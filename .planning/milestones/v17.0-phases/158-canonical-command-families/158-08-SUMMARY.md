---
phase: 158-canonical-command-families
plan: 08
subsystem: docs
tags: [docs, markdown, canonical-commands, node-test]
requires:
  - phase: 158-canonical-command-families
    provides: canonical /bgsd-plan and /bgsd-settings family contracts from earlier Phase 158 plans
provides:
  - canonical-first onboarding guidance for planning-family commands
  - canonical workflow reference entries for planning gaps and settings profile flows
  - focused doc regression coverage for Phase 158 guidance drift
affects: [getting-started, workflows-reference, phase-159-help-audit]
tech-stack:
  added: []
  patterns:
    - canonical-first docs wording with compatibility-only alias notes
    - focused node:test guidance regressions for touched markdown surfaces
key-files:
  created: [tests/guidance-docs.test.cjs]
  modified:
    - docs/getting-started.md
    - docs/workflows.md
key-decisions:
  - "Teach canonical /bgsd-plan subcommands directly in onboarding and workflow reference examples."
  - "Keep legacy mentions only as compatibility notes instead of primary examples."
patterns-established:
  - "Docs migration slices should pair canonical-first wording with targeted regression tests."
requirements-completed: [CMD-02, CMD-03]
one-liner: "Canonical /bgsd-plan onboarding and workflow-reference guidance with compatibility-only legacy notes"
duration: 1 min
completed: 2026-03-29
---

# Phase 158 Plan 08: Close the docs-reference portion of GAP-158-01 by updating the remaining user-facing docs that still recommend legacy planning and settings commands as the preferred path. Summary

**Canonical `/bgsd-plan` onboarding and workflow-reference guidance with compatibility-only legacy notes**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-29 17:14:14 -0600
- **Completed:** 2026-03-29 17:14:47 -0600
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rewrote `docs/getting-started.md` so first-run planning examples and next-step routing now teach `/bgsd-plan phase` instead of legacy planning commands.
- Updated `docs/workflows.md` to present `/bgsd-plan phase|discuss|research|gaps` and `/bgsd-settings profile` as the preferred reference surface.
- Added focused `tests/guidance-docs.test.cjs` coverage so touched docs fail fast if they drift back to legacy-preferred wording.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the remaining preferred docs and workflow prompts to canonical family forms** - `ad100aa` (docs)
2. **Task 2: Lock canonical docs guidance and compatibility-only legacy mentions** - `d1b7ba0` (test)

**Plan metadata:** recorded in the final docs metadata commit for this plan

## Files Created/Modified

- `docs/getting-started.md` - Canonical planning-family examples, next-step routing, and compatibility-only alias note
- `docs/workflows.md` - Canonical workflow command table entries for planning, gaps, and settings profile flows
- `tests/guidance-docs.test.cjs` - Focused regression checks for canonical-first docs guidance

## Decisions Made

- Taught canonical family subcommands directly in the touched docs instead of deferring users to legacy compatibility wrappers.
- Added narrow compatibility-only notes where legacy names still matter so migration context survives without making aliases the preferred path.
- Kept verification scoped to a dedicated docs regression file rather than expanding into broader repo-wide guidance auditing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created the missing focused docs regression file referenced by the plan verify command**
- **Found during:** Task 1 (Rewrite the remaining preferred docs and workflow prompts to canonical family forms)
- **Issue:** `tests/guidance-docs.test.cjs` did not exist, so the required `npm run test:file -- tests/guidance-docs.test.cjs` verification path could not run.
- **Fix:** Added the targeted docs regression file in Task 1, then expanded it in Task 2 to lock canonical-first wording and compatibility-only legacy notes.
- **Files modified:** tests/guidance-docs.test.cjs
- **Verification:** `npm run test:file -- tests/guidance-docs.test.cjs`
- **Committed in:** `ad100aa` and `d1b7ba0`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Narrow unblock only. It enabled the planned focused verification without expanding scope beyond the touched docs.

## Issues Encountered

None.

## Next Phase Readiness

- The remaining onboarding and workflow-reference docs in this slice now prefer canonical command families consistently.
- Phase 158 can continue closing the remaining GAP-158-01 surfaces outside these docs-focused files.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-08-SUMMARY.md`
- Found `docs/getting-started.md`, `docs/workflows.md`, and `tests/guidance-docs.test.cjs`
- Confirmed task commits `vyxvysyl` and `lrmurvyy` in `jj log`

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
