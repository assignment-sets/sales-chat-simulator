import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
  FileText,
  Clock,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { Button } from "@/components/ui/Button";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = constructPublicMetadata({
  title: "Refund & Cancellation Policy",
  description:
    "Review Chat2Sell's cancellation terms, 14-day refund eligibility criteria, and Dodo Payments Merchant of Record (MoR) disclosures.",
  path: "/refund",
});

const SUPPORT_EMAIL = "support@chat2sell.in";

export default function RefundPage() {
  return (
    <LegalPageShell
      title="Refund & Cancellation Policy"
      subtitle="Transparent terms on subscription cancellations, refund review criteria, and payment processing."
      lastUpdated="November 2026"
    >
      {/* Merchant of Record (MoR) Notice Card */}
      <section className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 not-prose">
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900">
              Merchant of Record Notice (Dodo Payments)
            </h2>
            <p className="text-xs leading-relaxed text-zinc-600">
              Chat2Sell partners with <strong>Dodo Payments</strong> as our Merchant of Record (MoR) for digital product sales, subscription billing, and tax compliance. Dodo Payments is the legal entity that processes your transactions, calculates applicable global sales tax (VAT/GST), and issues official invoices. On your credit card or bank account statements, charges will typically be identified as <strong>DODO* CHAT2SELL</strong> or <strong>DODOPAYMENTS</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Subscription Cancellation */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            1. Subscription Cancellation Policy
          </h2>
        </div>
        <p>
          You have full control over your subscription. You may cancel your paid recurring plan at any time through your organization settings dashboard or by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-zinc-900 underline font-medium">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>

        <div className="space-y-3 not-prose my-3">
          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl space-y-1">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-600" />
              Service Continues Until Period End
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              When you cancel a subscription, your paid benefits (including simulation quotas, team seat allocations, and advanced scoring) remain fully active throughout the remainder of your paid billing cycle.
            </p>
          </div>

          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl space-y-1">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-zinc-600" />
              No Mid-Cycle Prorating
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Because full cloud and AI inference resources are allocated upfront for each billing interval, we do not provide prorated refunds or credits for partial months or unused simulation turns upon voluntary cancellation.
            </p>
          </div>

          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl space-y-1">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-zinc-600" />
              Plan Upgrades & Downgrades
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              When upgrading plans, your simulation quota expands immediately and Dodo Payments applies a prorated credit toward the new tier. When downgrading, the change is scheduled for the end of your prepaid billing period (Next Billing Date) — you retain your existing higher-tier limits until renewal, and no mid-cycle cash refunds are issued for early downgrades.
            </p>
          </div>

          <div className="p-4 bg-white border border-zinc-200/80 rounded-xl space-y-1">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-600" />
              Automatic Transition to Free Tier
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Upon conclusion of your paid period, your account will smoothly revert to our Free plan. All historical chat simulations, transcripts, and evaluation scores remain safe, viewable, and exportable.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Refund Eligibility */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            2. Refund Eligibility & 14-Day Evaluation Window
          </h2>
        </div>
        <p>
          We want you to be completely confident in Chat2Sell. If you experience technical defects, platform failures, or billing discrepancies, you may request a refund within <strong>14 calendar days</strong> of the transaction date.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-4">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-900">
              Eligible for Refund Review
            </span>
            <ul className="text-xs text-zinc-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Severe or persistent platform outages preventing simulation usage.</li>
              <li>Reproducible bugs where AI responses consistently fail to generate.</li>
              <li>Duplicate billing or inadvertent multiple transactions for the same plan.</li>
              <li>Unintended renewals if reported within 48 hours with zero simulation usage.</li>
            </ul>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Non-Refundable Scenarios
            </span>
            <ul className="text-xs text-zinc-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Substantial or complete consumption of monthly simulation quotas.</li>
              <li>Requests submitted after the 14-day evaluation window has elapsed.</li>
              <li>Discontent with AI feedback scores when the system operated as designed.</li>
              <li>Accounts terminated due to violations of our Acceptable Use Policy.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. How to Submit */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            3. How to Submit a Refund Request
          </h2>
        </div>
        <p>
          To ensure your request is reviewed quickly, please email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-zinc-900 underline font-medium">
            {SUPPORT_EMAIL}
          </a>{" "}
          with the following details:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 text-zinc-700 text-xs sm:text-sm">
          <li>
            <strong>Account Email & Organization:</strong> The email associated with your Chat2Sell account.
          </li>
          <li>
            <strong>Transaction Identifier:</strong> The invoice number or payment ID from your Dodo Payments receipt.
          </li>
          <li>
            <strong>Description of Issue:</strong> A summary of the technical defect or reason for your request.
          </li>
        </ol>
        <p className="text-xs text-zinc-500">
          Our team reviews all inquiries within <strong>24 to 48 business hours</strong>. If an issue is verified, a full or partial refund will be authorized.
        </p>
      </section>

      {/* 4. Processing & Settlement */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-700" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            4. Refund Settlement & Timelines
          </h2>
        </div>
        <p>
          Once approved, refunds are processed via Dodo Payments directly to the original payment method used during checkout (credit card, debit card, or supported local method).
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-700 text-xs sm:text-sm">
          <li>
            <strong>Disbursement Timeframe:</strong> Funds typically appear on your statement within <strong>3 to 5 business days</strong>, depending on your card issuer or banking institution.
          </li>
          <li>
            <strong>Currency & Taxes:</strong> Dodo Payments automatically calculates and refunds applicable VAT/GST sales tax collected at checkout.
          </li>
        </ul>
      </section>

      {/* 5. Disputes & Chargebacks */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          5. Chargebacks & Bank Inquiries
        </h2>
        <p>
          We are committed to resolving any legitimate billing concern directly and equitably. If you believe an error occurred, we ask that you contact our team at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-zinc-900 underline font-medium">
            {SUPPORT_EMAIL}
          </a>{" "}
          prior to filing a formal dispute or chargeback with your issuing bank. Uncoordinated chargebacks may result in administrative dispute fees and automatic suspension of your workspace while the inquiry is investigated.
        </p>
      </section>

      {/* Contact Support Footer Card */}
      <section className="bg-zinc-100/80 border border-zinc-200/80 rounded-2xl p-6 not-prose flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-zinc-700" />
            <h3 className="text-sm font-bold text-zinc-900">Have questions about your bill?</h3>
          </div>
          <p className="text-xs text-zinc-600">
            Our support desk is here to help with invoice lookups, subscription modifications, and receipt inquiries.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/support">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              Help Center
            </Button>
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Button size="sm" className="text-xs font-semibold gap-1.5">
              Contact Billing
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </section>
    </LegalPageShell>
  );
}

