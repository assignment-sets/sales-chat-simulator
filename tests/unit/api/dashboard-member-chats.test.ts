import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/dashboard/members/[userId]/chats/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as cacheModule from "@/lib/cache";
import { memberChatsKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import * as tenantModule from "@/lib/tenant";
import * as redisModule from "@/lib/redis";

describe("GET /api/dashboard/members/[userId]/chats", () => {
  const targetUserId = "target-user-123";
  const mockContext = {
    params: Promise.resolve({ userId: targetUserId }),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Authentication
  it("returns 401 unauthorized when unauthenticated", async () => {
    setupMockAuth(null);
    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  // 2. Active organization resolution failure
  it("returns 500 internal error when active organization cannot be resolved", async () => {
    setupMockAuth({ role: "owner", planTier: "pro" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to resolve active organization");
  });

  // 3. Role gate: member role restricted
  it("returns 403 forbidden for member role", async () => {
    setupMockAuth({
      role: "member",
      planTier: "pro",
      orgId: "org-1",
    });

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Viewing member activity is restricted to organization owners and admins");
  });

  // 4. Feature gate: starter plan restricted
  it("returns 403 forbidden when organization is on starter plan tier", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "starter",
      orgId: "org-1",
    });

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team Oversight Dashboard & Rep Analytics require the Pro or Scale plan.");
  });

  // 5. Allowed for admin role
  it("allows access for admin role on pro plan", async () => {
    setupMockAuth({
      role: "admin",
      planTier: "pro",
      orgId: "org-1",
    });

    const mockCached = {
      simulations: [
        {
          id: "chat-admin-1",
          product_name: "Admin Tool",
          status: "WON",
          score: 5,
        },
      ],
      userId: targetUserId,
      organizationId: "org-1",
    };

    vi.spyOn(cacheModule, "cached").mockResolvedValue(mockCached as any);

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.simulations).toHaveLength(1);
    expect(json.userId).toBe(targetUserId);
    expect(json.organizationId).toBe("org-1");
  });

  // 6. Tenant & User isolation: filters strictly by organization_id and target userId
  it("enforces tenant and user isolation by querying chats with organization_id and target userId", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-tenant-abc",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    const mockSimulations = [
      {
        id: "chat-101",
        product_name: "Enterprise Cloud",
        product_description: "Cloud security pitch",
        status: "WON",
        score: 4,
        evaluation_outcome: "deal_won",
        tokens_used: 350,
        created_at: "2026-02-01T12:00:00Z",
        updated_at: "2026-02-01T12:05:00Z",
      },
      {
        id: "chat-102",
        product_name: "CRM Pro",
        product_description: "Sales CRM demo",
        status: "LOST",
        score: 2,
        evaluation_outcome: "deal_lost",
        tokens_used: 500,
        created_at: "2026-02-02T15:00:00Z",
        updated_at: "2026-02-02T15:10:00Z",
      },
    ];

    const eqFilters: Record<string, any> = {};
    const selectSpy = vi.fn().mockReturnThis();
    const eqSpy = vi.fn((col: string, val: any) => {
      eqFilters[col] = val;
      return queryBuilder;
    });
    const orderSpy = vi.fn().mockResolvedValue({ data: mockSimulations, error: null });

    const queryBuilder = {
      select: selectSpy,
      eq: eqSpy,
      order: orderSpy,
    };

    mockClient.from = vi.fn((table: string) => {
      if (table === "chats") {
        return queryBuilder;
      }
      return queryBuilder;
    }) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Verify tenant and user isolation in query
    expect(eqFilters["organization_id"]).toBe("org-tenant-abc");
    expect(eqFilters["user_id"]).toBe(targetUserId);

    // Verify response structure
    expect(json.simulations).toHaveLength(2);
    expect(json.simulations[0].id).toBe("chat-101");
    expect(json.userId).toBe(targetUserId);
    expect(json.organizationId).toBe("org-tenant-abc");
  });

  // 7. Caching: verifies memberChatsKey(orgId, userId) and CACHE_TTLS.memberChats
  it("uses cached with memberChatsKey(orgId, userId) and CACHE_TTLS.memberChats", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-key-test",
    });

    const cachedSpy = vi.spyOn(cacheModule, "cached").mockResolvedValue({
      simulations: [],
      userId: targetUserId,
      organizationId: "org-key-test",
    } as any);

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    expect(cachedSpy).toHaveBeenCalledWith(
      memberChatsKey("org-key-test", targetUserId),
      CACHE_TTLS.memberChats,
      expect.any(Function)
    );
  });

  // 8. Caching: serves from Redis cache on hit without querying database
  it("serves simulations from Redis cache without querying database", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "scale",
      orgId: "org-redis-hit",
    });

    const cachedEnvelope = {
      simulations: [
        {
          id: "chat-cached-99",
          product_name: "Cached Product",
          status: "WON",
        },
      ],
      userId: targetUserId,
      organizationId: "org-redis-hit",
    };

    const mockRedis = {
      get: vi.fn(async () => ({ v: 1, d: cachedEnvelope })),
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);

    const dbSpy = vi.spyOn(mockClient, "from");

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.simulations).toHaveLength(1);
    expect(json.simulations[0].id).toBe("chat-cached-99");
    expect(dbSpy).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith(memberChatsKey("org-redis-hit", targetUserId));
  });

  // 9. Error handling: MemberChatsLoadError when database query fails
  it("returns 500 internalError when database query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection timeout" },
      }),
    })) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch member simulations");
  });

  // 10. Error handling: general unexpected error in cached()
  it("returns 500 internalError when an unexpected error occurs during loading", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(cacheModule, "cached").mockRejectedValue(new Error("Unexpected failure"));

    const req = new Request(`http://localhost:3000/api/dashboard/members/${targetUserId}/chats`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch member simulations");
  });
});
