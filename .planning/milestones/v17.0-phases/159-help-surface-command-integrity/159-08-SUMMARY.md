---
phase: 159-help-surface-command-integrity
plan: 08
subsystem: docs
tags: [help, commands, inspect, docs, skills, validation]
requires:
  - phase: 159-help-surface-command-integrity
    provides: shared validator cleanup from Plans 01-07, including reference-style command exceptions
provides:
  - canonical inspect-first help and troubleshooting guidance on the remaining touched Phase 159 surfaces
  - clearer separation between reference-style command indexes and runnable examples in command docs and skills
  - focused regression proof that the touched help, docs, and skill surfaces stay validator-clean
affects: [help-surfaces, docs, skills, verification, phase-159]
tech-stack:
  added: []
  patterns: [inspect-first surfaced guidance, reference-style indexes versus runnable examples]
key-files:
  created: [.planning/phases/159-help-surface-command-integrity/159-08-SUMMARY.md]
  modified: [workflows/help.md, docs/commands.md, docs/planning-system.md, docs/troubleshooting.md, skills/raci/SKILL.md, tests/guidance-help-surface.test.cjs, tests/guidance-command-integrity-docs.test.cjs, tests/guidance-command-integrity-agent-skill-surfaces.test.cjs]
key-decisions:
  - "Canonical help and troubleshooting next steps now route progress, health, trace, and search guidance through /bgsd-inspect on touched Phase 159 surfaces."
  - "Reference-style command-family summaries stay allowed only when labeled as indexes, while runnable prose keeps concrete executable examples."
patterns-established:
  - "Use /bgsd-inspect progress as the canonical progress/help route instead of surfacing /bgsd-progress in user guidance."
  - "Reference tables may use family-form commands only when the surrounding prose explicitly marks them as reference-style rather than runnable next steps."
requirements-completed: [CMD-04, CMD-05, CMD-06]
one-liner: "Help, docs, and skill guidance now route remaining progress and inspect next steps through canonical /bgsd-inspect surfaces with validator-backed regression proof"
duration: 5 min
completed: 2026-03-30
---

# Phase 159 Plan 08: Help and command integrity closure summary

**Help, docs, and skill guidance now route remaining progress and inspect next steps through canonical `/bgsd-inspect` surfaces with validator-backed regression proof**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T02:17:11Z
- **Completed:** 2026-03-30T02:22:16Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Replaced the last stale `/bgsd-progress` help guidance with canonical `/bgsd-inspect progress` examples while keeping `/bgsd-review` in the compact core path.
- Canonicalized touched docs to prefer `/bgsd-inspect` progress, health, trace, and search routes and clarified when planning-family command forms are reference-only indexes.
- Tightened focused regressions so the touched help, docs, and skill surfaces stay validator-clean under the post-Plan-07 reference-style contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace stale progress guidance in the main help surface with canonical inspect routing** - `znkrkmvw` (docs)
2. **Task 2: Canonicalize the remaining touched docs and reference-style skill guidance** - `vmpntnrr` (docs)
3. **Task 3: Re-lock the touched help/docs/skill surfaces against the shared validator** - `rkuokllt` (test)

## Files Created/Modified

- `workflows/help.md` - Replaces legacy progress guidance with `/bgsd-inspect progress` in the core path, resume example, and final help callout.
- `docs/commands.md` - Labels planning-family shorthand as a reference index and adds canonical `/bgsd-inspect` route notes for legacy diagnostic aliases.
- `docs/planning-system.md` - Updates trace and memory-search examples to canonical inspect routes.
- `docs/troubleshooting.md` - Replaces stale health/progress troubleshooting next steps with canonical inspect guidance.
- `skills/raci/SKILL.md` - Clarifies that placeholder command forms in the ownership matrix are reference-style only.
- `tests/guidance-help-surface.test.cjs` - Guards against legacy `/bgsd-progress` help guidance returning.
- `tests/guidance-command-integrity-docs.test.cjs` - Verifies canonical inspect guidance and reference-style index wording on touched docs.
- `tests/guidance-command-integrity-agent-skill-surfaces.test.cjs` - Confirms the RACI skill note and placeholder matrix stay validator-clean.

## Decisions Made

- Canonicalized user-facing progress and diagnostics guidance on the touched Phase 159 surfaces to `/bgsd-inspect` routes instead of leaving legacy aliases in runnable prose.
- Made the planning-family summary in `docs/commands.md` explicitly reference-style so concise family forms no longer read like missing-argument next steps.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Repo-wide `validateCommandIntegrity()` still reports 303 issues outside the touched Phase 159 surfaces, but the touched help/docs/skill files in this plan now report zero validator issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The final incomplete Phase 159 gap-closure plan is now executed and the touched help/docs/skill surfaces are ready for aggregate phase verification.
- Aggregate verification should confirm whether the remaining 303 repo-wide validator issues fall outside Phase 159 scope as expected.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-08-SUMMARY.md`
- FOUND: `znkrkmvw` task commit for help-surface inspect routing
- FOUND: `vmpntnrr` task commit for doc and skill canonicalization
- FOUND: `rkuokllt` task commit for focused validator regressions
