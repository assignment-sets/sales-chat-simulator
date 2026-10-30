"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { notify } from "@/lib/toast";

interface CopyEmailButtonProps {
  email: string;
}

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      notify.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Failed to copy email");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy support email address"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 transition-colors cursor-pointer"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
          <span>Copy Address</span>
        </>
      )}
    </button>
  );
}
