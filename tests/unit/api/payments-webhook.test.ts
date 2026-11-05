import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/payments/webhook/route";
import { NextRequest } from "next/server";
import { createMockSupabaseClient, testState } from "../../utils/mock-supabase";
import * as dodoClientModule from "@/lib/dodo/client";
import * as redisModule from "@/lib/redis";

describe("POST /api/payments/webhook", () => {
  let mockDodoClient: any;
  let mockRedis: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = "whsec_test_secret_123456789";

    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "starter", dodo_customer_id: null }],
        dodo_payments: [],
        dodo_subscriptions: [],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient = {
      webhooks: {
        unwrap: vi.fn(),
      },
    };
    vi.spyOn(dodoClientModule, "getDodoClient").mockReturnValue(mockDodoClient as any);

    mockRedis = {
      set: vi.fn().mockResolvedValue("OK"),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);
  });

  function createRequest(body: string, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost:3000/api/payments/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_test_123",
        "webhook-signature": "v1,signature_abc",
        "webhook-timestamp": "1730700000",
        ...headers,
      },
      body,
    });
  }

  it("returns 500 if DODO_PAYMENTS_WEBHOOK_KEY is unconfigured", async () => {
    const original = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    try {
      const req = createRequest(JSON.stringify({ type: "payment.succeeded" }));
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toContain("Webhook signature key unconfigured");
    } finally {
      process.env.DODO_PAYMENTS_WEBHOOK_KEY = original;
    }
  });

  it("returns 401 if webhook headers are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "payment.succeeded" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Missing required webhook signature headers");
  });

  it("returns 401 if signature verification fails", async () => {
    mockDodoClient.webhooks.unwrap.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = createRequest(JSON.stringify({ type: "payment.succeeded" }));
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid webhook signature");
  });

  it("returns 200 duplicate skipped if idempotency key was already set in Redis", async () => {
    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "payment.succeeded",
      data: { payment_id: "pay_dup_123" },
    });
    mockRedis.set.mockResolvedValue(null); // nx failed

    const req = createRequest(JSON.stringify({ type: "payment.succeeded" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });

  it("handles payment.succeeded: inserts dodo_payments and links organization customer", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "starter", dodo_customer_id: null }],
        dodo_payments: [],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "payment.succeeded",
      data: {
        payment_id: "pay_test_999",
        subscription_id: "sub_test_888",
        total_amount: 2900,
        currency: "USD",
        customer: { customer_id: "cus_dodo_111", email: "user@test.com" },
        metadata: { organization_id: "org-1" },
        created_at: new Date().toISOString(),
      },
    });

    const req = createRequest(JSON.stringify({ type: "payment.succeeded" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.result.handled).toBe(true);
    expect(json.result.action).toBe("payment_recorded");
    expect(json.result.organizationId).toBe("org-1");
  });

  it("handles payment.failed: records failed status in dodo_payments", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "starter", dodo_customer_id: null }],
        dodo_payments: [],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "payment.failed",
      data: {
        payment_id: "pay_failed_999",
        subscription_id: "sub_test_888",
        total_amount: 2900,
        currency: "USD",
        customer: { customer_id: "cus_dodo_111" },
        metadata: { organization_id: "org-1" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "payment.failed" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("failed_payment_recorded");
  });

  it("handles subscription.active: upgrades organization plan_tier and records subscription", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "starter" }],
        dodo_subscriptions: [],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.active",
      data: {
        subscription_id: "sub_active_777",
        customer: { customer_id: "cus_dodo_111" },
        product_id: "pdt_0NrCqCw137x2o5PtfWW3E", // Team product ID
        status: "active",
        next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        metadata: { organization_id: "org-1", target_tier: "team" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.active" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.handled).toBe(true);
    expect(json.result.action).toBe("subscription_activated");
    expect(json.result.organizationId).toBe("org-1");
  });

  it("handles subscription.renewed: extends current_period_end", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "team" }],
        dodo_subscriptions: [{ id: "sub_active_777", organization_id: "org-1", status: "active" }],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.renewed",
      data: {
        subscription_id: "sub_active_777",
        customer: { customer_id: "cus_dodo_111" },
        next_billing_date: new Date(Date.now() + 60 * 86400000).toISOString(),
        metadata: { organization_id: "org-1" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.renewed" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("subscription_renewed");
  });

  it("handles subscription.cancelled: sets cancel_at_period_end", async () => {
    const futureDate = new Date(Date.now() + 15 * 86400000).toISOString();
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "team" }],
        dodo_subscriptions: [{ id: "sub_active_777", organization_id: "org-1", status: "active" }],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.cancelled",
      data: {
        subscription_id: "sub_active_777",
        next_billing_date: futureDate,
        metadata: { organization_id: "org-1" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.cancelled" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("subscription_cancelled");
  });

  it("handles subscription.plan_changed: immediately transitions tier to new product", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "team" }],
        dodo_subscriptions: [{ id: "sub_active_777", organization_id: "org-1", plan_tier: "team", status: "active" }],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.plan_changed",
      data: {
        subscription_id: "sub_active_777",
        product_id: "pdt_0NrCqD1GfGTlFxBTIfmdg", // Scale product ID
        metadata: { organization_id: "org-1" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.plan_changed" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("plan_changed");
  });

  it("handles subscription.active with tier hierarchy: does not demote organization if higher tier is active", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [
          {
            id: "org-1",
            name: "Test Org",
            plan_tier: "scale",
            dodo_subscription_id: "sub_scale_active",
          },
        ],
        dodo_subscriptions: [
          {
            id: "sub_scale_active",
            organization_id: "org-1",
            plan_tier: "scale",
            status: "active",
          },
        ],
      },
    });
    testState.adminClient = mockAdmin;

    // Incoming activation for a lower Solo subscription
    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.active",
      data: {
        subscription_id: "sub_solo_rogue",
        customer: { customer_id: "cus_dodo_111" },
        product_id: "pdt_0NrCqCpQLfiaQSDlhGxoC", // Solo
        metadata: { organization_id: "org-1", target_tier: "solo" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.active" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("subscription_activated_secondary");
  });

  it("handles subscription.updated: syncs status and billing dates", async () => {
    const mockAdmin = createMockSupabaseClient({
      tables: {
        organizations: [{ id: "org-1", name: "Test Org", plan_tier: "team" }],
        dodo_subscriptions: [
          { id: "sub_active_777", organization_id: "org-1", plan_tier: "team", status: "active" },
        ],
      },
    });
    testState.adminClient = mockAdmin;

    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "subscription.updated",
      data: {
        subscription_id: "sub_active_777",
        status: "active",
        product_id: "pdt_0NrCqD1GfGTlFxBTIfmdg", // Scale
        next_billing_date: "2026-12-04T10:00:00Z",
        metadata: { organization_id: "org-1" },
      },
    });

    const req = createRequest(JSON.stringify({ type: "subscription.updated" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.action).toBe("subscription_updated");
  });

  it("ignores unhandled event types gracefully with 200 and ignored: true", async () => {
    mockDodoClient.webhooks.unwrap.mockReturnValue({
      type: "dispute.opened",
      data: { dispute_id: "disp_123" },
    });

    const req = createRequest(JSON.stringify({ type: "dispute.opened" }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.ignored).toBe(true);
  });
});
