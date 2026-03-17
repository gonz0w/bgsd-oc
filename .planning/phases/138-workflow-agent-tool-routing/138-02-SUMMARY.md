---
phase: 138-workflow-agent-tool-routing
plan: 02
subsystem: agent
tags: [tool-routing, agents, bgsd-context, preferred-commands]
provides:
  - tool-aware agent system prompts for executor, debugger, and codebase-mapper
affects:
  - bgsd-executor agents (now read tool_availability for file/search/JSON/YAML/view commands)
  - bgsd-debugger agents (now use ripgrep for investigation when available)
  - bgsd-codebase-mapper agents (now resolve fd/rg commands before explore_codebase)
tech-stack:
  added: []
  patterns:
    - Preferred Commands table pattern — preamble has resolved commands, body references by name
    - tool_routing XML section — standard placement after project-context, before philosophy/execution_flow
key-files:
  created: []
  modified:
    - agents/bgsd-executor.md
    - agents/bgsd-debugger.md
    - agents/bgsd-codebase-mapper.md
key-decisions:
  - Single Preferred Commands table at top of agent prompt — body uses resolved command names, no if/else
  - Debugger tool_routing focuses on investigation_loop operations (search, find, view) not general purpose
  - Codebase mapper explore_codebase blocks updated to reference preamble commands rather than repeat hardcoded find/grep
patterns-established:
  - tool_routing XML section with Preferred Commands table — reusable pattern for any agent that needs tool-aware commands
  - "When tool available" / "Fallback" two-column format for clear conditional routing without conditionals in prompt body
requirements-completed: [AGENT-01, AGENT-02, ROUTE-03]
one-liner: "Add <tool_routing> Preferred Commands sections to executor (5 ops), debugger (4 investigation ops), and codebase-mapper (6 ops) so all 3 agents use fd/rg/jq/bat when available and fall back to MCP tools or node when not"
duration: 20min
completed: 2026-03-17
---

# Phase 138 Plan 02: Agent Tool Routing Summary

**Add <tool_routing> Preferred Commands sections to executor (5 ops), debugger (4 investigation ops), and codebase-mapper (6 ops) so all 3 agents use fd/rg/jq/bat when available and fall back to MCP tools or node when not**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-17
- **Completed:** 2026-03-17
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `<tool_routing>` Preferred Commands section to `bgsd-executor.md` with 5 operations (file discovery, content search, JSON processing, YAML processing, file viewing) mapping tool_availability booleans to concrete fd/rg/jq/yq/bat commands with Glob/Grep/node/Read MCP fallbacks
- Added investigation-focused `<tool_routing>` to `bgsd-debugger.md` with 4 search operations (error text search, related file finding, stack trace search, file context viewing), highlighting ripgrep's -C context lines, -l file listing, and --type filtering advantages for root cause identification
- Added `<tool_routing>` Preferred Commands preamble to `bgsd-codebase-mapper.md` with 6 operations and updated all 4 explore_codebase focus blocks (tech/arch/quality/concerns) to reference the preamble pattern instead of hardcoding find/grep commands

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Preferred Commands section to bgsd-executor.md** - `76bf695` (feat)
2. **Task 2: Add search-mode guidance to bgsd-debugger.md investigation section** - `b517ed1` (feat)
3. **Task 3: Add Preferred Commands preamble and update explore_codebase in bgsd-codebase-mapper.md** - `77c813c` (feat)

## Files Created/Modified

- `agents/bgsd-executor.md` [+16/-0] — tool_routing section with 5-op Preferred Commands table
- `agents/bgsd-debugger.md` [+15/-0] — tool_routing section with 4-op investigation-focused table
- `agents/bgsd-codebase-mapper.md` [+33/-15] — tool_routing preamble + 4 updated explore_codebase blocks

## Decisions Made

- Placed `<tool_routing>` immediately after `<skill:project-context />` so agents read tool context early in their system prompt before execution flow
- Kept debugger tool_routing narrowly focused on investigation operations — the debugger's primary tool need is content search during investigation_loop, not general-purpose operations
- Updated codebase-mapper explore_codebase blocks to use comment-references to Preferred Commands rather than keeping duplicate hardcoded commands — the preamble table is now the single source for concrete commands

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. (Note: The plan mentioned a secrets scan `grep` in bgsd-codebase-mapper.md to leave unchanged — that grep is actually in `workflows/map-codebase.md`, not in the agent file itself, so no action was needed.)

## Next Phase Readiness

Phase 138 complete. Phase 139 (End-to-End Validation) can now verify the detection → enrichment → behavior chain by writing tests that confirm tool-aware routing actually changes agent behavior based on tool availability.

## Self-Check: PASSED

- `agents/bgsd-executor.md` — `<tool_routing>` section after `<skill:project-context />`, before `<execution_flow>`, 5-op table ✓
- `agents/bgsd-debugger.md` — `<tool_routing>` section after `<skill:project-context />`, before `<philosophy>`, 4-op investigation table ✓
- `agents/bgsd-codebase-mapper.md` — `<tool_routing>` preamble with 6-op table, explore_codebase blocks updated to reference Preferred Commands ✓
- 3 commits exist: 76bf695, b517ed1, 77c813c ✓
- All 3 agents reference `tool_availability` from `<bgsd-context>` ✓

---
*Phase: 138-workflow-agent-tool-routing*
*Completed: 2026-03-17*
