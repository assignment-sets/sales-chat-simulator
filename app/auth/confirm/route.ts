import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { INVITATION_INTENT_COOKIE_NAME } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "";

  let targetPath = rawNext;
  const cookieStore = await cookies();
  if (!targetPath || targetPath === "/chats") {
    const intentToken = cookieStore.get(INVITATION_INTENT_COOKIE_NAME)?.value?.trim();
    if (intentToken) {
      targetPath = `/invite/${encodeURIComponent(intentToken)}`;
    }
  }

  // Sanitize next redirect target to prevent open-redirect vulnerabilities
  const isSafeRelativeUrl = targetPath.startsWith("/") && !targetPath.startsWith("//");
  const next = isSafeRelativeUrl ? targetPath : "/chats";

  if (next.startsWith("/invite/")) {
    cookieStore.delete(INVITATION_INTENT_COOKIE_NAME);
  }

  const supabase = await createServerSupabaseClient();

  // 1. Handle token_hash (email OTP verification links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error) {
      // Auto-claim any pending invitations on confirmed signup or invite (unless heading to specific token page)
      if ((type === "signup" || type === "invite") && !next.startsWith("/invite/")) {
        try {
          await supabase.rpc("claim_pending_org_invitations");
        } catch {
          // Non-fatal if table or function is pending migration
        }
      }

      // For password recovery, route to the password reset page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[AuthConfirm] verifyOtp failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Verification link is invalid or has expired")}`
    );
  }

  // 2. Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!next.startsWith("/invite/")) {
        try {
          await supabase.rpc("claim_pending_org_invitations");
        } catch {
          // Non-fatal
        }
      }

      if (rawNext === "/reset-password") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[AuthConfirm] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Authentication link is invalid or has expired")}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Missing verification parameters")}`
  );
}
