---
phase: 0113-programmatic-summary-generation
plan: 01
subsystem: cli
tags: [javascript, commonjs, git, summary-generation]

provides:
  - "cmdSummaryGenerate() function for programmatic SUMMARY.md scaffold generation"
  - "summary-generate CLI subcommand in util namespace"
  - "Merge/preserve logic for re-running on existing summaries"
affects: [execute-plan, summary-verification, workflow-integration]

tech-stack:
  added: []
  patterns: [git-data-extraction-pipeline, section-merge-preserve, TODO-marker-detection]

key-files:
  created: [tests/summary-generate.test.cjs]
  modified: [src/commands/misc.js, src/router.js, src/lib/commandDiscovery.js, bin/bgsd-tools.cjs]

key-decisions:
  - "Used phase_number from findPhaseInternal for filenames (preserves zero-padding from directory names)"
  - "Scope matching accepts both 0113-01 and 113-01 forms for backward compat"
  - "Merge/preserve checks for TODO: markers to detect filled vs unfilled sections"
  - "Preservable frontmatter fields include provides, affects, tech-stack, patterns, subsystem, tags"

patterns-established:
  - "TODO marker convention: TODO: section-name (contextual hint text)"
  - "Judgment section detection: absence of TODO: marker means LLM filled the section"

requirements-completed: [SUM-01, SUM-03]
one-liner: "CLI summary:generate command that pre-builds SUMMARY.md from git/plan data, leaving only TODO-marked judgment sections for LLM"

duration: 14min
completed: 2026-03-13
---

# Phase 113 Plan 01: Programmatic Summary Generation — Core Command Summary

**CLI summary:generate command that pre-builds SUMMARY.md from git/plan data, leaving only TODO-marked judgment sections for LLM**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-13T18:43:12Z
- **Completed:** 2026-03-13T18:57:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built `cmdSummaryGenerate()` pipeline: resolve phase → parse PLAN.md → extract git commits → compute diffs → infer frontmatter → generate markdown → merge/preserve
- Implemented section-level merge/preserve: re-running on existing SUMMARY.md preserves LLM-filled judgment sections while refreshing data sections
- 20 contract tests covering happy path, merge/preserve, no-commits edge case, missing plan error, scope normalization, and CLI integration — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement cmdSummaryGenerate in misc.js with router registration** - `22315af` (feat)
2. **Task 2: Add contract tests for summary generation and edge cases** - `8f2106e` (test)

## Files Created/Modified
- `src/commands/misc.js` - Added cmdSummaryGenerate(), mergeSummary(), parseSummarySections(), subsystem/tag inference maps
- `src/router.js` - Added summary-generate subcommand routing in util namespace
- `src/lib/commandDiscovery.js` - Registered summary-generate in routerImplementations.util
- `tests/summary-generate.test.cjs` - 20 contract tests across 6 test suites
- `bin/bgsd-tools.cjs` - Rebuilt bundle with new command

## Decisions Made
- Used `phase_number` from `findPhaseInternal` (e.g. "0112") rather than `normalizePhaseName` for filenames — preserves zero-padding matching the actual directory structure
- Scope matching accepts both `0113-01` and `113-01` commit scopes for backward compatibility with varying commit conventions
- Merge/preserve logic detects filled sections by checking absence of `TODO:` markers — simple and reliable
- Preservable frontmatter fields (provides, affects, tech-stack, patterns, subsystem, tags, key-decisions, one-liner) are preserved when non-empty and non-TODO; data fields (key-files, duration, completed) are always regenerated

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `util:summary-generate` is fully functional and tested
- Ready for workflow integration: execute-plan workflow can call this command after tasks complete to pre-build SUMMARY.md scaffold
- The LLM filling step needs only 5-6 judgment sections (one-liner, accomplishments, decisions, deviations, issues, next-phase-readiness) instead of authoring the entire document

## Self-Check: PASSED

- [x] `tests/summary-generate.test.cjs` exists
- [x] `src/commands/misc.js` modified with cmdSummaryGenerate
- [x] `src/router.js` modified with routing
- [x] `src/lib/commandDiscovery.js` modified with registration
- [x] Commit `22315af` exists (Task 1)
- [x] Commit `8f2106e` exists (Task 2)
- [x] 20/20 tests pass
- [x] Full test suite: 421 pass, 652 pre-existing fail (0 regressions)

---
*Phase: 0113-programmatic-summary-generation*
*Completed: 2026-03-13*
