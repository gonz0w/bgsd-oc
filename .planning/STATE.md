# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v7.0 Agent Orchestration & Efficiency

## Current Position

Phase: 43 of 44 (TDD Execution Engine)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-27 — Completed 43-01 TDD validation CLI commands

## Performance Metrics

**Velocity:**
- Total plans completed: 94 (85 across v1.0-v6.0 + 9 in v7.0)
- Average duration: ~15 min/plan
- Total execution time: ~21 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 | 5 | 14 | 2 days |
| v1.1 | 4 | 10 | 1 day |
| v2.0 | 4 | 13 | 3 days |
| v3.0 | 4 | 10 | 1 day |
| v4.0 | 5 | 13 | 1 day |
| v5.0 | 7 | 14 | 2 days |
| v6.0 | 7 | 11 | 1 day |

## Accumulated Context

### Decisions

All v1.0-v6.0 decisions recorded in PROJECT.md Key Decisions table with outcomes.

- Phase 37-01: Pre-commit checks run all checks before reporting (agents see all failures in one pass)
- Phase 37-01: Exit code 2 for pre-commit blocks vs 1 for general errors
- Phase 37-02: Hybrid snapshot strategy — full snapshots for init-phase-op/state-read, field-level contracts for others
- Phase 37-02: Profiler uses process exit hook to capture timing after output() calls process.exit()
- Phase 38-01: Use acorn with module→script fallback, TypeScript stripping via regex not full parser
- Phase 38-02: Base complexity 1 per function + branching nodes, skip bin/dist in repo-map, cap signatures per file
- Phase 39-01: Model mapping scores 1-3 → sonnet, 4-5 → opus; dep graph non-blocking for classification
- Phase 39-01: task_routing added to compact mode whitelist so agents always get routing guidance
- Phase 40-01: Agent manifests use whitelist (fields + optional) not blacklist for safety; --agent flag via process.argv
- Phase 40-02: Duplicated scoreTaskFile (~15 lines) to avoid circular imports; AST signatures lazy-loaded only when requested
- Phase 41-01: Git --trailer for Agent-Type commit attribution; gsd-reviewer manifest scoped to conventions + dependencies
- Phase 41-02: Post-execution review is non-blocking (informational) until pipeline proven reliable; Review Findings between Deviations and Issues in SUMMARY
- Phase 43-01: TDD gate validation via execSync with 120s timeout; auto-test does NOT set exitCode; compact help entries to fit 1000KB budget

### Pending Todos

- Plan and execute Phase 43 (TDD Execution Engine)
- Plan and execute Phase 44 (Review Gate Hardening)
- Phase 42 (Integration & Validation) should run last to validate everything

### Blockers/Concerns

- Test command discovery: orchestrator needs to know `npm test` vs `pytest` (config.json test_command field exists)
- Distinguishing "correct failure" (expected in RED) from "broken test" (syntax error) — needs heuristic
- Cost of 3× test runs per TDD task for projects with slow test suites

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 43-01-PLAN.md (TDD validation CLI commands)
Resume file: None
