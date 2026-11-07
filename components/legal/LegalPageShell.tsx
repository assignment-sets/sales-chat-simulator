import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

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
      {/* Top Public Header */}
      <PublicHeader />

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

      {/* Shared Categorized Directory Footer */}
      <PublicFooter />
    </div>
  );
}
