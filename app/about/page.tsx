import type { Metadata } from "next";
import Link from "next/link";
import { Target, ShieldCheck, Zap, ArrowRight, Compass } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { Button } from "@/components/ui/Button";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = constructPublicMetadata({
  title: "About Us",
  description:
    "Learn why we built Chat2Sell: the interactive AI sales simulation platform designed to master objection handling without burning real pipeline.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalPageShell
      title="About Chat2Sell"
      subtitle="Master live sales chats and high-stakes objection handling before facing real buyers."
      lastUpdated="November 2026"
    >
      {/* Mission Banner */}
      <section className="bg-zinc-900 text-white rounded-3xl p-6 sm:p-8 not-prose shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
          <Compass className="w-4 h-4 text-zinc-400" />
          <span>Our Mission</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Nobody should have to burn valuable pipeline leads just to get better at selling.
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
          Chat2Sell was engineered to bridge the gap between static sales scripts and live high-pressure customer conversations. We give revenue teams, founders, and account executives an on-demand, hyper-realistic practice arena to hone objection handling, discovery questions, and closing strategies.
        </p>
      </section>

      {/* The Problem */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-zinc-700" />
          The Problem with Traditional Sales Practice
        </h2>
        <p>
          For decades, sales onboarding has relied on two flawed approaches:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-4">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <h3 className="text-sm font-bold text-zinc-900">Awkward Colleague Roleplay</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Practicing with teammates feels artificial, lacks adversarial skepticism, and depends entirely on someone else having free time in their calendar.
            </p>
          </div>
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-2xs space-y-2">
            <h3 className="text-sm font-bold text-zinc-900">Trial by Fire on Real Inbound</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              When reps practice on real prospects, missteps burn five-figure deals, waste marketing spend, and hurt customer trust before objections can be mastered.
            </p>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-zinc-700" />
          How Chat2Sell Works
        </h2>
        <p>
          We combine cutting-edge Groq LLM inference with behavioral simulation mechanics to create conversations that genuinely feel like chatting with a discerning B2B buyer:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Adversarial Prospect Personas:</strong> The AI lead simulates realistic objections—pushing back on budget constraints, enterprise security requirements, contract terms, or competing vendor loyalty.
          </li>
          <li>
            <strong>Human Conversational Pacing:</strong> Real buyers don&apos;t spit out 400-word essays in 0.2 seconds. Chat2Sell emulates realistic typing cadence delays, debounced multi-message bursts, and typing indicators.
          </li>
          <li>
            <strong>Objective Jev Scoring:</strong> After every exchange, our decision engine rates your response on a 1–5 scale with actionable coaching critiques on tone, value framing, and next-step commitments.
          </li>
          <li>
            <strong>Team Collaboration & Benchmarks:</strong> Sales managers and founders can review simulation transcripts, track team improvement over time, and standardize pitch playbooks across the organization.
          </li>
        </ul>
      </section>

      {/* Privacy & Trust */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-zinc-700" />
          Privacy & Data Protection First
        </h2>
        <p>
          Your sales pitches, internal positioning, and simulation transcripts represent your organization&apos;s intellectual property. We treat it that way:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Strict Tenant Isolation:</strong> Every simulation is bound directly to your authenticated organization with Row Level Security (RLS).
          </li>
          <li>
            <strong>No Third-Party AI Model Training:</strong> Your chat transcripts and custom product descriptions are never used to train public LLMs or sold to data brokers.
          </li>
          <li>
            <strong>Full Data Ownership:</strong> You can export full conversation transcripts or delete your account and associated simulation data at any time from your settings.
          </li>
        </ul>
      </section>

      {/* Contact & Next Steps CTA */}
      <section className="bg-zinc-100/80 border border-zinc-200/80 rounded-2xl p-6 not-prose flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-900">Have questions or want to partner?</h3>
          <p className="text-xs text-zinc-600">
            Reach out directly to our team at{" "}
            <a href="mailto:support@chat2sell.in" className="text-zinc-900 font-semibold underline">
              support@chat2sell.in
            </a>{" "}
            or explore our documentation.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/docs">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              Read Docs
            </Button>
          </Link>
          <Link href="/login">
            <Button size="sm" className="text-xs font-semibold gap-1.5">
              Start Practicing
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </section>
    </LegalPageShell>
  );
}
