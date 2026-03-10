---
phase: 77-validation-engine-modernization
plan: 02
subsystem: infra
tags: [plugin, validation, valibot, zod, performance]

# Dependency graph
requires:
  - phase: 77-01
    provides: adapter seam, flag-based engine toggle, normalized validation envelopes
provides:
  - Migrated remaining plugin tools to adapter-backed argument validation
  - Cross-engine parity coverage for coercion, enum, and missing/invalid arg envelopes
  - VALD-01 benchmark evidence comparing fallback and modern validation modes
affects: [plugin-tools, validation, benchmarks]

# Tech tracking
tech-stack:
  added: []
  patterns: [adapter-backed tool argument schemas, debug shadow-compare diagnostics, dual-mode benchmark capture]

key-files:
  created: [.planning/phases/77-validation-engine-modernization/77-02-SUMMARY.md]
  modified: [src/plugin/tools/bgsd-status.js, src/plugin/tools/bgsd-context.js, src/plugin/tools/bgsd-validate.js, src/plugin/tools/bgsd-progress.js, src/plugin/validation/adapter.js, tests/plugin.test.cjs, baseline.cjs]

key-decisions:
  - "Route all remaining plugin tool arg parsing through shared adapter schemas to preserve contract parity across engines."
  - "Normalize valibot enum/missing-key errors to zod-style option envelopes for cross-engine response consistency."
  - "Measure VALD-01 using repeated plugin validation calls under explicit legacy/modern env flags."

patterns-established:
  - "Tool args use createObjectSchema + validateArgs, not direct in-tool zod schemas"
  - "Parity tests execute each risky argument path in default and forced fallback modes"

requirements-completed: [VALD-01, VALD-02, VALD-03]
one-liner: "Migrated remaining plugin tools to adapter validation with cross-engine contract parity tests and recorded a 34.48% faster VALD-01 modern validation run versus legacy fallback."

# Metrics
duration: 12 min
completed: 2026-03-10
---

# Phase 77 Plan 02: Validation Engine Modernization Summary

**Migrated remaining plugin tools to adapter validation with cross-engine contract parity tests and recorded a 34.48% faster VALD-01 modern validation run versus legacy fallback.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T00:34:11Z
- **Completed:** 2026-03-10T00:46:40Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Completed adapter-backed validation migration for `bgsd_status`, `bgsd_context`, `bgsd_validate`, and `bgsd_progress`.
- Expanded plugin parity tests to lock engine-equivalent behavior for coercion, enum handling, and invalid/missing args.
- Validated rollout safety with successful `npm run build`, `npm test`, and legacy/modern baseline captures showing >=10% VALD-01 gain.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate remaining plugin tools to adapter-backed validators** - `7b9d549` (refactor)
2. **Task 2: Expand parity and contract tests for all migrated tool args** - `10c1ce3` (test)
3. **Task 3: Validate performance-safety rollout and build compatibility** - `4f74d6a` (perf)

## Files Created/Modified
- `src/plugin/tools/bgsd-status.js` - Migrated no-arg tool validation through shared adapter.
- `src/plugin/tools/bgsd-context.js` - Migrated task coercion validation and parsed-arg path usage.
- `src/plugin/tools/bgsd-validate.js` - Migrated validator tool args to adapter-backed schema.
- `src/plugin/tools/bgsd-progress.js` - Migrated enum/string arg validation and action handling via parsed args.
- `src/plugin/validation/adapter.js` - Added debug shadow-compare diagnostics and enum envelope normalization parity.
- `tests/plugin.test.cjs` - Added fallback-vs-modern parity coverage for migration risk paths.
- `baseline.cjs` - Added VALD-01 benchmark metric and fixed CLI command paths for current namespaces.

## Benchmark Evidence (VALD-01)

Commands executed:
- `BGSD_DEP_VALIBOT=0 BGSD_DEP_VALIBOT_FALLBACK=1 npm run baseline`
- `BGSD_DEP_VALIBOT=1 BGSD_DEP_VALIBOT_FALLBACK=0 npm run baseline`

Measured from `.planning/baselines/performance-legacy.json` and `.planning/baselines/performance-modern.json`:
- Legacy `vald01_timing_ms`: 58
- Modern `vald01_timing_ms`: 38
- Delta: `((58 - 38) / 58) * 100 = 34.48%` improvement

Threshold check:
- Required improvement: >=10%
- Actual improvement: 34.48%
- Result: PASS

## Decisions Made
- Standardized remaining plugin tool argument handling on adapter schema specs to preserve rollout/rollback behavior through shared engine selection.
- Added valibot message normalization for enum and missing enum keys so response envelopes remain identical in fallback mode.
- Benchmarked a validation hot-path batch under explicit engine env flags to provide requirement-level evidence for VALD-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Baseline script referenced outdated CLI binary/command names**
- **Found during:** Task 3 (Validate performance-safety rollout and build compatibility)
- **Issue:** `npm run baseline` failed because `baseline.cjs` still called `bin/gsd-tools.cjs` and pre-namespace command forms.
- **Fix:** Updated baseline script to call `bin/bgsd-tools.cjs` with current namespaced commands, and added explicit VALD-01 benchmark capture fields.
- **Files modified:** baseline.cjs
- **Verification:** `BGSD_DEP_VALIBOT=0 BGSD_DEP_VALIBOT_FALLBACK=1 npm run baseline` and `BGSD_DEP_VALIBOT=1 BGSD_DEP_VALIBOT_FALLBACK=0 npm run baseline` both succeeded.
- **Committed in:** 4f74d6a

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was required to execute planned benchmark verification and produce VALD-01 evidence; scope remained focused on rollout validation.

## Auth Gates
None.

## Issues Encountered
- Initial parity assertions surfaced cross-engine enum message drift; resolved with adapter message normalization and rerun parity suite.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Remaining validation-engine migration scope in this phase is complete for plan 02 with benchmark evidence captured.
- Ready for subsequent phase validation/safety work with rollback flags retained (`BGSD_DEP_VALIBOT`, `BGSD_DEP_VALIBOT_FALLBACK`).

## Self-Check: PASSED

- Found summary file: `.planning/phases/77-validation-engine-modernization/77-02-SUMMARY.md`
- Found task commits: `7b9d549`, `10c1ce3`, `4f74d6a`
