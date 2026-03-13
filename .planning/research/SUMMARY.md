# Project Research Summary

**Project:** bGSD Plugin v11.3
**Domain:** LLM Offloading — Programmatic Decision-Making
**Researched:** 2026-03-13
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** Research identified 6 categories of deterministic decisions currently handled by LLMs that can be offloaded to code, saving an estimated ~39K tokens/session. The approach requires zero new dependencies — all capabilities exist in Node.js built-ins and existing codebase patterns. The primary risk is false determinism: decisions that appear deterministic but rely on implicit LLM context.

**Recommended stack:** Plain JS decision tables (Map/Object), weighted scoring patterns, regex classifiers (all built-in); acorn AST (bundled); valibot validation (existing dep); template literal functions (built-in). Zero new dependencies.

**Architecture:** Three-layer decision pipeline — plugin decision-engine (in-process, fastest) → CLI decisions module (subprocess, heavy compute) → simplified workflow prompts consuming pre-resolved `<bgsd-context>` JSON. Shared `decision-rules.js` consumed by both bundles via esbuild.

**Top pitfalls:**
1. **False determinism** — Apply 7-criterion rubric before each offload; if ANY critical criterion fails, keep in LLM
2. **Killing the escape hatch** — Every decision must return `{value, confidence}` with LLM fallback for LOW/null
3. **Decision tree explosion** — Use lookup tables, cap at 3 decision levels; >5 edge cases = reject candidate

**Suggested phases:**
1. Audit & Decision Framework — scan workflows, build decision catalog, establish offloading rubric
2. Core Decision Engine — build decision-rules.js, decision-engine.js, extend enrichment pipeline
3. Workflow Integration & Validation — update workflows to consume pre-computed decisions, measure savings

**Confidence:** HIGH | **Gaps:** Token savings estimates need real measurement; progressive confidence thresholds need tuning with real data
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

The v11.3 LLM Offloading milestone targets a systematic reduction of unnecessary LLM reasoning by moving deterministic decisions into programmatic code. Analysis of 44 workflow files, the plugin system (2834 lines), and the CLI router (1100+ lines) reveals that the bGSD codebase already makes significant programmatic decisions — task complexity classification, execution mode selection, deviation classification, intent classification, and convention detection. The milestone extends this proven pattern to cover 6 additional categories of decisions currently wasted on LLM token consumption.

The recommended approach is **zero new dependencies**. Every needed capability exists in Node.js built-ins (Map, RegExp, template literals), already-bundled tools (acorn), or existing dependencies (valibot). The architecture adds a thin decision engine layer to the existing plugin hook system, shared decision rules consumed by both ESM (plugin) and CJS (CLI) bundles, and extended `<bgsd-context>` enrichment — all within the existing injection pipeline. Estimated bundle impact: 12-26KB total (1-2% of current 1163KB).

The primary risks are false determinism (decisions that look deterministic but depend on implicit LLM context), regression avalanche (changing decision paths that silently break downstream workflows), and scope creep ("code can do everything" trap). These are mitigated by a strict decision criteria rubric that gates every offloading candidate, mandatory LLM fallback paths, and contract testing for every offloaded decision output format.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

Zero new production dependencies. The offloading milestone is about **code patterns, not library additions**. The codebase already contains all necessary primitives — the work is extending existing patterns to cover more decision points. Estimated total bundle increase: 12-26KB (1-2%).

**Core technologies (all already available):**
- **Decision tables (Map/Object)** — O(1) deterministic routing. Already proven in `orchestration.js` (MODEL_MAP), `autoRecovery.js` (DEVIATION_PATTERNS), `conventions.js` (NAMING_PATTERNS)
- **Weighted scoring (plain JS)** — Multi-factor classification. Already proven in `checkpointAdvisor.js` (7 factors), `orchestration.js` (5 factors)
- **Regex pattern classifiers (built-in)** — Text classification with 309+ patterns in codebase. LRU caching via `regex-cache.js`
- **Template literal functions (built-in)** — Deterministic output generation. Already proven in `format.js` formatting engine
- **valibot (existing dep)** — Pre-validation pipeline catching invalid states before LLM involvement
- **acorn (bundled)** — AST walking for workflow/code analysis. Already at ~114KB in bundle

**Explicitly avoided:** json-rules-engine (overkill for <50 decisions), Handlebars/Mustache (template engines add 50-200KB), NLP libraries (1-5MB for marginal accuracy gain), jscodeshift/ts-morph (massive, unnecessary)

### Expected Features

Analysis of 44 workflow files identified 6 offloading categories, ordered by frequency and impact:

**Must have (table stakes — P1, ~39K tokens/session savings):**
1. **State lookups & routing** — Every workflow starts with "Read STATE.md, determine position." Pure lookup. (~20K tokens/session)
2. **File path construction** — LLM constructs `.planning/phases/XX-name/XX-YY-PLAN.md` paths. Already resolved by code. (~2K tokens/session)
3. **Preflight/validation aggregation** — 3-5 sequential CLI calls parsed by LLM as shell interpreter. Single aggregated call instead. (~4.5K tokens/session)
4. **Execution plan resolution** — Plan discovery, wave analysis, mode determination. All deterministic from frontmatter. (~7K tokens/session)
5. **Plan execution pattern classification** — Pattern A/B/C from checkpoint presence. (~2K tokens/session)
6. **Auto-mode checkpoint resolution** — Deterministic lookup table when auto_advance enabled. (~400 tokens/session)

**Should have (P2 — builds on P1 foundation):**
- SUMMARY.md skeleton generation from PLAN frontmatter + git metadata
- Spawn context pre-assembly for Task() spawn parameters
- Transition state machine encoding mechanical steps (LLM keeps PROJECT.md evolution)
- Workflow step elimination for pre-computed steps
- Token savings telemetry for measurement

**Defer (v2+):**
- Full workflow code generation (LLM fills only judgment gaps)
- Autonomous plan execution for fully autonomous plans
- Predictive pre-computation (anticipate next command)

**Anti-features (keep in LLM):**
- Plan content generation (requires architectural judgment)
- Code review decisions (requires semantic understanding)
- Scope creep detection (requires domain boundary understanding)
- Deviation classification (requires understanding code impact)
- Commit message content (requires understanding intent)

### Architecture Approach

Three-layer decision pipeline extending existing infrastructure with zero new hooks or API changes. A new `decision-engine.js` module in the plugin evaluates shared rules in-process during existing hooks. A `decisions.js` module in the CLI provides subprocess access for heavier computation. Both consume `decision-rules.js` — pure functions bundled into both outputs by esbuild. Pre-computed decisions flow through the existing `<bgsd-context>` JSON injection in `command-enricher.js`.

**Major components:**
1. **`src/lib/decision-rules.js`** (NEW) — Shared rule definitions as pure functions. CJS, consumed by both bundles. ~3KB
2. **`src/plugin/decision-engine.js`** (NEW) — In-process rule evaluation against `getProjectState()`. ESM, plugin bundle. ~2KB
3. **`src/lib/decisions.js`** (NEW) — CLI-callable decision resolvers for workflow-invoked resolution. CJS, CLI bundle. ~2KB
4. **`src/plugin/command-enricher.js`** (MODIFIED) — Calls decision-engine, injects results in `<bgsd-context>`
5. **`src/plugin/context-builder.js`** (MODIFIED) — Includes decision summary in system prompt
6. **Workflows** (SIMPLIFIED) — Consume `decisions` field from `<bgsd-context>` instead of re-deriving

**Key architectural patterns:**
- **Progressive offloading (confidence-gated):** HIGH = code authoritative, MEDIUM = code suggests + LLM confirms, LOW = code provides data + LLM decides
- **Decision registry:** Central Map of rules, testable in isolation, single source of truth
- **Enrichment extension:** Zero new hooks — extend existing `enrichCommand()` with pre-resolved decisions

### Critical Pitfalls

Seven pitfalls identified, mapped to implementation phases with prevention strategies:

1. **False determinism** — Decisions that LOOK deterministic have hidden context the LLM was quietly handling. **Gate:** Apply 7-criterion rubric; if input isn't finite/enumerable or output depends on broader context, keep in LLM. **Phase:** Scan
2. **Killing the escape hatch** — Removing LLM fallback when code path is introduced. **Gate:** Every offloaded function MUST return `{value, confidence}` tuple; LOW/null routes back to LLM. **Phase:** All
3. **Decision tree explosion** — Simple offloading becomes 500-line nested conditionals. **Gate:** Use lookup tables; cap at 3 levels deep; "3-rule test" — if >3 rules needed, reconsider. **Phase:** Scan
4. **Regression avalanche** — Changing decision path silently breaks 45 downstream workflows. **Gate:** Contract tests (snapshots) for every offloaded decision output format. **Phase:** Implementation
5. **The last-20% trap** — Easy 80% is trivial; edge cases eat all savings. **Gate:** >5 known edge cases = reject candidate; time-box at 2 hours. **Phase:** Scan
6. **Over-coupling plugin to workflow text** — Parsing workflow markdown prose creates brittle contract. **Gate:** Decision parameters only from structured sources (config.json, frontmatter, STATE.md). **Phase:** All
7. **"Code can do everything" trap** — Early success creates false confidence for harder decisions. **Gate:** Explicit offloading boundary per milestone; distinguish "decisions" from "judgments." **Phase:** Scan
<!-- /section -->

<!-- section: priority_ordered_opportunities -->
## Priority-Ordered Offloading Opportunities

Consolidated from FEATURES.md categories and ARCHITECTURE.md integration analysis, ordered by (token savings × frequency) / implementation cost:

| Priority | Opportunity | Tokens Saved/Session | Frequency | Complexity | Phase |
|----------|------------|---------------------|-----------|------------|-------|
| 1 | Enhanced command enrichment (routing + paths + next-action) | ~20K | ~50/session | LOW | 2 |
| 2 | Execution plan pre-computation (waves, modes, dependencies) | ~7K | ~3/session | MEDIUM | 2 |
| 3 | Progress routing pre-computation (Route A-F with next-command) | ~5K | ~10/session | LOW | 2 |
| 4 | Preflight check aggregation (single CLI call, structured result) | ~4.5K | ~3/session | MEDIUM | 2 |
| 5 | Plan execution pattern classification (Pattern A/B/C) | ~2K | ~5/session | LOW | 2 |
| 6 | SUMMARY.md template pre-fill (frontmatter + git metadata) | ~1.5K | ~5/session | MEDIUM | 3 |
| 7 | Checkpoint auto-resolution (auto-mode lookup table) | ~400 | ~2/session | LOW | 2 |
| 8 | Spawn context pre-assembly (complete Task() params) | ~3K | ~5/session | MEDIUM | 3 |
| 9 | Transition state machine (mechanical steps only) | ~5K | ~3/session | HIGH | 3 |

**Estimated total P1 savings:** ~39K tokens/session (conservative; assumes 50-command session)
**Estimated total P1+P2 savings:** ~48.4K tokens/session

### Decision Criteria Gate

**Before implementing ANY opportunity above, apply this rubric from PITFALLS.md:**

| Criterion | Must Be True | If Not |
|-----------|-------------|--------|
| Input is finite and enumerable | YES (critical) | STOP — keep in LLM |
| Output is deterministic (same input → same output) | YES (critical) | STOP — keep in LLM |
| No natural language understanding needed | YES (critical) | STOP — keep in LLM |
| Decision logic fits in <50 lines | Preferred | Can proceed with caution |
| Edge cases are known and finite (≤5) | Preferred | Reject if >5 edge cases |
| Decision doesn't need project history | Preferred | Consider partial offload |
| Failure mode is safe (wrong = inconvenience, not data loss) | Preferred | Add extra safeguards |

All 3 critical criteria must pass. If ANY fails, the opportunity stays with the LLM regardless of token savings.
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Audit & Decision Framework
**Rationale:** Must catalog what to offload before building the engine. Research identified 6 categories but each contains individual decision points that need scoring against the criteria rubric. Also establishes the decision framework (rules, confidence model, fallback pattern) that all subsequent work builds on.
**Delivers:** Annotated catalog of offloading candidates with complexity scores, edge-case counts, and rubric pass/fail per candidate. Decision framework specification (rule format, confidence levels, fallback contract).
**Addresses:** Category 1-6 identification from FEATURES.md; decision criteria rubric from PITFALLS.md
**Avoids:** False determinism (Pitfall 4), Last-20% trap (Pitfall 3), "Code can do everything" (Pitfall 7) — by scoring candidates honestly before implementation

### Phase 2: Core Decision Engine & Enrichment
**Rationale:** Builds the shared decision infrastructure and implements the highest-value P1 offloading opportunities. Depends on Phase 1's catalog and framework. This is where token savings materialize.
**Delivers:** `decision-rules.js`, `decision-engine.js`, `decisions.js` modules. Extended `<bgsd-context>` with routing, paths, execution plans, preflight aggregation, pattern classification, and checkpoint auto-resolution. Contract tests for all output formats.
**Uses:** Decision tables (Map/Object), weighted scoring, regex classifiers (all built-in); existing plugin hooks and enrichment pipeline
**Implements:** Three-layer decision pipeline from ARCHITECTURE.md; progressive offloading (confidence-gated) pattern
**Avoids:** Decision tree explosion (Pitfall 1) — using lookup tables; Killing escape hatch (Pitfall 2) — confidence-gated fallback; Regression avalanche (Pitfall 5) — contract tests

### Phase 3: Workflow Integration & Measurement
**Rationale:** Connects the decision engine to workflows and validates real-world savings. P2 features (SUMMARY pre-fill, spawn pre-assembly, transition state machine) layer on. Without measurement, offloading claims are unverified.
**Delivers:** Simplified workflow prompts consuming `<bgsd-context>` decisions. P2 offloading features. Token savings telemetry comparing before/after. Workflow step elimination for pre-computed data.
**Addresses:** Workflow optimization target from FEATURES.md; over-coupling pitfall prevention
**Avoids:** Over-coupling plugin to workflow text (Pitfall 6) — structured data flow direction: code → `<bgsd-context>` → workflow, never reverse

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Can't build the right engine without knowing which decisions to offload. The audit prevents false determinism and scope creep.
- **Phase 2 before Phase 3:** Workflows can't consume pre-computed decisions until the decision engine exists. Infrastructure before integration.
- **Phase 3 last:** Measurement requires both the engine (Phase 2) and the workflow changes to be in place. Also, P2 features (SUMMARY pre-fill, transition state machine) are higher complexity and benefit from patterns proven in Phase 2.
- **Grouping rationale:** Phases align with the natural delivery boundaries — audit (understand), build (implement), integrate (validate). Each phase delivers independently verifiable outcomes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** May need targeted workflow file analysis to score individual decision points. The 6 categories are identified but individual candidates within each need scoring.
- **Phase 3:** Transition state machine (HIGH complexity) may need design spike to cleanly separate mechanical vs judgment steps.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Architecture is fully specified in ARCHITECTURE.md. Module placement, dependency graph, build integration, and code examples are all documented. Standard extend-existing-module work.
<!-- /section -->

<!-- section: pitfall_phase_mapping -->
## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Gate / Verification |
|---------|------------------|---------------------|
| Decision tree explosion | Phase 1 (scan) | No candidate accepted with >3 decision depth or >5 edge cases |
| Killing the LLM escape hatch | Phase 2 (implementation) | Every offloaded function has `{value, confidence}` return + fallback path; tested |
| The last-20% trap | Phase 1 (scan) | Candidates scored with edge-case count; >5 = rejected; 2-hour time-box |
| False determinism | Phase 1 (scan) | 7-criterion rubric applied; 3 critical criteria must all pass |
| Regression avalanche | Phase 2 (implementation) | Contract/snapshot tests for every offloaded decision; CI validates |
| Over-coupling to workflows | Phase 2, 3 (boundary) | Code review gate: no `.md` prose parsing in `src/` modules |
| "Code can do everything" | Phase 1 (boundary) | Candidates labeled "decision" vs "judgment"; judgment = rejected |
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies — all patterns proven in existing codebase (10+ existing decision-making modules) |
| Features | HIGH | All findings from direct analysis of 44 workflows, plugin.js, router.js — no external sources needed |
| Architecture | HIGH | Extends existing hooks, enrichment pipeline, and two-bundle build — all proven infrastructure |
| Pitfalls | HIGH | Pitfalls derived from existing codebase examples of both successful and borderline programmatic decisions |

**Overall confidence:** HIGH

### Gaps to Address

- **Token savings estimates need real measurement:** Current estimates (39K/session) are based on per-decision token counts × frequency. Actual savings depend on session composition and LLM model tokenization. Phase 3 telemetry will validate.
- **Progressive confidence thresholds need tuning:** The HIGH/MEDIUM/LOW confidence model is conceptually sound but threshold values (when to fall back to LLM) need calibration with real data across diverse project states.
- **Transition state machine complexity:** The mechanical/judgment boundary in `transition.md` needs closer analysis during Phase 3 planning. The 60% mechanical estimate may shift once individual steps are scored.
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/lib/orchestration.js` (528 lines), `src/lib/ast.js` (1186 lines), `src/lib/recovery/autoRecovery.js` (326 lines), `src/lib/recovery/checkpointAdvisor.js` (302 lines)
- Direct codebase analysis: `src/lib/nl/intent-classifier.js`, `src/lib/nl/command-registry.js`, `src/lib/conventions.js` (640+ lines)
- Direct codebase analysis: `plugin.js` (2834 lines — parsers, enricher, tools, guardrails, file watcher, idle validator, stuck detector)
- Direct codebase analysis: `src/router.js` (1100+ lines), `src/commands/init.js` (1883 lines)
- Direct analysis of 44 workflow files in `workflows/`
- `.planning/PROJECT.md` — architecture decisions, constraints, milestone goals

### Secondary (MEDIUM confidence)
- Token savings estimates — calculated from per-decision token cost × invocation frequency (needs real-world validation)
- Bundle size estimates — extrapolated from existing module sizes (actual sizes depend on esbuild optimization)

### Tertiary (LOW confidence)
- Progressive confidence threshold values — conceptual model, needs empirical tuning with real session data

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
<!-- /section -->
