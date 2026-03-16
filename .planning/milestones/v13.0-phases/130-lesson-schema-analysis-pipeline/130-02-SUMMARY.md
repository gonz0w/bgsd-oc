---
phase: 130-lesson-schema-analysis-pipeline
plan: 02
subsystem: cli
tags: [lessons, analysis, pattern-detection, workflow-hooks, deduplication]
requires:
  - phase: 130-lesson-schema-analysis-pipeline plan 01
    provides: lessons schema, capture, migrate, list commands and lessons.json store
provides:
  - lessons:analyze command — groups recurrent patterns by agent+type with ≥2 threshold
  - lessons:suggest command — structured advisory suggestions excluding type:environment entries
  - lessons:compact command — deduplicates by root_cause above configurable threshold
  - verify-work.md hook — surfaces lessons:suggest advisory after verification (non-blocking)
  - complete-milestone.md hook — surfaces lessons:suggest at milestone wrapup (non-blocking)
affects: [130-lesson-schema-analysis-pipeline, workflows/verify-work, workflows/complete-milestone, phase-132-deviation-auto-capture]
tech-stack:
  added: []
  patterns:
    - "SEVERITY_ORDER map for comparing LOW/MEDIUM/HIGH/CRITICAL"
    - "type:environment sentinel exclusion in suggest/analyze"
    - "2>/dev/null || true pattern for non-blocking workflow hooks"
key-files:
  created: []
  modified:
    - src/commands/lessons.js
    - src/lib/constants.js
    - src/router.js
    - bin/bgsd-tools.cjs
    - workflows/verify-work.md
    - workflows/complete-milestone.md
key-decisions:
  - "cmdLessonsAnalyze and cmdLessonsSuggest both use same agent+type grouping logic — DRY via shared agentTypeMap build pattern"
  - "lessons:suggest excludes type:environment per LESSON-02 sentinel — downstream analysis filters migrated free-form lessons"
  - "lessons:compact groups by lowercase-trimmed root_cause — normalized key ensures case/whitespace variants merge correctly"
  - "Workflow hooks placed as dedicated steps (surface_lesson_suggestions) with 2>/dev/null || true — never block verification or milestone"
patterns-established:
  - "Severity comparison: SEVERITY_ORDER map { LOW:1, MEDIUM:2, HIGH:3, CRITICAL:4 } for deterministic ordering"
  - "Agent group building: expand affected_agents (string or array) into per-agent buckets before type sub-grouping"
requirements-completed:
  - LESSON-04
  - LESSON-05
  - LESSON-07
  - LESSON-08
  - LESSON-09
one-liner: "Lesson analysis pipeline with pattern detection (analyze), advisory suggestions (suggest), deduplication (compact), and non-blocking hooks in verify-work and complete-milestone"
duration: 8min
completed: 2026-03-15
---

# Phase 130 Plan 02: Analysis Pipeline Summary

**Lesson analysis pipeline with pattern detection (analyze), advisory suggestions (suggest), deduplication (compact), and non-blocking hooks in verify-work and complete-milestone**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T19:13:14Z
- **Completed:** 2026-03-15T19:21:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `cmdLessonsAnalyze` — groups lesson entries by affected agent + type, filters to groups with ≥2 lessons, reports severity distribution and common root causes (LESSON-04)
- Added `cmdLessonsSuggest` — generates structured improvement suggestions from qualified groups, excludes `type:environment` migrated entries, sorts by severity then count (LESSON-05)
- Added `cmdLessonsCompact` — deduplicates the lesson store by normalized root_cause above configurable threshold (default 100), merges prevention rules and preserves highest severity (LESSON-07)
- Added non-blocking `lessons:suggest` advisory steps to `verify-work.md` and `complete-milestone.md` using `2>/dev/null || true` (LESSON-08, LESSON-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lessons:analyze and lessons:suggest commands** - `5cadc14` (feat)
2. **Task 2: Add lessons:compact command and workflow integration hooks** - `97c091f` (feat)

**Plan metadata:** `84d206a` (docs: complete plan)

## Files Created/Modified

- `src/commands/lessons.js` — Added cmdLessonsAnalyze, cmdLessonsSuggest, cmdLessonsCompact with SEVERITY_ORDER helper
- `src/router.js` — Added analyze, suggest, compact routing under lessons namespace with --agent/--threshold option parsing
- `src/lib/constants.js` — Added COMMAND_HELP entries for lessons:analyze, lessons:suggest, lessons:compact
- `bin/bgsd-tools.cjs` — Rebuilt from source
- `workflows/verify-work.md` — Added surface_lesson_suggestions step (non-blocking)
- `workflows/complete-milestone.md` — Added surface_lesson_suggestions step (non-blocking)

## Decisions Made

- `cmdLessonsAnalyze` and `cmdLessonsSuggest` share identical agent+type grouping logic — both build agentTypeMap with the same expand-agents pattern for DRY code
- `lessons:suggest` excludes `type:environment` entries per LESSON-02 design: migrated free-form lessons use this as a sentinel type, preventing noisy suggestions from unstructured historical data
- `lessons:compact` normalizes root_cause by `.toLowerCase().trim()` before grouping — ensures case and whitespace variants merge correctly
- Workflow hooks placed as dedicated named steps (`surface_lesson_suggestions`) rather than inlined to enable future extension and clear step attribution

## Deviations from Plan

None — plan executed exactly as written.

## Review Findings

Review skipped — review context assembly covers only structural issues; this plan added new commands with no architectural changes.

## Issues Encountered

Pre-existing test failure (`bgsd_status returns structured data from live project`) in plugin.test.cjs:379 was present before and after changes — confirmed via git stash isolation test. 1564/1565 tests pass.

Note: git stash during verification temporarily lost source changes (stash pop blocked by build artifact conflicts). Re-applied edits from memory; no code was lost.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 130 complete — all 9 LESSON-* requirements delivered across plans 01 and 02
- Phase 131 (Skill Discovery & Security) is independent and can proceed immediately
- Phase 132 (Deviation Recovery Auto-Capture) can now proceed — `lessons:capture` exists as required dependency

---
*Phase: 130-lesson-schema-analysis-pipeline*
*Completed: 2026-03-15*
