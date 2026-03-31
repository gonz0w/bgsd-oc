---
phase: 159-help-surface-command-integrity
plan: 13
subsystem: skills
tags: [commands, docs, validator, workflows, skills]
requires:
  - phase: 159-help-surface-command-integrity
    provides: reference-style validator classification and path-fragment-safe extraction from Plan 07
  - phase: 159-help-surface-command-integrity
    provides: exact shipped remaining-surface regression style from Plan 12
provides:
  - canonical onboarding, milestone, and expert guidance for the remaining Phase 159 gap-closure slice
  - canonical template, workflow, skill, and agent next-step wording for progress, gaps, todos, and direct CLI examples
  - narrowed validator treatment for frontmatter description metadata plus focused regressions over the touched gap-closure files
affects: [verification, docs, workflows, templates, skills, agent-prompts]
tech-stack:
  added: []
  patterns: [validator-safe reference-only metadata, direct file-backed command-guidance regression coverage]
key-files:
  created:
    - tests/guidance-command-integrity-gap-closure.test.cjs
  modified:
    - agents/bgsd-github-ci.md
    - docs/expert-guide.md
    - docs/getting-started.md
    - docs/milestones.md
    - skills/phase-argument-parsing/SKILL.md
    - skills/planner-scope-estimation/SKILL.md
    - src/lib/commandDiscovery.js
    - templates/state.md
    - tests/validate-commands.test.cjs
    - workflows/plan-milestone-gaps.md
    - workflows/research-phase.md
key-decisions:
  - "Treat frontmatter `description:` lines as reference-only metadata so validators stay strict on runnable prose without flagging descriptive agent and skill metadata."
  - "Normalize the remaining gap-closure docs and workflows to `/bgsd-inspect ...`, `/bgsd-plan gaps ...`, and namespaced `bgsd-tools` CLI examples so users can run them as written."
patterns-established:
  - "Gap-closure regressions should read the exact shipped files directly instead of synthetic snippets."
  - "Support-surface docs should use canonical planning, inspect, and todo families with concrete arguments whenever the flow shape is known."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical gap-closure guidance now spans onboarding docs, templates, skills, and validator-backed metadata handling for the last Phase 159 blocker slice"
duration: 10min
completed: 2026-03-30
---

# Phase 159 Plan 13: Close the remaining high-signal Phase 159 gaps by fixing the still-user-followable guidance called out in re-verification and trimming validator false positives on clearly reference-only metadata. Summary

**Canonical gap-closure guidance now spans onboarding docs, templates, skills, and validator-backed metadata handling for the last Phase 159 blocker slice**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T03:45:00Z
- **Completed:** 2026-03-30T03:55:07Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Rewrote the remaining onboarding, milestone-history, and expert-guide commands so surfaced progress, gap-closure, todo, and direct CLI examples now match canonical runnable routes.
- Updated the remaining workflow, template, skill, and agent wording to prefer `/bgsd-inspect ...`, `/bgsd-plan gaps ...`, and `/bgsd-plan todo ...` instead of stale aliases or vague shorthand.
- Narrowed command validation to treat frontmatter description metadata as reference-only and added a focused regression that reads the exact touched gap-closure files directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize the remaining user-followable docs and workflow next steps** - `ff07fdf` (docs)
2. **Task 2: Fix the remaining template, skill, and agent guidance blockers** - `34ac366` (docs)
3. **Task 3: Refine validator classification and lock the gap-closure slice with regressions** - `33f1f48` (test)

## Files Created/Modified

- `agents/bgsd-github-ci.md` [+1/-1]
- `docs/expert-guide.md` [+63/-63]
- `docs/getting-started.md` [+17/-19]
- `docs/milestones.md` [+9/-9]
- `skills/phase-argument-parsing/SKILL.md` [+2/-2]
- `skills/planner-scope-estimation/SKILL.md` [+2/-2]
- `src/lib/commandDiscovery.js` [+13/-0]
- `templates/state.md` [+2/-2]
- `tests/guidance-command-integrity-gap-closure.test.cjs` [+95/-0]
- `tests/validate-commands.test.cjs` [+37/-0]
- `workflows/plan-milestone-gaps.md` [+5/-5]
- `workflows/research-phase.md` [+3/-3]

## Decisions Made

- Frontmatter `description:` lines are now treated as reference-only metadata because they describe capabilities, not next-step guidance users should execute.
- The remaining gap slice now standardizes on explicit phase-aware planning and inspect commands so users do not have to infer missing arguments or command families.
- Focused regressions read real shipped files rather than snippets so future wording drift in these support surfaces is caught exactly where users see it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Repo-wide command validation still reports unrelated surfaced-guidance issues elsewhere in the repository, but the touched Phase 159 gap-closure slice is now validator-clean and no longer contributes to that blocker set.

## Next Phase Readiness

- Re-verification can now target Phase 159's remaining blocker slice with canonical docs, workflows, templates, skills, and agent wording in place.
- The shared validator and focused regression suite now protect the touched gap-closure files while leaving unrelated remaining guidance debt visible for later cleanup.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-13-SUMMARY.md`
- FOUND: `lulumrul` task commit for docs and workflow guidance cleanup
- FOUND: `zxvptmvk` task commit for template, skill, and agent guidance cleanup
- FOUND: `mvqsyuxy` task commit for validator and regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
