---
phase: 69-skills-architecture
plan: 02
subsystem: skills
tags: [opencode-skills, protocol-extraction, skill-architecture, lazy-loading]

# Dependency graph
requires:
  - phase: 69-skills-architecture
    provides: "build.cjs skill validation/manifest, deploy.sh skill routing (Plan 01)"
provides:
  - "9 shared protocol skills: project-context, commit-protocol, checkpoint-protocol, state-update-protocol, deviation-rules, goal-backward, structured-returns, research-patterns, tdd-execution"
  - "2 supporting reference files: checkpoints-reference.md, tdd-reference.md"
affects: [69-skills-architecture, agent-definitions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SKILL.md structure (frontmatter + 5 required sections)", "section markers for selective loading", "cross-references with <skill:name /> syntax", "placeholder documentation in Placeholders table"]

key-files:
  created:
    - skills/project-context/SKILL.md
    - skills/commit-protocol/SKILL.md
    - skills/checkpoint-protocol/SKILL.md
    - skills/checkpoint-protocol/checkpoints-reference.md
    - skills/state-update-protocol/SKILL.md
    - skills/deviation-rules/SKILL.md
    - skills/goal-backward/SKILL.md
    - skills/structured-returns/SKILL.md
    - skills/research-patterns/SKILL.md
    - skills/tdd-execution/SKILL.md
    - skills/tdd-execution/tdd-reference.md
  modified: []

key-decisions:
  - "All skills follow uniform structure (Purpose, Placeholders, Content, Cross-references, Examples) regardless of type"
  - "structured-returns uses <!-- section: agent-name --> markers for all 10 agents"
  - "Supporting reference files (checkpoints-reference.md, tdd-reference.md) provide depth; SKILL.md provides concise protocol"

patterns-established:
  - "SKILL.md frontmatter: name, description, type, agents, sections (optional)"
  - "Section markers: <!-- section: name --> for selective loading"
  - "Cross-references: <skill:name /> and <skill:name section='x' />"
  - "Placeholders: {{placeholder}} syntax documented in Placeholders table"

requirements-completed: [SKIL-01, SKIL-04]

# Metrics
duration: 8min
completed: 2026-03-08
---

# Phase 69 Plan 02: Shared Protocol Skills Summary

**9 shared protocol skills created with rewritten content covering project-context, commit-protocol, checkpoint-protocol, state-update-protocol, deviation-rules, goal-backward, structured-returns, research-patterns, and tdd-execution — each with YAML frontmatter, 5 required sections, valid cross-references, and documented placeholders**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T22:37:00Z
- **Completed:** 2026-03-08T22:45:04Z
- **Tasks:** 2
- **Files created:** 11

## Accomplishments
- Created 5 core protocol skills (project-context, commit-protocol, checkpoint-protocol, state-update-protocol, deviation-rules) with content rewritten from executor, CI, planner, and debugger agent sources
- Created 4 methodology skills (goal-backward, structured-returns, research-patterns, tdd-execution) with content rewritten from planner, verifier, both researchers, and all 10 agents
- Created 2 supporting reference files (checkpoints-reference.md, tdd-reference.md) migrated and improved from references/ directory
- structured-returns skill contains all 10 agent section markers for selective loading
- All 19 cross-references between skills resolve to valid skill directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Create core protocol skills** - `b4cd0b9` (feat) — 6 files, 762 lines
2. **Task 2: Create methodology skills** - `aacbbb4` (feat) — 5 files, 1038 lines

## Files Created/Modified
- `skills/project-context/SKILL.md` — Project discovery protocol for all agents
- `skills/commit-protocol/SKILL.md` — Staging, commit format, hash tracking with 3 sections
- `skills/checkpoint-protocol/SKILL.md` — Detection, handling, return format with 3 sections
- `skills/checkpoint-protocol/checkpoints-reference.md` — Detailed checkpoint type examples and anti-patterns
- `skills/state-update-protocol/SKILL.md` — STATE.md/ROADMAP.md update sequence
- `skills/deviation-rules/SKILL.md` — 4-rule auto-fix framework with executor and CI sections
- `skills/goal-backward/SKILL.md` — 5-step goal-backward methodology with must-haves format
- `skills/structured-returns/SKILL.md` — All 10 agent return format templates with section markers
- `skills/research-patterns/SKILL.md` — RAG tier strategy and source verification protocol
- `skills/tdd-execution/SKILL.md` — RED-GREEN-REFACTOR cycle with executor and planner sections
- `skills/tdd-execution/tdd-reference.md` — CLI gate commands, commit trailers, test quality guidelines

## Decisions Made
- All skills follow uniform structure regardless of type (shared vs agent-specific) — per RESEARCH.md recommendation
- structured-returns uses section markers for all 10 agents to enable selective loading via `<skill:structured-returns section="executor" />`
- Supporting reference files provide deep detail while SKILL.md stays concise (~50-100 lines of core content)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- All 9 shared protocol skills ready for agent-specific skills (Plan 03)
- Skill structure pattern established for remaining skills
- Cross-reference graph validated — no broken references
- Plans 03 (agent-specific skills) and 04 (agent migration) can proceed

## Self-Check: PASSED

All 11 created files verified on disk. Both task commits (b4cd0b9, aacbbb4) verified in git log.

---
*Phase: 69-skills-architecture*
*Completed: 2026-03-08*
