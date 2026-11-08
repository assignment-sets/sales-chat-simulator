"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { validatePassword } from "@/lib/validation/password";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
  showOnlyWhenStarted?: boolean;
}

export function PasswordRequirements({
  password,
  className = "",
  showOnlyWhenStarted = true,
}: PasswordRequirementsProps) {
  if (showOnlyWhenStarted && !password) {
    return null;
  }

  const { details, isValid } = validatePassword(password);

  return (
    <div
      className={`rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-xs transition-all ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-zinc-700 text-[11px] uppercase tracking-wider">
          Password Requirements
        </span>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isValid
              ? "bg-emerald-100 text-emerald-800"
              : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {isValid ? "Strong" : "Weak"}
        </span>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {details.map((req) => (
          <li
            key={req.id}
            className={`flex items-center gap-1.5 transition-colors ${
              req.met ? "text-emerald-700 font-medium" : "text-zinc-500"
            }`}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            )}
            <span className="text-[11px]">{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
