# Phase 42: Integration & Validation - Research

**Researched:** 2026-02-27
**Domain:** v7.0 feature validation, end-to-end testing, performance measurement
**Confidence:** HIGH

## Summary

Phase 42 validates that all v7.0 Agent Orchestration & Efficiency features (Phases 37-41, 43) work end-to-end with measured performance and no regressions. This phase tests and measures — it does not build new features. The validation uses this project (gsd-opencode) as a canary, running a complete planning→execution→verification cycle on Phase 44 to exercise all v7.0 features in a real workflow.

**Primary recommendation:** Run a complete canary cycle that exercises the full v7.0 pipeline: plan-phase → execute-phase → verify-phase on Phase 44, measuring token consumption and validating all success criteria.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Canary Project Strategy**
   - Use this project (gsd-opencode) as the canary — self-referential validation
   - Run a full cycle: plan-phase → execute-phase → verify-work on Phase 44 (Review Gate Hardening)
   - This means Phase 44 gets planned as a real side effect of validation — real work, real pipeline exercise
   - If the canary cycle hits problems (agent errors, bad plan output), treat them as bugs in v7.0 features — fix and re-run

2. **Token Measurement Approach**
   - Baseline: checkout v6.0 tag, run the same commands, capture token counts
   - Measure total tokens consumed during a complete plan→execute→verify workflow cycle
   - Use an actual tokenizer (tiktoken or equivalent) for real token counts, not character approximations
   - The >=30% savings target is a goal, not a hard gate — measure and document actual savings, ship either way
   - Documenting measured token results counts as passing criterion 2, even if savings are below 30%

3. **Regression Scope & Severity**
   - All existing tests (574+) plus new tests written for v7.0 features must pass
   - Output format regressions detected via Phase 37's contract test snapshots (automated, not manual)
   - Bundle budget (1000KB): build and measure file size of bin/gsd-tools.cjs — no permanent CI check needed
   - Do NOT write new tests for coverage gaps found during validation — document gaps only

4. **Pass/Fail Gates**
   - All five success criteria evaluated as a checklist — all must pass
   - Token savings exception: measuring and documenting counts as passing (see above)
   - Blocking failures (test failures, bundle bloat) get fixed immediately within this phase
   - Minor/deferred findings (token shortfall, test coverage gaps) get documented
   - Produce a structured validation report (markdown) with all criterion results, token measurements, and findings

### Agent's Discretion

- Exact tokenizer implementation choice
- v6.0 baseline checkout strategy (tag vs commit hash)
- Validation report structure and formatting
- Order of criterion evaluation

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>

## Phase Requirements

This phase validates all prior v7.0 phases (37-41, 43). The requirements are:

| ID | Description | Phase | Research Support |
|----|-------------|-------|------------------|
| SAFE-01 | CLI JSON output has consumer contract tests | 37 | Contract tests exist in test file |
| SAFE-02 | Pre-commit safety checks | 37 | Implemented in cmdCommit |
| GIT-01 | Structured git log, diff-summary, blame, branch-info | 37 | git.js module with 5 functions |
| GIT-02 | Pre-commit checks (dirty tree, rebase, detached HEAD, shallow) | 37 | preCommitChecks function |
| AST-01 | Function signature extraction via acorn | 38 | codebase ast command |
| AST-02 | Export surface analysis | 38 | codebase exports command |
| AST-03 | Per-function complexity metrics | 38 | codebase complexity command |
| AST-04 | Regex fallback for non-JS languages | 38 | DETECTOR_REGISTRY |
| CTX-01 | Repository map (~1k token compact summary) | 38 | codebase repo-map command |
| ORCH-01 | Task complexity classification (1-5) | 39 | orchestration.js classifyTaskComplexity |
| ORCH-02 | Agent/model routing recommendations | 39 | task_routing in init execute-phase |
| ORCH-03 | Execution mode auto-selection | 39 | selectExecutionMode function |
| CTX-02 | Agent manifests for context scoping | 40 | AGENT_MANIFESTS in context.js |
| CTX-03 | Compact serialization (70-80% reduction) | 40 | compactPlanState, compactDepGraph |
| CTX-04 | Task-scoped file injection | 40 | buildTaskContext function |
| QUAL-01 | Code review agent (gsd-reviewer) | 41 | reviewer-agent.md reference |
| QUAL-02 | Commit attribution via git trailers | 41 | --agent flag in cmdCommit |
| QUAL-03 | Post-execution review in pipeline | 41 | execute-plan.md workflow |
| TDD-01 | RED→GREEN→REFACTOR state machine | 43 | workflows/tdd.md |
| TDD-02 | RED phase commits failing test | 43 | tdd validate-red command |
| TDD-03 | GREEN phase minimal implementation | 43 | tdd validate-green command |
| TDD-04 | REFACTOR phase verified | 43 | tdd validate-refactor command |
| TDD-05 | GSD-Phase git trailers | 43 | --tdd-phase flag in cmdCommit |
| EXEC-01 | Auto test-after-edit | 43 | execute-plan.md auto_test_after_edit |
| EXEC-02 | Anti-pattern detection | 43 | tdd detect-antipattern command |

</phase_requirements>

---

## v7.0 Feature Summary

### Phase 37: Foundation & Safety Net
- **Contract Tests**: Snapshot tests for init/state outputs + field-level contracts
- **Git Intelligence**: structuredLog, diffSummary, blame, branchInfo functions
- **Pre-commit Checks**: Detects dirty tree, detached HEAD, active rebase, shallow clone
- **Profiler**: GSD_PROFILE=1 opt-in performance profiling to .planning/baselines/

### Phase 38: AST Intelligence & Repo Map
- **codebase ast**: Function signature extraction via acorn parser
- **codebase exports**: Export surface analysis (ESM/CJS)
- **codebase complexity**: Per-function cyclomatic complexity scoring
- **codebase repo-map**: ~1k token compact codebase summary
- **DETECTOR_REGISTRY**: Regex fallback for Python/Go/Rust/Ruby/Java/PHP

### Phase 39: Orchestration Intelligence
- **Task Classification**: 1-5 complexity score based on file count, cross-module reach, tests
- **Agent/Model Routing**: Recommended agent type and model tier per task
- **Execution Mode**: Auto-select single/parallel/sequential/pipeline
- **task_routing**: Added to init execute-phase output

### Phase 40: Context Efficiency
- **Agent Manifests**: 6 agent types declare required context fields
- **scopeContextForAgent**: Filters init output by agent type
- **compactPlanState**: 70-80% token reduction for STATE.md
- **compactDepGraph**: 50-60% token reduction for dependency data
- **buildTaskContext**: Task-scoped file injection with relevance scoring

### Phase 41: Agent Quality Gates
- **Commit Attribution**: --agent flag adds Agent-Type git trailer
- **gsd-reviewer Manifest**: Review-scoped context fields
- **review CLI**: Assembles diff + conventions + commits for reviewer
- **Post-execution Review**: execute-plan.md workflow integration
- **Review Findings**: Included in SUMMARY.md

### Phase 43: TDD Execution Engine
- **tdd validate-red**: Gate verifying test fails
- **tdd validate-green**: Gate verifying test passes
- **tdd validate-refactor**: Gate verifying tests still pass
- **tdd auto-test**: Run tests after each edit
- **tdd detect-antipattern**: Pre-test code, YAGNI, over-mocking detection
- **--tdd-phase**: GSD-Phase commit trailer (red/green/refactor)
- **workflows/tdd.md**: Complete RED→GREEN→REFACTOR state machine
- **auto_test_after_edit**: In execute-plan.md for all plan types

---

## Standard Stack

### Core Technologies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| acorn | latest | JavaScript parser for AST extraction | Industry-standard ES parser |
| Node.js | 20+ | Runtime | Project requirement |
| esbuild | ^0.19 | Bundling | Fast, single-file output |

### Token Measurement
| Library | Purpose | When to Use |
|---------|---------|-------------|
| tiktoken | OpenAI's fast tokenizer | Primary recommendation for token counting |
| js-tiktoken | Alternative Node.js tokenizer | If tiktoken has bundling issues |

---

## End-to-End Validation Strategy

### Success Criteria Checklist

1. **Full planning→execution→verification cycle succeeds**
   - Plan Phase 44 (Review Gate Hardening) using v7.0 tools
   - Execute Phase 44 plans
   - Verify Phase 44 completion
   
2. **Measurable token savings (>=30% vs v6.0)**
   - Measure full workflow tokens with v7.0
   - Compare against v6.0 baseline
   - Document actual savings percentage

3. **All tests pass (existing + new contract + feature tests)**
   - Run `npm test` — all must pass
   - Contract tests detect output format regressions
   - Bundle size must stay within 1000KB

4. **No output format regressions**
   - Contract tests in test file verify init/state outputs
   - Run with GSD_UPDATE_SNAPSHOTS=1 for baseline, then verify

5. **Bundle within 1000KB budget**
   - Build: `npm run build`
   - Check bundle size in build output

### Canary Cycle Approach

Per user decision, run a real canary cycle on Phase 44:

```
1. Plan Phase 44 using gsd-tools plan-phase
2. Execute Phase 44 using gsd-tools execute-phase  
3. Verify using gsd-tools verify-phase
4. All v7.0 features are exercised in this real workflow
```

This validates:
- Git intelligence (branch-info, commit with --agent)
- AST intelligence (repo-map for context)
- Orchestration (task_routing in execute-phase)
- Context efficiency (--agent flag scoping)
- Quality gates (review integration)
- TDD (if any tdd plans in Phase 44)

---

## Token Measurement Approach

### Implementation Details (Agent's Discretion)

**Tokenizer Choice:**
- Primary: Use `tiktoken` npm package
- Alternative: `js-tiktoken` if bundling issues arise
- Fallback: Character-based approximation (chars/4) with clear disclaimer

**Baseline Collection:**
```bash
# Checkout v6.0 tag
git checkout v6.0

# Measure baseline tokens for key commands
node bin/gsd-tools.cjs init execute-phase 42 --raw | wc -c
node bin/gsd-tools.cjs init execute-phase 42 --agent=gsd-executor --raw | wc -c

# Return to current branch
git checkout -
```

**Measurement Points:**
1. `init execute-phase <phase>` (full output)
2. `init execute-phase <phase> --agent=gsd-executor` (scoped)
3. `init execute-phase <phase> --agent=gsd-reviewer` (scoped)
4. `codebase repo-map` output
5. Full workflow: plan-phase + execute-phase + verify-phase

**Token Counting:**
```javascript
const tiktoken = require('tiktoken');
const enc = tiktoken.get_encoding("cl100k_base");
const tokens = enc.encode(text).length;
```

**Documentation:**
- Record measured tokens for each command
- Calculate percentage reduction vs v6.0
- Include tokenizer choice rationale in validation report

---

## Test Strategy

### Test Categories

1. **Contract Tests** (Phase 37)
   - Snapshot tests for init-phase-op and state-read
   - Field-level contracts for all init/state commands
   - Run: `npm test -- --grep contract`

2. **Feature Tests** (v7.0 features)
   - Git: `npm test -- --grep git`
   - AST: `npm test -- --grep ast|codebase`
   - Orchestration: `npm test -- --grep orchest|classify`
   - Context: `npm test -- --grep context|agent`
   - Review: `npm test -- --grep review`
   - TDD: `npm test -- --grep tdd`

3. **Regression Tests**
   - All existing tests must continue passing
   - Contract tests catch output format regressions

### Running Tests

```bash
# Full test suite
npm test

# Specific categories
npm test -- --grep contract
npm test -- --grep git
npm test -- --grep ast
npm test -- --grep orchest
npm test -- --grep context
npm test -- --grep tdd

# Contract test validation
GSD_UPDATE_SNAPSHOTS=1 npm test  # Create baseline
npm test  # Verify against baseline
```

---

## Architecture Patterns

### Validation Report Structure

Create `.planning/phases/42-integration-validation/VALIDATION-REPORT.md`:

```markdown
# v7.0 Integration Validation Report

**Date:** 2026-02-27
**Canary Phase:** 44 (Review Gate Hardening)

## Success Criteria Results

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Full cycle succeeds | PASS/FAIL | Details |
| 2 | Token savings >=30% | PASS/FAIL | Measured: XX% |
| 3 | All tests pass | PASS/FAIL | Test count |
| 4 | No regressions | PASS/FAIL | Contract tests |
| 5 | Bundle <=1000KB | PASS/FAIL | Actual: XXXKB |

## Token Measurements

| Command | v6.0 Baseline | v7.0 | Reduction |
|---------|---------------|------|-----------|
| init execute-phase 42 | X tokens | Y tokens | Z% |
| init execute-phase --agent=gsd-executor | ... | ... | ... |

## Feature Validation

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| Git intelligence | 37 | PASS/FAIL | |
| Contract tests | 37 | PASS/FAIL | |
| AST extraction | 38 | PASS/FAIL | |
| Repo map | 38 | PASS/FAIL | |
| Orchestration | 39 | PASS/FAIL | |
| Context efficiency | 40 | PASS/FAIL | |
| Review integration | 41 | PASS/FAIL | |
| TDD execution | 43 | PASS/FAIL | |

## Findings

### Blocking
- [List any blocking issues]

### Minor/Deferred
- [List non-blocking findings]
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom regex approximation | tiktoken | Accurate, industry-standard |
| Output validation | Manual inspection | Contract tests (Phase 37) | Automated, regression-safe |
| Bundle sizing | Guesswork | Build output measurement | Precise |

---

## Common Pitfalls

### Pitfall 1: Token Measurement Without Baseline
**What goes wrong:** Measuring v7.0 tokens without comparable v6.0 baseline
**Why it happens:** v6.0 tag may not reflect exact feature parity
**How to avoid:** Checkout v6.0 tag, run same commands, document any feature differences
**Warning signs:** "Baseline unavailable" messages in validation report

### Pitfall 2: Contract Test False Positives
**What goes wrong:** Adding new fields causes test failures
**Why it happens:** Contract tests designed to catch field removal/renaming
**How to avoid:** Contract tests are additive-safe (new fields allowed); verify failure is actual regression
**Warning signs:** Test failures after adding legitimate new fields

### Pitfall 3: Bundle Size Regression
**What goes wrong:** New features cause bundle to exceed 1000KB
**Why it happens:** Bundle already at 1000KB, every addition counts
**How to avoid:** Monitor bundle during build, trim verbose strings before adding features
**Warning signs:** Build output shows >1000KB

### Pitfall 4: Incomplete Canary Coverage
**What goes wrong:** Canary cycle doesn't exercise all v7.0 features
**Why it happens:** Phase 44 may not use all features (no TDD plans, etc.)
**How to avoid:** Document which features were exercised vs. tested in isolation
**Warning signs:** Validation report shows gaps in feature coverage

### Pitfall 5: Token Savings Below 30%
**What goes wrong:** Measured savings don't meet >=30% target
**Why it happens:** Context efficiency features may not reduce as much as expected
**How to avoid:** Per user decision, measuring and documenting counts as passing
**Warning signs:** Actual reduction 20-29%

---

## Code Examples

### Running Contract Tests
```bash
# Update snapshots (first time or after intentional changes)
GSD_UPDATE_SNAPSHOTS=1 npm test

# Run contract tests specifically
npm test -- --grep contract
```

### Measuring Token Savings
```javascript
// Using tiktoken
const tiktoken = require('tiktoken');
const enc = tiktoken.get_encoding("cl100k_base");

function countTokens(text) {
  return enc.encode(text).length;
}

// Measure command output
const fullOutput = execSync('node bin/gsd-tools.cjs init execute-phase 42 --raw', { encoding: 'utf-8' });
const scopedOutput = execSync('node bin/gsd-tools.cjs init execute-phase 42 --agent=gsd-executor --raw', { encoding: 'utf-8' });

console.log(`Full: ${countTokens(fullOutput)} tokens`);
console.log(`Scoped: ${countTokens(scopedOutput)} tokens`);
console.log(`Reduction: ${(1 - countTokens(scopedOutput)/countTokens(fullOutput)) * 100}%`);
```

### Bundle Size Check
```bash
npm run build 2>&1 | grep "Bundle size"
```

---

## Open Questions

1. **v6.0 Tag Availability**
   - What we know: v6.0 tag exists in git history
   - What's unclear: Whether all v6.0 features are available at that tag
   - Recommendation: Checkout tag and verify key commands work; document any missing features

2. **Token Measurement Scope**
   - What we know: Need to measure full workflow tokens
   - What's unclear: Which commands to include in "full workflow"
   - Recommendation: Measure init execute-phase (main), plus repo-map, classify, review commands

3. **Phase 44 Plan Types**
   - What we know: Phase 44 is Review Gate Hardening (QUAL-04, 05, 06)
   - What's unclear: Whether Phase 44 will have TDD plans
   - Recommendation: Document which v7.0 features were exercised vs. tested in isolation

---

## Sources

### Primary (HIGH confidence)
- CONTEXT.md - Phase 42 user decisions and constraints
- ROADMAP.md - v7.0 feature overview
- REQUIREMENTS.md - Requirement traceability
- Individual PLAN.md files from Phases 37-41, 43

### Secondary (MEDIUM confidence)
- npm package documentation for tiktoken
- Node.js perf_hooks documentation

### Tertiary (LOW confidence)
- WebSearch for "tiktoken node.js bundle" - needs verification

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - verified through build and package.json
- Architecture: HIGH - based on implemented plans
- Pitfalls: MEDIUM - identified from project context

**Research date:** 2026-02-27
**Valid until:** 30 days (features are implemented, not changing)
