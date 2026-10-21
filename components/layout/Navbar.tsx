"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/Loader";
import { PanelLeft, MessageSquare, LayoutDashboard } from "lucide-react";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { Organization, OrganizationMembership, OrgRole } from "@/lib/tenant";

export interface NavbarProps {
  userEmail?: string;
  userName?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  activeOrg?: Organization;
  activeRole?: OrgRole;
  organizations?: OrganizationMembership[];
  isDashboard?: boolean;
}

export function Navbar({
  userEmail,
  userName,
  onToggleSidebar,
  isSidebarOpen,
  activeOrg,
  activeRole,
  organizations,
  isDashboard = false,
}: NavbarProps) {
  const router = useRouter();
  const [isNavPending, startNavTransition] = useTransition();
  const [navTarget, setNavTarget] = useState<string | null>(null);

  // Reset target once current view matches the intended route
  useEffect(() => {
    if (navTarget) {
      if ((navTarget === "/dashboard" && isDashboard) || (navTarget === "/chats" && !isDashboard)) {
        setNavTarget(null);
      }
    }
  }, [isDashboard, navTarget]);

  // Safety timeout in case client navigation is interrupted or hangs
  useEffect(() => {
    if (navTarget) {
      const timer = setTimeout(() => {
        setNavTarget(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [navTarget]);

  const handleModeSwitch = (e: React.MouseEvent, target: "/chats" | "/dashboard") => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    if ((target === "/dashboard" && isDashboard) || (target === "/chats" && !isDashboard)) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    setNavTarget(target);
    startNavTransition(() => {
      router.push(target);
    });
  };

  return (
    <header className="h-14 border-b border-zinc-200 bg-white sticky top-0 z-40 flex items-center justify-between px-3 sm:px-6">
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

        <Link
          href="/chats"
          onClick={(e) => {
            if (isDashboard) {
              handleModeSwitch(e, "/chats");
            }
          }}
          className="flex items-center gap-2 select-none shrink-0 [&_svg]:shrink-0"
        >
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

        {/* Practice vs Team Dashboard Switcher for Owners/Admins */}
        {activeRole && (activeRole === "owner" || activeRole === "admin") && (
          <div className="hidden sm:flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/80 text-xs font-medium ml-1 sm:ml-2">
            <Link
              href="/chats"
              onClick={(e) => handleModeSwitch(e, "/chats")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                !isDashboard
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Practice</span>
            </Link>
            <Link
              href="/dashboard"
              onClick={(e) => handleModeSwitch(e, "/dashboard")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                isDashboard
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {(userName || userEmail) && (
          <UserProfileMenu
            userName={userName}
            userEmail={userEmail}
          />
        )}
      </div>

      {/* Practice / Dashboard Mode Transition Loader Overlay */}
      {(isNavPending || navTarget !== null) && (
        <Loader overlay size="md" />
      )}
    </header>
  );
}
