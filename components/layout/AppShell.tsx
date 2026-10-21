"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar, ChatSummary } from "@/components/layout/Sidebar";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { Organization, OrganizationMembership, OrgRole } from "@/lib/tenant";

export interface AppShellProps {
  userEmail?: string;
  chats: ChatSummary[];
  activeOrg?: Organization;
  activeRole?: OrgRole;
  organizations?: OrganizationMembership[];
  children: React.ReactNode;
}

function AppShellContent({
  userEmail,
  chats,
  activeOrg,
  activeRole,
  organizations,
  children,
}: AppShellProps) {
  const { isOpen, toggleSidebar, closeMobile } = useSidebar();
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
          onCloseMobile={closeMobile}
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

export function AppShell(props: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellContent {...props} />
    </SidebarProvider>
  );
}
