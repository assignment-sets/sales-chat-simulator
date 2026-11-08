"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTransition, Suspense, useState } from "react";
import { signup } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight } from "lucide-react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import {
  validatePassword,
  PASSWORD_REQUIREMENT_HINT,
} from "@/lib/validation/password";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const initialEmail = searchParams.get("email") || "";
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const loginQuery = new URLSearchParams({
    ...(next ? { next } : {}),
    ...(initialEmail ? { email: initialEmail } : {}),
  }).toString();
  const loginHref = loginQuery ? `/login?${loginQuery}` : "/login";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      setClientError(errors[0] || PASSWORD_REQUIREMENT_HINT);
      return;
    }
    setClientError(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await signup(formData);
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          id="fullName"
          name="fullName"
          type="text"
          label="Full Name"
          placeholder="e.g. Alex Morgan"
          required
          autoComplete="name"
          disabled={isPending}
        />

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

        <div className="flex flex-col gap-2">
          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (clientError) setClientError(null);
            }}
            error={clientError || undefined}
          />
          <PasswordRequirements password={password} />
        </div>

        <Button
          type="submit"
          size="md"
          className="w-full mt-2 font-semibold"
          isLoading={isPending}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {isPending ? "Creating account..." : "Get Started"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-semibold text-zinc-900 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <AuthToastWatcher />
      </Suspense>

      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-3xl p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <BrandLogo variant="icon" size={32} priority ariaHidden />
          <span className="font-semibold text-zinc-900 text-base tracking-tight">
            Chat2Sell
          </span>
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-1">Create your account</h1>
        <p className="text-xs text-zinc-500 mb-6">
          Start practicing high-stakes sales conversations with AI buyers.
        </p>

        <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-100 rounded-2xl" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
