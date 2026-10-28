import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: vi.fn(async () => {
    return NextResponse.next();
  }),
}));

describe("Proxy Request Interceptor (proxy.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks mutating API requests when Sec-Fetch-Site is cross-site", async () => {
    const req = new NextRequest("http://localhost:3000/api/organizations/switch", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
        origin: "https://evil.com",
        host: "localhost:3000",
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error.code).toBe("FORBIDDEN");
    expect(json.error.message).toBe("Cross-site request forbidden");
  });

  it("blocks mutating API requests when Origin mismatches Host", async () => {
    const req = new NextRequest("http://localhost:3000/api/chats", {
      method: "POST",
      headers: {
        origin: "https://unauthorized-origin.com",
        host: "localhost:3000",
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("allows same-origin mutating API requests through to updateSession", async () => {
    const req = new NextRequest("http://localhost:3000/api/chats", {
      method: "POST",
      headers: {
        "sec-fetch-site": "same-origin",
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(200);
  });

  it("allows GET requests to pass through without CSRF enforcement", async () => {
    const req = new NextRequest("http://localhost:3000/api/chats", {
      method: "GET",
      headers: {
        "sec-fetch-site": "cross-site",
      },
    });

    const response = await proxy(req);
    expect(response.status).toBe(200);
  });

  it("allows non-API page routes to pass through to updateSession", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      method: "GET",
    });

    const response = await proxy(req);
    expect(response.status).toBe(200);
  });
});
