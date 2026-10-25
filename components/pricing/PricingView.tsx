"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/lib/toast";
import {
  PLAN_CONFIGS,
  PlanTier,
  normalizePlanTier,
  getPlanConfig,
} from "@/lib/plans";

export interface PricingViewProps {
  organizationName: string;
  currentTier?: string | null;
  simulationsUsedThisMonth: number;
  seatsUsed: number;
}

interface TierFeatureRow {
  label: string;
  included: boolean;
}

const TIER_FEATURE_LISTS: Record<PlanTier, TierFeatureRow[]> = {
  starter: [
    { label: "15 practice simulations / month", included: true },
    { label: "1 workspace seat (personal use)", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Detailed AI Coaching Breakdown", included: false },
    { label: "Team Oversight Dashboard & analytics", included: false },
    { label: "Markdown transcript export", included: false },
  ],
  pro: [
    { label: "150 practice simulations / month", included: true },
    { label: "Up to 10 team seats", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Unlimited Detailed AI Coaching", included: true },
    { label: "Full Team Dashboard & rep benchmarks", included: true },
    { label: "Markdown transcript export", included: true },
  ],
  scale: [
    { label: "600 practice simulations / month", included: true },
    { label: "Up to 50 team seats", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Unlimited Detailed AI Coaching", included: true },
    { label: "Full Team Dashboard & rep benchmarks", included: true },
    { label: "Markdown transcript export", included: true },
  ],
};

export function PricingView({
  organizationName,
  currentTier,
  simulationsUsedThisMonth,
  seatsUsed,
}: PricingViewProps) {
  const router = useRouter();
  const [switchingTier, setSwitchingTier] = useState<PlanTier | null>(null);
  const activeTier = normalizePlanTier(currentTier);
  const activePlan = getPlanConfig(activeTier);

  const handleSwitchTier = async (targetTier: PlanTier) => {
    if (targetTier === activeTier) return;

    try {
      setSwitchingTier(targetTier);
      const res = await fetch("/api/organizations/tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_tier: targetTier }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update plan");
      }

      notify.success(`Switched to ${PLAN_CONFIGS[targetTier].name} plan`);
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error updating plan");
    } finally {
      setSwitchingTier(null);
    }
  };

  const simLimit = activePlan.quotas.monthly_simulations;
  const seatLimit = activePlan.quotas.team_seats;
  const simPercent = Math.min(
    100,
    Math.round((simulationsUsedThisMonth / Math.max(simLimit, 1)) * 100)
  );
  const seatPercent = Math.min(
    100,
    Math.round((seatsUsed / Math.max(seatLimit, 1)) * 100)
  );

  const tiers: PlanTier[] = ["starter", "pro", "scale"];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/chats"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Practice</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              Plans & Usage
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
              Workspace: <span className="font-medium text-zinc-700">{organizationName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-zinc-400">Active Tier:</span>
            <Badge variant="accent" className="text-xs px-2.5 py-0.5 uppercase tracking-wider">
              {activePlan.name}
            </Badge>
          </div>
        </div>

        {/* Current Monthly Quota Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-zinc-700">
                Monthly Simulations
              </span>
              <span className="font-mono font-semibold text-zinc-900">
                {simulationsUsedThisMonth} / {simLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  simPercent >= 100 ? "bg-rose-500" : "bg-zinc-900"
                }`}
                style={{ width: `${simPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Resets on the 1st of each calendar month (UTC)
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-zinc-700">
                Team Seats
              </span>
              <span className="font-mono font-semibold text-zinc-900">
                {seatsUsed} / {seatLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  seatPercent >= 100 ? "bg-amber-500" : "bg-zinc-900"
                }`}
                style={{ width: `${seatPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Includes active members and pending invitations
            </p>
          </div>
        </div>

        {/* 3-Column Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tierKey) => {
            const plan = PLAN_CONFIGS[tierKey];
            const isCurrent = tierKey === activeTier;
            const isPopular = tierKey === "pro";
            const features = TIER_FEATURE_LISTS[tierKey];

            return (
              <div
                key={tierKey}
                className={`rounded-3xl p-6 flex flex-col justify-between border transition-all bg-white ${
                  isPopular
                    ? "border-zinc-900 shadow-md ring-1 ring-zinc-900/5"
                    : "border-zinc-200/90 shadow-2xs"
                }`}
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-zinc-900">
                      {plan.name}
                    </h2>
                    {isCurrent ? (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        Current Plan
                      </Badge>
                    ) : isPopular ? (
                      <Badge variant="accent" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        Recommended
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-xs text-zinc-500 min-h-[32px]">
                    {plan.tagline}
                  </p>

                  {/* Price */}
                  <div className="my-5 pb-5 border-b border-zinc-100 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-zinc-900 tracking-tight font-mono">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      / month per workspace
                    </span>
                  </div>

                  {/* Feature List */}
                  <ul className="space-y-3 mb-6">
                    {features.map((feat, idx) => (
                      <li
                        key={idx}
                        className={`flex items-start gap-2.5 text-xs ${
                          feat.included ? "text-zinc-700" : "text-zinc-400"
                        }`}
                      >
                        {feat.included ? (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" />
                        )}
                        <span className={feat.included ? "font-medium" : "line-through decoration-zinc-200"}>
                          {feat.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button: Instant 1-click access */}
                <Button
                  type="button"
                  variant={isPopular && !isCurrent ? "primary" : "outline"}
                  size="md"
                  disabled={isCurrent || switchingTier !== null}
                  isLoading={switchingTier === tierKey}
                  onClick={() => handleSwitchTier(tierKey)}
                  className="w-full text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                >
                  {isCurrent
                    ? "Active Plan"
                    : `Switch to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
