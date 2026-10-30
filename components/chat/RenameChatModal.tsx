"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { X, Pencil } from "lucide-react";
import { notify } from "@/lib/toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface RenameChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  initialProductName: string;
  initialProductDescription?: string;
  onSuccess?: (updated: { productName: string; productDescription?: string }) => void;
}

export function RenameChatModal({
  isOpen,
  onClose,
  chatId,
  initialProductName,
  initialProductDescription = "",
  onSuccess,
}: RenameChatModalProps) {
  const [productName, setProductName] = useState(initialProductName);
  const [productDescription, setProductDescription] = useState(initialProductDescription);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProductName(initialProductName);
      setProductDescription(initialProductDescription);
    }
  }, [isOpen, initialProductName, initialProductDescription]);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = productName.trim();
    if (!trimmedName) {
      notify.error("Product name cannot be empty");
      return;
    }
    if (trimmedName.length > 120) {
      notify.error("Product name must be 120 characters or fewer");
      return;
    }
    if (productDescription.length > 2000) {
      notify.error("Pitch context must be 2000 characters or fewer");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: trimmedName,
          product_description: productDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update simulation");
      }

      const json = await res.json();
      notify.success("Simulation updated");
      onSuccess?.({
        productName: json.chat?.product_name || trimmedName,
        productDescription: json.chat?.product_description || productDescription.trim(),
      });
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to update simulation");
    } finally {
      setIsLoading(false);
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
        aria-labelledby="rename-chat-dialog-title"
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center">
            <Pencil className="w-4 h-4" />
          </div>
          <h2 id="rename-chat-dialog-title" className="text-lg font-bold text-zinc-900">
            Edit Simulation
          </h2>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          Update the product name or pitch policies for this practice session.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Product or Service"
            placeholder="e.g. Acme CRM"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            maxLength={120}
            required
            autoFocus
          />

          <Textarea
            label="Pitch, Pricing & Context"
            placeholder="e.g. $99/mo B2B CRM. Common objections: pricing and migration time."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            maxLength={2000}
            rows={4}
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
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
