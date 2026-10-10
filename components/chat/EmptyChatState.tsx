import React from "react";
import { MessageSquareText, Lightbulb } from "lucide-react";

export interface EmptyChatStateProps {
  productName: string;
}

export function EmptyChatState({ productName }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto my-auto">
      <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center mb-3">
        <MessageSquareText className="w-5 h-5" />
      </div>

      <h3 className="text-sm font-semibold text-zinc-900 mb-1">
        Start the conversation
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Prospect is viewing <span className="font-medium text-zinc-800">{productName}</span>.
      </p>

      <div className="w-full bg-zinc-50 border border-zinc-200/70 rounded-xl p-3 text-left">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 mb-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Opening suggestion</span>
        </div>
        <p className="text-xs text-zinc-700 italic">
          &ldquo;Hi! Let me know if you have any questions about {productName}.&rdquo;
        </p>
      </div>
    </div>
  );
}
