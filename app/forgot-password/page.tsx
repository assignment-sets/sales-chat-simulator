"use client";

import Link from "next/link";
import { useTransition } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MessageSquare, ArrowRight, ArrowLeft } from "lucide-react";

import { Suspense } from "react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await requestPasswordReset(formData);
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

        <h1 className="text-xl font-bold text-zinc-900 mb-1">Reset your password</h1>
        <p className="text-xs text-zinc-500 mb-6">
          Enter the email associated with your account and we&apos;ll send you a password recovery link.
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

          <Button
            type="submit"
            size="md"
            className="w-full mt-2 font-semibold"
            isLoading={isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isPending ? "Sending link..." : "Send Reset Link"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
