"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Download, Lock } from "lucide-react";
import { exportChatAsMarkdown } from "@/lib/exportChat";
import { hasFeature, PlanTier } from "@/lib/plans";
import { notify } from "@/lib/toast";

export function ExportChatButton({
  className = "",
  planTier = "starter",
}: {
  className?: string;
  planTier?: PlanTier;
}) {
  const pathname = usePathname();
  const [isExporting, setIsExporting] = useState(false);

  // Check if user is inside a specific chat room (/chats/[id])
  const match = pathname.match(/^\/chats\/([a-zA-Z0-9-]+)$/);
  const chatId = match ? match[1] : null;

  if (!chatId) return null;

  const canExport = hasFeature(planTier, "transcript_export");

  const handleExport = async () => {
    if (!canExport) {
      notify.info(
        "Markdown transcript export is a Pro feature. View Plans & Pricing in the workspace menu."
      );
      return;
    }

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
      console.error("Export error:", err);
      notify.error(err instanceof Error ? err.message : "Failed to export chat");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      isLoading={isExporting}
      leftIcon={
        canExport ? (
          <Download className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3 h-3 text-zinc-400" />
        )
      }
      className={`text-xs h-7 px-2.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-zinc-200 gap-1.5 font-medium shrink-0 ${className}`}
    >
      <span>Export</span>
      {!canExport && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 ml-0.5">
          Pro
        </span>
      )}
    </Button>
  );
}
