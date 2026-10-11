"use client";

import React, { useState } from "react";
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
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

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

  const handleSendMessage = async (content: string) => {
    // 1. Optimistic user message append
    const userMsg: MessageItem = {
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to send message");
      }

      if (!response.body) {
        throw new Error("No response body stream received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingContent(accumulated);
      }

      // 2. Commit complete assistant message to state
      if (accumulated.trim()) {
        const assistantMsg: MessageItem = {
          role: "assistant",
          content: accumulated.trim(),
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error("Streaming error:", err);
      notify.error(err instanceof Error ? err.message : "Failed to receive AI response");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
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
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        hasMore={hasMore}
        isLoadingOlder={isLoadingOlder}
        onLoadOlder={handleLoadOlder}
      />

      {/* 3. Fixed Input Area (Permanently pinned at bottom of chat pane) */}
      <div className="p-4 sm:px-6 border-t border-zinc-200 bg-white shrink-0 z-10">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            isStreaming={isStreaming}
            placeholder="Type your message or response to prospect..."
          />
        </div>
      </div>
    </div>
  );
}
