import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as replyRoute } from "@/app/api/chats/[id]/reply/route";
import { POST as feedbackRoute } from "@/app/api/chats/[id]/feedback/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as chatAuthModule from "@/lib/chat-auth";
import * as entitlementsModule from "@/lib/entitlements";
import * as rateLimitModule from "@/lib/rate-limit";
import * as jevModule from "@/lib/jev";
import * as aiUsageModule from "@/lib/ai-usage";
import { groq } from "@/lib/groq";
import { forbidden } from "@/lib/api-response";

const PERIOD_START = "2026-10-01T00:00:00.000Z";

function ceilingAllowed(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true as const,
    usedTokens: 0,
    ceilingTokens: 500_000,
    periodStart: PERIOD_START,
    planTier: "starter" as const,
    ...overrides,
  };
}

function ceilingBlocked() {
  return {
    ok: false as const,
    usedTokens: 500_000,
    ceilingTokens: 500_000,
    periodStart: PERIOD_START,
    planTier: "starter" as const,
    response: forbidden("Monthly AI usage safety limit reached"),
  };
}

function mockReplyHistory(content = "Hey, can I show you a demo?") {
  const mockClient = setupMockAuth({ userId: "user-1", orgId: "org-1" }).mockClient;

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

  const mockMessagesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [{ id: "m1", role: "user", content }],
      error: null,
    }),
    insert: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: [
          {
            id: "m2",
            role: "assistant",
            content: "I am quite busy today, what makes your CRM different?",
          },
        ],
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

  vi.spyOn(rateLimitModule, "acquireChatLock").mockResolvedValue(true);
  vi.spyOn(rateLimitModule, "releaseChatLock").mockResolvedValue();

  return { mockClient, mockMessagesQuery };
}

function mockFeedbackChat() {
  const mockClient = setupMockAuth({
    userId: "user-1",
    orgId: "org-1",
    tables: {
      messages: [
        { role: "user", content: "Hi there", created_at: "2026-10-27T10:00:00.000Z" },
        { role: "assistant", content: "Not interested", created_at: "2026-10-27T10:00:01.000Z" },
      ],
    },
  }).mockClient;

  vi.spyOn(chatAuthModule, "validateChatAccess").mockResolvedValue({
    ok: true,
    chat: {
      id: "chat-1",
      organization_id: "org-1",
      product_name: "CRM",
      product_description: "Sales CRM",
      status: "ACTIVE",
      score: 3,
      evaluation_outcome: "in_progress",
      evaluation_summary: null,
      ai_feedback: null,
      tokens_used: 0,
    },
    role: "member",
  });

  vi.spyOn(entitlementsModule, "requireOrgFeature").mockResolvedValue({
    ok: true,
    planTier: "pro",
  });

  vi.spyOn(rateLimitModule, "acquireChatLock").mockResolvedValue(true);
  vi.spyOn(rateLimitModule, "releaseChatLock").mockResolvedValue();

  return { mockClient };
}

function abortError() {
  const err = new Error("Request was aborted.");
  err.name = "APIUserAbortError";
  return err;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(aiUsageModule, "checkAiTokenCeiling").mockResolvedValue(ceilingAllowed());
  vi.spyOn(aiUsageModule, "recordAiUsage").mockResolvedValue();
});

describe("POST /api/chats/[id]/reply", () => {
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

  it("generates prospect reply, runs Jev evaluation, saves messages, and meters usage", async () => {
    mockReplyHistory();

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
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    } as any);

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
    expect(json.messages[0].content).toContain("I am quite busy today");

    // The upstream call must carry the request signal and bounded timeouts.
    expect(groq.chat.completions.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: req.signal, timeout: 20_000, maxRetries: 1 })
    );

    expect(aiUsageModule.recordAiUsage).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ total_tokens: 120 })
    );
  });

  it("returns 403 and never calls Groq when the monthly ceiling is exhausted", async () => {
    mockReplyHistory();
    vi.mocked(aiUsageModule.checkAiTokenCeiling).mockResolvedValue(ceilingBlocked());
    const createSpy = vi.spyOn(groq.chat.completions, "create");

    const req = new Request("http://localhost:3000/api/chats/chat-1/reply", { method: "POST" });
    const res = await replyRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("does not retry or call Jev when the client aborts mid-generation", async () => {
    mockReplyHistory();
    const controller = new AbortController();

    const createSpy = vi
      .spyOn(groq.chat.completions, "create")
      .mockImplementation((async () => {
        controller.abort();
        throw abortError();
      }) as any);
    const jevSpy = vi.spyOn(jevModule, "evaluateSimulationTurn");

    const req = new Request("http://localhost:3000/api/chats/chat-1/reply", {
      method: "POST",
      signal: controller.signal,
    });
    const res = await replyRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(499);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(jevSpy).not.toHaveBeenCalled();
    expect(aiUsageModule.recordAiUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/chats/[id]/feedback", () => {
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

  it("returns 403 and never calls Groq when the monthly ceiling is exhausted", async () => {
    mockFeedbackChat();
    vi.mocked(aiUsageModule.checkAiTokenCeiling).mockResolvedValue(ceilingBlocked());
    const createSpy = vi.spyOn(groq.chat.completions, "create");

    const req = new Request("http://localhost:3000/api/chats/chat-1/feedback", { method: "POST" });
    const res = await feedbackRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("streams content, meters final-chunk usage, and closes cleanly", async () => {
    mockFeedbackChat();

    const fakeStream = {
      controller: new AbortController(),
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: "### Executive Summary" } }], x_groq: null };
        yield {
          choices: [{ delta: { content: "\nSolid call." } }],
          x_groq: { usage: { prompt_tokens: 800, completion_tokens: 120, total_tokens: 920 } },
        };
      },
    };

    vi.spyOn(groq.chat.completions, "create").mockResolvedValue(fakeStream as any);

    const req = new Request("http://localhost:3000/api/chats/chat-1/feedback", { method: "POST" });
    const res = await feedbackRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("### Executive Summary");

    expect(groq.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
      expect.objectContaining({ signal: req.signal, timeout: 15_000, maxRetries: 0 })
    );

    expect(aiUsageModule.recordAiUsage).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ total_tokens: 920 })
    );
    // The lock is released after the stream closes and the write finishes.
    await vi.waitFor(() => {
      expect(rateLimitModule.releaseChatLock).toHaveBeenCalled();
    });
  });

  it("aborts the upstream stream and releases the lock when the consumer cancels", async () => {
    mockFeedbackChat();

    const upstream = new AbortController();
    const fakeStream = {
      controller: upstream,
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: "partial" } }], x_groq: null };
        await new Promise<void>((resolve) => {
          upstream.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    };

    vi.spyOn(groq.chat.completions, "create").mockResolvedValue(fakeStream as any);

    const req = new Request("http://localhost:3000/api/chats/chat-1/feedback", { method: "POST" });
    const res = await feedbackRoute(req, { params: Promise.resolve({ id: "chat-1" }) });

    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => {
      expect(upstream.signal.aborted).toBe(true);
    });
    await vi.waitFor(() => {
      expect(rateLimitModule.releaseChatLock).toHaveBeenCalled();
    });
  });
});
