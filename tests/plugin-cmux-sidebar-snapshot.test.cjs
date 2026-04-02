'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const snapshotModulePath = path.join(__dirname, '..', 'src', 'plugin', 'cmux-sidebar-snapshot.js');
const lifecycleModulePath = path.join(__dirname, '..', 'src', 'plugin', 'cmux-lifecycle-signal.js');

async function loadSnapshotModule() {
  try {
    const lifecycleSource = fs.readFileSync(lifecycleModulePath, 'utf-8');
    const lifecycleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(lifecycleSource).replace(/'/g, '%27')}`;
    const snapshotSource = fs.readFileSync(snapshotModulePath, 'utf-8')
      .replace(
        /import \{[\s\S]*?\} from '\.\/cmux-lifecycle-signal\.js';/,
        `import { deriveContextLabel as deriveLifecycleContextLabel, deriveWorkspaceLifecycleSignal } from '${lifecycleUrl}';`,
      );
    return await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(snapshotSource)}`);
  } catch (error) {
    if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ENOENT')) {
      return {};
    }
    throw error;
  }
}

function makeProjectState(overrides = {}) {
  const state = {
    phase: '171 — Ambient Workspace Status & Progress',
    currentPlan: '01',
    status: 'In progress',
    lastActivity: '2026-04-02T05:00:00Z',
    progress: null,
    raw: '',
    getSection(name) {
      return name === 'Session Continuity' ? null : null;
    },
    ...overrides.state,
  };

  const currentPhase = {
    number: '171',
    name: 'Ambient Workspace Status & Progress',
    status: 'incomplete',
    ...overrides.currentPhase,
  };

  return {
    state,
    currentPhase,
    roadmap: overrides.roadmap || null,
    notificationHistory: overrides.notificationHistory || [],
  };
}

describe('cmux sidebar snapshot contract', () => {
  test('waiting state projects one truthful compact hint and clears misleading progress', async () => {
    const { deriveCmuxSidebarSnapshot } = await loadSnapshotModule();
    const snapshot = deriveCmuxSidebarSnapshot(makeProjectState({
      state: {
        status: 'Checkpoint waiting for review',
        progress: 61,
      },
    }));

    assert.strictEqual(snapshot.status.label, 'Waiting');
    assert.strictEqual(snapshot.context.label, 'Phase 171 P01');
    assert.match(snapshot.activity.label, /waiting|review/i);
    assert.strictEqual(snapshot.progress.mode, 'hidden');
  });

  test('roadmap intervention states replace warning overlays with truthful lifecycle states', async () => {
    const { derivePrimaryState } = await loadSnapshotModule();

    const stale = derivePrimaryState(makeProjectState({
      state: {
        status: 'In progress',
        blocking_reason: 'stale',
        recovery_summary: { blocking_reason: 'stale' },
      },
    }));
    assert.strictEqual(stale.label, 'Stale');

    const blocked = derivePrimaryState(makeProjectState({
      notificationHistory: [{ severity: 'critical', message: 'workspace cannot continue' }],
    }));
    assert.strictEqual(blocked.label, 'Blocked');
  });

  test('workflow context outranks structural labels when directly trustworthy', async () => {
    const { deriveContextLabel } = await loadSnapshotModule();
    const snapshot = deriveContextLabel(makeProjectState({
      state: {
        status: 'Verification running',
        currentPlan: '03',
      },
    }));

    assert.deepStrictEqual(snapshot, {
      label: 'Verifying',
      source: 'workflow',
      trustworthy: true,
    });
  });

  test('structural fallback is allowed when workflow meaning is absent', async () => {
    const { deriveContextLabel } = await loadSnapshotModule();
    const snapshot = deriveContextLabel(makeProjectState({
      state: {
        status: 'Idle',
        currentPlan: '02',
      },
    }));

    assert.deepStrictEqual(snapshot, {
      label: 'Phase 171 P02',
      source: 'structure',
      trustworthy: true,
    });
  });

  test('progress distinguishes exact numeric values from activity-only work', async () => {
    const { deriveProgressSignal } = await loadSnapshotModule();

    const exact = deriveProgressSignal(makeProjectState({
      state: {
        progress: 42,
      },
    }));
    assert.strictEqual(exact.mode, 'exact');
    assert.strictEqual(exact.value, 0.42);

    const activity = deriveProgressSignal(makeProjectState({
      state: {
        status: 'Verification running',
        progress: null,
      },
    }));
    assert.deepStrictEqual(activity, {
      mode: 'activity',
      label: 'Verification running',
    });
  });

  test('weak or stale progress hides instead of guessing', async () => {
    const { deriveProgressSignal } = await loadSnapshotModule();
    const hidden = deriveProgressSignal(makeProjectState({
      state: {
        status: 'Idle',
        lastActivity: '2026-01-01T00:00:00Z',
        progress: null,
      },
    }));

    assert.deepStrictEqual(hidden, { mode: 'hidden' });
  });
});
