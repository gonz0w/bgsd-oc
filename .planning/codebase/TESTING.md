# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Node.js built-in `node:test` (no external test framework)
- Config: None — uses `node --test` CLI flag
- Node.js >=18 required (`engines` in `package.json`)

**Assertion Library:**
- `node:assert` (built-in) — primarily `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`

**Run Commands:**
```bash
npm test                              # Run all tests (577 tests)
node --test bin/gsd-tools.test.cjs    # Run main test suite directly
node --test bin/format.test.cjs       # Run format module tests separately
```

## Test File Organization

**Location:**
- Co-located in `bin/` alongside the built artifact
- Tests run against the **built bundle** (`bin/gsd-tools.cjs`), not source files
- Exception: `bin/format.test.cjs` imports directly from `src/lib/format` (unit tests)

**Naming:**
- `bin/gsd-tools.test.cjs` — main test suite (13,736 lines, 577 tests, 80 describe blocks)
- `bin/format.test.cjs` — format module unit tests (365 lines, 45 tests)

**Structure:**
```
bin/
├── gsd-tools.cjs          # Built CLI bundle (tested artifact)
├── gsd-tools.test.cjs     # Main test suite (integration + unit)
└── format.test.cjs         # Format module unit tests
```

## Test Architecture

**Integration-first approach:** The primary test suite (`gsd-tools.test.cjs`) tests the CLI as a subprocess. Each test:
1. Creates a temp directory with `.planning/` structure
2. Runs `node bin/gsd-tools.cjs <command>` via `execSync`
3. Parses JSON stdout
4. Asserts on the JSON output structure and values
5. Cleans up temp directory

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
    const result = runGsdTools('roadmap get-phase 1', tmpDir);

    // Assert success
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Parse and assert JSON output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
  });

  test('missing input returns graceful error', () => {
    const result = runGsdTools('roadmap get-phase 99', tmpDir);
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

## Test Categories

**80 describe blocks organized into categories:**

**Command Tests (unit-level, 60+ blocks):**
- One `describe` per CLI command/subcommand
- Named `'{command} command'` or `'{command} {subcommand}'`
- Examples: `'history-digest command'`, `'phase next-decimal command'`, `'state validate'`

**Integration Tests (5 blocks):**
- Named `'integration: {description}'`
- Test multi-command workflows and round-trip operations:
  - `'integration: workflow sequences'` — multi-step verify workflows
  - `'integration: state round-trip'` — patch → get → verify persistence
  - `'integration: config migration'` — old → new config format
  - `'integration: e2e simulation'` — full plan lifecycle
  - `'integration: snapshot tests'` — output format stability

**Cross-cutting Tests:**
- `'--help flag'` — help text output for all commands
- `'--fields flag'` — JSON field filtering
- `'compact default behavior'` — compact mode across all init commands
- `'build system'` — bundle size within budget
- `'build pipeline'` — build + test pipeline
- `'debug logging'` — GSD_DEBUG env var behavior
- `'shell sanitization'` — input escaping
- `'temp file cleanup'` — large payload tmpfile lifecycle

## Mocking

**Framework:** None. No mocking library used.

**Approach:** All tests use real filesystem I/O in isolated temp directories. No mocking of:
- `fs` module
- `child_process` (except `runGsdTools` spawns real subprocess)
- `process.exit` 
- Git operations

**What to Mock:** Nothing — the test architecture avoids mocking by:
1. Creating temp directories per test
2. Running the CLI as a subprocess (complete isolation)
3. Asserting on JSON output (black-box testing)

**What NOT to Mock:**
- Filesystem operations (use real temp dirs instead)
- Git commands (tested as integration where needed)
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
- STATE.md: Field key-value pairs (`**Current Phase:** 03`)
- ROADMAP.md: Phase headers with goals (`### Phase 1: Foundation\n**Goal:** Set up project`)
- PLAN.md: YAML frontmatter + `## Task` headers
- SUMMARY.md: YAML frontmatter with provides/decisions/patterns arrays
- config.json: Direct `JSON.stringify()` of config objects

**Specialized helpers for complex setups:**
```javascript
// In lifecycle tests section:
function createLifecycleProject(files) {
  const tmpDir = createTempProject();
  // Create .planning/codebase directory for intel
  fs.mkdirSync(path.join(tmpDir, '.planning', 'codebase'), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return tmpDir;
}
```

**Location:**
- No separate fixtures directory
- All test data is inline within test functions
- Helper functions defined at the top of the test file or within describe blocks

## Coverage

**Requirements:** No coverage threshold enforced. No coverage tool configured.

**View Coverage:** Not available — `node:test` has `--experimental-test-coverage` but it's not configured.

**Implicit coverage tracking via `test-coverage` command:**
```bash
node bin/gsd-tools.cjs test-coverage
```
This introspects the test file for `runGsdTools('command ...')` calls and compares against router commands to report command-level coverage (not line-level).

## Test Types

**Unit Tests:**
- `bin/format.test.cjs` — direct function imports, tests individual format primitives
- Some tests within `gsd-tools.test.cjs` test pure functions (frontmatter round-trip, slug generation, shell sanitization)
- Pattern: import function directly, call with args, assert on return value

**Integration Tests (CLI subprocess):**
- The vast majority of tests (570+) in `gsd-tools.test.cjs`
- Spawn `node bin/gsd-tools.cjs` as subprocess with temp directory as cwd
- Assert on JSON stdout, check stderr for errors
- Test real filesystem, real file parsing, real frontmatter extraction

**E2E Simulation:**
- `'integration: e2e simulation'` block tests full plan lifecycle:
  - Create project structure → run init → check state → advance plan → verify
- `'integration: workflow sequences'` tests multi-step verify workflows

## Common Patterns

**Success Testing:**
```javascript
test('command returns expected output', () => {
  // Setup files
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);

  const result = runGsdTools('roadmap analyze', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.total_phases, 3, 'should have 3 phases');
  assert.ok(Array.isArray(output.phases), 'phases should be array');
});
```

**Error Testing:**
```javascript
test('missing input returns graceful error', () => {
  const result = runGsdTools('roadmap get-phase 99', tmpDir);
  // Note: many "error" cases still return success=true with error in JSON
  assert.ok(result.success, `Command should succeed: ${result.error}`);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.found, false, 'should return not found');
  assert.strictEqual(output.error, 'Phase not found', 'should report error');
});
```

**Fatal error testing (process.exit(1)):**
```javascript
test('missing required arg exits with error', () => {
  const result = runGsdTools('commit', tmpDir);  // No message
  assert.strictEqual(result.success, false, 'should fail');
  assert.ok(result.error.includes('Error:'), 'should have error message on stderr');
});
```

**Backward Compatibility Testing:**
```javascript
test('flat provides field still works (backward compatibility)', () => {
  // Test old format still parses correctly
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), `---\nprovides:\n  - "Direct provides"\n---\n`);
  const result = runGsdTools('history-digest', tmpDir);
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(digest.phases['01'].provides, ['Direct provides']);
});
```

**Size/Performance Testing:**
```javascript
test('compact default reduces init output size by at least 38% vs --verbose', () => {
  const commands = ['init progress', 'init execute-phase 03', /* ... */];
  const reductions = [];
  for (const cmd of commands) {
    const full = runGsdTools(`${cmd} --verbose`, tmpDir);
    const compact = runGsdTools(`${cmd}`, tmpDir);
    // Calculate byte-size reduction...
  }
  const avgReduction = reductions.reduce((sum, r) => sum + r.reduction, 0) / reductions.length;
  assert.ok(avgReduction >= 38, `Expected >=38%, got ${avgReduction.toFixed(1)}%`);
});
```

**Build Validation Testing:**
```javascript
describe('build system', () => {
  test('bundle size within budget', () => {
    const stat = fs.statSync('bin/gsd-tools.cjs');
    const sizeKB = Math.round(stat.size / 1024);
    assert.ok(sizeKB <= 1000, `Bundle ${sizeKB}KB exceeds 1000KB budget`);
  });
});
```

## Adding New Tests

**For a new command:**
1. Add a new `describe` block in `bin/gsd-tools.test.cjs`
2. Use the section divider comment pattern above the `describe`
3. Include `beforeEach`/`afterEach` with `createTempProject`/`cleanup`
4. Test at minimum: happy path, missing input, edge case
5. Use `runGsdTools('new-command args', tmpDir)` pattern
6. Parse output as JSON, assert on structure

**For a new lib function:**
1. If it's a format primitive: add tests to `bin/format.test.cjs`
2. If it's a parsing/utility function: either test via CLI in main test suite, or add direct import test
3. Follow existing `describe`/`test` naming patterns

**Test naming convention:**
- Describe: `'{command-name} command'` or `'{command} {subcommand}'`
- Test: descriptive lowercase sentence starting with action verb or condition:
  - `'extracts phase section from ROADMAP.md'`
  - `'returns not found for missing phase'`
  - `'handles decimal phase numbers'`
  - `'empty phases directory returns empty array'`
  - `'malformed SUMMARY.md skipped gracefully'`

---

*Testing analysis: 2026-02-26*
