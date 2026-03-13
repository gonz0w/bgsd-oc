# Phase 110: Audit & Decision Framework - Research (Rescoped)

**Researched:** 2026-03-13 (revised — replaces previous catalog-focused research)
**Domain:** Inline replacement of LLM-dependent deterministic decision logic
**Confidence:** HIGH

## Summary

Phase 110 is rescoped from "build a catalog scan tool" to "find LLM waste and fix it inline." The previous Phase 110 execution built `src/commands/audit.js` — a scanner that identifies 87 decision candidates across workflows and agents. That scanner and its tests are now artifacts of the old scope. The new scope says: don't catalog, don't build an engine, just replace the deterministic decisions with code where they live.

After scanning every workflow `.md` file, every source module, and the plugin infrastructure, there are **5 concrete decision points** that are genuinely LLM-dependent today and can be replaced with inline code. The number is small because this codebase has already offloaded most deterministic work: `orchestration.js` handles task complexity classification, `severity.js` handles finding severity, `command-enricher.js` pre-computes paths and model resolution, and `init.js` resolves models for all major workflows. What remains are specific gaps where the LLM still interprets a routing table or resolves a decision that code could handle.

Additionally, `util:classify` is **not dead code** — it has CLI registration, tests (14 test cases in `orchestration.test.cjs`), help text, and command discovery entries. However, **no workflow calls it**. It's a user-facing diagnostic tool, not LLM waste. The CONTEXT.md said "verify and remove if unused" — it's used by humans via CLI but not by any LLM workflow, so the decision of what to do with it should be made during planning.

**Primary recommendation:** Fix the 5 identified decision points inline, add targeted tests for each, remove `src/commands/audit.js` (old scope artifact), and clean up the `audit:scan` routing. One plan, ~5-7 tasks.

<user_constraints>

## User Constraints

From CONTEXT.md:

1. **Quick scan + fix in one pass** — No separate catalog tool, no CLI scan command. Analysis is baked into the implementation process.
2. **Inline code placement** — All decision logic goes where the LLM call currently lives. No new modules, no shared utilities.
3. **Hard replace** — If it's deterministic, rip out the LLM call entirely. No fallback, no confidence bands.
4. **Three categories to scan** — Model selection logic, routing/classification, template generation.
5. **Add targeted tests** — Each replaced decision point gets regression tests.
6. **`util:classify` investigation** — Verify usage, remove if unused rather than optimizing.

</user_constraints>

<phase_requirements>

## Phase Requirements

The roadmap requirements (AUDIT-01, AUDIT-02, AUDIT-03) were written for the old scope (CLI scan tool + rubric + token estimates). Since the phase is rescoped, the planner should redefine requirements or map work to the intent behind the original ones:

| Original ID | Original Scope | Rescoped Intent |
|-------------|---------------|-----------------|
| AUDIT-01 | CLI scan command that catalogs decisions | Scan codebase, identify fixable LLM waste, fix inline |
| AUDIT-02 | Rubric-scored evaluation of candidates | Replace deterministic decisions with code — rubric is implicit (if code can do it, code does it) |
| AUDIT-03 | Token savings estimates per candidate | Remove old audit scanner artifacts; savings are realized by the replacements themselves |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | built-in | All inline replacements use fs, path, regex | Zero-dependency project constraint |
| Existing `src/lib/constants.js` | existing | MODEL_PROFILES lookup table | Already proven for model selection |
| Existing `src/lib/helpers.js` | existing | `resolveModelInternal()` | Already proven for model resolution |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/output.js` | existing | Structured JSON/TTY output | If any new CLI output needed |
| `src/lib/format.js` | existing | Tables, colors | If any new CLI output needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline replacement in workflows | Shared decision-rules.js module | Violates CONTEXT.md "no new modules" constraint — that's Phase 111's scope |
| Hard-coded lookup tables | Config-driven rule engine | Over-engineering — inline logic is simpler and sufficient |

## Architecture Patterns

### Recommended Approach: Fix-in-Place

Each decision point is fixed exactly where the LLM currently interprets it:

1. **Workflow routing tables** → Pre-compute the route in `init.js` or `command-enricher.js`, inject via `<bgsd-context>`
2. **Model resolution gaps** → Add missing agents to `init.js` enrichment (2 workflows still call `util:resolve-model` manually)
3. **Commit type selection** → Pure function in `execute-plan.md`'s commit step context, or pre-compute in enricher
4. **Progress routing** → The routing table in `progress.md` (Routes A-F) is already deterministic based on file counts — pre-compute in enricher

### Pattern: Enricher-Injected Decisions (follows `command-enricher.js`)

The dominant pattern in this codebase for offloading LLM work is: compute the answer in JS, inject it as a field in the `<bgsd-context>` JSON block, and have the workflow consume the pre-computed value. This is how model resolution, phase directories, plan lists, and config flags already work.

```javascript
// In command-enricher.js or init.js:
enrichment.progress_route = computeProgressRoute(state, phaseDir);
enrichment.next_action = determineNextAction(state, plans, summaries);

// In workflow:
// "Use progress_route from <bgsd-context> to determine next action"
```

### Anti-Patterns to Avoid

1. **Don't create new modules** — CONTEXT.md is explicit: inline placement only, no new files.
2. **Don't abstract prematurely** — Each fix is a one-off inline replacement. If Phase 111 wants to generalize later, it can.
3. **Don't break workflow readability** — Workflows should still be understandable. If a routing table is replaced with "use `progress_route` from context," the logic is just hidden, not eliminated. The routing table should stay as documentation/comments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model resolution | Custom model lookup | `resolveModelInternal()` from helpers.js | Already handles overrides + profiles |
| Phase directory lookup | Custom dir finder | `resolvePhaseDir()` from command-enricher.js | Already handles padding + directory scan |
| Plan/summary counting | Custom file counter | `parsePlans()` from plugin/parsers | Already used by enricher |
| Config reading | Custom config loader | `loadConfig()` from helpers.js | Handles defaults + nested keys |

## Common Pitfalls

### Pitfall 1: Confusing "LLM reads instructions" with "LLM makes decisions"

**What goes wrong:** Every workflow routing table looks like an LLM decision, but most are just structured instructions. The LLM follows Route A because the counts say so — it doesn't "decide" in a way that requires understanding.
**Why it happens:** The routing tables ARE instructions the LLM follows, but the branching is on deterministic data (file counts, existence checks).
**How to avoid:** Only replace decision points where the LLM evaluates deterministic data to pick a branch. If the "decision" is really just following a lookup table, pre-compute the lookup.
**Warning signs:** Replacing a workflow section that the LLM was following correctly and predictably — no actual improvement.

### Pitfall 2: Breaking workflow readability for marginal token savings

**What goes wrong:** Replacing a clear 10-line routing table in a workflow with "use `progress_route` from context" makes the workflow harder to understand and debug.
**Why it happens:** Optimizing for token count without considering maintainability.
**How to avoid:** Keep routing tables as comments in workflows. The pre-computed value is the execution path; the table is the documentation.
**Warning signs:** Workflow becomes a thin wrapper around opaque context fields.

### Pitfall 3: Removing `audit.js` without cleaning up dependencies

**What goes wrong:** Build breaks because router.js still references the audit command handlers.
**Why it happens:** The audit module is wired into the router namespace, command discovery, and help text.
**How to avoid:** Clean up all references: router.js namespace, constants.js help text, commandDiscovery.js, command-help.js.
**Warning signs:** `npm test` fails after removal.

## Concrete Candidates for Inline Replacement

### Candidate 1: `debug.md` manual model resolution (HIGH priority)

**File:** `workflows/debug.md:17`
**Current:** `DEBUGGER_MODEL=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:resolve-model bgsd-debugger --raw)`
**Problem:** Workflow manually calls CLI to resolve model instead of using pre-computed context.
**Fix:** Add `debugger_model` to the enricher output for `bgsd-debug` commands. The enricher already resolves models for all other workflows via `init.js`.
**Complexity:** Low — add one `resolveModelInternal()` call to the init handler for debug commands, include in `<bgsd-context>`.
**Files:** `src/commands/init.js`, `workflows/debug.md`

### Candidate 2: `audit-milestone.md` manual model resolution (HIGH priority)

**File:** `workflows/audit-milestone.md:21`
**Current:** `CHECKER_MODEL=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:resolve-model bgsd-verifier)`
**Problem:** Same as Candidate 1 — manual CLI call instead of pre-computed context.
**Fix:** Add `verifier_model` (or `checker_model`) to enricher output for `bgsd-audit-milestone`.
**Complexity:** Low — same pattern as Candidate 1.
**Files:** `src/commands/init.js`, `workflows/audit-milestone.md`

### Candidate 3: `progress.md` routing logic (MEDIUM priority)

**File:** `workflows/progress.md:104-330`
**Current:** LLM evaluates a routing table (Routes A-F) based on file counts (plans vs summaries, UAT gaps, milestone position). The LLM runs `ls` commands, counts files, then picks a route.
**Problem:** The route selection is 100% deterministic — it's based on integer comparisons of file counts. Code can do this faster and more reliably.
**Fix:** Pre-compute `progress_route` in the init/enricher: count plans, summaries, UAT gaps, determine current vs highest phase, and return the route letter (A-F) plus the relevant context (next plan path, next phase number, etc.).
**Complexity:** Medium — requires counting files in phase directory and evaluating the routing conditions. The `findPhaseInternal()` helper already provides most of this data.
**Files:** `src/commands/init.js` (add route computation), `workflows/progress.md` (consume pre-computed route)

### Candidate 4: `execute-plan.md` pattern selection (MEDIUM priority)

**File:** `workflows/execute-plan.md:44-57`
**Current:** LLM greps for checkpoint task types, counts them, and selects Pattern A/B/C.
**Problem:** Pattern selection is deterministic: no checkpoints → A, verify-only checkpoints → B, decision checkpoints → C. This is a simple grep + classify.
**Fix:** Pre-compute `execution_pattern` in enricher/init by parsing the plan's task types. The `parseTasksFromPlan()` function in `orchestration.js` already extracts task types.
**Complexity:** Medium — need to call `parseTasksFromPlan()` during init, classify checkpoint presence.
**Files:** `src/commands/init.js`, `workflows/execute-plan.md`

### Candidate 5: `verify-work.md` severity inference (LOW priority)

**File:** `workflows/verify-work.md:64`
**Current:** LLM infers severity from user text responses ("crash" → blocker, "doesn't work" → major, "slow" → minor).
**Problem:** This is keyword-based classification — the same pattern already offloaded in `src/lib/review/severity.js`.
**Fix:** The severity inference instructions in the workflow could reference the existing `severity.js` classification rules, or the executor could call a new `util:classify-severity` inline. However, this is borderline — the LLM is already following a simple keyword table, and the "inference" happens during interactive conversation where the LLM is already running.
**Complexity:** Low code change, but marginal benefit — the LLM handles this during a conversational loop where it's already loaded.
**Files:** `workflows/verify-work.md`, possibly `src/lib/review/severity.js`

### NOT a candidate: `progress.md` "recent work" extraction

The old research flagged this, but reading recent SUMMARY files and extracting one-liners requires the LLM to read file content and summarize — this is NLU, not deterministic logic.

### NOT a candidate: Commit type selection

`execute-plan.md:151` lists commit types (feat/fix/test/refactor/perf/docs/style/chore). The LLM picks the right type based on what the task actually did. This requires understanding the semantic nature of the change — not deterministic.

### NOT a candidate: `resume-project.md` next action routing

Although the routing looks deterministic, the "determine next action" step in resume involves reading free-form STATE.md content, checking for interrupted agents, and evaluating project state holistically. The branching conditions involve agent state that isn't fully captured in structured data.

## Old Scope Artifacts to Remove

The previous Phase 110 execution built these artifacts that no longer serve the rescoped phase:

### `src/commands/audit.js` (739 lines)
- Scanner, rubric scorer, token estimator, catalog writer, TTY formatter
- Registered in router under `audit` namespace
- Has command help text in `constants.js` and `command-help.js`
- Referenced in `commandDiscovery.js`
- **No tests** — audit.js has no dedicated test file (the scanner was validated via manual execution)

### `.planning/audit-catalog.json`
- Generated artifact from the old scanner runs
- Consumed by nobody (Phase 111 hasn't started)
- Can be deleted

### Router/help/discovery cleanup
- `src/router.js`: `audit` namespace case
- `src/lib/constants.js`: `COMMAND_HELP['audit:scan']` and related entries
- `src/lib/command-help.js`: audit entries
- `src/lib/commandDiscovery.js`: audit entries

## `util:classify` Investigation

**Verdict: NOT dead code. But NOT LLM waste either.**

`util:classify` is a user-facing CLI command that classifies task complexity and recommends models:
- **Router:** Registered in `src/router.js` under `util` → `classify` subcommand
- **Implementation:** `src/lib/orchestration.js` → `cmdClassifyPlan()`, `cmdClassifyPhase()`
- **Tests:** 14 test cases in `tests/orchestration.test.cjs` covering plan classification, phase classification, edge cases
- **Help text:** In `constants.js` COMMAND_HELP
- **Command discovery:** Listed in `commandDiscovery.js`

**Who calls it:**
- **Users via CLI:** `node bgsd-tools.cjs util:classify plan <path>` or `util:classify phase <num>`
- **No workflow calls it** — grep of all 44 workflow `.md` files returns zero matches
- **`init.js` calls `classifyPlan()` and `selectExecutionMode()` programmatically** — the functions are used internally, but the CLI command wrappers (`cmdClassifyPlan`, `cmdClassifyPhase`) are only invoked via the router

The CONTEXT.md said "verify and remove if unused rather than optimizing." The functions ARE used (by init.js). The CLI command wrappers are user-facing diagnostic tools. Removing the CLI commands would remove user visibility into task complexity classification. Recommendation: **keep the functions, keep the CLI commands** — they're diagnostic tools, not LLM waste. The classify command is comparable to `util:progress` or `verify:state` — a user inspection tool.

## Scope Estimate

| Work Item | Effort | Files |
|-----------|--------|-------|
| Candidate 1: debug.md model resolution | ~10 min | 2 files |
| Candidate 2: audit-milestone.md model resolution | ~10 min | 2 files |
| Candidate 3: progress.md route pre-computation | ~30 min | 2-3 files |
| Candidate 4: execute-plan.md pattern selection | ~20 min | 2-3 files |
| Candidate 5: verify-work.md severity (optional) | ~10 min | 1-2 files |
| Remove audit.js + cleanup references | ~20 min | 5-6 files |
| Targeted tests for each replacement | ~20 min | 1-2 test files |
| **Total** | **~2 hours** | **~10-15 files** |

This fits in a single plan with 5-7 tasks. The work is straightforward because all patterns already exist in the codebase — every fix follows a proven template.

## Open Questions

1. **What to do with `util:classify` CLI?** — Functions are used internally. CLI wrappers are user-facing diagnostics. Recommendation: keep. But planner should decide.

2. **Should `progress.md` routing be fully pre-computed or partially?** — Full pre-computation means the enricher returns the exact route letter + all data needed for that route (next plan path, phase number, etc.). Partial means just returning the counts and letting the LLM do the final comparison. Full pre-computation saves ~350 tokens/invocation but adds complexity to the enricher.

3. **Should old ROADMAP.md success criteria be updated?** — The success criteria (SC-1 through SC-4) reference CLI scan commands, rubric scores, and token estimates from the old scope. These are now invalid. The planner should update ROADMAP.md to reflect the new scope's success criteria.

## Sources

### Primary (HIGH confidence)
- **Direct codebase analysis:** Read all 44 workflow files, all src/commands/*.js, all src/lib/*.js, all plugin/*.js modules
- `src/commands/init.js` — Where model resolution is pre-computed for enrichment
- `src/plugin/command-enricher.js` — The pattern for injecting pre-computed decisions
- `src/lib/orchestration.js` — Existing task classification proving the inline pattern
- `src/lib/review/severity.js` — Existing severity classification proving keyword-based offloading

### Secondary (MEDIUM confidence)
- `src/commands/audit.js` — Old Phase 110 artifact; analyzed to understand removal scope
- `.planning/audit-catalog.json` — Old artifact; not used by any code

### Tertiary (LOW confidence)
- Token savings estimates — Based on typical prompt sizes for routing tables; rough order-of-magnitude

## Metadata

**Confidence breakdown:**
- Candidate identification: HIGH (systematic grep + read of every workflow and source file)
- Fix patterns: HIGH (every fix follows an existing proven pattern in the codebase)
- Scope estimate: HIGH (small number of well-defined changes)
- `util:classify` verdict: HIGH (comprehensive trace of all references)
- Token savings from fixes: LOW (no runtime telemetry to validate)

**Research date:** 2026-03-13
**Valid until:** Phase 110 completion
