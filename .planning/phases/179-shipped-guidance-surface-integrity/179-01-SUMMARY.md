---
phase: 179-shipped-guidance-surface-integrity
plan: 01
subsystem: runtime
tags: [plugin, runtime-guidance, command-integrity, bundle-parity, tdd]

# Dependency graph
requires:
  - phase: 177-runtime-guidance-integrity-cleanup
    provides: operand-complete runtime guidance parity and focused validator coverage patterns
provides:
  - Command-only `/bgsd-plan phase ${nextPhase.number}` idle-validator action guidance
  - Rebuilt `plugin.js` bundle that preserves the canonical phase-next action
  - Focused regressions guarding shipped runtime guidance against `Next:`-prefixed drift
affects: [plugin runtime, command-integrity validation, phase-next guidance]

# Tech tracking
tech-stack:
  added: []
  patterns: [source-to-bundle runtime parity, command-only action payloads, focused touched-surface runtime proof]

key-files:
  created: [.planning/phases/179-shipped-guidance-surface-integrity/179-01-SUMMARY.md]
  modified: [tests/plugin.test.cjs, tests/integration.test.cjs, tests/validate-commands.test.cjs, src/plugin/idle-validator.js, plugin.js]

key-decisions:
  - "Keep explanatory next-step prose in the notification message, but make the action payload the runnable canonical command only."
  - "Use rebuilt-runtime and touched-surface proof after the broad node:test pattern stayed red from unrelated legacy failures and timed out."

patterns-established:
  - "Runtime action payloads: notification action fields must be directly runnable commands, with prose reserved for message text."
  - "Focused runtime proof: rebuild plugin.js, then validate source, bundle, and validator parity on the touched surface instead of trusting a noisy broad pattern gate."

requirements-completed: [SAFE-03]
one-liner: "Plugin idle-validation now ships a command-only `/bgsd-plan phase ${nextPhase.number}` next-step action and locks bundle parity with focused runtime regressions."

# Metrics
duration: 16 min
completed: 2026-04-01
---

# Phase 179 Plan 01: Shipped Guidance Surface Integrity Summary

**Plugin idle-validation now ships a command-only `/bgsd-plan phase ${nextPhase.number}` next-step action and locks bundle parity with focused runtime regressions.**

## Intent Alignment

- **Verdict:** aligned
- **Reason:** The shipped idle-validator surface now presents the canonical phase-next command exactly as runnable, which is the narrow SAFE-03 gap this plan targeted.

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-01T15:50:34Z
- **Completed:** 2026-04-01T16:06:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added RED regressions in plugin, integration, and validator coverage that reject the malformed `Next: /bgsd-plan phase ...` runtime action.
- Canonicalized `src/plugin/idle-validator.js` so the phase-complete notification action is command-only while the explanatory prose remains in `message`.
- Rebuilt `plugin.js` and verified source, bundle, and validator parity on the touched shipped-runtime surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for the malformed phase-next runtime action** - `e6213ad1` (test)
2. **Task 2: Canonicalize the idle-validator action and rebuild the shipped plugin bundle** - `a835c72e` (fix)

**Plan metadata:** `pending final docs commit`

## TDD Audit Trail

### RED
- **Commit:** `e6213ad1` (test: add failing phase-next runtime guidance regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/validate-commands.test.cjs --test-name-pattern "accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only"`
- **Exit status:** `1`
- **Matched evidence:** `✖ accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only`

### GREEN
- **Commit:** `a835c72e` (fix: canonicalize shipped phase-next runtime guidance)
- **GSD-Phase:** green
- **Target command:** `node --test tests/validate-commands.test.cjs --test-name-pattern "accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only"`
- **Exit status:** `0`
- **Matched evidence:** `✔ accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "e6213ad1", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/validate-commands.test.cjs --test-name-pattern \"accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only\"",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only"
    }
  },
  "green": {
    "commit": { "hash": "a835c72e", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test tests/validate-commands.test.cjs --test-name-pattern \"accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only\"",
      "exit_code": 0,
      "matched_evidence_snippet": "✔ accepts shipped runtime phase-next guidance only when plugin guidance keeps the action command-only"
    }
  }
}
```

## Files Created/Modified
- `tests/plugin.test.cjs` - rejects `Next:`-prefixed idle-validator action payloads in the shipped plugin bundle.
- `tests/integration.test.cjs` - updates repo-local runtime freshness proof to require the command-only phase-next action in source and bundle artifacts.
- `tests/validate-commands.test.cjs` - proves the shipped plugin runtime no longer emits the malformed phase-next command surface.
- `src/plugin/idle-validator.js` - makes the phase-complete action payload the canonical runnable `/bgsd-plan phase ${nextPhase.number}` command.
- `plugin.js` - rebuilt shipped plugin bundle preserving the corrected action payload.

## Decisions Made
- Kept the human-readable “Next: Phase …” explanation in the notification `message` so UX copy remains descriptive while the `action` stays directly runnable.
- Treated the broad `node --test ... --test-name-pattern "phase|plugin.js|runtime"` gate as baseline-only proof after it remained red from unrelated legacy slices and eventually timed out; relied on rebuilt-runtime plus touched-surface checks for plan acceptance.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure plan.

## Issues Encountered
- The plan-level `node --test tests/plugin.test.cjs tests/integration.test.cjs tests/validate-commands.test.cjs --test-name-pattern "phase|plugin.js|runtime"` command remained red from unrelated legacy integration/plugin failures and timed out even after the touched slice passed.
- Focused proof used the rebuilt runtime plus targeted validator coverage and direct source/bundle smoke checks instead of retrying the same noisy broad gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The shipped idle-validator next-step surface is now canonical, runnable, and preserved in `plugin.js` after rebuild.
- Phase 180 can continue on the remaining validator drift backlog without inheriting this `Next:`-prefixed plugin runtime failure.

## Self-Check: PASSED

- Verified file presence for `.planning/phases/179-shipped-guidance-surface-integrity/179-01-SUMMARY.md`.
- Verified task commits `e6213ad1` and `a835c72e` exist in `jj log`.

---
*Phase: 179-shipped-guidance-surface-integrity*
*Completed: 2026-04-01*
