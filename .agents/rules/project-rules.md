# Workspace Rules

### Documentation & File Management
- **No walkthrough files:** Do not create, update, or generate `walkthrough.md` or any walkthrough-related markdown files.
- **Reference documentation:** Use the `find-docs` tool or `ctx7` skill to retrieve up-to-date documentation.

### Version Control & Git
- **No unsolicited commits:** Never stage, commit, or push changes to Git unless explicitly instructed.
- **Prevent formatting diffs:** Run `npm run lint` before finalizing work to keep git diffs clean.

### Build & Execution
- **Avoid redundant builds:** Do not run `npm start` or `npm build` for changes that do not affect runtime behavior (e.g., documentation, comments, formatting, or minor asset updates).
- **Concurrency:** Dispatch parallel subagents for independent, decoupled tasks to optimize execution speed.

### CLI & Integrations
- **Supabase:** Use `npx supabase` for all database operations and project management.
- **Vercel:** Use the `vercel` CLI to check deployment status, inspect project info, and manage deployments.
