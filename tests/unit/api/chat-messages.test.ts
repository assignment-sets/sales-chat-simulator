import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/chats/[id]/messages/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as chatAuthModule from "@/lib/chat-auth";
import * as cacheModule from "@/lib/cache";

describe("GET /api/chats/[id]/messages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when unauthenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/chats/chat-1/messages");
    const res = await GET(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(401);
  });

  it("fetches messages reversed in chronological order", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1" },
      role: "member",
    });

    const mockRows = [
      { id: "m2", role: "assistant", content: "Second message", created_at: "2026-10-26T12:01:00Z" },
      { id: "m1", role: "user", content: "First message", created_at: "2026-10-26T12:00:00Z" },
    ];

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1/messages?limit=10");
    const res = await GET(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toHaveLength(2);
    // Should be reversed to chronological (m1 first, m2 second)
    expect(json.messages[0].id).toBe("m1");
    expect(json.messages[1].id).toBe("m2");
  });
});

describe("POST /api/chats/[id]/messages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 bad request if content is missing or whitespace", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", status: "ACTIVE" },
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "   " }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "chat-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Message content cannot be empty");
  });

  it("inserts user message and invalidates caches", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", status: "ACTIVE" },
      role: "member",
    });

    const invalidateSpy = vi.spyOn(cacheModule, "invalidate").mockResolvedValue();

    const createdMsg = {
      id: "msg-new-1",
      chat_id: "chat-1",
      user_id: "user-1",
      role: "user",
      content: "Do you have 5 minutes for a demo?",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdMsg, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Do you have 5 minutes for a demo?" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "chat-1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message.id).toBe("msg-new-1");
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("returns 400 bad request when simulation user turn limit of 40 is reached", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", status: "ACTIVE" },
      role: "member",
    });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: 40, error: null }).then(onfulfilled, onrejected),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Are we past the turn limit?" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "chat-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Turn cap of 40 reached for this simulation");
  });

  it("returns 400 bad request when simulation is archived", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", status: "ARCHIVED" },
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Cannot message archived chat" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "chat-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Cannot send messages to an archived chat. Resume the chat to continue.");
  });
});
