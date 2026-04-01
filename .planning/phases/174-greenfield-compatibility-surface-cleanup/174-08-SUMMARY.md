---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 08
subsystem: testing
tags: [command-integrity, workflows, slash-commands, validation, regressions]

# Dependency graph
requires:
  - phase: 174-07
    provides: canonical slash-command guidance cleanup across hidden NL and surfaced docs/workflows
provides:
  - validator classification for removed planning aliases as legacy surfaced guidance
  - workflow-specific fallback reconstruction boundaries that avoid misreading internal bootstrap examples as runnable public guidance
  - focused regression proof for the last Phase 174 command-integrity verification gaps
affects: [phase-175-command-surface-alignment, command-discovery, workflow-guidance, verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - precise legacy-alias classification for removed slash-command entrypoints
    - workflow-local fallback reconstruction context excluded without weakening real runnable guidance enforcement

key-files:
  created:
    - .planning/phases/174-greenfield-compatibility-surface-cleanup/174-08-SUMMARY.md
  modified:
    - src/lib/commandDiscovery.js
    - tests/validate-commands.test.cjs
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Treat removed planning aliases like /bgsd-plan-phase as explicit legacy surfaced guidance even after the alias wrapper file is gone."
  - "Limit fallback-context exemptions to the internal reconstruction blocks in workflows/plan-phase.md and workflows/discuss-phase.md so real runnable guidance mistakes still fail validation."

patterns-established:
  - "Removed slash-command aliases should produce legacy-command findings with canonical suggestions instead of generic unknown-command findings."
  - "Workflow bootstrap examples may be exempted only when the surrounding text clearly marks them as hook-bypass reconstruction context."

requirements-completed: [CLEAN-03]
one-liner: "Command-integrity validation now reports removed planning aliases as legacy guidance and ignores only the workflow-internal fallback reconstruction blocks in plan/discuss workflows."

# Metrics
duration: 6 min
completed: 2026-04-01
---

# Phase 174 Plan 08: Close GAP-174-RV-01 and GAP-174-RV-02 by making command-integrity validation distinguish internal workflow fallback reconstruction from surfaced runnable guidance, while restoring legacy alias classification for removed planning commands. Summary

**Command-integrity validation now reports removed planning aliases as legacy guidance and ignores only the workflow-internal fallback reconstruction blocks in plan/discuss workflows.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T02:30:33Z
- **Completed:** 2026-04-01T02:36:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Locked the remaining Phase 174 RED proof so the legacy planning alias misclassification and workflow-fallback boundary regressions were explicit before the fix.
- Updated `validateCommandIntegrity()` to classify removed planning aliases as legacy surfaced guidance with canonical suggestions.
- Narrowed workflow fallback handling so only the internal hook-bypass reconstruction blocks in `plan-phase.md` and `discuss-phase.md` are ignored while real runnable guidance mistakes still fail.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock RED coverage for the remaining Phase 174 verification gaps** - `eb4a1d41` (test)
2. **Task 2: Fix command-integrity classification for legacy planning aliases and internal workflow fallback context** - `5c509c98` (fix)

## Files Created/Modified

- `tests/validate-commands.test.cjs` - Makes the remaining Phase 174 regression gaps explicit, then proves the fixed legacy-alias and workflow-boundary behavior.
- `src/lib/commandDiscovery.js` - Adds precise legacy slash-alias classification and workflow-specific fallback reconstruction detection.
- `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-08-SUMMARY.md` - Records execution results for the final Phase 174 gap-closure slice.
- `.planning/STATE.md` - Advances execution state to plan 08 and records the command-integrity decision.
- `.planning/ROADMAP.md` - Will reflect the completed Phase 174 plan count after summary registration.

## Decisions Made

- Keep the legacy-alias fallback list explicit and narrow so removed planning aliases are still classified correctly after their command wrappers disappear.
- Treat only the hook-bypass reconstruction blocks in the planning workflows as reference-only context; do not broaden exemptions to ordinary `/bgsd-plan phase`, `/bgsd-plan discuss`, or arbitrary `node ... bgsd-tools.cjs ...` guidance.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — reason: gap closure plan

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The final Phase 174 command-integrity gaps now have focused regression coverage and passing proof.
- Phase 174 is ready for refreshed verification and Phase 175 command-surface work without the remaining legacy guidance ambiguity.

## Self-Check

PASSED

- Found `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-08-SUMMARY.md`
- Found `src/lib/commandDiscovery.js` and `tests/validate-commands.test.cjs`
- Verified task commits `eb4a1d41` and `5c509c98` in `jj log`
