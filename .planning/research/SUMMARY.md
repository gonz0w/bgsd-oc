# Project Research Summary

**Project:** GSD Plugin v1.1 — Context Reduction & Tech Debt
**Domain:** Token/context optimization for AI-driven CLI workflow orchestration
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

The GSD plugin orchestrates AI-driven project planning through 43 workflow files (~81K tokens), 13 reference docs (~23K tokens), and 24+ templates (~30K tokens). Combined with planning doc reads and CLI JSON output, each workflow invocation consumes 9,000–13,000 tokens before the agent does any work. Research confirms that the problem is not context window size (200K is generous) but context noise: JetBrains Research (Dec 2025) showed that agents with managed context consistently outperform those with unmanaged context, and Cursor's A/B testing (Jan 2026) showed dynamic context loading reduced agent tokens by 46.9%. The v1.1 approach is to reduce what GSD injects into context — not to manage the conversation (that's the host tool's job).

The recommended approach is a layered reduction strategy: (1) accurate token measurement to establish baselines, (2) CLI output filtering via `--fields` and `--compact` flags, (3) selective section loading from planning docs, (4) workflow prompt compression through rewriting and reference deduplication, and (5) template tightening for smaller generated documents. The only new dependency is `tokenx` (4.5KB bundled, ~96% accuracy token estimation), replacing the broken `lines * 4` heuristic that underestimates by 20–50%. Architecture research estimates a 50–60% reduction per workflow invocation is achievable, from ~10K tokens down to ~4K–6K tokens. The 30% minimum target is conservative.

The key risks are: (1) over-aggressive field removal from init commands breaking workflow prompts that reference specific JSON keys, (2) workflow prompt trimming removing load-bearing behavioral instructions that LLMs need, (3) token counting overhead exceeding the savings it measures, and (4) reducing per-command output while inadvertently increasing tool calls (false economy). Every risk has a concrete prevention strategy: trace fields to consumers before removing, A/B test prompt changes, keep `chars/4` at runtime with accurate counting only for benchmarks, and measure at the workflow level not the command level.

## Key Findings

### Recommended Stack

The stack change for v1.1 is deliberately minimal: one new bundled dependency.

**Core technologies:**
- **tokenx 1.3.0**: Token estimation (~96% prose accuracy) — 4.5KB bundle, zero deps, replaces broken `lines * 4` heuristic that underestimates by 20–50%. Provides `estimateTokenCount()`, `isWithinTokenLimit()`, `sliceByTokens()` utilities. ESM source converted to CJS by esbuild automatically.
- **Built-in regex section extraction**: Selective markdown loading — extends existing 309+ regex patterns. No remark/unified (500KB+ AST ecosystem explicitly out of scope per PROJECT.md).
- **Built-in JSON field projection**: CLI output filtering — native destructuring, no jmespath/json-path needed for simple field selection.

**Critical version note:** Build config must change from `packages: 'external'` to selective externals (only node builtins) so tokenx gets bundled. Bundle grows from 257KB to ~262KB (negligible).

**What NOT to add:** gpt-tokenizer (1.1MB bundle for exact BPE we don't need), tiktoken WASM (complex init), remark/unified (500KB+), NLP summarization libraries (irrelevant to structured markdown), lru-cache (v1.0 decided plain Map is sufficient for short-lived CLI).

### Expected Features

**Must have (table stakes):**
- **Token counting/reporting** — foundation for all measurement; replace broken `lines * 4` with tokenx. Without accurate measurement, can't prove 30% target.
- **Output field projection (`--fields` flag)** — immediate 30–50% reduction in CLI output tokens. Every workflow benefits. Backward compatible (no-op without flag).
- **Selective section loading** — 40–60% reduction for doc reads. Workflows load entire STATE.md/ROADMAP.md when they only need specific sections.
- **Workflow prompt compression** — 30%+ reduction across 11,050 lines of workflow prompts via rewriting, deduplication, and reference inlining.

**Should have (differentiators):**
- **Per-workflow context manifests** — declarative context declarations per workflow (GSD's equivalent of Cursor's dynamic context discovery)
- **Research output summarization tiers** — full version for humans, compact version for agent consumption (50–70% reduction)
- **Workflow deduplication via shared reference extraction** — 15–25% reduction by extracting repeated patterns across 43 workflows
- **Context budget awareness in orchestrators** — orchestrators pass budget to subagents; subagents adjust verbosity

**Defer (v2+):**
- **Incremental context loading** — HIGH complexity, requires workflow structural changes and protocol design
- **Smart diff-based context** — niche use case (mid-workflow state re-reads), only matters for very long sessions
- **LLM-based conversation compaction** — host tool's responsibility (OpenCode/Claude Code already handles this)
- **RAG/vector search** — requires embedding infrastructure, violates zero-dependency constraint, planning docs are <20 files

### Architecture Approach

The architecture follows a four-layer reduction model: (1) CLI tool layer — new `src/lib/context.js` module for token estimation, enhanced `output.js` for field filtering, enhanced `helpers.js` for section extraction; (2) Workflow prompt layer — rewrite all 32 workflows for 30%+ reduction; (3) Template/reference layer — tighten templates, deduplicate references; (4) Planning doc layer — indirect benefit from smaller templates and selective loading. All changes are additive and backward compatible — without `--fields` or `--compact`, behavior is identical to current.

**Major components:**
1. **`src/lib/context.js` (NEW)** — token estimation, budget checking, section extraction utilities. ~60 lines.
2. **`src/lib/output.js` (MODIFIED)** — `output()` function gains `--fields` filtering before JSON serialization.
3. **`src/router.js` (MODIFIED)** — parses `--fields`, `--compact`, `--sections` global flags before command dispatch.
4. **`src/commands/init.js` (MODIFIED)** — all 12 init commands support `--compact` for minimal payload.
5. **`workflows/*.md` (ALL 32 REWRITTEN)** — compressed prompts, inlined relevant reference excerpts, tightened step descriptions.

### Critical Pitfalls

1. **Over-aggressive field removal breaks workflows** — Init commands return 20–30 JSON fields consumed by name in workflow prompts. Removing `milestone_slug` because it's "derivable from name" causes branch names with spaces/null. **Prevention:** Trace every field to its 43 workflow consumers before removal. Create field→consumer matrix. Never remove pre-computed derived values.

2. **Workflow prompt trimming removes behavioral instructions** — Workflow verbosity is load-bearing. Removing "obvious" instructions (yolo mode fallback, git reference) causes agents to improvise wrong behavior. **Prevention:** Rewrite for conciseness, don't delete for brevity. "Read STATE.md before any operation to load project context" → "Read STATE.md first." A/B test all prompt changes.

3. **False economy — smaller commands cause more tool calls** — Stripping init output to 10 fields forces 5 extra CLI calls (~200 tokens each including overhead), net increase of 200 tokens. **Prevention:** Measure at workflow level, not command level. Keep "compound init" pattern. Count tool-call overhead (~150–200 tokens per invocation).

4. **Token counting overhead exceeds savings** — Bundling a full tokenizer adds 1.1MB+ to a 257KB CLI. Per-invocation tokenization of 50KB files adds 50–200ms. **Prevention:** Use tokenx (4.5KB) for estimation, never full BPE tokenizer. Keep `chars/4` for ultra-fast runtime checks. Accurate counting only in benchmark scripts.

5. **Cache invalidation with selective loading** — Adding section-aware caching breaks the "trivially correct" whole-file read-once cache. **Prevention:** Keep file cache as whole-file, read-once. Add section extraction as a pure function layer ABOVE the cache. Cache stays dumb; extraction stays pure.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Token Measurement & Output Infrastructure
**Rationale:** Everything depends on measurement. The `lines * 4` heuristic underestimates by 20–50%, so current baselines are wrong. The `--fields` flag is foundational infrastructure used by every subsequent optimization. PITFALLS.md insists: measure before changing. Build the measurement tools and basic output infrastructure first.
**Delivers:** `src/lib/context.js` with tokenx integration, `--fields` flag on all commands, enhanced `context-budget` command with workflow-level estimation, baseline measurements for all 32 workflows.
**Addresses:** Token counting/reporting (table stakes), output field projection (table stakes)
**Avoids:** Pitfall 3 (token counting overhead) — uses tokenx heuristic not full BPE; Pitfall 7 (debugging harder) — establishes compact/full duality principle from day one.

### Phase 2: CLI Output Reduction — Init Command Compaction
**Rationale:** Init commands are the primary data source for workflows (12 commands, 20–30 fields each). Reducing their output directly reduces context consumption. Depends on Phase 1 for `--fields` infrastructure and measurement baselines. This is the safest reduction — additive flags, no behavioral change.
**Delivers:** `--compact` flag on all 12 init commands, field→consumer tracing matrix, measured per-command and per-workflow reduction (target: 40–50% per init command).
**Addresses:** Init command compaction (ARCHITECTURE.md Decision 6)
**Avoids:** Pitfall 1 (over-aggressive compression) — field tracing first; Pitfall 2 (JSON shape change) — frozen API, new fields alongside; Pitfall 6 (false economy) — workflow-level measurement.

### Phase 3: Workflow Prompt Compression
**Rationale:** Workflows are the single largest context consumer (11,050 lines across 32 files, loaded at start of every invocation). This phase has the highest absolute token savings. Depends on Phase 1 for measurement and Phase 2 so compressed workflows can use `--compact` init calls. This is HIGH effort but HIGH impact.
**Delivers:** All 32 workflows rewritten for 30%+ reduction, deduplicated cross-workflow instructions, inlined relevant reference excerpts, no behavioral regression.
**Addresses:** Workflow prompt compression (table stakes), workflow deduplication (differentiator)
**Avoids:** Pitfall 4 (removes behavioral instructions) — rewrite, don't delete; A/B test; Pitfall 8 (reference reduction confusion) — keep examples, trim explanations; inline don't remove.

### Phase 4: Template & Research Output Reduction
**Rationale:** Templates control the size of documents created by GSD. Smaller templates → smaller STATE.md, SUMMARY.md, PLAN.md → less context when agents read these files. Also adds `extractSections()` for selective file loading. Less urgent than workflow compression because impact is indirect.
**Delivers:** Templates produce 20–30% smaller documents, `extractSections()` for selective markdown loading, research output summarization tiers (compact for agents, full for humans).
**Addresses:** Research summarization tiers (differentiator), selective section loading (table stakes)
**Avoids:** Pitfall 5 (cache invalidation) — section extraction is a pure function above whole-file cache; Pitfall 8 (reference/template reduction) — split references, don't summarize them.

### Phase 5: Tech Debt Cleanup
**Rationale:** Independent tech debt items that don't depend on context reduction features. Can run in parallel with any phase or be deferred to the end. These are explicit v1.1 targets from PROJECT.md.
**Delivers:** Fixed `roadmap analyze` test (pre-existing failure), `--help` text for remaining 36 commands, plan template files (deferred TMPL-01 from v1.0).
**Addresses:** Tech debt items from PROJECT.md Active requirements
**Avoids:** No significant pitfalls — these are isolated fixes and additive content.

### Phase Ordering Rationale

- **Measure before changing** (Phase 1 first): PITFALLS.md and FEATURES.md both insist that token counting is the foundation. Without accurate measurement, you can't prove the 30% target or detect false economies.
- **Output infrastructure before workflow changes** (Phase 1–2 before Phase 3): Workflows need `--fields` and `--compact` flags to exist before they can be rewritten to use them.
- **CLI-side reduction before prompt-side reduction** (Phase 2 before Phase 3): CLI output reduction is lower risk (additive flags, no behavioral change) and provides immediate measurable wins. Workflow compression is higher risk (prompt changes affect agent behavior).
- **Templates after workflows** (Phase 4 after Phase 3): Template changes have indirect impact through generated documents. Workflow changes have direct impact on every invocation. Do the high-impact work first.
- **Tech debt is independent** (Phase 5 parallel): The broken test, missing help text, and plan templates don't depend on or affect context reduction.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Init Compaction):** Needs comprehensive field→workflow consumer mapping. Each of the 12 init commands must be traced through all 43 workflow files to determine which fields are core vs. optional. This is a data-gathering exercise, not a design decision.
- **Phase 3 (Workflow Compression):** Each of the 32 workflows needs individual analysis for compression opportunities. No general algorithm — each workflow is a unique prompt requiring judgment about what's essential. The top 6 workflows (new-project, complete-milestone, verify-work, execute-phase, execute-plan, plan-phase) total 3,854 lines and should be prioritized.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Token estimation library is already selected (tokenx). `--fields` implementation pattern is documented in ARCHITECTURE.md. Standard code.
- **Phase 4 (Templates):** Template tightening follows clear pattern — remove verbose examples, keep structure guidance. `extractSections()` is a well-understood regex operation.
- **Phase 5 (Tech Debt):** Isolated fixes with obvious implementations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | tokenx evaluated with actual esbuild bundling tests (4.5KB verified), accuracy compared against cl100k_base BPE on GSD-representative content (~96% prose). Build config change tested. |
| Features | HIGH | Feature landscape grounded in industry research (JetBrains, Cursor, LangChain, Continue.dev) and direct codebase measurement (325K chars workflows, 91K chars references, 20–30 fields per init command). Dependency graph and effort estimates concrete. |
| Architecture | HIGH | 5-phase build order derived from actual module dependency analysis. Data flow diagrams show specific token counts (before/after). Integration points identified at the function level with line-count estimates. |
| Pitfalls | HIGH | 9 pitfalls grounded in specific code locations, codebase patterns (309+ regex, 43 workflows, 12 init commands), and industry sources (Manus context engineering, JetBrains research). Each has concrete prevention strategy and warning signs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Field→consumer matrix not yet built:** Research identifies the need to trace every init command JSON field through 43 workflow files before any removal. This mapping doesn't exist yet — it's Phase 2's first task. Without it, any field removal is guesswork.
- **Workflow compression ROI not validated per-file:** ARCHITECTURE.md estimates 30% reduction across all 32 workflows, but actual achievable reduction varies by workflow. The top 6 by size are estimated; the remaining 26 smaller workflows may have less fat to trim.
- **tokenx accuracy for structured content:** tokenx is ~96% accurate for prose but ~80–90% for structured content (JSON, code blocks). GSD content is heavily structured. The 5% estimation error is acceptable for budgeting but may undercount structured output.
- **Incremental loading protocol undefined:** Per-workflow context manifests and incremental step loading (deferred features) would require a new protocol between the CLI and workflow format. No design exists yet — this is a future-milestone concern.
- **No automated regression testing for workflow behavior:** The research recommends A/B testing prompt changes, but there's no framework for comparing agent output quality before and after compression. This must be done manually for v1.1; automation is a v2+ concern.

## Sources

### Primary (HIGH confidence)
- Context7 `/niieani/gpt-tokenizer` — API docs, encoding imports, bundle size verification
- Context7 `/dqbd/tiktoken` — Lite mode, WASM bindings, CJS import patterns
- GitHub `johannschopplich/tokenx` — README, API docs, accuracy benchmarks (96% for prose)
- npm registry: tokenx@1.3.0, gpt-tokenizer@3.4.0, js-tiktoken@1.0.18 — Version and size verification
- Actual esbuild bundling tests — tokenx 4.5KB, gpt-tokenizer cl100k 1.1MB (verified by build)
- JetBrains Research, "Cutting Through the Noise" (Dec 2025) — Context management for LLM agents (NeurIPS 2025 workshop)
- Cursor Blog, "Dynamic Context Discovery" (Jan 2026) — 46.9% token reduction in A/B testing
- Claude API Compaction docs — Confirms compaction is host-tool responsibility
- Current codebase analysis — 15 source modules, 32 workflow files, 24+ templates, 13 references

### Secondary (MEDIUM confidence)
- Agenta.ai, "Top Techniques to Manage Context Lengths in LLMs" (Jul 2025) — Survey of reduction techniques
- Manus context engineering (Philschmid, Dec 2025) — Context Rot/Pollution/Confusion terminology
- Context Compaction Research Gist (Claude Code, Codex CLI, OpenCode, Amp) — Community research with source code references
- Elementor token optimization — Structured error messages reduce retries
- Stevens Online hidden economics — Quadratic token growth in multi-turn conversations

### Project-Specific (HIGH confidence)
- `.planning/PROJECT.md` — v1.1 scope, constraints, backward compatibility rules
- `.planning/codebase/ARCHITECTURE.md` — Module structure, dependency directions
- `.planning/codebase/CONCERNS.md` — Known issues (309 regex, 55 catches, config drift)
- Direct measurement: `wc -c workflows/*.md` (325K chars), `wc -c references/*.md` (91K chars), `wc -c templates/*.md` (118K chars)

---
*Research completed: 2026-02-22*
*Supersedes: v1.0 research summary (build/test/quality improvement)*
*Ready for roadmap: yes*
