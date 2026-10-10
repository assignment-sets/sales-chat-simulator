"use client";

import React, { useEffect, useRef } from "react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { EmptyChatState } from "@/components/chat/EmptyChatState";

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
}

export function ChatMessageList({
  productName,
  messages,
  streamingContent,
  isStreaming,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isStreaming]);

  if (messages.length === 0 && !isStreaming && !streamingContent) {
    return <EmptyChatState productName={productName} />;
  }

  return (
    <div className="space-y-1 pb-2">
      {messages.map((msg, index) => (
        <ChatBubble
          key={msg.id || index}
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
  );
}
