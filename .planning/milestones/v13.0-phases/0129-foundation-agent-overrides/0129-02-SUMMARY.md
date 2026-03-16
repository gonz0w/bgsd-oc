---
phase: 129-foundation-agent-overrides
plan: 02
subsystem: cli
tags: [agent-overrides, unified-diff, fuzzy-matching, yaml-injection]
requires:
  - phase: 129-foundation-agent-overrides plan 01
    provides: validateAgentFrontmatter, generateUnifiedDiff utilities used by override and diff commands
provides:
  - agent:override command (copy global agent to .opencode/agents/ with name: field injection and YAML validation)
  - agent:diff command (unified diff between local override and global counterpart)
  - findClosestAgent helper (prefix/substring fuzzy matching for agent name suggestions)
  - injectNameField helper (injects name: field into YAML frontmatter when missing)
affects:
  - Phase 129 Plan 03 (agent:sync uses same override infrastructure)
tech-stack:
  added: []
  patterns:
    - "Fuzzy agent matching: prefix-length scoring with substring containment, best match returned (longest prefix wins)"
    - "Name field injection: detect missing name: field in frontmatter, inject before first field, re-validate"
key-files:
  created: []
  modified: [src/commands/agent.js, src/router.js, bin/bgsd-tools.cjs]
key-decisions:
  - "findClosestAgent scores by prefix length (not agent name length) — bgsd-exector correctly maps to bgsd-executor via 9-char prefix"
  - "injectNameField always adds name: as first field in frontmatter — global agents lack name: field, so all overrides show a diff showing the injected field"
  - "agent:diff silent exit (no output) when files identical — raw mode returns {identical:true, diff:null}"
patterns-established:
  - "Pattern: New agent subcommands registered with else-if chain in router.js util:agent block, export added to module.exports"
requirements-completed: [LOCAL-02, LOCAL-04, LOCAL-05]
one-liner: "agent:override copies global agent to .opencode/agents/ with name: field injection and YAML validation; agent:diff shows unified diff with silent exit when identical"
duration: 11min
completed: 2026-03-15
---

# Phase 129 Plan 02: Override and Diff Commands Summary

**agent:override copies global agent to .opencode/agents/ with name: field injection and YAML validation; agent:diff shows unified diff with silent exit when identical**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-15T18:00:06Z
- **Completed:** 2026-03-15T18:11:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **agent:override command**: Creates project-local agent copies in `.opencode/agents/` with automatic `name:` field injection (global agents lack this field), YAML validation, fuzzy suggestion on typo, duplicate guard with diff/sync hint, and silent directory creation
- **agent:diff command**: Shows standard unified diff between local override and global counterpart; exits silently (no output) when files are identical; errors with override hint if no local copy exists
- **findClosestAgent helper**: Scores candidates by longest common prefix (not shortest name), fixing a bug where same-prefix agents (all start with "bgsd-") would return wrong suggestion

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement agent:override command** - `f351490` (feat)
2. **Task 2: Implement agent:diff command** - `efa6304` (feat)

## Files Created/Modified

- `src/commands/agent.js` - Added cmdAgentOverride, cmdAgentDiff, findClosestAgent, injectNameField functions; exported all from module.exports
- `src/router.js` - Registered `override` and `diff` subcommands in util:agent block; updated error message listing
- `bin/bgsd-tools.cjs` - Rebuilt bundle with all additions

## Decisions Made

- **findClosestAgent scoring**: Changed from "return shortest name" to "return highest prefix score" — bgsd-exector initially suggested bgsd-planner (shortest name) instead of bgsd-executor (9-char prefix match). Score-based sorting fixes this.
- **injectNameField**: All global agents lack a `name:` field (the Anthropic auth plugin rewrites it), so all overrides will always include the injected field, causing a permanent diff between local and global. This is expected and correct — the local copy has the required YAML field.
- **Raw mode for agent:diff**: When identical, returns `{agent, diff: null, identical: true}` in JSON mode. Human-readable mode exits silently with no output, matching CONTEXT.md specification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findClosestAgent scoring by prefix length instead of agent name length**
- **Found during:** Task 1 verification
- **Issue:** Original implementation sorted matches by agent name length (shortest first), returning "bgsd-planner" for "bgsd-exector" instead of "bgsd-executor" — wrong suggestion
- **Fix:** Changed to score-based sorting where prefix length determines match quality; ties broken by agent name length
- **Files modified:** src/commands/agent.js
- **Verification:** `agent override bgsd-exector` now correctly suggests "bgsd-executor"
- **Committed in:** f351490 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was essential for correctness of fuzzy suggestion. No scope creep.

## Review Findings

Review skipped — no post-execution review performed for this plan.

## Issues Encountered

None.

## Next Phase Readiness

- agent:override and agent:diff are complete and functional; ready for Plan 03 (agent:sync)
- All test suite passes (1867 tests, 0 failures)
- `.opencode/agents/` path confirmed as local override directory, consistent with Plan 01 decision

---
*Phase: 129-foundation-agent-overrides*
*Completed: 2026-03-15*
