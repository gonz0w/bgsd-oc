const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tempPaths = [];

async function loadAttentionPolicyModule() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cmux-attention-'));
  const policyPath = path.join(__dirname, '..', 'src', 'plugin', 'cmux-attention-policy.js');
  assert.ok(fs.existsSync(policyPath), 'src/plugin/cmux-attention-policy.js should exist');
  const policySource = fs.readFileSync(policyPath, 'utf-8');
  const policyFile = path.join(fixtureDir, 'cmux-attention-policy.mjs');
  fs.writeFileSync(policyFile, policySource);
  tempPaths.push(fixtureDir);
  return import(pathToFileURL(policyFile).href);
}

function buildEvent(overrides = {}) {
  return {
    workspaceId: 'workspace:1',
    phase: '172',
    plan: '01',
    task: '02',
    kind: 'warning',
    identity: 'semantic dedupe',
    message: 'warning needs attention',
    now: 1_000,
    ...overrides,
  };
}

test.afterEach(() => {
  while (tempPaths.length > 0) {
    fs.rmSync(tempPaths.pop(), { recursive: true, force: true });
  }
});

describe('plugin cmux attention policy', () => {
  test('planner-start, executor-start, and task-complete stay log-only', async () => {
    const { classifyAttentionEvent } = await loadAttentionPolicyModule();

    for (const kind of ['planner-start', 'executor-start', 'task-complete']) {
      const event = classifyAttentionEvent(buildEvent({ kind, identity: kind, message: `${kind} log-only` }));
      assert.strictEqual(event.kind, kind);
      assert.ok(event.log, `${kind} should log`);
      assert.strictEqual(event.notify, null);
    }
  });

  test('checkpoint, waiting-input, blocker, warning, plan-complete, phase-complete, and workflow-complete notify on first occurrence', async () => {
    const { classifyAttentionEvent } = await loadAttentionPolicyModule();

    for (const kind of ['checkpoint', 'waiting-input', 'blocker', 'warning', 'plan-complete', 'phase-complete', 'workflow-complete']) {
      const event = classifyAttentionEvent(buildEvent({ kind, identity: kind, message: `${kind} notify` }));
      assert.ok(event.log, `${kind} should log`);
      assert.ok(event.notify, `${kind} should notify`);
    }
  });

  test('buildAttentionEventKey reuses one semantic dedupe key for unchanged warnings and blockers', async () => {
    const { buildAttentionEventKey } = await loadAttentionPolicyModule();
    const warningKey = buildAttentionEventKey(buildEvent({ kind: 'warning', identity: 'semantic dedupe' }));
    const warningRefreshKey = buildAttentionEventKey(buildEvent({ kind: 'warning', identity: 'semantic dedupe', message: 'semantic dedupe refresh' }));
    const blockerKey = buildAttentionEventKey(buildEvent({ kind: 'blocker', identity: 'semantic dedupe' }));

    assert.strictEqual(warningKey, warningRefreshKey);
    assert.notStrictEqual(warningKey, blockerKey);
    assert.match(warningKey, /workspace:1/);
    assert.match(warningKey, /semantic dedupe/);
  });

  test('shouldEmitAttentionEvent cools down repeated unchanged warning events until cooldown expiry or identity change', async () => {
    const { shouldEmitAttentionEvent } = await loadAttentionPolicyModule();
    const first = buildEvent({ kind: 'warning', identity: 'cooldown', now: 1_000 });
    const repeat = buildEvent({ kind: 'warning', identity: 'cooldown', now: 2_000 });
    const expired = buildEvent({ kind: 'warning', identity: 'cooldown', now: 400_000 });
    const changed = buildEvent({ kind: 'warning', identity: 'cooldown:new', now: 2_000 });

    const firstDecision = shouldEmitAttentionEvent(first);
    const repeatDecision = shouldEmitAttentionEvent(repeat, { lastEvent: firstDecision.event });
    const expiredDecision = shouldEmitAttentionEvent(expired, { lastEvent: firstDecision.event });
    const changedDecision = shouldEmitAttentionEvent(changed, { lastEvent: firstDecision.event });

    assert.strictEqual(firstDecision.emit, true);
    assert.strictEqual(repeatDecision.emit, false);
    assert.strictEqual(expiredDecision.emit, true);
    assert.strictEqual(changedDecision.emit, true);
    assert.match(repeatDecision.reason, /cooldown/i);
  });
});
