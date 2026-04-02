/**
 * bgsd-tools workspace tests
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const {
  runGsdToolsInRepo,
  hasJj,
  initWorkspaceProject,
  createManagedWorkspace,
  markWorkspaceStale,
  markWorkspaceDivergent,
} = require('./helpers.cjs');

function resolvedPath(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function writePlan(repoDir, planId, route, filesModified, wave = 1) {
  const phaseDir = path.join(repoDir, '.planning', 'phases', '155-jj-workspaces');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `---\nphase: 155-jj-workspaces\nplan: ${planId.split('-')[1]}\nwave: ${wave}\nverification_route: ${route}\nfiles_modified:\n${filesModified.map((file) => `  - ${file}`).join('\n')}\n---\n`);
}

describe('workspace commands', () => {
  let tmpDir;
  let workspaceBase;

  function createJjProject(configOverrides = {}) {
    const project = initWorkspaceProject(configOverrides);
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
  }

  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        const workspaces = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output || '{"workspaces":[]}').workspaces || [];
        for (const workspace of workspaces) {
          try {
            runGsdToolsInRepo('workspace cleanup', tmpDir);
            break;
          } catch {}
        }
      } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (workspaceBase && fs.existsSync(workspaceBase)) {
      fs.rmSync(workspaceBase, { recursive: true, force: true });
    }
  }

  afterEach(() => cleanupAll());

  test('creates and lists a managed JJ workspace', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const addResult = runGsdToolsInRepo('workspace add 155-02', tmpDir);
    assert.ok(addResult.success, `workspace add failed: ${addResult.error}`);
    const addData = JSON.parse(addResult.output);
    assert.strictEqual(addData.added, true);
    assert.strictEqual(addData.workspace.name, '155-02');
    assert.ok(fs.existsSync(addData.workspace.path), 'workspace path should exist');

    const listResult = runGsdToolsInRepo('workspace list', tmpDir);
    assert.ok(listResult.success, `workspace list failed: ${listResult.error}`);
    const listData = JSON.parse(listResult.output);
    assert.strictEqual(listData.workspaces.length, 1);
    assert.strictEqual(listData.workspaces[0].name, '155-02');
    assert.strictEqual(listData.workspaces[0].plan_id, '155-02');
    assert.ok(listData.workspaces[0].path.startsWith(resolvedPath(workspaceBase)));
  });

  test('forget keeps directory on disk while removing JJ tracking', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const addData = JSON.parse(runGsdToolsInRepo('workspace add 155-02', tmpDir).output);
    const workspacePath = addData.workspace.path;

    const forgetResult = runGsdToolsInRepo('workspace forget 155-02', tmpDir);
    assert.ok(forgetResult.success, `workspace forget failed: ${forgetResult.error}`);
    const forgetData = JSON.parse(forgetResult.output);
    assert.strictEqual(forgetData.forgotten, true);
    assert.strictEqual(forgetData.workspace.name, '155-02');
    assert.ok(fs.existsSync(workspacePath), 'forget should not delete the directory');

    const listData = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output);
    assert.deepStrictEqual(listData.workspaces, []);
  });

  test('cleanup forgets JJ workspaces and removes directories', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const add01 = JSON.parse(runGsdToolsInRepo('workspace add 155-01', tmpDir).output);
    const add02 = JSON.parse(runGsdToolsInRepo('workspace add 155-02', tmpDir).output);

    const cleanupResult = runGsdToolsInRepo('workspace cleanup', tmpDir);
    assert.ok(cleanupResult.success, `workspace cleanup failed: ${cleanupResult.error}`);
    const cleanupData = JSON.parse(cleanupResult.output);
    assert.strictEqual(cleanupData.cleaned, 2);
    assert.ok(cleanupData.workspaces.every((workspace) => workspace.removed_from_disk === true));
    assert.ok(!fs.existsSync(add01.workspace.path), 'first workspace path should be deleted');
    assert.ok(!fs.existsSync(add02.workspace.path), 'second workspace path should be deleted');

    const listData = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output);
    assert.deepStrictEqual(listData.workspaces, []);
  });

  test('reconcile resolves the managed workspace context', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const addData = JSON.parse(runGsdToolsInRepo('workspace add 155-02', tmpDir).output);
    fs.writeFileSync(path.join(addData.workspace.path, 'feature.txt'), 'workspace change\n');

    const reconcileResult = runGsdToolsInRepo('workspace reconcile 155-02', tmpDir);
    assert.ok(reconcileResult.success, `workspace reconcile failed: ${reconcileResult.error}`);
    const reconcileData = JSON.parse(reconcileResult.output);
    assert.strictEqual(reconcileData.reconciled, true);
    assert.strictEqual(reconcileData.mode, 'preview');
    assert.strictEqual(reconcileData.workspace.name, '155-02');
    assert.strictEqual(reconcileData.status, 'healthy');
    assert.ok(reconcileData.result_manifest, 'reconcile should expose result manifest metadata');
    assert.strictEqual(reconcileData.result_manifest.shared_planning_violation.status, 'none');
    assert.ok(Array.isArray(reconcileData.diagnostics.op_log));
    assert.strictEqual(reconcileData.recovery_preview, null);
  });

  test('list and reconcile expose JJ-backed stale diagnostics with preview-only recovery', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    markWorkspaceStale(tmpDir, workspace.path);

    const listData = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output);
    assert.strictEqual(listData.workspaces[0].status, 'stale');
    assert.ok(listData.workspaces[0].diagnostics.evidence[0].summary.includes('stale'));

    const reconcileData = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcileData.reconciled, false);
    assert.strictEqual(reconcileData.status, 'stale');
    assert.strictEqual(reconcileData.recovery_allowed, true);
    assert.ok(reconcileData.recovery_preview.commands[0].command.includes('workspace update-stale'));

    const statusBeforeApply = spawnSync('jj', ['status'], {
      cwd: workspace.path,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.notStrictEqual(statusBeforeApply.status, 0, 'preview should not auto-update the stale workspace');
    assert.match(statusBeforeApply.stderr, /working copy is stale/i);
  });

  test('reconcile marks conflicted stale recovery as divergent and disables automated apply', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    markWorkspaceDivergent(tmpDir, workspace.path);
    execSync('jj workspace update-stale', { cwd: workspace.path, stdio: 'pipe' });

    const reconcileData = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcileData.status, 'divergent');
    assert.strictEqual(reconcileData.recovery_allowed, false);
    assert.match(reconcileData.recovery_preview.summary, /manual resolution/i);
    assert.match(reconcileData.diagnostics.evidence[0].summary, /conflict/i);
  });

  test('reconcile keeps later healthy siblings inspectable as staged_ready behind the first stale blocker', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    writePlan(tmpDir, '155-01', 'full', ['src/lib/jj-workspace.js']);
    writePlan(tmpDir, '155-02', 'full', ['src/commands/workspace.js']);

    const first = createManagedWorkspace(tmpDir, '155-01');
    const second = createManagedWorkspace(tmpDir, '155-02');
    writePlan(first.path, '155-01', 'full', ['src/lib/jj-workspace.js']);
    writePlan(second.path, '155-02', 'full', ['src/commands/workspace.js']);
    fs.writeFileSync(path.join(first.path, '.planning', 'phases', '155-jj-workspaces', '155-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(second.path, '.planning', 'phases', '155-jj-workspaces', '155-02-SUMMARY.md'), '# Summary\n');
    markWorkspaceStale(tmpDir, first.path);

    const reconcileData = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcileData.reconciled, false);
    assert.strictEqual(reconcileData.status, 'staged_ready');
    assert.strictEqual(reconcileData.workspace.gating_sibling, '155-01');
    assert.strictEqual(reconcileData.workspace.blocking_reason, 'stale');
    assert.strictEqual(reconcileData.result_manifest.gating_sibling, '155-01');
    assert.strictEqual(reconcileData.result_manifest.staged_ready, true);
    assert.match(reconcileData.recovery_summary.next_command, /workspace reconcile 155-01/);
    assert.match(reconcileData.recovery_summary.proof_artifacts.jj_op_log, /op log --limit 5/);
  });

  test('list inventory surfaces staged-ready siblings plus canonical recovery summary guidance', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    writePlan(tmpDir, '155-01', 'full', ['src/lib/jj-workspace.js']);
    writePlan(tmpDir, '155-02', 'full', ['src/commands/workspace.js']);

    const first = createManagedWorkspace(tmpDir, '155-01');
    const second = createManagedWorkspace(tmpDir, '155-02');
    writePlan(first.path, '155-01', 'full', ['src/lib/jj-workspace.js']);
    writePlan(second.path, '155-02', 'full', ['src/commands/workspace.js']);
    fs.writeFileSync(path.join(first.path, '.planning', 'phases', '155-jj-workspaces', '155-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(second.path, '.planning', 'phases', '155-jj-workspaces', '155-02-SUMMARY.md'), '# Summary\n');
    markWorkspaceStale(tmpDir, first.path);

    const listData = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output);
    const listedSecond = listData.workspaces.find((workspace) => workspace.plan_id === '155-02');
    assert.strictEqual(listedSecond.status, 'staged_ready');
    assert.strictEqual(listedSecond.gating_sibling, '155-01');
    assert.match(listedSecond.recovery_summary.next_command, /workspace reconcile 155-01/);
    assert.deepStrictEqual(listData.summary.staged_ready, ['155-02']);
    assert.deepStrictEqual(listData.summary.recovery_needed, ['155-01']);
    assert.strictEqual(listData.summary.gating_sibling, '155-01');
    assert.match(listData.summary.recovery_summary.next_command, /workspace reconcile 155-01/);
  });

  test('cleanup retains stale recovery workspaces while removing healthy ones', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    createManagedWorkspace(tmpDir, '155-01');
    const staleWorkspace = createManagedWorkspace(tmpDir, '155-02');
    markWorkspaceStale(tmpDir, staleWorkspace.path);

    const cleanupData = JSON.parse(runGsdToolsInRepo('workspace cleanup', tmpDir).output);
    assert.strictEqual(cleanupData.cleaned, 1);
    assert.strictEqual(cleanupData.retained, 1);
    assert.strictEqual(cleanupData.retained_workspaces[0].status, 'stale');
    assert.ok(fs.existsSync(staleWorkspace.path), 'stale workspace should stay on disk for recovery');

    const listData = JSON.parse(runGsdToolsInRepo('workspace list', tmpDir).output);
    assert.strictEqual(listData.workspaces.length, 1);
    assert.strictEqual(listData.workspaces[0].name, '155-02');
  });

  test('workspace prove unlocks parallel mode only when intended root, cwd, and jj root all match', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    const proveResult = runGsdToolsInRepo('workspace prove 155-02', workspace.path);
    assert.ok(proveResult.success, `workspace prove failed: ${proveResult.error}`);

    const proveData = JSON.parse(proveResult.output);
    assert.strictEqual(proveData.parallel_allowed, true);
    assert.strictEqual(proveData.fallback_reason, null);
    assert.strictEqual(proveData.intended_root, resolvedPath(workspace.path));
    assert.strictEqual(proveData.observed_cwd, resolvedPath(workspace.path));
    assert.strictEqual(proveData.observed_jj_root, resolvedPath(workspace.path));
  });

  test('workspace prove downgrades a subdirectory start to the generic sequential fallback', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    const nestedDir = path.join(workspace.path, 'nested', 'child');
    fs.mkdirSync(nestedDir, { recursive: true });

    const proveResult = runGsdToolsInRepo('workspace prove 155-02', nestedDir);
    assert.ok(proveResult.success, `workspace prove failed: ${proveResult.error}`);

    const proveData = JSON.parse(proveResult.output);
    assert.strictEqual(proveData.parallel_allowed, false);
    assert.strictEqual(proveData.fallback_reason, 'workspace proof missing or mismatched before work start');
    assert.strictEqual(proveData.intended_root, resolvedPath(workspace.path));
    assert.strictEqual(proveData.observed_cwd, resolvedPath(nestedDir));
    assert.strictEqual(proveData.observed_jj_root, resolvedPath(workspace.path));
  });

  test('workspace prove returns the same generic fallback when authoritative workspace proof is unavailable', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const proveResult = runGsdToolsInRepo('workspace prove 155-02', tmpDir);
    assert.ok(proveResult.success, `workspace prove failed: ${proveResult.error}`);

    const proveData = JSON.parse(proveResult.output);
    assert.strictEqual(proveData.parallel_allowed, false);
    assert.strictEqual(proveData.fallback_reason, 'workspace proof missing or mismatched before work start');
    assert.strictEqual(proveData.intended_root, null);
    assert.strictEqual(proveData.observed_cwd, resolvedPath(tmpDir));
    assert.strictEqual(proveData.observed_jj_root, resolvedPath(tmpDir));
  });

  test('rejects duplicate workspace add for same plan', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    createJjProject();

    const first = runGsdToolsInRepo('workspace add 155-02', tmpDir);
    assert.ok(first.success, `first add failed: ${first.error}`);

    const second = runGsdToolsInRepo('workspace add 155-02', tmpDir);
    assert.ok(!second.success, 'duplicate add should fail');
    assert.match(second.error, /already exists/i);
  });
});
