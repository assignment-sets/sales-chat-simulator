import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { getActiveOrganization } from "@/lib/tenant";
import { normalizePlanTier, PlanTier } from "@/lib/plans";
import { enforceRateLimit } from "@/lib/rate-limit";
import { invalidateOrgTier } from "@/lib/cache";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  const activeContext = await getActiveOrganization(supabase, user.id, user.email);
  if (!activeContext) {
    return internalError("Failed to resolve active organization");
  }

  const { organization, role } = activeContext;

  if (role !== "owner" && role !== "admin") {
    return forbidden("Only organization owners and admins can switch subscription plans");
  }

  // Throttle billing-sensitive plan changes
  const rateLimit = await enforceRateLimit("orgs.tier.org", `o:${organization.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { plan_tier?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON body", err);
  }

  if (typeof body?.plan_tier !== "string") {
    return badRequest("plan_tier is required");
  }

  const targetTier: PlanTier = normalizePlanTier(body.plan_tier);

  // Self-service plan upgrade guard:
  // In production (and by default), self-service tier upgrades are disabled pending Stripe/billing integration.
  const allowSelfServe = process.env.ALLOW_SELF_SERVE_TIER_SWITCH === "true";
  if (!allowSelfServe) {
    return forbidden(
      "Self-service plan upgrades are currently disabled pending billing integration. Please contact sales to upgrade your plan."
    );
  }

  // When self-serve is explicitly enabled in dev/test, execute with service-role admin client
  const adminClient = createAdminSupabaseClient() || supabase;

  // Call secure RPC to update organization plan tier
  const { data: result, error: rpcError } = await adminClient.rpc(
    "update_organization_plan_tier",
    {
      target_org_id: organization.id,
      new_tier: targetTier,
    }
  );

  if (rpcError) {
    return internalError(
      "Failed to update organization plan",
      rpcError,
      "POST /api/organizations/tier"
    );
  }

  await invalidateOrgTier(organization.id);

  return apiSuccess({
    organization_id: organization.id,
    plan_tier: targetTier,
    result,
  });
}
