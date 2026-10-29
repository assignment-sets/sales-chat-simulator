import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/invitations/[token]/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as rateLimitModule from "@/lib/rate-limit";
import * as cacheModule from "@/lib/cache";
import { cookies } from "next/headers";

describe("GET /api/invitations/[token]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 bad request when token is empty or whitespace", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/invitations/%20");
    const res = await GET(req, { params: Promise.resolve({ token: "   " }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invitation token is required");
  });

  it("returns 404 not found when invitation does not exist or has expired", async () => {
    const { mockClient } = setupMockAuth(null);
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/invalid-token");
    const res = await GET(req, { params: Promise.resolve({ token: "invalid-token" }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Invitation not found");
  });

  it("returns 500 when database RPC throws an error", async () => {
    const { mockClient } = setupMockAuth(null);
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return { data: null, error: { message: "DB query failure" } };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/test-token");
    const res = await GET(req, { params: Promise.resolve({ token: "test-token" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to fetch invitation details");
  });

  it("returns invitation details and current user status when valid", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-123",
      email: "colleague@example.com",
    });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });

    const mockInvite = {
      id: "inv-1",
      email: "colleague@example.com",
      role: "member",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      is_expired: false,
      organization: {
        id: "org-123",
        name: "Acme Corp",
        slug: "acme-corp",
      },
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "get_invitation_by_token") {
        expect(params.invite_token).toBe("valid-token-123");
        return { data: mockInvite, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/valid-token-123");
    const res = await GET(req, { params: Promise.resolve({ token: "valid-token-123" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.invitation).toEqual(mockInvite);
    expect(json.current_user).toEqual({
      id: "user-123",
      email: "colleague@example.com",
    });
  });
});

describe("POST /api/invitations/[token]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not logged in", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/invitations/tok-1", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ token: "tok-1" }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Please sign in");
  });

  it("returns 400 bad request when invitation has expired", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-123",
      email: "user@example.com",
    });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "accept_organization_invitation") {
        return { data: null, error: { message: "Invitation has expired" } };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/tok-expired", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ token: "tok-expired" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("This invitation has expired");
  });

  it("returns 403 forbidden when user signs in with a mismatched email", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-123",
      email: "wrong@example.com",
    });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "accept_organization_invitation") {
        return {
          data: null,
          error: {
            message:
              "This invitation was issued for right@example.com, but you are signed in as wrong@example.com",
          },
        };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/tok-mismatch", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ token: "tok-mismatch" }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("This invitation was issued for right@example.com");
  });

  it("successfully accepts invitation, sets active org cookie, and invalidates cache", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-123",
      email: "right@example.com",
    });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(cacheModule, "invalidateOrgMembers").mockResolvedValue();

    const mockCookieStore = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
    };
    (cookies as any).mockResolvedValue(mockCookieStore);

    const mockAccepted = {
      status: "accepted",
      organization_id: "org-joined-123",
      role: "admin",
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "accept_organization_invitation") {
        expect(params.invite_token).toBe("valid-token");
        return { data: mockAccepted, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/invitations/valid-token", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ token: "valid-token" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.organization_id).toBe("org-joined-123");
    expect(json.role).toBe("admin");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "saleschat_active_org_id",
      "org-joined-123",
      expect.objectContaining({ path: "/" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith("org-joined-123", "user-123");
  });
});
