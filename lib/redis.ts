import { Redis } from "@upstash/redis";

/**
 * Shared lazy Upstash Redis client.
 *
 * Used by the rate limiter (`lib/rate-limit`) and the cache-aside layer
 * (`lib/cache`). Lazy initialization keeps `next build` working when
 * credentials are absent (and lets local development run with rate limiting
 * and caching disabled).
 */

const PLACEHOLDER_VALUES = new Set([
  "https://your-database.upstash.io",
  "your-upstash-rest-token",
]);

let redisClient: Redis | null | undefined;
let warnedMissingCredentials = false;

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_VALUES.has(normalized) || normalized.includes("placeholder");
}

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const credentialPairs = [
    [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
  ] as const;

  let url: string | undefined;
  let token: string | undefined;

  // Prefer whichever pair is actually configured; placeholders are ignored so
  // switching between Vercel's KV_* names and standalone Upstash's names works.
  for (const [candidateUrl, candidateToken] of credentialPairs) {
    if (
      candidateUrl &&
      candidateToken &&
      !isPlaceholder(candidateUrl) &&
      !isPlaceholder(candidateToken)
    ) {
      url = candidateUrl;
      token = candidateToken;
      break;
    }
  }

  if (!url || !token) {
    if (!warnedMissingCredentials) {
      console.warn(
        "[Redis] Upstash credentials are not configured (or are placeholders). Rate limiting and caching are disabled.",
      );
      warnedMissingCredentials = true;
    }
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch (error) {
    console.error(
      "[Redis] Failed to initialize Upstash Redis. Rate limiting and caching are disabled.",
      error,
    );
    redisClient = null;
  }

  return redisClient;
}
