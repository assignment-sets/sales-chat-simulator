"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  X,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { notify } from "@/lib/toast";
import { parseFeedbackMarkdown, ParsedTurn } from "@/lib/feedback-parser";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface DetailedFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  initialFeedback?: string | null;
  productName?: string;
}

export function DetailedFeedbackModal({
  isOpen,
  onClose,
  chatId,
  initialFeedback,
  productName,
}: DetailedFeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState<string>(initialFeedback || "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accordion state: all collapsed by default
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());
  const [isTakeawaysExpanded, setIsTakeawaysExpanded] = useState(false);
  const [copiedTurnIndex, setCopiedTurnIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  // Sync initialFeedback if provided externally
  useEffect(() => {
    if (initialFeedback && initialFeedback.trim().length > 0) {
      setFeedbackText(initialFeedback);
      hasLoadedRef.current = true;
    }
  }, [initialFeedback]);

  // Trigger streaming fetch when modal opens if no feedback yet
  useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      return;
    }

    if (feedbackText.trim().length > 0) {
      return;
    }

    async function streamFeedback() {
      try {
        setIsStreaming(true);
        setError(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch(`/api/chats/${chatId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to generate coaching feedback");
        }

        if (!res.body) {
          throw new Error("No response body received from server");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setFeedbackText((prev) => prev + chunk);
        }

        hasLoadedRef.current = true;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Error generating feedback";
        setError(msg);
        notify.error(msg);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    }

    streamFeedback();
  }, [isOpen, chatId, feedbackText]);

  // Parse structured sections from markdown text
  const parsed = useMemo(() => {
    return parseFeedbackMarkdown(feedbackText);
  }, [feedbackText]);

  const toggleTurn = (index: number) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set(parsed.turns.map((t) => t.turnIndex));
    setExpandedTurns(all);
    setIsTakeawaysExpanded(true);
  };

  const collapseAll = () => {
    setExpandedTurns(new Set());
    setIsTakeawaysExpanded(false);
  };

  const handleCopyScript = (scriptText: string, turnIndex: number) => {
    navigator.clipboard.writeText(scriptText);
    setCopiedTurnIndex(turnIndex);
    setTimeout(() => {
      setCopiedTurnIndex((curr) => (curr === turnIndex ? null : curr));
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
          <div className="min-w-0">
            <h3 id="feedback-dialog-title" className="font-semibold text-sm sm:text-base text-zinc-900 tracking-tight">
              Coaching Feedback
            </h3>
            {productName && (
              <p className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
                {productName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close feedback dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 min-h-0 bg-white">
          {error ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-7 h-7 text-rose-500 mb-2" />
              <p className="text-sm font-medium text-zinc-900">
                Coaching Feedback Unavailable
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setFeedbackText("");
                  setError(null);
                }}
              >
                Try Again
              </Button>
            </div>
          ) : feedbackText.length === 0 && isStreaming ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader
                size="md"
                label="Analyzing transcript and coaching moments..."
              />
            </div>
          ) : parsed.isParsed ? (
            <div className="space-y-6">
              {/* 1. Executive Summary */}
              {parsed.summary && (
                <div className="rounded-xl p-4 bg-zinc-50 border border-zinc-100">
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">
                    Overview
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed font-normal">
                    {parsed.summary}
                  </p>
                </div>
              )}

              {/* 2. Turn-by-Turn Moments to Review (Collapsed by default) */}
              {parsed.turns.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Moments to Review
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        ({parsed.turns.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={expandAll}
                        className="text-zinc-400 hover:text-zinc-700 text-[11px] transition-colors cursor-pointer"
                      >
                        Expand all
                      </button>
                      <span className="text-zinc-200">·</span>
                      <button
                        type="button"
                        onClick={collapseAll}
                        className="text-zinc-400 hover:text-zinc-700 text-[11px] transition-colors cursor-pointer"
                      >
                        Collapse all
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parsed.turns.map((turn: ParsedTurn) => {
                      const isExpanded = expandedTurns.has(turn.turnIndex);

                      return (
                        <div
                          key={turn.turnIndex}
                          className="rounded-xl border border-zinc-200/70 bg-white transition-all overflow-hidden"
                        >
                          {/* Turn Header Row */}
                          <button
                            type="button"
                            onClick={() => toggleTurn(turn.turnIndex)}
                            className="w-full text-left p-3.5 sm:px-4 cursor-pointer select-none flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                                #{turn.turnIndex}
                              </span>
                              <p className="text-xs sm:text-sm text-zinc-700 truncate font-normal">
                                &ldquo;{turn.quote}&rdquo;
                              </p>
                            </div>

                            <div className="shrink-0 text-zinc-400 pl-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Coaching Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-3 bg-zinc-50/30">
                              <div className="pt-2">
                                <p className="text-xs sm:text-sm text-zinc-800 font-medium italic">
                                  &ldquo;{turn.quote}&rdquo;
                                </p>
                              </div>

                              {turn.issue && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                    Issue
                                  </span>
                                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                                    {turn.issue}
                                  </p>
                                </div>
                              )}

                              {turn.script && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                      Suggested Phrasing
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyScript(turn.script, turn.turnIndex);
                                      }}
                                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                                    >
                                      {copiedTurnIndex === turn.turnIndex ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span className="text-emerald-600 font-medium">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="p-3 bg-white rounded-lg border border-zinc-200/60 text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal">
                                    &ldquo;{turn.script}&rdquo;
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Key Takeaways Section (Collapsed by default) */}
              {parsed.actionItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200/70 bg-white overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setIsTakeawaysExpanded((prev) => !prev)}
                    className="w-full text-left p-3.5 sm:px-4 cursor-pointer select-none flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Key Takeaways
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        ({parsed.actionItems.length})
                      </span>
                    </div>

                    <div className="shrink-0 text-zinc-400">
                      {isTakeawaysExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isTakeawaysExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-100 space-y-2.5 bg-zinc-50/30">
                      {parsed.actionItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed">
                          <span className="text-zinc-400 font-mono text-xs shrink-0 mt-0.5">
                            {idx + 1}.
                          </span>
                          <p className="text-zinc-600">{item}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  Finalizing coaching analysis...
                </div>
              )}
            </div>
          ) : (
            /* Fallback while receiving initial stream */
            <div className="text-sm leading-relaxed space-y-4">
              <ReactMarkdown
                components={{
                  h3: ({ children }) => (
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1 mt-4 first:mt-0">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-2">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-1.5 my-2 list-none pl-0">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-xs sm:text-sm text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg p-2.5 my-1 leading-relaxed">
                      {children}
                    </li>
                  ),
                }}
              >
                {feedbackText}
              </ReactMarkdown>

              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  Generating analysis...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-white flex items-center justify-between text-xs text-zinc-400 shrink-0 select-none">
          <span className="text-[11px]">
            Based on conversation transcript
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
