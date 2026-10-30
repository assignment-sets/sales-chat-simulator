import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { enforceRateLimits } from "@/lib/rate-limit";
import { validateOrgMembership } from "@/lib/tenant";
import { invalidateOrgMembers } from "@/lib/cache";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
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

  // Dual-check tenant scoping: caller must be current owner
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  if (role !== "owner") {
    return forbidden("Only the organization owner can transfer ownership");
  }

  // Throttle ownership transfer attempts
  const rateLimit = await enforceRateLimits(["orgs.transfer.org", `o:${orgId}`]);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  let body: { newOwnerUserId?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest(
      "Invalid JSON request body",
      err,
      "POST /api/organizations/[id]/transfer-ownership:parse"
    );
  }

  const newOwnerUserId =
    typeof body?.newOwnerUserId === "string" ? body.newOwnerUserId.trim() : "";

  if (!newOwnerUserId) {
    return badRequest("newOwnerUserId is required");
  }

  if (newOwnerUserId === user.id) {
    return badRequest("You are already the owner of this organization");
  }

  // Execute atomic transfer RPC (elevates target to owner, demotes caller to admin)
  const { data: result, error: rpcError } = await supabase.rpc(
    "transfer_organization_ownership",
    {
      target_org_id: orgId,
      new_owner_user_id: newOwnerUserId,
    }
  );

  if (rpcError) {
    const errorMsg = rpcError.message || "";
    if (errorMsg.includes("Target user must be an active member")) {
      return badRequest(
        "Target user must be an active member of this organization before receiving ownership"
      );
    }
    return internalError(
      "Failed to transfer organization ownership",
      rpcError,
      "POST /api/organizations/[id]/transfer-ownership:rpc"
    );
  }

  // Invalidate member caches for both former and new owners
  await invalidateOrgMembers(orgId, user.id);
  await invalidateOrgMembers(orgId, newOwnerUserId);

  return apiSuccess({
    success: true,
    result,
  });
}
