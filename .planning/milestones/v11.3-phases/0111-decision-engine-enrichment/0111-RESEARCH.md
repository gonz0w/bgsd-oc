# Phase 111: Decision Engine & Enrichment - Research

**Researched:** 2026-03-13
**Domain:** Programmatic decision infrastructure — shared rules module, in-process engine, CLI introspection, confidence-gated fallback
**Confidence:** HIGH

## Summary

Phase 111 builds the programmatic decision infrastructure for bGSD. Phase 110 produced two artifacts: (1) an `audit:scan` CLI command (`src/commands/audit.js`) that identifies 87 decision candidates across 44 workflows and 10 agents, and (2) `.planning/audit-catalog.json` containing those 87 candidates with rubric scores and token estimates. Of these, 85 are offloadable (pass the 3 critical rubric criteria: finite inputs, deterministic output, no NLU needed); 2 are kept in LLM (severity classification requiring natural language understanding).

The 85 offloadable candidates break down into 5 categories: workflow-routing (71 candidates, ~19.8K tokens/session), execution-mode (4, ~1.2K), state-assessment (3, ~1.1K), template-selection (7, ~317), and severity-classification (0 offloadable, 2 keep-in-LLM). However, the vast majority of these "candidates" are instances of the same **pattern** repeated across workflows — specifically, the `<bgsd-context>` presence check ("If no `<bgsd-context>` found: Stop") and the routing tables that branch on structured data (file counts, boolean flags, phase numbers). There are roughly **12-15 unique decision types** that appear in 85 locations.

The codebase already has a proven architecture for exactly this kind of offloading: the `command-enricher.js` plugin pre-computes values and injects them as `<bgsd-context>` JSON, and `init.js` command handlers resolve models, compute phase data, and classify tasks. Phase 111's job is to formalize this into a shared rules module with a consistent contract (`{value, confidence}`), expose it via CLI for debugging, and wire it into the existing hook system for in-process evaluation.

**Primary recommendation:** Create `src/lib/decision-rules.js` containing pure decision functions organized by category. Create `src/commands/decisions.js` for CLI access. Wire the engine into `command-enricher.js` to evaluate rules during existing hook execution. Use the existing `contractCheck()` helper from `tests/helpers.cjs` for contract tests. Each decision returns `{value, confidence, rule_id}` where confidence is HIGH (authoritative), MEDIUM (suggest, LLM may override), or LOW (fallback to LLM).

<phase_requirements>

## Phase Requirements

| ID | Requirement | Implementation Approach |
|-----|------------|------------------------|
| ENGINE-01 | Shared decision-rules.js module provides pure functions for deterministic decisions | Create `src/lib/decision-rules.js` with lookup tables, scoring functions, and template functions organized by category |
| ENGINE-02 | Plugin decision engine makes in-process decisions via existing hooks without subprocess overhead | Extend `command-enricher.js` to call decision-rules.js during `command.execute.before` hook — no new hooks needed |
| ENGINE-03 | CLI decisions command allows querying and debugging decision logic | Create `src/commands/decisions.js` with `decisions:list`, `decisions:inspect`, `decisions:evaluate` subcommands |
| ENGINE-04 | Progressive confidence model (HIGH/MEDIUM/LOW) gates decisions | Every rule function returns `{value, confidence, rule_id}` — engine respects confidence level in enrichment |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | built-in | All decision logic, fs, path | Zero-dependency project constraint |
| `src/lib/constants.js` MODEL_PROFILES | existing | Model selection lookup table | Already proven; the canonical example of a decision-as-data pattern |
| `src/lib/helpers.js` resolveModelInternal | existing | Model resolution with overrides | Proven decision function pattern: check override → check profile → fallback |
| `src/plugin/command-enricher.js` | existing | Hook-based context injection | The integration point for in-process decision evaluation |
| `src/lib/orchestration.js` classifyPlan | existing | Task complexity classification | Proven pure-function decision that returns structured output |
| `src/lib/output.js` output() | existing | Structured JSON/TTY dual-mode output | Standard output pattern for all CLI commands |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/format.js` | existing | Tables, colors, banners | For TTY-formatted decisions output |
| `src/lib/config.js` loadConfig | existing | Config reading | When decisions depend on user config |
| `tests/helpers.cjs` contractCheck | existing | Contract validation | For all decision output contract tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `decision-rules.js` | Multiple category-specific files | Single file follows `audit.js` and `orchestration.js` conventions; splitting adds import complexity with no real benefit at this scale |
| New `decisions` CLI namespace | Adding to `util` namespace | Separate namespace is cleaner for a self-contained domain, following `audit` namespace precedent |
| Extending enricher directly with decision logic | Separate engine module | Separation keeps enricher thin (hook glue) and rules module pure (testable functions) |

## Architecture Patterns

### Recommended Project Structure

```
src/lib/decision-rules.js     # Pure decision functions + rule registry (ENGINE-01)
src/commands/decisions.js      # CLI command handlers (ENGINE-03)
src/router.js                  # Add 'decisions' namespace (ENGINE-03)
src/plugin/command-enricher.js # Import and call engine during hook (ENGINE-02)
tests/decisions.test.cjs       # Contract tests for all decision outputs (SC-5)
```

### Pattern 1: Decision Function Contract

Every decision function follows the same signature and return shape:

```javascript
// In decision-rules.js
/**
 * @param {object} state - Structured input (from init/enricher data)
 * @returns {{ value: *, confidence: 'HIGH'|'MEDIUM'|'LOW', rule_id: string, metadata?: object }}
 */
function resolveProgressRoute(state) {
  // state: { plan_count, summary_count, uat_gap_count, current_phase, highest_phase }
  if (state.uat_gap_count > 0) return { value: 'E', confidence: 'HIGH', rule_id: 'progress-route' };
  if (state.summary_count < state.plan_count) return { value: 'A', confidence: 'HIGH', rule_id: 'progress-route' };
  if (state.summary_count === state.plan_count && state.plan_count > 0) {
    if (state.current_phase < state.highest_phase) return { value: 'C', confidence: 'HIGH', rule_id: 'progress-route' };
    return { value: 'D', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (state.plan_count === 0) return { value: 'B', confidence: 'HIGH', rule_id: 'progress-route' };
  return { value: 'F', confidence: 'MEDIUM', rule_id: 'progress-route' }; // between-milestones — less certain
}
```

### Pattern 2: Rule Registry (enables CLI introspection)

```javascript
// In decision-rules.js
const DECISION_REGISTRY = [
  {
    id: 'progress-route',
    name: 'Progress Workflow Route Selection',
    category: 'workflow-routing',
    description: 'Determines which route (A-F) the progress workflow should take',
    inputs: ['plan_count', 'summary_count', 'uat_gap_count', 'current_phase', 'highest_phase'],
    outputs: ['route_letter'],
    confidence_range: ['HIGH', 'MEDIUM'],
    resolve: resolveProgressRoute,
  },
  // ... more entries
];
```

### Pattern 3: Engine Evaluation in Enricher (ENGINE-02)

```javascript
// In command-enricher.js (existing hook, no new subprocess)
import { evaluateDecisions } from '../lib/decision-rules.js';

export function enrichCommand(input, output, cwd) {
  // ... existing enrichment logic ...

  // Evaluate applicable decisions for this command
  const decisions = evaluateDecisions(command, enrichment);
  if (decisions && Object.keys(decisions).length > 0) {
    enrichment.decisions = decisions;
  }

  // ... existing output injection ...
}
```

### Pattern 4: CLI Introspection (ENGINE-03)

```javascript
// decisions:list → Show all registered rules with metadata
// decisions:inspect <rule_id> → Show rule details, inputs, outputs, confidence range
// decisions:evaluate <rule_id> [--state <json>] → Run rule against given state, show result
```

### Anti-Patterns to Avoid

1. **Don't put business logic in the enricher** — The enricher calls `evaluateDecisions()` but the rules live in `decision-rules.js`. The enricher is glue code, not a rules engine.
2. **Don't create a generic rule engine (json-rules-engine, etc.)** — REQUIREMENTS.md explicitly puts this in "Out of Scope." Plain JS functions are the rule format.
3. **Don't try to handle NLU decisions** — The 2 keep-in-LLM candidates (severity inference from user text) stay in the LLM. The confidence model accommodates this: LOW confidence = LLM handles it.
4. **Don't break existing init command contracts** — The decisions field is additive to `<bgsd-context>`. Existing fields remain untouched. Contract tests for existing init commands must still pass.
5. **Don't make the enricher slow** — Decision evaluation must be synchronous, pure, and fast. No file I/O in decision functions; they receive pre-computed state as input.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model resolution | Custom model lookup in decision-rules | `resolveModelInternal()` | Already proven, handles overrides + profiles |
| Config reading | Custom config parser | `loadConfig()` | Handles defaults + schema validation |
| Phase directory lookup | Custom dir finder | `findPhaseInternal()` / enricher's `resolvePhaseDir()` | Already handles padding + fallback |
| JSON output | Custom formatter | `output()` from output.js | Handles TTY/JSON dual-mode automatically |
| Contract testing | Custom assertion helper | `contractCheck()` from tests/helpers.cjs | Already validated in 12+ existing contract tests |
| Command routing | Custom CLI parser | Router namespace pattern | Add `decisions` namespace to `KNOWN_NAMESPACES` like `audit` was added |

## Common Pitfalls

### Pitfall 1: Trying to offload ALL 85 candidates immediately

**What goes wrong:** 85 candidates sounds like 85 decision functions. But most are the same pattern repeated (e.g., `<bgsd-context>` presence check appears in ~30 workflows).
**Why it happens:** Treating each catalog entry as a unique decision instead of recognizing pattern families.
**How to avoid:** Group candidates by decision type, not by source location. ~12-15 unique decision functions cover all 85 candidate locations. The registry maps rule_id to source locations.
**Warning signs:** decision-rules.js has >30 functions that are nearly identical.

### Pitfall 2: Putting decision evaluation in a subprocess

**What goes wrong:** ENGINE-02 requires "no new subprocess overhead." If decisions are evaluated via `node bgsd-tools.cjs decisions:evaluate`, that's a subprocess — the opposite of the requirement.
**Why it happens:** Following the CLI command pattern instead of the enricher pattern.
**How to avoid:** Decision evaluation happens in-process via `command-enricher.js` calling `decision-rules.js` directly. The CLI command is for debugging/inspection only.
**Warning signs:** Workflows contain `$(node ... decisions:evaluate ...)` calls.

### Pitfall 3: Breaking existing enrichment contracts

**What goes wrong:** Adding a `decisions` field to `<bgsd-context>` JSON changes the shape of what workflows receive. If a workflow parses the JSON strictly, it could break.
**Why it happens:** Assuming workflows only look at specific fields.
**How to avoid:** Verify that no workflow parses `<bgsd-context>` in a way that would break with additional fields. Existing workflows use `Extract from <bgsd-context> JSON: <field_list>` — they cherry-pick fields and ignore extras. This is additive-safe.
**Warning signs:** Workflow parsing fails or behaves differently after adding decisions field.

### Pitfall 4: Confidence model that never returns MEDIUM or LOW

**What goes wrong:** If every decision returns HIGH confidence, the progressive confidence model is technically compliant but practically useless — there's no LLM escape hatch.
**Why it happens:** Developer assigns HIGH to everything because the code "knows the answer."
**How to avoid:** Use MEDIUM for decisions where edge cases exist (e.g., between-milestones state detection, next-action routing with ambiguous state). Use LOW for decisions where the code provides a reasonable default but the LLM should verify (e.g., commit type selection if it were offloaded).
**Warning signs:** 100% of decisions return HIGH confidence.

### Pitfall 5: Forgetting to register decisions in the audit namespace cleanup

**What goes wrong:** Phase 110 created `audit:scan`. Phase 111 creates `decisions:*`. But `audit:scan` still exists and produces the catalog. If Phase 111 doesn't clarify the relationship, users have two overlapping inspection tools.
**Why it happens:** Phase 111 builds new infrastructure without considering the audit tool's continued role.
**How to avoid:** `audit:scan` remains as-is — it scans for candidates. `decisions:*` inspects implemented rules. They're complementary: audit finds opportunities, decisions shows what's been built. Document this relationship in the CLI help.
**Warning signs:** Users confused about whether to use `audit:scan` or `decisions:list`.

## Code Examples

### Example 1: Progress Route Decision (HIGH priority, ~4.2K tokens/session)

The progress workflow has the highest token impact. Its routing table (Routes A-F) is currently evaluated by the LLM from file counts. This is the canonical decision to offload:

```javascript
// decision-rules.js — progress route
function resolveProgressRoute({ plan_count, summary_count, uat_gap_count, current_phase, highest_phase, roadmap_exists, project_exists, state_exists }) {
  if (!state_exists && !roadmap_exists && !project_exists) return { value: 'no-project', confidence: 'HIGH', rule_id: 'progress-route' };
  if (!state_exists) return { value: 'no-state', confidence: 'HIGH', rule_id: 'progress-route' };
  if (!roadmap_exists && project_exists) return { value: 'F', confidence: 'HIGH', rule_id: 'progress-route' };
  if (uat_gap_count > 0) return { value: 'E', confidence: 'HIGH', rule_id: 'progress-route' };
  if (summary_count < plan_count) return { value: 'A', confidence: 'HIGH', rule_id: 'progress-route' };
  if (summary_count === plan_count && plan_count > 0) {
    return current_phase < highest_phase
      ? { value: 'C', confidence: 'HIGH', rule_id: 'progress-route' }
      : { value: 'D', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (plan_count === 0) return { value: 'B', confidence: 'HIGH', rule_id: 'progress-route' };
  return { value: 'F', confidence: 'MEDIUM', rule_id: 'progress-route' };
}
```

### Example 2: Execution Pattern Selection (execute-plan.md)

```javascript
// decision-rules.js — execution pattern
function resolveExecutionPattern({ task_types }) {
  // task_types: array of type strings from parseTasksFromPlan()
  const hasDecisionCheckpoints = task_types.some(t => t.startsWith('checkpoint:decision'));
  const hasVerifyCheckpoints = task_types.some(t => t.startsWith('checkpoint:') && !t.startsWith('checkpoint:decision'));
  
  if (hasDecisionCheckpoints) return { value: 'C', confidence: 'HIGH', rule_id: 'execution-pattern' };
  if (hasVerifyCheckpoints) return { value: 'B', confidence: 'HIGH', rule_id: 'execution-pattern' };
  return { value: 'A', confidence: 'HIGH', rule_id: 'execution-pattern' };
}
```

### Example 3: Existing Pattern — resolveModelInternal (already offloaded)

This function in `helpers.js:325` is the exact pattern that decision-rules.js should follow:

```javascript
function resolveModelInternal(cwd, agentType) {
  const config = loadConfig(cwd);
  // Check per-agent override first
  const override = config.model_overrides?.[agentType];
  if (override) return override === 'opus' ? 'inherit' : override;
  // Fall back to profile lookup
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  return resolved === 'opus' ? 'inherit' : resolved;
}
```

If this were a Phase 111 decision rule, it would return `{ value: 'sonnet', confidence: 'HIGH', rule_id: 'model-resolution' }`. It already is a decision function — just without the standardized contract.

### Example 4: Contract Test Pattern (from tests/contracts.test.cjs)

```javascript
// Contract test for a decision
test('progress-route decision returns valid contract', () => {
  const result = resolveProgressRoute({
    plan_count: 3, summary_count: 1, uat_gap_count: 0,
    current_phase: 5, highest_phase: 8,
    roadmap_exists: true, project_exists: true, state_exists: true,
  });
  
  const contract = contractCheck(result, [
    { key: 'value', type: 'string' },
    { key: 'confidence', type: 'string' },
    { key: 'rule_id', type: 'string' },
  ], 'progress-route-decision');
  assert.ok(contract.pass, contract.message);
  assert.ok(['A', 'B', 'C', 'D', 'E', 'F', 'no-project', 'no-state'].includes(result.value));
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.confidence));
});
```

## Codebase Integration Map

### Where decision-rules.js gets called

1. **`src/plugin/command-enricher.js`** (ENGINE-02): Import `evaluateDecisions()`, call during existing `command.execute.before` hook. Add `decisions` field to enrichment JSON. This is the primary runtime path.

2. **`src/commands/decisions.js`** (ENGINE-03): Import rule registry, provide CLI access for `decisions:list`, `decisions:inspect <id>`, `decisions:evaluate <id> --state '{...}'`.

3. **`src/router.js`** (ENGINE-03): Add `decisions` namespace to `KNOWN_NAMESPACES` array and add routing case. Follow the `audit` namespace pattern exactly.

### Where decision inputs come from

Decision functions receive a state object assembled from data the enricher/init already computes:

| Input Source | Already Computed In | Used By Decisions |
|-------------|--------------------|--------------------|
| plan_count, summary_count | `parsePlans()` in command-enricher | progress-route |
| uat_gap_count | File listing in phase dir | progress-route |
| current_phase, highest_phase | `getProjectState()` + roadmap parsing | progress-route, next-action |
| task_types | `parseTasksFromPlan()` in orchestration.js | execution-pattern |
| state_exists, roadmap_exists | `pathExistsInternal()` | progress-route, resume-route |
| bgsd_context_present | Always true in enricher (the enricher is running) | context-gate (trivial) |
| config flags | `loadConfig()` | auto-advance, ci-gate |

### Files modified by Phase 111

| File | Change | Impact |
|------|--------|--------|
| `src/lib/decision-rules.js` | **NEW** — Rule functions + registry | Core module (ENGINE-01) |
| `src/commands/decisions.js` | **NEW** — CLI command handlers | CLI access (ENGINE-03) |
| `src/plugin/command-enricher.js` | **MODIFY** — Import and call engine | In-process integration (ENGINE-02) |
| `src/router.js` | **MODIFY** — Add decisions namespace + lazy loader | CLI routing |
| `src/lib/constants.js` | **MODIFY** — Add COMMAND_HELP entries for decisions:* | Help text |
| `src/lib/commandDiscovery.js` | **MODIFY** — Add decisions commands to categories | Discoverability |
| `tests/decisions.test.cjs` | **NEW** — Contract tests for all decision rules | Regression prevention (SC-5) |
| `bin/bgsd-tools.cjs` | **REBUILD** — Bundle includes new modules | Built artifact |

## Decision Candidate Analysis: From 85 Locations to ~12 Rules

Grouping the 85 offloadable candidates by unique decision type:

| Rule ID | Decision Type | Candidate Count | Token Impact | Confidence |
|---------|--------------|-----------------|--------------|------------|
| `context-gate` | bgsd-context presence check | ~30 | ~10.5K | HIGH (trivial boolean) |
| `progress-route` | Progress workflow Routes A-F | 5 | ~4.2K | HIGH |
| `resume-route` | Resume project next-action | 5 | ~1.8K | MEDIUM (state can be ambiguous) |
| `execution-pattern` | Execute-plan Pattern A/B/C | 1 | ~700 | HIGH |
| `context-budget-gate` | Context budget warning check | 1 | ~700 | HIGH |
| `previous-check-gate` | Previous SUMMARY blocker check | 1 | ~700 | HIGH |
| `ci-gate` | CI quality gate enabled check | 2 | ~700 | HIGH |
| `plan-existence-route` | Phase has plans / needs planning | 4 | ~700 | HIGH |
| `branch-handling` | Branch merge strategy selection | 1 | ~350 | MEDIUM (user pref dependent) |
| `auto-advance` | Auto-advance config check | 2 | ~210 | HIGH |
| `phase-arg-parse` | Phase number from arguments | 3 | ~315 | HIGH (already done by enricher) |
| `debug-handler-route` | Debug return handling (fix/plan/manual) | 2 | ~46 | MEDIUM (depends on return shape) |

**Total unique rules:** ~12
**Total candidate locations covered:** 85
**Total estimated token savings:** ~21K tokens/session

Note: `context-gate` is the biggest single savings because it appears in ~30 workflows. But it's also the most trivial decision: "Is `<bgsd-context>` present?" The enricher always provides it, so workflows could simply assume its presence when the plugin is loaded. This is really a Phase 112 workflow simplification concern — Phase 111 creates the rule and makes it available in the `decisions` field.

## Open Questions

1. **Should `context-gate` be a real decision rule or just documentation?** — The bgsd-context presence check is always true when the enricher runs. Creating a decision rule for it adds ~30 entries to the registry but the "decision" is trivially resolved. Recommendation: include it as a rule (it's cheap, keeps the catalog count accurate), but mark it as `confidence: HIGH` with a note that workflows can be simplified in Phase 112 to remove the check entirely.

2. **Should the enricher import decision-rules.js as ESM or CJS?** — The enricher is an ESM module (`import` syntax). decision-rules.js will be in `src/lib/` which uses CJS (`module.exports`). The build step (esbuild) handles this — during build, CJS is bundled into the ESM output. During tests, the CJS files are loaded directly with `require()`. Follow the existing pattern: `src/lib/` files use CJS, `src/plugin/` files use ESM, esbuild resolves the mismatch.

3. **How many rules should be implemented in Phase 111 vs Phase 112?** — Phase 111 creates the infrastructure and implements the rules. Phase 112 wires them into workflows (simplifying workflow .md files to consume pre-computed decisions). Recommendation: Phase 111 implements ALL ~12 rules and exposes them via CLI and enricher. Phase 112 focuses on workflow simplification and telemetry.

4. **Should audit.js and audit-catalog.json be kept or removed?** — Phase 110's CONTEXT.md said "remove old audit scanner artifacts." But the rescoped Phase 110 research recommended keeping the audit tool as complementary to the decisions tool. The audit tool finds candidates; the decisions tool inspects implemented rules. Recommendation: keep `audit:scan` and `audit-catalog.json` for now. Removal can be a Phase 112 cleanup task if desired.

## Sources

### Primary (HIGH confidence)
- **Direct codebase analysis:** All source files in `src/`, `src/lib/`, `src/commands/`, `src/plugin/`, `tests/`
- `src/plugin/command-enricher.js` — The integration point for in-process decisions (221 lines, complete read)
- `src/plugin/index.js` — Plugin hook registration (155 lines, complete read)
- `src/commands/init.js` — Model resolution, enrichment computation (1883 lines, key sections read)
- `src/router.js` — Namespace routing pattern (1316 lines, namespace sections read)
- `src/lib/helpers.js` — `resolveModelInternal()` as canonical decision pattern (1022 lines, key sections read)
- `src/lib/orchestration.js` — `parseTasksFromPlan()`, `classifyPlan()` as decision function patterns
- `src/lib/constants.js` — MODEL_PROFILES lookup table, CONFIG_SCHEMA, COMMAND_HELP patterns
- `tests/contracts.test.cjs` — Contract testing patterns with `contractCheck()` and `snapshotCompare()`
- `tests/helpers.cjs` — Test infrastructure (`runGsdTools`, `createTempProject`, `contractCheck`)
- `.planning/audit-catalog.json` — 87 candidates, 85 offloadable, category and token analysis

### Secondary (MEDIUM confidence)
- `.planning/phases/0110-audit-decision-framework/0110-RESEARCH.md` — Phase 110 candidate analysis (5 concrete candidates, NOT a candidate analysis)
- `.planning/phases/0110-audit-decision-framework/0110-CONTEXT.md` — Rescoping decisions and constraints
- `.planning/REQUIREMENTS.md` — ENGINE-01 through ENGINE-04 requirement definitions

### Tertiary (LOW confidence)
- Token savings estimates from audit catalog — Based on static midpoint model, not runtime telemetry

## Metadata

**Confidence breakdown:**
- Architecture patterns: HIGH (every pattern follows existing proven codebase conventions)
- Rule identification (12 unique rules from 85 candidates): HIGH (systematic grouping by decision type)
- Integration points (enricher, router, tests): HIGH (direct code analysis of exact integration files)
- Token savings estimates: LOW (inherited from Phase 110 audit catalog's static model)
- Confidence level assignments for individual rules: MEDIUM (edge cases in MEDIUM-confidence rules may need adjustment during implementation)

**Research date:** 2026-03-13
**Valid until:** Phase 111 completion (dependent on codebase structure remaining stable)
