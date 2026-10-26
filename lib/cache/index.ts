import { getRedisClient } from "@/lib/redis";

/**
 * Minimal cache-aside layer on the shared Upstash Redis client.
 *
 * Design rules:
 * - Fail open: any Redis error (read or write) logs and falls through to the
 *   loader, so an Upstash outage never turns into an error response.
 * - Never cache `null`/`undefined` or thrown errors — only real values.
 * - Callers must run authentication/authorization *before* `cached()` and must
 *   build keys with the helpers in `./keys` (always tenant-scoped).
 */

interface CacheEnvelope<T> {
  v: 1;
  d: T;
}

function isCacheDisabled(): boolean {
  return process.env.CACHE_DISABLED === "true";
}

/**
 * Read-through cache: returns the cached envelope value, otherwise runs the
 * loader and stores the result.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  if (isCacheDisabled()) {
    return loader();
  }

  const redis = getRedisClient();
  if (!redis) {
    return loader();
  }

  try {
    const envelope = await redis.get<CacheEnvelope<T>>(key);
    if (envelope && envelope.v === 1) {
      return envelope.d;
    }
  } catch (error) {
    // Fail open: treat a broken read as a miss.
    console.error(`[Cache] error reading key=${key}`, error);
  }

  // Logged at most once per key per TTL (i.e. once per miss), never on hits.
  console.log(`[Cache] miss key=${key}`);

  const value = await loader();
  if (value === undefined || value === null) {
    return value;
  }

  try {
    // Small random spread so keys written together do not all expire together.
    const maxJitter = Math.ceil(ttlSeconds * 0.1);
    const jitterSeconds = Math.floor(Math.random() * (maxJitter + 1));
    await redis.set(key, { v: 1, d: value } satisfies CacheEnvelope<T>, {
      ex: ttlSeconds + jitterSeconds,
    });
  } catch (error) {
    // Fail open: the caller already has the freshly loaded value.
    console.error(`[Cache] error writing key=${key}`, error);
  }

  return value;
}

/**
 * Best-effort invalidation. Swallows every error (including a missing Redis
 * client) so callers can `await` it after a write without risking the response.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  const uniqueKeys = Array.from(
    new Set(keys.filter((key) => typeof key === "string" && key.length > 0))
  );

  if (uniqueKeys.length === 0 || isCacheDisabled()) {
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(...uniqueKeys);
  } catch (error) {
    console.error(`[Cache] error invalidating keys=${uniqueKeys.join(",")}`, error);
  }
}
