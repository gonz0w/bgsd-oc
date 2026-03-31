---
phase: 159-help-surface-command-integrity
plan: 09
subsystem: docs
tags: [commands, docs, inspect, planning, settings]
requires:
  - phase: 158-canonical-command-families
    provides: canonical plan, inspect, and settings families plus compatibility shim behavior
  - phase: 159-help-surface-command-integrity
    provides: validator-backed command-integrity rules and earlier touched-surface cleanup
provides:
  - canonical-only command-reference guidance for planning, inspect, and settings routes
  - a single inspect-family diagnostics section instead of alias-heavy runnable entries
  - doc regression alignment between the shipped command reference and focused validator coverage
affects: [docs, command-reference, verification, phase-159]
tech-stack:
  added: []
  patterns: [canonical-only command reference, inspect-family consolidation, reference-only family index labeling]
key-files:
  created: [.planning/phases/159-help-surface-command-integrity/159-09-SUMMARY.md]
  modified: [docs/commands.md]
key-decisions:
  - "The shipped command reference should list canonical runnable routes only, even when compatibility shims still exist in-product."
  - "Read-only diagnostic aliases are documented through one `/bgsd-inspect` family table plus explicit canonical route callouts, not separate alias entries."
patterns-established:
  - "Keep family indexes explicitly reference-only while preserving concrete runnable examples beside them."
  - "Document inspect-owned diagnostics through canonical `/bgsd-inspect` examples instead of alias headings."
requirements-completed: [CMD-05, CMD-06]
one-liner: "docs/commands.md now teaches canonical /bgsd-plan, /bgsd-inspect, and /bgsd-settings routes without alias-heavy runnable guidance"
duration: 2 min
completed: 2026-03-30
---

# Phase 159 Plan 09: Command reference canonical-only cleanup summary

**docs/commands.md now teaches canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` routes without alias-heavy runnable guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T02:44:11Z
- **Completed:** 2026-03-30T02:46:45Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Reframed the planning-family overview so shorthand labels read as reference-only and concrete phase-filled examples stay runnable.
- Replaced standalone progress and diagnostics alias entries with one canonical `/bgsd-inspect` family section.
- Tightened the command reference intro and route callouts so the shipped doc stays aligned with focused command-integrity regression coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reframe the planning-family overview as reference-only, not runnable shorthand** - `msquwtuo` (docs)
2. **Task 2: Remove compatibility-alias sections that still read like surfaced guidance** - `utrlrpxo` (docs)
3. **Task 3: Perform a structural pass that leaves the shipped command reference validator-ready** - `tuxuvxmr` (docs)
4. **Verification follow-up: Restore explicit inspect-route callouts expected by the focused docs regression** - `zzvpnstz` (docs)

## Files Created/Modified

- `docs/commands.md` - Recasts the shipped command reference around canonical runnable plan, inspect, and settings routes.
- `.planning/phases/159-help-surface-command-integrity/159-09-SUMMARY.md` - Records execution details, decisions, and verification evidence for this plan.

## Decisions Made

- Kept the planning-family index in the doc, but labeled it as reference-only and left execution guidance to concrete examples with required arguments.
- Consolidated inspect-owned diagnostics into one canonical section while preserving explicit canonical route callouts that the focused docs regression already treats as required guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored explicit canonical inspect-route callouts after the focused docs regression failed**
- **Found during:** Final plan verification
- **Issue:** The new consolidated inspect-family table removed exact canonical-route lines that `tests/guidance-command-integrity-docs.test.cjs` still requires as shipped guidance proof.
- **Fix:** Added the explicit canonical progress, health, search, and trace callouts back above the inspect-family table.
- **Files modified:** `docs/commands.md`
- **Verification:** Plan verification commands plus `npm run test:file -- tests/guidance-command-integrity-docs.test.cjs`
- **Committed in:** `zzvpnstz` (verification follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The follow-up kept the canonical-only structure while restoring expected regression-visible guidance. No scope creep.

## Issues Encountered

- The focused docs regression expected exact `Canonical route:` callouts for inspect-owned guidance, so the first structural cleanup was too aggressive even though the content stayed canonical.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/commands.md` now reads as canonical-only on the remaining plan-09 blocker surfaces and is ready for the follow-on doc cleanup in Plans 10-11.
- Focused docs regression coverage passes against the shipped command reference after the canonical route callouts were restored.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-09-SUMMARY.md`
- FOUND: `msquwtuo` task 1 commit for planning-family reference labeling
- FOUND: `utrlrpxo` task 2 commit for inspect-family consolidation
- FOUND: `tuxuvxmr` task 3 commit for canonical-only structural cleanup
- FOUND: `zzvpnstz` verification follow-up commit for explicit inspect-route callouts
