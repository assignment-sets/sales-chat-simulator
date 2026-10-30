import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { validateChatAccess } from "@/lib/chat-auth";
import { invalidateChat } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/rate-limit";

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

  const orgId = chatCheck.chat.organization_id;
  if (orgId) {
    await invalidateChat(orgId, id, chatCheck.chat.user_id);
  }

  return apiSuccess({ success: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // 1. Throttle simulation updates per user
  const rateLimit = await enforceRateLimit("chats.update.user", `u:${user.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // 2. Dual-check: verify chat exists and caller is authorized (author member or org owner/admin)
  const chatCheck = await validateChatAccess<{
    id: string;
    product_name: string;
    product_description: string;
    status: string;
    evaluation_outcome?: string | null;
    organization_id?: string;
    user_id?: string;
  }>(
    supabase,
    id,
    user.id,
    "id, product_name, product_description, status, evaluation_outcome, organization_id, user_id",
    "PATCH /api/chats/[id]:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  // 3. Parse and validate JSON update payload
  let body: {
    product_name?: unknown;
    product_description?: unknown;
    status?: unknown;
    action?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "PATCH /api/chats/[id]:parse");
  }

  const updates: {
    product_name?: string;
    product_description?: string;
    status?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  // Handle renaming
  if (body.product_name !== undefined) {
    if (typeof body.product_name !== "string" || !body.product_name.trim()) {
      return badRequest("product_name must be a non-empty string");
    }
    const cleanName = body.product_name.trim();
    if (cleanName.length > 120) {
      return badRequest("product_name must be 120 characters or fewer");
    }
    updates.product_name = cleanName;
  }

  if (body.product_description !== undefined) {
    if (typeof body.product_description !== "string") {
      return badRequest("product_description must be a string");
    }
    const cleanDesc = body.product_description.trim();
    if (cleanDesc.length > 2000) {
      return badRequest("product_description must be 2,000 characters or fewer");
    }
    updates.product_description = cleanDesc;
  }

  // Handle archive / resume state transitions
  const statusInput = typeof body.status === "string" ? body.status.toUpperCase() : null;
  const actionInput = typeof body.action === "string" ? body.action.toLowerCase() : null;

  if (statusInput === "ARCHIVED" || actionInput === "archive") {
    updates.status = "ARCHIVED";
  } else if (statusInput === "ACTIVE" || actionInput === "resume") {
    // Aligned interview decision: restoring an archived chat preserves its terminal outcome if present
    if (chatCheck.chat.evaluation_outcome === "deal_won") {
      updates.status = "WON";
    } else if (chatCheck.chat.evaluation_outcome === "deal_lost") {
      updates.status = "LOST";
    } else {
      updates.status = "ACTIVE";
    }
  } else if (statusInput !== null || actionInput !== null) {
    return badRequest("Invalid status or action. Supported: archive/ARCHIVED, resume/ACTIVE");
  }

  // Reject empty update attempts
  if (!updates.product_name && updates.product_description === undefined && !updates.status) {
    return badRequest(
      "At least one valid field (product_name, product_description, status, or action) must be provided"
    );
  }

  // 4. Update scoped by id AND (user_id for members, or organization_id for owners/admins)
  let updateQuery = supabase
    .from("chats")
    .update(updates)
    .eq("id", id);

  if (chatCheck.role === "member") {
    updateQuery = updateQuery.eq("user_id", user.id);
  } else if (chatCheck.chat.organization_id) {
    updateQuery = updateQuery.eq("organization_id", chatCheck.chat.organization_id);
  }

  const { data: updatedChat, error: updateError } = await updateQuery
    .select(
      "id, product_name, product_description, status, score, evaluation_outcome, user_id, organization_id, created_at, updated_at"
    )
    .single();

  if (updateError || !updatedChat) {
    return internalError(
      "Failed to update chat",
      updateError,
      "PATCH /api/chats/[id]"
    );
  }

  // 5. Invalidate relevant tenant and member caches
  const orgId = chatCheck.chat.organization_id;
  if (orgId) {
    await invalidateChat(orgId, id, chatCheck.chat.user_id);
  }

  return apiSuccess({ chat: updatedChat });
}
