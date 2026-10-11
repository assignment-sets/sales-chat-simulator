"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { EmptyChatState } from "@/components/chat/EmptyChatState";
import { Loader } from "@/components/ui/Loader";

export interface MessageItem {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface ChatMessageListProps {
  productName: string;
  messages: MessageItem[];
  streamingContent?: string;
  isStreaming?: boolean;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
}

export function ChatMessageList({
  productName,
  messages,
  streamingContent,
  isStreaming,
  hasMore = false,
  isLoadingOlder = false,
  onLoadOlder,
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

  // Handle initial scroll to bottom and auto-scrolling on new messages / streaming
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

    // Auto-scroll when assistant is streaming
    if (isStreaming || streamingContent) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Auto-scroll when a new message has been appended at the bottom
    if (lastMsgKey && lastMsgKey !== prevLastMsgKeyRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevLastMsgKeyRef.current = lastMsgKey;
    }
  }, [messages, streamingContent, isStreaming]);

  if (messages.length === 0 && !isStreaming && !streamingContent) {
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

        {isStreaming && (
          <ChatBubble
            role="assistant"
            content={streamingContent || ""}
            isStreaming={true}
          />
        )}

        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}
