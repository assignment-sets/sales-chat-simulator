import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, CheckCircle2, ArrowRight, Compass, Rocket } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Changelog",
  description: "Stay up to date with new features, improvements, and roadmap updates for SalesChat.",
};

export default function ChangelogPage() {
  return (
    <LegalPageShell
      title="Product Changelog"
      subtitle="New releases, feature updates, and the evolving roadmap for SalesChat."
      lastUpdated="November 2026"
    >
      {/* Intro Note */}
      <section className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 not-prose flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-zinc-900" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Continuous Improvements
            </h2>
          </div>
          <p className="text-xs text-zinc-600">
            We ship product improvements, simulation tuning, and UX enhancements regularly.
          </p>
        </div>
        <Link href="/support">
          <Button variant="outline" size="sm" className="text-xs font-medium shrink-0">
            Request a Feature
          </Button>
        </Link>
      </section>

      {/* Release Entry: v0.1.0 */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/80 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">
              v0.1.0 — Initial Beta Launch
            </h2>
            <Badge variant="accent" className="text-[11px] font-semibold">
              Current Release
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
            <Calendar className="w-3.5 h-3.5" />
            <span>November 2026</span>
          </div>
        </div>

        <p className="text-sm text-zinc-700">
          Welcome to the initial beta release of SalesChat! This release introduces our core AI-powered simulation engine, turn-by-turn objection scoring, and multi-tenant team workspaces.
        </p>

        <div className="space-y-4 not-prose">
          {/* Feature 1 */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">
                Hyper-Realistic Live Chat Cadence
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-6">
              AI prospect responses now feature dynamic typing speed simulation, typing indicators, and debounced multi-message bursts so conversations mirror real human Slack or live-chat exchanges.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">
                Automated Jev Evaluation Engine
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-6">
              Instant feedback after each message exchange. Every rep response is scored on a 1–5 scale evaluating clarity, objection handling competence, and closing momentum with tactical coaching suggestions.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">
                Ultra-Fast Groq Inference Architecture
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-6">
              Powered by Groq LPUs for near-instant latency on complex buyer persona simulation prompts without lag or buffering.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">
                Multi-Tenant Workspaces & Org Quotas
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-6">
              Full workspace isolation with organization management, invite tokens, role-based controls (Owner, Admin, Member), and monthly simulation tracking.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-900">
                Full Session Persistence & Export
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-6">
              Browse past simulations, review coaching histories, and export conversation transcripts for offline 1-on-1 coaching sessions.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="space-y-4 pt-6 border-t border-zinc-200/80">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            What&apos;s Next on the Roadmap
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
          Here is what our engineering team is actively building for upcoming releases:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-4">
          <div className="border border-dashed border-zinc-300 rounded-2xl p-4 bg-zinc-50/50 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">In Design</span>
            <h3 className="text-xs font-bold text-zinc-900">Custom Persona Studio</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Define custom target personas with specific buyer titles, objection archetypes, and industry compliance rules.
            </p>
          </div>

          <div className="border border-dashed border-zinc-300 rounded-2xl p-4 bg-zinc-50/50 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Planned</span>
            <h3 className="text-xs font-bold text-zinc-900">Team Performance Analytics</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Manager dashboards showing team win rates, common objection failure points, and weekly practice streaks.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white border border-zinc-200/80 rounded-2xl p-6 not-prose flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ready to train?</h3>
          <p className="text-sm font-bold text-zinc-900">Jump right into your first simulated conversation.</p>
        </div>
        <Link href="/login">
          <Button size="sm" className="text-xs font-semibold gap-1.5">
            Start Free Practice
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </section>
    </LegalPageShell>
  );
}
