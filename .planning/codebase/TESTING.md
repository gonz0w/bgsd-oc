# Testing Patterns

**Analysis Date:** 2026-03-07

## Test Framework

**Runner:**
- Node.js built-in `node:test` (no external test framework)
- Config: None — uses `node --test` CLI flag
- Node.js >=18 required (`engines` in `package.json`)

**Assertion Library:**
- `node:assert` (built-in) — primarily `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`

**Run Commands:**
```bash
npm test                              # Run all 812 tests (767 main + 45 format)
node --test bin/gsd-tools.test.cjs    # Run main test suite directly (18,125 lines)
```

## Test File Organization

**Location:**
- Co-located in `bin/` alongside the built artifact
- Tests run against the **built bundle** (`bin/gsd-tools.cjs`), not source files
- Exception: Some tests directly `require('../src/commands/agent')` for unit-level testing of internal functions

**Naming:**
- `bin/gsd-tools.test.cjs` — single monolithic test file (18,125 lines, 767 tests, 188 describe blocks)

**Structure:**
```
bin/
├── gsd-tools.cjs          # Built CLI bundle (tested artifact)
├── gsd-tools.test.cjs     # Monolithic test suite (integration + unit + contract)
└── manifest.json           # Build manifest
test/
└── __snapshots__/
    ├── init-phase-op.json  # Snapshot fixture for init:phase-op output
    └── state-read.json     # Snapshot fixture for verify:state output
```

## Test Architecture

**Integration-first approach:** The primary test suite tests the CLI as a subprocess. Each test:
1. Creates a temp directory with `.planning/phases/` structure
2. Writes fixture files (ROADMAP.md, STATE.md, config.json, PLAN.md, SUMMARY.md)
3. Runs `node bin/gsd-tools.cjs <namespace:command> [args]` via `execSync`
4. Parses JSON stdout
5. Asserts on the JSON output structure and values
6. Cleans up temp directory in `afterEach`

**No mocking.** Tests use real filesystem operations — no mocks, stubs, or test doubles. The test helper `runGsdTools()` spawns an actual child process.

## Test Structure

**Suite Organization:**
```javascript
// Section divider comment (matches source file convention)
// ─────────────────────────────────────────────────────────────────────────────
// command-name command
// ─────────────────────────────────────────────────────────────────────────────

describe('command-name command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('happy path returns expected output', () => {
    // Setup: create files in tmpDir
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap...`);

    // Execute
    const result = runGsdTools('plan:roadmap get-phase 1', tmpDir);

    // Assert success
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Parse and assert JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
  });

  test('missing input returns graceful error', () => {
    const result = runGsdTools('plan:roadmap get-phase 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should return not found');
  });
});
```

**Patterns:**
- Every `describe` block uses `beforeEach`/`afterEach` for temp directory lifecycle
- First assertion always checks `result.success` with error context: `assert.ok(result.success, \`Command failed: ${result.error}\`)`
- JSON output parsed inline: `const output = JSON.parse(result.output)`
- Assertion messages are descriptive strings: `'phase should be found'`

## Core Test Helpers

**`runGsdTools(args, cwd)`** — Primary test runner (line 14):
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
- Returns `{ success, output, error }` — never throws
- `output` is stdout (trimmed), `error` is stderr
- Commands that call `process.exit(1)` (via `error()`) return `success: false`
- Commands that return JSON error objects (e.g., `{ error: 'File not found' }`) return `success: true`

**`createTempProject()`** — Creates isolated temp directory (line 32):
```javascript
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}
```

**`cleanup(tmpDir)`** — Removes temp directory (line 38):
```javascript
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

## Snapshot Testing

**Custom snapshot comparison** (not node:test snapshots — custom implementation at line 14397):

**`snapshotCompare(actual, fixturePath)`:**
- Compares actual JSON output against stored fixture in `test/__snapshots__/*.json`
- Bootstrap mode: if `GSD_UPDATE_SNAPSHOTS=1` env var is set or fixture doesn't exist, writes the fixture
- Deep comparison: recursively compares objects/arrays/primitives
- Reports diffs with key paths: `"phase_dir: expected '.planning/phases/01-foundation', got '...'"`
- Returns `{ pass, message }` — not an assertion, caller asserts

**Usage:**
```javascript
test('init phase-op output matches snapshot', () => {
  const result = runGsdTools('init:phase-op 1 --verbose', tmpDir);
  const actual = JSON.parse(result.output);

  const fixturePath = path.join(__dirname, '..', 'test', '__snapshots__', 'init-phase-op.json');
  const snap = snapshotCompare(actual, fixturePath);
  assert.ok(snap.pass, snap.message);
});
```

**Update snapshots:**
```bash
GSD_UPDATE_SNAPSHOTS=1 npm test
```

**Snapshot files:**
- `test/__snapshots__/init-phase-op.json` — full output of `init:phase-op` command
- `test/__snapshots__/state-read.json` — full output of `verify:state` command

## Contract Testing

**Custom contract check** (line 14472) — validates required fields exist with correct types:

**`contractCheck(actual, requiredFields, contextName)`:**
- Verifies each required field exists with correct type
- **Additive-safe**: new fields in actual are ALLOWED (don't break contract)
- Missing or wrong-type fields FAIL
- Supports dot-notation keys for nested access
- Returns `{ pass, message }` with detailed violation report

**Usage:**
```javascript
test('init plan-phase has required fields', () => {
  const result = runGsdTools('init:plan-phase 1 --verbose', tmpDir);
  const actual = JSON.parse(result.output);

  const contract = contractCheck(actual, [
    { key: 'phase_found', type: 'boolean' },
    { key: 'phase_dir', type: 'string' },
    { key: 'phase_number', type: 'string' },
    { key: 'plan_count', type: 'number' },
    { key: 'research_enabled', type: 'boolean' },
  ], 'init-plan-phase');
  assert.ok(contract.pass, contract.message);
});
```

**Contract test blocks (7 total):**
- `'contract: init phase-op (full snapshot)'`
- `'contract: state read (full snapshot)'`
- `'contract: init plan-phase fields'`
- `'contract: init new-project fields'`
- `'contract: init execute-phase fields'`
- `'contract: state read fields'`
- `'contract: init progress fields'`

## Test Categories

**188 describe blocks organized into categories:**

**Command Tests (90+ blocks):**
- One `describe` per CLI command/subcommand
- Named `'{namespace:command} command'` or `'{feature-name}'`
- Examples: `'history-digest command'`, `'phase next-decimal command'`, `'state validate'`
- Cover: `history-digest`, `phases list`, `roadmap get-phase`, `phase next-decimal`, `phase-plan-index`, `state-snapshot`, `summary-extract`, `init commands`, `roadmap analyze`, `phase add/insert/remove/complete`, `milestone complete`, `validate consistency`, `progress`, `todo complete`, `scaffold`, `state update/patch/add-decision/add-blocker/resolve-blocker/record-session/advance-plan/record-metric`, `frontmatter round-trip/edge-cases`, `debug logging`, `shell sanitization`, `temp file cleanup`, `--help flag`, `config-migrate`, `codebase-impact`, `--fields flag`, `token estimation`, `extractAtReferences`, `context-budget`, `extract-sections`, `state validate/pre-flight`, `memory commands/compact/trajectories`, `verify analyze-plan/deliverables/requirements/regression/plan-wave/plan-deps/plan-structure/quality`, `mcp-profile`, `assertions`, `worktree`, `session-summary`, `codebase intelligence/conventions/deps/context/lifecycle`, `git log/diff-summary/blame/branch-info/rewind/trajectory-branch`, `pre-commit checks`, `commit --agent`, `codebase ast/exports/complexity/repo-map`, `orchestration`, `agent audit/validate-contracts`, `trajectory checkpoint/list/pivot/compare/choose/dead-ends`, `review`, `tdd`, `profiler`

**Integration Tests (5+ blocks):**
- Named `'integration: {description}'`
- Test multi-command workflows and round-trip operations:
  - `'integration: workflow sequences'` — init → state → roadmap → verify
  - `'integration: state round-trip'` — patch → get → verify persistence → add-decision → get-back
  - Memory write → read → list sequence
  - Verify requirements with mixed coverage

**Contract/Snapshot Tests (7 blocks):**
- Named `'contract: {command} (full snapshot)'` or `'contract: {command} fields'`
- Ensure CLI output format stability for agent consumers
- Use `snapshotCompare()` for full output validation
- Use `contractCheck()` for field-level type validation

**Cross-cutting Tests:**
- `'--help flag'` — help text output for commands
- `'--fields flag'` — JSON field filtering
- `'build system'` — build succeeds, shebang correct, bundle size within budget, timing <500ms
- `'file cache'` — cache-enabled commands produce valid output
- `'debug logging'` — `GSD_DEBUG=1` behavior (stderr output, stdout JSON untouched)
- `'shell sanitization'` — input escaping prevents injection
- `'temp file cleanup'` — large payload tmpfile lifecycle
- `'profiler'` — `GSD_PROFILE=1` baseline generation and comparison

## Environment Variables in Tests

| Variable | Purpose | Usage |
|----------|---------|-------|
| `GSD_DEBUG=1` | Enable debug logging | Tested in `debug logging` block |
| `GSD_UPDATE_SNAPSHOTS=1` | Update snapshot fixtures | Bootstrap/regenerate snapshots |
| `GSD_PROFILE=1` | Enable profiler | Tested in `profiler` block |
| `GSD_CACHE_FORCE_MAP=1` | Force Map-based cache (skip SQLite) | Via `--no-cache` flag |

## Mocking

**Framework:** None. No mocking library used.

**Approach:** All tests use real filesystem I/O in isolated temp directories. No mocking of:
- `fs` module
- `child_process` (except `runGsdTools` spawns real subprocess)
- `process.exit`
- Git operations

**What NOT to Mock:**
- Filesystem operations (use real temp dirs instead)
- Git commands (tested as integration where needed — some tests do `git init && git commit`)
- External processes (subprocess execution is the test mechanism)

## Fixtures and Factories

**Test Data:**
- Created inline within each test using `fs.writeFileSync`:
```javascript
fs.writeFileSync(
  path.join(phaseDir, '01-01-SUMMARY.md'),
  `---
phase: "01"
name: "Foundation Setup"
provides:
  - "Database schema"
key-decisions:
  - "Use Prisma over Drizzle"
---

# Summary content here
`
);
```

**Fixture patterns for common file types:**
- **STATE.md:** Field key-value pairs with `**Field:** value` pattern
- **ROADMAP.md:** Phase headers with goals: `### Phase 1: Foundation\n**Goal:** Set up project`
- **PLAN.md:** YAML frontmatter (`wave`, `plan`, `phase`, `type`, `autonomous`, `depends_on`, `requirements`, `files_modified`, `must_haves`) + `<task>` XML blocks
- **SUMMARY.md:** YAML frontmatter with `provides`, `key-decisions`, `patterns-established`, `tech-stack` arrays
- **config.json:** Direct `JSON.stringify()` of config objects
- **REQUIREMENTS.md:** Markdown checklist: `- [ ] **REQ-01**: Description`
- **INTENT.md:** XML-tagged sections (`<objective>`, `<users>`, `<outcomes>`, `<criteria>`)

**Specialized helpers for complex setups:**
- Some describe blocks define their own helpers (e.g., `writeTrajectoryEntries()` for trajectory tests)
- Git-dependent tests do inline `execSync('git init && git config ... && git add . && git commit ...')`

**Location:**
- No separate fixtures directory (except `test/__snapshots__/` for snapshot fixtures)
- All test data is inline within test functions
- Helper functions defined at the top of the test file or within describe blocks

## Coverage

**Requirements:** No coverage threshold enforced. No coverage tool configured.

**View Coverage:** Not available — `node:test` has `--experimental-test-coverage` but it's not configured.

**Implicit coverage tracking:**
```bash
node bin/gsd-tools.cjs verify:test-coverage
```
This introspects the test file for `runGsdTools('command ...')` calls and compares against router commands to report command-level coverage (not line-level).

## Test Types

**Unit Tests (via direct require):**
- Some tests within `gsd-tools.test.cjs` directly require source modules:
  ```javascript
  const agentModule = require('../src/commands/agent');
  const result = agentModule.parseRaciMatrix(path.join(refsDir, 'RACI.md'));
  ```
- Pure function tests: frontmatter round-trip, slug generation, shell sanitization, extractAtReferences

**Integration Tests (CLI subprocess — the vast majority):**
- 750+ tests spawn `node bin/gsd-tools.cjs` as subprocess with temp directory as cwd
- Assert on JSON stdout, check stderr for errors
- Test real filesystem, real file parsing, real frontmatter extraction

**Contract Tests:**
- Snapshot comparison for full output shape stability
- Field-level type checking for additive-safe API contracts
- Ensure agents consuming CLI output don't break when new fields are added

**Build Validation Tests:**
```javascript
describe('build system', () => {
  test('npm run build succeeds with exit code 0', () => { ... });
  test('build produces bin/gsd-tools.cjs from src/', () => { ... });
  test('built file has working shebang on line 1', () => { ... });
  test('built current-timestamp outputs valid ISO format', () => { ... });
  test('built state load works in temp project', () => { ... });
  test('build completes in under 500ms', () => { ... });
});
```

**E2E Simulation:**
- `'integration: workflow sequences'` tests full lifecycle:
  - init:progress → verify:state → plan:roadmap analyze → verify:state patch → verify:state get → memory write → memory read → memory list → verify:verify requirements

## Common Patterns

**Success Testing:**
```javascript
test('command returns expected output', () => {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
  const result = runGsdTools('plan:roadmap analyze', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.phase_count, 3, 'should have 3 phases');
  assert.ok(Array.isArray(output.phases), 'phases should be array');
});
```

**Error Testing (recoverable — JSON error response):**
```javascript
test('missing phase returns not found', () => {
  const result = runGsdTools('plan:roadmap get-phase 99', tmpDir);
  assert.ok(result.success, `Command should succeed: ${result.error}`);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.found, false, 'should return not found');
});
```

**Error Testing (fatal — process.exit(1)):**
```javascript
test('missing required arg exits with error', () => {
  const result = runGsdTools('execute:commit', tmpDir);  // No message
  assert.strictEqual(result.success, false, 'should fail');
  assert.ok(result.error.includes('Error:'), 'should have error message on stderr');
});
```

**Backward Compatibility Testing:**
```javascript
test('flat provides field still works (backward compatibility)', () => {
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), `---\nprovides:\n  - "Direct provides"\n---\n`);
  const result = runGsdTools('util:history-digest', tmpDir);
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(digest.phases['01'].provides, ['Direct provides']);
});
```

**Malformed Input Graceful Handling:**
```javascript
test('malformed SUMMARY.md skipped gracefully', () => {
  fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), `# Just a heading\nNo frontmatter here\n`);
  fs.writeFileSync(path.join(phaseDir, '01-03-SUMMARY.md'), `---\nbroken: [unclosed\n---\n`);
  const result = runGsdTools('util:history-digest', tmpDir);
  assert.ok(result.success, `Command should succeed despite malformed files`);
});
```

**Performance/Size Testing:**
```javascript
test('build completes in under 500ms', () => {
  const result = execSync('npm run build', { cwd: path.join(__dirname, '..'), encoding: 'utf-8', timeout: 15000 });
  const match = result.match(/in (\d+)ms/);
  const elapsed = parseInt(match[1], 10);
  assert.ok(elapsed < 500, `Build took ${elapsed}ms, should be under 500ms`);
});
```

**Git-Dependent Testing:**
```javascript
test('trajectory checkpoint creates entry', () => {
  fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'dummy.txt'), 'hello');
  execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

  const result = runGsdTools('execute:trajectory checkpoint test-cp --scope task', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);
});
```

## Adding New Tests

**For a new command:**
1. Add a new `describe` block in `bin/gsd-tools.test.cjs`
2. Use the section divider comment pattern above the `describe`:
   ```javascript
   // ─────────────────────────────────────────────────────────────────────────────
   // new-command description
   // ─────────────────────────────────────────────────────────────────────────────
   ```
3. Include `beforeEach`/`afterEach` with `createTempProject`/`cleanup`
4. Test at minimum: happy path, missing input, edge case, backward compatibility
5. Use `runGsdTools('namespace:command args', tmpDir)` pattern
6. Parse output as JSON, assert on structure
7. Use namespaced command format (e.g., `'plan:phase add "New Phase"'`)

**For a new lib function:**
1. If testable via CLI: add integration test using `runGsdTools`
2. If internal-only: require directly from source and test unit-level:
   ```javascript
   const { myFunction } = require('../src/lib/mymodule');
   ```
3. Follow existing `describe`/`test` naming patterns

**For a new contract:**
1. Add a `describe('contract: command-name fields', ...)` block
2. Use `contractCheck(actual, requiredFields, contextName)`
3. Define required fields with `{ key, type }` objects
4. Test that adding new fields doesn't break contract (additive safety)

**Test naming convention:**
- Describe: `'{command-name} command'` or `'{feature-name}'` or `'contract: {command} fields'`
- Test: descriptive lowercase sentence starting with action verb or condition:
  - `'extracts phase section from ROADMAP.md'`
  - `'returns not found for missing phase'`
  - `'handles decimal phase numbers'`
  - `'empty phases directory returns empty array'`
  - `'malformed SUMMARY.md skipped gracefully'`
  - `'adding new field to plan-phase does not break contract'`

## Known Testing Limitations

- **Test runtime:** Full suite takes 2+ minutes due to subprocess spawning per test
- **No parallel execution:** Tests run sequentially (each creates temp dirs)
- **No line-level coverage:** Only command-level coverage tracking available
- **Single file:** All 767 tests in one 18,125-line file (no file splitting), plus 45 tests in `format.test.cjs`
- **Build dependency:** Most tests require `npm run build` to have been run first (test against built bundle)

---

*Testing analysis: 2026-03-07*
