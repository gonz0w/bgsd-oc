# Version History

Complete history of every bGSD milestone, what was delivered, and the metrics.

---

## Summary

| Version | Name | Phases | Plans | Timeline | Tests | Bundle |
|---------|------|--------|-------|----------|-------|--------|
| v1.0 | Performance & Quality | 5 | 14 | 2 days | 153 | — |
| v1.1 | Context Reduction & Tech Debt | 4 | 10 | 1 day | — | — |
| v2.0 | Quality & Intelligence | 4 | 13 | 3 days | 297 | 373KB |
| v3.0 | Intent Engineering | 4 | 10 | 1 day | 348 | 447KB |
| v4.0 | Environment & Execution Intelligence | 5 | 13 | 1 day | 502 | 549KB |
| v5.0 | Codebase Intelligence | 7 | 14 | 2 days | 572 | 672KB |
| v6.0 | UX & Developer Experience | 7 | 11 | 1 day | 574 | 681KB |
| v7.0 | Agent Orchestration & Efficiency | 8 | 16 | 1 day | 669 | 1000KB |
| **Total** | | **44** | **101** | **~10 days** | | |

---

## v7.0 Agent Orchestration & Efficiency

**Shipped:** 2026-02-27 | **Phases:** 37-44 | **Plans:** 16

**Goal:** Make bGSD the definitive agent orchestrator for building large software — add missing agent roles, improve orchestration intelligence, optimize performance, and reduce context load.

**What was delivered:**

### Foundation & Safety (Phases 37-38)
- **Contract test suite** — Snapshot-based consumer contract tests for all `init` and `state` JSON output, catching field renames before they break agents
- **Enhanced git.js** — Structured log, diff summary, blame, branch info, pre-commit safety checks (dirty tree, rebase in progress, detached HEAD, shallow clones)
- **AST intelligence** — Acorn-based JS/TS parser for function signature extraction, export surface analysis, per-function complexity metrics
- **Repository map** — ~1k token compact codebase summary from AST signatures, replacing full file content in agent context
- **Multi-language fallback** — Regex-based signature extraction for non-JS languages via detector registry pattern

### Intelligence (Phases 39-40)
- **Task complexity classifier** — Scores tasks 1-5 based on file count, cross-module reach, and test requirements
- **Automatic agent routing** — Auto-selects agent type and model tier from task classification
- **Execution mode selector** — Auto-selects single/parallel/team mode from plan structure
- **Agent context manifests** — Each agent declares required context; system provides only declared fields (40-60% token reduction)
- **Compact serialization** — Dense format for plan state (70-80% reduction) and dependency graphs (45-60% reduction)
- **Task-scoped file injection** — Loads only task-relevant files using dependency graph and relevance scoring

### Quality (Phases 41, 44)
- **gsd-reviewer agent** — Code review against project conventions with fresh context
- **Two-stage review** — First checks spec compliance (plan must_haves), then code quality (conventions)
- **Severity classification** — BLOCKER (prevents completion), WARNING (advisory), INFO (informational)
- **Commit attribution** — Git trailers (`Agent-Type: gsd-executor`) for agent tracking
- **Stuck/loop detection** — Identifies repeated failure patterns (>2 retries) and triggers recovery

### Execution (Phase 43)
- **TDD execution engine** — RED-GREEN-REFACTOR state machine with orchestrator-enforced gates
- **TDD commit discipline** — Git trailers (`GSD-Phase: red|green|refactor`) for audit trail
- **Auto test-after-edit** — Runs test suite after each file modification to catch errors early
- **Anti-pattern detection** — Blocks pre-test code in TDD, YAGNI violations, over-mocking

### Validation (Phase 42)
- **Canary cycle** — Full planning-execution-verification on test project
- **Token measurement** — Validated context reduction against v6.0 baselines
- **All tests passing** — 669 tests with zero regressions

**Requirements:** 29 total, all mapped to phases. See `.planning/REQUIREMENTS.md`.

---

## v6.0 UX & Developer Experience

**Shipped:** 2026-02-27 | **Phases:** 30-36 | **Plans:** 11
**Commits:** 29 | **Files:** 102 | **Lines:** +6,275 / -1,982 | **Tests:** 574 | **Bundle:** 681KB

**What was delivered:**
- **Shared formatting engine** (`src/lib/format.js`) — formatTable, progressBar, banner, box, and ~2KB picocolors-pattern color utility with TTY-aware auto-disable
- **Smart output detection** — Human-readable branded output in TTY mode, JSON when piped, with `--raw` and `--pretty` overrides
- **Command renderer migration** — All user-facing commands (init, state, verify, codebase, velocity, intent) migrated to shared formatting
- **Workflow output tightening** — 455-line reduction across 27 files, help.md cut 44%
- **11 slash command wrappers** — Created in `commands/` directory with deploy.sh safe sync
- **AGENTS.md** — Rewritten as lean 59-line project index

---

## v5.0 Codebase Intelligence

**Shipped:** 2026-02-26 | **Phases:** 23-29 | **Plans:** 14
**Commits:** 79 | **Files:** 185 | **Lines:** +27,096 / -8,274 | **Tests:** 572 | **Bundle:** 672KB

**What was delivered:**
- **Codebase-intel.json** — Storage with git-hash watermarks, staleness detection, incremental analysis
- **Convention extraction** — Naming patterns, file organization, framework macros with confidence scoring
- **Dependency graph** — Import/require/use analysis across 6 languages (JS, TS, Python, Go, Elixir, Rust) with Tarjan's SCC cycle detection
- **Lifecycle awareness** — Execution order detection (seeds, migrations, config, boot) with extensible detector registry
- **Task-scoped context** — Heuristic relevance scoring (graph distance + plan scope + git recency) with 5K token budget
- **Non-blocking analysis** — Background re-analysis with lock file and --refresh flag

---

## v4.0 Environment & Execution Intelligence

**Shipped:** 2026-02-25 | **Phases:** 18-22 | **Plans:** 13
**Commits:** 55 | **Files:** 70 | **Lines:** +16,399 / -2,478 | **Tests:** 502 | **Bundle:** 549KB

**What was delivered:**
- **Environment detection** — 26 manifest patterns, package manager precedence, binary version checks, auto-inject into init commands
- **MCP server profiling** — 20-server token estimation database, 16-type relevance scoring, keep/disable/review recommendations with backup/restore
- **Structured requirements** — ASSERTIONS.md template, per-assertion verification (pass/fail/needs_human), traceability chains
- **Git worktree parallelism** — Full CRUD lifecycle, merge-tree conflict pre-check, lockfile auto-resolution, static file overlap detection
- **Session management** — session-summary CLI and complete-and-clear workflow

---

## v3.0 Intent Engineering

**Shipped:** 2026-02-25 | **Phases:** 14-17 | **Plans:** 10
**Commits:** 43 | **Files:** 47 | **Lines:** +10,142 / -400 | **Tests:** 348 | **Bundle:** 447KB

**What was delivered:**
- **INTENT.md** — Template and CRUD commands (create, read/show, update, validate)
- **Intent tracing** — Per-plan intent sections in YAML frontmatter, traceability matrix, coverage gap detection
- **Intent drift validation** — 4 signals (coverage gap, objective mismatch, feature creep, priority inversion) producing weighted 0-100 score
- **Workflow-wide injection** — All workflows (research, plan, execute, verify) receive intent context automatically
- **Guided questionnaire** — Intent capture in new-project and new-milestone workflows
- **Evolution tracking** — History section with auto-logging, milestone context, --reason flag

---

## v2.0 Quality & Intelligence

**Shipped:** 2026-02-24 | **Phases:** 10-13 | **Plans:** 13
**Commits:** 25 | **Files:** 61 | **Lines:** +14,172 / -2,553 | **Tests:** 297 | **Bundle:** 373KB

**What was delivered:**
- **State validation** — 5 drift-detection checks (plan count, position, stale activity, blocker staleness, plan claims) with auto-fix
- **Cross-session memory** — Dual-store pattern (STATE.md authority + memory.json cache), sacred data protection, bookmark auto-save, deterministic compaction
- **Quality gates** — Test gating, requirement checking, regression detection, A-F quality scoring, single-responsibility analysis with union-find concern grouping
- **Integration tests** — Workflow sequence tests, state round-trips, E2E simulation, snapshot tests across 297 tests
- **Bundle tracking** — Token budgets, compact-as-default, MCP server discovery

---

## v1.1 Context Reduction & Tech Debt

**Shipped:** 2026-02-22 | **Phases:** 6-9 | **Plans:** 10
**Commits:** 42 | **Files:** 78 | **Lines:** +12,642 / -4,576

**What was delivered:**
- **tokenx integration** — Accurate BPE-based token estimation (~96% accuracy)
- **--compact flag** — 46.7% average output reduction across 12 init commands
- **extract-sections CLI** — Dual-boundary parsing enabling 67% reference file reduction
- **Workflow compression** — 54.6% average (39,426 to 15,542 tokens) across top 8 workflows
- **Research templates** — Summary/detail tiers for context-aware loading
- **Tech debt resolution** — Fixed failing test, completed 44-command help coverage, created plan templates

---

## v1.0 Performance & Quality

**Shipped:** 2026-02-22 | **Phases:** 1-5 | **Plans:** 14
**Commits:** 63 | **Files:** 86 | **Lines:** +24,142 / -5,143

**What was delivered:**
- **Test suite** — 153+ tests covering state mutations, frontmatter parsing, config schema
- **Debug logging** — GSD_DEBUG-gated stderr logging for all 96 catch blocks
- **Command discoverability** — --help support for all 15 feature commands (43 entries)
- **Module split** — Monolith split into 15 organized src/ modules with esbuild bundler
- **Performance** — In-memory file cache and batch grep to eliminate redundant I/O
- **Security** — sanitizeShellArg() for shell injection prevention, cleanup handlers for temp files

---

## Development Timeline

```
2026-02-21  v1.0 started
2026-02-22  v1.0 shipped, v1.1 shipped (same day)
2026-02-24  v2.0 shipped
2026-02-25  v3.0 shipped, v4.0 shipped (same day)
2026-02-26  v5.0 shipped
2026-02-27  v6.0 shipped, v7.0 shipped (same day)
```

Total: 7 milestones, 44 phases, 101 plans, ~21 hours execution time across ~10 days.

---

*For the architectural decisions behind each milestone, see [Decisions](decisions.md). For the current project state, see `.planning/STATE.md`.*
