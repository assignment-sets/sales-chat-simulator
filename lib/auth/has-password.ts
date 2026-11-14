import type { User } from "@supabase/supabase-js";

/**
 * Determines whether a Supabase user has password-based sign-in configured.
 * Email-registered accounts carry an `"email"` identity; OAuth-only users get
 * `user_metadata.has_password = true` once they set a password in settings.
 */
export function userHasPassword(
  user: Pick<User, "identities" | "user_metadata"> | null | undefined
): boolean {
  if (!user) return false;
  const hasEmailIdentity =
    user.identities?.some((identity) => identity.provider === "email") ?? false;
  return hasEmailIdentity || user.user_metadata?.has_password === true;
}
