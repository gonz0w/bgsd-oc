# Project State: v13.0 Closed-Loop Agent Evolution

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-15)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v13.0 — closed-loop agent evolution: local overrides, lesson-driven improvement, skill discovery, research enhancement

## Current Position

**Milestone:** v13.0 Closed-Loop Agent Evolution
**Phase:** Phase 129 of 133 (Foundation & Agent Overrides)
**Current Plan:** Not started
**Status:** Ready to plan
**Last Activity:** 2026-03-15

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 242 (through v12.1 Phase 128 Plan 03)
- Average duration: ~14 min/plan (improving with better tooling)
- Total execution time: ~41.5 hours

**Recent Trend:**
- v12.1 Phase 126 Plan 03: 4 min, 2 tasks, 1 file (1427 tests)
- v12.1 Phase 127 Plan 01: ~15 min, 2 tasks, 2 files (1446 tests)
- v12.1 Phase 127 Plan 02: ~10 min, 2 tasks, 2 files (1501 tests)
- v12.1 Phase 128 Plan 01: 12 min, 2 tasks, 4 files (1503 tests)
- v12.1 Phase 128 Plan 02: 14 min, 2 tasks, 2 files (1503 tests)
- v12.1 Phase 128 Plan 03: 5 min, 2 tasks, 2 files (1565 tests)
- v13.0 Phase 129 Plan 01: 11 min, 2 tasks, 3 files (foundation utilities + list-local)
- v13.0 Phase 129 Plan 02: 11 min, 2 tasks, 3 files (agent:override + agent:diff commands)
- v13.0 Phase 129 Plan 03: 4 min, 2 tasks, 4 files (agent:sync + local_agent_overrides)
- Trend: Stable, improving velocity with infrastructure improvements

*Updated after each plan completion*

## Accumulated Context

### v13.0 Roadmap Summary

- **Phases:** 129–133 (5 phases)
- **Requirements:** 33 total (LOCAL-*, LESSON-*, SKILL-*, DEVCAP-*, RESEARCH-* categories)
- **Coverage:** 100% — every requirement maps to exactly one phase
- **Dependencies:** Phase 129 first; Phase 130 before Phase 132; Phase 131 and 133 independent

### Phase Descriptions

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 129 | Foundation & Agent Overrides | Local agent override lifecycle with YAML validation | LOCAL-01 through LOCAL-07 |
| 130 | Lesson Schema & Analysis Pipeline | Structured lessons + analysis + workflow hooks | LESSON-01 through LESSON-09 |
| 131 | Skill Discovery & Security | Security-first skill lifecycle + agentskills.io discovery | SKILL-01 through SKILL-09 |
| 132 | Deviation Recovery Auto-Capture | Rule-1-only auto-capture in execute-phase | DEVCAP-01 through DEVCAP-04 |
| 133 | Enhanced Research Workflow | Structured quality profile + conflict detection | RESEARCH-01 through RESEARCH-04 |
### Key Decisions

- [v13.0 roadmap]: Phase 129 first — OC path correction (`.opencode/agents/` not `.planning/agents/`) and YAML validation must precede any automation writing agent files
- [v13.0 roadmap]: Phase 130 before Phase 132 — `lessons:capture` must exist before deviation auto-capture can call it
- [v13.0 roadmap]: Phase 131 independent — skill security architecture decoupled from lesson pipeline
- [v13.0 roadmap]: Phase 133 independent — research scoring has no dependency on Phases 129–132
- [v13.0 roadmap]: DEVCAP-01 typo fix included in Phase 132 (fix before building capture telemetry on top)
- [v13.0 roadmap]: Skill install writes to `.agents/skills/` only — never `~/.config`; 41-pattern security scan is mandatory, not optional
- [Phase 129 Plan 01]: LCS DP for generateUnifiedDiff — O(mn) is acceptable for agent files (<500 lines), avoids external diff library dependency
- [Phase 129 Plan 01]: sanitizeAgentContent uses regex lookbehind to exclude path contexts (.opencode/agents/) from editor name replacement
- [Phase 129 Plan 02]: findClosestAgent scores by prefix length (not agent name length) — bgsd-exector correctly maps to bgsd-executor via 9-char prefix match
- [Phase 129 Plan 02]: injectNameField adds name: as first frontmatter field; all global agents lack name: field so all overrides show a persistent diff at the name: line
- [Phase 129 Plan 03]: agent:sync uses --accept/--reject flags (not stdin) because bgsd-tools.cjs is a non-interactive CLI
- [Phase 129 Plan 03]: agent:sync raw string comparison for identical check — silent exit only when truly identical, expected that all overrides with injected name: field show 1-section diff

### Pending Work

Phase 129 complete (all 3 plans done). Execute Phase 130 (Lesson Schema & Analysis Pipeline) next.

### Blockers/Concerns

None.

## Session Continuity

**Last session:** 2026-03-15T18:19:46.715Z
**This session:** 2026-03-15 — Completed Phase 129 Plan 03 (agent:sync + local_agent_overrides enrichment)
**Next steps:**
1. Execute Phase 130 Plan 01 (Lesson Schema & Analysis Pipeline)
