# GSD Plugin for OpenCode

## What This Is

A zero-dependency, single-file Node.js CLI built from 16 organized `src/` modules via esbuild, producing `bin/gsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows running in OpenCode. v1.0 established the test suite, module split, and observability layer. v1.1 added context reduction across all workflow layers (46.7% CLI output reduction, 54.6% workflow compression, 67% reference file reduction). v2.0 added state validation, atomic plan decomposition, cross-session memory, comprehensive verification (quality scoring, regression detection), integration testing (297 tests), and dependency/token optimization. v3.0 added intent engineering — INTENT.md capture, per-plan intent tracing, drift validation (4 signals, 0-100 score), workflow-wide intent injection, and guided intent questionnaires for new projects/milestones. v4.0 added environment awareness (26-pattern language detection, MCP server profiling with token estimation), structured requirements (per-assertion verification, traceability chains), git worktree parallelism (conflict pre-check, wave-based execution), and session management (complete-and-clear workflow).

## Core Value

Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## Current Milestone: v5.0 Codebase Intelligence

**Goal:** Give agents deep architectural understanding of the projects they work on, with task-scoped context injection so they only see what's relevant.

**Target features:**
- Convention extraction — detect naming patterns, file organization, macro/framework usage
- Dependency graph — module relationships, what depends on what, impact analysis
- Lifecycle awareness — execution order (seeds, migrations, config, compilation), side-effect chains
- Task-scoped injection — plans auto-receive relevant architectural context at execution time
- Specialized analyzer agents — parallel agents for conventions, dependencies, lifecycle
- Research phase — investigate best practices for AI codebase understanding

## Current State

**Last shipped:** v4.0 Environment & Execution Intelligence (2026-02-25)

**Shipped in v4.0:**
- Environment detection engine with 26 manifest patterns, package manager detection, binary version checks, env-manifest.json with staleness detection, and compact "Tools:" summary injected into init commands
- MCP server profiling with 20-server known database, 16-type relevance scoring, keep/disable/review recommendations, and auto-disable with backup/restore
- Structured requirements with ASSERTIONS.md template, per-assertion pass/fail/needs_human verification, traceability chain display, test-command mapping, and planner workflow integration
- Git worktree parallelism with full lifecycle (create/list/remove/cleanup/merge), merge-tree conflict pre-check, lockfile auto-resolution, static file overlap detection, and execute-phase Mode A/B branching
- Session management with session-summary CLI command and complete-and-clear workflow for clean handoffs

<details>
<summary>Previous: v3.0 Intent Engineering (shipped 2026-02-25)</summary>

- INTENT.md template and CRUD commands (create, read/show, update, validate)
- Per-plan intent tracing with traceability matrix and gap detection
- Intent drift validation (4 signals, 0-100 score, advisory pre-flight)
- Workflow-wide intent injection (research, planning, execution, verification)
- Guided intent questionnaire in new-project/new-milestone workflows
- Intent evolution tracking with history section and --reason flag
- GSD dog-fooding — plugin uses its own intent system

</details>

## Requirements

### Validated

- ✓ 79 CLI commands with JSON-over-stdout interface — existing
- ✓ Zero-dependency single-file architecture — existing
- ✓ Markdown parsing with 309+ regex patterns — existing
- ✓ YAML frontmatter extraction and reconstruction — existing
- ✓ Git integration (commit, diff, log) via execSync — existing
- ✓ State management (STATE.md read/write/patch) — existing
- ✓ Roadmap analysis and phase management — existing
- ✓ Milestone detection with 5-strategy fallback — existing
- ✓ 19 test suites covering core parsing and state — existing
- ✓ Workflow orchestration via markdown prompts — existing
- ✓ Deploy script for live install — existing
- ✓ 15 feature commands (session-diff through quick-summary) — existing but unwired
- ✓ In-memory file cache to eliminate repeated reads — v1.0
- ✓ esbuild bundler pipeline with src/ module split — v1.0
- ✓ Debug logging (GSD_DEBUG) across all 96 catch blocks — v1.0
- ✓ Single CONFIG_SCHEMA constant (eliminated 3-way config drift) — v1.0
- ✓ Round-trip tests for 8 state mutation commands — v1.0
- ✓ Frontmatter round-trip tests (13 edge cases) — v1.0
- ✓ 11 slash commands wiring unwired features — v1.0
- ✓ Workflow integrations (validate-deps, search-lessons, context-budget) — v1.0
- ✓ package.json with engines, test/build scripts — v1.0
- ✓ Shell injection sanitization (sanitizeShellArg) — v1.0
- ✓ Temp file cleanup on exit — v1.0
- ✓ AGENTS.md line count fix — v1.0
- ✓ Parallel execution ASCII visualization — v1.0
- ✓ Per-command --help support (44 entries) — v1.0 + v1.1
- ✓ Config migration command — v1.0
- ✓ Batch grep in cmdCodebaseImpact() — v1.0
- ✓ Configurable context window size — v1.0
- ✓ Accurate BPE token estimation via tokenx — v1.1
- ✓ --fields flag for selective JSON output — v1.1
- ✓ Workflow baseline measurement (43 invocations) — v1.1
- ✓ Before/after token comparison — v1.1
- ✓ --compact flag (46.7% avg init output reduction) — v1.1
- ✓ --manifest flag (opt-in context loading guidance) — v1.1
- ✓ extract-sections CLI (dual-boundary parsing) — v1.1
- ✓ Top 8 workflow compression (54.6% avg reduction) — v1.1
- ✓ Research template summary/detail tiers — v1.1
- ✓ 202 tests passing (zero failures) — v1.1
- ✓ Complete --help coverage (44 commands) — v1.1
- ✓ Plan templates (execute, tdd, discovery) — v1.1
- ✓ State validation with 5 drift-detection checks and auto-fix — v2.0
- ✓ Atomic plan decomposition with SR scoring (1-5) and split suggestions — v2.0
- ✓ Cross-session memory with dual-store pattern and sacred data protection — v2.0
- ✓ Comprehensive verification (test gating, requirement checking, regression detection) — v2.0
- ✓ Multi-dimensional quality scoring with A-F grades and trend tracking — v2.0
- ✓ Integration test suite: 297 tests, E2E simulation, snapshot tests — v2.0
- ✓ Bundle size tracking (400KB budget) and token budgets for workflows — v2.0
- ✓ --compact as default for all init commands — v2.0
- ✓ MCP server discovery from .mcp.json configs — v2.0
- ✓ INTENT.md template and CRUD commands (create, read/show, update, validate) — v3.0
- ✓ Per-plan intent tracing with traceability matrix and gap detection — v3.0
- ✓ Intent drift validation (4 signals, 0-100 score, advisory pre-flight) — v3.0
- ✓ Workflow-wide intent injection (research, planning, execution, verification) — v3.0
- ✓ Guided intent questionnaire in new-project/new-milestone workflows — v3.0
- ✓ Intent evolution tracking with history section and --reason flag — v3.0
- ✓ GSD self-application (dog-fooding its own intent system) — v3.0
- ✓ Environment detection engine with 26 manifest patterns and binary checks — v4.0
- ✓ Env-manifest.json with staleness detection and auto-rescan — v4.0
- ✓ Init command "Tools:" summary injection for agent context — v4.0
- ✓ MCP server profiling with 20-server token estimation database — v4.0
- ✓ MCP relevance scoring (16 indicator types) and auto-disable with backup/restore — v4.0
- ✓ ASSERTIONS.md template and per-assertion verification (pass/fail/needs_human) — v4.0
- ✓ Traceability chain display and test-command mapping in requirements — v4.0
- ✓ Planner auto-populates must_haves.truths from structured assertions — v4.0
- ✓ Git worktree parallelism (create/list/remove/cleanup/merge) with conflict pre-check — v4.0
- ✓ Worktree execute-phase Mode A/B branching with sequential merge — v4.0
- ✓ Session-summary CLI and complete-and-clear workflow — v4.0

### Active

- [ ] Convention extraction — detect naming patterns, file organization, framework-specific macro usage
- [ ] Dependency graph — module-level relationships, impact analysis for changes
- [ ] Lifecycle awareness — execution order for seeds, migrations, config, compilation
- [ ] Task-scoped context injection — plans auto-receive relevant architectural sections
- [ ] Specialized analyzer agents — parallel convention/dependency/lifecycle analyzers

### Out of Scope

- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool, not a real bottleneck
- npm package publishing — This is a plugin deployed via file copy, not a library
- Multi-process file locking — Only one AI session runs per project, race conditions are theoretical
- ESM output format — CJS avoids __dirname/require rewriting, keep CJS
- RAG / vector search — Wrong architecture for a CLI tool
- LLM-based summarization — Deterministic compression outperforms (JetBrains NeurIPS 2025)
- Gherkin/BDD format — No evidence of superior outcomes vs structured assertions; 5-8x token overhead
- SQLite codebase index — Heavy dependency, overlaps with LSP/ripgrep, marginal ROI
- Runtime MCP server connection — Static analysis sufficient for profiling

## Context

Shipped v1.0, v1.1, v2.0, v3.0, and v4.0. 502 tests passing, 16 src/ modules, 549KB bundle, esbuild bundler.
Platform: OpenCode.
Tech stack: Node.js 18+, node:test, esbuild, tokenx (bundled), zero runtime dependencies.
Source: 16 modules — `src/lib/` (7 modules) and `src/commands/` (8 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.

No known tech debt (bundle at 549KB/550KB is tight but not blocking).

## Constraints

- **Backward compatibility**: All regex/parser changes must accept both old and new formats
- **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
- **Single-file deploy**: `deploy.sh` must continue to work — bundle to single file if splitting source
- **Node.js 18+**: Minimum version (for fetch, node:test) — formalized in package.json
- **Test against real project**: Always test against `/mnt/raid/DEV/event-pipeline/.planning/`
- **No artificial bundle budget**: Code quality and necessity gate additions, not arbitrary size limits

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Allow dev dependencies via bundler | Enables esbuild, proper test tooling while keeping single-file deploy | Good — esbuild bundles 15 modules to single file in <500ms |
| In-memory Map cache over lru-cache | CLI is short-lived process (<5s); plain Map needs no eviction | Good — simpler, zero dependency |
| Extend existing test file | `bin/gsd-tools.test.cjs` already has patterns; adding to it is simpler than new test infrastructure | Good — 502 tests in single file |
| Debug logging over error throwing for catches | Most silent catches are "optional data" patterns; throwing would break workflows | Good — 96 catch blocks instrumented, zero behavioral change when GSD_DEBUG unset |
| Strip-shebang esbuild plugin | Monolith has shebang that breaks bundling; plugin strips on input, banner adds on output | Good — clean build pipeline |
| 15-module split (6 lib + 7 commands + router + index) | Logical grouping by domain, strict dependency direction | Good — maintainable, no circular imports |
| Config migration with .bak backup | Safe upgrade path for existing configs | Good — only creates backup when changes needed |
| Batch grep: fixed-string vs regex split | Different grep flags needed; 1-2 calls max regardless of pattern count | Good — eliminates per-pattern spawn overhead |
| tokenx for token estimation | 4.5KB bundled, ~96% accuracy, zero deps, ESM→CJS via esbuild | Good — replaced broken lines*4 heuristic |
| Split --compact/--manifest flags | Field reduction separate from guidance; eliminates manifest overhead from default path | Good — 46.7% avg reduction without manifest bloat |
| HTML comment section markers | Invisible to markdown rendering, machine-parseable | Good — dual-boundary parsing for headers + markers |
| Prose tightening over structural changes | AI agents don't need persuasion; imperative instructions are sufficient | Good — 54.6% avg workflow compression |
| Advisory-only state validation | Never block workflows; warn and let user decide | Good — catches drift without disrupting execution |
| Dual-store pattern (STATE.md + memory.json) | Human-readable authority + machine-optimized caching | Good — decisions/bookmarks survive sessions |
| Sacred data protection in compaction | Decisions and lessons too valuable to prune | Good — no information loss during cleanup |
| 4-dimension quality scoring | Balanced weight: tests 30%, must_haves 30%, requirements 20%, regression 20% | Good — comprehensive deliverable verification |
| Union-find for concern grouping | Efficient clustering for single-responsibility analysis | Good — O(n) plan analysis |
| Compact-as-default | Most consumers are AI agents that need compact output | Good — saves ~47% tokens per invocation |
| Intent as architectural layer | INTENT.md + per-phase tracing + validation as dedicated system | Good — every workflow sees project purpose, drift detected early |
| Advisory intent validation | Flag drift, don't hard-block workflows | Good — consistent with v2.0 advisory pattern, zero workflow disruption |
| Cascading intent | Project-level INTENT.md + per-phase intent sections in PLAN frontmatter | Good — traceability at both macro and micro level |
| Conditional intent injection | All workflow injections check if INTENT.md exists first | Good — zero impact on projects without intent, graceful degradation |
| Progressive bundle budget (400→450→500→525→550KB) | Each major feature set adds ~15-20KB; budget grows to accommodate | Good — never blocked development, always tight enough to prevent bloat |
| Structured assertions over Gherkin | 80% benefit at 20% ceremony; no evidence of superior AI outcomes from BDD format | Good — simple, readable, testable |
| Static MCP profiling | Known-server database + relevance scoring vs runtime server connection | Good — no server spawn overhead, 20-server coverage sufficient |
| Two-file env output | Gitignored env-manifest.json (machine) + committed project-profile.json (team) | Good — machine-specific data stays local |
| Per-assertion hybrid verification | File/CLI auto-checked, behavior/api always need_human | Good — realistic about static analysis limits |
| Worktree three-gate check | worktree_enabled AND parallelization AND multi-plan wave | Good — conservative, falls back to proven sequential mode |
| Lockfile auto-resolution | checkout --theirs during conflicted merge for lockfiles/baselines | Good — eliminates most common merge conflicts |

---
*Last updated: 2026-02-25 after v5.0 milestone start*
