# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:** Node.js built-in test runner (`node:test`)
- No external test dependencies — consistent with the zero-dependency philosophy
- Uses `node:test` module: `describe`, `test`, `beforeEach`, `afterEach`
- Assertion library: `node:assert` (strict mode via `assert.strictEqual`, `assert.deepStrictEqual`)

**Test file:** `bin/gsd-tools.test.cjs` (2,302 lines, 81 test cases across 18 describe blocks)

**Config file:** None — tests run directly with Node.js

## Run Commands

```bash
node --test bin/gsd-tools.test.cjs        # Run all tests
node --test --test-name-pattern="phase"    # Filter by name pattern
```

No watch mode configured. No coverage tooling configured.

**From AGENTS.md — manual integration test commands:**
```bash
# Test against real project (event-pipeline)
node bin/gsd-tools.cjs init progress --raw 2>/dev/null | python3 -c "import json,sys; ..."
node bin/gsd-tools.cjs roadmap analyze --raw 2>/dev/null | python3 -c "import json,sys; ..."
```

## Test File Organization

**Location:** Co-located with source in `bin/` directory
- Source: `bin/gsd-tools.cjs`
- Tests: `bin/gsd-tools.test.cjs`

**Naming:** Mirror of source file with `.test` suffix

**Structure:**
```
bin/
  gsd-tools.cjs          # Source (6,495 lines)
  gsd-tools.test.cjs     # Tests (2,302 lines)
```

## Test Architecture

**Black-box testing via CLI execution:**
Tests invoke `gsd-tools.cjs` as a subprocess using `execSync`, not by importing functions directly. This means:
- Tests validate the full command pipeline (argument parsing + logic + output)
- No internal function access — everything tested through the CLI interface
- Output is parsed as JSON and validated with assertions

**Test helper:**
```javascript
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}
```

## Test Data & Fixtures

**Temp directory pattern — used by every test suite:**
```javascript
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

**Test data is inline:** Each test creates its own `.planning/` structure with `fs.writeFileSync` and `fs.mkdirSync`. No shared fixture files.

**Pattern for test setup:**
```javascript
describe('some command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();  // Fresh temp dir each test
  });

  afterEach(() => {
    cleanup(tmpDir);  // Always clean up
  });

  test('specific behavior', () => {
    // 1. Write test files into tmpDir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    // 2. Run command against tmpDir
    const result = runGsdTools('roadmap get-phase 1', tmpDir);

    // 3. Assert success
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 4. Parse and validate JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
  });
});
```

## Test Structure Pattern

**Suite organization follows a consistent pattern:**

```javascript
// ASCII divider matching source file style
// ---------------------------------------------------------------
// command-name command
// ---------------------------------------------------------------

describe('command-name command', () => {
  // Setup/teardown
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  // Happy path first
  test('basic functionality works', () => { ... });

  // Edge cases
  test('handles empty input', () => { ... });
  test('handles missing files gracefully', () => { ... });

  // Backward compatibility
  test('flat provides field still works (backward compatibility)', () => { ... });
  test('inline array syntax supported', () => { ... });

  // Error cases
  test('rejects missing phase', () => { ... });
  test('returns error for invalid input', () => { ... });
});
```

## Covered Commands (18 test suites)

| Suite | Tests | What's Tested |
|-------|-------|---------------|
| `history-digest` | 6 | Frontmatter extraction, merging, malformed files, backward compat |
| `phases list` | 5 | Directory listing, numeric sort, decimal phases, `--type`, `--phase` filter |
| `roadmap get-phase` | 7 | Phase extraction, decimal phases, `##`/`###` headers, malformed roadmap |
| `phase next-decimal` | 5 | Decimal calculation, gaps, padding, missing base phase |
| `phase-plan-index` | 6 | Plan inventory, wave grouping, summaries, checkpoints |
| `state-snapshot` | 5 | Field extraction, decisions table, blockers, session, paused_at |
| `summary-extract` | 5 | Frontmatter extraction, `--fields` filtering, missing fields, decisions |
| `init commands` | 5 | execute-phase, plan-phase, progress, phase-op path resolution |
| `roadmap analyze` | 3 | Phase parsing, disk status, goals/dependencies |
| `phase add` | 2 | Phase appending, empty roadmap |
| `phase insert` | 5 | Decimal insertion, sibling increment, missing phase, padding, `####` headers |
| `phase remove` | 4 | Directory removal, renumbering, `--force`, decimal phases, STATE.md update |
| `phase complete` | 6 | State transition, last phase detection, requirements update, bracket format |
| `milestone complete` | 2 | Archive creation, MILESTONES.md append |
| `validate consistency` | 3 | Consistency pass, orphan detection, gap detection |
| `progress` | 3 | JSON format, bar format, table format |
| `todo complete` | 2 | Move pending→completed, nonexistent todo |
| `scaffold` | 5 | Context, UAT, verification, phase-dir, no-overwrite |

## Assertion Patterns

**Success check + JSON parse — the standard pattern:**
```javascript
assert.ok(result.success, `Command failed: ${result.error}`);
const output = JSON.parse(result.output);
```

**Strict equality for scalar values:**
```javascript
assert.strictEqual(output.phase_number, '03', 'phase number correct');
assert.strictEqual(output.plans.length, 3, 'should have 3 plans');
```

**Deep equality for arrays/objects:**
```javascript
assert.deepStrictEqual(
  output.directories,
  ['01-foundation', '02-api', '10-final'],
  'should be sorted numerically'
);
```

**String containment for file content verification:**
```javascript
const roadmap = fs.readFileSync(..., 'utf-8');
assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
assert.ok(!roadmap.includes('Phase 2: Auth'), 'removed phase should not be in roadmap');
```

**Expected failure assertions:**
```javascript
assert.ok(!result.success, 'should fail without --force');
assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');
```

**Descriptive assertion messages:** Every assertion includes a message string explaining what's expected. This is enforced by convention, not tooling.

## What's NOT Mocked

- No mocking framework — tests use real filesystem operations on temp directories
- No git mocking — git-dependent tests are absent from the test file
- No network mocking — web search (`cmdWebsearch`) is not tested
- No process mocking — tests fork real `node` processes via `execSync`

## Coverage

**No formal coverage tracking.** No `--coverage` flag or coverage tool configured.

**Estimated coverage by analysis:**
- 18 of ~79 command functions have test suites (~23% function coverage)
- Core parsing/analysis commands are well-tested
- State mutation commands (add-decision, add-blocker, record-metric) are not tested
- Git integration commands (commit, session-diff, rollback-info) are not tested
- Web search, codebase-impact, velocity commands are not tested
- Helper functions tested indirectly through command tests

## Untested Command Categories

**State progression:** `cmdStateAdvancePlan`, `cmdStateRecordMetric`, `cmdStateUpdateProgress`, `cmdStateAddDecision`, `cmdStateAddBlocker`, `cmdStateResolveBlocker`, `cmdStateRecordSession`

**Git operations:** `cmdCommit`, `cmdSessionDiff`, `cmdRollbackInfo`, `cmdVerifyCommits`

**Verification suite:** `cmdVerifyPlanStructure`, `cmdVerifyPhaseCompleteness`, `cmdVerifyReferences`, `cmdVerifyArtifacts`, `cmdVerifyKeyLinks`

**Template/frontmatter:** `cmdTemplateFill`, `cmdTemplateSelect`, `cmdFrontmatterGet/Set/Merge/Validate`

**Analysis commands:** `cmdContextBudget`, `cmdTestRun`, `cmdSearchDecisions`, `cmdValidateDependencies`, `cmdSearchLessons`, `cmdCodebaseImpact`, `cmdVelocity`, `cmdTraceRequirement`, `cmdValidateConfig`

**Compound init commands:** Only `init execute-phase`, `init plan-phase`, `init progress`, `init phase-op` are tested. Missing: `init new-project`, `init new-milestone`, `init quick`, `init resume`, `init verify-work`, `init todos`, `init milestone-op`, `init map-codebase`

## Testing Approach Summary

The project uses a **black-box integration testing** approach:
1. Each test creates a minimal `.planning/` directory structure in a temp directory
2. Runs the CLI tool as a subprocess against that directory
3. Parses JSON output and asserts expected values
4. Verifies filesystem side-effects (file creation, content changes)
5. Cleans up temp directory after each test

**Manual testing** is also used, running commands against the real `/mnt/raid/DEV/event-pipeline/.planning/` directory (documented in AGENTS.md).

**Adding new tests:**
1. Add a new `describe` block in `bin/gsd-tools.test.cjs` with ASCII divider comment
2. Use `createTempProject()` / `cleanup()` in beforeEach/afterEach
3. Create necessary `.planning/` files inline in each test
4. Run command via `runGsdTools('command args', tmpDir)`
5. Parse output with `JSON.parse(result.output)`
6. Use descriptive assertion messages
7. Test: happy path, edge cases, error cases, backward compatibility

---

*Testing analysis: 2026-02-21*
