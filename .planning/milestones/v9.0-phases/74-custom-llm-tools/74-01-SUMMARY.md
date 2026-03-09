---
phase: 74-custom-llm-tools
plan: 01
subsystem: plugin
tags: [zod, tools, llm, esm, plugin]

# Dependency graph
requires:
  - phase: 73-context-injection
    provides: ProjectState cache, parsers, plugin hooks
provides:
  - bgsd_status tool: execution state reader (phase, plan, tasks, progress, blockers)
  - bgsd_plan tool: roadmap overview and detailed phase reader
  - bgsd_context tool: task-scoped file paths and action reader
  - Tool barrel (tools/index.js) with registry wiring
  - Plugin entry point updated with tool registration
affects: [74-custom-llm-tools]

# Tech tracking
tech-stack:
  added: [zod]
  patterns: [tool-per-file, barrel-registration, json-stringify-returns, zod-coerce-args]

key-files:
  created:
    - src/plugin/tools/bgsd-status.js
    - src/plugin/tools/bgsd-plan.js
    - src/plugin/tools/bgsd-context.js
    - src/plugin/tools/index.js
  modified:
    - src/plugin/index.js
    - bin/bgsd-tools.test.cjs

key-decisions:
  - "Zod bundled into plugin.js — size grew from 39KB to 548KB, within acceptable bounds per CONTEXT.md"
  - "Tools return JSON.stringify strings directly, not raw objects — explicit serialization"
  - "Fields always present with null for missing data — predictable response shape"
  - "Tool names auto-prefixed via registry: status → bgsd_status, plan → bgsd_plan, context → bgsd_context"

patterns-established:
  - "One tool per file in src/plugin/tools/ with description, args (Zod schema), async execute"
  - "Tool barrel (tools/index.js) as single wiring point for registration"
  - "Three response types: success JSON, error envelope (validation_error/runtime_error), no_project"
  - "z.coerce.number().optional() for lenient LLM parameter handling"

requirements-completed: [TOOL-01, TOOL-03, TOOL-04, TOOL-06]

# Metrics
duration: 10min
completed: 2026-03-09
---

# Phase 74 Plan 01: Tool Infrastructure & Read-Only Tools Summary

**Three LLM-callable tools (bgsd_status, bgsd_plan, bgsd_context) with Zod schemas, tool barrel registration, and plugin wiring — all returning typed JSON strings**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-09T13:23:03Z
- **Completed:** 2026-03-09T13:33:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created bgsd_status tool: reads execution state (phase, plan, task list, progress, blockers) from ProjectState cache
- Created bgsd_plan tool: dual-mode roadmap overview (no args) or detailed phase info with plan contents (phase arg)
- Created bgsd_context tool: returns task-scoped file paths, action text, and done criteria for current/specified task
- Built tool barrel (tools/index.js) that imports all tools and registers them via createToolRegistry
- Wired tools into plugin entry point: `tool: getTools(registry)` replaces commented-out placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tool infrastructure and bgsd_status tool** - `1be227c` (feat)
2. **Task 2: Create bgsd_plan and bgsd_context tools** - `0ae52da` (feat)

## Files Created/Modified
- `src/plugin/tools/bgsd-status.js` - Execution state reader tool (phase, plan, tasks, progress, blockers)
- `src/plugin/tools/bgsd-plan.js` - Roadmap/phase reader with dual-mode (overview vs detail)
- `src/plugin/tools/bgsd-context.js` - Task-scoped context reader (file paths, action, done criteria)
- `src/plugin/tools/index.js` - Tool barrel: imports, registers, and exports all tools
- `src/plugin/index.js` - Plugin entry point: added getTools import and tool wiring
- `bin/bgsd-tools.test.cjs` - Updated plugin bundle size limit from 100KB to 600KB for Zod

## Decisions Made
- Zod v4 (4.3.6) bundled from existing transitive dependency (via knip) — explicit devDependency addition deferred to Plan 02 build pipeline task
- Plugin bundle size limit raised from 100KB to 600KB — Zod adds ~500KB but CONTEXT.md explicitly notes "No concern about plugin.js bundle size increase from tools + Zod"
- Tools use direct JSON.stringify returns rather than relying on framework serialization — explicit control over response format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated plugin bundle size test**
- **Found during:** Task 2 (bgsd_plan and bgsd_context tools)
- **Issue:** Existing test asserted plugin.js < 100KB; Zod bundling grew it to 548KB
- **Fix:** Updated test threshold from 100KB to 600KB with descriptive message mentioning Zod
- **Files modified:** bin/bgsd-tools.test.cjs
- **Verification:** All 782 tests pass
- **Committed in:** 0ae52da (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test threshold update was necessary and expected — CONTEXT.md anticipated this growth.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool infrastructure established — Plan 02 can add bgsd_validate and bgsd_progress tools
- Tool barrel pattern makes adding new tools trivial (import + register)
- Build pipeline may need Zod as explicit devDependency (currently transitive via knip)

---
*Phase: 74-custom-llm-tools*
*Completed: 2026-03-09*
