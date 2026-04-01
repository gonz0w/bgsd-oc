---
phase: 180-command-validator-drift-resolution
plan: 01
subsystem: testing
tags: [validator, cli, command-discovery, proof-inventory]
requires:
  - phase: 179-shipped-guidance-surface-integrity
    provides: shipped runtime guidance surfaces that Phase 180 must validate truthfully
provides:
  - router-backed CLI inventory for surfaced command validation
  - named validator exclusion classes for transition and bootstrap contexts
  - raw proof inventory metadata for util:validate-commands output
affects: [180-02, milestone-close-validation, command-integrity]
tech-stack:
  added: []
  patterns: [router-backed validator inventory, named command-context exclusions]
key-files:
  created: [.planning/phases/180-command-validator-drift-resolution/180-01-SUMMARY.md]
  modified: [tests/validate-commands.test.cjs, src/lib/commandDiscovery.js, src/commands/misc/frontmatter.js, bin/bgsd-tools.cjs]
key-decisions:
  - "Derive CLI validator inventory from routed command coverage plus help metadata so surfaced node-invoked examples match real behavior."
  - "Publish validator-owned proofInventory with named exclusions so green raw output explains its proof scope."
patterns-established:
  - "Contract-first validator updates: extend the inventory from routed behavior before editing surfaced files."
  - "Classify intentional command-like text by named buckets instead of broad regex suppression."
requirements-completed: [CLEAN-03]
one-liner: "Router-backed validator inventory with named exclusions and proof-inventory output for trustworthy raw command validation"
duration: 5min
completed: 2026-04-01
---

# Phase 180 Plan 01: Command Validator Drift Resolution Summary

**Router-backed validator inventory with named exclusions and proof-inventory output for trustworthy raw command validation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T16:49:51Z
- **Completed:** 2026-04-01T16:54:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added RED regressions for routed node-invoked commands, redirect-bearing shell examples, transition headings, and proof inventory output.
- Reworked CLI inventory derivation so validator coverage reflects routed command truth instead of help text alone.
- Extended raw validator output with proof inventory and named exclusions, producing a green repo-wide `util:validate-commands --raw` result.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for the known validator-drift backlog** - `05787df2` (test)
2. **Task 2: Implement authoritative contract derivation and named classifications** - `375738cc` (feat)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## TDD Audit Trail

### RED
- **Commit:** `05787df2` (test: add validator drift regression coverage)
- **GSD-Phase:** red
- **Target command:** `node --test tests/validate-commands.test.cjs --test-name-pattern "accepts supported routed node-invoked commands and redirect-bearing shell examples|classifies transition headings intentionally and exposes proof inventory in raw output"`
- **Exit status:** `1`
- **Matched evidence:** `✖ accepts supported routed node-invoked commands and redirect-bearing shell examples`

### GREEN
- **Commit:** `375738cc` (feat: align validator inventory with routed command truth)
- **GSD-Phase:** green
- **Target command:** `npm run build && node --test tests/validate-commands.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ fail 0`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "05787df2", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/validate-commands.test.cjs --test-name-pattern \"accepts supported routed node-invoked commands and redirect-bearing shell examples|classifies transition headings intentionally and exposes proof inventory in raw output\"",
      "exit_code": 1,
      "matched_evidence_snippet": "✖ accepts supported routed node-invoked commands and redirect-bearing shell examples"
    }
  },
  "green": {
    "commit": { "hash": "375738cc", "gsd_phase": "green" },
    "proof": {
      "target_command": "npm run build && node --test tests/validate-commands.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ fail 0"
    }
  }
}
```

## Files Created/Modified
- `tests/validate-commands.test.cjs` - locks routed command, redirect, transition-heading, and proof-inventory regressions.
- `src/lib/commandDiscovery.js` - derives CLI inventory from routed command coverage, strips redirect artifacts, and exposes proof inventory.
- `src/commands/misc/frontmatter.js` - includes proof inventory in raw validator command output.
- `bin/bgsd-tools.cjs` - rebuilt CLI bundle with the validator contract changes.

## Decisions Made
- Derived validator CLI inventory from routed command coverage plus help metadata so supported node-invoked examples stop failing as nonexistent commands.
- Treated transition-style `Next Up` headings as a named intentional exclusion instead of generic slash-command failures.
- Reported named exclusions and proof scope from the validator itself so repo-wide green output has stable meaning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added raw proof-inventory reporting to the command entrypoint**
- **Found during:** Task 2 (Implement authoritative contract derivation and named classifications)
- **Issue:** `validateCommandIntegrity()` could compute proof inventory, but `util:validate-commands --raw` would still hide it unless the command output layer forwarded that data.
- **Fix:** Updated `src/commands/misc/frontmatter.js` to include `proofInventory` in the raw payload.
- **Files modified:** `src/commands/misc/frontmatter.js`
- **Verification:** `node bin/bgsd-tools.cjs util:validate-commands --raw`
- **Committed in:** `375738cc`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Small in-scope output-layer follow-through required to make the planned validator-owned proof inventory observable. No scope creep.

## Review Findings

Review skipped — execution focused on plan-scoped TDD and targeted verification.

## Issues Encountered
- `execute:tdd validate-red` currently returns `TDD command not yet implemented`, so RED proof was captured from the direct failing test command instead of the workflow helper.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validator contract is green repo-wide with named proof inventory, so Plan 02 can treat `util:validate-commands --raw` as the authority for any remaining surfaced-file drift.
- No blockers for Phase 180 Plan 02.

## Self-Check: PASSED

- FOUND: `.planning/phases/180-command-validator-drift-resolution/180-01-SUMMARY.md`
- FOUND: `05787df2` - `test(180-01): add validator drift regression coverage`
- FOUND: `375738cc` - `feat(180-01): align validator inventory with routed command truth`
