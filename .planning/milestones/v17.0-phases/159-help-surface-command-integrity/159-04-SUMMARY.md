---
phase: 159-help-surface-command-integrity
plan: 04
subsystem: docs
tags: [commands, workflows, handoffs, validation]

# Dependency graph
requires:
  - phase: 158-canonical-command-families
    provides: canonical planning-family routing and compatibility boundaries
provides:
  - canonical planning-prep workflow guidance on /bgsd-plan discuss|research|assumptions
  - persisted discuss handoff guidance aligned to /bgsd-plan research with a concrete phase number
  - focused regression coverage that combines exact string checks with validator-backed command proof
affects: [workflows, handoffs, command-integrity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - canonical planning-prep workflow follow-ups use /bgsd-plan subcommands
    - focused guidance tests pair string assertions with validator-backed concrete examples

key-files:
  created:
    - .planning/phases/159-help-surface-command-integrity/159-04-SUMMARY.md
  modified:
    - workflows/new-project.md
    - workflows/new-milestone.md
    - workflows/progress.md
    - workflows/list-phase-assumptions.md
    - workflows/discuss-phase.md
    - workflows/research-phase.md
    - .planning/phase-handoffs/159/discuss.json
    - tests/guidance-command-integrity-workflows-handoffs.test.cjs

key-decisions:
  - "Planning-prep workflow guidance now surfaces only canonical /bgsd-plan discuss|research|assumptions routes on the touched files."
  - "Focused command-integrity coverage uses validator-backed concrete examples so semantic routing stays locked without depending on unrelated repo-wide validator failures."

patterns-established:
  - "Workflow next-step guidance should fill in the phase number when the workflow knows it (for example `/bgsd-plan discuss 1`)."
  - "Persisted `next_command` handoff artifacts should store canonical planning-family routes with concrete arguments."

requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical planning-prep workflow guidance and persisted discuss handoff routing locked to executable /bgsd-plan commands with focused validator-backed regressions"

# Metrics
duration: 13 min
completed: 2026-03-30
---

# Phase 159 Plan 04: Workflow Planning-Prep Guidance Summary

**Canonical planning-prep workflow guidance and persisted discuss handoff routing locked to executable /bgsd-plan commands with focused validator-backed regressions**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-30T01:33:00Z
- **Completed:** 2026-03-30T01:45:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced remaining touched workflow guidance that preferred `/bgsd-discuss-phase`, `/bgsd-research-phase`, or `/bgsd-list-assumptions` with canonical `/bgsd-plan` subcommands.
- Filled concrete next-step phase arguments where the workflow already knew them, including new-project and the active discuss handoff.
- Added focused regression coverage that locks both exact wording and validator-backed command integrity for the touched workflow and handoff surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize workflow planning-prep guidance** - `cbdc3e35` (docs)
2. **Task 2: Update persisted next-command guidance and lock the touched surfaces** - `9b00bb25` (test)

**Plan metadata:** Recorded in the final `docs(159-04)` completion commit after state updates.

## Files Created/Modified
- `workflows/new-project.md` - switches project bootstrap next steps to canonical `/bgsd-plan discuss` commands.
- `workflows/new-milestone.md` - updates milestone follow-up guidance and success criteria to canonical planning-family routes.
- `workflows/progress.md` - routes discuss and assumptions follow-ups through canonical `/bgsd-plan` subcommands.
- `workflows/list-phase-assumptions.md` - updates usage/examples and next steps to canonical assumptions/discuss commands.
- `workflows/discuss-phase.md` - writes canonical `/bgsd-plan research` durable handoff guidance.
- `workflows/research-phase.md` - advertises canonical `/bgsd-plan research` usage examples.
- `.planning/phase-handoffs/159/discuss.json` - persists `/bgsd-plan research 159` as the next command.
- `tests/guidance-command-integrity-workflows-handoffs.test.cjs` - locks touched workflow strings and validator-backed canonical command examples.

## Decisions Made
- Canonical planning-prep guidance on the touched workflow surfaces now uses only `/bgsd-plan discuss`, `/bgsd-plan research`, and `/bgsd-plan assumptions`.
- Focused validator-backed coverage uses concrete runnable examples for the touched routes so semantic command integrity is enforced even while the broader Phase 159 sweep is still incomplete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seeded the focused regression file during Task 1 so the declared verification target existed**
- **Found during:** Task 1 (Canonicalize workflow planning-prep guidance)
- **Issue:** The task's verify command referenced `tests/guidance-command-integrity-workflows-handoffs.test.cjs`, but that file did not exist yet.
- **Fix:** Created the initial workflow-focused regression in Task 1, then expanded it in Task 2 with handoff and validator-backed coverage.
- **Files modified:** tests/guidance-command-integrity-workflows-handoffs.test.cjs
- **Verification:** `npm run test:file -- tests/guidance-command-integrity-workflows-handoffs.test.cjs`
- **Committed in:** cbdc3e35 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal. The deviation only unblocked the planned focused verification target and stayed within the plan's intended regression scope.

## Issues Encountered
- Full-repo `util:validate-commands --raw` still reports broader Phase 159 command-guidance issues outside this plan's touched surfaces, so light verification relied on the focused validator-backed regression for the affected workflow and handoff examples.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Workflow and persisted handoff planning-prep guidance for this slice are canonical-first and covered by focused regressions.
- Remaining Phase 159 plans can continue sweeping other surfaced command-integrity areas without reopening these workflow and handoff examples.

## Self-Check: PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-04-SUMMARY.md`.
- Verified task commits `cbdc3e35` and `9b00bb25` exist in `jj log`.
