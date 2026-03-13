# Pitfalls Research

**Domain:** LLM Offloading — Replacing LLM Decisions with Programmatic Code
**Researched:** 2026-03-13
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Decision tree explosion** — Start with lookup tables, not nested if/else; cap at 3 levels deep (Scan phase)
2. **Killing the escape hatch** — Every programmatic decision MUST have an LLM fallback path for unrecognized inputs (All phases)
3. **The last-20% trap** — Easy 80% is trivial; edge cases will eat all the savings. Scope offloading to truly deterministic cases only (Scan phase)
4. **Regression avalanche** — Changing a decision path can silently break 45 workflows. Add contract tests per offloaded decision (Implementation phase)
5. **False determinism** — A decision that LOOKS deterministic has hidden context the LLM was quietly handling (Scan phase)
6. **Over-coupling plugin to workflow text** — Programmatic code that parses workflow markdown creates a brittle contract (All phases)

**Tech debt traps:** Giant switch statements, regex-based decision parsing, duplicating logic between plugin and CLI

**Security risks:** Code-driven auto-resolution bypassing human-in-the-loop gates, programmatic path construction without sanitization

**"Looks done but isn't" checks:**
- Decision offloading: verify edge cases (empty input, unexpected format, null state)
- Workflow integration: verify the LLM fallback actually fires when code returns "unknown"
- Performance: verify offloaded path is actually faster than LLM (measure, don't assume)
</pitfalls_compact>
<!-- /section -->

<!-- section: decision_criteria -->
## Decision Criteria: Code vs. LLM

**Use this rubric before offloading any decision.** Score each criterion; if ANY answer is "no" on the critical row, keep it as LLM.

| Criterion | Code (Offload) | LLM (Keep) | Critical? |
|-----------|----------------|------------|-----------|
| Input is finite and enumerable | Yes — e.g., phase numbers, command names, config keys | No — free-form text, ambiguous descriptions | YES |
| Output is deterministic | Same input always produces same output | Output depends on broader context or judgment | YES |
| No natural language understanding needed | Pure data transformation, lookup, routing | Requires interpreting intent, summarizing, reasoning | YES |
| Decision logic fits in <50 lines | Simple mapping, threshold check, pattern match | Would need hundreds of lines of conditionals | No |
| Edge cases are known and finite | Can enumerate all edge cases | New edge cases appear regularly | No |
| Decision doesn't need project history | Uses only current state/config | Needs to "understand" what happened before | No |
| Failure mode is safe | Wrong answer = minor inconvenience | Wrong answer = data loss, broken state, wasted work | No |

### Concrete Examples from bGSD

**OFFLOAD (deterministic):**
- Phase number padding: `"1"` -> `"01"` (pure transformation)
- Plan file path resolution: phase + plan number -> directory path (lookup)
- Progress bar rendering: percentage -> filled/empty blocks (calculation)
- Config default resolution: key -> value from CONFIG_DEFAULTS (lookup)
- Requirement ID formatting: `"REQ-1"` -> `"REQ-01"` (pattern)
- Wave assignment from frontmatter: read `wave:` field (extraction)
- Namespace routing: `"init:state"` -> command handler (lookup table)

**KEEP AS LLM (requires reasoning):**
- "Should this task be in wave 1 or wave 2?" (dependency analysis + judgment)
- "Is this plan well-structured?" (quality assessment)
- "What's the right commit message?" (summarization)
- "Does this code change satisfy the requirement?" (semantic verification)
- "Which files are relevant to this task?" (codebase understanding)
- "Is this a bug or a feature gap?" (classification requiring context)
- "Should we escalate or auto-fix?" (risk assessment)
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Decision Tree Explosion

**What goes wrong:**
A simple "replace this LLM decision with code" turns into a 500-line nested if/else/switch monster that handles every edge case the LLM was quietly absorbing. The code becomes harder to maintain than the original prompt, takes longer to update, and introduces new bugs.

**Why it happens:**
LLMs are flexible by default — they handle edge cases, malformed input, and unexpected combinations gracefully because they "reason" about them. When you move to code, you must explicitly handle every case. Developers start with a clean `switch` statement and progressively add special cases until it's unmaintainable.

**Concrete bGSD example:**
The `classifyTaskComplexity` function in `orchestration.js` is already 80 lines of scoring logic with 7 factors. Imagine trying to codify "should this plan run sequentially or in parallel" — the current code handles 4 cases but the LLM handles dozens of nuanced situations (mixed checkpoint types, conditional parallelism, worktree availability, file overlap detection).

**How to avoid:**
- Use **lookup tables** (Map/Object) instead of decision trees — flat is better than nested
- Cap decision depth at 3 levels. If you need more, the decision isn't deterministic enough
- Use the **"3-rule test"**: if you can express the decision in 3 or fewer rules, offload it. If you need 10+ rules, keep LLM
- Extract the deterministic PART of a decision (data gathering, formatting) while keeping the judgment in LLM
- Write the code first in pseudocode; if it's hard to describe, it's hard to maintain

**Warning signs:**
- Function exceeds 50 lines of conditional logic
- `// TODO: handle edge case` comments proliferating
- Decision function requires more than 3 parameters
- Tests for the decision logic outnumber tests for actual features
- Developers avoid modifying the function because "it might break something"

**Phase to address:**
Scan phase — reject offloading candidates that would require complex decision trees. Score complexity during the audit.

---

### Pitfall 2: Killing the LLM Escape Hatch

**What goes wrong:**
Programmatic code replaces an LLM decision but provides no fallback path. When an unexpected input arrives that doesn't match any coded case, the system either crashes, returns a wrong default, or silently drops the decision. The user gets a worse experience than before.

**Why it happens:**
Developers assume they've covered all cases. The original LLM path gets removed from the workflow prompt ("we handle this in code now"). Six months later, a new input format arrives that the code doesn't handle, and there's no LLM to fall back to.

**Concrete bGSD example:**
The `selectExecutionMode` function returns `'sequential'` as a default when it can't determine the right mode. This is a safe fallback. But if you offloaded "which model to use for this task" and the code returns `null` for an unrecognized task type, the workflow would fail entirely — whereas the LLM would just pick a reasonable default.

**How to avoid:**
- Every offloaded decision function MUST return a `{ result, confidence }` tuple
- When confidence is `'low'` or result is `null`, route back to LLM
- Keep the original LLM prompt text available (don't delete it from workflows)
- Implement a **circuit breaker**: if the code path fails 3x, automatically revert to LLM for that session
- Add metrics/logging for fallback-to-LLM events so you know when code coverage is slipping

**Warning signs:**
- Decision functions that throw errors instead of returning defaults
- Workflow prompts edited to remove decision instructions "because code handles it now"
- No logging when the code path can't determine an answer
- Tests only cover happy paths, not "what if none of the rules match?"

**Phase to address:**
All phases — this is an architectural principle. The fallback pattern should be established in the first implementation and enforced in every subsequent offloading.

---

### Pitfall 3: The Last-20% Trap

**What goes wrong:**
The scan identifies 50 offloading candidates. The first 40 (80%) are trivially deterministic — phase number padding, config lookups, path resolution. The remaining 10 require nuanced handling of edge cases, legacy formats, and cross-cutting concerns. The team spends 80% of total effort on these 10 and still can't get them right.

**Why it happens:**
The Pareto principle in reverse: the easy cases are extremely easy (lookup tables), but the hard cases are genuinely hard because they involve hidden context. "Format this requirement ID" is trivial until you encounter legacy IDs without prefixes, IDs with decimal suffixes, or IDs from imported projects with different naming conventions.

**Concrete bGSD example:**
Phase number resolution looks deterministic: `"1"` -> `"01"`. But the actual `resolvePhaseDir` function handles: padded numbers (`"01-"`), un-padded numbers, directory names with slugs, missing directories, and decimal phases (`"1.1"`). The `find-phase` CLI command exists precisely because this "simple" lookup has 5+ edge cases. The LLM handles all of these naturally.

**How to avoid:**
- During the scan phase, score each candidate's edge-case count explicitly
- Set a **hard cutoff**: if a candidate has >5 known edge cases, don't offload it
- Offload the common case but route edge cases to LLM: `if (isSimpleCase(input)) return codePath(input); else return llmPath(input);`
- Time-box implementation: if an offloading takes >2 hours, it's not worth it
- Calculate actual token savings vs implementation cost. A decision that fires once per session saves almost nothing

**Warning signs:**
- "Just one more edge case" commits keep appearing
- Edge case tests outnumber happy path tests 3:1
- The offloaded function has more comments than code
- Implementation estimate keeps growing ("it was supposed to be 30 minutes")

**Phase to address:**
Scan phase — the audit must include honest edge-case counts per candidate. Reject candidates with high edge-case density.

---

### Pitfall 4: False Determinism

**What goes wrong:**
A decision appears deterministic from the outside ("just look up the config value") but actually depends on implicit context the LLM was incorporating: recent conversation history, the nature of the current task, user preferences expressed earlier in the session, or the semantic content of files being worked on.

**Why it happens:**
LLMs maintain conversational context. When an LLM in a workflow "decides" which model to assign to a task, it considers not just the task metadata but also what failed before, what the user said about preferences, and the nature of the project. Extracting the decision into code loses this context.

**Concrete bGSD example:**
The `command-enricher.js` detects phase arguments from command input — seemingly deterministic. But the LLM also considers: "the user just said 'continue with phase 3'" or "we're in the middle of executing phase 2, so 'next phase' means 3." The enricher only handles explicit numeric arguments, not conversational references. If you tried to offload "determine which phase the user means" into code, you'd miss conversational context entirely.

**How to avoid:**
- For each candidate, ask: "Does this decision ever change based on conversation context?"
- Shadow-test: run the code path alongside the LLM path for 20 sessions and compare results
- Document the **full input space** for each decision, including implicit inputs
- If a decision function needs access to conversation history, session state, or file content beyond structured metadata — it's not deterministic
- Distinguish "structured data in, structured data out" (offloadable) from "unstructured context in, decision out" (keep LLM)

**Warning signs:**
- The offloaded function works perfectly in tests but produces wrong results in real sessions
- Users report "it used to work" after offloading — the LLM was compensating for ambiguous inputs
- Decision functions that need growing numbers of parameters to handle "just one more context signal"
- Functions that work for existing projects but fail for new project types

**Phase to address:**
Scan phase — the audit must distinguish truly deterministic decisions from "usually deterministic" ones. Test with diverse project states, not just the current project.

---

### Pitfall 5: Regression Avalanche

**What goes wrong:**
A programmatic decision is introduced or modified, and it silently breaks downstream workflows. Because the decision was previously embedded in LLM prompts (which are forgiving), the downstream code never had explicit contracts around the decision's output format. Now that it's in code, a small change (different capitalization, missing field, new enum value) cascades through 10+ workflows.

**Why it happens:**
bGSD has 45 workflows, 27 skills, and 9 agents. A single decision like "what's the current phase status?" flows through: plugin context injection -> workflow prompt -> agent prompt -> CLI tool invocation -> state update. Changing the decision at any point can break downstream consumers that expected a specific format.

**Concrete bGSD example:**
The `updateProgress` function modifies STATE.md progress bars. The format `[████████░░] 80%` is consumed by: the plugin parser (`parseState`), the system prompt builder (`buildSystemPrompt`), the idle validator (`fixProgressBar`), workflow prompts that regex-match progress, and agents that read progress as context. If an offloaded decision changes the progress format even slightly, all consumers break.

**How to avoid:**
- Add **contract tests** (snapshot tests) for every offloaded decision's output format
- Create a shared type/schema for decision outputs that both code and workflows reference
- Use the existing `verify:` CLI namespace to validate offloaded decisions
- Before modifying any offloaded decision, run the full test suite (762+ tests exist for a reason)
- Implement **versioned output formats**: `{ version: 1, result: "..." }` so consumers can handle format changes
- Map the dependency chain for each decision: who produces it, who consumes it, what format do they expect

**Warning signs:**
- "Tests pass but workflows fail" — the test suite doesn't cover the integration point
- Agents producing unexpected output after a code change in a seemingly unrelated module
- The same decision output is parsed by regex in 3+ different files
- No snapshot tests for CLI output consumed by workflows

**Phase to address:**
Implementation phase — every offloaded decision must ship with contract tests. The scan phase should map the consumer chain for each candidate.

---

### Pitfall 6: Over-Coupling Plugin to Workflow Text

**What goes wrong:**
Programmatic code in the plugin starts parsing workflow markdown to extract decision parameters. The plugin becomes tightly coupled to the exact wording, formatting, and structure of `.md` workflow files. Any workflow edit requires a corresponding code change, and vice versa.

**Why it happens:**
The temptation is strong: "The workflow already contains the logic, let's just parse it programmatically." But workflows are prose instructions for LLMs, not structured data for code. They use natural language, vary in formatting, and evolve without considering code parsers.

**Concrete bGSD example:**
The `enrichCommand` function already does lightweight parsing of `<bgsd-context>` JSON blocks — this works because the format is structured JSON. But if someone tried to programmatically extract "should we run research for this phase?" by parsing the `plan-phase.md` workflow text, they'd be coupling to prose that changes with every iteration.

**How to avoid:**
- Decision parameters must come from **structured sources**: config.json, frontmatter, STATE.md fields, CLI arguments
- NEVER parse workflow `.md` prose programmatically — workflows are LLM instructions, not data
- Create explicit configuration points: if a decision needs a flag, add it to `config.json` or frontmatter schema
- Use the plugin's `<bgsd-context>` injection to pass structured data TO workflows, not extract data FROM them
- Establish a **data flow direction**: plugin/CLI -> structured data -> workflow prompt -> LLM. Never reverse this.

**Warning signs:**
- Regex patterns matching workflow markdown content (not frontmatter/XML blocks)
- Plugin code that reads `.md` files outside of `.planning/` directory
- Code comments like "parse the 'Handle Research' section of plan-phase.md"
- Changes to workflow prose requiring code changes

**Phase to address:**
All phases — this is an architectural boundary. Enforce it from the first offloading.

---

### Pitfall 7: The "Code Can Do Everything" Trap

**What goes wrong:**
Early successes with easy offloading (lookups, formatting) create false confidence. The team starts offloading progressively harder decisions: "classify this deviation," "decide if this plan needs revision," "determine optimal execution strategy." Each one is possible in code but produces brittle, inaccurate results compared to LLM judgment.

**Why it happens:**
The `classifyTaskComplexity` and `selectExecutionMode` functions in `orchestration.js` actually work well — they're concrete examples of successful programmatic decision-making. But they work because their domains are narrow and well-defined. The temptation is to apply the same pattern to broader decisions that genuinely need reasoning.

**Concrete bGSD example:**
The `autoRecovery.js` module has 4 deviation rules (bug, missing_critical, blocking, architectural) with pattern-matching classification. This works for common patterns but uses keyword matching — it would misclassify a novel deviation type. The LLM deviation detection in the executor is more accurate because it understands context. Offloading this "further" would degrade quality.

**How to avoid:**
- Set an explicit **offloading boundary** per milestone: "We offload X, Y, Z this milestone. Period."
- Require justification for each candidate: expected token savings, confidence in determinism, fallback plan
- Track decision accuracy after offloading — if accuracy drops below 95%, revert to LLM
- Recognize that some "decisions" are actually "judgments" — judgment requires reasoning, decisions require data
- Review the decision criteria rubric above for each candidate. If even one critical criterion fails, stop.

**Warning signs:**
- Token savings claims without measurement
- "We could also offload..." scope creep in planning
- Offloaded decisions that are "usually right" instead of "always right"
- Code that tries to simulate LLM reasoning with increasingly complex heuristics

**Phase to address:**
Scan phase — the audit should explicitly label each candidate as "decision" (offloadable) or "judgment" (keep LLM). The boundary should be enforced during implementation.
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Giant switch/case for all offloaded decisions | Quick to add new cases | Unmaintainable past 20 cases; merge conflicts in multi-dev | Never — use registry pattern (Map of handlers) |
| Regex-based decision extraction from markdown | No parser needed | Fragile to formatting changes; false matches | Only for well-defined XML/frontmatter blocks with tests |
| Duplicating logic between plugin.js and bgsd-tools.cjs | Each runs independently | Drift between implementations; double maintenance | Never — share via common module in src/ |
| Hardcoding decision thresholds | Fast to implement | Tuning requires code changes and redeploy | Only if threshold is truly universal (e.g., 0-100% range) |
| Removing LLM fallback "to simplify" | Cleaner code paths | No recovery when code can't decide | Never — always keep fallback path |
| Testing only with current project state | Faster test writing | Breaks on different project structures or legacy formats | Only for initial prototype; add diverse test fixtures before merge |
| Inlining decision logic in workflow orchestrators | Fewer files to manage | Workflows become untestable code-in-prose | Never — decisions belong in src/ modules |

## Integration Gotchas

Common mistakes when connecting offloaded decisions across the plugin/CLI/workflow boundary.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Plugin -> Workflow (context injection) | Adding raw decision output to system prompt, bloating tokens | Inject minimal structured data; let workflow interpret |
| CLI -> Plugin (tool execution) | Offloaded decision in CLI duplicates logic already in plugin | Single source of truth: either in plugin tools or CLI, never both |
| Workflow -> CLI (command invocation) | Workflow passes LLM-interpreted params to code that expects strict format | Validate all params at the CLI boundary; reject with clear error |
| Plugin parser -> State file | Parsing assumes format won't change; no version negotiation | Use defensive parsing with fallback: try new format, fall back to old |
| Config.json -> Decision logic | Reading config for every decision invocation | Cache config at session start (already done — `parseConfig` has cache) |
| Agent prompt -> Tool call | Agent misuses tool because offloaded decision changed output schema | Version tool schemas; document breaking changes in tool description |
| Test suite -> Production paths | Tests mock the decision function instead of testing it | Test the actual decision function; mock only external I/O |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as complexity grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Over-eager offloading | Every prompt call replaced with code; total code complexity exceeds maintainability | Offload only high-frequency, truly deterministic decisions | >30 offloaded decision functions |
| Decision function I/O | Offloaded function reads files on every call instead of using cache | Use existing cache layer (parseState, parseRoadmap already cached) | >10 file reads per CLI invocation |
| Validation overhead | Input validation for offloaded decisions takes longer than LLM would | Validate at entry point, not in every function; use schema-based validation | Validation adds >50ms per decision |
| Bundle size bloat | Each offloaded decision adds code to the 1163KB bundle | Keep decision logic minimal; use data files (JSON maps) over code | Bundle exceeds 1500KB |
| Regex compilation | Complex regexes for decision parsing compiled on every invocation | Pre-compile and cache regexes (regex-cache.js exists for this) | >50 regex patterns per decision path |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues when replacing LLM judgment with code.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Auto-resolving file paths without sanitization | Path traversal — offloaded "resolve file" decision constructs paths from user input | Use existing `sanitizeShellArg`; validate paths are within project root |
| Bypassing human-in-the-loop gates | Code auto-approves what LLM would flag for human review | Offloaded decisions must NEVER bypass checkpoint types (human-verify, decision, human-action) |
| Trusting config.json without validation | Malformed config could lead to unexpected decision outcomes | Validate config against schema before using in decisions (valibot validation exists) |
| Decision function exposes internal state | Error messages from decision code reveal file paths, internal state | Return user-safe messages; log details to bgsd-plugin.log only |
| Programmatic state modification without locking | Two processes make conflicting decisions about state | Use existing lock mechanism (mkdir-based lock in bgsd-progress tool) |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

How offloading can degrade the user/agent experience.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Code returns cryptic error instead of LLM's natural explanation | User sees "EINVAL: invalid phase argument" instead of "Phase 3 doesn't exist yet — did you mean to create it?" | Return structured error with `message` (human-readable) + `code` (machine-readable) + `suggestion` (recovery hint) |
| Offloaded decision is faster but less accurate | User gets wrong model recommendation 5% of the time; was always right with LLM | Accuracy > speed. If code isn't 99%+ accurate, keep LLM |
| Silent fallback to LLM with no indication | User doesn't know when code handles it vs LLM — can't report issues | Log fallback events; surface in `--verbose` mode |
| Decision code doesn't explain its reasoning | LLM naturally says "I chose X because Y"; code just returns X | Add `reason` field to decision output: `{ result: "sequential", reason: "plan has checkpoint tasks" }` |
| Inconsistent behavior between code path and LLM path | User gets different results depending on whether fallback fires | Ensure code path output format matches what LLM would produce |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Decision offloading:** Often missing LLM fallback path — verify fallback fires for unrecognized inputs
- [ ] **Contract tests:** Often missing snapshot tests for output format — verify decision output is tested as a contract
- [ ] **Edge case coverage:** Often missing legacy format handling — verify with pre-v8.0 project structures
- [ ] **Workflow integration:** Often missing `<bgsd-context>` update — verify the workflow receives the offloaded decision's result
- [ ] **Error messages:** Often missing human-readable recovery hints — verify error.js patterns are used
- [ ] **Performance measurement:** Often missing before/after token count comparison — verify actual savings with tokenx
- [ ] **Config integration:** Often missing config flag to disable offloading — verify `config.json` has a toggle
- [ ] **Test diversity:** Often missing test cases for empty/null/malformed state — verify with fresh project and mature project
- [ ] **Fallback metrics:** Often missing logging for fallback events — verify `debugLog` is called when code can't decide
- [ ] **Documentation:** Often missing update to AGENTS.md or skill files — verify agents know about the new code path
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Decision tree explosion | MEDIUM | Extract to lookup table; move edge cases to LLM fallback; write contract tests for remaining cases |
| Missing LLM fallback | LOW | Add `else { return llmFallback(input); }` clause; restore original prompt instructions in workflow |
| Last-20% trap | LOW | Revert the complex offloading; keep only the simple cases; route the rest to LLM |
| False determinism | MEDIUM | Add shadow-testing mode; compare code vs LLM output for 20 sessions; revert if divergence >5% |
| Regression avalanche | HIGH | Roll back the breaking change; add missing contract tests; re-introduce change with tests passing |
| Over-coupling to workflows | HIGH | Extract structured data to config/frontmatter; rewrite decision to use structured sources only |
| "Code can do everything" | LOW | Audit offloaded decisions; revert those with <95% accuracy; establish explicit boundary |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Decision tree explosion | Scan (complexity scoring) | No candidate accepted with >3 decision depth or >5 edge cases |
| Missing LLM fallback | Implementation (architectural rule) | Every offloaded function has a fallback return path; tested |
| Last-20% trap | Scan (honest edge-case counting) | Candidates scored with edge-case count; >5 edge cases = rejected |
| False determinism | Scan (input space analysis) | Each candidate documented with full input space including implicit inputs |
| Regression avalanche | Implementation (contract tests) | Every offloaded decision ships with snapshot tests; CI validates |
| Over-coupling to workflows | All phases (boundary enforcement) | Code review gate: no `.md` prose parsing in src/ modules |
| "Code can do everything" | Scan (explicit boundary) | Candidates labeled as "decision" or "judgment"; judgment = rejected |
| Testing burden | Implementation (test strategy) | Decision tests use diverse fixtures, not just current project state |
<!-- /section -->

<!-- section: sources -->
## Sources

- **Training data (verified against codebase):** Patterns observed in `orchestration.js`, `autoRecovery.js`, `checkpointAdvisor.js`, `command-enricher.js`, `advisory-guardrails.js` — existing examples of both successful and borderline programmatic decision-making in bGSD. Confidence: HIGH
- **Codebase analysis:** `plugin.js` (2834 lines), `src/` (90+ modules), `workflows/` (44 files) — analyzed integration points and data flow patterns. Confidence: HIGH
- **Architecture patterns:** Existing fallback patterns (circuit breaker in `safeHook`, graceful degradation in `parseConfig`, default-on-error in `classifyTaskComplexity`) provide templates for safe offloading. Confidence: HIGH
- **Project constraints:** From `PROJECT.md` — single-file deploy, backward compatibility, 762+ tests, 9-agent cap, advisory-only validation. Confidence: HIGH
- **Decision-making precedents:** `CONFIG_DEFAULTS`, `MODEL_MAP`, `COMPLEXITY_LABELS`, `RECOVERY_STRATEGIES`, `PLANNING_COMMANDS`, `NAMING_PATTERNS` — existing lookup-table patterns that work well. Confidence: HIGH

---
*Pitfalls research for: LLM Offloading — Replacing LLM Decisions with Programmatic Code*
*Researched: 2026-03-13*
