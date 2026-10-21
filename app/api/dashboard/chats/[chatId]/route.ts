import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "@/lib/api-response";
import { getActiveOrganization } from "@/lib/tenant";

interface RouteContext {
  params: Promise<{
    chatId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
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
    return forbidden("Viewing conversation transcripts is restricted to organization owners and admins");
  }

  // 1. Fetch simulation metadata verifying it belongs to this active organization
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, product_name, product_description, status, score, evaluation_outcome, tokens_used, created_at, user_id")
    .eq("id", chatId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (chatError) {
    return internalError(
      "Failed to fetch simulation",
      chatError,
      "GET /api/dashboard/chats/[chatId]:chat"
    );
  }

  if (!chat) {
    return notFound("Simulation not found in this organization");
  }

  // 2. Fetch full message history for this simulation
  const { data: messages, error: msgsError } = await supabase
    .from("messages")
    .select("id, role, content, created_at, prompt_tokens, completion_tokens, total_tokens")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgsError) {
    return internalError(
      "Failed to fetch conversation history",
      msgsError,
      "GET /api/dashboard/chats/[chatId]:messages"
    );
  }

  return apiSuccess({
    chat,
    messages: messages || [],
  });
}
