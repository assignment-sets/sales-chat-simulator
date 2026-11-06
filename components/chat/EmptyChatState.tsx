import React from "react";
import { MessageSquareText } from "lucide-react";

export interface EmptyChatStateProps {
  productName: string;
  onSelectStarter?: (prompt: string) => void;
}

export function EmptyChatState({ productName, onSelectStarter }: EmptyChatStateProps) {
  const sampleStarters = [
    `Hi! I saw you're exploring ${productName}. What's your current solution for this?`,
    `Welcome! What is the primary bottleneck your team is trying to solve with ${productName}?`,
    `Happy to help! Are you looking for security details, feature capabilities, or pricing?`,
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
      <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center mb-3">
        <MessageSquareText className="w-5 h-5" />
      </div>

      <h3 className="text-sm font-semibold text-zinc-900 mb-1">
        Start the simulation
      </h3>
      <p className="text-xs text-zinc-500 mb-5">
        The prospect is reviewing <span className="font-medium text-zinc-800">{productName}</span>. Choose an opener or write your own.
      </p>

      <div className="w-full space-y-2 text-left">
        <span className="text-[11px] font-mono font-medium text-zinc-400 block px-1">
          Opening angles:
        </span>
        {sampleStarters.map((starter, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectStarter?.(starter)}
            className="w-full p-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-xs text-zinc-700 text-left transition-colors cursor-pointer block select-none"
          >
            &ldquo;{starter}&rdquo;
          </button>
        ))}
      </div>
    </div>
  );
}
