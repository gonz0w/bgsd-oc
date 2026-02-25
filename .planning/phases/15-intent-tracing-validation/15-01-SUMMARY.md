---
phase: 15-intent-tracing-validation
plan: 01
subsystem: intent
tags: [intent, traceability, parser, cli, gap-detection]

requires:
  - phase: 14-intent-capture-foundation
    provides: parseIntentMd/generateIntentMd parser, intent command family, INTENT.md CRUD
provides:
  - parsePlanIntent() helper for extracting intent section from PLAN.md frontmatter
  - cmdIntentTrace() command with traceability matrix and gap detection
  - intent trace routing with --gaps and --raw flags
  - COMMAND_HELP entries for intent trace
affects: [15-02, 16-workflow-integration]

tech-stack:
  added: []
  patterns: [frontmatter-based intent tracing, traceability matrix, coverage gap detection]

key-files:
  created: []
  modified:
    - src/lib/helpers.js
    - src/commands/intent.js
    - src/router.js
    - src/lib/constants.js
    - bin/gsd-tools.cjs
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Plan intent stored in YAML frontmatter under intent.outcome_ids field (not separate file)"
  - "parsePlanIntent uses extractFrontmatter() for YAML parsing — consistent with existing patterns"
  - "Trace scoped to current milestone's phase range via getMilestoneInfo()"
  - "Gap detection sorts by priority (P1 gaps first) for actionable output"

patterns-established:
  - "Frontmatter intent section: intent.outcome_ids array + rationale string"
  - "Traceability matrix: outcome → plans mapping with coverage percentage"

requirements-completed: [ITRC-01, ITRC-02, ITRC-03]

duration: 5min
completed: 2026-02-25
---

# Phase 15 Plan 01: Intent Tracing Infrastructure Summary

**parsePlanIntent() helper for extracting PLAN.md intent frontmatter, plus cmdIntentTrace() command building traceability matrix from INTENT.md outcomes × PLAN.md intent sections with gap detection and priority-sorted output**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T09:56:46Z
- **Completed:** 2026-02-25T10:02:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `parsePlanIntent()` helper extracts intent.outcome_ids and rationale from PLAN.md YAML frontmatter, handling array and comma-separated formats with DO-\d+ validation
- `cmdIntentTrace()` builds full traceability matrix: scans all PLAN.md files in current milestone, maps each desired outcome to plans addressing it, calculates coverage percentage
- Gap detection flags uncovered outcomes sorted by priority (P1→P3), with --gaps flag for filtered view
- 8 new integration tests covering all behaviors — test count 316 → 324, all pass
- Bundle size: 422KB (within 450KB budget)

## Task Commits

Each task was committed atomically:

1. **Task 1: Plan intent parser and intent trace command** - `13f5801` (feat)
2. **Task 2: Integration tests for intent tracing** - `490f93a` (test)

## Files Created/Modified
- `src/lib/helpers.js` - Added parsePlanIntent() function for extracting intent from PLAN.md frontmatter
- `src/commands/intent.js` - Added cmdIntentTrace() with matrix building, gap detection, human-readable and JSON output
- `src/router.js` - Added intent trace subcommand routing, updated error message
- `src/lib/constants.js` - Added COMMAND_HELP for intent trace, updated intent overview with trace subcommand
- `bin/gsd-tools.cjs` - Rebuilt bundle (422KB)
- `bin/gsd-tools.test.cjs` - Added 8 integration tests for intent trace

## Decisions Made
- Plan intent stored in YAML frontmatter under `intent.outcome_ids` field — consistent with existing frontmatter patterns, no new file format needed
- parsePlanIntent uses extractFrontmatter() for YAML parsing — reuses existing infrastructure
- Trace command scoped to current milestone's phase range via getMilestoneInfo() — prevents scanning archived phases
- Gap detection sorts by priority (P1 gaps first) — actionable output highlights most important uncovered outcomes

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tracing infrastructure complete — Plan 15-02 can build validation (drift scoring) on top of this matrix
- parsePlanIntent() available for Plan 15-02's drift signal detection (objective mismatch, feature creep, priority inversion)
- Coverage percentage provides foundation for drift score calculation
- All 324 tests pass, no regressions

---
*Phase: 15-intent-tracing-validation*
*Completed: 2026-02-25*
