---
phase: 163-shared-contracts-safe-mutation
plan: 01
subsystem: infra
tags:
  - locking
  - atomic-write
  - json
  - markdown
  - commonjs
requires:
  - phase: 162
    provides: JJ-aware execution baseline for the v17.1 hardening milestone
provides:
  - project-scoped lock acquisition and release helpers for touched mutation flows
  - atomic temp-file-plus-rename publish helper for whole-file JSON and Markdown writes
  - regression tests proving stale-lock recovery, lock release, and no partial publish exposure
affects:
  - state-session mutations
  - memory stores
  - handoff writers
  - config writers
tech-stack:
  added: []
  patterns:
    - shared project-scoped mkdir/rmdir lock coordination
    - temp-file then rename atomic whole-file publish
key-files:
  created:
    - src/lib/project-lock.js
    - src/lib/atomic-write.js
    - tests/mutation-primitives.test.cjs
  modified: []
key-decisions:
  - "Expose both acquire/release and withProjectLock so CLI and plugin code can share one lock contract."
  - "Keep atomic publish source-first with one writeFileAtomic helper and test hooks that prove rename-time behavior."
patterns-established:
  - "Project lock pattern: acquireProjectLock()/withProjectLock() owns stale-lock recovery and guaranteed release."
  - "Atomic publish pattern: writeFileAtomic() stages replacement content in a sibling temp file before rename."
requirements-completed: [FOUND-02, FOUND-04]
one-liner: "Shared project locking and atomic file publish helpers with regression proof for stale-lock recovery and safe whole-file replacement"
duration: 3 min
completed: 2026-03-30
---

# Phase 163 Plan 01: Establish the shared locking and atomic publish primitives that every touched Phase 163 writer will reuse. Summary

**Shared project locking and atomic file publish helpers with regression proof for stale-lock recovery and safe whole-file replacement**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T16:35:30Z
- **Completed:** 2026-03-30T16:39:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extracted the plugin-local `.planning/.lock` mkdir/rmdir discipline into a reusable project lock helper for future CLI and plugin mutators.
- Added a shared atomic publish helper so later JSON and Markdown whole-file writers can stop calling raw `writeFileSync(target, content)`.
- Proved the primitives against the touched Phase 163 write risks: stale locks, guaranteed lock release, temp cleanup, and rename-only publish visibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shared lock and atomic publish helpers** - `129db533` (feat)
2. **Task 2: Prove the primitives are reusable from touched mutation surfaces** - `c80d04e2` (test)

## Files Created/Modified

- `src/lib/project-lock.js` - Shared project-scoped lock acquisition, stale-lock recovery, and guaranteed release wrapper.
- `src/lib/atomic-write.js` - Shared temp-file-plus-rename publish helper for whole-file replacements.
- `tests/mutation-primitives.test.cjs` - Focused regression coverage for lock lifecycle and atomic publish guarantees.

## Decisions Made

- Exposed both low-level `acquireProjectLock()` and higher-level `withProjectLock()` so later mutators can share one coordination contract without reimplementing cleanup.
- Kept atomic publish narrowly scoped to `writeFileAtomic()` so later state, memory, handoff, and config writers can bring their own rendering while reusing one safe publish primitive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `execute:commit` refused to commit inside the repo's detached, dirty JJ working copy, so task commits used path-scoped `jj commit` to isolate only the plan-owned files without touching unrelated user changes.

## Next Phase Readiness

- Shared mutation primitives now exist and are ready for the state/session mutator migration in Plan 02.
- Later memory, handoff, and config migrations can reuse the same lock and atomic publish contract instead of introducing new ad hoc helpers.

## Self-Check

PASSED

- Verified files exist: `src/lib/project-lock.js`, `src/lib/atomic-write.js`, `tests/mutation-primitives.test.cjs`, `.planning/phases/163-shared-contracts-safe-mutation/163-01-SUMMARY.md`
- Verified task commits exist: `129db533`, `c80d04e2`

---
*Phase: 163-shared-contracts-safe-mutation*
*Completed: 2026-03-30*
