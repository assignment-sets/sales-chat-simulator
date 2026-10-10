"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar, ChatSummary } from "@/components/layout/Sidebar";
import { NewChatDialog } from "@/components/chat/NewChatDialog";

export interface AppShellProps {
  userEmail?: string;
  chats: ChatSummary[];
  children: React.ReactNode;
}

export function AppShell({ userEmail, chats, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
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
    setIsNewChatOpen(false);
    router.push(`/chats/${chat.id}`);
    router.refresh();
  };

  return (
    <div className="h-screen h-dvh max-h-screen bg-white text-zinc-900 flex flex-col font-sans overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          chats={chats}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onNewChat={() => setIsNewChatOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-white relative overflow-hidden">
          {children}
        </main>
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSubmit={handleCreateChat}
      />
    </div>
  );
}
