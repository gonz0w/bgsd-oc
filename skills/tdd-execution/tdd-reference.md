# TDD Reference

Detailed reference material for the canonical TDD contract defined in `SKILL.md`. Load this when you need full documentation beyond the authoritative skill summary. If this file and `SKILL.md` ever disagree, `SKILL.md` is correct and this file must be updated to match it.

## Core Principle

TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

## Contract Scope

This reference follows the canonical contract through Phase 150 execution semantics:
- shared RED / GREEN / REFACTOR vocabulary
- `execute:tdd` subcommand names
- exact-command validation per phase
- structured proof artifacts for each phase

It does **not** reopen Phase 149 TDD selection or severity rules.

## CLI Validation Gate Commands

Each TDD phase uses the same CLI gate command names defined in `SKILL.md`. These commands are the canonical validation surfaces referenced by workflows, templates, and CLI help.

### validate-red

Confirms the exact declared target command fails (expected in RED phase):
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-red --test-cmd "<test_command>"
```
Returns structured proof including: exact target command, exit code, and matched fail evidence snippet.
- `valid: true` — exact target fails as expected, proceed to GREEN
- `valid: false` — target passed or the target command is missing, fix the target/test

### validate-green

Confirms the exact declared target command passes (expected in GREEN phase):
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-green --test-cmd "<test_command>"
```
Returns structured proof including: exact target command, exit code, and matched pass evidence snippet.
- `valid: true` — exact target passes, proceed to REFACTOR
- `valid: false` — exact target still fails, debug implementation

### validate-refactor

Confirms the exact declared target command still passes after cleanup:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd validate-refactor --test-cmd "<test_command>"
```
Returns structured proof including: exact target command, exit code, and matched pass evidence snippet.
- `valid: true` — refactor preserved the exact target behavior, commit
- `valid: false` — refactor broke the exact target behavior, undo

### auto-test

Non-blocking test execution for general use:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd auto-test --test-cmd "<test_command>"
```
Returns structured proof including the exact target command, exit code, and matched evidence snippet.
Does NOT set process.exitCode — the workflow decides whether to stop.

### detect-antipattern

Checks for TDD violations:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:tdd detect-antipattern --phase <red|green|refactor> --files <file_list>
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
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "test(08-02): add failing test for email validation" \
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

TDD plans produce the expected 2-3 atomic artifacts described in `SKILL.md`:

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
