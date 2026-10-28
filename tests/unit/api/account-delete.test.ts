import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/account/delete/route";
import { setupMockAuth, mockCookieStore } from "../../utils/mock-supabase";
import * as rateLimitModule from "@/lib/rate-limit";
import * as cacheModule from "@/lib/cache";
import { rateLimited } from "@/lib/api-response";

describe("POST /api/account/delete (GDPR Art. 17 Account Deletion)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when there is no authenticated user", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit policy account.delete.user is exceeded", async () => {
    setupMockAuth({ userId: "user-rate-limited" });

    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: rateLimited("Too many account deletion attempts", 3600),
    });

    const req = new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 400 bad request if confirmation string is not 'DELETE'", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "delete" }), // lowercase should fail
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Confirmation string 'DELETE' is required");
  });

  it("blocks deletion if user is the sole owner of an organization with other active members", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-sole-owner",
      role: "owner",
    });

    const mockOrgMemberships = [
      {
        organization_id: "org-shared-1",
        role: "owner",
        organizations: { id: "org-shared-1", name: "Alpha Team" },
      },
    ];

    const mockAllMembersInOrg = [
      { id: "mem-1", user_id: "user-sole-owner", role: "owner" },
      { id: "mem-2", user_id: "user-colleague-1", role: "member" },
      { id: "mem-3", user_id: "user-colleague-2", role: "member" },
    ];

    mockClient.from = vi.fn((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => {
            if (col === "user_id") {
              return Promise.resolve({ data: mockOrgMemberships, error: null });
            }
            if (col === "organization_id" && val === "org-shared-1") {
              return Promise.resolve({ data: mockAllMembersInOrg, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const req = new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe(
      "You are the sole owner of organization 'Alpha Team'. Please transfer ownership to another team member or remove all members before deleting your account."
    );
  });

  it("successfully deletes single-member orgs, scrubs user identity, terminates session and invalidates cache", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-delete-success",
      email: "delete-me@saleschat.io",
    });

    const invalidateSpy = vi.spyOn(cacheModule, "invalidate").mockResolvedValue();

    // User is owner of private org-solo (1 member) and member of shared org-team (3 members)
    const mockOrgMemberships = [
      {
        organization_id: "org-solo",
        role: "owner",
        organizations: { id: "org-solo", name: "My Personal Workspace" },
      },
      {
        organization_id: "org-team",
        role: "member",
        organizations: { id: "org-team", name: "Shared Enterprise Team" },
      },
    ];

    const mockSoloOrgMembers = [
      { id: "mem-solo-1", user_id: "user-delete-success", role: "owner" },
    ];

    const mockTeamOrgMembers = [
      { id: "mem-team-1", user_id: "other-owner", role: "owner" },
      { id: "mem-team-2", user_id: "other-admin", role: "admin" },
      { id: "mem-team-3", user_id: "user-delete-success", role: "member" },
    ];

    const mockUserChats = [
      { id: "chat-solo-1", organization_id: "org-solo" },
      { id: "chat-team-1", organization_id: "org-team" },
    ];

    const deletedOrgIds: string[] = [];
    const deleteOrgInMock = vi.fn((col: string, ids: string[]) => {
      if (Array.isArray(ids)) {
        deletedOrgIds.push(...ids);
      } else if (Array.isArray(col)) {
        deletedOrgIds.push(...col);
      }
      return Promise.resolve({ error: null });
    });

    mockClient.from = vi.fn((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => {
            if (col === "user_id") {
              return Promise.resolve({ data: mockOrgMemberships, error: null });
            }
            if (col === "organization_id" && val === "org-solo") {
              return Promise.resolve({ data: mockSoloOrgMembers, error: null });
            }
            if (col === "organization_id" && val === "org-team") {
              return Promise.resolve({ data: mockTeamOrgMembers, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        };
      }
      if (table === "chats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockUserChats, error: null }),
        };
      }
      if (table === "organizations") {
        return {
          delete: vi.fn(() => ({
            in: deleteOrgInMock,
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const req = new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // 1. Verify single-member org was deleted
    expect(deletedOrgIds).toContain("org-solo");
    // Shared org was NOT deleted
    expect(deletedOrgIds).not.toContain("org-team");

    // 2. Verify admin deleteUser called
    expect(mockClient.auth.admin.deleteUser).toHaveBeenCalledWith("user-delete-success");

    // 3. Verify session was signed out and cookie cleared
    expect(mockClient.auth.signOut).toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("sc_active_org_id");

    // 4. Verify cache invalidation occurred with appropriate keys
    expect(invalidateSpy).toHaveBeenCalled();
    const invalidatedKeys = invalidateSpy.mock.calls[0];
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        expect.stringContaining("org-solo"),
        expect.stringContaining("org-team"),
        expect.stringContaining("chat-solo-1"),
        expect.stringContaining("chat-team-1"),
      ])
    );
  });
});
