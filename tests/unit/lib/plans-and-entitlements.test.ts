import { describe, it, expect } from "vitest";
import {
  normalizePlanTier,
  hasFeature,
  getQuotaLimit,
  getPlanConfig,
  PLAN_CONFIGS,
} from "@/lib/plans";
import {
  requireFeature,
  requireOrgFeature,
  checkQuota,
  getStartOfCurrentMonthUTC,
} from "@/lib/entitlements";
import { createMockSupabaseClient } from "../../utils/mock-supabase";

describe("plans.ts (Plan Configurations & Helpers)", () => {
  it("normalizes unknown, null, or undefined tiers to 'starter'", () => {
    expect(normalizePlanTier(null)).toBe("starter");
    expect(normalizePlanTier(undefined)).toBe("starter");
    expect(normalizePlanTier("")).toBe("starter");
    expect(normalizePlanTier("enterprise")).toBe("starter");
    expect(normalizePlanTier("random_tier")).toBe("starter");
    expect(normalizePlanTier("pro")).toBe("pro");
    expect(normalizePlanTier("scale")).toBe("scale");
  });

  it("retrieves valid plan configs with correct quotas and pricing", () => {
    const starter = getPlanConfig("starter");
    expect(starter.priceMonthly).toBe(0);
    expect(starter.quotas.monthly_simulations).toBe(15);
    expect(starter.quotas.team_seats).toBe(1);

    const pro = getPlanConfig("pro");
    expect(pro.priceMonthly).toBe(79);
    expect(pro.quotas.monthly_simulations).toBe(150);
    expect(pro.quotas.team_seats).toBe(10);

    const scale = getPlanConfig("scale");
    expect(scale.priceMonthly).toBe(249);
    expect(scale.quotas.monthly_simulations).toBe(600);
    expect(scale.quotas.team_seats).toBe(50);
  });

  it("enforces feature flags across tiers via hasFeature", () => {
    expect(hasFeature("starter", "detailed_ai_feedback")).toBe(false);
    expect(hasFeature("starter", "team_dashboard")).toBe(false);

    expect(hasFeature("pro", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("pro", "team_dashboard")).toBe(true);

    expect(hasFeature("scale", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("scale", "team_dashboard")).toBe(true);
  });

  it("retrieves quota limits accurately via getQuotaLimit", () => {
    expect(getQuotaLimit("starter", "monthly_simulations")).toBe(15);
    expect(getQuotaLimit("starter", "team_seats")).toBe(1);

    expect(getQuotaLimit("pro", "monthly_simulations")).toBe(150);
    expect(getQuotaLimit("pro", "team_seats")).toBe(10);

    expect(getQuotaLimit("scale", "monthly_simulations")).toBe(600);
    expect(getQuotaLimit("scale", "team_seats")).toBe(50);
  });
});

describe("entitlements.ts (Server-side Quotas & Feature Gating)", () => {
  it("computes start of current UTC month correctly", () => {
    const startOfMonth = getStartOfCurrentMonthUTC();
    const parsed = new Date(startOfMonth);

    expect(parsed.getUTCDate()).toBe(1);
    expect(parsed.getUTCHours()).toBe(0);
    expect(parsed.getUTCMinutes()).toBe(0);
    expect(parsed.getUTCSeconds()).toBe(0);
    expect(parsed.getUTCMilliseconds()).toBe(0);
  });

  describe("requireFeature", () => {
    it("returns ok: true when organization tier has the feature", () => {
      const result = requireFeature({ plan_tier: "pro" }, "detailed_ai_feedback");
      expect(result.ok).toBe(true);
      expect(result.planTier).toBe("pro");
    });

    it("returns 403 Forbidden with descriptive message when feature is locked", async () => {
      const result = requireFeature({ plan_tier: "starter" }, "detailed_ai_feedback");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        const data = await result.response.json();
        expect(data.error).toContain("Detailed AI Coaching Breakdown is a Pro feature");
      }
    });
  });

  describe("requireOrgFeature", () => {
    it("returns 404 when organizationId is missing or empty", async () => {
      const client = createMockSupabaseClient();
      const result = await requireOrgFeature(client as any, null, "team_dashboard");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(404);
      }
    });

    it("fetches organization plan tier and validates feature gate", async () => {
      const client = createMockSupabaseClient({
        tables: {
          organizations: [{ id: "org-1", plan_tier: "scale" }],
        },
      });

      const result = await requireOrgFeature(client as any, "org-1", "team_dashboard");
      expect(result.ok).toBe(true);
      expect(result.planTier).toBe("scale");
    });
  });

  describe("checkQuota", () => {
    it("allows monthly simulation when count is below limit", async () => {
      const client = createMockSupabaseClient({
        tables: {
          chats: [
            { id: "c1", organization_id: "org-1", created_at: new Date().toISOString() },
            { id: "c2", organization_id: "org-1", created_at: new Date().toISOString() },
          ],
        },
      });

      const res = await checkQuota(client as any, {
        type: "monthly_simulations",
        organization: { id: "org-1", plan_tier: "starter" },
      });

      expect(res.ok).toBe(true);
      expect(res.current).toBe(2);
      expect(res.limit).toBe(15);
    });

    it("blocks monthly simulation with 403 when limit is reached", async () => {
      const fullChats = Array.from({ length: 15 }, (_, i) => ({
        id: `c-${i}`,
        organization_id: "org-1",
        created_at: new Date().toISOString(),
      }));

      const client = createMockSupabaseClient({
        tables: {
          chats: fullChats,
        },
      });

      const res = await checkQuota(client as any, {
        type: "monthly_simulations",
        organization: { id: "org-1", plan_tier: "starter" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.response.status).toBe(403);
        const data = await res.response.json();
        expect(data.error).toContain("Monthly simulation limit reached (15/15 on Starter plan)");
      }
    });

    it("enforces team seat quota summing active members and pending invitations", async () => {
      const client = createMockSupabaseClient({
        tables: {
          organization_members: [{ id: "m1" }],
          organization_invitations: [],
        },
      });

      const res = await checkQuota(client as any, {
        type: "team_seats",
        organization: { id: "org-1", plan_tier: "starter" }, // Limit is 1 seat
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.response.status).toBe(403);
        const data = await res.response.json();
        expect(data.error).toContain("Team seat limit reached (1/1 on Starter plan)");
      }
    });
  });
});
