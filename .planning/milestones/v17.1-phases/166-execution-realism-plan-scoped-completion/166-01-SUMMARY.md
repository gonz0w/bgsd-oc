---
phase: 166-execution-realism-plan-scoped-completion
plan: 01
subsystem: planning
tags: [planning, verification, command-integrity, analyze-plan, workflow-guidance]
requires:
  - phase: 165-03
    provides: repo-local rebuilt-runtime proof for validating generated CLI artifacts after source changes
provides:
  - approval-time plan realism checks for stale commands, stale paths, verify-order hazards, and overscope risk
  - command inventory validation for node-invoked `bgsd-tools.cjs` guidance examples
  - planner, checker, and verifier wording that requires broader surfaced-guidance coverage for discoverability goals
affects: [phase-166-02, plan-phase, verify-work, bgsd-planner, bgsd-plan-checker]
tech-stack:
  added: []
  patterns:
    - approval uses `verify:verify plan-structure` for metadata semantics plus `verify:verify analyze-plan` for execution realism
    - discoverability-focused verification expands beyond touched-file regressions to surfaced guidance users actually follow
key-files:
  created: []
  modified:
    - agents/bgsd-plan-checker.md
    - agents/bgsd-planner.md
    - bin/bgsd-tools.cjs
    - src/commands/verify.js
    - src/lib/commandDiscovery.js
    - tests/plan.test.cjs
    - tests/plan-phase-workflow.test.cjs
    - tests/validate-commands.test.cjs
    - workflows/plan-phase.md
    - workflows/verify-work.md
key-decisions:
  - "`verify:verify analyze-plan` is the approval-time realism gate, while `verify:verify plan-structure` stays the metadata gate."
  - "Node-invoked `bgsd-tools.cjs` examples must validate against the same shipped CLI inventory as direct `bgsd-tools` calls."
  - "Discoverability-driven verification must inspect surfaced guidance users rely on, not only the touched regression file."
patterns-established:
  - "Approval-ready plans need both metadata-valid must_haves and repo-real command/path/verification checks."
  - "If a phase truth depends on command-family discoverability, verification must expand to broader surfaced guidance."
requirements-completed: [VERIFY-04, PLAN-02, PLAN-03]
one-liner: "Approval-time plan realism checks now block stale guidance, missing paths, later-task verify dependencies, and overscoped plans before execution handoff"
duration: 11min
completed: 2026-03-30
---

# Phase 166 Plan 01: Make planning and verification flows catch non-executable plans early by validating runnable guidance, real paths, task order, and scope before execution starts. Summary

**Approval-time plan realism checks now block stale guidance, missing paths, later-task verify dependencies, and overscoped plans before execution handoff**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-30 14:44:11 -0600
- **Completed:** 2026-03-30 14:54:44 -0600
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added regressions that prove approval should fail on stale `bgsd-tools` examples, stale repo paths, missing verify artifacts, later-task verify dependencies, and overscoped batches.
- Extended `verify:verify analyze-plan` to validate runnable guidance, repo-real path references, and task-order hazards before execution starts, then rebuilt `bin/bgsd-tools.cjs`.
- Updated planner, checker, and verifier guidance so discoverability-focused verification expands to broader surfaced guidance instead of trusting touched-file-only proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for stale plan guidance and execution-risky plan structure** - `0cd842d` (test)
2. **Task 2: Wire approval-time plan realism checks into the shipped validator path** - `ce7c516` (fix)
3. **Task 3: Update planner and verifier guidance to require the new realism gates** - `3f6ec55` (docs)

**Plan metadata:** Recorded in the final docs commit that captures summary, state, roadmap, and requirements updates.

## Files Created/Modified

- `agents/bgsd-plan-checker.md` [+3/-0]
- `agents/bgsd-planner.md` [+3/-0]
- `bin/bgsd-tools.cjs` [+412/-412]
- `src/commands/verify.js` [+265/-31]
- `src/lib/commandDiscovery.js` [+8/-2]
- `tests/plan-phase-workflow.test.cjs` [+28/-3]
- `tests/plan.test.cjs` [+140/-0]
- `tests/validate-commands.test.cjs` [+27/-0]
- `workflows/plan-phase.md` [+2/-2]
- `workflows/verify-work.md` [+2/-0]

## Decisions Made

- Kept plan realism in `verify:verify analyze-plan` instead of overloading `plan-structure`, so approval can distinguish execution realism from verifier metadata semantics.
- Treated node-invoked `bgsd-tools.cjs` examples as shipped CLI guidance, because workflow prompts and plans often use that runtime form directly.
- Required verifier wording to mention broader surfaced-guidance scans whenever success depends on discoverability, preventing false confidence from touched-file-only checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Legacy state finalizers could not parse the current workspace metadata format**
- **Found during:** Plan finalization
- **Issue:** `verify:state complete-plan` could not parse the repo's existing STATE layout, and `plan:requirements mark-complete` did not update the targeted requirement rows.
- **Fix:** Updated `STATE.md` and `REQUIREMENTS.md` directly after roadmap progress refresh so the on-disk summary, current position, and completed requirement checkboxes match the executed plan.
- **Files modified:** `.planning/STATE.md`, `.planning/REQUIREMENTS.md`
- **Verification:** `bgsd_validate` returned zero issues after the readback repair.
- **Committed in:** Final docs commit

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** Metadata finalization needed a readback repair, but the shipped plan-realism behavior and verification scope changes landed as intended.

## Issues Encountered

- Task 1 intentionally produced failing regressions until Task 2 rebuilt the local CLI bundle with the new analyze-plan behavior.
- The task and plan-end verification gates passed after `npm run build` refreshed `bin/bgsd-tools.cjs` for repo-local runtime proof.
- Final metadata helpers did not fully update the repo's legacy STATE/REQUIREMENTS files, so those two planning artifacts were repaired directly and then validated cleanly.

## Next Phase Readiness

- Phase 166 plan-scoped completion work can now build on approval gates that reject stale executable guidance before executor repair loops begin.
- Plan 166-02 can focus on summary scoping and completion readback accuracy with planner, checker, and verifier realism wording already aligned.

## Self-Check: PASSED

- FOUND: `.planning/phases/166-execution-realism-plan-scoped-completion/166-01-SUMMARY.md`
- FOUND: `0cd842d` task commit
- FOUND: `ce7c516` task commit
- FOUND: `3f6ec55` task commit

---
*Phase: 166-execution-realism-plan-scoped-completion*
*Completed: 2026-03-30*
