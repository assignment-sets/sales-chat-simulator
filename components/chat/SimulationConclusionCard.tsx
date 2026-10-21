"use client";

import React, { useState } from "react";
import { XCircle, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DetailedFeedbackModal } from "@/components/chat/DetailedFeedbackModal";

export interface SimulationConclusionCardProps {
  chatId?: string;
  outcome: "deal_won" | "deal_lost" | string;
  score?: number | null;
  productName?: string;
  initialFeedback?: string | null;
}

export function SimulationConclusionCard({
  chatId,
  outcome,
  score,
  productName,
  initialFeedback,
}: SimulationConclusionCardProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const isWon = outcome === "deal_won" || outcome === "WON";
  const displayScore = score ? Math.min(Math.max(score, 1), 5) : (isWon ? 4 : 2);

  return (
    <>
      <div className="w-full my-6 animate-in fade-in zoom-in-95 duration-200">
        <div
          className={`max-w-2xl mx-auto rounded-3xl p-5 sm:p-6 border shadow-sm ${
            isWon
              ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
              : "bg-zinc-50 border-zinc-200 text-zinc-900"
          }`}
        >
          {/* Header Badge & Title */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                  isWon
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-zinc-800 text-white shadow-xs"
                }`}
              >
                {isWon ? <Trophy className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold">
                    {isWon ? "Deal Closed!" : "Lead Lost"}
                  </h3>
                  <Badge
                    variant={isWon ? "success" : "muted"}
                    className="text-[10px] px-2 py-0.5 uppercase tracking-wider"
                  >
                    {isWon ? "Success" : "Concluded"}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {productName ? `${productName} · ` : ""}
                  {isWon
                    ? "The prospect agreed to move forward with the purchase or pilot."
                    : "The prospect declined to proceed further with this offering."}
                </p>
              </div>
            </div>
          </div>

          {/* Score & Rubric Bar */}
          <div className="mt-4 p-3.5 rounded-2xl bg-white border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Performance Score
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-zinc-900 font-mono">
                  {displayScore}
                  <span className="text-sm font-normal text-zinc-400"> / 5</span>
                </span>
              </div>
            </div>

            {/* 5-Bar Score Indicator */}
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              {[1, 2, 3, 4, 5].map((level) => {
                const isFilled = level <= displayScore;
                return (
                  <div
                    key={level}
                    className={`w-5 h-2 rounded-full transition-all ${
                      isFilled
                        ? isWon
                          ? "bg-emerald-600"
                          : "bg-zinc-800"
                        : "bg-zinc-200"
                    }`}
                    title={`Score level ${level}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-4 pt-3 border-t border-zinc-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="text-[11px] text-zinc-400 select-none">
              Simulation concluded • Chat input locked
            </span>

            {chatId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFeedbackOpen(true)}
                className="text-xs gap-1.5 text-zinc-700 hover:text-zinc-900 bg-white shadow-2xs font-medium cursor-pointer"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              >
                Get Detailed AI Feedback
              </Button>
            )}
          </div>
        </div>
      </div>

      {chatId && (
        <DetailedFeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          chatId={chatId}
          initialFeedback={initialFeedback}
          productName={productName}
        />
      )}
    </>
  );
}
