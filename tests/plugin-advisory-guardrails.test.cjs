/**
 * Advisory Guardrails Tests (Phase 76)
 *
 * Tests for src/plugin/advisory-guardrails.js — convention violation detection,
 * planning file protection, and debounced test suggestions.
 *
 * Uses Node.js built-in test runner (node:test) with CJS extension.
 * Tests call createAdvisoryGuardrails directly with mock notifier and temp directories.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper: dynamic import the built plugin.js (ESM)
let createAdvisoryGuardrails;
async function loadModule() {
  if (createAdvisoryGuardrails) return;
  const mod = await import('../plugin.js');
  createAdvisoryGuardrails = mod.createAdvisoryGuardrails;
}

// Helper: create a temp project directory with standard files
function createTempProject(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

  // AGENTS.md with convention info
  if (opts.convention) {
    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      `# Project\n\nUse ${opts.convention} naming convention for files.\n`
    );
  }

  // package.json for test command detection
  if (opts.testCommand !== false) {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        scripts: { test: opts.testCommand || 'npm test' },
      })
    );
  }

  return tmpDir;
}

function cleanup(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

// Mock notifier that captures notifications
function createMockNotifier() {
  const calls = [];
  return {
    calls,
    notify: async (notification) => {
      calls.push(notification);
    },
    drainPendingContext: () => [],
    reset: () => { calls.length = 0; },
  };
}

// Helper: simulate a file write tool event
function writeEvent(filePath) {
  return { tool: 'write', args: { filePath } };
}

function editEvent(filePath) {
  return { tool: 'edit', args: { filePath } };
}

// ─── GARD-01: Convention Checks ──────────────────────────────────────────────

describe('GARD-01: Convention violation detection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('camelCase file in kebab-case project triggers warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-convention');
    assert.strictEqual(notifier.calls[0].severity, 'warning');
    assert.ok(notifier.calls[0].message.includes('camelCase'));
    assert.ok(notifier.calls[0].message.includes('kebab-case'));
    assert.ok(notifier.calls[0].message.includes('my-component.js'));
  });

  test('kebab-case file in kebab-case project does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'my-component.js')));

    // Only test suggestion should fire (GARD-03), not convention
    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('single-word filename does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('.planning/ file does NOT trigger convention warning (handled by GARD-02)', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0);
  });

  test('node_modules file does NOT trigger any warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'node_modules', 'foo', 'bar.js')));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('dedup threshold — 4th convention warning is suppressed', async () => {
    const config = { advisory_guardrails: { dedup_threshold: 3 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // 3 violations — all should produce warnings
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myFirst.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'mySecond.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myThird.js')));

    const conventionBefore = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionBefore.length, 3);

    // 4th violation — should be suppressed (not === threshold)
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myFourth.js')));

    const conventionAfter = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionAfter.length, 3, '4th warning should be suppressed by dedup threshold');
  });

  test('dedup summary fires at batch boundary (every 5th)', async () => {
    const config = { advisory_guardrails: { dedup_threshold: 3 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Generate 5 violations — 3 individual + suppressed 4th + summary at 5th
    for (let i = 1; i <= 5; i++) {
      await guardrails.onToolAfter(writeEvent(path.join(tmpDir, `myFile${i}.js`)));
    }

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    // 3 individual + 1 summary at count 5
    assert.strictEqual(conventionCalls.length, 4);
    assert.ok(conventionCalls[3].message.includes('5 convention violations'));
  });
});

// ─── GARD-02: Planning File Protection ───────────────────────────────────────

describe('GARD-02: Planning file protection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('direct write to .planning/ROADMAP.md triggers warning naming /bgsd-add-phase', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-add-phase'));
    assert.strictEqual(planningCalls[0].severity, 'warning');
  });

  test('direct write to .planning/STATE.md triggers warning naming /bgsd-progress', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'STATE.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-progress'));
  });

  test('direct write to unknown .planning/ file triggers generic warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'unknown-file.txt')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('bGSD workflows manage'));
  });

  test('write to .planning/ while bgsdCommandActive=true does NOT trigger warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    guardrails.setBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 0);
  });

  test('write to .planning/config.json triggers warning naming /bgsd-settings', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'config.json')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-settings'));
  });

  test('clearBgsdCommandActive re-enables warnings', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    guardrails.setBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    assert.strictEqual(notifier.calls.filter(c => c.type === 'advisory-planning').length, 0);

    guardrails.clearBgsdCommandActive();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    assert.strictEqual(notifier.calls.filter(c => c.type === 'advisory-planning').length, 1);
  });
});

// ─── GARD-03: Test Suggestions ───────────────────────────────────────────────

describe('GARD-03: Test suggestions', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case', testCommand: 'npm test' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('writing a .js source file queues a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    // Wait for debounce to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1);
    assert.ok(testCalls[0].message.includes('npm test'));
    assert.ok(testCalls[0].message.includes('index.js'));
  });

  test('writing a .md file does NOT queue a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'README.md')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0);
  });

  test('writing a .test.js file does NOT queue a test suggestion', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'foo.test.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0);
  });

  test('multiple source files within debounce window produce single suggestion with count', async () => {
    const config = { advisory_guardrails: { test_debounce_ms: 50 } };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Write 3 source files rapidly
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'a.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'b.js')));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'c.js')));

    // Wait for debounce to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1, 'should produce a single debounced suggestion');
    assert.ok(testCalls[0].message.includes('3 source files'));
    assert.ok(testCalls[0].message.includes('npm test'));
  });

  test('test suggestion includes detected test command from package.json', async () => {
    // Create project with custom test command
    const customDir = createTempProject({
      convention: 'kebab-case',
      testCommand: 'jest --coverage',
    });

    try {
      const config = { advisory_guardrails: { test_debounce_ms: 50 } };
      const guardrails = createAdvisoryGuardrails(customDir, notifier, config);

      await guardrails.onToolAfter(writeEvent(path.join(customDir, 'handler.ts')));

      await new Promise(resolve => setTimeout(resolve, 100));

      const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
      assert.strictEqual(testCalls.length, 1);
      // It should detect npm test from package.json scripts.test
      assert.ok(testCalls[0].message.includes('npm test'));
    } finally {
      cleanup(customDir);
    }
  });
});

// ─── Config Integration ──────────────────────────────────────────────────────

describe('Config integration', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case', testCommand: 'npm test' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('enabled=false disables all guardrails', async () => {
    const config = {
      advisory_guardrails: { enabled: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));
    // Planning file
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    // Source file for test suggestion
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.strictEqual(notifier.calls.length, 0, 'no notifications when enabled=false');
  });

  test('conventions=false disables GARD-01 only', async () => {
    const config = {
      advisory_guardrails: { conventions: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation — should NOT trigger
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 0, 'convention warnings disabled');

    // Test suggestion should still fire (GARD-03)
    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 1, 'test suggestions still active');
  });

  test('planning_protection=false disables GARD-02 only', async () => {
    const config = {
      advisory_guardrails: { planning_protection: false, test_debounce_ms: 50 },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Planning file write — should NOT trigger GARD-02
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'ROADMAP.md')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 0, 'planning protection disabled');
  });

  test('test_suggestions=false disables GARD-03 only', async () => {
    const config = {
      advisory_guardrails: { test_suggestions: false },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Convention violation — should still fire (GARD-01)
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1, 'convention warnings still active');

    // Source file — should NOT trigger test suggestion
    notifier.reset();
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'index.js')));

    await new Promise(resolve => setTimeout(resolve, 100));

    const testCalls = notifier.calls.filter(c => c.type === 'advisory-test');
    assert.strictEqual(testCalls.length, 0, 'test suggestions disabled');
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('non-write tool does not trigger any guardrail', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter({ tool: 'read', args: { filePath: path.join(tmpDir, 'myComponent.js') } });
    await guardrails.onToolAfter({ tool: 'glob', args: { pattern: '**/*.js' } });

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('null/undefined input does not throw', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(null);
    await guardrails.onToolAfter(undefined);
    await guardrails.onToolAfter({});
    await guardrails.onToolAfter({ tool: 'write' });
    await guardrails.onToolAfter({ tool: 'write', args: {} });

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('edit tool also triggers guardrails', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(editEvent(path.join(tmpDir, 'myComponent.js')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1);
  });

  test('PascalCase file in kebab-case project triggers warning', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'MyComponent.jsx')));

    const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
    assert.strictEqual(conventionCalls.length, 1);
    assert.ok(conventionCalls[0].message.includes('PascalCase'));
    assert.ok(conventionCalls[0].message.includes('my-component.jsx'));
  });

  test('no convention detected — no convention warning', async () => {
    // Create project without AGENTS.md or codebase-intel.json
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-bare-'));
    fs.mkdirSync(path.join(bareDir, '.planning'), { recursive: true });

    try {
      const config = {};
      const guardrails = createAdvisoryGuardrails(bareDir, notifier, config);

      await guardrails.onToolAfter(writeEvent(path.join(bareDir, 'myComponent.js')));

      const conventionCalls = notifier.calls.filter(c => c.type === 'advisory-convention');
      assert.strictEqual(conventionCalls.length, 0, 'no convention warning when no convention detected');
    } finally {
      cleanup(bareDir);
    }
  });
});
