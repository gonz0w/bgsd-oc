# Feature Landscape: Context Reduction for LLM-Driven CLI Tools

**Domain:** Context/token reduction in AI-assisted development workflows
**Researched:** 2026-02-22
**Overall confidence:** HIGH

## Research Context

The GSD plugin orchestrates LLM-driven project planning through 43 workflow files (325K chars / ~81K tokens), 13 reference docs (91K chars / ~23K tokens), and 14 templates (118K chars / ~30K tokens). These markdown prompts, combined with planning doc reads (PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md) and CLI JSON output, constitute the primary context burden.

**Key insight from research:** The problem is not that the LLM context window is too small (200K tokens is generous). The problem is that **wasted tokens degrade output quality** even when within limits. JetBrains Research (Dec 2025) showed that growing context "quickly turns into noise instead of useful information" — agents with managed context consistently outperform those with raw/unmanaged context. Cursor's Jan 2026 blog showed dynamic context discovery (loading on demand vs static inclusion) reduced agent tokens by 46.9% in A/B testing.

**Ecosystem patterns observed:**
- **Cursor:** Dynamic context discovery (files over static injection), observation masking, lazy MCP tool loading, summarization with history file backup
- **Claude Code/OpenCode/Codex CLI:** Conversation compaction via LLM summarization at ~85-95% capacity, tool output pruning
- **LangChain:** Contextual compression retrievers, knowledge graph memory, conversation summary buffers
- **LlamaIndex:** Node postprocessors that filter irrelevant sentences, long context reordering
- **Continue.dev:** Context providers (selective per-source loading), config-driven context scoping

**What translates to GSD's architecture:** GSD is a CLI tool that produces markdown prompts and JSON outputs consumed by LLM agents. It doesn't control the LLM conversation loop. This means: **conversation compaction is out of scope** (the host tool handles that). GSD's leverage is in **what gets loaded into context** and **how much data flows through each interaction**.

---

## Table Stakes

Features users expect. Missing these = workflows waste context silently, the core promise of v1.1 fails.

| Feature | Why Expected | Complexity | Existing Dep | Measurability |
|---------|--------------|------------|-------------|---------------|
| **Selective section loading in doc reads** | Workflows load entire STATE.md/ROADMAP.md/REQUIREMENTS.md when they only need specific sections (e.g., execute-phase only needs current phase + decisions, not full history). Every context-aware tool (Cursor, Continue.dev) loads selectively. The `init` commands already partially do this by returning JSON fields, but the workflows themselves instruct agents to "Read STATE.md" which loads the whole file. | MEDIUM | Builds on existing `init` command pattern and `safeReadFile()` in `helpers.js`. Needs section-extraction helpers in parsing. | Before/after: measure token count of `init execute-phase` output vs full STATE.md read. Target: 40-60% reduction in doc-reading tokens for typical workflows. |
| **Output field projection (--fields flag)** | CLI commands return full JSON objects. An `init progress` call returns 20+ fields when the workflow only uses 5-8 of them. Unused fields are noise that consume tokens and can confuse the LLM (JetBrains research: "agent contexts grow so rapidly they become very expensive, yet do not deliver better performance"). LangChain's retrieval pipelines always project/filter before injection. | LOW | Builds on existing `output()` function in `src/lib/output.js`. Simple: filter JSON keys before serialization. | Before/after: measure JSON output sizes for top 5 `init` commands with typical field usage. Target: 30-50% reduction in CLI output tokens. |
| **Workflow prompt compression (reduce static boilerplate)** | The largest workflow (`new-project.md`) is 33K chars (~8K tokens) — 4% of a 200K context window just for instructions. 43 workflows total 325K chars (~81K tokens). Much of this is repeated boilerplate (error handling patterns, commit instructions, git integration steps) that could be extracted into shared references loaded on demand. Cursor's "dynamic context discovery" principle: provide minimal static context, let agent pull details when needed. | HIGH | Depends on workflow file structure. Some boilerplate already extracted to `references/`. Needs audit of shared patterns across workflows. | Before/after: total chars of top 10 workflows. Target: 25-35% reduction in workflow prompt sizes. |
| **Token counting and reporting** | The existing `context-budget` command estimates tokens with a crude `lines * 4` heuristic. Real token counting (chars/4 is ~20% off for code-heavy content) is needed for before/after benchmarking. Without accurate measurement, we can't prove the 30% target. Claude's API provides token usage; locally we need a reliable estimation. | LOW | Builds on existing `cmdContextBudget()` in `features.js`. Replace `lines * 4` with `Math.ceil(chars / 3.5)` (closer to cl100k_base average). | Self-validating: the tool measures itself. Run against all workflows/templates/references to establish baseline. |

---

## Differentiators

Features that set GSD apart from other LLM CLI tools. Not expected but significantly improve context efficiency.

| Feature | Value Proposition | Complexity | Existing Dep | Measurability |
|---------|-------------------|------------|-------------|---------------|
| **Per-workflow context manifests** | Each workflow declares exactly what context it needs: which STATE.md sections, which config keys, which reference docs. The `init` command reads the manifest and returns only those sections. This is the GSD equivalent of Cursor's dynamic context discovery — but declarative and auditable. No other CLI planning tool does this. | HIGH | Extends `init` command pattern. Each workflow already has a `<required_reading>` tag; this makes it machine-readable. Needs manifest schema in `constants.js`, parser in `init.js`. | Measurable per-workflow: declared context vs total available context. Target: average workflow loads <40% of total available context. |
| **Research output summarization tiers** | Research outputs (FEATURES.md, STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md) are consumed by downstream agents (roadmapper, planner). Currently all 5 files are loaded in full. Add tiered output: full version for humans, condensed version (executive summary + key decisions only) for agent consumption. Similar to LlamaIndex's node postprocessors that filter irrelevant content before injection. | MEDIUM | Builds on existing research template structure. Each file already has a summary section. Needs a `--compact` flag on research output reads or a generated `.compact.md` variant. | Before/after: total research output chars loaded by roadmapper/planner agents. Target: 50-70% reduction for agent consumption (full files still available for human review). |
| **Incremental context loading for multi-step workflows** | Long workflows (execute-phase: 529 lines, plan-phase: 455 lines) front-load all instructions. Restructure so step N's instructions are loaded only when step N begins. The agent reads the workflow header + current step, not the entire workflow. Mirrors Cursor's Agent Skills pattern: name/description as static context, full instructions loaded on demand. | HIGH | Requires workflow structural changes. Could use `<step>` tags that are already present — the workflow parser could emit one step at a time. Needs protocol between CLI and workflow format. | Before/after: tokens consumed at step 1 of execute-phase workflow. Target: step 1 loads <30% of total workflow tokens. |
| **Smart diff-based context for state updates** | When STATE.md changes between workflow steps, send only the diff rather than re-reading the whole file. Similar to Cursor writing tool outputs to files and letting agents `tail`/`grep` as needed rather than injecting everything. | LOW | Builds on existing `state patch` command and `session-diff`. Git diff is already available. Needs wrapper that returns section-level diff vs full file. | Before/after: bytes transferred on state re-reads mid-workflow. Target: 80-90% reduction for incremental reads. |
| **Workflow deduplication via shared reference extraction** | Audit the 43 workflows for repeated instruction patterns (error handling, git commit format, checkpoint protocols, model resolution). Extract to `references/` and replace with single-line `<ref>` tags. Continue.dev's approach: config references that are resolved on demand. | MEDIUM | Extends existing `references/` directory pattern. Already 13 reference files exist. Needs systematic audit + refactoring of top 10 largest workflows. | Before/after: total unique chars across all workflows (deduplicated vs raw). Target: 15-25% reduction in total workflow corpus size. |
| **Context budget awareness in workflow orchestration** | Orchestrator workflows (execute-phase, new-project) that spawn subagents should calculate remaining context budget and pass it to subagents. Subagents adjust verbosity accordingly. Echoes Cursor's observation masking: keep recent context full, compress older context. | MEDIUM | Builds on existing `context-budget` command and `context_window` config. Needs budget calculation in orchestrator steps and budget parameter in subagent spawn. | Measurable: subagent context consumption with vs without budget constraints. Target: orchestrator stays under 60% context budget throughout execution. |

---

## Anti-Features

Features to explicitly NOT build for v1.1. Tempting but wrong for this architecture.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **LLM-based conversation compaction** | GSD is a CLI tool, not a conversation manager. The host (OpenCode/Claude Code) already handles conversation compaction. Building our own would duplicate effort and add massive complexity. JetBrains research showed LLM summarization is often less cost-effective than simpler observation masking. | Focus on reducing what GSD injects *into* context rather than managing the conversation itself. The host tool's compaction works better when GSD sends less noise. |
| **RAG/vector search over planning docs** | Requires embedding infrastructure (vector DB, embedding model), violates zero-dependency constraint, adds latency. Planning docs are typically <20 files, small enough for targeted section extraction. RAG's value is at 100+ documents scale. | Use section-level extraction and field projection. Markdown sections are natural chunk boundaries — parse and extract specific sections rather than embedding. |
| **LLM-based prompt compression (LLMLingua-style)** | Requires an additional LLM call to compress each prompt, adding latency and cost. The compression itself consumes tokens. Works well for large documents but our prompts are already structured markdown. | Use deterministic compression: remove boilerplate, extract shared patterns, load selectively. Zero-cost, zero-latency, reproducible. |
| **Dynamic model routing based on context size** | GSD doesn't control model selection — the host tool and user config do. Adding routing logic would conflict with the `resolve-model` system already in place. | Provide better context budget reporting so users can make informed model choices. The existing model-profile system already handles this. |
| **Token-level truncation of documents** | Dumb truncation loses context (referenced in every source reviewed). LLMs weight beginning and end of context (primacy/recency bias), so truncation in the middle causes "lost in the middle" effect. | Use section-level extraction instead. A STATE.md section boundary is a natural, meaningful truncation point. Always return complete sections, never partial ones. |
| **Caching/memoization of LLM responses** | GSD is a short-lived CLI process (<5s). There's no inter-session state to cache. The in-memory file cache already eliminates repeated file reads within a single invocation. | The existing `Map`-based file cache in `helpers.js` is sufficient. Focus on not loading unnecessary content rather than caching loaded content. |
| **Streaming/chunked output** | The CLI returns JSON over stdout. Streaming would break the JSON parsing contract that all 43 workflows depend on. It would also require massive changes to the `output()` function and every consumer. | Keep atomic JSON output. Reduce the size of what's in the JSON instead. |

---

## Feature Dependencies

```
Token counting/reporting ──→ Context budget awareness (need accurate counting first)
                         ──→ All before/after benchmarks (measurement prerequisite)

Selective section loading ──→ Per-workflow context manifests (manifests consume section loader)
                         ──→ Smart diff-based context (diff is specialized selective load)

Workflow deduplication ──→ Workflow prompt compression (dedup feeds compression)

Output field projection ──→ (independent, can ship first)

Research summarization tiers ──→ (independent, can ship first)

Incremental context loading ──→ Per-workflow context manifests (needs manifest to know what to load per step)
```

**Dependency graph summary:**
1. Token counting (foundation — measure before changing)
2. Output field projection + research tiers (independent, quick wins)
3. Selective section loading + workflow deduplication (core infrastructure)
4. Per-workflow manifests + workflow compression + incremental loading (advanced, builds on #3)
5. Context budget awareness (capstone, uses all of the above)

---

## MVP Recommendation

**Prioritize (maximum impact for minimum complexity):**

1. **Token counting/reporting** — Foundation for all measurement. LOW complexity. Ship first to establish baselines.
2. **Output field projection (`--fields`)** — LOW complexity, immediate 30-50% reduction in CLI output tokens. Every workflow benefits.
3. **Selective section loading** — MEDIUM complexity, 40-60% reduction for doc reads. Largest single-feature impact.
4. **Workflow deduplication** — MEDIUM complexity, 15-25% reduction across all workflows. Compounds with every workflow invocation.
5. **Research output summarization tiers** — MEDIUM complexity, 50-70% reduction for agent consumption of research. Especially impactful for new-project workflow which spawns 4+ research agents.

**Defer to later in milestone:**
- **Per-workflow context manifests** — HIGH complexity, requires manifest schema + parser + all 43 workflows updated. Do after selective section loading proves the pattern.
- **Incremental context loading** — HIGH complexity, requires workflow structural changes and protocol design. Do after manifests.
- **Context budget awareness** — MEDIUM complexity, but needs all other features in place first. Capstone feature.

**Defer to future milestone:**
- **Smart diff-based context** — LOW complexity per feature, but niche use case (mid-workflow state re-reads). Only matters for very long sessions.

---

## Complexity and Effort Estimates

| Feature | Complexity | Estimated Effort | Files Modified | Risk |
|---------|------------|-----------------|----------------|------|
| Token counting/reporting | LOW | 2-4 hours | `features.js`, test file | Very Low — pure measurement, no behavioral change |
| Output field projection | LOW | 4-8 hours | `output.js`, `router.js`, test file | Low — additive flag, no breaking changes |
| Selective section loading | MEDIUM | 1-2 days | `helpers.js`, `init.js`, potentially `state.js` | Medium — must not break existing full-file reads |
| Workflow deduplication | MEDIUM | 2-3 days | 10+ workflow files, 3-5 new reference files | Medium — refactoring risk, need to verify all workflows still work |
| Research summarization tiers | MEDIUM | 1-2 days | Research template, possibly `features.js` for CLI support | Low — additive, doesn't change existing output |
| Per-workflow context manifests | HIGH | 3-5 days | `constants.js`, `init.js`, all 43 workflow files | High — new schema, new parser, all workflows need manifest |
| Incremental context loading | HIGH | 3-5 days | Workflow format spec, init commands, workflow files | High — changes the fundamental agent-workflow protocol |
| Context budget awareness | MEDIUM | 1-2 days | `features.js`, orchestrator workflows | Medium — coordination logic, but builds on existing `context-budget` |

---

## Measurability Framework

**Baseline measurement (must happen first):**
```bash
# Measure workflow prompt sizes
wc -c workflows/*.md | sort -rn  # Already done: 325K chars total

# Measure reference sizes
wc -c references/*.md | sort -rn  # Already done: 91K chars total

# Measure typical CLI output sizes
node bin/gsd-tools.cjs init progress --raw 2>/dev/null | wc -c
node bin/gsd-tools.cjs init execute-phase 01 --raw 2>/dev/null | wc -c
node bin/gsd-tools.cjs roadmap analyze --raw 2>/dev/null | wc -c
```

**Per-feature measurement:**
- **Output projection:** `wc -c` of JSON output with and without `--fields`
- **Selective loading:** Token count of init output with section filtering vs full doc
- **Workflow compression:** `wc -c` of workflow files before and after dedup/compression
- **Research tiers:** `wc -c` of full vs compact research outputs

**Success criteria:** 30%+ aggregate token reduction across the "hot path" (the most frequently invoked workflows: execute-phase, execute-plan, plan-phase, progress).

---

## Sources

- JetBrains Research, "Cutting Through the Noise: Smarter Context Management for LLM-Powered Agents" (Dec 2025) — https://blog.jetbrains.com/research/2025/12/efficient-context-management/ — **HIGH confidence** (peer-reviewed, NeurIPS 2025 workshop)
- Cursor Blog, "Dynamic Context Discovery" (Jan 2026) — https://cursor.com/blog/dynamic-context-discovery — **HIGH confidence** (first-party engineering blog with A/B test results: 46.9% token reduction)
- Agenta.ai, "Top Techniques to Manage Context Lengths in LLMs" (Jul 2025) — https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms — **MEDIUM confidence** (good survey, references academic papers)
- Context Compaction Research Gist (Claude Code, Codex CLI, OpenCode, Amp) — https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f — **MEDIUM confidence** (community research, but with direct source code references)
- Continue.dev Context Providers docs — https://docs.continue.dev/customization/context-providers — **HIGH confidence** (official docs)
- LlamaIndex Node Postprocessor docs — https://docs.llamaindex.ai/en/stable/module_guides/querying/node_postprocessors/ — **HIGH confidence** (official docs)
- Claude API Compaction docs — https://platform.claude.com/docs/en/build-with-claude/compaction — **HIGH confidence** (official docs, confirms compaction is host-tool responsibility)
- Cursor Context Management docs — https://docs.cursor.com/context/management — **HIGH confidence** (official docs)
