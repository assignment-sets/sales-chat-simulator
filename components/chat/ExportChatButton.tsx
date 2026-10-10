"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import { exportChatAsMarkdown } from "@/lib/exportChat";
import { notify } from "@/lib/toast";

export function ExportChatButton({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [isExporting, setIsExporting] = useState(false);

  // Check if user is inside a specific chat room (/chats/[id])
  const match = pathname.match(/^\/chats\/([a-zA-Z0-9-]+)$/);
  const chatId = match ? match[1] : null;

  if (!chatId) return null;

  const handleExport = async () => {
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
      leftIcon={<Download className="w-3.5 h-3.5" />}
      className={`text-xs h-7 px-2.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-zinc-200 gap-1.5 font-medium shrink-0 ${className}`}
    >
      Export
    </Button>
  );
}
