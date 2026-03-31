---
phase: 158-canonical-command-families
plan: 06
subsystem: testing
tags: [commonjs, commands, aliases, workflow-routing, roadmap, todos, gaps]
requires:
  - phase: 158-canonical-command-families
    provides: canonical `/bgsd-plan` roadmap gaps and todo routing from Plan 03
provides:
  - Focused parity regressions for canonical and legacy roadmap gap and todo planning aliases
  - Contract coverage proving planning-family aliases stay on one normalized `/bgsd-plan` surface
affects:
  - phase-158-follow-on-command-family-slices
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Layer workflow-focused parity tests with contract-level alias normalization checks for canonical command families
key-files:
  created:
    []
  modified: []
    - tests/contracts.test.cjs
    - tests/plan-phase-workflow.test.cjs
    - tests/workflow.test.cjs
key-decisions:
  - Keep Phase 158 parity coverage constrained to routing and normalization behavior instead of reopening Phase 159 help auditing
  - Cover planning-family parity at both workflow and contract layers so alias drift breaks targeted tests before command docs diverge
patterns-established:
  - "Planning-family parity: assert canonical `/bgsd-plan` branches and legacy aliases in focused workflow tests"
  - "Alias normalization contract: require roadmap gap and todo shims to point back to `commands/bgsd-plan.md`"
requirements-completed: [CMD-02, CMD-03]
one-liner: "Targeted parity regressions now prove roadmap gap and plan-scoped todo aliases stay normalized to the canonical `/bgsd-plan` contract"
duration: 2 min
completed: 2026-03-29
---

# Phase 158 Plan 06: Lock the expanded `/bgsd-plan` family behind targeted parity regressions once roadmap, gap, and todo alias routing is in place. Summary

**Targeted parity regressions now prove roadmap gap and plan-scoped todo aliases stay normalized to the canonical `/bgsd-plan` contract**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T22:17:26Z
- **Completed:** 2026-03-29T22:19:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added workflow-level assertions in `tests/plan-phase-workflow.test.cjs` and `tests/workflow.test.cjs` that keep roadmap, gaps, and todo aliases tied to canonical `/bgsd-plan` branches.
- Added contract coverage in `tests/contracts.test.cjs` proving roadmap, gap, and todo shims reuse one normalized planning-family contract instead of drifting into alias-specific behavior.
- Kept the new regressions scoped to Phase 158 routing parity so help-surface auditing stays deferred to Phase 159.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workflow-level parity coverage for roadmap, gap, and todo flows** - `56c1969` (test)
2. **Task 2: Add contract-level regression checks for planning-family alias normalization** - `1e00687` (test)

**Plan metadata:** `TBD`

## Files Created/Modified

- `tests/contracts.test.cjs` [+26/-0]
- `tests/plan-phase-workflow.test.cjs` [+10/-0]
- `tests/workflow.test.cjs` [+19/-0]

## Decisions Made

- Kept the new assertions centered on routing targets and normalized arguments so this slice proves CMD-03 parity without expanding into a repo-wide command-reference audit.
- Split coverage between workflow-level and contract-level tests so alias wording drift and canonical contract drift fail in separate, easy-to-diagnose places.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context included cumulative branch changes outside this plan, so a plan-scoped post-execution review was not available.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Canonical and legacy roadmap, gap, and todo entrypoints now have direct workflow and contract parity proof, reducing regression risk for the remaining command-family slices.
- Phase 159 can update help and reference surfaces against a planning family with focused automated parity coverage already in place.

## Self-Check

PASSED

- Found expected files: `tests/plan-phase-workflow.test.cjs`, `tests/workflow.test.cjs`, `tests/contracts.test.cjs`, `.planning/phases/158-canonical-command-families/158-06-SUMMARY.md`
- Verified task commits exist: `ynwsktkx` (`test(158-06): add planning-family workflow parity coverage`), `uyyoonvl` (`test(158-06): add planning-family alias normalization contracts`)

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
