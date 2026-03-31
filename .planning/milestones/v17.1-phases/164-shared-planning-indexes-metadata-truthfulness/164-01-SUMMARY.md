---
phase: 164-shared-planning-indexes-metadata-truthfulness
plan: 01
subsystem: cli
tags: [javascript, commonjs, frontmatter, must_haves, caching]
requires:
  - phase: 163-shared-contracts-safe-mutation
    provides: canonical state and planning mutation safety for follow-on reliability work
provides:
  - shared must_haves normalization for verifier-facing consumers
  - cached phase plan metadata lookup for repeated analysis passes
  - cached workspace evidence lookup for artifact and wiring checks
affects: [verify, scaffold, trace-requirement, planner-checker]
tech-stack:
  added: []
  patterns: [frontmatter-backed must_haves normalization, shared phase metadata context, cached workspace evidence lookups]
key-files:
  created:
    - src/lib/plan-metadata.js
    - tests/plan-metadata-contract.test.cjs
  modified: [src/lib/helpers.js, src/commands/scaffold.js, src/commands/features.js]
key-decisions:
  - normalize must_haves through one shared helper that accepts string, array, and object forms
  - build plan metadata reads on cached phase indexes and shared workspace evidence lookups instead of per-consumer rescans
patterns-established:
  - "Plan metadata context: reuse one per-invocation phase + workspace index across consumers"
  - "Verifier-facing must_haves contract: always coerce truths, artifacts, and key links into stable normalized collections"
requirements-completed: [FOUND-03, VERIFY-01]
one-liner: "Shared must_haves normalization with cached phase and workspace indexes for scaffold and requirement tracing"
duration: 8 min
completed: 2026-03-30
---

# Phase 164 Plan 01: Shared Plan Metadata Contract Summary

**Shared must_haves normalization with cached phase and workspace indexes for scaffold and requirement tracing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T18:21:59Z
- **Completed:** 2026-03-30T18:30:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `src/lib/plan-metadata.js` as one shared verifier-facing contract that normalizes nested, inline-array, and plain-string `must_haves` metadata.
- Reused cached phase inventory plus a shared workspace evidence index so repeated metadata analysis stays inside one cached context instead of rescanning files per consumer.
- Migrated scaffold verification generation and requirement tracing onto the shared helper, then locked the contract with focused regression coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regression coverage for real must_haves shapes and reuseable indexes** - `761c596` (test)
2. **Task 2: Implement the shared plan metadata and index helper** - `36ce559` (feat)

## Files Created/Modified

- `src/commands/features.js` [+13/-18]
- `src/commands/scaffold.js` [+33/-21]
- `src/lib/helpers.js` [+34/-0]
- `src/lib/plan-metadata.js` [+176/-0]
- `tests/plan-metadata-contract.test.cjs` [+163/-0]

## Decisions Made

- Normalized artifact strings into `{ path }` entries and parsed string key links into `{ from, to, via }` objects so downstream consumers can work from one stable contract.
- Kept scaffold's legacy body-YAML fallback only as a compatibility path while making frontmatter-backed metadata the canonical source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used path-scoped `jj commit` after `execute:commit` rejected the detached dirty workspace**
- **Found during:** Task 1 and Task 2 commit steps
- **Issue:** The repo already had unrelated working-copy changes, so `execute:commit` refused scoped task commits.
- **Fix:** Committed only the task-owned files with path-scoped `jj commit ... -m ...` commands.
- **Verification:** `jj log -r @- --no-graph ...` confirmed each task commit landed with the expected message and isolated files.
- **Committed in:** `761c596`, `36ce559`

**2. [Rule 3 - Blocking] Applied manual state and requirement updates after plan-finalization helpers failed on current markdown shapes**
- **Found during:** Final metadata update step
- **Issue:** `verify:state complete-plan` could not parse the current STATE.md format, and `plan:requirements mark-complete` did not match the backtick-based requirement entries.
- **Fix:** Updated STATE.md and REQUIREMENTS.md directly after ROADMAP progress was refreshed successfully.
- **Verification:** Read-back checks showed Phase 164 progress at `1/3`, STATE moved to Phase 164 Plan 02, and `FOUND-03` / `VERIFY-01` are now checked complete.
- **Committed in:** final metadata commit

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No scope creep. Both fixes preserved the planned execution flow in the current JJ workspace and current markdown artifact formats.

## Issues Encountered

- `verify:state complete-plan` and `plan:requirements mark-complete` still assume older STATE / REQUIREMENTS shapes, so finalization needed manual read-back updates after the commands reported parse failures.

## Next Phase Readiness

- Verifier hardening can now consume one shared metadata contract instead of indentation-sensitive raw YAML scraping.
- Later Phase 164 plans can build loud missing vs inconclusive verifier outcomes and planner/checker approval gates on top of the new normalized status model.

## Self-Check

PASSED

---
*Phase: 164-shared-planning-indexes-metadata-truthfulness*
*Completed: 2026-03-30*
