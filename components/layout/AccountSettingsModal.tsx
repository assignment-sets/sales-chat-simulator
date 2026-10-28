"use client";

import React, { useState } from "react";
import { X, Settings, Download, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/lib/toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  userEmail = "",
  userName = "",
}: AccountSettingsModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: () => {
      setShowDeleteConfirm(false);
      setDeleteConfirmationInput("");
      onClose();
    },
  });

  if (!isOpen) return null;

  const displayName = userName || (userEmail ? userEmail.split("@")[0] : "Account");

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const res = await fetch("/api/account/export", { method: "GET" });

      if (res.status === 429) {
        notify.error("Export rate limit reached. Please try again later.");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate data export");
      }

      // Extract filename from Content-Disposition header if available
      let filename = `saleschat-data-export-${new Date().toISOString().split("T")[0]}.json`;
      const disposition = res.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      notify.success("Data export downloaded successfully");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationInput !== "DELETE") {
      notify.error('Please type "DELETE" in capital letters to confirm.');
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      notify.success("Account successfully deleted");
      // Redirect to login after successful deletion and session cleanup
      window.location.href = "/login";
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Account deletion failed");
    } finally {
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
        aria-labelledby="account-settings-title"
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 id="account-settings-title" className="text-base font-semibold text-zinc-900">
                Account Settings
              </h2>
              <p className="text-xs text-zinc-500">
                Manage your personal data, portability, and privacy.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmationInput("");
              onClose();
            }}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 min-h-0">
          {/* Profile Overview Card */}
          <div className="flex items-center gap-3.5 p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
            <Avatar name={displayName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 truncate">
                  {displayName}
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  User
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {userEmail || "No email linked"}
              </p>
            </div>
          </div>

          {/* Data Portability (GDPR Art. 20) */}
          <div className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-zinc-700" />
                  <span>Data Portability (GDPR Art. 20)</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Download a machine-readable JSON copy of your profile, memberships, simulations, coaching feedback, and pending invitations.
                </p>
              </div>
            </div>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportData}
                isLoading={isExporting}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export All Data
              </Button>
            </div>
          </div>

          {/* Danger Zone (GDPR Art. 17) */}
          <div className="p-4 border border-red-200 bg-red-50/30 rounded-2xl space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Danger Zone</span>
              </h3>
              <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
                Permanently delete your account and personal data. Private workspaces are deleted. Simulations in shared team workspaces are retained anonymously for team audit trails.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Account
                </Button>
              </div>
            ) : (
              <form onSubmit={handleDeleteAccount} className="pt-2 border-t border-red-200/60 space-y-3">
                <Input
                  label='Type "DELETE" to confirm'
                  placeholder="DELETE"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  autoComplete="off"
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
                    disabled={deleteConfirmationInput !== "DELETE"}
                  >
                    Permanently Delete
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
