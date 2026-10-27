<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Architecture & Engineering Rules

Refer to the modular rule definitions maintained under [`.agents/rules/`](file:///.agents/rules/):

- **Workspace Rules**: [`.agents/rules/project-rules.md`](file:///.agents/rules/project-rules.md) — Git conventions, documentation constraints, build optimizations, and CLI guidelines.
- **Frontend & UI Rules**: [`.agents/rules/frontend-rules.md`](file:///.agents/rules/frontend-rules.md) — Component-first design, minimalist UI standards, zero layout shifts, and loader consistency.
- **Backend & API Rules**: [`.agents/rules/backend-rules.md`](file:///.agents/rules/backend-rules.md) — Standardized responses, defense-in-depth tenant scoping, rate limiting policies, and authorized tenant caching.

