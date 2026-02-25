# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- ✅ **v2.0 Quality & Intelligence** — Phases 10-13 (shipped 2026-02-24)
- 🔵 **v3.0 Intent Engineering** — Phases 14-17 (active)

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

### Active: v3.0 Intent Engineering

**Milestone Goal:** Make intent the architectural backbone of GSD — every project captures *why* it exists and *what success looks like*, and every downstream workflow validates alignment against that intent.

- [x] **Phase 14: Intent Capture Foundation** - INTENT.md template and CRUD commands for creating, reading, and updating project intent (completed 2026-02-25)
- [x] **Phase 15: Intent Tracing & Validation** - Per-plan intent tracing, traceability matrix, coverage gap detection, and drift scoring (completed 2026-02-25)
- [ ] **Phase 16: Workflow Integration & Self-Application** - Inject intent context into all workflows and dog-food the system on GSD itself
- [ ] **Phase 17: Intent Enhancement** - Guided intent questionnaire for new projects and intent evolution tracking across milestones

## Phase Details

### Phase 14: Intent Capture Foundation
**Goal**: Users can create, read, and update a structured INTENT.md that captures why a project exists and what success looks like
**Depends on**: Nothing (v3.0 foundation)
**Requirements**: ICAP-01, ICAP-02, ICAP-03, ICAP-04
**Success Criteria** (what must be TRUE):
  1. Running `intent create` produces an INTENT.md with all structured sections (objective, desired outcomes, health metrics, target users, constraints, success criteria)
  2. Running `intent read` returns intent data as JSON; `intent show` renders a human-readable summary
  3. Running `intent update <section>` modifies only the targeted section, leaving all other sections untouched
  4. INTENT.md template exists in `templates/` and follows the same pattern as other GSD templates
**Plans:** 3/3 plans complete

Plans:
- [ ] 14-01-PLAN.md — Template reference doc + intent parser + create command
- [ ] 14-02-PLAN.md — Show/read + update commands with ID management
- [ ] 14-03-PLAN.md — Validate command + help entries + integration tests

### Phase 15: Intent Tracing & Validation
**Goal**: Plugin traces every plan's objective back to INTENT.md desired outcomes and detects when work drifts from stated intent
**Depends on**: Phase 14
**Requirements**: ITRC-01, ITRC-02, ITRC-03, IVAL-01, IVAL-02, IVAL-03, IVAL-04, IVAL-05
**Success Criteria** (what must be TRUE):
  1. Each PLAN.md includes an intent section linking its objective to specific desired outcome IDs from INTENT.md
  2. Running a traceability command shows which desired outcomes have plans addressing them and which have gaps
  3. Running intent validation detects objective mismatch (plan not tracing to any outcome), feature creep (tasks with no intent backing), and priority inversion (low-priority work before high-priority)
  4. Intent validation produces a numeric drift score (0-100) that summarizes alignment
  5. Intent validation runs as advisory pre-flight (warns, never blocks) before plan execution
**Plans:** 2/2 plans complete

Plans:
- [ ] 15-01-PLAN.md — Intent tracing: plan intent parser + traceability matrix + gap detection
- [ ] 15-02-PLAN.md — Intent validation: 4 drift signals + score + advisory pre-flight

### Phase 16: Workflow Integration & Self-Application
**Goal**: All GSD workflows see intent context automatically, and GSD's own development uses the intent system
**Depends on**: Phase 14, Phase 15
**Requirements**: WINT-01, WINT-02, WINT-03, WINT-04, SELF-01
**Success Criteria** (what must be TRUE):
  1. Init commands (progress, execute, plan) include intent summary in output so agents always see project intent
  2. Research workflows receive intent context (objective, target users, desired outcomes) to scope exploration
  3. Planner workflows reference intent when creating phase plans, deriving plan objectives from desired outcomes
  4. Verify-work workflow checks deliverables against desired outcomes and success criteria, not just requirements
  5. GSD's own `.planning/INTENT.md` exists and is actively used for its own milestone planning
**Plans**: TBD

### Phase 17: Intent Enhancement
**Goal**: New projects start with a structured intent conversation, and intent changes are tracked with reasoning across milestones
**Depends on**: Phase 14, Phase 16
**Requirements**: ICAP-05, ICAP-06
**Success Criteria** (what must be TRUE):
  1. New-project and new-milestone workflows ask guided questions to extract objective, desired outcomes, and success criteria before proceeding to requirements
  2. INTENT.md includes a history section that logs intent changes (additions, modifications, removals) with reasoning and milestone context
  3. Running `intent show` displays current intent plus a summary of how it has evolved
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
| 10. State Intelligence | v2.0 | 2/2 | Complete | 2026-02-22 |
| 11. Session Continuity | v2.0 | 3/3 | Complete | 2026-02-24 |
| 12. Quality Gates | v2.0 | 4/4 | Complete | 2026-02-24 |
| 13. Test Infrastructure & Polish | v2.0 | 4/4 | Complete | 2026-02-24 |
| 14. Intent Capture Foundation | 3/3 | Complete    | 2026-02-25 | - |
| 15. Intent Tracing & Validation | 2/2 | Complete   | 2026-02-25 | - |
| 16. Workflow Integration & Self-Application | v3.0 | 0/? | Not started | - |
| 17. Intent Enhancement | v3.0 | 0/? | Not started | - |
