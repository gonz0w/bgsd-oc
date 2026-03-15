---
phase: 119-parser-integration-planning-tables
plan: 03
subsystem: database
tags: [javascript, sqlite, testing, planning-cache, node-test]
provides:
  - "71-test comprehensive suite for PlanningCache covering schema migration, mtime invalidation, store/query round-trips, and MapDatabase fallback"
  - "clearForCwd() method on PlanningCache for full cache reset per cwd"
affects:
  - 120-query-integration
  - phases using PlanningCache for store/query operations
tech-stack:
  added: []
  patterns:
    - "PlanningCache test isolation: each group uses its own cwd string and temp dir — no inter-group interference"
    - "Round-trip test pattern: store mock data → query → assert fields match — establishes contract for TBL-01 through TBL-04"
key-files:
  created:
    - tests/planning-cache.test.cjs
  modified:
    - src/lib/planning-cache.js
key-decisions:
  - "clearForCwd() added to PlanningCache — was specified in Plan 02 Task 3 but not implemented; added as blocking deviation since tests require it"
  - "Both plan tasks (groups 1-3 and groups 4-8) written as complete file in one pass and committed together — same file, no value in partial intermediate commit"
patterns-established:
  - "PlanningCache test pattern: use string cwd ('/test/project/tblXX') for isolation rather than actual temp dirs for each group — avoids SQLite singleton issues across groups"
requirements-completed:
  - TBL-01
  - TBL-02
  - TBL-03
  - TBL-04
one-liner: "71-test suite covering PlanningCache schema migration (7 tables), mtime invalidation lifecycle, TBL-01 through TBL-04 store/query round-trips, and MapDatabase fallback — plus clearForCwd() added to planning-cache.js"
duration: 16min
completed: 2026-03-14
---

# Phase 119 Plan 03: PlanningCache Test Suite Summary

**71-test suite covering PlanningCache schema migration (7 tables), mtime invalidation lifecycle, TBL-01 through TBL-04 store/query round-trips, and MapDatabase fallback — plus clearForCwd() added to planning-cache.js**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-14T17:07:05Z
- **Completed:** 2026-03-14T17:23:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `tests/planning-cache.test.cjs` with 71 tests across 8 groups — covering MIGRATIONS[1] table existence/column verification, PlanningCache construction with both backends, mtime invalidation lifecycle (missing→fresh→stale→invalidated), and all four TBL-XX requirements
- Added `clearForCwd(cwd)` method to `src/lib/planning-cache.js` — was specified in Plan 02 Task 3 but not present in the implementation; tests for Group 7 require it for the end-to-end invalidation flow
- Full test suite (1090 tests) passes with zero regressions after adding 71 new tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests for schema migration, construction, and mtime invalidation (groups 1-3)** - `8ffd4a7` (test) — also includes groups 4-8 and clearForCwd, since both tasks target same file

**Plan metadata:** `bf18fdb` (docs: complete planning-cache test suite plan)

## Files Created/Modified

- `tests/planning-cache.test.cjs` — 71-test comprehensive test suite for PlanningCache (8 groups, 1061 lines)
- `src/lib/planning-cache.js` — Added `clearForCwd(cwd)` method (+43 lines)

## Decisions Made

- **Wrote complete file in one pass**: Both plan tasks (groups 1-3 and 4-8) modify the same file. Written as a complete suite in one pass and committed under Task 1 — same pattern established in Phase 118 Plan 03 where all db.test.cjs groups were committed together to avoid an incomplete intermediate state.

- **String cwds for test isolation**: Used distinct string CWDs (e.g., `/test/project/tbl01`) per describe group instead of per-group temp dirs — avoids SQLite singleton collision (`getDb()` returns same instance for same cwd) while still providing logical isolation across test groups.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `clearForCwd()` method to PlanningCache**

- **Found during:** Task 1 / Group 7 test authoring (Invalidation End-to-End)
- **Issue:** Plan 03 test group 7 specifies: "clearForCwd removes all data for a cwd". This method was planned in Phase 119 Plan 02 Task 3 (`clearForCwd(cwd)` method) but was not implemented in `src/lib/planning-cache.js`. Tests would fail with `TypeError: cache.clearForCwd is not a function`.
- **Fix:** Added `clearForCwd(cwd)` method to `PlanningCache` class — wraps DELETE statements for all cwd-scoped tables (phases, milestones, progress, requirements, plans/tasks cascade, file_cache LIKE) in a transaction.
- **Files modified:** `src/lib/planning-cache.js`
- **Verification:** Group 7 test "clearForCwd removes all data for a cwd" passes; all 71 tests pass; `npm test` passes with zero failures.
- **Committed in:** `8ffd4a7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing method)
**Impact on plan:** Necessary for test correctness. The clearForCwd method was already specified in the plan design; adding it completes the planned API surface.

## Review Findings

Review skipped — gap closure plan / review context unavailable

## Issues Encountered

None — tests passed on first run after adding the clearForCwd method.

## Next Phase Readiness

- **TBL-01 through TBL-04 test coverage complete**: All four requirement categories now have dedicated test groups verifying the PlanningCache contract
- **PlanningCache API locked**: 71 tests establish the contract for schema, mtime, store/query, invalidation, and fallback — future phases can extend without breaking these invariants
- **Ready for Phase 120**: Query integration can build on verified PlanningCache layer with confidence

---
*Phase: 119-parser-integration-planning-tables*
*Completed: 2026-03-14*

## Self-Check: PASSED

- ✅ `tests/planning-cache.test.cjs` — exists (71 tests, 8 groups)
- ✅ `src/lib/planning-cache.js` — exists, clearForCwd() method added
- ✅ Commit `8ffd4a7` (Task 1) — exists in git log
- ✅ 71 tests pass / 0 fail (node --test tests/planning-cache.test.cjs)
- ✅ 1090 total tests pass / 0 fail (npm test — zero regressions)
