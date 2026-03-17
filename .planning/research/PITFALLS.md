# Pitfalls Research

**Domain:** Workflow compression round 2 + document scaffold generation for AI agent orchestration
**Researched:** 2026-03-16
**Confidence:** HIGH (based on v1.1 compression experience, existing scaffold precedent in summary:generate, and current research on prompt compression effects)

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Semantic anchor loss** — preserve all Task() calls, step names, and decision branch markers during compression; diff before/after structurally (Phase: Compression)
2. **Scaffold/LLM boundary bleed** — define rigid section ownership (CLI fills data, LLM fills judgment); never let scaffolds generate content requiring reasoning (Phase: Scaffold design)
3. **Compression regression without detection** — add behavioral contract tests comparing compressed vs original workflow outputs before deleting originals (Phase: Compression)
4. **Section-level loading creates orphan context** — agents receiving partial workflow sections lose preceding context; sections must be self-contained with local variable definitions (Phase: Section loading)
5. **Scaffold staleness after source changes** — scaffolds pre-computed from ROADMAP/PLAN data go stale when those files change; need invalidation or regenerate-on-read (Phase: Scaffold infra)
6. **Over-compression of low-frequency workflows** — diminishing returns on small workflows; focus on top 10 by token count, not all 44 (Phase: Planning)

**Tech debt traps:** compressing without token measurement, hardcoding scaffold section boundaries, duplicate compression logic across workflow types, skipping merge/preserve behavior for re-runs

**Security risks:** compressed workflows dropping security-relevant instructions; section loading skipping security preambles

**"Looks done but isn't" checks:**
- Compression: verify Task() call count matches pre-compression count per workflow
- Compression: verify decision branches (if/else/route) are preserved, not just step names
- Scaffolds: verify re-running scaffold on existing file preserves LLM-written sections
- Section loading: verify each extracted section works standalone without prior section context
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Semantic Anchor Loss During Compression

**What goes wrong:**
Aggressive prose tightening removes text that the LLM uses as behavioral anchors — specifically Task() code blocks, step numbering, conditional branch instructions ("If X, do Y; otherwise Z"), and XML-tagged sections like `<purpose>`, `<required_reading>`, `<core_principle>`. The compressed workflow reads correctly to a human but the LLM skips steps, merges distinct tasks, or ignores conditional branches because the structural markers it attends to were removed.

**Why it happens:**
v1.1 compression already caught this: Task() calls were dropped from verify-work.md (3→0) and plan-phase.md (5→3) during compression and had to be restored. Prose that looks "redundant" to a human compressor often serves as attention anchors for the LLM. The compressor (human or AI) sees "this paragraph says the same thing as the step header" and removes it, not realizing the LLM relies on both the header AND the expanded instruction to activate the behavior. Research on prompt compression (PAACE framework, arxiv 2512.16970) confirms that function-preserving compression requires explicit plan-awareness — naive text compression destroys behavioral fidelity.

**How to avoid:**
1. Define an **immutable structural inventory** before compressing each workflow: count of Task() blocks, step names/numbers, conditional branches (if/else/when), XML-tagged sections, @-references, subagent spawn points.
2. After compression, run an automated **structural diff** comparing the inventory before vs after. Any delta = regression.
3. The v1.1 structural integrity table (Task() before/after, steps preserved) is the pattern. Formalize it as a CLI verification command: `workflow:verify-structure <file>`.

**Warning signs:**
- Compressed workflow has fewer Task() blocks than original
- Step numbers in compressed version skip (1, 2, 5, 6)
- Conditional branches ("If plan has checkpoints...") replaced with unconditional instructions
- XML tags removed during "cleanup" (they're structural, not decorative)

**Phase to address:**
Compression phase — must be a pre-commit verification gate, not a post-hoc check.

---

### Pitfall 2: Scaffold/LLM Boundary Bleed

**What goes wrong:**
The scaffold pre-fills sections that require LLM judgment (accomplishments, key decisions, one-liner summaries), producing plausible but wrong content. Or conversely, the scaffold leaves data sections empty that could be deterministically computed (file lists, commit hashes, timing), forcing the LLM to waste tokens gathering data it already had. The boundary between "CLI fills this" and "LLM fills this" is unclear, leading to either over-scaffolding (scaffold generates wrong judgments) or under-scaffolding (LLM re-derives data).

**Why it happens:**
The existing `summary:generate` command demonstrates the correct pattern (it uses `JUDGMENT_SECTIONS` constant to mark sections as "TODO: LLM fills this" and pre-fills data sections from git/plan data). But new scaffolds for PLAN.md and VERIFICATION.md have different section structures and the boundaries aren't obvious. PLAN.md has both deterministic content (file paths from codebase analysis, requirement IDs from ROADMAP.md) and judgment content (task descriptions, verification criteria, objective narrative). Without explicit section-type annotation, developers will guess wrong.

**How to avoid:**
1. Every scaffold type needs an explicit **section manifest** declaring each section as `data` (CLI fills) or `judgment` (LLM fills) or `hybrid` (CLI provides data, LLM adds narrative).
2. Data sections use actual values: `"**Duration:** 12 min"`. Judgment sections use TODO markers with instructions: `"TODO: one-liner (substantive — NOT 'phase complete')"`.
3. Follow the `summary:generate` pattern exactly — it's the proven blueprint. The `JUDGMENT_SECTIONS` constant is the key design pattern.
4. Test: scaffold output should have zero ambiguous sections. Every section is either fully filled or explicitly marked TODO.

**Warning signs:**
- Scaffold output contains placeholder text that reads like real content (e.g., "Implemented core features" instead of "TODO:")
- LLM fills a section that was already pre-filled by the scaffold (wasted tokens)
- Scaffold generates different content when run twice on the same inputs (non-deterministic = judgment, not data)

**Phase to address:**
Scaffold design phase — define section manifests before implementing scaffold commands.

---

### Pitfall 3: Compression Regression Without Detection

**What goes wrong:**
A compressed workflow works initially but a later edit (adding a feature, fixing a bug, updating for a new CLI command) introduces a regression because the editor doesn't realize they're modifying a compressed workflow where every line is load-bearing. In an uncompressed workflow, there's slack — moving a paragraph doesn't break behavior. In a compressed workflow, removing one line can drop a critical instruction.

**Why it happens:**
Compressed workflows are fragile by definition. The v1.1 compression achieved 54.6% reduction — meaning ~45% of the original content was removed as "non-essential." What remains is ALL essential. Future editors (human or AI) may not realize this density and will edit compressed workflows as if they have the same slack as normal prose. The "Taxonomy of Prompt Defects" (arxiv 2509.14404) classifies this under Maintainability defects — compressed prompts resist modification because context density is too high for safe local edits.

**How to avoid:**
1. Add a **compression marker** in workflow frontmatter or header: `<!-- compressed: v2 | structural-anchors: 13 steps, 2 Task(), 3 branches -->`. This warns editors that the file is compressed and what structural elements must survive edits.
2. Create a `workflow:lint` command that validates structural integrity (step counts, Task() counts, branch counts) against the declared values in the compression marker.
3. Include workflow structural tests in the CI pipeline — `npm test` should catch structural regressions.
4. Add compression markers to the v1.1 already-compressed workflows retroactively, not just new round 2 work.

**Warning signs:**
- Workflow edit reduces step count or Task() count without explicit justification
- A workflow test passes on content matching but fails on behavioral verification
- Agent behavior changes after a "minor edit" to a workflow file

**Phase to address:**
First phase — establish the lint/marker infrastructure before doing round 2 compression. Retroactively mark v1.1 compressed workflows.

---

### Pitfall 4: Section-Level Loading Creates Orphan Context

**What goes wrong:**
Section-level workflow loading (DO-99: "workflows load only the sections relevant to their current step") extracts a section from a workflow and provides it to the agent without the preceding context. The section references variables, conventions, or assumptions established in earlier sections. The agent receives instructions like "Use the route determined in Step 3" but Step 3 wasn't loaded. Or a section says "Following the pattern above..." when "above" wasn't included.

**Why it happens:**
Workflows are written as coherent documents where later sections build on earlier ones. Extracting a section breaks the implicit context chain. The existing `extract-sections` command (v1.1) handles reference files well because those files were designed with section independence in mind (each section of checkpoints.md is self-contained). But workflow files were NOT designed for section extraction — they're sequential procedures with 13-27 steps that build on each other.

**How to avoid:**
1. **Sections must be self-contained units.** If section-level loading is implemented for workflows, each loadable section must re-declare any context it needs — no forward/backward references to other sections.
2. Consider an alternative: instead of extracting sections from workflows, create **step-scoped context injection** where the workflow stays monolithic but CLI-computed context is injected only at the relevant step (e.g., scaffold data injected at the "write PLAN.md" step, not at workflow start).
3. If section extraction is necessary, add a `depends_on` metadata field to each section listing required prior sections: `<!-- section: execution depends_on: setup, context -->`.

**Warning signs:**
- Extracted section contains phrases like "as described above," "the X from Step N," "following the same pattern"
- Agent asks clarifying questions that would be answered by the un-loaded preceding sections
- Section works in full-workflow mode but fails in isolated mode

**Phase to address:**
Section loading phase — must audit all workflows for cross-section dependencies before implementing extraction.

---

### Pitfall 5: Scaffold Staleness After Source Data Changes

**What goes wrong:**
A scaffold is generated from ROADMAP.md, PLAN.md, or other planning files, then the source file is edited (requirement added, success criterion changed, phase goal updated). The scaffold becomes stale — it reflects the old data. If the LLM fills in judgment sections on top of stale data sections, the completed document is internally inconsistent (e.g., verification report checks requirements that no longer exist).

**Why it happens:**
The `summary:generate` command avoids this because it's run once after plan execution and the source data (git commits, PLAN.md) is frozen by that point. But PLAN.md scaffolds would be generated BEFORE execution and VERIFICATION.md scaffolds BEFORE verification — both during active editing periods where source data is still changing.

**How to avoid:**
1. **Generate scaffolds at the latest possible moment** — not during planning, but at the start of execution/verification. The scaffold command reads live data at invocation time.
2. Implement **merge/preserve semantics** (like `summary:generate` already does): re-running the scaffold on an existing file refreshes data sections while preserving LLM-filled judgment sections. This makes re-generation safe.
3. Add a **freshness check**: scaffold embeds a hash of source data in frontmatter (`source_hash: abc123`). Before use, compare against current source hash. If mismatched, warn or auto-regenerate.
4. Never cache scaffolds on disk for later use. They should be generated on demand.

**Warning signs:**
- Scaffold references requirements not in current ROADMAP.md
- Verification scaffold lists success criteria that were modified after scaffold generation
- Generated PLAN.md scaffold has file paths that no longer exist

**Phase to address:**
Scaffold infrastructure phase — implement freshness checks and merge/preserve before building specific scaffold types.

---

### Pitfall 6: Testing Compressed Workflows Is Harder Than Testing Uncompressed Ones

**What goes wrong:**
The test suite validates that compressed workflows produce correct JSON output or contain expected strings, but doesn't validate behavioral equivalence. A compressed workflow passes all existing tests but produces subtly different agent behavior (steps reordered, conditional branches collapsed, error handling removed). The 1587-test suite gives false confidence.

**Why it happens:**
Workflow tests in this codebase are primarily structural (command output format, JSON fields, string presence). They don't test "does the agent following this workflow produce the same outcome as the agent following the original workflow?" — that would require E2E agent testing which is expensive and non-deterministic.

**How to avoid:**
1. Add **structural contract tests** for each workflow: `{ steps: 13, tasks: 2, branches: 3, spawns: 1, references: ['checkpoints.md'] }`. These are cheap, deterministic, and catch structural regressions.
2. For critical workflows (execute-plan, execute-phase, verify-work), do **parallel execution testing** during development: run both original and compressed versions on the same task, compare outputs. Discard the originals only after behavioral equivalence is confirmed.
3. The `context-budget` command already measures token counts per workflow. Add a `workflow:diff` command that shows structural differences between two workflow versions.

**Warning signs:**
- All tests pass but agent behavior changes after compression
- Token count reduction exceeds 50% on a workflow that was already compressed in v1.1 (suspicious — where did 50% more come from?)
- No new tests added for newly compressed workflows

**Phase to address:**
First phase — structural contract tests must exist before round 2 compression begins.

---

### Pitfall 7: Diminishing Returns on Already-Compressed Workflows

**What goes wrong:**
Round 2 targets the "top 10 workflows by token count." But 8 of those were already compressed 54.6% in v1.1. Attempting another 40% reduction on already-compressed content either: (a) fails to reach the target because the remaining content is all structural, or (b) succeeds by removing structural anchors that v1.1 carefully preserved. The 40% target (SC-76) becomes a perverse incentive to over-compress.

**Why it happens:**
The v1.1 compression was thorough: prose tightening, deduplication, selective reference loading, `--compact` init calls. The remaining content is dense. The 8 already-compressed workflows average ~1,940 tokens each. Getting another 40% would mean reducing them to ~1,164 tokens each — below the threshold where workflows can meaningfully direct agent behavior.

**How to avoid:**
1. **Measure the target correctly.** SC-76 says "Top 10 workflows measured before/after with tokenx; average reduction >= 40%." The top 10 includes 2 workflows NOT compressed in v1.1 (discuss-phase at 538 lines, transition at 519 lines). Prioritize the fresh workflows for heavy compression; target incremental gains on v1.1 workflows.
2. Set per-workflow targets: 40-60% for uncompressed workflows, 15-25% for v1.1-compressed workflows. Average across all 10 should still hit 40%.
3. Track cumulative reduction from pre-v1.1 baseline, not just round-2 reduction.
4. Consider that the biggest wins may come from section-level loading (DO-99) rather than further prose compression — loading only 30% of a workflow's sections per invocation is a 70% reduction without any text changes.

**Warning signs:**
- Round 2 compression removes content that v1.1 explicitly preserved (Task() blocks, step names)
- Per-workflow token counts drop below 800 tokens (dangerously sparse)
- Compression changes require re-adding content to fix behavioral regressions

**Phase to address:**
Planning phase — set realistic per-workflow targets before starting compression work.

---

### Pitfall 8: Scaffold Command Inconsistency Across Types

**What goes wrong:**
The system accumulates scaffold commands with inconsistent interfaces: `summary:generate` takes `(phase, plan)` args, `util:scaffold` takes `(type, --path, --phase, --name)`, and new `plan:generate` and `verify:generate` would introduce yet another pattern. Each has different merge behavior, different output formats, and different error handling. Agents and workflows calling these commands need to remember which pattern each uses.

**Why it happens:**
Scaffolds were built incrementally: `util:scaffold` was first (v1.0, simple file creation), `summary:generate` was second (v11.3, sophisticated data extraction + merge). New scaffold commands will be built by different people at different times, each solving their immediate need without unifying the interface.

**How to avoid:**
1. Define a **unified scaffold interface** before building new commands:
   - All scaffold commands: `<type>:generate <phase> [plan] [--force] [--dry-run]`
   - All return: `{ scaffolded: true, path, sections_filled, sections_todo, source_hash }`
   - All support: merge/preserve on existing files, exclusive-create for new files, `--dry-run` for preview
2. Refactor `util:scaffold` to delegate to the unified interface (or deprecate it for the scaffold types that now have dedicated generators).
3. Document the interface contract in COMMAND_HELP — all scaffold commands share the same help pattern.

**Warning signs:**
- Workflow instructions have different invocation patterns for different scaffold types
- Error messages differ between scaffold commands for the same failure mode
- One scaffold type supports `--dry-run` and another doesn't
- Merge/preserve behavior varies across scaffold types

**Phase to address:**
Scaffold infrastructure phase — unify interface before building plan:generate and verify:generate.

---

### Pitfall 9: init Context and Scaffold Data Overlap

**What goes wrong:**
The `init:*` commands already inject context (phase, plan, state, requirements, codebase stats) into workflow execution. Scaffold commands generate documents from the same data. When both are used in the same workflow, the agent receives the same data twice: once in the init JSON context and once in the scaffold output. This wastes tokens and can create conflicts if the two computations diverge (e.g., init reads fresh data but scaffold was generated earlier).

**Why it happens:**
init commands and scaffold commands are built by different mechanisms. The init system is well-established (v1.0+). Scaffolds are new. Without explicit coordination, they'll independently query the same sources (ROADMAP.md, PLAN.md, git log) and produce overlapping output.

**How to avoid:**
1. Scaffold generation should be **part of init output**, not a separate command. For example, `init:plan-phase` could include a `scaffold` field in its JSON output containing the pre-computed PLAN.md structure. This ensures single-source computation and no duplication.
2. If scaffolds remain separate commands, add a `--skip-init-fields` flag that omits data already provided by init (or rely on section marking so the LLM knows which data is authoritative).
3. Document clearly: "init provides context for reasoning; scaffold provides document structure for writing. Don't use scaffold data for reasoning or init data for document structure."

**Warning signs:**
- Agent receives phase requirements in both init JSON and scaffold VERIFICATION.md header
- Token budget calculations don't account for scaffold + init overlap
- Agent copy-pastes from init context into scaffold sections instead of using the scaffold

**Phase to address:**
Scaffold infrastructure phase — decide the relationship between init and scaffold before implementation.

---

### Pitfall 10: Compressed Workflow XML Tags Silently Ignored by New Models

**What goes wrong:**
The bGSD workflows use custom XML tags (`<purpose>`, `<required_reading>`, `<core_principle>`, `<execution_context>`) as structural delimiters. Modern LLMs (2026) are better at following direct instructions and may treat unrecognized XML tags as noise rather than structure. Compressing workflows that rely on XML tags for section boundaries may work today but break when the model is updated, or work with one model but not another.

**Why it happens:**
Research ("The Anti-Prompting Guide," Rephrase, Mar 2026) documents that prompt patterns which worked in 2023-2024 can backfire on newer models. XML-style section markers were effective when models struggled with instruction following; modern models may handle markdown headers equally well. Compression that preserves XML tags but removes their surrounding context may leave tags that the model doesn't attend to.

**How to avoid:**
1. **Test XML tag attention explicitly**: for each critical XML tag in workflows, verify the agent's behavior changes when the tag content changes. If behavior doesn't change, the tag isn't being attended to.
2. Consider migrating from XML tags to **markdown headers with explicit section labels** during compression — these are more universally supported across model families.
3. Don't remove XML tags during compression without testing. If they're load-bearing for current models, keep them. But be aware they may need updating for future models.
4. The PAACE framework (function-preserving compression) recommends preserving structural delimiters regardless of format — don't compress the skeleton.

**Warning signs:**
- Agent ignores `<purpose>` section content during execution
- Different model versions produce different step ordering from the same workflow
- Compression that removes XML tags shows no behavioral change (suggesting tags weren't load-bearing to begin with — reconsider whether to keep them)

**Phase to address:**
Compression phase — test tag attention as part of behavioral verification.
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Compress without before/after token measurement | Faster compression work | No way to prove reduction or detect regressions in future edits | Never — v1.1 proved measurement is essential |
| Hardcode scaffold section boundaries in strings | Quick scaffold implementation | Every new section or reformat requires code changes; brittle to template evolution | Never — use a section manifest data structure |
| Skip merge/preserve for scaffold re-runs | Simpler first implementation | LLM work lost on re-generation; discourages iterative scaffold+fill workflow | Never — summary:generate proved this is essential |
| Duplicate compression logic per workflow type | Each workflow compressed independently | Bug fixes need N updates; inconsistent compression quality | Only during prototyping phase; refactor before shipping |
| Compress all 44 workflows uniformly | "Complete" coverage | Small workflows have low token impact; effort wasted on 50-line files | Never — Pareto: top 10 workflows cover 80%+ of token cost |
| Test compressed workflow by reading it manually | Quick human verification | Misses structural regressions; doesn't catch subtle anchor loss | Only during development; automated tests required for CI |
| Build scaffold commands without unified interface | Ship one scaffold type quickly | Interface divergence accumulates; agents need type-specific invocation patterns | Only for the first scaffold type, with commitment to unify before the second |

## Integration Gotchas

Common mistakes when integrating compression and scaffolds into the existing system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `init:*` commands + scaffold | Scaffold output duplicates data already in init JSON output; agent receives same data twice | Scaffold references init data by section; scaffold sections marked "from init" are omitted when init context is already injected |
| `extract-sections` + compressed workflow | Extracting sections from a compressed workflow loses more context than from an uncompressed one (less redundancy = less context per section) | Either don't section-extract compressed workflows, or ensure each section has self-contained preamble |
| `context-budget` baseline + compression | New baselines don't account for v1.1 already-compressed workflows; shows misleading "0% reduction" | Take a fresh baseline before round 2; explicitly track cumulative reduction (v1.1 + v2) |
| `workflow:lint` + existing v1.1 workflows | Lint command rejects v1.1 compressed workflows that lack compression markers | Retroactively add markers to v1.1 workflows; lint command has `--add-markers` mode |
| scaffold `plan:generate` + existing manual PLAN.md | Scaffold overwrites manually written PLAN.md | Use exclusive-create (wx flag) like existing cmdScaffold; never overwrite existing files unless `--force` |
| `summary:generate` + new scaffold commands | Inconsistent API patterns between summary:generate and plan:generate/verify:generate | All scaffold commands follow same pattern: read source → build frontmatter → build body → merge if existing → output |
| Plugin `command.execute.before` hook + scaffold injection | Hook pre-injects scaffold data at workflow start but workflow generates scaffold at a later step | Scaffold data injected lazily (on demand) not eagerly (at workflow start); or scaffold generation happens in the hook and result is cached |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Scaffold reads entire ROADMAP.md + all PLAN.md files on every invocation | Noticeable latency on large projects (10+ phases, 30+ plans) | Use SQLite-cached planning data (PlanningCache) instead of re-parsing markdown; scaffold commands should be lightweight consumers of already-parsed data | >15 plan files, >500KB total planning docs |
| Token measurement via tokenx on every workflow save | Adds 50-100ms per save; annoying in tight edit loops | Measure only on explicit command (`context-budget`), not on-save hooks | Any project — latency is always noticeable |
| Section-level loading creates N file reads per workflow step | Each `extract-sections` call reads the full file, parses, extracts | Cache parsed section index per file; return sections from in-memory index | >5 section extractions per workflow execution |
| Scaffold regeneration on every init call | Scaffold computation adds to init latency (already optimized in v9.1) | Scaffold only on explicit command; init injects a flag "scaffold available" for agents to request | Any project — init is hot path |
| Running structural verification (workflow:lint) on every commit | Adds 200ms+ to git hooks for each workflow file | Run structural verification only for modified workflow files; cache structural inventories | >10 workflow files modified in a single commit |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Compressed workflow removes security-relevant instructions | Instructions like "DO NOT commit .env files," "verify no secrets in output," or "never force push to main" get compressed away as "obvious" | Security instructions are immutable anchors — add to structural inventory; never compress them |
| Section-level loading skips security preamble | If security instructions are in workflow header and only a mid-section is loaded, agent doesn't see them | Security instructions must be in EVERY loadable section, or in a permanent system-prompt layer outside workflows (already exists in AGENTS.md) |
| Scaffold generates content from user-authored ROADMAP.md without sanitization | If ROADMAP.md contains markdown injection, scaffold output inherits it | Sanitize or escape user content in scaffold data sections (already practiced in `sanitizeAgentContent`) |

None of these are high-risk for this project (internal tool, no external user data), but worth tracking for correctness.
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scaffold produces TODO markers that look like errors | User sees "TODO: one-liner" in generated SUMMARY.md and thinks something broke | Use clear marker format with context: `"TODO: [LLM fills this] one-liner (substantive — NOT 'phase complete')"` |
| Compression makes workflows unreadable to human editors | User trying to customize a workflow can't follow compressed prose | Add comments at key structural points: `<!-- ANCHOR: 13 steps, 2 Task(), 3 branches -->`; maintain readable structure even if prose is terse |
| Section-level loading produces confusing error when section doesn't exist | Agent tries `extract-sections workflow.md "execution"` but section name changed during compression | `extract-sections` already handles missing sections gracefully (returns available sections); ensure compressed workflows maintain same section names |
| Scaffold commands have inconsistent interfaces | Agent invokes `plan:generate 3` but `verify:generate` needs `--phase 3 --plan 01` | Standardize all scaffold commands: `<type>:generate <phase> [plan] [--options]` |
| Cumulative token reduction not visible | User sees "40% reduction in round 2" but doesn't know total savings from v1.1 + round 2 | Report both: "Round 2: 35% reduction. Cumulative (v1.1 + v2): 72% reduction from original baseline." |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Workflow compression:** Often missing structural contract tests — verify automated step/Task/branch count validation exists per workflow, not just manual inspection
- [ ] **Workflow compression:** Often missing compression markers in file headers — verify every compressed workflow has `<!-- compressed: vN | anchors: ... -->` metadata
- [ ] **Workflow compression:** Often missing cumulative token measurement — verify both v1.1 and v2.0 reductions are tracked and the combined number is reported
- [ ] **Workflow compression:** Often missing re-verification of v1.1 workflows — verify round 2 didn't regress the 8 already-compressed workflows
- [ ] **PLAN.md scaffold:** Often missing merge/preserve for re-runs — verify running scaffold twice on same phase doesn't duplicate or overwrite content
- [ ] **PLAN.md scaffold:** Often missing requirement-to-task mapping — verify scaffold pulls requirement IDs from ROADMAP.md and includes them in plan frontmatter
- [ ] **PLAN.md scaffold:** Often missing file path pre-computation — verify scaffold uses codebase intelligence to suggest relevant file paths per task
- [ ] **VERIFICATION.md scaffold:** Often missing test result pre-fill — verify scaffold reads cached test results and pre-populates test status
- [ ] **VERIFICATION.md scaffold:** Often missing success criteria extraction — verify scaffold parses success criteria from ROADMAP.md phase requirements
- [ ] **Section-level loading:** Often missing self-containment audit — verify each extractable section works without prior section context
- [ ] **Section-level loading:** Often missing section name stability — verify section names in compressed workflows match what agents/commands expect
- [ ] **All scaffold types:** Often missing exclusive-create safety — verify scaffolds never overwrite existing files (use `fs.openSync(path, 'wx')` pattern from cmdScaffold)
- [ ] **All scaffold types:** Often missing --dry-run mode — verify agents can preview scaffold output without writing files
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Semantic anchor loss in compressed workflow | LOW | Git revert the compression commit; re-compress with structural inventory check; diff Task()/step counts before committing |
| Scaffold generates wrong section boundaries | MEDIUM | Fix section manifest; re-run scaffold on affected files; manually verify LLM-filled sections weren't corrupted |
| Compression regression in production | MEDIUM | Run `workflow:lint` to identify which structural anchors are missing; compare with git history; restore missing anchors from original |
| Section loading breaks due to cross-references | LOW | Switch back to full-workflow loading for affected workflow; audit and fix section self-containment; re-enable section loading |
| Scaffold staleness causes inconsistent docs | LOW | Re-run scaffold with merge/preserve to regenerate data sections; LLM judgment sections preserved automatically |
| Test suite gives false confidence on compressed workflow | HIGH | Requires adding structural contract tests after the fact; may need to re-verify behavioral equivalence manually for all compressed workflows |
| Over-compressed workflow fails behaviorally | MEDIUM | Git revert to pre-compression; identify minimum viable compression level by incremental testing; re-compress with lower target |
| Scaffold/init data overlap wastes tokens | LOW | Measure with context-budget; remove overlap from scaffold or init; document which is authoritative source |
| XML tags become non-functional after model update | MEDIUM | Test each tag's behavioral impact; replace non-functional XML with markdown headers; update compression markers |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Semantic anchor loss | Compression infrastructure (first) | `workflow:verify-structure` passes for all compressed workflows; structural contract tests in CI |
| Scaffold/LLM boundary bleed | Scaffold design (scaffold phase) | Section manifest exists for each scaffold type; `data`/`judgment` labels verified |
| Compression regression | Compression infrastructure (first) | Compression markers in all compressed files; structural tests pass after every edit |
| Orphan context from section loading | Section loading phase | Each extractable section verified standalone; `depends_on` metadata if needed |
| Scaffold staleness | Scaffold infrastructure (scaffold phase) | Merge/preserve works; re-generation produces consistent results |
| Insufficient testing | All phases | Structural contract tests added before compression begins; maintained per workflow |
| Diminishing returns on v1.1 workflows | Planning phase | Per-workflow targets set; combined with section-level loading for overall token reduction |
| Scaffold command inconsistency | Scaffold infrastructure (first scaffold phase) | Unified interface documented and tested; all scaffold types follow same pattern |
| init/scaffold data overlap | Scaffold infrastructure (scaffold phase) | context-budget shows no redundant data between init and scaffold output |
| XML tag degradation | Compression phase | Tag attention verified during behavioral testing; migration path documented |
<!-- /section -->

<!-- section: v11_lessons -->
## Lessons from v1.1 Compression (Direct Experience)

The v1.1 compression (Phase 8) provides concrete data for pitfall prevention:

### What Worked
- **Before/after token measurement** with tokenx — proved 54.6% average reduction (39,426→15,542 tokens across 8 workflows)
- **Structural integrity table** tracking Task() counts and step counts per workflow — caught regressions before shipping
- **Selective reference loading** — replacing 782-line unconditional loads with conditional `extract-sections` calls
- **Prose tightening** — "AI agents don't need persuasion" is a reliable compression heuristic
- **Deduplication** — new-project.md had identical Round 2 questions in auto/interactive modes (72.5% reduction)

### What Went Wrong
- **Task() calls dropped during compression** of verify-work.md (3→0) and plan-phase.md (5→3) — caught during review, had to be restored (deviation logged in 08-02-SUMMARY.md)
- **Merged steps that appeared redundant** in quick.md — Steps 3+4 were not identical (mkdir + context check), behavior differed
- **No automated structural verification** — relied entirely on manual counting; should have been a CLI command

### What to Do Differently in Round 2
1. Build `workflow:verify-structure` or `workflow:lint` **before** starting compression
2. Add compression markers **during** compression, not retroactively
3. Run parallel execution on at least the top 3 workflows to confirm behavioral equivalence
4. Track cumulative reduction: v1.1 reduced 8 workflows from ~39K to ~15.5K tokens; round 2 measures against the original pre-v1.1 baseline
5. Set realistic per-workflow targets: 40-60% for fresh workflows, 15-25% for already-compressed ones
6. The biggest remaining workflows (discuss-phase 538 lines, transition 519 lines, new-milestone 505 lines) were NOT compressed in v1.1 — these are the primary round 2 targets

### Existing Scaffold Precedents
The `summary:generate` command (src/commands/misc.js:2067-2350) established patterns:
- `JUDGMENT_SECTIONS` constant marking LLM-only sections
- Merge/preserve: re-running on existing SUMMARY.md preserves LLM-filled sections while refreshing data sections
- Frontmatter auto-generation from git and plan data
- 50%+ LLM writing reduction measured and verified
- `cmdScaffold` (src/commands/misc.js:1468-1535) established the exclusive-create (wx) safety pattern
<!-- /section -->

<!-- section: sources -->
## Sources

- **Direct experience:** v1.1 Phase 8 compression (08-02-SUMMARY.md, 08-VERIFICATION.md) — 54.6% reduction, Task() drop-and-restore incident, structural integrity verification pattern
- **Direct experience:** `summary:generate` scaffold implementation (src/commands/misc.js:2067-2350) — JUDGMENT_SECTIONS pattern, merge/preserve behavior, 50%+ LLM writing reduction
- **Direct experience:** `cmdScaffold` implementation (src/commands/misc.js:1468-1535) — exclusive-create (wx) pattern, scaffold type registry
- **Direct experience:** Workflow file analysis — 44 workflows totaling ~8,750 lines; top 14 by line count identified; 8 already compressed in v1.1
- **Research:** PAACE: Plan-Aware Automated Agent Context Engineering Framework (arxiv 2512.16970) — function-preserving compression, plan-aware context optimization for multi-step agent workflows
- **Research:** "A Taxonomy of Prompt Defects in LLM Systems" (arxiv 2509.14404) — 6-dimension defect classification; Maintainability defects from over-compressed prompts
- **Research:** "Prompt Compression for LLMs: Cutting Tokens Without Breaking Reasoning" (Yahia Mohamed, Feb 2026) — compression techniques taxonomy, reasoning preservation techniques
- **Research:** "Prompt Compression: How to Reduce Context Size Without Losing Quality" (MasterPrompting.net, Feb 2026) — lost-in-the-middle effect, attention degradation on long contexts
- **Research:** "The Anti-Prompting Guide: 12 Prompt Patterns That Used to Work" (Rephrase, Mar 2026) — model evolution affecting prompt pattern effectiveness
- **Research:** "How to Automate Workflows with Prompt Templates" (Rephrase, Mar 2026) — prompt templates as workflow code; parameterized, versioned, tested patterns
- **Research:** "Semantic Prompt Compression" (Aleksapolskyi, Apr 2025) — 22% compression with 95%+ entity/term preservation; tuned for human-generated text, less applicable to structured agent prompts

---
*Pitfalls research for: Workflow compression round 2 + document scaffold generation (v14.0)*
*Researched: 2026-03-16*
