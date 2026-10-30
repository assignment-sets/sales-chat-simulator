import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy and Subprocessor disclosures for SalesChat's AI sales training and simulation platform.",
};

interface SubprocessorEntry {
  name: string;
  role: string;
  dataProcessed: string;
  location: string;
}

const SUBPROCESSORS: SubprocessorEntry[] = [
  {
    name: "Supabase Inc.",
    role: "Primary Cloud Database & User Authentication",
    dataProcessed: "User profile credentials, organization memberships, simulation transcripts, and evaluation records.",
    location: "United States (AWS)",
  },
  {
    name: "Groq Inc.",
    role: "Ultra-Low Latency AI Inference Engine",
    dataProcessed: "Simulation prompt messages, prospect scenario guidelines, and coaching analysis generation.",
    location: "United States",
  },
  {
    name: "Upstash Inc.",
    role: "Serverless Redis Caching & Rate Limiting",
    dataProcessed: "Distributed rate limit counters, tenant concurrency locks, and ephemeral API caches.",
    location: "United States",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How SalesChat protects, processes, and respects your simulation data and account privacy."
      lastUpdated="October 2026"
    >
      {/* Commitment Highlight Callout */}
      <section className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 text-emerald-950 not-prose">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-emerald-900">
              Our Core Commitment: We Do Not Train Public Models on Your Conversations
            </h2>
            <p className="text-xs leading-relaxed text-emerald-900/90">
              Your sales chat transcripts, customer objection handling drills, and internal sales playbooks remain your confidential workspace property. SalesChat does not use customer simulation content to train public AI foundation models without explicit organizational authorization.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Information Collected */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          1. Information We Collect
        </h2>
        <p>To deliver high-fidelity sales simulation and team analytics, we collect:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Account & Workspace Information:</strong> Email address, hashed authentication credentials, organization membership roles, and workspace settings.
          </li>
          <li>
            <strong>Simulation Transcripts & Content:</strong> Practice messages, sales pitches, and objections submitted during chat simulations.
          </li>
          <li>
            <strong>Evaluation & Performance Metrics:</strong> AI-generated win/loss outcomes, 1–5 scoring rubrics, coaching breakdowns, and token utilization records.
          </li>
          <li>
            <strong>Technical & Diagnostics Data:</strong> Request IP addresses (for rate-limiting and abuse prevention), user agent headers, and error logs.
          </li>
        </ul>
      </section>

      {/* 2. Subprocessor Disclosure */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          2. Third-Party Subprocessor Disclosure
        </h2>
        <p>
          SalesChat partners with verified infrastructure and artificial intelligence service providers to deliver the platform. Each subprocessor is vetted for strict data protection compliance:
        </p>

        <div className="overflow-x-auto border border-zinc-200/90 rounded-2xl not-prose bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100/70 text-zinc-700 font-semibold border-b border-zinc-200">
                <th className="py-3 px-4">Subprocessor</th>
                <th className="py-3 px-4">Purpose / Role</th>
                <th className="py-3 px-4">Data Processed</th>
                <th className="py-3 px-4">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-600">
              {SUBPROCESSORS.map((sub) => (
                <tr key={sub.name} className="hover:bg-zinc-50/50">
                  <td className="py-3 px-4 font-bold text-zinc-900">{sub.name}</td>
                  <td className="py-3 px-4">{sub.role}</td>
                  <td className="py-3 px-4">{sub.dataProcessed}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">{sub.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Retention & Deletion */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          3. Data Retention & Deletion Policy
        </h2>
        <p>
          We retain your simulation data only as long as your workspace remains active:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Simulation Deletion:</strong> When a user or team admin deletes a simulation chat, the chat record, message history, and evaluation summaries are immediately removed from the active database, and corresponding Redis cache entries are evicted.
          </li>
          <li>
            <strong>Organization & Account Deletion:</strong> Deleting an organization cascades deletion across all associated memberships, invitations, simulations, and usage ledgers.
          </li>
        </ul>
      </section>

      {/* 4. Security & Tenant Isolation */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          4. Security & Multi-Tenant Isolation
        </h2>
        <p>
          SalesChat enforces strict defense-in-depth isolation using PostgreSQL Row Level Security (RLS) policies and private tenant helper functions. Customer simulation records are strictly segregated by organization boundary, preventing cross-tenant data access.
        </p>
      </section>

      {/* 5. User Rights */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          5. Data Subject Rights (GDPR & CCPA)
        </h2>
        <p>
          Depending on your jurisdiction, you have the right to access, export, correct, or request deletion of your personal data. You may export transcripts directly from the platform interface or submit privacy inquiries to our team.
        </p>
      </section>

      {/* 6. Cookies & Tracking Technologies */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          6. Cookies & Essential Session Storage
        </h2>
        <p>
          SalesChat uses only strictly necessary cookies for user authentication, security, and workspace multi-tenancy. We do not use third-party advertising cookies, marketing pixels, or cross-site tracking technologies. For full details on our cookie inventory and storage practices, please visit our dedicated{" "}
          <Link href="/cookies" className="text-zinc-900 underline font-medium">
            Cookie Policy
          </Link>.
        </p>
      </section>

      {/* 7. Contact */}
      <section className="space-y-3 border-t border-zinc-200/80 pt-6">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          7. Privacy Inquiries & Contact
        </h2>
        <p>
          If you have questions regarding this Privacy Policy or data processing practices, please email{" "}
          <a href="mailto:privacy@chat2sell.in" className="text-zinc-900 underline font-medium">
            privacy@chat2sell.in
          </a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
