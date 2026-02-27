# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- ✅ **v2.0 Quality & Intelligence** — Phases 10-13 (shipped 2026-02-24)
- ✅ **v3.0 Intent Engineering** — Phases 14-17 (shipped 2026-02-25)
- ✅ **v4.0 Environment & Execution Intelligence** — Phases 18-22 (shipped 2026-02-25)
- ✅ **v5.0 Codebase Intelligence** — Phases 23-29 (shipped 2026-02-26)
- ✅ **v6.0 UX & Developer Experience** — Phases 30-36 (shipped 2026-02-27)
- **v7.0 Agent Orchestration & Efficiency** — Phases 37-42

## Phases

<details>
<summary>✅ v1.0 Performance & Quality (Phases 1-5) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Foundation & Safety Nets (4/4 plans) — completed 2026-02-22
- [x] Phase 2: Error Handling & Hardening (2/2 plans) — completed 2026-02-22
- [x] Phase 3: Developer Experience & Discoverability (3/3 plans) — completed 2026-02-22
- [x] Phase 4: Build System & Module Split (3/3 plans) — completed 2026-02-22
- [x] Phase 5: Performance & Polish (2/2 plans) — completed 2026-02-22

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Context Reduction & Tech Debt (Phases 6-9) — SHIPPED 2026-02-22</summary>

- [x] Phase 6: Token Measurement & Output Infrastructure (3/3 plans) — completed 2026-02-22
- [x] Phase 7: Init Command Compaction (3/3 plans) — completed 2026-02-22
- [x] Phase 8: Workflow & Reference Compression (3/3 plans) — completed 2026-02-22
- [x] Phase 9: Tech Debt Cleanup (1/1 plans) — completed 2026-02-22

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Quality & Intelligence (Phases 10-13) — SHIPPED 2026-02-24</summary>

- [x] Phase 10: State Intelligence (2/2 plans) — completed 2026-02-22
- [x] Phase 11: Session Continuity (3/3 plans) — completed 2026-02-24
- [x] Phase 12: Quality Gates (4/4 plans) — completed 2026-02-24
- [x] Phase 13: Test Infrastructure & Polish (4/4 plans) — completed 2026-02-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Intent Engineering (Phases 14-17) — SHIPPED 2026-02-25</summary>

- [x] Phase 14: Intent Capture Foundation (3/3 plans) — completed 2026-02-25
- [x] Phase 15: Intent Tracing & Validation (2/2 plans) — completed 2026-02-25
- [x] Phase 16: Workflow Integration & Self-Application (3/3 plans) — completed 2026-02-25
- [x] Phase 17: Intent Enhancement (2/2 plans) — completed 2026-02-25

Full details: `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v4.0 Environment & Execution Intelligence (Phases 18-22) — SHIPPED 2026-02-25</summary>

- [x] Phase 18: Environment Awareness (3/3 plans) — completed 2026-02-25
- [x] Phase 19: MCP Server Profiling (3/3 plans) — completed 2026-02-25
- [x] Phase 20: Structured Requirements (3/3 plans) — completed 2026-02-25
- [x] Phase 21: Worktree Parallelism (3/3 plans) — completed 2026-02-25
- [x] Phase 22: Workflow Polish (1/1 plans) — completed 2026-02-25

Full details: `.planning/milestones/v4.0-ROADMAP.md`

</details>

<details>
<summary>✅ v5.0 Codebase Intelligence (Phases 23-29) — SHIPPED 2026-02-26</summary>

- [x] Phase 23: Infrastructure & Storage (2/2 plans) — completed 2026-02-26
- [x] Phase 24: Convention Extraction (2/2 plans) — completed 2026-02-26
- [x] Phase 25: Dependency Graph (2/2 plans) — completed 2026-02-26
- [x] Phase 26: Init Integration & Context Summary (2/2 plans) — completed 2026-02-26
- [x] Phase 27: Task-Scoped Context (2/2 plans) — completed 2026-02-26
- [x] Phase 28: Lifecycle Analysis (2/2 plans) — completed 2026-02-26
- [x] Phase 29: Workflow Integration (2/2 plans) — completed 2026-02-26

Full details: `.planning/milestones/v5.0-ROADMAP.md`

</details>

<details>
<summary>✅ v6.0 UX & Developer Experience (Phases 30-36) — SHIPPED 2026-02-27</summary>

- [x] Phase 30: Formatting Foundation & Smart Output (2/2 plans) — completed 2026-02-26
- [x] Phase 31: Quality Gates & Format Testing (2/2 plans) — completed 2026-02-27
- [x] Phase 32: Init & State Command Renderers (1/1 plans) — completed 2026-02-27
- [x] Phase 33: Verify & Codebase Command Renderers (1/1 plans) — completed 2026-02-27
- [x] Phase 34: Feature & Intent Command Renderers (1/1 plans) — completed 2026-02-27
- [x] Phase 35: Workflow Output Tightening (2/2 plans) — completed 2026-02-27
- [x] Phase 36: Integration & Polish (2/2 plans) — completed 2026-02-27

Full details: `.planning/milestones/v6.0-ROADMAP.md`

</details>

<details>
<summary>v7.0 Agent Orchestration & Efficiency (Phases 37-42)</summary>

### Phase 37: Foundation & Safety Net

**Goal:** Establish safety net (contract tests, enhanced git, pre-commit checks) that catches regressions before feature work touches output.

**Requirements:** SAFE-01, SAFE-02, GIT-01, GIT-02

**Success Criteria:**
1. Snapshot contract tests exist for every `init` and `state` JSON output field — renaming a field fails the test suite
2. Enhanced `git.js` exposes structured log, diff summary, blame, and branch info via CLI commands
3. Pre-commit checks detect dirty tree, active rebase, detached HEAD, and shallow clones before git-write operations
4. All existing 574 tests continue passing with zero regressions

**Plans:** 2/2 plans complete
Plans:
- [x] 37-01-PLAN.md — Git intelligence (enhanced git.js, CLI commands, pre-commit checks)
- [x] 37-02-PLAN.md — Safety net (contract tests, performance profiler)

### Phase 38: AST Intelligence & Repo Map

**Goal:** CLI produces compact code intelligence (signatures, repo map, complexity) that agents consume instead of full file contents.

**Requirements:** AST-01, AST-02, AST-03, AST-04, CTX-01

**Success Criteria:**
1. `codebase ast` extracts function signatures from JS/TS files via acorn parser
2. `codebase exports` produces export surface analysis for any JS/TS module
3. Per-function/module complexity metrics available for task classification
4. Non-JS files fall back to regex-based extraction via detector registry without errors
5. Repository map generates ~1k token compact codebase summary from AST signatures

**Plans:** 2/2 plans complete
Plans:
- [x] 38-01-PLAN.md — AST parser with acorn + regex fallback, codebase ast/exports CLI commands
- [x] 38-02-PLAN.md — Complexity scoring + repo-map generator

### Phase 39: Orchestration Intelligence

**Goal:** System auto-classifies task complexity and routes to right agent/model without manual selection.

**Requirements:** ORCH-01, ORCH-02, ORCH-03

**Success Criteria:**
1. Every plan task gets a 1-5 complexity score based on file count, cross-module reach, and test requirements
2. `init execute-phase` includes recommended agent type and model tier based on task classification
3. Orchestrator auto-selects single vs parallel vs team mode from plan structure
4. Routing decisions are visible in CLI output for transparency

**Plans:** 1/1 plans complete
Plans:
- [x] 39-01-PLAN.md — Task complexity classifier, agent router, execution mode selector, init execute-phase integration

### Phase 40: Context Efficiency

**Goal:** Agent context consumption drops 40-60% via compact serialization, context scoping, and task-scoped injection.

**Requirements:** CTX-02, CTX-03, CTX-04

**Success Criteria:**
1. Each agent type declares required context via manifest; system provides only declared context at spawn
2. Compact serialization format reduces plan state tokens by 70-80% and dependency graphs by 50-60%
3. Task-scoped file injection loads only task-relevant files using dependency graph and relevance scoring
4. Context reduction validated against quality baselines — no loss of agent decision quality

**Plans:** 2/2 plans complete ✅
Plans:
- [x] 40-01-PLAN.md — Agent context manifests + compact serializers for plan state and dep graphs
- [x] 40-02-PLAN.md — Task-scoped file injection using dep graph + AST signatures

### Phase 41: Agent Quality Gates

**Goal:** Every execution has a post-review quality gate — separate reviewer checks against conventions.

**Requirements:** QUAL-01, QUAL-02, QUAL-03

**Success Criteria:**
1. `gsd-reviewer` agent reviews code changes against project CONVENTIONS.md with fresh context
2. Commits are tagged with agent type in metadata for attribution and observability
3. Verification pipeline includes post-execution review step via gsd-reviewer
4. Review findings are surfaced in plan SUMMARY.md

### Phase 42: Integration & Validation

**Goal:** All v7.0 features work end-to-end with measured performance and no canary regressions.

**Requirements:** (validates all prior phases)

**Success Criteria:**
1. Full planning→execution→verification cycle on canary project succeeds
2. Measurable token savings (>=30%) vs v6.0 baselines
3. All tests pass (existing + new contract + new feature tests)
4. No output format regressions detected by contract tests
5. Bundle remains within 1000KB budget

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-5 | v1.0 | 14/14 | Complete | 2026-02-22 |
| 6-9 | v1.1 | 10/10 | Complete | 2026-02-22 |
| 10-13 | v2.0 | 13/13 | Complete | 2026-02-24 |
| 14-17 | v3.0 | 10/10 | Complete | 2026-02-25 |
| 18-22 | v4.0 | 13/13 | Complete | 2026-02-25 |
| 23-29 | v5.0 | 14/14 | Complete | 2026-02-26 |
| 30-36 | v6.0 | 11/11 | Complete | 2026-02-27 |
| 37-42 | v7.0 | 5/? | In progress | — |
