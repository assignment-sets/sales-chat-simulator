"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Loader } from "@/components/ui/Loader";
import { Avatar } from "@/components/ui/Avatar";
import { X, Users, UserPlus, Trash2, ShieldCheck, Copy, Check, RotateCw, Crown } from "lucide-react";
import Link from "next/link";
import { getPlanConfig, getQuotaLimit } from "@/lib/plans";
import { notify } from "@/lib/toast";
import { Organization, OrgRole } from "@/lib/tenant";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

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
  token?: string;
  expires_at?: string;
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
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [isInviting, setIsInviting] = useState(false);

  // Role modification and ownership transfer state
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberItem | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const plan = getPlanConfig(organization.plan_tier);
  const seatLimit = getQuotaLimit(organization.plan_tier, "team_seats");
  const totalSeatsUsed = members.length + invitations.length;
  const isSeatLimitReached = !isLoading && totalSeatsUsed >= seatLimit;

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
        notify.success(`Invitation created for ${inviteEmail}`);
        if (result.result?.token && typeof window !== "undefined") {
          try {
            const inviteUrl = `${window.location.origin}/invite/${result.result.token}`;
            await navigator.clipboard.writeText(inviteUrl);
            notify.success("Invite link copied to clipboard!");
          } catch {
            // Non-fatal
          }
        }
      }

      setInviteEmail("");
      fetchMembers();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = async (token?: string) => {
    if (!token) return;
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(token);
      notify.success("Invite link copied to clipboard");
      setTimeout(() => {
        setCopiedToken((prev) => (prev === token ? null : prev));
      }, 2000);
    } catch {
      notify.error("Failed to copy link to clipboard");
    }
  };

  const handleRevokeInvite = async (invite: InvitationItem) => {
    if (!confirm(`Revoke invitation for ${invite.email}?`)) return;

    try {
      const res = await fetch(
        `/api/organizations/${organization.id}/members?inviteId=${invite.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to revoke invitation");
      }

      notify.success("Invitation revoked");
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to revoke invitation");
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

  const handleRoleChange = async (member: MemberItem, newRole: "admin" | "member") => {
    if (member.role === newRole) return;
    try {
      setUpdatingMemberId(member.id);
      const res = await fetch(`/api/organizations/${organization.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update member role");
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
      notify.success(
        `Updated ${member.full_name || member.email || "member"}'s role to ${newRole}`
      );
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to update member role");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const confirmTransferOwnership = async () => {
    if (!transferTarget) return;

    try {
      setIsTransferring(true);
      const res = await fetch(
        `/api/organizations/${organization.id}/transfer-ownership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerUserId: transferTarget.user_id }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to transfer ownership");
      }

      notify.success(
        `Ownership transferred to ${transferTarget.full_name || transferTarget.email}. You are now an Admin.`
      );
      setTransferTarget(null);
      onClose();
      window.location.reload();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to transfer ownership");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleResendInvite = async (invite: InvitationItem) => {
    try {
      setResendingInviteId(invite.id);
      const res = await fetch(
        `/api/organizations/${organization.id}/invitations/${invite.id}/resend`,
        { method: "POST" }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to resend invitation");
      }

      const data = await res.json();
      const updated = data.invitation;

      if (updated?.token) {
        setInvitations((prev) =>
          prev.map((i) =>
            i.id === invite.id
              ? { ...i, token: updated.token, expires_at: updated.expires_at }
              : i
          )
        );

        if (typeof window !== "undefined") {
          try {
            const inviteUrl =
              updated.invite_url || `${window.location.origin}/invite/${updated.token}`;
            await navigator.clipboard.writeText(inviteUrl);
            setCopiedToken(updated.token);
            notify.success("Invitation refreshed & new link copied to clipboard!");
            setTimeout(() => {
              setCopiedToken((prev) => (prev === updated.token ? null : prev));
            }, 2000);
            return;
          } catch {
            // Non-fatal
          }
        }
      }

      notify.success(`Invitation refreshed for ${invite.email}`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResendingInviteId(null);
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
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-members-modal-title"
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 id="org-members-modal-title" className="text-base font-semibold text-zinc-900">
                Team Members
              </h2>
              <p className="text-xs text-zinc-500">
                Manage who has access to {organization.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite Member Section (Owners/Admins only) */}
        {isOwnerOrAdmin && (
          <form onSubmit={handleInvite} className="py-4 border-b border-zinc-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-zinc-500" />
                <span>Invite New Member</span>
              </label>
              <span className="text-[11px] font-mono text-zinc-500">
                {totalSeatsUsed} / {seatLimit} seats ({plan.name})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder={
                    isSeatLimitReached
                      ? `Seat limit reached on ${plan.name} plan`
                      : "colleague@company.com"
                  }
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 text-xs"
                  disabled={isSeatLimitReached}
                  required
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                disabled={isSeatLimitReached}
                className="h-9 px-2.5 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                type="submit"
                size="sm"
                isLoading={isInviting}
                disabled={isSeatLimitReached}
              >
                Invite
              </Button>
            </div>
            {isSeatLimitReached && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Seat quota reached for this workspace.</span>
                <Link
                  href="/pricing"
                  onClick={onClose}
                  className="font-semibold text-zinc-900 hover:underline"
                >
                  View Plans &rarr;
                </Link>
              </div>
            )}
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      {userRole === "owner" && !isSelf && member.role !== "owner" ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member, e.target.value as "admin" | "member")
                          }
                          disabled={updatingMemberId === member.id}
                          aria-label={`Change role for ${displayName}`}
                          className="h-7 px-2 text-[11px] font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer disabled:opacity-50"
                        >
                          <option value="member">MEMBER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role.toUpperCase()}
                        </Badge>
                      )}

                      {/* Transfer ownership button (owner-only, target not self and not owner) */}
                      {userRole === "owner" && !isSelf && member.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => setTransferTarget(member)}
                          className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Transfer workspace ownership"
                          aria-label={`Transfer ownership to ${displayName}`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}

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
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="muted" className="text-[10px]">
                          Pending ({invite.role})
                        </Badge>
                        {invite.token && (
                          <button
                            type="button"
                            onClick={() => handleCopyLink(invite.token)}
                            className="p-1 text-zinc-500 hover:text-zinc-800 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer"
                            title="Copy invitation link"
                            aria-label={`Copy invitation link for ${invite.email}`}
                          >
                            {copiedToken === invite.token ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(invite)}
                            disabled={resendingInviteId === invite.id}
                            className="p-1 text-zinc-500 hover:text-zinc-800 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Resend invitation & refresh link"
                            aria-label={`Resend invitation for ${invite.email}`}
                          >
                            <RotateCw
                              className={`w-3.5 h-3.5 ${
                                resendingInviteId === invite.id ? "animate-spin text-zinc-800" : ""
                              }`}
                            />
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(invite)}
                            className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Revoke invitation"
                            aria-label={`Revoke invitation for ${invite.email}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Transfer Ownership Confirmation Overlay */}
        {transferTarget && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs rounded-3xl p-6 flex flex-col justify-center items-center text-center animate-in fade-in duration-150">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-3">
              <Crown className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">
              Transfer Workspace Ownership
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-5">
              Are you sure you want to transfer ownership of{" "}
              <strong className="text-zinc-800">{organization.name}</strong> to{" "}
              <strong className="text-zinc-800">
                {transferTarget.full_name || transferTarget.email || "this member"}
              </strong>
              ? You will step down to an Admin role.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTransferTarget(null)}
                disabled={isTransferring}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={confirmTransferOwnership}
                isLoading={isTransferring}
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        )}

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
