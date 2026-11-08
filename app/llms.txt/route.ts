import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

  const content = `# Chat2Sell

> Chat2Sell is an interactive AI sales simulation and coaching platform where sales representatives, account executives, and revenue teams practice live objection handling and sales negotiation against dynamic AI buyer personas.

Chat2Sell helps revenue professionals master live chat sales, objection handling drills, and high-stakes negotiation before facing real buyers. Turn-by-turn simulations are evaluated by the Jev coaching engine across Discovery, Objection Handling, Value Articulation, and Negotiation. This curated index provides autonomous AI agents with direct, token-efficient references to our public information, documentation, and trust architecture.

## Core Features & Overview

- [AI Sales Practice Simulator](${siteUrl}): Interactive prospect personas, live chat simulation arena, and instant coaching feedback.
- [About Chat2Sell](${siteUrl}/about): Mission, founder background, and why revenue teams use simulation to master closing without burning live pipeline.
- [Product Changelog](${siteUrl}/changelog): Release history, feature updates, and the evolving product roadmap.
- [Support & Contact](${siteUrl}/support): Customer assistance, simulation help, workspace inquiries, and team contact options.

## User Playbook & Documentation

- [Documentation & User Playbook](${siteUrl}/docs): Complete playbook for crafting high-impact sales scenarios, conducting objection drills, and interpreting Jev scores.

## Subscription Plans & Pricing

- [Plans & Pricing](${siteUrl}/pricing): Transparent tiers (Starter, Pro, Scale) with seat limits, simulation quotas, and feature breakdowns.

## Legal, Trust & Security Disclosures

- [Terms of Service](${siteUrl}/terms): Platform terms and conditions, acceptable use policies, and AI simulation disclaimers.
- [Privacy Policy](${siteUrl}/privacy): Data protection practices, subprocessor disclosures, and GDPR/CCPA privacy rights.
- [Security & Zero-Training Architecture](${siteUrl}/security): Multi-tenant database isolation (PostgreSQL RLS) and zero foundation model training pledge.
- [AI Safety & Acceptable Use Policy](${siteUrl}/acceptable-use): Guidelines for safe AI simulation usage, prompt injection protections, and prohibited activities.
- [Subprocessors Directory](${siteUrl}/subprocessors): Complete listing of third-party infrastructure and service partners authorized to process data.
- [Cookie Policy](${siteUrl}/cookies): Inventory of strictly necessary authentication cookies and our zero-tracking commitment.
- [Refund & Cancellation Policy](${siteUrl}/refund): 14-day refund eligibility criteria, cancellation terms, and Merchant of Record disclosures.

## Optional

- [Full Content Ingestion](${siteUrl}/llms-full.txt): Complete consolidated markdown compilation of all public platform pages, playbooks, and policies in a single document for deep agent reasoning.
`;

  return new NextResponse(content.trim(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
