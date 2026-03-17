# Roadmap

**Last updated:** 2026-03-17

## Milestones

- ✅ **v12.1 Tool Integration & Agent Enhancement** — Phases 124–128 (shipped 2026-03-15)
- ✅ **v13.0 Closed-Loop Agent Evolution** — Phases 129–133 (shipped 2026-03-15)
- 🚧 **v14.0 LLM Workload Reduction** — Phases 134–137 (in progress)

## Active Phases

### 🚧 v14.0 LLM Workload Reduction (In Progress)

**Milestone Goal:** Reduce context consumption and token waste by compressing workflows, pre-computing document scaffolds, and shifting administrative work from LLM reasoning to deterministic CLI operations.

## Phases

- [x] **Phase 134: Measurement Infrastructure & Baseline** - Token measurement tooling, structural contract tests, and compression regression detection (completed 2026-03-16)
- [x] **Phase 135: Workflow Compression & Section Markers** - Top 10 workflows prose-tightened 40%+, section markers added, shared blocks extracted to skill references (completed 2026-03-17)
- [x] **Phase 136: Scaffold Infrastructure** - Pre-computed PLAN.md and VERIFICATION.md scaffolds with data/judgment separation following summary:generate pattern (completed 2026-03-17)
- [x] **Phase 137: Section-Level Loading & Conditional Elision** - Enricher loads workflow sections per-step instead of full file; conditional steps elided when decisions indicate they don't apply (completed 2026-03-17)

## Phase Details

### Phase 134: Measurement Infrastructure & Baseline
**Goal**: Users can measure, compare, and structurally validate workflows — establishing the safety net required before any compression work begins
**Depends on**: Nothing (first phase)
**Requirements**: MEAS-01, MEAS-02, MEAS-03
**Success Criteria** (what must be TRUE):
  1. User can run `workflow:baseline` and receive a JSON snapshot containing per-workflow token counts for all 44 workflows
  2. User can run `workflow:compare <snapshot-a> <snapshot-b>` and see per-workflow token deltas with a total reduction percentage
  3. User can run `workflow:verify-structure` and confirm that all workflows preserve their Task() calls, CLI commands, section markers, and question blocks — regressions produce explicit failures
**Plans**: 2/2 plans complete

### Phase 135: Workflow Compression & Section Markers
**Goal**: Top 10 highest-traffic workflows are prose-tightened with section markers for selective loading, and shared blocks repeated across 3+ workflows are extracted to skill references — all verified against the Phase 134 baseline
**Depends on**: Phase 134
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. Top 10 workflows (discuss-phase, execute-phase, new-milestone, execute-plan, transition, new-project, audit-milestone, quick, resume-project, map-codebase) show 40%+ average token reduction measured by `workflow:compare` against the Phase 134 baseline
  2. All 10 compressed workflows have `<!-- section: step_name -->` markers at each major process step, verified by `workflow:verify-structure`
  3. Shared blocks (deviation rules, commit protocol, checkpoint format) that appeared in 3+ workflows are extracted to skill references — workflows use `<skill:X />` instead of inline content
  4. Zero structural regressions — `workflow:verify-structure` passes on all compressed workflows (Task() count, CLI command count, branch markers preserved)
**Plans**: 5/5 plans complete

### Phase 136: Scaffold Infrastructure
**Goal**: CLI generates pre-filled PLAN.md and VERIFICATION.md scaffolds from deterministic data sources, with clear data/judgment section separation — LLM fills only judgment sections instead of writing from scratch
**Depends on**: Nothing (can parallel with Phases 134–135 — touches different files)
**Requirements**: SCAF-01, SCAF-02, SCAF-03
**Success Criteria** (what must be TRUE):
  1. User can run `plan:generate --phase <N>` and receive a PLAN.md scaffold pre-filled with frontmatter, objective, task structure, file paths, and requirement links from the roadmap phase definition
  2. User can run `verify:generate --phase <N>` and receive a VERIFICATION.md scaffold pre-filled with success criteria from ROADMAP.md, test result data, and requirement completion status
  3. Both scaffold types clearly mark each section as `<!-- data -->` (CLI pre-filled) or `<!-- judgment -->` (LLM fills), following the `summary:generate` JUDGMENT_SECTIONS pattern
  4. Scaffold generators are idempotent — re-running on an existing file preserves LLM-written judgment sections while refreshing data sections
**Plans**: 3/3 plans complete

### Phase 137: Section-Level Loading & Conditional Elision
**Goal**: The enricher loads only the workflow section(s) relevant to the current step instead of the full workflow, and conditional features are elided when bgsd-context decisions indicate they don't apply — delivering per-invocation context savings
**Depends on**: Phase 135 (section markers), Phase 136 (scaffolds for elision context)
**Requirements**: COMP-04, SCAF-04
**Success Criteria** (what must be TRUE):
  1. Workflow loading in command enricher supports section-level extraction — agents receive only the section(s) relevant to the current step, not the full workflow file
  2. Workflow steps that reference conditional features (TDD, auto-test, review, deviation-capture) are elided when bgsd-context decisions indicate those features don't apply to the current task
  3. End-to-end measurement shows cumulative token savings from compression + scaffolds + section loading, with no behavioral regressions in critical workflows (execute-plan, execute-phase, verify-work)
**Plans**: 2/2 plans complete

## Progress

**Execution Order:**
Phases 134 → 135 (after 134) → 136 (parallel with 134–135) → 137 (after 135 + 136)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 134. Measurement Infrastructure & Baseline | 2/2 | Complete    | 2026-03-16 | - |
| 135. Workflow Compression & Section Markers | 5/5 | Complete    | 2026-03-17 | - |
| 136. Scaffold Infrastructure | v14.0 | 3/3 | Complete | 2026-03-17 |
| 137. Section-Level Loading & Conditional Elision | 2/2 | Complete   | 2026-03-17 | - |

---

## Completed Milestones

<details>
<summary>v13.0 Closed-Loop Agent Evolution (shipped 2026-03-15) — 5 phases, 12 plans</summary>

**Goal:** Enable agents and skills to improve continuously from project experience — local agent overrides, lesson-driven improvement suggestions, agentskills.io discovery, and enhanced research workflows.

**Phases:**
- [x] Phase 129: Foundation & Agent Overrides — Local agent override lifecycle with YAML validation and content sanitization
- [x] Phase 130: Lesson Schema & Analysis Pipeline — Structured lesson format, analysis engine, and workflow improvement hooks
- [x] Phase 131: Skill Discovery & Security — Security-first skill install/manage lifecycle with 41-pattern scanner
- [x] Phase 132: Deviation Recovery Auto-Capture — Rule-1-only auto-capture hook wired into execute-phase
- [x] Phase 133: Enhanced Research Workflow — Structured research quality profile and gap surfacing

**Archives:** `.planning/milestones/v13.0-ROADMAP.md`, `v13.0-REQUIREMENTS.md`

</details>

<details>
<summary>v12.1 Tool Integration & Agent Enhancement (shipped 2026-03-15) — 5 phases, 13 plans</summary>

**Goal:** Integrate 6 modern CLI tools (ripgrep, fd, jq, yq, bat, gh) into core workflows and improve agent routing & collaboration.

**Phases:**
- [✓] Phase 124: Tool Detection & Infrastructure — Unified detect.js with caching, cross-platform PATH, detect:tools API
- [✓] Phase 125: Core Tools Integration — ripgrep/fd/jq with graceful Node.js fallbacks
- [✓] Phase 126: Extended Tools — yq/bat/gh with config toggles, version blocklist, gh-preflight
- [✓] Phase 127: Agent Routing Enhancement — 3 tool routing decision functions, tool_availability in enricher
- [✓] Phase 128: Agent Collaboration — resolveAgentCapabilityLevel, resolvePhaseDependencies, 9 handoff contracts, capability filtering

**Archives:** `.planning/milestones/v12.1-ROADMAP.md`, `v12.1-REQUIREMENTS.md`, `v12.1-DOCS.md`

</details>

<details>
<summary>v12.0 SQLite-First Data Layer (shipped 2026-03-15) — 6 phases, 16 plans</summary>

**Archives:** `.planning/milestones/v12.0-ROADMAP.md`, `v12.0-REQUIREMENTS.md`, `v12.0-DOCS.md`

</details>

<details>
<summary>v11.3 LLM Offloading (shipped 2026-03-13) — 4 phases, 9 plans</summary>

**Archives:** `.planning/milestones/v11.3-ROADMAP.md`, `v11.3-REQUIREMENTS.md`, `v11.3-DOCS.md`

</details>

<details>
<summary>Earlier milestones (v1.0–v11.1)</summary>

See `.planning/MILESTONES.md` and `.planning/milestones/` for full archive.

</details>
