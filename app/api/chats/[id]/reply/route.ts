import { createServerSupabaseClient } from "@/utils/supabase/server";
import { groq, DEFAULT_GROQ_MODEL } from "@/lib/groq";
import {
  extractBubbles,
  formatGroqMessages,
  MessageItem,
  StructuredProspectResponse,
} from "@/lib/prompt";
import { evaluateSimulationTurn } from "@/lib/jev";
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

  // Helper to persist bubbles with staggered timestamps and token tracking
  const persistAndReturnBubbles = async (
    rawBubbles: unknown[],
    sentiment?: string,
    objectionType?: string,
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  ) => {
    let cleanBubbles = rawBubbles
      .flatMap(extractBubbles)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    if (cleanBubbles.length === 0) {
      cleanBubbles = ["Thanks for the info! Tell me a bit more."];
    }

    if (cleanBubbles.length > 3) {
      cleanBubbles = cleanBubbles.slice(0, 3);
    }

    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || (promptTokens + completionTokens);

    const baseTime = Date.now();
    const rowsToInsert = cleanBubbles.map((bubble, index) => ({
      chat_id: id,
      user_id: user.id,
      role: "assistant" as const,
      content: bubble,
      created_at: new Date(baseTime + index * 1000).toISOString(),
      prompt_tokens: index === 0 ? promptTokens : 0,
      completion_tokens: index === 0 ? completionTokens : 0,
      total_tokens: index === 0 ? totalTokens : 0,
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

    // 6. Evaluate conversational status and performance via TypeSafe AI Jev
    let evaluationResult = null;
    try {
      evaluationResult = await evaluateSimulationTurn({
        productName: chat.product_name,
        productDescription: chat.product_description,
        history: [...history, ...savedMessages],
      });

      // Update chat record with evaluation outcome and score
      const updatePayload: Record<string, unknown> = {
        score: Math.round(evaluationResult.score),
        evaluation_outcome: evaluationResult.outcome,
        evaluation_summary: evaluationResult,
      };

      if (evaluationResult.outcome === "deal_won") {
        updatePayload.status = "WON";
      } else if (evaluationResult.outcome === "deal_lost") {
        updatePayload.status = "LOST";
      }

      console.log(
        `[Chat Reply] Simulation ${id} evaluation: ${evaluationResult.outcome} | score=${evaluationResult.score}/5 | leadLostProb=${evaluationResult.leadLostProbability.toFixed(2)}`
      );

      const { error: updateChatErr } = await supabase
        .from("chats")
        .update(updatePayload)
        .eq("id", id);

      if (updateChatErr) {
        console.warn("[Chat Reply] Could not update chat status with evaluation:", updateChatErr);
      }
    } catch (evalErr) {
      console.warn("[Jev] Background turn evaluation error:", evalErr);
    }

    return apiSuccess({
      messages: savedMessages,
      sentiment,
      objection_type: objectionType,
      tokens_used: totalTokens,
      evaluation: evaluationResult,
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
      // Handled by extractBubbles below
    }

    const bubbles = extractBubbles(parsed.messages?.length ? parsed : rawContent);

    return await persistAndReturnBubbles(
      bubbles,
      parsed.buyer_sentiment,
      parsed.objection_type,
      completion.usage
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
      const recoveredBubbles = extractBubbles(failedGen);
      if (recoveredBubbles.length > 0) {
        return await persistAndReturnBubbles(recoveredBubbles);
      }
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
      const fallbackBubbles = extractBubbles(fallbackText);

      return await persistAndReturnBubbles(
        fallbackBubbles,
        undefined,
        undefined,
        fallbackCompletion.usage
      );
    } catch (fallbackErr) {
      return internalError(
        "Failed to generate prospect reply",
        fallbackErr,
        "POST /api/chats/[id]/reply:groq"
      );
    }
  }
}
