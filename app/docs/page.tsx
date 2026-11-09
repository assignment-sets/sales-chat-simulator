import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Play,
  Lightbulb,
  Award,
  Users,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { Button } from "@/components/ui/Button";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = constructPublicMetadata({
  title: "Documentation & User Playbook",
  description:
    "Learn how to craft high-impact sales simulations, master objection handling drills, and interpret Jev coaching scores in Chat2Sell.",
  path: "/docs",
});

export default function DocsPage() {
  return (
    <LegalPageShell
      title="User Playbook & Documentation"
      subtitle="Master sales simulations, objection handling drills, and coaching analytics."
      lastUpdated="November 2026"
    >
      {/* Overview Card */}
      <section className="bg-zinc-900 text-white rounded-3xl p-6 sm:p-8 not-prose shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Platform Overview</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Welcome to the Chat2Sell Playbook
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
          Chat2Sell is designed for reps, founders, and sales leaders who want to build muscle memory before stepping into live buyer meetings. This guide walks you through setting up drills, structuring product pitches, and interpreting live coaching feedback.
        </p>
      </section>

      {/* 1. Quickstart */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            1. Quickstart: Launching Your First Simulation
          </h2>
        </div>
        <p>
          Starting an interactive practice session takes less than 30 seconds:
        </p>
        <ol className="list-decimal pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Navigate to Chats:</strong> In your dashboard or sidebar, click <strong>&ldquo;New Practice Chat&rdquo;</strong>.
          </li>
          <li>
            <strong>Set Your Product Name:</strong> Enter your product or service name (e.g. <em>&ldquo;Chat2Sell Enterprise&rdquo;</em> or <em>&ldquo;CloudFlow Observability&rdquo;</em>).
          </li>
          <li>
            <strong>Provide the Value Proposition:</strong> Detail your core value hook, pricing model, key differentiators, and target customer persona (up to 2,000 characters).
          </li>
          <li>
            <strong>Engage the AI Buyer:</strong> The AI prospect will enter the chat room and initiate a realistic opening challenge or qualification inquiry.
          </li>
        </ol>
      </section>

      {/* 2. Crafting Prompts */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            2. Crafting High-Impact Product Pitches
          </h2>
        </div>
        <p>
          The more specific your product description, the more nuanced and realistic the AI prospect&apos;s objections will be.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-4">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Avoid: Vague Specification
            </span>
            <p className="text-xs text-zinc-700 font-mono bg-white p-3 rounded-lg border border-zinc-200/80">
              &ldquo;We sell an AI tool for marketing teams to make content faster and cheaper.&rdquo;
            </p>
            <p className="text-[11px] text-zinc-500">
              Too vague. The AI lead will default to generic surface-level pricing questions without deep domain objections.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
              Recommended: Concrete Parameters
            </span>
            <p className="text-xs text-zinc-700 font-mono bg-white p-3 rounded-lg border border-zinc-200/80">
              &ldquo;B2B SaaS churn prediction platform for Series B+ companies. Starts at $18k/yr. Integrates with Stripe & HubSpot. Main objection is long implementation timelines.&rdquo;
            </p>
            <p className="text-[11px] text-zinc-500">
              Concrete details allow the AI prospect to test budget ceilings, technical security, and ROI payback periods.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Understanding Personas */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            3. AI Buyer Behavior & Objection Types
          </h2>
        </div>
        <p>
          The simulation engine emulates realistic buyer hesitations across four primary pillars:
        </p>
        <div className="space-y-3 not-prose">
          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Budget & Priority Pushback
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              &ldquo;We don&apos;t have budget allocated for this quarter,&rdquo; or &ldquo;Our executive team froze non-essential software spend.&rdquo;
            </p>
          </div>
          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Security & Technical Compliance
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              &ldquo;Our infosec policy requires on-premise deployment or strict SOC2 Type II compliance with isolated tenant databases.&rdquo;
            </p>
          </div>
          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Competitor & Status Quo Loyalty
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              &ldquo;We already use an established incumbent solution and switching costs are too high for our team.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* 4. Scoring Engine */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            4. The Jev Decision Engine & Scoring Rubric
          </h2>
        </div>
        <p>
          Every response you submit is reviewed against sales best practices. The engine assigns a score from 1 to 5:
        </p>

        <div className="space-y-2.5 not-prose my-3">
          <div className="flex items-start sm:items-center gap-3 p-3.5 bg-white border border-zinc-200/80 rounded-xl">
            <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap tabular-nums min-w-[3.5rem]">
              1 <span className="text-zinc-400 font-normal ml-0.5">/ 5</span>
            </span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">Offensive / Fatal Misstep:</strong> Completely dodges the prospect&apos;s concern, presents false facts, or becomes defensive.
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3 p-3.5 bg-white border border-zinc-200/80 rounded-xl">
            <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap tabular-nums min-w-[3.5rem]">
              2 <span className="text-zinc-400 font-normal ml-0.5">/ 5</span>
            </span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">Weak / Passive:</strong> Acknowledges the question but lacks conviction, value justification, or persuasive framing.
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3 p-3.5 bg-white border border-zinc-200/80 rounded-xl">
            <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap tabular-nums min-w-[3.5rem]">
              3 <span className="text-zinc-400 font-normal ml-0.5">/ 5</span>
            </span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">Neutral / Informational:</strong> Answers accurately like a documentation bot, but fails to steer the conversation or probe for discovery.
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3 p-3.5 bg-white border border-zinc-200/80 rounded-xl">
            <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap tabular-nums min-w-[3.5rem]">
              4 <span className="text-zinc-400 font-normal ml-0.5">/ 5</span>
            </span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">Strong Reframing:</strong> Directly resolves the concern, links solution to ROI, and asks an engaging qualifying question.
            </div>
          </div>

          <div className="flex items-start sm:items-center gap-3 p-3.5 bg-white border border-zinc-200/80 rounded-xl">
            <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap tabular-nums min-w-[3.5rem]">
              5 <span className="text-zinc-400 font-normal ml-0.5">/ 5</span>
            </span>
            <div className="text-xs text-zinc-700 leading-relaxed">
              <strong className="text-zinc-900">Deal Advance / Win:</strong> Flawlessly overcomes resistance, creates urgency, and secures commitment to the next milestone (demo, security review, or technical pilot).
            </div>
          </div>
        </div>
      </section>

      {/* 5. Team Workspaces */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            5. Team Workspaces & Roles
          </h2>
        </div>
        <p>
          Chat2Sell provides tenant-scoped collaboration:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-700">
          <li>
            <strong>Owner & Admin:</strong> Manage workspace billing, set monthly simulation quotas, review team-wide conversation transcripts, and invite members.
          </li>
          <li>
            <strong>Member:</strong> Run unlimited personal practice sessions within their assigned tier quota and review historical feedback.
          </li>
          <li>
            <strong>Session Export:</strong> All completed simulations can be exported as structured transcripts for manager review during 1-on-1s.
          </li>
        </ul>
      </section>

      {/* Help Link Footer */}
      <section className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-6 not-prose flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-zinc-700" />
            <h3 className="text-sm font-bold text-zinc-900">Need personal assistance?</h3>
          </div>
          <p className="text-xs text-zinc-600">
            Our support team is available to assist with custom workspace setups and onboarding drills.
          </p>
        </div>
        <Link href="/support">
          <Button size="sm" className="text-xs font-semibold">
            Contact Support
          </Button>
        </Link>
      </section>
    </LegalPageShell>
  );
}
