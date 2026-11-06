"use client";

import React, { useState } from "react";
import { BarChart3, Layers } from "lucide-react";
import { DashboardScorePoint, DashboardScenarioPoint } from "@/app/api/dashboard/route";

export interface ScenarioScoreChartProps {
  scoreDistribution: DashboardScorePoint[];
  scenarioBreakdown: DashboardScenarioPoint[];
}

export function ScenarioScoreChart({
  scoreDistribution,
  scenarioBreakdown,
}: ScenarioScoreChartProps) {
  const [activeTab, setActiveTab] = useState<"scores" | "scenarios">("scores");

  const totalScored = scoreDistribution.reduce((acc, s) => acc + s.count, 0);
  const maxScenarioCount = Math.max(1, ...scenarioBreakdown.map((s) => s.count));

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">
            {activeTab === "scores" ? "Evaluator Score Curve" : "Scenario Performance"}
          </h3>
          <p className="text-[11px] text-zinc-400">
            {activeTab === "scores"
              ? "Session rating distribution across 1 to 5 score tiers"
              : "Volume & closing conversion across pitched offerings"}
          </p>
        </div>

        <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/80 text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("scores")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === "scores"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-zinc-700" />
            <span>Score Curve</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scenarios")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === "scenarios"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span>Scenarios</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Score Distribution */}
      {activeTab === "scores" && (
        <div className="space-y-3 my-auto py-1">
          {totalScored === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-mono">
              No completed simulations evaluated yet.
            </div>
          ) : (
            [5, 4, 3, 2, 1].map((scoreLevel) => {
              const pt = scoreDistribution.find((s) => s.score === scoreLevel) || {
                score: scoreLevel,
                count: 0,
                percentage: 0,
              };

              const getBarColor = (s: number) => {
                if (s >= 4) return "bg-emerald-700"; // Deep forest pine
                if (s === 3) return "bg-zinc-500";   // Slate neutral
                return "bg-rose-800";                // Muted crimson
              };

              return (
                <div key={scoreLevel} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-14 shrink-0 font-mono">
                    <span className="font-semibold text-zinc-900 tabular-nums">
                      {scoreLevel}
                    </span>
                    <span className="text-[11px] text-zinc-400">/ 5</span>
                  </div>

                  <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBarColor(scoreLevel)}`}
                      style={{ width: `${pt.percentage}%` }}
                    />
                  </div>

                  <div className="w-16 text-right font-mono text-[11px] shrink-0 tabular-nums">
                    <span className="font-semibold text-zinc-900">{pt.count}</span>
                    <span className="text-zinc-400 ml-1">({pt.percentage}%)</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Scenario Performance */}
      {activeTab === "scenarios" && (
        <div className="space-y-3 my-auto py-1">
          {scenarioBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-mono">
              No simulation scenarios recorded yet.
            </div>
          ) : (
            scenarioBreakdown.map((scen, idx) => {
              const barWidth = Math.max(8, Math.round((scen.count / maxScenarioCount) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-900 truncate max-w-[200px] sm:max-w-xs" title={scen.productName}>
                      {scen.productName}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-500">{scen.count} sims</span>
                      {scen.winRate !== null && (
                        <span className={`font-semibold ${scen.winRate >= 60 ? "text-emerald-700" : "text-zinc-700"}`}>
                          {scen.winRate}% won
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-zinc-800 h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
