import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupMockAuth } from "../../utils/mock-supabase";
import {
  login,
  signup,
  logout,
  requestPasswordReset,
  updatePassword,
  resendVerificationEmail,
} from "@/app/auth/actions";
import * as rateLimitModule from "@/lib/rate-limit";

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

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
};

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers({
        host: "localhost:3000",
        "x-forwarded-for": "203.0.113.195",
      })
    ),
  cookies: () => Promise.resolve(mockCookieStore),
}));

describe("app/auth/actions.ts", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockRevalidatePath.mockClear();
    mockCookieStore.get.mockReset();
    mockCookieStore.set.mockReset();
    mockCookieStore.delete.mockReset();
    vi.spyOn(rateLimitModule, "enforceRateLimit").mockResolvedValue({ ok: true });
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

    it("redirects with rate limit error when IP limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.login.ip") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("email", "spammer@saleschat.io");
      formData.set("password", "password123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/login?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many sign-in attempts"))
      );
    });

    it("redirects with rate limit error when account email limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.login.email") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("email", "target@saleschat.io");
      formData.set("password", "password123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/login?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many sign-in attempts for this account"))
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
          user: { id: "user-123", email: "rep@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "rep@saleschat.io");
      formData.set("password", "password123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");
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
          user: { id: "user-123", email: "rep@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });
      mockClient.rpc = vi.fn().mockRejectedValue(new Error("RPC failed or does not exist"));

      const formData = new FormData();
      formData.set("email", "rep@saleschat.io");
      formData.set("password", "password123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");
      expect(mockRedirect).toHaveBeenCalledWith("/chats");
    });

    it("redirects to next invite URL on login without calling claim_pending_org_invitations", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-123", email: "rep@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "rep@saleschat.io");
      formData.set("password", "password123");
      formData.set("next", "/invite/token-abc-123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/invite/token-abc-123");
      expect(mockClient.rpc).not.toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockRedirect).toHaveBeenCalledWith("/invite/token-abc-123");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("saleschat_pending_invite_token");
    });

    it("falls back to saleschat_pending_invite_token cookie when next is default", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: "user-123", email: "rep@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });

      mockCookieStore.get.mockReturnValue({ value: "cookie-token-999" });

      const formData = new FormData();
      formData.set("email", "rep@saleschat.io");
      formData.set("password", "password123");

      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT:/invite/cookie-token-999");
      expect(mockClient.rpc).not.toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockRedirect).toHaveBeenCalledWith("/invite/cookie-token-999");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("saleschat_pending_invite_token");
    });
  });

  describe("signup action", () => {
    it("redirects with error if email or password is missing", async () => {
      setupMockAuth();
      const formData = new FormData();
      formData.set("email", "new@saleschat.io");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/register?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Please enter email and password"))
      );
    });

    it("redirects with rate limit error when signup limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.signup.ip") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("email", "new@saleschat.io");
      formData.set("password", "securepassword");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/register?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many accounts created from this network"))
      );
    });

    it("redirects with error if signUp fails", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "User already registered" },
      });

      const formData = new FormData();
      formData.set("email", "exists@saleschat.io");
      formData.set("password", "securepassword");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/register?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Account already exists for this email"))
      );
    });

    it("invokes claim_pending_org_invitations with ZERO arguments on immediate session creation", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "new-user-123", email: "fresh@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "fresh@saleschat.io");
      formData.set("password", "securepassword");
      formData.set("fullName", "Fresh Rep");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/chats");
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

    it("redirects to next invite URL on signup session without calling claim_pending_org_invitations", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "new-user-123", email: "fresh@saleschat.io" },
          session: { access_token: "fake-jwt" },
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "fresh@saleschat.io");
      formData.set("password", "securepassword");
      formData.set("next", "/invite/token-signup-456");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/invite/token-signup-456");
      expect(mockClient.rpc).not.toHaveBeenCalledWith("claim_pending_org_invitations");
      expect(mockRedirect).toHaveBeenCalledWith("/invite/token-signup-456");
    });

    it("preserves next in emailRedirectTo and login redirect when confirmation is required", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "unconfirmed-user", email: "unconfirmed@saleschat.io" },
          session: null,
        },
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "unconfirmed@saleschat.io");
      formData.set("password", "securepassword");
      formData.set("next", "/invite/token-confirm-789");

      await expect(signup(formData)).rejects.toThrow("NEXT_REDIRECT:/login?message=");
      expect(mockClient.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: expect.stringContaining("next=%2Finvite%2Ftoken-confirm-789"),
          }),
        })
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("next=%2Finvite%2Ftoken-confirm-789")
      );
    });
  });

  describe("requestPasswordReset action", () => {
    it("redirects with error if email is missing", async () => {
      setupMockAuth();
      const formData = new FormData();

      await expect(requestPasswordReset(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/forgot-password?error="
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Please enter your email address"))
      );
    });

    it("redirects with rate limit error when reset request limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.reset.ip") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("email", "reset@saleschat.io");

      await expect(requestPasswordReset(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/forgot-password?error="
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many password reset requests"))
      );
    });

    it("calls resetPasswordForEmail and redirects to login with confirmation message", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "reset@saleschat.io");

      await expect(requestPasswordReset(formData)).rejects.toThrow("NEXT_REDIRECT:/login?message=");
      expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "reset@saleschat.io",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/confirm?next=/reset-password"),
        })
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("password reset link has been sent"))
      );
    });
  });

  describe("updatePassword action", () => {
    it("redirects with rate limit error when password update limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.password_update.ip") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("password", "newsecret123");
      formData.set("confirmPassword", "newsecret123");

      await expect(updatePassword(formData)).rejects.toThrow("NEXT_REDIRECT:/reset-password?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many password update attempts"))
      );
    });

    it("redirects with error if passwords do not match or are missing", async () => {
      setupMockAuth();
      const formData = new FormData();
      formData.set("password", "newsecret123");
      formData.set("confirmPassword", "mismatch123");

      await expect(updatePassword(formData)).rejects.toThrow("NEXT_REDIRECT:/reset-password?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Passwords do not match"))
      );
    });

    it("redirects with error if password is under 6 characters", async () => {
      setupMockAuth();
      const formData = new FormData();
      formData.set("password", "123");
      formData.set("confirmPassword", "123");

      await expect(updatePassword(formData)).rejects.toThrow("NEXT_REDIRECT:/reset-password?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Password must be at least 6 characters"))
      );
    });

    it("redirects with error if user session has expired", async () => {
      setupMockAuth(null);
      const formData = new FormData();
      formData.set("password", "newsecret123");
      formData.set("confirmPassword", "newsecret123");

      await expect(updatePassword(formData)).rejects.toThrow("NEXT_REDIRECT:/login?error=");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Your password reset session has expired"))
      );
    });

    it("updates password and redirects to /chats on success", async () => {
      const { mockClient } = setupMockAuth({ userId: "user-reset-123" });
      mockClient.auth.updateUser = vi.fn().mockResolvedValue({
        data: { user: { id: "user-reset-123" } },
        error: null,
      });

      const formData = new FormData();
      formData.set("password", "newsecret123");
      formData.set("confirmPassword", "newsecret123");

      await expect(updatePassword(formData)).rejects.toThrow("NEXT_REDIRECT:/chats?message=");
      expect(mockClient.auth.updateUser).toHaveBeenCalledWith({
        password: "newsecret123",
      });
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Password updated successfully!"))
      );
    });
  });

  describe("resendVerificationEmail action", () => {
    it("redirects with error if email is missing", async () => {
      setupMockAuth();
      const formData = new FormData();

      await expect(resendVerificationEmail(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/resend-verification?error="
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Please enter your email address"))
      );
    });

    it("redirects with rate limit error when resend limit is exceeded", async () => {
      setupMockAuth();
      vi.spyOn(rateLimitModule, "enforceRateLimit").mockImplementation(async (name) => {
        if (name === "auth.verify.ip") {
          return { ok: false, response: null as any };
        }
        return { ok: true };
      });

      const formData = new FormData();
      formData.set("email", "verify@saleschat.io");

      await expect(resendVerificationEmail(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/resend-verification?error="
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("Too many verification requests"))
      );
    });

    it("calls auth.resend and redirects to login with message", async () => {
      const { mockClient } = setupMockAuth();
      mockClient.auth.resend = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const formData = new FormData();
      formData.set("email", "verify@saleschat.io");

      await expect(resendVerificationEmail(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/login?message="
      );
      expect(mockClient.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "verify@saleschat.io",
        options: {
          emailRedirectTo: expect.stringContaining("/auth/confirm"),
        },
      });
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("verification link has been sent"))
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
