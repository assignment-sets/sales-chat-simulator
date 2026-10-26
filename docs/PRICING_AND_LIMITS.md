# SalesChat — Pricing Tiers, Limits & Feature Matrix

## 1. Core Philosophy: Why We Do NOT Meter by Raw AI Tokens

1. **Simplicity Over Friction**: Buyers (sales managers and reps) buy *practice and coaching*, not raw compute. A quota of *"50 simulations per month"* is immediately understandable; *"400,000 Groq tokens"* creates cognitive overhead.
2. **Never Cut Off Mid-Conversation**: Roleplay conversations should never fail halfway through because a hidden token meter ran out. Gate checks happen **only when creating a new simulation** (`POST /api/chats`).
3. **Turn Counts Belong to Scenarios, Not Pricing**: Roleplays naturally vary—some objections take 8 turns, others take 20. Turn counts are a **simulation scenario parameter** (e.g., test time limits), not a tier restriction.
4. **Natural Abuse Protection**: TypeSafe AI Jev automatically concludes chats as `deal_won` or `deal_lost` once an agreement or impasse is reached, preventing runaway conversations.

---

## 2. Tier Structure & Limits

The product uses a **Flat Organization Tier Model** with monthly simulation pools and seat bands.

| Dimension / Limit | **Starter** (Free) | **Pro** (Team / Growth) | **Scale** (Enterprise) |
| :--- | :--- | :--- | :--- |
| **Target Audience** | Solo SDR / Individual rep testing the tool | Sales pod / SDR team (up to 10 reps) | Full sales organization |
| **Monthly Price (Indicative)** | **$0** (Free forever) | **$79 / month** (Flat org fee) | **$249 / month** (Flat org fee) |
| **Team Seats (Members + Pending)** | **1 Seat** (Owner only, invites disabled) | **Up to 10 Seats** | **Up to 50 Seats** |
| **Simulations / Month (Org Pool)** | **15 Simulations / month** | **150 Simulations / month** | **600 Simulations / month** |
| **Turn Limit per Chat** | **No tier cap** *(natural Jev conclusion)* | **No tier cap** *(natural Jev conclusion)* | **No tier cap** *(natural Jev conclusion)* |

> [!NOTE]
> All monthly simulation counters reset on the **1st of each calendar month** (UTC).

---

## 3. Feature Gate Matrix (Premium vs. Free)

Instead of complicated token budgets, subscription tiers are differentiated by high-value capabilities:

| Feature Area | **Starter** (Free) | **Pro** (Team) | **Scale** (Enterprise) |
| :--- | :---: | :---: | :---: |
| **Interactive Sales Roleplay** | Included | Included | Included |
| **Automated Jev Evaluation (Win/Loss + 1–5 Score)** | Included | Included | Included |
| **Turn Feedback Summary Card** | Included | Included | Included |
| **Client-side Markdown Transcript Export** | Included | Included | Included |
| **Detailed AI Coaching Breakdown** (`DetailedFeedbackModal`) | Gated / Locked (Upgrade Hook) | Included (Unlimited) | Included (Unlimited) |
| **Team Oversight Dashboard** (`TeamDashboard`) | Personal stats only | Included (Full Team) | Included (Full Team) |
| **Rep Performance Benchmarks & Charts** | Locked | Included | Included |
| **Manager Transcript Drawer Inspection** | Locked | Included | Included |
| **Custom Scenario Templates & Turn Deadlines** *(Roadmap)* | Standard templates only | Custom personas & rubrics | Custom personas & rubrics |

---

## 4. Enforcement Architecture (Implementation Reference)

When ready to enforce in code, limits are checked at specific API endpoints using simple queries:

### 1. Monthly Simulations Limit
- **Enforced at**: `POST /api/chats`
- **Logic**:
  ```sql
  SELECT COUNT(*) FROM public.chats
  WHERE organization_id = :org_id
    AND created_at >= date_trunc('month', now());
  ```
- **Behavior**: If count >= tier limit, return `403 Forbidden` (`Simulations quota reached for this month. Upgrade to Pro for more sessions.`).

### 2. Team Seats Limit
- **Enforced at**: `POST /api/organizations/[id]/members` (or invitation creation)
- **Logic**:
  ```sql
  SELECT COUNT(*) FROM public.organization_members
  WHERE organization_id = :org_id;
  ```
- **Behavior**: If count >= tier seat cap, return `403 Forbidden` (`Seat limit reached for this tier.`).

### 3. Detailed AI Coaching Feature Gate
- **Enforced at**: `POST /api/chats/[id]/feedback`
- **UI Behavior**: On the `SimulationConclusionCard`, if the organization is on `Starter`, the `"Get Detailed AI Feedback"` button displays a badge or triggers an upgrade modal rather than calling the API.
- **API Behavior**: If a direct request hits the endpoint for a `Starter` org, return `403 Forbidden` with a standardized upgrade requirement.

---

## 5. Unit Economics & Margin Safety

With Groq LLM + TypeSafe AI Jev:
- **Average Simulation**: ~10–15 messages = **~$0.03 – $0.05** total compute cost.
- **Starter (15 sims/mo)**: Maximum monthly compute cost per free user is **~$0.50 – $0.75**.
- **Pro ($79/mo for 150 sims)**: Maximum monthly compute cost at 100% quota utilization is **~$6 – $9** (**>88% gross margin**).
- **Scale ($249/mo for 600 sims)**: Maximum monthly compute cost at 100% quota utilization is **~$24 – $36** (**>85% gross margin**).
