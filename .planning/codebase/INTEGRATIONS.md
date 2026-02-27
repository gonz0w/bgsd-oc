# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Brave Search API (optional):**
- Purpose: Web search during research phases
- SDK/Client: Node.js native `fetch()` (built-in since Node 18)
- Auth: `BRAVE_API_KEY` environment variable or `~/.gsd/brave_api_key` file
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Implementation: `src/commands/misc.js` (`cmdWebsearch`, lines 1136-1197)
- Config toggle: `brave_search` in `.planning/config.json` (default: `false`)
- Graceful degradation: If no API key, returns `{ available: false }` silently — agent falls back to built-in WebSearch tool
- Parameters: query, count, country, search_lang, freshness

**No other external APIs.** This is a local-only CLI tool. All other operations use the local filesystem and git.

## Git Integration

**Git is the primary external dependency** — used pervasively across the codebase:

- **Client:** `execFileSync('git', args)` via `src/lib/git.js` (`execGit` wrapper)
- **No shell spawning:** Uses `execFileSync` directly, bypassing shell interpretation for security and ~2ms performance gain per call
- **Operations performed:**
  - Commit creation (`src/commands/misc.js` — `cmdCommit`)
  - Diff and log queries for session tracking (`src/commands/features.js`)
  - Worktree create/list/remove/merge/cleanup (`src/commands/worktree.js`)
  - Branch management for phase/milestone branching strategies
  - `git check-ignore` for respecting `.gitignore` during file scanning
  - `git rev-parse`, `git rev-list` for staleness detection
  - `git diff --name-only` for incremental codebase analysis
- **Config:** Branching strategy configurable via `branching_strategy`, `phase_branch_template`, `milestone_branch_template` in `.planning/config.json`

## Data Storage

**Databases:**
- None. All data stored as files.

**File Storage (local filesystem only):**
- `.planning/` directory tree — all project state, plans, phases, config
- `.planning/STATE.md` — Project state (current phase, progress, decisions, blockers)
- `.planning/ROADMAP.md` — Phase definitions and milestone tracking
- `.planning/config.json` — Per-project configuration
- `.planning/phases/` — Phase directories with PLAN.md, SUMMARY.md, RESEARCH.md files
- `.planning/codebase/codebase-intel.json` — Codebase analysis cache (auto-generated)
- `.planning/env-manifest.json` — Environment scan cache (gitignored, machine-specific)
- `.planning/project-profile.json` — Committed project structure profile
- `.planning/memory/` — Persistent memory stores (bookmarks, decisions, lessons, test baselines, quality scores)
- `.planning/milestones/` — Archived milestone phase directories
- `.planning/baselines/bundle-size.json` — Build size tracking

**Temporary files:**
- Large JSON payloads (>50KB) written to `os.tmpdir()` as `gsd-*.json`
- Cleaned up on process exit via `process.on('exit')` handler in `src/lib/output.js`

**Caching:**
- In-memory caches per CLI invocation (no cross-invocation persistence):
  - `fileCache` — File content cache (`src/lib/helpers.js`)
  - `dirCache` — Directory listing cache (`src/lib/helpers.js`)
  - `_phaseTreeCache` — Phase directory tree (`src/lib/helpers.js`)
  - `_configCache` — Config.json parse cache (`src/lib/config.js`)
  - `_fmCache` — Frontmatter parse cache with LRU eviction at 100 entries (`src/lib/frontmatter.js`)
  - `_dynamicRegexCache` — Regex compilation cache with LRU eviction at 200 entries (`src/lib/regex-cache.js`)
  - `_milestoneCache` — Milestone info cache (`src/lib/helpers.js`)

## Authentication & Identity

**Auth Provider:**
- None. This is a local CLI tool with no user authentication.
- The only credential is the optional `BRAVE_API_KEY` for web search.
- MCP server configs may reference auth tokens in `.mcp.json` or `opencode.json` but gsd-tools reads only server names, not credentials.

## AI Agent Integration

**OpenCode (host environment):**
- gsd-tools runs as a plugin inside the OpenCode AI coding assistant
- Communication: CLI invocation (`node bin/gsd-tools.cjs <command>`) from agent workflows
- Workflow definitions: `workflows/*.md` — 44 workflow files (agent prompts)
- Command wrappers: `commands/*.md` — 11 slash command definitions
- Agent system prompts: Deployed to `~/.config/opencode/agents/` (not in this repo)
- Reference docs: `references/*.md` — 13 reference documents loaded by agents
- Templates: `templates/*.md` — 28 document templates for plans, state, summaries, etc.

**Model Profile System:**
- Manages AI model selection across agent types
- Profiles: `quality`, `balanced`, `budget` — defined in `src/lib/constants.js` (`MODEL_PROFILES`)
- Agent types: `gsd-planner`, `gsd-executor`, `gsd-verifier`, `gsd-codebase-mapper`, etc.
- Model options: `opus` (mapped to `inherit`), `sonnet`, `haiku`
- Per-agent overrides via `model_overrides` in config
- Resolution: `src/lib/helpers.js` (`resolveModelInternal`)

**MCP Server Profiling:**
- Discovers MCP servers from `.mcp.json`, `opencode.json`, `~/.config/opencode/opencode.json`
- Estimates token cost per server against context window budget
- Generates keep/disable/review recommendations
- Can apply recommendations by setting `enabled: false` in `opencode.json`
- Implementation: `src/commands/mcp.js`
- Known server database: 19 servers (postgres, github, brave-search, context7, terraform, docker, redis, rabbitmq, slack, linear, notion, sentry, datadog, etc.)

## Token Budget Management

**Context window tracking:**
- Estimates tokens using `tokenx` library (~96% accuracy)
- Fallback: `Math.ceil(text.length / 4)` if tokenx unavailable
- Default context window: 200,000 tokens
- Configurable target utilization: `context_target_percent` (default: 50%)
- Implementation: `src/lib/context.js`
- Commands: `context-budget`, `token-budget` in `src/commands/features.js`

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)

**Logging:**
- Debug logging to stderr via `debugLog()` in `src/lib/output.js`
- Enabled by `GSD_DEBUG` environment variable
- Format: `[GSD_DEBUG] context: message | error`
- Status messages via `status()` to stderr (visible even when stdout is piped)

**Metrics:**
- Execution velocity tracking: `src/commands/features.js` (`cmdVelocity`)
- Quality scores with trend tracking: stored in `.planning/memory/quality-scores.json`
- Bundle size tracking: `.planning/baselines/bundle-size.json`
- Build timing: logged to stdout during `npm run build`

## CI/CD & Deployment

**Hosting:**
- Local filesystem plugin (not a hosted service)
- Deployed to `~/.config/opencode/get-shit-done/` via `deploy.sh`

**CI Pipeline:**
- None configured in this repository
- Build validation: `npm run build` (includes smoke test and bundle size check)
- Test suite: `npm test` (574+ tests via `node --test`)

## Environment Detection Engine

**Auto-detects target project environments** (for the projects gsd-tools manages, not itself):
- Implementation: `src/commands/env.js`
- Scans for 26 language manifest patterns (package.json, go.mod, mix.exs, Cargo.toml, etc.)
- Detects package managers from lockfiles (npm, pnpm, yarn, bun, mix, cargo, poetry, etc.)
- Detects version managers (asdf, mise, nvm, pyenv, rbenv, goenv)
- Detects CI platforms (GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis)
- Detects test frameworks, linters, formatters
- Detects Docker/infrastructure services from compose files
- Detects MCP servers from `.mcp.json`
- Detects monorepo/workspace configurations
- Output: `.planning/env-manifest.json` (gitignored) and `.planning/project-profile.json` (committed)
- Staleness detection via watched file mtimes — auto-rescans when manifests change

## Codebase Analysis Engine

**Auto-analyzes target project codebases:**
- Implementation: `src/lib/codebase-intel.js`, `src/commands/codebase.js`
- Walks source directories, analyzes files (language, lines, size, mtime)
- Supports 40+ file extensions across 30+ languages
- Incremental analysis via git diff (only re-analyzes changed files)
- Staleness detection: git commit hash comparison, mtime fallback
- Convention detection: naming patterns, file organization, framework patterns (`src/lib/conventions.js`)
- Dependency graph: multi-language import parsing (JS/TS, Python, Go, Elixir, Rust) with resolution (`src/lib/deps.js`)
- Lifecycle detection: migration ordering, config/boot chains (`src/lib/lifecycle.js`)
- Impact analysis: transitive dependents via BFS on reverse edges
- Cycle detection: Tarjan's SCC algorithm
- Output: `.planning/codebase/codebase-intel.json`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (except the optional Brave Search API call)

---

*Integration audit: 2026-02-26*
