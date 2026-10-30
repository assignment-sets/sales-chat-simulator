import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Clock, MessageSquare, Sparkles, Users, HelpCircle, ArrowRight } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { CopyEmailButton } from "@/components/support/CopyEmailButton";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Support & Contact",
  description: "Get in touch with the SalesChat team for help with simulations, team workspaces, or billing inquiries.",
};

const SUPPORT_EMAIL = "support@chat2sell.in";

export default function SupportPage() {
  return (
    <LegalPageShell
      title="Help & Support"
      subtitle="Have questions about simulations, team workspaces, or billing? We're here to help."
      lastUpdated="October 2026"
    >
      {/* Primary Contact Card */}
      <section className="bg-white border border-zinc-200/80 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6 not-prose">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
              Direct Contact
            </span>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-zinc-700" />
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-base sm:text-lg font-bold text-zinc-900 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <CopyEmailButton email={SUPPORT_EMAIL} />
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Button size="sm" className="font-semibold text-xs px-3.5">
                Send Email
              </Button>
            </a>
          </div>
        </div>

        {/* Expected response time indicator */}
        <div className="flex items-center gap-3 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4">
          <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <span className="font-semibold text-zinc-900">Response Expectation: </span>
            We typically respond to all inquiries within <strong className="text-zinc-900">24 business hours</strong> (Monday through Friday).
          </div>
        </div>
      </section>

      {/* Inquiry Channels Breakdown */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          How We Can Help
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 not-prose">
          {/* General Help */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Simulation Coaching</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Questions regarding scenario configuration, objection-handling prompts, or automated scoring rubrics.
            </p>
          </div>

          {/* Teams & Invitations */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Workspace & Teams</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Assistance with member invitations, seat limits, organization switching, or role permissions.
            </p>
          </div>

          {/* Upgrades & Enterprise */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Plans & Upgrades</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Inquire about custom seat bundles, higher monthly simulation quotas, or invoicing for your sales team.
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="space-y-4 border-t border-zinc-200/80 pt-8">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-zinc-900">
              How do sales roleplay simulations work?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Start a new simulation with any product name and value proposition. Our AI simulates a realistic, challenging customer persona that tests your objection handling and value discovery skills.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-zinc-900">
              How is my sales performance scored?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Evaluations are computed automatically using TypeSafe AI&apos;s Jev decision engine. Conversations are evaluated on a 1–5 performance scale and classified as won once a concrete next step (such as booking a calendar slot or agreeing to a quote) is reached.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-zinc-900">
              How do I invite colleagues to my organization?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              If your organization is on a Pro or Scale plan, workspace owners and admins can invite members by email from the organization settings. Invitees receive a secure token link to join your workspace.
            </p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 space-y-1.5">
            <h3 className="text-sm font-bold text-zinc-900">
              How do I upgrade my organization&apos;s plan?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Check our <Link href="/pricing" className="text-zinc-900 underline font-semibold">Pricing page</Link> to compare simulation pools and seat allocations. To upgrade your workspace, please reach out to us directly at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-zinc-900 underline font-semibold">{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Link to Pricing */}
      <section className="bg-zinc-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 not-prose">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold">Ready to explore team plans?</h3>
          <p className="text-xs text-zinc-400">
            Compare monthly simulation quotas, team dashboards, and rep performance benchmarks.
          </p>
        </div>
        <Link href="/pricing">
          <Button
            size="md"
            variant="outline"
            className="font-semibold text-xs whitespace-nowrap bg-white text-zinc-900 hover:bg-zinc-100 border-white/20"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            View Pricing Plans
          </Button>
        </Link>
      </section>
    </LegalPageShell>
  );
}
