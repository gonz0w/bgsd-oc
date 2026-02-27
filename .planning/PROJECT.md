# GSD Plugin for OpenCode

## What This Is

A zero-dependency, single-file Node.js CLI built from 18 organized `src/` modules via esbuild, producing `bin/gsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows running in OpenCode. Six major versions shipped: v1.0 (test suite, module split, observability), v1.1 (context reduction — 46.7% CLI, 54.6% workflow, 67% reference compression), v2.0 (state validation, cross-session memory, quality scoring, 297 tests), v3.0 (intent engineering — INTENT.md, drift validation, workflow injection), v4.0 (environment awareness, MCP profiling, worktree parallelism), v5.0 (codebase intelligence — convention extraction, dependency graphs, lifecycle awareness), and v6.0 (UX overhaul — shared formatting engine, TTY-aware smart output, branded CLI, workflow tightening).

## Core Value

Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## Current Milestone: v7.0 Agent Orchestration & Efficiency

**Goal:** Make GSD the definitive agent orchestrator for building large software — add missing agent roles, improve orchestration intelligence, optimize performance, and reduce context load without losing fidelity.

**Target features:**
- New specialized agent roles (code review, test generation, refactoring, dependency management)
- Smarter orchestration (task routing, parallelism, agent-to-agent coordination)
- Git workflow enhancements (research-driven — branch management, PR workflows, conflict handling)
- Performance optimizations where impactful
- Context window reduction across workflows, references, and CLI output (fidelity-preserving)

## Current State

**Last shipped:** v6.0 UX & Developer Experience (2026-02-27)

**Shipped in v6.0:**
- Shared formatting engine (`src/lib/format.js`) with formatTable, progressBar, banner, box, and ~2KB picocolors-pattern color utility
- Smart output detection — human-readable branded output in TTY mode, JSON when piped — with `--raw` and `--pretty` overrides
- All user-facing commands migrated to shared formatting (init, state, verify, codebase, velocity, intent)
- Workflow output tightened across 27 files (455-line reduction), ui-brand.md updated with bGSD patterns
- 11 slash command wrappers created in `commands/` directory with deploy.sh safe sync
- AGENTS.md rewritten as lean 59-line project index

<details>
<summary>Previous: v5.0 Codebase Intelligence (shipped 2026-02-26)</summary>

- Codebase-intel.json storage with git-hash watermarks, staleness detection, incremental analysis
- Convention extraction (naming patterns, file organization, framework macros) with confidence scoring
- Module dependency graph across 6 languages with Tarjan's SCC cycle detection
- Lifecycle awareness for execution order with extensible detector registry
- Task-scoped context injection with heuristic relevance scoring and 5K token budget
- Non-blocking background re-analysis with lock file and --refresh flag

</details>

<details>
<summary>Previous: v4.0 Environment & Execution Intelligence (shipped 2026-02-25)</summary>

- Environment detection engine with 26 manifest patterns, package manager detection, binary version checks
- MCP server profiling with 20-server known database, 16-type relevance scoring, auto-disable with backup/restore
- Structured requirements with ASSERTIONS.md template, per-assertion verification, traceability chains
- Git worktree parallelism with full lifecycle, conflict pre-check, lockfile auto-resolution
- Session management with session-summary CLI and complete-and-clear workflow

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
- ✓ In-memory file cache to eliminate repeated reads — v1.0
- ✓ esbuild bundler pipeline with src/ module split — v1.0
- ✓ Debug logging (GSD_DEBUG) across all 96 catch blocks — v1.0
- ✓ Shell injection sanitization (sanitizeShellArg) — v1.0
- ✓ Per-command --help support (44 entries) — v1.0 + v1.1
- ✓ Accurate BPE token estimation via tokenx — v1.1
- ✓ --compact flag (46.7% avg init output reduction) — v1.1
- ✓ extract-sections CLI (dual-boundary parsing) — v1.1
- ✓ Top 8 workflow compression (54.6% avg reduction) — v1.1
- ✓ State validation with 5 drift-detection checks and auto-fix — v2.0
- ✓ Cross-session memory with dual-store pattern and sacred data protection — v2.0
- ✓ Comprehensive verification (test gating, requirement checking, regression detection) — v2.0
- ✓ Multi-dimensional quality scoring with A-F grades and trend tracking — v2.0
- ✓ Integration test suite: 574 tests, E2E simulation, snapshot tests — v2.0+
- ✓ INTENT.md template and CRUD commands — v3.0
- ✓ Intent drift validation (4 signals, 0-100 score, advisory pre-flight) — v3.0
- ✓ Workflow-wide intent injection — v3.0
- ✓ Environment detection engine with 26 manifest patterns — v4.0
- ✓ MCP server profiling with 20-server token estimation database — v4.0
- ✓ Structured requirements with per-assertion verification — v4.0
- ✓ Git worktree parallelism with conflict pre-check — v4.0
- ✓ Codebase-intel.json storage with staleness detection — v5.0
- ✓ Convention extraction with confidence scoring — v5.0
- ✓ Module dependency graph across 6 languages with cycle detection — v5.0
- ✓ Lifecycle awareness with extensible detector registry — v5.0
- ✓ Task-scoped context injection with heuristic relevance scoring — v5.0
- ✓ Shared formatting engine (formatTable, progressBar, banner, box, color) — v6.0
- ✓ Smart output detection (TTY-aware, --raw, --pretty) — v6.0
- ✓ All user-facing commands produce branded output in TTY mode — v6.0
- ✓ Workflow output tightened (455-line reduction across 27 files) — v6.0
- ✓ 11 slash command wrappers created and deployed — v6.0

### Active

- [ ] New specialized agent roles for large-scale software development
- [ ] Improved orchestration intelligence (task routing, parallelism, coordination)
- [ ] Git workflow enhancements (research-driven)
- [ ] Performance optimizations across CLI and workflows
- [ ] Context window reduction without fidelity loss

### Out of Scope

- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool
- npm package publishing — Plugin deployed via file copy, not a library
- ESM output format — CJS avoids __dirname/require rewriting
- RAG / vector search — Wrong architecture for a CLI tool
- SQLite codebase index — Heavy dependency, marginal ROI
- Runtime MCP server connection — Static analysis sufficient
- CI/CD pipeline management — Handled by external tooling

## Context

Shipped v1.0 through v6.0. 574 tests passing, 18 src/ modules, 681KB bundle, esbuild bundler.
Platform: OpenCode.
Tech stack: Node.js 18+, node:test, esbuild, tokenx (bundled), zero runtime dependencies.
Source: 18 modules — `src/lib/` (9 modules) and `src/commands/` (8 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.

Known tech debt: None.

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
| Allow dev dependencies via bundler | Enables esbuild, proper test tooling while keeping single-file deploy | Good — esbuild bundles 18 modules to single file |
| In-memory Map cache over lru-cache | CLI is short-lived process (<5s); plain Map needs no eviction | Good — simpler, zero dependency |
| Debug logging over error throwing | Most silent catches are "optional data" patterns | Good — 96 catch blocks instrumented |
| 18-module split (9 lib + 8 commands + router) | Logical grouping by domain, strict dependency direction | Good — maintainable, no circular imports |
| tokenx for token estimation | 4.5KB bundled, ~96% accuracy, zero deps | Good — replaced broken lines*4 heuristic |
| Advisory-only state validation | Never block workflows; warn and let user decide | Good — catches drift without disrupting |
| Dual-store pattern (STATE.md + memory.json) | Human-readable authority + machine-optimized caching | Good — decisions survive sessions |
| Intent as architectural layer | INTENT.md + per-phase tracing + validation | Good — drift detected early |
| Structured assertions over Gherkin | 80% benefit at 20% ceremony | Good — simple, readable, testable |
| Worktree three-gate check | worktree_enabled AND parallelization AND multi-plan wave | Good — conservative fallback to sequential |
| Single-module format.js | All formatting primitives in one file, picocolors inline | Good — zero-dep, TTY-aware, ~2KB color |
| Smart output TTY detection | Human-readable when interactive, JSON when piped | Good — backward-compatible, --raw accepted |
| Co-located formatter functions | Formatters next to command handlers, not centralized | Good — only user-facing commands migrated |
| bGSD branding | Subtle rename from GSD across all output paths | Good — consistent brand identity |

---
*Last updated: 2026-02-26 after v7.0 milestone start*
