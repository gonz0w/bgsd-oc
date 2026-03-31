---
phase: 166-execution-realism-plan-scoped-completion
plan: 02
subsystem: state
tags: [commonjs, javascript, markdown]
requires:
  - phase: 166-01
    provides: approval-time realism gates for stale commands, stale paths, and overscoped plans before execution
provides: []
provides:
  - plan-scoped summary file and metric derivation that ignores unrelated workspace noise
  - complete-plan metadata refresh that repairs total plans, current focus, and progress text from disk truth
  - roadmap progress normalization that rewrites stale completion wording from on-disk plan inventory
affects: [execute-plan, state-metadata, roadmap-progress, summary-generation]
tech-stack:
  added: []
  patterns:
    - commit-backed summary file lists fall back to declared plan and task files when scoped history is absent or incomplete
    - completion finalization derives active-plan metadata from on-disk phase inventory before reporting success
key-files:
  created:
    - tests/state-session-mutator.test.cjs
    - tests/state.test.cjs
    - tests/summary-generate.test.cjs
    - tests/workflow.test.cjs
    - workflows/execute-plan.md
  modified:
    - bin/bgsd-tools.cjs
    - src/commands/state.js
    - src/commands/misc.js
key-decisions:
  - Summary scaffolds now treat plan-owned commits as primary evidence and declared plan files as the fallback truth source.
  - Complete-plan accepts disk-derived current-plan, total-plan, and focus overrides, then runs a focused readback repair before returning success.
  - Roadmap checklist completion text is normalized idempotently so repeated progress updates do not preserve stale wording or duplicate completion suffixes.
patterns-established:
  - Final metadata flows should repair high-level STATE and ROADMAP summary text from disk truth instead of trusting stale in-memory fields.
  - Generated summaries in dirty workspaces must scope files and metrics to the active plan, never ambient working-copy noise.
requirements-completed: [STATE-01, STATE-02, STATE-03]
one-liner: "Plan-scoped summary scaffolds and completion repair now derive files, totals, and focus text from on-disk phase truth"
duration: 8min
completed: 2026-03-30
---

# Phase 166 Plan 02: Make summary scaffolding and completion metadata reflect the active plan by deriving files and totals from plan-scoped evidence, then repairing stale STATE or ROADMAP summaries before metadata finalization. Summary

**Plan-scoped summary scaffolds and completion repair now derive files, totals, and focus text from on-disk phase truth**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30 14:57:48 -0600
- **Completed:** 2026-03-30 15:05:40 -0600
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added regressions for dirty-workspace summary drift, no-scoped-commit file fallback, stale plan totals, stale focus text, and execute-plan completion wording.
- Updated `util:summary-generate` to source file lists from scoped commits when present and declared plan/task files when commit evidence is missing or incomplete.
- Refreshed complete-plan and roadmap progress updates so metadata is recomputed from the live phase inventory and repaired by focused readback before success returns.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for plan-scoped summary truth and completion readback repair** - `538dcb2` (test)
2. **Task 2: Scope summary generation to active-plan commits or declared plan files** - `0b13e9c` (fix)
3. **Task 3: Refresh completion metadata from disk and repair stale state or roadmap summaries** - `a8fcebd` (fix)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+434/-433]
- `src/commands/misc.js` [+26/-8]
- `src/commands/roadmap.js` [+6/-4]
- `src/commands/state.js` [+112/-9]
- `src/lib/state-session-mutator.js` [+23/-3]
- `tests/state-session-mutator.test.cjs` [+20/-0]
- `tests/state.test.cjs` [+109/-0]
- `tests/summary-generate.test.cjs` [+26/-0]
- `tests/workflow.test.cjs` [+10/-0]
- `workflows/execute-plan.md` [+3/-0]

## Decisions Made

- Summary generation now merges scoped commit diffs with declared plan files so inactive dirty workspace files never leak into summary metrics while no-commit plans still emit truthful file lists.
- `verify:state complete-plan` now uses disk-derived plan counts and focus text when phase inventory exists, but preserves the prior incremental fallback for older fixtures that do not expose matching phase directories.
- Roadmap checklist repair strips stale completion suffixes before writing the new on-disk status so repeated progress updates remain idempotent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Freshly written phase fixtures in tests initially reused a stale phase-tree cache, so complete-plan now invalidates `.planning/phases` cache state before deriving disk truth.

## Next Phase Readiness

- Phase 166 is ready for verification: summary generation, STATE completion, and ROADMAP progress updates now stay scoped to the active plan.
- Phase 167 can build on quieter logging work without inheriting stale completion metadata from dirty workspaces.

## Self-Check: PASSED

- FOUND: `.planning/phases/166-execution-realism-plan-scoped-completion/166-02-SUMMARY.md`
- FOUND: `538dcb2` task commit
- FOUND: `0b13e9c` task commit
- FOUND: `a8fcebd` task commit

---
*Phase: 166-execution-realism-plan-scoped-completion*
*Completed: 2026-03-30*
