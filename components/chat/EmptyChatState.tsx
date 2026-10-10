import React from "react";
import { MessageSquareText, Lightbulb } from "lucide-react";

export interface EmptyChatStateProps {
  productName: string;
}

export function EmptyChatState({ productName }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center mb-4">
        <MessageSquareText className="w-6 h-6" />
      </div>

      <h3 className="text-base font-semibold text-zinc-900 mb-1">
        Start Practicing Your Pitch
      </h3>
      <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
        A prospective buyer is currently looking at <strong className="text-zinc-800">{productName}</strong>. Greet them in the chat box below to initiate the sales conversation.
      </p>

      <div className="w-full bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-left">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Recommended Opening Moves</span>
        </div>
        <ul className="text-xs text-zinc-600 space-y-1.5 list-disc list-inside">
          <li>“Hi there! Welcome to {productName}. Are you looking to solve a specific challenge today?”</li>
          <li>“Hello! I see you’re exploring our options. Can I help point you toward the right fit?”</li>
          <li>Ask qualifying discovery questions before pushing the close.</li>
        </ul>
      </div>
    </div>
  );
}
