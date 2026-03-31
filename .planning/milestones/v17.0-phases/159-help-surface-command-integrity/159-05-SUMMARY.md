---
phase: 159-help-surface-command-integrity
plan: 05
subsystem: docs
tags: [commands, guidance, agents, skills, tests]
requires:
  - phase: 158-canonical-command-families
    provides: canonical planning and settings command families
  - phase: 159-help-surface-command-integrity
    provides: validator-backed command integrity rules from Plan 02
provides:
  - canonical planning and settings examples across touched agent prompts
  - canonical executable examples across shared continuation, model-profile, and responsibility skills
  - focused regression coverage that validates touched agent and skill command guidance
affects: [agents, skills, validation]
tech-stack:
  added: []
  patterns: [canonical-only guidance examples, focused validator-backed surfaced guidance checks]
key-files:
  created: [tests/guidance-command-integrity-agent-skill-surfaces.test.cjs]
  modified: [agents/bgsd-phase-researcher.md, agents/bgsd-planner.md, agents/bgsd-plan-checker.md, agents/bgsd-roadmapper.md, agents/bgsd-verifier.md, agents/bgsd-codebase-mapper.md, skills/continuation-format/SKILL.md, skills/model-profiles/SKILL.md, skills/raci/SKILL.md]
key-decisions:
  - keep agent and skill guidance canonical-only while expressing required planning arguments as visible phase placeholders
  - use focused validator fixtures with concrete phase values so touched surfaces prove executable command shape without depending on unrelated pending phase cleanups
patterns-established:
  - "Supporting agent and skill prompts should teach only canonical planning/settings families on surfaced command examples."
  - "Focused surfaced-guidance tests can pair exact wording assertions with shared validator checks for semantic command correctness."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical planning and settings guidance across agent prompts and shared skills with validator-backed regression coverage for these surfaces"
duration: 15min
completed: 2026-03-30
---

# Phase 159 Plan 05: Canonicalize supporting agent and skill guidance surfaces Summary

**Canonical planning and settings guidance across agent prompts and shared skills with validator-backed regression coverage for these surfaces**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T01:26:11.995Z
- **Completed:** 2026-03-30T01:41:11.995Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Replaced stale planning-prep aliases in the touched agent prompts with canonical `/bgsd-plan` guidance and explicit phase placeholders for discussion, research, planning, and gap-closure flows.
- Updated shared continuation, model-profile, and responsibility skill examples so they surface canonical planning, settings, and inspect commands only.
- Added a focused regression that locks these agent and skill surfaces and reuses the shared command-integrity validator to prove the touched examples remain executable as written.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize supporting agent prompt surfaces** - `mzqkyrnt` (docs)
2. **Task 2: Canonicalize shared skill examples and lock these surfaces** - `nxvsntzx` (test)

## Files Created/Modified

- `agents/bgsd-phase-researcher.md` - Canonicalizes research and discuss guidance to `/bgsd-plan` command-family examples.
- `agents/bgsd-planner.md` - Rewrites planning, gap, and research orchestration examples to canonical planning-family commands.
- `agents/bgsd-plan-checker.md` - Aligns plan-checker spawn and context references with canonical planning-family guidance.
- `agents/bgsd-roadmapper.md` - Points downstream roadmap consumption at the canonical planning entrypoint.
- `agents/bgsd-verifier.md` - Routes gap-closure guidance through `/bgsd-plan gaps`.
- `agents/bgsd-codebase-mapper.md` - References `/bgsd-plan phase` as the planning consumer for codebase documents.
- `skills/continuation-format/SKILL.md` - Updates the phase-complete next-step example to `/bgsd-plan phase 3`.
- `skills/model-profiles/SKILL.md` - Replaces the legacy profile-switch example with `/bgsd-settings profile quality`.
- `skills/raci/SKILL.md` - Canonicalizes planning-family ownership rows and switches progress reporting to `/bgsd-inspect progress`.
- `tests/guidance-command-integrity-agent-skill-surfaces.test.cjs` - Adds exact wording assertions plus focused shared-validator coverage for the touched agent and skill surfaces.

## Decisions Made

- Used visible `[phase]` placeholders in agent and skill prompts so the guidance keeps the required planning argument shape without pretending a fixed phase number applies everywhere.
- Kept the validator-backed regression focused on curated touched-surface examples with concrete values because the repo-wide validator still reports unrelated pending Phase 159 issues from sibling plans.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repo-wide `util:validate-commands` gate still reports unrelated surfaced-guidance failures in other pending Phase 159 plans, so plan-local verification relied on the new focused regression's shared-validator coverage for these touched agent and skill files.

## Next Phase Readiness

- Agent prompts and shared skills now reinforce the same canonical command contract as the main help, docs, and workflow surfaces already updated in this phase.
- The new regression gives the remaining Phase 159 template and runtime cleanup plans a reusable pattern for locking focused surfaced-guidance slices without weakening semantic command validation.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-05-SUMMARY.md`
- FOUND: `mzqkyrnt` task commit for agent guidance canonicalization
- FOUND: `nxvsntzx` task commit for agent and skill regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
