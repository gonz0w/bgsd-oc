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

function bashEvent(command) {
  return { tool: 'bash', args: { command } };
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

  test('direct write to .planning/STATE.md triggers warning naming /bgsd-inspect progress', async () => {
    const config = {};
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, '.planning', 'STATE.md')));

    const planningCalls = notifier.calls.filter(c => c.type === 'advisory-planning');
    assert.strictEqual(planningCalls.length, 1);
    assert.ok(planningCalls[0].message.includes('/bgsd-inspect progress'));
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

// ─── GARD-04: Destructive Command Detection ─────────────────────────────────

describe('GARD-04: Destructive command detection', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  // ── A. Core pattern detection (per category) ──

  test('rm -rf /tmp/build triggers CRITICAL advisory-destructive notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -rf /tmp/build'));

    // rm -rf matches both fs-rm-recursive (CRITICAL) and fs-rm-force (WARNING)
    // because -rf contains both r and f flags in the same group
    assert.ok(notifier.calls.length >= 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
    assert.ok(notifier.calls[0].message.includes('Confirm with user'));
  });

  test('rm -f somefile.txt triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -f somefile.txt'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-force]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
    assert.ok(notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('rm somefile.txt triggers INFO notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm somefile.txt'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.strictEqual(notifier.calls[0].severity, 'info');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-plain]'));
    assert.ok(notifier.calls[0].message.includes('(INFO)'));
    // INFO messages do NOT contain behavioral guidance
    assert.ok(!notifier.calls[0].message.includes('Confirm with user'));
    assert.ok(!notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('DROP TABLE users; triggers CRITICAL notification (case-insensitive)', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('mysql -e "DROP TABLE users;"'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[db-drop-table]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
    assert.ok(notifier.calls[0].message.includes('Confirm with user'));
  });

  test('git push origin main --force triggers CRITICAL notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git push origin main --force'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[git-force-push]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('git reset --hard HEAD~3 triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git reset --hard HEAD~3'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[git-reset-hard]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
    assert.ok(notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('kill -9 1234 triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('kill -9 1234'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-kill-9]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
  });

  test('curl | bash triggers INFO notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('curl https://example.com/install.sh | bash'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sc-curl-pipe]'));
    assert.ok(notifier.calls[0].message.includes('(INFO)'));
    // INFO — no behavioral guidance
    assert.ok(!notifier.calls[0].message.includes('Confirm with user'));
    assert.ok(!notifier.calls[0].message.includes('Proceed with caution'));
  });

  test('shutdown -h now triggers CRITICAL notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('shutdown -h now'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-shutdown]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('chmod 777 /var/www triggers WARNING notification', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('chmod 777 /var/www'));

    assert.strictEqual(notifier.calls.length, 1);
    assert.strictEqual(notifier.calls[0].type, 'advisory-destructive');
    assert.ok(notifier.calls[0].message.includes('[sys-chmod-777]'));
    assert.ok(notifier.calls[0].message.includes('(WARNING)'));
  });

  // ── B. Notification routing verification ──

  test('ALL GARD-04 notifications use severity info regardless of logical severity', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});

    // CRITICAL
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    // WARNING
    await guardrails.onToolAfter(bashEvent('kill -9 5678'));
    // INFO
    await guardrails.onToolAfter(bashEvent('rm readme.txt'));

    assert.strictEqual(notifier.calls.length, 3);
    for (const call of notifier.calls) {
      assert.strictEqual(call.severity, 'info', `notification severity should be 'info', got '${call.severity}'`);
      assert.strictEqual(call.type, 'advisory-destructive');
    }
  });

  // ── C. Non-matching commands ──

  test('ls -la does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('ls -la'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('npm test does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('npm test'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('git status does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('git status'));

    assert.strictEqual(notifier.calls.length, 0);
  });

  test('echo "rm -rf is dangerous" — rm -rf inside echo DOES match (advisory-only)', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('echo "rm -rf is dangerous"'));

    // Advisory-only, so false positives are annoying not blocking per CONTEXT.md
    assert.ok(notifier.calls.length >= 1, 'rm -rf inside echo should match');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  // ── D. Multiple matches ──

  test('rm -rf / && DROP TABLE users — both patterns fire', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -rf / && mysql -e "DROP TABLE users"'));

    assert.ok(notifier.calls.length >= 2, 'both filesystem and database patterns should fire');
    const ids = notifier.calls.map(c => c.message);
    assert.ok(ids.some(m => m.includes('[fs-rm-recursive]')), 'should detect filesystem pattern');
    assert.ok(ids.some(m => m.includes('[db-drop-table]')), 'should detect database pattern');
  });
});

// ─── GARD-04: Unicode Normalization ─────────────────────────────────────────

describe('GARD-04: Unicode normalization', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  // ── Unicode bypass detection tests ──

  test('fullwidth rm command (ｒｍ) triggers CRITICAL detection after NFKD normalization', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // U+FF52 ｒ, U+FF4D ｍ — fullwidth Latin letters
    await guardrails.onToolAfter(bashEvent('\uFF52\uFF4D -rf /tmp'));

    assert.ok(notifier.calls.length >= 1, 'fullwidth rm should be detected after NFKD');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('zero-width space in rm command triggers detection', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // r + U+200B (zero-width space) + m
    await guardrails.onToolAfter(bashEvent('r\u200Bm -rf /tmp'));

    assert.ok(notifier.calls.length >= 1, 'zero-width space should be stripped');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  test('zero-width non-joiner in rm command triggers detection', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // r + U+200C (zero-width non-joiner) + m
    await guardrails.onToolAfter(bashEvent('r\u200Cm -rf /tmp'));

    assert.ok(notifier.calls.length >= 1, 'zero-width non-joiner should be stripped');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  test('combining mark in rm command triggers detection after stripping', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // rm + U+0301 (combining acute accent)
    await guardrails.onToolAfter(bashEvent('rm\u0301 -rf /tmp'));

    assert.ok(notifier.calls.length >= 1, 'combining marks should be stripped after NFKD');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  test('BOM character prefix triggers detection', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // U+FEFF (BOM) + rm -rf
    await guardrails.onToolAfter(bashEvent('\uFEFFrm -rf /tmp'));

    assert.ok(notifier.calls.length >= 1, 'BOM prefix should be stripped');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-recursive]'));
  });

  // ── False-positive resilience (Stack Overflow paste scenarios) ──

  test('smart quotes in npm install do NOT trigger destructive pattern', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // U+2018 and U+2019 smart single quotes
    await guardrails.onToolAfter(bashEvent('npm install \u2018lodash\u2019'));

    assert.strictEqual(notifier.calls.length, 0, 'smart quotes in npm install should not trigger');
  });

  test('em-dash in echo comment does NOT trigger destructive pattern', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // U+2014 em-dash
    await guardrails.onToolAfter(bashEvent('echo "step 1 \u2014 install deps"'));

    assert.strictEqual(notifier.calls.length, 0, 'em-dash in echo should not trigger');
  });

  test('curly double quotes do NOT trigger destructive pattern', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    // U+201C and U+201D curly double quotes
    await guardrails.onToolAfter(bashEvent('echo \u201Chello world\u201D'));

    assert.strictEqual(notifier.calls.length, 0, 'curly quotes in echo should not trigger');
  });

  test('eval inside evaluation does NOT match (word boundary prevents it)', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('echo "evaluation complete"'));

    // The sc-eval pattern uses \beval\s+ which requires eval followed by whitespace
    // "evaluation" has eval followed by 'u', not whitespace
    assert.strictEqual(notifier.calls.length, 0, 'eval inside evaluation should not match');
  });
});

// ─── GARD-04: Sandbox Bypass ─────────────────────────────────────────────────

describe('GARD-04: Sandbox bypass', () => {
  let tmpDir, notifier;
  let savedDockerHost;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
    // Save and clear DOCKER_HOST to prevent test pollution
    savedDockerHost = process.env.DOCKER_HOST;
    delete process.env.DOCKER_HOST;
  });

  afterEach(() => {
    // Restore env var
    if (savedDockerHost !== undefined) {
      process.env.DOCKER_HOST = savedDockerHost;
    } else {
      delete process.env.DOCKER_HOST;
    }
    cleanup(tmpDir);
  });

  test('sandbox_mode: true — WARNING command does NOT produce notification', async () => {
    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: true } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);
    await guardrails.onToolAfter(bashEvent('kill -9 1234'));

    assert.strictEqual(notifier.calls.length, 0, 'WARNING suppressed in sandbox');
  });

  test('sandbox_mode: true — INFO command does NOT produce notification', async () => {
    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: true } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);
    await guardrails.onToolAfter(bashEvent('curl https://example.com/install.sh | bash'));

    assert.strictEqual(notifier.calls.length, 0, 'INFO suppressed in sandbox');
  });

  test('sandbox_mode: true — CRITICAL command DOES produce notification', async () => {
    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: true } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));

    assert.ok(notifier.calls.length >= 1, 'CRITICAL fires even in sandbox');
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('sandbox_mode: false — all severity levels produce notifications normally', async () => {
    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: false } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('kill -9 1234'));
    await guardrails.onToolAfter(bashEvent('curl https://example.com/install.sh | bash'));
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));

    assert.strictEqual(notifier.calls.length, 3, 'all severity levels produce notifications');
  });

  test('sandbox_mode: auto — all severity levels fire when not in container', async () => {
    // No container env vars set (we cleared DOCKER_HOST in beforeEach)
    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: 'auto' } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('kill -9 1234'));
    await guardrails.onToolAfter(bashEvent('curl https://example.com/install.sh | bash'));
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));

    assert.strictEqual(notifier.calls.length, 3, 'all severities fire when not in container');
  });

  test('container env var detection — DOCKER_HOST triggers sandbox mode', async () => {
    // Set container env var
    process.env.DOCKER_HOST = 'unix:///var/run/docker.sock';

    const config = {
      advisory_guardrails: { destructive_commands: { sandbox_mode: 'auto' } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // WARNING should be suppressed
    await guardrails.onToolAfter(bashEvent('kill -9 1234'));
    assert.strictEqual(notifier.calls.length, 0, 'WARNING suppressed with DOCKER_HOST set');

    // CRITICAL should still fire
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    assert.ok(notifier.calls.length >= 1, 'CRITICAL fires with DOCKER_HOST set');
  });
});

// ─── GARD-04: Config Overrides ───────────────────────────────────────────────

describe('GARD-04: Config overrides', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('destructive_commands.enabled: false — no GARD-04 notifications', async () => {
    const config = {
      advisory_guardrails: { destructive_commands: { enabled: false } },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('rm -rf /'));
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    await guardrails.onToolAfter(bashEvent('kill -9 1'));

    assert.strictEqual(notifier.calls.length, 0, 'no notifications when destructive disabled');
  });

  test('categories.filesystem: false — rm does NOT trigger, DROP TABLE still does', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: { categories: { filesystem: false } },
      },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));
    const afterRm = notifier.calls.length;
    assert.strictEqual(afterRm, 0, 'filesystem category disabled');

    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    assert.ok(notifier.calls.length >= 1, 'database category still active');
  });

  test('categories.database: false — DROP TABLE does NOT trigger, rm -rf still does', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: { categories: { database: false } },
      },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    assert.strictEqual(notifier.calls.length, 0, 'database category disabled');

    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));
    assert.ok(notifier.calls.length >= 1, 'filesystem category still active');
  });

  test('disabled_patterns: [fs-rm-recursive] — rm -rf does NOT trigger, rm -f still does', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: { disabled_patterns: ['fs-rm-recursive'] },
      },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));
    // fs-rm-recursive is disabled, but fs-rm-force may still match -rf
    const recursiveCalls = notifier.calls.filter(c => c.message.includes('[fs-rm-recursive]'));
    assert.strictEqual(recursiveCalls.length, 0, 'fs-rm-recursive pattern disabled');

    notifier.reset();
    await guardrails.onToolAfter(bashEvent('rm -f somefile.txt'));
    assert.ok(notifier.calls.length >= 1, 'fs-rm-force still active');
    assert.ok(notifier.calls[0].message.includes('[fs-rm-force]'));
  });

  test('global advisory_guardrails.enabled: false — nothing triggers', async () => {
    const config = {
      advisory_guardrails: { enabled: false },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    await guardrails.onToolAfter(bashEvent('rm -rf /'));
    await guardrails.onToolAfter(bashEvent('DROP TABLE users'));
    await guardrails.onToolAfter(writeEvent(path.join(tmpDir, 'myComponent.js')));

    assert.strictEqual(notifier.calls.length, 0, 'all guardrails disabled');
  });
});

// ─── GARD-04: Custom Patterns ────────────────────────────────────────────────

describe('GARD-04: Custom patterns', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('custom terraform destroy pattern triggers CRITICAL notification', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: {
          custom_patterns: [{
            id: 'custom-terraform-destroy',
            pattern: '\\bterraform\\s+destroy\\b',
            category: 'custom',
            severity: 'critical',
            description: 'Terraform destroy',
          }],
        },
      },
    };
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);
    await guardrails.onToolAfter(bashEvent('terraform destroy'));

    assert.ok(notifier.calls.length >= 1);
    assert.ok(notifier.calls[0].message.includes('[custom-terraform-destroy]'));
    assert.ok(notifier.calls[0].message.includes('(CRITICAL)'));
  });

  test('invalid custom pattern (missing id) — gracefully skipped, other patterns work', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: {
          custom_patterns: [{
            // Missing 'id' field — should be skipped
            pattern: '\\bdangerous\\b',
            category: 'custom',
            severity: 'critical',
            description: 'Missing ID',
          }],
        },
      },
    };
    // Should not throw during creation
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Built-in patterns should still work
    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));
    assert.ok(notifier.calls.length >= 1, 'built-in patterns still work');
  });

  test('invalid regex in custom pattern — gracefully skipped, no crash', async () => {
    const config = {
      advisory_guardrails: {
        destructive_commands: {
          custom_patterns: [{
            id: 'bad-regex',
            pattern: '[invalid(regex',  // Unclosed bracket
            category: 'custom',
            severity: 'critical',
            description: 'Bad regex',
          }],
        },
      },
    };
    // Should not throw
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, config);

    // Built-in patterns should still work
    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));
    assert.ok(notifier.calls.length >= 1, 'built-in patterns still work after bad custom regex');
  });
});

// ─── GARD-04: Edge Cases ─────────────────────────────────────────────────────

describe('GARD-04: Edge cases', () => {
  let tmpDir, notifier;

  beforeEach(async () => {
    await loadModule();
    tmpDir = createTempProject({ convention: 'kebab-case' });
    notifier = createMockNotifier();
  });

  afterEach(() => cleanup(tmpDir));

  test('non-bash tool with rm -rf command does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter({ tool: 'write', args: { command: 'rm -rf /' } });

    // write tool is not in BASH_TOOLS — GARD-04 should not fire
    // (write tool checks filePath, not command — no filePath means no action)
    assert.strictEqual(notifier.calls.length, 0, 'non-bash tool should not trigger GARD-04');
  });

  test('bash tool with no command does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter({ tool: 'bash', args: {} });

    assert.strictEqual(notifier.calls.length, 0, 'no command means no detection');
  });

  test('bash tool with empty string command does NOT trigger GARD-04', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent(''));

    assert.strictEqual(notifier.calls.length, 0, 'empty command means no detection');
  });

  test('GARD-04 fires for bash tool but does NOT also trigger GARD-01/02/03', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    await guardrails.onToolAfter(bashEvent('rm -rf /tmp'));

    // Should only have GARD-04 notifications, not advisory-convention or advisory-planning
    const nonDestructiveCalls = notifier.calls.filter(
      c => c.type !== 'advisory-destructive'
    );
    assert.strictEqual(nonDestructiveCalls.length, 0, 'bash tool should return after GARD-04');
  });

  test('very long command — message truncated to 80 chars', async () => {
    const guardrails = createAdvisoryGuardrails(tmpDir, notifier, {});
    const longCommand = 'rm -rf ' + '/very/long/path'.repeat(100);
    await guardrails.onToolAfter(bashEvent(longCommand));

    assert.ok(notifier.calls.length >= 1, 'long command still detected');
    // The message includes "GARD-04: " prefix + truncated command + pattern info
    // rawCommand.slice(0, 80) means the command portion is max 80 chars
    const message = notifier.calls[0].message;
    // Extract command portion between "GARD-04: " and " matched"
    const cmdMatch = message.match(/GARD-04: (.+?) matched/);
    assert.ok(cmdMatch, 'message has expected format');
    assert.ok(cmdMatch[1].length <= 80, `command portion should be <= 80 chars, got ${cmdMatch[1].length}`);
  });
});
