import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/dashboard/route";
import { setupMockAuth, createMockQueryBuilder } from "../../utils/mock-supabase";
import * as cacheModule from "@/lib/cache";
import { dashboardKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import * as tenantModule from "@/lib/tenant";
import * as redisModule from "@/lib/redis";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Authentication
  it("returns 401 unauthorized when there is no authenticated user", async () => {
    setupMockAuth(null);
    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  // 2. Active organization resolution failure
  it("returns 500 internal error when active organization cannot be resolved", async () => {
    setupMockAuth({ role: "owner", planTier: "pro" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to resolve active organization");
  });

  // 3. Role gate: member role restricted
  it("returns 403 forbidden for member role with standard oversight restriction message", async () => {
    setupMockAuth({
      role: "member",
      planTier: "pro",
      orgId: "org-1",
    });

    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Team oversight is restricted to organization owners and admins");
  });

  // 4. Plan feature gate: starter plan tier restricted
  it("returns 403 forbidden when organization is on starter plan tier (requires team_dashboard)", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "starter",
      orgId: "org-1",
    });

    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team Oversight Dashboard & Rep Analytics require the Pro or Scale plan.");
  });

  // 5. Role gate: admin role is allowed on pro plan
  it("allows access for admin role on pro plan", async () => {
    setupMockAuth({
      role: "admin",
      planTier: "pro",
      orgId: "org-1",
    });

    const mockPayload = {
      kpis: {
        totalSimulations: 5,
        totalMessages: 20,
        totalTokens: 1000,
        activeMembersCount: 2,
        totalMembersCount: 3,
        winRate: 80,
        avgScore: 4.2,
      },
      analytics: {
        outcomes: { won: 4, lost: 1, active: 0, total: 5, winRate: 80 },
        scoreDistribution: [],
        activityTimeline: [],
        scenarioBreakdown: [],
      },
      members: [],
      organization: { id: "org-1", name: "Acme Sales", slug: "acme-sales" },
    };

    vi.spyOn(cacheModule, "cached").mockResolvedValue(mockPayload as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.currentUserRole).toBe("admin");
    expect(json.organization.id).toBe("org-1");
    expect(json.kpis.totalSimulations).toBe(5);
  });

  // 6. Caching: verifies read-through cache invocation with dashboardKey(orgId)
  it("uses read-through cache with dashboardKey(orgId) and CACHE_TTLS.dashboard", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-42",
    });

    const cachedSpy = vi.spyOn(cacheModule, "cached").mockResolvedValue({
      kpis: {
        totalSimulations: 1,
        totalMessages: 2,
        totalTokens: 300,
        activeMembersCount: 1,
        totalMembersCount: 1,
        winRate: 100,
        avgScore: 5.0,
      },
      analytics: {
        outcomes: { won: 1, lost: 0, active: 0, total: 1, winRate: 100 },
        scoreDistribution: [],
        activityTimeline: [],
        scenarioBreakdown: [],
      },
      members: [],
      organization: { id: "org-42", name: "Org 42", slug: "org-42" },
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(cachedSpy).toHaveBeenCalledWith(
      dashboardKey("org-42"),
      CACHE_TTLS.dashboard,
      expect.any(Function)
    );
  });

  // 7. Caching: does not re-run DB loader on cache hit
  it("does not re-run DB loader on cache hit", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "scale",
      orgId: "org-cache-hit",
    });

    const cachedPayload = {
      kpis: {
        totalSimulations: 10,
        totalMessages: 50,
        totalTokens: 5000,
        activeMembersCount: 3,
        totalMembersCount: 5,
        winRate: 70,
        avgScore: 4.0,
      },
      analytics: {
        outcomes: { won: 7, lost: 3, active: 0, total: 10, winRate: 70 },
        scoreDistribution: [],
        activityTimeline: [],
        scenarioBreakdown: [],
      },
      members: [],
      organization: { id: "org-cache-hit", name: "Cached Org", slug: "cached-org" },
    };

    // Simulate Redis returning a cached envelope
    const mockRedis = {
      get: vi.fn(async () => ({ v: 1, d: cachedPayload })),
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);

    const dbFromSpy = vi.spyOn(mockClient, "from");

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.organization.id).toBe("org-cache-hit");
    expect(json.kpis.totalSimulations).toBe(10);
    expect(json.currentUserRole).toBe("owner");

    // On cache hit, loader must NOT have queried Supabase tables
    expect(dbFromSpy).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith(dashboardKey("org-cache-hit"));
  });

  // 8. Aggregate Computations: members summary, KPIs, timeline, and scenario points
  it("computes accurate aggregates for members summary, KPIs, timeline, and scenario breakdown", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-owner-1",
      role: "owner",
      planTier: "pro",
      orgId: "org-aggregates",
    });

    // Ensure Redis returns null so cache miss runs the DB loader
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    const orgRow = {
      id: "org-aggregates",
      name: "Acme Sales Org",
      slug: "acme-sales-org",
    };

    const memberRows = [
      {
        id: "mem-1",
        user_id: "user-owner-1",
        role: "owner",
        email: "alice@acme.com",
        full_name: "Alice Owner",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "mem-2",
        user_id: "user-rep-2",
        role: "member",
        email: "bob@acme.com",
        full_name: "Bob Seller",
        created_at: "2026-01-02T00:00:00Z",
      },
    ];

    const todayIso = new Date().toISOString();

    const chatRows = [
      // Alice: 1 WON, 1 LOST
      {
        id: "c1",
        user_id: "user-owner-1",
        product_name: "Enterprise Cloud",
        tokens_used: 100,
        status: "WON",
        score: 4,
        evaluation_outcome: "deal_won",
        created_at: todayIso,
      },
      {
        id: "c2",
        user_id: "user-owner-1",
        product_name: "Enterprise Cloud",
        tokens_used: 150,
        status: "LOST",
        score: 2,
        evaluation_outcome: "deal_lost",
        created_at: todayIso,
      },
      // Bob: 1 WON, 1 ACTIVE
      {
        id: "c3",
        user_id: "user-rep-2",
        product_name: "CRM Suite",
        tokens_used: 200,
        status: "WON",
        score: 5,
        evaluation_outcome: "deal_won",
        created_at: todayIso,
      },
      {
        id: "c4",
        user_id: "user-rep-2",
        product_name: "CRM Suite",
        tokens_used: 50,
        status: "ACTIVE",
        score: null,
        evaluation_outcome: null,
        created_at: todayIso,
      },
    ];

    const messageRows = [
      { chat_id: "c1", user_id: "user-owner-1", total_tokens: 100 },
      { chat_id: "c2", user_id: "user-owner-1", total_tokens: 150 },
      { chat_id: "c3", user_id: "user-rep-2", total_tokens: 200 },
      { chat_id: "c4", user_id: "user-rep-2", total_tokens: 50 },
    ];

    // Mock RPC returning member rows
    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "get_organization_members") {
        return { data: memberRows, error: null };
      }
      return { data: null, error: null };
    });

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: orgRow, error: null }),
        };
      }
      if (tableName === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: memberRows, error: null }),
        };
      }
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: chatRows, error: null }),
        };
      }
      if (tableName === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: messageRows, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    // 1. KPIs
    // Total simulations: 4
    // Total messages: 4
    // Total tokens: 100 + 150 + 200 + 50 = 500
    // Active members count: 2 (both user-owner-1 and user-rep-2 have simulations)
    // Total members: 2
    // Concluded: 3 (2 won + 1 lost)
    // Win rate: Math.round((2 / 3) * 100) = 67%
    // Avg score: (4 + 2 + 5) / 3 = 3.666... rounded to 3.7
    expect(json.kpis.totalSimulations).toBe(4);
    expect(json.kpis.totalMessages).toBe(4);
    expect(json.kpis.totalTokens).toBe(500);
    expect(json.kpis.activeMembersCount).toBe(2);
    expect(json.kpis.totalMembersCount).toBe(2);
    expect(json.kpis.winRate).toBe(67);
    expect(json.kpis.avgScore).toBe(3.7);

    // 2. Members Summary
    expect(json.members).toHaveLength(2);
    const alice = json.members.find((m: any) => m.userId === "user-owner-1");
    expect(alice).toBeDefined();
    expect(alice.fullName).toBe("Alice Owner");
    expect(alice.email).toBe("alice@acme.com");
    expect(alice.role).toBe("owner");
    expect(alice.simulationsCount).toBe(2);
    expect(alice.messagesCount).toBe(2);
    expect(alice.tokensUsed).toBe(250);
    expect(alice.winRate).toBe(50); // 1 won out of 2 concluded
    expect(alice.avgScore).toBe(3.0); // (4 + 2) / 2 = 3.0

    const bob = json.members.find((m: any) => m.userId === "user-rep-2");
    expect(bob).toBeDefined();
    expect(bob.fullName).toBe("Bob Seller");
    expect(bob.email).toBe("bob@acme.com");
    expect(bob.role).toBe("member");
    expect(bob.simulationsCount).toBe(2);
    expect(bob.messagesCount).toBe(2);
    expect(bob.tokensUsed).toBe(250);
    expect(bob.winRate).toBe(100); // 1 won out of 1 concluded
    expect(bob.avgScore).toBe(5.0); // 5 / 1 = 5.0

    // 3. Analytics Outcomes
    expect(json.analytics.outcomes).toEqual({
      won: 2,
      lost: 1,
      active: 1, // 4 total - 3 concluded = 1 active
      total: 4,
      winRate: 67,
    });

    // 4. Score Distribution (1 to 5)
    expect(json.analytics.scoreDistribution).toHaveLength(5);
    const score2 = json.analytics.scoreDistribution.find((s: any) => s.score === 2);
    const score4 = json.analytics.scoreDistribution.find((s: any) => s.score === 4);
    const score5 = json.analytics.scoreDistribution.find((s: any) => s.score === 5);
    expect(score2.count).toBe(1);
    expect(score4.count).toBe(1);
    expect(score5.count).toBe(1);
    // 3 scored chats total: each is 33%
    expect(score2.percentage).toBe(33);
    expect(score4.percentage).toBe(33);
    expect(score5.percentage).toBe(33);

    // 5. Activity Timeline (14 days)
    expect(json.analytics.activityTimeline).toHaveLength(14);
    const todayEntry = json.analytics.activityTimeline[13];
    expect(todayEntry.count).toBe(4);
    expect(todayEntry.wonCount).toBe(2);

    // 6. Scenario Breakdown (top products)
    expect(json.analytics.scenarioBreakdown).toHaveLength(2);
    const enterpriseScenario = json.analytics.scenarioBreakdown.find(
      (s: any) => s.productName === "Enterprise Cloud"
    );
    expect(enterpriseScenario).toBeDefined();
    expect(enterpriseScenario.count).toBe(2);
    expect(enterpriseScenario.wonCount).toBe(1);
    expect(enterpriseScenario.winRate).toBe(50);
    expect(enterpriseScenario.avgScore).toBe(3.0);

    const crmScenario = json.analytics.scenarioBreakdown.find(
      (s: any) => s.productName === "CRM Suite"
    );
    expect(crmScenario).toBeDefined();
    expect(crmScenario.count).toBe(2);
    expect(crmScenario.wonCount).toBe(1);
    expect(crmScenario.winRate).toBe(100);
    expect(crmScenario.avgScore).toBe(5.0);
  });

  // 9. Aggregation edge cases: fallback when RPC fails and former member simulation exists
  it("falls back to direct organization_members table when RPC fails and handles former members", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-owner-1",
      role: "owner",
      planTier: "pro",
      orgId: "org-fallback",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.rpc = vi.fn(async () => ({ data: null, error: { message: "RPC not found" } }));

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "org-fallback", name: "Fallback Org", slug: "fallback-org" },
            error: null,
          }),
        };
      }
      if (tableName === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "mem-1",
                user_id: "active-user-12345678",
                role: "owner",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        };
      }
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              // Chat created by a former member not in organization_members
              {
                id: "c-former",
                user_id: "former-user-99999999",
                product_name: "Legacy Product",
                tokens_used: 100,
                status: "WON",
                score: 4,
                evaluation_outcome: "deal_won",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        };
      }
      if (tableName === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.members).toHaveLength(2);
    const formerMember = json.members.find((m: any) => m.userId === "former-user-99999999");
    expect(formerMember).toBeDefined();
    expect(formerMember.fullName).toContain("Former Member");

    const fallbackActiveMember = json.members.find((m: any) => m.userId === "active-user-12345678");
    expect(fallbackActiveMember).toBeDefined();
    expect(fallbackActiveMember.email).toBe("member-active-u@team");
  });

  // 10. DashboardLoadError: organization load failure -> internalError
  it("returns 500 internalError when organization query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database connection failed" },
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to load organization");
  });

  // 11. DashboardLoadError: organization members load failure -> internalError
  it("returns 500 internalError when organization members query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.rpc = vi.fn(async () => ({ data: null, error: { message: "RPC error" } }));

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "org-1", name: "Org", slug: "org" },
            error: null,
          }),
        };
      }
      if (tableName === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Table permission denied" },
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch organization members");
  });

  // 12. DashboardLoadError: chats query load failure -> internalError
  it("returns 500 internalError when chats query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.rpc = vi.fn(async () => ({
      data: [{ id: "mem-1", user_id: "u-1", role: "owner", created_at: "2026-01-01" }],
      error: null,
    }));

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "org-1", name: "Org", slug: "org" },
            error: null,
          }),
        };
      }
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Failed to read chats" },
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch organization chats");
  });

  // 13. General error handling: unexpected exception in cached() -> internalError
  it("returns 500 internalError when an unexpected exception is thrown", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(cacheModule, "cached").mockRejectedValue(new Error("Unexpected Redis crash"));

    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to load dashboard");
  });
});
