---
phase: 169-canonical-model-resolution-visibility
plan: 03
subsystem: orchestration
tags: [javascript, routing, model-settings, tdd]
requires:
  - phase: 169-canonical-model-resolution-visibility
    provides: shared configured-versus-resolved model-state helper contract from plan 01
provides:
  - provider-agnostic orchestration profile recommendations
  - canonical concrete-model resolution for routed executor work
  - regression tests that reject provider-tier routing vocabulary
affects: [init, task-routing, classify-phase, classify-plan]
tech-stack:
  added: []
  patterns:
    - recommend shared quality/balanced/budget profiles before resolving concrete models
    - resolve routed concrete models through canonical config rather than provider-tier fallback tables
key-files:
  created: []
  modified:
    - src/lib/orchestration.js
    - src/lib/constants.js
    - tests/orchestration.test.cjs
    - bin/bgsd-tools.cjs
    - bin/manifest.json
key-decisions:
  - "Mapped orchestration complexity scores to shared quality/balanced/budget profiles instead of Anthropic tier names."
  - "Resolved routed executor models by overriding the canonical default profile for the route decision and delegating final model selection to resolveModelSelectionFromConfig()."
patterns-established:
  - "Routing outputs should recommend shared profiles and only surface concrete models after canonical resolution."
  - "Orchestration regression tests should fail loudly if provider-tier names reappear in live routing semantics."
requirements-completed: [MODEL-04, MODEL-08]
one-liner: "Orchestration now recommends quality/balanced/budget profiles and resolves the final executor model through canonical config." 
duration: 7min
completed: 2026-03-31
---

# Phase 169 Plan 03: Remove the last provider-tier routing assumptions from orchestration. Summary

**Orchestration now recommends quality/balanced/budget profiles and resolves the final executor model through canonical config.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T05:03:30Z
- **Completed:** 2026-03-31T05:10:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Replaced live provider-tier routing recommendations with shared `quality`, `balanced`, and `budget` profiles.
- Routed executor model selection through `resolveModelSelectionFromConfig()` so profile-backed model changes alter concrete output without changing routing semantics.
- Locked the new routing contract with orchestration tests that reject `haiku`, `sonnet`, and `opus` as live recommendation vocabulary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace provider-tier routing with shared-profile recommendation**
   - `4c3b66f` — `feat(169-03): route orchestration through shared profiles`
2. **Task 2: Lock provider-agnostic routing behavior with regression tests**
   - `c5cf575` — `test(169-03): add failing provider-agnostic routing tests`

_Note: This TDD plan used a plan-level RED→GREEN cycle where the regression test commit landed before the routing implementation commit._

## TDD Audit Trail

Review the exact RED/GREEN proof package here.

### RED
- **Commit:** `c5cf575` (`test(169-03): add failing provider-agnostic routing tests`)
- **GSD-Phase:** red
- **Target command:** `npm run test:file -- tests/orchestration.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `TypeError: routeTask is not a function`

### GREEN
- **Commit:** `4c3b66f` (`feat(169-03): route orchestration through shared profiles`)
- **GSD-Phase:** green
- **Target command:** `npm run test:file -- tests/orchestration.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `ℹ pass 13`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "c5cf575", "gsd_phase": "red" },
    "proof": {
      "target_command": "npm run test:file -- tests/orchestration.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "TypeError: routeTask is not a function"
    }
  },
  "green": {
    "commit": { "hash": "4c3b66f", "gsd_phase": "green" },
    "proof": {
      "target_command": "npm run test:file -- tests/orchestration.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "ℹ pass 13"
    }
  }
}
```

## Files Created/Modified

- `src/lib/orchestration.js` - Replaces provider-tier routing with shared-profile recommendations and canonical concrete-model resolution.
- `src/lib/constants.js` - Updates classify-plan help text to document shared-profile routing output.
- `tests/orchestration.test.cjs` - Locks provider-agnostic profile recommendations and canonical routed-model resolution.
- `bin/bgsd-tools.cjs` - Rebuilt CLI bundle with the updated orchestration logic.
- `bin/manifest.json` - Refreshed build manifest for the regenerated CLI bundle.

## Decisions Made

- Used score-to-profile routing (`budget` / `balanced` / `quality`) instead of any provider-tier priority map so routing semantics stay stable across provider swaps.
- Kept final routed model resolution on the canonical config path by overriding only the routed default profile and delegating the concrete lookup to the shared resolver.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run build` refreshed other generated workspace artifacts beyond the touched routing files, so task commits were kept path-scoped to the orchestration bundle outputs required by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Live orchestration routing no longer depends on Anthropic tier names, so Phase 169 plan 04 can safely fence or remove remaining dead provider-shaped cache APIs.
- Init, classify, and execution surfaces now describe routing intent in the same shared-profile vocabulary as settings.

## Self-Check: PASSED

- Found `.planning/phases/169-canonical-model-resolution-visibility/169-03-SUMMARY.md`
- Verified task commits `c5cf575e` and `4c3b66f1` in `jj log`
