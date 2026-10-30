import { describe, it, expect, vi, beforeEach } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import HomePage from "@/app/page";
import PricingPage, { metadata as pricingMetadata } from "@/app/pricing/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import CookiePage, { metadata as cookieMetadata } from "@/app/cookies/page";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { setupMockAuth } from "../utils/mock-supabase";

const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT: ${url}`);
  (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw err;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Public Surface & SEO Infrastructure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockAuth(null);
  });

  describe("app/robots.ts", () => {
    it("returns correct crawl rules allowing public pages and disallowing protected app routes", () => {
      const result = robots();
      expect(result.rules).toBeDefined();

      const rulesArray = Array.isArray(result.rules) ? result.rules : [result.rules];
      expect(rulesArray.length).toBeGreaterThanOrEqual(2);

      // Verify AI Search / Citation bots rule
      const aiRule = rulesArray.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes("OAI-SearchBot"));
      expect(aiRule).toBeDefined();
      expect(aiRule?.userAgent).toContain("PerplexityBot");
      expect(aiRule?.userAgent).toContain("Claude-SearchBot");
      expect(aiRule?.userAgent).toContain("Applebot-Extended");

      // Verify general crawler wildcard rule
      const wildcardRule = rulesArray.find((r) => r.userAgent === "*");
      expect(wildcardRule).toBeDefined();

      const allowedPaths = ["/", "/pricing", "/login", "/terms", "/privacy", "/cookies"];
      for (const path of allowedPaths) {
        expect(wildcardRule?.allow).toContain(path);
      }

      const disallowedPaths = [
        "/api/",
        "/chats/",
        "/dashboard/",
        "/settings/",
        "/auth/",
        "/invite/",
        "/reset-password",
        "/forgot-password",
        "/resend-verification",
      ];
      for (const path of disallowedPaths) {
        expect(wildcardRule?.disallow).toContain(path);
      }

      expect(result.sitemap).toContain("/sitemap.xml");
      expect(result.host).toBeDefined();
    });
  });

  describe("app/sitemap.ts", () => {
    it("returns valid sitemap entries for all public pages", () => {
      const entries = sitemap();
      expect(entries.length).toBeGreaterThanOrEqual(5);

      const urls = entries.map((e) => e.url);
      expect(urls.some((u) => u.endsWith("/") || u.includes("saleschat.vercel.app"))).toBe(true);
      expect(urls.some((u) => u.includes("/pricing"))).toBe(true);
      expect(urls.some((u) => u.includes("/terms"))).toBe(true);
      expect(urls.some((u) => u.includes("/privacy"))).toBe(true);
      expect(urls.some((u) => u.includes("/cookies"))).toBe(true);

      const pricingEntry = entries.find((e) => e.url.includes("/pricing"));
      expect(pricingEntry?.priority).toBe(0.8);
      expect(pricingEntry?.changeFrequency).toBe("weekly");
    });
  });

  describe("app/page.tsx (Landing Page)", () => {
    it("redirects authenticated users immediately to /chats", async () => {
      setupMockAuth({ userId: "user-1", orgId: "org-1" });

      await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT: /chats");
      expect(mockRedirect).toHaveBeenCalledWith("/chats");
    });

    it("renders the public LandingHero when user is unauthenticated", async () => {
      setupMockAuth(null);

      const component = await HomePage();
      expect(component).toBeDefined();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("app/pricing/page.tsx (Public Pricing)", () => {
    it("renders public pricing view when user is unauthenticated without redirecting to /login", async () => {
      setupMockAuth(null);

      const component = await PricingPage();
      expect(component).toBeDefined();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(component.props.isAuthenticated).toBe(false);
      expect(component.props.organizationName).toBe("Public");
    });

    it("loads organization usage and renders authenticated pricing view when user is logged in", async () => {
      const { mockClient } = setupMockAuth({
        userId: "user-1",
        orgId: "org-1",
        planTier: "pro",
      });

      mockClient.from = vi.fn((tableName: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 12, error: null }),
        then: (onfulfilled: any) =>
          Promise.resolve({
            count: tableName === "chats" ? 12 : 3,
            error: null,
          }).then(onfulfilled),
      })) as any;

      const component = await PricingPage();
      expect(component).toBeDefined();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(component.props.organizationName).toBe("Acme Sales");
      expect(component.props.currentTier).toBe("pro");
      expect(pricingMetadata.title).toContain("Pricing");
    });
  });

  describe("app/terms/page.tsx (Terms of Service)", () => {
    it("exports valid metadata and renders terms with AI disclaimer", () => {
      expect(termsMetadata.title).toBe("Terms of Service");
      expect(termsMetadata.description).toBeDefined();

      const component = TermsPage();
      expect(component).toBeDefined();
      expect(component.props.title).toBe("Terms of Service");
    });
  });

  describe("app/privacy/page.tsx (Privacy Policy & Subprocessors)", () => {
    it("exports valid metadata and renders privacy policy with subprocessor disclosures", () => {
      expect(privacyMetadata.title).toBe("Privacy Policy");
      expect(privacyMetadata.description).toBeDefined();

      const component = PrivacyPage();
      expect(component).toBeDefined();
      expect(component.props.title).toBe("Privacy Policy");
    });
  });

  describe("app/cookies/page.tsx (Cookie Policy)", () => {
    it("exports valid metadata and renders cookie policy with essential cookie table", () => {
      expect(cookieMetadata.title).toBe("Cookie Policy");
      expect(cookieMetadata.description).toBeDefined();

      const component = CookiePage();
      expect(component).toBeDefined();
      expect(component.props.title).toBe("Cookie Policy");
    });
  });

  describe("app/llms.txt/route.ts (AI Agent Discovery Specification)", () => {
    it("returns clean markdown with H1 title, pricing, capabilities, and security pledges", async () => {
      const response = await getLlmsTxt();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/markdown");
      expect(response.headers.get("Cache-Control")).toContain("max-age=86400");

      const text = await response.text();
      expect(text).toContain("# SalesChat");
      expect(text).toContain("Overview & Core Capabilities");
      expect(text).toContain("Pricing Plans & Workspace Tiers");
      expect(text).toContain("Zero Foundation Model Training");
      expect(text).toContain("Canonical Public Links");
      expect(text).toContain("/pricing");
      expect(text).toContain("/terms");
      expect(text).toContain("/privacy");
      expect(text).toContain("/cookies");
    });
  });
});
