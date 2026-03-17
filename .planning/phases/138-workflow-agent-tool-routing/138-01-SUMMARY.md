---
phase: 138-workflow-agent-tool-routing
plan: 01
subsystem: workflow
tags: [tool-routing, workflow, bgsd-context]
provides:
  - tool-aware workflow routing for execute-plan, execute-phase, map-codebase, github-ci
affects:
  - agents spawned by execute-phase (receive capability_level hint)
  - mapper agents spawned by map-codebase (receive TOOL_GUIDANCE block)
tech-stack:
  added: []
  patterns:
    - Pre-computed decision pattern for tool routing (file-discovery-mode, search-mode)
key-files:
  created: []
  modified:
    - workflows/execute-plan.md
    - workflows/execute-phase.md
    - workflows/map-codebase.md
    - workflows/github-ci.md
key-decisions:
  - Minimal one-line capability hint in Task() prompts — full details in bgsd-context (avoids duplication)
  - detect:gh-preflight replaces raw gh auth status for structured JSON error + actionable fix format
  - TOOL_GUIDANCE block built before mapper spawns so all 4 Task() calls use resolved concrete commands
patterns-established:
  - Pre-computed decision pattern for tool decisions (same as execution-pattern, branch-handling)
  - Actionable error format: error field + fix_command field from preflight JSON
requirements-completed:
  - ROUTE-01
  - ROUTE-02
  - ROUTE-03
  - GH-01
one-liner: "Wire tool detection decisions into 4 workflows: file-discovery/search-mode guidance in execute-plan, capability_level hints in execute-phase executor spawns, fd/rg TOOL_GUIDANCE in map-codebase mapper spawns, and detect:gh-preflight replacing raw gh auth status in github-ci"
duration: 15min
completed: 2026-03-17
---

# Phase 138 Plan 01: Workflow Tool Routing Summary

**Wire tool detection decisions into 4 workflows: file-discovery/search-mode guidance in execute-plan, capability_level hints in execute-phase executor spawns, fd/rg TOOL_GUIDANCE in map-codebase mapper spawns, and detect:gh-preflight replacing raw gh auth status in github-ci**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-17
- **Completed:** 2026-03-17
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Added tool-aware execution guidance section to execute-plan.md using pre-computed decision pattern for `file-discovery-mode` and `search-mode`, enabling executors to use `fd`/`rg` when available or Glob/Grep MCP tools as fallback
- Added `capability_level` one-line hint to both Mode A (worktree) and Mode B (standard) executor Task() prompts in execute-phase.md, giving spawned executors an upfront signal about tool availability without duplicating full tool_availability data
- Added tool routing to map-codebase.md: extracts `tool_availability`/`capability_level` from bgsd-context and builds `TOOL_GUIDANCE` block with concrete fd/rg commands or Glob/Grep fallbacks, injected into all 4 parallel mapper Task() spawn prompts
- Replaced raw `gh auth status` in github-ci.md with `detect:gh-preflight` JSON parsing: checks `usable` boolean, surfaces actionable `error` + `fix_command` on failure, and displays `warnings` array for version-specific issues

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tool-aware search/discovery instructions to execute-plan.md** - `ed3dc17` (feat)
2. **Task 2: Pass tool capability hint in execute-phase.md Task() prompts** - `d4d8fd7` (feat)
3. **Task 3: Add tool routing guidance to map-codebase.md mapper spawns** - `cf9ca7b` (feat)
4. **Task 4: Replace gh auth status with detect:gh-preflight in github-ci.md** - `d8f3f73` (feat)

## Files Created/Modified

- `workflows/execute-plan.md` [+17/-1] — tool-aware guidance section + extended field list
- `workflows/execute-phase.md` [+4/-2] — handoff_tool_context fields + capability_level in Task() prompts
- `workflows/map-codebase.md` [+13/-5] — tool_availability fields + TOOL_GUIDANCE in mapper spawns
- `workflows/github-ci.md` [+15/-5] — detect:gh-preflight with structured error/fix/warnings output

## Decisions Made

- Minimal one-line capability hint in Task() prompts instead of full tool_availability duplication — agents receive their own bgsd-context with complete details
- `detect:gh-preflight` used instead of parsing raw `gh auth status` text — structured JSON provides actionable fix commands rather than generic auth error messages
- TOOL_GUIDANCE block constructed before spawning loop so all 4 mapper agents receive the same resolved commands

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Plan 02 (agent system prompts) can now proceed: workflows pass tool routing context to agents, agents need Preferred Commands sections to act on that context.

## Self-Check: PASSED

- `workflows/execute-plan.md` — tool_routing section exists, file-discovery-mode and search-mode decisions referenced ✓
- `workflows/execute-phase.md` — handoff_tool_context in field list, capability_level in Mode A and Mode B Task() prompts ✓
- `workflows/map-codebase.md` — tool_availability in field list, TOOL_GUIDANCE in all 4 mapper Task() prompts ✓
- `workflows/github-ci.md` — detect:gh-preflight used, usable/error/fix_command/warnings parsed ✓
- 4 commits exist: ed3dc17, d4d8fd7, cf9ca7b, d8f3f73 ✓

---
*Phase: 138-workflow-agent-tool-routing*
*Completed: 2026-03-17*
