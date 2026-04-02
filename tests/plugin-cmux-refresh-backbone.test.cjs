'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const backboneModulePath = path.join(__dirname, '..', 'src', 'plugin', 'cmux-refresh-backbone.js');

async function loadBackboneModule() {
  try {
    const source = fs.readFileSync(backboneModulePath, 'utf-8');
    return await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
  } catch (error) {
    if (error && (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ENOENT')) {
      return {};
    }
    throw error;
  }
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness(overrides = {}) {
  const calls = {
    invalidateAll: [],
    getCurrentCmuxAdapter: [],
    getProjectState: [],
    syncCmuxSidebar: [],
    syncCmuxAttention: [],
  };

  let stateVersion = 0;
  const adapter = overrides.adapter || { workspaceId: 'workspace:1' };

  const deps = {
    projectDir: '/repo',
    debounceMs: overrides.debounceMs ?? 25,
    invalidateAll(projectDir) {
      calls.invalidateAll.push(projectDir);
    },
    async getCurrentCmuxAdapter(options = {}) {
      calls.getCurrentCmuxAdapter.push(options);
      return adapter;
    },
    async getProjectState(projectDir) {
      calls.getProjectState.push(projectDir);
      if (typeof overrides.getProjectState === 'function') {
        return overrides.getProjectState(projectDir, calls.getProjectState.length);
      }
      stateVersion += 1;
      return { stateVersion, projectDir };
    },
    getNotificationHistory() {
      return [{ severity: 'info', message: 'history' }];
    },
    async syncCmuxSidebar(currentAdapter, payload) {
      calls.syncCmuxSidebar.push({ currentAdapter, payload });
      return { currentAdapter, payload };
    },
    async syncCmuxAttention(currentAdapter, payload, options) {
      calls.syncCmuxAttention.push({ currentAdapter, payload, options });
      return { currentAdapter, payload, options };
    },
    ...overrides,
  };

  return { calls, deps, adapter };
}

describe('createCmuxRefreshBackbone', () => {
  test('coalesces bursty enqueue calls into one debounced shared snapshot cycle', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { createCmuxRefreshBackbone } = await loadBackboneModule();
    assert.strictEqual(typeof createCmuxRefreshBackbone, 'function');

    const { calls, deps, adapter } = createHarness();
    const backbone = createCmuxRefreshBackbone(deps);

    backbone.enqueue({ hook: 'startup' });
    backbone.enqueue({ hook: 'command.executed', event: { name: 'run' } });
    backbone.enqueue({ hook: 'file.watcher.external', filePath: '/repo/.planning/ROADMAP.md' });

    assert.strictEqual(calls.invalidateAll.length, 0);
    context.mock.timers.tick(25);
    await flushMicrotasks();

    assert.deepStrictEqual(calls.invalidateAll, ['/repo']);
    assert.deepStrictEqual(calls.getProjectState, ['/repo']);
    assert.strictEqual(calls.getCurrentCmuxAdapter.length, 1);
    assert.strictEqual(calls.syncCmuxSidebar.length, 1);
    assert.strictEqual(calls.syncCmuxAttention.length, 1);

    const sidebarCall = calls.syncCmuxSidebar[0];
    const attentionCall = calls.syncCmuxAttention[0];
    assert.strictEqual(sidebarCall.currentAdapter, adapter);
    assert.strictEqual(attentionCall.currentAdapter, adapter);
    assert.strictEqual(sidebarCall.payload, attentionCall.payload, 'shared snapshot payload should fan out to both sinks');
    assert.deepStrictEqual(sidebarCall.payload.notificationHistory, [{ severity: 'info', message: 'history' }]);
    assert.strictEqual(attentionCall.options.trigger.hook, 'file.watcher.external');
    assert.deepStrictEqual(attentionCall.options.trigger.hooks, ['startup', 'command.executed', 'file.watcher.external']);
    assert.strictEqual(attentionCall.options.trigger.planningChange, true);
  });

  test('refreshNow runs immediately and schedules exactly one rerun while work is in flight', async () => {
    const { createCmuxRefreshBackbone } = await loadBackboneModule();
    assert.strictEqual(typeof createCmuxRefreshBackbone, 'function');

    let releaseSidebar;
    const firstSidebarGate = new Promise((resolve) => {
      releaseSidebar = resolve;
    });

    const { calls, deps } = createHarness({
      debounceMs: 50,
      async syncCmuxSidebar(currentAdapter, payload) {
        calls.syncCmuxSidebar.push({ currentAdapter, payload });
        if (calls.syncCmuxSidebar.length === 1) {
          await firstSidebarGate;
        }
        return { currentAdapter, payload };
      },
    });

    const backbone = createCmuxRefreshBackbone(deps);
    const firstRun = backbone.refreshNow({ hook: 'startup' });
    await flushMicrotasks();

    backbone.enqueue({ hook: 'tool.execute.after', input: { tool: 'task', task: 'Initial task' } });
    backbone.enqueue({ hook: 'file.watcher.external', filePath: '/repo/.planning/STATE.md' });

    assert.strictEqual(calls.invalidateAll.length, 1, 'first cycle should start immediately');
    assert.strictEqual(calls.syncCmuxSidebar.length, 1, 'first cycle should reach the shared sidebar sink once before the rerun');
    assert.strictEqual(calls.syncCmuxAttention.length, 0, 'attention should wait until the gated first cycle is released');

    releaseSidebar();
    await firstRun;
    await flushMicrotasks();
    await flushMicrotasks();

    assert.strictEqual(calls.invalidateAll.length, 2, 'overlapping triggers should request one bounded rerun');
    assert.strictEqual(calls.getProjectState.length, 2);
    assert.strictEqual(calls.syncCmuxSidebar.length, 2);
    assert.strictEqual(calls.syncCmuxAttention.length, 2);

    const rerunTrigger = calls.syncCmuxAttention[1].options.trigger;
    assert.strictEqual(rerunTrigger.hook, 'file.watcher.external');
    assert.deepStrictEqual(rerunTrigger.hooks, ['tool.execute.after', 'file.watcher.external']);
    assert.strictEqual(rerunTrigger.planningChange, true);
    assert.deepStrictEqual(rerunTrigger.input, { tool: 'task', task: 'Initial task' });
  });
});
