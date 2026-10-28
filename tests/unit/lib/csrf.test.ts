import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCsrf } from "@/lib/security/csrf";

describe("CSRF Defense (lib/security/csrf.ts)", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://saleschat.io";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  describe("HTTP Method Filtering", () => {
    it("allows safe GET requests unconditionally", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "GET",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://evil.com",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("allows safe HEAD requests unconditionally", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "HEAD",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://evil.com",
        },
      });
      expect(verifyCsrf(req).valid).toBe(true);
    });

    it("allows safe OPTIONS requests unconditionally", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "OPTIONS",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://evil.com",
        },
      });
      expect(verifyCsrf(req).valid).toBe(true);
    });
  });

  describe("Sec-Fetch-Site Validation", () => {
    it("blocks mutating requests with sec-fetch-site: cross-site", () => {
      const req = new Request("http://localhost:3000/api/organizations/switch", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Cross-site request blocked");
    });

    it("allows mutating requests with sec-fetch-site: same-origin", () => {
      const req = new Request("http://localhost:3000/api/organizations/switch", {
        method: "POST",
        headers: {
          "sec-fetch-site": "same-origin",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("allows mutating requests with sec-fetch-site: same-site", () => {
      const req = new Request("https://saleschat.io/api/organizations/switch", {
        method: "POST",
        headers: {
          "sec-fetch-site": "same-site",
          origin: "https://saleschat.io",
          host: "saleschat.io",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Origin Header Validation", () => {
    it("blocks request when Origin host does not match request Host", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          origin: "https://attacker-website.com",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Origin mismatch");
    });

    it("allows request when Origin host matches request Host header", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("allows request when Origin host matches x-forwarded-host header", () => {
      const req = new Request("https://internal-proxy:8080/api/chats", {
        method: "POST",
        headers: {
          origin: "https://saleschat.io",
          "x-forwarded-host": "saleschat.io",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("allows request when Origin host matches NEXT_PUBLIC_APP_URL host", () => {
      const req = new Request("http://10.0.0.1/api/chats", {
        method: "POST",
        headers: {
          origin: "https://saleschat.io",
          host: "10.0.0.1",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("blocks request with malformed Origin header", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          origin: "not-a-valid-url::80",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Malformed origin header");
    });
  });

  describe("Referer Header Fallback", () => {
    it("blocks request when Origin is missing but Referer host mismatches", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          referer: "https://evil-phishing.com/click-here",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Referer mismatch");
    });

    it("allows request when Origin is missing but Referer matches host", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          referer: "http://localhost:3000/dashboard",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });

    it("blocks request with malformed Referer header", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          referer: "invalid-url",
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Malformed referer header");
    });
  });

  describe("Direct & Server-to-Server Requests", () => {
    it("allows requests without Origin or Referer when Sec-Fetch-Site is not cross-site", () => {
      const req = new Request("http://localhost:3000/api/chats", {
        method: "POST",
        headers: {
          host: "localhost:3000",
        },
      });
      const result = verifyCsrf(req);
      expect(result.valid).toBe(true);
    });
  });
});
