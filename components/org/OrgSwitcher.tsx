"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check, Plus, Users } from "lucide-react";
import { Organization, OrganizationMembership, OrgRole } from "@/lib/tenant";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/lib/toast";
import { CreateOrgDialog } from "@/components/org/CreateOrgDialog";
import { OrgMembersModal } from "@/components/org/OrgMembersModal";

export interface OrgSwitcherProps {
  currentOrg: Organization;
  currentRole: OrgRole;
  organizations: OrganizationMembership[];
}

export function OrgSwitcher({
  currentOrg,
  currentRole,
  organizations,
}: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === currentOrg.id) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to switch organization");
      }

      setIsOpen(false);
      // Route to /chats to show the new organization's simulations
      router.push("/chats");
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error switching organization");
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "accent";
      case "admin":
        return "success";
      default:
        return "muted";
    }
  };

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={isSwitching}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors border cursor-pointer select-none ${
            isOpen
              ? "bg-zinc-100 border-zinc-300 text-zinc-900"
              : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="max-w-[130px] truncate font-semibold text-zinc-900">
            {currentOrg.name}
          </span>
          <Badge variant={getRoleBadgeVariant(currentRole)} className="text-[10px] px-1.5 py-0">
            {currentRole}
          </Badge>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white border border-zinc-200/90 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider select-none">
              Organizations
            </div>

            <div className="max-h-56 overflow-y-auto px-1 space-y-0.5">
              {organizations.map((membership) => {
                const isSelected = membership.organization_id === currentOrg.id;
                return (
                  <button
                    key={membership.id}
                    onClick={() => handleSwitchOrg(membership.organization_id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-zinc-100 text-zinc-900 font-semibold"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Building2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-zinc-900" : "text-zinc-400"
                        }`}
                      />
                      <span className="truncate">{membership.organization.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-400 uppercase">
                        {membership.role}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-zinc-100 my-1.5" />

            {/* Quick Actions */}
            <div className="px-1 space-y-0.5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsMembersOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Team Members</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsCreateOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                <span>New Organization</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateOrgDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newOrg) => {
          handleSwitchOrg(newOrg.id);
        }}
      />

      <OrgMembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        organization={currentOrg}
        userRole={currentRole}
      />
    </>
  );
}
