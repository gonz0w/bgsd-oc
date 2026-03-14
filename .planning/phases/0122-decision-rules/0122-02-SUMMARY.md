---
phase: 0122-decision-rules
plan: 02
subsystem: cli
tags: [decision-rules, enricher, model-selection, sqlite, testing, cjs]
provides:
  - command-enricher.js populates agent_type, model_profile, db, files_modified_count, task_count, phase_has_external_deps, deps_complete, phases_total, phases_complete, plan_type, is_tdd before evaluateDecisions
  - resolveModelInternal in helpers.js delegates to model-selection decision rule (SQLite-backed) with static fallback
  - routeTask in orchestration.js uses model-selection rule with static fallback
  - 61 new tests for all 5 new + 1 expanded decision rules (contract + edge cases + integration)
affects:
  - phase 123 and any workflow that calls evaluateDecisions (17 rules now evaluated in-process)
  - any caller of resolveModelInternal (now tries SQLite model_profiles first)
  - any caller of routeTask (now tries model-selection decision rule first)
requires:
  - phase: 0122-01
    provides: 5 new decision functions + expanded plan-existence-route + model_profiles SQLite table

tech-stack:
  added: []
  patterns:
    - "Command-to-agent mapping: COMMAND_TO_AGENT object maps command names to bgsd-* agent type strings"
    - "Enricher inputs pattern: each decision rule gets its inputs populated in a try/catch block before evaluateDecisions"
    - "Decision rule consumer migration: try rule first, catch and fall back to static lookup"

key-files:
  created: []
  modified:
    - src/plugin/command-enricher.js
    - src/lib/helpers.js
    - src/lib/orchestration.js
    - tests/decisions.test.cjs
    - tests/enricher-decisions.test.cjs
    - bin/bgsd-tools.cjs

key-decisions:
  - "COMMAND_TO_AGENT static map in enricher (not dynamic lookup) — simpler, zero error risk, covers all known bgsd-* commands"
  - "routeTask signature unchanged for callers — cwd parameter added as optional third arg to avoid breaking existing callers"
  - "enricher tries getDb() for model-selection rule db handle — wrapped in try/catch so rule gracefully falls back to static if db unavailable"

patterns-established:
  - "Decision rule consumer migration pattern: try rule, check result.value, fall back on error or missing value"

requirements-completed:
  - DEC-01
  - DEC-02
  - DEC-03
  - DEC-04
  - DEC-05
  - DEC-06

one-liner: "Enricher wired to populate all 6 decision rule inputs, model consumers migrated to decision-rule path, 61 new tests covering all new rules with contract + edge case + integration coverage"

duration: 17min
completed: 2026-03-14
---

# Phase 122 Plan 02: Decision Rules — Enricher Integration and Test Coverage Summary

**Enricher wired to populate all 6 decision rule inputs, model consumers migrated to decision-rule path, 61 new tests covering all new rules with contract + edge case + integration coverage**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-14T23:24:40Z
- **Completed:** 2026-03-14T23:41:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added 110+ lines of enrichment inputs in `command-enricher.js`: COMMAND_TO_AGENT map for agent_type derivation, db handle pass-through, files_modified_count and task_count from first incomplete plan frontmatter, phase_has_external_deps heuristic from phase goal text, deps_complete from plan frontmatter depends_on + roadmap phase status, phases_total and phases_complete from roadmap, plan_type and is_tdd from plan frontmatter — all wrapped in try/catch so enricher stays non-fatal
- Migrated `resolveModelInternal` in helpers.js to try model-selection decision rule first (SQLite-backed via getDb) with lazy require to avoid circular deps, falling back to static MODEL_PROFILES; migrated `routeTask` in orchestration.js similarly with optional `cwd` parameter
- Added 61 new tests across decisions.test.cjs and enricher-decisions.test.cjs: full contract checks + edge cases + compound return shape validation for all 5 new rules + expanded plan-existence-route; 5 new `evaluateDecisions` integration groups verifying new rules fire when their inputs are present; registry completeness updated to >= 17

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire enricher inputs for new decision rules** - `698a67e` (feat)
2. **Task 2: Add comprehensive test coverage for new decision rules** - `b781b11` (test)

## Files Created/Modified

- `src/plugin/command-enricher.js` — Added ~119 lines of enrichment inputs for all 6 new/expanded decision rules
- `src/lib/helpers.js` — resolveModelInternal migrated to use model-selection decision rule with SQLite fallback
- `src/lib/orchestration.js` — routeTask migrated to use model-selection decision rule with static fallback
- `tests/decisions.test.cjs` — Added 7 new describe blocks (resolveModelSelection, resolveVerificationRouting, resolveResearchGate, resolvePlanExistenceRoute expanded, resolveMilestoneCompletion, resolveCommitStrategy); updated registry test to >= 17
- `tests/enricher-decisions.test.cjs` — Added 5 new describe blocks for evaluateDecisions integration tests of new rules
- `bin/bgsd-tools.cjs` — Rebuilt from source

## Decisions Made

- **COMMAND_TO_AGENT static map**: Used a static `COMMAND_TO_AGENT` object in the enricher rather than dynamic agent type inference — covers all known commands, simpler to read and test, zero runtime error risk
- **routeTask cwd parameter**: Added optional `cwd` as third parameter to `routeTask` to support the model-selection rule lookup without breaking existing callers (backward compatible — default `process.cwd()`)
- **Enricher db handle**: Pass `getDb(resolvedCwd)` as `enrichment.db` for the model-selection rule — wrapped in inner try/catch so if db is unavailable the enricher still succeeds and the rule falls back gracefully to static
- **deps_complete heuristic**: Uses `roadmap.getPhase().status !== 'complete'` check for each depends_on phase number — simple, works with roadmap facade already available in the enricher

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan context.

## Issues Encountered

None - all implementations worked as expected on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 122 complete: all 17 decision rules implemented (Plan 01), wired to enricher (Plan 02), and fully tested
- DECISION_REGISTRY has 17 rules across 5 categories; evaluateDecisions fires in-process during every enricher invocation
- model-selection rule is now the primary path for resolveModelInternal and routeTask — consumers can override via SQLite model_profiles table
- Phase 123 can proceed with full confidence that all decision rules are available and correct

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Task commits: 698a67e (Task 1), b781b11 (Task 2) — both present
- All source files verified on disk
- 202 tests pass in decision test files (0122-01 had 141)
- Zero failures in full test suite

---
*Phase: 0122-decision-rules*
*Completed: 2026-03-14*
