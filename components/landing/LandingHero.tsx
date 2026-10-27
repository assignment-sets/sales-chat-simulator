import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Sparkles, TrendingUp, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function LandingHero() {
  return (
    <div className="min-h-full flex flex-col bg-white text-zinc-900 overflow-y-auto">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-zinc-900 text-sm tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-4 h-4 text-zinc-100" />
            </div>
            <span className="text-base tracking-tight font-black">SalesChat</span>
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
              <Button size="sm" className="text-xs font-semibold px-4 shadow-xs">
                Start Practicing
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center">
        {/* Badge */}
        <div className="mb-6">
          <Badge variant="accent" className="px-3.5 py-1 text-xs gap-1.5 font-medium tracking-wide shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-zinc-800" />
            Hyper-Realistic AI Sales Simulation
          </Badge>
        </div>

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
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div>
                <div className="text-xs font-semibold text-zinc-900">Marcus Vance • VP of Engineering</div>
                <div className="text-[11px] text-zinc-400">Enterprise Tech Buyer • Budget Skeptic Persona</div>
              </div>
            </div>
            <Badge variant="success" className="text-[11px] px-2.5 py-0.5">
              Outcome: Deal Won (5/5)
            </Badge>
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

          {/* AI Coaching Insight Pill */}
          <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-[11px] text-emerald-950 font-medium">
              <span className="font-bold">AI Coach Analysis:</span> Strong objection turnaround. Direct technical answer paired with a friction-reducing call to action.
            </div>
          </div>
        </div>

        {/* 3 Core Value Pillars */}
        <section className="mt-16 sm:mt-24 w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Adaptive Prospect Personas</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Encounter budget-sensitive founders, procurement specialists, and impatient decision-makers tuned for realism.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Instant Automated Coaching</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Every turn is scored on clarity, tone, and objection handling with actionable recommendations.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Team Progress & Metrics</h3>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Sales leaders track team simulation volume, win/loss conversion rates, and skill progression over time.
            </p>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200/80 bg-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            <span>© {new Date().getFullYear()} SalesChat. All rights reserved.</span>
          </div>

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
