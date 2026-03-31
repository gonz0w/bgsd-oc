---
phase: 155-jj-execution-gate-workspace-lifecycle
plan: 02
subsystem: infra
tags: [jj, workspace, cli, workflow, testing]
requires:
  - phase: 155-jj-execution-gate-workspace-lifecycle
    provides: workspace-first execute init contract and JJ execution gating
provides:
  - top-level JJ-native workspace add/list/forget/cleanup/reconcile commands
  - JJ-first help discovery and execute workflow guidance without execute:worktree routing
  - real JJ workspace lifecycle coverage plus legacy execute:worktree rejection checks
affects: [phase-156, execution-workspaces, command-discovery, execute-workflow]
tech-stack:
  added: [JJ workspace command family]
  patterns: [top-level workspace lifecycle wrapper, JJ-first execution help, JJ-backed test fixtures]
key-files:
  created: [src/commands/workspace.js, tests/workspace.test.cjs]
  modified: [src/commands/init.js, src/router.js, src/lib/constants.js, src/lib/command-help.js, src/lib/commandDiscovery.js, workflows/execute-phase.md, tests/worktree.test.cjs, tests/helpers.cjs, tests/contracts.test.cjs, tests/state.test.cjs, tests/integration.test.cjs, bin/bgsd-tools.cjs, bin/manifest.json, plugin.js, skills/skill-index/SKILL.md]
key-decisions:
  - "Promoted execution isolation to a top-level `workspace` command family instead of keeping any `execute:*` worktree surface."
  - "Kept `workspace reconcile` intentionally validation-only in Phase 155 so stale recovery and op-log flows remain deferred to Phase 156."
  - "Updated broad regression fixtures to initialize JJ repos explicitly so the new execution gate is tested as the supported contract, not bypassed."
patterns-established:
  - "Managed JJ workspaces: derive deterministic `phase-plan` workspace names under the configured workspace base path and filter list/cleanup output to those managed paths."
  - "JJ-first execution surfaces: router, help, discovery, and workflow guidance must advertise `workspace` and reject `execute:worktree` as unsupported."
requirements-completed: [JJ-02, JJ-01]
one-liner: "Top-level JJ workspace lifecycle commands with JJ-first execution guidance and real workspace regression coverage"
duration: 14 min
completed: 2026-03-29
---

# Phase 155 Plan 02: JJ Execution Gate & Workspace Lifecycle Summary

**Top-level JJ workspace lifecycle commands with JJ-first execution guidance and real workspace regression coverage**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-29T16:07:12Z
- **Completed:** 2026-03-29T16:21:30Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments
- Shipped a top-level `workspace` command family for managed JJ workspace add, list, forget, cleanup, and minimal reconcile flows.
- Replaced user-facing `execute:worktree` help, discovery, and workflow guidance with JJ-first workspace execution language.
- Ported execution lifecycle coverage to real JJ-backed temp repos and verified legacy `execute:worktree` now fails as unsupported.

## Task Commits

Each task was committed atomically:

1. **Task 1: Ship the JJ-native workspace command family** - `b856335` (feat)
2. **Task 2: Rewrite execution surfaces to be visibly JJ-first** - `4e122e9` (feat)
3. **Task 3: Port worktree coverage to real JJ workspace tests** - `1db9f45` (test)

**Additional metadata refresh:** `f4ce529` (`chore(155-02): refresh generated CLI metadata`)

## Files Created/Modified
- `src/commands/workspace.js` - Implements managed JJ workspace add/list/forget/cleanup/reconcile commands plus shared overlap helpers.
- `src/commands/init.js` - Reads overlap metadata from the new workspace module.
- `src/router.js` - Routes top-level `workspace` commands and rejects legacy `execute:worktree` execution paths.
- `src/lib/constants.js` - Rewrites CLI help text around the workspace command family.
- `src/lib/command-help.js` - Surfaces `workspace` in command categories, briefs, and related-command guidance.
- `src/lib/commandDiscovery.js` - Registers workspace discovery metadata and removes execute-side worktree routing.
- `workflows/execute-phase.md` - Teaches workspace-based parallel execution and JJ-first reconcile/cleanup wording.
- `tests/workspace.test.cjs` - Covers real JJ workspace add/list/forget/cleanup/reconcile behavior.
- `tests/worktree.test.cjs` - Locks legacy `execute:worktree` rejection while `workspace list` still succeeds.
- `tests/helpers.cjs`, `tests/contracts.test.cjs`, `tests/state.test.cjs`, `tests/integration.test.cjs` - Initialize JJ in execution-init fixtures so broad regression coverage matches the new gate contract.
- `bin/bgsd-tools.cjs`, `bin/manifest.json`, `plugin.js`, `skills/skill-index/SKILL.md` - Regenerated shipped artifacts after the command-surface change.

## Decisions Made
- Promoted workspace lifecycle to a top-level `workspace` family so the supported execution-isolation path is visibly JJ-native.
- Kept `workspace reconcile` validation-only in this plan so deeper stale-workspace recovery can land cleanly in Phase 156.
- Treated JJ repo initialization as required fixture setup for execution-init tests, aligning broad regression coverage with the shipped execution gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Update execution-init regression fixtures for mandatory JJ gating**
- **Found during:** Final broad regression gate
- **Issue:** Contract, state, and integration fixtures that called `init:execute-phase` without a JJ repo began failing once the Phase 155 gate became authoritative.
- **Fix:** Added shared JJ test helpers and initialized JJ repos in execution-init fixtures so the regression suite exercises the supported path.
- **Files modified:** `tests/helpers.cjs`, `tests/contracts.test.cjs`, `tests/state.test.cjs`, `tests/integration.test.cjs`
- **Verification:** `npm run test:file -- tests/contracts.test.cjs tests/state.test.cjs tests/integration.test.cjs` and `npm run test:fast`
- **Committed in:** `1db9f45`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Narrow regression alignment only; no scope expansion beyond the shipped JJ-first execution contract.

## Review Findings

Review skipped — review context unavailable.

## Issues Encountered
- macOS temp paths surfaced as `/private/var/...` while config fixtures used `/var/...`, so managed-workspace filtering needed realpath normalization before list assertions would pass.
- `npm run test:fast` exposed older execution-init fixtures that still assumed Git-only repos; those fixtures were updated to initialize JJ explicitly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 155 is now ready to close with both plans complete and the visible execution path reset around JJ workspaces.
- Phase 156 can build on the new `workspace` family to add stale-workspace recovery, richer reconcile semantics, and parallel-wave orchestration.

## Self-Check

PASSED
- Found summary file and all referenced key implementation files.
- Verified task commits `b856335`, `4e122e9`, `1db9f45`, and metadata refresh commit `f4ce529` exist locally.

---
*Phase: 155-jj-execution-gate-workspace-lifecycle*
*Completed: 2026-03-29*
