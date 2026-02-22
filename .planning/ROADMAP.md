# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- 🔵 **v2.0 Quality & Intelligence** — Phases 10-13 (active)

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

### 🔵 v2.0 Quality & Intelligence (Active)

**Milestone Goal:** Make the GSD plugin self-aware — validate its own state, decompose plans atomically, remember across sessions, verify deliverables comprehensively, and optimize its dependency/token footprint.

- [x] **Phase 10: State Intelligence** — Drift detection, position validation, and pre-flight state checks (completed 2026-02-22)
- [ ] **Phase 11: Session Continuity** — Cross-session memory with dual-store pattern (STATE.md + memory.json)
- [ ] **Phase 12: Quality Gates** — Comprehensive verification + atomic plan decomposition
- [ ] **Phase 13: Test Infrastructure & Polish** — Integration tests, dependency optimization, and MCP discovery

## Phase Details

### Phase 10: State Intelligence
**Goal**: Plugin detects when its declared state drifts from filesystem/git reality and warns before execution begins
**Depends on**: Nothing (v2.0 foundation)
**Requirements**: SVAL-01, SVAL-02, SVAL-03, SVAL-04, SVAL-05, SVAL-06
**Success Criteria** (what must be TRUE):
  1. Running `state validate` reports mismatches between ROADMAP.md plan-completion claims and actual SUMMARY.md files on disk
  2. Running `state validate` warns when STATE.md Current Position points to a non-existent or already-completed plan
  3. Running `state validate` detects when Last activity timestamp is stale relative to recent .planning/ git commits
  4. Running `state validate --fix` auto-corrects unambiguous drift (e.g., updating plan counts to match reality)
  5. Execute-phase pre-flight automatically runs state validation and surfaces warnings before any plan execution begins
**Plans**: 2/2 plans complete

Plans:
- [ ] 10-01-PLAN.md — Core `state validate` command with 5 validation checks + `--fix` auto-correction
- [ ] 10-02-PLAN.md — Pre-flight integration into execute-phase workflow + integration tests

### Phase 11: Session Continuity
**Goal**: Decisions, position, codebase knowledge, and lessons persist across session boundaries and are automatically surfaced at session start
**Depends on**: Phase 10 (validated state ensures only accurate data is persisted)
**Requirements**: MEMO-01, MEMO-02, MEMO-03, MEMO-04, MEMO-05, MEMO-06
**Success Criteria** (what must be TRUE):
  1. After `/clear` or new session, init commands include a memory digest with last decisions, current blockers, pending todos, and last position
  2. Plugin records exact position (phase, plan, task, last file) on pause, and a new session resumes from that bookmark
  3. Decisions made during execution persist durably in memory.json and are never pruned (only compacted)
  4. Codebase mapping knowledge (architecture, conventions) is surfaced during execution via section extraction from .planning/codebase/ files
  5. Old memory entries are deterministically compressed to prevent STATE.md and memory.json from growing unbounded
**Plans**: 3 plans

Plans:
- [ ] 11-01-PLAN.md — Memory store infrastructure with CRUD commands (decisions, bookmarks, lessons, todos)
- [ ] 11-02-PLAN.md — Init memory command with workflow-aware digest and codebase knowledge surfacing
- [ ] 11-03-PLAN.md — Bookmark auto-save in workflows and deterministic memory compaction

### Phase 12: Quality Gates
**Goal**: Plugin verifies that work was done correctly (test gating, requirement checking, regression detection) and that plans are structured correctly (single-responsibility, clean dependencies)
**Depends on**: Phase 10 (drift detection foundation), Phase 11 (baseline storage via memory persistence)
**Requirements**: VRFY-01, VRFY-02, VRFY-03, VRFY-04, VRFY-05, VRFY-06, PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. After plan execution, `verify deliverables` runs the project's test suite and fails verification if tests don't pass
  2. `verify requirements` checks each REQUIREMENTS.md item against linked phases/plans and their summaries, reporting unaddressed requirements
  3. `verify regression` compares test results before and after plan execution, flagging new failures introduced by the plan
  4. Running plan analysis on a multi-concern PLAN.md produces a 1-5 single-responsibility score and suggests how to split poorly-scoring plans
  5. `verify deliverables` produces a combined quality verdict across tests, requirements, regressions, and must_haves
**Plans**: TBD

### Phase 13: Test Infrastructure & Polish
**Goal**: Integration tests lock in the v2.0 contract with end-to-end workflow tests, and build pipeline gains bundle size tracking and token budgets
**Depends on**: Phase 12 (all features must exist before integration testing)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, OPTM-01, OPTM-02, OPTM-03, OPTM-04, OPTM-05, MCPA-01
**Success Criteria** (what must be TRUE):
  1. Integration test suite includes multi-command workflow sequence tests (init → plan → execute → verify) that pass on CI
  2. Integration test suite includes state round-trip tests verifying create → write → patch → advance → reload produces expected state
  3. Build pipeline reports gsd-tools.cjs bundle size on each build and flags when it exceeds the defined budget ceiling
  4. Each workflow has an assigned token budget with actual vs budget comparison, and overages are flagged
  5. Plugin can discover available MCP servers and surface their tool capabilities to workflows
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Safety Nets | v1.0 | 4/4 | Complete | 2026-02-22 |
| 2. Error Handling & Hardening | v1.0 | 2/2 | Complete | 2026-02-22 |
| 3. Developer Experience & Discoverability | v1.0 | 3/3 | Complete | 2026-02-22 |
| 4. Build System & Module Split | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. Performance & Polish | v1.0 | 2/2 | Complete | 2026-02-22 |
| 6. Token Measurement & Output Infrastructure | v1.1 | 3/3 | Complete | 2026-02-22 |
| 7. Init Command Compaction | v1.1 | 3/3 | Complete | 2026-02-22 |
| 8. Workflow & Reference Compression | v1.1 | 3/3 | Complete | 2026-02-22 |
| 9. Tech Debt Cleanup | v1.1 | 1/1 | Complete | 2026-02-22 |
| 10. State Intelligence | 2/2 | Complete    | 2026-02-22 | - |
| 11. Session Continuity | v2.0 | 0/3 | Planned | - |
| 12. Quality Gates | v2.0 | 0/? | Not started | - |
| 13. Test Infrastructure & Polish | v2.0 | 0/? | Not started | - |
