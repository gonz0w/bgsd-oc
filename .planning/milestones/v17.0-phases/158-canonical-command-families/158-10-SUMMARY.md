---
phase: 158-canonical-command-families
plan: 10
subsystem: workflow
tags: [canonical-commands, handoffs, resume-summary, testing]

# Dependency graph
requires:
  - phase: 158-canonical-command-families
    provides: canonical planning-family wording introduced by earlier Phase 158 gap-closure slices
provides:
  - research handoff guidance and persisted resume commands now prefer `/bgsd-plan phase <phase>`
  - focused regressions cover canonical next-command text for research and resume-summary flows
affects: [phase-159-help-surface-command-integrity, resume-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical next-command wording is validated in both workflow copy and init resume-summary regressions

key-files:
  created: []
  modified:
    - workflows/research-phase.md
    - src/commands/init.js
    - bin/bgsd-tools.cjs
    - tests/integration.test.cjs
    - tests/init.test.cjs

key-decisions:
  - "Keep handoff mechanics unchanged and only move surfaced next-command text to canonical planning-family wording."
  - "Update runtime fallback generation and regression expectations together so persisted resume summaries cannot drift from workflow guidance."

patterns-established:
  - "Canonical command migrations should verify both authored workflow prompts and derived runtime resume_summary output."

requirements-completed: [CMD-03]
one-liner: "Research handoffs and resume summaries now surface canonical `/bgsd-plan phase` next commands with matching runtime and regression coverage."

# Metrics
duration: 3 min
completed: 2026-03-29
---

# Phase 158 Plan 10: Align persisted handoff and resume-summary test expectations with the canonical planning next-command wording introduced by the workflow guidance gap closure. Summary

**Research handoffs and resume summaries now surface canonical `/bgsd-plan phase` next commands with matching runtime and regression coverage.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T23:12:19Z
- **Completed:** 2026-03-29T23:15:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Reworded the research workflow so canonical planning-family guidance now points to `/bgsd-plan phase` in both user-facing copy and persisted handoff metadata.
- Updated `init` runtime fallback logic so resume summaries emit the same canonical planning next command when no explicit next command is stored.
- Locked the change with focused integration and init regressions covering fresh-context fallback and resume-summary expectations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update research follow-up prompts and persisted next-command wording to canonical planning-family language** - `a10ac9f` (fix)
2. **Task 2: Update resume-summary expectations to canonical planning next commands** - `ad62116` (test)

**Plan metadata:** `55c9003` (docs: complete plan)

## Files Created/Modified

- `workflows/research-phase.md` - Canonicalized research follow-up and persisted handoff next-command wording.
- `src/commands/init.js` - Switched derived research-step resume fallback to `/bgsd-plan phase <phase>`.
- `bin/bgsd-tools.cjs` - Rebuilt shipped CLI so runtime behavior matches the source update.
- `tests/integration.test.cjs` - Updated fresh-context handoff-chain assertions to the canonical planning command.
- `tests/init.test.cjs` - Updated resume-summary fallback expectation to the canonical planning command.

## Decisions Made

- Preserved existing handoff-chain semantics and changed only the displayed next-command text so alias compatibility remains intact.
- Treated the runtime fallback string in `src/commands/init.js` as part of the same gap because tests proved workflow-copy-only edits would leave persisted resume guidance stale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Runtime resume fallback still emitted legacy planning wording**
- **Found during:** Task 1 (Update research follow-up prompts and persisted next-command wording to canonical planning-family language)
- **Issue:** Focused integration verification failed because `init:plan-phase` still derived `/bgsd-plan-phase <phase>` when no explicit next command was stored.
- **Fix:** Updated `src/commands/init.js` and rebuilt `bin/bgsd-tools.cjs` so persisted resume summaries match the canonical workflow wording.
- **Files modified:** `src/commands/init.js`, `bin/bgsd-tools.cjs`
- **Verification:** `npm run test:file -- tests/integration.test.cjs`
- **Committed in:** `a10ac9f`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Kept scope narrow while ensuring the regression suite reflected real runtime behavior, not just edited workflow copy.

## Issues Encountered

- Initial Task 1 verification exposed that resume-summary fallback text was still generated from legacy runtime logic. Updating the runtime fallback and rebuilding the bundled CLI resolved the mismatch.

## Next Phase Readiness

- Canonical planning next-command wording is now aligned across research workflow guidance, resume-summary fallback output, and focused regression coverage.
- Phase 159 can build on this by auditing the remaining help and command-reference surfaces for canonical accuracy.

## Self-Check: PASSED

- Found `.planning/phases/158-canonical-command-families/158-10-SUMMARY.md`.
- Verified task commits `a10ac9f` and `ad62116` exist in history.

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
