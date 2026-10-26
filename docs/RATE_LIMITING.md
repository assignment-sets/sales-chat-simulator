# Rate Limiting

SalesChat uses **Upstash Redis** (`@upstash/ratelimit`) for application-level
rate limiting and an optional **Vercel WAF** rate-limit rule as a coarse outer
shield.

Rate limiting protects burst abuse and LLM spend. It is **separate** from plan
quotas in `lib/entitlements.ts`:

- Quota exhausted → `403` (monthly simulations, team seats)
- Too many requests → `429` with `Retry-After` and `X-RateLimit-*` headers

## Setup

### 1. Upstash Redis

1. Vercel dashboard → **Storage / Marketplace** → **Upstash Redis** → create a
   database in the same region as your functions (default `iad1`).
2. Connect it to the project for **Production**, **Preview**, and
   **Development**. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Locally, copy those two values into `.env` (or set the equivalent
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
4. `RATE_LIMIT_DISABLED=true` bypasses all checks (useful for load tests).

Until real credentials are set, the limiter logs a warning once and stays
disabled. This keeps local development and `next build` working.

### 2. Vercel WAF rule (free tier)

Hobby allows **one** rate-limit rule per project. Configure it in
**Firewall → Configure → New Rule** (it cannot be declared in `vercel.json`):

| Field | Value |
| --- | --- |
| If | `Request Path` starts with `/api/chats` **AND** `Method` equals `POST` |
| Then | **Rate Limit** |
| Algorithm | Fixed Window |
| Window | `60s` |
| Request limit | `120` |
| Key | `IP` |
| Action | `429` (start with **Log** for ~10 minutes to validate) |

This covers the routes that can spend Groq/Jev money: `reply`, `feedback`,
`messages`, and simulation creation.

> WAF counters are tracked **per region**, so a client routed to multiple
> regions can exceed the limit you configure in any single region. The Upstash
> layer remains the precise, global limit.

## Policies

All policies live in `lib/rate-limit/policies.ts`. Keys are namespaced by
policy and prefixed in Redis as `rl:<policy>`.

| Route | Key | Burst | Sustained |
| --- | --- | --- | --- |
| `POST /api/chats/[id]/reply` | `u:<userId>` | 10 / min | 150 / hour |
| `POST /api/chats/[id]/reply` | `o:<orgId>` | 40 / min | — |
| `POST /api/chats/[id]/feedback` | `u:<userId>` | 5 / 10 min | 30 / day |
| `POST /api/chats` | `u:<userId>` | 5 / min | 100 / day |
| `POST /api/chats/[id]/messages` | `u:<userId>` | 20 / min | 300 / hour |
| `POST /api/organizations` | `u:<userId>` | 2 / hour | 10 / day |
| `POST /api/organizations/[id]/members` | `o:<orgId>` | 10 / hour | 30 / day |
| `POST /api/organizations/switch` | `u:<userId>` | 60 / min | — |
| `POST /api/organizations/tier` | `o:<orgId>` | 10 / hour | — |

Additional non-rate guards:

- Messages and product descriptions are capped at **2,000 characters**;
  product names at **120**.
- Simulations stop generating prospect replies after **40 user turns**.
- A user can own at most **3 organizations**, limiting free-tier quota farming.
- Per-conversation Redis locks prevent duplicate concurrent LLM generations:
  `reply` 45s, `feedback` 120s.

## Behavior

- **Fail open**: Redis errors/timeouts allow the request and log an error. The
  WAF rule still protects the expensive paths.
- **Sliding windows** via `Ratelimit.slidingWindow`, 1s SDK timeout,
  ephemeral cache per limiter, analytics disabled to keep command usage low.
- Rate-limit helpers are called **after authentication** and **before** DB or
  LLM work, so unauthorised requests are not counted against a user.
- Use `enforceRateLimit(name, identifier)` for one check or
  `enforceRateLimits(...)` for several. Policies must never be inlined in a
  route handler.

## Tuning

Watch `[RateLimit] blocked` lines in Vercel logs and Upstash command usage.
Adjust limits in `lib/rate-limit/policies.ts`; the route code does not change.
If 429s appear during normal practice, raise the relevant burst first, then the
sustained limit.
