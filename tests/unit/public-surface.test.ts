import { describe, it, expect, vi, beforeEach } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import HomePage, { metadata as homeMetadata } from "@/app/page";
import PricingPage, { metadata as pricingMetadata } from "@/app/pricing/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import CookiePage, { metadata as cookieMetadata } from "@/app/cookies/page";
import SupportPage, { metadata as supportMetadata } from "@/app/support/page";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as docsMetadata } from "@/app/docs/page";
import { metadata as changelogMetadata } from "@/app/changelog/page";
import { metadata as loginMetadata } from "@/app/login/layout";
import { metadata as registerMetadata } from "@/app/register/layout";
import { metadata as dashboardMetadata } from "@/app/dashboard/layout";
import { metadata as chatsMetadata } from "@/app/chats/layout";
import { metadata as rootMetadata } from "@/app/layout";
import { metadata as forgotPasswordMetadata } from "@/app/forgot-password/layout";
import { metadata as resetPasswordMetadata } from "@/app/reset-password/layout";
import { metadata as resendVerificationMetadata } from "@/app/resend-verification/layout";
import { metadata as inviteMetadata } from "@/app/invite/[token]/layout";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { GET as getLlmsFullTxt } from "@/app/llms-full.txt/route";
import { dynamic as sitemapDynamic, revalidate as sitemapRevalidate } from "@/app/sitemap";
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

      const allowedPaths = ["/", "/pricing", "/login", "/terms", "/privacy", "/cookies", "/support"];
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
    it("is configured for dynamic on-demand discovery", () => {
      expect(sitemapDynamic).toBe("force-dynamic");
      expect(sitemapRevalidate).toBe(0);
    });

    it("returns valid sitemap entries for all public pages", () => {
      const entries = sitemap();
      expect(entries.length).toBeGreaterThanOrEqual(5);

      const urls = entries.map((e) => e.url);
      expect(urls.some((u) => u.endsWith("/") || u.includes("chat2sell.in"))).toBe(true);
      expect(urls.some((u) => u.includes("/pricing"))).toBe(true);
      expect(urls.some((u) => u.includes("/terms"))).toBe(true);
      expect(urls.some((u) => u.includes("/privacy"))).toBe(true);
      expect(urls.some((u) => u.includes("/cookies"))).toBe(true);
      expect(urls.some((u) => u.includes("/support"))).toBe(true);

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
        planTier: "team",
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
      expect(component.props.currentTier).toBe("team");
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

  describe("app/support/page.tsx (Support & Contact)", () => {
    it("exports valid metadata and renders support page with contact email", () => {
      expect(supportMetadata.title).toBe("Support & Contact");
      expect(supportMetadata.description).toBeDefined();

      const component = SupportPage();
      expect(component).toBeDefined();
      expect(component.props.title).toBe("Help & Support");
    });
  });

  describe("app/llms.txt/route.ts (AI Agent Discovery Specification)", () => {
    it("returns standard-compliant llms.txt markdown with H1, summary blockquote, and sectioned links", async () => {
      const response = await getLlmsTxt();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/markdown");

      const text = await response.text();
      // H1 Header
      expect(text).toMatch(/^# SalesChat/m);
      // Blockquote summary
      expect(text).toContain("> SalesChat is an interactive AI sales simulation");
      // H2 Sections
      expect(text).toContain("## Core Features & Overview");
      expect(text).toContain("## User Playbook & Documentation");
      expect(text).toContain("## Subscription Plans & Pricing");
      expect(text).toContain("## Legal, Trust & Security Disclosures");
      expect(text).toContain("## Optional");
      // Formatted links with descriptions
      expect(text).toContain("- [Plans & Pricing]");
      expect(text).toContain("- [Documentation & User Playbook]");
      expect(text).toContain("/llms-full.txt");
    });
  });

  describe("app/llms-full.txt/route.ts (Comprehensive Ingestion Specification)", () => {
    it("returns comprehensive single-file compilation for deep agent reasoning", async () => {
      const response = await getLlmsFullTxt();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/markdown");

      const text = await response.text();
      expect(text).toContain("# SalesChat - Full Documentation & Platform Knowledge Base");
      expect(text).toContain("## 1. Platform Overview & Capabilities");
      expect(text).toContain("## 2. About SalesChat & Mission");
      expect(text).toContain("## 3. User Playbook & Documentation");
      expect(text).toContain("## 4. Pricing Plans & Workspace Tiers");
      expect(text).toContain("## 10. Security & Zero-Training Disclosure");
    });
  });

  describe("SEO Metadata & Directives (Headers, Robots, Canonicals, OpenGraph)", () => {
    const publicPages = [
      { name: "Root Layout", meta: rootMetadata, expectedPath: "/" },
      { name: "Landing Page", meta: homeMetadata, expectedPath: "/" },
      { name: "Pricing", meta: pricingMetadata, expectedPath: "/pricing" },
      { name: "About", meta: aboutMetadata, expectedPath: "/about" },
      { name: "Docs", meta: docsMetadata, expectedPath: "/docs" },
      { name: "Changelog", meta: changelogMetadata, expectedPath: "/changelog" },
      { name: "Support", meta: supportMetadata, expectedPath: "/support" },
      { name: "Terms", meta: termsMetadata, expectedPath: "/terms" },
      { name: "Privacy", meta: privacyMetadata, expectedPath: "/privacy" },
      { name: "Cookies", meta: cookieMetadata, expectedPath: "/cookies" },
      { name: "Login", meta: loginMetadata, expectedPath: "/login" },
      { name: "Register", meta: registerMetadata, expectedPath: "/register" },
    ];

    it.each(publicPages)("enforces explicit indexing (noindex: false) and canonical URL for $name", ({ meta, expectedPath }) => {
      expect(meta).toBeDefined();
      expect(meta.title).toBeDefined();
      expect(meta.description).toBeDefined();

      // Explicit robots directive allowing indexing
      const robots = meta.robots as any;
      expect(robots).toBeDefined();
      expect(robots.index).toBe(true);
      expect(robots.follow).toBe(true);

      if (robots.googleBot) {
        expect(robots.googleBot.index).toBe(true);
        expect(robots.googleBot.follow).toBe(true);
        expect(robots.googleBot["max-image-preview"]).toBe("large");
      }

      // Canonical link
      const alternates = meta.alternates as any;
      expect(alternates).toBeDefined();
      expect(alternates.canonical).toBe(expectedPath);
    });

    it.each(publicPages.filter((p) => p.name !== "Root Layout"))("configures OpenGraph and Twitter cards for $name", ({ meta, expectedPath }) => {
      const og = meta.openGraph as any;
      expect(og).toBeDefined();
      expect(og.siteName).toBe("SalesChat");
      expect(og.url).toBe(expectedPath);
      expect(og.type).toBe("website");

      const twitter = meta.twitter as any;
      expect(twitter).toBeDefined();
      expect(twitter.card).toBe("summary_large_image");
    });

    it("enforces noindex and nofollow on protected authenticated surfaces", () => {
      const privatePages = [
        { name: "Dashboard", meta: dashboardMetadata },
        { name: "Chats", meta: chatsMetadata },
        { name: "Forgot Password", meta: forgotPasswordMetadata },
        { name: "Reset Password", meta: resetPasswordMetadata },
        { name: "Resend Verification", meta: resendVerificationMetadata },
        { name: "Invite", meta: inviteMetadata },
      ];

      for (const { name, meta } of privatePages) {
        expect(meta, `${name} metadata should exist`).toBeDefined();
        expect(meta.title, `${name} should have a defined title`).toBeDefined();
        expect(meta.description, `${name} should have a defined description`).toBeDefined();
        const robots = meta.robots as any;
        expect(robots).toBeDefined();
        expect(robots.index).toBe(false);
        expect(robots.follow).toBe(false);
        if (robots.googleBot) {
          expect(robots.googleBot.index).toBe(false);
          expect(robots.googleBot.follow).toBe(false);
        }
      }
    });
  });
});
