import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import {
  isPublicSitemapRoute,
  getRoutePolicy,
  CORE_SITEMAP_FALLBACK_ROUTES,
} from "@/lib/seo/sitemap-config";

describe("Dynamic Sitemap Generation System", () => {
  describe("isPublicSitemapRoute filter", () => {
    it("allows standard public routes", () => {
      expect(isPublicSitemapRoute("/")).toBe(true);
      expect(isPublicSitemapRoute("/pricing")).toBe(true);
      expect(isPublicSitemapRoute("/about")).toBe(true);
      expect(isPublicSitemapRoute("/docs")).toBe(true);
      expect(isPublicSitemapRoute("/changelog")).toBe(true);
      expect(isPublicSitemapRoute("/acceptable-use")).toBe(true);
      expect(isPublicSitemapRoute("/security")).toBe(true);
      expect(isPublicSitemapRoute("/subprocessors")).toBe(true);
      expect(isPublicSitemapRoute("/terms")).toBe(true);
      expect(isPublicSitemapRoute("/privacy")).toBe(true);
      expect(isPublicSitemapRoute("/cookies")).toBe(true);
      expect(isPublicSitemapRoute("/refund")).toBe(true);
      expect(isPublicSitemapRoute("/support")).toBe(true);
    });

    it("filters out protected and authenticated application routes", () => {
      expect(isPublicSitemapRoute("/chats")).toBe(false);
      expect(isPublicSitemapRoute("/chats/chat-123")).toBe(false);
      expect(isPublicSitemapRoute("/dashboard")).toBe(false);
      expect(isPublicSitemapRoute("/settings")).toBe(false);
      expect(isPublicSitemapRoute("/api/chat")).toBe(false);
      expect(isPublicSitemapRoute("/auth/confirm")).toBe(false);
      expect(isPublicSitemapRoute("/invite")).toBe(false);
      expect(isPublicSitemapRoute("/reset-password")).toBe(false);
      expect(isPublicSitemapRoute("/forgot-password")).toBe(false);
      expect(isPublicSitemapRoute("/resend-verification")).toBe(false);
    });

    it("filters out dynamic parameterized routes", () => {
      expect(isPublicSitemapRoute("/chats/[id]")).toBe(false);
      expect(isPublicSitemapRoute("/invite/[token]")).toBe(false);
      expect(isPublicSitemapRoute("/blog/[slug]")).toBe(false);
    });

    it("filters out redirect aliases", () => {
      expect(isPublicSitemapRoute("/aup")).toBe(false);
      expect(isPublicSitemapRoute("/trust")).toBe(false);
      expect(isPublicSitemapRoute("/contact")).toBe(false);
      expect(isPublicSitemapRoute("/cancellation")).toBe(false);
    });
  });

  describe("getRoutePolicy", () => {
    it("returns expected SEO weights per route tier", () => {
      expect(getRoutePolicy("/")).toEqual({ priority: 1.0, changeFrequency: "weekly" });
      expect(getRoutePolicy("/pricing")).toEqual({ priority: 0.8, changeFrequency: "weekly" });
      expect(getRoutePolicy("/about")).toEqual({ priority: 0.7, changeFrequency: "monthly" });
      expect(getRoutePolicy("/docs")).toEqual({ priority: 0.7, changeFrequency: "weekly" });
      expect(getRoutePolicy("/changelog")).toEqual({ priority: 0.6, changeFrequency: "weekly" });
      expect(getRoutePolicy("/terms")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/privacy")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/acceptable-use")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/security")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/subprocessors")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/cookies")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
      expect(getRoutePolicy("/refund")).toEqual({ priority: 0.3, changeFrequency: "monthly" });
    });

    it("assigns reasonable defaults for unknown new public routes", () => {
      expect(getRoutePolicy("/new-feature")).toEqual({
        priority: 0.5,
        changeFrequency: "monthly",
      });
    });
  });

  describe("sitemap() execution", () => {
    it("dynamically generates full sitemap array from codebase files", () => {
      const entries = sitemap();
      expect(entries.length).toBeGreaterThanOrEqual(10);

      const urls = entries.map((e) => e.url);

      // Verify essential public URLs are present
      expect(urls.some((u) => u.endsWith("/") || u === "https://chat2sell.in")).toBe(true);
      expect(urls.some((u) => u.includes("/pricing"))).toBe(true);
      expect(urls.some((u) => u.includes("/about"))).toBe(true);
      expect(urls.some((u) => u.includes("/docs"))).toBe(true);
      expect(urls.some((u) => u.includes("/changelog"))).toBe(true);
      expect(urls.some((u) => u.includes("/acceptable-use"))).toBe(true);
      expect(urls.some((u) => u.includes("/security"))).toBe(true);
      expect(urls.some((u) => u.includes("/subprocessors"))).toBe(true);
      expect(urls.some((u) => u.includes("/terms"))).toBe(true);
      expect(urls.some((u) => u.includes("/privacy"))).toBe(true);
      expect(urls.some((u) => u.includes("/cookies"))).toBe(true);
      expect(urls.some((u) => u.includes("/support"))).toBe(true);

      // Verify protected routes are absent
      expect(urls.some((u) => u.includes("/chats"))).toBe(false);
      expect(urls.some((u) => u.includes("/dashboard"))).toBe(false);
      expect(urls.some((u) => u.includes("/api"))).toBe(false);
      expect(urls.some((u) => u.includes("/invite"))).toBe(false);
      expect(urls.some((u) => u.includes("[id]"))).toBe(false);
      expect(urls.some((u) => u.includes("[token]"))).toBe(false);

      // Verify timestamps are genuine Date objects
      for (const entry of entries) {
        expect(entry.lastModified).toBeInstanceOf(Date);
        expect(entry.priority).toBeGreaterThan(0);
        expect(entry.priority).toBeLessThanOrEqual(1.0);
        expect(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).toContain(
          entry.changeFrequency
        );
      }

      // Verify entries are sorted deterministically with highest priority first
      for (let i = 0; i < entries.length - 1; i++) {
        const current = entries[i].priority ?? 0.5;
        const next = entries[i + 1].priority ?? 0.5;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it("verifies fallback catalog completeness", () => {
      expect(CORE_SITEMAP_FALLBACK_ROUTES.length).toBeGreaterThanOrEqual(10);
      expect(CORE_SITEMAP_FALLBACK_ROUTES).toContain("/");
      expect(CORE_SITEMAP_FALLBACK_ROUTES).toContain("/pricing");
      expect(CORE_SITEMAP_FALLBACK_ROUTES).toContain("/security");
      expect(CORE_SITEMAP_FALLBACK_ROUTES).toContain("/acceptable-use");
      expect(CORE_SITEMAP_FALLBACK_ROUTES).toContain("/subprocessors");
    });
  });
});
