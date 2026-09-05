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
