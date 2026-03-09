---
name: tdd-execution
description: TDD red-green-refactor execution flow with CLI validation gates, commit protocol per phase, and context budget guidance. Covers both executor (running cycles) and planner (structuring TDD plans) perspectives.
type: shared
agents: [executor, planner]
sections: [executor, planner]
---

## Purpose

Provides the TDD methodology for both creating TDD plans (planner) and executing them (executor). TDD work is fundamentally heavier than standard tasks — it requires 2-3 execution cycles (RED, GREEN, REFACTOR), each with file reads, test runs, and potential debugging. This skill ensures consistent cycle discipline, proper commit granularity, and appropriate context budgeting.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `08-validation` |
| `{{plan}}` | Current plan number | `02` |

## Content

<!-- section: executor -->
### Executor: Running TDD Cycles

**Principle:** If you can describe the behavior as `expect(fn(input)).toBe(output)` before writing `fn`, TDD improves the result.

#### Step 1: Check Test Infrastructure

If this is the first TDD task, detect project type and install test framework if needed:

| Project | Framework | Install |
|---|---|---|
| Node.js | Jest | `npm install -D jest @types/jest ts-jest` |
| Node.js (Vite) | Vitest | `npm install -D vitest` |
| Python | pytest | `pip install pytest` |
| Go | testing | Built-in |
| Rust | cargo test | Built-in |

#### Step 2: RED — Write Failing Test

1. Read `<behavior>` from the plan
2. Create test file following project conventions
3. Write tests describing expected behavior
4. Run tests — they MUST fail
5. Validate: `node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-red --test-cmd "<cmd>"`
6. Commit: `test({{phase}}-{{plan}}): add failing test for [feature]`

If the test passes instead of failing, investigate — the feature may already exist or the test may be wrong.

#### Step 3: GREEN — Minimal Implementation

1. Read `<implementation>` from the plan
2. Write minimal code to make tests pass
3. Run tests — they MUST pass
4. Validate: `node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-green --test-cmd "<cmd>"`
5. Commit: `feat({{phase}}-{{plan}}): implement [feature]`

If tests don't pass, debug and iterate. Don't skip to refactor.

#### Step 4: REFACTOR (if needed)

1. Clean up code — extract constants, rename variables, simplify logic
2. Run tests — they MUST still pass
3. Validate: `node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-refactor --test-cmd "<cmd>"`
4. Commit only if changes made: `refactor({{phase}}-{{plan}}): clean up [feature]`

If refactoring breaks tests, undo. Refactor in smaller steps.

#### Error Handling

- **Test doesn't fail in RED:** Feature may already exist. Investigate before proceeding.
- **Test doesn't pass in GREEN:** Debug implementation. Keep iterating until green.
- **Tests fail in REFACTOR:** Undo refactor. Commit was premature. Try smaller steps.
- **Unrelated tests break:** Stop and investigate. May indicate coupling issue.

#### Test Quality Guidelines

- **Test behavior, not implementation:** "returns formatted date string" not "calls formatDate helper"
- **One concept per test:** Separate tests for valid input, empty input, malformed input
- **Descriptive names:** "should reject empty email" not "test1"
- **No implementation details:** Test public API, observable behavior

<!-- section: planner -->
### Planner: Structuring TDD Plans

#### TDD Detection Heuristic

Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
- **Yes:** Create a dedicated TDD plan (`type: tdd`)
- **No:** Standard task in standard plan

**TDD candidates (dedicated TDD plans):**
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints
- Algorithms with testable behavior
- State machines and workflows

**Skip TDD (standard plan with `type="auto"` tasks):**
- UI layout, styling, visual components
- Configuration changes
- Glue code connecting existing components
- One-off scripts and migrations
- Simple CRUD with no business logic

#### TDD Plan Structure

Each TDD plan implements ONE feature through the full RED-GREEN-REFACTOR cycle:

```markdown
---
phase: XX-name
plan: NN
type: tdd
---

<objective>
[What feature and why]
Purpose: [Design benefit of TDD for this feature]
Output: [Working, tested feature]
</objective>

<feature>
  <name>[Feature name]</name>
  <files>[source file, test file]</files>
  <behavior>
    [Expected behavior in testable terms]
    Cases: input -> expected output
  </behavior>
  <implementation>[How to implement once tests pass]</implementation>
</feature>
```

**One feature per TDD plan.** If features are trivial enough to batch, they're trivial enough to skip TDD.

#### Context Budget for TDD

TDD plans target **~40% context** (lower than standard plans' ~50%). The RED-GREEN-REFACTOR back-and-forth with file reads, test runs, and output analysis is inherently heavier than linear execution.

Each TDD plan produces 2-3 atomic commits (test, feat, optional refactor).

For detailed TDD reference material including framework setup, commit trailers, and anti-patterns, see: `tdd-reference.md`

## Cross-references

- <skill:commit-protocol /> — TDD commits follow the same format with type-specific prefixes (test, feat, refactor)
- <skill:goal-backward /> — TDD behavior descriptions derive from must-haves truths

## Examples

**RED phase commit:**
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:commit "test(08-02): add failing test for email validation" \
  --files src/utils/__tests__/email.test.ts \
  --agent bgsd-executor \
  --tdd-phase red
```

**GREEN phase commit:**
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:commit "feat(08-02): implement email validation" \
  --files src/utils/email.ts \
  --agent bgsd-executor \
  --tdd-phase green
```
