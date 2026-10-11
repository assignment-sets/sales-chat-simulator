"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message and press Enter...",
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  };

  const canSubmit = content.trim().length > 0 && !disabled;

  return (
    <div className="w-full bg-white border border-zinc-200 rounded-2xl p-2 shadow-xs focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10 transition-all flex items-end gap-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 max-h-[140px] p-2 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none disabled:opacity-50"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label="Send message"
        className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center transition-all hover:bg-zinc-800 active:bg-zinc-950 disabled:opacity-30 disabled:pointer-events-none shrink-0 mb-0.5 cursor-pointer"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
}
