"use client";

import Link from "next/link";
import { useTransition } from "react";
import { resendVerificationEmail } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

import { Suspense } from "react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";

export default function ResendVerificationPage() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await resendVerificationEmail(formData);
    });
  };

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

      <h1 className="text-xl font-bold text-zinc-900 mb-1">Resend verification</h1>
      <p className="text-xs text-zinc-500 mb-6">
        Didn&apos;t receive your signup confirmation email? Enter your address to request a new link.
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
          {isPending ? "Sending email..." : "Resend Verification Link"}
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
    </AuthPageShell>
  );
}
