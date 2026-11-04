"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Building2,
  AlertTriangle,
  Trash2,
  LogOut,
  Save,
  CreditCard,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/lib/toast";
import { Organization, OrgRole } from "@/lib/tenant";
import { normalizePlanTier } from "@/lib/plans";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface OrgSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization;
  userRole: OrgRole;
  totalWorkspacesCount: number;
  currentUserId?: string;
  onOrgRenamed?: (updatedOrg: Organization) => void;
}

export function OrgSettingsModal({
  isOpen,
  onClose,
  organization,
  userRole,
  totalWorkspacesCount,
  currentUserId,
  onOrgRenamed,
}: OrgSettingsModalProps) {
  const router = useRouter();

  // General settings state
  const [nameInput, setNameInput] = useState(organization.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Reset internal states on modal open or organization change
  useEffect(() => {
    if (isOpen) {
      setNameInput(organization.name);
      setShowDeleteConfirm(false);
      setDeleteConfirmationInput("");
    }
  }, [isOpen, organization.name]);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: () => {
      setShowDeleteConfirm(false);
      setDeleteConfirmationInput("");
      onClose();
    },
  });

  if (!isOpen) return null;

  const isOwner = userRole === "owner";
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";
  const isNameChanged = nameInput.trim() !== organization.name;
  const isSoleWorkspace = totalWorkspacesCount <= 1;
  const planTier = normalizePlanTier(organization.plan_tier);
  const hasPaidBilling = planTier !== "starter" && Boolean(organization.dodo_customer_id);

  // 1. Handle Rename Organization
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();

    if (cleanName.length < 2 || cleanName.length > 50) {
      notify.error("Workspace name must be between 2 and 50 characters");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update workspace name");
      }

      const data = await res.json();
      notify.success("Workspace name updated successfully");

      if (onOrgRenamed && data.organization) {
        onOrgRenamed(data.organization);
      }
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to rename workspace");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Dodo Customer Billing Portal
  const handleOpenBillingPortal = async () => {
    try {
      setIsOpeningPortal(true);
      const res = await fetch("/api/payments/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal");
      if (!data.portalUrl) throw new Error("No portal URL returned");
      window.location.href = data.portalUrl;
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  // 2. Handle Leave Organization
  const handleLeaveWorkspace = async () => {
    if (!currentUserId) {
      notify.error("Could not resolve current user identifier to leave workspace");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to leave ${organization.name}? You will lose access to team simulations and coaching insights.`
      )
    ) {
      return;
    }

    try {
      setIsLeaving(true);
      const res = await fetch(
        `/api/organizations/${organization.id}/members?userId=${encodeURIComponent(currentUserId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to leave workspace");
      }

      notify.success(`Left ${organization.name}`);
      onClose();
      window.location.href = "/chats";
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to leave workspace");
      setIsLeaving(false);
    }
  };

  // 3. Handle Delete Organization
  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteConfirmationInput.trim() !== organization.name) {
      notify.error(`Please type "${organization.name}" exactly to confirm deletion`);
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmationInput.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete workspace");
      }

      notify.success("Workspace permanently deleted");
      onClose();
      window.location.href = "/chats";
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeleting(false);
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
        aria-labelledby="org-settings-modal-title"
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="org-settings-modal-title" className="text-base font-semibold text-zinc-900">
                Workspace Settings
              </h2>
              <p className="text-xs text-zinc-500">
                Manage preferences for {organization.name}
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {/* General Workspace Information */}
          <form onSubmit={handleRename} className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Workspace Profile
              </h3>
              <Badge variant="accent" className="text-[10px] uppercase font-semibold">
                {organization.plan_tier} PLAN
              </Badge>
            </div>

            <div>
              <Input
                label="Workspace Name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Acme Corp"
                disabled={isSaving || !isAdminOrOwner}
                className="h-9 text-xs"
                required
              />
              {!isAdminOrOwner && (
                <p className="text-[11px] text-zinc-400 mt-1">
                  Only workspace owners and admins can edit the workspace name.
                </p>
              )}
            </div>

            {isAdminOrOwner && (
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSaving}
                  disabled={!isNameChanged || nameInput.trim().length < 2 || nameInput.trim().length > 50}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  Save Changes
                </Button>
              </div>
            )}
          </form>

          {/* Subscription & Billing */}
          <div className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-zinc-500" />
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                  Subscription & Billing
                </h3>
              </div>
              <Badge
                variant={planTier === "starter" ? "muted" : "accent"}
                className="text-[10px] uppercase font-semibold"
              >
                {planTier} PLAN
              </Badge>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              {hasPaidBilling
                ? "Manage payment methods, download invoices, or modify your subscription in the self-service billing portal."
                : "Your workspace is currently on the free Starter plan. Upgrade to unlock higher simulation quotas, team seats, and advanced AI coaching."}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
              <Link
                href="/pricing"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <span>View all plans & features</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {isAdminOrOwner ? (
                hasPaidBilling ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isLoading={isOpeningPortal}
                    onClick={handleOpenBillingPortal}
                    leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                  >
                    Manage Subscription & Invoices
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onClose();
                      router.push("/pricing");
                    }}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Upgrade Workspace Plan
                  </Button>
                )
              ) : (
                <span className="text-[11px] text-zinc-400">
                  Workspace admin access required to manage billing
                </span>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-4 border border-red-200 bg-red-50/30 rounded-2xl space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Danger Zone</span>
              </h3>
            </div>

            {/* Non-owner: Leave Organization */}
            {!isOwner && (
              <div className="space-y-2">
                <p className="text-xs text-red-700/80 leading-relaxed">
                  Leave this workspace. You will lose access to team simulations, dashboards, and shared workspaces.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleLeaveWorkspace}
                  isLoading={isLeaving}
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Leave Workspace
                </Button>
              </div>
            )}

            {/* Owner: Leave Guidance */}
            {isOwner && (
              <p className="text-xs text-zinc-500 leading-relaxed">
                As the workspace owner, you must transfer ownership to another member before leaving, or delete the workspace below.
              </p>
            )}

            {/* Owner: Delete Organization */}
            {isOwner && (
              <div className="pt-2 border-t border-red-200/60 space-y-2.5">
                {isSoleWorkspace ? (
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    You cannot delete your only workspace. To delete all your data, please use Delete Account under Account Settings.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-red-700/80 leading-relaxed">
                      Permanently delete this workspace and all associated chats, members, and data. This action cannot be undone.
                    </p>

                    {!showDeleteConfirm ? (
                      <div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Delete Workspace
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleDeleteOrganization} className="space-y-3 pt-1">
                        <Input
                          label={`Type "${organization.name}" to confirm`}
                          placeholder={organization.name}
                          value={deleteConfirmationInput}
                          onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                          autoComplete="off"
                          className="h-9 text-xs"
                          required
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeleteConfirmationInput("");
                            }}
                            disabled={isDeleting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            isLoading={isDeleting}
                            disabled={deleteConfirmationInput.trim() !== organization.name}
                          >
                            Permanently Delete Workspace
                          </Button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
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
