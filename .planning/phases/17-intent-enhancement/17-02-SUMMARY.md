---
phase: 17-intent-enhancement
plan: 02
subsystem: workflows
tags: [intent, questionnaire, new-project, new-milestone, INTENT.md]

# Dependency graph
requires:
  - phase: 14-intent-capture-foundation
    provides: "intent create/update/show CLI commands"
  - phase: 16-workflow-integration-self-application
    provides: "intent-aware plan-phase, verify-work, verify-phase workflows"
provides:
  - "Guided intent questionnaire in new-project workflow (Step 4.5)"
  - "Intent evolution review in new-milestone workflow (Step 4.5)"
  - "Intent-seeded requirements in both workflows"
  - "INTENT.md passed to roadmapper in both workflows"
affects: [new-project, new-milestone, requirements, roadmap]

# Tech tracking
tech-stack:
  added: []
  patterns: ["guided-questionnaire-pattern", "intent-evolution-review"]

key-files:
  created: []
  modified:
    - "workflows/new-project.md"
    - "workflows/new-milestone.md"

key-decisions:
  - "Step 4.5 placement: after PROJECT.md creation but before requirements — intent guides requirements"
  - "new-milestone references new-project Step 4.5 for fresh intent creation (DRY)"

patterns-established:
  - "Intent questionnaire: 4 guided questions (Objective, Outcomes, Criteria, Constraints) with probing follow-ups"
  - "Intent evolution: section-by-section review with --reason flag for history tracking"

requirements-completed: [ICAP-05]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 17 Plan 02: Workflow Intent Questionnaires Summary

**Guided intent questionnaires injected into new-project and new-milestone workflows with 4 structured questions (objective, outcomes, criteria, constraints), auto-mode synthesis, and intent-seeded requirements**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T11:00:25Z
- **Completed:** 2026-02-25T11:02:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New-project workflow captures structured intent via 4 guided questions before requirements gathering
- New-milestone workflow reviews and evolves existing intent section-by-section with history tracking
- Both workflows seed requirements from desired outcomes and pass INTENT.md to roadmapper
- Auto mode synthesizes intent from idea documents without user interaction
- Backward compatible — projects without INTENT.md see zero workflow changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add intent questionnaire to new-project workflow** - `16c094e` (feat)
2. **Task 2: Add intent evolution questionnaire to new-milestone workflow** - `c41e974` (feat)

## Files Created/Modified
- `workflows/new-project.md` - Added Step 4.5 (Capture Project Intent), updated Steps 7/8/9 and success criteria
- `workflows/new-milestone.md` - Added Step 4.5 (Review and Evolve Intent), updated Steps 9/10/11 and success criteria

## Decisions Made
- Step 4.5 placed after PROJECT.md creation but before requirements — intent needs project context to ask specific questions, and requirements need intent to seed categories
- new-milestone references new-project Step 4.5 for fresh intent creation rather than duplicating the questionnaire (DRY principle)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Intent capture is now woven into the natural project setup flow for both new projects and milestones
- All 17-phase intent engineering work is complete — milestone v3.0 ready for verification

---
*Phase: 17-intent-enhancement*
*Completed: 2026-02-25*
