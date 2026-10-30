"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ACTIVE_ORG_COOKIE_NAME, INVITATION_INTENT_COOKIE_NAME } from "@/lib/tenant";

function sanitizeRedirect(url: string | null | undefined): string {
  if (!url) return "/chats";
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url;
  }
  return "/chats";
}

function buildAuthRedirectUrl(
  path: "/login" | "/register",
  params: { error?: string; message?: string; next?: string | null; email?: string | null }
): string {
  const parts: string[] = [];
  if (params.error) parts.push(`error=${encodeURIComponent(params.error)}`);
  if (params.message) parts.push(`message=${encodeURIComponent(params.message)}`);
  if (params.next && params.next !== "/chats") parts.push(`next=${encodeURIComponent(params.next)}`);
  if (params.email) parts.push(`email=${encodeURIComponent(params.email)}`);
  return parts.length > 0 ? `${path}?${parts.join("&")}` : path;
}

async function getClientIp(): Promise<string> {
  try {
    const reqHeaders = await headers();
    if (!reqHeaders) return "127.0.0.1";
    const forwarded = reqHeaders.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return reqHeaders.get("x-real-ip") || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

async function getRequestOrigin(): Promise<string> {
  try {
    const reqHeaders = await headers();
    const host = reqHeaders?.get("x-forwarded-host") || reqHeaders?.get("host");
    const proto =
      reqHeaders?.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // fallback
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function login(formData: FormData) {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = formData.get("password") as string;
  const rawNext = (formData.get("next") as string)?.trim() || null;

  if (!email || !password) {
    redirect(
      buildAuthRedirectUrl("/login", {
        error: "Please enter email and password",
        next: rawNext,
        email,
      })
    );
  }

  const clientIp = await getClientIp();
  const ipLimit = await enforceRateLimit("auth.login.ip", `ip:${clientIp}`);
  if (!ipLimit.ok) {
    redirect(
      buildAuthRedirectUrl("/login", {
        error: "Too many sign-in attempts. Please try again in a few moments.",
        next: rawNext,
        email,
      })
    );
  }

  const emailLimit = await enforceRateLimit("auth.login.email", `email:${email.toLowerCase()}`);
  if (!emailLimit.ok) {
    redirect(
      buildAuthRedirectUrl("/login", {
        error: "Too many sign-in attempts for this account. Please try again later or reset your password.",
        next: rawNext,
        email,
      })
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    let msg = "Invalid email or password";
    if (error.message.toLowerCase().includes("email not confirmed")) {
      msg = "Please verify your email address. You can resend the link below.";
    }
    redirect(
      buildAuthRedirectUrl("/login", {
        error: msg,
        next: rawNext,
        email,
      })
    );
  }

  let nextTarget = sanitizeRedirect(rawNext);

  // If next is default, check for short-lived intent cookie
  const cookieStore = await cookies();
  if (nextTarget === "/chats") {
    const intentToken = cookieStore.get(INVITATION_INTENT_COOKIE_NAME)?.value?.trim();
    if (intentToken) {
      nextTarget = `/invite/${encodeURIComponent(intentToken)}`;
    }
  }

  if (nextTarget.startsWith("/invite/")) {
    cookieStore.delete(INVITATION_INTENT_COOKIE_NAME);
  } else if (data?.user) {
    // Only auto-claim and delete invitations if NOT navigating directly to an invite acceptance page
    try {
      await supabase.rpc("claim_pending_org_invitations");
    } catch {
      // Non-fatal if table or function is pending migration
    }
  }

  revalidatePath("/", "layout");
  redirect(nextTarget);
}

export async function signup(formData: FormData) {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = formData.get("password") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const rawNext = (formData.get("next") as string)?.trim() || null;

  if (!email || !password) {
    redirect(
      buildAuthRedirectUrl("/register", {
        error: "Please enter email and password",
        next: rawNext,
        email,
      })
    );
  }

  const clientIp = await getClientIp();
  const ipLimit = await enforceRateLimit("auth.signup.ip", `ip:${clientIp}`);
  if (!ipLimit.ok) {
    redirect(
      buildAuthRedirectUrl("/register", {
        error: "Too many accounts created from this network. Please try again later.",
        next: rawNext,
        email,
      })
    );
  }

  const defaultName = fullName || email.split("@")[0];
  const origin = await getRequestOrigin();
  let nextTarget = sanitizeRedirect(rawNext);

  const cookieStore = await cookies();
  if (nextTarget === "/chats") {
    const intentToken = cookieStore.get(INVITATION_INTENT_COOKIE_NAME)?.value?.trim();
    if (intentToken) {
      nextTarget = `/invite/${encodeURIComponent(intentToken)}`;
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: defaultName,
        name: defaultName,
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(nextTarget)}`,
    },
  });

  if (error) {
    let msg = error.message;
    if (msg.toLowerCase().includes("already registered")) {
      msg = "Account already exists for this email";
    } else if (msg.toLowerCase().includes("at least 6 characters")) {
      msg = "Password must be at least 6 characters";
    }
    redirect(
      buildAuthRedirectUrl("/register", {
        error: msg,
        next: rawNext,
        email,
      })
    );
  }

  // If user session is created immediately (e.g. autoconfirm enabled)
  if (data?.session && data.user) {
    if (nextTarget.startsWith("/invite/")) {
      cookieStore.delete(INVITATION_INTENT_COOKIE_NAME);
    } else {
      try {
        await supabase.rpc("claim_pending_org_invitations");
      } catch {
        // Non-fatal
      }
    }

    revalidatePath("/", "layout");
    redirect(nextTarget);
  }

  // If email confirmation is required
  redirect(
    buildAuthRedirectUrl("/login", {
      message: "Account created! You can now sign in.",
      next: rawNext,
      email,
    })
  );
}

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();

  if (!email) {
    redirect("/forgot-password?error=" + encodeURIComponent("Please enter your email address"));
  }

  const clientIp = await getClientIp();
  const ipLimit = await enforceRateLimit("auth.reset.ip", `ip:${clientIp}`);
  if (!ipLimit.ok) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("Too many password reset requests. Please try again in 15 minutes.")
    );
  }

  const origin = await getRequestOrigin();
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    console.error("[Auth] resetPasswordForEmail error:", error.message);
  }

  // Always redirect with a generic message to prevent email enumeration
  redirect(
    "/login?message=" +
      encodeURIComponent("If an account exists with this email, a password reset link has been sent.")
  );
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    redirect("/reset-password?error=" + encodeURIComponent("Please fill in all password fields"));
  }

  if (password.length < 6) {
    redirect("/reset-password?error=" + encodeURIComponent("Password must be at least 6 characters"));
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=" + encodeURIComponent("Passwords do not match"));
  }

  const clientIp = await getClientIp();
  const ipLimit = await enforceRateLimit("auth.password_update.ip", `ip:${clientIp}`);
  if (!ipLimit.ok) {
    redirect(
      "/reset-password?error=" +
        encodeURIComponent("Too many password update attempts. Please try again later.")
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      "/login?error=" +
        encodeURIComponent("Your password reset session has expired. Please request a new link.")
    );
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/chats?message=" + encodeURIComponent("Password updated successfully!"));
}

export async function resendVerificationEmail(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();

  if (!email) {
    redirect("/resend-verification?error=" + encodeURIComponent("Please enter your email address"));
  }

  const clientIp = await getClientIp();
  const ipLimit = await enforceRateLimit("auth.verify.ip", `ip:${clientIp}`);
  if (!ipLimit.ok) {
    redirect(
      "/resend-verification?error=" +
        encodeURIComponent("Too many verification requests. Please try again in 15 minutes.")
    );
  }

  const origin = await getRequestOrigin();
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    console.error("[Auth] resend error:", error.message);
  }

  // Generic message to avoid email enumeration
  redirect(
    "/login?message=" +
      encodeURIComponent("If your email is registered and unverified, a new verification link has been sent.")
  );
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_ORG_COOKIE_NAME);
  } catch {
    // Safe fallback if cookies() context is unavailable
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateProfile(fullName: string) {
  const cleanName = fullName.trim();
  if (!cleanName) {
    return { success: false, error: "Full name cannot be empty" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: cleanName,
      name: cleanName,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
