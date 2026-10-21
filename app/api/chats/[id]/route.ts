import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  internalError,
  notFound,
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

  // Dual-check: verify chat exists, belongs to user's organization, and meets role visibility
  const chatCheck = await validateChatAccess<{
    id: string;
    product_name: string;
    product_description: string;
    organization_id?: string;
    user_id?: string;
    [key: string]: unknown;
  }>(
    supabase,
    id,
    user.id,
    "*",
    "GET /api/chats/[id]:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  // Fetch messages with dual scoping:
  // - For regular members, scope to chat_id AND user_id
  // - For owners/admins, scope to chat_id to review the entire simulation
  let messagesQuery = supabase
    .from("messages")
    .select("*")
    .eq("chat_id", id);

  if (chatCheck.role === "member") {
    messagesQuery = messagesQuery.eq("user_id", user.id);
  }

  const { data: messages, error: messagesError } = await messagesQuery.order("created_at", {
    ascending: true,
  });

  if (messagesError) {
    return internalError(
      "Failed to fetch messages",
      messagesError,
      "GET /api/chats/[id]:messages"
    );
  }

  return apiSuccess({
    chat: chatCheck.chat,
    messages: messages || [],
    role: chatCheck.role,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Verify chat access and permissions before deleting
  const chatCheck = await validateChatAccess<{
    id: string;
    organization_id?: string;
    user_id?: string;
  }>(
    supabase,
    id,
    user.id,
    "id, organization_id, user_id",
    "DELETE /api/chats/[id]:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  // Delete scoped by id AND (user_id for members, or organization_id for owners/admins)
  let deleteQuery = supabase.from("chats").delete().eq("id", id);

  if (chatCheck.role === "member") {
    deleteQuery = deleteQuery.eq("user_id", user.id);
  } else if (chatCheck.chat.organization_id) {
    deleteQuery = deleteQuery.eq("organization_id", chatCheck.chat.organization_id);
  }

  const { data: deletedRows, error } = await deleteQuery.select("id");

  if (error) {
    return internalError(
      "Failed to delete chat",
      error,
      "DELETE /api/chats/[id]"
    );
  }

  if (!deletedRows || deletedRows.length === 0) {
    return notFound("Chat not found");
  }

  return apiSuccess({ success: true });
}
