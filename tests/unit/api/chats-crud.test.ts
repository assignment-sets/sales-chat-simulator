import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/chats/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as entitlementsModule from "@/lib/entitlements";
import * as cacheModule from "@/lib/cache";

describe("GET /api/chats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when there is no authenticated user", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/chats");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns personal simulations for member role", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-rep-1",
      role: "member",
      orgId: "org-1",
    });

    const mockChats = [
      { id: "c1", product_name: "Sales AI", user_id: "user-rep-1", organization_id: "org-1" },
    ];
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockChats, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chats).toHaveLength(1);
    expect(json.role).toBe("member");
    expect(json.scope).toBe("personal");
  });

  it("returns team simulations when scope=team and caller is owner or admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-admin-1",
      role: "admin",
      orgId: "org-1",
    });

    const mockTeamChats = [
      { id: "c1", product_name: "Sales AI", user_id: "rep-1", organization_id: "org-1" },
      { id: "c2", product_name: "Sales AI", user_id: "rep-2", organization_id: "org-1" },
    ];
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTeamChats, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats?scope=team");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chats).toHaveLength(2);
    expect(json.role).toBe("admin");
    expect(json.scope).toBe("team");
  });
});

describe("POST /api/chats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 bad request if payload is missing required fields", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    const req = new Request("http://localhost:3000/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("product_name and product_description are required");
  });

  it("returns 400 bad request if product_name exceeds 120 characters", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    const req = new Request("http://localhost:3000/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: "A".repeat(125),
        product_description: "Valid description",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("product_name must be 120 characters or fewer");
  });

  it("returns 403 forbidden when monthly simulation quota is exceeded", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", planTier: "starter" });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Monthly simulation limit reached" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ) as any,
    });

    const req = new Request("http://localhost:3000/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: "Enterprise Cloud",
        product_description: "Infrastructure management",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates simulation via atomic RPC and invalidates cache", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(cacheModule, "invalidate").mockResolvedValue();

    const createdChat = {
      id: "new-chat-1",
      product_name: "Enterprise Cloud",
      product_description: "Infrastructure management",
      status: "ACTIVE",
    };

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "create_chat_with_quota") {
        return { data: createdChat, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: "Enterprise Cloud",
        product_description: "Infrastructure management",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.chat.id).toBe("new-chat-1");
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
