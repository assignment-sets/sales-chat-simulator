<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend & UI Architecture Rules

1. **Component-First Design**: When building any UI feature, extract and construct reusable components (`components/ui/`, `components/chat/`, etc.) first before assembling page layouts.
2. **Minimal & Clutter-Free UI**: Never overwhelm the user with walls of text, dense instructional paragraphs, duplicate buttons, bloated placeholders, or cramped spacing. Keep copy crisp, minimal, and non-intimidating.
3. **Zero Layout Shifts**: Never render expanding inline error/message banners that alter container shapes or heights. Use the centralized toast utility (`lib/toast.ts`) for all user feedback.
4. **Standard 3-Dot Loader**: Use the shared 3-dot loader component (`components/ui/Loader.tsx`) for loading states, async actions, and screen transitions (`loading.tsx`).

## Backend & API Architecture Rules

1. **Standardized API Responses & Sanitized Errors**: Always use `lib/api-response.ts` (`apiSuccess`, `apiError`, `badRequest`, `unauthorized`, `notFound`, `internalError`) for API routes. Never return raw internal error messages (`error.message`, database/PostgREST errors, or third-party SDK exceptions) to the client — log internal details on the server and return sanitized user-facing messages.
2. **Dual-Check Tenant Scoping (Defense-in-Depth)**: Never rely solely on RLS. Always explicitly filter by `.eq("organization_id", orgId)` (and `.eq("user_id", user.id)` when role is `member`) on all database queries and use `validateChatAccess` (`lib/chat-auth.ts`) when accessing chat sub-resources. For deletions, select the deleted rows to verify affected count and return 404 if no rows were deleted.
3. **Rate Limit Expensive Routes**: Every AI/mutation route must call `enforceRateLimit`/`enforceRateLimits` from `lib/rate-limit` after authentication and before DB/LLM work. Keep limits in `lib/rate-limit/policies.ts` — never inline numbers in route handlers. Rate limiting is separate from plan quotas (`lib/entitlements.ts`): quotas return `403`, rate limits return `429`.
4. **Tenant-Scoped Caching Only After Authorization**: Cache only after authentication, active-organization resolution and role/feature checks have run. Every cache key must carry its tenant scope (`orgId`, plus `userId` when the value varies per user) — never cross tenants. Always use the `lib/cache` helpers (`cached`, `invalidate`, keys from `lib/cache/keys.ts`, TTLs from `lib/cache/policies.ts`); never inline cache keys or call Redis directly from a route. Never cache auth results, cookies, request objects, or per-request conversation data. See `docs/CACHING.md`.
