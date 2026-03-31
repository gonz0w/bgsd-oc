---
phase: 159-help-surface-command-integrity
plan: 17
subsystem: workflow
tags: [workflows, guidance, commands, validator]
requires:
  - phase: 159-help-surface-command-integrity
    provides: focused gap-closure regression style and canonical command-family guidance from earlier wave-6 slices
provides:
  - canonical new-milestone guidance that no longer advertises a nonexistent standalone milestone command
  - direct-file regression coverage for the shipped new-milestone workflow slice
affects: [workflows, verification, milestone-initialization]
tech-stack:
  added: []
  patterns: [reference-only labeling for non-runnable workflow metadata, direct validator-backed workflow guidance regression]
key-files:
  created:
    - tests/guidance-command-integrity-workflow-prep-d.test.cjs
  modified:
    - workflows/new-milestone.md
key-decisions:
  - "Treat the MILESTONE-CONTEXT provenance note as reference-only metadata so users are not pointed at a nonexistent standalone slash command."
  - "Lock this final milestone workflow slice with a direct-file validator-backed regression instead of broadening the scope to other workflow surfaces."
patterns-established:
  - "Workflow guidance that names generated artifacts should explicitly say when the text is reference-only rather than runnable."
requirements-completed: [CMD-06]
one-liner: "New-milestone workflow guidance now labels milestone-context provenance as reference-only and is locked by a direct shipped-file regression"
duration: 2min
completed: 2026-03-30
---

# Phase 159 Plan 17: Close the final workflow-only milestone blocker slice by fixing the remaining stale guidance in `workflows/new-milestone.md`. Summary

**New-milestone workflow guidance now labels milestone-context provenance as reference-only and is locked by a direct shipped-file regression**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T04:19:55Z
- **Completed:** 2026-03-30T04:22:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote the remaining `workflows/new-milestone.md` blocker line so it no longer presents `/bgsd-discuss-milestone` as a runnable command.
- Preserved the useful milestone-context note by clearly labeling it as reference-only metadata.
- Added a focused regression that reads the shipped workflow file directly and verifies the shared command-integrity validator accepts it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the new-milestone guidance slice** - `dc495b49` (docs)
2. **Task 2: Lock the new-milestone slice with direct regression coverage** - `b0dc95e8` (test)

## Files Created/Modified

- `workflows/new-milestone.md` - Reframed the milestone-context note as reference-only metadata instead of runnable guidance.
- `tests/guidance-command-integrity-workflow-prep-d.test.cjs` - Added direct-file assertions plus validator coverage for the touched workflow surface.

## Decisions Made

- Treated the milestone-context note as reference-only because it describes artifact provenance, not a supported user command.
- Kept verification surgical by reading the shipped workflow file directly and validating only this final milestone workflow slice.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Summary scaffold generation picked up unrelated concurrent wave commits, so the final summary was authored manually to keep this plan's record limited to its actual files and commits.

## Next Phase Readiness

- The `workflows/new-milestone.md` blocker cited in `159-VERIFICATION.md` is now removed.
- Focused regression coverage now protects this final workflow-only milestone slice without reopening broader runtime or skill cleanup work.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-17-SUMMARY.md`
- FOUND: `dc495b49` task commit for workflow guidance cleanup
- FOUND: `b0dc95e8` task commit for regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
