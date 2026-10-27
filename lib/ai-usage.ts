import { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { forbidden } from "@/lib/api-response";
import { getStartOfCurrentMonthUTC } from "@/lib/entitlements";
import { getPlanConfig, normalizePlanTier, PlanTier } from "@/lib/plans";

/**
 * Monthly per-organization AI usage ceiling.
 *
 * This is a *safety backstop*, not a marketed plan quota: it exists so a stuck
 * request, a bug, or an abusive client cannot burn unbounded Groq spend. The
 * customer-facing limits stay in `lib/plans.ts` (simulations, seats) — see
 * `docs/PRICING_AND_LIMITS.md` for why we do not sell raw tokens.
 *
 * Ceilings sit at roughly 3x the maximum expected usage for each tier, so a
 * normal workspace should never touch them.
 */
export const AI_TOKEN_CEILINGS: Record<PlanTier, number> = {
  starter: 500_000,
  pro: 5_000_000,
  scale: 20_000_000,
};

export interface AiTokenUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}

export interface NormalizedAiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AiCeilingResult =
  | {
      ok: true;
      usedTokens: number;
      ceilingTokens: number;
      periodStart: string;
      planTier: PlanTier;
    }
  | {
      ok: false;
      response: NextResponse;
      usedTokens: number;
      ceilingTokens: number;
      periodStart: string;
      planTier: PlanTier;
    };

function isCeilingDisabled(): boolean {
  return process.env.AI_CEILING_DISABLED === "true";
}

function toTokenCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeUsage(usage?: AiTokenUsage | null): NormalizedAiUsage {
  const promptTokens = toTokenCount(usage?.prompt_tokens);
  const completionTokens = toTokenCount(usage?.completion_tokens);
  const reportedTotal = toTokenCount(usage?.total_tokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens: reportedTotal || promptTokens + completionTokens,
  };
}

function pricePerMillionTokens(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Best-effort USD estimate for observability only. It is never used to enforce
 * the ceiling: Groq prices change per model, and a stale hardcoded price would
 * silently move the limit. Set `GROQ_INPUT_PRICE_PER_MTOK` /
 * `GROQ_OUTPUT_PRICE_PER_MTOK` to make the ledger's spend column meaningful.
 */
export function estimateGroqCostUsd(usage?: AiTokenUsage | null): number {
  const { promptTokens, completionTokens } = normalizeUsage(usage);
  const inputPrice = pricePerMillionTokens(process.env.GROQ_INPUT_PRICE_PER_MTOK);
  const outputPrice = pricePerMillionTokens(process.env.GROQ_OUTPUT_PRICE_PER_MTOK);

  return (promptTokens / 1_000_000) * inputPrice + (completionTokens / 1_000_000) * outputPrice;
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatResetDate(): string {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return reset.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Checks whether an organization still has room under its monthly token
 * ceiling. Must be called after authentication and authorization.
 *
 * Fails open: a transient database error logs loudly and lets the request
 * through, matching `lib/rate-limit`. The ceiling is a backstop, not the only
 * guard on AI spend.
 */
export async function checkAiTokenCeiling(
  supabase: SupabaseClient,
  organizationId?: string | null
): Promise<AiCeilingResult> {
  const periodStart = getStartOfCurrentMonthUTC();

  if (!organizationId || isCeilingDisabled()) {
    return {
      ok: true,
      usedTokens: 0,
      ceilingTokens: 0,
      periodStart,
      planTier: "starter",
    };
  }

  const [orgResult, usageResult] = await Promise.all([
    supabase.from("organizations").select("id, plan_tier").eq("id", organizationId).maybeSingle(),
    supabase
      .from("organization_ai_usage")
      .select("total_tokens")
      .eq("organization_id", organizationId)
      .eq("period_start", periodStart)
      .maybeSingle(),
  ]);

  if (orgResult.error || usageResult.error || !orgResult.data) {
    console.error("[AI Usage] Ceiling check failed; allowing request.", {
      organizationId,
      orgError: orgResult.error,
      usageError: usageResult.error,
    });

    return {
      ok: true,
      usedTokens: 0,
      ceilingTokens: 0,
      periodStart,
      planTier: "starter",
    };
  }

  const planTier = normalizePlanTier(orgResult.data.plan_tier);
  const ceilingTokens = AI_TOKEN_CEILINGS[planTier];
  const usedTokens = toTokenCount(usageResult.data?.total_tokens);

  if (usedTokens < ceilingTokens) {
    return { ok: true, usedTokens, ceilingTokens, periodStart, planTier };
  }

  console.warn(
    `[AI Usage] Ceiling reached organization=${organizationId} plan=${planTier} used=${usedTokens}/${ceilingTokens}`
  );

  return {
    ok: false,
    usedTokens,
    ceilingTokens,
    periodStart,
    planTier,
    response: forbidden(
      `This workspace has reached its monthly AI usage safety limit (${formatTokens(
        usedTokens
      )}/${formatTokens(ceilingTokens)} tokens on the ${
        getPlanConfig(planTier).name
      } plan). It resets on ${formatResetDate()}. Contact support if this is unexpected.`
    ),
  };
}

/**
 * Adds a completed AI call to the organization's monthly ledger. Never throws:
 * failing to meter a call must not fail the user's request.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  organizationId: string | null | undefined,
  usage?: AiTokenUsage | null
): Promise<void> {
  if (!organizationId || isCeilingDisabled()) {
    return;
  }

  const normalized = normalizeUsage(usage);
  if (normalized.totalTokens === 0) {
    return;
  }

  try {
    const { error } = await supabase.rpc("record_org_ai_usage", {
      target_org_id: organizationId,
      prompt_tokens: normalized.promptTokens,
      completion_tokens: normalized.completionTokens,
      total_tokens: normalized.totalTokens,
      estimated_cost_usd: estimateGroqCostUsd(usage),
    });

    if (error) {
      console.error("[AI Usage] Failed to record usage:", error);
    }
  } catch (err) {
    console.error("[AI Usage] Failed to record usage:", err);
  }
}
