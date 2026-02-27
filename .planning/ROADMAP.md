# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- ✅ **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (shipped 2026-02-22)
- ✅ **v2.0 Quality & Intelligence** — Phases 10-13 (shipped 2026-02-24)
- ✅ **v3.0 Intent Engineering** — Phases 14-17 (shipped 2026-02-25)
- ✅ **v4.0 Environment & Execution Intelligence** — Phases 18-22 (shipped 2026-02-25)
- ✅ **v5.0 Codebase Intelligence** — Phases 23-29 (shipped 2026-02-26)
- 🔵 **v6.0 UX & Developer Experience** — Phases 30-36 (active)

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

### v6.0 UX & Developer Experience (Phases 30-36)

#### Phase 30: Formatting Foundation & Smart Output
**Goal**: Developers get a shared formatting engine and TTY-aware output mode — the infrastructure every command renderer depends on
**Depends on**: Nothing (foundation phase)
**Requirements**: FMT-01, FMT-02, FMT-03, FMT-04, FMT-05, OUT-01, OUT-02, OUT-03, OUT-04
**Plans**: 2/2 plans complete
Plans:
- [ ] 30-01-PLAN.md — Formatting primitives module (color, table, progress bar, banner, symbols)
- [ ] 30-02-PLAN.md — Smart output mode, --raw removal, brand rename to bGSD
**Success Criteria** (what must be TRUE):
  1. Running any GSD command in a terminal shows branded human-readable output; piping the same command produces JSON
  2. `--raw` forces JSON output in a TTY; `--pretty` forces human-readable output when piped
  3. `formatTable()` renders aligned columns with optional borders and truncation
  4. `progressBar()`, `banner()`, and `box()` produce consistent branded visuals matching ui-brand.md spec
  5. Status symbols (`✓`, `✗`, `▸`, etc.) are exported constants used by all output paths

#### Phase 31: Quality Gates & Format Testing
**Goal**: Test suite is green and new formatting utilities have coverage — no regressions before building on Phase 30
**Depends on**: Phase 30 (formatting foundation)
**Requirements**: QUAL-01, QUAL-02
**Plans**: 2/2 plans complete
Plans:
- [ ] 31-01-PLAN.md — Fix outputJSON rawValue bug + clean --raw from tests (243 failures → 0)
- [ ] 31-02-PLAN.md — Format utility test suite (formatTable, color, progressBar, banner, box)
**Success Criteria** (what must be TRUE):
  1. All tests pass with zero failures (the 2 broken v5.0 tests are fixed)
  2. New tests cover formatTable, color utility, progressBar, banner, and box — at least one test per utility
  3. Color auto-disable verified in non-TTY test environment

#### Phase 32: Init & State Command Renderers
**Goal**: The most-used commands (init progress, init execute-phase, init plan-phase, state show) produce clean branded output developers want to read
**Depends on**: Phase 30 (formatting foundation)
**Requirements**: CMD-01, CMD-02
**Plans**: 1 plan
Plans:
- [ ] 32-01-PLAN.md — Add formatters to init progress, state show, state update-progress (user-facing only)
**Success Criteria** (what must be TRUE):
  1. `init progress` in a TTY shows a branded banner, progress bar, phase checklist, and milestone summary — not raw JSON
  2. `state show` in a TTY renders a formatted state card with current position, velocity, and blockers
  3. `state update-progress` confirms the update with a formatted success message
  4. All init commands still produce valid JSON when piped (backward compatible)

#### Phase 33: Verify & Codebase Command Renderers
**Goal**: Verification and codebase analysis commands render summary tables with pass/fail indicators and formatted analysis output
**Depends on**: Phase 30 (formatting foundation)
**Requirements**: CMD-03, CMD-04
**Plans**: 1 plan
Plans:
- [ ] 33-01-PLAN.md — Add formatters to verify requirements/quality, codebase status/analyze (user-facing only)
**Success Criteria** (what must be TRUE):
  1. `verify requirements` shows a table of requirements with ✓/✗ pass/fail status and a summary line
  2. `verify quality` shows quality dimensions (tests, must_haves, requirements, regression) with letter grades and an overall score
  3. `codebase analyze` and `codebase status` show formatted summaries with staleness indicators
  4. `codebase conventions`, `codebase deps`, and `codebase context` produce readable formatted output with tables and section headers

#### Phase 34: Feature & Intent Command Renderers
**Goal**: All remaining user-facing commands — velocity, quick-summary, and intent commands — adopt shared formatting
**Depends on**: Phase 30 (formatting foundation)
**Requirements**: CMD-05, CMD-06
**Plans**: 1 plan
Plans:
- [ ] 34-01-PLAN.md — Add formatters to velocity, quick-summary, intent show/validate/drift (user-facing only)
**Success Criteria** (what must be TRUE):
  1. `velocity` shows plans/day rate, forecast, and per-milestone table in formatted output
  2. `quick-summary`, `context-budget`, `search-decisions`, and `trace-requirement` all produce branded output with tables and section headers
  3. Intent commands (`intent show`, `intent validate`, `intent drift`) use shared formatting utilities (banners, tables, status symbols)
  4. Every command in the CLI produces either formatted TTY output or JSON — no unformatted text output remains

#### Phase 35: Workflow Output Tightening
**Goal**: Agent-consumed workflow output is leaner — less noise, higher information density, consistent table patterns
**Depends on**: Phase 30 (formatting foundation)
**Requirements**: WKFL-04, WKFL-05, WKFL-06, WKFL-07
**Plans**: 2 plans
Plans:
- [ ] 35-01-PLAN.md — Update ui-brand.md to bGSD branding with concrete examples and tighter specs
- [ ] 35-02-PLAN.md — Tighten all workflow and reference files, measure token reduction
**Success Criteria** (what must be TRUE):
  1. Before/after token baselines measured for all workflow .md files with measurable reduction
  2. Status messages in workflows reduced — no "Starting...", "Processing...", "Done." noise patterns
  3. `ui-brand.md` updated with tighter patterns, concrete examples, and information-dense table specs
  4. All workflow table instructions use consistent column widths and alignment patterns

#### Phase 36: Integration & Polish
**Goal**: All slash commands are wired, deployment updated, documentation current, and bundle size verified
**Depends on**: Phase 34 (all command renderers done), Phase 35 (workflow output done)
**Requirements**: INTG-01, INTG-02, INTG-03, QUAL-03
**Plans**: 2 plans
**Success Criteria** (what must be TRUE):
  1. All 11 missing command wrapper files exist in the OpenCode command directory
  2. `deploy.sh` syncs command wrappers to the target installation during deployment
  3. AGENTS.md reflects current project state — no stale references to completed work, v6.0 status is current
  4. Bundle size after adding format.js is reasonable (no massive increase — validated by build)

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
| 14. Intent Capture Foundation | v3.0 | 3/3 | Complete | 2026-02-25 |
| 15. Intent Tracing & Validation | v3.0 | 2/2 | Complete | 2026-02-25 |
| 16. Workflow Integration & Self-Application | v3.0 | 3/3 | Complete | 2026-02-25 |
| 17. Intent Enhancement | v3.0 | 2/2 | Complete | 2026-02-25 |
| 18. Environment Awareness | v4.0 | 3/3 | Complete | 2026-02-25 |
| 19. MCP Server Profiling | v4.0 | 3/3 | Complete | 2026-02-25 |
| 20. Structured Requirements | v4.0 | 3/3 | Complete | 2026-02-25 |
| 21. Worktree Parallelism | v4.0 | 3/3 | Complete | 2026-02-25 |
| 22. Workflow Polish | v4.0 | 1/1 | Complete | 2026-02-25 |
| 23. Infrastructure & Storage | v5.0 | 2/2 | Complete | 2026-02-26 |
| 24. Convention Extraction | v5.0 | 2/2 | Complete | 2026-02-26 |
| 25. Dependency Graph | v5.0 | 2/2 | Complete | 2026-02-26 |
| 26. Init Integration & Context Summary | v5.0 | 2/2 | Complete | 2026-02-26 |
| 27. Task-Scoped Context | v5.0 | 2/2 | Complete | 2026-02-26 |
| 28. Lifecycle Analysis | v5.0 | 2/2 | Complete | 2026-02-26 |
| 29. Workflow Integration | v5.0 | 2/2 | Complete | 2026-02-26 |
| 30. Formatting Foundation & Smart Output | 2/2 | Complete    | 2026-02-26 | — |
| 31. Quality Gates & Format Testing | 2/2 | Complete   | 2026-02-27 | — |
| 32. Init & State Command Renderers | v6.0 | 0/1 | Not started | — |
| 33. Verify & Codebase Command Renderers | v6.0 | 0/1 | Not started | — |
| 34. Feature & Intent Command Renderers | v6.0 | 0/1 | Not started | — |
| 35. Workflow Output Tightening | v6.0 | 2/2 | Complete | 2026-02-27 |
| 36. Integration & Polish | v6.0 | 0/2 | Not started | — |
