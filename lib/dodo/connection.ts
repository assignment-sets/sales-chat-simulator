import { env } from "@/lib/env";
import { getDodoClient } from "./client";

export type DodoConnectionStatus = "configured" | "placeholder" | "auth_error" | "network_error";

export interface DodoConnectionResult extends Record<string, unknown> {
  ok: boolean;
  status: DodoConnectionStatus;
  environment: "test_mode" | "live_mode";
  brandName?: string | null;
  errorMessage?: string;
}

/**
 * Performs a safe, non-destructive read-only connectivity test against Dodo Payments.
 * Does not create or modify any resources.
 */
export async function testDodoConnection(): Promise<DodoConnectionResult> {
  const environment = (env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";
  const apiKey = env.DODO_PAYMENTS_API_KEY;

  if (!apiKey || apiKey === "dodo_test_placeholder_key") {
    return {
      ok: false,
      status: "placeholder",
      environment,
      errorMessage: "DODO_PAYMENTS_API_KEY is not configured or is using placeholder.",
    };
  }

  try {
    const client = getDodoClient();
    // Read-only brand query to verify credentials without creating/modifying anything
    const response = await client.brands.list();
    const brandName = response.items?.[0]?.name ?? null;

    return {
      ok: true,
      status: "configured",
      environment,
      brandName,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuth =
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("401") ||
      message.toLowerCase().includes("api key") ||
      message.toLowerCase().includes("forbidden");

    return {
      ok: false,
      status: isAuth ? "auth_error" : "network_error",
      environment,
      errorMessage: message,
    };
  }
}
