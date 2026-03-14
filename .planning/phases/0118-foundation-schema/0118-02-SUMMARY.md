---
phase: 118-foundation-schema
plan: 02
subsystem: cli
tags: [sqlite, database, startup, cache, node-sqlite]

# Dependency graph
requires:
  - phase: 118-foundation-schema
    provides: "db.js dual-backend database module (SQLiteDatabase + MapDatabase) from Plan 01"
provides:
  - "Eager database initialization on every bGSD command via router.js lazyDb() + getDb()"
  - "cache:clear extended to remove project-local .planning/.cache.db and WAL/SHM files"
  - "Notices stored in global._gsdDbNotices for plugin system to drain"
affects: [119-kv-store, 120-query-layer, 121-memory-store]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy module loader pattern extended to db.js (lazyDb() in router.js)"
    - "Silent try/catch wrapping for non-critical startup initialization"
    - "global._gsdDbNotices as cross-process handoff channel for plugin notifications"

key-files:
  created: []
  modified:
    - src/router.js
    - src/commands/cache.js
    - bin/bgsd-tools.cjs

key-decisions:
  - "Database initialization placed after --no-cache flag parsing so BGSD_CACHE_FORCE_MAP is set before getDb() runs"
  - "closeAll() called before unlinkSync in cache:clear to prevent locked-file errors on Windows"
  - ".planning/.gitignore already had all three entries — no modification needed"

patterns-established:
  - "lazyDb() pattern: all lib/ modules accessed via lazy loaders in router.js"
  - "global._gsdDbNotices: once-per-session plugin notification channel for db status"

requirements-completed: [FND-01, FND-03]
one-liner: "Eager SQLite db init wired into every bGSD CLI command at startup; cache:clear extended to sweep .planning/.cache.db and WAL/SHM companions"

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 118 Plan 02: CLI Startup Wiring & Cache Lifecycle Summary

**Eager SQLite db init wired into every bGSD CLI command at startup; cache:clear extended to sweep .planning/.cache.db and WAL/SHM companions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T15:30:04Z
- **Completed:** 2026-03-14T15:37:28Z
- **Tasks:** 2
- **Files modified:** 3 (src/router.js, src/commands/cache.js, bin/bgsd-tools.cjs)

## Accomplishments
- Added `lazyDb()` lazy loader and eager `getDb(cwd)` call in `router.js main()` after global flag parsing, ensuring every bGSD command creates `.planning/.cache.db` at startup (Node 22.5+) with silent failure on error
- Extended `cmdCacheClear()` in `cache.js` to iterate `.cache.db`, `.cache.db-wal`, `.cache.db-shm` — calling `closeAll()` first to release open connections, then `fs.unlinkSync()` each file
- Confirmed `.planning/.gitignore` already contained all three exclusion entries from a prior commit — zero additional changes required

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire getDb() into CLI startup in router.js** - `5226d7b` (feat)
2. **Task 2: Extend cache:clear and update .planning/.gitignore** - `91fecff` (feat)

**Plan metadata:** `(see below — docs commit)` (docs: complete plan)

## Files Created/Modified
- `src/router.js` - Added `lazyDb()` function and eager db initialization block in `main()`
- `src/commands/cache.js` - Extended `cmdCacheClear()` to remove project-local `.cache.db` + WAL/SHM files
- `bin/bgsd-tools.cjs` - Rebuilt bundle reflecting both source changes

## Decisions Made
- Placed the db initialization block **after** `--no-cache` flag parsing (line ~192) so `BGSD_CACHE_FORCE_MAP=1` is set before `getDb()` runs — avoids initializing SQLite only to have it bypassed by the Map backend fallback flag
- Called `closeAll()` before `fs.unlinkSync()` in cache clear to close any open db handles (important on Windows where locked files cannot be deleted)
- `.planning/.gitignore` already had `.cache.db`, `.cache.db-wal`, `.cache.db-shm` entries — no write required, confirmed via file read before edit

## Deviations from Plan

None - plan executed exactly as written. The `.planning/.gitignore` entries already existed, which saved one file modification. The plan's Task 2 action specified adding those entries "if not present" (implied) and they were present.

## Review Findings

Review skipped — gap closure plan / no autonomous review context configured for this plan.

## Issues Encountered
None. All tests passed (1010–1024 pass, 0 fail across both test runs). Build succeeded on first attempt. Cache clear behavior confirmed with manual before/after `ls` verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Foundation complete: db module exists, initializes at startup, and integrates with cache lifecycle
- Phase 119 (KV Store) can now build on the SQLite backend with full confidence the db exists when commands run
- No blockers — all must_haves satisfied: eager creation, Map fallback, .gitignore exclusion, cache:clear cleanup, notices stored

---
*Phase: 118-foundation-schema*
*Completed: 2026-03-14*
