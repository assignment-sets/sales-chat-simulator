import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { cached } from "@/lib/cache";
import { memberChatsKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import { requireFeature } from "@/lib/entitlements";
import { getActiveOrganization } from "@/lib/tenant";

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

interface MemberChatsPayload extends Record<string, unknown> {
  simulations: Record<string, unknown>[];
  userId: string;
  organizationId: string;
}

class MemberChatsLoadError extends Error {
  readonly internal?: unknown;
  readonly context?: string;

  constructor(message: string, internal?: unknown, context?: string) {
    super(message);
    this.name = "MemberChatsLoadError";
    this.internal = internal;
    this.context = context;
  }
}

/**
 * Loads a member's simulations inside one organization. The cache key carries
 * both the org and the member, so tenants and members never share entries.
 */
async function loadMemberChats(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<MemberChatsPayload> {
  // Fetch all chats for this member within the active organization
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, product_name, product_description, status, score, evaluation_outcome, tokens_used, created_at, updated_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new MemberChatsLoadError(
      "Failed to fetch member simulations",
      error,
      "GET /api/dashboard/members/[userId]/chats"
    );
  }

  return {
    simulations: chats || [],
    userId,
    organizationId: orgId,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params;
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
    return forbidden("Viewing member activity is restricted to organization owners and admins");
  }

  // Enforce Pro/Scale plan tier requirement for Team Oversight Dashboard
  const featureGate = requireFeature(organization, "team_dashboard");
  if (!featureGate.ok) {
    return featureGate.response;
  }

  let payload: MemberChatsPayload;
  try {
    payload = await cached(
      memberChatsKey(organization.id, userId),
      CACHE_TTLS.memberChats,
      () => loadMemberChats(supabase, organization.id, userId)
    );
  } catch (error) {
    if (error instanceof MemberChatsLoadError) {
      return internalError(error.message, error.internal, error.context);
    }
    return internalError(
      "Failed to fetch member simulations",
      error,
      "GET /api/dashboard/members/[userId]/chats"
    );
  }

  return apiSuccess(payload);
}
