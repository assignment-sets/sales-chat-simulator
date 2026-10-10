import React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Loader } from "@/components/ui/Loader";

export interface ChatBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

function formatTime(isoString?: string) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatBubble({ role, content, createdAt, isStreaming }: ChatBubbleProps) {
  const isUser = role === "user";
  const formattedTime = formatTime(createdAt);

  return (
    <div
      className={`flex items-start gap-2.5 my-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <Avatar
        name={isUser ? "You" : "Prospect"}
        size="sm"
        className={isUser ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-800 border-zinc-300"}
      />

      <div
        className={`max-w-[80%] sm:max-w-[70%] flex flex-col ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1 px-1 select-none">
          <span>{isUser ? "You (Sales Rep)" : "Potential Customer"}</span>
          {formattedTime && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-400 font-normal">{formattedTime}</span>
            </>
          )}
        </div>

        <div
          className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-zinc-900 text-white rounded-2xl rounded-tr-xs"
              : "bg-zinc-100 text-zinc-900 border border-zinc-200/80 rounded-2xl rounded-tl-xs"
          }`}
        >
          {isStreaming && !content ? (
            <div className="py-1 px-0.5">
              <Loader size="sm" dotClassName="bg-zinc-500" />
            </div>
          ) : (
            <>
              {content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-900 animate-pulse align-middle" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
