import { createServerSupabaseClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { normalizePlanTier, MAX_OWNED_ORGS_PER_USER } from "@/lib/plans";
import { enforceRateLimits } from "@/lib/rate-limit";
import {
  ACTIVE_ORG_COOKIE_NAME,
  ACTIVE_ORG_COOKIE_OPTIONS,
  getActiveOrganization,
} from "@/lib/tenant";

export async function GET() {
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
    return internalError("Failed to resolve organization context");
  }

  return apiSuccess({
    active_organization: activeContext.organization,
    role: activeContext.role,
    organizations: activeContext.allOrganizations,
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Throttle organization creation (prevents free-tier quota farming)
  const rateLimit = await enforceRateLimits(
    ["orgs.create.user", `u:${user.id}`],
    ["orgs.create.user.daily", `u:${user.id}`]
  );
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "POST /api/organizations:parse");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return badRequest("Organization name is required");
  }

  if (name.length < 2 || name.length > 50) {
    return badRequest("Organization name must be between 2 and 50 characters");
  }

  // Cap owned organizations so one user cannot reset free-tier quotas by creating new workspaces
  const { count: ownedOrgCount, error: ownedOrgError } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner");

  if (ownedOrgError) {
    return internalError(
      "Failed to verify organization ownership limit",
      ownedOrgError,
      "POST /api/organizations:ownedCount"
    );
  }

  if ((ownedOrgCount ?? 0) >= MAX_OWNED_ORGS_PER_USER) {
    return forbidden(
      `You can own up to ${MAX_OWNED_ORGS_PER_USER} organizations. Contact support if you need more.`
    );
  }

  const cleanSlug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).substring(2, 8)}`;

  // Create organization + owner membership atomically via RPC
  const { data: result, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    { org_name: name, org_slug: cleanSlug }
  );

  if (rpcError || !result) {
    return internalError("Failed to create organization", rpcError, "POST /api/organizations:create");
  }

  const org = {
    id: result.id,
    name: result.name,
    slug: result.slug,
    plan_tier: normalizePlanTier(result.plan_tier),
    created_by: result.created_by,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };

  // Set newly created org as active in cookies
  try {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE_NAME, org.id, ACTIVE_ORG_COOKIE_OPTIONS);
  } catch (err) {
    console.warn("Could not set active org cookie in POST /api/organizations:", err);
  }

  return apiSuccess(
    {
      organization: org,
      role: result.role,
    },
    201
  );
}
