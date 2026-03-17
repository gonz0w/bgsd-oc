---
phase: 137-section-level-loading-conditional-elision
plan: 02
subsystem: workflow-measurement
tags: [conditional-elision, token-savings, regression-testing, workflow:savings, dangling-reference]

requires:
  - phase: 137-01
    provides: elideConditionalSections() + workflow annotations with if= markers

provides:
  - "Dangling reference check: post-elision scan reports references to removed sections"
  - "workflow:savings command: cumulative token savings table (original→compressed→elided)"
  - "Structural regression tests for execute-plan, execute-phase, verify-work critical workflows"
  - "49 elision tests total (7 dangling reference + 14 regression + 28 from Plan 01)"

affects: [bgsd-executor, bgsd-planner, workflow-verification]

tech-stack:
  added: []
  patterns:
    - "Post-elision dangling reference scan: word-boundary regex on elided section names in remaining content"
    - "Historical token measurement: hardcoded SUMMARY fallbacks for pre-compression baselines"
    - "Worst-case elision measurement: strip all conditional sections for maximum savings estimate"

key-files:
  created: []
  modified:
    - src/plugin/command-enricher.js
    - src/commands/workflow.js
    - src/router.js
    - src/lib/commandDiscovery.js
    - src/lib/constants.js
    - tests/enricher-elision.test.cjs
    - bin/bgsd-tools.cjs

key-decisions:
  - "Dangling reference warnings propagated to _elision debug field in bgsd-context (not blocking)"
  - "workflow:savings uses hardcoded Phase 135 SUMMARY baselines — on-disk baselines all created post-compression"
  - "Post-elision column shows worst-case (all conditions false) by stripping all conditional sections from workflow files"
  - "Structural regression tests skip extractStructuralFingerprint from binary (not exported) — use section marker checks directly"

patterns-established:
  - "Dangling reference check: scan elided content names as word-boundary regex against remaining text"
  - "Historical measurement: SUMMARY files serve as authoritative record when disk snapshots are post-change"

requirements-completed: [COMP-04, SCAF-04]
one-liner: "Dangling reference check post-elision, workflow:savings cumulative table (42.3% avg reduction), 14 structural regression tests for execute-plan/execute-phase/verify-work; 49 elision tests pass"

duration: 15min
completed: 2026-03-17
---

# Phase 137 Plan 02: Cumulative Measurement, Regression Safety & Dangling Reference Check Summary

**Dangling reference check post-elision, workflow:savings cumulative table (42.3% avg reduction), 14 structural regression tests for execute-plan/execute-phase/verify-work; 49 elision tests pass**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-17T04:40:58Z
- **Completed:** 2026-03-17T04:55:58Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added post-elision dangling reference scan to `elideConditionalSections()` — word-boundary matching catches references to removed sections, propagates warnings to `_elision` debug field and BGSD_DEBUG logs
- Added `workflow:savings` command generating a 3-column cumulative savings table: Original (pre-Phase 135) → Post-Compression (Phase 135) → Post-Elision (all conditions false); shows 42.3% average total reduction across 10 target workflows
- Added 14 structural regression tests verifying execute-plan, execute-phase, and verify-work workflows maintain core sections after elision; `workflow:verify-structure` CLI test confirms 44/44 PASS

## Task Commits

Each task was committed atomically:

1. **Task 1: Dangling reference check after elision** - `6093f8f` (feat)
2. **Task 2: Cumulative token savings measurement** - `43bea63` (feat)
3. **Task 3: Structural regression verification on critical workflows** - `65f966f` (test)

**Plan metadata:** `a2bdd7d` (docs: complete plan)

## Files Created/Modified
- `src/plugin/command-enricher.js` — Post-elision dangling reference scan + BGSD_DEBUG logging + `_elision.dangling_warnings` field
- `src/commands/workflow.js` — `cmdWorkflowSavings()` + `stripAllConditionalSections()` helper (290 lines added)
- `src/router.js` — Wired `workflow:savings` subcommand routing
- `src/lib/commandDiscovery.js` — Added `workflow:savings` to COMMAND_TREE, aliases (`w:s`), COMMAND_CATEGORIES
- `src/lib/constants.js` — Added `workflow:savings` help entry to COMMAND_HELP
- `tests/enricher-elision.test.cjs` — 6 dangling reference tests + 1 integration test + 14 structural regression tests (352 lines added)
- `bin/bgsd-tools.cjs` — Rebuilt binary with all changes

## Decisions Made
- **Hardcoded Phase 135 baselines**: On-disk baseline files in `.planning/baselines/` were all created during Phase 137 Plan 01 testing (post-compression). They can't serve as pre-compression reference. Phase 135 SUMMARY files contain the authoritative measured token counts (execute-plan: 4749→2727, execute-phase: 5355→3321, quick: 2776→1659).
- **Post-elision = worst-case measurement**: The `workflow:savings` post-elision column strips ALL conditional sections from workflow files regardless of enrichment state — this represents maximum possible savings (all conditions false: no TDD, no CI, no review). Shows 2424 for execute-plan vs 2727 post-compression (11% elision savings).
- **Dangling reference warning is non-blocking**: Warnings propagated to `_elision.dangling_warnings` debug field but don't block enrichment. BGSD_DEBUG logs them as console.error. No current workflow has dangling references.
- **Structural regression tests avoid binary exports**: `extractStructuralFingerprint` isn't exported from the bundled binary. Tests use direct section marker string checks instead — simpler and more explicit about what's verified.

## Deviations from Plan

None — plan executed exactly as written, with one clarification: the "post-elision" column measurement strategy was specified as "worst-case savings (all conditions false)" which required a `stripAllConditionalSections()` helper rather than re-using the enricher's runtime elision (which requires a live enrichment object).

## Issues Encountered
- Initial `workflow:savings` showed 0% savings because all disk baselines were created post-compression during Plan 01 testing. Fixed by using hardcoded Phase 135 SUMMARY values as the authoritative historical reference.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 137 complete — all COMP-04 and SCAF-04 requirements met
- Cumulative token savings verified: 42.3% average reduction across 10 target workflows
- 49 elision tests pass, workflow:verify-structure 44/44 PASS
- v14.0 milestone ready for audit/completion

---
*Phase: 137-section-level-loading-conditional-elision*
*Completed: 2026-03-17*
