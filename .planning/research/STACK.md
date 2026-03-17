# Stack Research — LLM Workload Reduction

**Domain:** Workflow compression, pre-computed document scaffolding, section-level loading for AI-driven CLI
**Researched:** 2026-03-16
**Confidence:** HIGH (all recommendations use existing codebase infrastructure — no new dependencies)

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core stack:** No new dependencies. Everything built on existing modules.

| Technology | Purpose | Version |
|------------|---------|---------|
| tokenx (bundled) | BPE token measurement for before/after compression proof | Already bundled (~4.5KB) |
| extractSectionsFromFile (features.js) | Section-level workflow loading via `<!-- section: name -->` markers | Existing in v1.1+ |
| cmdSummaryGenerate (misc.js) | Scaffold-then-fill pattern for SUMMARY.md — extend to PLAN.md/VERIFICATION.md | Existing in v11.3+ |
| context.js estimateTokens | Per-workflow token counting for compression measurement | Existing in v1.1+ |
| esbuild (dev) | Build pipeline — no changes needed | 0.25.x (bundled dev dep) |

**Key patterns:** `<!-- section: name -->` markers for selective loading, scaffold-then-fill (CLI generates structure, LLM fills judgment), `<step>` tag compression via prose tightening, pre-computed data injection via `<bgsd-context>`.

**Avoid:** Template engines (Mustache/Handlebars/EJS — adds dependencies, overkill for string interpolation), Markdown AST parsers (remark/unified — heavy, regex sufficient), external compression libraries (gzip/brotli — wrong kind of compression), new CLI tools (all work is internal module changes).

**Install:** No installation needed — zero new dependencies.
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| tokenx | Bundled | BPE token estimation (~96% accuracy) | Already integrated in `context.js`; required for before/after compression measurement per SC-76 |
| node:sqlite (DatabaseSync) | Node 22.5+ | Cache compressed workflow variants and scaffold data | Already in use via `planning-cache.js`; cache pre-computed scaffolds for cross-invocation reuse |
| extractSectionsFromFile | v1.1+ | Parse `<!-- section: name -->` and `##` header boundaries | Foundation for section-level workflow loading (DO-99); already tested and exported |
| cmdSummaryGenerate | v11.3+ | Git/plan data extraction for scaffold generation | Proven scaffold-then-fill pattern; extend same approach to PLAN.md and VERIFICATION.md |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| estimateTokens (context.js) | Existing | Per-text token counting | Measure every workflow before/after compression; feed `context-budget` baseline/compare |
| structuredLog (git.js) | Existing | Scoped git commit extraction | VERIFICATION.md scaffold needs commit data scoped to phase |
| diffSummary (git.js) | Existing | File change summaries | VERIFICATION.md scaffold pre-fills file change evidence |
| extractFrontmatter (frontmatter.js) | Existing | YAML frontmatter parsing | PLAN.md scaffold reads roadmap phase data and requirements |
| findPhaseInternal (misc.js) | Existing | Phase directory/metadata resolution | All scaffold commands need phase resolution |
| AGENT_MANIFESTS (context.js) | Existing | Agent context manifests with token budgets | Section-level loading respects agent budget constraints |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| context-budget baseline | Capture pre-compression token counts | Run BEFORE any compression work begins |
| context-budget compare | Measure post-compression reduction | Run AFTER each compression batch to verify >= 40% target |
| node:test | Test compressed workflows produce identical behavior | Snapshot tests for scaffold output structure |

## Installation

```bash
# No new packages needed
# All work uses existing bundled dependencies

# Dev workflow:
npm run build     # Rebuild after src/ changes
npm test          # Verify no regressions
```
<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| String concatenation for scaffolds | Mustache/Handlebars template engine | Never for this project — adds dependency, template syntax is overkill for structured markdown generation |
| `<!-- section: name -->` markers | remark/unified Markdown AST | Never — regex-based section extraction is already working, AST parsing adds 200KB+ dependency |
| Manual prose tightening | LLM-based auto-compression | Never — compression must preserve behavioral logic; manual review catches semantic drift |
| In-memory scaffold generation | File-based scaffold templates | Never as separate files — scaffolds are generated dynamically from live project data (roadmap, git, requirements), not static templates |
| SQLite cache for scaffold results | File-based .cache/ scaffold cache | Use file-based only if scaffold generation is <10ms (no caching needed). SQLite preferred if generation involves git operations (>50ms) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Mustache/Handlebars/EJS | Adds npm dependency; violates zero-dependency policy; string interpolation sufficient for structured scaffold output | Template literals + helper functions in a `scaffold.js` module |
| remark/unified/mdast | 200KB+ dependency for Markdown AST; `extractSectionsFromFile` already handles section extraction with regex | Existing regex-based section parser in `features.js` |
| gzip/brotli/zstd | Wrong kind of compression — we need *semantic* token reduction, not byte-level compression | Prose tightening, deduplication, section-level loading |
| New workflow format (YAML/JSON) | Workflows are Markdown prompts consumed by LLMs; changing format breaks the entire agent architecture | Keep Markdown with `<!-- section: name -->` markers for selective loading |
| External diff tools for compression measurement | Adds tool dependency for something tokenx already handles | `estimateTokens()` before/after comparison |
| Template inheritance / partials system | Over-engineering for 44 workflows; each workflow is self-contained by design | Shared `<step>` blocks extracted into reusable references only if 3+ workflows duplicate them verbatim |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns for v14.0

### Pattern 1: Workflow Compression (DO-96)

**Technique:** Prose tightening + section markers + conditional loading

The top 10 workflows by token count are the compression targets:

| # | Workflow | Est. Tokens | Compression Strategy |
|---|----------|-------------|---------------------|
| 1 | discuss-phase.md | ~5,000 | Add `<!-- section -->` markers around examples/philosophy; load examples only on first run |
| 2 | execute-phase.md | ~4,800 | Already compressed in v1.1 (57%); focus on section markers for branching/worktree logic |
| 3 | new-milestone.md | ~4,250 | Extract research/roadmapper spawn prompts to conditional sections; tighten PROJECT.md update instructions |
| 4 | execute-plan.md | ~4,100 | Already compressed in v1.1 (54%); add section markers around TDD/checkpoint/review sections |
| 5 | transition.md | ~3,000 | Extract config-check and safety-rail sections; load only when relevant |
| 6 | new-project.md | ~2,750 | Already compressed in v1.1 (72%); section markers around questionnaire |
| 7 | audit-milestone.md | ~2,450 | Section markers around scoring rubric and report template |
| 8 | quick.md | ~2,350 | Already compressed in v1.1 (32%); tighten plan-context loading |
| 9 | map-codebase.md | ~2,140 | Extract language-specific mapping instructions to conditional sections |
| 10 | complete-milestone.md | ~2,120 | Already compressed in v1.1 (74%); section markers around archive instructions |

**v1.1 already compressed 8 of these.** Round 2 focuses on:
1. Adding `<!-- section: name -->` markers to enable partial loading
2. Prose tightening on the 2 never-compressed workflows (discuss-phase, transition)
3. Moving examples and edge-case instructions to loadable sections

**Measurement:** Use `context-budget baseline` before, `context-budget compare` after. Target: 40%+ average across top 10.

### Pattern 2: Scaffold-Then-Fill for PLAN.md (DO-97)

**Technique:** New `plan:generate` CLI command extending the `summary:generate` pattern

```
Input:  Phase number → roadmap data + requirements + CONTEXT.md + RESEARCH.md
Output: PLAN.md scaffold with:
  - Frontmatter (phase, plan number, requirements, tags)
  - Objective section (from roadmap goal)
  - Task shells (numbered, with <name>, <files>, empty <action>/<verify>/<done>)
  - @context references (auto-populated from phase directory)
  - Must-haves (from ASSERTIONS.md or roadmap success criteria)
```

LLM fills ONLY: task objectives, action steps, verify commands, done criteria.
CLI pre-fills: ~60%+ of PLAN.md content (frontmatter, structure, references, requirement mapping).

**Implementation location:** `src/commands/misc.js` — new `cmdPlanGenerate()` alongside existing `cmdSummaryGenerate()`.

### Pattern 3: Scaffold-Then-Fill for VERIFICATION.md (DO-98)

**Technique:** New `verify:generate` CLI command

```
Input:  Phase number → PLAN.md data + success criteria + test results + git diff
Output: VERIFICATION.md scaffold with:
  - Frontmatter (phase, timestamp, status: pending)
  - Goal section (from roadmap)
  - Observable Truths table (from success criteria, all status "? PENDING")
  - Required Artifacts table (from PLAN.md key-files, all status "? PENDING")
  - Requirements Coverage table (from requirements, all status "? PENDING")
  - Anti-Patterns section (empty template)
```

LLM fills ONLY: status verdicts, evidence descriptions, gap analysis.
CLI pre-fills: ~60%+ of VERIFICATION.md content (structure, tables, success criteria text).

**Implementation location:** `src/commands/verify.js` — new `cmdVerificationGenerate()`.

### Pattern 4: Section-Level Workflow Loading (DO-99)

**Technique:** Extend `extractSectionsFromFile` with workflow-aware loading

Currently, workflows are loaded as full files into the LLM context. With section markers, the command-enricher or workflow loader can:

1. Parse workflow for `<!-- section: name -->` boundaries
2. Load only sections relevant to the current step
3. Skip examples, edge cases, and conditional logic until needed

**Integration point:** `src/plugin/command-enricher.js` — intercept workflow loading and apply section filtering based on execution state.

**Prerequisite:** Workflows must first have `<!-- section: name -->` markers added (Pattern 1).
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Package/Module | Compatible With | Notes |
|----------------|-----------------|-------|
| tokenx (bundled) | Node 18+ | Already bundled in esbuild output; no version concerns |
| node:sqlite (DatabaseSync) | Node 22.5+ | Required for scaffold caching; Map fallback on older versions |
| extractSectionsFromFile | All bgsd-tools versions | Uses only `fs.readFileSync` and regex; no version constraints |
| esbuild 0.25.x | Node 18+ | Build-time only; no runtime impact |
| `<!-- section: name -->` markers | All Markdown renderers | Standard HTML comments; invisible to Markdown rendering; no compatibility concerns |

## Integration Points

| Existing Module | v14.0 Change | Risk |
|-----------------|-------------|------|
| `src/commands/features.js` (extractSectionsFromFile) | No changes — consumed as-is by section-level loading | None |
| `src/commands/misc.js` (cmdSummaryGenerate) | Add sibling `cmdPlanGenerate()` following same pattern | Low — additive |
| `src/commands/verify.js` | Add `cmdVerificationGenerate()` | Low — additive |
| `src/router.js` | Wire new `plan:generate` and `verify:generate` commands | Low — pattern established |
| `src/plugin/command-enricher.js` | Add section-filtering logic for workflow loading | Medium — changes how workflows are injected into LLM context |
| `workflows/*.md` | Add `<!-- section: name -->` markers; tighten prose | Medium — must preserve all behavioral logic |
| `src/lib/context.js` | No changes — `estimateTokens()` used for measurement only | None |
| `build.cjs` | No changes — esbuild bundles new commands automatically | None |

## Constraints Verified

| Constraint | Impact on v14.0 | Status |
|-----------|-----------------|--------|
| Zero external dependencies | All work uses existing bundled modules | ✓ Satisfied |
| Single-file deploy | New commands bundle into `bgsd-tools.cjs` via esbuild | ✓ Satisfied |
| Backward compatibility | Section markers are HTML comments — invisible to existing parsers; scaffold commands are additive | ✓ Satisfied |
| Node 22.5+ minimum | Scaffold caching uses existing SQLite; Map fallback preserved | ✓ Satisfied |
| Agent cap (9 roles) | No new agents — scaffolds are CLI commands consumed by existing agents | ✓ Satisfied |

## Sources

- **Codebase inspection** — `src/commands/misc.js` (cmdSummaryGenerate, cmdScaffold), `src/commands/features.js` (extractSectionsFromFile, estimateTokens), `src/commands/verify.js`, `workflows/*.md` (all 44 files measured) — HIGH confidence
- **v1.1 compression results** — `.planning/milestones/v1.1-phases/08-workflow-reference-compression/` (verified 54.6% avg reduction in round 1, 8 workflows) — HIGH confidence
- **v11.3 scaffold pattern** — `.planning/milestones/v11.3-phases/0113-programmatic-summary-generation/` (summary:generate proven in production) — HIGH confidence
- **PROJECT.md / INTENT.md** — v14.0 milestone requirements (DO-96 through DO-99, SC-76 through SC-79) — HIGH confidence
- **Token measurement** — All 44 workflows measured: ~66,800 total tokens, top 10 account for ~33,800 (50.6%) — HIGH confidence

---
*Stack research for: v14.0 LLM Workload Reduction*
*Researched: 2026-03-16*
