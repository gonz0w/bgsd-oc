# bGSD Plugin

## What This Is

A single-file Node.js CLI built from 34 organized `src/` modules via esbuild, producing `bin/bgsd-tools.cjs`. It provides structured data operations for AI-driven project planning workflows running in the host editor. Seventeen versions shipped: v1.0 (test suite, module split, observability), v1.1 (context reduction — 46.7% CLI, 54.6% workflow, 67% reference compression), v2.0 (state validation, cross-session memory, quality scoring), v3.0 (intent engineering — INTENT.md, drift validation, workflow injection), v4.0 (environment awareness, MCP profiling, worktree parallelism), v5.0 (codebase intelligence — convention extraction, dependency graphs, lifecycle awareness), v6.0 (UX overhaul — shared formatting engine, TTY-aware smart output, branded CLI), v7.0 (agent orchestration — AST intelligence, task routing, context efficiency, TDD execution, review gates), v7.1 (trajectory engineering — checkpoint, pivot, compare, choose, decision journal, dead-end detection), v8.0 (performance & agent architecture — SQLite caching, agent consolidation 11→9, namespace routing, profiler instrumentation, token budgets, RACI matrix), v8.1 (RAG-powered research — YouTube integration, NotebookLM synthesis, multi-source orchestration, 4-tier degradation, session persistence), v8.2 (cleanup & validation — dead code removal, namespace-only routing, 24-40% init speedup, RACI handoff contracts), v8.3 (agent quality & skills — OpenCode skills architecture with 27 skills and 52.4% agent line reduction, agent consistency audit, GitHub CI agent overhaul, 766 tests fully green), v9.0 (embedded plugin experience — always-on context injection, native LLM tools, event-driven sync, advisory guardrails), v9.1 (performance acceleration — valibot validation, fast-glob discovery, compile-cache, SQLite statement caching, safe adoption controls), v9.2 (CLI tool integrations — ripgrep, fd, jq, yq, bat, gh, Bun runtime), v9.3 (quality, performance & agent sharpening — command consolidation, deterministic context, Bun validation, benchmark adapter), and v10.0 (agent intelligence & UX — planning/verification/execution intelligence, multi-agent collaboration, rich TTY output, interactive workflows).

## Core Value

Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.

## Current State

**Last shipped:** v9.3 Quality, Performance & Agent Sharpening (2026-03-10)

## Current Milestone: v10.0 Agent Intelligence & UX

**Goal:** Comprehensive upgrade to agent intelligence (planning, verification, execution, multi-agent) and user experience (formatting, interactivity, commands, error handling).

**Target features:**
- Agent Intelligence:
  - Planning intelligence: Better task decomposition, dependency detection
  - Verification intelligence: Smarter testing, regression detection
  - Execution intelligence: Deviation handling, autonomous recovery
  - Multi-agent collaboration: Better handoffs, shared context
- UX Improvements:
  - Output formatting: Rich TTY output, color schemes
  - Interactive workflows: Prompts, wizards
  - Command improvements: Discoverability, help
  - Error handling: Better messages, debug helpers
- Intent outcomes:
  - DO-32 [P2]: Memory and disk I/O reduced
  - DO-36 [P2]: Bundle size reduced
  - DO-45 [P1]: Enhanced compaction

## Next Milestone Goals

- v10.0 is now active — Agent Intelligence & UX

## Active Milestone

v10.0 Agent Intelligence & UX — See Current Milestone above.

<details>
<summary>Previous: v9.3 Quality, Performance & Agent Sharpening (shipped 2026-03-10)</summary>

- Agent sharpening — DO-27 (zero overlap), DO-35 (validated boundaries)
- Command consolidation — DO-30 (subcommand groups), DO-34 (78% surface reduction)
- Quality — DO-28 (deterministic context), DO-33 (zero orphaned code)
- Runtime — DO-47 (Bun migration validated)
- Benchmark — DO-48 (plugin adapter)

</details>

<details>
<summary>Previous: v9.2 CLI Tool Integrations & Runtime Modernization (shipped 2026-03-10)</summary>

- Tool Detection Infrastructure — CLI tool detection with caching, install guidance, graceful fallback
- Search & Discovery — ripgrep, fd, jq integrations with JSON output
- Extended Tools — yq, bat, gh CLI tool wrappers
- Runtime Exploration — Bun runtime detection, compatibility docs, benchmarking

</details>

<details>
<summary>Previous: v9.1 Performance Acceleration (shipped 2026-03-10)</summary>

- Validation engine modernization — valibot with zod fallback, 34.48% improvement
- File discovery optimization — fast-glob, in-process ignore, no subprocess overhead
- Compile-cache acceleration — warm starts 76-102ms faster on Node 22+
- SQLite statement caching — p50 latency reduced ~43%, p99 reduced ~22%
- Safe adoption controls — unified optimization flags, parity-check utility, backward compatibility

</details>

<details>
<summary>Previous: v9.0 Embedded Plugin Experience (shipped 2026-03-09)</summary>

**Goal:** Transform the bGSD plugin from a minimal 3-hook integration into a deeply embedded OpenCode experience — always-on context injection, custom LLM-callable tools replacing CLI calls, event-driven state sync, smart command enrichment, advisory guardrails, toast notifications, and enhanced compaction.

**Target features:**
- Always-on context injection (system prompt always knows current phase, plan, blockers)
- Custom LLM-callable tools registered via plugin `tool` property (replacing hot-path CLI calls over time)
- Event-driven state sync (auto-update STATE.md on session idle, react to file changes and commits)
- Smart command enrichment (slash commands auto-inject project context before executing)
- Tool interception and advisory guardrails (convention enforcement, test-after-edit suggestions)
- Toast/notification UX (desktop notifications for phase transitions, milestone completion, stuck detection)
- Enhanced compaction (preserve decisions, blockers, current task context — not just STATE.md)

</details>

<details>
<summary>Previous: v8.3 Agent Quality & Skills (shipped 2026-03-09)</summary>

- OpenCode skills architecture — 27 skills extracted, 52.4% agent line reduction (7,361 to 3,504 lines)
- Agent consistency across all 10 agents (project_context, PATH SETUP, structured_returns)
- GitHub CI agent overhaul (deviation_rules, state tracking, structured returns, unified checkpoint format)
- Test suite fully green — 766 tests, 0 failures (fixed 49 pre-existing failures)
- Pre-commit test gate in executor workflow

</details>

<details>
<summary>Previous: v1.0-v8.2 (shipped 2026-02-22 through 2026-03-07)</summary>

See `.planning/MILESTONES.md` for full history of v1.0 through v8.2.

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

v10.0 milestone is active — Agent Intelligence & UX

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

Shipped v1.0 through v8.3. 766 tests passing, 34 src/ modules, ~1163KB bundle, esbuild bundler.
Platform: OC (host editor).
Tech stack: Node.js >= 22.5 (required for `node:sqlite` caching), node:test, esbuild, tokenx (bundled), acorn (bundled).
Source: 34 modules — `src/lib/` (18 modules) and `src/commands/` (14 modules) + router + index.
Deploy pipeline: `npm run build` → esbuild bundle → `deploy.sh` with smoke test and rollback.
9 specialized AI agents, 41 slash commands, 45 workflows, 27 skills.

Known tech debt: Bundle at ~1163KB (over 1050KB budget). `node:sqlite` is Stability 1.2 (Release Candidate).

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
*Last updated: 2026-03-10 after v10.0 milestone start*
