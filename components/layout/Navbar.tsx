"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/auth/actions";
import { PanelLeft, LogOut, MessageSquare } from "lucide-react";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { Organization, OrganizationMembership, OrgRole } from "@/lib/tenant";

export interface NavbarProps {
  userEmail?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  activeOrg?: Organization;
  activeRole?: OrgRole;
  organizations?: OrganizationMembership[];
}

export function Navbar({
  userEmail,
  onToggleSidebar,
  isSidebarOpen,
  activeOrg,
  activeRole,
  organizations,
}: NavbarProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await logout();
    });
  };

  return (
    <header className="h-14 border-b border-zinc-200 bg-white sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 [&_svg]:shrink-0 ${
              isSidebarOpen
                ? "text-zinc-900 bg-zinc-100 hover:bg-zinc-200/70"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        <Link href="/chats" className="flex items-center gap-2 select-none shrink-0 [&_svg]:shrink-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-semibold text-zinc-900 text-sm tracking-tight hidden xs:inline">
            SalesChat
          </span>
        </Link>

        {activeOrg && activeRole && organizations && organizations.length > 0 && (
          <div className="flex items-center pl-1 sm:pl-3 border-l border-zinc-200 min-w-0">
            <OrgSwitcher
              currentOrg={activeOrg}
              currentRole={activeRole}
              organizations={organizations}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {userEmail && (
          <div className="flex items-center gap-2">
            <Avatar name={userEmail} size="sm" />
            <span className="hidden md:inline-block text-xs text-zinc-600 max-w-[140px] truncate font-medium">
              {userEmail}
            </span>
          </div>
        )}

        <form onSubmit={handleSignOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
            isLoading={isPending}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">{isPending ? "Signing out..." : "Sign Out"}</span>
            <span className="sm:hidden">{isPending ? "..." : "Exit"}</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
