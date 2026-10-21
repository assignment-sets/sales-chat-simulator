import { createServerSupabaseClient } from "@/utils/supabase/server";
import { groq, DEFAULT_GROQ_MODEL } from "@/lib/groq";
import {
  formatGroqMessages,
  MessageItem,
  StructuredProspectResponse,
} from "@/lib/prompt";
import {
  apiSuccess,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { validateChatAccess } from "@/lib/chat-auth";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
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

  // 1. Dual-check: verify chat exists and belongs to the authenticated user
  const chatCheck = await validateChatAccess<{
    id: string;
    product_name: string;
    product_description: string;
  }>(
    supabase,
    id,
    user.id,
    "id, product_name, product_description",
    "POST /api/chats/[id]/reply:validateChat"
  );
  if (!chatCheck.ok) {
    return chatCheck.response;
  }
  const chat = chatCheck.chat;

  // 2. Fetch full chronological history with dual scoping
  let historyQuery = supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("chat_id", id);

  if (chatCheck.role === "member") {
    historyQuery = historyQuery.eq("user_id", user.id);
  }

  const { data: historyRows, error: historyError } = await historyQuery
    .order("created_at", { ascending: true });

  if (historyError) {
    return internalError(
      "Failed to fetch conversation history",
      historyError,
      "POST /api/chats/[id]/reply:history"
    );
  }

  const history: MessageItem[] = (historyRows || []).map((row) => ({
    id: row.id,
    role: row.role as MessageItem["role"],
    content: row.content,
    created_at: row.created_at,
  }));

  // 3. Idempotency guard: only generate a reply if the latest message was from the user
  if (history.length === 0) {
    return apiSuccess({ messages: [] });
  }

  const lastMessage = history[history.length - 1];
  if (lastMessage.role !== "user") {
    // Prospect already replied to the latest turn
    return apiSuccess({ messages: [] });
  }

  // 4. Format prompt messages with coalesced turns for Groq
  const groqMessages = formatGroqMessages(
    chat.product_name,
    chat.product_description,
    history
  );

  // Helper to persist bubbles with staggered timestamps
  const persistAndReturnBubbles = async (
    rawBubbles: string[],
    sentiment?: string,
    objectionType?: string
  ) => {
    let cleanBubbles = rawBubbles
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    if (cleanBubbles.length === 0) {
      cleanBubbles = ["Thanks for the info! Tell me a bit more."];
    }

    if (cleanBubbles.length > 3) {
      cleanBubbles = cleanBubbles.slice(0, 3);
    }

    const baseTime = Date.now();
    const rowsToInsert = cleanBubbles.map((bubble, index) => ({
      chat_id: id,
      user_id: user.id,
      role: "assistant" as const,
      content: bubble,
      created_at: new Date(baseTime + index * 1000).toISOString(),
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("messages")
      .insert(rowsToInsert)
      .select("id, role, content, created_at");

    if (insertError) {
      return internalError(
        "Failed to persist prospect reply",
        insertError,
        "POST /api/chats/[id]/reply:persist"
      );
    }

    const savedMessages: MessageItem[] = (insertedRows || []).map((row) => ({
      id: row.id,
      role: row.role as MessageItem["role"],
      content: row.content,
      created_at: row.created_at,
    }));

    return apiSuccess({
      messages: savedMessages,
      sentiment,
      objection_type: objectionType,
    });
  };

  try {
    // 5. Invoke Groq with JSON Mode for structured multi-bubble output
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: groqMessages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_completion_tokens: 350,
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";
    let parsed: StructuredProspectResponse = { messages: [] };

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { messages: rawContent.split("\n").filter(Boolean) };
    }

    let bubbles: string[] = [];
    if (Array.isArray(parsed.messages)) {
      bubbles = parsed.messages;
    } else if (
      typeof (parsed as unknown as { message?: string }).message === "string"
    ) {
      bubbles = [(parsed as unknown as { message: string }).message];
    } else {
      bubbles = [rawContent];
    }

    return await persistAndReturnBubbles(
      bubbles,
      parsed.buyer_sentiment,
      parsed.objection_type
    );
  } catch (err: unknown) {
    console.warn("Groq JSON mode error, attempting recovery:", err);

    // 1. Check if Groq returned failed_generation in error payload
    const anyErr = err as Record<string, any>;
    const failedGen =
      anyErr?.error?.error?.failed_generation ||
      anyErr?.error?.failed_generation ||
      anyErr?.failed_generation;

    if (typeof failedGen === "string" && failedGen.trim().length > 0) {
      const recoveredBubbles = failedGen
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      return await persistAndReturnBubbles(recoveredBubbles);
    }

    // 2. Fallback: call Groq without response_format to salvage conversational turn
    try {
      const fallbackCompletion = await groq.chat.completions.create({
        model: DEFAULT_GROQ_MODEL,
        messages: groqMessages,
        temperature: 0.7,
        max_completion_tokens: 300,
      });

      const fallbackText =
        fallbackCompletion.choices[0]?.message?.content || "";
      const fallbackBubbles = fallbackText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return await persistAndReturnBubbles(fallbackBubbles);
    } catch (fallbackErr) {
      return internalError(
        "Failed to generate prospect reply",
        fallbackErr,
        "POST /api/chats/[id]/reply:groq"
      );
    }
  }
}
