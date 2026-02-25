---
phase: 20-structured-requirements
plan: 02
subsystem: verification
tags: [assertions, verification, traceability, per-assertion, coverage, gap-detection]

# Dependency graph
requires:
  - phase: 20-structured-requirements
    provides: "parseAssertionsMd parser and ASSERTIONS.md template"
provides:
  - "Per-assertion pass/fail in verify requirements output"
  - "Test-command column parsing from traceability table"
  - "Assertion chain display in trace-requirement"
  - "Failed must-have gap_description for --gaps workflow"
affects: [20-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid verification: file/cli assertions auto-checked, behavior/api need human review"
    - "Backward-compatible output extension: new fields added alongside existing fields"
    - "Cross-module import: features.js imports parseAssertionsMd from verify.js"

key-files:
  created: []
  modified:
    - "src/commands/verify.js"
    - "src/commands/features.js"
    - "bin/gsd-tools.test.cjs"
    - "bin/gsd-tools.cjs"

key-decisions:
  - "File-type assertions check disk existence via path extraction from assert text"
  - "CLI-type assertions check against known gsd-tools command list"
  - "Behavior/api assertions always need_human — no static verification possible"
  - "Traceability regex uses [^|\\n]* to prevent cross-row matching"
  - "Cross-reference assertion text against plan must_haves.truths for planned/gap detection"

patterns-established:
  - "Per-assertion status: pass | fail | needs_human"
  - "Gap description format: [REQ-ID] Must-have assertion failed: <text>"
  - "Chain format: REQ → N assertions (M must-have) → Plan → VERIFICATION: status"

requirements-completed: [SREQ-03, SREQ-04]

# Metrics
duration: 11min
completed: 2026-02-25
---

# Phase 20 Plan 02: Verification and Traceability Enhancement Summary

**Per-assertion verification in `verify requirements` with test-command parsing, gap detection, and assertion chain display in `trace-requirement` — 13 new tests, 462 total passing**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-25T17:10:19Z
- **Completed:** 2026-02-25T17:22:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Enhanced `verify requirements` with per-assertion pass/fail status when ASSERTIONS.md exists
- Added test-command column parsing from traceability table with validity checking
- Coverage percentage reported for both assertions and test commands
- Failed must-have assertions generate gap_description for --gaps planning workflow
- Enhanced `trace-requirement` with assertion chain: planned/implemented/gap status per assertion
- Human-readable chain field matching CONTEXT.md format
- Full backward compatibility: no ASSERTIONS.md → identical existing behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance verify requirements with per-assertion checking** - `60942e7` (feat)
2. **Task 2: Enhance trace-requirement with assertion chain** - `4b88fbc` (feat)

## Files Created/Modified
- `src/commands/verify.js` - Enhanced cmdVerifyRequirements with per-assertion checking, test-command parsing, coverage stats
- `src/commands/features.js` - Enhanced cmdTraceRequirement with assertion chain, imported parseAssertionsMd
- `bin/gsd-tools.test.cjs` - 13 new tests (8 for verify requirements, 5 for trace-requirement)
- `bin/gsd-tools.cjs` - Built bundle (518KB / 525KB budget)

## Decisions Made
- File-type assertions extract path patterns from assertion text and check disk existence across cwd, .planning/, and templates/ directories
- CLI-type assertions match against a curated list of 25+ known gsd-tools commands
- Behavior and API assertions always return `needs_human` status — they require agent evaluation, not static checks
- Traceability regex uses `[^|\n]*` (not `[^|]*`) to prevent cross-row matching in markdown tables — this also fixed a latent bug in the pre-existing test
- Cross-referencing uses fuzzy substring matching (first 30 chars) between assertion text and plan must_haves.truths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed traceability table regex cross-row matching**
- **Found during:** Task 1 (implementing test-command column parsing)
- **Issue:** Original enhanced regex `/[^|]*/` could match across newlines, causing `| DX-01 | Phase 01 |\n| DX-02 |` to be parsed as a single multi-column row
- **Fix:** Changed `[^|]*` to `[^|\n]*` in all three capture groups
- **Files modified:** src/commands/verify.js
- **Verification:** Pre-existing test "detects unaddressed req when phase has no summaries" now passes
- **Committed in:** 60942e7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Critical fix — without it, existing tests would have broken. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Per-assertion verification is fully operational for Plan 03's planner integration
- parseAssertionsMd is now consumed by both verify.js and features.js
- Gap descriptions are ready to feed into --gaps planning workflow
- Chain format provides the visibility needed for planner to read assertion status
- Bundle at 518KB leaves 7KB headroom for Plan 03 additions

---
*Phase: 20-structured-requirements*
*Completed: 2026-02-25*
