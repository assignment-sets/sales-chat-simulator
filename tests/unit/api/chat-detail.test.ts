import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE, PATCH } from "@/app/api/chats/[id]/route";
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

    const invalidateSpy = vi.spyOn(cacheModule, "invalidateChat").mockResolvedValue();

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
    expect(invalidateSpy).toHaveBeenCalledWith("org-1", "chat-1", undefined);
  });
});

describe("PATCH /api/chats/[id]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when unauthenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: "Renamed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when validateChatAccess denies access", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: "Renamed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(404);
  });

  it("returns 400 when body is invalid JSON", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", user_id: "user-1", status: "ACTIVE" } as any,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON");
  });

  it("returns 400 when no valid update field is provided", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", user_id: "user-1", status: "ACTIVE" } as any,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unknown_field: "test" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("At least one valid field");
  });

  it("returns 400 when product_name is empty or exceeds 120 chars", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1", user_id: "user-1", status: "ACTIVE" } as any,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: "   " }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(400);
  });

  it("successfully renames a chat and purges caches", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        product_name: "Old Name",
        product_description: "Old Desc",
        status: "ACTIVE",
        organization_id: "org-1",
        user_id: "user-1",
      } as any,
      role: "member",
    });

    const invalidateSpy = vi.spyOn(cacheModule, "invalidateChat").mockResolvedValue();

    const updatedData = {
      id: "chat-1",
      product_name: "Enterprise Cloud Drill",
      product_description: "New Scenario",
      status: "ACTIVE",
      user_id: "user-1",
      organization_id: "org-1",
    };

    mockClient.from = vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedData, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: "Enterprise Cloud Drill",
        product_description: "New Scenario",
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.product_name).toBe("Enterprise Cloud Drill");
    expect(invalidateSpy).toHaveBeenCalledWith("org-1", "chat-1", "user-1");
  });

  it("successfully archives a simulation (status = ARCHIVED)", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        product_name: "Drill",
        status: "ACTIVE",
        organization_id: "org-1",
        user_id: "user-1",
      } as any,
      role: "member",
    });

    const invalidateSpy = vi.spyOn(cacheModule, "invalidateChat").mockResolvedValue();

    mockClient.from = vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "chat-1", status: "ARCHIVED" },
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.status).toBe("ARCHIVED");
    expect(invalidateSpy).toHaveBeenCalledWith("org-1", "chat-1", "user-1");
  });

  it("successfully resumes an archived simulation back to ACTIVE", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        product_name: "Drill",
        status: "ARCHIVED",
        evaluation_outcome: null,
        organization_id: "org-1",
        user_id: "user-1",
      } as any,
      role: "member",
    });

    const updateSpy = vi.fn().mockReturnThis();

    mockClient.from = vi.fn(() => ({
      update: updateSpy,
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "chat-1", status: "ACTIVE" },
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE" })
    );
  });

  it("preserves prior evaluation outcome (WON/LOST) when resuming an archived completed simulation", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", role: "member", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        product_name: "Drill",
        status: "ARCHIVED",
        evaluation_outcome: "deal_won",
        organization_id: "org-1",
        user_id: "user-1",
      } as any,
      role: "member",
    });

    const updateSpy = vi.fn().mockReturnThis();

    mockClient.from = vi.fn(() => ({
      update: updateSpy,
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "chat-1", status: "WON", evaluation_outcome: "deal_won" },
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "WON" })
    );
  });

  it("allows organization owner/admin to update member chat", async () => {
    const { mockClient } = setupMockAuth({ userId: "owner-1", role: "owner", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        product_name: "Member Drill",
        status: "ACTIVE",
        organization_id: "org-1",
        user_id: "member-2",
      } as any,
      role: "owner",
    });

    mockClient.from = vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "chat-1", product_name: "Admin Renamed", status: "ACTIVE" },
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: "Admin Renamed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chat.product_name).toBe("Admin Renamed");
  });
});
