---
phase: 129-foundation-agent-overrides
plan: 01
subsystem: cli
tags: [agent-overrides, yaml-validation, unified-diff, lcs, sanitization]
requires: []
provides:
  - validateAgentFrontmatter function (YAML frontmatter validation with name field check)
  - sanitizeAgentContent function (injection marker stripping, editor name normalization)
  - generateUnifiedDiff function (pure-JS LCS unified diff, zero dependencies)
  - agent:list-local command (scope + drift table for all global agents)
affects:
  - Phase 129 Plan 02 (override creation uses validateAgentFrontmatter and sanitizeAgentContent)
  - Phase 129 Plan 03 (diff and sync use generateUnifiedDiff)
tech-stack:
  added: []
  patterns:
    - "LCS-based unified diff: O(mn) DP approach for files <500 lines, zero external deps"
    - "Generic sanitization: regex-based editor name replacement excluding path-like contexts"
key-files:
  created: []
  modified: [src/commands/agent.js, src/router.js, bin/bgsd-tools.cjs]
key-decisions:
  - "LCS DP approach for generateUnifiedDiff — agent files are small (<500 lines), O(mn) is acceptable"
  - "sanitizeAgentContent uses regex lookbehind to exclude path contexts (.opencode/agents/) from replacement"
  - "cmdAgentListLocal uses output() helper with raw flag for JSON, direct console.log for formatted table"
patterns-established:
  - "Pattern: Utility functions added above command functions in agent.js, exported from module.exports"
requirements-completed: [LOCAL-05, LOCAL-06, LOCAL-01]
one-liner: "YAML validation, content sanitization, and LCS-based unified diff utilities plus agent:list-local scope/drift table command"
duration: 11min
completed: 2026-03-15
---

# Phase 129 Plan 01: Foundation Utilities and agent:list-local Summary

**YAML validation, content sanitization, and LCS-based unified diff utilities plus agent:list-local scope/drift table command**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-15T17:45:40Z
- **Completed:** 2026-03-15T17:57:17Z
- **Tasks:** 2
- **Files modified:** 3

## Task Commits

Each task was committed atomically:

1. **Task 1: Add YAML validation, content sanitization, and unified diff utilities** - `b97b83a` (feat)
2. **Task 2: Implement agent:list-local command with scope and drift annotations** - `147318d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/commands/agent.js` - Added three utility functions (validateAgentFrontmatter, sanitizeAgentContent, generateUnifiedDiff) and cmdAgentListLocal command
- `src/router.js` - Registered `list-local` subcommand under `util agent` namespace
- `bin/bgsd-tools.cjs` - Rebuilt bundle with all additions

## Accomplishments

- **YAML validation infrastructure**: `validateAgentFrontmatter` checks for `---` delimiters and required `name:` field, returning structured error objects with line numbers where available — used by override creation in Plan 02
- **Content sanitization**: `sanitizeAgentContent` strips `<system>`, `[INST]`, and triple-backtick system injection markers, normalizes editor name references to 'OC' while preserving path contexts like `.opencode/agents/`
- **Zero-dependency unified diff**: `generateUnifiedDiff` implements LCS via O(mn) DP backtracking with 3-line context, producing standard `--- / +++ / @@ -N,M +N,M @@` formatted output — shared by diff and sync commands
- **agent:list-local command**: Shows all global agents in columnar table with scope (`global`/`local-override`) and drift (`✓`/`Δ`) annotations; reads overrides from `.opencode/agents/` relative to cwd

## Decisions Made

- **LCS DP for diff**: Used O(mn) DP approach — agent files are <500 lines so quadratic is fine; avoids any external dependency on diff libraries
- **sanitizeAgentContent regex lookbehind**: Used `(?<![./])(?<!\w)` to prevent replacing `opencode` in path contexts like `.opencode/agents/` while still replacing standalone references like "Use opencode"
- **list-local uses console.log for table**: When not in raw mode, directly writes formatted table rows rather than using the `output()` helper (which doesn't support columnar formatting)

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — no post-execution review performed for this plan.

## Issues Encountered

None.

## Next Phase Readiness

- Foundation utilities are complete and exported, ready for use by Plan 02 (agent:override) and Plan 03 (agent:diff, agent:sync)
- `.opencode/agents/` path confirmed as local override directory (not `.planning/agents/`)
- All three utilities verified functional: validation, sanitization, and diff generation

---
*Phase: 129-foundation-agent-overrides*
*Completed: 2026-03-15*
