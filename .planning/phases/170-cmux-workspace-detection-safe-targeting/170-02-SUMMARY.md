---
phase: 170-cmux-workspace-detection-safe-targeting
plan: 02
subsystem: plugin
tags: [javascript, plugin, cmux, workspace-targeting, safety]
requires:
  - phase: 170-cmux-workspace-detection-safe-targeting
    provides: bounded cmux transport and inert adapter contract from plan 01
provides:
  - managed-terminal-first exact workspace proof from env plus identify agreement
  - compatibility-only alongside targeting via one exact normalized cwd match
  - machine-readable suppression for mismatches, ambiguity, and blocked alongside access
affects: [plugin, cmux, workspace-targeting, ambient-ux]
tech-stack:
  added: []
  patterns:
    - managed env evidence must agree with cmux identify before a workspace id is trusted
    - alongside fallback is exact-cwd-only and suppresses when zero or multiple candidates match
key-files:
  created: []
  modified:
    - src/plugin/cmux-targeting.js
    - tests/plugin-cmux-targeting.test.cjs
    - plugin.js
key-decisions:
  - "Conflicting managed evidence now suppresses immediately instead of dropping into cwd heuristics."
  - "Alongside targeting remains compatibility-only and only succeeds when access mode allows it and one normalized cwd match proves the workspace."
patterns-established:
  - "cmux target proof is managed-terminal-first, exact, and suppressive on ambiguity."
  - "Plugin-local targeting helpers return one proven workspace id or a machine-readable suppression reason."
requirements-completed: [CMUX-01, CMUX-07, CMUX-08]
one-liner: "cmux workspace targeting now trusts only env-plus-identify proof or one exact allowAll cwd match, suppressing mismatches and ambiguity."
duration: 5min
completed: 2026-03-31
---

# Phase 170 Plan 02: Managed-terminal-first exact workspace proof Summary

**cmux workspace targeting now trusts only env-plus-identify proof or one exact allowAll cwd match, suppressing mismatches and ambiguity.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T13:11:07Z
- **Completed:** 2026-03-31T13:16:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added focused regressions for managed env proof, access-mode gating, unique cwd proof, and ambiguity suppression.
- Implemented `resolveManagedWorkspaceTarget` and `resolveAlongsideWorkspaceTarget` so the plugin returns one proven workspace id or a suppression reason.
- Kept alongside fallback conservative: no best-guess matching and no fallback from conflicting managed evidence.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for exact workspace proof and ambiguity suppression**
   - `ee14058` — `test(170-02): add failing exact workspace proof regressions`
2. **Task 2: Implement managed-terminal proof and conservative alongside fallback**
   - `785c004` — `feat(170-02): prove cmux workspace targeting safely`

_Note: This TDD plan used RED/GREEN commits; no separate refactor commit was needed._

## TDD Audit Trail

Review the exact RED/GREEN proof package here.

### RED
- **Commit:** `ee14058` (`test(170-02): add failing exact workspace proof regressions`)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `✖ resolveCmuxAvailability proves a managed target when env and identify agree (2.440875ms)`

### GREEN
- **Commit:** `785c004` (`feat(170-02): prove cmux workspace targeting safely`)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/plugin-cmux-targeting.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 12`

### Machine-Readable Stage Proof
```json
{
  "task_1": {
    "red": {
      "commit": { "hash": "ee14058", "gsd_phase": "red" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 1,
        "matched_evidence_snippet": "✖ resolveCmuxAvailability proves a managed target when env and identify agree (2.440875ms)"
      }
    }
  },
  "task_2": {
    "green": {
      "commit": { "hash": "785c004", "gsd_phase": "green" },
      "proof": {
        "target_command": "npm run test:file -- tests/plugin-cmux-targeting.test.cjs",
        "exit_code": 0,
        "matched_evidence_snippet": "ℹ pass 12"
      }
    }
  }
}
```

## Files Created/Modified
- `tests/plugin-cmux-targeting.test.cjs` - regression coverage for managed proof, access-mode blocking, exact cwd targeting, and ambiguity suppression
- `src/plugin/cmux-targeting.js` - exact workspace-proof helpers and suppression logic for managed and alongside callers
- `plugin.js` - rebuilt plugin bundle including the narrowed targeting logic

## Decisions Made
- Managed-terminal targeting now requires `CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`, and `identify --json` agreement before trusting a workspace.
- Alongside targeting only runs for non-managed callers when access mode is `allowAll` and exactly one normalized workspace cwd matches the project directory.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context unavailable

## Issues Encountered
- `npm run build` refreshed repo-wide generated files such as `bin/manifest.json` and `skills/skill-index/SKILL.md`; task commits stayed path-scoped so unrelated dirty changes were preserved.

## User Setup Required

None - no external service configuration required.

## Auth Gates

None.

## Next Phase Readiness
- Phase 170 can now prove one target workspace safely before plan 03 adds reversible write-path proof and attached adapter methods.
- Multi-workspace ambiguity and conflicting managed evidence now suppress attachment instead of guessing.

## Self-Check

PASSED

- Verified required summary, source, test, and rebuilt runtime files exist on disk.
- Verified task commits `ee14058f` and `785c0040` exist in `jj log`.

---
*Phase: 170-cmux-workspace-detection-safe-targeting*
*Completed: 2026-03-31*
