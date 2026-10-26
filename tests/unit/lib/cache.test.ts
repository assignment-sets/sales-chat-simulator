import { describe, it, expect, vi, beforeEach } from "vitest";
import { cached, invalidate } from "@/lib/cache";
import { memberChatsKey, dashboardKey, pricingKey, transcriptKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import * as redisModule from "@/lib/redis";

describe("cache/keys.ts (Tenant-Scoped Keys)", () => {
  it("generates correct organization and user scoped keys with prefix", () => {
    expect(memberChatsKey("org-123", "usr-456")).toBe("cache:v1:memberchats:org:org-123:user:usr-456");
    expect(dashboardKey("org-123")).toBe("cache:v1:dashboard:org:org-123");
    expect(pricingKey("org-123")).toBe("cache:v1:pricing:org:org-123");
    expect(transcriptKey("org-123", "chat-789")).toBe("cache:v1:transcript:org:org-123:chat:chat-789");
  });
});

describe("cache/policies.ts", () => {
  it("defines positive TTL values for all cache targets", () => {
    expect(CACHE_TTLS.dashboard).toBeGreaterThan(0);
    expect(CACHE_TTLS.pricing).toBeGreaterThan(0);
    expect(CACHE_TTLS.transcript).toBeGreaterThan(0);
    expect(CACHE_TTLS.memberChats).toBeGreaterThan(0);
  });
});

describe("cache/index.ts (Read-Through Cache)", () => {
  beforeEach(() => {
    delete process.env.CACHE_DISABLED;
    vi.restoreAllMocks();
  });

  it("bypasses cache and runs loader directly when CACHE_DISABLED='true'", async () => {
    process.env.CACHE_DISABLED = "true";
    const loader = vi.fn(async () => ({ data: "fresh-from-db" }));

    const res = await cached("test-key", 60, loader);
    expect(res).toEqual({ data: "fresh-from-db" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("falls back to loader when Redis is not available (fail open)", async () => {
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(null);
    const loader = vi.fn(async () => "fresh-data");

    const res = await cached("test-key", 60, loader);
    expect(res).toBe("fresh-data");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves cached value from Redis on cache hit without invoking loader", async () => {
    const mockRedis = {
      get: vi.fn(async (key: string) => ({ v: 1, d: { total: 42 } })),
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);
    const loader = vi.fn(async () => ({ total: 999 }));

    const res = await cached("kpi-key", 60, loader);
    expect(res).toEqual({ total: 42 });
    expect(loader).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith("kpi-key");
  });

  it("runs loader on cache miss and writes value to Redis with jitter", async () => {
    const mockRedis = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);
    const loader = vi.fn(async () => ({ total: 100 }));

    const res = await cached("kpi-key", 60, loader);
    expect(res).toEqual({ total: 100 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it("does not write null or undefined results to cache", async () => {
    const mockRedis = {
      get: vi.fn(async () => null),
      set: vi.fn(),
    };
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue(mockRedis as any);
    const loader = vi.fn(async () => null);

    const res = await cached("empty-key", 60, loader);
    expect(res).toBeNull();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("invalidates cache key via del", async () => {
    const mockDel = vi.fn(async () => 1);
    vi.spyOn(redisModule, "getRedisClient").mockReturnValue({
      del: mockDel,
    } as any);

    await invalidate("key-to-delete");
    expect(mockDel).toHaveBeenCalledWith("key-to-delete");
  });
});
