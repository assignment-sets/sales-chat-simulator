import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/dashboard/chats/[chatId]/route";
import { setupMockAuth, createMockQueryBuilder } from "../../utils/mock-supabase";
import * as cacheModule from "@/lib/cache";
import { transcriptKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import * as tenantModule from "@/lib/tenant";
import * as redisModule from "@/lib/redis";

describe("GET /api/dashboard/chats/[chatId]", () => {
  const targetChatId = "chat-sim-123";
  const mockContext = {
    params: Promise.resolve({ chatId: targetChatId }),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Authentication
  it("returns 401 unauthorized when unauthenticated", async () => {
    setupMockAuth(null);
    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  // 2. Active organization resolution failure
  it("returns 500 internal error when active organization cannot be resolved", async () => {
    setupMockAuth({ role: "owner", planTier: "pro" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
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

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Viewing conversation transcripts is restricted to organization owners and admins");
  });

  // 4. Feature gate: starter plan restricted
  it("returns 403 forbidden when organization is on starter plan tier", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "starter",
      orgId: "org-1",
    });

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team Oversight Dashboard & Rep Analytics require the Pro or Scale plan.");
  });

  // 5. Allowed for admin role on pro plan
  it("allows access for admin role on pro plan", async () => {
    setupMockAuth({
      role: "admin",
      planTier: "pro",
      orgId: "org-1",
    });

    const mockTranscript = {
      chat: {
        id: targetChatId,
        product_name: "Admin Pitch",
        status: "WON",
        score: 5,
      },
      messages: [
        { id: "m1", role: "user", content: "Hello" },
        { id: "m2", role: "assistant", content: "Hi there" },
      ],
    };

    vi.spyOn(cacheModule, "cached").mockResolvedValue(mockTranscript as any);

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.id).toBe(targetChatId);
    expect(json.messages).toHaveLength(2);
  });

  // 6. Cross-tenant isolation: 404 when chat belongs to another organization
  it("returns 404 Not Found when chat belongs to another organization (cross-tenant isolation)", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-tenant-a",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    // When querying chats table with .eq("id", targetChatId).eq("organization_id", "org-tenant-a"),
    // return null data to simulate that the chat exists in another org (not tenant A).
    const eqFilters: Record<string, any> = {};
    mockClient.from = vi.fn((table: string) => {
      if (table === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: any) => {
            eqFilters[col] = val;
            return {
              eq: vi.fn((col2: string, val2: any) => {
                eqFilters[col2] = val2;
                return {
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
              }),
            };
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Simulation not found in this organization");
    expect(eqFilters["id"]).toBe(targetChatId);
    expect(eqFilters["organization_id"]).toBe("org-tenant-a");
  });

  // 7. Caching: uses transcriptKey(orgId, chatId) and CACHE_TTLS.transcript
  it("uses cached with transcriptKey(orgId, chatId) and CACHE_TTLS.transcript", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-key-org",
    });

    const cachedSpy = vi.spyOn(cacheModule, "cached").mockResolvedValue({
      chat: { id: targetChatId },
      messages: [],
    } as any);

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    expect(cachedSpy).toHaveBeenCalledWith(
      transcriptKey("org-key-org", targetChatId),
      CACHE_TTLS.transcript,
      expect.any(Function)
    );
  });

  // 8. Caching: ensures 404 is not written to Redis cache
  it("ensures 404 Not Found is never written to cache", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-no-cache-404",
    });

    // Provide mock Redis client to track set calls
    const mockRedis = {
      get: vi.fn(async () => null), // Cache miss
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);

    // Chat not found in this org
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(404);
    // Crucial check: loader returned null, so cached() did not call redis.set
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  // 9. Caching: serves from Redis cache on hit without querying database
  it("serves transcript from Redis cache without querying database", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "scale",
      orgId: "org-cache-hit",
    });

    const cachedEnvelope = {
      chat: {
        id: targetChatId,
        product_name: "Cached Security Solution",
        score: 4,
        status: "WON",
      },
      messages: [
        { id: "msg-1", role: "user", content: "How much?" },
        { id: "msg-2", role: "assistant", content: "$100/seat" },
      ],
    };

    const mockRedis = {
      get: vi.fn(async () => ({ v: 1, d: cachedEnvelope })),
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);

    const dbSpy = vi.spyOn(mockClient, "from");

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.product_name).toBe("Cached Security Solution");
    expect(json.messages).toHaveLength(2);
    expect(dbSpy).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith(transcriptKey("org-cache-hit", targetChatId));
  });

  // 10. Successful retrieval: fetches chat metadata and ordered messages from DB
  it("fetches chat metadata and ordered messages from database on cache miss", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-success",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    const mockChat = {
      id: targetChatId,
      product_name: "AI Copilot Pro",
      product_description: "Next-gen sales assistant",
      status: "WON",
      score: 4,
      evaluation_outcome: "deal_won",
      tokens_used: 1250,
      created_at: "2026-03-01T10:00:00Z",
      user_id: "rep-user-456",
      ai_feedback: { score: 4, strengths: ["Clear pitch"] },
    };

    const mockMessages = [
      {
        id: "m-1",
        role: "user",
        content: "Tell me about your product.",
        created_at: "2026-03-01T10:01:00Z",
        prompt_tokens: 10,
        completion_tokens: 0,
        total_tokens: 10,
      },
      {
        id: "m-2",
        role: "assistant",
        content: "AI Copilot helps sales teams close deals faster.",
        created_at: "2026-03-01T10:01:05Z",
        prompt_tokens: 20,
        completion_tokens: 15,
        total_tokens: 35,
      },
    ];

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockChat, error: null }),
        };
      }
      if (tableName === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.id).toBe(targetChatId);
    expect(json.chat.product_name).toBe("AI Copilot Pro");
    expect(json.messages).toHaveLength(2);
    expect(json.messages[0].id).toBe("m-1");
    expect(json.messages[1].id).toBe("m-2");
  });

  // 11. Error handling: TranscriptLoadError when chat query fails
  it("returns 500 internalError when chat query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Query timeout on chats" },
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch simulation");
  });

  // 12. Error handling: TranscriptLoadError when messages query fails
  it("returns 500 internalError when messages query fails", async () => {
    const { mockClient } = setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: targetChatId, product_name: "Pitch" },
            error: null,
          }),
        };
      }
      if (tableName === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Query failure on messages" },
          }),
        };
      }
      return createMockQueryBuilder([]);
    }) as any;

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch conversation history");
  });

  // 13. Error handling: general unexpected error in cached()
  it("returns 500 internalError when an unexpected error occurs during loading", async () => {
    setupMockAuth({
      role: "owner",
      planTier: "pro",
      orgId: "org-1",
    });

    vi.spyOn(cacheModule, "cached").mockRejectedValue(new Error("Generic cache failure"));

    const req = new Request(`http://localhost:3000/api/dashboard/chats/${targetChatId}`);
    const res = await GET(req, mockContext);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch conversation");
  });
});
