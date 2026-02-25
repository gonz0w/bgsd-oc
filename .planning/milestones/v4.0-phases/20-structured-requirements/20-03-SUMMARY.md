---
phase: 20-structured-requirements
plan: 03
subsystem: workflow
tags: [assertions, planning, templates, requirements, traceability]

# Dependency graph
requires:
  - phase: 20-01
    provides: "parseAssertionsMd parser and assertions list/validate CLI commands"
provides:
  - "plan-phase workflow with assertion-aware planner and researcher spawns"
  - "Step 8.5 assertion surfacing before planner spawn"
  - "requirements.md template with structured assertions guidance and test-command column"
  - "assertions.md template with assertion → plan flow and migration docs"
affects: [plan-phase, new-project, new-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional assertion path injection: assertions_path checked at Step 7, consumed in Step 9"
    - "Gradual migration: assertions added when phase touches requirement, no backfill"

key-files:
  created: []
  modified:
    - "workflows/plan-phase.md"
    - "templates/requirements.md"
    - "templates/assertions.md"

key-decisions:
  - "Integrated assertion reading into existing workflow steps rather than creating new steps — 12 net new lines"
  - "Planner derives must_haves.truths from assertions automatically, falls back to requirement text when no assertions exist"
  - "Test-command column added to traceability table template for requirement-to-test mapping"

patterns-established:
  - "Assertion-aware planning: planner reads ASSERTIONS.md and maps must-have assertions to must_haves.truths"
  - "Step 8.5 pattern: surface relevant data between lessons and planner spawn"

requirements-completed: [SREQ-02, SREQ-05]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 20 Plan 03: Planner Workflow Integration and Template Updates Summary

**Assertion-aware plan-phase workflow with auto-populated must_haves.truths from ASSERTIONS.md and updated templates for new project assertion guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T17:09:58Z
- **Completed:** 2026-02-25T17:12:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wired ASSERTIONS.md reading into plan-phase workflow: researcher, planner, and new Step 8.5 all assertion-aware
- Planner prompt now derives must_haves.truths from must-have assertions with graceful fallback to requirement text
- Updated requirements.md template with Structured Assertions guidelines, evolution step, and test-command traceability column
- Updated assertions.md template with Assertion → Plan Flow documentation and gradual migration guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire assertion reading into plan-phase workflow** - `1560064` (feat)
2. **Task 2: Update templates for assertion-aware projects** - `18bc899` (feat)

## Files Created/Modified
- `workflows/plan-phase.md` - Added assertion path discovery (Step 7), assertion surfacing (Step 8.5), assertion reading in researcher/planner prompts (Steps 5, 9)
- `templates/requirements.md` - Added Structured Assertions guidelines, evolution step 4, test-command column in traceability tables
- `templates/assertions.md` - Added Assertion → Plan Flow section and Migration section

## Decisions Made
- Integrated into existing steps rather than creating verbose new sections — 12 net new lines in workflow (well under 20-line target)
- Planner uses must-have assertions as source for must_haves.truths with fallback to requirement text when no assertions exist
- Added test-command column to both template and example traceability tables for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 complete: assertion schema (Plan 01), per-assertion verification (Plan 02), and workflow integration (Plan 03)
- New projects created with `/gsd-new-project` will get assertion awareness from templates
- Existing projects gain assertions gradually as phases touch requirements
- Planning workflow automatically reads and uses assertions when available

---
*Phase: 20-structured-requirements*
*Completed: 2026-02-25*
