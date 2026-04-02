---
phase: 184-deterministic-finalize-partial-wave-recovery
plan: 02
subsystem: infra
tags: [jj, workspace, finalize, deterministic, recovery]

# Dependency graph
requires:
  - phase: 184-01
    provides: wave-aware reconcile metadata with staged_ready and gating_sibling signals
provides:
  - deterministic `execute:finalize-wave` promotion in canonical plan order
  - shared wave recovery JSON that preserves staged-ready siblings across reruns
  - regression coverage for finish-order determinism and trusted-main reruns
affects: [phase-184, finalize, workspace-execution, recovery]

# Tech tracking
tech-stack:
  added: []
  patterns: [ordered-prefix wave promotion, trusted-main rerun recovery summaries]

key-files:
  created: []
  modified:
    - src/commands/misc/finalize.js
    - src/router.js
    - tests/finalize.test.cjs
    - bin/bgsd-tools.cjs
    - bin/manifest.json
    - skills/skill-index/SKILL.md

key-decisions:
  - "Expose deterministic sibling promotion as `execute:finalize-wave` so wave orchestration stays on the execute surface beside the existing single-plan finalizer."
  - "Regenerate one shared `184-wave-<wave>-recovery.json` artifact on every rerun so blocked and staged-ready siblings are derived from current disk truth rather than prior finish timing."

patterns-established:
  - "Wave finalize: inspect all wave siblings, promote only the longest healthy prefix, and leave later healthy siblings as staged_ready behind the first blocker."
  - "Trusted-main rerun: reuse workspace-local summary/proof artifacts and recompute shared recovery metadata instead of requiring sibling re-execution."

requirements-completed: [FIN-02, FIN-03, FIN-04]
one-liner: "Deterministic execute:finalize-wave promotion that preserves staged-ready siblings and regenerates canonical recovery metadata on rerun"

# Metrics
duration: 8 min
completed: 2026-04-02
---

# Phase 184 Plan 02: Deterministic Wave Finalize Summary

**Deterministic execute:finalize-wave promotion that preserves staged-ready siblings and regenerates canonical recovery metadata on rerun**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-02T03:03:09Z
- **Completed:** 2026-04-02T03:11:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added RED coverage proving wave finalize stays deterministic across healthy sibling finish-order permutations.
- Implemented `execute:finalize-wave` with canonical ordered-prefix promotion through existing shared-state mutators.
- Preserved later healthy siblings as `staged_ready` behind the first blocker and regenerated shared recovery JSON on rerun.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED coverage for ordered-prefix promotion and trusted-main reruns** - `68f38b8b` (test)
2. **Task 2: Implement the deterministic wave finalizer and ordered-prefix promotion** - `e7144cca` (feat)

**Plan metadata:** created in the final docs commit after summary/state updates.

## TDD Audit Trail

### RED
- **Commit:** `68f38b8b` (test: add failing wave finalize coverage)
- **GSD-Phase:** red
- **Target command:** `node --test tests/finalize.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `Unknown execute subcommand: finalize-wave`

### GREEN
- **Commit:** `e7144cca` (feat: implement deterministic wave finalize)
- **GSD-Phase:** green
- **Target command:** `npm run build && node --test tests/finalize.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `✔ wave finalize preserves staged-ready healthy siblings behind a blocker and promotes them on rerun after recovery`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "68f38b8b", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/finalize.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "Unknown execute subcommand: finalize-wave"
    }
  },
  "green": {
    "commit": { "hash": "e7144cca", "gsd_phase": "green" },
    "proof": {
      "target_command": "npm run build && node --test tests/finalize.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "✔ wave finalize preserves staged-ready healthy siblings behind a blocker and promotes them on rerun after recovery"
    }
  }
}
```

## Files Created/Modified
- `src/commands/misc/finalize.js` - adds wave-level deterministic promotion, recovery-summary generation, and rerun handling.
- `src/router.js` - exposes `execute:finalize-wave` on the execute surface.
- `tests/finalize.test.cjs` - locks canonical finish-order promotion and staged-ready rerun behavior.
- `bin/bgsd-tools.cjs` - rebuilt bundled CLI runtime with the new execute route.

## Decisions Made
- Reused the existing per-plan canonical mutators inside wave finalize instead of introducing new markdown patching logic.
- Persisted a shared `184-wave-2-recovery.json` artifact so reruns can report canonical blocker and staged-ready state from disk truth.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — reason: review context unavailable.

## Issues Encountered

- The RED proof path still relied on direct failing test output because the current `execute:tdd validate-red` surface is not yet part of this repo's normal execution path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 184 now has a trusted-main wave finalizer that produces deterministic shared state regardless of healthy sibling finish order.
- Plan 03 can surface truthful inventory and execution guidance from the new finalized vs staged-ready vs recovery-needed wave outputs.

## Self-Check: PASSED

- Summary file created at `.planning/phases/184-deterministic-finalize-partial-wave-recovery/184-02-SUMMARY.md`.
- Task commits `68f38b8b` and `e7144cca` verified in local history.
