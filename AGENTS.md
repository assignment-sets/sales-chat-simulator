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
