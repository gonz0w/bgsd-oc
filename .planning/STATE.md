# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-15)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v14.0 LLM Workload Reduction — workflow compression and scaffold generation

## Current Position

**Milestone:** v14.0 LLM Workload Reduction
**Phase:** Not started (defining requirements)
**Current Plan:** —
**Status:** Defining requirements
**Last Activity:** 2026-03-16 — Milestone v14.0 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 254 (through v13.0 Phase 133 Plan 02)
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
- v13.0 Phase 130 Plan 01: 10 min, 2 tasks, 9 files (lessons schema + capture + migrate + list + memory filters)
- v13.0 Phase 130 Plan 02: 8 min, 2 tasks, 6 files (lessons:analyze + suggest + compact + workflow hooks)
- v13.0 Phase 131 Plan 01: 12 min, 2 tasks, 1 file (security scanner + skills:list + skills:validate)
- v13.0 Phase 131 Plan 02: 12 min, 2 tasks, 1 file (skills:install + skills:remove + audit logging)
- v13.0 Phase 131 Plan 03: 6 min, 2 tasks, 6 files (router wiring + enricher installed_skills + new-milestone Step 8.5)
- v13.0 Phase 132 Plan 01: 8 min, 2 tasks, 9 files (autonomousRecoveries typo fix + lessons:deviation-capture with Rule-1 filter + 3-cap)
- v13.0 Phase 132 Plan 02: 5 min, 2 tasks, 4 files (deviation_auto_capture hook in execute-plan.md + help/discovery metadata)
- v13.0 Phase 133 Plan 01: 8 min, 2 tasks, 4 files (research:score + research:gaps command handlers with 22 tests)
- v13.0 Phase 133 Plan 02: 8 min, 2 tasks, 5 files (help/discovery wiring + new-milestone.md quality profile integration)
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
| Phase 0133 P01 | 8min | 2 tasks | 4 files |
| Phase 0133-02 P02 | 8min | 2 tasks | 5 files |

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
- [Phase 130 Plan 01]: validateLesson() receives pre-built entry — id/date set by caller, validation only checks 6 schema-required fields — keeps validation pure and testable
- [Phase 130 Plan 01]: cmdLessonsMigrate uses type:environment as sentinel per LESSON-02 — downstream analysis can exclude legacy entries by checking type!=environment
- [Phase 130 Plan 01]: lessons-specific filters in cmdMemoryRead use options.type/since/severity to avoid collision with trajectory filter options
- [Phase 130 Plan 02]: lessons:suggest excludes type:environment per LESSON-02 sentinel — migrated free-form lessons lack structured data, filtering prevents noisy suggestions
- [Phase 130 Plan 02]: lessons:compact normalizes root_cause by lowercase+trim before grouping — ensures case/whitespace variants merge correctly
- [Phase 130 Plan 02]: workflow hooks use 2>/dev/null || true — lessons command failures must never block verification or milestone completion
- [Phase 131 Plan 01]: 41 patterns exactly in SECURITY_PATTERNS — trimmed from 45 by removing fs.appendFile, dgram, encodeURIComponent+http, </system> (redundant with <system>)
- [Phase 131 Plan 01]: scanSkillFiles returns structured { verdict, findings, summary } — clean contract for install gatekeeper, validate, and list consumers
- [Phase 131 Plan 01]: formatScanResults(scanResult, verbose) is pure — callers control when/how to print, no side effects
- [Phase 131 Plan 02]: Dangerous verdict is hard block: no force/override option in cmdSkillsInstall — files never reach dest dir on dangerous findings
- [Phase 131 Plan 02]: --confirm pattern mirrors agent:sync --accept/--reject; without --confirm, outputs confirmation data for calling agent to handle Y/N
- [Phase 131 Plan 02]: logAuditEntry is synchronous — simplifies error handling, audit writes are non-critical and fast
- [Phase 131 Plan 03]: skills:install uses await in router — cmdSkillsInstall is async (GitHub API fetch), main() is already async so await is safe
- [Phase 131 Plan 03]: COMMAND_TREE added as new export from commandDiscovery.js — not previously present, created full tree covering all namespaces (additive, backward-compatible)
- [Phase 132 Plan 01]: deviation-recovery added as 5th type in LESSON_SCHEMA.type_values — reuses existing validateLesson() pipeline without schema changes
- [Phase 132 Plan 01]: lessons:deviation-capture uses Rule-1-only parseInt filter — silently skips Rules 2, 3, 4 per DEVCAP-01
- [Phase 132 Plan 01]: cmdDeviationCapture wrapped in try/catch — all errors swallowed and debugLogged, never blocks execution per DEVCAP-04
- [Phase 132 Plan 02]: Rule-3 explicitly excluded in workflow text AND command filters internally — dual-layer prevents accidental invocation for environmental failures
- [Phase 133 Plan 01]: research:score + research:gaps use composite negative-signal scoring (5 signals, >= 3 = LOW); router wiring added as Rule-3 blocking fix — commands need explicit case blocks to be callable
- [Phase 133 Plan 01]: cache-first pattern: cmdResearchScore writes research-score.json, cmdResearchGaps reads it — no independent recomputation keeps the two commands decoupled
- [Phase 133 Plan 01]: parseResearchFile scans Primary+Secondary sources only for official docs detection (docs.* domain or "official" keyword) — Tertiary sources excluded as secondary references
- [Phase 133 Plan 02]: quality profile section placed after RESEARCH COMPLETE banner with non-blocking re-research prompt (N default) — shows profile to completers without forcing on skippers; HIGH/MEDIUM gaps only per CONTEXT.md
- [Phase 133 Plan 02]: advisory gate pattern: surface quality info after completion banner, offer remediation with N default — never block primary workflow

### Pending Work

None — v13.0 milestone complete and archived.

### Blockers/Concerns

None.

## Session Continuity

**Last session:** 2026-03-15
**This session:** 2026-03-16 — Started v14.0 LLM Workload Reduction milestone
**Next steps:**
1. Define requirements
2. Create roadmap
3. Begin execution with `/bgsd-discuss-phase` or `/bgsd-plan-phase`
