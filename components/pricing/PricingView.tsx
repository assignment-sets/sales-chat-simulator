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

export type Currency = "USD" | "INR";

export interface PricingViewProps {
  organizationName?: string;
  currentTier?: string | null;
  simulationsUsedThisMonth?: number;
  seatsUsed?: number;
  isAuthenticated?: boolean;
}

interface TierFeatureRow {
  label: string;
  included: boolean;
}

interface TierPriceConfig {
  symbol: string;
  amount: string;
  period: string;
}

const TIER_PRICING: Record<Currency, Record<PlanTier, TierPriceConfig>> = {
  USD: {
    starter: { symbol: "$", amount: "0", period: "/ month" },
    solo: { symbol: "$", amount: "5", period: "/ month" },
    team: { symbol: "$", amount: "29", period: "/ month" },
    scale: { symbol: "$", amount: "79", period: "/ month" },
  },
  INR: {
    starter: { symbol: "₹", amount: "0", period: "/ month" },
    solo: { symbol: "₹", amount: "399", period: "/ month" },
    team: { symbol: "₹", amount: "1,999", period: "/ month" },
    scale: { symbol: "₹", amount: "5,499", period: "/ month" },
  },
};

const TIER_FEATURE_LISTS: Record<PlanTier, TierFeatureRow[]> = {
  starter: [
    { label: "10 practice simulations / month", included: true },
    { label: "1 workspace seat (personal use)", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Detailed AI Coaching Breakdown", included: false },
    { label: "Team Oversight Dashboard & analytics", included: false },
  ],
  solo: [
    { label: "50 practice simulations / month", included: true },
    { label: "1 workspace seat (personal use)", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Unlimited Detailed AI Coaching", included: true },
    { label: "Team Oversight Dashboard & analytics", included: false },
  ],
  team: [
    { label: "200 practice simulations / month", included: true },
    { label: "Up to 10 team seats", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Unlimited Detailed AI Coaching", included: true },
    { label: "Full Team Dashboard & rep benchmarks", included: true },
  ],
  scale: [
    { label: "600 practice simulations / month", included: true },
    { label: "Up to 50 team seats", included: true },
    { label: "Automated Jev Win/Loss & 1–5 score", included: true },
    { label: "Unlimited Detailed AI Coaching", included: true },
    { label: "Full Team Dashboard & rep benchmarks", included: true },
  ],
};

export function PricingView({
  organizationName,
  currentTier,
  simulationsUsedThisMonth = 0,
  seatsUsed = 0,
  isAuthenticated = true,
}: PricingViewProps) {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const activeTier = normalizePlanTier(currentTier);
  const activePlan = getPlanConfig(activeTier);
  const hasActivePaidPlan = isAuthenticated && activeTier !== "starter";

  const handleAction = async (targetTier: PlanTier) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (targetTier === activeTier) return;

    if (hasActivePaidPlan || targetTier === "starter") {
      // Subscribed users manage upgrades, downgrades, and cancellations via the Customer Portal
      try {
        setLoadingTier(targetTier);
        const res = await fetch("/api/payments/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnUrl: window.location.href }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to open billing portal");
        if (!data.portalUrl) throw new Error("No billing portal URL returned");
        window.location.href = data.portalUrl;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Failed to open billing portal");
      } finally {
        setLoadingTier(null);
      }
      return;
    }

    // Free tier user initiating paid plan checkout
    try {
      setLoadingTier(targetTier);
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: targetTier,
          currency,
          returnUrl: `${window.location.origin}/pricing?checkout=success`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoadingTier(null);
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

  const tiers: PlanTier[] = ["starter", "solo", "team", "scale"];

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={isAuthenticated ? "/chats" : "/"}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isAuthenticated ? "Back to Practice" : "Back to Home"}</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              {isAuthenticated ? "Plans & Usage" : "Transparent Plans & Pricing"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
              {isAuthenticated ? (
                <>
                  Workspace: <span className="font-medium text-zinc-700">{organizationName}</span>
                </>
              ) : (
                "Predictable simulation tiers for individuals and growing sales teams."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            {/* Currency toggle */}
            <div className="flex items-center p-0.5 bg-zinc-100 border border-zinc-200/80 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
                aria-pressed={currency === "USD"}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currency === "INR"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
                aria-pressed={currency === "INR"}
              >
                INR (₹)
              </button>
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Active Tier:</span>
                <Badge variant="accent" className="text-xs px-2.5 py-0.5 uppercase tracking-wider">
                  {activePlan.name}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Current Monthly Quota Summary Bar (Only for authenticated active orgs) */}
        {isAuthenticated && (
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
        )}

        {/* Subscribed Plan Self-Service Portal Banner */}
        {hasActivePaidPlan && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Subscribed Workspace
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-xs text-zinc-300 font-medium">
                  {activePlan.name} Plan Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                Plan upgrades, downgrades, saved payment methods, and invoice downloads are managed seamlessly via your Customer Portal.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingTier !== null}
              isLoading={loadingTier === "starter"}
              onClick={() => handleAction("starter")}
              className="shrink-0 bg-white text-zinc-900 hover:bg-zinc-100 border-transparent text-xs font-semibold cursor-pointer"
            >
              Manage Subscription
            </Button>
          </div>
        )}

        {/* 4-Column Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((tierKey) => {
            const plan = PLAN_CONFIGS[tierKey];
            const isCurrent = isAuthenticated && tierKey === activeTier;
            const isPopular = tierKey === "team";
            const features = TIER_FEATURE_LISTS[tierKey];
            const price = TIER_PRICING[currency][tierKey];

            return (
              <div
                key={tierKey}
                className={`rounded-3xl p-6 flex flex-col justify-between border transition-all bg-white relative ${
                  isCurrent
                    ? "border-zinc-900 shadow-md ring-2 ring-zinc-900"
                    : isPopular && !isAuthenticated
                      ? "border-zinc-900 shadow-md ring-1 ring-zinc-900/5"
                      : "border-zinc-200/90 shadow-2xs hover:border-zinc-300"
                }`}
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-zinc-900">
                      {plan.name}
                    </h2>
                    {isCurrent ? (
                      <Badge variant="accent" className="text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold">
                        Current Plan
                      </Badge>
                    ) : isPopular ? (
                      <Badge variant="muted" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        Popular
                      </Badge>
                    ) : null}
                  </div>

                  <p className="text-xs text-zinc-500 min-h-[32px]">
                    {plan.tagline}
                  </p>

                  {/* Price */}
                  <div className="my-5 pb-5 border-b border-zinc-100 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-zinc-900 tracking-tight font-mono">
                      {price.symbol}{price.amount}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      {price.period}
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

                {/* Action Button */}
                {isAuthenticated ? (
                  <Button
                    type="button"
                    variant={isPopular && !hasActivePaidPlan && !isCurrent ? "primary" : "outline"}
                    size="md"
                    disabled={isCurrent || loadingTier !== null}
                    isLoading={loadingTier === tierKey}
                    onClick={() => handleAction(tierKey)}
                    className="w-full text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isCurrent
                      ? "Current Plan"
                      : hasActivePaidPlan
                        ? "Manage in Portal"
                        : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <Link href="/login" className="w-full">
                    <Button
                      type="button"
                      variant={isPopular ? "primary" : "outline"}
                      size="md"
                      className="w-full text-xs font-semibold cursor-pointer"
                    >
                      {tierKey === "starter"
                        ? "Start Free"
                        : `Start with ${plan.name}`}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
