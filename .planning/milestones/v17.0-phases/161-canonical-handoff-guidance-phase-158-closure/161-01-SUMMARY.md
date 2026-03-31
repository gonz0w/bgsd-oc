---
phase: 161-canonical-handoff-guidance-phase-158-closure
plan: 01
subsystem: testing
tags: [commonjs, javascript, handoffs, command-integrity, canonical-commands]
requires:
  - phase: 159-help-surface-command-integrity
    provides: canonical planning-family guidance and validator coverage
  - phase: 160-phase-intent-alignment-verification
    provides: closure context and milestone audit follow-up inputs
provides:
  - canonical runtime handoff next-command generation for discuss and restart flows
  - rebuilt CLI output aligned with canonical planning-family runtime guidance
  - regression coverage for generated and persisted handoff guidance
affects: [phase-158-verification, runtime-handoffs, command-validation]
tech-stack:
  added: []
  patterns:
    - canonical planning-family commands in generated handoff and restart guidance
    - validator-backed runtime guidance regression coverage
key-files:
  created: []
  modified:
    - src/commands/init.js
    - bin/bgsd-tools.cjs
    - tests/state.test.cjs
    - tests/integration.test.cjs
    - tests/workflow.test.cjs
    - tests/guidance-command-integrity-workflows-handoffs.test.cjs
key-decisions:
  - "Canonicalize discuss-step handoffs to `/bgsd-plan research <phase>` and restart guidance to `/bgsd-plan discuss <phase>` at the runtime source."
  - "Lock runtime handoff guidance with focused state, integration, workflow, and validator-backed regressions rather than widening unrelated static-doc coverage."
patterns-established: []
requirements-completed:
  - CMD-02
  - CMD-03
  - CMD-05
  - CMD-06
one-liner: "Canonical runtime handoff guidance now uses `/bgsd-plan discuss|research <phase>` with rebuilt CLI output and regression coverage across state, integration, and validator-backed workflow surfaces."
duration: 6 min
completed: 2026-03-30
---

# Phase 161 Plan 01: Close the remaining Phase 158 blocker by canonicalizing generated planning-prep handoff and restart guidance in the runtime handoff path. Summary

**Canonical runtime handoff guidance now uses `/bgsd-plan discuss|research <phase>` with rebuilt CLI output and regression coverage across state, integration, and validator-backed workflow surfaces.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-30T12:08:32Z
- **Completed:** 2026-03-30T12:15:11Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Canonicalized generated discuss-step handoff and restart commands in `src/commands/init.js` so runtime guidance stops emitting legacy planning-prep aliases.
- Rebuilt `bin/bgsd-tools.cjs` immediately after the source update so shipped CLI behavior matches source-level handoff guidance.
- Added focused regression coverage proving persisted handoffs, runtime defaults, and workflow-facing validator checks stay on canonical `/bgsd-plan` routes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize generated handoff next-step and restart commands at the source** - `716a565` (fix)
2. **Task 2: Lock canonical handoff output across unit state and integration tests** - `c878feb` (test)
3. **Task 3: Strengthen canonical-guidance proof for dynamic handoff surfaces** - `de3e892` (test)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+335/-332]
- `src/commands/init.js` [+2/-2]
- `tests/guidance-command-integrity-workflows-handoffs.test.cjs` [+6/-1]
- `tests/integration.test.cjs` [+2/-2]
- `tests/state.test.cjs` [+2/-2]
- `tests/workflow.test.cjs` [+14/-6]

## Decisions Made

- Canonical runtime output now prefers `/bgsd-plan research <phase>` and `/bgsd-plan discuss <phase>` directly at the source helper so resume and repair guidance stay executable as written.
- Runtime guidance proof stays narrow and auditable through state, integration, workflow, and validator-backed tests instead of reopening unrelated static-surface coverage already handled in earlier phases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used path-scoped git commits when `execute:commit` rejected the dirty tree**
- **Found during:** Task 1 / Task 2 / Task 3 commit steps
- **Issue:** The repo already contained unrelated working-tree changes, so `execute:commit` refused otherwise scoped task commits.
- **Fix:** Used `git commit --only ...` for each task's explicit file set to preserve atomic task commits without sweeping in unrelated files.
- **Files modified:** None beyond the task-owned files already listed above
- **Verification:** Each task produced its own commit hash and plan-scoped verification still passed
- **Committed in:** `716a565`, `c878feb`, `de3e892`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Commit mechanics changed, but shipped code and verification scope stayed aligned with the written plan.

## Issues Encountered

- `npm test` failed on multiple unrelated pre-existing suites outside this plan's file scope (including yq fallback, codebase intelligence JJ fixtures, settings reference guidance, env scan, and other legacy guidance checks). All plan-scoped verification commands passed, so the broad regression failure is documented as an existing repo issue rather than a Phase 161 implementation regression.

## Next Phase Readiness

- Phase 158 closure evidence is now in the runtime handoff path, built CLI, and validator-backed regression tests.
- Remaining milestone follow-up can focus on Phase 162 intent runtime parity without reopening the canonical planning-prep handoff blocker.

## Self-Check: PASSED

- Verified summary and referenced task files exist on disk.
- Verified task commits `716a565`, `c878feb`, and `de3e892` exist in repository history.

---
*Phase: 161-canonical-handoff-guidance-phase-158-closure*
*Completed: 2026-03-30*
