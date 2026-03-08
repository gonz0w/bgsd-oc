---
phase: 65-performance-tuning
plan: 01
subsystem: infra
tags: [acorn, lazy-loading, bundle-size, performance, esbuild]

# Dependency graph
requires:
  - phase: 61-build-analysis
    provides: bundle size baselines and metafile analysis infrastructure
provides:
  - Lazy-loaded acorn (230KB deferred from cold-start path)
  - Updated bundle size baselines with acorn lazy-load metadata
affects: [65-performance-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-require-for-lazy-loading]

key-files:
  created: []
  modified:
    - src/lib/ast.js
    - .planning/baselines/performance.json

key-decisions:
  - "Lazy-load acorn inside parseWithAcorn() rather than each public function — single entry point, cleanest approach"
  - "Bundle file size unchanged at 1153KB — esbuild can't tree-shake dynamic require, but effective cold-start reduced by 230KB"

patterns-established:
  - "Inline require() for large optional dependencies: use require() inside function body instead of top-level for modules only needed in specific code paths"

requirements-completed: [PERF-02]

# Metrics
duration: 27min
completed: 2026-03-07
---

# Phase 65 Plan 01: Lazy-Load Acorn Summary

**Acorn (230KB) lazy-loaded via inline require() in parseWithAcorn(), reducing effective cold-start parse size from 1153KB to 923KB for all non-AST commands**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-07T16:28:37Z
- **Completed:** 2026-03-07T16:56:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Acorn (230KB) moved from top-level require to lazy inline require inside parseWithAcorn()
- Non-AST commands (state, init, verify, plan, etc.) no longer load/parse acorn's 230KB
- Bundle composition audited — only 2 npm deps: acorn (230KB) and tokenx (6KB)
- Performance baselines updated with lazy-load metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Lazy-load acorn in ast.js** - `aa6cbfe` (perf)
2. **Task 2: Bundle composition audit and additional size reductions** - `8a089dc` (docs)

## Files Created/Modified
- `src/lib/ast.js` - Moved require('acorn') from top-level (line 5) to inline within parseWithAcorn()
- `.planning/baselines/performance.json` - Updated bundle_size_kb from 1216 to 1153, added acorn_lazy_loaded and effective_cold_start_kb fields

## Decisions Made
- Placed the lazy require inside `parseWithAcorn()` rather than in each of the 4 public API functions — parseWithAcorn is the only direct acorn consumer, and all 4 public functions flow through it
- Bundle file size stays at 1153KB because esbuild can't tree-shake dynamic require() — but effective cold-start is reduced since V8 only parses acorn's 230KB when the require() is actually hit
- No additional size reduction opportunities found — acorn and tokenx are the only npm dependencies, and command modules are already lazy-loaded

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — autonomous plan, no review context needed.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Acorn lazy-loading complete, ready for Phase 65 Plan 02 (init command optimization and I/O reduction)
- Bundle at 1153KB, well within 1500KB budget
- Effective cold-start reduced to 923KB for majority of commands

---
*Phase: 65-performance-tuning*
*Completed: 2026-03-07*
