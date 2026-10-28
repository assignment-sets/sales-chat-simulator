"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { X, Sparkles } from "lucide-react";
import { notify } from "@/lib/toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { productName: string; productDescription: string }) => Promise<void>;
}

export function NewChatDialog({ isOpen, onClose, onSubmit }: NewChatDialogProps) {
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { containerRef, handleBackdropClick } = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !productDescription.trim()) {
      notify.error("Please enter both product name and context");
      return;
    }

    try {
      setIsLoading(true);
      await onSubmit({
        productName: productName.trim(),
        productDescription: productDescription.trim(),
      });
      setProductName("");
      setProductDescription("");
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to create simulation");
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
        aria-labelledby="new-chat-dialog-title"
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
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 id="new-chat-dialog-title" className="text-lg font-bold text-zinc-900">New Simulation</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          Enter what you are pitching to start the practice session.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Product or Service"
            placeholder="e.g. Acme CRM"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />

          <Textarea
            label="Context & Common Objections"
            placeholder="e.g. $99/mo B2B CRM. Common objections: pricing and migration time."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={3}
            required
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
              Start Simulation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
