'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const modulePath = path.join(__dirname, '..', 'src', 'plugin', 'cmux-lifecycle-signal.js');

async function loadLifecycleModule() {
  try {
    const source = fs.readFileSync(modulePath, 'utf-8');
    return await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
  } catch (error) {
    if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ENOENT')) {
      return {};
    }
    throw error;
  }
}

function makeProjectState(overrides = {}) {
  const state = {
    phase: '186 — cmux Truthful Lifecycle Signals',
    currentPlan: '01',
    status: 'In progress',
    lastActivity: '2026-04-02T05:00:00Z',
    progress: null,
    raw: '',
    blocking_reason: null,
    recovery_summary: null,
    getSection(name) {
      return name === 'Session Continuity' ? null : null;
    },
    ...overrides.state,
  };

  const currentPhase = {
    number: '186',
    name: 'cmux Truthful Lifecycle Signals',
    status: 'incomplete',
    ...overrides.currentPhase,
  };

  return {
    state,
    currentPhase,
    notificationHistory: overrides.notificationHistory || [],
  };
}

describe('workspace lifecycle signal contract', () => {
  test('finalize-failed outranks waiting when both signals exist', async () => {
    const { deriveWorkspaceLifecycleSignal } = await loadLifecycleModule();
    const signal = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: {
        status: 'Checkpoint waiting for review',
        progress: 72,
        blocking_reason: 'finalize_failed',
        recovery_summary: {
          blocking_reason: 'finalize_failed',
          next_command: 'node bin/bgsd-tools.cjs workspace reconcile 186-01',
        },
      },
    }));

    assert.strictEqual(signal.state, 'finalize-failed');
    assert.strictEqual(signal.label, 'Finalize failed');
    assert.match(signal.hint, /finalize/i);
    assert.deepStrictEqual(signal.progress, { mode: 'hidden' });
  });

  test('waiting outranks stale and stale outranks blocked', async () => {
    const { deriveWorkspaceLifecycleSignal } = await loadLifecycleModule();

    const waiting = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: {
        status: 'Awaiting review reply',
        blocking_reason: 'stale',
        recovery_summary: { blocking_reason: 'stale' },
      },
    }));
    assert.strictEqual(waiting.state, 'waiting');

    const stale = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: {
        status: 'Blocked on stale sibling state',
        progress: 55,
        blocking_reason: 'stale',
        recovery_summary: { blocking_reason: 'stale' },
      },
      notificationHistory: [{ severity: 'critical', message: 'workspace cannot continue yet' }],
    }));
    assert.strictEqual(stale.state, 'stale');
    assert.deepStrictEqual(stale.progress, { mode: 'hidden' });
  });

  test('quiet states stay plain-English and non-alarming', async () => {
    const { deriveWorkspaceLifecycleSignal } = await loadLifecycleModule();

    const reconciling = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: { status: 'Reconciling sibling workspaces' },
    }));
    assert.strictEqual(reconciling.label, 'Reconciling');
    assert.strictEqual(reconciling.severity, 'quiet');

    const running = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: { status: 'Verification running', progress: 42 },
    }));
    assert.strictEqual(running.label, 'Running');
    assert.strictEqual(running.progress.mode, 'exact');

    const complete = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: { status: 'Plan complete' },
      currentPhase: { status: 'complete' },
    }));
    assert.strictEqual(complete.label, 'Complete');

    const idle = deriveWorkspaceLifecycleSignal(makeProjectState({
      state: { status: 'Idle', lastActivity: '2026-01-01T00:00:00Z' },
    }));
    assert.strictEqual(idle.label, 'Idle');
  });
});
