---
phase: 0122-decision-rules
plan: 01
subsystem: database
tags: [sqlite, decision-rules, model-profiles, planning-cache, cjs, esm]
requires:
  - phase: 0121-memory-store
    provides: PlanningCache with SQLite backing and migration infrastructure
provides:
  - MIGRATIONS[3] (migration_v4) creating model_profiles table with auto-seeded defaults
  - PlanningCache CJS methods: getModelProfile, storeModelProfile, getModelProfiles, seedModelDefaults
  - ESM db-cache.js PlanningCache: matching model profile methods, schema bumped to v4
  - 5 new decision functions: resolveModelSelection, resolveVerificationRouting, resolveResearchGate, resolveMilestoneCompletion, resolveCommitStrategy
  - Expanded resolvePlanExistenceRoute with ready/blocked-deps/missing-context return values
  - DECISION_REGISTRY at 17 rules (was 12)
affects:
  - plan 02 of this phase (callers migrated from static MODEL_PROFILES to resolveModelSelection)
  - any workflow that calls resolvePlanExistenceRoute (new return values: blocked-deps, ready, missing-context)

tech-stack:
  added: []
  patterns:
    - "SQLite-backed decision: try DB lookup first, fall back to static constant"
    - "Migration seeding via INSERT OR IGNORE with '__defaults__' cwd sentinel"
    - "Compound return values { run, depth }, { ready, action }, { granularity, prefix } for multi-field decisions"

key-files:
  created: []
  modified:
    - src/lib/db.js
    - src/lib/planning-cache.js
    - src/plugin/lib/db-cache.js
    - src/lib/decision-rules.js
    - src/lib/constants.js
    - tests/db.test.cjs
    - tests/decisions.test.cjs
    - tests/enricher-decisions.test.cjs
    - tests/planning-cache.test.cjs

key-decisions:
  - "model_profiles uses multi-column schema (quality_model, balanced_model, budget_model, override_model) instead of one row per tier — simpler, matches static table shape"
  - "Migration v4 seeds defaults using '__defaults__' CWD sentinel so defaults are inserted once globally regardless of project"
  - "resolvePlanExistenceRoute backward compat: plan_count > 0 with no has_context → 'has-plans' (old callers unaffected); new callers pass has_context=true to get 'ready'"
  - "PlanningCache lazy require of PlanningCache inside resolveModelSelection to avoid circular dependency at module load time"
  - "Test assertions updated from schema version 3 to 4 (and needs-research to missing-context) per new behavior"

patterns-established:
  - "DB-backed decision rule pattern: try PlanningCache lookup, fall back to static constant, ultimate fallback to hardcoded default"
  - "ESM SCHEMA_V4_SQL superset pattern: full schema in single CREATE IF NOT EXISTS block, version guard bumped atomically"

requirements-completed:
  - DEC-01
  - DEC-02
  - DEC-03
  - DEC-04
  - DEC-05
  - DEC-06

one-liner: "SQLite model_profiles table with auto-seeded defaults, 5 new decision functions (model-selection, verification-routing, research-gate, milestone-completion, commit-strategy), and expanded plan-existence-route with 3 new return values"

duration: 14min
completed: 2026-03-14
---

# Phase 122 Plan 01: Decision Rules — Migration v4 and New Decision Functions Summary

**SQLite model_profiles table with auto-seeded defaults, 5 new decision functions (model-selection, verification-routing, research-gate, milestone-completion, commit-strategy), and expanded plan-existence-route with 3 new return values**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-14T23:07:04Z
- **Completed:** 2026-03-14T23:21:33Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added MIGRATIONS[3] (migration_v4) that creates the `model_profiles` table with `quality_model`, `balanced_model`, `budget_model`, `override_model` columns, and auto-seeds defaults from `MODEL_PROFILES` constants using the `'__defaults__'` CWD sentinel for idempotent global seeding
- Added `getModelProfile`, `storeModelProfile`, `getModelProfiles`, `seedModelDefaults` to both CJS PlanningCache and ESM db-cache.js PlanningCache, with db-cache.js schema bumped to v4
- Implemented 5 new decision functions and expanded `resolvePlanExistenceRoute` to handle `blocked-deps`, `ready`, and `missing-context` return values — DECISION_REGISTRY now has 17 rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Add model_profiles migration and PlanningCache methods** - `725c01e` (feat)
2. **Task 2: Implement 5 new decision functions and expand plan-existence-route** - `ed6f702` (feat)

## Files Created/Modified

- `src/lib/db.js` — Added MIGRATIONS[3] (migration_v4) for model_profiles table with auto-seed
- `src/lib/planning-cache.js` — Added model profile CRUD methods: getModelProfile, storeModelProfile, getModelProfiles, seedModelDefaults
- `src/plugin/lib/db-cache.js` — SCHEMA_V3_SQL → SCHEMA_V4_SQL with model_profiles table, version guard bumped to >= 4, matching ESM methods added
- `src/lib/decision-rules.js` — 5 new functions + expanded resolvePlanExistenceRoute, DECISION_REGISTRY at 17 rules
- `src/lib/constants.js` — MODEL_PROFILES marked @deprecated per Phase 122 plan
- `tests/db.test.cjs` — Schema version assertions updated 3 → 4
- `tests/decisions.test.cjs` — Updated for new plan-existence-route behavior + new test cases
- `tests/enricher-decisions.test.cjs` — Updated for new plan-existence-route behavior + new test cases
- `tests/planning-cache.test.cjs` — Schema version assertion updated 3 → 4

## Decisions Made

- **Multi-column model_profiles schema**: Used `(quality_model, balanced_model, budget_model, override_model)` columns instead of one row per tier — simpler, matches static MODEL_PROFILES shape, avoids multiple rows per agent
- **`'__defaults__'` CWD sentinel**: Seeds once globally using a special CWD value, so default profiles are available before any project-specific seeding occurs; `INSERT OR IGNORE` keeps it idempotent
- **Backward compat for plan-existence-route**: Old callers passing `plan_count > 0` without `has_context` continue to get `has-plans`; only callers that explicitly pass `has_context: true` get the new `ready` value
- **Lazy require for circular dep avoidance**: `resolveModelSelection` lazy-requires PlanningCache inside the function body to avoid circular dependency between decision-rules.js and planning-cache.js at module load

## Deviations from Plan

None - plan executed exactly as written.

The test assertion updates (schema version 3 → 4, `needs-research` → `missing-context`) are expected consequences of the behavioral changes specified in the plan.

## Review Findings

Review skipped — gap closure plan context.

## Issues Encountered

- **Schema version test failures (Rule 1 - Bug)**: After adding MIGRATIONS[3], existing tests asserting `version === 3` failed. Updated 5 test assertions across `db.test.cjs` and `planning-cache.test.cjs` to expect version 4. Straightforward fix — expected consequence of the migration.
- **plan-existence-route test failures (Rule 1 - Bug)**: The new `missing-context` return value replaced `needs-research` for the zero-plans/no-context/no-research case. Updated test assertions in `decisions.test.cjs` and `enricher-decisions.test.cjs` to match new behavior, and added additional test cases covering `blocked-deps`, `ready`, and `missing-context`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Model profiles SQLite infrastructure is ready for Plan 02 which migrates callers from static `MODEL_PROFILES` to `resolveModelSelection`
- All 17 decision rules are registered and evaluatable via `decisions:evaluate` CLI
- 1189 tests pass (was 1179 — added 10 new tests for new behaviors)
- Schema is at version 4 in both CJS migrations and ESM SCHEMA_V4_SQL

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Task commits: 725c01e (Task 1), ed6f702 (Task 2) — both present
- All source files verified on disk
- 1189 tests pass, 0 fail

---
*Phase: 0122-decision-rules*
*Completed: 2026-03-14*
