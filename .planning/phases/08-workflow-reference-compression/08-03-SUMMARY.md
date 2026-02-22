---
phase: 08-workflow-reference-compression
plan: 03
subsystem: cli
tags: [research-templates, section-markers, compact-tiers, context-reduction]

requires:
  - phase: 08-workflow-reference-compression
    provides: "extract-sections CLI command and section marker convention"
provides:
  - "Research template with <research_compact> compact tier for planners"
  - "Section markers on all 6 research templates for selective loading"
  - "Compact blocks on all 5 research-project templates (SUMMARY, ARCHITECTURE, FEATURES, PITFALLS, STACK)"
  - "Post-compression baseline showing -35.7% average reduction across top 6 workflows"
affects: [workflows, agents, plan-phase]

tech-stack:
  added: []
  patterns: ["compact tier: <research_compact> block as default planner view", "section markers on research templates for extract-sections integration"]

key-files:
  created: []
  modified:
    - templates/research.md
    - templates/research-project/SUMMARY.md
    - templates/research-project/ARCHITECTURE.md
    - templates/research-project/FEATURES.md
    - templates/research-project/PITFALLS.md
    - templates/research-project/STACK.md
    - bin/gsd-tools.test.cjs

key-decisions:
  - "Compact blocks use XML tags (<research_compact>, <compact_summary>, etc.) consistent with existing template conventions"
  - "Section markers placed outside code fences where possible — inside code fences for template content (extract-sections handles both)"
  - "Top 6 workflow avg reduction at -35.7% exceeds 30% target (3 workflows compressed by Plan 08-02, 3 unchanged)"

patterns-established:
  - "Research compact tier: ~40-60 lines with summary, key stack, top pitfalls, user constraints"
  - "Research-project compact tier: ~25-30 lines per file with essential findings only"

requirements-completed: [WKFL-04]

duration: 8min
completed: 2026-02-22
---

# Phase 8 Plan 03: Research Template Summary/Detail Tiers + Baseline Comparison Summary

**Compact/detail tiers added to all 6 research templates enabling planners to load ~30% of research by default, plus post-compression baseline showing -35.7% avg reduction across top 6 workflows**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T19:24:12Z
- **Completed:** 2026-02-22T19:32:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added `<research_compact>` compact tier to `templates/research.md` with quick-reference summary, key stack table, top pitfalls, and user constraints
- Added `<!-- section: name -->` markers to all major sections in `templates/research.md` (8 sections: compact, user_constraints, research_summary, standard_stack, architecture, dont_hand_roll, pitfalls, code_examples, sota)
- Added compact blocks to all 5 research-project templates with condensed findings per template type
- Added section markers to all 5 research-project templates (33 total markers across all files)
- Post-compression baseline captured: 92,186 total tokens across 43 workflows
- Before/after comparison: execute-phase.md -55.1%, verify-phase.md -86.8%, new-project.md -72.5%, top 6 avg -35.7%
- Smoke test for extract-sections command passes (201/202 tests, 1 pre-existing DEBT-01 failure)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add summary/detail tiers to research templates** - `20d1a37` (feat)
2. **Task 2: Baseline comparison and extract-sections smoke test** - `e657755` (feat)

## Files Created/Modified
- `templates/research.md` - Added compact tier block and section markers on all major sections
- `templates/research-project/SUMMARY.md` - Added `<compact_summary>` block and 6 section markers
- `templates/research-project/ARCHITECTURE.md` - Added `<architecture_compact>` block and 7 section markers
- `templates/research-project/FEATURES.md` - Added `<features_compact>` block and 6 section markers
- `templates/research-project/PITFALLS.md` - Added `<pitfalls_compact>` block and 9 section markers
- `templates/research-project/STACK.md` - Added `<stack_compact>` block and 5 section markers
- `bin/gsd-tools.test.cjs` - Added smoke test for extract-sections command registration

## Decisions Made
- Compact blocks use XML tags (`<research_compact>`, `<compact_summary>`, etc.) consistent with existing template conventions — planners already parse XML tags
- Section markers placed around template content sections for selective loading via extract-sections
- Top 6 workflow average reduction of -35.7% exceeds Phase 8 success criterion 5 (30% target)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 8 research template tiers complete — WKFL-04 fulfilled
- Phase 8 Plan 02 (workflow compression) remains to be executed for WKFL-03
- Before/after baseline shows 30%+ reduction already achieved for top 6 workflows
- Ready for Phase 9 tech debt cleanup after Plan 02 completes

---
*Phase: 08-workflow-reference-compression*
*Completed: 2026-02-22*
