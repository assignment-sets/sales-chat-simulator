import { createServerSupabaseClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { normalizePlanTier } from "@/lib/plans";
import { enforceRateLimits } from "@/lib/rate-limit";
import {
  ACTIVE_ORG_COOKIE_NAME,
  ACTIVE_ORG_COOKIE_OPTIONS,
  getUserOrganizations,
  validateOrgMembership,
} from "@/lib/tenant";
import { invalidate, invalidateOrgMembers } from "@/lib/cache";
import { dashboardKey, pricingKey } from "@/lib/cache/keys";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Dual-check tenant scoping: caller must be member of this org
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  if (role !== "owner" && role !== "admin") {
    return forbidden("Only organization owners and admins can rename the organization");
  }

  // Throttle organization rename operations
  const rateLimit = await enforceRateLimits(["orgs.rename.org", `o:${orgId}`]);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "PATCH /api/organizations/[id]:parse");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return badRequest("Organization name is required");
  }

  if (name.length < 2 || name.length > 50) {
    return badRequest("Organization name must be between 2 and 50 characters");
  }

  const { data: updatedOrg, error: updateError } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", orgId)
    .select("id, name, slug, plan_tier, created_at, updated_at")
    .maybeSingle();

  if (updateError) {
    return internalError(
      "Failed to update organization",
      updateError,
      "PATCH /api/organizations/[id]:update"
    );
  }

  if (!updatedOrg) {
    return notFound("Organization not found");
  }

  await invalidateOrgMembers(orgId);

  return apiSuccess({
    organization: {
      ...updatedOrg,
      plan_tier: normalizePlanTier(updatedOrg.plan_tier),
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Dual-check tenant scoping: caller must be owner
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  if (role !== "owner") {
    return forbidden("Only the organization owner can delete the organization");
  }

  // Rate limit deletion attempts per user
  const rateLimit = await enforceRateLimits(["orgs.delete.user", `u:${user.id}`]);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // Sole workspace check: cannot delete if it is the user's only workspace
  const userMemberships = await getUserOrganizations(supabase, user.id);
  if (userMemberships.length <= 1) {
    return badRequest(
      "You cannot delete your only workspace. To delete all your data, please use Delete Account in Account Settings."
    );
  }

  // Look up target organization for confirmation verification
  const { data: targetOrg, error: fetchError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();

  if (fetchError || !targetOrg) {
    return notFound("Organization not found");
  }

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "DELETE /api/organizations/[id]:parse");
  }

  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  if (confirmation !== targetOrg.name) {
    return badRequest(`Confirmation does not match. Please enter "${targetOrg.name}" to confirm.`);
  }

  // Delete organization (cascades to members, invitations, usage, and chats)
  const { data: deletedRows, error: deleteError } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId)
    .select("id");

  if (deleteError) {
    return internalError(
      "Failed to delete organization",
      deleteError,
      "DELETE /api/organizations/[id]:delete"
    );
  }

  if (!deletedRows || deletedRows.length === 0) {
    return notFound("Organization could not be deleted");
  }

  // Invalidate tenant-scoped caches
  await invalidate(dashboardKey(orgId), pricingKey(orgId));

  // Determine fallback active organization and update cookie if the deleted one was active
  let nextOrgId: string | null = null;
  const remainingMemberships = userMemberships.filter((m) => m.organization_id !== orgId);
  if (remainingMemberships.length > 0) {
    nextOrgId = remainingMemberships[0].organization_id;
  }

  try {
    const cookieStore = await cookies();
    const activeCookie = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value;
    if (activeCookie === orgId) {
      if (nextOrgId) {
        cookieStore.set(ACTIVE_ORG_COOKIE_NAME, nextOrgId, ACTIVE_ORG_COOKIE_OPTIONS);
      } else {
        cookieStore.delete(ACTIVE_ORG_COOKIE_NAME);
      }
    }
  } catch {
    // Non-fatal if cookies cannot be set in certain test or static rendering contexts
  }

  return apiSuccess({
    success: true,
    deleted_organization_id: orgId,
    next_organization_id: nextOrgId,
  });
}
