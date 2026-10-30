import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

  const content = `# SalesChat

> SalesChat is an interactive AI sales simulation and coaching platform where sales representatives, account executives, and revenue teams practice live objection handling and sales negotiation against dynamic AI buyer personas.

## Overview & Core Capabilities

- **Interactive AI Roleplay Simulations**: Practice live sales conversations and objection handling drills against realistic buyer prospect personas with differing negotiation styles, company stages, and budget constraints.
- **Automated Turn Scoring & Evaluation**: Turn-by-turn simulation analysis evaluated by the Jev decision engine, providing 1–5 scoring rubrics across Discovery, Objection Handling, Value Articulation, and Negotiation.
- **Personalized Coaching & Feedback**: Real-time actionable suggestions to improve pitch clarity, avoid pushy rhetoric, and steer prospects toward closing milestones.
- **Team Oversight Dashboard**: Sales managers and leadership gain visibility into team performance benchmarks, rep win/loss rates, and objection mastery metrics.

## Pricing Plans & Workspace Tiers

- **Starter Plan**: Ideal for individual sales reps. Includes 1 practice seat, standard AI prospect simulation turns, and fundamental performance scoring.
- **Pro Plan**: Designed for high-performing sales professionals and small teams. Includes 5 workspace seats, expanded monthly simulation quota, detailed AI coaching breakdowns, and full Team Oversight Dashboard analytics.
- **Scale Plan**: Built for growing revenue teams and enterprise sales forces. Includes 20 workspace seats, high-volume simulation quota, priority ultra-low latency inference, custom objection scenarios, and centralized seat administration.

## Privacy, Security & AI Commitments

- **Zero Foundation Model Training**: SalesChat does not use customer simulation transcripts, practice messages, internal objection playbooks, or coaching evaluations to train public AI foundation models.
- **Multi-Tenant Isolation**: Rigorous tenant segregation enforced through PostgreSQL Row Level Security (RLS) policies and private organization boundaries.
- **Strictly Necessary Cookies Only**: SalesChat utilizes only essential authentication and workspace session cookies (Supabase Auth and active organization retention). Zero advertising cookies, marketing pixels, or third-party behavioral trackers are deployed.

## Canonical Public Links

- [Platform Overview](${siteUrl}): Product features, AI simulation overview, and core capabilities.
- [Pricing Plans](${siteUrl}/pricing): Detailed subscription breakdown, seat capacity, and quota limits.
- [Terms of Service](${siteUrl}/terms): Platform terms, acceptable use policy, and AI simulation disclaimers.
- [Privacy Policy](${siteUrl}/privacy): Data protection practices, subprocessor disclosures, and GDPR/CCPA rights.
- [Cookie Policy](${siteUrl}/cookies): Inventory of strictly necessary authentication cookies and zero-tracking commitment.
`;

  return new NextResponse(content.trim(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
