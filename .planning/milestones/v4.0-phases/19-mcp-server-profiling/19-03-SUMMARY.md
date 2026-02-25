---
phase: 19-mcp-server-profiling
plan: 03
subsystem: mcp
tags: [mcp, auto-disable, backup, restore, config-mutation, opencode]

# Dependency graph
requires:
  - phase: 19-02
    provides: "scoreServerRelevance(), generateRecommendations(), RELEVANCE_INDICATORS"
provides:
  - "applyRecommendations() — disables servers in opencode.json with backup"
  - "restoreBackup() — restores opencode.json from backup"
  - "mcp-profile --apply, --restore, --dry-run flags"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["config backup before mutation (copyFileSync)", "source-aware filtering (only opencode.json modified)"]

key-files:
  created: []
  modified: [src/commands/mcp.js, src/lib/constants.js, bin/gsd-tools.cjs, bin/gsd-tools.test.cjs]

key-decisions:
  - "Only opencode.json mutated (not .mcp.json) — standard MCP format has no standard disable field"
  - "Trimmed intent help text to fit 500KB bundle budget after adding new code"

patterns-established:
  - "Config mutation with backup: copyFileSync before write, restore deletes backup"
  - "Source-aware filtering: only apply to servers from matching config source"

requirements-completed: [MCP-05]

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 19 Plan 03: Auto-Disable with Backup & Restore Summary

**`mcp-profile --apply` disables recommended servers in opencode.json with backup, `--restore` undoes changes, `--dry-run` previews without modifying**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-25T15:48:02Z
- **Completed:** 2026-02-25T15:57:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `applyRecommendations()` creates backup of opencode.json, sets `enabled: false` on servers with "disable" recommendation from opencode.json source only
- `restoreBackup()` copies opencode.json.bak back and removes the backup file
- `--apply`, `--restore`, and `--dry-run` flags integrated into `cmdMcpProfile` with full CLI routing
- 9 new tests covering all apply/restore paths: backup creation, server disabling, source filtering, config preservation, idempotency, restore, edge cases
- Bundle at exactly 500KB (trimmed verbose intent help text to compensate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement apply and restore functionality** - `f32b195` (feat)
2. **Task 2: Add tests for apply and restore operations** - `c4bfa26` (test)

## Files Created/Modified
- `src/commands/mcp.js` — Added applyRecommendations(), restoreBackup(); updated cmdMcpProfile with --apply/--restore/--dry-run; compacted existing code for bundle budget
- `src/lib/constants.js` — Updated COMMAND_HELP for mcp-profile (new flags) and mcp (new subcommand options); trimmed intent help text
- `bin/gsd-tools.cjs` — Bundled output (500KB, exactly at budget)
- `bin/gsd-tools.test.cjs` — 9 new test cases in apply-and-restore describe block

## Decisions Made
- Only opencode.json is mutated — .mcp.json (standard MCP format) has no standard `enabled: false` field, so servers from .mcp.json are skipped and noted in output
- Trimmed intent drift/trace/validate help text (~600 chars) to fit new code within 500KB bundle budget — functionality unchanged, just shorter help descriptions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bundle size exceeded 500KB budget**
- **Found during:** Task 1 (after initial implementation)
- **Issue:** New apply/restore functions + expanded COMMAND_HELP pushed bundle to 504KB, then 503KB, then 502KB
- **Fix:** Progressively compacted JSDoc comments, inline comments, section headers, and trimmed verbose intent help text entries
- **Files modified:** src/commands/mcp.js, src/lib/constants.js
- **Verification:** `npm run build` passes at exactly 500KB
- **Committed in:** f32b195 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Bundle budget constraint required code compaction. No functionality or test coverage affected.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 (MCP Server Profiling) complete — all 3 plans executed
- Full pipeline: discovery → estimation → relevance → recommendations → apply/restore
- Ready for Phase 20 (Structured Requirements)

---
*Phase: 19-mcp-server-profiling*
*Completed: 2026-02-25*
