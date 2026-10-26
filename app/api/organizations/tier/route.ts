import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getActiveOrganization } from "@/lib/tenant";
import { normalizePlanTier, PlanTier } from "@/lib/plans";

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

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ plan_tier: targetTier })
    .eq("id", organization.id);

  if (updateError) {
    return internalError("Failed to update organization plan", updateError);
  }

  return apiSuccess({
    organization_id: organization.id,
    plan_tier: targetTier,
  });
}
