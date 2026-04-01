---
phase: 174-greenfield-compatibility-surface-cleanup
plan: 03
subsystem: cli
tags: [commonjs, javascript]
provides: []
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: [bin/bgsd-tools.cjs, src/lib/helpers.js, plugin.js]
key-decisions:
  - "Active roadmap and plan readers now accept only canonical TDD metadata and never rewrite legacy values on read."
  - "Plugin roadmap parsing now mirrors CLI canonical-only behavior so no hidden normalization path survives behind the runtime bundle."
patterns-established: []
requirements-completed: [CLEAN-02]
one-liner: "Canonical-only roadmap and plan readers that stop rewriting legacy TDD metadata across CLI and plugin paths"
duration: 18min
completed: 2026-04-01
---

# Phase 174 Plan 03: Remove rewrite-on-read planning normalization from both CLI and plugin roadmap readers so canonical plan and roadmap shapes are enforced instead of silently rewritten. Summary

**Canonical-only roadmap and plan readers that stop rewriting legacy TDD metadata across CLI and plugin paths**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-31 18:12:27 -0600
- **Completed:** 2026-03-31 18:30:07 -0600
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Removed CLI rewrite-on-read normalization helpers and call sites so active planning reads stay canonical-only instead of silently mutating roadmap or plan files.
- Matched the plugin roadmap parser to the CLI contract so legacy `**TDD:** true/yes` hints no longer normalize behind the scenes.
- Added regressions proving canonical roadmap/plan metadata still parses and validates cleanly while legacy metadata remains untouched on read. Intent alignment: aligned.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED regressions for canonical-only roadmap and plan reads** - `309c0e3` (test)
2. **Task 2: Remove mirrored normalization from helpers, init, roadmap, and plugin readers** - `2a2ae61` (feat)

**Plan metadata:** `8a3d665` (docs)

## TDD Audit Trail

Review the exact RED/GREEN/REFACTOR proof package here. REFACTOR evidence is required when a refactor commit exists.

### RED
- **Commit:** `309c0e3` (test: test(174-03): add canonical-only roadmap and plan reader regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/init.test.cjs tests/plugin.test.cjs --test-name-pattern "legacy TDD metadata|parseRoadmap|canonical roadmap and plan metadata"`
- **Exit status:** `1`
- **Matched evidence:** `legacy TDD metadata no longer rewrites plan files on read` and `parseRoadmap leaves legacy TDD hints untouched on read` both failed before the reader cleanup landed.

### GREEN
- **Commit:** `2a2ae61` (feat: feat(174-03): enforce canonical roadmap and plan read paths)
- **GSD-Phase:** green
- **Target command:** `node --test tests/init.test.cjs --test-name-pattern "legacy TDD metadata|canonical roadmap and plan metadata" && node --test tests/plugin.test.cjs --test-name-pattern "parseRoadmap"`
- **Exit status:** `0`
- **Matched evidence:** `canonical roadmap and plan metadata still parse and validate`, `legacy TDD metadata no longer rewrites plan files on read`, and `parseRoadmap leaves legacy TDD hints untouched on read` all passed against the rebuilt local runtime.

### Machine-Readable Stage Proof

```json
{
  "red": {
    "commit": {
      "hash": "309c0e3f4fe848ea66ccfa6440a7933a2ddb9174",
      "message": "test(174-03): add canonical-only roadmap and plan reader regressions",
      "gsd_phase": "red"
    },
    "proof": {
      "target_command": "node --test tests/init.test.cjs tests/plugin.test.cjs --test-name-pattern \"legacy TDD metadata|parseRoadmap|canonical roadmap and plan metadata\"",
      "exit_code": 1,
      "matched_evidence_snippet": "legacy TDD metadata no longer rewrites plan files on read"
    }
  },
  "green": {
    "commit": {
      "hash": "2a2ae61337cc9c00f854f06b468726abafcf2481",
      "message": "feat(174-03): enforce canonical roadmap and plan read paths",
      "gsd_phase": "green"
    },
    "proof": {
      "target_command": "node --test tests/init.test.cjs --test-name-pattern \"legacy TDD metadata|canonical roadmap and plan metadata\" && node --test tests/plugin.test.cjs --test-name-pattern \"parseRoadmap\"",
      "exit_code": 0,
      "matched_evidence_snippet": "parseRoadmap leaves legacy TDD hints untouched on read"
    }
  }
}
```

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+349/-353]
- `plugin.js` [+8/-162]
- `src/commands/init.js` [+1/-2]
- `src/commands/roadmap.js` [+3/-3]
- `src/lib/helpers.js` [+3/-169]
- `src/plugin/parsers/roadmap.js` [+4/-8]
- `tests/init.test.cjs` [+20/-15]
- `tests/plugin.test.cjs` [+110/-7]
- `tests/init.test.cjs
    tests/plugin.test.cjs` [declared plan file]
- `src/lib/helpers.js
    src/commands/init.js
    src/commands/roadmap.js
    src/plugin/parsers/roadmap.js` [declared plan file]

## Decisions Made

- Accepted only exact canonical roadmap TDD hints (`required` / `recommended`) so legacy booleans or prose stop receiving hidden compatibility normalization.
- Deleted helper-layer rewrite-on-read plan normalization instead of replacing it with a shadow validator, because Phase 174 intent requires canonical active-path behavior with no silent mutation. Intent alignment: aligned.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The broad focused regression gate `npm run test:file -- tests/init.test.cjs tests/plugin.test.cjs` still surfaces pre-existing unrelated `init new-milestone` failures and then hangs while draining the long plugin suite. Per the phase verification route, I recorded that attempted gate once, stopped retrying it, rebuilt the runtime, and used rebuilt targeted touched-surface proofs instead. Intent alignment: aligned.

## Next Phase Readiness

- Canonical planning readers are now strict and mirrored across CLI and plugin runtimes, so later Phase 174 cleanup can assume no legacy TDD rewrite-on-read path remains.
- Follow-up plans can build on this stricter compatibility surface without carrying hidden roadmap/parser normalization debt.

## Self-Check: PASSED

- FOUND: `.planning/phases/174-greenfield-compatibility-surface-cleanup/174-03-SUMMARY.md`
- FOUND: `309c0e3` task commit
- FOUND: `2a2ae61` task commit
- FOUND: `8a3d665` metadata commit

---
*Phase: 174-greenfield-compatibility-surface-cleanup*
*Completed: 2026-04-01*
