# bGSD Plugin

## What This Is

A single-file Node.js CLI built from 34 organized `src/` modules via esbuild, producing `bin/gsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows running in the host editor. Nine versions shipped: v1.0 (test suite, module split, observability), v1.1 (context reduction — 46.7% CLI, 54.6% workflow, 67% reference compression), v2.0 (state validation, cross-session memory, quality scoring), v3.0 (intent engineering — INTENT.md, drift validation, workflow injection), v4.0 (environment awareness, MCP profiling, worktree parallelism), v5.0 (codebase intelligence — convention extraction, dependency graphs, lifecycle awareness), v6.0 (UX overhaul — shared formatting engine, TTY-aware smart output, branded CLI), v7.0 (agent orchestration — AST intelligence, task routing, context efficiency, TDD execution, review gates), v7.1 (trajectory engineering — checkpoint, pivot, compare, choose, decision journal, dead-end detection), and v8.0 (performance & agent architecture — SQLite caching, agent consolidation 11→9, namespace routing, profiler instrumentation, token budgets, RACI matrix).

## Core Value

Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## Current State

**Last shipped:** v8.0 Performance & Agent Architecture (2026-03-03)

**Shipped in v8.0:**
- Two-layer SQLite caching (L1 in-memory Map + L2 SQLite via `node:sqlite`) with graceful degradation to Map-only on Node <22.5
- Agent consolidation (11→9): merged gsd-integration-checker into gsd-verifier, gsd-research-synthesizer into gsd-roadmapper
- RACI matrix mapping every lifecycle step to exactly one responsible agent, with automated audit command
- Token budgets (60-80K) declared in all 9 agent manifests, context builder enforces limits
- Namespace routing for CLI commands (`init:`, `plan:`, `execute:`, `verify:`, `util:` prefixes)
- Profiler instrumentation on hot paths (`GSD_PROFILE=1`), compare command with regression highlighting
- Auto changelog generation in milestone wrapup workflow

<details>
<summary>Previous: v7.1 Trajectory Engineering (shipped 2026-03-02)</summary>

- Decision journal foundation with trajectories sacred memory store, crypto-generated IDs, cross-session persistence
- Selective git rewind preserving `.planning/` state via protected-path denylist
- Checkpoint system with named snapshots, auto-collected metrics (tests, LOC delta, complexity), branch-based tracking
- Pivot engine with structured reason capture, auto-checkpoint of abandoned work, stuck-detector integration
- Multi-attempt comparison with side-by-side metrics matrix, color-coded TTY output, JSON fallback
- Choose & cleanup lifecycle — merge winner via `--no-ff`, archive alternatives as tags, branch cleanup
- Agent context integration — dead-end detection, `previous_attempts` in init execute-phase, scope validation
- Commit attribution via git trailers, anti-pattern detection, stuck/loop recovery

</details>

<details>
<summary>Previous: v7.0 Agent Orchestration & Efficiency (shipped 2026-02-27)</summary>

- Contract test safety net with snapshot-based consumer tests for all init/state JSON output
- Enhanced git.js with structured log, diff, blame, branch info, pre-commit safety checks
- AST intelligence via acorn parser — function signatures, export analysis, complexity metrics, ~1k token repo map
- Orchestration intelligence — task complexity scoring (1-5), automatic agent/model routing, execution mode selection
- Context efficiency — agent manifests (40-60% token reduction), compact serialization, task-scoped file injection
- gsd-reviewer agent with two-stage review (spec compliance + code quality), severity classification (BLOCKER/WARNING/INFO)
- TDD execution engine — RED→GREEN→REFACTOR state machine with orchestrator gates, auto test-after-edit

</details>

<details>
<summary>Previous: v6.0 UX & Developer Experience (shipped 2026-02-27)</summary>

- Shared formatting engine (`src/lib/format.js`) with formatTable, progressBar, banner, box, and ~2KB picocolors-pattern color utility
- Smart output detection — human-readable branded output in TTY mode, JSON when piped — with `--raw` and `--pretty` overrides
- All user-facing commands migrated to shared formatting (init, state, verify, codebase, velocity, intent)
- Workflow output tightened across 27 files (455-line reduction), ui-brand.md updated with bGSD patterns
- 11 slash command wrappers created in `commands/` directory with deploy.sh safe sync
- AGENTS.md rewritten as lean 59-line project index

</details>

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

- ✓ 100+ CLI commands with JSON-over-stdout interface — existing
- ✓ Single-file architecture via esbuild — existing
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
- ✓ Integration test suite: 762 tests, E2E simulation, snapshot tests — v2.0+
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
- ✓ 41 slash command wrappers created and deployed — v6.0+v8.0
- ✓ Contract tests (snapshot-based) for all init/state JSON output — v7.0
- ✓ Enhanced git.js (structured log, diff, blame, branch info, pre-commit checks) — v7.0
- ✓ AST intelligence via acorn (signatures, exports, complexity, repo map) — v7.0
- ✓ Orchestration intelligence (task classification, model routing, execution mode) — v7.0
- ✓ Context efficiency (agent manifests, compact serialization, task-scoped injection) — v7.0
- ✓ gsd-reviewer agent with two-stage review and severity classification — v7.0
- ✓ TDD execution engine (RED→GREEN→REFACTOR with orchestrator gates) — v7.0
- ✓ Commit attribution via git trailers — v7.0
- ✓ Auto test-after-edit and anti-pattern detection — v7.0
- ✓ Stuck/loop detection with recovery — v7.0
- ✓ Trajectory decision journal with sacred memory store — v7.1
- ✓ Checkpoint command with auto-metrics and branch tracking — v7.1
- ✓ Pivot command with reason capture, auto-checkpoint, selective rewind — v7.1
- ✓ Compare command with multi-attempt metrics matrix — v7.1
- ✓ Choose command with merge, tag archival, branch cleanup — v7.1
- ✓ Dead-end detection and agent context integration — v7.1
- ✓ Multi-level trajectory support (task, plan, phase) — v7.1
- ✓ SQLite L1/L2 caching with graceful Map fallback on Node <22.5 — v8.0
- ✓ Agent consolidation 11→9 with RACI matrix and automated lifecycle audit — v8.0
- ✓ Manifest-driven agent context loading with token budgets (60-80K) — v8.0
- ✓ Namespace routing for CLI commands (init:, plan:, execute:, verify:, util:) — v8.0
- ✓ Profiler instrumentation and baseline comparison tool — v8.0
- ✓ Auto changelog generation in milestone wrapup workflow — v8.0

### Active

None — all v8.0 requirements shipped. Ready for next milestone.

### Out of Scope

- Async I/O rewrite — Synchronous I/O is appropriate for CLI tool
- npm package publishing — Plugin deployed via file copy, not a library
- ESM output format — CJS avoids __dirname/require rewriting
- RAG / vector search — Wrong architecture for a CLI tool
- ~~SQLite codebase index~~ — Reconsidered for v8.0 as read cache layer
- Runtime MCP server connection — Static analysis sufficient
- CI/CD pipeline management — Handled by external tooling
- TypeScript migration — Not worth 34-module migration cost
- Autonomous agent teams — Human-in-the-loop is correct
- Dynamic agent spawning — Pre-planned parallelism over self-spawning
- Agent role explosion — Cap at 9 roles; intelligence = data, not agents

## Context

Shipped v1.0 through v8.0. 762 tests passing, 34 src/ modules, ~1133KB bundle, esbuild bundler.
Platform: OC (host editor).
Tech stack: Node.js >= 22.5 (required for `node:sqlite` caching), node:test, esbuild, tokenx (bundled), acorn (bundled).
Source: 34 modules — `src/lib/` (18 modules) and `src/commands/` (14 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.
9 specialized AI agents, 41 slash commands, 45 workflows.

Known tech debt: Bundle at ~1133KB (over 1050KB budget). `node:sqlite` is Stability 1.2 (Release Candidate).

## Constraints

- **Backward compatibility**: All regex/parser changes must accept both old and new formats
- **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
- **Single-file deploy**: `deploy.sh` must continue to work — bundle to single file if splitting source
- **Node.js 18+**: Minimum version (for fetch, node:test) — formalized in package.json
- **Test against current project**: Always test against current working directory's `.planning/`
- **Agent cap**: Maximum 9 agent roles; new intelligence delivered as CLI data, not new agents

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Allow dev dependencies via bundler | Enables esbuild, proper test tooling while keeping single-file deploy | Good — esbuild bundles 34 modules to single file |
| In-memory Map cache over lru-cache | CLI is short-lived process (<5s); plain Map needs no eviction | Good — simpler, zero dependency |
| Debug logging over error throwing | Most silent catches are "optional data" patterns | Good — 96 catch blocks instrumented |
| 34-module split (18 lib + 14 commands + router + index) | Logical grouping by domain, strict dependency direction | Good — maintainable, no circular imports |
| tokenx for token estimation | 4.5KB bundled, ~96% accuracy, zero deps | Good — replaced broken lines*4 heuristic |
| Advisory-only state validation | Never block workflows; warn and let user decide | Good — catches drift without disrupting |
| Dual-store pattern (STATE.md + memory.json) | Human-readable authority + machine-optimized caching | Good — decisions survive sessions |
| Intent as architectural layer | INTENT.md + per-phase tracing + validation | Good — drift detected early |
| Structured assertions over Gherkin | 80% benefit at 20% ceremony | Good — simple, readable, testable |
| Worktree three-gate check | worktree_enabled AND parallelization AND multi-plan wave | Good — conservative fallback to sequential |
| Single-module format.js | All formatting primitives in one file, picocolors inline | Good — zero-dep, TTY-aware, ~2KB color |
| Smart output TTY detection | Human-readable when interactive, JSON when piped | Good — backward-compatible |
| acorn for AST parsing | 114KB bundled, zero deps, most widely-used JS parser | Good — enables repo map, complexity metrics |
| Intelligence as data, not agents | New capabilities = CLI data for existing agents, not new roles | Good — avoids coordination overhead |
| Hybrid snapshot strategy | Full snapshots for high-value, field-level for others | Good — catches regressions without brittle tests |
| Agent manifests whitelist | Agents declare what they need; system provides only that | Good — 40-60% token reduction |
| Two-stage review (spec + quality) | Catches both "built wrong thing" and "built it wrong" | Good — dual failure mode coverage |
| TDD as opt-in plan type | Not all work benefits from test-first | Good — discipline when wanted, no overhead when not |
| Stuck/loop detection at 3 failures | Prevents token waste from repeated failed patterns | Good — automatic recovery |
| Graduated review enforcement | Start advisory, graduate to blocking for BLOCKERs | Good — builds trust before gating |
| Sacred trajectory store | Reuse memory.js dual-store with compaction protection | Good — no new storage mechanism |
| Protected-path denylist for rewind | Everything except listed paths gets rewound | Good — safer default than allowlist |
| Reason capture via --reason flag | gsd-tools runs via execFileSync, no interactive prompts | Good — CLI-compatible |
| Advisory dead-end context | Never crash, null when absent, matching existing patterns | Good — zero-risk integration |

| Trajectory exploration over worktrees | Sequential exploration sufficient; worktrees disk-expensive |
| Automatic pivot without human signal | Human-in-the-loop is a core GSD principle |
| Trajectory analytics | Deferred to future milestone |
| `node:sqlite` over `better-sqlite3` | Preserves single-file deploy, zero dependencies | Good — graceful Map fallback on Node <22.5 |
| Two-layer cache (Map L1 + SQLite L2) | In-memory for speed, SQLite for persistence across invocations | Good — transparent to consumers via cachedReadFile |
| Agent consolidation 11→9 | Merged integration-checker→verifier, synthesizer→roadmapper | Good — fewer agents, same capabilities |
| RACI matrix for agent lifecycle | Every step has exactly one responsible agent | Good — eliminates ambiguity |
| Token budgets per agent manifest | 60-80K caps prevent context rot | Good — context builder warns on exceedance |
| Namespace routing (colon syntax) | Semantic grouping for 100+ CLI commands | Good — discoverable, backward-compatible |

---
*Last updated: 2026-03-03 after v8.0 milestone complete*
