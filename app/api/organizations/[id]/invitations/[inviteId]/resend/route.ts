import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import {
  apiSuccess,
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
    inviteId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id: orgId, inviteId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Dual-check tenant scoping: caller must be owner or admin
  const { isMember, role } = await validateOrgMembership(supabase, user.id, orgId);
  if (!isMember || !role) {
    return notFound("Organization not found");
  }

  if (role !== "owner" && role !== "admin") {
    return forbidden("Only organization owners and admins can resend invitations");
  }

  // Throttle invite resends per organization
  const rateLimit = await enforceRateLimits(["orgs.invite.resend", `o:${orgId}`]);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // Call the atomic resend helper RPC to refresh the token and reset expiry to +7 days
  const { data: result, error: rpcError } = await supabase.rpc(
    "resend_organization_invitation",
    {
      target_org_id: orgId,
      target_invite_id: inviteId,
    }
  );

  if (rpcError) {
    const errorMsg = rpcError.message || "";
    if (errorMsg.includes("Invitation not found")) {
      return notFound("Invitation not found");
    }
    return internalError(
      "Failed to resend invitation",
      rpcError,
      "POST /api/organizations/[id]/invitations/[inviteId]/resend:rpc"
    );
  }

  await invalidateOrgMembers(orgId);

  const resObj = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const origin =
    request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = typeof resObj.token === "string" ? resObj.token : null;
  const inviteUrl = token ? `${origin.replace(/\/$/, "")}/invite/${token}` : null;
  const targetEmail = typeof resObj.email === "string" ? resObj.email : "";

  // Best-effort attempt to re-dispatch Supabase's built-in invite email if service role exists
  if (inviteUrl && targetEmail) {
    try {
      const adminClient = createAdminSupabaseClient();
      if (adminClient) {
        await adminClient.auth.admin.inviteUserByEmail(targetEmail, {
          redirectTo: inviteUrl,
        });
      }
    } catch {
      // Non-fatal
    }
  }

  return apiSuccess({
    success: true,
    invitation: {
      ...resObj,
      invite_url: inviteUrl,
    },
  });
}
