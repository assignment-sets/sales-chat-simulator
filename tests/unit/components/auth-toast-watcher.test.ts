import { describe, it, expect } from "vitest";
import {
  evaluatePaymentToastOutcome,
  stripPaymentParamsFromUrl,
  PAYMENT_REDIRECT_PARAMS,
} from "@/components/auth/AuthToastWatcher";

describe("AuthToastWatcher Payment Status & Redirect Logic", () => {
  describe("evaluatePaymentToastOutcome", () => {
    it("strictly flags payment failure even if checkout=success is lingering in query params", () => {
      const params = new URLSearchParams("checkout=success&status=failed&payment_id=pay_123");
      const outcome = evaluatePaymentToastOutcome(params);

      expect(outcome).not.toBeNull();
      expect(outcome?.type).toBe("failed");
      expect(outcome?.message).toContain("Payment failed");
    });

    it("evaluates standalone Dodo status=failed as failure", () => {
      const params = new URLSearchParams("status=failed&payment_id=pay_failed_999");
      const outcome = evaluatePaymentToastOutcome(params);

      expect(outcome?.type).toBe("failed");
      expect(outcome?.message).toMatch(/Payment failed/i);
    });

    it("evaluates checkout=failed or checkout=error as failure", () => {
      const params1 = new URLSearchParams("checkout=failed");
      const outcome1 = evaluatePaymentToastOutcome(params1);
      expect(outcome1?.type).toBe("failed");

      const params2 = new URLSearchParams("checkout=error");
      const outcome2 = evaluatePaymentToastOutcome(params2);
      expect(outcome2?.type).toBe("failed");
    });

    it("evaluates status=cancelled or checkout=cancelled as cancellation", () => {
      const params1 = new URLSearchParams("status=cancelled");
      const outcome1 = evaluatePaymentToastOutcome(params1);
      expect(outcome1?.type).toBe("cancelled");
      expect(outcome1?.message).toMatch(/cancelled/i);

      const params2 = new URLSearchParams("checkout=cancelled");
      const outcome2 = evaluatePaymentToastOutcome(params2);
      expect(outcome2?.type).toBe("cancelled");
    });

    it("evaluates status=expired as expired session", () => {
      const params = new URLSearchParams("status=expired");
      const outcome = evaluatePaymentToastOutcome(params);
      expect(outcome?.type).toBe("expired");
      expect(outcome?.message).toMatch(/expired/i);
    });

    it("evaluates processing and pending statuses correctly", () => {
      for (const statusVal of ["processing", "pending", "requires_customer_action"]) {
        const params = new URLSearchParams(`status=${statusVal}`);
        const outcome = evaluatePaymentToastOutcome(params);
        expect(outcome?.type).toBe("processing");
        expect(outcome?.message).toMatch(/processing/i);
      }
    });

    it("evaluates Dodo status=active (subscription) as success", () => {
      const params = new URLSearchParams("status=active&subscription_id=sub_active_123");
      const outcome = evaluatePaymentToastOutcome(params);
      expect(outcome?.type).toBe("success");
      expect(outcome?.message).toMatch(/Subscription updated/i);
    });

    it("evaluates Dodo status=succeeded (payment) as success", () => {
      const params = new URLSearchParams("status=succeeded&payment_id=pay_ok_123");
      const outcome = evaluatePaymentToastOutcome(params);
      expect(outcome?.type).toBe("success");
      expect(outcome?.message).toMatch(/Subscription updated/i);
    });

    it("supports legacy checkout=success fallback when no conflicting status is present", () => {
      const params = new URLSearchParams("checkout=success&session_id=cks_123");
      const outcome = evaluatePaymentToastOutcome(params);
      expect(outcome?.type).toBe("success");
    });

    it("returns null when no payment query params are present", () => {
      const params = new URLSearchParams("tab=billing&foo=bar");
      const outcome = evaluatePaymentToastOutcome(params);
      expect(outcome).toBeNull();
    });
  });

  describe("stripPaymentParamsFromUrl", () => {
    it("strips all Dodo payment and checkout query params while preserving other params", () => {
      const url = new URL(
        "https://chat2sell.in/pricing?tab=billing&checkout=success&status=failed&session_id=cks_123&payment_id=pay_456&subscription_id=sub_789&license_key=LK-001&email=test@example.com&keep=me"
      );

      const modified = stripPaymentParamsFromUrl(url);
      expect(modified).toBe(true);

      for (const param of PAYMENT_REDIRECT_PARAMS) {
        expect(url.searchParams.has(param)).toBe(false);
      }

      // Preserved non-payment query params
      expect(url.searchParams.get("tab")).toBe("billing");
      expect(url.searchParams.get("keep")).toBe("me");
    });

    it("returns false if no payment params were present", () => {
      const url = new URL("https://chat2sell.in/dashboard?tab=overview");
      const modified = stripPaymentParamsFromUrl(url);
      expect(modified).toBe(false);
      expect(url.searchParams.get("tab")).toBe("overview");
    });
  });
});
