"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Pencil,
  Archive,
  RotateCcw,
  MoreHorizontal,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RenameChatModal } from "@/components/chat/RenameChatModal";
import { exportChatAsMarkdown } from "@/lib/exportChat";
import { PlanTier } from "@/lib/plans";
import { notify } from "@/lib/toast";
import { useSidebar } from "@/components/layout/SidebarContext";

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
  status = "ACTIVE",
  onRename,
  onArchiveToggle,
}: ChatHeaderProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { isOpen: isSidebarOpen } = useSidebar();
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isArchived = status === "ARCHIVED";

  // Close popover and action menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsPopoverOpen(false);
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    if (isPopoverOpen || isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen, isMenuOpen]);

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
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("chat:status-change", {
            detail: { chatId, status: updatedStatus },
          })
        );
      }
      notify.success(isArchived ? "Simulation resumed" : "Simulation archived");
      onArchiveToggle?.(updatedStatus);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : `Failed to ${action} simulation`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleExport = async () => {
    if (!chatId || isExporting) return;
    try {
      setIsExporting(true);
      const res = await fetch(`/api/chats/${chatId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch chat data for export");
      }

      const { chat, messages } = await res.json();
      exportChatAsMarkdown({
        product_name: chat.product_name,
        product_description: chat.product_description,
        created_at: chat.created_at,
        messages: messages || [],
      });

      notify.success("Transcript exported successfully");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to export chat");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div
        className={`h-13 border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white relative z-20 transition-[padding] duration-300 ease-in-out ${
          !isSidebarOpen ? "pl-14 sm:pl-14" : ""
        }`}
      >
        {/* Left: Product Title, Rename trigger & Subtle status */}
        <div className="flex items-center gap-2 min-w-0 pr-3">
          <h2 className="text-sm font-semibold text-zinc-900 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
            {productName}
          </h2>

          {chatId && (
            <button
              type="button"
              onClick={() => setIsRenameOpen(true)}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer shrink-0 opacity-60 hover:opacity-100"
              aria-label="Edit simulation title"
              title="Edit simulation details"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {isArchived && (
            <span className="text-xs text-zinc-400 font-normal shrink-0">
              · Archived
            </span>
          )}
        </div>

        {/* Right: Discreet Pitch Reference, Message Counter & Unified Session Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            ref={buttonRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsPopoverOpen((prev) => !prev)}
            className="text-xs h-7 px-2.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg font-medium shrink-0 gap-1"
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

          <span className="text-xs font-mono text-zinc-400 tabular-nums hidden sm:inline-block">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </span>

          {/* Quick Resume Button when Archived */}
          {isArchived && chatId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchiveToggle}
              disabled={isArchiving}
              isLoading={isArchiving}
              className="text-xs h-7 px-2.5 rounded-lg font-medium text-zinc-900 border-zinc-300 hover:bg-zinc-50"
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-zinc-500" />}
            >
              Resume
            </Button>
          )}

          {/* Consolidated Overflow Menu (•••) */}
          {chatId && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="More simulation actions"
                className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <div
                role="menu"
                className={`absolute right-0 top-8 z-30 w-48 bg-white border border-zinc-200 rounded-xl p-1 shadow-lg ring-1 ring-zinc-950/5 ${
                  isMenuOpen ? "block animate-in fade-in zoom-in-95 duration-100" : "hidden"
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsRenameOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleExport();
                  }}
                  disabled={isExporting}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Export Transcript</span>
                </button>

                <div className="my-1 border-t border-zinc-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleArchiveToggle();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg text-left transition-colors cursor-pointer"
                >
                  {isArchived ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Resume Simulation</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Archive Simulation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Floating Pitch & Policies Popover */}
        {isPopoverOpen && (
          <div
            ref={popoverRef}
            className="absolute top-12 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-lg bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-lg ring-1 ring-zinc-950/5 animate-in fade-in zoom-in-95 duration-150"
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
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("chat:renamed", {
                  detail: {
                    chatId,
                    productName: updated.productName,
                    productDescription: updated.productDescription,
                  },
                })
              );
            }
            onRename?.(updated.productName, updated.productDescription);
          }}
        />
      )}
    </>
  );
}
