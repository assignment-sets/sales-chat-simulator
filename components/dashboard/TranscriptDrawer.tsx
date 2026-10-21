"use client";

import React, { useEffect, useState } from "react";
import { X, MessageSquare, Bot, User, Coins, FileText } from "lucide-react";
import { Loader } from "@/components/ui/Loader";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/lib/toast";

export interface TranscriptDrawerProps {
  chatId: string | null;
  onClose: () => void;
}

interface ChatDetail {
  id: string;
  product_name: string;
  product_description: string;
  tokens_used: number;
  created_at: string;
  user_id: string;
}

interface MessageDetail {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  total_tokens?: number;
}

export function TranscriptDrawer({ chatId, onClose }: TranscriptDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<MessageDetail[]>([]);
  const [showPitch, setShowPitch] = useState(false);

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setMessages([]);
      return;
    }

    async function fetchTranscript() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/dashboard/chats/${chatId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load conversation transcript");
        }
        const data = await res.json();
        setChat(data.chat);
        setMessages(data.messages || []);
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Error loading transcript");
        onClose();
      } finally {
        setIsLoading(false);
      }
    }

    fetchTranscript();
  }, [chatId, onClose]);

  if (!chatId) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50/70">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="accent" className="text-[10px] px-2 py-0.5">
                Audit Mode
              </Badge>
              <span className="text-xs text-zinc-400">
                {formatDate(chat?.created_at)}
              </span>
            </div>
            <h2 className="text-base font-bold text-zinc-900 truncate">
              {chat?.product_name || "Conversation Transcript"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-xl transition-colors cursor-pointer"
            aria-label="Close transcript"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader size="md" label="Loading conversation..." />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Simulation Context Accordion */}
            {chat?.product_description && (
              <div className="p-3 sm:px-6 border-b border-zinc-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPitch((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer select-none"
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Product Pitch & Scenario Context</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    {showPitch ? "(hide)" : "(show)"}
                  </span>
                </button>

                {showPitch && (
                  <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {chat.product_description}
                  </div>
                )}
              </div>
            )}

            {/* Conversation Flow */}
            <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-3.5 min-h-0">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No dialogue records found for this practice session.
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1 px-1">
                        {isUser ? (
                          <>
                            <User className="w-3 h-3 text-zinc-500" />
                            <span>Sales Rep</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-zinc-500" />
                            <span>AI Customer</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatDate(msg.created_at)}</span>
                        {msg.total_tokens && msg.total_tokens > 0 ? (
                          <>
                            <span>·</span>
                            <span className="text-zinc-400">
                              {msg.total_tokens} tokens
                            </span>
                          </>
                        ) : null}
                      </div>

                      <div
                        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
                          isUser
                            ? "bg-zinc-900 text-white rounded-tr-xs"
                            : "bg-zinc-100 text-zinc-900 border border-zinc-200/80 rounded-tl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary Bar */}
            <div className="p-3 sm:px-6 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  {messages.length} messages
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Coins className="w-3.5 h-3.5 text-zinc-400" />
                  {(chat?.tokens_used || 0).toLocaleString()} tokens
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 italic">
                Read-only admin inspection
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
