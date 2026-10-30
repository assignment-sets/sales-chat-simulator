import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/organizations/[id]/members/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";
import * as entitlementsModule from "@/lib/entitlements";
import * as cacheModule from "@/lib/cache";

describe("GET /api/organizations/[id]/members", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 not found when caller is not a member of the organization", async () => {
    setupMockAuth({ userId: "user-1", orgId: "other-org" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: false,
      role: null,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Organization not found");
  });

  it("returns members list via get_organization_members RPC and hides invitations for member role", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "member",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const mockMembers = [
      {
        id: "mem-1",
        organization_id: "org-1",
        user_id: "user-1",
        role: "member",
        created_at: new Date().toISOString(),
        email: "user1@saleschat.io",
        full_name: "User One",
      },
    ];

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "get_organization_members") {
        expect(params.target_org_id).toBe("org-1");
        return { data: mockMembers, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual(mockMembers);
    expect(json.invitations).toEqual([]);
    expect(json.current_user_role).toBe("member");
    expect(json.current_user_id).toBe("user-1");
  });

  it("returns members and pending invitations when caller is owner or admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const mockMembers = [
      {
        id: "mem-admin",
        organization_id: "org-1",
        user_id: "admin-1",
        role: "admin",
        created_at: new Date().toISOString(),
        email: "admin@saleschat.io",
      },
    ];

    const mockInvitations = [
      {
        id: "invite-1",
        email: "prospect-rep@saleschat.io",
        role: "member",
        created_at: new Date().toISOString(),
      },
    ];

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "get_organization_members") {
        return { data: mockMembers, error: null };
      }
      return { data: null, error: null };
    });

    mockClient.from = vi.fn((table: string) => {
      if (table === "organization_invitations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockInvitations, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual(mockMembers);
    expect(json.invitations).toEqual(mockInvitations);
    expect(json.current_user_role).toBe("admin");
  });

  it("falls back to direct query if get_organization_members RPC fails", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "member",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "get_organization_members") {
        return { data: null, error: { message: "function does not exist" } };
      }
      return { data: null, error: null };
    });

    const fallbackMembers = [
      {
        id: "mem-fb",
        organization_id: "org-1",
        user_id: "user-1",
        role: "member",
        created_at: new Date().toISOString(),
      },
    ];

    mockClient.from = vi.fn((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: fallbackMembers, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual(fallbackMembers);
  });

  it("returns 500 when both RPC and direct query fail", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "member",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    mockClient.rpc = vi.fn(async () => ({
      data: null,
      error: { message: "function not found" },
    }));

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "Table query failed" } }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members");
    const res = await GET(req, { params: Promise.resolve({ id: "org-1" }) });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to fetch organization members");
  });
});

describe("POST /api/organizations/[id]/members", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@saleschat.io" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 forbidden when caller is a member (non-admin/non-owner)", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@saleschat.io" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners and admins can invite new members");
  });

  it("returns 429 when invitation rate limit is exceeded", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    vi.spyOn(rateLimitModule, "enforceRateLimits").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many invitations sent" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@saleschat.io" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many invitations sent");
  });

  it("returns 400 bad request on invalid JSON request body", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON request body");
  });

  it("returns 400 bad request when email is invalid or missing @", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email-no-at" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("A valid email address is required");
  });

  it("returns 403 forbidden when team seats quota is exceeded", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Team seat limit reached for your plan" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ) as any,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rep@saleschat.io", role: "member" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team seat limit reached");
  });

  it("returns 500 internal error when invite_or_add_org_member RPC fails", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({ ok: true });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "invite_or_add_org_member") {
        return { data: null, error: { message: "RPC failed" } };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rep@saleschat.io", role: "member" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to invite member");
  });

  it("successfully invites member via RPC and invalidates pricing cache", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({ ok: true });
    const invalidateSpy = vi.spyOn(cacheModule, "invalidateOrgMembers").mockResolvedValue();

    const mockResult = { status: "invited", email: "newuser@saleschat.io" };
    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "invite_or_add_org_member") {
        expect(params.target_org_id).toBe("org-1");
        expect(params.target_email).toBe("newuser@saleschat.io");
        expect(params.target_role).toBe("admin");
        return { data: mockResult, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "NewUser@SalesChat.io", role: "admin" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result).toEqual(mockResult);

    expect(invalidateSpy).toHaveBeenCalledWith("org-1");
  });

  it("returns 403 forbidden when an admin attempts to invite/grant the owner role", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newowner@saleschat.io", role: "owner" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners can grant the owner role");
  });

  it("allows owner to grant owner role via invite_or_add_org_member", async () => {
    const { mockClient } = setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    vi.spyOn(rateLimitModule, "enforceRateLimits").mockResolvedValue({
      ok: true,
    });

    vi.spyOn(entitlementsModule, "checkQuota").mockResolvedValue({ ok: true });
    vi.spyOn(cacheModule, "invalidateOrgMembers").mockResolvedValue();

    const mockResult = { status: "added", user_id: "user-2", email: "coowner@saleschat.io" };
    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "invite_or_add_org_member") {
        expect(params.target_role).toBe("owner");
        return { data: mockResult, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "coowner@saleschat.io", role: "owner" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/organizations/[id]/members", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem-1", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 not found when caller is not a member of the organization", async () => {
    setupMockAuth({ userId: "user-1", orgId: "other-org" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: false,
      role: null,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem-1", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 forbidden when caller is a member (non-admin/non-owner)", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem-1", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners and admins can update member roles");
  });

  it("returns 400 bad request on invalid JSON or missing parameters", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req1 = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });

    const res1 = await PATCH(req1, { params: Promise.resolve({ id: "org-1" }) });
    expect(res1.status).toBe(400);

    const req2 = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem-1", role: "invalid_role" }),
    });

    const res2 = await PATCH(req2, { params: Promise.resolve({ id: "org-1" }) });
    expect(res2.status).toBe(400);
    const json2 = await res2.json();
    expect(json2.error).toContain("Role must be either 'admin' or 'member'");
  });

  it("returns 404 not found when target member does not exist in the organization", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "nonexistent-mem", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Member not found in this organization");
  });

  it("returns 403 forbidden to prevent owner demotion", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const ownerMember = {
      id: "owner-mem-id",
      user_id: "owner-user-id",
      role: "owner",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: ownerMember, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "owner-mem-id", role: "member" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Organization owners cannot be demoted");
  });

  it("returns 403 forbidden when an admin attempts to promote a member to admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const targetMember = {
      id: "target-mem-id",
      user_id: "target-user-id",
      role: "member",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: targetMember, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "target-mem-id", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only the workspace owner can promote members to Admin");
  });

  it("returns 403 forbidden when an admin attempts to demote another admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const targetAdmin = {
      id: "admin-2-id",
      user_id: "user-admin-2",
      role: "admin",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: targetAdmin, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "admin-2-id", role: "member" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only the workspace owner can demote an Admin");
  });

  it("successfully updates member role to admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const existingMember = {
      id: "target-mem-id",
      user_id: "user-2",
      role: "member",
    };

    const updatedRecord = {
      id: "target-mem-id",
      user_id: "user-2",
      role: "admin",
      created_at: new Date().toISOString(),
    };

    let callCount = 0;
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return { data: existingMember, error: null };
        }
        return { data: updatedRecord, error: null };
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "target-mem-id", role: "admin" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.member.role).toBe("admin");
  });
});

describe("DELETE /api/organizations/[id]/members", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=mem-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 not found when caller is not a member of the organization", async () => {
    setupMockAuth({ userId: "user-1", orgId: "other-org" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: false,
      role: null,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=mem-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 bad request when memberId and userId query params are missing", async () => {
    setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/members", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("memberId or userId query parameter is required");
  });

  it("returns 404 not found when targeted member does not exist in organization", async () => {
    const { mockClient } = setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=unknown-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Member not found in this organization");
  });

  it("returns 403 forbidden when a member tries to remove another member", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const targetMember = {
      id: "mem-2",
      user_id: "user-2",
      role: "member",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: targetMember, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=mem-2", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("You do not have permission to remove members");
  });

  it("returns 403 forbidden when admin tries to remove the owner", async () => {
    const { mockClient } = setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const ownerTarget = {
      id: "owner-mem-id",
      user_id: "owner-user-id",
      role: "owner",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: ownerTarget, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=owner-mem-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Admins cannot remove the organization owner");
  });

  it("returns 400 bad request when sole owner attempts to remove themselves", async () => {
    const { mockClient } = setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const selfOwnerTarget = {
      id: "owner-mem-id",
      user_id: "owner-1",
      role: "owner",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: selfOwnerTarget, error: null }),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: 1, error: null }).then(onfulfilled, onrejected),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=owner-mem-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Cannot leave as the sole owner");
  });

  it("successfully removes member when caller is owner/admin or self", async () => {
    const { mockClient } = setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const targetMember = {
      id: "mem-target",
      user_id: "user-target",
      role: "member",
    };

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: targetMember, error: null }),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ data: [{ id: "mem-target" }], error: null }).then(
          onfulfilled,
          onrejected
        ),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?memberId=mem-target", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("successfully revokes an invitation when caller is owner or admin", async () => {
    const { mockClient } = setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const deleteMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });

    mockClient.from = vi.fn((tableName: string) => {
      if (tableName === "organization_invitations") {
        return {
          delete: deleteMock,
          eq: vi.fn().mockReturnValue({
            eq: eqMock,
          }),
        };
      }
      return {} as any;
    }) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1/members?inviteId=inv-target", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.revoked).toBe(true);
  });
});
