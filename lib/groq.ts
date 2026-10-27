import Groq, { APIUserAbortError } from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY is not defined in environment variables");
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

/**
 * Groq client defaults.
 *
 * The SDK defaults are 60s per attempt with 2 retries, so a single stalled
 * request can occupy a function for ~3 minutes before it fails. Every AI route
 * also passes a tighter per-request timeout, but the client-level values are
 * the floor that protects any call site we forget to update.
 */
export const GROQ_TIMEOUT_MS = positiveInt(process.env.GROQ_TIMEOUT_MS, 30_000);
export const GROQ_MAX_RETRIES = positiveInt(process.env.GROQ_MAX_RETRIES, 1);

export const groq = new Groq({
  apiKey,
  timeout: GROQ_TIMEOUT_MS,
  maxRetries: GROQ_MAX_RETRIES,
});

/**
 * True when a Groq error was caused by an aborted request (client disconnect
 * or our own watchdog) rather than a real upstream failure. Aborted calls must
 * never be retried or followed by a recovery generation.
 */
export function isGroqAbortError(error: unknown): boolean {
  return (
    error instanceof APIUserAbortError ||
    (error instanceof Error &&
      (error.name === "APIUserAbortError" || error.name === "AbortError"))
  );
}

export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
