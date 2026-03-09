---
phase: 73-context-injection
plan: 03
subsystem: workflows
tags: [context-injection, plugin-required, workflows, v9.0, init-removal]

# Dependency graph
requires:
  - phase: 73-context-injection
    provides: "Plan 02 — command enricher with <bgsd-context> auto-injection via command.execute.before hook"
  - phase: 71-plugin-architecture
    provides: "ESM plugin build pipeline, safeHook, shared parsers"
provides:
  - "All 19 workflow files use plugin-injected context instead of init:* subprocess calls"
  - "Plugin-required guard on every workflow (clear error if plugin not loaded)"
  - "new-project.md graceful degradation (allows missing context for new projects)"
  - "Complete init:* → plugin context transition for v9.0"
affects: [74-custom-tools, 75-event-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin-required guard: every workflow checks for <bgsd-context>, errors if absent"
    - "Variable references migrated from $INIT JSON to <bgsd-context> JSON fields"
    - "Special case: new-project.md allows missing context (new projects have no .planning/)"

key-files:
  created: []
  modified:
    - "workflows/execute-phase.md"
    - "workflows/execute-plan.md"
    - "workflows/plan-phase.md"
    - "workflows/verify-work.md"
    - "workflows/research-phase.md"
    - "workflows/discuss-phase.md"
    - "workflows/new-project.md"
    - "workflows/new-milestone.md"
    - "workflows/resume-project.md"
    - "workflows/progress.md"
    - "workflows/quick.md"
    - "workflows/github-ci.md"
    - "workflows/map-codebase.md"
    - "workflows/add-phase.md"
    - "workflows/insert-phase.md"
    - "workflows/remove-phase.md"
    - "workflows/add-todo.md"
    - "workflows/check-todos.md"
    - "workflows/audit-milestone.md"

key-decisions:
  - "Plugin is mandatory for v9.0 — no fallback to init:* calls"
  - "new-project.md is the only workflow that proceeds without <bgsd-context> (new projects have no .planning/ yet)"
  - "All 12 Phase 73 exports already validated in build.cjs from Plans 01-02 — no additional exports needed"

patterns-established:
  - "Plugin-required guard pattern: check for <bgsd-context>, error with install instructions if absent"
  - "Context source migration: $INIT → <bgsd-context> JSON for all workflow variable references"

requirements-completed: [CINJ-04]

# Metrics
duration: 11min
completed: 2026-03-09
---

# Phase 73 Plan 03: Workflow Init Removal Summary

**Removed all init:* subprocess calls from 19 workflow files, replacing with plugin-injected `<bgsd-context>` guards — completing the v9.0 transition from subprocess-based to plugin-based context injection**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-09T12:11:32Z
- **Completed:** 2026-03-09T12:23:12Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Removed init:* subprocess calls from all 19 workflow files (execute-phase, execute-plan, plan-phase, verify-work, research-phase, discuss-phase, new-project, new-milestone, resume-project, progress, quick, github-ci, map-codebase, add-phase, insert-phase, remove-phase, add-todo, check-todos, audit-milestone)
- Added plugin-required guard to every workflow with clear error message: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"
- Updated all variable references from `$INIT` JSON to `<bgsd-context>` JSON fields
- Special-cased new-project.md to gracefully handle missing context (new projects have no .planning/)
- Verified build succeeds with 12 critical ESM exports, all 782 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove init:* calls from all 19 workflow files** - `b966f31` (refactor)
2. **Task 2: Update build validation and run full test suite** - `d7091d5` (chore)

## Files Created/Modified
- `workflows/execute-phase.md` - Removed init:execute-phase call, added plugin guard
- `workflows/execute-plan.md` - Removed init:execute-phase call, added plugin guard
- `workflows/plan-phase.md` - Removed init:plan-phase call, added plugin guard
- `workflows/verify-work.md` - Removed init:verify-work call, added plugin guard
- `workflows/research-phase.md` - Removed init:phase-op call, added plugin guard
- `workflows/discuss-phase.md` - Removed init:phase-op call, added plugin guard, updated init reference
- `workflows/new-project.md` - Removed init:new-project call, added graceful guard (allows missing context)
- `workflows/new-milestone.md` - Removed init:new-milestone call, added plugin guard
- `workflows/resume-project.md` - Removed init:resume call, added plugin guard
- `workflows/progress.md` - Removed init:progress call, added plugin guard
- `workflows/quick.md` - Removed init:quick call, added plugin guard
- `workflows/github-ci.md` - Removed init:execute-phase fallback call, added plugin guard
- `workflows/map-codebase.md` - Removed init:map-codebase call, added plugin guard
- `workflows/add-phase.md` - Removed init:phase-op call, added plugin guard
- `workflows/insert-phase.md` - Removed init:phase-op call, added plugin guard
- `workflows/remove-phase.md` - Removed init:phase-op call, added plugin guard
- `workflows/add-todo.md` - Removed init:todos call, added plugin guard
- `workflows/check-todos.md` - Removed init:todos call, added plugin guard
- `workflows/audit-milestone.md` - Removed init:milestone-op call, added plugin guard
- `bin/manifest.json` - Updated deployment manifest
- `skills/skill-index/SKILL.md` - Auto-regenerated skill index

## Decisions Made
- Plugin is mandatory for v9.0 — workflows error if no `<bgsd-context>` block is present, directing user to install the plugin
- new-project.md is special-cased: it's the only workflow that proceeds without `<bgsd-context>` because new projects have no `.planning/` directory yet
- Build.cjs requiredExports array already contained all 12 Phase 73 exports from Plans 01-02, so no additions were needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 73 context injection is complete — the AI always knows current project state via system prompt, compaction preserves full context, and commands auto-enrich
- Zero init:* subprocess calls remain in any workflow file
- All workflows depend on the bGSD plugin being loaded (no graceful degradation without plugin)
- Ready for Phase 74 (custom tools) or Phase 75 (event-driven state sync)

---
*Phase: 73-context-injection*
*Completed: 2026-03-09*
