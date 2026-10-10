"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export interface LeadContextCardProps {
  productName: string;
  productDescription: string;
}

export function LeadContextCard({
  productName,
  productDescription,
}: LeadContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="accent" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Lead Trigger
          </Badge>
          <span className="text-sm font-semibold text-zinc-900">
            {productName}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-medium transition-colors select-none"
        >
          {isExpanded ? (
            <>
              Hide Context <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View Pitch & Policies <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
        Prospect is actively browsing this offering. Greet them, discover their needs, and qualify the lead.
      </p>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-zinc-200/80 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed bg-white/60 p-3 rounded-xl">
          <span className="font-semibold text-zinc-900 block mb-1">
            Product Pitch & Policies:
          </span>
          {productDescription}
        </div>
      )}
    </div>
  );
}
