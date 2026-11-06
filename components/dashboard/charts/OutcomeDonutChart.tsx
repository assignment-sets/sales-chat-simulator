"use client";

import React from "react";

export interface OutcomeDonutChartProps {
  outcomes: {
    won: number;
    lost: number;
    active: number;
    total: number;
    winRate: number | null;
  };
}

export function OutcomeDonutChart({ outcomes }: OutcomeDonutChartProps) {
  const { won, lost, active, total, winRate } = outcomes;

  // SVG Geometry Constants: 10px sleek stroke for executive data precision
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  const wonRatio = total > 0 ? won / total : 0;
  const lostRatio = total > 0 ? lost / total : 0;
  const activeRatio = total > 0 ? active / total : 0;

  const wonOffset = 0;
  const wonLength = wonRatio * circumference;

  const lostOffset = -wonLength;
  const lostLength = lostRatio * circumference;

  const activeOffset = -(wonLength + lostLength);
  const activeLength = activeRatio * circumference;

  const wonPct = total > 0 ? Math.round((won / total) * 100) : 0;
  const lostPct = total > 0 ? Math.round((lost / total) * 100) : 0;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Deal Outcomes</h3>
          <p className="text-[11px] text-zinc-400">
            Pipeline conversion & conclusion breakdown
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-semibold text-zinc-700 tabular-nums">
            {total} {total === 1 ? "Session" : "Sessions"}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 my-auto py-3">
        {/* SVG Donut */}
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#f4f4f5"
              strokeWidth={strokeWidth}
            />

            {total > 0 ? (
              <>
                {/* Won Segment - Forest Emerald */}
                {won > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#047857"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${wonLength} ${circumference}`}
                    strokeDashoffset={wonOffset}
                    strokeLinecap={won === total ? "round" : "butt"}
                    className="transition-all duration-500 ease-out"
                  />
                )}
                {/* Lost Segment - Muted Crimson */}
                {lost > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#9f1239"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${lostLength} ${circumference}`}
                    strokeDashoffset={lostOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-500 ease-out"
                  />
                )}
                {/* Active Segment - Slate Graphite */}
                {active > 0 && (
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#52525b"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${activeLength} ${circumference}`}
                    strokeDashoffset={activeOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-500 ease-out"
                  />
                )}
              </>
            ) : null}
          </svg>

          {/* Donut Center Stat */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            {total > 0 ? (
              <>
                <span className="text-2xl font-bold font-mono tracking-tight text-zinc-900 tabular-nums leading-none">
                  {winRate !== null ? `${winRate}%` : "—"}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mt-1">
                  Win Rate
                </span>
              </>
            ) : (
              <>
                <span className="text-base font-semibold font-mono text-zinc-400">0</span>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  No Data
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 w-full sm:w-auto min-w-[140px]">
          <div className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-700 shrink-0" />
              <span className="text-zinc-600 font-medium">Deals Won</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="font-semibold text-zinc-900">{won}</span>
              <span className="text-[10px] text-zinc-400">({wonPct}%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-800 shrink-0" />
              <span className="text-zinc-600 font-medium">Deals Lost</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="font-semibold text-zinc-900">{lost}</span>
              <span className="text-[10px] text-zinc-400">({lostPct}%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
              <span className="text-zinc-600 font-medium">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="font-semibold text-zinc-900">{active}</span>
              <span className="text-[10px] text-zinc-400">({activePct}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
