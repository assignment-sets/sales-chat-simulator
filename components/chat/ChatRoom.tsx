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
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Turn management & typing cadence references
  const turnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const pendingBubblesRef = useRef<MessageItem[]>([]);
  const isReplyInFlightRef = useRef(false);

  // Clean up all pending timers on unmount
  useEffect(() => {
    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
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
  }, []);

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
  const scheduleStaggeredBubbles = useCallback((bubbles: MessageItem[]) => {
    typingTimeoutRefs.current.forEach((t) => clearTimeout(t));
    typingTimeoutRefs.current = [];
    pendingBubblesRef.current = [...bubbles];

    let accumulatedDelay = 800; // Initial delay to simulate reading & starting to type

    bubbles.forEach((bubble, index) => {
      const isLast = index === bubbles.length - 1;

      const timeout = setTimeout(() => {
        setMessages((prev) => [...prev, bubble]);
        pendingBubblesRef.current = pendingBubblesRef.current.filter((b) => b !== bubble);

        if (isLast) {
          setIsProspectTyping(false);
        }
      }, accumulatedDelay);

      typingTimeoutRefs.current.push(timeout);

      // Subsequent bubbles appear after realistic typing pause (~950ms)
      accumulatedDelay += 950;
    });
  }, []);

  // Trigger AI prospect turn generation
  const triggerProspectTurn = useCallback(async () => {
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

      if (newBubbles.length === 0) {
        setIsProspectTyping(false);
        return;
      }

      scheduleStaggeredBubbles(newBubbles);
    } catch (err) {
      console.error("Prospect reply error:", err);
      setIsProspectTyping(false);
      notify.error(err instanceof Error ? err.message : "Failed to receive buyer response");
    } finally {
      isReplyInFlightRef.current = false;
    }
  }, [chat.id, scheduleStaggeredBubbles]);

  // Handle salesperson sending messages (supports rapid fire burst messaging)
  const handleSendMessage = async (content: string) => {
    // 1. If prospect had unrevealed bubbles in progress, settle them immediately
    flushPendingBubbles();

    // 2. Optimistic instant user message append
    const userMsg: MessageItem = {
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 3. Atomically persist to DB in background
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

    // 4. Turn Debounce Window (1500ms): Reset timer with each message so bursts coalesce into one turn
    if (turnTimeoutRef.current) {
      clearTimeout(turnTimeoutRef.current);
    }

    turnTimeoutRef.current = setTimeout(() => {
      triggerProspectTurn();
    }, 1500);
  };

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
        productName={chat.product_name}
        messages={messages}
        isProspectTyping={isProspectTyping}
        hasMore={hasMore}
        isLoadingOlder={isLoadingOlder}
        onLoadOlder={handleLoadOlder}
      />

      {/* 3. Fixed Input Area (Permanently pinned at bottom of chat pane, never locked) */}
      <div className="p-4 sm:px-6 border-t border-zinc-200 bg-white shrink-0 z-10">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
