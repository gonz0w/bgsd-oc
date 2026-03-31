---
phase: 149-tdd-selection-contract-alignment
plan: 01
subsystem: testing
tags:
  - commonjs
  - json
  - javascript
  - markdown
requires:
  - phase: 148-review-readiness-release-pipeline
    provides: review-ready workflow and CLI help surfaces that Phase 149 aligns with the canonical TDD contract
provides:
  - Canonical TDD contract wording under skills/tdd-execution/
  - Workflow, template, and CLI help copy aligned to the same RED/GREEN/REFACTOR command names
  - Focused contract-drift tests for TDD docs and help surfaces
affects:
  - 150-tdd-execution-semantics-proof
  - planner guidance
  - executor workflow text
  - CLI help
tech-stack:
  added: []
  patterns:
    - Canonical skill owns TDD contract language; downstream docs defer to it
    - Focused drift tests lock shared command names and scope boundaries
key-files:
  created: [tests/agent.test.cjs, tests/workflow.test.cjs]
  modified:
    - bin/bgsd-tools.cjs
    - skills/tdd-execution/SKILL.md
    - skills/tdd-execution/tdd-reference.md
    - src/lib/constants.js
    - templates/plans/tdd.md
    - workflows/execute-plan.md
    - workflows/tdd.md
key-decisions:
  - Canonical TDD contract authority lives in skills/tdd-execution/SKILL.md, with the reference doc explicitly subordinate to it
  - Phase 149 language stops at contract alignment and defers deeper semantic enforcement and end-to-end proof to Phase 150
patterns-established:
  - Canonical contract pattern: skill text defines shared terms, commands, and expected artifacts; workflows/templates/help point back to it
  - Contract drift tests read source docs directly instead of depending on broader execution semantics
requirements-completed: [TDD-04]
one-liner: "Canonical RED/GREEN/REFACTOR contract wording with aligned workflow, template, CLI help, and drift tests"
duration: 5 min
completed: 2026-03-29
---

# Phase 149 Plan 01: Establish the single canonical TDD contract for Phase 149. Summary

**Canonical RED/GREEN/REFACTOR contract wording with aligned workflow, template, CLI help, and drift tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T01:15:03Z
- **Completed:** 2026-03-29T01:20:40Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Declared `skills/tdd-execution/SKILL.md` the single authoritative TDD contract and aligned `tdd-reference.md` under it.
- Reworded workflow, execute-plan, template, and CLI help surfaces to reuse the same RED/GREEN/REFACTOR command names and expected artifacts.
- Added focused tests that fail when the canonical skill, workflow text, and help copy drift or leak Phase 150 semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the TDD contract inside the shared skill and reference doc** - `4f83961` (docs)
2. **Task 2: Align workflow, template, and CLI help text to the canonical skill** - `83a9cd8` (chore)
3. **Task 3: Add focused tests that lock contract alignment in place** - `b2c1e9e` (test)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+125/-120]
- `bin/manifest.json` [+1/-1]
- `plugin.js` [+7/-2]
- `skills/skill-index/SKILL.md` [+1/-1]
- `skills/tdd-execution/SKILL.md` [+11/-2]
- `skills/tdd-execution/tdd-reference.md` [+12/-3]
- `src/lib/command-help.js` [+1/-1]
- `src/lib/constants.js` [+7/-2]
- `templates/plans/tdd.md` [+4/-2]
- `tests/agent.test.cjs` [+13/-0]
- `tests/workflow.test.cjs` [+30/-0]
- `workflows/execute-plan.md` [+2/-2]
- `workflows/tdd.md` [+11/-4]

## Decisions Made

- `skills/tdd-execution/SKILL.md` is the canonical TDD contract so downstream docs can defer instead of restating rules.
- Phase 149 stays limited to contract alignment; semantic-gate depth and end-to-end proof language were explicitly deferred to Phase 150.
- Contract alignment coverage reads source docs/help text directly so the tests catch wording drift without turning this phase into execution-proof validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced stale workflow verification invocation with a valid baseline-backed structure check**
- **Found during:** Task 2 (Align workflow, template, and CLI help text to the canonical skill)
- **Issue:** The plan-specified `workflow:verify-structure workflows/tdd.md` command is no longer a valid invocation because `workflow:verify-structure` expects a baseline file, not a workflow path.
- **Fix:** Verified the workflow with `node bin/bgsd-tools.cjs workflow:baseline && node bin/bgsd-tools.cjs workflow:verify-structure --raw`, which confirmed `tdd.md` still passes structure checks.
- **Files modified:** None (verification substitution only)
- **Verification:** Fresh baseline creation plus full workflow structure verification passed 47/47 workflows.
- **Committed in:** None — verification-only substitution

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Kept the plan within Phase 149 scope while replacing a stale verification command with the current equivalent check.

## Issues Encountered

- `execute:commit` refused task-scoped commits while unrelated working-tree files were present, so temporary stashes were used to preserve atomic per-task commits.

## Next Phase Readiness

- Phase 150 can now build on one canonical TDD contract instead of reconciling competing workflow/help/docs language first.
- Planner, executor, and CLI help surfaces now expose the same RED/GREEN/REFACTOR vocabulary and command names needed for later semantic hardening.

## Self-Check

PASSED

- Found `.planning/phases/149-tdd-selection-contract-alignment/149-01-SUMMARY.md`
- Found commit `4f83961`
- Found commit `83a9cd8`
- Found commit `b2c1e9e`

---
*Phase: 149-tdd-selection-contract-alignment*
*Completed: 2026-03-29*
