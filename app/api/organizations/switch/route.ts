import { createServerSupabaseClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  apiSuccess,
  badRequest,
  forbidden,
  unauthorized,
} from "@/lib/api-response";
import {
  ACTIVE_ORG_COOKIE_NAME,
  ACTIVE_ORG_COOKIE_OPTIONS,
  validateOrgMembership,
} from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  const rateLimit = await enforceRateLimit("orgs.switch.user", `u:${user.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { organization_id?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "POST /api/organizations/switch:parse");
  }

  const organizationId =
    typeof body?.organization_id === "string" ? body.organization_id.trim() : "";

  if (!organizationId) {
    return badRequest("organization_id is required");
  }

  // Verify that the user is actually a member of this organization
  const { isMember, role } = await validateOrgMembership(
    supabase,
    user.id,
    organizationId
  );

  if (!isMember) {
    return forbidden("You do not have access to this organization");
  }

  // Update active organization cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, organizationId, ACTIVE_ORG_COOKIE_OPTIONS);

  return apiSuccess({
    success: true,
    active_organization_id: organizationId,
    role,
  });
}
