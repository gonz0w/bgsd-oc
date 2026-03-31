---
phase: 163-lesson-snapshot-foundation
plan: 01
subsystem: planning
tags:
  - lessons
  - snapshot
  - remediation
  - init
  - javascript
requires: []
provides:
  - frozen milestone lesson snapshot artifact
  - stable remediation buckets with exact lesson_ids
  - init:new-milestone snapshot metadata and inspect path
affects:
  - phase planning context injection
  - milestone planning scope control
tech-stack:
  added: []
  patterns:
    - freeze canonical lesson scope into a milestone-owned artifact
    - expose compact remediation summaries with an inspect path instead of live lesson rediscovery
key-files:
  created: []
  modified:
    - src/commands/lessons.js
    - src/commands/init.js
    - workflows/new-milestone.md
    - tests/init.test.cjs
    - tests/memory.test.cjs
    - tests/planning-cache.test.cjs
    - bin/bgsd-tools.cjs
    - bin/manifest.json
key-decisions:
  - "Store the v18.0 lesson baseline in a separate milestone snapshot file so later lesson captures cannot silently change scope."
  - "Derive stable named remediation buckets in shared code and surface only compact metadata plus inspect_path through init:new-milestone."
patterns-established:
  - "Frozen source plus derived views: keep the raw lessons baseline in one artifact and derive buckets/summary projections from it."
  - "Compact planning injection: surface bucket names, counts, IDs, and inspect_path without mutating lessons.json or re-querying live lessons."
requirements-completed: [LES-01, LES-02]
one-liner: "Milestone-owned lesson snapshot JSON with stable remediation buckets and inspectable init:new-milestone metadata"
duration: 12min
completed: 2026-03-30
---

# Phase 163 Plan 01: Freeze a milestone-owned lesson snapshot and derive inspectable remediation buckets from that frozen baseline. Summary

**Milestone-owned lesson snapshot JSON with stable remediation buckets and inspectable init:new-milestone metadata**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T14:27:16Z
- **Completed:** 2026-03-30T14:39:23Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added shared lesson snapshot helpers that freeze `.planning/memory/lessons.json` into a milestone-owned artifact with source hash, lesson count, and derived remediation buckets.
- Wired `init:new-milestone` to create or reuse the frozen artifact, expose compact bucket metadata, and give downstream planning an explicit inspect path instead of live lesson rediscovery.
- Locked the behavior with regression tests covering snapshot immutability, bucket membership, snapshot reuse, and canonical JSON-source selection over SQLite-only additions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing coverage for frozen snapshot and bucket schema** - `f08a8f5` (test)
2. **Task 2: Implement shared snapshot + bucket derivation and milestone-init wiring** - `dedaf8a` (feat)
3. **Task 3: Turn tests green and prove inspectable frozen output** - `0bfea3f` (feat)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+362/-362]
- `bin/manifest.json` [+1/-1]
- `skills/skill-index/SKILL.md` [+1/-1]
- `src/commands/init.js` [+30/-0]
- `src/commands/lessons.js` [+201/-0]
- `tests/init.test.cjs` [+111/-5]
- `tests/memory.test.cjs` [+67/-0]
- `tests/planning-cache.test.cjs` [+49/-0]
- `workflows/new-milestone.md` [+2/-0]

## Decisions Made

- Stored the milestone baseline at `.planning/milestones/v18.0-lessons-snapshot.json` so milestone scope stays immutable after startup.
- Kept `.planning/memory/lessons.json` as the canonical raw source and treated the snapshot as a read-only derived artifact to preserve auditability.
- Added `inspect_path` to the compact summary so humans and later workflows can inspect exact bucket membership without reopening live lesson search.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed the Phase 160 legacy fixture to the archived milestone path**
- **Found during:** Task 1 (Add failing coverage for frozen snapshot and bucket schema)
- **Issue:** The plan's focused verification command still executed an existing legacy Phase 160 init test, and that test failed because the repo no longer keeps the fixture under `.planning/phases/`.
- **Fix:** Updated the shared fixture helper in `tests/init.test.cjs` to fall back to `.planning/milestones/v17.0-phases/160-phase-intent-alignment-verification/` when the live phase directory is absent.
- **Files modified:** tests/init.test.cjs
- **Verification:** `node --test tests/init.test.cjs tests/memory.test.cjs tests/planning-cache.test.cjs --test-name-pattern "lesson snapshot|remediation bucket|init:new-milestone"`
- **Committed in:** `f08a8f5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to make the plan's declared verification command trustworthy; no product scope changed.

## Issues Encountered

- A final broad `npm test` regression gate still reported pre-existing failures in unrelated yq, codebase-intel, env, trajectory, and legacy-contract suites. The plan's explicit snapshot verification command passed, so those unrelated failures were left out of scope for this slice.

## Next Phase Readiness

- Phase 163 now has a frozen lesson baseline and stable remediation buckets for v18.0 planning.
- Later Phase 163 plans can wire the compact snapshot summary into planner/researcher context and replace remaining live lesson queries.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- Found `.planning/phases/163-lesson-snapshot-foundation/163-01-SUMMARY.md`
- Found `.planning/milestones/v18.0-lessons-snapshot.json`
- Verified task commits `zullqqlm`, `knlvntks`, and `pqpntpqq` in `jj log`

---
*Phase: 163-lesson-snapshot-foundation*
*Completed: 2026-03-30*
