# Feature Landscape: Quality & Intelligence for GSD Plugin v2.0

**Domain:** State validation, atomic planning, cross-session memory, comprehensive verification, integration testing, and dependency optimization for AI-assisted development workflow CLI
**Researched:** 2026-02-22
**Overall confidence:** MEDIUM-HIGH

## Research Context

The GSD plugin is a zero-dependency Node.js CLI (79 commands, 15 src/ modules, 202 tests) that orchestrates AI-driven project planning workflows in OpenCode. v1.0 established the test suite, module split, and observability. v1.1 achieved 46.7% CLI output reduction and 54.6% workflow compression. v2.0 targets making the plugin smarter: validating its own state, decomposing plans atomically, remembering across sessions, verifying deliverables comprehensively, and optimizing its footprint.

**Key insight from research:** The AI coding tool ecosystem (2025-2026) is converging on three capabilities that separate production-grade tools from prototypes: (1) **drift detection** — ensuring declared state matches reality, borrowed from IaC/GitOps patterns; (2) **persistent memory** — claude-mem (30K+ stars) and OpenCode issue #8043 prove cross-session memory is the most requested missing capability; (3) **eval-driven development** — Anthropic's Jan 2026 evals engineering post establishes that capability evals + regression evals compound in value, making verification a first-class concern.

**What GSD already has that others don't:** GSD's `.planning/` filesystem-as-database means state is already persisted in human-readable markdown. The challenge isn't persistence (it's already there) — it's **validation** (does STATE.md match reality?), **memory** (surfacing the right state efficiently across sessions), and **verification** (proving work was done correctly).

---

## Category 1: State Validation

**Problem:** STATE.md can drift from git/filesystem reality. A plan may be marked "in progress" but its SUMMARY.md already exists. A phase may claim 2/3 plans complete but the directory shows 3 SUMMARY.md files. No one detects this.

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Phase completion drift detection** | Compare ROADMAP.md plan-completion claims against actual SUMMARY.md files on disk. Infrastructure drift detection is standard in IaC (Terraform `plan`, driftctl, Spacelift). GSD already has `roadmap analyze` that does partial disk comparison — extend it to flag discrepancies. | LOW | Extends existing `roadmap analyze` + `validate consistency` commands | Snyk's driftctl pattern: compare declared state against actual, report delta. GSD equivalent: compare ROADMAP.md against `.planning/phases/` filesystem. |
| **Current position validation** | STATE.md says "Phase 3, Plan 2" but the actual phase directory structure doesn't match. Detect when `Current Position` in STATE.md points to a non-existent or already-completed plan. | LOW | Extends existing `state load` + `find-phase` commands | Low risk — pure read-only analysis. |
| **Stale activity detection** | STATE.md `Last activity` timestamp is days old but git log shows recent commits to `.planning/`. Detect when state hasn't been updated after work was done. | LOW | Extends existing `session-diff` command (already reads git log) | Combine `session-diff` output with `state load` — if git has commits newer than `Last activity`, flag staleness. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **Auto-repair of simple drift** | When drift is detected and the fix is unambiguous (e.g., SUMMARY.md exists but plan not marked complete), offer `--fix` flag to auto-correct STATE.md/ROADMAP.md. Terraform does `apply` after `plan`; GSD can do `validate --fix` after `validate`. | MEDIUM | Builds on state mutation commands (state update, phase complete) | Only auto-fix when there's exactly one correct resolution. Ambiguous cases prompt user. |
| **Blocker/todo staleness checks** | Detect blockers that have been open for N plans without resolution, or todos that accumulated without being addressed. Surface "forgotten" items. | LOW | Extends existing `state load` blocker/todo parsing | No other AI planning CLI does this. Catches the "we recorded a blocker and forgot about it" anti-pattern. |
| **Pre-execution state validation** | Run state validation automatically before `execute-phase` starts. Catch drift before it compounds. Like CI/CD drift detection in deploy pipelines (Harness, Firefly). | MEDIUM | Integrates into `init execute-phase` command + execute-phase workflow | Requires wiring validation into workflow orchestration. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Continuous background monitoring** | GSD is a CLI, not a daemon. No background processes. | Run validation on-demand: at workflow start, via explicit command, or as pre-flight check. |
| **Git hook enforcement** | Too invasive. Users may have their own git hooks. GSD shouldn't force a commit-time validation. | Provide validation commands that workflows call. Let users wire them into hooks if they want. |

---

## Category 2: Atomic Plan Decomposition

**Problem:** Plans often bundle 3+ concerns (e.g., "add validation + write tests + update docs"). When a multi-concern plan fails partway, it's hard to resume, rollback, or verify. Cognizant's MAKER research (2026) shows that decomposing to atomic, single-responsibility tasks dramatically improves reliability.

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Plan complexity analysis** | Analyze a PLAN.md's task list and flag when it contains too many unrelated concerns. "Your plan has 3 independent task groups — consider splitting." The MAKER system (Cognizant 2026) distributes work across "focused microagents, each responsible for one atomic action." | MEDIUM | Extends existing `verify plan-structure` command, reads PLAN.md YAML frontmatter | Needs heuristics: count `<task>` blocks, check if `files_modified` lists overlap between tasks, check if tasks could run in separate waves. |
| **Single-responsibility scoring** | Score each plan on a 1-5 scale for single-responsibility adherence. Plans with score < 3 get a warning during `plan-phase`. Based on: (1) number of distinct file groups modified, (2) number of distinct concern areas, (3) whether tasks have cross-dependencies. | MEDIUM | Extends plan-phase workflow + verify plan-structure | Zylos research (Jan 2026): "Making each subtask atomic and verifiable" is the first principle of good task decomposition. |
| **Suggested plan splits** | When a plan scores poorly, suggest how to split it into 2-3 atomic plans. "Tasks 1-3 modify auth code, tasks 4-5 modify test infrastructure. Split into two plans." | HIGH | Builds on complexity analysis + plan-phase workflow | Requires understanding task grouping — may need LLM assistance for ambiguous cases. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **Wave-aware decomposition** | Plans already have `wave` in YAML frontmatter for parallel execution. Enforce that tasks within a wave are truly independent (no shared file modifications). Flag plans where wave parallelism is invalid. | MEDIUM | Extends existing `phase-plan-index` wave grouping | Unique to GSD — no other tool validates wave parallelism safety. |
| **Dependency-aware task ordering** | Analyze task `depends_on` within a plan. Detect cycles, unreachable tasks, and unnecessary serialization. Output optimal task ordering. | MEDIUM | Extends existing `validate-dependencies` command (currently phase-level) | Apply the same dependency analysis at task-within-plan level, not just phase-level. |
| **Plan template enforcement** | Plans generated from templates (execute.md, tdd.md, discovery.md) should conform to the template's expected structure. Validate that generated plans match template schema. | LOW | Extends existing plan templates in `templates/plans/` | Straightforward — compare generated plan structure against template. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automatic plan splitting without human approval** | Plans encode human decisions about scope. Auto-splitting could break intended groupings. | Flag and suggest splits. Let the planner agent or human decide. |
| **Enforcing maximum task count per plan** | Hard limits are arbitrary. A 10-task plan with related tasks is better than 5 2-task plans with artificial boundaries. | Score single-responsibility adherence rather than enforce task count limits. |

---

## Category 3: Cross-Session Memory

**Problem:** When a session ends (context clear, new conversation), accumulated knowledge is lost. The next session re-reads STATE.md but doesn't know about decisions, positions, or patterns discovered during execution. claude-mem (30K+ GitHub stars, 199 releases) proves this is the #1 pain point in AI coding tools. OpenCode issue #8043 (assigned to core maintainer) requests exactly this.

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Decision persistence** | Decisions made during execution (architectural choices, rejected alternatives, "we chose X because Y") must survive session boundaries. Currently `state add-decision` writes to STATE.md but decisions accumulate and get compacted away. | LOW | Extends existing `state add-decision` + `search-decisions` commands | Key pattern from claude-mem: decisions are high-signal, low-volume. Store them durably, never prune. The existing `search-decisions` command already searches across STATE.md + archives — just needs better surfacing at session start. |
| **Session position bookmarks** | When pausing work, record exact position (phase, plan, task, last file modified) so next session starts where work stopped. Currently `state record-session` exists but workflows don't consistently call it. | LOW | Extends existing `state record-session` + `pause-work` workflow | claude-mem captures session end automatically via hooks. GSD equivalent: ensure `pause-work` and workflow completion always record position. |
| **Context injection at session start** | When a new session begins (`init` commands), automatically include: last 3 decisions, current blockers, pending todos, and last session position. Don't require the agent to "remember" to check. | MEDIUM | Extends all 12 `init` commands, especially `init resume` | This is what claude-mem's ContextInjector does: inject relevant memories at session start. GSD's `init resume` already partially does this — expand it and make it the default path. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **Codebase knowledge persistence** | During `map-codebase`, knowledge about architecture, conventions, and file purposes is gathered. This knowledge should persist and be available to execution sessions. Currently codebase mapping docs exist but aren't surfaced during execution. | MEDIUM | Extends `init execute-phase` to reference `.planning/codebase/` docs | GSD already generates ARCHITECTURE.md, CONVENTIONS.md, etc. during map-codebase. The missing piece is surfacing the *right sections* during execution (via existing `extract-sections`). |
| **Lessons learned accumulation** | Capture patterns from plan execution: "this approach worked", "this caused a regression", "this took 3x longer than estimated". Build a searchable lessons database. | MEDIUM | Extends existing `search-lessons` command + SUMMARY.md `key-decisions` field | The `search-lessons` command already exists but is unwired. Wire it into plan-phase workflow to surface relevant lessons from past plans. |
| **Memory compaction** | As decisions and lessons accumulate, periodically compact old entries: merge related decisions, archive resolved blockers, summarize lesson patterns. Prevent STATE.md from growing unbounded. | MEDIUM | Builds on existing `milestone complete` archive pattern | claude-mem uses AI compression (~10x token efficiency). GSD should use deterministic compression: group decisions by topic, count occurrences, keep most recent + highest impact. No LLM needed. |
| **Cross-project knowledge** | Patterns learned in one project (e.g., "esbuild ESM→CJS conversion works automatically") could benefit other projects using GSD. Store project-agnostic lessons in a global memory location. | HIGH | Requires new storage location outside `.planning/` | OpenCode issue #8043 requests exactly two scopes: global memory + project memory. Global at `~/.config/opencode/gsd-memory/`, project at `.planning/memory/`. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **RAG / vector search over planning docs** | Requires embedding infrastructure, violates zero-dependency constraint. Planning docs are <50 files. | Use section-level extraction + full-text search (existing `search-decisions`, `search-lessons`). |
| **LLM-based memory summarization** | Requires LLM call during CLI execution, adds latency and cost. JetBrains NeurIPS 2025 showed deterministic compression outperforms. | Deterministic compression: grouping, counting, recency-based pruning. Zero-cost, reproducible. |
| **Worker process for memory** | claude-mem runs a worker daemon on port 37777. GSD is a CLI tool — no daemons, no ports, no background processes. | All memory operations are file-based, executed during CLI invocations. No server needed. |
| **External database for memory** | claude-mem uses SQLite + Chroma vector DB. Overkill for GSD's scale. | Markdown files in `.planning/memory/` (project) and `~/.config/opencode/gsd-memory/` (global). Searchable via existing grep-based `search-*` commands. |

---

## Category 4: Comprehensive Verification

**Problem:** Current verification (`verify` suite) checks structural things (plan has tasks, phase has summaries) but doesn't verify *what was built actually works*. Anthropic's Jan 2026 evals engineering post: "Evals make problems and behavioral changes visible before they affect users, and their value compounds over the lifecycle of an agent."

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Test execution gating** | After plan execution, automatically run the project's test suite and fail verification if tests don't pass. The existing `test-run` command parses ExUnit/Go/pytest output but isn't wired into verification. | LOW | Extends existing `test-run` command + verify workflow | Anthropic evals: "Does the code run and do the tests pass?" is the most fundamental coding agent eval. Wire `test-run` into `verify-work` workflow. |
| **Requirement delivery verification** | For each requirement in REQUIREMENTS.md, verify that it was addressed by checking linked phases/plans and their summaries. Detect "orphan requirements" that no phase addresses. | MEDIUM | Extends existing `trace-requirement` command | `trace-requirement` already traces from requirement to files on disk. Add a "coverage check": for each active requirement, is there a completed plan that claims to deliver it? |
| **Regression detection via test comparison** | Compare test results before and after plan execution. If a plan introduced test failures that didn't exist before, flag regression. | MEDIUM | Extends `test-run` + adds baseline comparison | Anthropic evals pattern: "regression evals should have a nearly 100% pass rate. A decline signals that something is broken." Store pre-execution test results, compare post-execution. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **Goal-backward verification** | Plans have `must_haves` blocks defining what the plan should deliver. Verify each `must_have` was actually produced (file exists, function exists, test passes). Go beyond "did tasks complete?" to "did we achieve the goal?" | MEDIUM | Extends existing `verify artifacts` + `verify key-links` commands | Already partially implemented. Extend to check not just file existence but content assertions (e.g., "function `sanitizeShellArg` exists in helpers.js"). |
| **Multi-dimensional quality scoring** | Score each plan execution on multiple dimensions: (1) tests pass, (2) requirements addressed, (3) no regressions, (4) must_haves delivered, (5) code quality signals. Produce a single quality score. | HIGH | Combines multiple verify commands into composite score | Anthropic evals: "For each task, scoring can be weighted (combined grader scores must hit a threshold)." Apply this pattern to plan verification. |
| **Verification trend tracking** | Track quality scores over time (per plan, per phase, per milestone). Detect if quality is trending up or down. Surface in `progress` reports. | MEDIUM | Extends `progress` command + SUMMARY.md metrics | Anthropic: "Once evals exist, you get baselines and regression tests for free: latency, token usage, cost per task." Apply to GSD's plan execution metrics. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **LLM-as-judge for code quality** | Adds LLM cost per verification, non-deterministic, requires calibration. | Use deterministic checks: test pass/fail, file existence, lint results. Reserve LLM judgment for subjective plan review (already in verify-work workflow). |
| **Automated test generation** | Out of scope for a planning CLI. The AI agent writes tests during execution, not the planning tool. | Provide test execution + comparison infrastructure. Let the executing agent write tests. |

---

## Category 5: Integration Testing

**Problem:** 202 tests cover individual commands, but no tests verify end-to-end workflows (init → plan → execute → verify). A command might work in isolation but fail when called in sequence by a workflow.

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Workflow sequence tests** | Test that multi-command sequences produce expected state transitions. E.g.: `init execute-phase 1` → `state advance-plan` → `state update-progress` → `phase complete 1` produces correct ROADMAP.md + STATE.md state. | MEDIUM | Extends existing test infrastructure (node:test, temp dir pattern) | Current tests are single-command. Add tests that chain 3-5 commands in sequence and verify final state. |
| **State round-trip tests** | Verify STATE.md survives a full lifecycle: create → write fields → patch → advance → record-session → reload → verify all fields. Cover field format edge cases. | LOW | Extends existing state mutation tests (8 round-trip tests) | 8 round-trip tests exist but don't cover full lifecycle. Add comprehensive chain. |
| **Config migration tests** | Verify that old config.json formats are correctly migrated by `config-migrate`. Test backward compatibility of config changes. | LOW | Extends existing `validate-config` tests | Straightforward — create old-format config, run migrate, verify new format. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **End-to-end workflow simulation** | Simulate a complete workflow: new-project → plan-phase → execute-phase → verify-work → complete-phase → complete-milestone. Verify all artifacts created, state transitions correct, archives produced. | HIGH | Requires mocking workflow behavior with CLI commands | This is what Anthropic calls "multi-turn evaluation." Complex because it needs to simulate agent decisions at branching points. |
| **Snapshot testing for init commands** | Capture known-good JSON output from all 12 init commands and compare against future runs. Detect unexpected output changes. | MEDIUM | New test pattern for existing init commands | Anthropic: "regression evals should have a nearly 100% pass rate." Snapshot tests are the cheapest form of regression detection. |
| **Test coverage tracking** | Measure which commands have tests and which don't. Currently 18/79 commands tested. Track coverage improvement over v2.0. | LOW | Requires list of all commands + test suite inspection | Not formal coverage tooling — just a manifest: command name → has_test (yes/no). |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Mocking LLM responses** | GSD doesn't call LLMs. It produces JSON for LLMs. Testing LLM behavior is the host tool's responsibility. | Test CLI command sequences and state transitions. The AI decision-making is out of scope. |
| **Browser/GUI testing** | GSD is a CLI. No UI to test. | Black-box CLI testing via execSync (existing pattern). |

---

## Category 6: Dependency & Token Optimization

**Problem:** v2.0 may introduce bundled dependencies for performance or quality gains. Need a framework for evaluating whether a dependency is worth adding, and continued token optimization.

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dep | Notes |
|---------|--------------|------------|--------------|-------|
| **Dependency evaluation framework** | Before adding any npm dependency, evaluate: bundle size impact, token count impact on output, maintenance burden, license compatibility. Document in a decision record. | LOW | Extends existing esbuild pipeline + `context-budget` command | Not code — a process. Create an evaluation template that each dependency must pass. |
| **Bundle size tracking** | Track `bin/gsd-tools.cjs` bundle size over time. Detect unexpected growth. Currently ~6,500 lines. Set a budget (e.g., 10K lines max for v2.0). | LOW | Extends existing build pipeline | Add `wc -l` or byte count to build output. Compare against baseline. |
| **Tree-shaking verification** | When adding bundled dependencies, verify esbuild tree-shakes unused exports. A dependency that adds 100KB but only 5KB is used should bundle at ~5KB. | LOW | Extends existing esbuild pipeline (metafile already generated) | esbuild already generates metafile. Parse it to verify individual dependency contribution to bundle. |

### Differentiators

| Feature | Value Proposition | Complexity | Existing Dep | Notes |
|---------|-------------------|------------|--------------|-------|
| **Token budget per workflow** | Assign each workflow a token budget (e.g., execute-phase: 5000 tokens max for init output). Track actual vs budget. Flag overages. | MEDIUM | Extends existing `context-budget` + workflow baseline system from v1.1 | v1.1 measured baselines for 43 workflows. Convert these baselines into budgets with ±10% tolerance. |
| **Progressive --compact adoption** | Make `--compact` the default for all init commands (was deferred from v1.1 as ACTX-04). Requires migration period: warn for 1 milestone, then flip default. | MEDIUM | Extends existing `--compact` infrastructure | Breaking change, but the right direction. v1.1 proved 46.7% reduction with zero quality loss. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Async I/O rewrite** | Synchronous I/O is appropriate for a CLI tool running <5s. Async adds complexity without measurable benefit. | Keep synchronous I/O. Focus optimization on reducing what's read, not how it's read. |
| **npm package publishing** | This is a plugin deployed via file copy. npm publishing adds maintenance burden without user value. | Keep `deploy.sh` file-copy model. |
| **ESM output format** | CJS avoids __dirname/require rewriting. esbuild handles ESM→CJS conversion for dependencies. | Keep CJS output. Bundle ESM dependencies via esbuild (proven pattern from tokenx). |

---

## Feature Dependencies

```
State Validation (Category 1)
  └──→ Pre-execution validation ──→ Integration into execute-phase workflow

Atomic Plan Decomposition (Category 2)
  └──→ Plan complexity analysis ──→ Suggested plan splits (needs analysis first)
  └──→ Wave-aware decomposition ──→ Dependency-aware task ordering

Cross-Session Memory (Category 3)
  ├──→ Decision persistence (independent, low effort)
  ├──→ Session position bookmarks (independent, low effort)
  └──→ Context injection at session start (needs persistence + bookmarks first)
       └──→ Memory compaction (needs accumulation before compaction matters)
            └──→ Cross-project knowledge (v3.0 — needs proven project-level pattern first)

Comprehensive Verification (Category 4)
  ├──→ Test execution gating (independent, wire existing test-run)
  ├──→ Requirement delivery verification (independent, extend trace-requirement)
  └──→ Regression detection (needs test gating first for baseline)
       └──→ Goal-backward verification (extends regression detection)
            └──→ Multi-dimensional quality scoring (capstone — combines all)

Integration Testing (Category 5)
  ├──→ State round-trip tests (independent)
  ├──→ Workflow sequence tests (independent)
  └──→ Snapshot testing for init commands (needs stable init output — do after optimizations)

Dependency & Token Optimization (Category 6)
  ├──→ Dependency evaluation framework (process, do first)
  ├──→ Bundle size tracking (independent)
  └──→ Token budget per workflow (builds on v1.1 baselines)
```

**Critical path:** State Validation and Cross-Session Memory are independent of each other. Verification depends on state being accurate (so validate first, then verify). Integration Tests can start immediately as they test existing behavior.

---

## MVP Recommendation

**Prioritize (maximum impact for minimum complexity):**

1. **State validation — drift detection** — LOW complexity, immediate trust improvement. Without it, every other feature builds on potentially-false state. Foundation.
2. **Test execution gating** — LOW complexity, wires existing unwired `test-run` command. Immediately catches regressions.
3. **Decision persistence + session bookmarks** — LOW complexity each, addresses the #1 user pain point (lost context). Two small features with outsized impact.
4. **Workflow sequence tests** — MEDIUM complexity, fills the biggest testing gap (zero end-to-end tests currently). Prevents integration-level regressions during v2.0 development.
5. **Plan complexity analysis** — MEDIUM complexity, prevents the "bundled plan" anti-pattern that causes the most execution failures.

**Defer to later in milestone:**
- Context injection at session start — MEDIUM complexity, do after persistence proves the pattern
- Regression detection — MEDIUM complexity, do after test gating establishes baselines
- Suggested plan splits — HIGH complexity, do after complexity analysis proves useful
- Goal-backward verification — MEDIUM complexity, extend after basic verification works
- Multi-dimensional quality scoring — HIGH complexity, capstone feature

**Defer to future milestone (v3.0):**
- Cross-project knowledge — HIGH complexity, needs proven project-level memory first
- End-to-end workflow simulation — HIGH complexity, diminishing returns vs workflow sequence tests
- Progressive --compact adoption — Breaking change, needs migration period across a milestone boundary

---

## Complexity and Effort Estimates

| Feature | Category | Complexity | Est. Effort | Files Modified | Risk |
|---------|----------|------------|-------------|----------------|------|
| Phase completion drift detection | State Validation | LOW | 4-6 hours | validation.js, router | Very Low |
| Current position validation | State Validation | LOW | 2-4 hours | validation.js | Very Low |
| Stale activity detection | State Validation | LOW | 2-4 hours | features.js | Very Low |
| Auto-repair of simple drift | State Validation | MEDIUM | 1-2 days | validation.js, state.js | Low |
| Pre-execution state validation | State Validation | MEDIUM | 1 day | init.js, execute-phase workflow | Low |
| Plan complexity analysis | Atomic Plans | MEDIUM | 1-2 days | verification.js, plan-phase workflow | Medium |
| Single-responsibility scoring | Atomic Plans | MEDIUM | 1-2 days | verification.js | Medium |
| Suggested plan splits | Atomic Plans | HIGH | 2-3 days | plan-phase workflow | Medium |
| Decision persistence improvements | Memory | LOW | 4-8 hours | state.js, init.js | Very Low |
| Session position bookmarks | Memory | LOW | 4-8 hours | state.js, pause-work workflow | Very Low |
| Context injection at session start | Memory | MEDIUM | 1-2 days | all 12 init commands | Low |
| Codebase knowledge persistence | Memory | MEDIUM | 1-2 days | init.js, execute-phase workflow | Low |
| Lessons learned accumulation | Memory | MEDIUM | 1-2 days | features.js, plan-phase workflow | Low |
| Memory compaction | Memory | MEDIUM | 2-3 days | state.js + new compaction module | Medium |
| Test execution gating | Verification | LOW | 4-8 hours | verify workflow, test-run integration | Very Low |
| Requirement delivery verification | Verification | MEDIUM | 1-2 days | features.js, requirements.js | Low |
| Regression detection | Verification | MEDIUM | 1-2 days | features.js + baseline storage | Medium |
| Goal-backward verification | Verification | MEDIUM | 1-2 days | verification.js | Low |
| Multi-dimensional quality scoring | Verification | HIGH | 2-3 days | verification.js + new scoring module | Medium |
| Workflow sequence tests | Integration Tests | MEDIUM | 2-3 days | test file | Very Low |
| State round-trip tests | Integration Tests | LOW | 4-8 hours | test file | Very Low |
| Snapshot testing for init commands | Integration Tests | MEDIUM | 1-2 days | test file + snapshot files | Low |
| Dependency evaluation framework | Optimization | LOW | 2-4 hours | Process doc, not code | Very Low |
| Bundle size tracking | Optimization | LOW | 2-4 hours | build script | Very Low |
| Token budget per workflow | Optimization | MEDIUM | 1-2 days | features.js, workflow baselines | Low |

---

## Sources

- Anthropic Engineering, "Demystifying Evals for AI Agents" (Jan 2026) — https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — **HIGH confidence** (first-party engineering, comprehensive eval methodology)
- claude-mem (thedotmack), "Persistent Memory Compression System" (30K+ stars, v10.3.1) — https://github.com/thedotmack/claude-mem — **HIGH confidence** (production system, 199 releases, proves cross-session memory demand)
- claude-mem-opencode (mc303), "OpenCode Integration for claude-mem" — https://github.com/mc303/claude-mem-opencode — **MEDIUM confidence** (community port, validates OpenCode memory need)
- OpenCode Issue #8043, "Feature Request: Model-Agnostic Memory Layer" — https://github.com/anomalyco/opencode/issues/8043 — **HIGH confidence** (assigned to core maintainer, validates demand)
- Cognizant AI Lab, "MAKER: Maximal Agentic Decomposition" (2026) — https://www.cognizant.com/us/en/ai-lab/blog/maker — **MEDIUM confidence** (industry research, validates atomic decomposition pattern)
- Zylos Research, "Long-Running AI Agents and Task Decomposition" (Jan 2026) — https://zylos.ai/research/2026-01-16-long-running-ai-agents — **MEDIUM confidence** (research survey)
- OneUptime, "How to Create Task Decomposition" (Jan 2026) — https://oneuptime.com/blog/post/2026-01-30-task-decomposition/view — **MEDIUM confidence** (practical guide with code examples)
- Snyk driftctl, "Detect, Track and Alert on Infrastructure Drift" — https://github.com/snyk/driftctl — **HIGH confidence** (established drift detection pattern)
- Spacelift, "Infrastructure Drift Detection" — https://spacelift.io/blog/drift-detection — **MEDIUM confidence** (IaC drift detection patterns applicable to state management)
- MGX Insights, "Cross-Session Agent Memory: Foundations, Implementations, Challenges" (Dec 2025) — https://mgx.dev/insights/cross-session-agent-memory-foundations-implementations-challenges-and-future-directions/ — **MEDIUM confidence** (comprehensive academic survey)
- Shichun-Liu, "Agent Memory Paper List" (2026) — https://github.com/Shichun-Liu/Agent-Memory-Paper-List — **MEDIUM confidence** (curated academic papers on agent memory)
- Anthropic, "Claude Code vs Cursor" comparison articles (multiple, 2026) — **MEDIUM confidence** (third-party comparisons validating CLAUDE.md memory pattern)
