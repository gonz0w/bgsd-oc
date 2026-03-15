---
phase: 119-parser-integration-planning-tables
plan: 02
subsystem: plugin
tags: [javascript, sqlite, caching, parsers, esm]
provides:
  - parseRoadmap with SQLite-first cache hit path (TBL-01)
  - parsePlan/parsePlans with SQLite-first cache hit path (TBL-02)
  - Requirements queryable by REQ-ID from SQLite after roadmap parse (TBL-03)
  - Mtime-based invalidation detecting file changes and triggering re-parse (TBL-04)
  - ESM-native db-cache.js providing PlanningCache and getDb for plugin parsers
  - Eager mtime check in getProjectState at command startup
affects:
  - 120-query-integration
  - 121-memory-store
  - phases using parseRoadmap, parsePlan, parsePlans via plugin
tech-stack:
  added:
    - node:sqlite (dynamic import via top-level await in ESM db-cache.js)
  patterns:
    - "ESM-native adapter pattern: db-cache.js provides PlanningCache+getDb without CJS require() leaks"
    - "SQLite-first with write-through: check freshness → return cached or parse+store"
    - "Eager mtime invalidation: bulk freshness check at getProjectState startup"
    - "CWD derivation from plan path: walk dirname() chain to find .planning/ ancestor"
key-files:
  created:
    - src/plugin/lib/db-cache.js
  modified:
    - src/plugin/parsers/roadmap.js
    - src/plugin/parsers/plan.js
    - src/plugin/parsers/index.js
    - src/plugin/project-state.js
key-decisions:
  - "ESM db-cache.js created as plugin-layer adapter instead of importing CJS db.js — CJS require() wrapper fails in native ESM module context"
  - "Top-level await with dynamic import('node:sqlite') in db-cache.js — gracefully degrades when node:sqlite unavailable (Bun, old Node)"
  - "storeRoadmap adapts camelCase parser field names (planCount, plansComplete) to snake_case DB schema (plan_count, plans_complete)"
  - "parsePlan derives cwd from planPath by walking dirname() to find .planning/ ancestor"
  - "Cache hit path: raw is null (full markdown not stored) — consumers needing raw parse fresh"
patterns-established:
  - "ESM plugin modules must not import CJS modules directly — use src/plugin/lib/db-cache.js as the ESM-native adapter"
  - "All SQLite operations in parsers are non-fatal — try/catch wraps every cache interaction, markdown parse is always the fallback"
requirements-completed:
  - TBL-01
  - TBL-02
  - TBL-03
  - TBL-04
one-liner: "SQLite-first caching wired into roadmap/plan parsers via ESM db-cache.js adapter — cache hits, write-through, mtime invalidation, and eager startup check all integrated"
duration: 24min
completed: 2026-03-14
---

# Phase 119 Plan 02: Wire Parsers to SQLite-First Cache Summary

**SQLite-first caching wired into roadmap/plan parsers via ESM db-cache.js adapter — cache hits, write-through, mtime invalidation, and eager startup check all integrated**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-14T16:39:33Z
- **Completed:** 2026-03-14T17:03:11Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Created `src/plugin/lib/db-cache.js` — ESM-native adapter providing `PlanningCache` and `getDb` using `import { DatabaseSync } from 'node:sqlite'` via top-level await dynamic import, bypassing the CJS `__require` wrapper that fails in native ESM plugin context
- `parseRoadmap` and `parsePlan`/`parsePlans` are now SQLite-first: check `PlanningCache.checkFreshness()` before reading markdown, reconstruct frozen objects from SQLite rows on cache hit, parse markdown + write through on miss/stale — all with identical return shapes
- `getProjectState` performs eager bulk mtime check at startup (ROADMAP.md, STATE.md, current phase plan files), invalidating stale SQLite entries before individual parsers are called; `invalidateAll` now also clears SQLite cache via `clearForCwd`

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire parseRoadmap to SQLite-first with write-through** - `3d04a05` (feat)
2. **Task 2: Wire parsePlan/parsePlans to SQLite-first with write-through** - `c5a74be` (feat)
3. **Task 3: Update invalidation and ensure eager mtime check at startup** - `9c16343` (feat)

## Files Created/Modified

- `src/plugin/lib/db-cache.js` — ESM-native PlanningCache + getDb adapter (474 lines)
- `src/plugin/parsers/roadmap.js` — SQLite-first parseRoadmap with buildRoadmapFromCache helper (+184 lines)
- `src/plugin/parsers/plan.js` — SQLite-first parsePlan/parsePlans with _buildPlanFromCache helper (+161 lines)
- `src/plugin/parsers/index.js` — invalidateAll now clears SQLite, new invalidatePlanningCache export (+30 lines)
- `src/plugin/project-state.js` — eager mtime check via _eagerMtimeCheck at startup (+85 lines)
- `plugin.js` — rebuilt ESM bundle incorporating all parser changes

## Decisions Made

- **ESM db-cache.js adapter pattern**: Cannot import CJS `db.js` directly into ESM plugin parsers — esbuild generates a `__require` wrapper for CJS modules that fails in native ESM context because `require` is undefined. Created `src/plugin/lib/db-cache.js` as an ESM-native reimplementation using `import { DatabaseSync } from 'node:sqlite'` via top-level await dynamic import.

- **Top-level await + dynamic import for SQLite**: Used `await import('node:sqlite')` at module initialization to gracefully handle runtimes where `node:sqlite` is unavailable (Bun, Node <22.5). Errors are caught and `_DatabaseSync` stays null, causing `MapBackend` to be used instead.

- **Field name adaptation in write-through**: Parser objects use camelCase (`planCount`, `plansComplete`, `plansTotal`) while SQLite schema uses snake_case (`plan_count`, `plans_complete`, `plans_total`). Adaptation happens in the write-through call — no parser return shape changes needed.

- **CWD derivation from planPath**: `parsePlan` accepts an optional `cwd` parameter. When not provided, `_cwdFromPlanPath` walks the `dirname()` chain to find the `.planning/` ancestor directory.

- **Cache hit shape difference**: `raw` is `null` on cache hits (markdown content not stored in SQLite). Consumers needing `raw` will get it after the first markdown parse in a session (in-memory cache stores the full object with `raw`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CJS import fails in ESM context**

- **Found during:** Task 1 (Wire parseRoadmap)
- **Issue:** Plan suggested importing CJS `db.js`/`planning-cache.js` directly from ESM parsers. When esbuild bundles CJS into ESM, it wraps CJS modules in a `__require` helper that throws `Dynamic require of "fs" is not supported` in native ESM context since `require` is undefined.
- **Fix:** Created `src/plugin/lib/db-cache.js` — an ESM-native reimplementation using `node:*` imports. Avoids the CJS bundling issue entirely.
- **Files modified:** `src/plugin/lib/db-cache.js` (new), `src/plugin/parsers/roadmap.js` (import changed)
- **Verification:** `npm run build` passes ESM validation (0 bare `require()` calls). All 68 plugin tests pass.
- **Committed in:** `3d04a05` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** The ESM adapter is a necessary architectural refinement — the plan's suggested import approach would have broken all plugin tests. No scope creep.

## Review Findings

Review skipped — gap closure plan / review context unavailable

## Issues Encountered

- **CJS require() in ESM bundle**: The primary blocker was that esbuild's CJS wrapping generates `__require()` calls which fail in native ESM. Initial test output: `Dynamic require of "fs" is not supported at file:///plugin.js`. Resolved by creating the ESM-native `db-cache.js` adapter — took ~10 min to diagnose with build tests.
- **Top-level await for SQLite detection**: Using `await import('node:sqlite')` at module level makes `plugin.js` an async ESM module. This means it cannot be `require()`d with Node's `require()` (throws `ERR_REQUIRE_ASYNC_MODULE`). This is acceptable — `plugin.js` is an ESM plugin loaded by the editor, not a CJS module.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **TBL-01 through TBL-04 fulfilled**: All four SQLite integration requirements are now implemented and verified
- **CJS tool (bgsd-tools.cjs) integration**: The CJS CLI tool uses the separate `src/lib/db.js` + `src/lib/planning-cache.js` path (unchanged). It populates the same `.planning/.cache.db` database. Both ESM plugin and CJS tool share the same SQLite file — queries from either will see the same data.
- **Ready for Phase 120**: Query integration can now build on top of the wired parsers — SQLite data is being populated by both paths
- **No blockers**: All tests pass, build validates, ESM requirement constraint met

---
*Phase: 119-parser-integration-planning-tables*
*Completed: 2026-03-14*

## Self-Check: PASSED

- ✅ `src/plugin/lib/db-cache.js` — exists
- ✅ `src/plugin/parsers/roadmap.js` — exists, SQLite-first implemented
- ✅ `src/plugin/parsers/plan.js` — exists, SQLite-first implemented
- ✅ `src/plugin/parsers/index.js` — exists, invalidateAll + invalidatePlanningCache
- ✅ `src/plugin/project-state.js` — exists, eager mtime check implemented
- ✅ Commit `3d04a05` (Task 1) — exists in git log
- ✅ Commit `c5a74be` (Task 2) — exists in git log
- ✅ Commit `9c16343` (Task 3) — exists in git log
- ✅ Commit `6fc4cbd` (metadata) — exists in git log
- ✅ 169 tests pass (plugin + plan + db suites), 0 failures
- ✅ `npm run build` succeeds, ESM validation: 0 bare require() calls
- ✅ SQLite populated: ROADMAP.md file_cache entry present, 6 phases, 23 requirements stored
