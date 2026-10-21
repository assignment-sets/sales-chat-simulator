import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { validateChatAccess } from "@/lib/chat-auth";

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
  const chatCheck = await validateChatAccess(
    supabase,
    id,
    user.id,
    "id",
    "POST /api/chats/[id]/messages:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  // 2. Parse incoming message body
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

  // 3. Atomically persist user message
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

  return apiSuccess({ message }, 201);
}
