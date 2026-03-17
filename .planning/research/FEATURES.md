# Feature Research: LLM Workload Reduction — Workflow Compression & Document Scaffolds

**Domain:** Token optimization for AI agent orchestration systems (prompt compression, pre-computed scaffolds, section-level loading)
**Researched:** 2026-03-16
**Confidence:** HIGH (codebase analysis of 44 workflows + 52 src/ modules + existing compression infrastructure, validated against OpenDev paper [arXiv:2603.05344v3], CompactPrompt [arXiv:2510.18043], and Anthropic context engineering patterns)

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- Workflow compression round 2 (top 10 workflows by token size, 40%+ reduction) — extends v1.1's 54.6% top-8 reduction to remaining high-traffic workflows
- Pre-computed PLAN.md scaffolds from roadmap/phase/requirements data — CLI generates structure, LLM fills only task bodies
- Pre-computed VERIFICATION.md scaffolds from success criteria + test results — CLI generates observable truths and artifact tables, LLM fills evidence
- Section-level workflow loading — `<!-- section: -->` markers in workflows, load per-step not whole file
- Baseline measurement tooling — token count before/after for all workflows, regression detection

**Differentiators:**
- Conditional step elision — skip workflow steps that don't apply (e.g., skip TDD section for non-TDD plans, skip research step when research exists)
- Scaffold-then-fill pattern generalization — extend summary:generate pattern to PLAN.md, VERIFICATION.md, UAT.md, and CONTEXT.md
- Step-level CLI pre-computation — each workflow step that currently requires LLM reasoning replaced by CLI command outputting structured data

**Defer (v2+):** LLM-based prompt compression (LLMLingua/CompactPrompt), dynamic context compaction during execution, workflow DAG execution (parallel steps), auto-generated workflow variants per model capability

**Key dependencies:** Section-level loading requires `<!-- section: -->` markers in all target workflows; PLAN.md scaffold requires roadmap parser + requirements parser (both exist); VERIFICATION.md scaffold requires success_criteria extraction from PLAN.md (exists) + test runner integration (exists); all scaffolds depend on existing `util:scaffold` and `util:summary-generate` infrastructure
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the milestone to deliver measurable token reduction. Without these, v14.0 adds complexity without benefit.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Workflow compression round 2 | v1.1 compressed top 8 workflows by 54.6% avg; the next 10 largest workflows (discuss-phase 20KB, execute-phase 19KB, new-milestone 18KB, execute-plan 16KB, transition 12KB, new-project 11KB, audit-milestone 10KB, quick 10KB, resume-project 8KB, map-codebase 8KB) remain uncompressed. Total: ~133KB of workflow text loaded into context | HIGH | Requires per-workflow analysis. Compression techniques: remove verbose examples, extract repeating patterns into references, replace prose instructions with structured tables/XML, eliminate redundant context already provided by `<bgsd-context>` JSON injection. Must preserve behavioral correctness — compressed workflow must produce identical outcomes |
| Pre-computed PLAN.md scaffolds | Currently the planner LLM writes the entire PLAN.md from scratch (~1500-3000 tokens per plan). The CLI already has roadmap data (phase goal, requirements, depends_on), parsed requirements text, and phase context. A scaffold with frontmatter, objective, task structure, and requirement mapping pre-populated reduces LLM work to writing task descriptions and verification criteria only | MEDIUM | Extends `util:scaffold` (currently supports context/uat/verification/phase-dir) and `util:summary-generate` pattern. Input: phase number → output: PLAN.md skeleton with frontmatter, `<objective>`, requirement links, empty `<task>` blocks. LLM fills: task names, file lists, action bodies, verification blocks, success criteria |
| Pre-computed VERIFICATION.md scaffolds | Verifier agents currently write full verification reports from scratch. The CLI can pre-populate: phase goal (from ROADMAP), observable truths (derived from PLAN success_criteria), required artifacts (from PLAN file lists), requirement mapping (from REQUIREMENTS.md). LLM fills only: status, evidence, gap analysis | MEDIUM | Extends `util:scaffold verification` (currently creates empty template). New: `util:scaffold verification --populate` reads PLAN.md success_criteria, PLAN.md file lists, ROADMAP goal, and REQUIREMENTS to pre-fill tables. Similar to summary:generate pattern |
| Section-level workflow loading | Workflows currently load as monolithic files into context. A 376-line execute-plan.md consumes ~4200 tokens even when the agent only needs the current step. Section markers (`<!-- section: step_name -->`) enable `extract-sections` to load only relevant portions. The extract-sections command already exists and supports `<!-- section: -->` / `<!-- /section -->` markers | MEDIUM | Requires adding section markers to target workflows. Agent workflow then becomes: load init section → execute → load next section → execute. Existing `extract-sections` CLI handles the parsing. Key design choice: sections must be self-contained (no cross-references to other sections within the same workflow) |
| Baseline measurement tooling | Cannot prove 40%+ reduction without before/after measurements. `util:baseline measure` already exists and measures all workflows. Need: per-workflow token count, per-section token count, regression detection (flag workflows that grow beyond baseline), integration into CI/deploy pipeline | LOW | Extends existing `cmdBaselineMeasure` and `cmdBaselineCompare` in features.js. Add: section-level token counts, threshold alerts, and a `--check` flag that fails if any workflow exceeds its baseline by >10% |

### Differentiators (Competitive Advantage)

Features that transform bGSD from "compressed prompts" into "minimal-context agent orchestration." These represent patterns not found in comparable systems.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conditional step elision | Workflow steps that don't apply to the current plan are removed before injection. Example: execute-plan.md has TDD section (149-154), auto-test section (156-177), deviation-capture section (124-147), review section (229-257) — a simple non-TDD plan without review doesn't need any of these. Pre-computed decisions from `<bgsd-context>` already tell us which steps apply. Estimated savings: 30-50% of execute-plan.md content per invocation | HIGH | Requires workflow annotation (which steps are conditional on which `<bgsd-context>` fields) and a new CLI command `util:workflow-prepare` that takes a workflow path + context JSON → outputs only applicable sections. This is the "lazy tool discovery" pattern from OpenDev (arXiv:2603.05344v3 §2.4.7) applied to workflow steps rather than tools |
| Scaffold-then-fill generalization | summary:generate proved the pattern: CLI generates data sections (commits, files, timing), LLM fills only judgment sections (accomplishments, decisions, issues). Generalizing to PLAN.md, VERIFICATION.md, UAT.md, and CONTEXT.md means 4 more document types where CLI does 50-70% of the writing. Pattern: `scaffold:generate <type> <args> → JSON with {file_written, todos_remaining, sections_populated}` | MEDIUM | Each scaffold type needs its own data extraction logic, but the infrastructure (template + fill + count-todos) is identical. The summary:generate implementation (misc.js L2067-2354) provides the blueprint |
| Step-level CLI pre-computation | Each workflow step currently contains bash commands the LLM must parse, execute, and interpret. Pre-computing step results into `<bgsd-context>` means the LLM receives data, not instructions to get data. Example: execute-plan.md's `context_budget_check` step already uses pre-computed decisions. Extending this to ALL data-gathering steps eliminates ~40% of bash command blocks in workflows | HIGH | Requires identifying all workflow steps that gather data (vs. steps that require LLM judgment), creating CLI commands for each, and wiring them into the enricher/context pipeline. Some already exist (context budget, execution pattern, previous check gate). Need: plan file listing, summary counting, requirement extraction, phase validation |
| Reference deduplication across workflows | Multiple workflows contain identical instruction blocks (deviation rules in execute-plan.md and execute-phase.md, checkpoint protocol in execute-plan.md and plan-phase.md, commit patterns in 5+ workflows). Extracting shared blocks into skills or references and loading them by reference eliminates duplication. The skills architecture (27 skills, v8.3) already supports this pattern | MEDIUM | Audit all 44 workflows for duplicated instruction blocks. Extract to skills or references. Replace inline content with `@reference` or `<skill:X />` directives. Must ensure extract-sections can resolve references for section-level loading |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in a CLI-based agent orchestration context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| LLM-based prompt compression (LLMLingua/CompactPrompt) | "Use an LLM to compress prompts before sending to the main LLM" — the CompactPrompt paper (arXiv:2510.18043) achieves 60% token reduction | Adds a second LLM call per workflow invocation, increasing latency and cost. CLI tools have <5s budget. Training-data-based token pruning removes tokens the LLM might need for specific edge cases. Risk of behavioral regression is high and hard to test | Structural compression (remove redundancy, use tables, extract references) achieves 40-55% without LLM call overhead. Deterministic, testable, zero latency cost |
| Dynamic context compaction during execution | "Progressively summarize conversation history as context grows" — OpenDev uses adaptive compaction (§2.3.6) with 5-stage progressive compression | bGSD workflows are short-lived (single plan execution, not multi-hour sessions). Compaction is a long-session optimization. bGSD's context pressure comes from workflow injection at startup, not from accumulated conversation history. The plugin's `buildCompactionContext` already handles session compaction for the host editor | Focus on reducing what goes IN to context (workflow compression, section loading) rather than compacting what accumulates DURING execution. Different problem, different solution |
| Workflow DAG execution (parallel steps) | "Steps that don't depend on each other could run in parallel" | Adds massive complexity to the orchestration layer. Most workflow steps DO depend on previous steps (init → validate → execute → summarize). The few independent steps (e.g., parallel subagent spawns) are already handled by the host editor's Task() primitive. CLI tool is synchronous by design (OUT OF SCOPE constraint) | Keep sequential workflow execution. Let the host editor handle parallelism via its native concurrency model (Task spawns). Focus on making each sequential step faster (less tokens, more pre-computed data) |
| Auto-generated workflow variants per model capability | "Generate Opus-quality and Sonnet-quality workflow variants automatically" | Doubles maintenance surface. Behavioral differences between models are better handled by the progressive confidence model in decision-rules.js (HIGH confidence = deterministic, MEDIUM = LLM confirms). Workflow text should be model-agnostic; model-specific behavior lives in the decision layer | Use existing model routing (v8.0) and decision confidence (v11.3) to adapt behavior. Workflow stays one version. Model-awareness is a runtime concern, not a document concern |
| Full workflow rewrite in structured XML | "Replace all markdown workflows with pure XML for machine parsing" | Breaks human readability. Workflows serve dual purpose: machine instructions AND human documentation. Developers read workflows to understand system behavior. Pure XML would require a separate human-readable documentation layer | Use hybrid: structural elements in XML (`<step>`, `<deviation_rules>`) for machine parsing, prose in markdown for human reading. This is already the pattern in execute-plan.md and most v1.1+ workflows |
<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Baseline Measurement Tooling]
    └──enhances──> [Workflow Compression Round 2] (measures impact)
    └──enhances──> [Section-Level Loading] (measures per-section tokens)

[Section Markers in Workflows]
    └──requires──> [Audit of all 44 workflows for step boundaries]

[Section-Level Workflow Loading]
    └──requires──> [Section Markers in Workflows]
    └──requires──> [extract-sections CLI] (already exists)

[Workflow Compression Round 2]
    └──requires──> [Baseline Measurement] (know what to compress)
    └──enhances──> [Section-Level Loading] (compressed sections = smaller loads)

[Conditional Step Elision]
    └──requires──> [Section-Level Loading] (needs section boundaries to skip)
    └──requires──> [<bgsd-context> decisions] (already exists, drives conditions)

[Pre-computed PLAN.md Scaffolds]
    └──requires──> [Roadmap parser] (already exists)
    └──requires──> [Requirements parser] (already exists)
    └──requires──> [util:scaffold infrastructure] (already exists)
    └──enhances──> [Workflow Compression] (planner workflow shrinks because scaffold does data work)

[Pre-computed VERIFICATION.md Scaffolds]
    └──requires──> [PLAN.md success_criteria parser] (already exists)
    └──requires──> [util:scaffold infrastructure] (already exists)
    └──requires──> [Pre-computed PLAN.md Scaffolds] (PLAN must exist to scaffold VERIFICATION)

[Reference Deduplication]
    └──requires──> [Skills architecture] (already exists, v8.3)
    └──enhances──> [Workflow Compression] (shared blocks extracted = less per-workflow content)

[Step-Level CLI Pre-computation]
    └──requires──> [<bgsd-context> enricher] (already exists)
    └──enhances──> [Workflow Compression] (data steps replaced by pre-computed values)
    └──enhances──> [Conditional Step Elision] (pre-computed decisions drive elision)
```

### Dependency Notes

- **Section-Level Loading requires Section Markers:** The `extract-sections` command already parses `<!-- section: name -->` / `<!-- /section -->` markers. Workflows need these markers added before section loading can work. This is a prerequisite task, not a feature.
- **Conditional Step Elision requires Section-Level Loading:** You can't skip a step if you can't identify its boundaries. Section markers define the boundaries; elision uses them to exclude irrelevant steps.
- **Workflow Compression and Section Loading are synergistic:** Compression reduces the size of each section; section loading avoids injecting sections that aren't needed. Together they compound: a compressed section that's also elided saves both its reduced size AND its load.
- **VERIFICATION.md Scaffold logically follows PLAN.md Scaffold:** The verification report is derived from plan content (success criteria, file lists, requirements). If PLAN.md is scaffold-generated, the scaffold generator already has the parsed data needed for VERIFICATION.md.
- **Reference Deduplication enhances Workflow Compression:** If 5 workflows each contain 30 lines of identical deviation rules, extracting them to a skill saves 120 lines total. This is compression by deduplication rather than by rewriting.
- **Step-Level CLI Pre-computation enhances everything:** Every bash command block replaced by a pre-computed `<bgsd-context>` field removes ~50-100 tokens of instruction text per step. This compounds with compression and section loading.
<!-- /section -->

<!-- section: compression_analysis -->
## Workflow Compression Analysis

### Top 10 Uncompressed Workflows by Size

Current token counts (estimated via tokenx, including @-reference resolution):

| Rank | Workflow | Lines | Bytes | Est. Tokens | Key Compression Opportunities |
|------|----------|-------|-------|-------------|-------------------------------|
| 1 | discuss-phase.md | 538 | 20,330 | ~5,100 | Heavy prose instructions for conversation flow; repeating pattern structures; examples that could be references |
| 2 | execute-phase.md | 497 | 19,544 | ~4,900 | Orchestration logic duplicated from execute-plan.md; phase-level wrapping of plan execution that could be a thin layer |
| 3 | new-milestone.md | 505 | 18,610 | ~4,700 | Research spawning, roadmap creation, context gathering — much of which is now pre-computed by enricher/decisions |
| 4 | execute-plan.md | 376 | 16,564 | ~4,200 | Deviation rules (30+ lines), TDD section (conditional), auto-test section (conditional), review section (conditional), commit protocol (duplicated in 3+ workflows) |
| 5 | transition.md | 519 | 12,140 | ~3,000 | Phase transition logic; much overlaps with execute-phase orchestration |
| 6 | new-project.md | 273 | 11,299 | ~2,800 | Project initialization; wizard-like flow that could be CLI-driven |
| 7 | audit-milestone.md | 301 | 10,782 | ~2,700 | Milestone validation; heavy template sections for report generation |
| 8 | quick.md | 341 | 10,105 | ~2,500 | Quick task execution; contains full deviation rules and commit protocol (duplicated) |
| 9 | resume-project.md | 286 | 8,799 | ~2,200 | Session resume; diagnostic steps that could be CLI pre-computed |
| 10 | map-codebase.md | 303 | 8,564 | ~2,100 | Codebase mapping; heavy instructions for something largely CLI-automatable |

**Total opportunity:** ~34,200 tokens across top 10. At 40% reduction target: ~13,700 tokens saved per session (for whichever workflow is invoked).

### Compression Technique Applicability

| Technique | Applicable Workflows | Estimated Reduction | Confidence |
|-----------|---------------------|---------------------|------------|
| Remove redundant context (already in `<bgsd-context>`) | All 10 — every workflow has "parse bgsd-context JSON for: ..." sections that restate what the enricher provides | 10-15% per workflow | HIGH — v1.1 proved this technique |
| Extract shared blocks to skills/references | execute-plan, execute-phase, quick (deviation rules); execute-plan, plan-phase (checkpoint protocol); 5+ workflows (commit protocol) | 15-25% for affected workflows | HIGH — skills architecture proven in v8.3 |
| Replace prose with structured tables/XML | discuss-phase, new-milestone, audit-milestone (heavy prose sections) | 15-25% for affected workflows | MEDIUM — effectiveness depends on LLM's ability to follow tabular instructions vs prose |
| Conditional step elision | execute-plan (TDD, auto-test, review, deviation-capture are all conditional) | 30-50% per invocation for execute-plan | HIGH for execute-plan; MEDIUM for others |
| Step-level CLI pre-computation | resume-project (diagnostic steps), new-milestone (phase detection), progress (route determination) | 20-30% for affected workflows | HIGH — enricher/decision pattern proven |
<!-- /section -->

<!-- section: scaffold_analysis -->
## Document Scaffold Analysis

### Existing Scaffold Infrastructure

| Component | Location | What It Does | Status |
|-----------|----------|-------------|--------|
| `util:scaffold` | misc.js L1483-1534 | Creates empty context/uat/verification/phase-dir files with basic frontmatter | Exists — creates blank templates |
| `util:summary-generate` | misc.js L2067-2354 | Pre-populates SUMMARY.md from PLAN.md + git commits + diff data. Writes file, LLM fills TODOs | Exists — proven pattern, 50%+ LLM writing reduction |
| `util:extract-sections` | features.js L1459-1478 | Extracts named sections from files with `<!-- section: -->` markers | Exists — used by references and skills |
| PLAN.md template parsing | Frontmatter + XML `<task>`, `<objective>`, `<verification>`, `<success_criteria>` tags | N/A — templates define structure, parsers extract it | Exists — regex patterns in router.js, misc.js |
| Verification report template | templates/verification-report.md | Defines full verification report structure with tables | Exists — 322-line template with examples |
| `<bgsd-context>` enricher | plugin/command-enricher.js | Pre-computes project state, decisions, paths, counts | Exists — injected into every workflow execution |

### New Scaffold Types Needed

#### 1. PLAN.md Scaffold (`plan:scaffold` or `util:scaffold plan --populate`)

**Input:** Phase number → reads ROADMAP.md (goal, requirements, depends_on), REQUIREMENTS.md (requirement text), CONTEXT.md (decisions, discretion areas), RESEARCH.md (if exists)

**Pre-populated sections (CLI writes):**
- Frontmatter: `phase`, `plan`, `phase_name`, `phase_goal`, `requirements` (IDs from roadmap)
- `<objective>` block with phase goal as starting point
- `<context>` block listing available files (context, research, requirements paths)
- Per-requirement `<task>` skeleton: `<name>`, `<context>`, empty `<action>`, empty `<verification>`
- `<success_criteria>` seeded from requirements text
- `<done>` block listing requirement IDs

**LLM fills (remaining TODOs):**
- Task names (specific implementation descriptions)
- Task `<action>` bodies (actual implementation steps)
- Task `<verification>` checks (specific test/check commands)
- Task `<files>` lists (which files to create/modify)
- Success criteria refinement (make testable/observable)
- Task ordering and dependencies

**Estimated reduction:** 40-60% of planner LLM writing work (frontmatter + structure is ~600 tokens per plan; LLM currently writes all ~1500-3000 tokens)

#### 2. VERIFICATION.md Scaffold (`verify:scaffold` or `util:scaffold verification --populate`)

**Input:** Phase number → reads all PLAN.md files (success_criteria, file lists), ROADMAP.md (goal, requirements), REQUIREMENTS.md (requirement text), test results (if available)

**Pre-populated sections (CLI writes):**
- Frontmatter: `phase`, `verified` timestamp, `status: pending`, `score: 0/N`
- Phase goal (from ROADMAP)
- Observable truths table: one row per success criterion from PLAN.md, status column blank
- Required artifacts table: one row per file in PLAN.md `<files>` blocks, status column blank
- Requirements coverage table: one row per requirement ID, status column blank
- Anti-patterns section structure (empty table)
- Gaps summary structure

**LLM fills (remaining TODOs):**
- Status column for each truth/artifact/requirement (✓/✗/?)
- Evidence descriptions
- Anti-pattern findings
- Gap analysis and recommendations
- Fix plan suggestions

**Estimated reduction:** 50-70% of verifier LLM writing work (report structure + table rows are ~800-1200 tokens; LLM currently writes all ~2000-4000 tokens)

#### 3. CONTEXT.md Scaffold (enhanced `util:scaffold context`)

**Input:** Phase number → reads ROADMAP.md (phase description), previous phase SUMMARYs (decisions, patterns), INTENT.md (if exists)

**Pre-populated sections (CLI writes):**
- Frontmatter with phase metadata
- Previous phase decisions (extracted from SUMMARYs)
- Known constraints (from PROJECT.md)
- Requirements for this phase (from REQUIREMENTS.md)

**LLM fills:** Discussion outcomes, discretion areas, deferred ideas (these require human conversation via discuss-phase)

**Estimated reduction:** 30-40% of discuss-phase workflow's setup work
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v14.0 Core)

Minimum viable token reduction — enough to prove measurable savings and establish patterns for further reduction.

- [ ] Workflow compression round 2 — top 10 workflows reduced by 40%+ tokens via structural compression (redundancy removal, shared block extraction, table/XML conversion)
- [ ] Pre-computed PLAN.md scaffolds — `util:scaffold plan --populate <phase>` generates PLAN.md skeleton with frontmatter, objective, task structure, requirement links from roadmap/requirements data
- [ ] Pre-computed VERIFICATION.md scaffolds — `util:scaffold verification --populate <phase>` generates verification report with observable truths, artifact tables, requirement mapping from PLAN.md data
- [ ] Section-level workflow loading — `<!-- section: step_name -->` markers added to all top 10 workflows; orchestrator workflows load per-step instead of whole file
- [ ] Baseline measurement with regression detection — `util:baseline measure --sections` captures per-section token counts; `util:baseline compare --check` fails on >10% regression

### Add After Validation (v14.0 Later Phases)

Features to add once core compression and scaffolds are working.

- [ ] Conditional step elision — execute-plan.md steps gated by `<bgsd-context>` decisions (TDD, review, deviation-capture conditionally excluded)
- [ ] Reference deduplication — deviation rules, commit protocol, checkpoint protocol extracted to skills; 5+ workflows use `<skill:X />` instead of inline content
- [ ] Step-level CLI pre-computation — resume-project diagnostics, new-milestone phase detection, progress route determination replaced by enricher fields
- [ ] UAT.md scaffold — `util:scaffold uat --populate <phase>` generates test list from SUMMARY accomplishments

### Future Consideration (v15+)

Features to defer until the compression pipeline is battle-tested.

- [ ] Workflow-level caching — if `<bgsd-context>` hasn't changed, serve cached workflow output instead of re-injecting
- [ ] Model-aware section selection — load fewer/simpler sections for more capable models that need less guidance
- [ ] Dynamic context budgeting — allocate workflow token budget based on remaining context window, compress more aggressively when window is tight
- [ ] Workflow DAG execution — identify independent steps for parallel execution (blocked by synchronous architecture constraint)
<!-- /section -->

<!-- section: prioritization -->
## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Workflow compression round 2 (top 10) | HIGH | HIGH | P1 |
| Pre-computed PLAN.md scaffolds | HIGH | MEDIUM | P1 |
| Pre-computed VERIFICATION.md scaffolds | HIGH | MEDIUM | P1 |
| Section-level workflow loading | HIGH | MEDIUM | P1 |
| Baseline measurement with sections + regression | MEDIUM | LOW | P1 |
| Conditional step elision | HIGH | HIGH | P2 |
| Reference deduplication (shared blocks → skills) | MEDIUM | MEDIUM | P2 |
| Step-level CLI pre-computation | MEDIUM | MEDIUM | P2 |
| UAT.md scaffold | LOW | LOW | P2 |
| Workflow-level caching | LOW | HIGH | P3 |
| Model-aware section selection | LOW | HIGH | P3 |
| Dynamic context budgeting | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v14.0 launch — defines the milestone's token reduction targets
- P2: Should have in v14.0 — compounds P1 savings, add in later phases
- P3: Future consideration — defer to v15+, requires architectural changes
<!-- /section -->

<!-- section: competitors -->
## Comparable Agent System Patterns

How other AI agent orchestration systems handle workflow compression and document scaffolding.

| Pattern | System | How They Do It | Our Approach |
|---------|--------|----------------|--------------|
| Adaptive context compaction | OpenDev (arXiv:2603.05344v3 §2.3.6) | 5-stage progressive compression of conversation history; pre-computed summaries replace full tool outputs at compaction time | We compress at injection time (workflow compression) rather than at compaction time. Different problem: bGSD workflows are short-lived, context pressure is from workflow size, not conversation accumulation |
| Conditional prompt composition | OpenDev (§2.3.1) | Priority-ordered sections with mode-specific variants and provider-conditional sections; sections load only when contextually relevant | Directly applicable. Our section-level loading + conditional step elision follows this exact pattern. OpenDev uses priority ordering; we use `<bgsd-context>` decisions for conditions |
| Scaffold-then-fill | bGSD v11.3 `summary:generate` | CLI pre-populates SUMMARY.md from git/plan data; LLM fills only judgment sections | Proven in our own system. Extending to PLAN.md and VERIFICATION.md. No external precedent found for planning document scaffolds specifically |
| Lazy tool discovery | OpenDev (§2.4.7) | Tools loaded on-demand via keyword search rather than all at startup; reduces initial prompt size by ~95% | Our equivalent: section-level loading. Instead of loading all workflow steps at once, load per-step. Different mechanism (file sections vs tool registry) but same principle |
| Token-efficient templates | Claude Code (CLAUDE.md convention) | Structured project conventions in a single file; model learns patterns once rather than re-reading per-task instructions | Our PROJECT.md + skills architecture serves this role. Compression round 2 applies this insight: extract repeating patterns into learned conventions |
| n-gram abbreviation | CompactPrompt (arXiv:2510.18043) | Replaces recurring text patterns with abbreviated forms using n-gram analysis | Applicable in limited form: CLI path template `__OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs` appears 50+ times across workflows. Could be aliased. But full n-gram compression requires runtime decompression, which adds complexity |
| Pre-computed summaries at ingestion | OpenDev (§2.3.2) | Tool results get pre-computed summaries at ingestion time; compactor uses summaries instead of re-processing full output | Our enricher serves this exact role. `<bgsd-context>` pre-computes all data-gathering results. Extending this pattern to MORE workflow steps (step-level CLI pre-computation) is a natural evolution |
| Event-driven system reminders | OpenDev (§2.3.4) | Instead of putting all instructions in system prompt, inject targeted reminders at decision points | Our conditional step elision approximates this: load the instruction section only when the agent reaches that step. Not event-driven (CLI is synchronous) but achieves the same effect |

### Key Insight from Comparable Systems

The OpenDev paper (arXiv:2603.05344v3) and Anthropic's context engineering guidance converge on the same principle: **context engineering is about the right information at the right time, not the most information all at once.**

bGSD v14.0's approach directly implements this:
1. **Right time:** Section-level loading provides workflow instructions only when the agent reaches that step
2. **Right information:** Conditional elision removes steps that don't apply to the current plan
3. **Less LLM work:** Scaffolds shift data-gathering from LLM reasoning to deterministic CLI operations
4. **Measurable:** Baseline tooling proves the savings are real and prevents regression

The unique aspect of bGSD's approach vs. OpenDev/Claude Code: bGSD operates at the **workflow orchestration layer** (the instructions that drive agent behavior) rather than at the **conversation history layer** (accumulated tool outputs and reasoning). This is because bGSD workflows are short-lived plan executions (~5-30 minutes) rather than long-running interactive sessions (~hours). The context pressure is front-loaded (large workflows injected at start) rather than accumulated (conversation history growth).

## Sources

- OpenDev: "Building Effective AI Coding Agents for the Terminal" (arXiv:2603.05344v3, 2026-03-13) — adaptive context compaction, conditional prompt composition, lazy tool discovery — [HIGH confidence, peer-reviewed paper]
- CompactPrompt: "A Unified Pipeline for Prompt Data Compression in LLM Workflows" (arXiv:2510.18043, 2025-10-20) — n-gram abbreviation, self-information scoring — [MEDIUM confidence, benchmark results only]
- Anthropic: Context engineering patterns via morphllm.com summary (2026-02-15) — "right information at the right time", lazy loading, ~1M token wall — [HIGH confidence, documented patterns]
- Existing bGSD codebase: 44 workflows (274KB total), `util:summary-generate` (misc.js L2067-2354), `util:scaffold` (misc.js L1483-1534), `extract-sections` (features.js L1459-1478), `<bgsd-context>` enricher (plugin/command-enricher.js), context.js (AGENT_MANIFESTS, token estimation) — [HIGH confidence, direct source analysis]
- Context engineering article by Elliott Girard (2026-02-18) — "prompt engineering gets you a demo, context engineering gets you a product" — [MEDIUM confidence, practitioner report]
- v1.1 workflow compression results: 54.6% average across top 8 workflows — [HIGH confidence, measured in our system]
- v11.3 summary:generate results: 50%+ LLM writing reduction — [HIGH confidence, measured in our system]
<!-- /section -->

---
*Feature research for: LLM workload reduction — workflow compression & document scaffolds*
*Researched: 2026-03-16*
