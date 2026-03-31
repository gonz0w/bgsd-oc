---
phase: 170-cmux-workspace-detection-safe-targeting
plan: 01
subsystem: core
tags: [javascript, plugin, cmux, child-process, fail-open]
requires:
  - phase: 169-canonical-model-resolution-visibility
    provides: plugin runtime and test surfaces that Phase 170 can extend without changing non-cmux behavior
provides:
  - bounded cmux CLI execution with structured JSON and timeout results
  - explicit Phase 170 availability verdicts and suppression reasons
  - cached inert plugin adapter that preserves quiet fail-open startup
affects: [plugin, cmux, workspace-targeting, ambient-ux]
tech-stack:
  added: []
  patterns:
    - bounded plugin-local cmux transport isolates subprocess failures from plugin hooks
    - plugin startup caches one inert cmux adapter while later phases prove exact targeting
key-files:
  created:
    - src/plugin/cmux-cli.js
    - src/plugin/cmux-targeting.js
    - tests/plugin-cmux-targeting.test.cjs
  modified:
    - src/plugin/index.js
    - tests/plugin.test.cjs
    - plugin.js
key-decisions:
  - "Kept Phase 170 startup fail-open by classifying cmux availability into explicit verdicts and always returning an inert adapter instead of letting subprocess errors escape."
  - "Cached the plugin adapter by project and cmux env identity so repeated plugin startup checks reuse one verdict without making other subsystems cmux-aware."
patterns-established:
  - "cmux work should enter the plugin through one bounded transport and one verdict-producing adapter boundary."
  - "Available-but-unproven cmux sessions remain inert until later plans complete exact workspace proof and write-path proof."
requirements-completed: [CMUX-01, CMUX-08]
one-liner: "Bounded cmux transport helpers now classify availability and cache an inert plugin adapter that stays quiet when cmux is missing or unusable."
duration: 24min
completed: 2026-03-31
---

# Phase 170 Plan 01: Bounded cmux runner and inert adapter contract Summary

**Bounded cmux transport helpers now classify availability and cache an inert plugin adapter that stays quiet when cmux is missing or unusable.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-31T12:42:32Z
- **Completed:** 2026-03-31T13:06:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `src/plugin/cmux-cli.js` with bounded `cmux` command execution, JSON parsing helpers, and workspace-targeted sidebar reads.
- Added `src/plugin/cmux-targeting.js` with explicit availability verdicts, suppression reasons, and an inert adapter contract for later phases.
- Cached that inert adapter in plugin startup and locked missing-cmux plus suppressed-cmux fail-open behavior with focused regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a bounded cmux CLI runner with JSON helpers**
   - `bf30872` — `test(170-01): add failing cmux transport tests`
   - `d8165b5` — `feat(170-01): add bounded cmux transport helpers`
2. **Task 2: Add the availability verdict and inert adapter boundary to plugin startup**
   - `378ea53` — `test(170-01): add failing plugin cmux startup tests`
   - `c414680` — `feat(170-01): cache an inert cmux adapter at plugin startup`

_Note: This TDD plan used RED/GREEN commits for both tasks; no separate refactor commit was needed._

## TDD Audit Trail

Review the exact RED/GREEN proof package here.

### Task 1 — Bounded cmux runner

#### RED
- **Commit:** `bf30872` (`test(170-01): add failing cmux transport tests`)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `ERR_MODULE_NOT_FOUND`

#### GREEN
- **Commit:** `d8165b5` (`feat(170-01): add bounded cmux transport helpers`)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 6`

### Task 2 — Cached inert plugin adapter

#### RED
- **Commit:** `378ea53` (`test(170-01): add failing plugin cmux startup tests`)
- **GSD-Phase:** red
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux adapter fail-open contract" tests/plugin.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `resetCmuxAdapterCache is not a function`

#### GREEN
- **Commit:** `c414680` (`feat(170-01): cache an inert cmux adapter at plugin startup`)
- **GSD-Phase:** green
- **Target command:** `node --test --test-force-exit --test-name-pattern "Plugin cmux adapter fail-open contract" tests/plugin.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 2`

### Machine-Readable Stage Proof
```json
{
  "task_1": {
    "red": {
      "commit": { "hash": "bf30872e", "gsd_phase": "red" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 1,
        "matched_evidence_snippet": "ERR_MODULE_NOT_FOUND"
      }
    },
    "green": {
      "commit": { "hash": "d8165b58", "gsd_phase": "green" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 0,
        "matched_evidence_snippet": "ℹ pass 6"
      }
    }
  },
  "task_2": {
    "red": {
      "commit": { "hash": "378ea536", "gsd_phase": "red" },
      "proof": {
        "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux adapter fail-open contract\" tests/plugin.test.cjs",
        "exit_code": 1,
        "matched_evidence_snippet": "resetCmuxAdapterCache is not a function"
      }
    },
    "green": {
      "commit": { "hash": "c4146805", "gsd_phase": "green" },
      "proof": {
        "target_command": "node --test --test-force-exit --test-name-pattern \"Plugin cmux adapter fail-open contract\" tests/plugin.test.cjs",
        "exit_code": 0,
        "matched_evidence_snippet": "ℹ pass 2"
      }
    }
  }
}
```

## Files Created/Modified
- `src/plugin/cmux-cli.js` - bounded `cmux` command runner with JSON helpers and target flag support
- `src/plugin/cmux-targeting.js` - Phase 170 availability verdict logic plus inert adapter boundary
- `src/plugin/index.js` - plugin-level cached adapter initialization and reset hook for deterministic tests
- `tests/plugin-cmux-targeting.test.cjs` - focused transport and verdict regressions
- `tests/plugin.test.cjs` - plugin startup regressions for cached fail-open behavior
- `plugin.js` - rebuilt plugin runtime bundle with the new adapter cache surface

## Decisions Made
- Kept all Phase 170 adapter methods inert even when cmux is available, so later plans can add exact target proof without changing the caller contract.
- Used explicit suppression reasons such as `cmux-missing`, `capabilities-unavailable`, and `access-mode-blocked` instead of leaving later phases to infer intent from raw subprocess errors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `src/plugin/*.js` source files are not directly importable by the local Node test runner in this workspace, so the focused transport test copies the new modules to temporary `.mjs` fixtures before importing them. This kept task-local source proof deterministic without widening plugin runtime scope.
- The broader `npm run test:fast` regression gate exposed pre-existing unrelated failures in the legacy phase-160 additive contract and phase-165 repo-local runtime truth suites, then timed out after those broader runs. Focused cmux tests and `npm run build` passed, so the Phase 170 slice remained verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 170 now has one bounded cmux transport and one inert adapter contract for exact target proof work in Plan 02.
- Later workspace-status plans can reuse the cached adapter boundary without teaching notifier, watcher, or validator modules about cmux yet.

## Self-Check
PASSED

- Verified required source, test, and summary files exist on disk.
- Verified RED/GREEN task commits `bf30872`, `d8165b5`, `378ea53`, and `c414680` exist in `jj log`.

---
*Phase: 170-cmux-workspace-detection-safe-targeting*
*Completed: 2026-03-31*
