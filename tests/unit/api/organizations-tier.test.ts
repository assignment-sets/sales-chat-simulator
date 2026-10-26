import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/organizations/tier/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";

describe("POST /api/organizations/tier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 500 internal error when active organization context fails to resolve", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to resolve active organization");
  });

  it("returns 403 forbidden when user is a member (not owner or admin)", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only organization owners and admins can switch subscription plans");
  });

  it("returns 429 when tier rate limit is exceeded", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many plan tier changes" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "scale" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many plan tier changes");
  });

  it("returns 400 bad request on invalid JSON request body", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON body");
  });

  it("returns 400 bad request when plan_tier is missing or not a string", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("plan_tier is required");
  });

  it("returns 500 internal error when update_organization_plan_tier RPC fails", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "update_organization_plan_tier") {
        return { data: null, error: { message: "Database update error" } };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to update organization plan");
  });

  it("successfully updates plan tier for owner with normalized tier", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-1",
      orgId: "org-123",
      role: "owner",
    });

    const mockRpcResult = {
      id: "org-123",
      plan_tier: "scale",
      updated_at: new Date().toISOString(),
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "update_organization_plan_tier") {
        expect(params.target_org_id).toBe("org-123");
        expect(params.new_tier).toBe("scale");
        return { data: mockRpcResult, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "scale" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.organization_id).toBe("org-123");
    expect(json.plan_tier).toBe("scale");
    expect(json.result).toEqual(mockRpcResult);
  });

  it("successfully updates plan tier for admin", async () => {
    const { mockClient } = setupMockAuth({
      userId: "user-admin",
      orgId: "org-123",
      role: "admin",
    });

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "update_organization_plan_tier") {
        expect(params.target_org_id).toBe("org-123");
        expect(params.new_tier).toBe("pro");
        return { data: { success: true }, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_tier: "pro" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.organization_id).toBe("org-123");
    expect(json.plan_tier).toBe("pro");
  });
});
