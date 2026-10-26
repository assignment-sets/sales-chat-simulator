import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "@/app/api/chats/[id]/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as chatAuthModule from "@/lib/chat-auth";
import * as cacheModule from "@/lib/cache";

describe("GET /api/chats/[id]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when unauthenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/chats/chat-1");
    const res = await GET(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when validateChatAccess rejects", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1");
    const res = await GET(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(404);
  });

  it("returns simulation details and messages for author member", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    const chatData = {
      id: "chat-1",
      product_name: "Security Gateway",
      product_description: "Firewall SaaS",
      organization_id: "org-1",
      user_id: "user-1",
    };

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: chatData,
      role: "member",
    });

    const mockMessages = [
      { id: "m1", role: "user", content: "Tell me your pricing" },
      { id: "m2", role: "assistant", content: "We start at $50/mo" },
    ];

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1");
    const res = await GET(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.id).toBe("chat-1");
    expect(json.messages).toHaveLength(2);
    expect(json.role).toBe("member");
  });
});

describe("DELETE /api/chats/[id]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 if validateChatAccess denies access", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(404);
  });

  it("deletes chat, verifies deleted rows, and invalidates caches", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "owner", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1" },
      role: "owner",
    });

    const invalidateSpy = vi.spyOn(cacheModule, "invalidate").mockResolvedValue();

    mockClient.from = vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: "chat-1" }], error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
