import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { checkQuota } from "@/lib/entitlements";
import { enforceRateLimits } from "@/lib/rate-limit";
import { validateOrgMembership } from "@/lib/tenant";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Dual-check: verify caller is a member of this organization
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  // 1. Fetch organization members (with profile info if available)
  let members: Array<{
    id: string;
    organization_id: string;
    user_id: string;
    role: string;
    created_at: string;
    email?: string;
    full_name?: string;
  }> = [];

  const { data: rpcMembers, error: rpcError } = await supabase.rpc(
    "get_organization_members",
    { target_org_id: orgId }
  );

  if (!rpcError && rpcMembers) {
    members = rpcMembers;
  } else {
    // Fallback if RPC migration hasn't run yet
    const { data: directMembers, error: membersError } = await supabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (membersError) {
      return internalError("Failed to fetch organization members", membersError, "GET /api/organizations/[id]/members");
    }
    members = directMembers || [];
  }

  // 2. If caller is owner or admin, fetch pending invitations
  let invitations: Array<{ id: string; email: string; role: string; created_at: string }> = [];
  if (role === "owner" || role === "admin") {
    const { data: inviteRows, error: inviteError } = await supabase
      .from("organization_invitations")
      .select("id, email, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!inviteError && inviteRows) {
      invitations = inviteRows;
    }
  }

  return apiSuccess({
    members: members || [],
    invitations,
    current_user_role: role,
    current_user_id: user.id,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: orgId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Dual-check: verify caller is owner or admin
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || (role !== "owner" && role !== "admin")) {
    return forbidden("Only organization owners and admins can invite new members");
  }

  // Throttle invitations per organization before parsing the body
  const rateLimit = await enforceRateLimits(
    ["orgs.invite.org", `o:${orgId}`],
    ["orgs.invite.org.daily", `o:${orgId}`]
  );
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "POST /api/organizations/[id]/members:parse");
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const targetRole = body?.role === "admin" ? "admin" : "member";

  if (!email || !email.includes("@")) {
    return badRequest("A valid email address is required");
  }

  // Enforce team seat quota for this organization's plan tier
  const quota = await checkQuota(supabase, {
    type: "team_seats",
    organizationId: orgId,
  });
  if (!quota.ok) {
    return quota.response;
  }

  // Call the database function to add or invite the member
  const { data: result, error: rpcError } = await supabase.rpc("invite_or_add_org_member", {
    target_org_id: orgId,
    target_email: email,
    target_role: targetRole,
  });

  if (rpcError) {
    return internalError(
      "Failed to invite member",
      rpcError,
      "POST /api/organizations/[id]/members:rpc"
    );
  }

  return apiSuccess({ success: true, result }, 201);
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

  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  const targetUserId = searchParams.get("userId");

  if (!memberId && !targetUserId) {
    return badRequest("memberId or userId query parameter is required");
  }

  // Fetch the membership record being targeted
  let targetQuery = supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("organization_id", orgId);

  if (memberId) {
    targetQuery = targetQuery.eq("id", memberId);
  } else if (targetUserId) {
    targetQuery = targetQuery.eq("user_id", targetUserId);
  }

  const { data: targetMember, error: targetError } = await targetQuery.maybeSingle();

  if (targetError || !targetMember) {
    return notFound("Member not found in this organization");
  }

  const isSelf = targetMember.user_id === user.id;

  // Authorization check: either member is leaving themselves, or caller is owner/admin
  if (!isSelf && role !== "owner" && role !== "admin") {
    return forbidden("You do not have permission to remove members from this organization");
  }

  // Admins cannot remove the owner
  if (targetMember.role === "owner" && role !== "owner") {
    return forbidden("Admins cannot remove the organization owner");
  }

  // Prevent sole owner from leaving without transferring ownership
  if (isSelf && targetMember.role === "owner") {
    const { count } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "owner");

    if (count !== null && count <= 1) {
      return badRequest("Cannot leave as the sole owner. Please transfer ownership or delete the organization.");
    }
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", targetMember.id)
    .eq("organization_id", orgId)
    .select("id");

  if (deleteError) {
    return internalError("Failed to remove member", deleteError, "DELETE /api/organizations/[id]/members");
  }

  if (!deletedRows || deletedRows.length === 0) {
    return notFound("Member could not be deleted");
  }

  return apiSuccess({ success: true });
}
