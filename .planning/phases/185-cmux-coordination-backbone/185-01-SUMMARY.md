---
phase: 185-cmux-coordination-backbone
plan: 01
subsystem: infra
tags: [cmux, debounce, single-flight, node:test]

# Dependency graph
requires:
  - phase: 184-deterministic-finalize-partial-wave-recovery
    provides: deterministic workspace/finalize state that cmux refreshes project into sidebar and attention sinks
provides:
  - shared single-flight cmux refresh backbone with debounced enqueue and immediate refresh entrypoints
  - shared snapshot fan-out contract covering parser invalidation, project-state rebuild, and bounded reruns
  - focused node:test proof for burst coalescing, shared payload fan-out, and overlapping-trigger reruns
affects: [185-02, 186-cmux-truthful-lifecycle-signals, plugin runtime refresh wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-flight refresh coordination, bounded trigger merging, shared snapshot fan-out]

key-files:
  created: [src/plugin/cmux-refresh-backbone.js, tests/plugin-cmux-refresh-backbone.test.cjs]
  modified: [src/plugin/cmux-refresh-backbone.js, tests/plugin-cmux-refresh-backbone.test.cjs]

key-decisions:
  - "Keep the backbone dependency-injected and phase-scoped so Plan 02 can wire hooks without reintroducing direct sidebar/attention refresh paths."
  - "Merge trigger fidelity into a bounded hooks-plus-context summary instead of keeping an unbounded queue of runtime events."

patterns-established:
  - "Backbone pattern: invalidate parsers once, build one fresh payload, then fan the same object to sidebar and attention sinks."
  - "Overlap pattern: while a cycle is in flight, set one rerun request and merge trigger detail for the follow-up cycle."

requirements-completed: [CMUX-01]
one-liner: "Single-flight cmux refresh backbone with debounced coalescing, one shared project snapshot, and bounded reruns"

# Metrics
duration: 3 min
completed: 2026-04-02
---

# Phase 185 Plan 01: cmux Coordination Backbone Summary

**Single-flight cmux refresh backbone with debounced coalescing, one shared project snapshot, and bounded reruns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T04:19:30Z
- **Completed:** 2026-04-02T04:22:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `createCmuxRefreshBackbone` with debounced `enqueue()` and immediate `refreshNow()` entrypoints.
- Ensured each refresh cycle invalidates parser caches once, builds one fresh payload, and fans the same payload to sidebar and attention sinks.
- Added focused regressions for burst coalescing, bounded trigger merging, and single reruns after overlapping refresh requests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author focused backbone regressions before wiring the plugin** - `3e01d2fe` (test)
2. **Task 2: Implement the shared refresh coordinator with one-snapshot fan-out** - `850350fb` (feat)

_Note: TDD helpers `execute:tdd validate-red|green` currently return `TDD command not yet implemented`, so exact proof below comes from the declared target command output._

## TDD Audit Trail

### RED
- **Commit:** `3e01d2fe` (test: add failing refresh backbone regressions)
- **GSD-Phase:** red
- **Target command:** `node --test tests/plugin-cmux-refresh-backbone.test.cjs`
- **Exit status:** `1`
- **Matched evidence:** `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: actual 'undefined' expected 'function'`

### GREEN
- **Commit:** `850350fb` (feat: implement single-flight cmux refresh backbone)
- **GSD-Phase:** green
- **Target command:** `node --test tests/plugin-cmux-refresh-backbone.test.cjs`
- **Exit status:** `0`
- **Matched evidence:** `pass 2, fail 0`

### Machine-Readable Stage Proof
```json
{
  "red": {
    "commit": { "hash": "3e01d2fe", "gsd_phase": "red" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-refresh-backbone.test.cjs",
      "exit_code": 1,
      "matched_evidence_snippet": "actual 'undefined' expected 'function'"
    }
  },
  "green": {
    "commit": { "hash": "850350fb", "gsd_phase": "green" },
    "proof": {
      "target_command": "node --test tests/plugin-cmux-refresh-backbone.test.cjs",
      "exit_code": 0,
      "matched_evidence_snippet": "pass 2, fail 0"
    }
  }
}
```

## Verification

- **Behavior proof (required):** Passed — `node --test tests/plugin-cmux-refresh-backbone.test.cjs`
- **Regression proof (required):** Passed — `npm run build`
- **Human verification (not required):** Module-level runtime contract covered by deterministic tests and build gate.
- **Intent Alignment:** partial — the backbone contract landed, but plugin hook wiring and quiet fail-open lifecycle behavior remain for Plan 02.
- **Requirement Coverage:** CMUX-01 satisfied for the backbone slice delivered by this plan.

## Files Created/Modified
- `src/plugin/cmux-refresh-backbone.js` - Defines the dependency-injected refresh backbone with debounced enqueue, single-flight execution, trigger merging, and bounded reruns.
- `tests/plugin-cmux-refresh-backbone.test.cjs` - Proves burst coalescing, shared payload fan-out, and one follow-up rerun while a cycle is in flight.

## Decisions Made
- Kept the backbone dependency-injected so later plugin wiring can reuse the coordinator without moving sidebar or attention logic into event hooks.
- Preserved bounded trigger fidelity with `hook`, `hooks`, `filePath`, `event`, `input`, and `planningChange` instead of storing an unbounded trigger queue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched the new test loader to a data URL import for ESM source**
- **Found during:** Task 2 (Implement the shared refresh coordinator with one-snapshot fan-out)
- **Issue:** Directly importing the new `.js` source from the CommonJS test file caused Node to parse the ESM export syntax as CJS and fail before the implementation contract could run.
- **Fix:** Updated the new test helper to read the module source and import it through a `data:` URL, matching existing repo-local plugin snapshot test patterns.
- **Files modified:** `tests/plugin-cmux-refresh-backbone.test.cjs`
- **Verification:** `node --test tests/plugin-cmux-refresh-backbone.test.cjs`
- **Committed in:** `850350fb` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix only repaired the new test harness so the intended backbone contract could be proven. No scope creep.

## Issues Encountered
- `execute:tdd validate-red` and `execute:tdd validate-green` still return `TDD command not yet implemented`, so RED/GREEN evidence was recorded from the exact target command outputs instead of helper JSON.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can wire plugin startup, watcher, command, idle, and tool hooks into the shared backbone instead of calling sidebar and attention refreshes directly.
- Quiet fail-open suppression and early wake handling still need end-to-end plugin wiring proof in the next plan.

## Self-Check

PASSED

---
*Phase: 185-cmux-coordination-backbone*
*Completed: 2026-04-02*
