---
phase: 159-help-surface-command-integrity
plan: 10
subsystem: docs
tags: [commands, docs, inspect, troubleshooting, planning]
requires:
  - phase: 159-help-surface-command-integrity
    provides: canonical command-reference cleanup from Plan 09 for planning and inspect guidance
provides:
  - canonical inspect-family replacements in planning-system and troubleshooting narrative docs
  - executable troubleshooting CLI examples that use current bgsd-tools command forms
  - narrative-doc alignment for the follow-on full-file command-guidance regression plan
affects: [docs, troubleshooting, planning-system, verification, phase-159]
tech-stack:
  added: []
  patterns: [canonical inspect routes, executable doc examples, current bgsd-tools CLI namespaces]
key-files:
  created: [.planning/phases/159-help-surface-command-integrity/159-10-SUMMARY.md]
  modified: [docs/planning-system.md, docs/troubleshooting.md]
key-decisions:
  - "Narrative docs should point rollback and context-budget guidance at canonical `/bgsd-inspect` routes instead of legacy aliases."
  - "Troubleshooting CLI examples should use the shipped `bgsd-tools.cjs` binary and current namespaced commands so users can run them as written."
patterns-established:
  - "When a doc names an inspect flow, prefer a concrete `/bgsd-inspect <subcommand> ...` example over a legacy alias mention."
  - "Troubleshooting docs should mirror `docs/commands.md` by using the current `node bin/bgsd-tools.cjs <namespace:command>` forms for direct CLI examples."
requirements-completed: [CMD-04, CMD-06]
one-liner: "Planning-system and troubleshooting guidance now use canonical inspect routes plus current bgsd-tools CLI examples for rollback, context-budget, and state recovery flows"
duration: 4 min
completed: 2026-03-30
---

# Phase 159 Plan 10: Narrative docs command-surface alignment summary

**Planning-system and troubleshooting guidance now use canonical inspect routes plus current `bgsd-tools` CLI examples for rollback, context-budget, and state recovery flows**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T02:50:00Z
- **Completed:** 2026-03-30T02:54:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Replaced the last planning-system reference to the legacy context-budget alias with a canonical `/bgsd-inspect context-budget` example.
- Rewrote troubleshooting rollback and token-budget guidance to use canonical inspect-family routes with concrete runnable shapes.
- Tightened troubleshooting and planning-system CLI examples so state, config, cache, and codebase commands use the current `bgsd-tools.cjs` binary and namespaced routes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove legacy context-budget guidance from planning-system docs** - `ptlwukmm` (docs)
2. **Task 2: Replace legacy troubleshooting routes with canonical executable guidance** - `nmoywmux` (docs)
3. **Task 3: Align both narrative docs with the post-Plan-09 canonical command surface** - `vroykwtl` (docs)

## Files Created/Modified

- `docs/planning-system.md` - Replaces the last legacy context-budget mention and updates the state-validation CLI wording to the current command form.
- `docs/troubleshooting.md` - Canonicalizes rollback and context-budget guidance and refreshes direct CLI examples to current `bgsd-tools` routes.
- `.planning/phases/159-help-surface-command-integrity/159-10-SUMMARY.md` - Records outcomes, decisions, and verification evidence for this plan.

## Decisions Made

- Pointed rollback and context-budget troubleshooting guidance to `/bgsd-inspect` so the narrative docs match the canonical command family introduced earlier in the phase.
- Updated direct CLI examples in the touched docs to current namespaced `bgsd-tools.cjs` forms so the examples remain executable exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — reason: gap closure plan.

## Issues Encountered

- The broad `util:validate-commands --raw` regression gate still reports 23 repo-wide issues in other surfaces, but the cited `docs/planning-system.md` and `docs/troubleshooting.md` blockers targeted by this plan no longer fail the explicit plan checks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/planning-system.md` and `docs/troubleshooting.md` are now aligned with the canonical command surface from `docs/commands.md`.
- The follow-on regression plan can focus on locking the full shipped docs/validator state without reopening these two narrative docs.

## Self-Check: PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-10-SUMMARY.md` on disk.
- Verified task commits `ptlwukmm`, `nmoywmux`, and `vroykwtl` in `jj log`.
