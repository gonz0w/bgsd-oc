---
phase: 159-help-surface-command-integrity
plan: 11
subsystem: testing
tags: [commonjs, docs, regression, command-integrity]
requires:
  - phase: 159-09
    provides: Canonical command-reference wording for docs/commands.md and the shared docs regression file
  - phase: 159-10
    provides: Canonical inspect-family wording for docs/planning-system.md and docs/troubleshooting.md
provides:
  - Full-file regression coverage for the exact shipped Phase 159 blocker docs
  - Canonical-only assertions for planning-family shorthand and cited legacy command blockers
affects: [verification, docs, command-guidance]
tech-stack:
  added: []
  patterns:
    - Full-file documentation regression checks via validateCommandIntegrity surface injection
    - Exact shipped blocker-doc coverage instead of snippet-only proofs
key-files:
  created: []
  modified: [tests/guidance-command-integrity-docs.test.cjs]
key-decisions:
  - "Keep the regression narrowed to docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md so CMD-06 proof covers only the real shipped blockers."
  - "Feed validateCommandIntegrity the full shipped file contents instead of synthetic snippets so future regressions fail on the exact user-facing docs."
patterns-established:
  - "Doc blocker regressions should validate full shipped file bodies for the cited surfaces, not reconstructed excerpts."
  - "Canonical-only guidance checks should encode exact blocker commands from verification evidence."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Full-file command-integrity regression for docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md using exact shipped content"
duration: 1min
completed: 2026-03-30
---

# Phase 159 Plan 11: Lock the shipped-doc fixes with full-file regression coverage on the exact Phase 159 blocker docs. Summary

**Full-file command-integrity regression for docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md using exact shipped content**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-29 20:58:28 -0600
- **Completed:** 2026-03-29 20:58:57 -0600
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Narrowed the docs guidance regression to the three shipped Phase 159 blocker docs named by verification.
- Replaced snippet-only validator fixtures with full-file `validateCommandIntegrity()` coverage on the exact shipped document bodies.
- Locked explicit assertions against planning-family shorthand in `docs/commands.md` and the legacy inspect aliases previously cited in `docs/planning-system.md` and `docs/troubleshooting.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Read the real shipped blocker docs inside the doc guidance regression** - `afb0596` (test)
2. **Task 2: Assert that planning-family ambiguity and cited legacy commands stay gone** - `13450ba` (test)

## Files Created/Modified

- `tests/guidance-command-integrity-docs.test.cjs` [+10/-53]

## Decisions Made

- Kept the regression scope limited to the exact blocker docs from `159-VERIFICATION.md` so the proof path stays narrow and does not reopen unrelated validator-core behavior.
- Used the real shipped file contents as validator inputs instead of extracted snippets so future failures reflect what users actually read.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 159 now has executable regression proof for the remaining shipped documentation blockers called out in verification.
- The verifier can rely on one narrow docs-focused test path without reopening broader command-validator coverage.

## Self-Check

PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-11-SUMMARY.md`
- Found task commit `afb0596`
- Found task commit `13450ba`

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
