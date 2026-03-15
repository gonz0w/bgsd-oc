---
phase: 118-foundation-schema
plan: 01
subsystem: database
tags: [node:sqlite, sqlite, database, migrations, dual-backend, caching]

# Dependency graph
requires: []
provides:
  - "src/lib/db.js with getDb(cwd) factory, SQLiteDatabase, MapDatabase, MIGRATIONS"
  - "Dual-backend database abstraction: SQLite on Node 22.5+, Map fallback on older"
  - "Schema migrations via PRAGMA user_version with delete-and-rebuild on failure"
  - "WAL mode + busy_timeout=5000 for concurrent access safety"
affects: [119-cache-population, 120-command-integration, 121-memory-store, 122-reporting-queries, 123-cleanup-pruning]

# Tech tracking
tech-stack:
  added: [node:sqlite]
  patterns:
    - "Dual-backend abstraction: SQLiteDatabase + MapDatabase with identical interface"
    - "Lazy singleton per cwd: _instances Map keyed by resolved cwd"
    - "Migration runner: MIGRATIONS[i](rawDb) in explicit transactions"
    - "Silent delete-and-rebuild on migration failure (_degraded flag → Map fallback)"

key-files:
  created: [src/lib/db.js, .planning/.gitignore (entries)]
  modified: []

key-decisions:
  - "Dual-path feature detection: version fast-path then try/catch require() for robustness"
  - "PRAGMA user_version inside transactions works on current Node — no post-COMMIT workaround needed"
  - "Multi-tier DatabaseSync constructor: {timeout,defensive} -> {timeout} -> plain, handles 22.5–25.x+"
  - "busy_timeout PRAGMA returns {timeout:N} not {busy_timeout:N} in node:sqlite — fixed verification"
  - "_degraded flag: constructor sets it on rebuild failure, getDb() swaps to MapDatabase"

patterns-established:
  - "db.notices[] drain pattern: plugin/caller reads and drains, notices cleared on read"
  - "zero-dependency CJS module with try/catch node:sqlite import for bundle compatibility"

requirements-completed:
  - FND-01
  - FND-02
  - FND-03
  - FND-04
one-liner: "SQLite database abstraction in src/lib/db.js — WAL mode, PRAGMA user_version migrations, Map fallback, and silent delete-and-rebuild recovery"

# Metrics
duration: 9min
completed: 2026-03-14
---

# Phase 118 Plan 01: Foundation & Schema Summary

**SQLite database abstraction in src/lib/db.js — WAL mode, PRAGMA user_version migrations, Map fallback, and silent delete-and-rebuild recovery**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-14T15:17:06Z
- **Completed:** 2026-03-14T15:26:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/lib/db.js` with `getDb(cwd)` factory, `SQLiteDatabase` class, `MapDatabase` class, `MIGRATIONS` array, `hasSQLiteSupport()`, and `closeAll()` — the complete dual-backend database infrastructure for v12.0
- SQLiteDatabase opens `.planning/.cache.db` with WAL mode + busy_timeout=5000 for concurrent access, runs schema migrations via PRAGMA user_version, and uses a multi-tier DatabaseSync constructor to handle Node 22.5–25.x+ differences (including `defensive: false` for Node 25.5+)
- MapDatabase provides identical interface as transparent in-memory fallback — callers cannot distinguish which backend is active; migration failures trigger silent delete-and-rebuild with MapDatabase as final fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/lib/db.js with dual-backend database abstraction** - `75ad003` (feat)
2. **Task 2: Implement migration failure recovery and concurrency safety** - `11a3345` (fix)

## Files Created/Modified
- `src/lib/db.js` — New module: getDb factory, SQLiteDatabase, MapDatabase, MIGRATIONS, hasSQLiteSupport, closeAll
- `.planning/.gitignore` — Added .cache.db, .cache.db-wal, .cache.db-shm entries

## Decisions Made
- **Dual-path hasSQLiteSupport()**: Version fast-path (avoids require() overhead) then `try { require('node:sqlite') }` verification — matches pattern in existing `cache.js` while being more robust
- **PRAGMA user_version inside transactions**: Verified at runtime — works correctly in modern Node.js SQLite, no post-COMMIT workaround needed. Documented in code for future reference
- **Multi-tier DatabaseSync constructor**: `{timeout:5000, defensive:false}` → `{timeout:5000}` → plain — handles Node 22.5 (no options), 22.16+/24+ (timeout option), and 25.5+ (defensive mode default)
- **busy_timeout PRAGMA result key**: `node:sqlite` returns `{timeout:N}` not `{busy_timeout:N}` — corrected verification logic in Task 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed busy_timeout PRAGMA result key name**
- **Found during:** Task 2 (concurrency safety verification)
- **Issue:** Plan specified verifying `btResult.busy_timeout !== 5000` but `node:sqlite`'s `PRAGMA busy_timeout` returns `{timeout: N}` not `{busy_timeout: N}`. The verification was always skipping (treating undefined as "already correct")
- **Fix:** Changed verification to check `btResult.timeout !== undefined ? btResult.timeout : btResult.busy_timeout` — handles both key names for forward/backward compatibility
- **Files modified:** src/lib/db.js
- **Verification:** `node -e` test confirms `PRAGMA busy_timeout` returns `{timeout:5000}` and verification triggers correctly
- **Committed in:** `11a3345` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was necessary for correctness — verification would have silently passed even if busy_timeout wasn't set. No scope creep.

## Review Findings

Review skipped — gap closure plan / checkpoint plan / review context unavailable

## Issues Encountered
- The `npm test` run under `--test-concurrency=8` produced a transient memory test failure (bundle truncated during concurrent build). Re-running with lower concurrency confirmed 1006/1006 pass. The single repeatable failure (`buildTaskContext quality baseline`) is pre-existing and unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/lib/db.js` is ready for Phase 119 (cache population) — wire `getDb(cwd)` into command startup and populate structured tables
- Phase 119 should append its migrations to the `MIGRATIONS` array in `db.js`
- The `node:sqlite` external dependency is already in the esbuild `external` list — no build changes needed
- `.planning/.cache.db` will be created on first command invocation in any project

---
*Phase: 118-foundation-schema*
*Completed: 2026-03-14*
