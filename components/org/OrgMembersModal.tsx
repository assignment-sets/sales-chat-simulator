"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Loader } from "@/components/ui/Loader";
import { X, Users, UserPlus, Trash2, Mail, ShieldCheck } from "lucide-react";
import { notify } from "@/lib/toast";
import { Organization, OrgRole } from "@/lib/tenant";

export interface OrgMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization;
  userRole: OrgRole;
}

interface MemberItem {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

interface InvitationItem {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export function OrgMembersModal({
  isOpen,
  onClose,
  organization,
  userRole,
}: OrgMembersModalProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [isInviting, setIsInviting] = useState(false);

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/organizations/${organization.id}/members`);
      if (!res.ok) {
        throw new Error("Failed to load members");
      }
      const data = await res.json();
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
      setCurrentUserId(data.current_user_id || "");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error loading team");
    } finally {
      setIsLoading(false);
    }
  }, [organization.id]);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen, fetchMembers]);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      notify.error("Please enter a valid email address");
      return;
    }

    try {
      setIsInviting(true);
      const res = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invite member");
      }

      const { result } = await res.json();
      if (result?.status === "added") {
        notify.success(`Added ${email} to ${organization.name}`);
      } else {
        notify.success(`Invitation sent to ${email}`);
      }

      setInviteEmail("");
      fetchMembers();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (member: MemberItem) => {
    const isSelf = member.user_id === currentUserId;
    const confirmMsg = isSelf
      ? `Are you sure you want to leave ${organization.name}?`
      : "Are you sure you want to remove this member?";

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(
        `/api/organizations/${organization.id}/members?memberId=${member.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove member");
      }

      notify.success(isSelf ? "Left organization" : "Member removed");
      if (isSelf) {
        onClose();
        window.location.reload();
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "accent";
      case "admin":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">
                {organization.name}
              </h2>
              <p className="text-xs text-zinc-400">Manage workspace members and roles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer p-1 rounded-lg"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invite Member Section (Owners & Admins only) */}
        {isOwnerOrAdmin && (
          <form
            onSubmit={handleInvite}
            className="pt-4 pb-4 border-b border-zinc-100 flex flex-col gap-2.5"
          >
            <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-zinc-500" /> Invite Colleague
            </span>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isInviting}
                  required
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                disabled={isInviting}
                className="px-3 py-2 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" size="sm" isLoading={isInviting}>
                Invite
              </Button>
            </div>
          </form>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-[160px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader size="md" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">No members found.</div>
          ) : (
            <>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                Active Members ({members.length})
              </div>
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {isSelf ? "You" : <Mail className="w-3.5 h-3.5 text-zinc-500" />}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium text-zinc-900 truncate">
                          {isSelf ? "You (Current Account)" : `User ${member.user_id.slice(0, 8)}`}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role.toUpperCase()}
                      </Badge>

                      {/* Remove button if permitted */}
                      {(isOwnerOrAdmin || isSelf) && member.role !== "owner" && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={isSelf ? "Leave organization" : "Remove member"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1.5">
                    Pending Invitations ({invitations.length})
                  </div>
                  {invitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/40 border border-amber-200/50 mb-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-medium text-zinc-800 truncate">
                          {invite.email}
                        </span>
                      </div>
                      <Badge variant="muted" className="text-[10px]">
                        Pending ({invite.role})
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
