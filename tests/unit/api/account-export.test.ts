import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/account/export/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as rateLimitModule from "@/lib/rate-limit";
import { rateLimited } from "@/lib/api-response";

describe("GET /api/account/export (GDPR Art. 20 Data Portability)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when there is no authenticated user", async () => {
    setupMockAuth(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Authentication required");
  });

  it("returns 429 when rate limit policy account.export.user is exceeded", async () => {
    setupMockAuth({ userId: "user-rate-limited" });

    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: rateLimited("Too many export requests", 3600),
    });

    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("returns complete machine-readable structured JSON document with attachment header", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-gdpr-1",
      email: "alex@enterprise.com",
    });

    const mockOrg = {
      id: "org-100",
      name: "Enterprise Sales Corp",
      slug: "enterprise-sales",
      plan_tier: "enterprise",
      created_at: "2026-01-01T00:00:00Z",
    };

    const mockMemberRows = [
      {
        organization_id: "org-100",
        role: "owner",
        created_at: "2026-01-01T00:00:00Z",
        organizations: mockOrg,
      },
    ];

    const mockChats = [
      {
        id: "chat-1",
        organization_id: "org-100",
        product_name: "Cloud Platform",
        product_description: "Cloud compute and storage",
        status: "WON",
        score: 5,
        evaluation_outcome: "deal_won",
        tokens_used: 1250,
        ai_feedback: "Great value proposition articulation.",
        created_at: "2026-02-01T10:00:00Z",
        updated_at: "2026-02-01T10:15:00Z",
      },
    ];

    const mockMessages = [
      {
        id: "msg-1",
        chat_id: "chat-1",
        role: "user",
        content: "Hello! Our platform cuts compute bills by 30%.",
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
        created_at: "2026-02-01T10:01:00Z",
      },
      {
        id: "msg-2",
        chat_id: "chat-1",
        role: "assistant",
        content: "Interesting, but migration sounds too painful for our ops team.",
        prompt_tokens: 25,
        completion_tokens: 30,
        total_tokens: 55,
        created_at: "2026-02-01T10:02:00Z",
      },
    ];

    const mockSentInvitations = [
      {
        id: "inv-1",
        organization_id: "org-100",
        email: "colleague@enterprise.com",
        role: "member",
        created_at: "2026-02-15T09:00:00Z",
      },
    ];

    const mockReceivedInvitations = [
      {
        id: "inv-2",
        organization_id: "org-200",
        email: "alex@enterprise.com",
        role: "admin",
        invited_by: "boss@partner.com",
        created_at: "2026-02-20T11:00:00Z",
      },
    ];

    mockClient.from = vi.fn((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockMemberRows, error: null }),
        };
      }
      if (table === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockChats, error: null }),
        };
      }
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
        };
      }
      if (table === "organization_invitations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string) => {
            if (field === "invited_by") {
              return Promise.resolve({ data: mockSentInvitations, error: null });
            }
            return Promise.resolve({ data: mockReceivedInvitations, error: null });
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const res = await GET();
    expect(res.status).toBe(200);

    // Verify attachment header and format
    const contentDisposition = res.headers.get("content-disposition");
    expect(contentDisposition).toContain('attachment; filename="saleschat-data-export-user-gdpr-1-');
    expect(contentDisposition).toContain('.json"');

    const json = await res.json();
    expect(json.version).toBe("1.0");
    expect(json.user.id).toBe("user-gdpr-1");
    expect(json.user.email).toBe("alex@enterprise.com");
    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].name).toBe("Enterprise Sales Corp");
    expect(json.simulations).toHaveLength(1);
    expect(json.simulations[0].productName).toBe("Cloud Platform");
    expect(json.simulations[0].messages).toHaveLength(2);
    expect(json.invitations.sent).toHaveLength(1);
    expect(json.invitations.received).toHaveLength(1);
  });
});
