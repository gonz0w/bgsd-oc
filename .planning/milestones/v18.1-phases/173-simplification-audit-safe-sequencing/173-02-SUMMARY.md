---
phase: 173-simplification-audit-safe-sequencing
plan: 02
subsystem: docs
tags: [audit, sequencing, cleanup, router, command-surface]
requires:
  - phase: 173-01
    provides: canonical milestone findings ledger with evidence-backed audit rows
provides:
  - Gate-based cleanup stage definitions for the milestone audit
  - Per-finding stage assignments with blast-radius-first sequencing rationale
  - A concise low-risk-first cleanup order maintainers can plan against
affects: [phase-174, cleanup-planning, router-simplification, command-hotspots]
tech-stack:
  added: []
  patterns:
    - Gate-based staging instead of fake execution waves
    - Blast-radius-first sequencing attached directly to canonical findings
key-files:
  created: []
  modified:
    - .planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-MILESTONE-AUDIT.md
    - .planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-02-SUMMARY.md
key-decisions:
  - Replace vague waves with four named stage gates that define prerequisites and exclusions.
  - Keep router, ambient-global, direct-argv, and oversized command-module cleanup in Stage 4 until earlier low-blast-radius work lands.
patterns-established:
  - "Canonical audit rows carry their own recommended stage gate and sequencing dependency."
  - "Validation-required suspects stay separate from proven safe deletes until targeted proof exists."
requirements-completed: [AUDIT-02]
one-liner: "Gate-based cleanup sequencing for milestone audit findings with low-risk deletes ahead of router and command-module hotspots"
duration: 3 min
completed: 2026-03-31
---

# Phase 173 Plan 02: Safe Cleanup Sequencing Summary

**Gate-based cleanup sequencing for milestone audit findings with low-risk deletes ahead of router and command-module hotspots**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T22:51:41Z
- **Completed:** 2026-03-31T22:54:57Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Added a `## Stage Gates` table that defines real prerequisite boundaries for safe cleanup instead of pretending the milestone already knows exact execution waves.
- Assigned every canonical finding a recommended stage gate plus sequencing dependency so later plans can tell which work is safe first-pass deletion, proof-required cleanup, live-surface simplification, or high-risk structural surgery.
- Closed the audit with a concise low-risk-first order of operations that explicitly keeps router, ambient-global, direct-argv, and oversized command-module work late.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gate-based stage definitions with explicit prerequisites** - `425efcd` (docs)
2. **Task 2: Assign every finding a stage gate, blast radius, and sequencing rationale** - `715ca97` (docs)
3. **Task 3: Write the low-risk-first cleanup narrative and final sequencing summary** - `9cfc69e` (docs)

**Plan metadata:** recorded in the final docs commit after summary/state updates.

## Files Created/Modified

- `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-MILESTONE-AUDIT.md` [+30/-10]
- `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-02-SUMMARY.md` - Plan execution summary and commit ledger

## Decisions Made

- Replaced generic cleanup waves with named stage gates that say what can start, what must stay out, and why that boundary exists so downstream plans inherit real safety rules.
- Classified router parsing, ambient globals, direct argv reads, circular state coupling, and oversized command buckets as Stage 4 work because annoyance-driven ordering would front-load the highest blast radius.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `execute:commit` used its JJ path-scoped fallback because the shared workspace already contained unrelated in-flight changes; task commits still remained isolated to the audit file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 173 now satisfies both audit requirements: the milestone audit has canonical findings plus a safe order of operations.
- Phase 174 planning can lift Stage 1 and Stage 2 candidates first without re-deriving why router and command-module hotspots must wait.

## Self-Check

PASSED

- Found `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-MILESTONE-AUDIT.md`
- Found `.planning/milestones/v18.1-phases/173-simplification-audit-safe-sequencing/173-02-SUMMARY.md`
- Found task commits `425efcd1`, `715ca974`, and `9cfc69e3` in `jj log`

---
*Phase: 173-simplification-audit-safe-sequencing*
*Completed: 2026-03-31*
