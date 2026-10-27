import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "";

  // Sanitize next redirect target to prevent open-redirect vulnerabilities
  const isSafeRelativeUrl = rawNext.startsWith("/") && !rawNext.startsWith("//");
  const next = isSafeRelativeUrl ? rawNext : "/chats";

  const supabase = await createServerSupabaseClient();

  // 1. Handle token_hash (email OTP verification links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error) {
      // Auto-claim any pending invitations on confirmed signup or invite
      if (type === "signup" || type === "invite") {
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
      try {
        await supabase.rpc("claim_pending_org_invitations");
      } catch {
        // Non-fatal
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
