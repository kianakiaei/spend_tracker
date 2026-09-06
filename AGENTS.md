# AGENTS.md

## Git workflow

### Commits

Commit after every meaningful step — small, logical commits (one step = one commit), so no work is ever lost. Keep each commit to one coherent change and write a short message saying what changed and why. Never leave hours of work uncommitted, and never bundle many unrelated changes into one big commit.

### Git ignore

A root `.gitignore` covers the Node.js (pnpm) frontend and backend projects (dependencies, build output, logs, env/secrets, caches, local databases). Whenever you create a file that must not be tracked — secrets/`.env` files, build artifacts, caches, logs, scratch data, local DB files — add it to `.gitignore` in the same step, and mention it in the commit.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
