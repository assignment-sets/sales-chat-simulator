"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Suspense } from "react";
import { AuthToastWatcher } from "@/components/auth/AuthToastWatcher";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import {
  validatePassword,
  PASSWORD_REQUIREMENT_HINT,
} from "@/lib/validation/password";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      setClientError(errors[0] || PASSWORD_REQUIREMENT_HINT);
      return;
    }

    if (password !== confirmPassword) {
      setClientError("Passwords do not match");
      return;
    }

    setClientError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updatePassword(formData);
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

      <h1 className="text-xl font-bold text-zinc-900 mb-1">Set new password</h1>
        <p className="text-xs text-zinc-500 mb-6">
          Please enter your new password below (at least 8 characters with letters and numbers).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              id="password"
              name="password"
              type="password"
              label="New Password"
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

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm New Password"
            placeholder="Repeat your new password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (clientError) setClientError(null);
            }}
          />

          <Button
            type="submit"
            size="md"
            className="w-full mt-2 font-semibold"
            isLoading={isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isPending ? "Updating password..." : "Reset Password"}
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
