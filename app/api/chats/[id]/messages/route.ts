import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { validateChatAccess } from "@/lib/chat-auth";
import { enforceRateLimits } from "@/lib/rate-limit";
import { invalidate } from "@/lib/cache";
import {
  dashboardKey,
  memberChatsKey,
  transcriptKey,
} from "@/lib/cache/keys";
import { MAX_USER_TURNS } from "@/lib/plans";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // 1. Dual-check: verify chat exists and belongs to the authenticated user
  const chatCheck = await validateChatAccess(
    supabase,
    id,
    user.id,
    "id",
    "GET /api/chats/[id]/messages:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

  // 2. Fetch messages with dual scoping:
  // - Regular members see their own simulation messages
  // - Owners and admins see all simulation messages
  let query = supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id);

  if (chatCheck.role === "member") {
    query = query.eq("user_id", user.id);
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  query = query.order("created_at", { ascending: false }).limit(limit);

  const { data: rows, error } = await query;

  if (error) {
    return internalError(
      "Failed to fetch messages",
      error,
      "GET /api/chats/[id]/messages"
    );
  }

  // Reverse to chronological order (oldest to newest)
  const messages = (rows || []).slice().reverse();
  const hasMore = (rows || []).length === limit;
  const nextCursor =
    rows && rows.length > 0 ? rows[rows.length - 1].created_at : null;

  return apiSuccess({
    messages,
    hasMore,
    nextCursor,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // 1. Dual-check: verify chat exists and belongs to user
  const chatCheck = await validateChatAccess<{
    id: string;
    status: string;
    organization_id?: string;
  }>(
    supabase,
    id,
    user.id,
    "id, status",
    "POST /api/chats/[id]/messages:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  // Prevent sending messages to archived simulations
  if (chatCheck.chat.status === "ARCHIVED") {
    return badRequest("Cannot send messages to an archived chat. Resume the chat to continue.");
  }

  // 2. Throttle message writes before parsing the body
  const rateLimit = await enforceRateLimits(
    ["messages.create.user", `u:${user.id}`],
    ["messages.create.user.hourly", `u:${user.id}`]
  );
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // 3. Parse incoming message body
  let body: { content?: unknown } = {};
  try {
    body = await request.json();
  } catch (err) {
    return badRequest(
      "Invalid JSON request body",
      err,
      "POST /api/chats/[id]/messages:parse"
    );
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return badRequest("Message content cannot be empty");
  }

  if (content.length > 2000) {
    return badRequest("Messages must be 2,000 characters or fewer");
  }

  // 4. Enforce simulation turn cap
  const { count: userTurnCount, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", id)
    .eq("role", "user");

  if (countError) {
    return internalError(
      "Failed to verify simulation turn limit",
      countError,
      "POST /api/chats/[id]/messages:count"
    );
  }

  if ((userTurnCount ?? 0) >= MAX_USER_TURNS) {
    return badRequest(
      `Turn cap of ${MAX_USER_TURNS} reached for this simulation. Start a new simulation to keep practicing.`
    );
  }

  // 5. Atomically persist user message
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      chat_id: id,
      user_id: user.id,
      role: "user",
      content,
    })
    .select("id, role, content, created_at")
    .single();

  if (insertError) {
    return internalError(
      "Failed to save message",
      insertError,
      "POST /api/chats/[id]/messages:insert"
    );
  }

  // The message was persisted: drop the aggregates and transcript that embed it.
  // Legacy chats may have no organization_id, so skip cache work in that case.
  const orgId = chatCheck.chat.organization_id;
  if (orgId) {
    await invalidate(
      dashboardKey(orgId),
      transcriptKey(orgId, id),
      memberChatsKey(orgId, user.id)
    );
  }

  return apiSuccess({ message }, 201);
}
