"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { X, Building2 } from "lucide-react";
import { notify } from "@/lib/toast";
import { Organization } from "@/lib/tenant";

export interface CreateOrgDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (org: Organization) => void;
}

export function CreateOrgDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateOrgDialogProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      notify.error("Please enter an organization name");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create organization");
      }

      const { organization } = await res.json();
      notify.success(`Created "${cleanName}"`);
      setName("");
      onClose();
      if (onCreated) {
        onCreated(organization);
      }
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">New Organization</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          Create a shared workspace to collaborate with your sales team.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Organization Name"
            placeholder="e.g. Acme Sales Team"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
