# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-14)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** Phase 122 — Decision Rules

## Current Position

**Phase:** 122 of 123 (Decision Rules)
**Current Plan:** Plan 01 complete (1 of 2)
**Status:** In Progress
**Last Activity:** 2026-03-14

Progress: [█████████░] 87%

## Performance Metrics

**Velocity:**
- Total plans completed: 220 (v12.0 Phase 122 Plan 01)
- Average duration: ~15 min/plan
- Total execution time: ~38 hours

**Recent Trend:**
- v12.0 Phase 119 Plan 03: 16 min, 2 tasks, 2 files (71 tests)
- v12.0 Phase 120 Plan 01: 20 min, 2 tasks, 4 files (1108 tests)
- v12.0 Phase 120 Plan 02: 7 min, 2 tasks, 4 files (1160 tests)
- v12.0 Phase 121 Plan 01: 5 min, 2 tasks, 6 files (1160 tests)
- v12.0 Phase 121 Plan 02: 27 min, 3 tasks, 5 files (1160 tests)
- v12.0 Phase 121 Plan 03: 17 min, 2 tasks, 2 files (1179 tests)
- v12.0 Phase 122 Plan 01: 14 min, 2 tasks, 9 files (1189 tests)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v12.0 Phase 118]: node:sqlite PRAGMA busy_timeout returns {timeout:N} not {busy_timeout:N} — verify with correct key
- [v12.0 Phase 118]: PRAGMA user_version works inside explicit transactions on current Node.js — no post-COMMIT workaround needed
- [v12.0 Phase 118]: DatabaseSync constructor multi-tier fallback handles Node 22.5–25.x+ differences including defensive mode
- [v11.4]: Test suite fully stabilized — 1008 pass / 0 fail
- [v11.3]: Progressive confidence model (HIGH/MEDIUM/LOW) — never kills LLM escape hatch
- [v11.3]: In-process decision engine via enricher — zero subprocess overhead
- [Phase 118]: All 10 db.test.cjs test groups implemented in one commit — both tasks write to same file, no value in split commits — Avoids incomplete intermediate state; 52 tests cover full FND-01 through FND-04 contract
- [Phase 118 Plan 02]: db init placed after --no-cache flag parsing so BGSD_CACHE_FORCE_MAP is set before getDb() runs; closeAll() called before unlinkSync in cache:clear for safe file deletion
- [Phase 119-01]: Schema version 2: MIGRATIONS[1] appended — db.test.cjs assertions updated from v1 to v2 — MIGRATIONS[1] advances schema from version 1 to 2; tests were checking specific version numbers and needed updating
- [Phase 119-01]: PlanningCache null-return pattern: getPhases/getPlans return null (not []) on miss — callers distinguish no-data from empty — Enables callers to differentiate cache miss from empty result, ensuring parse-on-miss is triggered correctly
- [Phase 119-02]: ESM plugin cannot import CJS db.js — esbuild __require wrapper fails in native ESM; created ESM-native db-cache.js using top-level await dynamic import('node:sqlite')
- [Phase 119-02]: storeRoadmap field name adaptation: parser uses camelCase (planCount) but DB schema uses snake_case (plan_count) — adapt in write-through call
- [Phase 119-02]: raw is null on cache hits (markdown not stored in SQLite) — in-memory Map cache retains full object with raw after first parse in session
- [Phase 119-03]: clearForCwd() added to PlanningCache — was specified in Plan 02 but not implemented; added as blocking deviation since tests require it for end-to-end invalidation flow — Rule 3 blocking fix
- [Phase 119-03]: PlanningCache test isolation uses string cwds ('/test/project/tblXX') per describe group — avoids SQLite getDb() singleton collision while providing logical scoping across groups
- [Phase 0120]: ensurePlans/ensureSummaryFiles closures provide single-allocation lazy access — parsePlans and listSummaryFiles called exactly once per enrichCommand invocation — Eliminates CPU waste from 3x parsePlans and 3x listSummaryFiles redundant calls per invocation
- [Phase 0120]: PlanningCache.getSummaryCount and getIncompletePlans: SQLite-first enrichment data for plan/summary counts — warm cache serves from SQL, cold falls back to parsers — ENR-02: SQL-backed enrichment eliminates redundant fs operations on warm cache hits
- [Phase 0120]: ProjectState.phaseDir added to frozen facade — enricher uses statePhaseDir to skip redundant resolvePhaseDir call for current phase — Avoids extra readdirSync on the phases directory when current phase is already resolved in getProjectState
- [Phase 0120]: performance.now() + Date.now() fallback for _enrichment_ms timing; setTimeout(0) for background warm-up — Sub-millisecond precision needed for ENR-03 measurement; setTimeout(0) is clear fire-and-forget pattern
- [Phase 0121-01]: Schema advanced from v2 to v3 — MIGRATIONS[2] creates 4 memory_* tables; db-cache.js SCHEMA_V2_SQL renamed to SCHEMA_V3_SQL with same memory tables; version guard bumped to >= 3
- [Phase 0121-01]: data_json stores full JSON entry in memory tables for lossless round-tripping; searchable columns (summary, text, phase, category) extracted for LIKE queries — no FTS5 per REQUIREMENTS.md
- [Phase 0121-01]: migrateMemoryStores() idempotency check: COUNT(*) on memory_decisions for cwd — if any exist, skip entire migration
- [Phase 0121]: JSON canonical, SQLite best-effort dual-write — failures log but never roll back JSON — Sacred data integrity requires JSON as source of truth; SQLite is an acceleration layer
- [Phase 0121]: searchMemory extended to support null query (fetch all for cwd) for init.js reads without search term — cmdInitMemory needs to fetch recent decisions/lessons without a search query
- [Phase 0121-03]: SQLite test isolation uses os.tmpdir() prefix dirs + closeAll() before getDb() in beforeEach — avoids getDb() singleton collision; PlanningCache direct API for unit tests, CLI for end-to-end verification
- [Phase 0122-01]: model_profiles uses multi-column schema (quality_model, balanced_model, budget_model, override_model) with '__defaults__' CWD sentinel for idempotent global seeding — Simpler than one-row-per-tier, matches static MODEL_PROFILES shape
- [Phase 0122-01]: resolvePlanExistenceRoute backward compat: plan_count > 0 without has_context returns 'has-plans'; with has_context=true returns 'ready' — Old callers unaffected; new behavior only triggered with explicit new inputs

### Roadmap Evolution

- 6 phases (118-123) mapped from 21 requirements across 6 categories
- Phase 121 (Memory Store) depends only on 118 — can potentially parallelize with 119/120

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

**Last session:** 2026-03-14T23:23:16.639Z
**Stopped at:** Completed 0122-01-PLAN.md
**Next step:** Phase 122 — advance to next phase
