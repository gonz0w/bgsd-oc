---
phase: 35-workflow-output-tightening
plan: 02
subsystem: docs
tags: [workflow-tightening, token-reduction, bGSD, output-patterns]

requires:
  - phase: 35-workflow-output-tightening
    provides: ui-brand.md bGSD branding reference (Plan 01)
provides:
  - 455-line reduction across 27 workflow and reference files
  - All --raw flag references removed from workflows/references
  - Consistent bGSD branding across all agent-consumed files
affects: [36-integration-polish]

tech-stack:
  added: []
  patterns: [direct-imperative prose in workflows, compressed required_reading blocks]

key-files:
  created: []
  modified: [workflows/help.md, workflows/progress.md, workflows/execute-phase.md, workflows/discuss-phase.md, workflows/transition.md, workflows/resume-project.md, workflows/update.md, workflows/diagnose-issues.md, workflows/new-milestone.md, workflows/quick.md, workflows/map-codebase.md, workflows/discovery-phase.md, workflows/execute-plan.md, workflows/new-project.md, workflows/settings.md, workflows/add-todo.md, workflows/complete-and-clear.md, workflows/health.md, workflows/set-profile.md, workflows/audit-milestone.md, workflows/plan-milestone-gaps.md, references/checkpoints.md, references/verification-patterns.md, references/git-integration.md, references/planning-config.md, references/decimal-phase-calculation.md, references/phase-argument-parsing.md, references/model-profiles.md]

key-decisions:
  - "No Starting/Processing/Done noise patterns existed — prior v1.1 pass already cleaned them"
  - "help.md offered largest tightening opportunity (44% reduction) by compressing verbose command descriptions"
  - "All ~40 standalone GSD brand references converted to bGSD across workflows and references"
  - "4 residual --raw references in reference files removed (legacy from Phase 30 migration)"

patterns-established:
  - "Direct imperative prose: no filler words (please, make sure, you should) in workflow instructions"
  - "Compressed required_reading: single-line format instead of multi-line blocks"

requirements-completed: [WKFL-04, WKFL-05, WKFL-07]

duration: 10min
completed: 2026-02-27
---

# Phase 35 Plan 02: Workflow & Reference File Tightening Summary

**455-line reduction across 27 workflow/reference files — help.md cut 44%, all --raw and standalone GSD references eliminated**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-27T04:25:34Z
- **Completed:** 2026-02-27T04:35:47Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Reduced 455 lines (166 insertions, 621 deletions) across 22 workflow and 7 reference files
- `help.md` cut from 486 → 270 lines (44% reduction) — largest single-file gain
- Removed all 4 remaining `--raw` flag references in reference files
- Converted ~40 standalone `GSD` brand references to `bGSD` across all files
- Standardized `<required_reading>` blocks to concise single-line format
- Compressed verbose purpose, philosophy, and success_criteria sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Measure baselines and tighten top 10 workflow files** - `48935e9` (docs)
2. **Task 2: Tighten remaining workflow and reference files** - `48935e9` (docs)

_Note: Both tasks committed together as a single atomic change since tightening was applied in one pass._

## Files Created/Modified

### Workflow files (22)
- `workflows/help.md` - 486→270 (-216 lines, 44%) — compressed verbose command descriptions
- `workflows/progress.md` - 381→345 (-36 lines) — compressed step explanations
- `workflows/execute-phase.md` - 422→391 (-31 lines) — removed redundant context
- `workflows/discuss-phase.md` - 490→464 (-26 lines) — tightened conditionals
- `workflows/transition.md` - 544→513 (-31 lines) — compressed phase transition logic
- `workflows/resume-project.md` - 166→140 (-26 lines) — removed filler words
- `workflows/update.md` - 139→111 (-28 lines) — compressed update instructions
- `workflows/diagnose-issues.md` - 242→220 (-22 lines) — tightened diagnostic steps
- `workflows/new-milestone.md` - 349→333 (-16 lines) — compressed milestone setup
- `workflows/quick.md` - 217→205 (-12 lines) — removed noise
- `workflows/map-codebase.md` - 223→213 (-10 lines) — tightened instructions
- `workflows/discovery-phase.md` - 198→190 (-8 lines) — compressed
- `workflows/execute-plan.md` - Minor tightening
- `workflows/new-project.md` - Minor tightening
- `workflows/settings.md` - Minor tightening
- `workflows/add-todo.md` - Minor tightening
- `workflows/complete-and-clear.md` - Minor tightening
- `workflows/health.md` - Minor tightening
- `workflows/set-profile.md` - Minor tightening
- `workflows/audit-milestone.md` - Minor tightening
- `workflows/plan-milestone-gaps.md` - Minor tightening
- `workflows/list-phase-assumptions.md` - Minor tightening

### Reference files (7)
- `references/checkpoints.md` - 782→746 (-36 lines) — compressed checkpoint patterns
- `references/verification-patterns.md` - Tightened verification examples
- `references/git-integration.md` - Removed --raw references
- `references/planning-config.md` - Tightened config docs
- `references/decimal-phase-calculation.md` - Removed --raw reference
- `references/phase-argument-parsing.md` - Removed --raw reference
- `references/model-profiles.md` - Brand fix

## Decisions Made
- No "Starting..."/"Processing..."/"Done." noise patterns existed — prior v1.1 compression pass (Phase 8) already cleaned them
- `help.md` offered the largest tightening opportunity because command descriptions were verbose multi-line paragraphs
- All ~40 standalone `GSD` brand references converted to `bGSD` (beyond what Plan 01 did in ui-brand.md)
- 4 residual `--raw` references found in reference files and removed (leftover from Phase 30 migration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] GSD → bGSD brand consistency across all files**
- **Found during:** Task 1 (while tightening workflow files)
- **Issue:** ~40 standalone `GSD` references inconsistent with bGSD branding established in Plan 01
- **Fix:** Converted all `GSD` → `bGSD` across workflows and references, including `GSD ►` banner prefixes
- **Files modified:** All 27 modified files
- **Verification:** `grep -r '\bGSD\b' workflows/ references/ | grep -v bGSD` → 0 results
- **Committed in:** `48935e9`

---

**Total deviations:** 1 auto-fixed (Rule 2 - brand consistency)
**Impact on plan:** Brand fix was necessary for consistency with Phase 35-01 output. No scope creep.

## Issues Encountered

- `references/ui-brand.md` was already expanded by Phase 35-01 (160→238 lines), making the reference file total appear to increase. This is a baseline measurement artifact, not a regression from this plan's tightening work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 35 complete — all workflow and reference files tightened with consistent branding
- Phase 36 (Integration & Polish) can proceed — all dependencies met
- Command renderer phases (32-34) unblocked and can execute in any order

---
*Phase: 35-workflow-output-tightening*
*Completed: 2026-02-27*
