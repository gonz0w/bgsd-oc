---
phase: 0121-memory-store-migration
plan: 01
subsystem: database
tags: [sqlite, memory-stores, migration, planning-cache]
provides:
  - MIGRATIONS[2] creating four memory_* tables with indexes in db.js
  - SCHEMA_V3_SQL in db-cache.js matching all memory tables
  - PlanningCache.migrateMemoryStores() — idempotent JSON-to-SQLite migration
  - PlanningCache.searchMemory() — LIKE-based SQL search across all memory stores
  - PlanningCache.writeMemoryEntry() — single-entry insert for dual-write
  - PlanningCache.clearMemoryStore() — delete all entries for a store/cwd
  - PlanningCache.getBookmarkTop() — most recent bookmark retrieval
affects:
  - 0122-memory-dual-write
  - 0123-memory-sql-search
tech-stack:
  added: []
  patterns:
    - "data_json column stores full JSON for lossless round-tripping alongside extracted searchable columns"
    - "All memory methods guard with _isMap() and return null on Map backend"
key-files:
  created: []
  modified:
    - src/lib/db.js
    - src/lib/planning-cache.js
    - src/plugin/lib/db-cache.js
    - bin/bgsd-tools.cjs
    - tests/db.test.cjs
    - tests/planning-cache.test.cjs
key-decisions:
  - "Schema advanced from v2 to v3 — db-cache.js renamed SCHEMA_V2_SQL to SCHEMA_V3_SQL and bumped version check to >= 3"
  - "data_json stores full original JSON entry for lossless round-tripping; searchable fields broken out as columns"
  - "migrateMemoryStores() uses per-store transactions for atomicity and skips if any decisions exist for cwd"
  - "searchMemory() uses LIKE-based search per REQUIREMENTS.md Out of Scope — no FTS5"
  - "Schema version assertions in db.test.cjs and planning-cache.test.cjs updated from 2 to 3 [Rule 1 - Bug]"
patterns-established:
  - "Memory store methods all return null on Map backend — consistent with existing PlanningCache pattern"
requirements-completed: [MEM-02]
one-liner: "SQLite memory store schema (v3) with 4 memory_* tables plus PlanningCache migration/search/write/clear/bookmark methods"
duration: 5min
completed: 2026-03-14
---

# Phase 121 Plan 01: Memory Store Schema and Migration Summary

**SQLite memory store schema (v3) with 4 memory_* tables plus PlanningCache migration/search/write/clear/bookmark methods**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T19:04:22Z
- **Completed:** 2026-03-14T19:09:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added MIGRATIONS[2] to `src/lib/db.js` creating four memory tables (`memory_decisions`, `memory_lessons`, `memory_trajectories`, `memory_bookmarks`) with appropriate indexes; bumped schema to v3
- Updated `src/plugin/lib/db-cache.js` from SCHEMA_V2_SQL to SCHEMA_V3_SQL (same four tables) and bumped version check from `>= 2` to `>= 3`
- Added 5 new methods to `PlanningCache`: `migrateMemoryStores()`, `searchMemory()`, `writeMemoryEntry()`, `clearMemoryStore()`, and `getBookmarkTop()` — all no-op on Map backend

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MIGRATIONS[2] for memory tables and sync db-cache.js** - `2c35835` (feat)
2. **Task 2: Add PlanningCache memory migration and query methods** - `c333216` (feat)

## Files Created/Modified

- `src/lib/db.js` — Added MIGRATIONS[2] (migration_v3) creating 4 memory tables with indexes
- `src/plugin/lib/db-cache.js` — Renamed SCHEMA_V2_SQL→SCHEMA_V3_SQL, appended memory tables, bumped version guard to 3
- `src/lib/planning-cache.js` — Added 5 memory store methods (migrateMemoryStores, searchMemory, writeMemoryEntry, clearMemoryStore, getBookmarkTop)
- `bin/bgsd-tools.cjs` — Rebuilt bundle
- `tests/db.test.cjs` — Updated schema version assertions from 2 → 3
- `tests/planning-cache.test.cjs` — Updated schema version assertion from 2 → 3

## Decisions Made

- Schema advanced from v2 to v3 — `db-cache.js` renamed `SCHEMA_V2_SQL` to `SCHEMA_V3_SQL` and bumped version check to `>= 3`; both CJS and ESM schemas now create identical memory_* tables
- `data_json` column stores the full original JSON entry for lossless round-tripping; searchable fields (summary, text, phase, category) are extracted as indexed columns for LIKE queries
- `migrateMemoryStores()` uses a COUNT-based idempotency check — if any decisions exist for cwd, the entire migration is skipped
- `searchMemory()` uses LIKE-based search (`%query%`) per REQUIREMENTS.md Out of Scope constraint (no FTS5)
- Per-store transactions in `migrateMemoryStores()` so a failure in one file doesn't abort the others

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema version assertions updated from 2 to 3 in tests**
- **Found during:** Task 1 (build + test run)
- **Issue:** `tests/db.test.cjs` and `tests/planning-cache.test.cjs` had hardcoded assertions that `getSchemaVersion()` returns 2; adding MIGRATIONS[2] advances the schema to version 3, causing 5 test failures
- **Fix:** Updated all schema version assertions from 2 → 3 with updated test names and error messages
- **Files modified:** `tests/db.test.cjs`, `tests/planning-cache.test.cjs`
- **Verification:** `npm test` passes 1160/1160
- **Committed in:** `2c35835` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — schema version assertion mismatch)
**Impact on plan:** Necessary correctness fix for the test suite to reflect the new schema version. No scope creep.

## Review Findings

Review skipped — gap closure / autonomous plan with no checkpoint segments

## Issues Encountered

None — both tasks executed cleanly after the schema version test fix.

## Next Phase Readiness

- Schema v3 is live in both CJS (`db.js`) and ESM (`db-cache.js`) — both create identical memory_* tables
- `PlanningCache` has all 5 memory methods ready for Plan 02's dual-write implementation
- All 1160 existing tests pass — no behavioral regressions
- Memory tables are empty until `migrateMemoryStores()` is called; Plan 02 will wire that call into the enricher/command flow

---
*Phase: 0121-memory-store-migration*
*Completed: 2026-03-14*
