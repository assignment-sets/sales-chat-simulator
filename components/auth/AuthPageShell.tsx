import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export interface AuthPageShellProps {
  children?: React.ReactNode;
  maxWidth?: "sm" | "md";
  backHref?: string;
  backLabel?: string;
}

export function AuthPageShell({
  children,
  maxWidth = "sm",
  backHref = "/",
  backLabel = "Back to home",
}: AuthPageShellProps) {
  const maxWidthClass = maxWidth === "md" ? "max-w-md" : "max-w-sm";

  return (
    <div className="min-h-full flex flex-col bg-zinc-50/60 overflow-y-auto">
      {/* Top Public Header Navbar */}
      <PublicHeader />

      {/* Main Centered Content */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:py-14">
        <div className={`w-full ${maxWidthClass}`}>
          {/* Back Navigation Link */}
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-4 transition-colors select-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>

          {/* Centered Card */}
          <div className="w-full bg-white border border-zinc-200 rounded-3xl p-8 shadow-xs">
            {children}
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
}
