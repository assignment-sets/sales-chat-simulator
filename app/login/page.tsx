"use client";

import Link from "next/link";
import { useTransition } from "react";
import { login } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MessageSquare, ArrowRight } from "lucide-react";

import { Suspense } from "react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await login(formData);
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <AuthToastWatcher />
      </Suspense>

      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-3xl p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-semibold text-zinc-900 text-base tracking-tight">
            SalesChat
          </span>
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-1">Welcome back</h1>
        <p className="text-xs text-zinc-500 mb-6">
          Sign in to your account to continue your sales simulation practice.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            name="email"
            type="email"
            label="Email Address"
            placeholder="name@company.com"
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
                href="/forgot-password"
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
              href="/register"
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
      </div>
    </div>
  );
}
