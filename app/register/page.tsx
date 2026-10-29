"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTransition, Suspense } from "react";
import { signup } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MessageSquare, ArrowRight } from "lucide-react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const initialEmail = searchParams.get("email") || "";
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="At least 6 characters"
          required
          minLength={6}
          autoComplete="new-password"
          disabled={isPending}
        />

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
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
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
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-semibold text-zinc-900 text-base tracking-tight">
            SalesChat
          </span>
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-1">Create an account</h1>
        <p className="text-xs text-zinc-500 mb-6">
          Start practicing sales chat processes against AI prospects.
        </p>

        <Suspense fallback={<div className="h-56" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
