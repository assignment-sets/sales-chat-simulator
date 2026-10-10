"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { X, Sparkles } from "lucide-react";

export interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { productName: string; productDescription: string }) => Promise<void>;
}

export function NewChatDialog({ isOpen, onClose, onSubmit }: NewChatDialogProps) {
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !productDescription.trim()) {
      setError("Please provide both product name and details.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onSubmit({
        productName: productName.trim(),
        productDescription: productDescription.trim(),
      });
      setProductName("");
      setProductDescription("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create simulation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">New Sales Simulation</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          Specify what you are selling. The AI will adopt the role of a realistic prospect evaluating this offering.
        </p>

        {error && (
          <div className="p-3 mb-4 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Product or Service Name"
            placeholder="e.g. Acme SaaS CRM, Custom SEO Audit, Luxury Noise-Cancelling Headphones"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />

          <Textarea
            label="Pitch, Pricing, Policies & Objections Context"
            placeholder="e.g. B2B software for marketing agencies starting at $99/mo. 14-day trial without credit card. Common objections: cost compared to HubSpot, migration effort, onboarding duration."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={4}
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
