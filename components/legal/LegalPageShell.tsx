import React from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LegalPageShellProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPageShell({
  title,
  subtitle,
  lastUpdated,
  children,
}: LegalPageShellProps) {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50/60 overflow-y-auto">
      {/* Top Header */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-zinc-900 text-sm tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-4 h-4 text-zinc-100" />
            </div>
            <span>SalesChat</span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/pricing"
              className="text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Pricing
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

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>

        {/* Title Header */}
        <div className="border-b border-zinc-200/80 pb-6 mb-8">
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-zinc-600 leading-relaxed">
            {subtitle}
          </p>
          <div className="mt-3 text-xs text-zinc-400 font-mono">
            Last Updated: {lastUpdated}
          </div>
        </div>

        {/* Document Body */}
        <div className="prose prose-zinc max-w-none space-y-8 text-zinc-700 text-xs sm:text-sm leading-relaxed">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 bg-white py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} SalesChat. All rights reserved.</div>
          <div className="flex items-center gap-6 font-medium">
            <Link href="/pricing" className="hover:text-zinc-900 transition-colors">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-zinc-900 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
