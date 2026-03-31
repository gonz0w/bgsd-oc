---
phase: 156-jj-parallel-waves-recovery-coverage
plan: 01
subsystem: cli
tags:
  - jj
  - workspace
  - recovery
  - commonjs
  - json
  - markdown
  - javascript
requires:
  - phase: 155-jj-execution-gate-workspace-lifecycle
    provides: validation-only workspace lifecycle commands and JJ execution gating
provides:
  - JJ-backed workspace status classification with op-log diagnostics
  - preview-first reconcile payloads for stale and divergent workspaces
  - retention-aware cleanup that preserves recovery breadcrumbs
affects:
  - phase-156-wave-orchestration
  - execution-workspaces
  - workspace-recovery
tech-stack:
  added: []
  patterns:
    - JJ workspace diagnostics helper shared by command surfaces
    - preview-first recovery payloads before any workspace mutation
key-files:
  created: [src/lib/jj-workspace.js]
  modified:
    - bin/bgsd-tools.cjs
    - bin/manifest.json
    - skills/skill-index/SKILL.md
    - src/commands/workspace.js
    - src/lib/jj.js
    - tests/helpers.cjs
    - tests/workspace.test.cjs
key-decisions:
  - "Classify managed workspaces from JJ command results (`jj status`, `jj op log`) instead of filesystem-only guesses so recovery output stays auditable."
  - "Keep reconcile preview-only for recoverable cases and reserve cleanup for healthy workspaces so failed breadcrumbs remain inspectable."
patterns-established:
  - "Workspace diagnostics return explicit `status`, `diagnostics`, and bounded `op_log` evidence together."
  - "Cleanup retains `recovery_needed` workspaces and reports them separately from deleted healthy workspaces."
requirements-completed: [JJ-03, JJ-04]
one-liner: "JJ workspace reconcile now classifies healthy, stale, and divergent states with op-log evidence and preview-first recovery guidance"
duration: 20min
completed: 2026-03-29
---

# Phase 156 Plan 01: Turn the top-level `workspace` family from a Phase 155 lifecycle shell into a real inspection and recovery surface with JJ-backed status classification, op-log diagnostics, and preview-first recovery behavior. Summary

**JJ workspace reconcile now classifies healthy, stale, and divergent states with op-log evidence and preview-first recovery guidance**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-29T17:16:20Z
- **Completed:** 2026-03-29T17:36:07Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added a shared `jj-workspace` helper that inspects managed workspaces with `jj status` and `jj op log`, classifying healthy, stale, divergent, failed, and missing cases with structured evidence.
- Upgraded `workspace list`, `workspace reconcile`, and `workspace cleanup` so stale or conflicted workspaces surface preview-first recovery guidance and cleanup preserves recovery breadcrumbs.
- Locked the new contract with real JJ temp-repo coverage for stale rewrites, conflicted update-stale flows, and retention-aware cleanup behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shared JJ workspace diagnostics and state classification** - `90e0929` (feat)
2. **Task 2: Implement preview-first recovery and retention-aware cleanup behavior** - `e853543` (feat)
3. **Task 3: Lock real JJ regression coverage for stale, divergent, and recovery scenarios** - `e665d63` (test)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+345/-341]
- `bin/manifest.json` [+1/-1]
- `skills/skill-index/SKILL.md` [+1/-1]
- `src/commands/workspace.js` [+29/-11]
- `src/lib/jj-workspace.js` [+180/-0]
- `src/lib/jj.js` [+25/-0]
- `tests/helpers.cjs` [+65/-0]
- `tests/workspace.test.cjs` [+75/-28]

## Decisions Made

- Used JJ command output as the source of truth for workspace status so future workflow layers can reuse auditable diagnostics instead of reconstructing state heuristically.
- Kept recovery preview-first by returning `recovery_preview` and `recovery_allowed` metadata from `workspace reconcile` rather than mutating stale workspaces automatically.
- Treated cleanup as safe only for healthy workspaces, preserving stale or divergent workspaces until recovery is complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stabilized JJ test fixtures so workspace config survives stale-workspace rewrites**
- **Found during:** Task 3 (real JJ regression coverage)
- **Issue:** The temp-repo fixture left `.planning/config.json` only in the active working copy, so stale-rewrite helpers could move config files into the simulated workspace change and break later command discovery.
- **Fix:** Snapshot and commit the fixture setup before stale/divergent rewrites so workspace config remains part of the repo baseline during JJ recovery simulations.
- **Files modified:** `tests/helpers.cjs`
- **Verification:** `npm run test:file -- tests/workspace.test.cjs`
- **Committed in:** `e665d63`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Narrow fixture hardening only; no scope expansion beyond making the planned JJ recovery coverage reliable.

## Issues Encountered

- JJ stale-workspace simulation initially consumed uncommitted `.planning` fixture files during `jj squash`, which hid managed workspaces until the fixture baseline was committed first.
- Divergent workspace diagnostics were noisy because JJ created cache artifacts inside temp repos; the summary now prefixes conflict evidence so the recovery signal stays obvious.

## Next Phase Readiness

- Phase 156 plan 02 can now consume a stable command-layer contract: `status`, `diagnostics`, `recovery_allowed`, and `recovery_preview` are available for execution-wave orchestration.
- Active workspace cleanup now preserves stale/divergent breadcrumbs, so wave-level reporting can distinguish healthy completions from recovery-needed work without losing evidence.

## Self-Check

PASSED
- Found summary file and key implementation files: `src/lib/jj-workspace.js`, `src/commands/workspace.js`, and `tests/workspace.test.cjs`.
- Verified task commits `90e0929c`, `e8535435`, and `e665d63c` exist locally.

---
*Phase: 156-jj-parallel-waves-recovery-coverage*
*Completed: 2026-03-29*
