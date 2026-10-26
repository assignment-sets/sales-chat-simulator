import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/organizations/switch/route";
import { setupMockAuth, mockCookieStore } from "../../utils/mock-supabase";
import { ACTIVE_ORG_COOKIE_NAME } from "@/lib/tenant";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";

describe("POST /api/organizations/switch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: "org-2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    setupMockAuth({ userId: "user-1" });

    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Too many organization switches" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }) as any,
    });

    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: "org-2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many organization switches");
  });

  it("returns 400 bad request on invalid JSON request body", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON request body");
  });

  it("returns 400 bad request when organization_id is missing or empty", async () => {
    setupMockAuth({ userId: "user-1" });

    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: "   " }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("organization_id is required");
  });

  it("returns 403 forbidden when user is not a member of the target organization", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: false,
      role: null,
    });

    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: "unauthorized-org-99" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("You do not have access to this organization");
  });

  it("successfully switches active organization, sets cookie, and returns membership role", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });

    vi.spyOn(tenantModule, "validateOrgMembership").mockResolvedValue({
      isMember: true,
      role: "admin",
    });

    const targetOrgId = "org-target-456";
    const req = new Request("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: targetOrgId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.active_organization_id).toBe(targetOrgId);
    expect(json.role).toBe("admin");

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      ACTIVE_ORG_COOKIE_NAME,
      targetOrgId,
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 365,
      })
    );
  });
});
