import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupMockAuth } from "../../utils/mock-supabase";
import { login, signup, logout } from "@/app/auth/actions";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockRevalidatePath = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

describe("app/auth/actions.ts", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockRevalidatePath.mockClear();
  });

  describe("login action", () => {
    it("redirects with error if email or password is missing", async () => {
      setupMockAuth();
      const formData = new FormData();
      formData.set("email", "test@saleschat.io");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/login?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Please enter email and password"))
      );
    });

    it("redirects with error if signInWithPassword fails", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Invalid credentials" },
      });

      const formData = new FormData();
      formData.set("email", "bad@saleschat.io");
      formData.set("password", "wrongpass");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/login?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Invalid email or password"))
      );
    });

    it("invokes claim_pending_org_invitations with ZERO arguments on successful login", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-123", email: "legit@saleschat.io" },
          session: { access_token: "mock-jwt" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "legit@saleschat.io");
      formData.set("password", "correctpass");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");

      // Verify RPC was invoked with ZERO arguments (no client-provided user_id or user_email)
      expect(mockClient.rpc).toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockClient.rpc).not.toHaveBeenCalledWith(
        "claim_pending_org_invitations",
        expect.anything()
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
      expect(mockRedirect).toHaveBeenCalledWith("/chats");
    });

    it("gracefully continues to /chats if claim_pending_org_invitations RPC throws", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-123", email: "legit@saleschat.io" },
          session: { access_token: "mock-jwt" },
        },
        error: null,
      });
      mockClient.rpc = vi.fn().mockRejectedValue(new Error("RPC migration pending"));

      const formData = new FormData();
      formData.set("email", "legit@saleschat.io");
      formData.set("password", "correctpass");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");
      expect(mockRedirect).toHaveBeenCalledWith("/chats");
    });
  });

  describe("signup action", () => {
    it("redirects with error if email or password is missing", async () => {
      setupMockAuth();
      const formData = new FormData();
      formData.set("email", "test@saleschat.io");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/register?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Please enter email and password"))
      );
    });

    it("redirects with error if signUp fails", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Account already registered for this email" },
      });

      const formData = new FormData();
      formData.set("email", "existing@saleschat.io");
      formData.set("password", "password123");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/register?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Account already exists for this email"))
      );
    });

    it("invokes claim_pending_org_invitations with ZERO arguments on immediate session creation", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "new-user-456", email: "newuser@saleschat.io" },
          session: { access_token: "mock-session" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "newuser@saleschat.io");
      formData.set("password", "securepassword");
      formData.set("fullName", "New User");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");

      // Verify RPC was invoked with ZERO arguments
      expect(mockClient.rpc).toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockClient.rpc).not.toHaveBeenCalledWith(
        "claim_pending_org_invitations",
        expect.anything()
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
      expect(mockRedirect).toHaveBeenCalledWith("/chats");
    });

    it("redirects to login when email confirmation is required without invoking claim_pending_org_invitations", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "unconfirmed-user", email: "unconfirmed@saleschat.io" },
          session: null, // No session until email verified
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "unconfirmed@saleschat.io");
      formData.set("password", "securepassword");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/login?message=");
      expect(mockClient.rpc).not.toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Account created! You can now sign in."))
      );
    });
  });

  describe("logout action", () => {
    it("signs out and redirects to /login", async () => {
      const { mockClient } = setupMockAuth();

      await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });
});
