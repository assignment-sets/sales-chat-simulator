"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useTransition, Suspense, useEffect } from "react";
import { login } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight } from "lucide-react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { createClient } from "@/utils/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const initialEmail = searchParams.get("email") || "";
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/chats";
        router.replace(target);
      }
    });
  }, [next, router]);

  const registerQuery = new URLSearchParams({
    ...(next ? { next } : {}),
    ...(initialEmail ? { email: initialEmail } : {}),
  }).toString();
  const registerHref = registerQuery ? `/register?${registerQuery}` : "/register";

  const forgotQuery = new URLSearchParams({
    ...(next ? { next } : {}),
    ...(initialEmail ? { email: initialEmail } : {}),
  }).toString();
  const forgotHref = forgotQuery ? `/forgot-password?${forgotQuery}` : "/forgot-password";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await login(formData);
    });
  };

  return (
    <>
      <GoogleAuthButton mode="signin" next={next} disabled={isPending} />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-zinc-400">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          placeholder="name@company.com"
          defaultValue={initialEmail}
          required
          autoComplete="email"
          disabled={isPending}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-zinc-700 select-none"
            >
              Password
            </label>
            <Link
              href={forgotHref}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={isPending}
          />
        </div>

        <Button
          type="submit"
          size="md"
          className="w-full mt-2 font-semibold"
          isLoading={isPending}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1.5 text-center text-xs text-zinc-500">
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-zinc-900 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-[11px] text-zinc-400">
          Need another verification link?{" "}
          <Link
            href="/resend-verification"
            className="font-medium text-zinc-600 hover:underline"
          >
            Resend email
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={null}>
        <AuthToastWatcher />
      </Suspense>

      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 group select-none"
        title="Chat2Sell Home"
      >
        <BrandLogo variant="icon" size={36} priority ariaHidden className="group-hover:opacity-90 transition-opacity" />
        <span className="font-semibold text-zinc-900 text-base tracking-tight group-hover:text-zinc-700 transition-colors">
          Chat2Sell
        </span>
      </Link>

      <h1 className="text-xl font-bold text-zinc-900 mb-1">Welcome back</h1>
      <p className="text-xs text-zinc-500 mb-6">
        Sign in to your account to continue your sales simulation practice.
      </p>

      <Suspense fallback={<div className="h-48" />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
