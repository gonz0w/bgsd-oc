---
phase: 70-test-debt-cleanup
plan: 01
subsystem: testing
tags: [router, codebase-impact, config-migrate, test-coverage, namespace-routing]

# Dependency graph
requires:
  - phase: 69-skills-architecture
    provides: "Skills architecture with updated router namespace routing"
provides:
  - "Fixed router argument passing for codebase ast/exports/complexity"
  - "Aligned codebase-impact output format between codebase.js and features.js"
  - "Updated test assertions for namespace:command syntax"
  - "Updated test-coverage extraction for namespace router patterns"
affects: [70-test-debt-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: ["namespace:command routing in router.js", "if/else chain command extraction"]

key-files:
  created: []
  modified:
    - src/router.js
    - src/commands/codebase.js
    - src/commands/features.js
    - bin/gsd-tools.test.cjs
    - bin/gsd-tools.cjs

key-decisions:
  - "Removed dead codebase-impact --fixed-strings test — grep path unreachable via codebase.js route"
  - "Used profiler.js instead of frontmatter.js for 'few dependents' risk level test — frontmatter.js now has >10 dependents"
  - "Updated test-coverage extraction to scan if/else chains and namespace patterns, not just switch/case"

patterns-established:
  - "namespace:command syntax required for all init commands in tests"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04]

# Metrics
duration: 7min
completed: 2026-03-09
---

# Phase 70 Plan 01: Source Bug Fixes and Test Assertion Updates Summary

**Fixed router argument passing (restArgs[1] to restArgs.slice(1)) for codebase ast/exports/complexity, aligned codebase-impact output format with files_analyzed/total_dependents/overall_risk/source fields, and updated 28+ stale test assertions for namespace:command syntax**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-09T00:34:01Z
- **Completed:** 2026-03-09T00:41:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed router passing string instead of array to codebase ast/exports/complexity handlers (15 tests now pass)
- Aligned codebase.js cmdCodebaseImpact output format to match features.js (9 tests now pass)
- Updated all init command tests to use namespace:command syntax (4 compact/init tests pass)
- Fixed config-migrate test with missing RAG/ytdlp/nlm/mcp schema keys (5 tests pass)
- Updated debug logging tests to use namespace:command syntax (4 tests pass)
- Removed dead --fixed-strings test (grep path unreachable in codebase.js)
- Updated test-coverage command extraction for namespace router patterns (2 tests pass)
- Fixed risk level test to use a file with genuinely few dependents (2 tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix router bugs and codebase-impact output format** - `6dee306` (fix)
2. **Task 2: Fix config-migrate, compact/init, test-coverage, and codebase context test assertions** - `ca3f168` (fix)

## Files Created/Modified
- `src/router.js` - Changed restArgs[1] to restArgs.slice(1) for ast/exports/complexity routes
- `src/commands/codebase.js` - Updated cmdCodebaseImpact to return files_analyzed, total_dependents, overall_risk, source fields
- `src/commands/features.js` - Updated cmdTestCoverage to extract commands from if/else chains and namespace routing
- `bin/gsd-tools.test.cjs` - Updated config-migrate, compact/init, debug logging, shell sanitization, risk level tests
- `bin/gsd-tools.cjs` - Rebuilt bundle with all source fixes

## Decisions Made
- Removed dead codebase-impact --fixed-strings test rather than trying to make it work — the grep fallback path in features.js is unreachable since the router sends codebase impact to codebase.js which always uses the dependency graph
- Used src/lib/profiler.js for the "few dependents" risk level test since frontmatter.js now has >10 dependents (imported by 12 modules), making it "high" risk
- Updated test-coverage command extraction to handle both switch/case and if/else chain patterns from the namespace router

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan / test debt cleanup

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All targeted test groups show 0 failures
- Ready for Plan 02 (extract-sections, context-budget baseline, and remaining test failures)
- Full test suite validation deferred to Plan 02

---
*Phase: 70-test-debt-cleanup*
*Completed: 2026-03-09*
