# TDD Execution Engine

bGSD supports test-driven development as a first-class plan type. Plans with `type: tdd` follow a strict RED-GREEN-REFACTOR state machine with orchestrator-enforced gates.

---

## Overview

TDD in bGSD is opt-in per plan. When a plan specifies `type: tdd` in its frontmatter, the executor follows a disciplined cycle:

```
RED → Verify test fails → GREEN → Verify test passes → REFACTOR → Verify tests still pass
```

Each phase has explicit verification gates. The orchestrator confirms the expected test state before allowing progression.

---

## How It Works

### Plan Frontmatter

```yaml
---
phase: 5
plan: 1
type: tdd              # Enables TDD execution mode
wave: 1
must_haves:
  truths:
    - "User authentication works with email/password"
  artifacts:
    - "src/auth/login.ts"
    - "test/auth/login.test.ts"
---
```

### Execution Flow

#### 1. RED Phase

**Goal:** Write a failing test that defines the expected behavior.

1. Executor writes the test file
2. Executor runs the test suite
3. Orchestrator verifies the new test **fails** (expected behavior doesn't exist yet)
4. Commit with trailer: `GSD-Phase: red`

**What's validated:**
- Test file exists
- Test actually runs (not a syntax error)
- Test fails for the right reason (missing implementation, not broken test)

#### 2. GREEN Phase

**Goal:** Write the minimum code to make the test pass.

1. Executor writes implementation code
2. Executor runs the test suite
3. Orchestrator verifies the previously-failing test now **passes**
4. Commit with trailer: `GSD-Phase: green`

**What's validated:**
- Previously-failing test now passes
- No other tests broken
- Implementation is minimal (anti-pattern detection warns on over-engineering)

#### 3. REFACTOR Phase

**Goal:** Clean up the code without changing behavior.

1. Executor improves code quality (naming, structure, duplication)
2. Executor runs the test suite
3. Orchestrator verifies **all tests still pass**
4. Commit with trailer: `GSD-Phase: refactor`

**What's validated:**
- All tests still pass
- No behavioral changes introduced
- Code quality improved

---

## Git Commit Discipline

TDD commits use git trailers for audit trail:

```
feat(auth): add login test (failing)

[phase-05/plan-01/task-01]

GSD-Phase: red
Agent-Type: gsd-executor
```

```
feat(auth): implement login endpoint

[phase-05/plan-01/task-02]

GSD-Phase: green
Agent-Type: gsd-executor
```

```
refactor(auth): extract validation helper

[phase-05/plan-01/task-03]

GSD-Phase: refactor
Agent-Type: gsd-executor
```

---

## Anti-Pattern Detection

The TDD engine detects and warns on common mistakes:

### Blocking Anti-Patterns

| Pattern | Detection | Action |
|---------|-----------|--------|
| **Pre-test code** | Implementation code written before test exists | Block: delete implementation, write test first |
| **YAGNI violations** | Implementation exceeds what the test requires | Warning: simplify to minimal passing code |

### Warning Anti-Patterns

| Pattern | Detection | Action |
|---------|-----------|--------|
| **Over-mocking** | More than 3 mocks in a single test | Warning: consider integration test instead |
| **Test-after-fact** | Test written after implementation (detected via git timeline) | Warning: follow RED-GREEN order |
| **Broad assertions** | Test asserts too many behaviors in one case | Warning: split into focused test cases |

---

## Auto Test-After-Edit

Independent of TDD mode, the executor runs the test suite after each file modification:

```
Edit file → Run tests → If pass: continue → If fail: fix before proceeding
```

This catches errors immediately rather than discovering them at plan end. The test command is determined by:

1. `config.json` → `test_commands` for the project language
2. Auto-detection from `package.json` (`npm test`), `Makefile`, etc.
3. Environment manifest detection

**Key behavior:** Auto test-after-edit does NOT set exit codes. It's informational — the executor sees failures and fixes them as part of the task flow.

---

## Stuck/Loop Detection

If the executor retries the same failing pattern more than 2 times:

1. **Detection** — Identifies the loop (same error message, same file, same approach)
2. **Recovery options:**
   - Roll back to last passing state
   - Try a fundamentally different approach
   - Escalate to workflow for human decision
3. **Timeout** — TDD gate validation uses 120s timeout to prevent hanging test suites

---

## When to Use TDD

TDD plans are appropriate for:
- New feature implementations with clear behavioral requirements
- Bug fixes where the bug can be expressed as a failing test
- API endpoint implementations
- Business logic with defined inputs/outputs

TDD plans are NOT appropriate for:
- Research and exploration tasks
- Configuration and infrastructure changes
- Documentation updates
- Refactoring (by definition, refactoring doesn't change behavior)

---

## Configuration

TDD behavior is controlled at the plan level, not globally:

```yaml
# In PLAN.md frontmatter
type: tdd          # Enable TDD mode
type: execute      # Standard execution (default)
```

The `test_gate` setting in `config.json` controls whether test failures block execution:

```json
{
  "test_gate": true    // Block on test failure (default)
}
```

---

## CLI Commands

```bash
# TDD gate validation
node bin/gsd-tools.cjs tdd validate-red <test-file>     # Verify test fails
node bin/gsd-tools.cjs tdd validate-green <test-file>    # Verify test passes
node bin/gsd-tools.cjs tdd validate-refactor             # Verify all tests pass

# Anti-pattern detection
node bin/gsd-tools.cjs tdd detect-antipattern <file>     # Check for TDD anti-patterns

# Auto-test
node bin/gsd-tools.cjs tdd auto-test                     # Run test suite, report results
```

---

## Research Background

bGSD's TDD engine was informed by analysis of 8 TDD systems:

- **Superpowers (obra)** — Strict RED-GREEN enforcement with code deletion for violations. bGSD adopted the discipline but with softer enforcement (warnings before blocking).
- **Aider** — Auto test-after-edit with fix loop. bGSD adopted the continuous testing pattern.
- **SWE-agent** — Edit-with-linter guard catching errors at edit time. Informed the auto-test design.
- **Industry research** — 67% AI PR rejection rate (LinearB) validates that quality gates matter more than speed.

The key insight: test-first development produces more testable designs and catches issues earlier, but forcing TDD on all work types adds overhead without benefit. The opt-in plan type approach gives teams the discipline when they want it.

---

*For how TDD plans fit into the execution workflow, see [Workflows](workflows.md). For quality gate configuration, see [Configuration](configuration.md).*
