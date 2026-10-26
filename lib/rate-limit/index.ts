import { Ratelimit } from "@upstash/ratelimit";
import type { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-response";
import { getRedisClient } from "@/lib/redis";
import { RATE_LIMITS } from "./policies";
import type { RateLimitPolicyName } from "./policies";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

const limiters = new Map<RateLimitPolicyName, Ratelimit>();

function getLimiter(name: RateLimitPolicyName): Ratelimit | null {
  const cached = limiters.get(name);
  if (cached) {
    return cached;
  }

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const policy = RATE_LIMITS[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `rl:${name}`,
    // Fail open inside the SDK if Upstash is slow to respond.
    timeout: 1000,
    analytics: false,
    // Short-circuit identifiers that were already blocked by this instance.
    ephemeralCache: new Map<string, number>(),
  });

  limiters.set(name, limiter);
  return limiter;
}

/**
 * Checks a single policy for an identifier (e.g. `u:<userId>`, `o:<orgId>`).
 *
 * Fails open on Redis/network errors so an Upstash outage does not take down
 * the product. The Vercel WAF rule remains as a coarse outer shield.
 */
export async function enforceRateLimit(
  name: RateLimitPolicyName,
  identifier: string
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { ok: true };
  }

  const limiter = getLimiter(name);
  if (!limiter) {
    return { ok: true };
  }

  try {
    const result = await limiter.limit(identifier);

    if (result.success) {
      return { ok: true };
    }

    const retryAfterMs = Math.max(0, result.reset - Date.now());
    console.warn(
      `[RateLimit] blocked policy=${name} identifier=${identifier} retryAfterMs=${retryAfterMs}`
    );

    return {
      ok: false,
      response: rateLimited(retryAfterMs, result.limit, result.remaining),
    };
  } catch (error) {
    console.error(
      `[RateLimit] check failed; failing open. policy=${name} identifier=${identifier}`,
      error
    );
    return { ok: true };
  }
}

/**
 * Checks several policies at once and returns the first failure.
 */
export async function enforceRateLimits(
  ...checks: Array<[RateLimitPolicyName, string]>
): Promise<RateLimitResult> {
  if (checks.length === 0) {
    return { ok: true };
  }

  const results = await Promise.all(
    checks.map(([name, identifier]) => enforceRateLimit(name, identifier))
  );

  return results.find((result) => !result.ok) ?? { ok: true };
}

/**
 * Best-effort per-chat lock used to stop two concurrent requests from both
 * generating an LLM response (double-click, multiple tabs, retries).
 *
 * Returns `true` when the lock is acquired or when Redis is unavailable.
 */
export async function acquireChatLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return true;
  }

  try {
    const result = await redis.set(`rl:lock:${key}`, "1", {
      nx: true,
      ex: ttlSeconds,
    });
    return result === "OK";
  } catch (error) {
    console.error(
      `[RateLimit] lock acquisition failed; proceeding without lock. key=${key}`,
      error
    );
    return true;
  }
}

/**
 * Releases a per-chat lock. Safe to call when Redis is unavailable.
 */
export async function releaseChatLock(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(`rl:lock:${key}`);
  } catch (error) {
    console.error(`[RateLimit] lock release failed. key=${key}`, error);
  }
}
