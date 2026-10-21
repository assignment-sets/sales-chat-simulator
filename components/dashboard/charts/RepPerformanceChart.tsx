"use client";

import React, { useState, useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { DashboardMemberSummary } from "@/app/api/dashboard/route";
import { Flame, AlertCircle } from "lucide-react";

export type PerformanceMetric = "winRate" | "avgScore" | "volume" | "tokens";
export type PerformanceView = "top" | "bottom";

export interface RepPerformanceChartProps {
  members: DashboardMemberSummary[];
  onSelectMember?: (member: DashboardMemberSummary) => void;
}

export function RepPerformanceChart({
  members,
  onSelectMember,
}: RepPerformanceChartProps) {
  const [metric, setMetric] = useState<PerformanceMetric>("winRate");
  const [view, setView] = useState<PerformanceView>("top");

  // Rank members based on chosen metric and view
  const rankedMembers = useMemo(() => {
    // Only consider members with activity or registered
    const eligible = [...members].filter((m) => {
      if (metric === "winRate") return m.winRate !== null;
      if (metric === "avgScore") return m.avgScore !== null;
      if (metric === "volume") return m.simulationsCount >= 0;
      if (metric === "tokens") return m.tokensUsed >= 0;
      return true;
    });

    eligible.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (metric === "winRate") {
        valA = a.winRate ?? -1;
        valB = b.winRate ?? -1;
      } else if (metric === "avgScore") {
        valA = a.avgScore ?? -1;
        valB = b.avgScore ?? -1;
      } else if (metric === "volume") {
        valA = a.simulationsCount;
        valB = b.simulationsCount;
      } else if (metric === "tokens") {
        valA = a.tokensUsed;
        valB = b.tokensUsed;
      }

      return view === "top" ? valB - valA : valA - valB;
    });

    return eligible.slice(0, 5);
  }, [members, metric, view]);

  // Determine maximum reference value for proportional bar widths
  const maxRefValue = useMemo(() => {
    if (metric === "winRate") return 100;
    if (metric === "avgScore") return 5;
    if (metric === "volume") {
      return Math.max(1, ...members.map((m) => m.simulationsCount));
    }
    if (metric === "tokens") {
      return Math.max(1, ...members.map((m) => m.tokensUsed));
    }
    return 100;
  }, [members, metric]);

  const getMetricDisplay = (member: DashboardMemberSummary) => {
    if (metric === "winRate") {
      return member.winRate !== null ? `${member.winRate}%` : "—";
    }
    if (metric === "avgScore") {
      return member.avgScore !== null ? `${member.avgScore} / 5` : "—";
    }
    if (metric === "volume") {
      return `${member.simulationsCount} ${member.simulationsCount === 1 ? "sim" : "sims"}`;
    }
    if (metric === "tokens") {
      return `${(member.tokensUsed / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
    }
    return "";
  };

  const getBarPercentage = (member: DashboardMemberSummary) => {
    let val = 0;
    if (metric === "winRate") val = member.winRate ?? 0;
    else if (metric === "avgScore") val = member.avgScore ?? 0;
    else if (metric === "volume") val = member.simulationsCount;
    else if (metric === "tokens") val = member.tokensUsed;

    return Math.min(100, Math.max(4, Math.round((val / maxRefValue) * 100)));
  };

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-zinc-900">Rep Performance Benchmarks</h3>
          </div>
          <p className="text-[11px] text-zinc-400">
            Compare reps by closing efficiency, evaluation scores, or activity
          </p>
        </div>

        {/* View Toggle (Top Performers vs Needs Coaching) */}
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/80 text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setView("top")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              view === "top"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Top Performers</span>
          </button>
          <button
            type="button"
            onClick={() => setView("bottom")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              view === "bottom"
                ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Needs Coaching</span>
          </button>
        </div>
      </div>

      {/* Metric Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setMetric("winRate")}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 border ${
            metric === "winRate"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          Win Rate
        </button>
        <button
          type="button"
          onClick={() => setMetric("avgScore")}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 border ${
            metric === "avgScore"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          Avg Evaluation
        </button>
        <button
          type="button"
          onClick={() => setMetric("volume")}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 border ${
            metric === "volume"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          Simulation Volume
        </button>
        <button
          type="button"
          onClick={() => setMetric("tokens")}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 border ${
            metric === "tokens"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          AI Tokens
        </button>
      </div>

      {/* Horizontal Progress Bars List */}
      <div className="space-y-3 my-auto py-1">
        {rankedMembers.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No member data available for this metric yet.
          </div>
        ) : (
          rankedMembers.map((member, index) => {
            const pct = getBarPercentage(member);
            const isFirst = index === 0;

            return (
              <div
                key={member.userId}
                onClick={() => onSelectMember?.(member)}
                className={`group flex items-center gap-3 p-1.5 -mx-1.5 rounded-xl transition-colors ${
                  onSelectMember ? "cursor-pointer hover:bg-zinc-50" : ""
                }`}
              >
                {/* Rank Badge */}
                <div className="w-5 text-center shrink-0">
                  <span
                    className={`text-xs font-mono font-bold ${
                      isFirst && view === "top"
                        ? "text-amber-500"
                        : "text-zinc-400"
                    }`}
                  >
                    #{index + 1}
                  </span>
                </div>

                {/* Member Info */}
                <div className="flex items-center gap-2 w-32 sm:w-40 shrink-0">
                  <Avatar name={member.fullName || member.email} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">
                      {member.fullName || member.email.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {member.role}
                    </p>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        view === "bottom" && (metric === "winRate" || metric === "avgScore")
                          ? "bg-rose-400"
                          : view === "top" && (metric === "winRate" || metric === "avgScore")
                          ? "bg-emerald-500"
                          : "bg-zinc-800"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Numeric Metric Value */}
                <div className="w-20 text-right shrink-0">
                  <span
                    className={`text-xs font-mono font-semibold ${
                      view === "top" && metric === "winRate" && (member.winRate ?? 0) >= 60
                        ? "text-emerald-600"
                        : view === "bottom" && metric === "winRate" && (member.winRate ?? 0) < 50
                        ? "text-rose-600"
                        : "text-zinc-800"
                    }`}
                  >
                    {getMetricDisplay(member)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
