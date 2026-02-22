# Requirements: GSD Plugin for OpenCode

**Defined:** 2026-02-22
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v2.0 Requirements

Requirements for v2.0 Quality & Intelligence milestone. Each maps to roadmap phases.

### State Validation

- [x] **SVAL-01**: Plugin can detect when ROADMAP.md plan-completion claims don't match actual SUMMARY.md files on disk (drift detection)
- [x] **SVAL-02**: Plugin can detect when STATE.md Current Position points to a non-existent or already-completed plan (position validation)
- [x] **SVAL-03**: Plugin can detect when STATE.md Last activity is older than recent git commits to .planning/ (stale activity detection)
- [x] **SVAL-04**: Plugin can auto-correct unambiguous drift with --fix flag when exactly one correct resolution exists (auto-repair)
- [x] **SVAL-05**: Plugin can detect blockers and todos that have been open for N plans without resolution (blocker staleness)
- [x] **SVAL-06**: Plugin runs state validation automatically before execute-phase starts as pre-flight check (pre-execution validation)

### Atomic Plan Decomposition

- [ ] **PLAN-01**: Plugin can analyze a PLAN.md and flag when it contains multiple unrelated task groups (complexity analysis)
- [ ] **PLAN-02**: Plugin can score each plan 1-5 on single-responsibility adherence based on file groups, concern areas, and cross-dependencies (SR scoring)
- [ ] **PLAN-03**: Plugin can suggest how to split a poorly-scoring plan into 2-3 atomic plans based on task grouping (suggested splits)
- [ ] **PLAN-04**: Plugin can validate that tasks within a wave have no shared file modifications (wave-aware decomposition)
- [ ] **PLAN-05**: Plugin can detect dependency cycles, unreachable tasks, and unnecessary serialization within a plan (dependency-aware ordering)
- [ ] **PLAN-06**: Plugin can validate generated plans conform to their template's expected structure (template enforcement)

### Cross-Session Memory

- [ ] **MEMO-01**: Decisions made during execution persist durably across session boundaries and are never pruned (decision persistence)
- [ ] **MEMO-02**: Plugin records exact position (phase, plan, task, last file) on pause for seamless resume in next session (session bookmarks)
- [ ] **MEMO-03**: Init commands automatically include last decisions, current blockers, pending todos, and last position at session start (context injection)
- [ ] **MEMO-04**: Codebase mapping knowledge (architecture, conventions) is surfaced during execution sessions via section extraction (codebase knowledge)
- [ ] **MEMO-05**: Plugin captures what worked and what failed during execution, searchable across plans and phases (lessons accumulation)
- [ ] **MEMO-06**: Plugin performs deterministic compression of old memory entries to prevent STATE.md/memory files from growing unbounded (memory compaction)

### Comprehensive Verification

- [ ] **VRFY-01**: Plugin automatically runs the project's test suite after plan execution and fails verification if tests don't pass (test gating)
- [ ] **VRFY-02**: Plugin verifies each requirement in REQUIREMENTS.md was addressed by checking linked phases/plans and their summaries (requirement checking)
- [ ] **VRFY-03**: Plugin compares test results before and after plan execution, flagging regressions introduced by the plan (regression detection)
- [ ] **VRFY-04**: Plugin verifies each plan's must_haves were actually produced (file exists, function exists, test passes) (goal-backward verification)
- [ ] **VRFY-05**: Plugin produces a multi-dimensional quality score per plan execution (tests, requirements, regressions, must_haves, code quality) (quality scoring)
- [ ] **VRFY-06**: Plugin tracks quality scores over time per plan, phase, and milestone, surfacing trends in progress reports (trend tracking)

### Integration Testing

- [ ] **TEST-01**: Test suite includes multi-command sequence tests verifying expected state transitions (workflow sequence tests)
- [ ] **TEST-02**: Test suite includes full lifecycle state round-trip tests: create → write → patch → advance → reload → verify (state round-trip tests)
- [ ] **TEST-03**: Test suite includes config migration tests verifying old formats are correctly migrated (config migration tests)
- [ ] **TEST-04**: Test suite includes end-to-end workflow simulation: new-project → plan → execute → verify → complete (E2E simulation)
- [ ] **TEST-05**: Test suite includes snapshot/golden-file tests for all 12 init command outputs (snapshot testing)
- [ ] **TEST-06**: Plugin tracks which of 79 commands have tests and reports coverage gaps (coverage tracking)

### Dependency & Token Optimization

- [ ] **OPTM-01**: Evaluation template exists for assessing any new npm dependency before adding (bundle size, token impact, license, maintenance) (eval framework)
- [ ] **OPTM-02**: Build pipeline tracks gsd-tools.cjs bundle size over time with a defined budget ceiling (bundle size tracking)
- [ ] **OPTM-03**: Build pipeline verifies esbuild tree-shakes unused exports from bundled dependencies (tree-shaking verification)
- [ ] **OPTM-04**: Each workflow has an assigned token budget with actual vs budget tracking and overage flagging (token budgets)
- [ ] **OPTM-05**: --compact flag becomes the default for all init commands with migration period (compact default)

### MCP & Agent Awareness

- [ ] **MCPA-01**: Plugin can discover available MCP servers and surface their capabilities to workflows (MCP discovery)

## Future Requirements

Deferred to v3.0 or later. Tracked but not in current roadmap.

### Cross-Project Knowledge

- **XPRJ-01**: Patterns learned in one project can benefit other projects using GSD via global memory location

### Advanced Verification

- **ADVV-01**: Progressive --compact adoption with breaking change migration across milestone boundary

## Out of Scope

| Feature | Reason |
|---------|--------|
| RAG / vector search | Wrong architecture for a CLI tool; planning docs are <50 files |
| LLM-based summarization | Deterministic compression outperforms (JetBrains NeurIPS 2025) |
| Worker process / daemon | GSD is a CLI, not a server — no background processes |
| External database for memory | Markdown + JSON files in .planning/ are sufficient at GSD's scale |
| Async I/O rewrite | Synchronous I/O appropriate for CLI tool running <5s |
| npm package publishing | Plugin deployed via file copy, not a library |
| ESM output format | CJS avoids __dirname/require rewriting; esbuild handles ESM deps |
| Automated test generation | Out of scope for planning CLI; executing agent writes tests |
| LLM-as-judge for code quality | Non-deterministic, costly; use deterministic checks instead |
| Git hook enforcement | Too invasive; provide commands that workflows call |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SVAL-01 | Phase 10 | Complete |
| SVAL-02 | Phase 10 | Complete |
| SVAL-03 | Phase 10 | Complete |
| SVAL-04 | Phase 10 | Complete |
| SVAL-05 | Phase 10 | Complete |
| SVAL-06 | Phase 10 | Complete |
| PLAN-01 | Phase 12 | Pending |
| PLAN-02 | Phase 12 | Pending |
| PLAN-03 | Phase 12 | Pending |
| PLAN-04 | Phase 12 | Pending |
| PLAN-05 | Phase 12 | Pending |
| PLAN-06 | Phase 12 | Pending |
| MEMO-01 | Phase 11 | Pending |
| MEMO-02 | Phase 11 | Pending |
| MEMO-03 | Phase 11 | Pending |
| MEMO-04 | Phase 11 | Pending |
| MEMO-05 | Phase 11 | Pending |
| MEMO-06 | Phase 11 | Pending |
| VRFY-01 | Phase 12 | Pending |
| VRFY-02 | Phase 12 | Pending |
| VRFY-03 | Phase 12 | Pending |
| VRFY-04 | Phase 12 | Pending |
| VRFY-05 | Phase 12 | Pending |
| VRFY-06 | Phase 12 | Pending |
| TEST-01 | Phase 13 | Pending |
| TEST-02 | Phase 13 | Pending |
| TEST-03 | Phase 13 | Pending |
| TEST-04 | Phase 13 | Pending |
| TEST-05 | Phase 13 | Pending |
| TEST-06 | Phase 13 | Pending |
| OPTM-01 | Phase 13 | Pending |
| OPTM-02 | Phase 13 | Pending |
| OPTM-03 | Phase 13 | Pending |
| OPTM-04 | Phase 13 | Pending |
| OPTM-05 | Phase 13 | Pending |
| MCPA-01 | Phase 13 | Pending |

**Coverage:**
- v2.0 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation — all 36 requirements mapped to phases 10-13*
