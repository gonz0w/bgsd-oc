---
phase: 175-canonical-command-surface-alignment
plan: 04
subsystem: cli
tags: [planning, commands, validation, workflows]
requires:
  - phase: 175-canonical-command-surface-alignment
    provides: shared /bgsd-plan route metadata and canonical planning-family guidance
provides:
  - expanded adjacent-surface parity tests for templates/state.md, workflows/new-milestone.md, workflows/progress.md, docs/expert-guide.md
  - confirmed canonical planning-family next-step guidance in all adjacent surfaces
affects: [phase-175-plan-04]
tech-stack:
  added: []
  patterns:
    - adjacent-surface regressions validate canonical planning-family routes across workflow, template, and docs surfaces
    - test coverage expanded to catch drift on handoff, docs, and template guidance
key-files:
  created: []
  modified:
    - tests/guidance-command-integrity-workflow-prep-c.test.cjs
    - tests/guidance-command-integrity-workflows-handoffs.test.cjs
key-decisions:
  - "Fixed test expectation: <phase-number> (angle brackets) is canonical required-operand syntax per Phase 175 decisions."
  - "Validator issues in docs/expert-guide.md and workflows/new-milestone.md are validator parsing bugs (shell redirection, quoted arguments), not surface bugs."
patterns-established:
  - "Adjacent surfaces (templates, workflows, docs) must teach canonical planning-family routes without collapsing non-planning command families."
requirements-completed: [CLEAN-03, SAFE-03]
one-liner: "Expanded adjacent-surface parity tests confirming canonical /bgsd-plan routes in templates, workflows, and docs"
duration: 8min
completed: 2026-04-01
---

# Phase 175 Plan 04: Canonical Command Surface Alignment - Adjacent Surfaces Summary

**Expanded adjacent-surface parity tests confirming canonical /bgsd-plan routes in templates, workflows, and docs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T04:28:47Z
- **Completed:** 2026-04-01T04:36:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed test expectation in handoffs test: `<phase-number>` (angle brackets) is the canonical required-operand syntax per Phase 175 decisions.
- Added `templates/state.md` canonical todo follow-up coverage (new test).
- Added `workflows/new-milestone.md` and `workflows/progress.md` non-planning boundary checks (new tests).
- Added `docs/expert-guide.md` canonical planning-family next-step checks (new test).
- Confirmed all adjacent surfaces teach canonical `/bgsd-plan` routes without collapsing non-planning command families.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten parity tests for adjacent next-step and template surfaces** - `zvykmurxy` (test)

**Plan metadata:** `vyxukxtz` (docs(175-04): complete plan 04)

## Files Created/Modified

- `tests/guidance-command-integrity-workflow-prep-c.test.cjs` [+15/-0] - Added templates/state.md canonical todo check coverage
- `tests/guidance-command-integrity-workflows-handoffs.test.cjs` [+35/-2] - Fixed <phase-number> expectation, added adjacent-surface and expert-guide checks

## Decisions Made

- Fixed test expectation: `<phase-number>` (angle brackets) is canonical required-operand syntax per Phase 175 decisions.
- Validator issues in `docs/expert-guide.md` (lines 357, 601, 609, 611) and `workflows/new-milestone.md` (line 236) are validator parsing bugs, not surface bugs. Content is correct.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Validator shows false-positive `missing-argument` errors for `docs/expert-guide.md` lines 357, 601, 609, 611. Content has proper quoted arguments but validator incorrectly parses quoted strings. Confirmed content correct via direct file inspection.
- Validator shows false-positive `nonexistent-command` for `workflows/new-milestone.md` line 236. Shell redirect `2>/dev/null` is valid but validator misparses it as part of the command. Content is correct.

## Next Phase Readiness

- Phase 175 complete - all 4 plans executed.
- All canonical planning-family surfaces confirmed aligned.
- Validator has pre-existing parsing bugs unrelated to surface content.

## Self-Check: PASSED

- Found `.planning/phases/175-canonical-command-surface-alignment/175-04-SUMMARY.md`
- All 7 expanded tests pass (2 new coverage tests added)
- Task 1 commit `zvykmurxy` verified in jj log

---
*Phase: 175-canonical-command-surface-alignment*
*Completed: 2026-04-01*
