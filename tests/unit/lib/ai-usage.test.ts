import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AI_TOKEN_CEILINGS,
  checkAiTokenCeiling,
  estimateGroqCostUsd,
  normalizeUsage,
  recordAiUsage,
} from "@/lib/ai-usage";
import { getStartOfCurrentMonthUTC } from "@/lib/entitlements";

function builder(data: unknown, error: unknown = null) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  return chain;
}

function fakeSupabase(
  tables: Record<string, any>,
  rpc: any = vi.fn(async () => ({ data: null, error: null }))
) {
  return {
    from: vi.fn((table: string) => tables[table]),
    rpc,
  } as any;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeUsage", () => {
  it("returns zeros for missing usage", () => {
    expect(normalizeUsage(undefined)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it("derives the total when Groq omits it", () => {
    expect(normalizeUsage({ prompt_tokens: 100, completion_tokens: 25 })).toEqual({
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
    });
  });

  it("ignores negative and non-finite counters", () => {
    expect(
      normalizeUsage({ prompt_tokens: -5, completion_tokens: Number.NaN, total_tokens: -1 })
    ).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});

describe("estimateGroqCostUsd", () => {
  it("prices prompt and completion tokens from env overrides", () => {
    vi.stubEnv("GROQ_INPUT_PRICE_PER_MTOK", "1");
    vi.stubEnv("GROQ_OUTPUT_PRICE_PER_MTOK", "2");

    expect(
      estimateGroqCostUsd({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 })
    ).toBeCloseTo(3);
  });

  it("returns zero when no prices are configured", () => {
    expect(estimateGroqCostUsd({ prompt_tokens: 10_000, completion_tokens: 10_000 })).toBe(0);
  });
});

describe("checkAiTokenCeiling", () => {
  it("allows requests below the tier ceiling", async () => {
    const supabase = fakeSupabase({
      organizations: builder({ id: "org-1", plan_tier: "pro" }),
      organization_ai_usage: builder({ total_tokens: 1000 }),
    });

    const result = await checkAiTokenCeiling(supabase, "org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedTokens).toBe(1000);
      expect(result.ceilingTokens).toBe(AI_TOKEN_CEILINGS.pro);
      expect(result.periodStart).toBe(getStartOfCurrentMonthUTC());
    }
  });

  it("blocks requests at the ceiling with a 403", async () => {
    const supabase = fakeSupabase({
      organizations: builder({ id: "org-1", plan_tier: "starter" }),
      organization_ai_usage: builder({ total_tokens: AI_TOKEN_CEILINGS.starter }),
    });

    const result = await checkAiTokenCeiling(supabase, "org-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(result.usedTokens).toBe(AI_TOKEN_CEILINGS.starter);
    }
  });

  it("treats a missing ledger row as zero usage", async () => {
    const supabase = fakeSupabase({
      organizations: builder({ id: "org-1", plan_tier: "scale" }),
      organization_ai_usage: builder(null),
    });

    const result = await checkAiTokenCeiling(supabase, "org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedTokens).toBe(0);
    }
  });

  it("fails open when the ledger query errors", async () => {
    const supabase = fakeSupabase({
      organizations: builder({ id: "org-1", plan_tier: "starter" }),
      organization_ai_usage: builder(null, { message: "boom" }),
    });

    const result = await checkAiTokenCeiling(supabase, "org-1");

    expect(result.ok).toBe(true);
  });

  it("skips the check when no organization is resolved", async () => {
    const from = vi.fn();
    const result = await checkAiTokenCeiling({ from } as any, undefined);

    expect(result.ok).toBe(true);
    expect(from).not.toHaveBeenCalled();
  });

  it("can be disabled for load tests", async () => {
    vi.stubEnv("AI_CEILING_DISABLED", "true");
    const from = vi.fn();
    const result = await checkAiTokenCeiling({ from } as any, "org-1");

    expect(result.ok).toBe(true);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("recordAiUsage", () => {
  it("increments the ledger with normalized counters", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const supabase = fakeSupabase({}, rpc);

    await recordAiUsage(supabase, "org-1", {
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
    });

    expect(rpc).toHaveBeenCalledWith("record_org_ai_usage", {
      target_org_id: "org-1",
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      estimated_cost_usd: 0,
    });
  });

  it("skips the RPC when there is nothing to record", async () => {
    const rpc = vi.fn();
    const supabase = fakeSupabase({}, rpc);

    await recordAiUsage(supabase, "org-1", { total_tokens: 0 });
    await recordAiUsage(supabase, undefined, { total_tokens: 100 });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("never throws when the RPC fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    const supabase = fakeSupabase({}, rpc);

    await expect(
      recordAiUsage(supabase, "org-1", { total_tokens: 50 })
    ).resolves.toBeUndefined();
  });
});
