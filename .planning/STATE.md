# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-16)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v14.0 LLM Workload Reduction — workflow compression, scaffold generation, section-level loading

## Current Position

**Milestone:** v14.0 LLM Workload Reduction
**Phase:** 136 — Scaffold Infrastructure
**Current Plan:** Complete (3/3)
**Status:** Complete — ready for Phase 137
**Last Activity:** 2026-03-17

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 254 (through v13.0 Phase 133 Plan 02)
- Average duration: ~14 min/plan (improving with better tooling)
- Total execution time: ~41.5 hours

**Recent Trend:**
- v13.0 Phase 130 Plan 01: 10 min, 2 tasks, 9 files (lessons schema + capture + migrate + list + memory filters)
- v13.0 Phase 130 Plan 02: 8 min, 2 tasks, 6 files (lessons:analyze + suggest + compact + workflow hooks)
- v13.0 Phase 131 Plan 01: 12 min, 2 tasks, 1 file (security scanner + skills:list + skills:validate)
- v13.0 Phase 131 Plan 02: 12 min, 2 tasks, 1 file (skills:install + skills:remove + audit logging)
- v13.0 Phase 131 Plan 03: 6 min, 2 tasks, 6 files (router wiring + enricher installed_skills + new-milestone Step 8.5)
- v13.0 Phase 132 Plan 01: 8 min, 2 tasks, 9 files (autonomousRecoveries typo fix + lessons:deviation-capture)
- v13.0 Phase 132 Plan 02: 5 min, 2 tasks, 4 files (deviation_auto_capture hook in execute-plan.md)
- v13.0 Phase 133 Plan 01: 8 min, 2 tasks, 4 files (research:score + research:gaps command handlers)
- v13.0 Phase 133 Plan 02: 8 min, 2 tasks, 5 files (help/discovery wiring + new-milestone.md quality profile)
- v14.0 Phase 134 Plan 01: 7 min, 2 tasks, 7 files (workflow:baseline + workflow:compare + structural fingerprint + 21 tests)
- v14.0 Phase 134 Plan 02: 12 min, 2 tasks, 4 files (workflow:verify-structure + regression detection + 14 tests)
- v14.0 Phase 135 Plan 01: 5 min, 2 tasks, 5 files (pre-compression baseline + 3 shared skill extractions)
  - v14.0 Phase 135 Plan 02: 12 min, 2 tasks, 2 files (discuss-phase 42% + execute-phase 42% compression, section markers, skill refs)
  - v14.0 Phase 135 Plan 03: 8 min, 2 tasks, 2 files (new-milestone 45% + execute-plan 40% compression, section markers, skill refs)
  - v14.0 Phase 135 Plan 04: 14 min, 3 tasks, 3 files (transition 42% + new-project 41% + resume-project 41% compression, section markers)
  - v14.0 Phase 135 Plan 05: 32 min, 3 tasks, 6 files (audit-milestone -41% + map-codebase -43% + quick -40% + transition further to -43%; 41.1% avg)
- v14.0 Phase 136 Plan 01: 8 min, 2 tasks, 2 files (scaffold merge lib: DATA_MARKER, JUDGMENT_MARKER, parseMarkedSections, mergeScaffold; 28 unit tests)
- v14.0 Phase 136 Plan 02: 15 min, 2 tasks, 3 files (plan:generate command — roadmap pre-fill, data/judgment markers, idempotent merge)
- v14.0 Phase 136 Plan 03: 5 min, 2 tasks, 2 files (verify:generate command — success criteria pre-fill, must-haves extraction; 31 integration tests; 1681 tests pass)
- Trend: Stable, improving velocity with infrastructure improvements

*Updated after each plan completion*

## Accumulated Context

### v14.0 Roadmap Summary

- **Phases:** 134–137 (4 phases)
- **Requirements:** 11 total (MEAS-01 through MEAS-03, COMP-01 through COMP-04, SCAF-01 through SCAF-04)
- **Coverage:** 100% — every requirement maps to exactly one phase
- **Dependencies:** Phase 134 first (measurement before compression); Phase 135 after 134; Phase 136 parallel with 134–135 (different files); Phase 137 after 135 + 136

### Phase Descriptions

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 134 | Measurement Infrastructure & Baseline | Token measurement, structural tests, regression detection | MEAS-01, MEAS-02, MEAS-03 |
| 135 | Workflow Compression & Section Markers | Top 10 workflows compressed 40%+, section markers, shared block extraction | COMP-01, COMP-02, COMP-03 |
| 136 | Scaffold Infrastructure | PLAN.md + VERIFICATION.md scaffolds with data/judgment separation | SCAF-01, SCAF-02, SCAF-03 |
| 137 | Section-Level Loading & Conditional Elision | Per-step workflow loading + conditional feature elision | COMP-04, SCAF-04 |

### Key Decisions

- [v14.0 roadmap]: Phase 134 first — baseline measurement required before any compression work (v1.1 lesson: compression without verification catches regressions too late)
- [v14.0 roadmap]: COMP-01 + COMP-02 together in Phase 135 — section markers added WITH compression, not separately
- [v14.0 roadmap]: Phase 136 parallel with 134–135 — scaffold work touches misc.js/verify.js, compression touches workflows/*.md, no overlap
- [v14.0 roadmap]: Phase 137 last — section-level loading depends on markers from Phase 135; conditional elision depends on scaffolds from Phase 136
- [134-01]: Reuse measureAllWorkflows() from features.js (exported it) rather than duplicating measurement code
- [134-01]: Structural fingerprint stores arrays of matched strings (not just counts) for richer future diffing
- [134-01]: Workflow baselines named workflow-baseline-{timestamp}.json to distinguish from old baseline-{timestamp}.json
- [134-02]: CLI-based unit tests (execSync + BGSD_PLUGIN_DIR) for verify-structure — direct stdout capture interferes with node:test runner
- [134-02]: Fixed __dirname path in workflow.js: path.resolve(dirname, '..') not '../..' (bundled binary has bin/ as dirname)
- [135-01]: Baseline JSON gitignored (.planning/.gitignore: baselines/*.json) — snapshot exists on disk, not in git (intentional per project convention)
- [135-01]: Parameterized CI gate skill with {{scope}}/{{base_branch}} to serve both execute-phase and quick workflows
- [135-01]: bgsd-context-init skill has no placeholders — 2-paragraph preamble is identical across all 10 workflows
- [135-03]: Research pipeline banner not duplicated in workflow — skill already contains the RESEARCHING banner block
- [135-03]: TDD auto-test kept inline (compressed) in execute-plan rather than full skill reference — execute:tdd command stays visible
- [135-04]: Decision tables used in transition.md and resume-project.md routing logic — more compact/scannable than if/else prose
- [135-04]: Research pipeline (4 researchers + synthesizer) in new-project.md replaced with single skill reference — all 5 Task() calls preserved in skill
- [135-05]: Compressed transition.md in Plan 05 (was only 32% token reduction after Plan 04 despite 42% line reduction) — offer_next routes expressed as compact bullet routing
- [135-05]: map-codebase 4 Task() calls kept as distinct code blocks rather than 1 template — structural fingerprint requires individual calls
- [135-05]: Phase 135 final: 41.1% average token reduction across 10 workflows (threshold: 40%); all 1609 tests pass
- [136-01]: scaffold.js uses Map (ordered) for parseMarkedSections() to preserve section order for document rebuilding
- [136-02]: REQUIREMENTS.md format is **ID:** (colon inside bold markers) not **ID**: — regex must match `\*\*ID:\*\*` not `\*\*ID\*\*:`
- [136-02]: Frontmatter values must be raw strings (not `"0050"`) to prevent idempotency failure where extractFrontmatter strips embedded quotes
- [136-02]: marker count must use `/g` regex flag — `String.match(constant)` finds only first occurrence

### Blockers/Concerns

None.

## Session Continuity

**Last session:** 2026-03-17T04:04:52.144Z
**This session:** 2026-03-17 — Executed Phase 136 (scaffold infrastructure). 3/3 plans complete. SCAF-01, SCAF-02, SCAF-03 done. 1681 tests pass.
**Next steps:**
1. Phase 137 (section-level loading) — depends on Phase 135 markers AND Phase 136 scaffolds, both now complete
