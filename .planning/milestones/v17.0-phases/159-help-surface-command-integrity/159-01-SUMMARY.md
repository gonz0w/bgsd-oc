---
phase: 159-help-surface-command-integrity
plan: 01
subsystem: docs
tags: [help, commands, guidance, markdown, commonjs]
requires:
  - phase: 158-canonical-command-families
    provides: canonical planning-family command surfaces and /bgsd-review baseline
provides:
  - compact top-level help with canonical core and advanced paths
  - focused regression coverage for top-level help wording
affects: [workflows/help.md, command-guidance-contracts, CMD-04]
tech-stack:
  added: []
  patterns: [core-path-first help, canonical-only runnable examples]
key-files:
  created: [tests/guidance-help-surface.test.cjs]
  modified: [workflows/help.md]
key-decisions:
  - keep the main help screen compact by splitting core path from advanced families
  - use canonical-only runnable examples with filled arguments where the flow shape is known
patterns-established:
  - "Top-level help leads with a core path, then routes deeper needs through advanced families."
  - "Help-surface regressions are locked with deterministic string-contract tests."
requirements-completed: [CMD-04]
one-liner: "Compact canonical help with a core path, advanced family map, and locked /bgsd-review guidance"
duration: 2min
completed: 2026-03-30
---

# Phase 159 Plan 01: Refresh the top-level help surface so it becomes a small, trustworthy canonical front door with executable examples and a clear core-versus-advanced split. Summary

**Compact canonical help with a core path, advanced family map, and locked /bgsd-review guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29 19:17:33 -0600
- **Completed:** 2026-03-29 19:19:27 -0600
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced the old flat top-level command menu with a smaller core path that highlights `/bgsd-new-project`, `/bgsd-plan phase`, `/bgsd-execute-phase`, `/bgsd-review`, and `/bgsd-progress`.
- Recast deeper guidance as advanced command families with canonical-only runnable examples that include concrete phase numbers, flags, and arguments where the flow shape is known.
- Added a focused help-surface regression test that fails if the compact split, `/bgsd-review` primary placement, or canonical runnable examples regress.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the main help surface around a compact canonical command path** - `b49b861` (docs)
2. **Task 2: Add focused regression coverage for the help-surface contract** - `85a8ee8` (test)

## Files Created/Modified

- `tests/guidance-help-surface.test.cjs` [+35/-0]
- `workflows/help.md` [+50/-91]

## Decisions Made

- Kept the top-level help intentionally compact and moved detail into advanced families so the first screen acts as a trustworthy canonical front door.
- Removed legacy and deprecated command guidance from the main help contract so surfaced examples stay canonical-only and executable as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Requirement completion helper missed CMD-04**
- **Found during:** Plan finalization
- **Issue:** `plan:requirements mark-complete CMD-04` returned `not_found` even though `CMD-04` exists in `.planning/REQUIREMENTS.md`.
- **Fix:** Updated `REQUIREMENTS.md` directly so requirement state matches the completed plan.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Confirmed `CMD-04` is checked in the requirements list and marked `Complete` in the traceability matrix.
- **Committed in:** plan metadata commit

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No product-scope change. The workaround kept planning metadata consistent after a finalization-tool mismatch.

## Issues Encountered

- `plan:requirements mark-complete CMD-04` reported `not_found` despite the requirement being present in `.planning/REQUIREMENTS.md`; the requirement was recorded manually so plan state stayed accurate.

## Next Phase Readiness

- The main help surface now teaches the reduced canonical command set with executable examples, so the broader Phase 159 validator and surface sweeps can build on a stable front-door contract.
- Focused regression coverage is in place for future command-integrity work touching `workflows/help.md`.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-01-SUMMARY.md`
- FOUND: `zqyszrqw` task commit for help-surface rewrite
- FOUND: `vzmrmutp` task commit for help-surface regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
