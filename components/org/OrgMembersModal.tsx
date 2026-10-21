"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Loader } from "@/components/ui/Loader";
import { Avatar } from "@/components/ui/Avatar";
import { X, Users, UserPlus, Trash2, ShieldCheck } from "lucide-react";
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
  email?: string;
  full_name?: string;
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
        const err = await res.json();
        throw new Error(err.error || "Failed to load members");
      }
      const data = await res.json();
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
      setCurrentUserId(data.current_user_id || "");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to load organization members");
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
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      notify.error("Please enter a valid email address");
      return;
    }

    try {
      setIsInviting(true);
      const res = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invite member");
      }

      const result = await res.json();
      if (result.result?.status === "added") {
        notify.success(`${inviteEmail} added to organization`);
      } else {
        notify.success(`Invitation sent to ${inviteEmail}`);
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
    const confirmMessage = isSelf
      ? "Are you sure you want to leave this organization?"
      : `Are you sure you want to remove this member?`;

    if (!confirm(confirmMessage)) return;

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Team Members
              </h2>
              <p className="text-xs text-zinc-500">
                Manage who has access to {organization.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite Member Section (Owners/Admins only) */}
        {isOwnerOrAdmin && (
          <form onSubmit={handleInvite} className="py-4 border-b border-zinc-100">
            <label className="text-xs font-medium text-zinc-700 mb-1.5 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-zinc-500" />
              Invite New Member
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                className="h-9 px-2.5 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
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
                const displayName = member.full_name || (isSelf ? "You (Current Account)" : `User ${member.user_id.slice(0, 8)}`);

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={member.full_name || member.email || "Member"} size="sm" />
                      <div className="truncate">
                        <div className="text-xs font-medium text-zinc-900 truncate">
                          {displayName}
                          {isSelf && member.full_name && (
                            <span className="ml-1 text-[10px] text-zinc-400 font-normal">(You)</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {member.email ? `${member.email} • ` : ""}Joined {new Date(member.created_at).toLocaleDateString()}
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
