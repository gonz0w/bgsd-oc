# Pitfalls Research

**Domain:** Context/token reduction for AI agent CLI tool pipeline (GSD plugin v1.1)
**Researched:** 2026-02-22
**Confidence:** HIGH (codebase analysis + verified industry patterns from Manus/LangChain/community)

## Critical Pitfalls

### Pitfall 1: Over-Aggressive Compression Strips Agent-Critical Information

**What goes wrong:**
Reducing token output from CLI commands (init, roadmap analyze, state-snapshot) by removing "redundant" fields causes downstream workflow prompts to silently degrade. The workflow markdown files reference specific JSON fields by name (`phase_dir`, `commit_docs`, `plans`, `incomplete_plans`). If a context-reduction pass removes a field that seems redundant from a human perspective — like `phase_slug` when `phase_name` exists — a workflow step that uses `phase_slug` for branch naming (`gsd/phase-{phase}-{slug}`) silently gets `null` and creates a branch named `gsd/phase-3-null`.

The most dangerous variant: removing fields from `init` commands that are only used by one workflow. For example, `cmdInitExecutePhase()` returns `verifier_model`, `verifier_enabled`, `branching_strategy`, `branch_name`, `milestone_version`, `milestone_name`, `milestone_slug`. Someone optimizing for "smaller JSON output" may remove `milestone_slug` because it can be derived from `milestone_name`. But the workflow expects it pre-computed — if it's missing, the LLM agent either hallucates a slug algorithm or uses `milestone_name` verbatim (with spaces and special characters) in a path.

**Why it happens:**
Context reduction is driven by token counts, not by tracing field usage through 43 workflow files. The developer sees a JSON blob with 30+ fields and removes the ones that look derivable. But derivability for a human ("I can compute the slug from the name") is not the same as derivability for an LLM agent consuming the JSON in a prompt. Agents are unreliable at computing derived values — they hallucinate algorithms.

**How to avoid:**
1. **Trace every field to its consumers before removing it.** For each init command, grep all 43 workflow `.md` files for every field name in the output JSON. Create a field→workflow matrix. Only remove fields with zero consumers.
2. **Distinguish "must-have" from "optional" fields.** Mark fields in the JSON output as core (always included) vs. extended (included only in verbose mode). Add a `--compact` flag to init commands that omits optional fields, but never omit core fields.
3. **Never remove pre-computed derived values.** If the CLI returns `milestone_slug` computed from `milestone_name`, keep it. The 12 extra tokens are cheaper than the LLM hallucinating a slugify algorithm.
4. **Test with the actual workflow prompts:** After reducing init output, run the complete `execute-phase` and `plan-phase` workflows against a real project and verify the output hasn't changed.

**Warning signs:**
- Workflow starts using `null` values where it previously had strings
- Branch names contain spaces, "null", or "undefined"
- Agent asks "I don't have the X field" during workflow execution
- Phase operations silently scope to wrong directory because a path component was removed from init output

**Phase to address:**
CLI output reduction phase. Must establish the field→consumer mapping as the first task, before any output trimming.

---

### Pitfall 2: Changing JSON Output Shape Breaks Existing Workflow Prompts

**What goes wrong:**
The 43 workflow markdown files contain hard-coded references to JSON field names from `gsd-tools.cjs` commands. They say things like "Parse JSON for: `executor_model`, `commit_docs`, `phase_dir`..." (line 22 of `execute-phase.md`). If context reduction restructures the JSON (e.g., nesting flat fields into groups: `{ models: { executor: "...", verifier: "..." }, flags: { commit_docs: true } }`) or renames fields for brevity (`phase_dir` → `dir`, `commit_docs` → `docs`), every workflow that references the old names breaks.

This is the "API contract" problem. The JSON output of each CLI command is an implicit API consumed by workflow prompts. Unlike typed APIs, these consumers can't be found by a compiler — they're inside markdown prose.

**Why it happens:**
Restructuring JSON for "cleaner" output or "reduced nesting" is a natural refactoring instinct. It feels like improving the code. But the consumers aren't code — they're LLM prompts in markdown files. The LLM reads "Parse JSON for: `executor_model`" as an instruction and looks for that exact key. Renaming it to `exec_model` doesn't cause a parse error — it causes the LLM to hallucinate a value or use null.

**How to avoid:**
1. **Treat JSON field names as a frozen public API.** v1.1 context reduction must NOT rename or restructure existing fields. Only add new compact alternatives alongside existing ones.
2. **If you must change output format, update all 43 workflow files in the same commit.** Use grep to find every reference: `grep -rn 'field_name' workflows/` for each field.
3. **Add a `--format=compact` flag** rather than changing the default output. Workflows can opt in to the new compact format when they're updated. This provides a migration path.
4. **Write snapshot tests** for the output of every `init` command. Before any context reduction, capture the current JSON output as golden files. After changes, diff against golden files to detect unintended shape changes.

**Warning signs:**
- `git diff` of a context-reduction commit shows changes in `workflows/*.md` files — this means the output shape changed and required workflow updates
- Any field rename in `src/commands/init.js` that isn't accompanied by workflow file changes
- Test passes but workflow execution fails with "I couldn't find the field..." agent messages

**Phase to address:**
Must be established as a constraint in the measurement/benchmarking phase: define the output contract before reducing. The workflow update phase (if needed) must be separate from the CLI reduction phase.

---

### Pitfall 3: Token Counting Overhead Exceeds Token Savings

**What goes wrong:**
Adding accurate token counting (for measurement, budgeting, or adaptive loading) to every CLI command introduces per-invocation overhead. The existing `cmdContextBudget()` uses a crude `Math.ceil(text.length / 4)` estimation (4 chars ≈ 1 token). Replacing this with accurate tokenizer counting (e.g., a bundled tokenizer library) adds:
- **Startup cost:** Loading a tokenizer library on every CLI invocation (the CLI is a short-lived process that starts fresh each time)
- **Runtime cost:** Tokenizing large markdown files (a 50KB ROADMAP.md = ~12,500 tokens = measurable CPU time)
- **Bundle size cost:** A tokenizer like `tiktoken` is ~2MB of WASM or JS — this would balloon the 200KB CLI bundle by 10x

For a CLI tool that runs 3-15 times per workflow invocation, adding 50-200ms per invocation for token counting means 150-3000ms of added overhead per workflow. If the context reduction saves 10,000 tokens (≈ $0.003 at Claude pricing), but the token counting adds 2 seconds of wall-clock time across invocations, you've traded invisible cost for visible latency.

**Why it happens:**
"We need to measure tokens to prove we reduced them." Accurate measurement is valuable for benchmarking but becomes a trap if baked into the hot path of every command. The measurement overhead can exceed the benefit of the reduction.

**How to avoid:**
1. **Keep the `chars/4` heuristic for runtime estimation.** It's fast (zero overhead), good enough for budget warnings (within ~20% accuracy for English text), and requires no dependencies.
2. **Use accurate token counting only in dedicated measurement commands,** not in every init command. Add a `context-measure` command that does full tokenization — this runs once for benchmarking, not on every workflow invocation.
3. **If a tokenizer must be bundled,** gate it behind lazy loading: `let tokenizer; function getTokenizer() { if (!tokenizer) tokenizer = require('./tokenizer'); return tokenizer; }`. Only pay the cost when someone actually calls `context-budget` or `context-measure`.
4. **Measure CLI invocation time before and after.** Set a budget: context reduction must not add more than 50ms per invocation. Use `time node gsd-tools.cjs init execute-phase 1 --raw` as the benchmark.
5. **Never add a runtime dependency for tokenization** — it violates the zero-dependency constraint. Use the heuristic at runtime and accurate counting only in dev/test scripts.

**Warning signs:**
- `package.json` gains a new runtime dependency for tokenization
- `gsd-tools.cjs` bundle grows from ~200KB to >500KB
- `time node gsd-tools.cjs current-timestamp --raw` takes >200ms (currently ~80-100ms)
- A workflow that previously took 5 seconds now takes 8 seconds with no functional change

**Phase to address:**
Measurement/benchmarking phase. Decide on estimation strategy (heuristic vs. accurate) before implementing. Default to heuristic at runtime, accurate for benchmarks only.

---

### Pitfall 4: Workflow Prompt Trimming Removes Agent Behavioral Instructions

**What goes wrong:**
The 43 workflow files total ~12,000+ lines of markdown. They consume significant context when loaded by the host LLM (OpenCode). An obvious context-reduction target is trimming the workflow prompts themselves — shorter instructions, fewer examples, condensed step descriptions. But workflow prompts are not documentation — they are executable instructions that control agent behavior with nuance.

Concrete example: `execute-plan.md` (485 lines) includes handling for yolo mode vs. interactive mode, context budget warnings, error recovery, checkpoint protocols, and summary generation. Removing "verbose" instructions like the yolo mode fallback ("⚠️ Proceeding with large plan (yolo mode) — {estimated_percent}% estimated context usage") seems like free tokens saved. But the LLM agent uses these exact strings as templates for its output. Removing them changes the agent's visible behavior.

The worst case: removing a `<required_reading>` reference to `references/git-integration.md` to save ~248 lines of loaded context. The agent then commits with wrong message format, wrong file staging, or triggers git operations in the wrong order.

**Why it happens:**
Workflow prompts look like verbose documentation that "could be shorter." But LLM prompts aren't documentation — their verbosity is load-bearing. Specific phrasing, examples, and edge-case handling directly control agent behavior. There's no type system or compiler to tell you which instructions are critical.

**How to avoid:**
1. **Never trim workflow prompts by removing content blindly.** Instead, identify sections that are loaded but never reached (dead code paths) and remove only those.
2. **Measure which parts of each workflow are actually executed** by adding debug markers: `debugLog('workflow', 'reached step: preflight_dependency_check')`. Trim only unreached steps.
3. **Use progressive loading instead of trimming.** Instead of loading the full 485-line `execute-plan.md` upfront, restructure workflows to load steps on demand. Steps 1-3 load first; step 4+ loads only when step 3 completes. This is an architecture change, not a content removal.
4. **Separate behavioral instructions from format examples.** Move literal output templates (like checkpoint format strings) to `references/` files that are loaded only when that step executes, not upfront.
5. **A/B test prompt changes** by running the same workflow before and after trimming and comparing the agent's output quality. If the agent starts asking more clarifying questions, it means instructions were lost.

**Warning signs:**
- Agent starts asking questions it previously handled autonomously
- Git commits use wrong message format (lost `git-integration.md` reference)
- Agent generates output without GSD UI branding (lost `ui-brand.md` reference)
- Checkpoint interactions change format or frequency
- Agent skips steps it previously performed (verification, dependency check)

**Phase to address:**
Workflow optimization phase. Must come AFTER CLI output reduction (lower-hanging fruit, lower risk) and AFTER establishing measurement baselines.

---

### Pitfall 5: Cache Invalidation Bugs When Adding Context-Aware Loading

**What goes wrong:**
v1.0 added an in-memory file cache (`Map`-based, read-only) to eliminate repeated `fs.readFileSync` calls within a single CLI invocation. v1.1 context reduction may extend this with "smart loading" — reading only parts of files, caching parsed results, or conditionally loading sections. This introduces cache coherency problems that don't exist with the simple read-once-cache-whole-file approach.

Example scenario: A new "selective section loader" reads and caches only the first 3 phases from ROADMAP.md for a compact init response. Later in the same invocation, `cmdRoadmapAnalyze()` requests the full roadmap. If it gets the cached partial instead of re-reading, it reports 3 phases instead of 7. The `safeReadFile()` cache returns stale/partial data.

Another scenario: Adding a "file freshness check" (stat mtime before reading from cache) to support workflows that modify files between CLI invocations. This makes the cache non-deterministic — the same invocation can get cached or fresh data depending on timing.

**Why it happens:**
The current cache is trivially correct: read whole file once, return cached version for subsequent reads within the same process. Any change that introduces partial reads, conditional caching, or freshness checks breaks the "trivially correct" property. In a short-lived CLI process (~2s lifespan), cache invalidation bugs manifest as one-in-ten wrong answers rather than consistent failures.

**How to avoid:**
1. **Keep the file cache as whole-file, read-once.** Don't add partial caching or freshness checking. The CLI process lives <5 seconds — stale data within a single invocation is not a real problem.
2. **Add selective loading as a layer ABOVE the cache,** not inside it. The cache stores complete file contents; a new `extractSection(filepath, sectionName)` function reads from the cache and returns a substring. Cache stays dumb, extraction stays pure.
3. **If adding context-aware loading for init commands,** compute the reduced output from the full file data (already cached). Don't skip reading the file — skip including parts of its content in the JSON output.
4. **Never add mtime-based invalidation.** A CLI that starts, reads files, and exits in 2 seconds has no staleness problem. Freshness checking adds filesystem syscalls (stat) on every cached read — overhead with no benefit.

**Warning signs:**
- Same CLI command returns different results when run twice in rapid succession
- `roadmap analyze` returns fewer phases than `ls .planning/phases/` shows
- State operations that read→modify→read-back show stale data on the second read
- Tests pass individually but fail when run as a suite (cache leaks between tests)

**Phase to address:**
CLI output reduction phase. The cache architecture decision (keep simple vs. add intelligence) must be made upfront. Recommendation: keep the v1.0 simple cache unchanged.

---

### Pitfall 6: False Economy — Reducing Per-Command Tokens While Increasing API Calls

**What goes wrong:**
Context reduction makes each CLI output smaller, but to compensate for missing data, the LLM agent makes more tool calls. Example: the `init execute-phase` command currently returns a comprehensive JSON with 30+ fields — models, config flags, phase info, plan inventory, branch names, milestone info, file paths. If context reduction strips this to 10 essential fields, the workflow must make additional calls to get the missing data:
- `config-get commit_docs`
- `config-get branching_strategy`
- `resolve-model gsd-verifier`
- Etc.

Each additional tool call costs: (1) a round-trip to the CLI (~80ms), (2) LLM context to describe the call, (3) LLM context to parse the result, (4) the output tokens of the response. Five extra tool calls can easily consume more total tokens than the 20 fields removed from the init command.

This is documented in the industry as the "context vs. calls" tradeoff. Manus's team wrote that their todo.md approach "wasted ~30% of tokens" not from the file content itself, but from the repeated read-modify-write cycle of updating it. The GSD init commands were specifically designed to frontload data to minimize round-trips (ARCHITECTURE.md documents this as the "Compound Init" pattern).

**Why it happens:**
Token counting is done per-output but not per-workflow. A developer sees "this init command returns 800 tokens of JSON" and reduces it to 400 tokens. Success! But the workflow now makes 3 more CLI calls (at ~200 tokens each including the tool-call overhead), for a net increase of 200 tokens. The per-command metric improved while the per-workflow metric worsened.

**How to avoid:**
1. **Measure at the workflow level, not the command level.** A token budget must account for the total tokens consumed by a complete workflow execution (init + all subsequent commands + workflow prompt + agent output).
2. **Keep the "compound init" pattern.** The init commands exist specifically to frontload context and eliminate round-trips. Context reduction should slim the data within init commands, not remove fields that force additional calls.
3. **Use selective verbosity,** not field removal. Instead of removing fields, return them in shorter form: `plans: ["01-01-PLAN.md", "01-02-PLAN.md"]` instead of full path strings, `phase_dir: "phases/01-foundation"` instead of `".planning/phases/01-foundation"`.
4. **Count tool-call overhead.** Each CLI invocation adds ~150-200 tokens of overhead (bash code block in prompt + JSON parsing). If removing 100 tokens from init output causes one more tool call, that's a net loss.
5. **Profile a complete workflow** with the `context-budget` command before and after changes to verify net reduction.

**Warning signs:**
- After context reduction, workflow scripts show more `$(node gsd-tools.cjs ...)` calls than before
- Total execution time for a workflow increases despite smaller per-command output
- Agent output includes phrases like "Let me check..." or "I need to get..." indicating it's making additional calls to compensate for missing data
- `GSD_DEBUG=1` logs show more file reads than before the "reduction"

**Phase to address:**
Measurement phase. Establish per-workflow token baselines before any reduction. Verify net reduction at the workflow level, not command level.

---

### Pitfall 7: Context Reduction Makes Debugging Harder

**What goes wrong:**
Reduced CLI output means less information visible in agent conversation history. When a workflow fails, the debugging path is: look at what data the agent received, trace the decision back to the CLI output, identify the wrong/missing data. If the CLI output was aggressively reduced, the conversation history shows a minimal JSON blob that's hard to trace.

Specific to GSD: the `state-snapshot` command outputs the full STATE.md as structured JSON. If context reduction summarizes this to "Phase 3, 2/5 plans complete, no blockers," a debugging session trying to understand why a decision was wrong has no access to the full state — the decisions, blockers, and session history that were loaded but then compressed away.

This also affects the `session-diff` data. Currently it returns complete git log information. If reduced to "3 commits since last session," debugging a regression requires re-running the command with a verbose flag, which wasn't available when the agent initially loaded context.

**Why it happens:**
Context reduction optimizes for the happy path — the agent gets what it needs and proceeds. But debugging is the unhappy path, and it needs MORE context, not less. If the only record of what the agent saw is the reduced output, post-mortem analysis becomes impossible.

**How to avoid:**
1. **Always support a verbose/full mode alongside compact mode.** Every command that gets a compact variant must retain its full-output capability. Use `--compact` as the opt-in for reduced output, not as the default.
2. **Log full output to a debug file,** not just to stdout. When `GSD_DEBUG=1`, write the full (unreduced) JSON to `.planning/.debug/last-init.json` so it's available for post-mortem analysis even if the agent conversation only shows the compact version.
3. **Include a `_meta` field in compact output** that records what was omitted: `"_meta": { "compact": true, "omitted_fields": ["session_history", "decision_log", "blocker_details"] }`. This tells debuggers what to re-request.
4. **Never reduce STATE.md loading.** STATE.md is the project's memory — reducing it loses the debugging trail. Instead, reduce how much of it is included in agent prompts while keeping the full data available.

**Warning signs:**
- Debugging sessions require multiple "can you re-read the full file?" requests
- Agent says "I don't have enough context to diagnose this" during debugging workflows
- `.planning/` state looks correct but agent made wrong decisions (couldn't trace why because context was reduced)
- `diagnose-issues.md` workflow stops working effectively

**Phase to address:**
Should be addressed in the first phase as a design principle: "all reduction must be reversible." Establish the compact/full duality before implementing any specific reduction.

---

### Pitfall 8: Workflow Template/Reference Reduction Creates Context Confusion

**What goes wrong:**
The GSD plugin loads `references/*.md` files (13 files, ~2,500+ lines total) into agent context via `<required_reading>` blocks. These contain behavioral rules like UI branding, checkpoint formats, git commit conventions, and model profile resolution. Reducing these creates "context confusion" — the LLM receives partial instructions that contradict each other or leave gaps that it fills with hallucinated behavior.

Specific risk: `references/checkpoints.md` (776 lines) defines 3 checkpoint types (human-verify, decision, action) with specific formatting, trigger conditions, and escalation rules. Summarizing this to "use checkpoints at decision points" loses the distinction between types. The agent then uses a single generic checkpoint format, breaking the interactive experience.

Another risk: `references/ui-brand.md` (160 lines) defines banner formats, progress symbols (✅🔵⏳), and section dividers. The LLM treats these as arbitrary examples if the full context isn't loaded. Removing "redundant" examples causes the LLM to improvise similar-but-different formatting, making GSD output inconsistent.

**Why it happens:**
Reference files look like documentation — verbose, repetitive, full of examples. But LLMs learn behavior from examples far more reliably than from abstract rules. Removing examples while keeping rules is the opposite of what works for LLMs.

**How to avoid:**
1. **Don't compress reference files — make them loadable on demand instead.** Rather than a 776-line checkpoint reference loaded for every workflow, load only the checkpoint types relevant to the current step.
2. **Split reference files by usage pattern.** `checkpoints.md` → `checkpoint-human-verify.md`, `checkpoint-decision.md`, `checkpoint-action.md`. Workflows load only the ones they need. This reduces context without losing content.
3. **Keep examples, trim explanations.** If reducing, remove the "why" text and keep the "what" examples. LLMs use examples as templates more effectively than they follow abstract instructions.
4. **Measure reference file token cost per workflow.** Some workflows load all 13 references; others load 2-3. Focus reduction on the references that appear in the most workflows.

**Warning signs:**
- Agent output stops using GSD formatting (banners, symbols, section dividers)
- Checkpoint interactions become generic ("Do you approve?") instead of type-specific
- Git commits lose the `docs:` / `chore:` prefix convention
- Agent generates PLAN.md or SUMMARY.md files that don't match template structure

**Phase to address:**
Reference/template optimization phase. Should come AFTER CLI output reduction and workflow measurement, as reference loading is the second-largest context consumer after the workflow prompts themselves.

---

### Pitfall 9: Regex Pattern Changes During Output Format Optimization

**What goes wrong:**
Context reduction for CLI output may involve changing how parsed data is formatted — shorter field names, condensed progress strings, compact milestone representation. If these formatting changes touch any of the 309+ regex patterns (even indirectly), backward compatibility breaks. This is v1.0 Pitfall 3 amplified: context reduction provides motivation to change patterns that were previously stable.

Specific example: The current `cmdRoadmapAnalyze()` returns `disk_status` as full strings: `"complete"`, `"partial"`, `"planned"`, `"empty"`, `"no_directory"`. A context reduction might change these to single characters: `"C"`, `"P"`, `"L"`, `"E"`, `"N"`. This saves ~50 tokens per roadmap analysis. But if any workflow or downstream command regex-matches on the string `"complete"`, the abbreviation breaks the match.

Another example: The progress percentage display. Currently returned as `"progress_percent": 40`. If reformatted as `"progress": "40%"`, any downstream parsing that does `parseInt(result.progress_percent)` now fails because the value is a string with a `%` sign.

**Why it happens:**
Format changes feel safe because "it's just the output, not the parsing." But in a system where CLI output becomes LLM prompt input, output format IS parsing input for the next stage. The field values are matched by regex patterns in workflow prompts and by LLM pattern recognition.

**How to avoid:**
1. **Never change the TYPE of an existing JSON field** (number→string, string→array, etc.). Add new fields with new types alongside existing ones.
2. **Never abbreviate existing string values.** Add a separate compact representation if needed: `"disk_status": "complete", "disk_status_short": "C"`.
3. **Run the full test suite after ANY output format change,** even seemingly harmless ones. The test suite covers 153+ patterns that may depend on exact output format.
4. **Check workflow files for string literals** that match the value being changed: `grep -rn '"complete"' workflows/` before changing `disk_status` values.

**Warning signs:**
- Test that previously checked `disk_status === "complete"` now fails
- Workflow logs show "unknown status" or default-case behavior
- Agent reports unexpected phase status
- `progress.md` workflow routes to the wrong action

**Phase to address:**
CLI output reduction phase. Establish the rule "add new compact fields, never modify existing fields" as a hard constraint in the first planning task.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using chars/4 heuristic instead of real tokenizer | Zero overhead, zero dependencies, <20% error margin | Under-counts structured data (JSON, code blocks use more tokens per char); over-counts repeated English words | Acceptable for runtime estimation; use accurate counting only for benchmarking |
| Compacting output by removing fields rather than adding `--compact` flag | Simpler implementation, fewer code paths | Breaking change for any workflow referencing removed fields; no way to debug with full output | Never acceptable — always add opt-in compact mode |
| Reducing reference files by removing examples | Smaller context, faster workflow loading | LLMs degrade on abstract rules without examples; output format becomes inconsistent | Never acceptable — examples are load-bearing |
| Hardcoding context window size (200K) instead of making it configurable | Simpler code, one less config key | Wrong estimation when new models have different window sizes; already an issue noted in CONCERNS.md | Acceptable for v1.1 if `context_window` config key exists (already added in v1.0) |
| Measuring only command-level token savings, not workflow-level | Easy to measure, clear metric | Misses the false-economy trap of reduced commands causing more tool calls | Never acceptable — always measure at workflow level |

## Integration Gotchas

Common mistakes when adding context reduction to existing tool/workflow pipeline.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `init` commands → workflow prompts | Removing JSON fields from init output without updating workflow instructions that reference them | Trace every field to its consumers (43 workflow files) before any removal |
| `--compact` flag → output function | Adding compact mode to `output()` globally instead of per-command | Each command defines its own compact representation; `output()` only handles JSON serialization |
| Token estimation → context-budget | Bundling a tokenizer library as a runtime dependency | Keep heuristic at runtime; tokenizer only for dev-time benchmarking scripts |
| Reference file splitting → `<required_reading>` | Splitting references but not updating `<required_reading>` blocks to load the new sub-files | Update every workflow's `<required_reading>` block when splitting a reference file |
| File cache → selective section loading | Adding partial-file caching that returns incomplete data to full-file readers | Keep cache as whole-file only; add section extraction as a layer above the cache |
| Workflow prompt trimming → agent behavior | Removing "verbose" instructions that are actually behavioral templates | A/B test workflow output before and after prompt changes; never remove examples |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Token counting on every CLI invocation | CLI startup time increases 50-200ms; workflows that call CLI 5-15 times feel sluggish | Gate token counting behind dedicated command or `--measure` flag; use chars/4 heuristic otherwise | Breaks when workflow has >10 CLI calls (total overhead >1.5s) |
| Compacting JSON by removing whitespace (`JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`) | Saves ~30% bytes but LLM agents parse formatted JSON better than minified; debugging impossible | Use formatted JSON for agent output; minified only for machine-to-machine data | Breaks agent parsing reliability on complex nested objects |
| Loading all references at workflow start "just in case" | 2,500+ lines of reference content loaded for workflows that use 1-2 references | Audit which workflows load which references; reduce to only what's needed | Already breaking — this is the current state, ~30% of context may be unnecessary references |
| Re-reading entire STATE.md when only one field needed | `state load` returns everything (40+ fields parsed) when agent only needs `current_phase` | Add `state get <field>` for single-field access (already exists); prefer it in workflows | Breaks when STATE.md grows beyond ~100 lines (accumulates decisions, blockers, session history) |

## Security Mistakes

Domain-specific security issues for context reduction.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Debug dump of full context to a temp file that persists | Planning data (decisions, blockers, API keys in config) written to `/tmp/gsd-*.json` without cleanup | v1.0 added temp file cleanup on exit; ensure context-reduction debug files also get cleaned up |
| Compact mode leaks internal field names that reveal architecture | `_meta.omitted_fields` tells an observer what data exists in the system | Only include `_meta` when `GSD_DEBUG=1`, not in normal compact output |
| Token measurement logs expose prompt content | Benchmark scripts that log "token count for workflow X: {content}" to a file | Log token counts only, never the content being counted |

## UX Pitfalls

Common user experience mistakes when reducing context for AI agents.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Compact output as default, verbose as opt-in | Every existing workflow breaks on upgrade; debugging requires remembering `--verbose` flag | Compact as opt-in (`--compact`); existing behavior is default. Workflows migrate individually. |
| Reducing `progress.md` workflow output to save tokens | Progress reports become terse and unhelpful; user loses situational awareness | Progress output is user-facing, not agent-internal. Reduce agent-internal data, not user-facing reports. |
| Removing `<required_reading>` blocks to "save context" | Agent behavior degrades gradually — format inconsistencies, wrong checkpoint types, git commit style drift | Split references for selective loading; never remove the requirement to load them |
| Making context reduction configurable (50 knobs) | User overwhelmed by config options they don't understand; wrong settings cause subtle workflow degradation | Provide 2-3 presets (minimal, standard, full) with sensible defaults. Only expose individual knobs for power users. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Init output reduction:** Fields removed — verify every workflow still works by running `execute-phase` and `plan-phase` against a real project (event-pipeline)
- [ ] **Workflow prompt trimming:** Instructions shortened — run the full workflow and compare agent output format with before-trimming output. Check banners, checkpoints, commit messages.
- [ ] **Reference file splitting:** Files split into smaller pieces — verify every workflow's `<required_reading>` was updated. Run `grep -rn 'references/' workflows/` and confirm each referenced file exists.
- [ ] **Token measurement:** Benchmarks show 30% reduction — verify this is measured at the WORKFLOW level (total tokens across all CLI calls + prompt + agent output), not just individual command output.
- [ ] **Backward compatibility:** Compact mode added — verify existing behavior is UNCHANGED when `--compact` is NOT passed. Run full test suite WITHOUT the flag.
- [ ] **Debug path:** Compact output deployed — verify `GSD_DEBUG=1` still produces full output for debugging. Test that `.planning/.debug/last-init.json` captures unreduced data.
- [ ] **Help text:** New flags added (`--compact`, `--format`) — verify `--help` for affected commands documents the new options.
- [ ] **Deploy test:** `./deploy.sh && node ~/.config/opencode/get-shit-done/bin/gsd-tools.cjs init execute-phase 1 --raw` produces same output as before context reduction (unless `--compact` flag is used).

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Init output field removed, workflow breaks | LOW | Add field back to init command output. Workflow continues working. No data loss. |
| JSON output shape changed, 43 workflows affected | HIGH | Revert the output change. If already deployed, must update all 43 workflow files to match new format — or revert to old format and add new format alongside. |
| Token counting overhead visible | LOW | Remove tokenizer from runtime path, revert to chars/4 heuristic. Move accurate counting to benchmark-only scripts. |
| Workflow prompt trimmed, agent behavior degraded | MEDIUM | Revert workflow file from git. A/B test more carefully. Require side-by-side comparison for all future prompt changes. |
| Cache returns partial data | MEDIUM | Revert cache changes. Return to v1.0 whole-file cache. Add section extraction as pure function above cache. |
| False economy (more tool calls than before) | MEDIUM | Profile the workflow end-to-end. Restore fields that cause extra tool calls. Measure net tokens, not per-command tokens. |
| Debugging impossible due to compact output | LOW | Add `--verbose` flag, add debug file output, add `_meta` omission list. No data loss — just visibility loss that's easily restored. |
| Reference reduction causes inconsistent agent behavior | MEDIUM | Revert reference files from git. Split rather than summarize. Keep all examples intact. |
| Regex patterns broken by output format change | MEDIUM | `git bisect` to find the breaking change. Revert. Add golden file tests for the specific output. Re-apply change with backward compatibility. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Over-aggressive compression | Measurement phase (field→consumer mapping first) | Every init command field traced to ≥1 workflow consumer; untraced fields documented |
| JSON output shape change | CLI output reduction phase (frozen API constraint) | Snapshot tests for all init commands; `git diff` of workflows/ is empty in output-reduction commits |
| Token counting overhead | Measurement phase (decide heuristic vs. accurate) | `time node gsd-tools.cjs init execute-phase 1 --raw` stays under 200ms |
| Workflow prompt trimming | Workflow optimization phase (after CLI reduction) | Side-by-side workflow execution comparison; agent output format unchanged |
| Cache invalidation | CLI output reduction phase (architecture decision) | Cache stays whole-file read-once; no partial caching |
| False economy | Measurement phase (workflow-level baselines) | Per-workflow token count is LOWER than baseline, not just per-command |
| Debugging harder | Design phase (compact/full duality principle) | `GSD_DEBUG=1` produces full output; `.debug/` capture works |
| Reference/template reduction | Reference optimization phase (split, don't summarize) | All reference files still exist (possibly split); no removed examples; agent output format unchanged |
| Regex pattern breakage | CLI output reduction phase (add, don't modify) | Full test suite passes; existing field types/values unchanged; new compact fields added alongside |

## Sources

- Codebase analysis: `src/commands/init.js` (730 lines, 12 init commands), 43 workflow files, 13 reference files, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- `.planning/PROJECT.md` — v1.1 scope, constraints, backward compatibility rules
- Manus context engineering (Philschmid, Dec 2025): Context Rot, Context Pollution, Context Confusion terminology; "prefer compaction over summarization"; "keep toolset small" principle — https://www.philschmid.de/context-engineering-part-2
- Agenta LLM context management techniques (Jul 2025): Truncation must-have/optional distinction; compression information loss risk; RAG selective loading — https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms
- Elementor token optimization (Medium): "return structured, helpful [error] messages" to reduce retries; "more tokens ≠ better output" — https://medium.com/elementor-engineers/optimizing-token-usage-in-agent-based-assistants-ffd1822ece9c
- Speakeasy MCP token reduction: "MCP is a context hog" — dynamic toolset reduction reduced token usage 100x — https://www.speakeasy.com/blog/how-we-reduced-token-usage-by-100x-dynamic-toolsets-v2
- Stevens Online hidden economics: Quadratic token growth in multi-turn conversations; false economy of additional API calls — https://online.stevens.edu/blog/hidden-economics-ai-agents-token-costs-latency/
- Galileo tiktoken guide: "10% token count errors translate to massive budget overruns" — measurement accuracy matters for benchmarking — https://galileo.ai/blog/tiktoken-guide-production-ai
- DigitalOcean context management best practices: "Insufficient context causes AI agents to hallucinate" — the risk of over-reduction — https://docs.digitalocean.com/products/gradient-ai-platform/concepts/context-management/
- Datagrid context window optimization: "Dynamic pruning clears out outdated context automatically — pruning the wrong information can break your agent" — https://datagrid.com/blog/optimize-ai-agent-context-windows-attention

---
*Pitfalls research for: GSD Plugin v1.1 Context Reduction & Tech Debt*
*Researched: 2026-02-22*
