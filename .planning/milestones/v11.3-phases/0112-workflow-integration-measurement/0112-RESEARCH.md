# Phase 112: Workflow Integration & Measurement - Research

**Researched:** 2026-03-13
**Domain:** Replace LLM reasoning in workflows with pre-computed decisions from decision engine
**Confidence:** HIGH

## Summary

Phase 112 connects the decision engine built in Phase 111 to the 44 workflow `.md` files that agents follow. The engine already exists: 12 pure decision functions in `src/lib/decision-rules.js`, a `DECISION_REGISTRY`, and an `evaluateDecisions()` aggregator called in-process by `src/plugin/command-enricher.js`. The enricher already injects a `decisions` field into the `<bgsd-context>` JSON block that every workflow receives.

The problem: **no workflow currently reads `decisions` from `<bgsd-context>`.** The decision rules fire, the results appear in the JSON, but every workflow still re-derives the same answers via LLM reasoning — running `ls` commands to count files, grepping for checkpoint types, evaluating routing tables manually.

After auditing all 44 workflows against the 12 existing decision rules, I found **19 concrete replacement opportunities** across 13 workflows. These range from trivial (add one sentence telling the workflow to read a pre-computed value) to moderate (supply additional enrichment data the workflow currently computes via bash). Additionally, there are **2 manual model resolution calls** that should be replaced with enricher-provided values, identified in Phase 110 research but not yet fixed.

The measurement aspect is straightforward: count LLM reasoning steps (bash commands + routing table evaluations) before and after, per workflow. Static analysis — no telemetry framework needed.

**Primary recommendation:** Work through the 13 affected workflows in priority order (high-traffic first), adding consumption of pre-computed decisions and simplifying the derivation logic. Add the missing enrichment inputs. Report before/after LLM call counts as CLI output.

<user_constraints>

## User Constraints

From CONTEXT.md:

1. **Audit ALL ~40 workflows** — not just high-traffic ones. Every workflow examined.
2. **Replace LLM-derivable logic with deterministic code** — if code can compute it, code should compute it.
3. **No decision payload architecture, no config framework, no telemetry system** — pragmatic replacements only.
4. **Moderate restructuring** — simplify step logic, collapse redundant branches, remove derivation code. Don't rewrite workflows from scratch.
5. **Silent fallback** — workflows should gracefully degrade if a code path isn't available.
6. **Code can live wherever fits** — bgsd-tools.cjs, plugin hook, etc. No mandate to centralize.
7. **Measurement via static analysis** — count reasoning steps before/after, CLI output only.
8. **High-traffic workflows first** — execute-phase, plan-phase, discuss-phase migrated first within incremental rollout.

</user_constraints>

<phase_requirements>

## Phase Requirements

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| FLOW-01 | Extended bgsd-context JSON includes pre-computed decisions | Already partially done (enricher calls evaluateDecisions). Needs: supply missing inputs so more rules fire, and add new enrichment fields some workflows need. |
| FLOW-02 | Workflow files simplified to consume pre-computed decisions | The bulk of the work: modify 13 workflows to read from `decisions` field instead of re-deriving. |
| FLOW-03 | Token savings telemetry — before/after LLM call counts | Static analysis report: count bash commands + routing evaluations per workflow, before vs after. CLI output. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | built-in | All enrichment changes use fs, path | Zero-dependency project constraint |
| `src/lib/decision-rules.js` | existing | Decision functions and registry | Phase 111 output — the engine to consume |
| `src/plugin/command-enricher.js` | existing | Injects `<bgsd-context>` JSON | The delivery mechanism for decisions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/output.js` | existing | Structured JSON/TTY output | For the measurement report CLI command |
| `src/lib/format.js` | existing | Tables, colors | For the measurement report |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static LLM call counting | Runtime telemetry hooks | Over-engineering — CONTEXT.md explicitly says no telemetry system |
| Per-workflow decision payload | Flat decisions field | Already flat — evaluateDecisions() returns `{rule_id: result}` |

## Architecture Patterns

### Pattern 1: Consume Pre-Computed Decision (Primary Pattern)

Every replacement follows this pattern:

**Before (workflow derives via LLM):**
```markdown
<step name="route">
Count plans: `ls .planning/phases/XX/*-PLAN.md | wc -l`
Count summaries: `ls .planning/phases/XX/*-SUMMARY.md | wc -l`

| summaries < plans → Route A |
| summaries = plans → Step 3 |
| plans = 0 → Route B |
...evaluate routing table...
</step>
```

**After (workflow consumes from context):**
```markdown
<step name="route">
**If `decisions.progress-route` is present in `<bgsd-context>`:** Use its `.value` directly as the route letter (A-F). Skip file counting and routing table evaluation.

**Fallback:** If `decisions.progress-route` is absent, derive the route using the original method below:
[...keep existing routing table as fallback documentation...]
</step>
```

### Pattern 2: Enrichment Input Expansion

Some decisions need more data in the enrichment object for their rules to fire with useful results. The enricher currently passes paths and config flags. To activate more rules, add:

```javascript
// In command-enricher.js enrichCommand():
// Supply counts for progress-route rule
if (enrichment.plans) {
  enrichment.plan_count = enrichment.plans.length;
  enrichment.summary_count = summaryFiles.length;  // already computed
}
// Supply file existence flags for plan-existence-route
enrichment.has_research = existsSync(join(cwd, phaseDir, `${padded}-RESEARCH.md`));
enrichment.has_context = existsSync(join(cwd, phaseDir, `${padded}-CONTEXT.md`));
```

### Anti-Patterns to Avoid

1. **Don't remove routing tables entirely** — keep them as fallback/documentation. The `decisions` field is additive.
2. **Don't rewrite workflow structure** — CONTEXT.md says moderate restructuring, not rewrites.
3. **Don't add config toggles** — no feature flags for decision consumption.
4. **Don't build a telemetry system** — static before/after counts are sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decision evaluation | Custom workflow-side logic | `decisions.*` from `<bgsd-context>` | Engine already computes these |
| Plan/summary counting | bash `ls | wc -l` in workflow | `plan_count`/`summary_count` from enrichment | Enricher already has this data |
| Model resolution | `util:resolve-model` CLI call | `executor_model`/`verifier_model` from enrichment | Init already resolves most models |
| Phase argument parsing | Regex in workflow bash | `decisions.phase-arg-parse` | Rule already handles all formats |

## Concrete Replacement Opportunities

### Category A: Decision Rules Already Exist — Workflows Just Need to Read Them

These require NO new code in the engine. The decision rules fire, the results are in `<bgsd-context>`, workflows just need one sentence added: "If `decisions.X` is present, use its value."

#### 1. `progress.md` — Route Selection (HIGH impact, EASY effort)

**Workflow:** `workflows/progress.md` lines 104-330
**Decision Rule:** `progress-route` (already exists)
**Current LLM Work:** Runs `ls` to count PLANs, SUMMARYs, and UATs. Evaluates 6-route table. Counts phases to determine milestone position.
**Replacement:** Add "If `decisions.progress-route` is present, use its `.value` as the route letter" at the top of the `<step name="route">`. Keep the routing table below as fallback.
**Enrichment Needed:** Supply `plan_count`, `summary_count`, `uat_gap_count`, `current_phase`, `highest_phase`, `state_exists`, `project_exists`, `roadmap_exists` to the enrichment object so the rule fires with correct data. Most of these are already derivable from existing enrichment logic.
**LLM Calls Saved:** 3 bash commands + 1 routing table evaluation = ~4 LLM reasoning steps per invocation.

#### 2. `execute-plan.md` — Pattern A/B/C Selection (HIGH impact, EASY effort)

**Workflow:** `workflows/execute-plan.md` lines 44-57
**Decision Rule:** `execution-pattern` (already exists)
**Current LLM Work:** Greps plan for checkpoint types, counts them, selects Pattern A/B/C.
**Replacement:** Add "If `decisions.execution-pattern` is present, use its `.value` as the pattern letter."
**Enrichment Needed:** Supply `task_types` array from parsed plan tasks. The enricher already parses plans via `parsePlans()` — just extract task types from plan tasks.
**LLM Calls Saved:** 1 grep + 1 classification = ~2 reasoning steps.

#### 3. `execute-plan.md` — Context Budget Gate (MEDIUM impact, EASY effort)

**Workflow:** `workflows/execute-plan.md` line 36-41
**Decision Rule:** `context-budget-gate` (already exists)
**Current LLM Work:** Runs `verify:context-budget` CLI command, then interprets warning/mode to decide proceed/warn/stop.
**Replacement:** Add "If `decisions.context-budget-gate` is present, use its `.value` (proceed/warn/stop)."
**Enrichment Needed:** Supply `warning` (from budget check) and `mode` (from config). Note: the budget check itself still needs to run as CLI — the decision just replaces the interpretation.
**LLM Calls Saved:** 1 reasoning step (interpreting budget result).

#### 4. `execute-plan.md` — Previous Summary Check (MEDIUM impact, EASY effort)

**Workflow:** `workflows/execute-plan.md` line 81
**Decision Rule:** `previous-check-gate` (already exists)
**Current LLM Work:** LLM checks if previous SUMMARY has unresolved issues/blockers and decides proceed/warn/block.
**Replacement:** Add "If `decisions.previous-check-gate` is present, use its `.value`."
**Enrichment Needed:** Supply `has_previous_summary`, `has_unresolved_issues`, `has_blockers`. Derivable from plan/summary file existence checks in the enricher.
**LLM Calls Saved:** 1 reasoning step.

#### 5. `execute-phase.md` — Branch Handling (MEDIUM impact, EASY effort)

**Workflow:** `workflows/execute-phase.md` lines 57-63
**Decision Rule:** `branch-handling` (already exists)
**Current LLM Work:** Reads `branching_strategy` from context, checks branch state, decides skip/create/update.
**Replacement:** Add "If `decisions.branch-handling` is present, use its `.value` (skip/create/update/use-existing)."
**Enrichment Needed:** `branching_strategy` already in enrichment. Add `has_branch` and `branch_behind` (git checks).
**LLM Calls Saved:** 1-2 reasoning steps.

#### 6. `execute-phase.md` — CI Gate (MEDIUM impact, EASY effort)

**Workflow:** `workflows/execute-phase.md` lines 389-438
**Decision Rule:** `ci-gate` (already exists)
**Current LLM Work:** Reads CI_FLAG, checks config, determines run/skip/warn.
**Replacement:** Add "If `decisions.ci-gate` is present, use its `.value` (run/skip/warn)."
**Enrichment Needed:** Supply `ci_enabled`, `has_test_command`, `tests_passing`.
**LLM Calls Saved:** 1-2 reasoning steps.

#### 7. `resume-project.md` — Next Action Routing (HIGH impact, MEDIUM effort)

**Workflow:** `workflows/resume-project.md` lines 116-148
**Decision Rule:** `resume-route` (already exists)
**Current LLM Work:** Evaluates 6 conditions (interrupted agent, continue-here, incomplete plans, phase complete, ready to plan, ready to execute) and picks the primary next action.
**Replacement:** Add "If `decisions.resume-route` is present, use its `.value` as the primary action."
**Enrichment Needed:** Supply `has_state`, `has_roadmap`, `has_plans`, `has_incomplete_plans`, `has_blockers`, `phase_complete`. Several already derivable from enrichment data.
**LLM Calls Saved:** 2-3 reasoning steps.

#### 8. `discuss-phase.md` — Auto-Advance Check (LOW impact, EASY effort)

**Workflow:** `workflows/discuss-phase.md` lines 404-450
**Decision Rule:** `auto-advance` (already exists)
**Current LLM Work:** Reads `--auto` flag, checks config for `workflow.auto_advance`.
**Replacement:** Add "If `decisions.auto-advance` is present, use its `.value` (boolean)."
**Enrichment Needed:** Supply `auto_advance_config` (from config) and `auto_flag` (from command args).
**LLM Calls Saved:** 1 reasoning step.

#### 9. `plan-phase.md` — Auto-Advance Check (LOW impact, EASY effort)

**Workflow:** `workflows/plan-phase.md` lines 147-153
**Decision Rule:** `auto-advance` (same rule as #8)
**Same replacement pattern as discuss-phase.md.**
**LLM Calls Saved:** 1 reasoning step.

#### 10. `transition.md` — Auto-Advance and Branch Handling (MEDIUM impact, EASY effort)

**Workflow:** `workflows/transition.md` lines 306-467 and 424-426
**Decision Rules:** `auto-advance` + `branch-handling`
**Current LLM Work:** Checks `is_last_phase`, reads CONTEXT.md existence, determines route A/B, checks mode.
**Replacement:** Use `decisions.auto-advance` for the auto-advance check. Use `decisions.branch-handling` for branch handling.
**LLM Calls Saved:** 1-2 reasoning steps.

#### 11. `debug.md` — Return Handler Route (LOW impact, EASY effort)

**Workflow:** `workflows/debug.md` lines 79-99
**Decision Rule:** `debug-handler-route` (already exists)
**Current LLM Work:** Interprets agent return type (ROOT CAUSE FOUND / CHECKPOINT / INCONCLUSIVE) and routes to fix/plan/manual/continue.
**Note:** This rule uses MEDIUM confidence, so the LLM should still have override ability. The pre-computed route is a suggestion, not authoritative.
**LLM Calls Saved:** 1 reasoning step.

### Category B: Decision Rules Exist but Need Enrichment Input Expansion

These require adding data to the enrichment object so the rules produce useful results.

#### 12. Enricher: Add `plan_count`, `summary_count`, `uat_gap_count` for progress-route (MEDIUM effort)

**File:** `src/plugin/command-enricher.js`
**Current:** Enricher provides `plans` array and `incomplete_plans` but not counts or UAT status.
**Change:** Add `plan_count`, `summary_count` (both derivable from files already listed), and `uat_gap_count` (count `*-UAT.md` files with `status: diagnosed`). Also add `current_phase` (number), `highest_phase` (number from roadmap phases), `state_exists`, `project_exists`, `roadmap_exists`.
**Impact:** Makes `progress-route`, `plan-existence-route`, and `resume-route` decisions produce correct results instead of firing on partial data.

#### 13. Enricher: Add `task_types` for execution-pattern (EASY effort)

**File:** `src/plugin/command-enricher.js`
**Current:** Enricher parses plans but doesn't extract task types.
**Change:** After parsing plans, extract `task_types` from plan tasks: `plan.tasks.map(t => t.type)`. Add to enrichment.
**Impact:** Makes `execution-pattern` decision produce correct A/B/C result.

#### 14. Enricher: Add `has_research`, `has_context` for plan-existence-route (EASY effort)

**File:** `src/plugin/command-enricher.js`
**Current:** Enricher doesn't check for RESEARCH.md or CONTEXT.md existence.
**Change:** Check `existsSync` for `{phaseDir}/{padded}-RESEARCH.md` and `{phaseDir}/{padded}-CONTEXT.md`.
**Impact:** Makes `plan-existence-route` fire with correct data.

### Category C: Model Resolution Replacements (from Phase 110 Research)

#### 15. `debug.md` — Manual Model Resolution (HIGH impact, EASY effort)

**Workflow:** `workflows/debug.md` line 17
**Current:** `DEBUGGER_MODEL=$(node .../bgsd-tools.cjs util:resolve-model bgsd-debugger --raw)`
**Problem:** Subprocess call to resolve model that the enricher should pre-compute.
**Fix:** Either add `debugger_model` to enrichment for `bgsd-debug` commands, or consume it from the existing `executor_model` field if the debug agent uses the same model profile.
**LLM Calls Saved:** 1 subprocess + 1 reasoning step = 2 steps.

#### 16. `audit-milestone.md` — Manual Model Resolution (HIGH impact, EASY effort)

**Workflow:** `workflows/audit-milestone.md` line 21
**Current:** `CHECKER_MODEL=$(node .../bgsd-tools.cjs util:resolve-model bgsd-verifier)`
**Fix:** Use `verifier_model` or `checker_model` from `<bgsd-context>` enrichment. The enricher already resolves models for most workflows.
**LLM Calls Saved:** 1 subprocess + 1 reasoning step = 2 steps.

### Category D: Measurement & Reporting

#### 17. Static analysis: Count LLM reasoning steps per workflow (MEDIUM effort)

**What:** For each of the 13 affected workflows, count:
- Bash commands the LLM would run for derivation (ls, grep, etc.)
- Routing table evaluations
- Model resolution subprocess calls

**Before counts** come from the current workflow text. **After counts** come from the simplified version.

**Output:** A CLI command or a simple report showing absolute before/after per workflow and total savings.

### Workflows With NO Replacement Opportunities

The following workflows were audited and have no LLM-derivable logic to replace:

| Workflow | Reason No Replacement |
|----------|-----------------------|
| `add-phase.md` | Delegates to CLI, no LLM derivation |
| `add-todo.md` | Conversational input, no derivation |
| `check-todos.md` | Reads todo files, no routing logic |
| `cleanup.md` | User-directed cleanup |
| `cmd-codebase-impact.md` | Thin CLI wrapper |
| `cmd-context-budget.md` | Thin CLI wrapper |
| `cmd-rollback-info.md` | Thin CLI wrapper |
| `cmd-search-decisions.md` | Thin CLI wrapper |
| `cmd-search-lessons.md` | Thin CLI wrapper |
| `cmd-session-diff.md` | Thin CLI wrapper |
| `cmd-test-run.md` | Thin CLI wrapper |
| `cmd-trace-requirement.md` | Thin CLI wrapper |
| `cmd-validate-config.md` | Thin CLI wrapper |
| `cmd-validate-deps.md` | Thin CLI wrapper |
| `cmd-velocity.md` | Thin CLI wrapper |
| `complete-milestone.md` | Mostly CLI-delegated, LLM work is judgment-based |
| `diagnose-issues.md` | Orchestrates debug agents — no deterministic routing |
| `health.md` | CLI delegation |
| `help.md` | Static content |
| `insert-phase.md` | CLI delegation |
| `list-phase-assumptions.md` | Conversational analysis — requires LLM judgment |
| `map-codebase.md` | Spawns analysis agents — no deterministic logic |
| `new-milestone.md` | Conversational + research spawning — no deterministic routing to replace |
| `new-project.md` | Conversational flow |
| `pause-work.md` | Context gathering — requires LLM |
| `plan-milestone-gaps.md` | Gap analysis — requires LLM judgment |
| `quick.md` | Spawns planner/executor — minimal derivation (CI gate already covered by rule) |
| `remove-phase.md` | CLI delegation |
| `research-phase.md` | Spawns researcher — no deterministic routing to replace |
| `set-profile.md` | Simple config update |
| `settings.md` | Conversational config |
| `tdd.md` | Execution instructions — no routing |
| `update.md` | CLI delegation |
| `verify-work.md` | Conversational UAT — severity inference is borderline (kept as LLM for now) |

**31 workflows have no actionable replacement opportunities.** The remaining 13 have the 19 opportunities listed above.

## Estimated LLM Call Savings

| Workflow | Before (LLM steps) | After (LLM steps) | Saved |
|----------|--------------------|--------------------|-------|
| `progress.md` | ~7 (3 ls + routing table + milestone check) | ~1 (read pre-computed route) | 6 |
| `execute-plan.md` | ~5 (grep + pattern select + budget + previous check) | ~1 | 4 |
| `execute-phase.md` | ~4 (branch check + CI gate + flag parsing) | ~1 | 3 |
| `resume-project.md` | ~5 (state checks + routing) | ~1 | 4 |
| `discuss-phase.md` | ~2 (auto-advance check) | ~0 | 2 |
| `plan-phase.md` | ~2 (auto-advance check) | ~0 | 2 |
| `transition.md` | ~3 (auto-advance + branch + milestone check) | ~1 | 2 |
| `debug.md` | ~3 (model resolution + return routing) | ~1 | 2 |
| `audit-milestone.md` | ~2 (model resolution) | ~0 | 2 |
| **Total** | **~33** | **~6** | **~27** |

These are **per-invocation** savings. High-traffic workflows (progress, execute-phase, execute-plan) run multiple times per session, so real-world savings multiply.

## Scope Estimate

| Work Item | Effort | Files |
|-----------|--------|-------|
| Enrichment input expansion (items 12-14) | ~30 min | 1 file (command-enricher.js) + build |
| progress.md consumption + simplification | ~15 min | 1 workflow |
| execute-plan.md consumption (3 decisions) | ~15 min | 1 workflow |
| execute-phase.md consumption (2 decisions) | ~15 min | 1 workflow |
| resume-project.md consumption | ~10 min | 1 workflow |
| discuss-phase.md auto-advance consumption | ~5 min | 1 workflow |
| plan-phase.md auto-advance consumption | ~5 min | 1 workflow |
| transition.md consumption (2 decisions) | ~10 min | 1 workflow |
| debug.md model resolution + return routing | ~10 min | 1 workflow |
| audit-milestone.md model resolution | ~5 min | 1 workflow |
| Measurement report (before/after counts) | ~20 min | 1-2 files |
| Tests for enrichment expansion | ~15 min | 1 test file |
| **Total** | **~2.5 hours** | **~13-15 files** |

This fits in 2 plans: (1) enrichment expansion + tests, (2) workflow simplifications + measurement report.

## Common Pitfalls

### Pitfall 1: Breaking Workflow Fallback

**What goes wrong:** Workflow becomes completely dependent on `decisions` field — breaks if enricher doesn't run or decision evaluation fails.
**Why it happens:** Removing the derivation code entirely instead of making it a fallback.
**How to avoid:** Always keep the original derivation logic as fallback. The decision consumption is an "if present, use it" shortcut, not a replacement for the logic section.
**Warning signs:** Workflow has no bash commands and no routing table — it's become a thin wrapper.

### Pitfall 2: Enrichment Object Growing Too Large

**What goes wrong:** Adding too many fields to the enrichment object inflates `<bgsd-context>` beyond the 500-token budget.
**Why it happens:** Adding raw data instead of computed results.
**How to avoid:** Add counts and booleans, not raw arrays. The `decisions` field is already compact (12 entries × ~30 chars each).
**Warning signs:** Token budget warning fires on every command.

### Pitfall 3: Decision Rules Firing on Incomplete Data

**What goes wrong:** A rule fires because one of its input keys is present, but other required inputs are missing, producing wrong results.
**Why it happens:** `evaluateDecisions()` fires rules when ANY input key matches, not when ALL inputs are present.
**How to avoid:** For each rule, ensure ALL required inputs are supplied when enrichment runs. Review `DECISION_REGISTRY.inputs` for each rule against what the enricher provides.
**Warning signs:** Decision value is `null` or confidence is `LOW` — the rule fired but couldn't compute properly.

### Pitfall 4: Measurement Report Complexity Creep

**What goes wrong:** Building a persistent telemetry system instead of a static report.
**Why it happens:** Scope creep from "count LLM calls" to "track LLM calls over time."
**How to avoid:** CONTEXT.md is explicit: no telemetry system. Count once, report once. The report is a snapshot, not a dashboard.
**Warning signs:** Adding timestamps, storage, aggregation, or per-session tracking.

## Code Examples

### Example: Consuming a Decision in a Workflow

```markdown
<step name="route">
**Pre-computed routing:** If `decisions.progress-route` exists in `<bgsd-context>`:
- Use `decisions.progress-route.value` as the route letter (A/B/C/D/E/F)
- Skip to the corresponding route section below

**Fallback** (if decisions not available):
[...existing routing table unchanged...]
</step>
```

### Example: Adding Enrichment Inputs

```javascript
// In command-enricher.js, after plan enumeration:
if (enrichment.plans) {
  enrichment.plan_count = enrichment.plans.length;
}
const summaryFiles = listSummaryFiles(phaseDirFull);
enrichment.summary_count = summaryFiles.length;

// Check file existence for plan-existence-route
if (phaseDir) {
  const padded = String(phaseNum).padStart(4, '0');
  enrichment.has_research = existsSync(join(resolvedCwd, phaseDir, `${padded}-RESEARCH.md`));
  enrichment.has_context = existsSync(join(resolvedCwd, phaseDir, `${padded}-CONTEXT.md`));
}
```

## Open Questions

1. **Should `verify-work.md` severity inference be replaced?** — Phase 110 research flagged this as a candidate (keyword-based classification that `severity.js` already handles). The savings are marginal because the LLM is already running during a conversation. Recommendation: defer — not worth the effort for Phase 112.

2. **Should the enricher supply `task_types` for ALL plans or just the current plan?** — The `execution-pattern` rule needs task types from the plan being executed. The enricher could extract types from all plans in the phase or just the first incomplete one. Recommendation: first incomplete plan only — that's what the executor will run.

3. **How should the measurement report be presented?** — Options: (a) Add to existing `decisions:list` CLI output, (b) New `decisions:savings` subcommand, (c) Write to a file. Recommendation: (b) new subcommand — keeps it discoverable and separate.

## Sources

### Primary (HIGH confidence)
- **All 44 workflow files** in `workflows/` — read in full, each one audited for LLM-derivable logic
- **`src/lib/decision-rules.js`** — 12 decision functions and registry (467 lines)
- **`src/plugin/command-enricher.js`** — enrichment pipeline and decision injection (230 lines)
- **`plugin.js`** — built bundle showing full enrichment flow (2900+ lines)
- **Phase 110 RESEARCH.md** — candidates identified and validated
- **Phase 111 SUMMARYs** — what was built (rules, CLI, enricher integration)

### Secondary (MEDIUM confidence)
- **Phase 110 research candidate list** — cross-referenced against current workflow state
- **Token savings estimates** — based on LLM reasoning step counts, not runtime measurement

## Metadata

**Confidence breakdown:**
- Workflow audit: HIGH (every workflow read and analyzed line by line)
- Decision rule mapping: HIGH (rules are code, mapping is deterministic)
- Enrichment gaps: HIGH (compared rule inputs against enricher output)
- LLM call savings estimates: MEDIUM (based on reasoning step counts, not runtime telemetry)
- Scope estimate: HIGH (small, well-defined changes following proven patterns)

**Research date:** 2026-03-13
**Valid until:** Phase 112 completion
