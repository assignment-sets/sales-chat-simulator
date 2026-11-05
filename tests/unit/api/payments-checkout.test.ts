import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/payments/checkout/route";
import { NextRequest } from "next/server";
import { setupMockAuth } from "../../utils/mock-supabase";
import * as tenantModule from "@/lib/tenant";
import * as rateLimitModule from "@/lib/rate-limit";
import * as dodoClientModule from "@/lib/dodo/client";
import { DODO_PRODUCTS } from "@/lib/dodo/products";

describe("POST /api/payments/checkout", () => {
  let mockDodoClient: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDodoClient = {
      checkoutSessions: {
        create: vi.fn().mockResolvedValue({
          session_id: "cks_test_12345",
          checkout_url: "https://test.checkout.dodopayments.com/buy/cks_test_12345",
        }),
      },
    };
    vi.spyOn(dodoClientModule, "getDodoClient").mockReturnValue(mockDodoClient as any);
  });

  function createRequest(body: any) {
    return new NextRequest("http://localhost:3000/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 unauthorized when user is not authenticated", async () => {
    setupMockAuth(null);

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 500 when active organization context cannot be resolved", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1" });
    vi.spyOn(tenantModule, "getActiveOrganization").mockResolvedValue(null);

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Failed to resolve active workspace context");
  });

  it("returns 403 forbidden when user is only a member", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "member" });

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only workspace owners and administrators");
  });

  it("returns 429 when checkout rate limit is exceeded", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Retry-After": "60" },
      }) as any,
    });

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 400 bad request on invalid JSON body", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = new NextRequest("http://localhost:3000/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON body");
  });

  it("returns 400 bad request on missing or invalid tier", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    // Starter tier cannot be purchased through checkout
    const req1 = createRequest({ tier: "starter" });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);
    const json1 = await res1.json();
    expect(json1.error).toContain("Paid subscriptions must be one of: solo, team, scale");

    // Invalid tier string
    const req2 = createRequest({ tier: "enterprise" });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it("returns 400 bad request when workspace already has an active subscription", async () => {
    setupMockAuth({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
      tables: {
        dodo_subscriptions: [
          {
            id: "sub_active_scale",
            organization_id: "org-1",
            status: "active",
            plan_tier: "scale",
          },
        ],
      },
    });

    const req = createRequest({ tier: "solo" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Workspace already has an active scale subscription");
    expect(mockDodoClient.checkoutSessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 bad request on unsupported currency", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = createRequest({ tier: "team", currency: "EUR" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Supported currencies are USD and INR");
  });

  it("creates checkout session for new customer with USD default", async () => {
    const { user, organization } = setupMockAuth({
      userId: "user-1",
      email: "jane@saleschat.io",
      orgId: "org-1",
      role: "owner",
    });

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.checkoutUrl).toBe("https://test.checkout.dodopayments.com/buy/cks_test_12345");
    expect(json.sessionId).toBe("cks_test_12345");

    expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith({
      product_cart: [{ product_id: DODO_PRODUCTS.team.productId, quantity: 1 }],
      customer: {
        email: user!.email,
        name: "Test User",
      },
      billing_currency: "USD",
      feature_flags: {
        allow_currency_selection: true,
      },
      metadata: {
        organization_id: organization!.id,
        user_id: user!.id,
        target_tier: "team",
      },
      return_url: "http://localhost:3000/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    });
  });

  it("creates checkout session for existing customer with INR and localized address", async () => {
    const { user, organization } = setupMockAuth({
      userId: "user-1",
      email: "raj@saleschat.io",
      orgId: "org-1",
      role: "admin",
    });

    // Attach existing dodo_customer_id
    (organization as any).dodo_customer_id = "cus_existing_dodo_888";

    const req = createRequest({
      tier: "solo",
      currency: "INR",
      returnUrl: "/settings?tab=billing",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.checkoutUrl).toBe("https://test.checkout.dodopayments.com/buy/cks_test_12345");

    expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith({
      product_cart: [{ product_id: DODO_PRODUCTS.solo.productId, quantity: 1 }],
      customer: {
        customer_id: "cus_existing_dodo_888",
      },
      billing_currency: "INR",
      billing_address: {
        country: "IN",
      },
      feature_flags: {
        allow_currency_selection: true,
      },
      metadata: {
        organization_id: organization!.id,
        user_id: user!.id,
        target_tier: "solo",
      },
      return_url: "http://localhost:3000/settings?tab=billing",
    });
  });

  it("sanitizes malicious open redirect return_url by reverting to default", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    const req = createRequest({
      tier: "scale",
      returnUrl: "https://evil-phishing-site.com/steal-creds",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "http://localhost:3000/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      })
    );
  });

  it("returns 500 sanitized error when Dodo Payments SDK fails", async () => {
    setupMockAuth({ userId: "user-1", orgId: "org-1", role: "owner" });

    mockDodoClient.checkoutSessions.create.mockRejectedValue(
      new Error("Dodo Payments upstream network timeout: 504")
    );

    const req = createRequest({ tier: "team" });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();

    // Sensitive upstream error message must not be leaked to the client
    expect(json.error).toBe("Failed to initiate checkout session. Please try again later.");
    expect(json.error).not.toContain("Dodo Payments upstream");
  });
});
