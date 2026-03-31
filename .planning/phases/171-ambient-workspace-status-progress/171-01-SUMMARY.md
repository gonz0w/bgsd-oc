---
phase: 171-ambient-workspace-status-progress
plan: 01
subsystem: plugin
tags: [javascript, commonjs]
provides:
  - canonical ambient snapshot derivation for workspace state, context, and progress trust
  - regression coverage for action-first state precedence and workflow-first context labels
affects: [cmux, plugin, sidebar-status, sidebar-progress]
tech-stack:
  added: []
  patterns: [pure snapshot derivation, workflow-first context fallback, exact-vs-activity progress gating]
key-files:
  created:
    - src/plugin/cmux-sidebar-snapshot.js
    - tests/plugin-cmux-sidebar-snapshot.test.cjs
  modified:
    - src/plugin/cmux-sidebar-snapshot.js
    - tests/plugin-cmux-sidebar-snapshot.test.cjs
key-decisions:
  - "Kept sidebar truth in one pure helper so later cmux writes can consume a single deterministic contract."
  - "Preferred workflow labels like Planning and Verifying over structural labels when the workflow signal is directly trustworthy."
  - "Classified progress as exact, activity, or hidden so the plugin never implies fake numeric precision."
patterns-established:
  - "Action-first state precedence: Input needed > Blocked > Warning > Working > Complete > Idle"
  - "Workflow-first context with structural fallback only when workflow meaning is absent"
requirements-completed: [CMUX-02, CMUX-03, CMUX-04]
one-liner: "Pure ambient snapshot derivation for trustworthy cmux workspace state, workflow-aware context, and exact-versus-activity progress gating"
duration: 67min
completed: 2026-03-31
---

# Phase 171 Plan 01: Create the shared ambient snapshot contract that later `cmux` writes can trust. Summary

**Pure ambient snapshot derivation for trustworthy cmux workspace state, workflow-aware context, and exact-versus-activity progress gating**

## Performance

- **Duration:** 67 min
- **Started:** 2026-03-31 07:49:43 -0600
- **Completed:** 2026-03-31 08:57:08 -0600
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added focused regressions that lock action-first state precedence, workflow-first context fallback, and non-deceptive progress handling before later cmux sync work lands.
- Implemented `src/plugin/cmux-sidebar-snapshot.js` as a pure helper that derives stable primary state, trustworthy compact context, and explicit progress modes from existing plugin truth.
- Preserved conservative trust gates so weak or stale signals hide progress or degrade context instead of guessing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for stable state precedence and trust gating** - `ad2896d` (`test`)
2. **Task 2: Implement the shared ambient snapshot helper** - `5e69077` (`feat`)
3. **Task 2 cleanup: clean up canonical ambient cmux snapshot** - `396fb23` (`refactor`)
4. **Task 1 support fix: stabilize snapshot source loading** - `dc1c39e` (`test`)

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `ad2896d` (test: test(171-01): add failing test for canonical ambient cmux snapshot)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ Input needed outranks Blocked when trustworthy signals compete (1.297709ms)`
- **Expected / observed:** fail → fail

### GREEN
- **Commit:** `5e69077` (feat: feat(171-01): implement canonical ambient cmux snapshot)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 6`
- **Expected / observed:** pass → pass

### REFACTOR
- **Commit:** `396fb23` (refactor: refactor(171-01): clean up canonical ambient cmux snapshot)
- **GSD-Phase:** refactor
- **Target command:** `npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 6`
- **Expected / observed:** pass → pass

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "ad2896d12b2b90e4b1d719b51cbf3433978713ce",
      "message": "test(171-01): add failing test for canonical ambient cmux snapshot",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ Input needed outranks Blocked when trustworthy signals compete (1.297709ms)",
      "expected_outcome": "fail",
      "observed_outcome": "fail"
    }
  },
  "green": {
    "commit": {
      "hash": "5e69077c2c1ce4b5cc6a1548a2c743a663fbb498",
      "message": "feat(171-01): implement canonical ambient cmux snapshot",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 6",
      "expected_outcome": "pass",
      "observed_outcome": "pass"
    }
  },
  "refactor": {
    "commit": {
      "hash": "396fb23b0e24e8af38a13d76d0aef32b14c08105",
      "message": "refactor(171-01): clean up canonical ambient cmux snapshot",
      "gsd_phase": "refactor"
    },
    "proof": {
      "target_command": "npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 6",
      "expected_outcome": "pass",
      "observed_outcome": "pass"
    }
  }
}
```

## Files Created/Modified

- `src/plugin/cmux-sidebar-snapshot.js` [+177/-0]
- `tests/plugin-cmux-sidebar-snapshot.test.cjs` [+149/-0]

## Decisions Made

- Centralized ambient sidebar truth in a pure helper so Plan 02 can reuse one contract instead of scattering cmux-specific precedence logic across hooks.
- Treated workflow meaning as the preferred compact context source because labels like `Planning` and `Verifying` communicate trustworthy current intent better than raw phase or plan numbers.
- Split progress into `exact`, `activity`, and `hidden` modes so active work can stay visible without inventing percentages when trustworthy counts are unavailable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stabilized direct source loading inside the focused regression file**
- **Found during:** Task 2 (Implement the shared ambient snapshot helper)
- **Issue:** The new regression file imported the source module directly from a CommonJS test context, which caused Node to parse the ESM source file with the wrong loader once implementation existed.
- **Fix:** Updated the test helper to load the source file contents through an inline `data:` module import so the focused regression runs against the live source contract without bundle indirection.
- **Files modified:** tests/plugin-cmux-sidebar-snapshot.test.cjs
- **Verification:** `npm run test:file -- tests/plugin-cmux-sidebar-snapshot.test.cjs`
- **Committed in:** dc1c39e

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix preserved the intended focused regression surface without changing the plan scope or runtime contract.

## Issues Encountered

- Initial RED proof failed as a missing-target condition because the focused test imported a not-yet-created module; after implementation, the same loader path exposed a Node CJS-versus-ESM parsing mismatch. The focused regression was updated to import the source through a `data:` module so TDD proof stayed targeted and deterministic.

## Next Phase Readiness

- Plan 02 can now wire attached cmux sidebar writes against one deterministic snapshot helper instead of duplicating precedence and trust logic in plugin hooks.
- The new focused regression file protects state precedence, workflow context, and progress-mode behavior so later integration work can verify wiring without reopening the contract.

## Self-Check: PASSED

---
*Phase: 171-ambient-workspace-status-progress*
*Completed: 2026-03-31*
