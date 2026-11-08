import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function PublicHeader() {
  return (
    <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-zinc-900 text-sm tracking-tight"
        >
          <BrandLogo variant="icon" size={34} className="shrink-0" priority ariaHidden />
          <span>Chat2Sell</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/pricing"
            className="text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/changelog"
            className="hidden sm:inline-block text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Changelog
          </Link>
          <Link
            href="/login"
            className="text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Sign In
          </Link>
          <Link href="/login">
            <Button size="sm" className="text-xs font-semibold px-3.5">
              Start Practicing
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
