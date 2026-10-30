import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  ACTIVE_ORG_COOKIE_NAME,
  ACTIVE_ORG_COOKIE_OPTIONS,
  INVITATION_INTENT_COOKIE_NAME,
} from "@/lib/tenant";
import { invalidateOrgMembers } from "@/lib/cache";

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return badRequest("Invitation token is required");
  }

  const cleanToken = token.trim();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateLimit = await enforceRateLimit("invitations.view", `ip:${ip}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const supabase = await createServerSupabaseClient();

  const { data: invitation, error: rpcError } = await supabase.rpc(
    "get_invitation_by_token",
    { invite_token: cleanToken }
  );

  if (rpcError) {
    return internalError(
      "Failed to fetch invitation details",
      rpcError,
      "GET /api/invitations/[token]:rpc"
    );
  }

  if (!invitation) {
    return notFound("Invitation not found or has expired");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAlreadyMember = false;
  const invOrgId = (invitation as any)?.organization?.id;

  if (user && invOrgId) {
    const { data: memberRecord } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", invOrgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRecord) {
      isAlreadyMember = true;
    }
  }

  return apiSuccess({
    invitation,
    current_user: user ? { id: user.id, email: user.email } : null,
    is_already_member: isAlreadyMember,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return badRequest("Invitation token is required");
  }

  const cleanToken = token.trim();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized("Please sign in to accept this invitation");
  }

  const rateLimit = await enforceRateLimit("invitations.accept", `u:${user.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    invite_token: cleanToken,
  });

  if (error) {
    const errorMsg = error.message || "Failed to accept invitation";
    if (errorMsg.toLowerCase().includes("expired")) {
      return badRequest("This invitation has expired", error, "POST /api/invitations/[token]:expired");
    }
    if (errorMsg.toLowerCase().includes("issued for")) {
      return forbidden(errorMsg);
    }
    if (errorMsg.toLowerCase().includes("not found")) {
      return notFound("Invitation not found or already accepted");
    }
    return badRequest(errorMsg, error, "POST /api/invitations/[token]:rpc");
  }

  const result = data as {
    status: string;
    organization_id: string;
    role: string;
  };

  // Set active organization cookie so the user switches into the accepted workspace
  if (result?.organization_id) {
    const cookieStore = await cookies();
    cookieStore.set(
      ACTIVE_ORG_COOKIE_NAME,
      result.organization_id,
      ACTIVE_ORG_COOKIE_OPTIONS
    );
    cookieStore.delete(INVITATION_INTENT_COOKIE_NAME);

    // Invalidate cached member lists
    await invalidateOrgMembers(result.organization_id, user.id);
  }

  return apiSuccess({
    success: true,
    organization_id: result?.organization_id,
    role: result?.role,
  });
}
