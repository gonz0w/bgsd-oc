---
phase: 119-parser-integration-planning-tables
verified: 2026-03-14T17:45:00Z
verifier: claude-sonnet-4-6
status: passed
score: 9/9
re_verification: false
gaps: []
---

# Phase 119 Verification Report

**Phase Goal:** Parsed planning data (phases, plans, tasks, requirements) persists in SQLite across invocations — queries replace markdown re-parsing on cache hit

**Overall Status:** ✓ PASSED  
**Score:** 9/9 must-haves verified  
**Requirements:** TBL-01 ✓ · TBL-02 ✓ · TBL-03 ✓ · TBL-04 ✓

---

## Goal Achievement — Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MIGRATIONS[1] creates all 7 planning tables with correct columns and foreign keys | ✓ VERIFIED | `getSchemaVersion()` returns 2; `sqlite_master` shows `file_cache, milestones, phases, progress, plans, tasks, requirements` — confirmed by live test |
| 2 | `PlanningCache.checkFreshness(filePath)` returns `fresh`/`stale`/`missing` based on mtime comparison | ✓ VERIFIED | Live tests: `missing` → `fresh` after `updateMtime` → `stale` after file touch — all correct |
| 3 | `storeRoadmap` + `getPhases` round-trip returns correct phase data (TBL-01) | ✓ VERIFIED | Round-trip test: phases stored → `getPhases` returns array with correct fields |
| 4 | `storePlan` + `getPlan` round-trip returns plan with tasks and JSON-serialized frontmatter (TBL-02) | ✓ VERIFIED | Round-trip test: plan+tasks stored → `getPlan` returns row with `tasks` array and `frontmatter_json` |
| 5 | Requirements extracted from roadmap section text and queryable by REQ-ID (TBL-03) | ✓ VERIFIED | `storeRoadmap` with `section: "**Requirements**: TBL-01, TBL-02"` → `getRequirement('TBL-01', cwd)` returns correct row |
| 6 | Mtime change triggers stale detection causing re-parse (TBL-04) | ✓ VERIFIED | File touched with future mtime → `checkFreshness` returns `stale`; `invalidateFile` clears cache |
| 7 | `parseRoadmap(cwd)` is SQLite-first — checks freshness before reading ROADMAP.md | ✓ VERIFIED | `roadmap.js` line 259: `planningCache.checkFreshness(roadmapPath)` before `readFileSync` |
| 8 | `parsePlan(planPath)` is SQLite-first with write-through on miss/stale | ✓ VERIFIED | `plan.js` lines 231–274: freshness check → cache hit path → markdown fallback → `storePlan` write-through |
| 9 | MapDatabase backend causes all PlanningCache reads to return null (transparent miss) | ✓ VERIFIED | `getDb('/nonexistent')` → `backend: map` → all query methods return null; all store methods no-op |

---

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| `src/lib/db.js` — MIGRATIONS[1] appended | ✓ | ✓ (183 lines DDL: 7 tables + 7 indexes) | ✓ (called by `_runMigrations` at startup) | ✓ VERIFIED |
| `src/lib/planning-cache.js` — PlanningCache class | ✓ | ✓ (613 lines; 15 methods: mtime, store, query) | ✓ (imported by plugin parsers via db-cache.js) | ✓ VERIFIED |
| `src/plugin/lib/db-cache.js` — ESM-native adapter | ✓ | ✓ (474 lines; SQLiteBackend + MapBackend + PlanningCache) | ✓ (imported by roadmap.js, plan.js, index.js, project-state.js) | ✓ VERIFIED |
| `src/plugin/parsers/roadmap.js` — SQLite-first | ✓ | ✓ (403 lines; SQLite check before readFileSync; buildRoadmapFromCache helper) | ✓ (imports `getDb, PlanningCache` from db-cache.js) | ✓ VERIFIED |
| `src/plugin/parsers/plan.js` — SQLite-first | ✓ | ✓ (411 lines; SQLite check before readFileSync; _buildPlanFromCache helper) | ✓ (imports `getDb, PlanningCache` from db-cache.js) | ✓ VERIFIED |
| `src/plugin/parsers/index.js` — invalidateAll + invalidatePlanningCache | ✓ | ✓ (63 lines; clearForCwd called in invalidateAll) | ✓ (imports PlanningCache from db-cache.js) | ✓ VERIFIED |
| `src/plugin/project-state.js` — eager mtime check | ✓ | ✓ (152 lines; `_eagerMtimeCheck` called at startup) | ✓ (calls `cache.checkAllFreshness`, `cache.invalidateFile`) | ✓ VERIFIED |
| `tests/planning-cache.test.cjs` — 71-test suite | ✓ | ✓ (1061 lines; 8 groups covering schema, mtime, store/query, invalidation, fallback) | ✓ (imports `./src/lib/db` and `./src/lib/planning-cache` directly) | ✓ VERIFIED |

---

## Key Link Verification

| Link | Status | Evidence |
|------|--------|----------|
| `MIGRATIONS[1]` called by `_runMigrations` at startup — tables auto-created | ✓ WIRED | `db.js:199-232`: loop over `MIGRATIONS[i](dbInstance._db)`; `getSchemaVersion()=2` on fresh DB |
| `PlanningCache` constructor takes db from `getDb(cwd)` — works with both backends | ✓ WIRED | Constructor `new PlanningCache(db)` used in both `db.js` (CJS) and `db-cache.js` (ESM) paths |
| `file_cache` table links `file_path` to `mtime_ms` — checked before serving cached data | ✓ WIRED | `planning-cache.js:79-91`: `file_cache_get` statement used in `checkFreshness` before all query methods |
| `phases` table stores roadmap phases — populated by `storeRoadmap`, queried by `getPhases` | ✓ WIRED | Phases key has `(number, cwd)` PK; verified via live round-trip test |
| `requirements` table stores REQ-ID → phase mapping — extracted from section text | ✓ WIRED | `_extractRequirementsFromPhases` parses `**Requirements**: TBL-01, ...` pattern; `getRequirement('TBL-01', cwd)` returns correct row |
| `plans` table with `tasks` FK CASCADE — `storePlan` populates both, `getPlan` JOINs them | ✓ WIRED | `planning-cache.js:154-165`: `FOREIGN KEY (plan_path) REFERENCES plans(path) ON DELETE CASCADE`; `getPlan` LEFT JOINs tasks |
| ESM parsers import from `db-cache.js` (not CJS `db.js`) — avoids `__require` failure | ✓ WIRED | `roadmap.js:3`, `plan.js:3`, `index.js:19`, `project-state.js:12`: all `import ... from '../lib/db-cache.js'` |
| `getProjectState` calls `_eagerMtimeCheck` before parsers — stale entries invalidated upfront | ✓ WIRED | `project-state.js:110`: `_eagerMtimeCheck(resolvedCwd, phaseNumForCheck)` before `parseRoadmap` call |
| `invalidateAll(cwd)` calls `cache.clearForCwd(cwd)` — clears both Map and SQLite caches | ✓ WIRED | `index.js:37-44`: `cache.clearForCwd(cwd)` after all `invalidate*` calls |
| `clearForCwd(cwd)` in PlanningCache removes all cwd-scoped rows | ✓ WIRED | `planning-cache.js:524-558`: DELETEs from all 5 tables + file_cache LIKE query |

---

## Requirements Coverage

| Req ID | Description | In PLAN frontmatter | In REQUIREMENTS.md | Status |
|--------|-------------|---------------------|--------------------|--------|
| TBL-01 | Phases queryable from SQLite (cache hit path) | ✓ (Plans 01, 02, 03) | ✓ (line 12, `[x]`) | ✓ Complete |
| TBL-02 | Plans queryable from SQLite (cache hit path) | ✓ (Plans 01, 02, 03) | ✓ (line 13, `[x]`) | ✓ Complete |
| TBL-03 | Requirements queryable by REQ-ID from SQLite | ✓ (Plans 01, 02, 03) | ✓ (line 14, `[x]`) | ✓ Complete |
| TBL-04 | Mtime-based invalidation detects file changes | ✓ (Plans 01, 02, 03) | ✓ (line 15, `[x]`) | ✓ Complete |

All 4 phase requirements referenced in all 3 PLANs. All marked `[x]` complete in REQUIREMENTS.md. Traceability table (REQUIREMENTS.md lines 65-68) confirms Phase 119 ownership.

---

## Anti-Patterns Scan

| File | Pattern | Category | Notes |
|------|---------|----------|-------|
| All 8 key files | No TODO/FIXME/PLACEHOLDER | ℹ Info | Clean — zero instances found |
| `roadmap.js` write-through | Does not pass explicit `requirements:` to `storeRoadmap` | ⚠ Warning | Requirements extracted via `_extractRequirementsFromPhases` from `section` text. Only captures requirement IDs, not descriptions. Acceptable for TBL-03 (queries by REQ-ID work correctly). Description field is null for requirements stored this way. |
| `plan.js` cache hit shape | `context`, `verification`, `successCriteria`, `output` are `null` on cache hit | ⚠ Warning | By design (documented in SUMMARY.md). Consumers needing these fields will get them after first markdown parse (in-memory cache stores full object). Not a regression risk. |
| Live `.cache.db` | One plan entry stored with `cwd="."` (relative) | ⚠ Warning | Test artifact from early manual run using `bgsd-tools.cjs` with relative cwd. Both `db.js` and `db-cache.js` now use `path.resolve(cwd)`, so production runs are unaffected. The stale entry doesn't cause errors (just a cache miss on that key). Clears on next `invalidateAll`. |

---

## Human Verification — Not Required

All Phase 119 deliverables are programmatically verifiable:
- Schema: queried via `sqlite_master`
- Cache hit path: traced via code reading + manual round-trip tests
- Mtime invalidation: exercised with real `fs.utimesSync` modifications
- Test suite: 71/71 tests pass

No visual, real-time, or external service behavior to verify.

---

## Test Coverage

| Test Group | Tests | Result |
|------------|-------|--------|
| Group 1: Schema Migration | 9 | ✓ 9/9 pass |
| Group 2: PlanningCache Construction | 3 | ✓ 3/3 pass |
| Group 3: Mtime Invalidation | 9 | ✓ 9/9 pass |
| Group 4: Roadmap Store + Query Round-Trip (TBL-01) | 10 | ✓ 10/10 pass |
| Group 5: Plan Store + Query Round-Trip (TBL-02) | 12 | ✓ 12/12 pass |
| Group 6: Requirements Store + Query (TBL-03) | 9 | ✓ 9/9 pass |
| Group 7: Invalidation End-to-End (TBL-04) | 5 | ✓ 5/5 pass |
| Group 8: MapDatabase Fallback | 14 | ✓ 14/14 pass |
| **Total** | **71** | **✓ 71/71 pass** |

Full suite (`npm test`): 1084/1086 pass, 2 fail — pre-existing race condition in `codebase.test.cjs` and `intent.test.cjs` under `--test-concurrency=8`. Both pass at concurrency=1. **Not caused by Phase 119** (those test files were last modified in commits `58d84c0` and `11b98cb`, neither from this phase).

---

## Gaps Summary

**No gaps found.** All 9 observable truths verified. All 8 artifacts exist, are substantive, and are wired. All 4 requirements (TBL-01 through TBL-04) implemented, tested, and marked complete in REQUIREMENTS.md. Two anti-pattern warnings are by-design behaviors documented in SUMMARYs, not blocking issues.

Phase 119 goal is **achieved**: parsed planning data (phases, plans, tasks, requirements) persists in SQLite across invocations via PlanningCache, and queries replace markdown re-parsing on cache hit via the SQLite-first parser integration.

---

*Verified by: claude-sonnet-4-6*  
*Date: 2026-03-14*  
*Method: Code inspection + live round-trip tests + test suite execution*
