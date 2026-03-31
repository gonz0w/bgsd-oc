---
phase: 130-lesson-schema-analysis-pipeline
plan: 01
subsystem: cli
tags: [lessons, json, memory, schema-validation, commonjs, javascript]

# Dependency graph
requires: []
provides:
  - "lessons:capture command with LESSON_SCHEMA validation (6 required fields, severity/type normalization)"
  - "Structured lessons live directly in .planning/memory/lessons.json; migration-era markdown ingestion was later retired"
  - "lessons:list command with --type/--severity/--since/--limit/--query filters"
  - "util:memory read --store lessons --type/--since/--severity filter support (LESSON-06)"
  - ".planning/memory/lessons.json as the structured lessons backing store"
affects:
  - "Phase 132 (Deviation Recovery Auto-Capture) — lessons:capture must exist before auto-capture can call it"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lessons schema validation: LESSON_SCHEMA constant + validateLesson() normalizes severity/type, coerces affected_agents string→array"
    - "Lazy namespace loader: lazyLessons() follows same pattern as all other command modules"
    - "Store-specific filters in cmdMemoryRead: lessons block alongside existing trajectories block"

key-files:
  created:
    - src/commands/lessons.js
    - .planning/memory/lessons.json
  modified:
    - src/router.js
    - src/commands/memory.js
    - src/lib/constants.js
    - src/lib/commandDiscovery.js
    - src/lib/command-help.js
    - bin/bgsd-tools.cjs

key-decisions:
  - "validateLesson() receives pre-built entry object (id/date added by cmdLessonsCapture) — separation keeps validation pure"
  - "Initial rollout included a migration sentinel strategy for environment-type historical entries; the repo later standardized on structured lessons only"
  - "parseLessonsOptions() defined as local function inside router case block — avoids polluting outer scope"
  - "lessons-specific filters in cmdMemoryRead use options.type/options.since/options.severity naming (distinct from trajectory 'from'/'to')"

patterns-established:
  - "Lessons schema validation pattern: LESSON_SCHEMA constant with required/severity_values/type_values arrays"
  - "Namespace case pattern: local parseXxxOptions() helper inside case block for option parsing"

requirements-completed:
  - LESSON-01
  - LESSON-02
  - LESSON-03
  - LESSON-06
one-liner: "Structured lesson capture with LESSON_SCHEMA validation, filtered listing, and enhanced memory read for the lessons store"

# Metrics
duration: 10min
completed: 2026-03-15
---

# Phase 130 Plan 01: Lesson Schema & Analysis Pipeline — Core Infrastructure Summary

**Structured lesson capture with LESSON_SCHEMA validation, filtered listing, and enhanced memory read for the lessons store**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-15T18:59:17Z
- **Completed:** 2026-03-15T19:09:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created `src/commands/lessons.js` with LESSON_SCHEMA (6 required fields), `validateLesson()` normalizing severity/type/agents, `cmdLessonsCapture` writing structured UUID+date entries to `.planning/memory/lessons.json`, and `cmdLessonsList` with 5-filter support
- Registered `lessons` as a top-level namespace in `src/router.js` with lazy loader and structured command dispatch; enhanced `util:memory read` to parse and pass `--type`, `--since`, `--severity` for LESSON-06 pagination support
- Added lessons command help entries in `constants.js`, updated `commandDiscovery.js` with lessons namespace routing map and category, and `command-help.js` with COMMAND_BRIEF and COMMAND_RELATED entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/commands/lessons.js with schema, capture, and list commands** - `27b5793` (feat)
2. **Task 2: Register lessons namespace in router + enhance memory read filters + add help text** - `b95047d` (feat)

**Plan metadata:** `8a5c83d` (docs: complete plan)

## Files Created/Modified

- `src/commands/lessons.js` - New module: LESSON_SCHEMA, validateLesson, cmdLessonsCapture, cmdLessonsList
- `src/router.js` - Added lazyLessons(), lessons namespace case, --type/--since/--severity in memory read path
- `src/commands/memory.js` - Added lessons-specific filter block in cmdMemoryRead (LESSON-06)
- `src/lib/constants.js` - Added COMMAND_HELP entries for lessons:capture and lessons:list
- `src/lib/commandDiscovery.js` - Added lessons to COMMAND_CATEGORIES and routerImplementations
- `src/lib/command-help.js` - Added Lessons category, COMMAND_BRIEF entries, COMMAND_RELATED entries
- `.planning/memory/lessons.json` - Seeded with structured lesson entries
- `bin/bgsd-tools.cjs` - Rebuilt with all changes

## Decisions Made

- `validateLesson()` receives a pre-built entry object (with `id`/`date` already set by the caller) — keeps validation pure and testable in isolation
- The lessons store is intentionally structured JSON in `.planning/memory/lessons.json`, enabling later analysis and suggestions to avoid depending on free-form markdown parsing
- `parseLessonsOptions()` defined as a local function inside the router `case 'lessons':` block — avoids polluting the outer scope, follows the ad-hoc pattern used elsewhere
- Lessons-specific filters in `cmdMemoryRead` use `options.type`/`options.since`/`options.severity` naming to avoid collision with trajectory filter options (`from`/`to`/`category`)

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context unavailable (no prior commits to scan for phase/plan)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lessons infrastructure (LESSON-01 through LESSON-03, LESSON-06) is complete and functional
- `lessons:capture` is ready for Phase 132 (Deviation Recovery Auto-Capture) to call
- Phase 130 Plan 02 (analysis pipeline, LESSON-04/05/07/08/09) can now build on this foundation
- No blockers

---
*Phase: 130-lesson-schema-analysis-pipeline*
*Completed: 2026-03-15*
