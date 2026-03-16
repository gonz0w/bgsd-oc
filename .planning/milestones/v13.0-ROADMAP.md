# Roadmap

**Last updated:** 2026-03-15

## Milestones

- ✅ **v12.1 Tool Integration & Agent Enhancement** — Phases 124–128 (shipped 2026-03-15)
- 🚧 **v13.0 Closed-Loop Agent Evolution** — Phases 129–133 (in progress)

## Active Phases

### 🚧 v13.0 Closed-Loop Agent Evolution (In Progress)

**Milestone Goal:** Enable agents and skills to improve continuously from project experience — local agent overrides, lesson-driven improvement suggestions, agentskills.io discovery, and enhanced research workflows.

## Phases

- [x] **Phase 129: Foundation & Agent Overrides** - Local agent override lifecycle with YAML validation and content sanitization (completed 2026-03-15)
- [x] **Phase 130: Lesson Schema & Analysis Pipeline** - Structured lesson format, analysis engine, and workflow improvement hooks (completed 2026-03-15)
- [x] **Phase 131: Skill Discovery & Security** - Security-first skill install/manage lifecycle with 41-pattern scanner and agentskills.io discovery (completed 2026-03-15)
- [x] **Phase 132: Deviation Recovery Auto-Capture** - Rule-1-only auto-capture hook wired into execute-phase with typo fix (completed 2026-03-15)
- [x] **Phase 133: Enhanced Research Workflow** - Structured research quality profile and gap surfacing (completed 2026-03-15)

## Phase Details

### Phase 129: Foundation & Agent Overrides
**Goal**: Users can manage project-local agent overrides — creating, viewing diffs, syncing with globals — with YAML validation and content sanitization preventing silent failure
**Depends on**: Nothing (first phase)
**Requirements**: LOCAL-01, LOCAL-02, LOCAL-03, LOCAL-04, LOCAL-05, LOCAL-06, LOCAL-07
**Success Criteria** (what must be TRUE):
  1. User can run `agent:list-local` and see both global and project-local agents with scope annotations (global / local-override)
  2. User can run `agent:override <name>` to create a project-local copy in `.opencode/agents/` — missing `name:` field hard-errors before writing
  3. User can run `agent:diff <name>` to view a line-level diff between the local override and its global counterpart
  4. User can run `agent:sync <name>` to see incoming upstream changes and accept or reject them
  5. bgsd-context `local_agent_overrides` field lists which agents have project-local versions, and any generated agent content is sanitized against system-prompt mangling
**Plans**: 3/3 plans complete

### Phase 130: Lesson Schema & Analysis Pipeline
**Goal**: Users can capture, list, analyze, and get improvement suggestions from structured lessons — with migration of existing free-form lessons and workflow hooks that surface suggestions after verify-work and milestone completion
**Depends on**: Phase 129
**Requirements**: LESSON-01, LESSON-02, LESSON-03, LESSON-04, LESSON-05, LESSON-06, LESSON-07, LESSON-08, LESSON-09
**Success Criteria** (what must be TRUE):
  1. User can run `lessons:capture` with required fields (Date, Title, Severity, Type, Root Cause, Prevention Rule, Affected Agents) and the entry is stored correctly
  2. Existing free-form `lessons.md` entry is grandfathered as `Type: environment` and produces 0 improvement suggestions
  3. User can run `lessons:list --type agent-behavior --severity HIGH` and get filtered results with pagination via `--limit` and `--since`
  4. User can run `lessons:analyze` and see recurrent patterns grouped by affected agent (only groups with ≥2 supporting lessons are shown)
  5. verify-work and complete-milestone workflows surface `lessons:suggest` advisory (non-blocking, informational) after phase/milestone completes; `lessons:compact` deduplicates when store exceeds 100 entries
**Plans**: 2/2 plans complete

### Phase 131: Skill Discovery & Security
**Goal**: Users can browse, install, validate, and remove project-local skills with a mandatory security scan and human confirmation gate before any file is written — plus bgsd-context exposing installed skills
**Depends on**: Nothing (independent of Phase 130)
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07, SKILL-08, SKILL-09
**Success Criteria** (what must be TRUE):
  1. User can run `skills:list` and see all skills installed in `.agents/skills/` with name and source
  2. User can run `skills:install <github-url>` — the system runs a 41-pattern security scan; dangerous findings block install; policy/warn findings require explicit human confirmation; full content diff shown before any file is written
  3. All install attempts (including blocked/rejected) appear in `.agents/skill-audit.json` with timestamp, source, scan verdict, and outcome
  4. User can run `skills:validate <name>` to re-scan an installed skill; user can run `skills:remove <name>` to delete it
  5. `new-milestone.md` Step 8.5 prompts optional skill discovery; bgsd-context `installed_skills` field lists installed skill names
**Plans**: 3/3 plans complete

| Plan | Wave | Objective | Tasks |
|------|------|-----------|-------|
| 0131-01 | 1 | Security scanner (41 patterns) + skills:list + skills:validate | 2 |
| 0131-02 | 2 | skills:install (GitHub fetch + scan + confirm) + skills:remove + audit | 2 |
| 0131-03 | 3 | Router/help wiring + enricher installed_skills + new-milestone Step 8.5 | 2 |

### Phase 132: Deviation Recovery Auto-Capture
**Goal**: Winning recovery patterns from Rule-1 (code bug) failures are automatically captured as structured lesson entries in execute-phase — capped at 3 per milestone, non-blocking, never triggered by environmental failures
**Depends on**: Phase 130
**Requirements**: DEVCAP-01, DEVCAP-02, DEVCAP-03, DEVCAP-04
**Success Criteria** (what must be TRUE):
  1. `autoRecovery.js` typo `autonomousRecoverles` is fixed to `autonomousRecoveries` and deviation telemetry increments correctly
  2. After a Rule-1 deviation recovery succeeds in execute-phase, a structured lesson entry is auto-captured non-blocking (`2>/dev/null || true`) — Rule-3 environmental failures never trigger capture
  3. Auto-capture stops silently after 3 entries per milestone; captured entries include deviation rule type, failure count before success, behavioral change that succeeded, and affected agent
**Plans**: 2/2 plans complete

### Phase 133: Enhanced Research Workflow
**Goal**: `research:score` returns a structured quality profile instead of a single grade, new-milestone.md surfaces it with LOW-confidence flags, `research:gaps` extracts gap lists, and multi-source conflicts are explicitly surfaced
**Depends on**: Nothing (independent of Phases 129–132)
**Requirements**: RESEARCH-01, RESEARCH-02, RESEARCH-03, RESEARCH-04
**Success Criteria** (what must be TRUE):
  1. `research:score <file>` returns a structured JSON profile: `{ source_count, high_confidence_pct, oldest_source_days, has_official_docs, flagged_gaps[] }` — not a single A-F grade
  2. `new-milestone.md` research completion step displays the quality profile and flags any file with LOW confidence for optional re-research (non-blocking)
  3. `research:gaps <file>` returns the `flagged_gaps[]` array as a formatted list
  4. `research:score` detects and surfaces multi-source conflicts as `conflicts: [{claim, source_a, source_b}]` when two or more sources disagree on a fact
**Plans**: 2/2 plans complete

| Plan | Wave | Objective | Tasks |
|------|------|-----------|-------|
| 0133-01 | 1 | Core commands — cmdResearchScore + cmdResearchGaps + tests | 2 |
| 0133-02 | 2 | Router/help wiring + new-milestone.md quality profile integration | 2 |

## Progress

**Execution Order:**
Phases execute in order: 129 → 130 → 131 (parallel with 130) → 132 (after 130) → 133 (any order)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 129. Foundation & Agent Overrides | 3/3 | Complete    | 2026-03-15 | - |
| 130. Lesson Schema & Analysis Pipeline | 2/2 | Complete    | 2026-03-15 | - |
| 131. Skill Discovery & Security | 2/3 | Complete    | 2026-03-15 | - |
| 132. Deviation Recovery Auto-Capture | 2/2 | Complete    | 2026-03-15 | - |
| 133. Enhanced Research Workflow | v13.0 | Complete    | 2026-03-15 | - |

---

## Completed Milestones

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
