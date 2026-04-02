# Engineering Design Document: Code Simplification Engine

**Document:** EDD-002
**Author:** Cam / Claude (collaborative)
**Status:** Draft — ready for milestone creation
**Scope:** bgsd-oc harness — new `simplify` step in execute-phase workflow
**Date:** 2026-04-01
**Depends on:** EDD-001 (Development Practices Stack) — contract validation is used as a simplification safety gate

---

## 1. Executive Summary

After execution completes and before verification runs, bGSD currently hands code directly to the verifier. The verifier checks *what exists* — but nobody checks whether what exists is *as simple as it could be*. Agents tend to produce correct-but-verbose code: extra abstractions, redundant helpers, over-parameterized functions, defensive patterns that duplicate what callers already guarantee.

This EDD adds a **simplification pass** between execution and verification in the `execute-phase` workflow. The pass is powered by a deterministic CLI analysis command (`simplify:analyze`) that scans the phase's changed files and produces a scored list of simplification opportunities. If opportunities exist above a configurable threshold, the workflow auto-generates a `type: refactor` plan and spawns the executor to simplify. The loop runs up to 3 iterations, then verification runs against the simplified code.

The methodological foundation is Kent Beck's Four Rules of Simple Design, Sandi Metz's structural constraints, and SonarSource's Cognitive Complexity metric. These are not philosophies the agent interprets — they're measurable rules the CLI enforces.

**No new agent roles.** The executor simplifies. The CLI analyzes. A new skill provides the methodology. This follows bGSD's "intelligence as data, not agents" principle.

---

## 2. Methodological Foundations

### 2.1 Kent Beck's Four Rules of Simple Design

Formulated alongside TDD, ordered by priority:

1. **Passes the tests** — Non-negotiable. Simplification never changes behavior.
2. **Reveals intention** — Names, structure, and organization make the code's purpose obvious.
3. **No duplication** — DRY applied at the right granularity. Not premature abstraction — actual repeated logic.
4. **Fewest elements** — Minimum functions, modules, parameters, and indirection layers to accomplish the job.

The TDD REFACTOR step already addresses these within a single feature. The simplification pass addresses them across an entire phase's output, where cross-cutting redundancy becomes visible.

### 2.2 Sandi Metz's Rules (Adapted for JS)

Measurable structural constraints the CLI can enforce:

| Rule | Threshold | Rationale |
|------|-----------|-----------|
| Function length | ≤ 15 lines | Forces decomposition at natural boundaries |
| Parameter count | ≤ 4 parameters | Signals missing abstraction (use an options object) |
| Module length | ≤ 200 lines | Prevents god modules; aligns with bGSD's existing source structure |
| Nesting depth | ≤ 3 levels | Forces early returns and guard clauses |

These are **advisory thresholds**, not hard blockers. The CLI reports violations; the executor decides whether to act.

### 2.3 Cognitive Complexity (SonarSource)

bGSD already computes **cyclomatic complexity** in `src/lib/ast.js` via `walkComplexity()` using acorn. Cyclomatic complexity counts execution paths. Cognitive complexity measures how hard code is to *understand* — it's the metric that correlates with "this feels overcomplicated."

Key differences from cyclomatic:

| Construct | Cyclomatic | Cognitive |
|-----------|-----------|-----------|
| `if` | +1 | +1 (+ nesting increment) |
| `else if` | +1 | +1 (no extra nesting penalty) |
| `else` | 0 | +1 |
| Nested `if` inside `if` | +1 | +2 (nesting penalty) |
| `&&` / `||` chain | +1 per operator | +1 per *sequence change* |
| `switch` | +1 per case | +1 total (linear, easy to read) |
| Recursion | 0 | +1 (harder to reason about) |
| `break`/`continue` to label | 0 | +1 (non-linear flow) |

**Threshold:** Cognitive complexity per function ≤ 8. This is the industry standard from SonarQube's default ruleset.

### 2.4 The Simplification Hierarchy

When the executor runs a simplification pass, it follows this priority order. Each level is cheaper and safer than the next:

```
1. Dead code removal          — Zero risk. Remove unused imports, unreachable branches, orphaned helpers.
2. Duplication extraction     — Low risk. Identical logic in multiple locations → shared function.
3. Complexity reduction       — Medium risk. Flatten nesting, extract early returns, simplify conditionals.
4. Naming and clarity         — Low risk. Rename unclear variables/functions to reveal intent.
5. Structural simplification  — Higher risk. Inline single-use abstractions, collapse unnecessary layers.
```

The executor works top-to-bottom, running tests after each change. If a simplification breaks tests, it's reverted immediately — no debugging, no iteration, just revert and move to the next opportunity.

---

## 3. Where It Fits in the Workflow

### 3.1 Insertion Point

The simplification step is inserted into `workflows/execute-phase.md` between `aggregate_results` and `ci_quality_gate` / `verify_phase_goal`:

```
initialize
  → preflight checks
  → discover and group plans
  → execute waves (spawn executors per plan)
  → aggregate results
  → *** SIMPLIFY PHASE OUTPUT ***    ← NEW STEP
  → CI quality gate (if enabled)
  → verify phase goal (spawn verifier)
  → update roadmap
  → offer next
```

### 3.2 Why Here, Not Elsewhere

**Why not after verification?**
Verification would check the pre-simplified code, then simplification would change it, requiring re-verification. That doubles the cost and creates an awkward state where "verified" code has been modified.

**Why not per-plan inside execution?**
The TDD REFACTOR step already handles per-feature cleanup. The value of the simplification pass is seeing *across* plans — duplication between Plan 01 and Plan 02 is invisible to either executor. The phase-level view is where cross-cutting simplification becomes possible.

**Why not as a separate command?**
Making it part of `execute-phase` means it runs automatically. A separate `/bgsd-simplify` command would require the user to remember to run it. The always-on default with configurable skip (`--skip-simplify`) is safer.

### 3.3 Workflow Integration Detail

New step in `execute-phase.md` between `aggregate_results` and `ci_quality_gate`:

```markdown
<step name="simplify_phase_output">
## Simplify Phase Output

Skip if `--skip-simplify` flag is set or `config.simplify.enabled` is false.

1. Collect all files modified during this phase's execution:
   ```bash
   MODIFIED=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs simplify:files "${PHASE_NUMBER}")
   ```

2. Run simplification analysis:
   ```bash
   ANALYSIS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs simplify:analyze \
     --phase "${PHASE_NUMBER}" \
     --threshold "${SIMPLIFY_THRESHOLD:-medium}" \
     --raw)
   ```

3. Check if simplification is warranted:
   - Parse `opportunities_count` and `total_score` from analysis JSON
   - If `opportunities_count` is 0: skip, log "✓ Code already clean — no simplification needed"
   - If `total_score` below threshold: skip, log "✓ Simplification score below threshold — skipping"
   - If warranted: proceed to step 4

4. Auto-generate simplification plan:
   ```bash
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs simplify:plan \
     --phase "${PHASE_NUMBER}" \
     --analysis "$ANALYSIS"
   ```
   This writes a `{phase_dir}/XX-simplify-PLAN.md` with `type: refactor`.

5. Spawn executor with simplification skill:
   ```
   Task(
     subagent_type="bgsd-executor", model="{executor_model}",
     prompt="
       <objective>
       Simplify phase ${PHASE_NUMBER} code. This is a refactor-only pass.
       Tests must stay green. Contracts must stay valid. No behavior changes.
       </objective>

       <execution_context>
       @__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-plan.md
       @__OPENCODE_CONFIG__/bgsd-oc/skills/simplification/SKILL.md
       </execution_context>

       <simplification_analysis>
       ${ANALYSIS}
       </simplification_analysis>

       <files_to_read>
       - ${phase_dir}/${simplify_plan} (Simplification plan)
       - .planning/STATE.md
       </files_to_read>

       <hard_rules>
       - NEVER change behavior. If a test breaks, revert immediately.
       - NEVER modify test files. Tests are the safety net, not the target.
       - NEVER reduce test coverage.
       - NEVER break a contract (if contracts from EDD-001 are implemented).
       - Work top-to-bottom through the simplification hierarchy.
       - Commit with: refactor({phase}): simplify {description}
       </hard_rules>
     "
   )
   ```

6. Re-analyze after simplification:
   ```bash
   REANALYSIS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs simplify:analyze \
     --phase "${PHASE_NUMBER}" --raw)
   ```
   - If `opportunities_count` > 0 AND iteration < 3 AND score improved: loop to step 4
   - Otherwise: exit loop, log simplification summary

7. Write simplification report:
   ```bash
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs simplify:report \
     --phase "${PHASE_NUMBER}" \
     --before "$ANALYSIS" \
     --after "$REANALYSIS"
   ```
   Creates `{phase_dir}/SIMPLIFICATION.md` with before/after metrics.

8. Write handoff artifact for verification chain:
   ```bash
   node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
     --phase "${PHASE_NUMBER}" \
     --step simplify \
     --summary "Simplification complete for Phase ${PHASE_NUMBER}" \
     --next-command "/bgsd-verify-work ${PHASE_NUMBER}"
   ```
</step>
```

---

## 4. CLI Commands

### 4.1 New Namespace: `simplify:`

All commands live in a new `src/commands/simplify.js` module, following the existing pattern (synchronous, JSON output, zero external dependencies at runtime).

#### `simplify:files <phase>`

Returns JSON array of all files modified during the phase's execution. Derived from git history (jj log) filtered to phase commits.

```json
{
  "phase": "05-auth",
  "files": [
    "src/auth/login.js",
    "src/auth/register.js",
    "src/auth/session.js",
    "src/auth/hash.js",
    "test/auth/login.test.js",
    "test/auth/register.test.js"
  ],
  "source_files": 4,
  "test_files": 2
}
```

**Note:** Test files are included in the listing but excluded from simplification targets. They're used for reference only (the executor needs to know which tests to run).

#### `simplify:analyze --phase <N> [--threshold low|medium|high] [--files <paths>]`

The core analysis command. Scans source files, computes metrics, identifies opportunities. Returns structured JSON.

**Analysis pipeline:**

```
For each source file modified in the phase:
  1. Parse AST (acorn, reuse existing ast.js)
  2. Compute per-function metrics:
     - Cyclomatic complexity (existing walkComplexity)
     - Cognitive complexity (NEW — see §4.2)
     - Line count
     - Parameter count
     - Nesting depth (existing walkComplexity)
  3. Detect duplication (cross-file, within-file)
  4. Detect dead code (unused exports, unreachable branches)
  5. Check Metz thresholds
  6. Score and rank opportunities
```

**Output:**

```json
{
  "phase": "05-auth",
  "files_analyzed": 4,
  "metrics": {
    "total_cognitive_complexity": 47,
    "avg_cognitive_complexity_per_fn": 5.2,
    "max_cognitive_complexity": 14,
    "total_functions": 9,
    "total_lines": 342,
    "metz_violations": 3
  },
  "opportunities": [
    {
      "id": "OPP-001",
      "type": "duplication",
      "priority": 1,
      "score": 8,
      "files": ["src/auth/login.js", "src/auth/register.js"],
      "description": "validateEmail() — identical 12-line function in both files",
      "suggestion": "Extract to src/auth/validation.js",
      "lines_saved_estimate": 12
    },
    {
      "id": "OPP-002",
      "type": "complexity",
      "priority": 3,
      "score": 6,
      "file": "src/auth/session.js",
      "function": "refreshToken",
      "cognitive_complexity": 14,
      "threshold": 8,
      "description": "refreshToken has cognitive complexity 14 (threshold: 8)",
      "suggestion": "Extract early returns for error cases, split token validation from refresh logic"
    },
    {
      "id": "OPP-003",
      "type": "dead_code",
      "priority": 1,
      "score": 3,
      "file": "src/auth/hash.js",
      "description": "hashLegacy() — exported but not imported anywhere in the codebase",
      "suggestion": "Remove function and its export"
    },
    {
      "id": "OPP-004",
      "type": "metz_violation",
      "priority": 2,
      "score": 4,
      "file": "src/auth/session.js",
      "function": "refreshToken",
      "rule": "function_length",
      "actual": 28,
      "limit": 15,
      "description": "refreshToken is 28 lines (limit: 15)",
      "suggestion": "Decompose into refreshToken + validateRefreshToken + issueNewToken"
    },
    {
      "id": "OPP-005",
      "type": "over_abstraction",
      "priority": 5,
      "score": 2,
      "file": "src/auth/factory.js",
      "description": "AuthStrategyFactory has a single concrete implementation",
      "suggestion": "Inline the factory — direct instantiation is simpler"
    }
  ],
  "opportunities_count": 5,
  "total_score": 23,
  "threshold_applied": "medium",
  "threshold_value": 10,
  "simplification_warranted": true
}
```

**Threshold levels:**

| Level | Min Score | When to Use |
|-------|----------|-------------|
| `low` | 5 | Aggressive simplification — catch everything |
| `medium` | 10 | Default — significant opportunities only |
| `high` | 20 | Conservative — only major issues |

#### `simplify:plan --phase <N> --analysis <json>`

Auto-generates a `type: refactor` plan from the analysis output. The plan groups opportunities by the simplification hierarchy (dead code first, then duplication, then complexity, etc.) and creates one task per group.

**Output:** Writes `{phase_dir}/XX-simplify-PLAN.md` and returns the plan path.

#### `simplify:report --phase <N> --before <json> --after <json>`

Creates `{phase_dir}/SIMPLIFICATION.md` with before/after comparison:

```markdown
# Simplification Report — Phase 05-auth

## Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Cognitive complexity (total) | 47 | 31 | -34% |
| Cognitive complexity (max fn) | 14 | 7 | -50% |
| Total lines | 342 | 298 | -13% |
| Metz violations | 3 | 0 | -100% |
| Duplication blocks | 2 | 0 | -100% |
| Dead code items | 1 | 0 | -100% |

## Opportunities Resolved

- OPP-001: Extracted validateEmail() to src/auth/validation.js
- OPP-003: Removed unused hashLegacy()
- OPP-004: Decomposed refreshToken into 3 focused functions

## Opportunities Deferred

- OPP-005: Factory inlining deferred — test structure depends on factory interface

## Iterations

- Pass 1: 5 opportunities found, 3 resolved
- Pass 2: 1 opportunity found (emerged from pass 1 refactor), resolved
- Pass 3: 0 opportunities — clean
```

### 4.2 Cognitive Complexity Implementation

New function in `src/lib/ast.js` alongside the existing `walkComplexity`:

```javascript
function walkCognitiveComplexity(node, nestingLevel = 0) {
  // Returns { cognitive: number, breakdown: [] }
  // Increments:
  //   +1 for: if, else if, else, ternary, switch, for, while, do-while,
  //           catch, &&, ||, ??, break-to-label, continue-to-label, recursion
  //   +nestingLevel for: if, ternary, for, while, do-while, catch, switch
  //           (nesting penalty — deeper = harder to understand)
  //   Sequences of same logical operator (a && b && c) count as +1, not +2
  //   else-if does NOT increment nesting (it's linear, not nested)
}
```

This extends the existing AST infrastructure without modifying `walkComplexity` (cyclomatic is still needed for trajectory metrics).

### 4.3 Duplication Detection

Lightweight approach — no external dependencies, runs inside the deterministic CLI:

1. **AST-level:** Extract function bodies as normalized token sequences (strip whitespace, normalize variable names to positional placeholders). Compare sequences across files using longest common subsequence (LCS). Threshold: ≥ 6 normalized tokens shared = potential duplication.

2. **Line-level fallback (non-JS files):** Sliding window of 3+ consecutive identical non-blank lines across files. Less precise but works for any language.

Both approaches live in a new `src/lib/duplication.js` module.

### 4.4 Dead Code Detection

Extends existing AST export extraction:

1. Parse all source files in the phase's modified set
2. Extract all `module.exports` / `export` declarations
3. For each export, search the codebase for imports/requires of that symbol
4. Exports with zero importers = dead code candidates

**Exclusions:** Entry points (files referenced in `package.json` bin/main), test files, files matching `.config.` patterns.

### 4.5 Over-Abstraction Detection

Heuristics for patterns agents commonly over-produce:

| Pattern | Detection | Score |
|---------|-----------|-------|
| Factory with single implementation | Class/function with "Factory"/"Builder" in name, only one concrete usage | 2 |
| Wrapper that only delegates | Function body is a single return of another function call with same args | 2 |
| Abstract base with one child | Class extended by exactly one subclass | 3 |
| Options object with one field | Function accepts `{ singleField }` — just use a parameter | 1 |
| Re-export barrel with no additions | `index.js` that only re-exports from one file | 1 |

These are scored low intentionally — they're suggestions, not critical fixes.

---

## 5. New Skill: `skills/simplification/SKILL.md`

### 5.1 Skill Metadata

```yaml
---
name: simplification
description: Code simplification methodology for refactor-only passes — priority hierarchy, measurable targets, hard rules, and stop conditions. Used by the executor during the simplify step of execute-phase.
type: shared
agents: [executor]
sections: [executor, planner]
---
```

### 5.2 Skill Content (Executor Section)

**Authority:** This skill is the canonical simplification contract. The executor loads it when spawned for a simplification plan.

**Core identity:** You are simplifying, not reimplementing. You are *removing* code, not *adding* code. The best simplification pass produces a negative line count. If your diff is net-positive, stop and reconsider.

**Simplification hierarchy (work top-to-bottom):**

| Priority | Type | Risk | Action |
|----------|------|------|--------|
| 1 | Dead code removal | Zero | Delete unused imports, unreachable branches, orphaned helpers. No judgment needed. |
| 2 | Duplication extraction | Low | Identical logic in N locations → one shared function. The analysis tells you exactly which code is duplicated. |
| 3 | Complexity reduction | Medium | Flatten nesting via early returns. Split compound conditionals. Extract named boolean expressions. |
| 4 | Naming and clarity | Low | Rename unclear variables/functions. Make the code read like prose. |
| 5 | Structural simplification | Higher | Inline single-use abstractions. Collapse unnecessary indirection layers. Remove factories with one implementation. |

**Per-opportunity workflow:**

```
1. Read the opportunity from the analysis JSON
2. Identify the affected files
3. Make the change (one opportunity at a time)
4. Run tests
5. If tests pass: commit with refactor({phase}): simplify — {description}
6. If tests fail: revert ALL changes for this opportunity. Do not debug. Move to next.
```

**Hard rules:**

- NEVER change behavior. The test suite is your definition of behavior.
- NEVER modify test files. If simplification requires test changes, it's not simplification.
- NEVER reduce test coverage. If a function you're inlining had tests, the tests must still pass against the inlined code.
- NEVER add new dependencies.
- NEVER break a contract file (`.contract.md` interface must still match).
- NEVER simplify code outside the current phase's modified files.
- If an opportunity requires touching code not modified in this phase, skip it.

**Measurable targets:**

| Metric | Target | Source |
|--------|--------|--------|
| Cognitive complexity per function | ≤ 8 | SonarSource default |
| Function length | ≤ 15 lines | Metz (adapted) |
| Parameter count | ≤ 4 | Metz |
| Nesting depth | ≤ 3 | Industry standard |
| Duplication blocks | 0 | Beck Rule 3 |
| Dead code items | 0 | Beck Rule 4 |

**Stop condition:** When `simplify:analyze` returns zero opportunities above threshold, OR 3 iterations reached, whichever comes first.

**Commit format:**

```
refactor({phase}-simplify): {what was simplified}

- {metric before} → {metric after}
- {files affected}

GSD-Step: simplify
Agent-Type: bgsd-executor
```

### 5.3 Skill Content (Planner Section)

The planner does NOT create simplification plans — the `execute-phase` workflow auto-generates them from CLI analysis. However, the planner should be aware that simplification runs after execution:

- Don't over-optimize during planning. Let the simplification pass handle cross-plan cleanup.
- Don't create separate "refactoring" plans for cleanup that simplification would catch.
- If a plan's TDD REFACTOR step is getting complex, defer cross-cutting cleanup to the simplification pass.
- The planner may reference simplification in phase estimates: "simplification adds ~15 min per phase."

---

## 6. Decision Rule: `resolveSimplificationGate`

New function in `src/lib/decision-rules.js`:

```javascript
function resolveSimplificationGate(state) {
  // state: { simplify_enabled, skip_flag, opportunities_count, total_score, threshold, iteration }

  if (!state.simplify_enabled || state.skip_flag) {
    return { value: 'skip', confidence: 'HIGH', rule_id: 'simplify-disabled' };
  }

  if (state.opportunities_count === 0) {
    return { value: 'skip', confidence: 'HIGH', rule_id: 'simplify-clean',
             metadata: { reason: 'No opportunities detected' } };
  }

  if (state.total_score < state.threshold) {
    return { value: 'skip', confidence: 'MEDIUM', rule_id: 'simplify-below-threshold',
             metadata: { score: state.total_score, threshold: state.threshold } };
  }

  if (state.iteration >= 3) {
    return { value: 'stop', confidence: 'HIGH', rule_id: 'simplify-max-iterations' };
  }

  return { value: 'simplify', confidence: 'HIGH', rule_id: 'simplify-warranted',
           metadata: { opportunities: state.opportunities_count, score: state.total_score } };
}
```

This is consumed by the `execute-phase` workflow to decide whether to run/continue the simplification loop.

---

## 7. Configuration

New section in `.planning/config.json`:

```json
{
  "simplify": {
    "enabled": true,
    "threshold": "medium",
    "max_iterations": 3,
    "targets": {
      "cognitive_complexity": 8,
      "function_length": 15,
      "parameter_count": 4,
      "nesting_depth": 3
    },
    "skip_types": []
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Master switch. Also overridden by `--skip-simplify` flag. |
| `threshold` | `"medium"` | Score threshold for triggering simplification. |
| `max_iterations` | `3` | Maximum simplification loop iterations. |
| `targets.*` | (see above) | Per-metric thresholds. Adjustable per-project. |
| `skip_types` | `[]` | Opportunity types to ignore (e.g., `["over_abstraction"]`). |

---

## 8. Interaction with Existing Components

### 8.1 TDD Integration

The simplification pass is **complementary** to TDD's REFACTOR step, not a replacement:

| | TDD REFACTOR | Simplification Pass |
|-|-------------|---------------------|
| **Scope** | Single feature (one plan) | Entire phase (all plans) |
| **Trigger** | Always (part of RED-GREEN-REFACTOR) | Conditional (score above threshold) |
| **Visibility** | Within one executor's context window | Cross-plan, cross-file |
| **Methodology** | Executor judgment | CLI-driven analysis + executor execution |
| **Commits** | `refactor({phase}-{plan}): clean up {feature}` | `refactor({phase}-simplify): {description}` |

The TDD REFACTOR catches per-feature cleanup. The simplification pass catches what REFACTOR can't see: duplication between features, cross-plan complexity accumulation, and dead code left over from iterative development.

### 8.2 Contract-First Integration (EDD-001)

If contracts are implemented:

- `simplify:analyze` checks whether any simplification would break a contract signature
- Opportunities that would change a contracted interface are marked `contract_breaking: true` and excluded from auto-generated plans
- The executor validates contracts after each simplification commit (same as during normal execution)
- Inlining a function that's part of a contract is explicitly forbidden

### 8.3 ADR Integration (EDD-001)

If ADRs are implemented:

- Before simplifying a module, the executor checks for ADRs affecting that module via `memory:adr for-files`
- If an ADR explains *why* a pattern exists (e.g., "Factory pattern used because we plan to add OAuth provider"), the executor skips that simplification opportunity
- If the executor removes an abstraction that has an ADR, it creates a superseding ADR explaining the simplification

### 8.4 Existing AST Infrastructure

The cognitive complexity implementation extends `src/lib/ast.js` alongside the existing:

- `walkComplexity()` — cyclomatic complexity + nesting depth (unchanged)
- `extractFunctions()` — function signature extraction (unchanged)
- `parseFile()` — acorn parsing with TypeScript stripping (unchanged)

New additions:
- `walkCognitiveComplexity()` — cognitive complexity scoring
- `normalizeTokens()` — token sequence normalization for duplication detection

### 8.5 Trajectory Engineering

If a simplification pass produces a worse result (metrics increase instead of decrease), the trajectory system can be used to roll back:

```bash
node bin/bgsd-tools.cjs trajectory checkpoint "${PHASE_NUMBER}" --scope simplify
# ... simplification runs ...
# If metrics got worse:
node bin/bgsd-tools.cjs trajectory pivot "${PHASE_NUMBER}" --scope simplify
```

This is not automatic — the workflow compares before/after scores and only commits if scores improved.

### 8.6 Verification Pipeline

The verifier runs AFTER simplification. This means:

- `VERIFICATION.md` reflects the simplified code, not the raw output
- The verifier does not need to know about simplification — it just verifies the current state
- `SIMPLIFICATION.md` is available alongside `VERIFICATION.md` for audit trail
- If verification finds gaps, gap-closure plans work against the simplified codebase

### 8.7 Handoff Chain

The simplification step writes its own handoff artifact (`--step simplify`), maintaining the execute → simplify → verify chain. Resume detection in `verify-work.md` treats `simplify` as a valid `latest_valid_step`.

---

## 9. PLAN.md Template: `templates/plans/simplify.md`

```markdown
---
phase: [XX-phase-name]
plan: simplify
type: refactor
wave: post-execution
autonomous: true
files_modified: []
must_haves:
  truths:
    - "All tests pass after simplification"
    - "No behavioral changes introduced"
    - "Cognitive complexity reduced or unchanged"
  artifacts: []
---

<!-- Auto-generated by simplify:plan from simplify:analyze output -->
<!-- This plan is refactor-only. No behavior changes. Tests are the safety net. -->

<objective>
Simplify phase [XX] code output. Reduce complexity, remove duplication,
eliminate dead code while maintaining identical behavior.
Output: Cleaner code with same test coverage and passing suite.
</objective>

<execution_context>
@__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-plan.md
@__OPENCODE_CONFIG__/bgsd-oc/skills/simplification/SKILL.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<simplification_opportunities>
<!-- Populated from simplify:analyze JSON -->
</simplification_opportunities>

<task n="1" type="auto">
  <n>Remove dead code</n>
  <files>[files from dead_code opportunities]</files>
  <action>
  Remove unused exports, unreachable branches, and orphaned helpers
  identified in the simplification analysis.
  </action>
  <verify>Run test suite — all tests pass. No imports broken.</verify>
  <done>All dead_code opportunities resolved or explicitly skipped.</done>
</task>

<task n="2" type="auto">
  <n>Extract duplicated logic</n>
  <files>[files from duplication opportunities]</files>
  <action>
  Extract identical logic blocks into shared modules.
  Update all call sites to use the shared version.
  </action>
  <verify>Run test suite — all tests pass. Duplicated code exists in exactly one place.</verify>
  <done>All duplication opportunities resolved or explicitly skipped.</done>
</task>

<task n="3" type="auto">
  <n>Reduce complexity</n>
  <files>[files from complexity + metz_violation opportunities]</files>
  <action>
  Flatten nested conditionals via early returns.
  Decompose long functions into focused helpers.
  Simplify parameter lists where possible.
  </action>
  <verify>Run test suite — all tests pass. Target functions below cognitive complexity 8.</verify>
  <done>All complexity opportunities resolved or explicitly skipped.</done>
</task>

<task n="4" type="auto">
  <n>Simplify structure</n>
  <files>[files from over_abstraction opportunities]</files>
  <action>
  Inline single-use abstractions. Collapse unnecessary indirection.
  Only proceed if no ADR justifies the current structure.
  </action>
  <verify>Run test suite — all tests pass. Module count same or reduced.</verify>
  <done>All over_abstraction opportunities resolved or explicitly skipped.</done>
</task>

<verification>
```bash
npm test
```
</verification>

<o>
Create SIMPLIFICATION.md (via simplify:report) with before/after metrics.
Do NOT create a separate SUMMARY.md for the simplification plan.
</o>
```

---

## 10. Implementation Plan

### Phase 1: Core Analysis Engine

**Estimated effort:** 2-3 phases

1. **Cognitive complexity** — Implement `walkCognitiveComplexity()` in `src/lib/ast.js`. Unit tests against known-complexity functions. Validate against SonarQube reference cases.
2. **Metz checks** — Implement threshold checking (function length, parameter count, nesting depth, module length) using existing AST infrastructure. New `src/lib/simplify-metrics.js` module.
3. **`simplify:analyze` command** — Implement in `src/commands/simplify.js`. Wire metrics + Metz checks into scored opportunity list. Add to router.
4. **`simplify:files` command** — Extract modified files from jj log for a phase's commits.

**Tests:** Cognitive complexity unit tests (known inputs → expected scores), Metz threshold tests, analysis integration tests with fixture projects.

### Phase 2: Duplication and Dead Code Detection

**Estimated effort:** 2-3 phases

1. **Duplication detection** — AST-level token normalization and LCS comparison in `src/lib/duplication.js`. Line-level fallback for non-JS files.
2. **Dead code detection** — Export/import cross-reference analysis. Extend existing AST export extraction.
3. **Over-abstraction heuristics** — Pattern matching for factory-with-one-impl, wrapper-that-only-delegates, etc.
4. **Integrate into `simplify:analyze`** — Add duplication, dead code, and over-abstraction opportunities to the analysis output.

**Tests:** Duplication detection tests with known-duplicate fixtures, dead code detection tests, false positive tests (ensure legitimate patterns aren't flagged).

### Phase 3: Workflow Integration

**Estimated effort:** 2-3 phases

1. **`simplify:plan` command** — Auto-generate refactor plans from analysis JSON. Write plan template.
2. **`simplify:report` command** — Before/after metric comparison, SIMPLIFICATION.md generation.
3. **`resolveSimplificationGate` decision rule** — Add to decision-rules.js and register.
4. **`execute-phase.md` integration** — Add `simplify_phase_output` step between `aggregate_results` and `ci_quality_gate`.
5. **Config schema** — Add `simplify` section to CONFIG_SCHEMA in constants.js.
6. **Handoff chain** — Wire simplify step into handoff artifact system.

**Tests:** Plan generation tests, report generation tests, decision rule tests, workflow integration tests (mock execution → simplify → verify flow).

### Phase 4: Skill and Documentation

**Estimated effort:** 1 phase

1. **`skills/simplification/SKILL.md`** — Write the full skill with executor and planner sections.
2. **`templates/plans/simplify.md`** — Simplification plan template.
3. **Skill index update** — Add simplification to `skills/skill-index/SKILL.md`.
4. **Agent prompt updates** — Add simplification awareness to `bgsd-executor.md` (load skill when spawned for simplification), `bgsd-planner.md` (awareness that simplification runs post-execution).
5. **Documentation** — Update `docs/architecture.md`, `docs/workflows.md`, `docs/configuration.md`.

**Tests:** Skill content tests (ensure no conflicts with existing skills), template validation tests.

---

## 11. Acceptance Criteria

### Analysis Engine
- [ ] `walkCognitiveComplexity()` produces correct scores for reference test cases
- [ ] Metz threshold violations detected with correct rule/actual/limit values
- [ ] `simplify:analyze` returns scored opportunities in priority order
- [ ] `simplify:files` correctly extracts phase-modified files from jj history
- [ ] Analysis completes in < 5 seconds for projects with 50 source files

### Detection
- [ ] Duplication detection catches identical 3+ line blocks across files
- [ ] Duplication detection ignores import statements and boilerplate
- [ ] Dead code detection identifies unused exports with zero false positives on entry points
- [ ] Over-abstraction patterns detected for factory/wrapper/single-child cases
- [ ] All detectors return zero opportunities on already-clean code

### Workflow
- [ ] Simplification step runs between aggregate_results and verify_phase_goal
- [ ] `--skip-simplify` flag bypasses the entire step
- [ ] `config.simplify.enabled: false` bypasses the entire step
- [ ] Loop terminates at max_iterations (default 3) even if opportunities remain
- [ ] Loop terminates early when score doesn't improve between iterations
- [ ] Handoff artifact written for simplify step
- [ ] Verification runs against simplified code
- [ ] SIMPLIFICATION.md created with before/after metrics

### Safety
- [ ] Test suite passes identically before and after simplification
- [ ] No behavioral changes introduced (verified by test pass, not by diff inspection)
- [ ] Contract files unchanged (if EDD-001 contracts implemented)
- [ ] ADRs consulted before structural simplification (if EDD-001 ADRs implemented)
- [ ] Files outside the phase's modified set are never touched
- [ ] Failed simplification opportunities are reverted, not debugged

### Integration
- [ ] TDD REFACTOR commits and simplification commits are distinguishable in git history
- [ ] Trajectory checkpoint/pivot works for the simplification step
- [ ] `simplify:analyze` reuses existing `ast.js` infrastructure without modifying cyclomatic complexity
- [ ] Decision rule registered in decision-rules.js registry
- [ ] Config schema validates `simplify` section

---

## 12. Open Questions

1. **Duplication granularity:** Should duplication detection work at the token level (AST-normalized) or the line level? Token-level is more accurate but more complex to implement. Line-level is simpler but misses refactored-but-equivalent duplication. Recommendation: start with line-level, upgrade to token-level in a future iteration.

2. **Cross-phase simplification:** Should the analysis consider files modified in previous phases? A function duplicated in Phase 3 and Phase 5 is a real issue, but fixing it in Phase 5's simplification pass means modifying Phase 3's code. Current design: restrict to current phase. Future: add a milestone-level simplification command.

3. **Language support beyond JS:** The AST analysis uses acorn, which only handles JS/TS. For multi-language projects, should the simplification pass have a regex/line-based fallback for non-JS files? The Metz line-count checks work on any language. Cognitive complexity doesn't.

4. **Simplification and workspace mode:** When phases execute in JJ workspaces (parallel execution), the simplification pass runs after workspace reconciliation on the merged result. Is this sufficient, or should each workspace be simplified independently before reconciliation?

5. **Scoring weights:** The current scoring is simple (each opportunity type has a fixed score). Should scoring account for file importance (e.g., higher score for complexity in core business logic vs. utility helpers)? This could use the codebase-intel data to weight by file centrality.

6. **Agent gold-plating risk:** The simplification executor might over-simplify — collapsing code that was intentionally verbose for readability. The "revert on test failure" guard catches behavioral changes but not readability regressions. Should there be a human checkpoint after simplification for high-score phases? Current design says no (advisory only, verifier catches real issues), but this is worth watching.

---

## Appendix A: Relationship to Existing bGSD Components

| Existing Component | How It's Extended |
|-------------------|------------------|
| `src/lib/ast.js` | `walkCognitiveComplexity()` added alongside existing `walkComplexity()` |
| `src/lib/decision-rules.js` | `resolveSimplificationGate` added to registry |
| `src/lib/constants.js` | `CONFIG_SCHEMA` extended with `simplify` section |
| `src/commands/` | New `simplify.js` module |
| `src/router.js` | `simplify:` namespace routed to new module |
| `workflows/execute-phase.md` | `simplify_phase_output` step added |
| `skills/` | New `simplification/SKILL.md` |
| `templates/plans/` | New `simplify.md` template |
| `docs/architecture.md` | Simplification step documented in workflow diagram |
| `docs/configuration.md` | `simplify` config section documented |
| `skills/skill-index/SKILL.md` | Simplification skill added to index |
| `agents/bgsd-executor.md` | Simplification skill added to skills table |

## Appendix B: Example `simplify:analyze` Run Against bGSD Itself

To validate the analysis engine, run it against bGSD's own source. Expected findings:

- `src/router.js` (81K, single file) would trigger module_length Metz violation
- Several `src/commands/*.js` files have functions exceeding cognitive complexity 8
- Duplication detection would find shared patterns across command modules (error handling boilerplate, output formatting)
- Dead code detection should return zero results (bGSD already runs `knip` for dead exports)

This self-referential test validates both accuracy and false-positive rate.

## Appendix C: Prior Art

| System | Approach | What bGSD Borrows |
|--------|----------|-------------------|
| SonarQube | Static analysis with cognitive complexity scoring | Cognitive complexity metric and thresholds |
| Sandi Metz (POODR) | Structural constraints for OO code | Function length, parameter count limits (adapted for JS) |
| Kent Beck (XP) | Four Rules of Simple Design | Priority hierarchy and TDD integration |
| Martin Fowler (Refactoring) | Catalog of code smells and refactoring patterns | Opportunity type taxonomy |
| Sourcery (Python) | AI-powered refactoring suggestions | Auto-generated refactoring plans from analysis |
| jscpd | Copy-paste detector for source code | Duplication detection approach (line-level) |

The differentiator is integration: these are standalone tools that produce reports humans read. bGSD's simplification engine produces structured data that agents execute, with the CLI as the deterministic layer and the executor as the AI layer.
