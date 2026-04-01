---
phase: 177-runtime-guidance-integrity-cleanup
plan: 01
subsystem: runtime
tags: [plugin, runtime-guidance, roadmap, command-integrity, tdd]

# Dependency graph
requires:
  - phase: 175-canonical-command-surface-alignment
    provides: canonical /bgsd-plan roadmap command shapes and validator expectations
provides:
  - Operand-complete roadmap follow-up guidance in plugin advisory warnings
  - Rebuilt plugin and CLI runtimes that preserve the corrected roadmap strings
  - Focused regressions covering runtime guidance parity and the plugin roadmap validator gap
affects: [plugin runtime, command-integrity validation, roadmap guidance]

# Tech tracking
tech-stack:
  added: []
  patterns: [source-to-bundle runtime parity, focused command-integrity regression coverage]

key-files:
  created: [.planning/phases/177-runtime-guidance-integrity-cleanup/177-01-SUMMARY.md]
  modified: [tests/plugin-advisory-guardrails.test.cjs, tests/validate-commands.test.cjs, src/plugin/advisory-guardrails.js, src/lib/commandDiscovery.js, plugin.js, bin/bgsd-tools.cjs]

key-decisions:
  - "Keep roadmap advisory strings in placeholder form, but make them operand-complete so source and shipped runtime stay canonical without baking in sample values."
  - "Broaden slash-command extraction just enough to retain quoted roadmap placeholders during validation instead of creating a plugin-only validator exception."

patterns-established:
  - "Runtime guidance parity: update src/plugin/* first, rebuild plugin.js immediately, then verify the shipped runtime surface."
  - "Focused validator proof: use touched-surface assertions plus one baseline util:validate-commands run to separate the fixed gap from unrelated backlog."

requirements-completed: [SAFE-03]
one-liner: "Operand-complete /bgsd-plan roadmap add|remove|insert guidance now ships from plugin runtime warnings and stays covered by focused validator regressions."

# Metrics
duration: 8 min
completed: 2026-04-01
---

# Phase 177 Plan 01: Runtime Guidance Integrity Cleanup Summary

**Operand-complete /bgsd-plan roadmap add|remove|insert guidance now ships from plugin runtime warnings and stays covered by focused validator regressions.**

## Intent Alignment

- **Verdict:** aligned
- **Reason:** The shipped runtime now surfaces runnable canonical roadmap follow-up syntax with required operands, which is the core expected user-visible change for this phase.

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T13:04:07Z
- **Completed:** 2026-04-01T13:09:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Tightened RED coverage so runtime advisory warnings must include full roadmap add/remove/insert operand shapes.
- Canonicalized `src/plugin/advisory-guardrails.js` roadmap guidance and rebuilt `plugin.js` so shipped runtime output matches source.
- Fixed slash-command extraction to keep quoted roadmap placeholders intact, eliminating the runtime roadmap `missing-argument` validator gap while leaving unrelated backlog untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for full roadmap operand syntax on the runtime surface** - `93275ffe` (test)
2. **Task 2: Canonicalize the roadmap advisory map and rebuild the shipped plugin bundle** - `c59b25e6` (fix)

**Plan metadata:** `pending final docs commit`

## TDD Audit Trail

### RED
- **Commit:** `93275ffe` (test: add failing roadmap guidance regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/plugin-advisory-guardrails.test.cjs tests/validate-commands.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `not ok 1 - direct write to .planning/ROADMAP.md triggers warning naming canonical roadmap commands`

### GREEN
- **Commit:** `c59b25e6` (fix: canonicalize runtime roadmap guidance)
- **GSD-Phase:** green
- **Target command:** `node --test tests/plugin-advisory-guardrails.test.cjs tests/validate-commands.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ok 1 - accepts shipped runtime roadmap guidance only when plugin guidance includes full operand shapes`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "93275ffe", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/plugin-advisory-guardrails.test.cjs tests/validate-commands.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "not ok 1 - direct write to .planning/ROADMAP.md triggers warning naming canonical roadmap commands"
    }
  },
  "green": {
    "commit": { "hash": "c59b25e6", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test tests/plugin-advisory-guardrails.test.cjs tests/validate-commands.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ok 1 - accepts shipped runtime roadmap guidance only when plugin guidance includes full operand shapes"
    }
  }
}
```

## Files Created/Modified
- `tests/plugin-advisory-guardrails.test.cjs` - locks full roadmap add/remove/insert operand shapes in advisory-planning warnings.
- `tests/validate-commands.test.cjs` - proves the shipped runtime bundle no longer reports roadmap `missing-argument` failures.
- `src/plugin/advisory-guardrails.js` - makes `ROADMAP.md` guidance operand-complete at the source of truth.
- `src/lib/commandDiscovery.js` - preserves quoted placeholder operands during slash-command extraction so runtime guidance validates correctly.
- `plugin.js` - rebuilt shipped plugin runtime with the corrected roadmap guidance.
- `bin/bgsd-tools.cjs` - rebuilt local CLI runtime after the validator extraction fix.

## Decisions Made
- Kept roadmap guidance in placeholder form (`<phase-number>`, `"<description>"`) to preserve canonical reference syntax while still making operands explicit.
- Fixed the validator extraction path instead of adding a special-case exemption for plugin runtime guidance, keeping one command-integrity contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Auto-fix bugs] Slash-command extraction dropped quoted roadmap placeholders during validation**
- **Found during:** Task 2 (Canonicalize the roadmap advisory map and rebuild the shipped plugin bundle)
- **Issue:** After correcting the roadmap advisory strings, `validateCommandIntegrity` still parsed `/bgsd-plan roadmap add "<description>"` as `/bgsd-plan roadmap add`, leaving the runtime gap falsely red.
- **Fix:** Expanded slash-command extraction to retain quoted operand placeholders, then rebuilt `bin/bgsd-tools.cjs` and re-ran focused proof.
- **Files modified:** `src/lib/commandDiscovery.js`, `bin/bgsd-tools.cjs`
- **Verification:** `npm run build` and `node --test tests/plugin-advisory-guardrails.test.cjs tests/validate-commands.test.cjs`
- **Committed in:** `c59b25e6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required to make the intended runtime roadmap fix validator-clean without broadening into unrelated command-integrity backlog.

## Issues Encountered
- `execute:tdd validate-red` currently returns `TDD command not yet implemented`, so RED/GREEN proof was recorded from the direct targeted test command output instead.
- Broad `util:validate-commands --raw` remains red from 10 unrelated surfaced-guidance findings; the Phase 177 runtime roadmap `missing-argument` gap is no longer present.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 177's narrow SAFE-03 runtime roadmap gap is closed with source, bundle, and focused validator proof aligned.
- Phase 178 can now focus on its broader Phase 176 reconciliation work without inheriting the plugin roadmap follow-up failure.

## Self-Check: PASSED

- Verified file presence for `.planning/phases/177-runtime-guidance-integrity-cleanup/177-01-SUMMARY.md`, `plugin.js`, and `src/plugin/advisory-guardrails.js`.
- Verified task commits `93275ffe` and `c59b25e6` exist in `jj log`.

---
*Phase: 177-runtime-guidance-integrity-cleanup*
*Completed: 2026-04-01*
