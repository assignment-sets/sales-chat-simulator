"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar, ChatSummary } from "@/components/layout/Sidebar";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { Organization, OrganizationMembership, OrgRole } from "@/lib/tenant";
import { PanelLeftOpen } from "lucide-react";

export interface AppShellProps {
  userEmail?: string;
  userName?: string;
  hasPassword?: boolean;
  chats: ChatSummary[];
  activeOrg?: Organization;
  activeRole?: OrgRole;
  organizations?: OrganizationMembership[];
  children: React.ReactNode;
}

function AppShellContent({
  userEmail,
  userName,
  hasPassword = true,
  chats,
  activeOrg,
  activeRole,
  organizations,
  children,
}: AppShellProps) {
  const { isOpen, toggleSidebar, closeMobile } = useSidebar();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (hasPassword !== false) return;
    const key = "chat2sell_pwd_prompt_shown";
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Ignore storage errors in restricted contexts
    }
    notify.info("You signed in with Google. Set a password anytime in Settings.");
  }, [hasPassword]);

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
        userName={userName}
        hasPassword={hasPassword}
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isOpen}
        activeOrg={activeOrg}
        activeRole={activeRole}
        organizations={organizations}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          chats={chats}
          isOpen={isOpen}
          onToggle={toggleSidebar}
          onCloseMobile={closeMobile}
          onNewChat={() => setIsNewChatOpen(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-white relative overflow-hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
            className={`absolute top-2.5 left-3 z-30 p-1.5 rounded-lg border border-zinc-200/90 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 shadow-2xs cursor-pointer flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out ${
              !isOpen
                ? "opacity-100 scale-100 pointer-events-auto delay-100"
                : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>

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

export function AppShell(props: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellContent {...props} />
    </SidebarProvider>
  );
}
