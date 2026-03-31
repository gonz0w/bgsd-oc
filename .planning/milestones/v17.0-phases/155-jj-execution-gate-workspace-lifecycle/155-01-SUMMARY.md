---
phase: 155-jj-execution-gate-workspace-lifecycle
plan: 01
subsystem: infra
tags: [jj, workspace, init, config, testing]
requires:
  - phase: 154-end-to-end-fresh-context-proof-delivery
    provides: fresh-context execution handoff baseline
provides:
  - shared JJ prerequisite detection for execution init surfaces
  - workspace-first execute init metadata and scoped executor context
  - explicit legacy worktree config rejection with migration guidance
  - regression coverage for Git-only failure and JJ-backed success paths
affects: [phase-155-plan-02, execution-init, quick-init, executor-context]
tech-stack:
  added: [Jujutsu CLI detection]
  patterns: [authoritative CLI gating, workspace-first init contract, fail-fast legacy config rejection]
key-files:
  created: [src/lib/jj.js]
  modified: [src/commands/init.js, src/lib/config.js, src/lib/context.js, tests/init.test.cjs, tests/agent.test.cjs, bin/bgsd-tools.cjs]
key-decisions:
  - "Gate execution-oriented init through one shared JJ helper and leave read-only planning flows available in Git-only repos."
  - "Reject legacy `.planning/config.json.worktree` centrally instead of silently mapping it to workspace config."
  - "Expose workspace-first execution metadata to executor-scoped context so downstream execution stops teaching worktrees."
patterns-established:
  - "Execution prerequisite gate: use authoritative JJ CLI behavior plus Git detection to classify execution readiness."
  - "Workspace-first init contract: emit `workspace_*` metadata and remove `worktree_*` execution fields."
requirements-completed: [JJ-01, JJ-02]
one-liner: "JJ-gated execution init with workspace-first metadata and explicit legacy worktree rejection"
duration: 19 min
completed: 2026-03-29
---

# Phase 155 Plan 01: JJ Execution Gate & Workspace Lifecycle Summary

**JJ-gated execution init with workspace-first metadata and explicit legacy worktree rejection**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-29T15:43:39Z
- **Completed:** 2026-03-29T16:03:11Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added a shared JJ prerequisite helper and gated `init:execute-phase` plus `init:quick` so Git-only repos fail fast with `jj git init` guidance.
- Replaced execution init worktree metadata with workspace-first fields and rejected legacy `worktree` config centrally.
- Locked regression coverage for Git-only failure, JJ-backed success, executor-scoped workspace metadata, and legacy-config rejection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the shared JJ prerequisite gate** - `e24de19` (feat)
2. **Task 2: Replace execution init fields and reject legacy worktree config** - `a6cecd1` (feat)
3. **Task 3: Lock regression coverage for the new gate contract** - `d76fcde` (test)

**Additional fix:** `9386ec2` (`fix(155-01): include JJ setup guidance for Git-only repos`)

## Files Created/Modified
- `src/lib/jj.js` - Classifies JJ availability, Git-only repos, and execution gating guidance.
- `src/commands/init.js` - Gates execution-oriented init flows and emits workspace-first execute metadata.
- `src/lib/config.js` - Rejects legacy `worktree` config with explicit migration guidance.
- `src/lib/context.js` - Aligns executor-scoped init context with workspace-first metadata.
- `tests/init.test.cjs` - Covers Git-only failures, JJ-backed success, compact/manifest flows, and legacy config rejection.
- `tests/agent.test.cjs` - Verifies executor context exposes workspace metadata instead of worktree assumptions.
- `bin/bgsd-tools.cjs` - Bundled CLI updated to ship the new init/config behavior.

## Decisions Made
- Used a single shared JJ gate for `init:execute-phase` and `init:quick` so execution prep fails before users invest in unsupported Git-only flows.
- Treated a top-level `worktree` config block as a hard error so the phase teaches one supported migration path instead of a hidden compatibility shim.
- Added workspace metadata directly to executor-scoped context so downstream execution consumers can adopt the new contract immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserve `jj git init` guidance when JJ omits the hint line**
- **Found during:** Final verification
- **Issue:** A temp Git-only repo produced `There is no jj repo` without the hint line, so the user-facing error lost the explicit setup command.
- **Fix:** Added Git-repo fallback detection in `src/lib/jj.js` so Git-only repos always surface `jj git init` guidance.
- **Files modified:** `src/lib/jj.js`, `bin/bgsd-tools.cjs`
- **Verification:** Rebuilt CLI, reran targeted tests, and rechecked temp Git-only init output.
- **Committed in:** `9386ec2`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Narrow verification-driven fix only; no scope expansion.

## Review Findings

Review skipped — review context unavailable.

## Issues Encountered
- `jj root` did not always echo JJ's setup hint in the captured stderr for Git-only temp repos; a Git-backed fallback classification restored the required guidance deterministically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 155 plan 02 can now build on a stable workspace-first execution-init contract.
- JJ execution gating is complete; the remaining phase work is the user-facing workspace command family and related documentation/help surface.

## Self-Check

PASSED
- Found summary file and all referenced implementation files.
- Verified task commits `e24de19`, `a6cecd1`, `d76fcde`, and fix commit `9386ec2` exist locally.

---
*Phase: 155-jj-execution-gate-workspace-lifecycle*
*Completed: 2026-03-29*
