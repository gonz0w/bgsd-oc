# Project Research Summary

**Project:** bGSD Plugin v14.0 — LLM Workload Reduction
**Domain:** Token optimization for AI agent orchestration — workflow compression, pre-computed document scaffolds, section-level loading
**Researched:** 2026-03-16
**Confidence:** HIGH (all recommendations validated against existing codebase infrastructure — zero new dependencies, proven patterns from v1.1 compression and v11.3 scaffold-then-fill)

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** v14.0 reduces LLM context consumption through three complementary strategies: workflow compression round 2 (top 10 workflows, 40%+ token reduction), pre-computed document scaffolds for PLAN.md and VERIFICATION.md (CLI generates 50-70% of content, LLM fills only judgment sections), and section-level workflow loading via `<!-- section: -->` markers (agents load per-step, not whole file). Zero new dependencies — all work uses existing modules (extractSectionsFromFile, cmdSummaryGenerate, estimateTokens, enricher pipeline). Total impact: ~20,000+ tokens saved per plan execution cycle.

**Recommended stack:** tokenx (bundled BPE measurement), extractSectionsFromFile (section markers), cmdSummaryGenerate pattern (scaffold-then-fill), estimateTokens (compression validation), node:sqlite PlanningCache (scaffold data), esbuild (unchanged build pipeline)

**Architecture:** Layered token reduction — workflow files get section markers + prose compression (40%+), misc.js gains `cmdScaffoldPlan()` and `cmdScaffoldVerification()` following the summary:generate pattern, enricher adds scaffold_path fields, agents write 20-40% instead of 100% of documents

**Top pitfalls:**
1. **Semantic anchor loss** — preserve all Task() calls, step names, branch markers during compression; run automated structural diff before/after
2. **Scaffold/LLM boundary bleed** — define rigid section manifests (CLI fills data, LLM fills judgment); follow summary:generate JUDGMENT_SECTIONS pattern exactly
3. **Compression regression** — add compression markers to workflow headers; build structural contract tests before round 2 begins
4. **Orphan context from section loading** — sections must be self-contained; audit cross-section dependencies before implementing extraction
5. **Diminishing returns on v1.1 workflows** — set per-workflow targets (40-60% fresh, 15-25% already-compressed); section loading provides the bigger win

**Suggested phases:**
1. **Compression Infrastructure & Baseline** — measurement tooling, structural contract tests, compression markers; prerequisite for safe compression work
2. **Workflow Compression Round 2** — top 10 workflows compressed + section markers added; 40%+ average reduction verified
3. **Scaffold Infrastructure & PLAN.md Generation** — unified scaffold interface, cmdScaffoldPlan following summary:generate pattern; 60%+ PLAN.md pre-fill
4. **VERIFICATION.md Scaffold & Enricher Integration** — cmdScaffoldVerification, enricher scaffold_path fields, workflow integration
5. **Section-Level Loading & Validation** — section-aware workflow loading in command-enricher, end-to-end validation of all compression + scaffold savings

**Confidence:** HIGH across all 4 research areas | **Gaps:** Behavioral equivalence testing for compressed workflows requires parallel execution (expensive, non-deterministic); section-level loading integration point in command-enricher.js is medium risk (changes how workflows are injected)
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

v14.0 shifts administrative writing work from LLM reasoning to deterministic CLI operations. The milestone targets three complementary token reduction strategies that compound: workflow prose compression (reducing what goes into context), document scaffolds (reducing what the LLM writes from scratch), and section-level loading (loading only what's needed per step). Together these deliver ~20,000+ tokens saved per plan execution cycle without requiring any new npm dependencies.

Research confirms the approach is architecturally sound — every component builds on proven infrastructure. The v1.1 compression round achieved 54.6% average reduction across 8 workflows; round 2 targets the remaining high-traffic workflows using the same techniques plus section markers. The v11.3 `summary:generate` command proved the scaffold-then-fill pattern (50%+ LLM writing reduction); extending it to PLAN.md and VERIFICATION.md follows the identical code pattern in `misc.js`. The `extractSectionsFromFile()` function already parses `<!-- section: -->` markers — section-level loading consumes this existing API.

The primary risk is compression quality: over-compressed workflows lose behavioral anchors that LLMs rely on (Task() calls, conditional branches, XML tags). v1.1 experienced this directly — Task() calls were dropped from verify-work.md (3→0) and plan-phase.md (5→3) during compression and had to be restored. Round 2 mitigates this by establishing structural contract tests and compression markers *before* starting compression work, not after. The secondary risk is scaffold/LLM boundary bleed — scaffolds that generate content requiring judgment produce plausible but wrong output. The `JUDGMENT_SECTIONS` pattern from `summary:generate` is the proven solution.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

Zero new dependencies. All work uses existing bundled modules and follows established patterns.

**Core technologies:**
- **tokenx (bundled)**: BPE token measurement for before/after compression proof — already integrated in `context.js`, ~4.5KB, ~96% accuracy
- **extractSectionsFromFile (features.js)**: Section-level workflow loading via `<!-- section: name -->` markers — already tested and exported since v1.1
- **cmdSummaryGenerate (misc.js)**: Scaffold-then-fill blueprint — extend same pattern to PLAN.md and VERIFICATION.md scaffolds
- **node:sqlite PlanningCache**: Cache pre-computed scaffold data for cross-invocation reuse — already in use via `planning-cache.js`
- **estimateTokens (context.js)**: Per-workflow token counting for compression measurement and regression detection

**What NOT to use:**
- Template engines (Mustache/Handlebars/EJS) — adds dependency; string interpolation sufficient
- Markdown AST parsers (remark/unified) — 200KB+ dependency; regex-based section extraction already works
- LLM-based prompt compression (LLMLingua/CompactPrompt) — adds latency, non-deterministic, risk of semantic drift
- External compression libraries (gzip/brotli) — wrong kind of compression; we need semantic token reduction
- New workflow format (YAML/JSON) — workflows are Markdown prompts consumed by LLMs; changing format breaks agent architecture

### Expected Features

**Must have — v14.0 launch (P1):**
- **Workflow compression round 2** — top 10 workflows by token count (discuss-phase ~5,100, execute-phase ~4,900, new-milestone ~4,700, execute-plan ~4,200, transition ~3,000, new-project ~2,800, audit-milestone ~2,700, quick ~2,500, resume-project ~2,200, map-codebase ~2,100) reduced by 40%+ average. Techniques: redundancy removal, prose tightening, shared block extraction, table/XML conversion
- **Pre-computed PLAN.md scaffolds** — `util:scaffold plan --populate <phase>` generates PLAN.md skeleton with frontmatter, objective, task structure, requirement links from roadmap/requirements data. LLM fills only task descriptions and verification criteria. Estimated: 40-60% of planner writing work eliminated
- **Pre-computed VERIFICATION.md scaffolds** — `util:scaffold verification --populate <phase>` generates verification report with observable truths, artifact tables, requirement mapping from PLAN.md data. LLM fills only status, evidence, gap analysis. Estimated: 50-70% of verifier writing work eliminated
- **Section-level workflow loading** — `<!-- section: step_name -->` markers added to all top 10 workflows; orchestrator loads per-step instead of whole file. Reuses existing `extractSectionsFromFile()` API
- **Baseline measurement with regression detection** — `util:baseline measure --sections` captures per-section token counts; `util:baseline compare --check` fails on >10% regression

**Should have — v14.0 later phases (P2):**
- **Conditional step elision** — execute-plan.md steps gated by `<bgsd-context>` decisions (TDD, review, deviation-capture conditionally excluded). 30-50% per-invocation savings
- **Reference deduplication** — deviation rules, commit protocol, checkpoint protocol extracted to skills; 5+ workflows use `<skill:X />` instead of inline content
- **Step-level CLI pre-computation** — resume-project diagnostics, new-milestone phase detection replaced by enricher fields

**Defer — v15+ (P3):**
- Workflow-level caching (serve cached workflow when context unchanged)
- Model-aware section selection (fewer sections for more capable models)
- Dynamic context budgeting (compress more when context window is tight)
- Workflow DAG execution (parallel steps — blocked by synchronous architecture)

### Architecture Approach

Layered token reduction with three independent but compounding strategies. Workflow files get section markers for selective loading and prose compression for reduced size. CLI generates pre-filled document scaffolds (PLAN.md, VERIFICATION.md) from deterministic data sources (ROADMAP.md, REQUIREMENTS.md, git history). The enricher injects scaffold paths so agents know when pre-built scaffolds are available.

**Major components:**
1. **Compressed Workflows (MODIFIED, 10 files)** — prose tightened, redundancy removed, section markers added; 40%+ token reduction measured with tokenx
2. **ScaffoldPlan (NEW function in misc.js)** — generates PLAN.md skeleton from roadmap phase data following `cmdSummaryGenerate()` pattern; pre-fills frontmatter, objective, task structure, requirement links
3. **ScaffoldVerification (NEW function in misc.js)** — generates VERIFICATION.md from success criteria + test results; pre-fills observable truths table, artifact list, requirement mapping
4. **SectionLoader integration (MODIFIED command-enricher.js)** — adds section-filtering logic for workflow loading; adds `scaffold_plan_path` and `scaffold_verification_path` enricher fields
5. **Measurement tooling (EXISTING features.js)** — `measureAllWorkflows()` and `estimateTokens()` used for compression validation and regression detection

**Build order:** Compression infrastructure (baseline + markers) → Workflow compression (10 files) → Scaffold infrastructure (plan + verification generators) → Enricher integration (scaffold fields) → Workflow integration (plan-phase.md, verify-work.md use scaffolds) → Section loading → Validation

### Critical Pitfalls

1. **Semantic anchor loss during compression** — LLMs use Task() blocks, step numbering, conditional branches, and XML tags as behavioral anchors. v1.1 caught Task() calls dropped from verify-work.md (3→0) and plan-phase.md (5→3). Prevention: build automated structural inventory before compressing (count Task(), steps, branches per workflow); run structural diff before committing.

2. **Scaffold/LLM boundary bleed** — scaffolds that generate judgment content produce plausible but wrong output; scaffolds that leave data sections empty waste LLM tokens. Prevention: every scaffold type needs an explicit section manifest declaring each section as `data` (CLI fills) or `judgment` (LLM fills). Follow `JUDGMENT_SECTIONS` pattern from `cmdSummaryGenerate()`.

3. **Compression regression without detection** — compressed workflows are fragile; every remaining line is load-bearing. Future edits can silently break behavior. Prevention: add compression markers in workflow headers (`<!-- compressed: v2 | anchors: N steps, M Task(), K branches -->`); add `workflow:lint` structural verification to CI.

4. **Orphan context from section loading** — sections extracted from sequential workflows lose preceding context. "Use the route from Step 3" fails when Step 3 wasn't loaded. Prevention: each loadable section must be self-contained; audit cross-section dependencies; add `depends_on` metadata if needed.

5. **Diminishing returns on already-compressed workflows** — 8 of top 10 were already compressed 54.6% in v1.1. Another 40% on dense content either fails or over-compresses. Prevention: set per-workflow targets (40-60% for uncompressed discuss-phase/transition, 15-25% for v1.1-compressed); combine with section-level loading for overall target.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Compression Infrastructure & Baseline
**Rationale:** Pitfalls research strongly recommends building structural contract tests and compression markers *before* starting compression work — v1.1 learned this lesson the hard way (Task() drops caught only by manual review). Baseline measurement must capture pre-compression state.
**Delivers:** `workflow:verify-structure` or `workflow:lint` CLI command validating structural integrity (step counts, Task() counts, branch counts); compression markers retroactively added to v1.1 compressed workflows; `util:baseline measure --sections` with per-section token counts; regression detection (`--check` flag failing on >10% growth)
**Addresses:** FEATURES.md baseline measurement tooling; PITFALLS.md #3 (regression detection), #6 (insufficient testing), #7 (diminishing returns measurement)
**Avoids:** Starting compression without measurement infrastructure (tech debt trap from PITFALLS.md)

### Phase 2: Workflow Compression Round 2
**Rationale:** The biggest token reduction opportunity — ~34,200 tokens across top 10 workflows. Must happen after Phase 1 infrastructure is in place. Primary targets: discuss-phase (538L, never compressed), transition (519L, never compressed), new-milestone (505L, never compressed). Secondary: incremental gains on v1.1-compressed workflows.
**Delivers:** 10 workflows compressed with proven techniques (redundancy removal, prose tightening, shared block extraction, table/XML conversion); `<!-- section: step_name -->` markers added to all 10; structural contract tests per workflow; compression markers in headers; before/after token measurement proving 40%+ average
**Uses:** tokenx for measurement (STACK.md); extractSectionsFromFile for section validation (STACK.md); compression techniques proven in v1.1 (PITFALLS.md v1.1 lessons)
**Avoids:** PITFALLS.md #1 (semantic anchor loss — structural inventory check), #7 (diminishing returns — per-workflow targets set)

### Phase 3: Scaffold Infrastructure & PLAN.md Generation
**Rationale:** The scaffold-then-fill pattern is proven by `summary:generate` (50%+ writing reduction). PLAN.md scaffold is the highest-value document scaffold because every plan execution starts with planner writing PLAN.md from scratch. Can start in parallel with Phases 1-2 (different files, no overlap).
**Delivers:** Unified scaffold interface design (consistent across all scaffold types); `cmdScaffoldPlan()` in misc.js generating PLAN.md skeleton from roadmap/requirements data; `util:scaffold plan --populate <phase>` CLI command; merge/preserve for re-runs; exclusive-create safety; frontmatter, objective, task structure, requirement links pre-filled (60%+ content)
**Uses:** cmdSummaryGenerate pattern (STACK.md); getRoadmapPhaseInternal, extractFrontmatter, findPhaseInternal (ARCHITECTURE.md data sources)
**Implements:** ARCHITECTURE.md Pattern 1 (scaffold-then-fill); ARCHITECTURE.md scaffold specification for PLAN.md
**Avoids:** PITFALLS.md #2 (boundary bleed — section manifest with data/judgment labels), #5 (staleness — generate just-in-time), #8 (inconsistent interface — unified design first)

### Phase 4: VERIFICATION.md Scaffold & Enricher Integration
**Rationale:** VERIFICATION.md scaffold logically follows PLAN.md scaffold — it derives from plan content (success criteria, file lists, requirements). The scaffold generator already has parsed data from Phase 3. Enricher integration wires scaffolds into the agent pipeline so agents discover pre-built scaffolds automatically.
**Delivers:** `cmdScaffoldVerification()` in misc.js generating VERIFICATION.md from success criteria + test results; `util:scaffold verification --populate <phase>` CLI command; enricher `scaffold_plan_path` and `scaffold_verification_path` fields; `plan-phase.md` updated to generate scaffold before planner spawn; `verify-work.md` updated to generate scaffold before verifier spawn
**Uses:** PLAN.md success_criteria parser (existing); ROADMAP.md phase data (existing); enricher pipeline (ARCHITECTURE.md)
**Avoids:** PITFALLS.md #9 (init/scaffold data overlap — scaffold references init data by section), #4 (stale scaffolds — generate just-in-time in workflow step)

### Phase 5: Section-Level Loading & End-to-End Validation
**Rationale:** Section-level loading requires section markers (added in Phase 2) and is the integration layer that ties compression + scaffolds together. End-to-end validation of all compression + scaffold savings proves the milestone's token reduction targets (SC-76 through SC-79).
**Delivers:** Section-aware workflow loading in command-enricher.js (load per-step instead of full file); self-containment audit of all extractable sections; end-to-end token measurement proving cumulative savings; behavioral equivalence testing for critical workflows (execute-plan, execute-phase, verify-work)
**Implements:** ARCHITECTURE.md Pattern 2 (section-marked workflows with selective loading); FEATURES.md conditional step elision (P2, if time permits)
**Avoids:** PITFALLS.md #4 (orphan context — self-containment audit), #10 (XML tag attention — tag attention verified during behavioral testing)

### Phase Ordering Rationale

- **Phase 1 first:** Measurement infrastructure and structural tests are prerequisites for safe compression. v1.1 proved that compression without automated verification catches regressions too late.
- **Phase 2 second:** Workflow compression is the highest-impact single change (~13,700 tokens saved per session). Must happen after infrastructure but before section loading depends on markers.
- **Phases 3-4 can parallel with 1-2:** Scaffold work touches different files (misc.js, verify.js) than compression work (workflows/*.md). No code overlap.
- **Phase 4 after Phase 3:** Verification scaffold derives from plan scaffold infrastructure. Enricher integration needs both scaffold types to exist.
- **Phase 5 last:** Section-level loading requires markers from Phase 2. End-to-end validation requires all components working together.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Per-workflow compression targets need calibration after baseline measurement — the 40%+ average target may need adjustment based on actual v1.1-compressed workflow density
- **Phase 5:** `command-enricher.js` section-filtering integration is medium risk — changes how workflows are injected into LLM context; needs careful design to avoid breaking existing workflow loading

Phases with standard patterns (skip research-phase):
- **Phase 1:** Baseline measurement extends existing `measureAllWorkflows()`; structural tests are straightforward CLI additions
- **Phase 3:** Follows `cmdSummaryGenerate()` implementation pattern exactly; data sources (roadmap parser, requirements parser) already exist
- **Phase 4:** Extends Phase 3 pattern; enricher field addition is a proven low-risk change
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all modules verified in existing codebase; tokenx, extractSectionsFromFile, cmdSummaryGenerate all battle-tested |
| Features | HIGH | Feature landscape grounded in measured token counts (44 workflows, ~66,800 total tokens); compression targets validated against v1.1 results; scaffold estimates based on summary:generate measured reduction |
| Architecture | HIGH | All integration points mapped to existing modules; data flow verified against current enricher/scaffold/section-extraction code paths; build order respects actual file dependencies |
| Pitfalls | HIGH | Top pitfalls drawn from direct v1.1 experience (Task() drops, structural verification gaps); scaffold boundary risks from summary:generate lessons; compression research (PAACE framework, Taxonomy of Prompt Defects) validates prevention strategies |

**Overall confidence:** HIGH

### Gaps to Address

- **Behavioral equivalence testing for compressed workflows** (MEDIUM confidence): Structural contract tests catch anchor loss, but don't prove behavioral equivalence. Parallel execution of original vs compressed workflows on the same task is the gold standard but is expensive and non-deterministic. Mitigation: run parallel tests on top 3 critical workflows (execute-plan, execute-phase, verify-work) during Phase 2; accept structural tests as sufficient for remaining 7.
- **Section-level loading integration in command-enricher.js** (MEDIUM confidence): The enricher currently injects full workflow content. Adding section-aware filtering changes a core injection path. The section extraction API is stable, but the integration point is new. Mitigation: implement behind a feature flag in Phase 5; fall back to full-workflow loading if section extraction fails.
- **XML tag attention with newer models** (LOW confidence): Custom XML tags (`<purpose>`, `<required_reading>`) may receive different attention from future model versions. Compression that preserves tags but removes surrounding context may leave non-functional structural markers. Mitigation: test tag attention during Phase 2 behavioral verification; document migration path from XML to markdown headers if needed.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- **Codebase inspection** — `src/commands/misc.js` (cmdSummaryGenerate L2067-2354, cmdScaffold L1470-1534), `src/commands/features.js` (extractSectionsFromFile L1354, measureAllWorkflows L1489), `src/plugin/command-enricher.js` (enrichCommand L29), `workflows/*.md` (44 files measured) — direct source analysis
- **v1.1 compression results** — `.planning/milestones/v1.1-phases/08-workflow-reference-compression/` — 54.6% avg reduction across 8 workflows; Task() drop-and-restore incident documented
- **v11.3 scaffold results** — `.planning/milestones/v11.3-phases/0113-programmatic-summary-generation/` — summary:generate proven 50%+ LLM writing reduction
- **Token measurement** — all 44 workflows measured: ~66,800 total tokens; top 10 account for ~34,200 (51.2%)
- **PROJECT.md / INTENT.md** — v14.0 requirements DO-96 through DO-99, success criteria SC-76 through SC-79

### Secondary (MEDIUM confidence)
- **OpenDev paper** (arXiv:2603.05344v3, 2026-03-13) — adaptive context compaction, conditional prompt composition, lazy tool discovery patterns
- **CompactPrompt paper** (arXiv:2510.18043, 2025-10-20) — n-gram abbreviation, self-information scoring; benchmark results only
- **Anthropic context engineering patterns** (morphllm.com summary, 2026-02-15) — "right information at the right time", lazy loading principles
- **PAACE framework** (arXiv:2512.16970) — function-preserving compression, plan-aware context optimization for multi-step agent workflows
- **Taxonomy of Prompt Defects** (arXiv:2509.14404) — maintainability defects from over-compressed prompts

### Tertiary (LOW confidence — validate during implementation)
- **"The Anti-Prompting Guide"** (Rephrase, Mar 2026) — model evolution affecting prompt pattern effectiveness; XML tag attention degradation
- **Elliott Girard context engineering article** (2026-02-18) — "prompt engineering gets you a demo, context engineering gets you a product"
- **Semantic Prompt Compression** (Aleksapolskyi, Apr 2025) — 22% compression with 95%+ entity preservation; less applicable to structured agent prompts

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
