import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
      <footer className="border-t border-zinc-200/80 bg-white py-12 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-zinc-100">
            {/* Column 1: Brand & Identity */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900 text-sm tracking-tight">
                <div className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                  <Bot className="w-3.5 h-3.5 text-zinc-100" />
                </div>
                <span>SalesChat</span>
              </Link>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Realistic sales chat simulations and objection coaching for revenue teams.
              </p>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900">Product</h4>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li><Link href="/pricing" className="hover:text-zinc-900 transition-colors">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-zinc-900 transition-colors">Documentation</Link></li>
                <li><Link href="/changelog" className="hover:text-zinc-900 transition-colors">Changelog</Link></li>
                <li><Link href="/support" className="hover:text-zinc-900 transition-colors">Support & Help</Link></li>
              </ul>
            </div>

            {/* Column 3: Trust & Compliance */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900">Trust & Security</h4>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li><Link href="/security" className="hover:text-zinc-900 transition-colors">Security Overview</Link></li>
                <li><Link href="/subprocessors" className="hover:text-zinc-900 transition-colors">Subprocessors</Link></li>
                <li><Link href="/acceptable-use" className="hover:text-zinc-900 transition-colors">Acceptable Use Policy</Link></li>
                <li><Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            {/* Column 4: Legal & Policies */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900">Legal</h4>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li><Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-zinc-900 transition-colors">Cookie Policy</Link></li>
                <li><Link href="/refund" className="hover:text-zinc-900 transition-colors">Refund Policy</Link></li>
                <li><Link href="/about" className="hover:text-zinc-900 transition-colors">About Us</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <span>© {new Date().getFullYear()} SalesChat. All rights reserved.</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>TLS 1.3 · AES-256 · Multi-Tenant Isolation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
