"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/auth/actions";
import { PanelLeft, LogOut, MessageSquare } from "lucide-react";

export interface NavbarProps {
  userEmail?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export function Navbar({
  userEmail,
  onToggleSidebar,
}: NavbarProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await logout();
    });
  };

  return (
    <header className="h-14 border-b border-zinc-200 bg-white sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center [&_svg]:shrink-0"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        <Link href="/chats" className="flex items-center gap-2 select-none [&_svg]:shrink-0">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">
            SalesChat
          </span>
          <span className="hidden sm:inline-block text-[11px] font-medium text-zinc-400 border border-zinc-200 rounded-full px-2 py-0.2">
            Simulator
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {userEmail && (
          <div className="flex items-center gap-2">
            <Avatar name={userEmail} size="sm" />
            <span className="hidden md:inline-block text-xs text-zinc-600 max-w-[160px] truncate font-medium">
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
            {isPending ? "Signing out..." : "Sign Out"}
          </Button>
        </form>
      </div>
    </header>
  );
}
