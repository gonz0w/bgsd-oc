# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

**Brave Search API:**
- Purpose: Web search during project research phases
- Implementation: `bin/gsd-tools.cjs` lines 2111-2173, function `cmdWebsearch()`
- Uses native `fetch()` to call `https://api.search.brave.com/res/v1/web/search`
- Auth: `BRAVE_API_KEY` environment variable or `~/.gsd/brave_api_key` file
- Optional integration — gracefully degrades when not configured
- Config flag: `brave_search` in `.planning/config.json`
- Detection: Auto-detected during `config-ensure-section` and `init new-project`

**OpenCode AI Assistant (Host Environment):**
- Purpose: The runtime that executes GSD workflows
- Not called via API — GSD is a plugin *within* OpenCode
- Workflows in `workflows/*.md` are LLM prompts that OpenCode's agent system executes
- Workflows invoke `bin/gsd-tools.cjs` via `node` for data operations
- Agents defined in `~/.config/opencode/agents/` (not in this repo — deployed separately)
- Commands defined in `~/.config/opencode/command/` (thin wrappers to workflows)
- Hooks defined in `~/.config/opencode/hooks/` (JS scripts for statusline, update checks)
- Hard-coded path in all workflows: `/home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs`

## Databases

**None.** All state is stored as markdown files and JSON in the `.planning/` directory tree.

## CLI Tools

**Git (critical dependency):**
- Wrapper: `execGit(cwd, args)` function at `bin/gsd-tools.cjs` line 221
- Used for all VCS operations via `child_process.execSync`
- Git operations performed:
  - `git add` + `git commit` — Planning doc commits (`cmdCommit()` line 1491)
  - `git check-ignore` — Detect gitignored paths (`isGitIgnored()` line 209)
  - `git rev-parse --verify` — Validate commit hashes (`cmdVerifyCommits()`)
  - `git log` — Session diffs, velocity calculations, rollback info
  - `git diff-tree` — File lists for commit analysis
  - `git diff --name-only` — Changed file detection
  - `git checkout -b` / `git checkout` — Branch management (phase/milestone strategies)
  - `git revert` — Rollback command generation (not executed, just suggested)
- Branch templates: `gsd/phase-{phase}-{slug}`, `gsd/{milestone}-{slug}`
- Commit message conventions: `docs:`, `chore:`, `wip:`, `test():`

**find (Unix):**
- Used in `cmdInitNewProject()` (line 4460) for brownfield codebase detection
- Searches for source files (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.swift`, `.java`)

**grep (Unix):**
- Used in `cmdCodebaseImpact()` (line 5628) for dependency analysis
- Searches for import/use patterns across source files (`.ex`, `.exs`, `.go`, `.py`, `.ts`, `.tsx`, `.js`)

**Node.js:**
- Required on PATH — all workflows invoke `node /path/to/gsd-tools.cjs` directly
- Minimum version: 18 (for `fetch()` global and `node:test`)

## File System

**Installation directory:**
- `~/.config/opencode/get-shit-done/` — Production plugin location
- Contains: `bin/`, `workflows/`, `templates/`, `references/`, `VERSION`

**User configuration directory:**
- `~/.gsd/defaults.json` — Global user defaults (merged into new project configs)
- `~/.gsd/brave_api_key` — Optional Brave Search API key file

**Project directory (`.planning/`):**
- `.planning/config.json` — Project-specific GSD configuration
- `.planning/PROJECT.md` — Project brief
- `.planning/STATE.md` — Current execution state (active phase, blockers, decisions)
- `.planning/ROADMAP.md` — Phase breakdown with progress tracking
- `.planning/REQUIREMENTS.md` — Project requirements with traceability IDs
- `.planning/phases/` — Phase directories (e.g., `01-foundation/`, `02-api/`)
  - `{NN}-{MM}-PLAN.md` — Execution plans with YAML frontmatter
  - `{NN}-{MM}-SUMMARY.md` — Completion summaries with YAML frontmatter
  - `{NN}-CONTEXT.md` — Phase context documents
  - `{NN}-UAT.md` — User acceptance test results
  - `{NN}-VERIFICATION.md` — Phase verification reports
  - `.continue-here.md` — Session continuation markers
- `.planning/codebase/` — Codebase analysis documents (STACK.md, ARCHITECTURE.md, etc.)
- `.planning/todos/pending/` — Pending todo items (markdown files)
- `.planning/todos/completed/` — Completed todo items
- `.planning/milestones/` — Archived milestone data
- `.planning/research/` — Research output documents

**Temp directory (`os.tmpdir()`):**
- Used for large JSON output overflow when response exceeds 50KB
- Pattern: `gsd-${Date.now()}.json`
- Output prefixed with `@file:` for caller detection

## Data Flow: CLI ↔ Workflows

Workflows (markdown files) are LLM prompts. They call `gsd-tools.cjs` for structured data:

```
OpenCode Agent → reads workflow/*.md → executes bash blocks →
  node gsd-tools.cjs <command> → reads .planning/ files →
    returns JSON to stdout → agent parses and acts
```

**Output protocol:**
- Default: JSON to stdout (structured data for agents to parse)
- `--raw` flag: Plain text to stdout (human-readable values)
- Large payloads (>50KB): Written to temp file, stdout gets `@file:/path/to/file.json`

**All 32 workflows** invoke `gsd-tools.cjs` with hard-coded absolute path:
```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs <command>
```

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None (Brave Search is a pull-based API call, not a webhook)

## Authentication & Identity

**No user authentication.** The tool runs locally with the user's filesystem and git permissions.

**Service auth:**
- Brave Search: API key via `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file

## Monitoring & Observability

**Error Tracking:** None — errors written to stderr
**Logs:** No structured logging. CLI uses `process.stderr.write()` for errors and `process.stdout.write()` for results.
**Metrics:** Built-in velocity tracking (`cmdVelocity()`) reads git history for plans/day calculations

## CI/CD & Deployment

**CI Pipeline:** None
**Hosting:** Local filesystem plugin (not a deployed service)
**Deployment:** Manual via `deploy.sh` — copies files to `~/.config/opencode/get-shit-done/`
**Backup:** `deploy.sh` creates timestamped backup at `~/.config/opencode/get-shit-done.bak-YYYYMMDD-HHMMSS`

---

*Integration audit: 2026-02-21*
