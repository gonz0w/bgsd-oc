---
phase: 181-workspace-root-truth-safe-fallback
plan: 02
subsystem: infra
tags: [jj, workspace, execution, workflow, proof-gate]
requires:
  - phase: 181-workspace-root-truth-safe-fallback
    provides: workspace prove runtime helper and generic fallback evidence
provides:
  - proof-first workspace execution workflow contract
  - workspace-rooted executor output containment guidance
  - regression coverage for proof gate and workspace-local outputs
affects: [execute-phase, execute-plan, workspace execution]
tech-stack:
  added: []
  patterns: [proof-first workspace preflight, workspace-rooted plan-local outputs]
key-files:
  created: []
  modified:
    - workflows/execute-phase.md
    - workflows/execute-plan.md
    - tests/integration.test.cjs
    - tests/workflow.test.cjs
key-decisions:
  - "Workspace-parallel execution only continues after `workspace prove {plan_id}` succeeds before any plan work begins."
  - "Workspace proof and availability failures share one generic downgrade path to Mode B sequential execution before repo-relative work starts."
  - "While workspace mode is active, repo-relative reads, writes, SUMMARY output, and proof sidecars stay rooted in the assigned workspace checkout."
patterns-established:
  - "Proof-first workspace execution: create workspace, prove root pinning, then allow plan work."
  - "Workspace-local outputs: plan-local artifacts stay in the assigned workspace until later reconcile/finalize phases own shared state."
requirements-completed: [JJ-01, JJ-03]
one-liner: "Proof-first workspace execution gate with generic sequential fallback and workspace-rooted plan-local outputs"
duration: 3 min
completed: 2026-04-01
---

# Phase 181 Plan 02: Workspace Root Truth & Safe Fallback Summary

**Proof-first workspace execution gate with generic sequential fallback and workspace-rooted plan-local outputs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T20:26:05Z
- **Completed:** 2026-04-01T20:29:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Required Mode A workspace execution to run `workspace prove {plan_id}` immediately after workspace creation and before executor plan work begins.
- Locked one generic fallback contract that downgrades to Mode B sequential execution before summaries, plan-local outputs, or other repo-relative work start when proof or workspace availability fails.
- Made executor guidance explicit that workspace-mode repo-relative reads, writes, `SUMMARY.md`, and proof sidecars remain rooted inside the assigned workspace checkout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make workspace-mode execution prove root pinning before any plan work begins** - `ltryoqnq` (`fix(181-02): require workspace proof before parallel execution`)
2. **Task 2: Keep workspace-mode repo-relative outputs rooted inside the assigned workspace** - `nynntrzk` (`fix(181-02): keep workspace plan outputs rooted`)

**Plan metadata:** `PENDING`

## Files Created/Modified
- `workflows/execute-phase.md` - adds the proof-first Mode A preflight contract and generic fallback wording.
- `workflows/execute-plan.md` - states that workspace-mode repo-relative work and plan-local outputs stay rooted in the assigned workspace.
- `tests/integration.test.cjs` - locks the shipped workflow contract for proof-first fallback and workspace-rooted outputs.
- `tests/workflow.test.cjs` - locks the execute-phase and execute-plan wording as workflow-contract regressions.

## Decisions Made
- Required `workspace prove {plan_id}` before any workspace-parallel plan work so workspace mode becomes an enforced preflight gate instead of advisory guidance.
- Kept one generic operator-facing fallback reason that still reports intended workspace, observed cwd, and observed `jj workspace root` evidence.
- Scoped containment guidance to plan-local workspace artifacts only and avoided reopening shared `.planning/` finalize ownership ahead of Phase 183.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `node --test tests/integration.test.cjs tests/workflow.test.cjs` still has 5 pre-existing unrelated failures in `tests/integration.test.cjs` (Phase 168 canonical model resolution, frontmatter round-trip, and TDD proof continuity coverage). Touched-surface proof passed: both new Phase 181 integration assertions passed, and `node --test tests/workflow.test.cjs` passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 181 now enforces proof before workspace-parallel execution begins and makes workspace-local artifact containment explicit.
- Ready for later phases to build on this contract for verification routing and plan-local workspace ownership/finalize boundaries.

## Self-Check: PASSED

- Found summary file: `.planning/phases/181-workspace-root-truth-safe-fallback/181-02-SUMMARY.md`
- Found task commits: `ltryoqnq`, `nynntrzk`

---
*Phase: 181-workspace-root-truth-safe-fallback*
*Completed: 2026-04-01*
