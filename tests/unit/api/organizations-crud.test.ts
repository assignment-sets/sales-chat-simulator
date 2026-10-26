import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/organizations/route";
import { setupMockAuth, mockCookieStore } from "../../utils/mock-supabase";
import { ACTIVE_ORG_COOKIE_NAME } from "@/lib/tenant";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";

describe("GET /api/organizations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);
    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 500 internal error when active organization context fails to resolve", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to resolve organization context");
  });

  it("returns active organization context and memberships list for authenticated user", async () => {
    const { activeContext } = setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      orgName: "Acme Corp",
      role: "owner",
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.active_organization.id).toBe("org-1");
    expect(json.active_organization.name).toBe("Acme Corp");
    expect(json.role).toBe("owner");
    expect(json.organizations).toEqual(activeContext!.allOrganizations);
  });
});

describe("POST /api/organizations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Org" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 when creation rate limit is exceeded", async () => {
    setupMockAuth({ userId: "user-1" });

    vi.spyOn(rateLimitModule, "enforceRateLimits").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many organizations created" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Org" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many organizations created");
  });

  it("returns 400 bad request on invalid JSON request body", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON request body");
  });

  it("returns 400 bad request when name is missing or whitespace", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Organization name is required");
  });

  it("returns 400 bad request when name is fewer than 2 characters", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("between 2 and 50 characters");
  });

  it("returns 400 bad request when name exceeds 50 characters", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X".repeat(51) }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("between 2 and 50 characters");
  });

  it("returns 500 internal error when checking owned organizations count fails", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1" });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: null, error: { message: "DB connection error" } }).then(
          onfulfilled,
          onrejected
        ),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Valid Org" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to verify organization ownership limit");
  });

  it("returns 403 forbidden when user already owns 3 organizations", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1" });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: 3, error: null }).then(onfulfilled, onrejected),
    })) as any;

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fourth Org" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("You can own up to 3 organizations");
  });

  it("returns 500 internal error when create_organization_with_owner RPC fails", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1" });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: 1, error: null }).then(onfulfilled, onrejected),
    })) as any;

    mockClient.rpc = vi.fn(async (fnName: string) => {
      if (fnName === "create_organization_with_owner") {
        return { data: null, error: { message: "RPC failed to insert org" } };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alpha Software" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to create organization");
  });

  it("creates organization via create_organization_with_owner RPC and sets active cookie", async () => {
    const { mockClient } = setupMockAuth({ userId: "user-1" });

    mockClient.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (onfulfilled: any, onrejected: any) =>
        Promise.resolve({ count: 1, error: null }).then(onfulfilled, onrejected),
    })) as any;

    const createdRecord = {
      id: "org-new-999",
      name: "Alpha Software",
      slug: "alpha-software-xyz123",
      plan_tier: "starter",
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: "owner",
    };

    mockClient.rpc = vi.fn(async (fnName: string, params: any) => {
      if (fnName === "create_organization_with_owner") {
        expect(params.org_name).toBe("Alpha Software");
        expect(params.org_slug).toContain("alpha-software");
        return { data: createdRecord, error: null };
      }
      return { data: null, error: null };
    });

    const req = new Request("http://localhost:3000/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alpha Software" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.organization.id).toBe("org-new-999");
    expect(json.organization.name).toBe("Alpha Software");
    expect(json.organization.plan_tier).toBe("starter");
    expect(json.role).toBe("owner");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      ACTIVE_ORG_COOKIE_NAME,
      "org-new-999",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: false,
      })
    );
  });
});
