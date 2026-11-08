import React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PublicHeader() {
  return (
    <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-zinc-900 text-sm tracking-tight"
        >
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-4 h-4 text-zinc-100" />
          </div>
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
