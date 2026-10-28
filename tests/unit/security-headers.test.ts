import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import { ACTIVE_ORG_COOKIE_OPTIONS } from "@/lib/tenant";

describe("Security Headers Configuration (next.config.ts)", () => {
  it("exports an async headers() function", () => {
    expect(nextConfig.headers).toBeTypeOf("function");
  });

  it("configures global security headers for /:path*", async () => {
    const headerConfigs = await nextConfig.headers!();
    const globalConfig = headerConfigs.find((c) => c.source === "/:path*");
    expect(globalConfig).toBeDefined();

    const headersMap = new Map<string, string>();
    for (const h of globalConfig!.headers) {
      headersMap.set(h.key.toLowerCase(), h.value);
    }

    // 1. Content-Security-Policy
    const csp = headersMap.get("content-security-policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");

    // 2. Strict-Transport-Security (HSTS)
    const hsts = headersMap.get("strict-transport-security");
    expect(hsts).toBeDefined();
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");

    // 3. X-Content-Type-Options
    expect(headersMap.get("x-content-type-options")).toBe("nosniff");

    // 4. X-Frame-Options
    expect(headersMap.get("x-frame-options")).toBe("DENY");

    // 5. Referrer-Policy
    expect(headersMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");

    // 6. Permissions-Policy
    const permissions = headersMap.get("permissions-policy");
    expect(permissions).toBeDefined();
    expect(permissions).toContain("camera=()");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("geolocation=()");

    // 7. Cross-Origin-Opener-Policy (COOP)
    expect(headersMap.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");

    // 8. Cross-Origin-Resource-Policy (CORP)
    expect(headersMap.get("cross-origin-resource-policy")).toBe("same-origin");

    // 9. X-DNS-Prefetch-Control
    expect(headersMap.get("x-dns-prefetch-control")).toBe("on");
  });

  it("configures no-store Cache-Control headers for /api/:path*", async () => {
    const headerConfigs = await nextConfig.headers!();
    const apiConfig = headerConfigs.find((c) => c.source === "/api/:path*");
    expect(apiConfig).toBeDefined();

    const cacheControl = apiConfig!.headers.find(
      (h) => h.key.toLowerCase() === "cache-control"
    );
    expect(cacheControl).toBeDefined();
    expect(cacheControl!.value).toBe("no-store, max-age=0, must-revalidate");
  });

  it("exports hardened ACTIVE_ORG_COOKIE_OPTIONS with secure attribute tied to environment", () => {
    expect(ACTIVE_ORG_COOKIE_OPTIONS).toEqual(
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
      })
    );
  });
});
