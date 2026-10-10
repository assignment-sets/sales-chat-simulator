"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import {
  MessageSquarePlus,
  Compass,
  ShieldCheck,
  Award,
  Zap,
} from "lucide-react";

export default function ChatsIndexPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  const handleCreateChat = async (data: {
    productName: string;
    productDescription: string;
  }) => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: data.productName,
        product_description: data.productDescription,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create simulation");
    }

    const { chat } = await res.json();
    setIsDialogOpen(false);
    router.push(`/chats/${chat.id}`);
    router.refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center">
      <div className="max-w-md w-full text-center my-auto py-8">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Zap className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
          Sales Chat Simulator
        </h1>
        <p className="text-xs text-zinc-500 mb-6 max-w-sm mx-auto">
          Practice pitching, handling objections, and closing deals against realistic AI buyers.
        </p>

        <Button
          onClick={() => setIsDialogOpen(true)}
          size="md"
          className="mx-auto font-medium"
          leftIcon={<MessageSquarePlus className="w-4 h-4" />}
        >
          New Practice Session
        </Button>
      </div>

      <NewChatDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateChat}
      />
    </div>
  );
}
