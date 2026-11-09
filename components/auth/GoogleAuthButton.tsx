"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { notify } from "@/lib/toast";
import { Loader } from "@/components/ui/Loader";

interface GoogleAuthButtonProps {
  mode?: "signin" | "signup";
  next?: string;
  className?: string;
  disabled?: boolean;
}

export function GoogleAuthButton({
  mode = "signin",
  next,
  className = "",
  disabled = false,
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isLoading || disabled) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const targetNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/chats";
      const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(targetNext)}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        notify.error("Could not connect to Google", error.message);
        setIsLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      notify.error("Google sign-in error", "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const label = mode === "signup" ? "Sign up with Google" : "Continue with Google";

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      className={`relative w-full inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-zinc-900 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer ${className}`}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader size="sm" dotClassName="bg-zinc-700" />
          <span className="text-xs text-zinc-500">Connecting to Google...</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2.5">
          <GoogleIcon className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </span>
      )}
    </button>
  );
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
