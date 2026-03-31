# Milestones

## ✅ v17.1 Workflow Reliability & Foundation Hardening (Shipped: 2026-03-30)

**Delivered:** bGSD now ships a quieter and more reliable workflow foundation with shared mutation and metadata contracts, JJ-aware execution truth, plan-scoped completion repair, and one predictable diagnostic contract across touched CLI and plugin flows.

**Phases completed:** 5 phases (163-167), 15 plans, 37 tasks
**Commits:** 61 | **Files changed:** 254 | **Lines:** +13,314 / -6,778
**Timeline:** 1 day (2026-03-30)

**Key accomplishments:**
- Shared mutation contracts now unify touched state/session, JSON-backed memory, config, handoff, and plugin progress writes behind locked or atomic update paths
- Planning and verifier flows now consume one truthful `must_haves` metadata contract with shared indexes and approval-time semantic gates
- JJ execution now supports path-scoped fallback commits in dirty or detached colocated workspaces while verification checks repo-local runtime freshness
- Plan realism analysis and completion repair now catch stale guidance earlier and recompute summary, focus, and progress metadata from on-disk truth
- Touched CLI and plugin diagnostics now use one shared `BGSD_DEBUG` or `--verbose` contract with quiet defaults and explicit investigation output
- All 17 milestone requirements shipped, and the milestone audit passed on requirements and integration with only non-blocking tech-debt follow-up

**What's next:** Ready for next milestone - `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v17.1-ROADMAP.md`
- `.planning/milestones/v17.1-REQUIREMENTS.md`
- `.planning/milestones/v17.1-DOCS.md`
- `.planning/milestones/v17.1-MILESTONE-AUDIT.md`
- `.planning/milestones/v17.1-MILESTONE-INTENT.md`
- `.planning/milestones/v17.1-phases/`
- `.planning/archive/INTENT-vv17.1.md`

---

## ✅ v17.0 JJ Workspaces, Intent Cascade & Command Simplification (Shipped: 2026-03-30)

**Delivered:** bGSD now ships a JJ-first execution model, a smaller canonical command surface, and layered intent handling that stays stable across planning, verification, and bundled runtime behavior.

**Phases completed:** 8 phases (155-162), 50 plans, 124 tasks
**Commits:** 202 | **Files changed:** 376 | **Lines:** +24,548 / -5,093
**Timeline:** 2 days (2026-03-29 -> 2026-03-30)

**Key accomplishments:**
- JJ-gated execution now routes users through workspace-first lifecycle, inventory, and op-log-backed recovery flows instead of Git worktree guidance
- Canonical `/bgsd-quick`, `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` families now anchor surfaced guidance while legacy commands remain compatibility aliases
- Help, docs, workflows, templates, skills, and plugin runtime guidance now stay aligned through inventory-backed command-integrity validation
- Milestone strategy now lives in `MILESTONE-INTENT.md`, with compact `effective_intent` payloads flowing into planning and verification surfaces
- Phase context artifacts now carry explicit phase intent, and verifier/UAT outputs report intent alignment separately from requirement coverage
- Legacy phase contexts without explicit phase intent now use one shared no-guess fallback in both source and bundled runtime, locked by real-artifact regressions

**What's next:** Ready for next milestone - `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v17.0-ROADMAP.md`
- `.planning/milestones/v17.0-REQUIREMENTS.md`
- `.planning/milestones/v17.0-DOCS.md`
- `.planning/milestones/v17.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v17.0-phases/`

---

## ✅ v16.1 Workflow Reliability & Acceleration (Shipped: 2026-03-29)

**Delivered:** bGSD now ships a fully wired TDD reliability and fresh-context acceleration milestone with deterministic TDD contracts, semantic proof validation, faster phase execution paths, durable handoffs, resume freshness enforcement, and end-to-end proof delivery through resumable summaries.

**Phases completed:** 6 phases (149-154), 19 plans
**Timeline:** 2 days (2026-03-28 -> 2026-03-29)

**Key accomplishments:**
- Deterministic TDD selection, rationale visibility, and severity guidance now stay aligned across planner, checker, roadmap docs, workflows, templates, and CLI help
- `execute:tdd` now enforces exact-command RED/GREEN/REFACTOR validation with structured proof payloads and trailer-aware summary audit rendering
- `phase:snapshot`, snapshot-backed init reuse, and batched `verify:state complete-plan` reduce repeated discovery and fragmented plan-finalization work
- Cached plan indexing, durable handoff artifacts, and exact resume/inspect/restart summaries now power fresh-context chaining through production workflow entrypoints
- Runtime resume freshness enforcement now validates canonical phase-input fingerprints and provides repair guidance for stale or corrupt handoff sets
- Production-created TDD audit sidecars now survive resumable handoff refreshes, surface in resume inspection, and re-render in downstream summaries end to end
- All 14 milestone requirements delivered across TDD-* and FLOW-* categories

**What's next:** Ready for next milestone - `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v16.1-ROADMAP.md`
- `.planning/milestones/v16.1-REQUIREMENTS.md`
- `.planning/milestones/v16.1-DOCS.md`
- `.planning/milestones/v16.1-MILESTONE-AUDIT.md`
- `.planning/milestones/v16.1-phases/`

---

## ✅ v16.0 Enterprise Developer Team (Shipped: 2026-03-28)

**Delivered:** bGSD now ships as a more complete AI development team with destructive-command safety guardrails, structured agent memory, code review, security audit, readiness reporting, and a dry-run-first release workflow.

**Phases completed:** 5 phases (144-148), 15 plans
**Timeline:** 1 day (2026-03-28)

**Key accomplishments:**
- GARD-04 destructive command detection with Unicode-aware matching, sandbox bypass rules, and strong regression coverage
- Markdown-backed `MEMORY.md` storage with stable IDs, management CLI, frozen prompt snapshots, and unsafe-entry blocking
- `/bgsd-review` with scan-first analysis, safe auto-fix routing, ASK batching, and CLI bootstrap through `init:review`
- `/bgsd-security` with OWASP coverage, secrets scanning, dependency advisory checks, and verifier-backed reporting
- `review:readiness` advisory output plus dry-run release analysis, changelog drafting, resumable tag/PR automation, and `/bgsd-release`
- All 23 milestone requirements delivered across SAFE, MEM, REV, SEC, READY, and REL categories

**What's next:** Ready for next milestone - `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v16.0-ROADMAP.md`
- `.planning/milestones/v16.0-REQUIREMENTS.md`
- `.planning/milestones/v16.0-DOCS.md`

---

## ✅ v12.1 Tool Integration & Agent Enhancement (Shipped: 2026-03-15)

**Delivered:** Integrated 6 modern CLI tools (ripgrep, fd, jq, yq, bat, gh) into core workflows with graceful degradation, unified detection infrastructure, and 5 new decision functions enabling smarter agent routing and inter-agent collaboration.

**Phases completed:** 5 phases (124-128), 13 plans
**Timeline:** 1 day (2026-03-15)
**Tests:** 1,565 passing (up from 1,280 baseline, +285 new tests)

**Key accomplishments:**
- Unified tool detection infrastructure (`detect.js`) with 5-min file cache, cross-platform PATH resolution, semver comparison, and `detect:tools` JSON API
- 6 CLI tools integrated with graceful Node.js fallbacks: ripgrep (search), fd (discovery), jq (JSON transform), yq (YAML), bat (syntax highlighting), gh (GitHub ops)
- 5 new decision functions in DECISION_REGISTRY: `resolveFileDiscoveryMode`, `resolveSearchMode`, `resolveJsonTransformMode`, `resolveAgentCapabilityLevel`, `resolvePhaseDependencies`
- `tool_availability` injected into bgsd-context enrichment — agents see tool status before task decomposition
- 9 agent pair handoff contracts with rich/minimal tool context split; `handoff_tool_context` in enricher output
- Silent capability-aware context filtering in `scopeContextForAgent` — tool-independent agents receive lean context
- `resolvePhaseDependencies` uses Kahn topological sort for multi-phase sequencing with tool-aware tie-breaking
- 285 new tests across 5 phases (all 1565 passing, including Phase 128's 114 contract/integration tests)
- All 11/11 requirements delivered across 3 categories (TOOL-*, AGENT-*, TOOL-DEGR-*)

**What's next:** Ready for next milestone — `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v12.1-ROADMAP.md`
- `.planning/milestones/v12.1-REQUIREMENTS.md`
- `.planning/milestones/v12.1-DOCS.md`

---

## ✅ v12.0 SQLite-First Data Layer (Shipped: 2026-03-15)

**Delivered:** Transformed SQLite from a dumb file cache into the structured data backbone for all workflow operations — parsed state persists across invocations, queries replace markdown re-parsing, and workflows get deterministic data from SQL instead of subprocess calls or LLM inference.

**Phases completed:** 6 phases (118-123), 16 plans
**Commits:** 80 | **Files changed:** 274 | **Lines:** +46,635 / -19,837
**Timeline:** 2 days (2026-03-14 → 2026-03-15)
**Tests:** 1,280 passing (0 failures)

**Key accomplishments:**
- Built DataStore class with schema versioning (v1-v5), WAL mode, migration runner, and transparent Map fallback for Node <22.5
- Created structured planning tables (phases, plans, tasks, requirements) with PlanningCache write-through caching and git-hash + mtime hybrid invalidation
- Eliminated enricher duplication (3x parsePlans, 3x listSummaryFiles) with SQLite-first data paths — measurably faster warm starts (<50ms enrichment)
- Migrated sacred data (decisions, lessons, trajectories, bookmarks) to SQLite with dual-write preserving JSON backups as git-trackable source of truth
- Implemented 6 new deterministic decision functions (model-selection, verification-routing, research-gate, phase-readiness, milestone-completion, commit-strategy) consuming SQLite-backed state
- Moved session state to SQLite — STATE.md becomes a generated view with SQL-first reads/writes ensuring markdown and SQL consistency
- All 23/23 requirements delivered across 6 categories (FND, TBL, ENR, MEM, DEC, SES)

**What's next:** Ready for next milestone — `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v12.0-ROADMAP.md`
- `.planning/milestones/v12.0-REQUIREMENTS.md`
- `.planning/milestones/v12.0-DOCS.md`

---

## ✅ v11.3 LLM Offloading (Shipped: 2026-03-13)

**Delivered:** Programmatic decision engine offloading deterministic LLM decisions to code, with audit scanner, pure decision functions, workflow integration, and summary generation automation.

**Phases completed:** 4 phases (110-113), 9 plans
**Commits:** 49 | **Files changed:** 92 | **Lines:** +15,796 / -16,098
**Timeline:** 1 day (2026-03-13)

**Key accomplishments:**
- Built audit scanner finding 87 LLM-offloadable decision candidates with 7-criteria rubric scoring and token estimation (~22K tokens/session savings)
- Created 12 pure decision functions with progressive confidence model (HIGH/MEDIUM/LOW) and 85 contract tests
- CLI decisions namespace (list/inspect/evaluate) for querying and debugging decision resolution
- Extended bgsd-context enrichment with 15+ pre-computed decision inputs and 46 contract tests
- Simplified 13 workflows to consume pre-computed decisions (82% LLM reasoning reduction, ~27 steps saved per session)
- Built summary:generate CLI command pre-filling SUMMARY.md from git/plan data, reducing LLM writing by 50%+
- All 13/13 requirements delivered

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v11.3-ROADMAP.md`
- `.planning/milestones/v11.3-REQUIREMENTS.md`
- `.planning/milestones/v11.3-DOCS.md`

---

## ✅ v11.2 Additional Refinement (Shipped: 2026-03-12)

**Delivered:** Additional CLI refinements and polish from Phase 115 execution.

**Phases completed:** 1 phase (115), 1 plan
**Commits:** 5 | **Files changed:** 12 | **Lines:** +2,100 / -890
**Timeline:** 1 day (2026-03-12)

**Key accomplishments:**
- Verified and fixed command routing for all 40+ slash commands
- Added missing help documentation for utility commands
- Fixed edge cases in command parsing and workflow execution

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- See archived ROADMAP.md

---

## ✅ v11.1 CLI Refinement (Shipped: 2026-03-12)

**Delivered:** Command routing improvements with direct execution, zero friction workflows, and polish fixes.

**Phases completed:** 3 phases (103-105), 8 plans
**Commits:** 42 | **Files changed:** 87 | **Lines:** +8,450 / -3,200
**Timeline:** 2 days (2026-03-11 → 2026-03-12)

**Key accomplishments:**
- Implemented direct slash command routing — `/bgsd {cmd}` executes workflow immediately without prompts
- Removed clarification loops with smart default selection based on context
- Fixed command confusion scenarios with actionable error messages
- All 9 requirements delivered (ROUTE-01 through POLY-03)

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v11.1-ROADMAP.md`
- `.planning/milestones/v11.1-REQUIREMENTS.md`
- `.planning/milestones/v11.1-DOCS.md`

---

## ✅ v11.0 Natural Interface & Insights (Shipped: 2026-03-11)

**Delivered:** Natural language command parsing, rich visualization with burndown charts and sparklines, and terminal dashboard.

**Phases completed:** 5 phases (98-102), 7 plans
**Commits:** 38 | **Files changed:** 76 | **Lines:** +12,800 / -5,400
**Timeline:** 1 day (2026-03-11)

**Key accomplishments:**
- Built natural language foundation with intent classification and parameter extraction
- Implemented progress bars, milestone progress, and quality score visualization
- Created ASCII burndown charts showing planned vs actual progress
- Added velocity sparklines for inline trend display
- Built terminal dashboard with key project metrics overview
- Implemented milestone summaries and velocity metrics reporting
- 12/12 requirements delivered (NL-01 through VIS-08)

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v11.0-ROADMAP.md`
- `.planning/milestones/v11.0-REQUIREMENTS.md`
- `.planning/milestones/v11.0-DOCS.md`

---

## ✅ v10.0 Agent Intelligence & UX (Shipped: 2026-03-11)

**Phases completed:** 7 phases (91-97), 12 plans

**Key accomplishments:**
- Enhanced format.js with CLI color control flags, Spinner class, and nested ProgressTracker
- Created error.js module with structured error classes and formatted output with recovery suggestions
- Created debug.js module with trace, context dump, and state inspection utilities
- Enhanced planner skills with dependency detection, task sizing feedback loop, and parallelization analysis
- Added CLI commands for dependency analysis, scope estimation, and parallelization warnings
- Added execution intelligence modules for autonomous deviation recovery, complexity-based checkpoint decisions, and stuck/loop pattern detection
- Structured handoff context transfer, shared context registry, and contract verification for multi-agent collaboration
- Implemented CLI contextual help with command history, autocomplete hints, and examples
- Reduced bundle size by ~50% through minification and tree-shaking

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v10.0-ROADMAP.md`
- `.planning/milestones/v10.0-REQUIREMENTS.md`
- `.planning/milestones/v10.0-DOCS.md`

---

## ✅ v9.3 Quality, Performance & Agent Sharpening (Shipped: 2026-03-10)

**Delivered:** Agent sharpening with zero-overlap validation, command consolidation (78% reduction), deterministic context loading, Bun runtime integration, and benchmark adapter.

**Phases completed:** 5 phases (86-90), 12 plans
**Commits:** 20 | **Files changed:** 109 | **Lines:** +11,434 / -5,079
**Timeline:** 1 day (2026-03-10)

**Key accomplishments:**
- Agent manifest audit found zero capability conflicts - verify:agents command created for automated boundary validation
- Handoff contracts documented in RACI skill with inputs, outputs, preconditions for all 10 agent pairs
- Created 8 subcommand wrapper commands organizing 41 slash commands into logical groups
- Consolidated 50 slash commands into 11 (8 wrappers + 3 standalone) - 78% reduction
- Deterministic context loading with git-hash cache invalidation for 6 agent types (50% token reduction)
- Reachability audit system with verify:orphans CLI command
- Bun runtime detection with config persistence and startup banner
- Runtime fallback via BGSD_RUNTIME env var - 1.2-1.6x speedup measured
- Plugin benchmark adapter with /bgsd-measure command capturing startup, execution, memory, context load metrics

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v9.3-ROADMAP.md`
- `.planning/milestones/v9.3-REQUIREMENTS.md`
- `.planning/milestones/v9.3-DOCS.md`

---

## ✅ v9.2 CLI Tool Integrations & Runtime Modernization (Shipped: 2026-03-10)

**Delivered:** Deep plugin integration with always-on context injection, native LLM tools, event-driven state synchronization, and advisory guardrails.

**Phases completed:** 6 phases (71-76), 15 plans, 35 tasks
**Commits:** 83 | **Files changed:** 217 | **Lines:** +34,616 / -2,113
**Timeline:** 2 days (2026-03-08 → 2026-03-09)

**Key accomplishments:**
- Established plugin foundation with ESM build target, safeHook boundaries, in-process parsers, and enforced `bgsd_` tool naming
- Completed full rebrand to `bgsd-*` names across source, workflows, commands, agents, install/deploy paths, and tests
- Replaced workflow `init:*` subprocess calls with plugin-injected `<bgsd-context>` across 19 workflows
- Delivered five native LLM-callable tools (`bgsd_status`, `bgsd_plan`, `bgsd_context`, `bgsd_validate`, `bgsd_progress`) with Zod schemas and build-time validation
- Added event-driven sync features: idle validation auto-fix, `.planning/` file watcher cache invalidation, and stuck/loop notifications
- Added advisory guardrails with 27-test coverage and bug fixes for path filtering and guard condition precedence

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v9.2-ROADMAP.md`
- `.planning/milestones/v9.2-REQUIREMENTS.md`
- `.planning/milestones/v9.2-DOCS.md`

---

## ✅ v9.1 Performance Acceleration (Shipped: 2026-03-10)

**Delivered:** Dependency-driven performance acceleration with validation modernization, file discovery optimization, compile-cache acceleration, and SQLite statement caching.

**Phases completed:** 5 phases (77-81), 13 plans
**Commits:** 65 | **Files changed:** 115 | **Lines:** +36,356 / -29,577
**Timeline:** 3 days (2026-03-08 → 2026-03-10)

**Key accomplishments:**
- Built validation adapter with valibot implementation and zod fallback — 34% improvement on modern path
- Created dual-path file discovery adapter with fast-glob integration and in-process ignore matching
- Eliminated git check-ignore subprocess overhead in file discovery
- Added compile-cache guard with BGSD_COMPILE_CACHE env var and Node 10.4+ capability detection
- Achieved 76-102ms warm start speedup via Node 22+ compile-cache by default
- Implemented SQLite statement caching reducing p50 latency by ~43%, p99 by ~22%
- Created unified optimization flags registry with env var overrides
- Built generalized parity-check utility for all dependency-backed optimizations

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v9.1-ROADMAP.md`
- `.planning/milestones/v9.1-REQUIREMENTS.md`
- `.planning/milestones/v9.1-DOCS.md`

---

## ✅ v8.3 Agent Quality & Skills (Shipped: 2026-03-09)

**Delivered:** OpenCode skills architecture (27 skills, 52.4% agent line reduction), agent consistency across all 10 agents, GitHub CI agent overhaul, and fully green test suite (766 tests, 0 failures)

**Phases completed:** 4 phases (67-70), 11 plans
**Commits:** 92 | **Files changed:** 235 | **Lines:** +21,340 / -11,537
**Timeline:** 2 days (2026-03-07 → 2026-03-08)
**Tests:** 766 passing (0 failures)

**Key accomplishments:**
- Brought GitHub CI agent to quality standard with project_context, deviation_rules, state tracking, structured_returns, and unified checkpoint format matching executor/planner patterns
- Achieved agent consistency across all 10 agents — all now have project_context discovery, PATH SETUP, and structured_returns blocks
- Shipped OpenCode skills architecture — 27 skills extracted from inline agent content, reducing agent definitions by 52.4% (7,361 to 3,504 lines) with full build/deploy/install pipeline
- Fixed 49 pre-existing test failures across config-migrate, compact, codebase-impact, extract-sections, and context-budget — test suite fully green at 766 tests
- Added pre-commit test gate to executor workflow for zero tolerance on test regressions
- All 17/17 requirements delivered, 0 new test failures introduced

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v8.3-ROADMAP.md`
- `.planning/milestones/v8.3-REQUIREMENTS.md`
- `.planning/milestones/v8.3-DOCS.md`

---

## ✅ v8.2 Cleanup, Performance & Validation (Shipped: 2026-03-07)

**Delivered:** Dead code removal, namespace-only routing, init performance optimization, and RACI-validated agent architecture with handoff contracts

**Phases completed:** 6 phases (61-66), 14 plans
**Commits:** 67 | **Files changed:** 148 | **Lines:** +18,370 / -9,080
**Timeline:** 5 days (2026-03-03 → 2026-03-07)
**Bundle:** 1,163KB (down from 1,216KB)

**Key accomplishments:**
- Built audit infrastructure (knip, madge, esbuild metafile) and manifest-based deploy sync with automatic stale file removal
- Removed ~80 dead internal exports from 24 files + 12 dead files (1 JS, 11 .md), cleaned 4 orphaned CONFIG_SCHEMA keys
- Migrated all CLI routing to namespace:command syntax, removing ~890-line backward-compat block (router.js 1642→928 lines, bundle -35KB)
- Achieved 24-40% init speedup with 97% I/O reduction via lazy acorn loading (230KB deferred) and cached git info
- Created RACI matrix (23 lifecycle steps, 12 handoff contracts) validating clean separation across all 9 agents — zero merge candidates
- All 22 requirements delivered, 0 new test failures introduced

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v8.2-ROADMAP.md`
- `.planning/milestones/v8.2-REQUIREMENTS.md`
- `.planning/milestones/v8.2-DOCS.md`

---

## ✅ v8.1 RAG-Powered Research Pipeline (Shipped: 2026-03-06)

**Delivered:** RAG-powered research pipeline with chunking, embedding, vector storage, and semantic search capabilities.

**Phases completed:** 5 phases (56-60), 12 plans
**Commits:** 71 | **Files changed:** 156 | **Lines:** +12,100 / -2,800
**Timeline:** 1 day (2026-03-06)

**Key accomplishments:**
- Built RAG pipeline with chunking strategies for different file types
- Implemented embedding generation with multiple provider support
- Created vector storage with SQLite-backed embeddings
- Added semantic search with relevance scoring
- Integrated research results into planning workflows

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v8.1-ROADMAP.md`
- `.planning/milestones/v8.1-REQUIREMENTS.md`
- `.planning/milestones/v8.1-DOCS.md`

---

## ✅ v8.0 Performance & Agent Architecture (Shipped: 2026-03-05)

**Delivered:** SQLite L1/L2 caching with Map fallback, agent consolidation (11→9), token budgets, namespace routing, and profiler instrumentation.

**Phases completed:** 5 phases (51-55), 14 plans
**Commits:** 83 | **Files changed:** 201 | **Lines:** +13,430 / -3,683
**Timeline:** 3 days (2026-03-03 → 2026-03-05)

**Key accomplishments:**
- Built SQLite L1/L2 caching with graceful Map fallback — zero dependencies
- Consolidated agents from 11 to 9 with RACI matrix and automated audit
- Implemented token budgets (60-80K) declared in all 9 agent manifests
- Added namespace routing with colon syntax for CLI command organization
- Created profiler instrumentation with compare and speedup tools
- Added auto changelog generation for milestone wrapup

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v8.0-ROADMAP.md`
- `.planning/milestones/v8.0-REQUIREMENTS.md`
- `.planning/milestones/v8.0-DOCS.md`

---

## ✅ v7.1 Trajectory Engineering (Shipped: 2026-03-02)

**Delivered:** Structured exploration system with checkpoint, pivot, compare, and choose commands for managing multiple approaches, plus a decision journal and dead-end detection for agent context

**Phases completed:** 6 phases (45-50), 12 plans
**Commits:** 64 | **Files changed:** 363 | **Lines:** +22,352 / -10,367
**Timeline:** 3 days (2026-02-28 → 2026-03-01)
**Tests:** 751 passing
**Bundle:** 1,058KB

**Key accomplishments:**
- Built decision journal foundation with trajectories sacred memory store, crypto-generated IDs, cross-session persistence, and selective git rewind preserving `.planning/` state
- Created checkpoint system with named snapshots, auto-collected metrics (tests, LOC delta, complexity), branch-based tracking (`trajectory/<scope>/<name>/attempt-N`), and formatted list command
- Implemented pivot engine with structured reason capture, auto-checkpoint of abandoned work, selective code rewind, and stuck-detector integration suggesting pivots after 3 failures
- Added multi-attempt comparison with side-by-side metrics matrix, color-coded TTY output (green=best, red=worst), best/worst identification per metric, and JSON fallback
- Built choose & cleanup lifecycle — merge winning attempt via `--no-ff`, archive alternatives as lightweight tags, clean up trajectory branches, and record final choice in journal
- Wired agent context integration — dead-end detection queries journal before new work, `previous_attempts` injected into init execute-phase output, scope validation across all trajectory commands

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v7.1-ROADMAP.md`
- `.planning/milestones/v7.1-REQUIREMENTS.md`

---

## ✅ v7.0 Agent Orchestration & Efficiency (Shipped: 2026-02-27)

**Delivered:** Intelligent agent orchestration with AST intelligence, task routing, context efficiency, TDD execution engine, code review gates, and stuck/loop detection

**Phases completed:** 8 phases (37-44), 15 plans
**Commits:** 72 | **Files changed:** 237 | **Lines:** +28,325 / -3,734
**Timeline:** 2 days (2026-02-26 → 2026-02-27)
**Tests:** 669 passing (3 pre-existing context-budget failures)
**Bundle:** 1000KB

**Key accomplishments:**
- Built contract test safety net with snapshot-based consumer tests and enhanced git.js (structured log, diff, blame, branch info, pre-commit safety checks)
- Added AST intelligence via acorn parser — function signatures, export analysis, per-function complexity metrics, ~1k token repo map, multi-language regex fallback
- Created orchestration intelligence — task complexity scoring (1-5), automatic agent/model routing, execution mode selection (single/parallel/team)
- Achieved 40-60% context reduction via agent manifests (whitelist-based), compact serialization, and task-scoped file injection using dependency graph + relevance scoring
- Built gsd-reviewer agent with two-stage review (spec compliance + code quality), BLOCKER/WARNING/INFO severity classification, and commit attribution via git trailers
- Implemented TDD execution engine with RED→GREEN→REFACTOR state machine, orchestrator-enforced gates, auto test-after-edit, anti-pattern detection, and stuck/loop recovery

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v7.0-ROADMAP.md`
- `.planning/milestones/v7.0-REQUIREMENTS.md`

---

## ✅ v6.0 UX & Developer Experience (Shipped: 2026-02-27)

**Delivered:** Polished CLI with shared formatting engine, TTY-aware branded output, tightened workflow output, and 11 slash command wrappers

**Phases completed:** 7 phases (30-36), 11 plans
**Commits:** 29 | **Files changed:** 102 | **Lines:** +6,275 / -1,982
**Timeline:** 1 day (2026-02-26 → 2026-02-27)
**Tests:** 574 passing (0 failing)
**Bundle:** 681KB

**Key accomplishments:**
- Built shared formatting engine (`src/lib/format.js`) with formatTable, progressBar, banner, box, and ~2KB picocolors-pattern color utility with TTY-aware auto-disable
- Added smart output detection — human-readable branded output in TTY mode, JSON when piped — with `--raw` and `--pretty` overrides, backward-compatible --raw acceptance
- Migrated all user-facing commands (init, state, verify, codebase, velocity, intent) to shared formatting with co-located formatter functions, agent-consumed commands untouched
- Tightened workflow output across 27 files (455-line reduction, help.md cut 44%), updated ui-brand.md with bGSD patterns and format.js function references
- Created 11 slash command wrappers in `commands/` directory with updated deploy.sh safe sync, and rewrote AGENTS.md as lean 59-line project index
- Fixed 2 failing v5.0 tests (outputJSON rawValue bug), added format utility test coverage, all 574 tests green

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v6.0-ROADMAP.md`
- `.planning/milestones/v6.0-REQUIREMENTS.md`

---

## ✅ v5.0 Codebase Intelligence (Shipped: 2026-02-26)

**Delivered:** Codebase awareness with convention extraction, dependency graphs, lifecycle analysis, and task-scoped context injection

**Phases completed:** 7 phases (23-29), 14 plans
**Commits:** 79 | **Files changed:** 185 | **Lines:** +27,096 / -8,274
**Timeline:** 2 days (2026-02-25 → 2026-02-26)
**Tests:** 572 passing (2 failing)
**Bundle:** 672KB

**Key accomplishments:**
- Built codebase-intel.json storage with git-hash watermarks, staleness detection, incremental analysis, and auto-trigger on init commands
- Created convention extraction engine detecting naming patterns, file organization rules, and framework-specific macros (Elixir/Phoenix) with confidence scoring and `codebase rules` generator (capped at 15 rules)
- Implemented module dependency graph from import/require/use statements across 6 languages (JS, TS, Python, Go, Elixir, Rust) with Tarjan's SCC cycle detection and transitive impact analysis
- Added lifecycle awareness detecting execution order relationships (seeds, migrations, config, boot) with framework-specific detector registry (starting with Elixir/Phoenix)
- Built task-scoped context injection (`codebase context --files`) with heuristic relevance scoring (graph distance + plan scope + git recency) and 5K token budget
- Wired codebase intelligence into init commands (compact three-field summary with confidence scores), execute-phase (pre-flight convention checks), and codebase-impact (graph-backed)
- Added non-blocking background re-analysis with lock file and --refresh flag for on-demand sync

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v5.0-ROADMAP.md`
- `.planning/milestones/v5.0-REQUIREMENTS.md`

---

## ✅ v4.0 Environment & Execution Intelligence (Shipped: 2026-02-25)

**Delivered:** Environment detection, MCP server profiling, structured requirements, and git worktree parallelism

**Phases completed:** 5 phases, 13 plans
**Commits:** 55 | **Files changed:** 70 | **Lines:** +16,399 / -2,478
**Timeline:** 1 day (2026-02-25)
**Tests:** 502 passing (0 failures)
**Bundle:** 549KB / 550KB budget

**Key accomplishments:**
- Built environment detection engine with 26 manifest patterns, package manager precedence, binary version checks, and auto-inject "Tools:" summary into init commands via env-manifest.json with staleness detection
- Created MCP server profiling with 20-server token estimation database, 16-type relevance scoring against project files, keep/disable/review recommendations, and auto-disable with backup/restore
- Added structured requirements with ASSERTIONS.md template, per-assertion verification (pass/fail/needs_human), traceability chain display, test-command mapping, and planner workflow integration
- Implemented git worktree parallelism with full CRUD lifecycle, merge-tree conflict pre-check, lockfile auto-resolution, static file overlap detection, and execute-phase Mode A/B branching
- Added session management with session-summary CLI command and complete-and-clear workflow for clean session handoffs

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v4.0-ROADMAP.md`
- `.planning/milestones/v4.0-REQUIREMENTS.md`

---

## ✅ v3.0 Intent Engineering (Shipped: 2026-02-25)

**Delivered:** INTENT.md capture, drift validation, traceability matrix, and workflow-wide intent injection

**Phases completed:** 4 phases, 10 plans
**Commits:** 43 | **Files changed:** 47 | **Lines:** +10,142 / -400
**Timeline:** 1 day (2026-02-24 → 2026-02-25)
**Tests:** 348 passing (0 failures)
**Bundle:** 447KB / 450KB budget

**Key accomplishments:**
- Built INTENT.md template and CRUD commands (create, read/show, update, validate) with structured sections for capturing project purpose, desired outcomes, health metrics, target users, constraints, and success criteria
- Implemented intent tracing with per-plan intent sections in YAML frontmatter, traceability matrix showing outcome-to-phase mapping, and coverage gap detection for unaddressed outcomes
- Added intent drift validation with 4 signals (coverage gap, objective mismatch, feature creep, priority inversion) producing a weighted 0-100 drift score as advisory pre-flight
- Injected intent context into all workflows (research, planning, execution, verification) via getIntentSummary() — all injections conditional, zero impact on projects without INTENT.md
- Created guided intent questionnaire in new-project and new-milestone workflows (Step 4.5) so projects start with clear intent before requirements
- Added intent evolution tracking with history section, auto-logging changes with milestone context and --reason flag

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v3.0-ROADMAP.md`
- `.planning/milestones/v3.0-REQUIREMENTS.md`

---

## ✅ v2.0 Quality & Intelligence (Shipped: 2026-02-24)

**Delivered:** State validation, cross-session memory, quality scoring with A-F grades, and 297 integration tests

**Phases completed:** 4 phases, 13 plans
**Commits:** 25 | **Files changed:** 61 | **Lines:** +14,172 / -2,553
**Timeline:** 3 days (2026-02-22 → 2026-02-24)
**Tests:** 297 passing (0 failures)
**Bundle:** 373KB / 400KB budget

**Key accomplishments:**
- Built state validation engine with 5 drift-detection checks (plan count, position, stale activity, blocker staleness, plan claims) and auto-fix for unambiguous corrections
- Implemented cross-session memory system with dual-store pattern (STATE.md authority + memory.json cache), sacred data protection, bookmark auto-save, and deterministic compaction
- Added comprehensive quality gates: test gating, requirement checking, regression detection, multi-dimensional quality scoring (A-F grades), and plan single-responsibility analysis with union-find concern grouping
- Created integration test infrastructure: workflow sequence tests, state round-trips, E2E simulation, snapshot tests, and test coverage tracking across 297 tests
- Added bundle size tracking (400KB budget), token budgets for workflows, compact-as-default for all init commands, and MCP server discovery

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v2.0-ROADMAP.md`
- `.planning/milestones/v2.0-REQUIREMENTS.md`

---

## ✅ v1.1 Context Reduction & Tech Debt (Shipped: 2026-02-22)

**Delivered:** 46.7% init output reduction, 54.6% workflow compression, and tokenx-based BPE estimation

**Phases completed:** 4 phases, 10 plans
**Commits:** 42 | **Files changed:** 78 | **Lines:** +12,642 / -4,576
**Timeline:** 1 day (2026-02-22)

**Key accomplishments:**
- Integrated tokenx for accurate BPE-based token estimation with workflow baseline measurement and before/after comparison tooling
- Added --compact flag achieving 46.7% average output reduction across all 12 init commands, plus opt-in --manifest for context-aware loading
- Built extract-sections CLI with dual-boundary parsing enabling 67% reference file reduction via selective section loading
- Compressed top 8 workflows by 54.6% average (39,426 to 15,542 tokens) preserving all behavioral logic
- Added summary/detail tiers to all 6 research templates for context-aware planner loading
- Resolved all pre-existing tech debt: fixed failing test, completed 44-command help coverage, created plan templates

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`

---

## ✅ v1.0 Performance & Quality (Shipped: 2026-02-22)

**Delivered:** 153+ tests, debug logging, module split with esbuild, --help coverage, and security hardening

**Phases completed:** 5 phases, 14 plans
**Commits:** 63 | **Files changed:** 86 | **Lines:** +24,142 / -5,143
**Timeline:** 2 days (2026-02-21 → 2026-02-22)

**Key accomplishments:**
- Built safety net with 153+ tests covering state mutations, frontmatter parsing, and config schema
- Instrumented all 96 catch blocks with GSD_DEBUG-gated stderr logging for full observability
- Made all 15 feature commands discoverable via --help (43 entries) and 11 new slash commands
- Split monolith into 15 organized src/ modules with esbuild bundler producing single-file deploy
- Added in-memory file cache and batch grep to eliminate redundant I/O
- Hardened CLI against shell injection and temp file leaks with sanitizeShellArg() and cleanup handlers

**What's next:** Ready for next milestone — `/bgsd milestone new`

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---

## v12.0 SQLite-First Data Layer (Shipped: 2026-03-15)

**Phases completed:** 35 phases, 77 plans, 6 tasks

**Key accomplishments:**
- isTTY banner guard eliminates 576 JSON parse failures, dead profiler tests removed — 990/998 tests now pass
- Test suite fully stabilized — zero failures, 1008 tests passing across 21 test files
- SQLite database abstraction in src/lib/db.js — WAL mode, PRAGMA user_version migrations, Map fallback, and silent delete-and-rebuild recovery
- Eager SQLite db init wired into every bGSD CLI command at startup; cache:clear extended to sweep .planning/.cache.db and WAL/SHM companions
- 52-test suite in tests/db.test.cjs covering all FND-01/FND-04 requirements — WAL mode, migrations, Map fallback, corruption recovery, and interface parity
- SQLite planning tables schema (MIGRATIONS[1] → version 2) plus PlanningCache class with mtime invalidation, storeRoadmap/storePlan write-through, and getPhases/getPlan/getRequirements queries
- SQLite-first caching wired into roadmap/plan parsers via ESM db-cache.js adapter — cache hits, write-through, mtime invalidation, and eager startup check all integrated
- 71-test suite covering PlanningCache schema migration (7 tables), mtime invalidation lifecycle, TBL-01 through TBL-04 store/query round-trips, and MapDatabase fallback — plus clearForCwd() added to planning-cache.js
- Zero-redundancy enricher: parsePlans and listSummaryFiles called exactly once per invocation via lazy closures, with SQLite-first data paths serving plan/summary counts from SQL on warm cache
- Timing instrumentation (_enrichment_ms) + background cache warm-up in plugin init + 29-test enricher.test.cjs verifying <50ms warm-cache enrichment and output shape invariance
- SQLite memory store schema (v3) with 4 memory_* tables plus PlanningCache migration/search/write/clear/bookmark methods
- Dual-write to SQLite on all memory/trajectory writes plus SQL-first search in cmdMemoryRead and SQLite-first reads in cmdInitMemory
- 19 new tests covering SQLite migration (7), SQL LIKE search (5), dual-write CLI (3), and trajectory dual-write (4) — full MEM-01/02/03 coverage
- SQLite model_profiles table with auto-seeded defaults, 5 new decision functions (model-selection, verification-routing, research-gate, milestone-completion, commit-strategy), and expanded plan-existence-route with 3 new return values
- Enricher wired to populate all 6 decision rule inputs, model consumers migrated to decision-rule path, 61 new tests covering all new rules with contract + edge case + integration coverage
- Schema v5 with 6 session state SQLite tables and full PlanningCache CRUD API for position tracking, metrics, decisions, todos, blockers, and continuity
- SQL-first writes for all cmdState* commands via PlanningCache + mtime-based re-import of manual STATE.md edits
- SQLite-first parseState() with getDecisions/getTodos/getBlockers/getMetrics query methods + 33-test session state suite covering schema, CRUD, migration, round-trip, re-import, and Map fallback
- ASCII visualization modules for progress bars, milestone completion, and quality scores
- Unified visualization API with end-to-end verification of ASCII output
- ASCII burndown chart visualization with ideal vs actual progress tracking
- Velocity sparkline visualization for session trend display
- Terminal dashboard with keyboard navigation for project metrics overview
- Milestone summary report module with on-demand CLI access
- Velocity metrics computation module with CLI access
- Mapped all 14 command groups and identified clarification prompt locations in NL modules
- Added bypass flags to NL modules enabling direct command routing without clarification prompts
- Verified all commands route correctly and success criteria are met
- Help-command alignment validation and exact-match override for deterministic command execution
- Confidence threshold (60%) auto-executes commands, context boosts matching phase, user choice learning improves future suggestions
- Verified all 77 commands route correctly with 60% confidence threshold, context boost, and --exact override for zero-friction goal
- Command confusion suggestions with 90% confidence threshold, --defaults flag for smart defaults bypass, and enhanced error messages with actionable suggestions
- Removed verify:orphans command and performance profiler from bundle, reducing size by 14.5KB
- Inventory of all exports and imports in src/ using AST analysis, with protected API allowlist
- Identified 1 potentially unused export (BgsdPlugin), verified used in tests, no safe removals
- Static analysis confirms no unreachable code in bGSD plugin - codebase is clean
- Confirmed codebase has no dead code - cleanup phase verified clean state
- Automated jscpd duplicate code detection on src/ with 70% threshold - found 40+ duplicate blocks across lib/, commands/, plugin/
- Analyzed duplicate patterns from plan 01 - decided to skip all consolidations based on clarity-over-DRY principle
- Verified test suite, build, and CLI commands - all working (pre-existing test failures noted)
- Implemented verify:handoff and verify:agents CLI commands for agent handoff validation
- Removed orphaned ci.js module, dead execute:profile route, and deduplicated standalone runtime/measure commands
- Command validator synchronized with router — audit namespace added, 5 stale subcommand lists corrected
- Added 32 COMMAND_HELP entries for util, verify, and cache routes - all routed commands now respond to --help
- Cleaned MILESTONES.md with 21 milestone entries in chronological order with consistent formatting
- Fixed PROJECT.md HTML structure, updated counts from 53→52 modules and 1014→1008 tests, removed strikethrough items from out-of-scope list
- Added CLI artifact validation as build gate, archived resolved Node.js version constraint
- INTENT.md automatic archival during milestone completion — completed outcomes archived to per-milestone files, active file stays lean with only current objective and pending outcomes
- Adapter-backed bgsd_plan validation now runs on valibot by default with zod fallback flags and parity-tested output contracts.
- Migrated remaining plugin tools to adapter validation with cross-engine contract parity tests and recorded a 34.48% faster VALD-01 modern validation run versus legacy fallback.
- Closed Phase 77 validation gaps by fixture-stabilizing `bgsd_context` fallback parity tests, adding explicit adapter-mediated fallback evidence for `bgsd_progress`, and revalidating full regression gates.
- Discovery now runs through a dual-path adapter that supports fast-glob traversal and in-process ignore matching while preserving legacy output contracts by default.
- Discovery hot paths now default to optimized in-process traversal, eliminating per-entry git check-ignore subprocess overhead with 8 behavioral tests proving activation.
- Parity fixture matrix proves legacy-vs-optimized source-dir equivalence across 15 edge-case fixtures with benchmark evidence and diagnoseParity() for mismatch triage.
- V8 compile-cache wrapper with BGSD_COMPILE_CACHE guard, runtime detection, and 10% benchmark improvement
- Created bin/bgsd wrapper script to apply --experimental-code-cache flag, achieving RUNT-01 warm-start speedup
- Fixed bin/bgsd wrapper to skip compile-cache flag on Node 22+, eliminating 58% startup regression
- SQLite statement caching using createTagStore() with env var guard reduces p50 latency by ~43%
- Added unified optimization flags registry in CONFIG_SCHEMA with env var support and settings display command
- Backward compatibility test coverage for .planning/ artifact parsers ensures graceful handling of legacy formats
- Created generalized parity-check utility and bgsd-tools command to validate dependency-backed optimizations
- Enhanced format.js with CLI color control flags, Spinner class, and nested ProgressTracker
- Created error.js module with structured error classes and formatted output with recovery suggestions
- Created debug.js module with trace, context dump, and state inspection utilities
- Integrated format.js, error.js, and debug.js into main CLI with working color and debug flags
- Enhanced planner skills with dependency detection, task sizing feedback loop, and parallelization analysis
- Added CLI commands for dependency analysis, scope estimation, and parallelization warnings
- Added execution intelligence modules for autonomous deviation recovery, complexity-based checkpoint decisions, and stuck/loop pattern detection
- Structured handoff context transfer, shared context registry, and contract verification for multi-agent collaboration
- Implemented CLI contextual help with command history, autocomplete hints, and examples
- Reduced bundle size by ~50% through minification and tree-shaking
- Intent classification and parameter extraction modules with 31 phrase command registry
- Fuzzy matching resolver with disambiguation and contextual help fallback


---

## v13.0 Closed-Loop Agent Evolution (Shipped: 2026-03-16)

**Phases completed:** 6 phases, 12 plans, 0 tasks

**Key accomplishments:**
- YAML validation, content sanitization, and LCS-based unified diff utilities plus agent:list-local scope/drift table command
- agent:override copies global agent to .opencode/agents/ with name: field injection and YAML validation; agent:diff shows unified diff with silent exit when identical
- agent:sync command with --accept/--reject flags for upstream sync, and local_agent_overrides array in bgsd-context enrichment
- 41-pattern security scanner + skills:list + skills:validate in src/commands/skills.js with severity-first findings and hard block on dangerous patterns
- GitHub API fetch + 41-pattern security gate + confirmation pipeline for skills:install, plus skills:remove and append-only audit logging in src/commands/skills.js
- Full CLI routing for skills:list/install/validate/remove, bgsd-context installed_skills field, COMMAND_TREE in discovery, and Step 8.5 skill discovery in new-milestone workflow
- Fixed autonomousRecoveries typo in autoRecovery.js + added lessons:deviation-capture CLI with Rule-1 filter, 3-per-milestone cap, and non-blocking error handling
- Deviation auto-capture hook wired into execute-plan.md + complete help/discovery metadata for lessons:deviation-capture
- RESEARCH.md quality profile engine: 7-field JSON scoring (source count, confidence, gaps, conflicts) with research-score.json cache and research:gaps convenience extractor
- research:score and research:gaps wired into help, discovery, and keyword aliases; new-milestone.md Step 8 surfaces LOW-confidence files with HIGH/MEDIUM gap filter and non-blocking re-research prompt
- Structured lesson capture with LESSON_SCHEMA validation, free-form migration to type:environment, filtered listing, and enhanced memory read for the lessons store
- Lesson analysis pipeline with pattern detection (analyze), advisory suggestions (suggest), deduplication (compact), and non-blocking hooks in verify-work and complete-milestone

---


## v14.0 LLM Workload Reduction (Shipped: 2026-03-17)

**Phases completed:** 4 phases, 12 plans, 2 tasks

**Key accomplishments:**
- workflow:baseline and workflow:compare CLI commands with token measurement, structural fingerprinting (Task/CLI/section/question/XML), snapshot persistence, and 21-test coverage
- Pre-compression baseline (44 workflows, 74230 tokens) + 3 new shared skills (ci-quality-gate, research-pipeline, bgsd-context-init) extracted from duplicate workflow content
- discuss-phase.md and execute-phase.md compressed 42% each with section markers and skill references replacing inline init and CI gate blocks
- Compressed new-milestone (505→275) and execute-plan (376→225) with section markers and 4 skill extractions
- Compressed transition, new-project, resume-project 41-42% each with section markers; new-project research pipeline replaced with skill reference
- audit-milestone (-41%), map-codebase (-43%), quick (-40%), transition (-43%) compressed with section markers; Phase 135 achieves 41.1% average token reduction across all 10 target workflows
- Scaffold merge library with data/judgment separation and 28 unit tests
- plan:generate command with roadmap pre-fill, data/judgment markers, idempotent merge, and 31 integration tests
- verify:generate command with success criteria pre-fill, plan must-haves extraction, idempotent merge, and full idempotency verified
- Conditional elision engine strips if=false workflow sections from output.parts; TDD, auto-test, CI gate, post-execution sections annotated in 3 workflows; 28 tests pass
- Dangling reference check post-elision, workflow:savings cumulative table (42.3% avg reduction), 14 structural regression tests for execute-plan/execute-phase/verify-work; 49 elision tests pass

---


## ✅ v14.1 Tool-Aware Agent Routing (Shipped: 2026-03-17)

**Delivered:** Made the v12.1 tool detection infrastructure actionable — 4 workflows and 3 agents now route behavior based on available tools, E2E tests prove the full detection→enrichment→behavior chain, and dead-weight infrastructure is pruned.

**Phases completed:** 3 phases (138–140), 4 plans, 9 tasks
**Timeline:** 1 day (2026-03-17)
**Tests:** 1,677 passing (0 failures); net reduction from pruning

**Key accomplishments:**
- Wired tool detection decisions into 4 workflows: file-discovery/search-mode guidance in execute-plan, capability_level hints in execute-phase executor spawns, fd/rg TOOL_GUIDANCE in map-codebase mapper spawns, and detect:gh-preflight replacing raw `gh auth status` in github-ci
- Added `<tool_routing>` Preferred Commands sections to executor (5 ops), debugger (4 investigation ops), and codebase-mapper (6 ops) — all 3 agents use fd/rg/jq/bat when available and fall back to MCP tools or node when not
- Added 13 E2E tests (TEST-01) confirming all Chain B decision rules produce tool-dependent outputs; 11 contract tests (TEST-02) dynamically verifying every Chain B rule has at least one workflow or agent consumer — zero orphaned decisions
- Pruned unused infrastructure: `handoff_tool_context` simplified to `{ capability_level }` only; 3 orphaned rules removed (`agent-capability-level`, `json-transform-mode`, `phase-dependencies`); DECISION_REGISTRY pruned 22→19 entries

**Stats:**
- 14 files modified across phases 138–140
- 4 plans, 9 tasks; 1 day from start to ship
- All 10/10 requirements delivered (ROUTE-01–03, AGENT-01–02, GH-01, TEST-01–02, PRUNE-01–02)

**Git range:** `feat(138-01)` → `feat(v14.1)` (Phase 140 Infrastructure Pruning, PR #28)

**What's next:** Ready for next milestone — `/bgsd-new-milestone`

**Archives:**
- `.planning/milestones/v14.1-ROADMAP.md`
- `.planning/milestones/v14.1-REQUIREMENTS.md`
- `.planning/milestones/v14.1-DOCS.md`

---


