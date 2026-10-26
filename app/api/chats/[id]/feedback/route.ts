import { createServerSupabaseClient } from "@/utils/supabase/server";
import { groq, DEFAULT_GROQ_MODEL } from "@/lib/groq";
import {
  badRequest,
  internalError,
  rateLimited,
  unauthorized,
} from "@/lib/api-response";
import { validateChatAccess } from "@/lib/chat-auth";
import { requireOrgFeature } from "@/lib/entitlements";
import {
  acquireChatLock,
  enforceRateLimits,
  releaseChatLock,
} from "@/lib/rate-limit";

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

  // 1. Dual-check tenant access: verify chat belongs to user & org
  const chatCheck = await validateChatAccess<{
    id: string;
    organization_id?: string;
    product_name: string;
    product_description: string;
    status: string;
    score: number | null;
    evaluation_outcome: string | null;
    evaluation_summary: Record<string, unknown> | null;
    ai_feedback: string | null;
    tokens_used: number | null;
  }>(
    supabase,
    id,
    user.id,
    "id, organization_id, product_name, product_description, status, score, evaluation_outcome, evaluation_summary, ai_feedback, tokens_used"
  );

  if (!chatCheck.ok) {
    return chatCheck.response;
  }

  const chat = chatCheck.chat;

  // Enforce Pro/Scale plan tier requirement for Detailed AI Coaching Feedback
  const featureGate = await requireOrgFeature(
    supabase,
    chat.organization_id,
    "detailed_ai_feedback"
  );
  if (!featureGate.ok) {
    return featureGate.response;
  }

  // 2. Fast-path: return cached feedback immediately if already generated
  if (chat.ai_feedback && chat.ai_feedback.trim().length > 0) {
    return new Response(chat.ai_feedback, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Cached": "true",
      },
    });
  }

  // 3. Throttle expensive coaching generations (cached responses above are free)
  const rateLimit = await enforceRateLimits(
    ["ai.feedback.user", `u:${user.id}`],
    ["ai.feedback.user.daily", `u:${user.id}`]
  );
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // 4. Fetch full conversation transcript
  const { data: messages, error: msgsError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  if (msgsError) {
    return internalError(
      "Failed to retrieve conversation history",
      msgsError,
      "POST /api/chats/[id]/feedback:messages"
    );
  }

  if (!messages || messages.length === 0) {
    return badRequest("Cannot generate feedback for an empty simulation.");
  }

  // 4. Format transcript and feed Jev's evaluation outcome for consistency
  const dialogue = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const speaker = m.role === "user" ? "Sales Rep" : "Potential Customer";
      return `${speaker}: ${m.content.trim()}`;
    })
    .join("\n\n");

  const jevOutcomeLabel =
    chat.evaluation_outcome === "deal_won" || chat.status === "WON"
      ? "Deal Won (Customer agreed to proceed/pilot)"
      : chat.evaluation_outcome === "deal_lost" || chat.status === "LOST"
      ? "Lead Lost (Customer disengaged/rejected/terminated)"
      : "In Progress";

  const jevEvaluationBlock = `Automated Evaluation Outcome:
- Decision: ${jevOutcomeLabel}
- Jev Score: ${chat.score != null ? `${chat.score} / 5` : "Unscored"}`;

  const systemPrompt = `You are an elite B2B sales coach analyzing a sales practice simulation transcript.
Your job is to provide concise, message-specific, actionable coaching in clean Markdown.
DO NOT write bulky paragraphs, intros, or conversational filler. Keep everything crisp, non-intimidating, and directly applicable.

FORMAT STRICTLY AS FOLLOWS:

### Executive Summary
[1-2 crisp sentences summarizing the rep's overall performance and whether it aligned with the final simulation outcome.]

### Message-Specific Critique
[Review the Sales Rep's messages chronologically. ONLY flag turns where the rep stumbled, showed poor tone, profanity, missed an objection, was defensive, or missed a closing opportunity. Do NOT flag routine pleasantries like "Hi", "Thanks", or "Goodbye". For each flagged turn, use this exact format:]

- **Turn Quoted**: "[Exact or partial snippet said by the rep]"
  - **Issue**: [1 concise sentence diagnosing why this turn was ineffective, impolite, or problematic]
  - **Recommended Script**: "[A concrete, polished alternative line the rep should say instead]"

### Key Action Items
[2-3 high-impact, actionable bullet points for what this rep must practice and improve on future calls]`;

  const userPrompt = `Product Offering: ${chat.product_name}
Context: ${chat.product_description}

${jevEvaluationBlock}

Full Conversation Transcript:
${dialogue}`;

  // 5. Prevent concurrent generations for the same simulation
  const lockKey = `feedback:${id}`;
  const lockAcquired = await acquireChatLock(lockKey, 120);
  if (!lockAcquired) {
    return rateLimited(5000);
  }

  let lockReleased = false;
  const releaseLock = async () => {
    if (lockReleased) {
      return;
    }
    lockReleased = true;
    await releaseChatLock(lockKey);
  };

  try {
    // 6. Invoke Groq with streaming enabled
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      stream: true,
    });

    // 7. Pipe stream directly to client and save completed text to database
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullFeedbackText = "";

        try {
          try {
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                fullFeedbackText += content;
                controller.enqueue(encoder.encode(content));
              }
            }
          } catch (streamErr) {
            console.error("[Feedback] Streaming error:", streamErr);
            controller.error(streamErr);
            return;
          }

          controller.close();

          // 8. Persist feedback to database asynchronously
          const trimmed = fullFeedbackText.trim();
          if (trimmed.length > 0) {
            try {
              await supabase
                .from("chats")
                .update({ ai_feedback: trimmed })
                .eq("id", id);
            } catch (dbErr) {
              console.warn("[Feedback] Failed to persist AI feedback to database:", dbErr);
            }
          }
        } finally {
          await releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    await releaseLock();
    return internalError(
      "Failed to stream AI coaching feedback",
      err,
      "POST /api/chats/[id]/feedback"
    );
  }
}
