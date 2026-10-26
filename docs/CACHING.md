# Caching

SalesChat uses **Upstash Redis** as a cache-aside (read-through) store for a
few expensive, org-scoped read paths. It shares one lazy client with rate
limiting (`lib/redis.ts`), so rate limits and cache entries live in the same
database and no additional setup is required.

This is application-level caching only. We deliberately do **not** use
`unstable_cache` (deprecated in Next 16) or `use cache` / `cacheLife` /
`cacheTag` (needs a PPR/`cacheComponents` migration). Pages and routes stay
dynamic; only the loader functions are wrapped.

## Files

| File | Purpose |
| --- | --- |
| `lib/redis.ts` | Shared lazy Upstash client + placeholder credential detection |
| `lib/cache/index.ts` | `cached()` read-through helper and `invalidate()` |
| `lib/cache/keys.ts` | Tenant-scoped key builders |
| `lib/cache/policies.ts` | TTLs (`CACHE_TTLS`) |

## Key format

All keys start with `cache:v1:` and always carry their tenant scope. Bump the
`v1` segment when a cached shape changes in a breaking way.

| Helper | Key |
| --- | --- |
| `dashboardKey(orgId)` | `cache:v1:dashboard:org:<orgId>` |
| `pricingKey(orgId)` | `cache:v1:pricing:org:<orgId>` |
| `transcriptKey(orgId, chatId)` | `cache:v1:transcript:org:<orgId>:chat:<chatId>` |
| `memberChatsKey(orgId, userId)` | `cache:v1:memberchats:org:<orgId>:user:<userId>` |

Never build a key inline in a route handler and never omit the org (or user)
segment — a shared entry without tenant scope is a data leak.

## TTLs

TTLs live in `lib/cache/policies.ts`. Each write also adds a random jitter of
`0…ceil(ttl * 0.1)` seconds so keys written together do not expire together.

| Data | TTL |
| --- | --- |
| Team dashboard payload | 60s |
| Pricing page usage counters | 30s |
| Admin chat transcript | 300s |
| Member simulations list | 60s |

The value is stored as an envelope `{ v: 1, d: <payload> }`; unknown versions
are treated as misses. `null`/`undefined` results are never written, so a
missing resource is not negatively cached.

## What is cached

Only after authentication, active-organization resolution, role checks and
(where applicable) `requireFeature` have run:

- `GET /api/dashboard` — members RPC, org chats, message stats and all
  aggregation. The payload is **org-scoped only** (`kpis`, `analytics`,
  `members`, `organization`); `currentUserRole` is added per caller outside the
  cache.
- `GET /api/dashboard/chats/[chatId]` — the simulation row plus its full
  message history. A 404 (chat not in this org) is never cached.
- `GET /api/dashboard/members/[userId]/chats` — that member's simulations in
  the active org.
- `/pricing` — only the three `COUNT` queries (`simulationsUsedThisMonth`,
  `seatsUsed`). Organization details stay live.

## What is deliberately not cached

- **Live chat reads** — `GET /api/chats`, `GET /api/chats/[id]/messages` and
  the in-simulation chat detail. They are per-request, cursor-paginated and
  must reflect the user's own latest turns immediately.
- **AI feedback text** — already cached in Postgres via `chats.ai_feedback`
  and returned with `X-Cached: true`, so Redis would be a second cache.
- **Auth results** — `supabase.auth.getUser()`, cookies, headers and anything
  derived from them. Cached loaders must never call `cookies()` or
  `headers()`.
- **`GET /api/chats`** — unused by the current UI; not worth a key.
- **Errors** — loader exceptions and `null` results are never stored.

## Invalidation

Invalidation is awaited (best-effort) **after** the database write succeeds:

| Write | Keys invalidated |
| --- | --- |
| `POST /api/chats` | dashboard(org), pricing(org), memberChats(org, author) |
| `POST /api/chats/[id]/messages` | dashboard(org), transcript(org, chat), memberChats(org, author) |
| `POST /api/chats/[id]/reply` | dashboard(org), transcript(org, chat), memberChats(org, author) |
| `POST /api/chats/[id]/feedback` | dashboard(org), transcript(org, chat) |
| `POST /api/organizations/[id]/members` (invite) | pricing(org) |

Legacy chats without `organization_id` skip invalidation instead of building
`undefined` keys. Organization switches, tier changes and plain reads do not
invalidate anything; the short TTLs cover those.

## Fail-open behaviour

- Any Redis read/write error logs `[Cache] error …` and falls through to the
  loader. A Redis outage degrades to "slightly slower", never a 500.
- `invalidate()` swallows all errors and never throws, including a missing
  client, so it can be awaited inline in a response path.
- If Upstash credentials are absent or placeholders, the shared client stays
  `null` (one warning at startup) and every loader runs uncached — identical
  to `CACHE_DISABLED=true`.

Misses log `[Cache] miss key=<key>` exactly once per key per TTL. Hits are not
logged, which keeps log volume flat.

## Disabling

Set `CACHE_DISABLED=true` to bypass reads and writes entirely (local load
tests, debugging stale data). This is independent of `RATE_LIMIT_DISABLED`.

## Verifying locally

1. Sign in as an owner/admin and open **Team Oversight** (`/api/dashboard`).
   The log shows `[Cache] miss key=cache:v1:dashboard:org:<orgId>`.
2. Reload. No new miss line; the response is served from Redis.
3. In the Upstash console, inspect that key: it holds `{"v":1,"d":{…}}` with a
   TTL slightly above 60s (TTL + jitter).
4. Send a message or create a simulation, then reload the dashboard — the key
   should be gone and the next load misses again.

## Future work

`supabase.auth.getUser()` runs 2–3 times per navigation (page, route handler,
`getActiveOrganization` helpers), and each call hits Supabase Auth. Swapping
those calls to `supabase.auth.getClaims()`, which verifies the JWT locally,
would remove most of that latency. That is a separate follow-up across auth,
tenant and route code and is **not** implemented here.
