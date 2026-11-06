"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  X,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  MessageSquareQuote,
  CheckCircle2,
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

// Safely parse action item strings like "**Title**: Description" into title and body
function formatActionItem(item: string) {
  const match = item.match(/^(?:\*\*(.*?)\*\*|\*(.*?)\*|([^:]+)):\s*(.*)$/s);
  if (match) {
    const rawTitle = (match[1] || match[2] || match[3] || "").trim();
    const rawBody = (match[4] || "").trim();
    if (rawTitle && rawBody) {
      return { title: rawTitle.replace(/^\*+|\*+$/g, ""), body: rawBody };
    }
  }
  return { title: "", body: item };
}

// Lightweight safe markdown renderer: renders bold, italics, code without raw HTML injection
function SafeInlineMarkdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className={className}>{children}</span>,
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-900">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-zinc-800">{children}</em>,
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded bg-zinc-100 font-mono text-xs text-zinc-800">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
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

  // Tab state: "moments" (turn-by-turn) vs "takeaways" (high-level action items)
  const [activeTab, setActiveTab] = useState<"moments" | "takeaways">("moments");

  // Strict single-accordion state: only ONE moment can ever be open at a time
  const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null);
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

  // Strict single-toggle: opening a turn automatically closes any other open turn
  const toggleTurn = (index: number) => {
    setActiveTurnIndex((prev) => (prev === index ? null : index));
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
        className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 sm:px-7 sm:py-5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
          <div className="min-w-0">
            <h3
              id="feedback-dialog-title"
              className="font-semibold text-base sm:text-lg text-zinc-900 tracking-tight"
            >
              Coaching Breakdown
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
              {/* Executive Summary Card */}
              {parsed.summary && (
                <div className="rounded-2xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200/80">
                  <div className="text-[10px] font-mono font-semibold tracking-wider uppercase text-zinc-400 mb-1.5">
                    Executive Summary
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-700 leading-relaxed font-normal">
                    <SafeInlineMarkdown content={parsed.summary} />
                  </div>
                </div>
              )}

              {/* Segmented View Switcher: Moments vs Takeaways */}
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("moments")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === "moments"
                      ? "bg-zinc-900 text-white shadow-xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  <span>Moments to Review</span>
                  <span
                    className={`font-mono text-[10px] ${
                      activeTab === "moments" ? "text-zinc-300" : "text-zinc-400"
                    }`}
                  >
                    ({parsed.turns.length})
                  </span>
                </button>

                {parsed.actionItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("takeaways")}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === "takeaways"
                        ? "bg-zinc-900 text-white shadow-xs font-semibold"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Key Takeaways</span>
                    <span
                      className={`font-mono text-[10px] ${
                        activeTab === "takeaways" ? "text-zinc-300" : "text-zinc-400"
                      }`}
                    >
                      ({parsed.actionItems.length})
                    </span>
                  </button>
                )}
              </div>

              {/* Tab 1: Turn-by-Turn Moments (Strict Single-Accordion Focus) */}
              {activeTab === "moments" && (
                <div className="space-y-3">
                  {parsed.turns.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 font-mono">
                      No specific moments flagged in this session.
                    </div>
                  ) : (
                    parsed.turns.map((turn: ParsedTurn) => {
                      const isExpanded = activeTurnIndex === turn.turnIndex;

                      return (
                        <div
                          key={turn.turnIndex}
                          className={`rounded-2xl border transition-all overflow-hidden ${
                            isExpanded
                              ? "border-zinc-300 bg-white shadow-xs ring-1 ring-zinc-950/5"
                              : "border-zinc-200/80 bg-white hover:border-zinc-300"
                          }`}
                        >
                          {/* Turn Trigger */}
                          <button
                            type="button"
                            onClick={() => toggleTurn(turn.turnIndex)}
                            className="w-full text-left p-3.5 sm:p-4 cursor-pointer select-none flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-[10px] font-mono font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md shrink-0 select-none">
                                Turn {String(turn.turnIndex).padStart(2, "0")}
                              </span>
                              <p className="text-xs sm:text-sm text-zinc-800 truncate font-medium">
                                &ldquo;{turn.quote}&rdquo;
                              </p>
                            </div>

                            <div className="shrink-0 text-zinc-400 pl-2">
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-300 ease-out ${
                                  isExpanded ? "rotate-180 text-zinc-700" : "text-zinc-400"
                                }`}
                              />
                            </div>
                          </button>

                          {/* Animated Single-Focus Content with Staggered Visual Lag */}
                          <div
                            className="grid transition-[grid-template-rows] ease-out"
                            style={{
                              gridTemplateRows: isExpanded ? "1fr" : "0fr",
                              transitionDuration: "350ms",
                              transitionDelay: isExpanded ? "100ms" : "0ms",
                            }}
                          >
                            <div className="overflow-hidden min-h-0">
                              <div
                                className={`px-5 pb-5 pt-3 border-t border-zinc-100 space-y-4 bg-zinc-50/40 transition-opacity duration-300 ease-out ${
                                  isExpanded ? "opacity-100 delay-100" : "opacity-0"
                                }`}
                              >
                                {/* Dialogue Quote Excerpt */}
                                <div>
                                  <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                                    What You Said
                                  </div>
                                  <div className="p-3 bg-white rounded-xl border border-zinc-200 text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal italic">
                                    &ldquo;{turn.quote}&rdquo;
                                  </div>
                                </div>

                                {/* Issue Identified */}
                                {turn.issue && (
                                  <div>
                                    <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                                      Issue Identified
                                    </div>
                                    <div className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                                      <SafeInlineMarkdown content={turn.issue} />
                                    </div>
                                  </div>
                                )}

                                {/* Recommended Alternative Script */}
                                {turn.script && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                                        Recommended Phrasing
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyScript(turn.script, turn.turnIndex);
                                        }}
                                        className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
                                      >
                                        {copiedTurnIndex === turn.turnIndex ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-700" />
                                            <span className="text-emerald-700">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 text-zinc-400" />
                                            <span>Copy Phrasing</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-2xs text-xs sm:text-sm text-zinc-900 leading-relaxed font-normal">
                                      <SafeInlineMarkdown
                                        content={`“${turn.script}”`}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Key Takeaways (Structured Editorial Cards) */}
              {activeTab === "takeaways" && (
                <div className="space-y-3.5">
                  {parsed.actionItems.map((item, idx) => {
                    const { title, body } = formatActionItem(item);

                    return (
                      <div
                        key={idx}
                        className="p-4 sm:p-5 rounded-2xl border border-zinc-200/90 bg-white shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 select-none">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {title ? (
                              <>
                                <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 mb-1">
                                  {title}
                                </h4>
                                <div className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                                  <SafeInlineMarkdown content={body} />
                                </div>
                              </>
                            ) : (
                              <div className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                                <SafeInlineMarkdown content={body} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1 font-mono">
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
                <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  Generating analysis...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-white flex items-center justify-between text-xs text-zinc-400 shrink-0 select-none">
          <span className="text-[11px]">Based on conversation transcript</span>
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
