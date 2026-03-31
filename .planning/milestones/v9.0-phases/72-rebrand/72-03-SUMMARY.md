---
phase: 72-rebrand
plan: 03
subsystem: infra
tags: [rebrand, bulk-rename, markdown, workflows, commands, templates, skills]

# Dependency graph
requires:
  - phase: 72-rebrand
    provides: "Source code and agent files already renamed (Plans 01, 02)"
provides:
  - "All workflow files using bgsd-oc/bgsd-tools naming"
  - "All command files using bgsd-oc naming"
  - "All template files using bgsd-oc/bgsd-tools naming"
  - "All skill files using bgsd-tools/__OPENCODE_CONFIG__/bgsd-oc naming"
  - "AGENTS.md using bgsd-tools and bgsd-oc naming"
affects: [72-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bgsd-oc config path pattern across all markdown files"
    - "bgsd-tools CLI binary name in workflow instructions"
    - "__OPENCODE_CONFIG__/bgsd-oc env var in skill references"

key-files:
  created: []
  modified:
    - "workflows/*.md (44 files)"
    - "commands/*.md (41 files)"
    - "templates/**/*.md (7 files)"
    - "skills/**/*.md (10 files)"
    - "AGENTS.md"

key-decisions:
  - "Used sed -i bulk replacement with agent-specific names before generic patterns to avoid partial matches"
  - "Searched templates subdirectories separately since glob *.md doesn't recurse"

patterns-established:
  - "bgsd-oc: standard config directory name in all markdown references"
  - "bgsd-tools: standard CLI binary name in all workflow instructions"
  - "__OPENCODE_CONFIG__/bgsd-oc: standard env var name in all skill files"

requirements-completed: [RBND-08]

# Metrics
duration: 8min
completed: 2026-03-09
---

# Phase 72 Plan 03: Workflow/Command/Template/Skill Rename Summary

**Bulk rename of gsd-* to bgsd-* across 100 markdown files — workflows, commands, templates, skills, and AGENTS.md**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T04:22:52Z
- **Completed:** 2026-03-09T04:31:50Z
- **Tasks:** 2
- **Files modified:** 100

## Accomplishments
- Renamed all `get-shit-done` → `bgsd-oc` config path references across 100+ files
- Renamed all `gsd-tools` → `bgsd-tools` CLI binary references
- Renamed all `GSD_HOME` → `__OPENCODE_CONFIG__/bgsd-oc` and `gsd_home` → `bgsd_home` env var references
- Renamed all agent names (`gsd-executor` → `bgsd-executor`, etc.) across all markdown files
- Zero remaining old-pattern references confirmed via comprehensive grep sweep

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all workflow and command files** - `4223437` (refactor)
2. **Task 2: Update templates, skills, and AGENTS.md** - `2d69bb8` (refactor)

## Files Created/Modified
- `workflows/*.md` (44 files) — Config paths, CLI binary, agent names, env vars
- `commands/*.md` (41 files) — Config paths, agent names
- `templates/**/*.md` (7 files) — Config paths, CLI binary, agent names
- `skills/**/*.md` (10 files) — CLI binary, env vars, agent names
- `AGENTS.md` — CLI binary name, config paths, project structure

## Decisions Made
- Ran agent-specific name replacements (e.g., `gsd-codebase-mapper`) before generic `gsd-tools` replacement to avoid partial match corruption
- Used `find -exec sed` for recursive template/skill subdirectories since shell glob `*.md` doesn't recurse into subdirs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Template subdirectories not covered by glob**
- **Found during:** Task 2 (template updates)
- **Issue:** `sed -i ... templates/*.md` only covered root-level templates, missing `templates/plans/*.md` and `templates/codebase/*.md`
- **Fix:** Used `find templates/ -name '*.md' -exec sed` for recursive replacement
- **Files modified:** templates/plans/execute.md, templates/plans/discovery.md, templates/plans/tdd.md, templates/codebase/structure.md
- **Verification:** Comprehensive grep confirms zero remaining old patterns
- **Committed in:** 2d69bb8 (Task 2 commit)

**2. [Rule 3 - Blocking] Agent names in templates/context.md and templates/debug-subagent-prompt.md**
- **Found during:** Task 2 (template updates)
- **Issue:** `gsd-planner`, `gsd-phase-researcher`, `gsd-debugger` references in context and debug templates not caught by initial sed
- **Fix:** Ran agent-name specific sed across all template subdirectories
- **Files modified:** templates/context.md, templates/debug-subagent-prompt.md
- **Verification:** Final grep sweep shows zero remaining old patterns
- **Committed in:** 2d69bb8 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes ensured complete coverage. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All markdown files now use bgsd-* naming consistently
- Plan 04 (test file rename and validation sweep) is ready to execute
- Full test suite passes (782/782) confirming no regressions from markdown changes

---
*Phase: 72-rebrand*
*Completed: 2026-03-09*
