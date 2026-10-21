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

function sanitizeBubbleContent(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // If content was saved as a JSON object containing messages or message
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) &&
    (trimmed.includes('"messages"') || trimmed.includes('"message"'))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return parsed.messages.map((m: unknown) => String(m).trim()).join("\n\n");
      }
      if (typeof parsed.message === "string") {
        return parsed.message;
      }
    } catch {
      // Not strict JSON, fallback to regex extraction
      const match = trimmed.match(/"messages?"\s*:\s*\[?\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      if (match && match[1]) {
        return match[1].replace(/\\"/g, '"');
      }
    }
  }

  return raw;
}

export function ChatBubble({ role, content, createdAt, isStreaming }: ChatBubbleProps) {
  const isUser = role === "user";
  const formattedTime = formatTime(createdAt);
  const displayContent = isUser ? content : sanitizeBubbleContent(content);

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
          {isStreaming && !displayContent ? (
            <div className="py-1 px-0.5">
              <Loader size="sm" dotClassName="bg-zinc-500" />
            </div>
          ) : (
            <>
              {displayContent}
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
