---
phase: 0121-memory-store-migration
plan: 02
subsystem: database
tags: [sqlite, memory-stores, dual-write, sql-search, planning-cache]
provides:
  - dual-write in cmdMemoryWrite — every memory write persists to both JSON and SQLite
  - SQL-first search in cmdMemoryRead — --query uses LIKE SQL when SQLite available
  - dual-write in trajectory checkpoint/pivot/choose via _dualWriteTrajectory helper
  - auto-migration in cmdInitMemory — migrateMemoryStores called on first access
  - SQLite-first reads in cmdInitMemory for bookmarks, decisions, lessons
requires:
  - phase: 0121-01
    provides: PlanningCache.writeMemoryEntry, searchMemory, migrateMemoryStores, getBookmarkTop methods
affects:
  - 0122-memory-dual-write
  - 0123-memory-sql-search
tech-stack:
  added: []
  patterns:
    - "Dual-write pattern: JSON canonical, SQLite best-effort — never roll back JSON on SQLite failure"
    - "SQL-first with JSON fallback: try SQLite, fall back to JSON on error or empty result"
    - "_dualWriteTrajectory helper: fire-and-forget, never blocks main operation"
    - "searchMemory(null query): match all rows for cwd — omits search filter when query is null"
key-files:
  created: []
  modified:
    - src/commands/memory.js
    - src/commands/trajectory.js
    - src/commands/init.js
    - src/lib/planning-cache.js
    - bin/bgsd-tools.cjs
key-decisions:
  - "JSON is canonical, SQLite is best-effort — dual-write failures log but never roll back JSON"
  - "SQL-first search uses JSON total for total field (not SQL count) to maintain API contract"
  - "searchMemory extended to support null query = fetch all (no search filter) for init.js reads"
  - "migrateMemoryStores inserts bookmarks in REVERSE order so newest (index 0) gets highest id, matching ORDER BY id DESC semantics"
  - "SQL-first reads fall back to JSON when SQLite returns empty (handles cold/uninitiated DB)"
patterns-established:
  - "SQL-first with JSON fallback: if sqlResult && sqlResult.entries.length > 0 use SQL, else continue to JSON path"
requirements-completed: [MEM-01, MEM-03]
one-liner: "Dual-write to SQLite on all memory/trajectory writes plus SQL-first search in cmdMemoryRead and SQLite-first reads in cmdInitMemory"
duration: 27min
completed: 2026-03-14
---

# Phase 121 Plan 02: Dual-Write and SQL-Powered Search Summary

**Dual-write to SQLite on all memory/trajectory writes plus SQL-first search in cmdMemoryRead and SQLite-first reads in cmdInitMemory**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-14T19:11:56Z
- **Completed:** 2026-03-14T19:39:03Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Wired dual-write into `cmdMemoryWrite` (all stores) and all 3 trajectory write paths (checkpoint, pivot, choose) — every sacred data write now persists to both JSON (canonical) and SQLite (queryable)
- Added SQL-first search in `cmdMemoryRead` — `--query` flag uses LIKE SQL search when SQLite available, with automatic migration trigger and JSON fallback for empty/failed SQL results
- Added auto-migration + SQLite-first reads in `cmdInitMemory` for bookmarks (via `getBookmarkTop`), decisions, and lessons — warm starts now use SQL without JSON.parse of entire files

## Task Commits

Each task was committed atomically:

1. **Task 1: Dual-write in memory.js and SQL-powered search in cmdMemoryRead** - `018a7da` (feat)
2. **Task 2: Dual-write in trajectory.js write paths** - `0292174` (feat)
3. **Task 3: SQLite-first reads in cmdInitMemory with auto-migration** - `aaeaba7` (feat)

## Files Created/Modified

- `src/commands/memory.js` — Added `getDb`/`PlanningCache` imports; dual-write block after JSON write in `cmdMemoryWrite`; SQL-first search block in `cmdMemoryRead` with `source: 'sql'/'json'` field
- `src/commands/trajectory.js` — Added `getDb`/`PlanningCache` imports; `_dualWriteTrajectory` helper; dual-write calls after `fs.writeFileSync` in checkpoint, pivot, and choose
- `src/commands/init.js` — Added `getDb`/`PlanningCache` imports; auto-migration trigger at start of `cmdInitMemory`; SQLite-first bookmark/decisions/lessons reads with JSON fallback
- `src/lib/planning-cache.js` — Extended `searchMemory` to support `null` query (fetch all, no filter); changed bookmark migration to insert in reverse order for correct `ORDER BY id DESC` semantics
- `bin/bgsd-tools.cjs` — Rebuilt bundle

## Decisions Made

- **JSON is canonical, SQLite is best-effort** — dual-write failures log via `debugLog` but never roll back the JSON write; JSON remains the source of truth per prior decision
- **SQL total vs JSON total in cmdMemoryRead** — when SQL search succeeds, the `total` field reports JSON store size (pre-computed before the SQL path) to maintain the API contract tests expect
- **searchMemory null-query support** — extended to accept `null` query meaning "no search filter, fetch all for cwd" needed by init.js reads that retrieve recent decisions/lessons without a search term
- **Bookmark migration order** — bookmarks.json stores newest first (index 0); migration now inserts in REVERSE order so the newest bookmark gets the highest `id`, matching `getBookmarkTop`'s `ORDER BY id DESC LIMIT 1` semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] searchMemory null-query support required for init.js reads**
- **Found during:** Task 3 (SQLite-first reads in cmdInitMemory)
- **Issue:** `cmdInitMemory` calls `searchMemory(cwd, 'decisions', null, {phase, limit})` with a null query to fetch recent entries without a search term. `searchMemory` used `'%' + query + '%'` which became `'%null%'` and matched nothing, causing init to fall through to the JSON path (no SQL acceleration)
- **Fix:** Extended `searchMemory` to check `if (query)` — when query is null/empty, omit the search filter and query with only `cwd = ?` and optional phase filter
- **Files modified:** `src/lib/planning-cache.js`
- **Verification:** `npm test` passes 1160/1160; `init:memory` SQLite-first reads return entries correctly
- **Committed in:** `aaeaba7` (Task 3 commit)

**2. [Rule 1 - Bug] Bookmark migration order — getBookmarkTop returned wrong bookmark**
- **Found during:** Task 3 (test run after init.js changes)
- **Issue:** `migrateMemoryStores` inserted bookmarks in array order (newest=index 0 inserted first, getting lowest id). `getBookmarkTop` uses `ORDER BY id DESC LIMIT 1`, so it returned the LAST inserted bookmark (oldest, index N-1) instead of the newest (index 0)
- **Fix:** Changed migration to iterate `entries.length-1` down to 0 (reverse order) so the newest bookmark gets the highest id, consistent with `ORDER BY id DESC` semantics and live dual-write behavior
- **Files modified:** `src/lib/planning-cache.js`
- **Verification:** `includes latest bookmark` test passes; `npm test` passes 1160/1160
- **Committed in:** `aaeaba7` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical — null-query support, 1 bug — bookmark migration order)
**Impact on plan:** Both fixes necessary for correctness. The null-query extension enables the SQL acceleration for init reads; the bookmark order fix ensures the correct bookmark is returned. No scope creep.

## Review Findings

Review skipped — autonomous plan

## Issues Encountered

None — both deviations were caught and fixed during Task 3 test run before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 sacred data write paths (cmdMemoryWrite, cmdTrajectoryCheckpoint, cmdTrajectoryPivot, cmdTrajectoryChoose) now dual-write to SQLite
- cmdMemoryRead --query uses SQL LIKE search with JSON fallback — user-visible search acceleration live
- cmdInitMemory auto-migrates JSON stores to SQLite on first access and reads warm data from SQL
- All 1160 existing tests pass — no behavioral regressions
- Phase 121 (Memory Store Migration) is complete: schema (Plan 01) + dual-write/SQL reads (Plan 02)
- Requirements MEM-01 and MEM-03 fulfilled

## Self-Check: PASSED

- ✅ `src/commands/memory.js` — exists
- ✅ `src/commands/trajectory.js` — exists
- ✅ `src/commands/init.js` — exists
- ✅ `src/lib/planning-cache.js` — exists
- ✅ `018a7da` — Task 1 commit found
- ✅ `0292174` — Task 2 commit found
- ✅ `aaeaba7` — Task 3 commit found
- ✅ `1160/1160` tests pass

---
*Phase: 0121-memory-store-migration*
*Completed: 2026-03-14*
