# TDD Reference

Detailed reference material for TDD execution. Load this when you need full TDD documentation beyond the SKILL.md summary.

## Core Principle

TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

## CLI Validation Gate Commands

Each TDD phase transition is enforced by a CLI gate command. These must pass before proceeding.

### validate-red

Confirms test fails (expected in RED phase):
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-red --test-cmd "<test_command>"
```
Returns: `{ phase: "red", valid: true/false, snippet: "..." }`
- `valid: true` — test fails as expected, proceed to GREEN
- `valid: false` — test passed (shouldn't), fix the test

### validate-green

Confirms test passes (expected in GREEN phase):
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-green --test-cmd "<test_command>"
```
Returns: `{ phase: "green", valid: true/false, snippet: "..." }`
- `valid: true` — test passes, proceed to REFACTOR
- `valid: false` — test still fails, debug implementation

### validate-refactor

Confirms tests still pass after cleanup:
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd validate-refactor --test-cmd "<test_command>"
```
Returns: `{ phase: "refactor", valid: true/false, snippet: "..." }`
- `valid: true` — refactor preserved behavior, commit
- `valid: false` — refactor broke something, undo

### auto-test

Non-blocking test execution for general use:
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd auto-test --test-cmd "<test_command>"
```
Returns: `{ passed: true/false, snippet: "..." }`
Does NOT set process.exitCode — the workflow decides whether to stop.

### detect-antipattern

Checks for TDD violations:
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:tdd detect-antipattern --phase <red|green|refactor> --files <file_list>
```
Returns: `{ warnings: [...] }` — array of detected anti-pattern violations.

## Commit Trailers

TDD commits include two trailers for attribution and phase tracking:

**Agent-Type trailer:**
```bash
--agent bgsd-executor
```
Produces: `Agent-Type: bgsd-executor`

**GSD-Phase trailer:**
```bash
--tdd-phase red    # or green, refactor
```
Produces: `GSD-Phase: red`

**Combined usage:**
```bash
node $BGSD_HOME/bin/bgsd-tools.cjs execute:commit "test(08-02): add failing test for email validation" \
  --files src/utils/__tests__/email.test.ts \
  --agent bgsd-executor \
  --tdd-phase red
```

**Resulting commit:**
```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected

Agent-Type: bgsd-executor
GSD-Phase: red
```

Both trailers enable querying commits by TDD phase (`git log --grep="GSD-Phase: red"`) and agent attribution.

## Commit Pattern

TDD plans produce 2-3 atomic commits:

```
test(08-02): add failing test for email validation
- Tests valid email formats accepted
- Tests invalid formats rejected

feat(08-02): implement email validation
- Regex pattern matches RFC 5322
- Returns boolean for validity

refactor(08-02): extract regex to constant (optional)
- Moved pattern to EMAIL_REGEX constant
- No behavior changes
```

## Test Framework Setup

When no test framework is configured, set it up as part of the RED phase:

1. **Detect project type** (package.json, requirements.txt, go.mod, Cargo.toml)
2. **Install minimal framework** (Jest, Vitest, pytest, built-in)
3. **Create config if needed** (jest.config.js, vitest.config.ts, etc.)
4. **Verify setup** (run empty test suite — should pass with 0 tests)
5. **Create first test file** following project conventions

Framework setup is a one-time cost included in the first TDD plan's RED phase.

## Good Tests vs Bad Tests

**Test behavior, not implementation:**
- Good: "returns formatted date string"
- Bad: "calls formatDate helper with correct params"

**One concept per test:**
- Good: Separate tests for valid input, empty input, malformed input
- Bad: Single test checking all edge cases

**Descriptive names:**
- Good: "should reject empty email", "returns null for invalid ID"
- Bad: "test1", "handles error"

**No implementation details:**
- Good: Test public API, observable behavior
- Bad: Mock internals, test private methods
