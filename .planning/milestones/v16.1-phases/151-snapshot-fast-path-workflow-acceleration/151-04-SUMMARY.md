---
phase: 151-snapshot-fast-path-workflow-acceleration
plan: 04
subsystem: workflow
tags: [workflow, discuss-phase, verify-work, batching, prompts]
requires:
  - phase: 151-03
    provides: batched plan finalization and fresh snapshot/init reads after planning writes
provides:
  - faster default `discuss-phase` handling for low-risk clarification without a split fast-mode product
  - optional `verify-work --batch N` grouped clean-path verification with exact drill-down only for failing groups
  - workflow contract coverage for accelerated discuss and verify behavior
affects: [discuss workflow, verify workflow, command wrappers, workflow regression tests]
tech-stack:
  added: []
  patterns: [default-flow acceleration over split modes, cheap grouped verification with failing-group drill-down]
key-files:
  created: []
  modified:
    - bin/bgsd-tools.cjs
    - bin/manifest.json
    - plugin.js
    - skills/skill-index/SKILL.md
    - commands/bgsd-discuss-phase.md
    - commands/bgsd-verify-work.md
    - src/lib/questions.js
    - tests/discuss-phase-workflow.test.cjs
    - tests/workflow.test.cjs
    - workflows/discuss-phase.md
    - workflows/verify-work.md
key-decisions:
  - "Accelerate the default discuss workflow with low-risk defaults instead of treating `--fast` as a separate product path."
  - "Keep grouped verify mode opt-in so one-at-a-time verification remains the default contract."
  - "Use grouped clean-path summaries only for passing batches and require exact per-test drill-down only inside failing groups."
patterns-established:
  - "Workflow acceleration should preserve existing decision-fidelity states such as locked, defaulted, delegated, and deferred."
  - "Batching is allowed when the clean path is cheap and failures fall back to the exact existing path."
requirements-completed: [FLOW-04, FLOW-05]
one-liner: "Low-risk discuss defaults and optional batched verify-work groups that stay fast on clean runs but exact on failures"
duration: 2min
completed: 2026-03-29
---

# Phase 151 Plan 04: Accelerate the human-facing discuss and verify workflows without sacrificing quality or exactness. Summary

**Low-risk discuss defaults and optional batched verify-work groups that stay fast on clean runs but exact on failures**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T04:00:00Z
- **Completed:** 2026-03-29T04:00:44Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added a low-risk default path to `discuss-phase` so routine clarification can move faster without weakening stress-test discipline.
- Kept `--fast` as compatibility wording only while preserving explicit locked/defaulted/delegated/deferred decision states.
- Added optional `verify-work --batch N` workflow guidance that stays summary-first on clean groups and drills down exactly only when a batch fails.

## Task Commits

Each task was committed atomically:

1. **Task 1: Accelerate the default discuss workflow without creating a split UX** - `14d24008` (feat)
2. **Task 2: Add optional grouped verify mode with cheap clean-path behavior and exact failing-group drill-down** - `a94c935d` (feat)
3. **Follow-up build artifact refresh** - `355e510b` (chore)

## Files Created/Modified

- `workflows/discuss-phase.md` - Added a low-risk default path and decision-fidelity guardrails before the normal clarification loop.
- `commands/bgsd-discuss-phase.md` - Reframed `--fast` as compatibility-only wording.
- `src/lib/questions.js` - Added a low-risk default handling template and updated discuss prompt wording.
- `tests/discuss-phase-workflow.test.cjs` - Locked the accelerated default discuss contract in regression coverage.
- `workflows/verify-work.md` - Added optional grouped verification semantics with clean-path summaries and failing-group drill-down.
- `commands/bgsd-verify-work.md` - Documented optional `--batch N` usage.
- `tests/workflow.test.cjs` - Added structural workflow contract coverage for discuss compatibility wording and verify batching behavior.
- `bin/bgsd-tools.cjs`, `plugin.js`, `bin/manifest.json`, `skills/skill-index/SKILL.md` - Regenerated tracked build artifacts after workflow updates.

## Decisions Made

- Default discuss acceleration happens in the main workflow, not in a separate long-term fast mode.
- Low-risk discuss shortcuts can only compress routine clarification when locked decisions, deferred ideas, and agent discretion remain explicit.
- Grouped verify mode is opt-in and must return to exact one-at-a-time results for any failing batch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `execute:commit` was blocked by detached-head and unrelated working-tree changes, so task commits were created directly with `jj commit <paths>` to keep each task atomic without touching unrelated files.

## Next Phase Readiness

- Discuss and verify workflows now have faster contracts for routine turns without changing their default quality guarantees.
- Phase 151 is ready for completion and Phase 152 can build on the faster human-facing workflow surfaces.

## Self-Check: PASSED

- Summary file present: `.planning/phases/151-snapshot-fast-path-workflow-acceleration/151-04-SUMMARY.md`
- Task commit `14d24008` verified in git history
- Task commit `a94c935d` verified in git history
- Follow-up build artifact commit `355e510b` verified in git history

---
*Phase: 151-snapshot-fast-path-workflow-acceleration*
*Completed: 2026-03-29*
