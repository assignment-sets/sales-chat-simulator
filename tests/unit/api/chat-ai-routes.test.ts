import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as replyRoute } from "@/app/api/chats/[id]/reply/route";
import { POST as feedbackRoute } from "@/app/api/chats/[id]/feedback/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as chatAuthModule from "@/lib/chat-auth";
import * as entitlementsModule from "@/lib/entitlements";
import * as rateLimitModule from "@/lib/rate-limit";
import * as jevModule from "@/lib/jev";
import { groq } from "@/lib/groq";

describe("POST /api/chats/[id]/reply", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty messages if latest message is not from user", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        status: "ACTIVE",
        product_name: "CRM",
        product_description: "Sales CRM",
      },
      role: "member",
    });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "m1", role: "assistant", content: "Already replied" }],
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/chats/chat-1/reply", { method: "POST" });
    const res = await replyRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toEqual([]);
  });

  it("returns 429 when chat mutex lock cannot be acquired", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        status: "ACTIVE",
        product_name: "CRM",
        product_description: "Sales CRM",
      },
      role: "member",
    });

    // Provide history with user message so it passes idempotency guard
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "m1", role: "user", content: "Can you send pricing?" }],
        error: null,
      }),
    })) as any;

    vi.spyOn(rateLimitModule, "acquireChatLock").mockResolvedValue(false);

    const req = new Request("http://localhost:3000/api/chats/chat-1/reply", { method: "POST" });
    const res = await replyRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(429);
  });

  it("generates prospect reply, runs Jev evaluation, and saves messages", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        status: "ACTIVE",
        product_name: "CRM",
        product_description: "Sales CRM",
        organization_id: "org-1",
      },
      role: "member",
    });

    vi.spyOn(rateLimitModule, "acquireChatLock").mockResolvedValue(true);
    vi.spyOn(rateLimitModule, "releaseChatLock").mockResolvedValue();

    const savedAssistantMsg = {
      id: "m2",
      role: "assistant",
      content: "I am quite busy today, what makes your CRM different?",
      chat_id: "chat-1",
    };

    // Mock messages history: 1 user message
    const mockMessagesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "m1", role: "user", content: "Hey, can I show you a demo?" }],
        error: null,
      }),
      insert: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: [savedAssistantMsg],
          error: null,
        }),
      })),
    };

    mockClient.from = vi.fn((table: string) => {
      if (table === "messages") {
        return mockMessagesQuery;
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }) as any;

    // Mock Groq AI completion
    vi.spyOn(groq.chat.completions, "create").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              messages: ["I am quite busy today, what makes your CRM different?"],
              buyer_sentiment: "skeptical",
            }),
          },
        },
      ],
      usage: { total_tokens: 120 },
    } as any);

    // Mock Jev turn evaluation
    vi.spyOn(jevModule, "evaluateSimulationTurn").mockResolvedValue({
      outcome: "continue",
      score: 3,
      leadLostProbability: 0.2,
      summary: { analysis: "Solid opening hook" },
      evaluation: null,
    } as any);

    const req = new Request("http://localhost:3000/api/chats/chat-1/reply", { method: "POST" });
    const res = await replyRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toBeDefined();
    expect(json.messages[0].content).toContain("I am quite busy today");
  });
});

describe("POST /api/chats/[id]/feedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 forbidden if organization plan tier lacks detailed_ai_feedback", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", planTier: "starter" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: { id: "chat-1", organization_id: "org-1" },
      role: "member",
    });

    vi.spyOn(entitlementsModule, "requireOrgFeature").mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Detailed AI Coaching Breakdown is a Pro feature" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ) as any,
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1/feedback", { method: "POST" });
    const res = await feedbackRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Detailed AI Coaching Breakdown is a Pro feature");
  });

  it("returns cached feedback immediately if already generated on the chat row", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", planTier: "pro" });

    vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
      ok: true,
      chat: {
        id: "chat-1",
        organization_id: "org-1",
        ai_feedback: "### Executive Summary\nGreat discovery pitch.",
      },
      role: "member",
    });

    vi.spyOn(entitlementsModule, "requireOrgFeature").mockResolvedValue({
      ok: true,
      planTier: "pro",
    });

    const req = new Request("http://localhost:3000/api/chats/chat-1/feedback", { method: "POST" });
    const res = await feedbackRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cached")).toBe("true");
    const text = await res.text();
    expect(text).toContain("Great discovery pitch.");
  });
});
