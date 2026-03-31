---
phase: 149-tdd-selection-contract-alignment
plan: 03
subsystem: testing
tags:
  - tdd
  - checker
  - roadmap
  - planning
  - contracts
requires:
  - phase: 149-tdd-selection-contract-alignment
    provides: deterministic planner-side TDD selection and canonical TDD contract wording from Plans 01-02
provides:
  - Explicit blocker, warning, and info TDD severity guidance for checker and orchestration prompts
  - Roadmap-author documentation aligned to the same required, recommended, and omitted hint meanings
  - Focused tests that lock omitted-hint reporting and Phase 149 scope boundaries in place
affects:
  - 150
  - plan checker
  - roadmap authoring
  - planning workflow
tech-stack:
  added: []
  patterns:
    - Omitted TDD hints still produce explicit informational reporting instead of silent checker behavior
    - Phase 149 TDD guidance stops at selection and severity alignment, leaving execute:tdd semantic enforcement to Phase 150
key-files:
  created:
    - .planning/phases/149-tdd-selection-contract-alignment/149-03-SUMMARY.md
  modified:
    - agents/bgsd-plan-checker.md
    - workflows/plan-phase.md
    - templates/roadmap.md
    - tests/verify.test.cjs
    - tests/workflow.test.cjs
    - tests/contracts.test.cjs
key-decisions:
  - Omitted roadmap TDD hints now map to explicit informational checker output instead of silently skipping TDD reporting
  - Checker, planner workflow, and roadmap guidance all use one blocker/warning/info severity ladder for required, recommended, and omitted hints
  - Phase 149 wording remains limited to selection and rationale severity, not Phase 150 execute:tdd semantics
patterns-established:
  - Checker guidance must always emit a visible TDD outcome, even when roadmap hints are omitted
  - Author-facing roadmap hints must describe the exact downstream checker severity each hint level triggers
requirements-completed: [TDD-03, TDD-04]
one-liner: "Explicit blocker, warning, and info TDD severity guidance across checker, planner workflow, roadmap docs, and contract tests"
duration: 2 min
completed: 2026-03-29
---

# Phase 149 Plan 03: Finish Phase 149 by making TDD checking severity deterministic and aligned. Summary

**Explicit blocker, warning, and info TDD severity guidance across checker, planner workflow, roadmap docs, and contract tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T01:46:37Z
- **Completed:** 2026-03-29T01:49:18Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Updated checker and planning workflow guidance so `required`, `recommended`, and omitted TDD hints now map to blocker, warning, and info outcomes with no silent branch.
- Aligned roadmap-author instructions to the same severity ladder and explicitly kept Phase 150 `execute:tdd` semantics out of scope.
- Added focused contract tests that fail if checker, workflow, or roadmap wording drifts from the locked Phase 149 severity contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Encode the strict TDD severity ladder in the checker and orchestration prompts** - `oxxwvxur` (docs)
2. **Task 2: Align roadmap-author guidance to the same checker meanings** - `zzolnyzq` (docs)
3. **Task 3: Add focused tests for severity ladder and omitted-hint reporting** - `lzwkvypz` (test)

## Files Created/Modified

- `agents/bgsd-plan-checker.md` - defines the explicit blocker/warning/info TDD severity ladder and removes silent omitted-hint handling.
- `workflows/plan-phase.md` - keeps planner orchestration wording aligned with the same severity ladder and Phase 149 boundary.
- `templates/roadmap.md` - tells roadmap authors exactly how required, recommended, and omitted hints flow into checker severities.
- `tests/verify.test.cjs` - locks the checker guidance contract, including omitted-hint informational reporting.
- `tests/workflow.test.cjs` - locks the workflow wording for the severity ladder and Phase 150 boundary.
- `tests/contracts.test.cjs` - locks roadmap guidance wording to the same checker meanings.

## Decisions Made

- Omitted TDD hints must still produce informational reporting so users can see the deterministic decision path.
- Roadmap, workflow, and checker wording now share one canonical severity ladder: `required` → blocker, `recommended` → warning, omitted → info.
- Phase 149 remains a contract-alignment phase; semantic `execute:tdd` hardening stays deferred to Phase 150.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 149 now has deterministic TDD selection, visible rationale, one canonical contract, and explicit checker severities for all roadmap hint states.
- Phase 150 can focus on real `execute:tdd` semantics and proof without reopening selection-contract ambiguity.

## Self-Check

PASSED

- Found `.planning/phases/149-tdd-selection-contract-alignment/149-03-SUMMARY.md`
- Found commit `oxxwvxur`
- Found commit `zzolnyzq`
- Found commit `lzwkvypz`

---
*Phase: 149-tdd-selection-contract-alignment*
*Completed: 2026-03-29*
