"use client";

import React, { useEffect, useState } from "react";
import { X, Coins, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { notify } from "@/lib/toast";

export interface MemberSimulationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  userEmail: string;
  onSelectChat: (chatId: string) => void;
}

interface MemberSimulation {
  id: string;
  product_name: string;
  product_description: string;
  tokens_used: number;
  status: string;
  created_at: string;
}

export function MemberSimulationsModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  onSelectChat,
}: MemberSimulationsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [simulations, setSimulations] = useState<MemberSimulation[]>([]);

  useEffect(() => {
    if (!isOpen || !userId) {
      setSimulations([]);
      return;
    }

    async function loadMemberSimulations() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/dashboard/members/${userId}/chats`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load member simulations");
        }
        const data = await res.json();
        setSimulations(data.simulations || []);
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Error loading simulations");
      } finally {
        setIsLoading(false);
      }
    }

    loadMemberSimulations();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              Practice Sessions
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Reviewing practice conversations created by{" "}
              <span className="font-semibold text-zinc-800">{userEmail}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader size="md" label="Loading practice sessions..." />
            </div>
          ) : simulations.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              This member hasn&apos;t started any sales practice simulations yet.
            </div>
          ) : (
            simulations.map((sim) => (
              <div
                key={sim.id}
                onClick={() => {
                  onSelectChat(sim.id);
                }}
                className="p-3.5 rounded-2xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-zinc-900 truncate">
                      {sim.product_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      {formatDate(sim.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 line-clamp-1">
                    {sim.product_description}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-xs">
                    <div className="font-semibold text-zinc-700 flex items-center gap-1 justify-end font-mono">
                      <Coins className="w-3 h-3 text-zinc-400" />
                      {(sim.tokens_used || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-400">tokens</div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-zinc-600 group-hover:text-zinc-900"
                    rightIcon={<ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />}
                  >
                    Inspect
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>{simulations.length} total simulations</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
