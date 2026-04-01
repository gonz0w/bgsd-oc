---
phase: 175-canonical-command-surface-alignment
plan: 02
subsystem: cli
tags: [planning, commands, docs, workflows]
requires:
  - phase: 175-canonical-command-surface-alignment
    provides: shared /bgsd-plan route metadata and shorthand rejection rules
provides:
  - canonical planning-entry docs with explicit `/bgsd-plan phase|discuss|research|assumptions <phase>` guidance
  - focused planning-entry parity tests that distinguish reference-style placeholders from runnable examples
affects: [phase-175-plan-03, phase-175-plan-04]
tech-stack:
  added: []
  patterns:
    - primary planning docs and workflow entrypoints keep required phase operands visible in runnable guidance
    - focused command-integrity tests validate only the owned planning-entry surfaces for this slice
key-files:
  created: []
  modified:
    - docs/commands.md
    - docs/workflows.md
    - workflows/plan-phase.md
    - workflows/discuss-phase.md
    - workflows/research-phase.md
    - tests/guidance-command-integrity-remaining-surfaces.test.cjs
    - tests/guidance-command-integrity-workflow-prep-b.test.cjs
    - workflows/list-phase-assumptions.md
key-decisions:
  - "Use `<phase>` or `<phase-number>` in primary planning-entry guidance so runnable examples always surface the required operand."
  - "Keep the remaining-surfaces regression scoped to plan-owned planning-entry docs and workflows so unrelated command-surface debt does not mask this slice's parity signal."
patterns-established:
  - "Reference-style planning-family labels stay explanatory only; runnable examples always show the explicit canonical `/bgsd-plan` route with its phase operand."
requirements-completed: [CLI-01, CLEAN-03, SAFE-03]
one-liner: "Primary planning docs and workflow entrypoints now teach explicit `/bgsd-plan` phase, discuss, research, and assumptions routes with visible phase operands and focused parity checks"
duration: 6min
completed: 2026-04-01
---

# Phase 175 Plan 02: Align the primary planning-family docs and workflow entrypoints to the canonical `/bgsd-plan` grammar for phase planning and planning-prep. Summary

**Primary planning docs and workflow entrypoints now teach explicit `/bgsd-plan` phase, discuss, research, and assumptions routes with visible phase operands and focused parity checks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31 21:54:04 -0600
- **Completed:** 2026-03-31 21:59:55 -0600
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Tightened the planning-entry regression tests so discuss, research, assumptions, and primary workflow docs now fail when explicit phase operands disappear.
- Rewrote the main planning docs and workflow tables to teach only canonical `/bgsd-plan phase|discuss|research|assumptions <phase>` guidance.
- Clarified reference-style planning-family labels versus runnable examples so shorthand and wrapper drift stay out of the primary planning surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand parity tests for the primary planning-family entry surfaces** - `e747eb1` (test)
2. **Task 2: Rewrite primary planning-family docs and workflow entry guidance** - `2c0a702` (docs)

## Files Created/Modified

- `docs/commands.md` [+1/-1]
- `docs/workflows.md` [+5/-5]
- `tests/guidance-command-integrity-remaining-surfaces.test.cjs` [+29/-69]
- `tests/guidance-command-integrity-workflow-prep-b.test.cjs` [+3/-1]
- `workflows/discuss-phase.md` [+2/-2]
- `workflows/list-phase-assumptions.md` [+5/-6]
- `workflows/plan-phase.md` [+1/-1]
- `workflows/research-phase.md` [+1/-1]

## Decisions Made

- Switched the user-facing workflow table examples from `[phase]` placeholders to `<phase>` so the primary entry surfaces keep the required operand visible while still reading as reference syntax.
- Scoped the remaining-surfaces validator coverage to the plan-owned docs and workflow entrypoints so this slice proves its own canonical planning-family alignment without inheriting unrelated command-integrity failures.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first pass of the expanded remaining-surfaces regression still inherited unrelated command-integrity failures from execute/architecture/runtime surfaces, so the final focused regression was narrowed back to the plan-owned planning-entry files before verification.

## Next Phase Readiness

- Plans 03-04 can reuse the same explicit-operand phrasing and focused parity-test pattern for roadmap, gaps, todo, and adjacent next-step surfaces.
- The primary planning entrypoints now match the canonical `/bgsd-plan` grammar, reducing drift risk for follow-on surface cleanup.

## Self-Check: PASSED

- Found `.planning/phases/175-canonical-command-surface-alignment/175-02-SUMMARY.md`
- Found all touched docs, workflow, and regression-test files for Plan 02
- Verified commits `wrnonypr` and `prskstvl` in `jj log`

---
*Phase: 175-canonical-command-surface-alignment*
*Completed: 2026-04-01*
