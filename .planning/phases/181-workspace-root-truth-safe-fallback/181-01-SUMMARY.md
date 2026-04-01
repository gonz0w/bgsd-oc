---
phase: 181-workspace-root-truth-safe-fallback
plan: 01
subsystem: infra
tags: [jj, workspace, cli, verification]

# Dependency graph
requires:
  - phase: 180-greenfield-cleanup-cli-simplification
    provides: sequential execution baseline and existing JJ workspace surfaces
provides:
  - reusable runtime workspace proof collection in `src/lib/jj-workspace.js`
  - `workspace prove` command that exposes triple-match evidence
  - focused regressions for success and generic fallback paths
affects: [phase-182-verification-routing, phase-183-workspace-ownership, workspace-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: [canonical realpath triple-match proof gate, generic sequential fallback payload]

key-files:
  created: []
  modified: [src/lib/jj-workspace.js, src/commands/workspace.js, src/router.js, src/lib/constants.js, src/lib/commandDiscovery.js, src/lib/router-contract.js, tests/workspace.test.cjs, bin/bgsd-tools.cjs, bin/manifest.json, plugin.js]

key-decisions:
  - "Parallel workspace mode unlocks only when intended root, observed cwd, and observed `jj workspace root` all canonically match."
  - "Missing workspace proof and root mismatches collapse to one generic fallback reason instead of multiple operator-facing failure classes."

patterns-established:
  - "Workspace proof surfaces should return evidence fields plus one generic fallback reason."
  - "Workspace command additions must update routed help and built runtime artifacts together."

requirements-completed: [JJ-01, JJ-03]
one-liner: "Runtime JJ workspace proof gate with `workspace prove` triple-match evidence and one generic sequential fallback"

# Metrics
duration: 5 min
completed: 2026-04-01
---

# Phase 181 Plan 01: Workspace Root Truth & Safe Fallback Summary

**Runtime JJ workspace proof gate with `workspace prove` triple-match evidence and one generic sequential fallback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T20:15:15Z
- **Completed:** 2026-04-01T20:21:09Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added RED regressions that lock the exact triple-match unlock rule and generic fallback payload.
- Implemented reusable workspace proof collection in `src/lib/jj-workspace.js` and surfaced it as `workspace prove`.
- Updated routed help/build outputs so the new command is available in source and rebuilt runtime artifacts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED coverage for the triple-match unlock rule and generic fallback cases** - `db1310f6` (test)
2. **Task 2: Implement the shared proof helper and surface it through `workspace prove`** - `46e879de` (feat)

**Plan metadata:** `umkptmow` (docs change-id)

## TDD Audit Trail

### RED
- **Commit:** `db1310f6` (test: add failing workspace proof regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/workspace.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `Unknown workspace subcommand. Available: add, list, forget, cleanup, reconcile`

### GREEN
- **Commit:** `46e879de` (feat: add workspace root proof command)
- **GSD-Phase:** green
- **Target command:** `npm run build && node --test tests/workspace.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `✔ workspace prove returns the same generic fallback when authoritative workspace proof is unavailable`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "db1310f6", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/workspace.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "Unknown workspace subcommand. Available: add, list, forget, cleanup, reconcile"
    }
  },
  "green": {
    "commit": { "hash": "46e879de", "gsd_phase": "green" },
    "proof": {
      "target_command": "npm run build && node --test tests/workspace.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "✔ workspace prove returns the same generic fallback when authoritative workspace proof is unavailable"
    }
  }
}
```

## Verification

- **Focused verification:** `npm run build && node --test tests/workspace.test.cjs`
- **Requirement Coverage:** JJ-01 and JJ-03 covered by the new proof helper, command surface, and focused regressions.
- **Intent Alignment:** aligned — the shipped behavior now proves root pinning from runtime evidence and downgrades missing proof to one generic fallback.

## Files Created/Modified
- `tests/workspace.test.cjs` - Locks the triple-match success case, subdirectory downgrade, and generic fallback when proof is unavailable.
- `src/lib/jj-workspace.js` - Adds canonical workspace proof collection and the shared fallback reason contract.
- `src/commands/workspace.js` - Exposes `workspace prove` through the existing workspace command family.
- `src/router.js` - Routes the new `workspace prove` subcommand and updates top-level command help.
- `src/lib/constants.js` - Documents `workspace prove` in command help text.
- `src/lib/commandDiscovery.js` - Adds the new command to fallback command discovery inventory.
- `src/lib/router-contract.js` - Adds `prove` to the declared workspace router contract.
- `bin/bgsd-tools.cjs` - Rebuilt local CLI runtime with the new workspace proof surface.
- `bin/manifest.json` - Refreshed generated manifest during runtime rebuild.
- `plugin.js` - Rebuilt plugin bundle containing updated command help.

## Decisions Made
- Required canonical triple-match proof before reporting `parallel_allowed: true`.
- Kept all proof failures on one operator-facing fallback reason so sequential downgrade stays simple and safe.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context unavailable

## Issues Encountered

- `execute:tdd validate-red` returned `TDD command not yet implemented`, so RED/GREEN proof was recorded directly from the declared commands and their observed output.
- `verify:state complete-plan` could not parse the current STATE.md shape, so STATE.md was repaired manually after ROADMAP and REQUIREMENTS helpers succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Runtime workspace proof is now reusable for earlier preflight checks in later execution workflows.
- Phase 181 Plan 02 can build on this command/helper contract to enforce proof before plan work begins and keep repo-relative outputs rooted correctly.

## Self-Check

PASSED

- FOUND: `.planning/phases/181-workspace-root-truth-safe-fallback/181-01-SUMMARY.md`
- FOUND: `db1310f6` task commit
- FOUND: `46e879de` task commit
- FOUND: `umkptmow` metadata change-id

---
*Phase: 181-workspace-root-truth-safe-fallback*
*Completed: 2026-04-01*
