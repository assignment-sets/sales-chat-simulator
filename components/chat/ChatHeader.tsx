"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, X, Pencil, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ExportChatButton } from "@/components/chat/ExportChatButton";
import { RenameChatModal } from "@/components/chat/RenameChatModal";
import { PlanTier } from "@/lib/plans";
import { notify } from "@/lib/toast";

export interface ChatHeaderProps {
  chatId?: string;
  productName: string;
  productDescription: string;
  messageCount: number;
  planTier?: PlanTier;
  status?: string;
  onRename?: (newName: string, newDesc?: string) => void;
  onArchiveToggle?: (newStatus: string) => void;
}

export function ChatHeader({
  chatId,
  productName,
  productDescription,
  messageCount,
  planTier = "starter",
  status = "ACTIVE",
  onRename,
  onArchiveToggle,
}: ChatHeaderProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isArchived = status === "ARCHIVED";

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

  const handleArchiveToggle = async () => {
    if (!chatId || isArchiving) return;

    const action = isArchived ? "resume" : "archive";
    try {
      setIsArchiving(true);
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to ${action} simulation`);
      }

      const json = await res.json();
      const updatedStatus = json.chat?.status || (isArchived ? "ACTIVE" : "ARCHIVED");
      notify.success(isArchived ? "Simulation resumed" : "Simulation archived");
      onArchiveToggle?.(updatedStatus);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : `Failed to ${action} simulation`);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <div className="h-13 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white relative z-20">
        {/* Left: Product Title, Edit Pencil, Status Badge & Pitch/Policies Toggle */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 truncate max-w-[140px] sm:max-w-xs md:max-w-md">
              {productName}
            </h2>

            {chatId && (
              <button
                type="button"
                onClick={() => setIsRenameOpen(true)}
                className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Edit simulation title"
                title="Edit simulation details"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isArchived && (
            <Badge variant="muted" className="text-[11px] gap-1 px-2 py-0 h-5">
              <Archive className="w-3 h-3 text-zinc-400" />
              Archived
            </Badge>
          )}

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

        {/* Right: Archive / Resume Action, Message Counter & Export Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {chatId && (
            <Button
              type="button"
              variant={isArchived ? "primary" : "outline"}
              size="sm"
              onClick={handleArchiveToggle}
              disabled={isArchiving}
              className={`text-xs h-7 px-2.5 rounded-lg font-medium transition-colors ${
                isArchived
                  ? "shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-zinc-200"
              }`}
              leftIcon={
                isArchived ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <Archive className="w-3.5 h-3.5 text-zinc-400" />
                )
              }
            >
              {isArchived ? "Resume" : "Archive"}
            </Button>
          )}

          <div className="text-xs text-zinc-400 font-medium select-none hidden sm:inline-block">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </div>

          <ExportChatButton planTier={planTier} />
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

      {chatId && (
        <RenameChatModal
          isOpen={isRenameOpen}
          onClose={() => setIsRenameOpen(false)}
          chatId={chatId}
          initialProductName={productName}
          initialProductDescription={productDescription}
          onSuccess={(updated) => {
            onRename?.(updated.productName, updated.productDescription);
          }}
        />
      )}
    </>
  );
}
