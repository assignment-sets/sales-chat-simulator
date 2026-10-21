"use client";

import React, { useState } from "react";

export interface ActivityTimelineChartProps {
  timeline: {
    date: string;
    label: string;
    count: number;
    wonCount: number;
  }[];
}

export function ActivityTimelineChart({ timeline }: ActivityTimelineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(1, ...timeline.map((t) => t.count));
  const totalVolume = timeline.reduce((acc, t) => acc + t.count, 0);
  const totalWon = timeline.reduce((acc, t) => acc + t.wonCount, 0);

  // SVG dimensions
  const height = 150;
  const paddingBottom = 26;
  const paddingTop = 12;
  const usableHeight = height - paddingBottom - paddingTop;

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">14-Day Practice Velocity</h3>
          <p className="text-[11px] text-zinc-400">
            Daily simulation volume & won deals trend
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-zinc-900" />
            <span className="text-zinc-500 font-medium">Practices ({totalVolume})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-emerald-500" />
            <span className="text-zinc-500 font-medium">Won ({totalWon})</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[155px]">
        {/* Tooltip on Hover */}
        {hoveredIdx !== null && timeline[hoveredIdx] && (
          <div
            className="absolute -top-7 transform -translate-x-1/2 bg-zinc-900 text-white text-[11px] px-2 py-1 rounded-lg shadow-md pointer-events-none z-10 whitespace-nowrap transition-all flex items-center gap-1.5 font-medium"
            style={{
              left: `${((hoveredIdx + 0.5) / timeline.length) * 100}%`,
            }}
          >
            <span>{timeline[hoveredIdx].label}:</span>
            <span className="font-mono text-zinc-200">{timeline[hoveredIdx].count} sims</span>
            {timeline[hoveredIdx].wonCount > 0 && (
              <span className="text-emerald-400 font-mono">({timeline[hoveredIdx].wonCount} won)</span>
            )}
          </div>
        )}

        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
          {/* Subtle horizontal grid lines */}
          <line
            x1="0"
            y1={paddingTop}
            x2="100%"
            y2={paddingTop}
            stroke="#f4f4f5"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={paddingTop + usableHeight / 2}
            x2="100%"
            y2={paddingTop + usableHeight / 2}
            stroke="#f4f4f5"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={height - paddingBottom}
            x2="100%"
            y2={height - paddingBottom}
            stroke="#e4e4e7"
          />

          {/* Render Bars */}
          {timeline.map((item, idx) => {
            const xPercent = (idx / timeline.length) * 100;
            const barWidthPercent = (1 / timeline.length) * 100 * 0.65;
            const barOffsetPercent = (1 / timeline.length) * 100 * 0.175;

            const barHeight = item.count > 0 ? (item.count / maxVal) * usableHeight : 2;
            const wonHeight = item.count > 0 ? (item.wonCount / maxVal) * usableHeight : 0;
            const yTop = height - paddingBottom - barHeight;
            const yWonTop = height - paddingBottom - wonHeight;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Full bar (Total Sessions) */}
                <rect
                  x={`${xPercent + barOffsetPercent}%`}
                  y={yTop}
                  width={`${barWidthPercent}%`}
                  height={barHeight}
                  rx="3"
                  className={`transition-colors duration-150 ${
                    item.count === 0
                      ? "fill-zinc-200"
                      : isHovered
                      ? "fill-zinc-700"
                      : "fill-zinc-900"
                  }`}
                />

                {/* Won bar overlay */}
                {wonHeight > 0 && (
                  <rect
                    x={`${xPercent + barOffsetPercent}%`}
                    y={yWonTop}
                    width={`${barWidthPercent}%`}
                    height={wonHeight}
                    rx="3"
                    className="fill-emerald-500 pointer-events-none"
                  />
                )}

                {/* X-axis date labels (show every second or third day to prevent overlap) */}
                {(idx % 2 === 0 || idx === timeline.length - 1) && (
                  <text
                    x={`${xPercent + barOffsetPercent + barWidthPercent / 2}%`}
                    y={height - 6}
                    textAnchor="middle"
                    className="text-[9px] fill-zinc-400 font-sans select-none"
                  >
                    {item.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
