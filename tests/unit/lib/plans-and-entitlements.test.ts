import { describe, it, expect } from "vitest";
import {
  normalizePlanTier,
  hasFeature,
  getQuotaLimit,
  getPlanConfig,
  MAX_USER_TURNS,
  MAX_OWNED_ORGS_PER_USER,
} from "@/lib/plans";
import {
  requireFeature,
  requireOrgFeature,
  checkQuota,
  getStartOfCurrentMonthUTC,
} from "@/lib/entitlements";
import { createMockSupabaseClient } from "../../utils/mock-supabase";

describe("plans.ts (Plan Configurations & Helpers)", () => {
  it("normalizes unknown, null, or undefined tiers to 'starter' and 'pro' to 'team'", () => {
    expect(normalizePlanTier(null)).toBe("starter");
    expect(normalizePlanTier(undefined)).toBe("starter");
    expect(normalizePlanTier("")).toBe("starter");
    expect(normalizePlanTier("enterprise")).toBe("starter");
    expect(normalizePlanTier("random_tier")).toBe("starter");
    expect(normalizePlanTier("pro")).toBe("team");
    expect(normalizePlanTier("solo")).toBe("solo");
    expect(normalizePlanTier("team")).toBe("team");
    expect(normalizePlanTier("scale")).toBe("scale");
  });

  it("retrieves valid plan configs with correct quotas and pricing", () => {
    const starter = getPlanConfig("starter");
    expect(starter.priceMonthly).toBe(0);
    expect(starter.quotas.monthly_simulations).toBe(10);
    expect(starter.quotas.team_seats).toBe(1);

    const solo = getPlanConfig("solo");
    expect(solo.priceMonthly).toBe(5);
    expect(solo.quotas.monthly_simulations).toBe(50);
    expect(solo.quotas.team_seats).toBe(1);

    const team = getPlanConfig("team");
    expect(team.priceMonthly).toBe(29);
    expect(team.quotas.monthly_simulations).toBe(200);
    expect(team.quotas.team_seats).toBe(10);

    const legacyPro = getPlanConfig("pro");
    expect(legacyPro.id).toBe("team");
    expect(legacyPro.priceMonthly).toBe(29);
    expect(legacyPro.quotas.monthly_simulations).toBe(200);

    const scale = getPlanConfig("scale");
    expect(scale.priceMonthly).toBe(79);
    expect(scale.quotas.monthly_simulations).toBe(600);
    expect(scale.quotas.team_seats).toBe(50);
  });

  it("enforces feature flags across tiers via hasFeature", () => {
    expect(hasFeature("starter", "detailed_ai_feedback")).toBe(false);
    expect(hasFeature("starter", "team_dashboard")).toBe(false);

    expect(hasFeature("solo", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("solo", "team_dashboard")).toBe(false);

    expect(hasFeature("team", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("team", "team_dashboard")).toBe(true);

    expect(hasFeature("pro", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("pro", "team_dashboard")).toBe(true);

    expect(hasFeature("scale", "detailed_ai_feedback")).toBe(true);
    expect(hasFeature("scale", "team_dashboard")).toBe(true);
  });

  it("retrieves quota limits accurately via getQuotaLimit", () => {
    expect(getQuotaLimit("starter", "monthly_simulations")).toBe(10);
    expect(getQuotaLimit("starter", "team_seats")).toBe(1);

    expect(getQuotaLimit("solo", "monthly_simulations")).toBe(50);
    expect(getQuotaLimit("solo", "team_seats")).toBe(1);

    expect(getQuotaLimit("team", "monthly_simulations")).toBe(200);
    expect(getQuotaLimit("team", "team_seats")).toBe(10);

    expect(getQuotaLimit("pro", "monthly_simulations")).toBe(200);
    expect(getQuotaLimit("pro", "team_seats")).toBe(10);

    expect(getQuotaLimit("scale", "monthly_simulations")).toBe(600);
    expect(getQuotaLimit("scale", "team_seats")).toBe(50);
  });

  it("exports valid turn and organization ownership constraints", () => {
    expect(MAX_USER_TURNS).toBe(40);
    expect(MAX_OWNED_ORGS_PER_USER).toBe(3);
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
      const result = requireFeature({ plan_tier: "team" }, "detailed_ai_feedback");
      expect(result.ok).toBe(true);
      expect(result.planTier).toBe("team");

      const soloResult = requireFeature({ plan_tier: "solo" }, "detailed_ai_feedback");
      expect(soloResult.ok).toBe(true);
      expect(soloResult.planTier).toBe("solo");

      const legacyProResult = requireFeature({ plan_tier: "pro" }, "detailed_ai_feedback");
      expect(legacyProResult.ok).toBe(true);
      expect(legacyProResult.planTier).toBe("team");
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
      expect(res.limit).toBe(10);
    });

    it("blocks monthly simulation with 403 when limit is reached", async () => {
      const fullChats = Array.from({ length: 10 }, (_, i) => ({
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
        expect(data.error).toContain("Monthly simulation limit reached (10/10 on Starter plan)");
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
