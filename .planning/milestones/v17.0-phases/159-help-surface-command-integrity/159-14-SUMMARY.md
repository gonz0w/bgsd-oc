---
phase: 159-help-surface-command-integrity
plan: 14
subsystem: workflows
tags: [commands, workflows, roadmap, todos]
requires:
  - phase: 159-help-surface-command-integrity
    provides: canonical planning-family wrappers and alias routing from Phase 158
  - phase: 159-help-surface-command-integrity
    provides: exact shipped-file regression style from Plan 13
provides:
  - canonical add-phase workflow guidance under `/bgsd-plan roadmap add`
  - canonical add-todo workflow guidance under `/bgsd-plan todo ...`
  - focused regression coverage for the first workflow-prep blocker slice
affects: [workflows, command-guidance, validator]
tech-stack:
  added: []
  patterns: [direct file-backed workflow guidance regression coverage, canonical planning-family next-step wording]
key-files:
  created:
    - tests/guidance-command-integrity-workflow-prep-a.test.cjs
  modified:
    - workflows/add-phase.md
    - workflows/add-todo.md
key-decisions:
  - "Use `/bgsd-plan roadmap add` for add-phase examples so roadmap mutation guidance stays executable and canonical."
  - "Keep todo follow-ups under `/bgsd-plan todo add|check` so workflow-prep text matches the plan-scoped todo family."
patterns-established:
  - "Workflow-prep regressions should read the shipped workflow markdown files directly and validate them through `validateCommandIntegrity()`."
  - "When a workflow knows the exact command family, examples should include that canonical route instead of compatibility aliases."
requirements-completed: [CMD-06]
one-liner: "Canonical roadmap-add and todo workflow guidance now points users to runnable `/bgsd-plan` commands with direct regression proof"
duration: 4 min
completed: 2026-03-30
---

# Phase 159 Plan 14: Close the first remaining workflow-prep blocker slice by fixing the still-user-followable guidance in add-phase and add-todo. Summary

**Canonical roadmap-add and todo workflow guidance now points users to runnable `/bgsd-plan` commands with direct regression proof**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T04:19:10Z
- **Completed:** 2026-03-30T04:23:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote `workflows/add-phase.md` examples, usage text, and follow-up guidance to prefer `/bgsd-plan roadmap add` while keeping the known next step phase-aware.
- Rewrote `workflows/add-todo.md` surfaced commands to use `/bgsd-plan todo add` and `/bgsd-plan todo check` only.
- Added a focused regression that reads both shipped workflow files directly and proves the shared validator accepts this cleaned workflow-prep slice.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the add-phase and add-todo guidance slice** - `nwvpqntl` (docs)
2. **Task 2: Lock the workflow-prep slice with direct regression coverage** - `wttvkqmz` (test)

## Files Created/Modified

- `workflows/add-phase.md` - Canonicalizes roadmap-add examples, usage text, and follow-up guidance.
- `workflows/add-todo.md` - Canonicalizes todo add/check examples and follow-up guidance.
- `tests/guidance-command-integrity-workflow-prep-a.test.cjs` - Locks this workflow-prep slice with direct-file assertions plus validator proof.

## Decisions Made

- Standardized add-phase runnable guidance on `/bgsd-plan roadmap add` because this workflow already knows the canonical roadmap-mutation family.
- Standardized add-todo runnable guidance on `/bgsd-plan todo add|check` so users stay inside the canonical plan-scoped todo family.
- Kept the non-command roadmap reminder explicitly labeled as reference-only instead of presenting vague executable wording.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- The first remaining workflow-prep blocker slice is now canonicalized and guarded by a surgical regression.
- Follow-on workflow-prep plans can reuse this direct-file regression pattern for the remaining cited workflow surfaces.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-14-SUMMARY.md`
- FOUND: `nwvpqntl` task commit for workflow guidance cleanup
- FOUND: `wttvkqmz` task commit for workflow-prep regression coverage
