import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Lock, Database, Server, Key, EyeOff } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = constructPublicMetadata({
  title: "Security & AI Data Training Disclosure",
  description:
    "Security architecture, multi-tenant isolation, data encryption, and zero foundation model training disclosures for SalesChat.",
  path: "/security",
});

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Security & AI Data Training Disclosure"
      subtitle="How we protect your workspace data, enforce tenant isolation, and ensure zero public model training."
      lastUpdated="October 2026"
    >
      {/* Zero Training Commitment Highlight Card */}
      <section className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 not-prose">
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900">
              Zero Foundation Model Training Commitment
            </h2>
            <p className="text-xs leading-relaxed text-zinc-600">
              Your company&apos;s sales pitch scripts, practice conversation transcripts, rep objection handling logs, and internal coaching feedback remain strictly confidential to your workspace. Neither SalesChat nor our cloud inference partners (including Groq Inc.) use your proprietary simulation inputs or outputs to train, fine-tune, or improve public foundation models.
            </p>
          </div>
        </div>
      </section>

      {/* 1. AI Data Governance & Privacy Architecture */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          1. AI Data Governance & Zero-Retention Inference
        </h2>
        <p>
          We architected SalesChat with an enterprise-first AI boundary. When reps engage in interactive practice sessions:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 not-prose">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
              <EyeOff className="w-4 h-4 text-zinc-900 shrink-0" />
              <span>Zero Public Model Training</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              No customer prompt, practice dialogue, or scoring critique is ever shared with third-party LLM providers for the purpose of training public models.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
              <Server className="w-4 h-4 text-zinc-900 shrink-0" />
              <span>Ephemeral Inference Processing</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Inference requests sent to our Groq LPU processing cluster are processed in memory and discarded immediately upon completion of response streaming.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Data Encryption */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          2. Encryption in Transit & at Rest
        </h2>
        <p>
          SalesChat implements industry-standard cryptographic protocols to protect data across all states:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Encryption in Transit:</strong> All data transmitted between your browser, SalesChat servers, and third-party subprocessors is secured using modern TLS 1.3 and HTTPS encryption with strict HTTP Strict Transport Security (HSTS) headers.
          </li>
          <li>
            <strong>Encryption at Rest:</strong> All database records, user credentials, conversation histories, and analytics are stored on encrypted volumes utilizing AES-256 encryption managed by Supabase on Amazon Web Services (AWS) data centers.
          </li>
          <li>
            <strong>Secure Cookie Flags:</strong> Authentication tokens are transmitted strictly via encrypted, HttpOnly, SameSite=Lax session cookies that are inaccessible to client-side scripts.
          </li>
        </ul>
      </section>

      {/* 3. Multi-Tenant Isolation & Defense-in-Depth */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          3. Multi-Tenant Isolation (Defense-in-Depth)
        </h2>
        <p>
          We employ a defense-in-depth isolation framework to prevent any possibility of cross-tenant data leakage:
        </p>
        <div className="space-y-2 text-xs text-zinc-600 not-prose">
          <div className="flex items-start gap-3 bg-white border border-zinc-200/80 rounded-2xl p-4">
            <Database className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-900 text-xs">PostgreSQL Row Level Security (RLS)</h3>
              <p className="leading-relaxed">
                Database tables enforce granular RLS policies. Queries execute with tenant-authenticated contexts ensuring users can only read or write rows that belong to their authorized workspace.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white border border-zinc-200/80 rounded-2xl p-4">
            <Lock className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-900 text-xs">Explicit Application-Level Tenant Scoping</h3>
              <p className="leading-relaxed">
                As a second line of defense, our server API routes explicitly enforce organization ID filters (<code>.eq(&quot;organization_id&quot;, orgId)</code>) and validate sub-resource ownership before querying the database.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white border border-zinc-200/80 rounded-2xl p-4">
            <Key className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-900 text-xs">Tenant-Partitioned Caching & Locks</h3>
              <p className="leading-relaxed">
                All temporary Redis cache entries and concurrency locks are strictly partitioned by organization and user keys (e.g., <code>orgId:userId</code>), completely preventing cross-tenant cache bleeding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Application Hardening & Error Sanitization */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          4. Application Hardening & Error Sanitization
        </h2>
        <p>
          We protect user experience and infrastructure integrity by applying strict API hygiene:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Sanitized Error Responses:</strong> API endpoints never expose raw stack traces, database schema details, or third-party SDK exception strings to the client. Internal errors are logged securely on the server while returning clean, sanitized error messages to the user.
          </li>
          <li>
            <strong>Brute-Force & Abuse Mitigation:</strong> Upstash Redis sliding-window rate limiters protect mutation endpoints, authentication routes, and AI generation calls against automated abuse and denial-of-service attempts.
          </li>
          <li>
            <strong>CSRF Protection:</strong> Mutation requests require verified origin headers matching trusted application domains.
          </li>
        </ul>
      </section>

      {/* 5. Subprocessor Due Diligence */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          5. Subprocessor Security & Due Diligence
        </h2>
        <p>
          Every external infrastructure vendor we partner with is evaluated for stringent data security compliance, including SOC 2 Type II certifications, ISO 27001 compliance, and adherence to GDPR Data Processing Addendums.
        </p>
        <p>
          For a complete, transparent directory of our third-party infrastructure and AI processors, please visit our dedicated{" "}
          <Link href="/subprocessors" className="text-zinc-900 underline font-semibold">
            Subprocessors Directory
          </Link>.
        </p>
      </section>

      {/* 6. Vulnerability Disclosure & Contact */}
      <section className="space-y-3 border-t border-zinc-200/80 pt-6">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          6. Vulnerability Disclosure Program
        </h2>
        <p>
          We welcome responsible security research. If you discover a security vulnerability or suspect an unauthorized access attempt, please report it immediately to our security engineering team at:
        </p>
        <div className="bg-zinc-100/80 border border-zinc-200/90 rounded-xl p-4 font-mono text-xs text-zinc-900 not-prose">
          security@chat2sell.in
        </div>
        <p className="text-xs text-zinc-500">
          Please include steps to reproduce, affected endpoints, and any relevant payload logs. We commit to acknowledging reports within 24 business hours and will not pursue legal action against researchers acting in good faith under safe harbor guidelines.
        </p>
      </section>
    </LegalPageShell>
  );
}
