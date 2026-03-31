---
phase: 149-tdd-selection-contract-alignment
plan: 02
subsystem: testing
tags:
  - tdd
  - planning
  - roadmap
  - plugin
  - migration
requires:
  - phase: 149-tdd-selection-contract-alignment
    provides: canonical TDD contract wording that this plan extends into deterministic planner and parser behavior
provides:
  - Deterministic planner guidance that always records a selected or skipped TDD decision
  - Read-time normalization that rewrites legacy roadmap and plan TDD metadata into the canonical contract
  - Focused roadmap, init, and plugin coverage for malformed hints and rewrite-on-read behavior
affects:
  - 149-03
  - planner guidance
  - roadmap parsing
  - init bootstrap
tech-stack:
  added: []
  patterns:
    - Planning always records a visible plan-body TDD decision callout instead of hiding rationale in frontmatter
    - Legacy TDD metadata is normalized on read and persisted back to disk so future reads see canonical data immediately
key-files:
  created: []
  modified:
    - agents/bgsd-planner.md
    - workflows/plan-phase.md
    - src/lib/helpers.js
    - src/commands/roadmap.js
    - src/plugin/parsers/roadmap.js
    - src/commands/init.js
    - tests/plan.test.cjs
    - tests/init.test.cjs
    - tests/plugin.test.cjs
    - bin/bgsd-tools.cjs
    - bin/manifest.json
    - plugin.js
key-decisions:
  - Planner guidance now treats TDD selection as mandatory for every implementation plan, with roadmap hints changing severity rather than whether evaluation happens
  - Canonical plan output keeps TDD rationale in a visible body callout and strips legacy TDD decision metadata out of frontmatter
  - Roadmap, init, and plugin reads normalize legacy TDD hints in place so the canonical contract becomes persistent instead of in-memory only
patterns-established:
  - Deterministic TDD floor: selected for testable behavior with clear expected outcomes, skipped for docs/config/layout/tooling work
  - Rewrite-on-read migration pattern: readers accept legacy metadata shapes, normalize them, and persist the canonical form immediately
requirements-completed: [TDD-01, TDD-02]
one-liner: "Deterministic plan-body TDD decisions with persisted normalization for legacy roadmap and plan metadata"
duration: 20 min
completed: 2026-03-29
---

# Phase 149 Plan 02: Make deterministic TDD selection visible and persistent during planning. Summary

**Deterministic plan-body TDD decisions with persisted normalization for legacy roadmap and plan metadata**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-29T01:23:06Z
- **Completed:** 2026-03-29T01:43:05Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Updated planner and plan-phase guidance so every implementation plan must record an explicit `Selected` or `Skipped` TDD decision with a visible body rationale.
- Added shared normalization helpers that accept legacy roadmap and plan TDD metadata, rewrite it to the canonical contract, and surface normalized TDD context through CLI and plugin reads.
- Added focused tests proving malformed and legacy TDD hints normalize cleanly and persist back to disk after read.

## Task Commits

Each task was committed atomically:

1. **Task 1: Encode the deterministic TDD floor and visible rationale rule into planning guidance** - `13b8b4f` (docs)
2. **Task 2: Implement persisted normalization-on-read for legacy TDD metadata** - `6ef07db` (feat)
3. **Task 3: Add focused parser/init coverage for omitted hints, malformed hints, and rewrite-on-read behavior** - `b36bfdc` (test)

## Files Created/Modified

- `agents/bgsd-planner.md` [+13/-1] - requires explicit selected/skipped TDD decisions and a visible plan-body rationale callout.
- `workflows/plan-phase.md` [+5/-1] - passes deterministic TDD-selection rules into planner execution even when roadmap hints are omitted.
- `src/lib/helpers.js` [+192/-7] - adds normalization helpers for roadmap hints and legacy plan metadata, including rewrite-on-read persistence.
- `src/commands/roadmap.js` [+10/-2] - normalizes roadmap TDD hints before returning phase data.
- `src/plugin/parsers/roadmap.js` [+56/-4] - keeps plugin roadmap parsing aligned with the same canonical TDD normalization behavior.
- `src/commands/init.js` [+6/-0] - surfaces normalized TDD context during `init:plan-phase` and rewrites legacy plan metadata while reading.
- `tests/plan.test.cjs` [+19/-0] - covers roadmap hint normalization and persistence.
- `tests/init.test.cjs` [+21/-0] - covers init-driven rewrite of legacy plan metadata and normalized TDD output.
- `tests/plugin.test.cjs` [+22/-0] - covers plugin-side roadmap normalization and rewrite-on-read behavior.
- `bin/bgsd-tools.cjs` [+812/-812] - rebuilt single-file CLI bundle with normalization changes.
- `bin/manifest.json` [+1/-1] - refreshed build manifest.
- `plugin.js` [+55/-0] - rebuilt plugin bundle with ESM-safe roadmap normalization.

## Decisions Made

- Omitted roadmap hints no longer mean planner discretion; every implementation plan must still emit an explicit TDD decision.
- The canonical TDD rationale lives in the plan body as `> **TDD Decision:** Selected|Skipped — ...`, not in frontmatter.
- Read paths now own legacy migration so old artifacts converge toward one canonical TDD contract without requiring a dedicated migration command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced the stale workflow verification invocation with the current baseline-backed structure check**
- **Found during:** Task 1 (Encode the deterministic TDD floor and visible rationale rule into planning guidance)
- **Issue:** The plan-specified `workflow:verify-structure workflows/plan-phase.md` invocation no longer works because `workflow:verify-structure` expects a generated baseline, not a workflow path.
- **Fix:** Verified planning workflow changes with `node bin/bgsd-tools.cjs workflow:baseline && node bin/bgsd-tools.cjs workflow:verify-structure --raw`.
- **Files modified:** None (verification substitution only)
- **Verification:** Fresh baseline creation plus workflow structure verification passed 47/47 workflows.
- **Committed in:** None — verification-only substitution

**2. [Rule 1 - Bug] Replaced a CommonJS helper import that broke plugin ESM bundling**
- **Found during:** Task 2 (Implement persisted normalization-on-read for legacy TDD metadata)
- **Issue:** Sharing the CLI helper module directly from the plugin roadmap parser introduced a dynamic `require("fs")` path that broke plugin loading.
- **Fix:** Kept the normalization logic shared by behavior but implemented the plugin-side helper as ESM-safe local functions before rebuilding the bundle.
- **Files modified:** src/plugin/parsers/roadmap.js, plugin.js
- **Verification:** `node --test --test-force-exit tests/plugin.test.cjs`
- **Committed in:** `6ef07db` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes preserved the intended scope while adapting to current verification and plugin-runtime constraints.

## Issues Encountered

- The combined Node test runner left open handles after the plugin suite completed, so final broad verification used `--test-force-exit` to preserve the intended suite coverage while allowing the command to terminate cleanly.

## Next Phase Readiness

- Phase 149 now has deterministic planner-side TDD selection and persistent normalization, so Plan 03 can focus purely on checker severity and roadmap-author guidance.
- Legacy roadmap and plan artifacts now converge toward the canonical contract automatically, reducing drift before Phase 150 hardens TDD execution semantics.

## Self-Check

PASSED

- Found `.planning/phases/149-tdd-selection-contract-alignment/149-02-SUMMARY.md`
- Found commit `13b8b4f`
- Found commit `6ef07db`
- Found commit `b36bfdc`

---
*Phase: 149-tdd-selection-contract-alignment*
*Completed: 2026-03-29*
