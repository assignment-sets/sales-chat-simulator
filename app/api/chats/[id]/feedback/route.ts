import { createServerSupabaseClient } from "@/utils/supabase/server";
import { groq, DEFAULT_GROQ_MODEL, isGroqAbortError } from "@/lib/groq";
import {
  badRequest,
  clientClosed,
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
import { checkAiTokenCeiling, recordAiUsage } from "@/lib/ai-usage";
import type { AiTokenUsage } from "@/lib/ai-usage";
import { invalidate } from "@/lib/cache";
import { dashboardKey, transcriptKey } from "@/lib/cache/keys";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Streaming plus persistence has to fit inside the platform budget. Vercel's
// default is 300s, which is far too generous for a ~1-2k token completion.
export const maxDuration = 90;

// Bounds the wait for the first streamed byte.
const GROQ_FIRST_BYTE_TIMEOUT_MS = 15_000;
// The SDK timeout is cleared once headers arrive, so a stalled stream needs its
// own watchdog: no chunk for this long means the upstream request is stuck.
const STREAM_IDLE_TIMEOUT_MS = 20_000;
// Hard ceiling for a single coaching generation, independent of maxDuration.
const STREAM_TOTAL_TIMEOUT_MS = 60_000;

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  // The client is already gone: do not start any billable work.
  if (request.signal.aborted) {
    return clientClosed();
  }

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

  // 4. Enforce the organization's monthly AI usage safety ceiling before any
  //    billable work happens. Returns 403 when the ledger is exhausted.
  const ceiling = await checkAiTokenCeiling(supabase, chat.organization_id);
  if (!ceiling.ok) {
    return ceiling.response;
  }

  // 5. Fetch full conversation transcript
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

  // 6. Format transcript and feed Jev's evaluation outcome for consistency
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

  // 7. Prevent concurrent generations for the same simulation
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
    // 8. Invoke Groq with streaming enabled. `signal` aborts generation on
    //    client disconnect; the timeout bounds the wait for the first byte only
    //    (the SDK clears it once headers arrive), hence the watchdog below.
    const completion = await groq.chat.completions.create(
      {
        model: DEFAULT_GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        stream: true,
      },
      {
        signal: request.signal,
        timeout: GROQ_FIRST_BYTE_TIMEOUT_MS,
        maxRetries: 0,
      }
    );

    // 9. Pipe stream to the client and save completed text to the database.
    //    Both `cancel()` (consumer cancelled) and `request.signal` (client
    //    disconnected) abort the upstream Groq request, so an abandoned modal
    //    stops consuming tokens immediately.
    let cancelled = false;
    let settled = false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullFeedbackText = "";
        let usage: AiTokenUsage | null = null;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let closed = false;
        const startedAt = Date.now();

        const clearIdleTimer = () => {
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Consumer is already gone; nothing left to close.
          }
        };

        const safeError = (error: unknown) => {
          if (closed) return;
          closed = true;
          try {
            controller.error(error);
          } catch {
            // Consumer is already gone; nothing left to signal.
          }
        };

        const abortUpstream = (reason: string) => {
          if (settled) return;
          console.warn(`[Feedback] Aborting Groq stream for chat=${id}: ${reason}`);
          completion.controller.abort();
        };

        const onRequestAbort = () => {
          cancelled = true;
          abortUpstream("client disconnected");
        };

        const armIdleTimer = () => {
          clearIdleTimer();
          idleTimer = setTimeout(
            () => abortUpstream(`no chunk for ${STREAM_IDLE_TIMEOUT_MS}ms`),
            STREAM_IDLE_TIMEOUT_MS
          );
        };

        request.signal.addEventListener("abort", onRequestAbort, { once: true });
        if (request.signal.aborted) {
          cancelled = true;
        }

        let completed = false;
        let abortedByWatchdog = false;

        try {
          armIdleTimer();

          for await (const chunk of completion) {
            if (cancelled || request.signal.aborted) {
              cancelled = true;
              break;
            }

            if (Date.now() - startedAt > STREAM_TOTAL_TIMEOUT_MS) {
              abortedByWatchdog = true;
              abortUpstream(`exceeded ${STREAM_TOTAL_TIMEOUT_MS}ms total deadline`);
              break;
            }

            armIdleTimer();

            if (chunk.x_groq?.usage) {
              usage = chunk.x_groq.usage;
            }

            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullFeedbackText += content;
              try {
                controller.enqueue(encoder.encode(content));
              } catch {
                // The consumer vanished between our checks. Stop paying.
                cancelled = true;
                abortUpstream("controller closed during enqueue");
                break;
              }
            }
          }

          completed = !cancelled && !abortedByWatchdog && !request.signal.aborted;
        } catch (streamErr) {
          if (cancelled || request.signal.aborted || isGroqAbortError(streamErr)) {
            console.warn(
              `[Feedback] Stream ended early for chat=${id}:`,
              streamErr instanceof Error ? streamErr.message : streamErr
            );
          } else {
            console.error("[Feedback] Streaming error:", streamErr);
            safeError(streamErr);
          }
        } finally {
          settled = true;
          clearIdleTimer();
          request.signal.removeEventListener("abort", onRequestAbort);
        }

        // Tokens consumed before an abort were still billed, so meter whatever
        // usage Groq reported. Never throws.
        await recordAiUsage(supabase, chat.organization_id, usage);

        if (cancelled || request.signal.aborted) {
          // Client is gone: never persist a partial coaching report.
          console.warn(
            `[Feedback] Client disconnected; discarding partial feedback for chat=${id}.`
          );
          await releaseLock();
          return;
        }

        if (!completed) {
          safeError(new Error("AI coaching stream was interrupted. Please try again."));
          await releaseLock();
          return;
        }

        safeClose();

        // 10. Persist feedback to database
        const trimmed = fullFeedbackText.trim();
        if (trimmed.length > 0) {
          try {
            const { error: persistError } = await supabase
              .from("chats")
              .update({ ai_feedback: trimmed })
              .eq("id", id);

            if (persistError) {
              console.warn("[Feedback] Failed to persist AI feedback to database:", persistError);
            } else if (chat.organization_id) {
              // Only invalidate once the write actually succeeded. Awaiting is
              // safe: `invalidate` never throws and the lock is released below.
              await invalidate(
                dashboardKey(chat.organization_id),
                transcriptKey(chat.organization_id, id)
              );
            }
          } catch (dbErr) {
            console.warn("[Feedback] Failed to persist AI feedback to database:", dbErr);
          }
        }

        await releaseLock();
      },

      cancel(reason) {
        // Consumer cancelled the body (modal closed, tab gone, reader.cancel()).
        if (settled) {
          return;
        }
        cancelled = true;
        console.warn(
          `[Feedback] Stream cancelled by client for chat=${id}:`,
          reason ?? "no reason"
        );
        completion.controller.abort();
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

    if (request.signal.aborted || isGroqAbortError(err)) {
      console.warn(`[Feedback] Generation aborted for chat=${id}; client is gone.`);
      return clientClosed();
    }

    return internalError(
      "Failed to stream AI coaching feedback",
      err,
      "POST /api/chats/[id]/feedback"
    );
  }
}
