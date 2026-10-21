"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { EmptyChatState } from "@/components/chat/EmptyChatState";
import { Loader } from "@/components/ui/Loader";
import { Avatar } from "@/components/ui/Avatar";
import { SimulationConclusionCard } from "@/components/chat/SimulationConclusionCard";

export interface MessageItem {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface ChatMessageListProps {
  productName: string;
  messages: MessageItem[];
  isProspectTyping?: boolean;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  isConcluded?: boolean;
  conclusionOutcome?: "deal_won" | "deal_lost" | string;
  conclusionScore?: number | null;
}

export function ChatMessageList({
  productName,
  messages,
  isProspectTyping = false,
  hasMore = false,
  isLoadingOlder = false,
  onLoadOlder,
  isConcluded = false,
  conclusionOutcome = "in_progress",
  conclusionScore = null,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // References to preserve scroll anchoring when older messages are prepended
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingRef = useRef<boolean>(false);
  const initialScrolledRef = useRef<boolean>(false);
  const prevLastMsgKeyRef = useRef<string | undefined>(undefined);

  // Keep latest refs for observer callback
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const isLoadingOlderRef = useRef(isLoadingOlder);
  isLoadingOlderRef.current = isLoadingOlder;
  const onLoadOlderRef = useRef(onLoadOlder);
  onLoadOlderRef.current = onLoadOlder;

  // Observe top sentinel for reverse infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          hasMoreRef.current &&
          !isLoadingOlderRef.current &&
          onLoadOlderRef.current
        ) {
          // Capture current scroll metrics right before loading older messages
          prevScrollHeightRef.current = container.scrollHeight;
          prevScrollTopRef.current = container.scrollTop;
          isPrependingRef.current = true;
          onLoadOlderRef.current();
        }
      },
      {
        root: container,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore]);

  // Scroll anchoring: synchronously restore scroll position before browser paint
  useLayoutEffect(() => {
    if (isPrependingRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const heightDelta = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = prevScrollTopRef.current + heightDelta;
      isPrependingRef.current = false;
    }
  }, [messages]);

  // Handle initial scroll to bottom and auto-scrolling on new messages / typing
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const lastMsg = messages[messages.length - 1];
    const lastMsgKey = lastMsg
      ? `${lastMsg.role}_${lastMsg.created_at || ""}_${lastMsg.content.slice(0, 20)}`
      : undefined;

    // Initial mount with messages: scroll directly to bottom (instant, no jump)
    if (!initialScrolledRef.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
      initialScrolledRef.current = true;
      prevLastMsgKeyRef.current = lastMsgKey;
      return;
    }

    // Auto-scroll when prospect is typing
    if (isProspectTyping) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Auto-scroll when a new message has been appended at the bottom
    if (lastMsgKey && lastMsgKey !== prevLastMsgKeyRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevLastMsgKeyRef.current = lastMsgKey;
    }
  }, [messages, isProspectTyping]);

  if (messages.length === 0 && !isProspectTyping) {
    return (
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0 bg-white flex flex-col items-center justify-center"
      >
        <div className="max-w-3xl w-full mx-auto">
          <EmptyChatState productName={productName} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0 bg-white"
    >
      <div className="max-w-3xl mx-auto space-y-1 pb-2">
        {/* Top Sentinel for Reverse Infinite Scroll */}
        <div ref={topSentinelRef} className="h-1 w-full pointer-events-none" />

        {/* 3-Dot Loader for Loading Older Messages */}
        {isLoadingOlder && (
          <div className="py-2.5 flex items-center justify-center">
            <Loader size="sm" dotClassName="bg-zinc-400" />
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatBubble
            key={msg.id || `${msg.role}_${index}`}
            role={msg.role}
            content={msg.content}
            createdAt={msg.created_at}
          />
        ))}

        {/* Prospect Typing Indicator Bubble */}
        {isProspectTyping && (
          <div className="flex items-start gap-2.5 my-3 flex-row animate-in fade-in duration-150">
            <Avatar
              name="Prospect"
              size="sm"
              className="bg-white text-zinc-800 border-zinc-300"
            />
            <div className="max-w-[80%] sm:max-w-[70%] flex flex-col items-start">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1 px-1 select-none">
                <span>Potential Customer is typing...</span>
              </div>
              <div className="px-4 py-2.5 bg-zinc-100 text-zinc-900 border border-zinc-200/80 rounded-2xl rounded-tl-xs">
                <Loader size="sm" dotClassName="bg-zinc-500" />
              </div>
            </div>
          </div>
        )}

        {/* Simulation Conclusion & Evaluation Card */}
        {isConcluded && (
          <SimulationConclusionCard
            outcome={conclusionOutcome}
            score={conclusionScore}
            productName={productName}
          />
        )}

        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}
