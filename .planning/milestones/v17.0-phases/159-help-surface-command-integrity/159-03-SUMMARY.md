---
phase: 159-help-surface-command-integrity
plan: 03
subsystem: docs
tags: [commands, docs, guidance, validation, canonical]
requires:
  - phase: 158-canonical-command-families
    provides: canonical command families and compatibility alias routing
  - phase: 159-help-surface-command-integrity
    provides: shared surfaced-command validator from plan 02
provides:
  - canonical planning-family guidance across the highest-risk documentation pages
  - compact direct CLI examples that use bgsd-tools instead of legacy gsd-tools naming
  - focused regression coverage that locks the touched docs against guidance drift
affects: [docs, help, command-reference, troubleshooting]
tech-stack:
  added: []
  patterns: [canonical /bgsd-plan subcommands in docs, focused validator-backed doc regressions]
key-files:
  created: [tests/guidance-command-integrity-docs.test.cjs]
  modified: [docs/commands.md, docs/expert-guide.md, docs/planning-system.md, docs/troubleshooting.md]
key-decisions:
  - "Teach the planning family through /bgsd-plan sub-actions with filled phase examples on high-risk docs surfaces."
  - "Use focused shared-validator coverage for the touched doc surfaces instead of the repo-wide validator backlog during light verification."
patterns-established:
  - "Doc guidance examples should show canonical commands with required phase numbers when the flow shape is known."
  - "Focused doc regressions can feed validator snippets from touched files without waiting for unrelated backlog cleanup."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical planning-family documentation sweep with focused validator-backed regressions for the highest-risk help surfaces"
duration: 13min
completed: 2026-03-30
---

# Phase 159 Plan 03: Canonicalize the highest-risk documentation surfaces Summary

**Canonical planning-family documentation sweep with focused validator-backed regressions for the highest-risk help surfaces**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-30T01:32:54Z
- **Completed:** 2026-03-30T01:46:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Rewrote the command reference to teach canonical `/bgsd-plan` and `/bgsd-settings` routes with concrete runnable examples.
- Updated expert, planning-system, and troubleshooting guidance to stop surfacing legacy planning-prep aliases on the targeted high-risk pages.
- Added focused doc regressions that assert the new guidance and run the shared validator against the touched surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize Phase 159 documentation surfaces** - `3fc4fdc5` (docs)
2. **Task 2: Lock documentation integrity with focused regression coverage** - `eb9b1b59` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `docs/commands.md` - Reframes the command reference around canonical planning, roadmap, todo, settings, and direct CLI examples.
- `docs/expert-guide.md` - Replaces legacy planning-prep and roadmap examples with canonical `/bgsd-plan` routes.
- `docs/planning-system.md` - Updates phase-directory examples to point at canonical planning-family commands.
- `docs/troubleshooting.md` - Aligns planning fixes with canonical planning-family and direct CLI find-phase guidance.
- `tests/guidance-command-integrity-docs.test.cjs` - Locks the touched docs with focused string assertions plus shared-validator checks.

## Decisions Made

- Used `/bgsd-plan` sub-actions as the primary teaching surface in the touched docs so planning, discussion, research, roadmap, and todo guidance all share one canonical family.
- Kept validation focused on the touched docs because the repo-wide validator still reports unrelated Phase 159 backlog outside this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repo-wide validator is still blocked by unrelated Phase 159 backlog**
- **Found during:** Task 2 (Lock documentation integrity with focused regression coverage)
- **Issue:** `util:validate-commands --raw` still fails on untouched help surfaces scheduled for later Phase 159 plans, so it cannot act as a passing gate for this plan in isolation.
- **Fix:** Added focused shared-validator coverage inside `tests/guidance-command-integrity-docs.test.cjs` so the touched docs are still validated with the canonical checker under the requested light verification route.
- **Files modified:** `tests/guidance-command-integrity-docs.test.cjs`
- **Verification:** `npm run test:file -- tests/guidance-command-integrity-docs.test.cjs`
- **Committed in:** `eb9b1b59`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Kept the plan scoped to the targeted docs while still proving the touched guidance stays canonical and executable.

## Issues Encountered

- The shared validator treats the remaining untouched Phase 159 help backlog as expected failures, so focused validator snippets were required for this plan's isolated proof.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The highest-risk docs now teach canonical planning-family routes and can serve as the reference baseline for the remaining workflow, agent, skill, and template sweeps.
- Focused regression coverage is in place for these doc surfaces, so later plans can expand coverage without reopening this guidance slice.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-03-SUMMARY.md`
- FOUND: `3fc4fdc5` task commit for the documentation sweep
- FOUND: `eb9b1b59` task commit for the focused regression coverage
