---
phase: 19-mcp-server-profiling
plan: 01
subsystem: mcp
tags: [mcp, token-estimation, server-discovery, profiling, context-window]

# Dependency graph
requires:
  - phase: 18-environment-awareness
    provides: "env.js module pattern as structural template"
provides:
  - "mcp-profile CLI command for server discovery and token estimation"
  - "MCP_KNOWN_SERVERS database (20 servers)"
  - "discoverMcpServers() — reads .mcp.json + opencode.json + user-level config"
  - "estimateTokenCost() — known-db lookup with default fallback"
affects: [19-02 relevance scoring, 19-03 auto-disable]

# Tech tracking
tech-stack:
  added: []
  patterns: ["known-server static database for token estimation", "multi-source config discovery with priority-based deduplication"]

key-files:
  created: [src/commands/mcp.js]
  modified: [src/router.js, src/lib/constants.js, bin/gsd-tools.cjs, bin/gsd-tools.test.cjs]

key-decisions:
  - "20-server known-DB with regex pattern matching against name/command/args"
  - "Deduplication by name: .mcp.json > opencode.json > user-level config"
  - "Default estimate for unknown servers: 5 tools × 150 tokens + 400 base = 1150 tokens"
  - "HOME env var isolation in tests to prevent user-config interference"

patterns-established:
  - "MCP config discovery: 3-source merge with priority deduplication"
  - "Token estimation: static known-db lookup with regex pattern matching"

requirements-completed: [MCP-01, MCP-02]

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 19 Plan 01: MCP Server Discovery & Token Estimation Summary

**MCP server discovery from .mcp.json + opencode.json (3 sources) with 20-server known-DB token estimation and context window percentage reporting**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-25T15:21:48Z
- **Completed:** 2026-02-25T15:31:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- MCP server discovery engine reading .mcp.json, opencode.json (OpenCode), and user-level config with priority-based deduplication
- Known-server token estimation database covering 20 common MCP servers (postgres, github, brave-search, terraform, docker, redis, vault, etc.)
- `mcp-profile` CLI command outputting per-server token estimates, total context cost, and context window percentage
- 15 comprehensive tests covering all discovery paths, merging, estimation, edge cases, and graceful degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: Build MCP server discovery and token estimation engine** - `13698cd` (feat)
2. **Task 2: Add comprehensive tests for discovery and estimation** - `8565b27` (test)

## Files Created/Modified
- `src/commands/mcp.js` — MCP profiling command module (discoverMcpServers, estimateTokenCost, MCP_KNOWN_SERVERS, cmdMcpProfile)
- `src/router.js` — Added mcp-profile and mcp case routing
- `src/lib/constants.js` — COMMAND_HELP entries for mcp-profile and mcp
- `bin/gsd-tools.cjs` — Bundled output
- `bin/gsd-tools.test.cjs` — 15 new test cases in mcp-profile describe block

## Decisions Made
- Used regex pattern matching against server name + command + args for flexible known-server matching (e.g., /queue[_-]?pilot/i matches rabbitmq's queue-pilot)
- Set default unknown server estimate at 5 tools × 150 tokens/tool + 400 base = 1,150 tokens (conservative)
- HOME environment variable override in tests to isolate from user-level config (brave-search, context7 in real ~/.config/opencode/opencode.json)
- Supported both `mcp-profile` and `mcp profile` command syntax for consistency with existing patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test isolation for user-level config**
- **Found during:** Task 2 (test writing)
- **Issue:** Tests checking exact server counts failed because user's real ~/.config/opencode/opencode.json added brave-search and context7 to results
- **Fix:** Added `isolateHome` option to test helper that temporarily sets HOME to tmpDir, preventing user-level config discovery
- **Files modified:** bin/gsd-tools.test.cjs
- **Verification:** All 15 tests pass with and without user-level config
- **Committed in:** 8565b27 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for test reliability across different machines. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Discovery engine and token estimation ready for Plan 02 (relevance scoring)
- `discoverMcpServers()` and `estimateTokenCost()` exported and tested for Plan 02 consumption
- MCP_KNOWN_SERVERS database extensible for future servers

---
*Phase: 19-mcp-server-profiling*
*Completed: 2026-02-25*
