import DodoPayments from "dodopayments";
import { env } from "@/lib/env";

let instance: DodoPayments | null = null;

/**
 * Returns a singleton server-side instance of the Dodo Payments SDK client.
 * Configured strictly for test_mode unless explicitly overridden.
 */
export function getDodoClient(): DodoPayments {
  if (typeof window !== "undefined") {
    throw new Error("getDodoClient() cannot be called client-side.");
  }

  const apiKey = env.DODO_PAYMENTS_API_KEY;
  if (!apiKey || apiKey === "dodo_test_placeholder_key") {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured or is still using placeholder.");
  }

  if (!instance) {
    const environment = (env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";
    instance = new DodoPayments({
      bearerToken: apiKey,
      environment,
    });
  }

  return instance;
}
