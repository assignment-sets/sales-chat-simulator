"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ExportChatButton } from "@/components/chat/ExportChatButton";

export interface ChatHeaderProps {
  productName: string;
  productDescription: string;
  messageCount: number;
}

export function ChatHeader({
  productName,
  productDescription,
  messageCount,
}: ChatHeaderProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    }

    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen]);

  return (
    <div className="h-13 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white relative z-20">
      {/* Left: Product Title & Pitch/Policies Toggle */}
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <h2 className="text-sm font-semibold text-zinc-900 truncate max-w-[160px] sm:max-w-xs md:max-w-md">
          {productName}
        </h2>

        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsPopoverOpen((prev) => !prev)}
          className="text-xs h-7 px-2.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-zinc-200 gap-1.5 font-medium shrink-0"
          rightIcon={
            isPopoverOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )
          }
        >
          Pitch & Policies
        </Button>
      </div>

      {/* Right: Message Counter & Export Button */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-xs text-zinc-400 font-medium select-none hidden sm:inline-block">
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </div>

        <ExportChatButton />
      </div>

      {/* Floating Pitch & Policies Popover */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-12 left-4 sm:left-6 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-lg bg-white border border-zinc-200 rounded-2xl p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
              <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Pitch, Pricing & Policies</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1">
            {productDescription}
          </div>
        </div>
      )}
    </div>
  );
}
