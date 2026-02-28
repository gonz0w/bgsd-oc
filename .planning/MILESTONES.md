# Milestones

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

**What's next:** Ready for next milestone — `/gsd-new-milestone`

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

**What's next:** Ready for next milestone — `/gsd-new-milestone`

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

**What's next:** v6.0 UX & Developer Experience — polished CLI with formatted output

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

**What's next:** v5.0 Codebase Intelligence — convention extraction, dependency graphs, context injection

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

**What's next:** v4.0 Environment & Execution Intelligence — environment awareness, MCP profiling, worktree parallelism

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

**What's next:** v3.0 Intent Engineering — INTENT.md capture, drift validation, traceability

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

**What's next:** v2.0 Quality & Intelligence — state validation, memory, quality scoring, test infrastructure

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

**What's next:** v1.1 Context Reduction & Tech Debt — token estimation, output compression, workflow tightening

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---
