const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tempPaths = [];

async function loadCmuxModules() {
  const cliPath = pathToFileURL(path.join(__dirname, '..', 'src', 'plugin', 'cmux-cli.js')).href;
  const targetingPath = pathToFileURL(path.join(__dirname, '..', 'src', 'plugin', 'cmux-targeting.js')).href;
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

    const workspaces = await listWorkspaces({ command: fakeCmux, timeoutMs: 50 });
    assert.strictEqual(workspaces.ok, true);
    assert.deepStrictEqual(workspaces.json.argv, ['list-workspaces', '--json']);

    const sidebar = await sidebarState({ command: fakeCmux, workspace: 'workspace:2', timeoutMs: 50 });
    assert.strictEqual(sidebar.ok, true);
    assert.deepStrictEqual(sidebar.json.argv, ['sidebar-state', '--json', '--workspace', 'workspace:2']);
  });

  test('runCmuxJson reports invalid JSON without throwing', async () => {
    const { runCmuxJson } = await loadCmuxModules();
    const fakeCmux = createFakeCmux(`
      process.stdout.write('not-json');
    `);

    const result = await runCmuxJson('capabilities', [], { command: fakeCmux, timeoutMs: 50 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.type, 'invalid-json');
    assert.match(result.error.message, /JSON/i);
  });
});

describe('plugin cmux targeting', () => {
  test('resolveCmuxAvailability treats managed cmux sessions as available but not attached', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const verdict = await resolveCmuxAvailability({
      env: {
        CMUX_WORKSPACE_ID: 'workspace:1',
        CMUX_SURFACE_ID: 'surface:1',
      },
      cmux: {
        ping: async () => ({ ok: true, stdout: 'pong' }),
        capabilities: async () => ({
          ok: true,
          json: {
            result: {
              access_mode: 'cmux processes only',
              methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
            },
          },
        }),
      },
    });

    assert.strictEqual(verdict.available, true);
    assert.strictEqual(verdict.attached, false);
    assert.strictEqual(verdict.mode, 'managed');
    assert.strictEqual(verdict.workspaceId, 'workspace:1');
    assert.strictEqual(verdict.surfaceId, 'surface:1');
    assert.strictEqual(verdict.suppressionReason, null);
  });

  test('resolveCmuxAvailability suppresses inaccessible alongside sessions with an explicit reason', async () => {
    const { resolveCmuxAvailability } = await loadCmuxModules();
    const verdict = await resolveCmuxAvailability({
      env: {},
      cmux: {
        ping: async () => ({ ok: true, stdout: 'pong' }),
        capabilities: async () => ({
          ok: true,
          json: {
            result: {
              access_mode: 'cmux processes only',
              methods: ['set-status', 'clear-status', 'set-progress', 'clear-progress', 'log'],
            },
          },
        }),
      },
    });

    assert.strictEqual(verdict.available, false);
    assert.strictEqual(verdict.mode, 'alongside');
    assert.strictEqual(verdict.suppressionReason, 'access-mode-blocked');
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
