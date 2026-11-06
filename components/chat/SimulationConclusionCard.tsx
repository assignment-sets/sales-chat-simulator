"use client";

import React, { useState } from "react";
import { XCircle, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DetailedFeedbackModal } from "@/components/chat/DetailedFeedbackModal";
import { hasFeature, PlanTier } from "@/lib/plans";
import { notify } from "@/lib/toast";

export interface SimulationConclusionCardProps {
  chatId?: string;
  outcome: "deal_won" | "deal_lost" | string;
  score?: number | null;
  productName?: string;
  initialFeedback?: string | null;
  planTier?: PlanTier;
}

export function SimulationConclusionCard({
  chatId,
  outcome,
  score,
  productName,
  initialFeedback,
  planTier = "starter",
}: SimulationConclusionCardProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const isWon = outcome === "deal_won" || outcome === "WON";
  const displayScore = score ? Math.min(Math.max(score, 1), 5) : (isWon ? 4 : 2);
  const canViewFeedback = hasFeature(planTier, "detailed_ai_feedback");

  const handleFeedbackButtonClick = () => {
    if (!canViewFeedback) {
      notify.info(
        "Detailed Coaching Breakdown is a Pro feature. View Plans & Pricing in the workspace menu."
      );
      return;
    }
    setIsFeedbackOpen(true);
  };

  return (
    <>
      <div className="w-full my-6 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto rounded-2xl p-5 border border-zinc-200 bg-white">
          {/* Header & Outcome */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isWon
                  ? "bg-emerald-700 text-white"
                  : "bg-zinc-800 text-white"
              }`}
            >
              {isWon ? <Trophy className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>

            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                {isWon ? "Deal Closed" : "Lead Lost"}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                {isWon
                  ? "Prospect agreed to move forward with the purchase or pilot."
                  : "Prospect declined to proceed further with this offering."}
              </p>
            </div>
          </div>

          {/* Performance Score Row */}
          <div className="mt-4 p-3 rounded-xl bg-zinc-50/75 border border-zinc-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Evaluation Score</span>
              <span className="font-mono text-xs font-bold text-zinc-900 tabular-nums">
                {displayScore} <span className="text-zinc-400 font-normal">/ 5</span>
              </span>
            </div>

            {/* 5-Bar Score Indicator */}
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              {[1, 2, 3, 4, 5].map((level) => {
                const isFilled = level <= displayScore;
                return (
                  <div
                    key={level}
                    className={`w-5 h-1.5 rounded-full transition-all ${
                      isFilled
                        ? isWon
                          ? "bg-emerald-700"
                          : "bg-zinc-800"
                        : "bg-zinc-200"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          {chatId && (
            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleFeedbackButtonClick}
                className="text-xs h-8 px-3 rounded-xl font-medium cursor-pointer"
                rightIcon={<ArrowRight className="w-3.5 h-3.5 text-zinc-400" />}
              >
                <span>Review Coaching Notes</span>
                {!canViewFeedback && (
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 ml-1">
                    Pro
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {chatId && canViewFeedback && (
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
