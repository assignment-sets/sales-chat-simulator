"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import {
  MessageSquarePlus,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Headphones,
} from "lucide-react";

interface PracticePreset {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  productName: string;
  productDescription: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRACTICE_PRESETS: PracticePreset[] = [
  {
    id: "enterprise-security",
    tag: "Enterprise • Compliance",
    title: "Security & Compliance Gatekeeper",
    subtitle: "Overcome infosec & compliance objections when pitching to a skeptical CISO.",
    productName: "FortressGuard SOC-2 Automation",
    productDescription:
      "Enterprise SOC-2 Type II automation software ($24k/year). Skeptical CISO is worried about questionnaire burden, vendor lock-in, and audit failure risks.",
    icon: ShieldCheck,
  },
  {
    id: "budget-cfo",
    tag: "Pricing • ROI Defense",
    title: "Budget-Constrained Finance Lead",
    subtitle: "Defend premium pricing and demonstrate quantifiable payback against spreadsheet inertia.",
    productName: "GrowthWave Modern CRM",
    productDescription:
      "Collaborative sales CRM at $99/seat/mo. Buyer is a frugal Ops Director concerned about switching costs from spreadsheets and demanding payback within 90 days.",
    icon: TrendingUp,
  },
  {
    id: "inbound-discovery",
    tag: "Discovery • Qualification",
    title: "First-Call Inbound Discovery",
    subtitle: "Uncover latent pain points and qualify decision authority under tough questioning.",
    productName: "OmniDesk AI Support Agent",
    productDescription:
      "Tier-1 ticket deflection platform for high-growth support teams. Prospect receives 40k monthly tickets and doubts AI accuracy without hurting CSAT scores.",
    icon: Headphones,
  },
];

export default function ChatsIndexPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PracticePreset | null>(null);
  const router = useRouter();

  // Keyboard shortcut listener: 'n' for new practice when not inside an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || isDialogOpen) return;

      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSelectedPreset(null);
        setIsDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  const handleLaunchPreset = (preset: PracticePreset) => {
    setSelectedPreset(preset);
    setIsDialogOpen(true);
  };

  const handleOpenBlank = () => {
    setSelectedPreset(null);
    setIsDialogOpen(true);
  };

  const handleCreateChat = async (data: {
    productName: string;
    productDescription: string;
  }) => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: data.productName,
        product_description: data.productDescription,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create simulation");
    }

    const { chat } = await res.json();
    setIsDialogOpen(false);
    router.push(`/chats/${chat.id}`);
    router.refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center">
      <div className="w-full max-w-4xl py-6 my-auto">
        {/* Workspace Hub Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-2.5">
            Sales Chat Simulator
          </h1>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            Choose a high-stakes objection scenario below to jump straight in, or start a custom practice session from scratch.
          </p>

          <Button
            onClick={handleOpenBlank}
            size="md"
            className="mx-auto font-medium"
            leftIcon={<MessageSquarePlus className="w-4 h-4" />}
          >
            New Practice Session
          </Button>
        </div>

        {/* 3 Actionable Practice Scenario Cards */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Curated Practice Scenarios
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              3 Archetypes Available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRACTICE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleLaunchPreset(preset)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleLaunchPreset(preset);
                    }
                  }}
                  className="group flex flex-col justify-between text-left p-5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-xs transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        {preset.tag}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <h2 className="text-sm font-semibold text-zinc-900 mb-1.5 group-hover:text-zinc-950 transition-colors">
                      {preset.title}
                    </h2>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {preset.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-zinc-700 pt-4 border-t border-zinc-100 mt-5">
                    <span>Launch Scenario</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Productivity Keyboard Hints */}
        <div className="flex items-center justify-center gap-6 text-[11px] text-zinc-400 font-mono pt-4 border-t border-zinc-100 select-none">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 font-semibold text-[10px]">
              N
            </kbd>
            New practice session
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 font-semibold text-[10px]">
              Esc
            </kbd>
            Close dialog
          </span>
        </div>
      </div>

      <NewChatDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateChat}
        initialProductName={selectedPreset?.productName || ""}
        initialProductDescription={selectedPreset?.productDescription || ""}
      />
    </div>
  );
}
