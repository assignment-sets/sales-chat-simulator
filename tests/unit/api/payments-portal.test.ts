import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/payments/portal/route";
import { NextRequest } from "next/server";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";
import * as dodoClientModule from "@/lib/dodo/client";

describe("POST /api/payments/portal", () => {
  let mockDodoClient: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDodoClient = {
      customers: {
        customerPortal: {
          create: vi.fn().mockResolvedValue({
            link: "https://test.customerportal.dodopayments.com/portal/ses_test_9999",
          }),
        },
      },
    };
    vi.spyOn(dodoClientModule, "getDodoClient").mockReturnValue(mockDodoClient as any);
  });

  function createRequest(body?: any) {
    return new NextRequest("http://localhost:3000/api/payments/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 500 when active workspace context fails to resolve", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to resolve active workspace context");
  });

  it("returns 403 forbidden when user is a member (not owner or admin)", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only workspace owners and administrators");
  });

  it("returns 429 when portal rate limit is exceeded", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Retry-After": "60" },
      }) as any,
    });

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 400 bad request on invalid JSON body", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = new NextRequest("http://localhost:3000/api/payments/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON body");
  });

  it("returns 400 bad request when workspace has no billing profile (no dodo_customer_id)", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      tables: {
        organizations: [{ id: "org-1", name: "Acme", dodo_customer_id: null }],
        dodo_subscriptions: [],
      },
    });

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("No billing account exists for this workspace");
  });

  it("creates customer portal session when dodo_customer_id is present on context", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      dodoCustomerId: "cus_direct_12345",
    });

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.portalUrl).toBe("https://test.customerportal.dodopayments.com/portal/ses_test_9999");
    expect(mockDodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
      "cus_direct_12345",
      {
        return_url: "http://localhost:3000/dashboard",
      }
    );
  });

  it("resolves dodo_customer_id from organizations table when missing on context", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
      tables: {
        organizations: [{ id: "org-1", dodo_customer_id: "cus_from_db_777" }],
        dodo_subscriptions: [],
      },
    });

    const req = createRequest({ returnUrl: "/settings?tab=billing", sendEmail: true });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.portalUrl).toBe("https://test.customerportal.dodopayments.com/portal/ses_test_9999");
    expect(mockDodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
      "cus_from_db_777",
      {
        return_url: "http://localhost:3000/settings?tab=billing",
        send_email: true,
      }
    );
  });

  it("resolves dodo_customer_id from dodo_subscriptions table when missing elsewhere", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      tables: {
        organizations: [{ id: "org-1", dodo_customer_id: null }],
        dodo_subscriptions: [{ id: "sub_1", organization_id: "org-1", customer_id: "cus_from_sub_888" }],
      },
    });

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.portalUrl).toBe("https://test.customerportal.dodopayments.com/portal/ses_test_9999");
    expect(mockDodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
      "cus_from_sub_888",
      {
        return_url: "http://localhost:3000/dashboard",
      }
    );
  });

  it("sanitizes malicious open redirect return_url by reverting to default", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      dodoCustomerId: "cus_direct_12345",
    });

    const req = createRequest({
      returnUrl: "https://malicious-attacker.com/steal-token",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockDodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
      "cus_direct_12345",
      {
        return_url: "http://localhost:3000/dashboard",
      }
    );
  });

  it("returns 500 sanitized error when Dodo Payments SDK fails upstream", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      dodoCustomerId: "cus_direct_12345",
    });

    mockDodoClient.customers.customerPortal.create.mockRejectedValue(
      new Error("Dodo Upstream 502 Bad Gateway: Secret API Key invalid")
    );

    const req = createRequest();
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();

    // Sanitized client error must not leak internal upstream message
    expect(json.error).toBe("Failed to open billing portal. Please try again later.");
    expect(json.error).not.toContain("Secret API Key");
  });
});
