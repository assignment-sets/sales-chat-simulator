import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/auth/confirm/route";
import { setupMockAuth } from "../../utils/mock-supabase";
import { type NextRequest } from "next/server";

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles token_hash for signup and auto-claims org invitations", async () => {
    const { mockClient } = setupMockAuth();
    mockClient.auth.verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "confirmed-user" }, session: {} },
      error: null,
    });

    const req = new Request(
      "http://localhost:3000/auth/confirm?token_hash=valid-hash&type=signup&next=/dashboard"
    ) as NextRequest;

    const res = await GET(req);
    expect(mockClient.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-hash",
      type: "signup",
    });
    expect(mockClient.rpc).toHaveBeenCalledWith("claim_pending_org_invitations");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("handles token_hash for password recovery and redirects to /reset-password", async () => {
    const { mockClient } = setupMockAuth();
    mockClient.auth.verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "reset-user" }, session: {} },
      error: null,
    });

    const req = new Request(
      "http://localhost:3000/auth/confirm?token_hash=recovery-hash&type=recovery"
    ) as NextRequest;

    const res = await GET(req);
    expect(mockClient.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "recovery-hash",
      type: "recovery",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/reset-password");
  });

  it("redirects to login with error when verifyOtp fails", async () => {
    const { mockClient } = setupMockAuth();
    mockClient.auth.verifyOtp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Token has expired" },
    });

    const req = new Request(
      "http://localhost:3000/auth/confirm?token_hash=expired-hash&type=signup"
    ) as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("handles PKCE code exchange successfully", async () => {
    const { mockClient } = setupMockAuth();
    mockClient.auth.exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { user: { id: "pkce-user" }, session: {} },
      error: null,
    });

    const req = new Request(
      "http://localhost:3000/auth/confirm?code=pkce-auth-code&next=/chats"
    ) as NextRequest;

    const res = await GET(req);
    expect(mockClient.auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-auth-code");
    expect(mockClient.rpc).toHaveBeenCalledWith("claim_pending_org_invitations");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/chats");
  });

  it("redirects open-redirect attempts to safe default /chats", async () => {
    const { mockClient } = setupMockAuth();
    mockClient.auth.verifyOtp = vi.fn().mockResolvedValue({
      data: { user: { id: "user" }, session: {} },
      error: null,
    });

    const req = new Request(
      "http://localhost:3000/auth/confirm?token_hash=valid-hash&type=signup&next=https://malicious.com"
    ) as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/chats");
  });

  it("redirects to login when no verification parameters are passed", async () => {
    setupMockAuth();

    const req = new Request("http://localhost:3000/auth/confirm") as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=");
  });
});
