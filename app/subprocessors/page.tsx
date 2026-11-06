import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Bell, Mail } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Subprocessors Directory",
  description:
    "Listing of third-party subprocessors and infrastructure partners authorized to process data on behalf of SalesChat.",
};

interface SubprocessorEntry {
  name: string;
  role: string;
  dataProcessed: string;
  location: string;
  safeguard: string;
}

const SUBPROCESSORS: SubprocessorEntry[] = [
  {
    name: "Supabase Inc.",
    role: "Primary Cloud Database, User Authentication & Session Management",
    dataProcessed:
      "User profile credentials, organization memberships, simulation conversation transcripts, rep evaluation scores, and audit logs.",
    location: "United States (AWS)",
    safeguard: "Data Processing Addendum (DPA) with Standard Contractual Clauses (SCCs)",
  },
  {
    name: "Groq Inc.",
    role: "Ultra-Low Latency AI Inference Engine (LPU)",
    dataProcessed:
      "Simulation roleplay messages, buyer persona guidelines, objection scenario parameters, and generated prospect replies.",
    location: "United States",
    safeguard: "Enterprise DPA with Zero-Training & Ephemeral Retention Commitments",
  },
  {
    name: "TypeSafe AI Inc.",
    role: "Automated Evaluation & Scoring Decision Engine (Jev)",
    dataProcessed:
      "Simulation dialogue turns, objection handling performance metrics, and automated coaching recommendations.",
    location: "United States",
    safeguard: "DPA with Standard Contractual Clauses (SCCs)",
  },
  {
    name: "Upstash Inc.",
    role: "Serverless Redis Caching & Distributed Rate Limiting",
    dataProcessed:
      "Distributed rate limit counters, tenant concurrency locks, and ephemeral API cache entries.",
    location: "United States",
    safeguard: "DPA with Standard Contractual Clauses (SCCs)",
  },
  {
    name: "Vercel Inc.",
    role: "Cloud Web Hosting, Edge CDN & Serverless Compute Runtime",
    dataProcessed:
      "HTTP request routing metadata, IP addresses (for security verification and DDoS mitigation), edge execution logs, and static asset distribution.",
    location: "United States / Global Edge Network",
    safeguard: "DPA with Standard Contractual Clauses (SCCs)",
  },
  {
    name: "Dodo Payments Inc.",
    role: "Merchant of Record (MoR), Subscription Billing & Global Sales Tax Compliance",
    dataProcessed:
      "Customer contact details, billing address, payment transaction metadata, and tax invoice records.",
    location: "United States",
    safeguard: "Data Processing Addendum (DPA) with Standard Contractual Clauses (SCCs), PCI-DSS Level 1 Compliant",
  },
];

export default function SubprocessorsPage() {
  return (
    <LegalPageShell
      title="Third-Party Subprocessors Directory"
      subtitle="Authorized infrastructure partners and service providers that process customer data on behalf of SalesChat."
      lastUpdated="October 2026"
    >
      {/* Commitment Highlight Callout */}
      <section className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-5 text-emerald-950 not-prose">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-emerald-900">
              Vetted for Enterprise Privacy & Zero Public Model Training
            </h2>
            <p className="text-xs leading-relaxed text-emerald-900/90">
              In accordance with Article 28 of the General Data Protection Regulation (GDPR) and global data privacy standards, all third-party subprocessors engaged by SalesChat are contractually bound by rigorous Data Processing Addendums (DPAs). We mandate that AI inference vendors adhere to strict zero-training and transient processing agreements.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Subprocessor Registry Table */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          1. Authorized Infrastructure & AI Subprocessors
        </h2>
        <p>
          The following entities provide hosting, computing, database persistence, and AI inference services necessary to deliver the SalesChat platform:
        </p>

        <div className="overflow-x-auto border border-zinc-200/90 rounded-2xl not-prose bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100/70 text-zinc-700 font-semibold border-b border-zinc-200">
                <th className="py-3 px-4">Subprocessor</th>
                <th className="py-3 px-4">Role & Purpose</th>
                <th className="py-3 px-4">Data Processed</th>
                <th className="py-3 px-4">Entity Location</th>
                <th className="py-3 px-4">Transfer Safeguards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-600">
              {SUBPROCESSORS.map((sub) => (
                <tr key={sub.name} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-4 font-bold text-zinc-900 whitespace-nowrap">
                    {sub.name}
                  </td>
                  <td className="py-3.5 px-4 min-w-[160px]">{sub.role}</td>
                  <td className="py-3.5 px-4 min-w-[200px]">{sub.dataProcessed}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                    {sub.location}
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-zinc-500 min-w-[140px]">
                    {sub.safeguard}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Due Diligence & Security Standards */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          2. Vendor Due Diligence & Security Standards
        </h2>
        <p>
          Before onboarding any third-party subprocessor, SalesChat conducts rigorous technical and legal evaluations, verifying:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Security Certifications:</strong> Verification of independent SOC 2 Type II audits, ISO/IEC 27001 certifications, or equivalent enterprise security attestations.
          </li>
          <li>
            <strong>Data Segregation & Encryption:</strong> Enforced encryption of data both in transit (TLS 1.3) and at rest (AES-256).
          </li>
          <li>
            <strong>AI Training Restrictions:</strong> Explicit legal commitments ensuring prompt data and model completions are not retained or utilized to train external public foundation models.
          </li>
        </ul>
      </section>

      {/* 3. Notification of Changes */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          3. Subprocessor Updates & Notification Procedures
        </h2>
        <p>
          As SalesChat develops new capabilities, we may engage additional subprocessors or migrate existing services. We maintain a transparent change management process:
        </p>
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-600 space-y-2 not-prose">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900">Advance Notification:</strong> Workspace owners and team administrators will receive written notice via email or platform notification at least <strong>30 days prior</strong> to authorizing a new subprocessor.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900">Right to Object:</strong> Enterprise customers with active Data Processing Addendums have the right to object in writing to the appointment of a new subprocessor on reasonable data protection grounds before the effective date.
            </div>
          </div>
        </div>
      </section>

      {/* 4. Contact & Inquiries */}
      <section className="space-y-3 border-t border-zinc-200/80 pt-6">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          4. Privacy & Subprocessor Inquiries
        </h2>
        <p>
          To request an enterprise Data Processing Addendum (DPA) or submit questions regarding our subprocessor compliance policies, please contact our privacy compliance team at{" "}
          <a href="mailto:privacy@chat2sell.in" className="text-zinc-900 underline font-semibold">
            privacy@chat2sell.in
          </a>{" "}
          or review our full{" "}
          <Link href="/privacy" className="text-zinc-900 underline font-medium">
            Privacy Policy
          </Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}
