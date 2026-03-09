---
phase: 69-skills-architecture
plan: 03
subsystem: skills
tags: [skills, agent-specific, reference-migration, planner, debugger, executor, RACI, verification]

# Dependency graph
requires:
  - phase: none
    provides: none (wave 1, no dependencies)
provides:
  - 6 planner/executor agent-specific skills (task-breakdown, checkpoints, dependency-graph, scope-estimation, gap-closure, continuation)
  - 4 debugger agent-specific skills (hypothesis-testing, investigation, verification, research-reasoning)
  - 8 reference skills migrated from references/ (raci, automation-reference, git-integration, questioning, model-profiles, phase-argument-parsing, continuation-format, verification-reference)
affects: [69-skills-architecture, agents]

# Tech tracking
tech-stack:
  added: []
  patterns: [SKILL.md standard structure with frontmatter/Purpose/Placeholders/Content/Cross-references/Examples, agent-prefixed naming for agent-specific skills, concept naming for shared skills]

key-files:
  created:
    - skills/planner-task-breakdown/SKILL.md
    - skills/planner-checkpoints/SKILL.md
    - skills/planner-dependency-graph/SKILL.md
    - skills/planner-scope-estimation/SKILL.md
    - skills/planner-gap-closure/SKILL.md
    - skills/executor-continuation/SKILL.md
    - skills/debugger-hypothesis-testing/SKILL.md
    - skills/debugger-investigation/SKILL.md
    - skills/debugger-verification/SKILL.md
    - skills/debugger-research-reasoning/SKILL.md
    - skills/raci/SKILL.md
    - skills/automation-reference/SKILL.md
    - skills/git-integration/SKILL.md
    - skills/questioning/SKILL.md
    - skills/model-profiles/SKILL.md
    - skills/phase-argument-parsing/SKILL.md
    - skills/continuation-format/SKILL.md
    - skills/verification-reference/SKILL.md
  modified: []

key-decisions:
  - "Treated all skills uniformly (no structural difference between protocol/reference/agent-specific) — type field in frontmatter provides classification"
  - "Dropped reviewer-agent.md content as dead — consolidated agent no longer exists separately"
  - "continuation-format kept as standalone skill (not folded into executor-continuation) since they serve different purposes"

patterns-established:
  - "Agent-specific skills use type: agent-specific with single agent in agents field"
  - "Reference skills use type: shared with multiple agents in agents field"
  - "All skills follow 5-section structure: Purpose, Placeholders, Content, Cross-references, Examples"
  - "Content rewritten and improved during migration — not verbatim copy-paste from source"

requirements-completed: [SKIL-01, SKIL-04]

# Metrics
duration: 10min
completed: 2026-03-08
---

# Phase 69 Plan 03: Agent-Specific and Reference Skills Summary

**18 skills created: planner task-breakdown/checkpoints/dependency-graph/scope-estimation/gap-closure, executor continuation, debugger hypothesis-testing/investigation/verification/research-reasoning, plus 8 reference skills migrated from references/ directory (RACI, automation, git, questioning, model profiles, phase parsing, continuation format, verification patterns)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-08T22:36:59Z
- **Completed:** 2026-03-08T22:47:24Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments
- Created 6 planner/executor agent-specific skills extracting deep domain methodology (task anatomy, checkpoint planning, dependency graphs, scope estimation, gap closure, context continuation)
- Created 4 debugger agent-specific skills extracting ~700 lines of investigation methodology (hypothesis testing, 8 investigation techniques, fix verification, research vs reasoning)
- Migrated 8 reference files from references/ into skill directories, reorganized by topic with rewritten content (RACI, automation patterns, git integration, questioning, model profiles, phase parsing, continuation format, verification patterns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create planner and executor agent-specific skills** - `629c356` (feat)
2. **Task 2: Create debugger agent-specific skills** - `15c12e4` (feat)
3. **Task 3: Create reference skills from references/ directory** - `11adc8d` (feat)

## Files Created/Modified
- `skills/planner-task-breakdown/SKILL.md` - Task anatomy, sizing, specificity, TDD detection, user setup
- `skills/planner-checkpoints/SKILL.md` - Checkpoint types (90%/9%/1%), auth gates, writing guidelines
- `skills/planner-dependency-graph/SKILL.md` - Wave analysis, vertical slices, file ownership
- `skills/planner-scope-estimation/SKILL.md` - Context budget (50% target), split signals, depth calibration
- `skills/planner-gap-closure/SKILL.md` - Verification gap planning methodology
- `skills/executor-continuation/SKILL.md` - Context window state saving and resumption
- `skills/debugger-hypothesis-testing/SKILL.md` - Falsifiability, experimental design, evidence quality, recovery
- `skills/debugger-investigation/SKILL.md` - Binary search, rubber duck, minimal reproduction, 5 more techniques
- `skills/debugger-verification/SKILL.md` - 5-criteria verification, regression testing, stability testing
- `skills/debugger-research-reasoning/SKILL.md` - Research vs reasoning decision tree, balance indicators
- `skills/raci/SKILL.md` - Agent responsibility matrix, handoff contracts, coverage summary
- `skills/automation-reference/SKILL.md` - Service CLI reference, env var automation, dev server lifecycle
- `skills/git-integration/SKILL.md` - Commit points, message formats, per-task rationale
- `skills/questioning/SKILL.md` - Dream extraction philosophy, question types, anti-patterns
- `skills/model-profiles/SKILL.md` - Quality/balanced/budget profiles, resolution logic, rationale
- `skills/phase-argument-parsing/SKILL.md` - Phase number normalization, find-phase, validation
- `skills/continuation-format/SKILL.md` - Next Up block format, variants, context-pulling
- `skills/verification-reference/SKILL.md` - Stub detection, artifact verification, wiring checks

## Decisions Made
- Treated all skills uniformly — no structural difference between protocol, reference, and agent-specific skills. The `type` field in frontmatter provides classification (shared vs agent-specific)
- Dropped `reviewer-agent.md` content during migration — the consolidated agent (v8.0) no longer exists as a separate entity, and its review protocol content is handled by the executor's post-execution review step
- Kept `continuation-format` as a standalone skill separate from `executor-continuation` — they serve different purposes (presenting "what's next" vs saving context window state)

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — wave 1 parallel execution, review performed at phase level.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 18 agent-specific and reference skills created
- Combined with Plan 02's 9 shared skills and Plan 01's build/deploy infrastructure, the full skill inventory is ready
- Plan 04 (agent migration) can now reference all skills via `<skill:name />` tags
- Plan 05 (validation and tuning) can perform full pipeline validation

---
*Phase: 69-skills-architecture*
*Completed: 2026-03-08*
