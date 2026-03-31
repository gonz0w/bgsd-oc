---
phase: 156-jj-parallel-waves-recovery-coverage
plan: 03
subsystem: infra
tags: [jj, workspace, recovery, config, help, contracts]
requires:
  - phase: 155-jj-execution-gate-workspace-lifecycle
    provides: JJ-first workspace execution and legacy worktree rejection
provides:
  - Workspace-first config templates aligned with runtime support
  - Recovery-aware JJ workspace help and command discovery wording
  - Regression tests that catch config/help/workflow drift
affects: [phase-156, phase-157, workspace, execute-phase]
tech-stack:
  added: []
  patterns:
    - JJ-first workspace config examples stay aligned with runtime validation
    - Help and workflow guidance are locked with cross-surface contract tests
key-files:
  created: []
  modified:
    - templates/config.json
    - templates/config-full.json
    - src/lib/config.js
    - src/lib/constants.js
    - src/lib/command-help.js
    - src/lib/commandDiscovery.js
    - tests/contracts.test.cjs
    - tests/workflow.test.cjs
key-decisions:
  - "Shipped config examples now expose only `workspace` settings that runtime already supports."
  - "JJ workspace recovery wording is tested across help, discovery, workflow, and template surfaces to prevent drift."
patterns-established:
  - "Workspace-first config contract: examples, schema text, and migration errors point to the same `workspace` block."
  - "Cross-surface guidance tests: contract coverage reads repo-facing docs/help files directly to catch wording regressions."
requirements-completed: [JJ-06]
one-liner: "JJ-first workspace config templates plus recovery-aware help and drift-catching guidance tests"
duration: 4min
completed: 2026-03-29
---

# Phase 156 Plan 03: Align templates, config/help/discovery text, and regression coverage with the JJ-first workspace recovery model so repo-facing guidance matches what Phase 155 and Phase 156 actually support. Summary

**JJ-first workspace config templates plus recovery-aware help and drift-catching guidance tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T17:40:12Z
- **Completed:** 2026-03-29T17:44:52Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Replaced shipped `worktree` config examples with the supported `workspace` block so templates no longer teach a runtime-rejected shape.
- Updated workspace help and discovery text to describe JJ-first inspection, recovery, and cleanup as the supported execution model.
- Added contract tests that fail when templates, workflow guidance, and help surfaces drift away from Phase 156 workspace recovery behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace legacy worktree examples with supported workspace config** - `d861249` (chore)
2. **Task 2: Refresh help and discovery wording around recovery-capable workspaces** - `23c95e2` (docs)
3. **Task 3: Add drift-catching coverage for repo-facing JJ-first guidance** - `229ac6e` (test)

## Files Created/Modified

- `templates/config.json` - Default config now publishes the supported JJ `workspace` block.
- `templates/config-full.json` - Full config example now mirrors runtime-supported workspace settings.
- `src/lib/config.js` - Legacy worktree migration error now points users at supported workspace keys.
- `src/lib/constants.js` - Config schema and workspace help text now describe recovery-aware JJ workspaces.
- `src/lib/command-help.js` - Command briefs and aliases now surface workspace inspection and recovery.
- `src/lib/commandDiscovery.js` - Discovery metadata now categorizes workspace actions around recovery.
- `tests/contracts.test.cjs` - Locks template/runtime config alignment for JJ-first workspace guidance.
- `tests/workflow.test.cjs` - Locks help/discovery/workflow wording to the recovery-first workspace model.

## Decisions Made

- Reused only runtime-supported workspace fields (`base_path`, `max_concurrent`) in shipped templates so examples cannot drift ahead of implementation.
- Treated repo-facing workspace wording as a contract problem, not doc polish, and verified it by reading help/workflow/template sources directly in tests.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context available for commit/diff inspection only; no separate reviewer pass was run during this plan.

## Issues Encountered

- The broad `npm test` regression gate still fails in unrelated pre-existing suites (`yq` fallback/parity, some `init:execute-phase` integration expectations, intent/env, and trajectory coverage). Focused plan checks passed, so the plan deliverables were verified with targeted tests and the unrelated failures were left untouched.

## Next Phase Readiness

- JJ-first config/help/workflow guidance is now aligned and protected against drift.
- Remaining Phase 156 execution work can build on a stable public workspace contract without reintroducing legacy worktree examples.

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `d8612491`, `23c95e2d`, and `229ac6ee` exist in JJ history.

---
*Phase: 156-jj-parallel-waves-recovery-coverage*
*Completed: 2026-03-29*
