---
phase: 119-parser-integration-planning-tables
plan: 01
subsystem: database
tags: [sqlite, planning-cache, migrations, mtime, caching]
provides:
  - SQLite planning tables schema (MIGRATIONS[1]) with 7 tables: file_cache, milestones, phases, progress, plans, tasks, requirements
  - PlanningCache class with mtime-based invalidation, storeRoadmap/storePlan write-through, and getPhases/getPlan/getRequirements query operations
  - MapDatabase backend transparent miss — all PlanningCache reads return null/empty on map backend
affects:
  - phase: 119-parser-integration-planning-tables plan 02 (wires PlanningCache into parser system)
  - phase: 120+ (all future phases using planning data queries)
requires:
  - phase: 118-foundation-schema
    provides: SQLiteDatabase/MapDatabase abstraction layer, MIGRATIONS[0], getDb() factory
tech-stack:
  added: []
  patterns:
    - "Lazy prepared statement cache: _stmts{} on instance, created on first call, reused thereafter"
    - "MapDatabase no-op guard: _isMap() check at method entry returns null/empty immediately"
    - "Write-through transactions: storeRoadmap/storePlan wrapped in BEGIN/COMMIT for atomicity"
    - "mtime_ms freshness: checkFreshness() compares fs.statSync().mtimeMs against stored mtime_ms"
key-files:
  created: [src/lib/planning-cache.js]
  modified: [src/lib/db.js, tests/db.test.cjs, bin/bgsd-tools.cjs]
key-decisions:
  - "Schema version 2: MIGRATIONS[1] appended to MIGRATIONS array — db.test.cjs assertions updated from version 1 to version 2"
  - "PlanningCache separate from db.js: keeps db.js focused on infrastructure, planning-cache.js on domain queries"
  - "NULL-returning queries on empty result: getPhases/getPlans etc return null (not []) when no rows — caller can distinguish no-data from empty-data"
  - "DELETE-then-INSERT pattern for storeRoadmap/storePlan: avoids partial update anomalies, ensures consistency with foreign key CASCADE"
patterns-established:
  - "Lazy prepared statement cache: _stmt(key, sql) pattern for reusable StatementSync objects"
  - "MapDatabase guard: all PlanningCache methods start with if (this._isMap()) return null/undefined"
requirements-completed:
  - TBL-01
  - TBL-02
  - TBL-03
  - TBL-04
one-liner: "SQLite planning tables schema (MIGRATIONS[1] → version 2) plus PlanningCache class with mtime invalidation, storeRoadmap/storePlan write-through, and getPhases/getPlan/getRequirements queries"
duration: 4min
completed: 2026-03-14
---

# Phase 119 Plan 01: Planning Tables Schema and PlanningCache Summary

**SQLite planning tables schema (MIGRATIONS[1] → version 2) plus PlanningCache class with mtime invalidation, storeRoadmap/storePlan write-through, and getPhases/getPlan/getRequirements queries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T16:32:34Z
- **Completed:** 2026-03-14T16:36:32Z
- **Tasks:** 2
- **Files modified:** 4

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MIGRATIONS[1] with planning tables schema** - `c12cea2` (feat)
2. **Task 2: Create PlanningCache class with mtime invalidation and CRUD operations** - `5b1992e` (feat)

## Files Created/Modified

- `src/lib/db.js` — Added MIGRATIONS[1] (7 planning tables: file_cache, milestones, phases, progress, plans, tasks, requirements + 7 indexes); schema advances to version 2
- `src/lib/planning-cache.js` — New PlanningCache class with mtime invalidation (checkFreshness/updateMtime/invalidateFile/checkAllFreshness), store operations (storeRoadmap/storePlan), query operations (getPhases/getPhase/getPlans/getPlan/getPlansForPhase/getRequirements/getRequirement/getMilestones/getProgress), and _extractRequirementsFromPhases helper
- `tests/db.test.cjs` — Updated 4 test assertions from schema version 1 → 2 (Group 3, Group 6, Group 7) to match new MIGRATIONS[1]
- `bin/bgsd-tools.cjs` — Rebuilt with MIGRATIONS[1] SQL bundled (file_cache and planning tables visible in bundle)

## Accomplishments

- Established the 7-table planning schema (MIGRATIONS[1]) that underpins all roadmap/plan caching in phases 119-123; tables created automatically at startup via existing `_runMigrations` infrastructure
- Built PlanningCache class providing the full data layer API — mtime-based stale detection, transactional write-through stores, and null-returning read queries — ready to be wired into parsers in Plan 02
- Verified MapDatabase backend returns null/empty from all PlanningCache methods, ensuring transparent parse-on-miss behavior for environments without SQLite

## Decisions Made

- **Schema version 2**: MIGRATIONS[1] appended to MIGRATIONS array — tests updated from version 1 to version 2. The test assertions specifically checking for version 1 were schema-accurate before this migration and needed updating (not bugs, just version expectations).
- **PlanningCache as separate file**: `planning-cache.js` is kept separate from `db.js` to maintain separation of concerns — `db.js` owns infrastructure (connection, migrations, WAL), `planning-cache.js` owns domain logic (roadmap/plan/task caching).
- **null vs [] for query returns**: `getPhases()` and similar methods return `null` (not `[]`) when no data is cached, allowing callers to distinguish "not cached" from "cached but empty".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated db.test.cjs schema version assertions from 1 → 2**
- **Found during:** Task 1 post-commit test run
- **Issue:** 3 tests in Group 3, Group 6, and Group 7 asserting `getSchemaVersion() === 1` failed after MIGRATIONS[1] advanced the schema to version 2
- **Fix:** Updated assertions in `getSchemaVersion() returns 1 after initial migration`, `fresh DB starts at version 0 before getDb(), version 1 after`, `calling getDb() again on same DB is idempotent — version stays at 1`, and the rebuild test — all changed to expect version 2
- **Files modified:** `tests/db.test.cjs`
- **Verification:** `node --test tests/db.test.cjs` → 52/52 pass
- **Committed in:** `c12cea2` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test version assertions)
**Impact on plan:** Necessary correctness fix. No scope creep — tests were correct before MIGRATIONS[1] and needed updating to match the new schema state.

## Review Findings

Review skipped — gap closure plan / review context unavailable at time of execution.

## Issues Encountered

None — plan executed smoothly. Both tasks completed without blocking issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready:** MIGRATIONS[1] creates all 7 planning tables on startup; PlanningCache class fully implemented with store/query/mtime APIs
- **Ready for Plan 02:** `src/lib/planning-cache.js` exports `{ PlanningCache }` — Plan 02 can `require('./planning-cache')` and integrate with roadmap/plan parsers
- **No blockers:** All tests pass (1017/1017), build succeeds, manual round-trip verified

## Self-Check

**Files created/modified:**
- `src/lib/db.js` — FOUND ✓
- `src/lib/planning-cache.js` — FOUND ✓
- `tests/db.test.cjs` — FOUND ✓

**Commits exist:**
- `c12cea2` (feat: MIGRATIONS[1]) — FOUND ✓
- `5b1992e` (feat: PlanningCache) — FOUND ✓

## Self-Check: PASSED

---
*Phase: 119-parser-integration-planning-tables*
*Completed: 2026-03-14*
