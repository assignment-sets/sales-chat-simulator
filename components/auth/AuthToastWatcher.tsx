"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { notify } from "@/lib/toast";

const recentlyShown = new Set<string>();

export const PAYMENT_REDIRECT_PARAMS = [
  "checkout",
  "status",
  "session_id",
  "payment_id",
  "subscription_id",
  "license_key",
  "email",
] as const;

export type PaymentToastOutcome =
  | { type: "failed"; message: string }
  | { type: "cancelled"; message: string }
  | { type: "expired"; message: string }
  | { type: "processing"; message: string }
  | { type: "success"; message: string };

/**
 * Evaluates payment outcome from Dodo Payments or checkout redirect query parameters.
 * Strict priority: Terminal failure states take precedence over any residual `checkout=success`.
 */
export function evaluatePaymentToastOutcome(
  searchParams: URLSearchParams
): PaymentToastOutcome | null {
  const checkout = searchParams.get("checkout")?.toLowerCase();
  const status = searchParams.get("status")?.toLowerCase();

  const isPaymentReturn =
    Boolean(status) ||
    Boolean(checkout) ||
    searchParams.has("payment_id") ||
    searchParams.has("subscription_id");

  if (!isPaymentReturn) {
    return null;
  }

  // 1. Terminal failure takes absolute precedence even if checkout=success was in return_url
  if (status === "failed" || checkout === "failed" || checkout === "error") {
    return {
      type: "failed",
      message: "Payment failed. Please check your payment details or try another card.",
    };
  }

  // 2. Cancellation
  if (status === "cancelled" || checkout === "cancelled") {
    return {
      type: "cancelled",
      message: "Payment was cancelled. Your account was not charged.",
    };
  }

  // 3. Expired checkout session
  if (status === "expired") {
    return {
      type: "expired",
      message: "Checkout session expired. Please try again.",
    };
  }

  // 4. Processing / pending confirmation
  if (
    status === "processing" ||
    status === "pending" ||
    status?.startsWith("requires_")
  ) {
    return {
      type: "processing",
      message: "Payment is processing. Your workspace will update once confirmed.",
    };
  }

  // 5. Successful payment / active subscription
  if (
    status === "succeeded" ||
    status === "active" ||
    (!status && checkout === "success")
  ) {
    return {
      type: "success",
      message: "Subscription updated! Your workspace limits are now active.",
    };
  }

  return null;
}

export function stripPaymentParamsFromUrl(url: URL): boolean {
  let hasModified = false;
  for (const param of PAYMENT_REDIRECT_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      hasModified = true;
    }
  }
  return hasModified;
}

export function AuthToastWatcher() {
  const searchParams = useSearchParams();
  const localShownRef = useRef<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    // Handle payment return redirects
    const outcome = evaluatePaymentToastOutcome(searchParams);
    if (outcome) {
      const key = `payment:${outcome.type}`;
      if (localShownRef.current !== key && !recentlyShown.has(key)) {
        localShownRef.current = key;
        recentlyShown.add(key);
        setTimeout(() => recentlyShown.delete(key), 3000);

        if (outcome.type === "failed" || outcome.type === "expired") {
          notify.error(outcome.message);
        } else if (outcome.type === "cancelled" || outcome.type === "processing") {
          notify.info(outcome.message);
        } else if (outcome.type === "success") {
          notify.success(outcome.message);
        }
      }

      // Clean up all payment return query params from URL without reload
      const url = new URL(window.location.href);
      if (stripPaymentParamsFromUrl(url)) {
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }
      return;
    }

    if (
      error &&
      localShownRef.current !== `error:${error}` &&
      !recentlyShown.has(`error:${error}`)
    ) {
      localShownRef.current = `error:${error}`;
      recentlyShown.add(`error:${error}`);
      setTimeout(() => recentlyShown.delete(`error:${error}`), 3000);

      notify.error(error);

      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else if (
      message &&
      localShownRef.current !== `message:${message}` &&
      !recentlyShown.has(`message:${message}`)
    ) {
      localShownRef.current = `message:${message}`;
      recentlyShown.add(`message:${message}`);
      setTimeout(() => recentlyShown.delete(`message:${message}`), 3000);

      notify.success(message);

      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [searchParams]);

  return null;
}
