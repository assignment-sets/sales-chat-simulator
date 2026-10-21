"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessageList, MessageItem } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { notify } from "@/lib/toast";

export interface ChatRoomProps {
  chat: {
    id: string;
    product_name: string;
    product_description: string;
    status: string;
    score?: number | null;
    evaluation_outcome?: string | null;
    ai_feedback?: string | null;
  };
  initialMessages: MessageItem[];
  initialHasMore?: boolean;
}

export function ChatRoom({
  chat,
  initialMessages,
  initialHasMore = false,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [isProspectTyping, setIsProspectTyping] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Simulation Evaluation & Status State
  const [status, setStatus] = useState<string>(chat.status || "ACTIVE");
  const [evaluationOutcome, setEvaluationOutcome] = useState<string>(
    chat.evaluation_outcome ||
      (chat.status === "WON" ? "deal_won" : chat.status === "LOST" ? "deal_lost" : "in_progress")
  );
  const [score, setScore] = useState<number | null>(chat.score ?? null);

  const isConcluded =
    status === "WON" ||
    status === "LOST" ||
    evaluationOutcome === "deal_won" ||
    evaluationOutcome === "deal_lost";

  // Tasteful confetti burst helper on deal won
  const triggerCelebration = useCallback(() => {
    try {
      import("canvas-confetti").then((confettiModule) => {
        const confetti = confettiModule.default;
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#10b981", "#34d399", "#059669", "#6ee7b7", "#1e293b"],
          disableForReducedMotion: true,
        });
      });
    } catch (err) {
      console.warn("Could not trigger celebration confetti:", err);
    }
  }, []);

  // Turn management & typing cadence references
  const emptySettleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const pendingBubblesRef = useRef<MessageItem[]>([]);
  const isReplyInFlightRef = useRef(false);
  const draftTextRef = useRef<string>("");
  const pendingEvaluationRef = useRef<{ outcome: string; score: number; confidence: number } | null>(null);

  // Clean up all pending timers on unmount
  useEffect(() => {
    return () => {
      if (emptySettleTimerRef.current) clearTimeout(emptySettleTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      typingTimeoutRefs.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Flush any remaining unrevealed bubbles immediately (e.g. on user interruption)
  const flushPendingBubbles = useCallback(() => {
    typingTimeoutRefs.current.forEach((t) => clearTimeout(t));
    typingTimeoutRefs.current = [];

    if (pendingBubblesRef.current.length > 0) {
      setMessages((prev) => [...prev, ...pendingBubblesRef.current]);
      pendingBubblesRef.current = [];
    }
    setIsProspectTyping(false);

    if (
      pendingEvaluationRef.current &&
      (pendingEvaluationRef.current.outcome === "deal_won" ||
        pendingEvaluationRef.current.outcome === "deal_lost")
    ) {
      const evalOutcome = pendingEvaluationRef.current.outcome;
      const isDealWon = evalOutcome === "deal_won";
      setStatus(isDealWon ? "WON" : "LOST");
      setEvaluationOutcome(evalOutcome);
      if (typeof pendingEvaluationRef.current.score === "number") {
        setScore(pendingEvaluationRef.current.score);
      }
      if (isDealWon) {
        setTimeout(() => triggerCelebration(), 200);
      }
      pendingEvaluationRef.current = null;
    }
  }, [triggerCelebration]);

  // Load older messages for reverse infinite scroll
  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage.created_at) return;

    try {
      setIsLoadingOlder(true);
      const res = await fetch(
        `/api/chats/${chat.id}/messages?before=${encodeURIComponent(
          oldestMessage.created_at
        )}&limit=50`
      );

      if (!res.ok) {
        throw new Error("Failed to load older messages");
      }

      const data = await res.json();
      const olderMessages: MessageItem[] = data.messages || [];

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error("Failed to load older messages:", err);
      notify.error("Could not load older messages");
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Sequentially reveal AI response bubbles with realistic human typing pauses
  const scheduleStaggeredBubbles = useCallback(
    (
      bubbles: MessageItem[],
      evaluation?: { outcome: string; score: number; confidence: number } | null
    ) => {
      typingTimeoutRefs.current.forEach((t) => clearTimeout(t));
      typingTimeoutRefs.current = [];
      pendingBubblesRef.current = [...bubbles];
      pendingEvaluationRef.current = evaluation || null;

      let accumulatedDelay = 800; // Initial delay to simulate reading & starting to type

      bubbles.forEach((bubble, index) => {
        const isLast = index === bubbles.length - 1;

        const timeout = setTimeout(() => {
          setMessages((prev) => [...prev, bubble]);
          pendingBubblesRef.current = pendingBubblesRef.current.filter((b) => b !== bubble);

          if (isLast) {
            setIsProspectTyping(false);

            // Once the final prospect bubble has appeared, trigger conclusion if decided
            if (
              evaluation &&
              (evaluation.outcome === "deal_won" || evaluation.outcome === "deal_lost")
            ) {
              const isDealWon = evaluation.outcome === "deal_won";
              setStatus(isDealWon ? "WON" : "LOST");
              setEvaluationOutcome(evaluation.outcome);
              if (typeof evaluation.score === "number") {
                setScore(evaluation.score);
              }
              if (isDealWon) {
                // Short 200ms delay so user can read the closing message first
                setTimeout(() => {
                  triggerCelebration();
                }, 200);
              }
              pendingEvaluationRef.current = null;
            }
          }
        }, accumulatedDelay);

        typingTimeoutRefs.current.push(timeout);

        // Subsequent bubbles appear after realistic typing pause (~950ms)
        accumulatedDelay += 950;
      });
    },
    [triggerCelebration]
  );

  // Trigger AI prospect turn generation
  const triggerProspectTurn = useCallback(async () => {
    if (emptySettleTimerRef.current) {
      clearTimeout(emptySettleTimerRef.current);
      emptySettleTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (isReplyInFlightRef.current) return;

    try {
      isReplyInFlightRef.current = true;
      setIsProspectTyping(true);

      const res = await fetch(`/api/chats/${chat.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate prospect reply");
      }

      const data = await res.json();
      const newBubbles: MessageItem[] = data.messages || [];
      const evaluation = data.evaluation;

      if (evaluation) {
        console.log(
          `[Simulation] Turn evaluation received: ${evaluation.outcome} | score=${evaluation.score}/5`
        );
      }

      if (newBubbles.length === 0) {
        setIsProspectTyping(false);
        return;
      }

      scheduleStaggeredBubbles(newBubbles, evaluation);
    } catch (err) {
      console.error("Prospect reply error:", err);
      setIsProspectTyping(false);
      notify.error(err instanceof Error ? err.message : "Failed to receive buyer response");
    } finally {
      isReplyInFlightRef.current = false;
    }
  }, [chat.id, scheduleStaggeredBubbles]);

  // Start 3-second empty settlement timer
  const startEmptySettleTimer = useCallback(() => {
    if (emptySettleTimerRef.current) {
      clearTimeout(emptySettleTimerRef.current);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    emptySettleTimerRef.current = setTimeout(() => {
      triggerProspectTurn();
    }, 3000);
  }, [triggerProspectTurn]);

  // Handle draft change from input (detects active composition vs empty box)
  const handleDraftChange = useCallback((text: string) => {
    draftTextRef.current = text;
    const isDirty = text.trim().length > 0;
    setIsComposing(isDirty);

    // Only adjust turn timers if the last message in chat is an unreplied user message
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== "user" || isProspectTyping) {
      return;
    }

    if (isDirty) {
      // User is typing follow-up: CANCEL 3-second empty settle timer
      if (emptySettleTimerRef.current) {
        clearTimeout(emptySettleTimerRef.current);
        emptySettleTimerRef.current = null;
      }

      // Reset 15-second inactivity fallback on each keystroke
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        triggerProspectTurn();
      }, 15000);
    } else {
      // Draft was cleared back to empty: reset 15s timer, start 3s empty timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (!emptySettleTimerRef.current) {
        emptySettleTimerRef.current = setTimeout(() => {
          triggerProspectTurn();
        }, 3000);
      }
    }
  }, [messages, isProspectTyping, triggerProspectTurn]);

  // Handle salesperson sending messages
  const handleSendMessage = async (content: string) => {
    if (isConcluded) return;

    // 1. Settle any unrevealed bubbles in progress
    flushPendingBubbles();

    // 2. Clear any active inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // 3. Optimistic instant user message append
    const userMsg: MessageItem = {
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 4. Reset draft state
    draftTextRef.current = "";
    setIsComposing(false);

    // 5. Atomically persist to DB in background
    fetch(`/api/chats/${chat.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save message");
        }
      })
      .catch((err) => {
        console.error("Failed to persist user message:", err);
        notify.error("Could not save message");
      });

    // 6. Start 3-second empty settlement timer
    startEmptySettleTimer();
  };

  // Determine subtle turn status clue for UI
  const lastMessage = messages[messages.length - 1];
  const hasUnrepliedUserMessage = lastMessage?.role === "user";

  let turnStatusHint: React.ReactNode = null;
  if (hasUnrepliedUserMessage && !isProspectTyping) {
    if (isComposing) {
      turnStatusHint = (
        <>
          <span className="text-zinc-500 font-medium">
            Composing follow-up... (AI reply paused)
          </span>
          <button
            type="button"
            onClick={() => triggerProspectTurn()}
            className="text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer transition-colors"
          >
            Reply now
          </button>
        </>
      );
    } else {
      turnStatusHint = (
        <>
          <span className="text-zinc-400">
            Waiting for prospect response...
          </span>
          <button
            type="button"
            onClick={() => triggerProspectTurn()}
            className="text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer transition-colors"
          >
            Reply now
          </button>
        </>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white min-h-0">
      {/* 1. Single Unified Fixed Header */}
      <ChatHeader
        productName={chat.product_name}
        productDescription={chat.product_description}
        messageCount={messages.length}
      />

      {/* 2. ONLY Message Bubbles Scroll Area */}
      <ChatMessageList
        chatId={chat.id}
        productName={chat.product_name}
        messages={messages}
        isProspectTyping={isProspectTyping}
        hasMore={hasMore}
        isLoadingOlder={isLoadingOlder}
        onLoadOlder={handleLoadOlder}
        isConcluded={isConcluded}
        conclusionOutcome={evaluationOutcome}
        conclusionScore={score}
        initialFeedback={chat.ai_feedback}
      />

      {/* 3. Fixed Input Area (Permanently pinned at bottom of chat pane) */}
      <div className="p-4 sm:px-6 border-t border-zinc-200 bg-white shrink-0 z-10">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            onDraftChange={handleDraftChange}
            turnStatusHint={!isConcluded ? turnStatusHint : null}
            disabled={isConcluded}
            placeholder={
              isConcluded
                ? "Simulation concluded • Practice session complete"
                : "Type a message and press Enter..."
            }
          />
        </div>
      </div>
    </div>
  );
}
