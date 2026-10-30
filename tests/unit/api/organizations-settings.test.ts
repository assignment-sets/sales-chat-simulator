import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH as renameOrg, DELETE as deleteOrg } from "@/app/api/organizations/[id]/route";
import { POST as transferOwnership } from "@/app/api/organizations/[id]/transfer-ownership/route";
import { POST as resendInvitation } from "@/app/api/organizations/[id]/invitations/[inviteId]/resend/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";

describe("PATCH /api/organizations/[id] (Rename)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Workspace" }),
    });

    const res = await renameOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 not found when user is not a member of the organization", async () => {
    setupMockAuth({ userId: "user-1", orgId: "other-org" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: false,
      role: null,
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Workspace" }),
    });

    const res = await renameOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 forbidden when a regular member attempts to rename", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Workspace" }),
    });

    const res = await renameOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners and admins can rename");
  });

  it("returns 400 bad request when organization name is empty or invalid", async () => {
    setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    // Too short (< 2)
    const req1 = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });
    const res1 = await renameOrg(req1, { params: Promise.resolve({ id: "org-1" }) });
    expect(res1.status).toBe(400);

    // Too long (> 50)
    const req2 = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A".repeat(51) }),
    });
    const res2 = await renameOrg(req2, { params: Promise.resolve({ id: "org-1" }) });
    expect(res2.status).toBe(400);
  });

  it("successfully renames the organization when called by an owner", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const updatedOrg = {
      id: "org-1",
      name: "Acme Enterprises",
      slug: "acme-enterprises",
      plan_tier: "pro",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockClient.from = vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: updatedOrg, error: null }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme Enterprises" }),
    });

    const res = await renameOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.organization.name).toBe("Acme Enterprises");
  });
});

describe("DELETE /api/organizations/[id] (Delete)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Acme Corp" }),
    });

    const res = await deleteOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 forbidden when an admin or member attempts to delete the organization", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Acme Corp" }),
    });

    const res = await deleteOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only the organization owner can delete");
  });

  it("returns 400 bad request when deleting the user's sole remaining workspace", async () => {
    setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    // Only 1 organization in list
    vi.spyOn(tenantModule, "getUserOrganizations").mockResolvedValue([
      {
        id: "mem-1",
        organization_id: "org-1",
        user_id: "owner-1",
        role: "owner",
        created_at: new Date().toISOString(),
        organization: {
          id: "org-1",
          name: "Acme Corp",
          slug: "acme-corp",
          plan_tier: "starter",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Acme Corp" }),
    });

    const res = await deleteOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("You cannot delete your only workspace");
  });

  it("returns 400 bad request when confirmation string does not match org name", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    // Multiple orgs exist
    vi.spyOn(tenantModule, "getUserOrganizations").mockResolvedValue([
      {
        id: "mem-1",
        organization_id: "org-1",
        user_id: "owner-1",
        role: "owner",
        created_at: new Date().toISOString(),
        organization: {
          id: "org-1",
          name: "Acme Corp",
          slug: "acme-corp",
          plan_tier: "pro",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        id: "mem-2",
        organization_id: "org-2",
        user_id: "owner-1",
        role: "owner",
        created_at: new Date().toISOString(),
        organization: {
          id: "org-2",
          name: "Beta Workspace",
          slug: "beta-ws",
          plan_tier: "starter",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "org-1", name: "Acme Corp" },
        error: null,
      }),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Wrong Name" }),
    });

    const res = await deleteOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Confirmation does not match");
  });

  it("successfully deletes the organization when user has multiple workspaces", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    vi.spyOn(tenantModule, "getUserOrganizations").mockResolvedValue([
      {
        id: "mem-1",
        organization_id: "org-1",
        user_id: "owner-1",
        role: "owner",
        created_at: new Date().toISOString(),
        organization: {
          id: "org-1",
          name: "Acme Corp",
          slug: "acme-corp",
          plan_tier: "pro",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        id: "mem-2",
        organization_id: "org-2",
        user_id: "owner-1",
        role: "owner",
        created_at: new Date().toISOString(),
        organization: {
          id: "org-2",
          name: "Beta Workspace",
          slug: "beta-ws",
          plan_tier: "starter",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    let callCount = 0;
    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => {
        return { data: { id: "org-1", name: "Acme Corp" }, error: null };
      }),
      then: (onfulfilled: any, onrejected: any) => {
        callCount++;
        return Promise.resolve({
          data: [{ id: "org-1" }],
          error: null,
        }).then(onfulfilled, onrejected);
      },
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations/org-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "Acme Corp" }),
    });

    const res = await deleteOrg(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deleted_organization_id).toBe("org-1");
    expect(json.next_organization_id).toBe("org-2");
  });
});

describe("POST /api/organizations/[id]/transfer-ownership", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/organizations/org-1/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: "target-user" }),
    });

    const res = await transferOwnership(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 forbidden when a non-owner attempts to transfer ownership", async () => {
    setupMockAuth({ userId: "admin-1", orgId: "org-1", role: "admin" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: "target-user" }),
    });

    const res = await transferOwnership(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only the organization owner can transfer ownership");
  });

  it("returns 400 bad request on self-transfer attempt", async () => {
    setupMockAuth({ userId: "owner-1", orgId: "org-1", role: "owner" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: "owner-1" }),
    });

    const res = await transferOwnership(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("You are already the owner");
  });

  it("returns 400 bad request when target user is not an active member", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    mockClient.rpc = vi.fn(async () => {
      return {
        data: null,
        error: { message: "Target user must be an active member of this organization before receiving ownership" },
      };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: "outsider-user" }),
    });

    const res = await transferOwnership(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Target user must be an active member");
  });

  it("successfully transfers ownership via atomic RPC", async () => {
    const { mockClient } = setupMockAuth({
      userId: "owner-1",
      orgId: "org-1",
      role: "owner",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    const rpcResult = {
      success: true,
      organization_id: "org-1",
      previous_owner_id: "owner-1",
      new_owner_id: "user-target",
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      expect(fnName).toBe("transfer_organization_ownership");
      expect(params.target_org_id).toBe("org-1");
      expect(params.new_owner_user_id).toBe("user-target");
      return { data: rpcResult, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerUserId: "user-target" }),
    });

    const res = await transferOwnership(req, { params: Promise.resolve({ id: "org-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result).toEqual(rpcResult);
  });
});

describe("POST /api/organizations/[id]/invitations/[inviteId]/resend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const req = new Request("http://localhost:3000/api/organizations/org-1/invitations/inv-1/resend", {
      method: "POST",
    });

    const res = await resendInvitation(req, {
      params: Promise.resolve({ id: "org-1", inviteId: "inv-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 forbidden when a regular member attempts to resend", async () => {
    setupMockAuth({ userId: "member-1", orgId: "org-1", role: "member" });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "member",
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/invitations/inv-1/resend", {
      method: "POST",
    });

    const res = await resendInvitation(req, {
      params: Promise.resolve({ id: "org-1", inviteId: "inv-1" }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners and admins can resend");
  });

  it("returns 404 not found when invitation does not exist", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    mockClient.rpc = vi.fn(async () => {
      return { data: null, error: { message: "Invitation not found" } };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/invitations/inv-missing/resend", {
      method: "POST",
    });

    const res = await resendInvitation(req, {
      params: Promise.resolve({ id: "org-1", inviteId: "inv-missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("successfully refreshes token and returns new invite URL for owner or admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "admin-1",
      orgId: "org-1",
      role: "admin",
    });
    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const rpcResult = {
      id: "inv-1",
      email: "colleague@example.com",
      role: "member",
      token: "new-token-abc12345",
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      expect(fnName).toBe("resend_organization_invitation");
      expect(params.target_org_id).toBe("org-1");
      expect(params.target_invite_id).toBe("inv-1");
      return { data: rpcResult, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/org-1/invitations/inv-1/resend", {
      method: "POST",
      headers: { origin: "https://app.saleschat.io" },
    });

    const res = await resendInvitation(req, {
      params: Promise.resolve({ id: "org-1", inviteId: "inv-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.invitation.token).toBe("new-token-abc12345");
    expect(json.invitation.invite_url).toBe("https://app.saleschat.io/invite/new-token-abc12345");
  });
});
