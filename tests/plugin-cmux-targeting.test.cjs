const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tempPaths = [];

async function loadCmuxModules() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cmux-modules-'));
  const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin', 'cmux-cli.js'), 'utf-8');
  const targetingSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin', 'cmux-targeting.js'), 'utf-8')
    .replace("'./cmux-cli.js'", "'./cmux-cli.mjs'");
  const cliFile = path.join(fixtureDir, 'cmux-cli.mjs');
  const targetingFile = path.join(fixtureDir, 'cmux-targeting.mjs');

  fs.writeFileSync(cliFile, cliSource);
  fs.writeFileSync(targetingFile, targetingSource);
  tempPaths.push(fixtureDir);

  const cliPath = pathToFileURL(cliFile).href;
  const targetingPath = pathToFileURL(targetingFile).href;
  const cli = await import(cliPath);
  const targeting = await import(targetingPath);
  return { ...cli, ...targeting };
}

function createFakeCmux(source) {
  const scriptPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-cmux-')), 'fake-cmux');
  fs.writeFileSync(scriptPath, `#!/usr/bin/env node\n${source}\n`, { mode: 0o755 });
  tempPaths.push(path.dirname(scriptPath));
  return scriptPath;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    fs.rmSync(tempPaths.pop(), { recursive: true, force: true });
  }
});

function createCmuxStub(overrides = {}) {
  const calls = [];
  const cmux = {
    ping: async () => {
      calls.push('ping');
      return { ok: true, stdout: 'pong' };
    },
    capabilities: async () => {
      calls.push('capabilities');
      return {
        ok: true,
        json: {
          result: {
            access_mode: 'cmux processes only',
            methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
          },
        },
      };
    },
    identify: async () => {
      calls.push('identify');
      return {
        ok: true,
        json: {
          result: {
            workspace: { id: 'workspace:1' },
            surface: { id: 'surface:1' },
          },
        },
      };
    },
    listWorkspaces: async () => {
      calls.push('listWorkspaces');
      return {
        ok: true,
        json: {
          result: {
            workspaces: [
              { id: 'workspace:1' },
            ],
          },
        },
      };
    },
    sidebarState: async ({ workspace }) => {
      calls.push(`sidebarState:${workspace}`);
      return {
        ok: true,
        json: {
          result: {
            cwd: '/repo',
          },
        },
      };
    },
  };

  return {
    calls,
    cmux: { ...cmux, ...overrides },
  };
}

describe('plugin cmux transport', () => {
  test('runCmuxCommand returns a structured missing-cli result', async () => {
    const { runCmuxCommand } = await loadCmuxModules();
    const result = await runCmuxCommand('ping', [], {
      command: path.join(os.tmpdir(), `missing-cmux-${Date.now()}`),
      timeoutMs: 50,
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.type, 'missing-cli');
    assert.strictEqual(result.timedOut, false);
    assert.strictEqual(result.commandName, 'ping');
  });

  test('JSON helpers add --json and target flags', async () => {
    const { listWorkspaces, sidebarState } = await loadCmuxModules();
    const fakeCmux = createFakeCmux(`
      process.stdout.write(JSON.stringify({ argv: process.argv.slice(2) }));
    `);

    const workspaces = await listWorkspaces({ command: fakeCmux, timeoutMs: 500 });
    assert.strictEqual(workspaces.ok, true);
    assert.deepStrictEqual(workspaces.json.argv, ['list-workspaces', '--json']);

    const sidebar = await sidebarState({ command: fakeCmux, workspace: 'workspace:2', timeoutMs: 500 });
    assert.strictEqual(sidebar.ok, true);
    assert.deepStrictEqual(sidebar.json.argv, ['sidebar-state', '--json', '--workspace', 'workspace:2']);
  });

  test('runCmuxJson reports invalid JSON without throwing', async () => {
    const { runCmuxJson } = await loadCmuxModules();
    const fakeCmux = createFakeCmux(`
      process.stdout.write('not-json');
    `);

    const result = await runCmuxJson('capabilities', [], { command: fakeCmux, timeoutMs: 500 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.type, 'invalid-json');
    assert.match(result.error.message, /JSON/i);
  });
});

describe('plugin cmux targeting', () => {
  test('resolveCmuxAvailability proves a managed target when env and identify agree', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux, calls } = createCmuxStub();
    const verdict = await resolveCmuxAvailability({
      env: {
        CMUX_WORKSPACE_ID: 'workspace:1',
        CMUX_SURFACE_ID: 'surface:1',
      },
      cmux,
    });

    assert.strictEqual(verdict.available, true);
    assert.strictEqual(verdict.attached, false);
    assert.strictEqual(verdict.mode, 'managed');
    assert.strictEqual(verdict.workspaceId, 'workspace:1');
    assert.strictEqual(verdict.surfaceId, 'surface:1');
    assert.strictEqual(verdict.suppressionReason, null);
    assert.deepStrictEqual(calls, ['ping', 'capabilities', 'identify']);
  });

  test('resolveCmuxAvailability suppresses managed workspace mismatch', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux, calls } = createCmuxStub({
      identify: async () => {
        calls.push('identify');
        return {
          ok: true,
          json: {
            result: {
              workspace: { id: 'workspace:2' },
              surface: { id: 'surface:1' },
            },
          },
        };
      },
    });
    const verdict = await resolveCmuxAvailability({
      env: {
        CMUX_WORKSPACE_ID: 'workspace:1',
        CMUX_SURFACE_ID: 'surface:1',
      },
      cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'managed');
    assert.strictEqual(verdict.workspaceId, null);
    assert.strictEqual(verdict.suppressionReason, 'workspace-mismatch');
    assert.deepStrictEqual(calls, ['ping', 'capabilities', 'identify']);
  });

  test('resolveCmuxAvailability suppresses managed surface mismatch', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux, calls } = createCmuxStub({
      identify: async () => {
        calls.push('identify');
        return {
          ok: true,
          json: {
            result: {
              workspace: { id: 'workspace:1' },
              surface: { id: 'surface:2' },
            },
          },
        };
      },
    });
    const verdict = await resolveCmuxAvailability({
      env: {
        CMUX_WORKSPACE_ID: 'workspace:1',
        CMUX_SURFACE_ID: 'surface:1',
      },
      cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'managed');
    assert.strictEqual(verdict.workspaceId, null);
    assert.strictEqual(verdict.suppressionReason, 'surface-mismatch');
    assert.deepStrictEqual(calls, ['ping', 'capabilities', 'identify']);
  });

  test('resolveCmuxAvailability proves one alongside target from exact cwd matching', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux, calls } = createCmuxStub({
      capabilities: async () => {
        calls.push('capabilities');
        return {
          ok: true,
          json: {
            result: {
              access_mode: 'allowAll',
              methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
            },
          },
        };
      },
      listWorkspaces: async () => {
        calls.push('listWorkspaces');
        return {
          ok: true,
          json: {
            result: {
              workspaces: [
                { id: 'workspace:1' },
                { id: 'workspace:2' },
              ],
            },
          },
        };
      },
      sidebarState: async ({ workspace }) => {
        calls.push(`sidebarState:${workspace}`);
        return {
          ok: true,
          json: {
            result: {
              cwd: workspace === 'workspace:2' ? '/repo' : '/other',
            },
          },
        };
      },
    });
    const verdict = await resolveCmuxAvailability({
      env: {},
      projectDir: '/repo',
      cmux,
    });

    assert.strictEqual(verdict.available, true);
    assert.strictEqual(verdict.mode, 'alongside');
    assert.strictEqual(verdict.workspaceId, 'workspace:2');
    assert.strictEqual(verdict.surfaceId, null);
    assert.strictEqual(verdict.suppressionReason, null);
    assert.deepStrictEqual(calls, ['ping', 'capabilities', 'listWorkspaces', 'sidebarState:workspace:1', 'sidebarState:workspace:2']);
  });

  test('resolveCmuxAvailability suppresses alongside access-mode-blocked callers', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const verdict = await resolveCmuxAvailability({
      env: {},
      cmux: createCmuxStub().cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'alongside');
    assert.strictEqual(verdict.suppressionReason, 'access-mode-blocked');
  });

  test('resolveCmuxAvailability suppresses alongside sessions with zero cwd matches', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux } = createCmuxStub({
      capabilities: async () => ({
        ok: true,
        json: {
          result: {
            access_mode: 'allowAll',
            methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
          },
        },
      }),
      listWorkspaces: async () => ({
        ok: true,
        json: {
          result: {
            workspaces: [
              { id: 'workspace:1' },
              { id: 'workspace:2' },
            ],
          },
        },
      }),
      sidebarState: async () => ({
        ok: true,
        json: {
          result: {
            cwd: '/elsewhere',
          },
        },
      }),
    });
    const verdict = await resolveCmuxAvailability({
      env: {},
      projectDir: '/repo',
      cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'alongside');
    assert.strictEqual(verdict.suppressionReason, 'ambiguous-cwd');
  });

  test('resolveCmuxAvailability suppresses alongside sessions with multiple cwd matches', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux } = createCmuxStub({
      capabilities: async () => ({
        ok: true,
        json: {
          result: {
            access_mode: 'allowAll',
            methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
          },
        },
      }),
      listWorkspaces: async () => ({
        ok: true,
        json: {
          result: {
            workspaces: [
              { id: 'workspace:1' },
              { id: 'workspace:2' },
            ],
          },
        },
      }),
      sidebarState: async () => ({
        ok: true,
        json: {
          result: {
            cwd: '/repo',
          },
        },
      }),
    });
    const verdict = await resolveCmuxAvailability({
      env: {},
      projectDir: '/repo',
      cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'alongside');
    assert.strictEqual(verdict.suppressionReason, 'ambiguous-cwd');
  });

  test('resolveCmuxAvailability does not fall back to cwd heuristics after managed proof conflicts', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const { cmux, calls } = createCmuxStub({
      capabilities: async () => {
        calls.push('capabilities');
        return {
          ok: true,
          json: {
            result: {
              access_mode: 'allowAll',
              methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
            },
          },
        };
      },
      identify: async () => {
        calls.push('identify');
        return {
          ok: true,
          json: {
            result: {
              workspace: { id: 'workspace:2' },
              surface: { id: 'surface:1' },
            },
          },
        };
      },
      listWorkspaces: async () => {
        calls.push('listWorkspaces');
        return {
          ok: true,
          json: {
            result: {
              workspaces: [{ id: 'workspace:1' }],
            },
          },
        };
      },
    });
    const verdict = await resolveCmuxAvailability({
      env: {
        CMUX_WORKSPACE_ID: 'workspace:1',
        CMUX_SURFACE_ID: 'surface:1',
      },
      projectDir: '/repo',
      cmux,
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'managed');
    assert.strictEqual(verdict.suppressionReason, 'workspace-mismatch');
    assert.deepStrictEqual(calls, ['ping', 'capabilities', 'identify']);
  });

  test('createNoopCmuxAdapter preserves the verdict and no-ops writes', async () => {
    const { createNoopCmuxAdapter, suppressionReason } = await loadCmuxModules();
    const adapter = createNoopCmuxAdapter({
      available: false,
      attached: false,
      mode: 'none',
      suppressionReason: 'cmux-missing',
      workspaceId: null,
      surfaceId: null,
      writeProven: false,
    });

    assert.strictEqual(adapter.mode, 'none');
    assert.strictEqual(suppressionReason(adapter), 'cmux-missing');

    const result = await adapter.setStatus('build', 'running');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.suppressed, true);
    assert.strictEqual(result.reason, 'cmux-missing');
  });
});
