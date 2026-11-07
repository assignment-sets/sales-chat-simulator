import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export function LandingHero() {
  return (
    <div className="min-h-full flex flex-col bg-white text-zinc-900 overflow-y-auto">
      {/* Top Navbar */}
      <PublicHeader />

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center">
        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-zinc-950 tracking-tight text-center max-w-4xl leading-[1.12]">
          Master live sales chats before facing real buyers.
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-lg text-zinc-600 text-center max-w-2xl leading-relaxed">
          Simulate high-stakes live buyer chats against realistic prospect personas. Get immediate objection-handling scoring, coaching notes, and team benchmarks.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-8 text-sm font-semibold shadow-md gap-2">
              Start Practicing Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/pricing" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-7 text-sm font-semibold border-zinc-200 hover:bg-zinc-50">
              View Plans & Pricing
            </Button>
          </Link>
        </div>

        {/* Live Chat Mockup Card */}
        <div className="mt-14 w-full max-w-3xl bg-white rounded-3xl border border-zinc-200/90 shadow-xl p-5 sm:p-7 ring-1 ring-zinc-950/5">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Marcus Vance • VP of Engineering</div>
              <div className="text-[11px] text-zinc-400">Enterprise Tech Buyer • Budget Skeptic Persona</div>
            </div>
            <div className="text-xs font-semibold text-zinc-900">
              Deal won <span className="text-zinc-400 font-normal">· 5/5</span>
            </div>
          </div>

          <div className="space-y-4 py-5">
            {/* Prospect Message */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-700 shrink-0">
                MV
              </div>
              <div className="bg-zinc-100/90 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-zinc-800 max-w-[85%] leading-relaxed border border-zinc-200/50">
                Your tool looks interesting, but our security team requires single-tenant data isolation and SOC2 Type II compliance. Do you support private VPC peering?
              </div>
            </div>

            {/* Rep Message */}
            <div className="flex items-start justify-end gap-3">
              <div className="bg-zinc-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs max-w-[85%] leading-relaxed shadow-xs">
                Yes, our Scale tier includes dedicated VPC peering and annual SOC2 audit packages. I can attach our architecture brief and schedule a 15-minute review with our security lead. Would tomorrow morning work?
              </div>
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                You
              </div>
            </div>

            {/* Prospect Response */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-700 shrink-0">
                MV
              </div>
              <div className="bg-zinc-100/90 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-zinc-800 max-w-[85%] leading-relaxed border border-zinc-200/50">
                That addresses our primary roadblock. Send over the brief and hold 10:30 AM tomorrow.
              </div>
            </div>
          </div>

          {/* Coaching Insight Note */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-zinc-700 shrink-0" />
            <div className="text-[11px] text-zinc-800 font-medium">
              <span className="font-bold">Coach Analysis:</span> Strong objection turnaround. Direct technical answer paired with a friction-reducing call to action.
            </div>
          </div>
        </div>

        {/* Editorial Specification: 01-03 Index */}
        <section className="mt-16 sm:mt-24 w-full grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 border-t border-zinc-200/80 pt-12">
          <div>
            <span className="font-mono text-xs font-semibold text-zinc-400">01</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-900 tracking-tight">Adaptive Prospect Personas</h3>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Simulate high-stakes live buyer chats against budget-sensitive founders, enterprise procurement leads, and impatient decision-makers.
            </p>
          </div>
          <div>
            <span className="font-mono text-xs font-semibold text-zinc-400">02</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-900 tracking-tight">Turn-by-Turn Objection Scoring</h3>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Every message is evaluated on discovery depth, value framing, and objection handling with instant recommendations.
            </p>
          </div>
          <div>
            <span className="font-mono text-xs font-semibold text-zinc-400">03</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-900 tracking-tight">Team Progress & Benchmarks</h3>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Track team-wide practice volume, win/loss conversion trends, and skill progression over time in one central view.
            </p>
          </div>
        </section>
      </main>

      {/* Categorized Directory Footer */}
      <PublicFooter />
    </div>
  );
}
