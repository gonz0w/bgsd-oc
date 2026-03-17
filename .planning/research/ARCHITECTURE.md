# Architecture Research — Workflow Compression & Scaffold Generation Integration

**Domain:** Workflow compression round 2 and pre-computed document scaffolds for v14.0 LLM Workload Reduction  
**Researched:** 2026-03-16  
**Confidence:** HIGH  
**Research mode:** Ecosystem — How new compression and scaffold features integrate with existing bGSD architecture

---

<!-- section: compact -->
<architecture_compact>

**Architecture:** Layered token reduction — workflow files get section markers for selective loading, CLI generates pre-filled document scaffolds (PLAN.md, VERIFICATION.md) from deterministic data, enricher injects scaffold paths so agents write less from scratch.

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| WorkflowCompressor (NEW) | Applies section markers to workflow .md files, measures token savings per workflow |
| ScaffoldGenerator (MODIFIED misc.js) | Extends existing `util:scaffold` to generate PLAN.md and VERIFICATION.md from roadmap/phase/plan data |
| ExtractSections (EXISTING features.js) | Already parses `<!-- section: name -->` markers — unchanged, consumed by agents and new section-loader |
| SectionLoader (NEW lib module) | Loads workflow sections on demand based on execution step, returns subset of workflow text |
| CommandEnricher (MODIFIED) | Adds `scaffold_available` and `scaffold_path` fields when scaffolds exist |
| MeasureWorkflows (EXISTING features.js) | Token measurement baseline/compare — reused for compression validation |

**Key patterns:** Section-marked workflows with selective loading, scaffold-then-fill (CLI generates data sections, LLM fills judgment), enricher pre-computation of scaffold availability

**Anti-patterns:** Compressing workflows so aggressively that agents lose critical context, generating scaffolds with stale data (no invalidation), breaking existing section marker parsing

**Scaling priority:** Top 10 workflows by token count — compress highest-impact workflows first (execute-phase 497L, discuss-phase 538L, new-milestone 505L, transition 519L)

</architecture_compact>
<!-- /section -->

---

<!-- section: standard_architecture -->
## System Overview

### Current Architecture (Before v14.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent System Prompt                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Workflow.md  │  │   Agent.md   │  │   Skill.md   │      │
│  │  (full file)  │  │  (full file) │  │  (on-demand) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
├─────────┴─────────────────┴─────────────────┴───────────────┤
│                    <bgsd-context> JSON                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Enricher │→ │ ProjectState│→ │  Decisions │              │
│  └──────────┘  └────────────┘  └────────────┘              │
├─────────────────────────────────────────────────────────────┤
│                    CLI (bgsd-tools.cjs)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ init.js  │  │  misc.js │  │features.js│  │ verify.js│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ SQLite   │  │ Markdown │  │   Git    │                  │
│  │ (cache)  │  │ (source) │  │ (history)│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**Token flow problem:** Workflows are loaded as full files into agent context. The top 10 workflows consume 4,000-8,000+ tokens each. Agents read entire workflow even when they only need the current step. Documents like PLAN.md and VERIFICATION.md are written from scratch by LLMs despite 60-80% of their content being deterministic data.

### Target Architecture (v14.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent System Prompt                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workflow.md   │  │   Agent.md   │  │   Skill.md   │      │
│  │ (COMPRESSED)  │  │  (unchanged) │  │  (unchanged) │      │
│  │ - 40% smaller │  │              │  │              │      │
│  │ - section-    │  │              │  │              │      │
│  │   marked      │  │              │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────┴───────┐                                          │
│  │SectionLoader │ ← Loads only needed sections per step     │
│  └──────────────┘                                          │
├─────────────────────────────────────────────────────────────┤
│                    <bgsd-context> JSON                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Enricher │→ │ ProjectState│→ │  Decisions │              │
│  │(+scaffold│  └────────────┘  └────────────┘              │
│  │  fields) │                                              │
│  └──────────┘                                              │
├─────────────────────────────────────────────────────────────┤
│                    CLI (bgsd-tools.cjs)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ init.js  │  │  misc.js │  │features.js│  │ verify.js│   │
│  │          │  │(+scaffold│  │(existing  │  │          │   │
│  │          │  │ generate)│  │ extract)  │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer (unchanged)                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location | Status |
|-----------|----------------|----------|--------|
| `extractSectionsFromFile()` | Parse `<!-- section: X -->` markers, extract named sections | `src/commands/features.js:1354` | EXISTS — reuse as-is |
| `cmdSummaryGenerate()` | Generate SUMMARY.md scaffold from plan/git data | `src/commands/misc.js:2067` | EXISTS — pattern to follow |
| `cmdScaffold()` | Generate context/uat/verification/phase-dir scaffolds | `src/commands/misc.js:1470` | EXISTS — extend for plan + verification |
| `measureAllWorkflows()` | Measure token counts across all workflow files | `src/commands/features.js:1489` | EXISTS — use for compression validation |
| `enrichCommand()` | Inject `<bgsd-context>` JSON into command execution | `src/plugin/command-enricher.js:29` | MODIFY — add scaffold fields |
| Workflow .md files | Agent instruction prompts loaded as system prompt | `workflows/*.md` (44 files) | MODIFY — compress top 10, add sections |
| SectionLoader (new) | Load specific workflow sections by step name | `src/lib/` (new module) | NEW |
| ScaffoldPlan (new function) | Generate PLAN.md skeleton from roadmap + phase data | `src/commands/misc.js` (extend) | NEW |
| ScaffoldVerification (new function) | Generate VERIFICATION.md from success criteria + test results | `src/commands/misc.js` (extend) | NEW |

<!-- /section -->

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: Scaffold-Then-Fill

**What:** CLI generates the deterministic 60-80% of a document (frontmatter, headers, data tables, file lists, commit logs), LLM fills only the judgment sections (accomplishments, decisions, analysis).

**When to use:** Any document where structured data is available before the LLM writes. Already proven by `summary:generate` (50%+ writing reduction).

**Trade-offs:**
- Pro: Massive token savings — LLM writes ~20-40% instead of 100%
- Pro: Consistent document structure — no formatting drift
- Pro: Data accuracy — git commits, file counts, timestamps are deterministic
- Con: Must handle stale scaffolds (phase changes between scaffold and fill)
- Con: LLM must understand TODO markers and not blindly accept them

**Existing precedent:**
```javascript
// src/commands/misc.js:2067 — cmdSummaryGenerate
// Generates full SUMMARY.md with frontmatter, performance data, task commits,
// file changes — LLM only fills "Accomplishments", "Key Decisions", "Patterns Established"
const JUDGMENT_SECTIONS = {
  'Accomplishments': 'LLM fills: what was achieved and why it matters',
  'Key Decisions': 'LLM fills: decisions made during execution with rationale',
  'Patterns Established': 'LLM fills: patterns created for future phases',
};
```

**New scaffolds follow this pattern:**

```javascript
// scaffold:plan — from roadmap phase data
// Data sections: frontmatter, objective, file inventory, task skeleton
// Judgment sections: task details, verify blocks, file paths

// scaffold:verification — from success criteria + plan summaries
// Data sections: frontmatter, phase goal, observable truth table skeleton, artifact list
// Judgment sections: evidence, status assessments, gap analysis
```

### Pattern 2: Section-Marked Workflows with Selective Loading

**What:** Add `<!-- section: step_name -->` markers to workflow .md files. Agents load only the sections needed for the current execution step rather than the full workflow.

**When to use:** Workflows > 200 lines where agents only need a subset per step. The existing `extractSectionsFromFile()` already handles this format.

**Trade-offs:**
- Pro: 40-60% token reduction per step when only loading relevant sections
- Pro: Zero new parsing code — reuses existing marker parser
- Pro: Full workflow still readable by humans as a single file
- Con: Agents must know which sections to request
- Con: Section boundaries must be carefully chosen to remain self-contained

**How it works with existing infrastructure:**

```bash
# Agent loads only the section for current step
node bin/bgsd-tools.cjs util:extract-sections workflows/execute-plan.md parse_segments context_budget_check

# Returns combined content of just those sections
# Instead of loading all 376 lines, loads ~60 lines
```

**Implementation:** Workflows already have `<step name="X">` tags. Adding `<!-- section: X -->` markers around each step is backward-compatible — agents loading the full file see no change. Section-aware agents can use extract-sections to load subsets.

### Pattern 3: Compression Without Information Loss

**What:** Reduce workflow token count by eliminating redundancy, tightening prose, removing examples that overlap with skill content, and consolidating repeated patterns.

**When to use:** All top 10 workflows by token count. v1.1 achieved 54.6% compression on the first 8 workflows; round 2 targets the next 10 that were skipped.

**Trade-offs:**
- Pro: Every workflow load consumes fewer tokens
- Pro: Agents still have all instructions needed
- Con: Must verify agents behave identically after compression
- Con: Too-aggressive compression causes agent quality degradation

**Compression techniques (proven in v1.1):**
1. **Redundancy removal:** Instructions repeated across steps consolidated to single declaration
2. **Prose tightening:** "You should make sure to check that X exists before doing Y" → "Check X exists before Y"
3. **Skill extraction:** Move domain knowledge to skills (loaded on-demand), keep only workflow-specific steps
4. **Table compression:** Convert verbose lists to tables
5. **Example deduplication:** Remove examples that exist in referenced templates

**Measurement protocol:**
```bash
# Before compression — baseline
node bin/bgsd-tools.cjs util:measure baseline

# After compression — compare
node bin/bgsd-tools.cjs util:measure compare
```

<!-- /section -->

<!-- section: data_flow -->
## Data Flow

### Scaffold Generation Flow

```
[Roadmap Phase Data]              [Git History]              [Plan Data]
  ↓ (roadmap:get-phase)             ↓ (structuredLog)         ↓ (parsePlan)
  phase_goal, requirements,         commits scoped to         tasks, objective,
  success_criteria                  phase/plan                frontmatter
        ↓                              ↓                        ↓
        └──────────────────┬───────────┘                        │
                           ↓                                    │
                    ┌──────────────┐                             │
                    │  scaffold:*  │ ←──────────────────────────┘
                    │  (misc.js)   │
                    └──────┬───────┘
                           ↓
              ┌────────────────────────┐
              │  {padded}-PLAN.md or   │
              │  {padded}-VERIFICATION │
              │  with TODO markers     │
              └────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │  Enricher adds:        │
              │  scaffold_plan_path    │
              │  scaffold_verif_path   │
              └────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │  Agent fills TODO      │
              │  sections (20-40%      │
              │  of document)          │
              └────────────────────────┘
```

### Workflow Section Loading Flow

```
[Agent receives workflow .md in system prompt]
        ↓
[Agent identifies current step from plan progress]
        ↓
[Agent calls extract-sections for needed steps]
        ↓
[extract-sections returns section content only]
        ↓
[Agent executes with ~40% fewer context tokens]
```

### Workflow Compression Flow

```
[Existing workflow file (N tokens)]
        ↓
[Compression analysis: identify redundancy, verbose prose, duplicate examples]
        ↓
[Apply compression techniques: tighten, deduplicate, extract to skills]
        ↓
[Add section markers for selective loading]
        ↓
[Compressed workflow file (~0.6N tokens)]
        ↓
[Validate: measure:baseline → measure:compare to confirm 40%+ reduction]
        ↓
[Test: run workflow end-to-end, verify agent behavior unchanged]
```

### Key Data Flows

1. **Scaffold data sources:** ROADMAP.md → phase goal/requirements/success criteria; PLAN.md → tasks/objective (for verification scaffold); Git → commit history/diff summary (for plan scaffold); Assertions → must-have truths (for verification scaffold)
2. **Enricher scaffold injection:** During `enrichCommand()`, check if scaffold files exist in phase dir → add `scaffold_plan: path` or `scaffold_verification: path` to `<bgsd-context>` JSON
3. **Section loading:** Agent parses step name from plan progress → calls `util:extract-sections workflow.md step1 step2` → receives only relevant content

<!-- /section -->

<!-- section: integration_map -->
## Integration Points — New vs Modified vs Unchanged

### NEW Components

| Component | Type | Location | Depends On | Consumed By |
|-----------|------|----------|------------|-------------|
| `cmdScaffoldPlan()` | CLI function | `src/commands/misc.js` | `findPhaseInternal`, `getRoadmapPhaseInternal`, `extractFrontmatter` | `plan-phase.md` workflow, planner agent |
| `cmdScaffoldVerification()` | CLI function | `src/commands/misc.js` | `findPhaseInternal`, `parsePlans`, plan summaries, `ASSERTIONS.md` parser | `verify-work.md` workflow, verifier agent |
| Section markers in workflows | Workflow text | `workflows/*.md` (10 files) | — | `extractSectionsFromFile()` (existing), agents |
| `util:scaffold plan` | CLI route | `src/router.js` (new case) | `cmdScaffoldPlan` | Workflow orchestration |
| `util:scaffold verification` | CLI route | `src/router.js` (new case) | `cmdScaffoldVerification` | Workflow orchestration |

### MODIFIED Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| `src/commands/misc.js` — `cmdScaffold()` | Add `plan` and `verification` cases to switch | Extends existing scaffold command with new document types |
| `src/router.js` | No changes needed — `scaffold` subcommand already routes to `cmdScaffold` | Existing routing handles new scaffold types automatically |
| `src/plugin/command-enricher.js` | Add `scaffold_plan_path`, `scaffold_verification_path` fields | Agents need to know when scaffolds are available |
| `workflows/execute-phase.md` (497L) | Compress prose, add section markers | Token reduction |
| `workflows/discuss-phase.md` (538L) | Compress prose, add section markers | Token reduction — largest workflow |
| `workflows/new-milestone.md` (505L) | Compress prose, add section markers | Token reduction |
| `workflows/transition.md` (519L) | Compress prose, add section markers | Token reduction |
| `workflows/execute-plan.md` (376L) | Add section markers, integrate scaffold references | Token reduction + scaffold awareness |
| `workflows/plan-phase.md` (187L) | Add scaffold generation step before planner spawn | Planner receives scaffold instead of blank file |
| `workflows/verify-work.md` (165L) | Add scaffold generation step before verifier spawn | Verifier receives scaffold instead of blank file |
| `workflows/progress.md` (349L) | Compress prose | Token reduction |
| `workflows/quick.md` (341L) | Compress prose, add section markers | Token reduction |
| `workflows/map-codebase.md` (303L) | Compress prose | Token reduction |
| `src/lib/constants.js` | Update `COMMAND_HELP` for new scaffold types | Help text for `util:scaffold plan` and `util:scaffold verification` |

### UNCHANGED Components

| Component | Why Unchanged |
|-----------|--------------|
| `src/commands/features.js` — `extractSectionsFromFile()` | Already handles section markers perfectly — no changes needed |
| `src/commands/features.js` — `measureAllWorkflows()` | Already measures token counts — used for compression validation |
| `src/lib/context.js` — `estimateTokens()` | Token estimation unchanged |
| `src/lib/context.js` — `AGENT_MANIFESTS` | Agent context scoping unchanged — scaffold fields are optional enrichment |
| `src/commands/misc.js` — `cmdSummaryGenerate()` | Existing scaffold pattern — serves as implementation reference |
| Templates (`templates/*.md`) | Templates define format; scaffolds populate instances |
| `build.cjs` | No new entry points — all code goes into existing modules |
| Plugin tools (`src/plugin/tools/`) | LLM tools unchanged — scaffolds are CLI operations |
| SQLite layer (`src/lib/db.js`, `planning-cache.js`) | No new tables needed — scaffolds are generated on demand |

<!-- /section -->

<!-- section: build_order -->
## Suggested Build Order

### Wave 1: Foundation (No Dependencies)

**Task 1: Workflow Compression — Top 10 Workflows**
- Files: `workflows/*.md` (10 largest files)
- Action: Apply proven compression techniques from v1.1
- Verify: `util:measure baseline` before, `util:measure compare` after — target 40%+ reduction
- Dependencies: None — pure text editing
- Risk: Low — compression is reversible

**Task 2: Add Section Markers to Compressed Workflows**
- Files: Same 10 workflow files from Task 1
- Action: Wrap `<step name="X">` blocks with `<!-- section: X -->` / `<!-- /section -->` markers
- Verify: `util:extract-sections workflow.md step_name` returns correct content
- Dependencies: Task 1 (compress first, then add markers)
- Risk: Low — markers are additive, no behavior change

### Wave 2: Scaffold Generation (Depends on Wave 1 only for final integration)

**Task 3: PLAN.md Scaffold Generator**
- Files: `src/commands/misc.js` (extend `cmdScaffold`), `src/lib/constants.js` (help text)
- Action: Add `plan` case to scaffold switch — generates PLAN.md skeleton from roadmap phase data
- Pattern: Follow `cmdSummaryGenerate()` implementation pattern exactly
- Data sources: `getRoadmapPhaseInternal()` for goal/requirements, `extractFrontmatter()` for existing plan format
- Verify: `node bin/bgsd-tools.cjs util:scaffold plan --phase 1` generates valid PLAN.md skeleton
- Dependencies: None (can start in parallel with Wave 1)

**Task 4: VERIFICATION.md Scaffold Generator**
- Files: `src/commands/misc.js` (extend `cmdScaffold`), `src/lib/constants.js` (help text)
- Action: Add `verification` case to scaffold switch — generates VERIFICATION.md from success criteria
- Data sources: ROADMAP.md success criteria, plan summaries, ASSERTIONS.md must-haves
- Verify: `node bin/bgsd-tools.cjs util:scaffold verification --phase 1` generates valid report skeleton
- Dependencies: None (can start in parallel with Task 3)

### Wave 3: Enricher Integration (Depends on Wave 2)

**Task 5: Enricher Scaffold Awareness**
- Files: `src/plugin/command-enricher.js`
- Action: Check for existing scaffold files in phase dir, add `scaffold_plan_path` and `scaffold_verification_path` to enrichment object
- Verify: `<bgsd-context>` JSON includes scaffold paths when files exist
- Dependencies: Tasks 3 and 4 (scaffold files must exist to test detection)

### Wave 4: Workflow Integration (Depends on Waves 2-3)

**Task 6: Update plan-phase.md to Generate Scaffold**
- Files: `workflows/plan-phase.md`
- Action: Add step before planner spawn that calls `util:scaffold plan` to pre-generate PLAN.md skeleton
- Verify: `/bgsd-plan-phase` generates scaffold, planner fills judgment sections only
- Dependencies: Task 3 (scaffold generator exists), Task 5 (enricher advertises scaffold)

**Task 7: Update verify-work/execute-phase to Use Verification Scaffold**
- Files: `workflows/verify-work.md`, `workflows/execute-phase.md`
- Action: Add step that calls `util:scaffold verification` before verifier spawn
- Verify: `/bgsd-verify-work` generates scaffold, verifier fills status/evidence columns
- Dependencies: Task 4 (verification scaffold generator exists), Task 5 (enricher advertises scaffold)

### Dependency Graph

```
Wave 1:  Task 1 (compress) → Task 2 (section markers)
                                                        ↘
Wave 2:  Task 3 (plan scaffold) ──────────────────────→ Wave 3: Task 5 (enricher)
         Task 4 (verification scaffold) ──────────────↗           ↓
                                                        Wave 4: Task 6 (plan workflow)
                                                                  Task 7 (verify workflow)
```

**Parallel opportunities:**
- Tasks 1-2 and Tasks 3-4 can run in parallel (different files, no overlap)
- Tasks 3 and 4 can run in parallel (different scaffold types)
- Tasks 6 and 7 can run in parallel (different workflows)

<!-- /section -->

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Over-Compression

**What people do:** Compress workflow prose so aggressively that agents lose critical context — removing examples, edge case handling, or decision trees.
**Why it's wrong:** Agent quality degrades silently. The 40% target is conservative deliberately — v1.1 achieved 54.6% on easier workflows, but the remaining 10 are harder because they contain more decision logic.
**Do this instead:** Compress redundancy and verbose prose. Preserve decision trees, edge cases, and examples that don't exist in skills/templates. Measure agent behavior with before/after test runs.

### Anti-Pattern 2: Stale Scaffolds

**What people do:** Generate a scaffold, then change the roadmap/plan data before the LLM fills it.
**Why it's wrong:** Scaffold contains outdated phase goals, wrong requirement IDs, or mismatched task counts. Agent writes wrong document.
**Do this instead:** Generate scaffolds just-in-time (in the workflow step immediately before the agent uses it). Never cache scaffolds across sessions. Include a `generated_at` timestamp in scaffold frontmatter so agents can detect staleness.

### Anti-Pattern 3: Breaking Section Marker Format

**What people do:** Use non-standard markers like `<!-- SECTION: X -->` or `<!-- Section X -->` or nest markers incorrectly.
**Why it's wrong:** `extractSectionsFromFile()` uses the regex `/<!--\s*section:\s*(.+?)\s*-->/i` — case-insensitive match on `section:` with colon. Non-standard formats silently fail. Nested markers close at the first `<!-- /section -->`.
**Do this instead:** Use exactly `<!-- section: step_name -->` and `<!-- /section -->`. Don't nest sections. Test with `util:extract-sections file.md section_name` to verify parsing.

### Anti-Pattern 4: Scaffold as Source of Truth

**What people do:** Treat the scaffold as the final document — agent just commits it without filling TODO markers.
**Why it's wrong:** TODO markers remain in committed files. Judgment sections are empty. Document looks complete but lacks analysis.
**Do this instead:** Scaffold includes explicit `TODO:` markers that agents must replace. Verification can grep for remaining TODOs as a quality gate: `grep -c 'TODO:' file.md` should be 0 after agent fills.

<!-- /section -->

<!-- section: sizing -->
## Sizing Estimates

### Token Impact Analysis

| Target | Current Tokens (est.) | After Compression | Savings |
|--------|----------------------|-------------------|---------|
| Top 10 workflows (compression) | ~45,000 total | ~27,000 total | ~18,000 tokens per agent load |
| PLAN.md scaffold (per plan) | 0 (LLM writes all) | ~800 scaffold + ~400 LLM | ~1,200 tokens per plan |
| VERIFICATION.md scaffold (per phase) | 0 (LLM writes all) | ~600 scaffold + ~300 LLM | ~800 tokens per verification |
| Section loading (per step) | ~3,000 (full workflow) | ~800 (2-3 sections) | ~2,200 tokens per step |

**Total milestone impact:** ~20,000+ tokens saved per plan execution cycle (workflow load + document generation).

### Effort Estimates

| Task | Complexity | Files | Estimated Duration |
|------|-----------|-------|-------------------|
| Workflow compression (10 files) | Medium — manual prose analysis | 10 workflows | 45-60 min |
| Section markers (10 files) | Low — additive markers | 10 workflows | 20-30 min |
| PLAN.md scaffold | Medium — follow summary:generate pattern | misc.js, constants.js | 30-45 min |
| VERIFICATION.md scaffold | Medium — parse success criteria | misc.js, constants.js | 30-45 min |
| Enricher scaffold fields | Low — add 2 fields | command-enricher.js | 15-20 min |
| Workflow integration | Low — add CLI calls to workflows | plan-phase.md, verify-work.md | 20-30 min |

<!-- /section -->

<!-- section: scaffold_specification -->
## Scaffold Specifications

### PLAN.md Scaffold — Data Sources and Structure

```markdown
---
phase: "{padded_phase}-{phase_slug}"
plan: "{padded_plan}"
objective: "{from roadmap phase goal}"
tags: []
requirements: [{requirement IDs from roadmap}]
must_haves:
  truths: [{from ASSERTIONS.md or roadmap success criteria}]
files_modified: []
---

# Phase {phase_number} Plan {plan_number}: {objective}

<objective>
{Phase goal from ROADMAP.md}
</objective>

## Context

**Phase Goal:** {from ROADMAP.md}
**Requirements:** {IDs and descriptions from REQUIREMENTS.md}
**Prior Research:** {reference to RESEARCH.md if exists}

TODO: Add any additional context from discuss-phase decisions.

## Tasks

TODO: Define tasks based on requirements and research.
Each task should follow this structure:

<task id="1">
<name>Task 1: TODO: task name</name>
<description>TODO: what this task accomplishes</description>
<files>TODO: list files to create or modify</files>
<verify>TODO: how to verify task completion</verify>
</task>
```

**Data source mapping:**
- `phase`, `plan`, `objective` → `getRoadmapPhaseInternal(cwd, phase)` → `.goal`, `.phase_number`
- `requirements` → Parse ROADMAP.md phase block for `Requirements:` line
- `must_haves.truths` → Parse `ASSERTIONS.md` for this phase's requirements (if exists)
- `Phase Goal`, `Requirements` section → Same roadmap data
- `Prior Research` → Check for `{padded_phase}-RESEARCH.md` existence

### VERIFICATION.md Scaffold — Data Sources and Structure

```markdown
---
phase: "{padded_phase}-{phase_name}"
verified: TODO: timestamp
status: TODO: passed | gaps_found | human_needed
score: TODO: N/M must-haves verified
---

# Phase {phase_number}: {phase_name} Verification Report

**Phase Goal:** {goal from ROADMAP.md}
**Verified:** TODO: timestamp
**Status:** TODO

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
{for each truth from must_haves/assertions:}
| {n} | {truth text} | TODO | TODO |

**Score:** TODO: N/{total_truths} truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
{for each file from plan summaries:}
| `{file_path}` | {description from task} | TODO | TODO |

### Key Link Verification

TODO: Identify and verify key connections between components.

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
{for each requirement mapped to phase:}
| {REQ-ID}: {description} | TODO | TODO |

## Test Results

TODO: Run test suite and record results.
```

**Data source mapping:**
- `phase`, `phase_name`, `Phase Goal` → `getRoadmapPhaseInternal(cwd, phase)`
- `Observable Truths` rows → Parse `ASSERTIONS.md` must-haves for this phase's requirement IDs; fallback to ROADMAP.md success criteria
- `Required Artifacts` rows → Parse completed plan SUMMARYs for `key-files.created` and `key-files.modified`
- `Requirements Coverage` rows → Parse ROADMAP.md phase block for `Requirements:` IDs, cross-reference `REQUIREMENTS.md` for descriptions

<!-- /section -->

<!-- section: risks -->
## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Workflow compression degrades agent behavior | HIGH | Measure with baseline/compare, test workflows end-to-end after compression |
| Section markers break existing workflow loading | MEDIUM | Markers are additive — agents loading full file see no change; only section-aware agents use markers |
| Scaffold data stale by time agent uses it | MEDIUM | Generate just-in-time in workflow step immediately before use; never cache |
| `extractSectionsFromFile()` edge cases with new markers | LOW | Extensive existing test coverage; add tests for each compressed workflow |
| Enricher performance impact from scaffold file checks | LOW | Single `existsSync` per scaffold type — negligible I/O cost |
| New scaffold types conflict with existing `cmdScaffold` switch | LOW | Additive cases to existing switch — no modification of existing paths |

<!-- /section -->

## Sources

- `src/commands/misc.js:2067` — `cmdSummaryGenerate()` scaffold-then-fill pattern (verified in codebase, HIGH confidence)
- `src/commands/features.js:1354` — `extractSectionsFromFile()` section marker parser (verified in codebase, HIGH confidence)
- `src/commands/features.js:1489` — `measureAllWorkflows()` token measurement (verified in codebase, HIGH confidence)
- `src/plugin/command-enricher.js:29` — `enrichCommand()` context injection (verified in codebase, HIGH confidence)
- `src/commands/misc.js:1470` — `cmdScaffold()` existing scaffold generator (verified in codebase, HIGH confidence)
- `workflows/*.md` — Workflow file sizes via `wc -l` (measured directly, HIGH confidence)
- v1.1 compression results — 54.6% average reduction on first 8 workflows (from PROJECT.md, HIGH confidence)
- v11.3 summary:generate — 50%+ LLM writing reduction (from PROJECT.md, HIGH confidence)

---
*Architecture research for: v14.0 LLM Workload Reduction — Workflow Compression & Scaffold Generation*  
*Researched: 2026-03-16*
