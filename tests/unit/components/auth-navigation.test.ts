import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";
import ResendVerificationPage from "@/app/resend-verification/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Authentication Pages Navigation & Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AuthPageShell Component", () => {
    it("renders PublicHeader, Back to home link, card content, and PublicFooter", () => {
      const html = renderToString(
        React.createElement(
          AuthPageShell,
          null,
          React.createElement("div", null, "Auth Form Content")
        )
      );

      // Verify header with logo and navigation links
      expect(html).toContain("Chat2Sell");
      expect(html).toContain('href="/pricing"');
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/changelog"');

      // Verify back link
      expect(html).toContain("Back to home");
      expect(html).toContain('href="/"');

      // Verify children content rendered in card
      expect(html).toContain("Auth Form Content");

      // Verify footer rendered
      expect(html).toContain("Terms of Service");
      expect(html).toContain("Privacy Policy");
      expect(html).toContain("Support &amp; Help");
    });

    it("respects custom backHref, backLabel, and maxWidth", () => {
      const html = renderToString(
        React.createElement(
          AuthPageShell,
          {
            maxWidth: "md",
            backHref: "/pricing",
            backLabel: "Return to Pricing",
          },
          React.createElement("div", null, "Custom Shell Content")
        )
      );

      expect(html).toContain("max-w-md");
      expect(html).toContain("Return to Pricing");
      expect(html).toContain('href="/pricing"');
      expect(html).toContain("Custom Shell Content");
    });
  });

  describe("Auth Pages Integration", () => {
    it("LoginPage renders within AuthPageShell with header, footer, back link, and clickable logo", () => {
      const html = renderToString(React.createElement(LoginPage));

      expect(html).toContain("Back to home");
      expect(html).toContain("Welcome back");
      expect(html).toContain('href="/pricing"');
      expect(html).toContain('title="Chat2Sell Home"');
      expect(html).toContain("Continue with Google");
      expect(html).toContain("or continue with email");
    });

    it("RegisterPage renders within AuthPageShell with header, footer, and navigation", () => {
      const html = renderToString(React.createElement(RegisterPage));

      expect(html).toContain("Back to home");
      expect(html).toContain("Create your account");
      expect(html).toContain('href="/pricing"');
      expect(html).toContain("Sign up with Google");
      expect(html).toContain("or register with email");
    });

    it("ForgotPasswordPage renders within AuthPageShell with header, footer, and navigation", () => {
      const html = renderToString(React.createElement(ForgotPasswordPage));

      expect(html).toContain("Back to home");
      expect(html).toContain("Reset your password");
      expect(html).toContain("Back to sign in");
    });

    it("ResetPasswordPage renders within AuthPageShell with header, footer, and navigation", () => {
      const html = renderToString(React.createElement(ResetPasswordPage));

      expect(html).toContain("Back to home");
      expect(html).toContain("Set new password");
      expect(html).toContain("Back to sign in");
    });

    it("ResendVerificationPage renders within AuthPageShell with header, footer, and navigation", () => {
      const html = renderToString(React.createElement(ResendVerificationPage));

      expect(html).toContain("Back to home");
      expect(html).toContain("Resend verification");
      expect(html).toContain("Back to sign in");
    });
  });
});
