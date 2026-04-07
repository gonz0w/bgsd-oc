# Project Research Summary

**Project:** bGSD Plugin (Node.js CLI planning tool)
**Domain:** Workflow orchestration CLI + TDD reliability hardening
**Researched:** 2026-04-06
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
**Summary:** v19.4 continues v19.3's workflow acceleration infrastructure and hardens TDD reliability by implementing stubbed validators, wiring TDD audit sidecar continuity, and adding fresh-context chaining via `/bgsd-deliver-phase`. No new npm dependencies required — existing node:sqlite, node:child_process, and the PlanningCache stack are sufficient.

**Recommended stack:** node:sqlite (routing cache + TDD rationale storage), node:child_process (parallel stage execution), PlanningCache (SQLite-backed mtime cache), DECISION_REGISTRY (19 decision functions), execute:tdd (TDD RED/GREEN/REFACTOR validation), node:test (E2E fixture tests)

**Architecture:** Layered CLI monolith with SQLite planning cache, JJ-first execution gating, and TDD audit sidecar pipeline. cmdTdd stub in misc/recovery.js is the critical path item — all TDD proof flows through it.

**Recommended skills:** None — existing project-local skills (tdd-execution, verification-reference, planner-dependency-graph, cmux-skill) cover all v19.4 needs.

**Top pitfalls:**
1. Stubbed TDD validators stall executor flow — implement execute:tdd validate-red/green/refactor or fail closed (Phase 210)
2. TDD audit sidecar continuity breaks in handoff — wire durable proof source before parallel/fast-path handoff refreshes (Phase 211)
3. Bundle parity regressions (recurring) — run `npm run build` + smoke after every src/ change, not just at milestone end
4. JJ proof gates bypassed by acceleration — `workspace prove` remains mandatory even on accelerated/fast paths
5. Cache invalidation races in parallel TDD stages — mutex per cache key before parallel fan-out of TDD verification

**Suggested phases:**
1. **TDD Validator Shipping** — Implement cmdTdd validate-red/green/refactor stubs; unblocks all downstream TDD proof consumers
2. **Fresh-Context Chaining** — Implement /bgsd-deliver-phase --fresh-step-context; enables end-to-end delivery without giant context windows
3. **TDD Audit Continuity** — Wire TDD audit sidecar into handoff artifact inventory; ensure proof survives resume/refresh cycles
4. **TDD Gate Hardening** — Implement TDD plan structure verification and Phase B/C gate semantics; extends execute:tdd beyond exit-code checks
5. **Parallel TDD Safety** — Add mutex protection for TDD cache keys; enables safe parallel TDD verification stages

**Confidence:** HIGH | **Gaps:** TDD Phase B gate semantics need repo-local fixture validation before final claims; deliver-phase complexity well-understood from v19.3 parallelization work
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

v19.4 is a reliability and infrastructure hardening milestone that builds on v19.3's workflow acceleration work. The project is a Node.js CLI planning tool (bGSD) that orchestrates markdown-based project planning through a plugin executed by an AI coding agent. The core value proposition is deterministic, low-context, resumable workflow execution — enabling reliable phase delivery without giant context windows.

Research identified two interconnected workstreams: **workflow acceleration continuation** (fresh-context chaining via `/bgsd-deliver-phase`) and **TDD reliability hardening** (implementing stubbed validators, wiring audit sidecar continuity, adding human-legible proof rendering). Both share a critical path dependency: the `misc/recovery.js cmdTdd` command at lines 209-223 is a stub returning "not yet implemented" — this must become production code before any TDD proof flows can be verified.

The recommended approach is additive-only implementation within existing modules — no structural changes, no new dependencies, no architectural rewrites. The existing SQLite-backed PlanningCache, JJ-first execution gating, and TDD audit sidecar pipeline provide all necessary infrastructure. The build order is explicit: cmdTdd first, then orchestration/context/planning-cache/workflow in dependency order.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

v19.4 continues v19.3's approach: no new npm dependencies, extend existing infrastructure. Core additions are logical (TDD decision rationale in SQLite, extended phase:snapshot for TDD context) not structural.

**Core technologies:**
- `node:sqlite` (Node 22.5+ built-in) — hot-path routing cache + TDD rationale storage, extended with `routing_decisions` table columns for TDD eligibility and decision rationale
- `node:child_process` (built-in) — parallel workflow stage execution via spawn; extends v19.3 parallel stages to TDD handoff coordination
- `PlanningCache` (existing) — SQLite-backed mtime cache; extend with TDD decision metadata and batch freshness checks
- `DECISION_REGISTRY` (19 functions, existing) — add `resolveTddEligibility` decision function for TDD fitness evaluation per plan
- `execute:tdd` (existing) — extend RED/GREEN/REFACTOR validation beyond exit-code checks to TDD-aware semantics
- `node:test` (Node 22.5+ built-in) — E2E fixture tests for TDD flow using existing test infrastructure

**Supporting libs (existing, no changes):** fast-glob (3.3.3), valibot (1.2.0), fuse.js (7.1.0), acorn (bundled)

**Avoid:** `lru-cache` (CLI short-lived, Map sufficient), `worker_threads` (CPU-bound parallelism not bottleneck), new async I/O infrastructure (sync I/O appropriate for CLI tool)

### Expected Features

**Must have (table stakes — shipped v16.1/v19.3, v19.4 must not regress):**
- `phase:snapshot` — single CLI call replacing repeated phase discovery (v16.1)
- `verify:state complete-plan` — atomic batched state mutation (v16.1)
- Phase handoff artifacts (`XX-HANDOFF.json`) — durable chaining contract (v16.1)
- PlanningCache-backed plan reads — SQLite-first with git-hash+mtime invalidation (v16.1)
- Mutex-protected cache for parallel stages (v19.3)
- Kahn topological sort with cycle detection (v19.3)
- `discuss-phase --fast`, `verify-work --batch N` (v19.3)
- Deterministic TDD selection with rationale visibility (v16.1)

**Should have (v19.4 differentiators):**
- `/bgsd-deliver-phase --fresh-step-context` — end-to-end fresh-context chaining pipeline; each step runs in fresh context, reads from snapshot+handoff, writes compact output, chains to next step. Eliminates giant context window requirement while preserving resumability.
- TDD RED/GREEN/REFACTOR gate semantics — validate state transitions beyond exit codes: RED must show test FAILED for expected missing behavior; GREEN must show test PASSED + test file NOT modified; REFACTOR must show all tests still pass + no new behavior added
- TDD plan structure verification — structural validation rejecting malformed `type:tdd` plans at planning-time; ensures required fields, step sequence, and test/impl file pairs are present
- TDD fixture-backed E2E tests — automated end-to-end fixture proving RED→GREEN→REFACTOR commit trail in actual repo
- TDD rationale visibility — selected/skipped rationale surfaced in plan output and summary rendering

**Defer (v2+):** dynamic autonomous agent team coordination, dynamic agent spawning, runtime dependency graph auto-detection

### Architecture Approach

Layered CLI monolith with SQLite planning cache, JJ-first execution gating, and TDD audit sidecar pipeline. The `misc/recovery.js cmdTdd` is the new implementation target (lines 209-223 currently stubbed). All TDD proof flows through it — implement first so downstream integration can be tested incrementally. `phase-handoff.js` already wires TDD audits correctly via `discoverPhaseProofContext()` — no structural changes needed. `orchestration.js` needs TDD type awareness in `classifyTaskComplexity()`. `context.js` should carry TDD budget awareness (~40% for `type:tdd` plans).

**Major components:**
1. `orchestration.js` — task complexity scoring (1-5), TDD-aware execution mode, hot-path task routing
2. `phase-handoff.js` — TDD audit sidecar discovery, durable artifact lifecycle with `tdd_audits` context injection
3. `misc/recovery.js cmdTdd` — RED/GREEN/REFACTOR validation stubs → production implementation
4. `decision-rules.js` — TDD commit strategy (`per-phase` granularity) via `resolveCommitStrategy`
5. `cache.js` / `planning-cache.js` — continued I/O reduction; batch operations, hot-path statement caching

### Critical Pitfalls

1. **Stubbed TDD validators stall executor flow** — The executor workflow instructs agents to run `execute:tdd validate-red/green/refactor`, but the command returns "not yet implemented". This has been a recurring failure across 8+ lessons (cde03562, 95c5d10a, 583c4a0e, 727b3d1f, 9e58f2c3, 7c8d4a1b, a21f3b5c, 0b4e6d8f). Implement validators or fail closed (exit 1) — never return placeholder text.

2. **TDD audit sidecar continuity breaks in handoff refreshes** — `.tdd_audit.json` created during execute-phase does not survive resumable handoff refreshes. Add `tdd_audit` to handoff artifact inventory in `phase-handoff.js`, test full handoff cycle (execute → kill → resume → inspect summary), and never allow fast-path acceleration to skip sidecar persistence.

3. **Bundle parity regressions (recurring pattern)** — Source changes work but bundle crashes after `npm run build` due to esbuild issues (missing require targets, incompatible syntax, __require wrapper failures). Run `npm run build` AND `util:validate-commands --raw` after every meaningful `src/` change — not just at milestone end.

4. **JJ workspace proof gates bypassed by acceleration** — `workspace prove` remains mandatory even on accelerated/fast paths. Never remove or short-circuit the proof gate. Optimize the proof check itself if slow (cache with TTL, batch the three match checks) — not the bypassing of it.

5. **Cache invalidation races in parallel TDD stages** — Simultaneous invalidation of the same TDD cache key during parallel verification can return stale TDD proof data or corrupt shared cache state. Extend mutex protection to TDD-related cache keys: `tdd_audit:${plan_path}`, `tdd_proof:${plan_path}`, `tdd_summary:${plan_path}`.

6. **TDD summary rendering unclear for humans** — Generated SUMMARY.md renders TDD proof as raw tokens (backtick-wrapped file paths) instead of human-legible narrative. Define format: "Phase N: 3 RED tests (test/calc.test.js:12,18,24), 3 GREEN tests, 1 REFACTOR cleanup".

7. **Fast-mode routes bypass TDD validation gates** — `--fast` mode may route `type:tdd` plans without running `execute:tdd validate-*` gates. TDD proof gates are mandatory and must never be skipped regardless of acceleration flags.

### Recommended Skills

No external skills meet the bar for v19.4. The existing project-local skills (tdd-execution, verification-reference, planner-dependency-graph, cmux-skill) already cover all agent-facing guidance needed. External candidates (obra/superpowers, softaworks/agent-toolkit, joshuadavidthomas/opencode-handoff) were rejected due to non-bGSD execution model dependencies (Git worktrees, Python runtimes, Claude Code toolchains) or architectural mismatch with v19.4's automated compact JSON handoff chaining design.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: TDD Validator Shipping
**Rationale:** cmdTdd (misc/recovery.js lines 209-223) is a stub returning "not yet implemented" — this is the critical path blocking all downstream TDD proof consumers. 8+ lessons across v16–v19 document this recurring failure. Implement it first so downstream integration can be tested incrementally.
**Delivers:** Production `execute:tdd validate-red/green/refactor` with `spawnSync` execution, exit code checking, structured proof JSON, and `*-TDD-AUDIT.json` sidecar writes using `writeFileAtomic()`.
**Addresses:** Pitfall 1 (stubbed validators), TDD Phase B gate implementation, TDD Phase C E2E fixture dependency
**Avoids:** Executor workflows stalling mid-plan with manual proof capture

### Phase 2: Fresh-Context Chaining
**Rationale:** The `/bgsd-deliver-phase --fresh-step-context` pipeline enables end-to-end delivery without giant context windows. It depends on phase:snapshot + handoff + PlanningCache (all shipped v16.1) and extends v19.3 parallelization work.
**Delivers:** Fresh-context chaining pipeline — each step runs in fresh context, reads from compact handoff + snapshot, writes compact output, clears context, chains to next. Stop points at checkpoints and interactive decisions preserved. JJ workspace proof gate remains mandatory.
**Addresses:** FEATURES.md differentiator (deliver-phase), v19.3 acceleration continuation
**Avoids:** Giant context window requirement, session resumability failures

### Phase 3: TDD Audit Continuity
**Rationale:** TDD proof must survive execute → verify → summary transitions and resume/inspect flows. Currently `.tdd_audit.json` is not in the handoff artifact inventory and gets lost on handoff refresh.
**Delivers:** `tdd_audit` added to handoff artifact inventory in phase-handoff.js; human-legible TDD proof rendering in summary:generate; verify:state includes TDD audit sidecar checks
**Addresses:** Pitfall 2 (audit continuity), Pitfall 6 (summary rendering)
**Avoids:** TDD proof lost on resume, backtick-wrapped raw tokens in SUMMARY.md

### Phase 4: TDD Gate Hardening
**Rationale:** Extends execute:tdd beyond exit-code checks with TDD-aware semantics. Depends on Phase 1 (cmdTdd implemented) and Phase 3 (audit continuity wired).
**Delivers:** TDD plan structure verification at planning-time (malformed `type:tdd` plans rejected early); RED/GREEN/REFACTOR gate semantics (file-diff per phase, test-not-modified check, no-new-behavior enforcement); TDD rationale visibility in plan output
**Addresses:** TDD-RELIABILITY-PRD Phase B (gate semantics), Phase C (rationale visibility)
**Avoids:** Pitfall 7 (fast-mode bypass), malformed TDD plans reaching execute-time

### Phase 5: Parallel TDD Safety
**Rationale:** Enables safe parallel TDD verification stages with mutex-protected cache writes. Extends v19.3 mutex infrastructure to TDD-specific cache keys.
**Delivers:** Mutex per TDD cache key (`tdd_audit:${plan_path}`, etc.); bounded parallelism for TDD batch operations; serial cache-warm call before parallel fan-out
**Addresses:** Pitfall 5 (cache invalidation races), Pitfall 7 (parallel TDD corruption)
**Avoids:** TDD audit sidecar corruption, stale TDD proof data served to downstream consumers

### Phase Ordering Rationale

- **Phase 1 (cmdTdd) before Phase 4 (Gate Hardening):** Gate hardening tests against cmdTdd — must have real validators before testing gate semantics
- **Phase 1 before Phase 3 (Audit Continuity):** Audit continuity tests proof capture — requires real proof before testing durability
- **Phase 2 (Fresh-Context) parallel to Phase 1:** deliver-phase is independent of TDD work; both v19.4 targets but have no shared implementation dependency
- **Phase 3 before Phase 4:** Rationale visibility in plan output depends on audit continuity wiring
- **Phase 4 before Phase 5:** TDD gate hardening establishes the correct behavior; parallel safety then protects that behavior under concurrent load

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (TDD Gate Hardening):** TDD Phase B gate semantics (RED/GREEN/REFACTOR specific checks) need repo-local fixture validation before final claims. Execution gate behavior needs fixture proving before stating definitive claims.
- **Phase 5 (Parallel TDD Safety):** TDD cache key mutex granularity needs profiling with actual parallel workloads — may need adjustment based on real concurrency levels

Phases with standard patterns (skip research-phase):
- **Phase 1 (cmdTdd):** Well-understood pattern (spawnSync + structured output); existing phase-handoff.js patterns for sidecar writing
- **Phase 2 (Fresh-Context Chaining):** Extends v19.3 parallelization; architecture documented in v19.3 ARCHITECTURE.md
- **Phase 3 (TDD Audit Continuity):** phase-handoff.js patterns already shipped; extension is additive
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; existing infrastructure sufficient; Context7 + official docs verified |
| Features | HIGH | Feature inventory from shipped v19.3 + existing PRDs; MEDIUM for TDD Phase B/C specifics needing fixture validation |
| Architecture | HIGH | Patterns well-documented; cmdTdd stub location known; phase-handoff.js already wires TDD audits correctly |
| Pitfalls | HIGH | 8+ lessons document recurring TDD validator stub failures; v19.3 PITFALLS.md covers cache races, JJ proof gates, bundle parity |

**Overall confidence:** HIGH

### Gaps to Address

- **TDD Phase B gate semantics:** Execution gate semantics need repo-local fixture validation before final claims. Cannot state definitive behavior until fixture tests prove actual RED/GREEN/REFACTOR state transitions.
- **deliver-phase complexity:** Well-understood from v19.3 parallelization work, but the fresh-context chaining pipeline has not been exercised in production — should baseline performance before and after changes.

<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- **Context7** — `node:sqlite` built-in docs, `node:child_process` built-in docs, `node:test` built-in docs
- **Official docs** — JJ workspace docs (parallel execution context)
- **Local project** — `src/lib/planning-cache.js`, `src/lib/orchestration.js`, `src/lib/decisions.js`, `src/lib/phase-handoff.js`, `src/commands/execute/tdd.js`, `src/commands/misc/recovery.js` (cmdTdd stub at lines 209-223)
- **v19.3 research** — `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` (v19.4 builds on v19.3)
- **PRDs** — `.planning/research/completed/TDD-RELIABILITY-PRD.md` (Phase A/B/C requirements), `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md` (continuation scope)

### Secondary (MEDIUM confidence)
- **Lessons** — `.planning/memory/lessons.json` (8+ recurring TDD validator stub failures across v16–v19)
- **Skills registry** — agentskills.me (490 skills), agentskills.so, awesome-opencode, awesome-claude-skills — all inspected; no strong fits for v19.4

### Tertiary (LOW confidence)
- **TDD Phase B gate specifics:** Needs repo-local fixture validation; behavioral claims provisional until fixture tests run
- **Parallel TDD safety tuning:** Mutex granularity may need adjustment based on actual concurrency profiling

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
