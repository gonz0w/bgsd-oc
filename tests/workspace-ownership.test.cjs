/**
 * Plan-local workspace ownership tests.
 */

'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  createWaveRecoverySummary,
} = require('../src/lib/jj-workspace');

const {
  runGsdToolsInRepo,
  hasJj,
  initWorkspaceProject,
  createManagedWorkspace,
} = require('./helpers.cjs');

describe('workspace result ownership', () => {
  let tmpDir;
  let workspaceBase;

  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (workspaceBase && fs.existsSync(workspaceBase)) {
      fs.rmSync(workspaceBase, { recursive: true, force: true });
    }
  }

  function writePlan(repoDir, planId, route, filesModified) {
    const phaseDir = path.join(repoDir, '.planning', 'phases', '155-jj-workspaces');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `---\nphase: 155-jj-workspaces\nplan: ${planId.split('-')[1]}\nverification_route: ${route}\nfiles_modified:\n${filesModified.map((file) => `  - ${file}`).join('\n')}\n---\n`);
    return phaseDir;
  }

  afterEach(() => cleanupAll());

  test('workspace reconcile stays preview-only and exposes a normalized result manifest', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlan(tmpDir, '155-02', 'full', ['src/lib/jj-workspace.js']);

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    writePlan(workspace.path, '155-02', 'full', ['src/lib/jj-workspace.js']);
    const phaseDir = path.join(workspace.path, '.planning', 'phases', '155-jj-workspaces');
    const summaryRelPath = '.planning/phases/155-jj-workspaces/155-02-SUMMARY.md';
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(workspace.path, summaryRelPath), '# Summary\n');

    const reconcile = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcile.mode, 'preview');
    assert.ok(reconcile.result_manifest, 'reconcile should expose result_manifest');
    assert.strictEqual(reconcile.result_manifest.summary_path, summaryRelPath);
    assert.strictEqual(reconcile.result_manifest.shared_planning_violation.status, 'none');
    assert.strictEqual(reconcile.result_manifest.inspection_level, 'direct-proof');
    assert.strictEqual(reconcile.result_manifest.proof_buckets.behavior, 'required');
    assert.strictEqual(reconcile.result_manifest.proof_buckets.regression, 'required');
    assert.strictEqual(reconcile.result_manifest.proof_buckets.human, 'not required');
    assert.ok(fs.existsSync(path.join(phaseDir, '155-02-SUMMARY.md')), 'workspace-local summary should stay local');
  });

  test('workspace reconcile marks a first containable shared planning write as repairable', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlan(tmpDir, '155-02', 'skip', ['templates/summary.md']);

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    writePlan(workspace.path, '155-02', 'skip', ['templates/summary.md']);
    fs.writeFileSync(path.join(workspace.path, '.planning', 'STATE.md'), '# local change\n');

    const reconcile = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcile.result_manifest.inspection_level, 'summary-first');
    assert.strictEqual(reconcile.result_manifest.shared_planning_violation.status, 'repairable');
    assert.deepStrictEqual(reconcile.result_manifest.shared_planning_violation.files, ['.planning/STATE.md']);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'STATE.md')), false, 'main checkout should remain untouched in fixture');
  });

  test('workspace reconcile quarantines repeated shared planning writes', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlan(tmpDir, '155-02', 'light', ['workflows/execute-plan.md']);

    const workspace = createManagedWorkspace(tmpDir, '155-02');
    writePlan(workspace.path, '155-02', 'light', ['workflows/execute-plan.md']);
    fs.writeFileSync(path.join(workspace.path, '.planning', 'STATE.md'), '# state change\n');
    fs.writeFileSync(path.join(workspace.path, '.planning', 'ROADMAP.md'), '# roadmap change\n');

    const reconcile = JSON.parse(runGsdToolsInRepo('workspace reconcile 155-02', tmpDir).output);
    assert.strictEqual(reconcile.result_manifest.shared_planning_violation.status, 'quarantine');
    assert.match(reconcile.message, /preview only/i);
  });

  test('createWaveRecoverySummary marks later healthy siblings as staged_ready behind the first blocker', () => {
    const summary = createWaveRecoverySummary({
      name: '155-03',
      plan_id: '155-03',
      path: '/tmp/workspaces/155-03',
      status: 'healthy',
      result_manifest: {
        summary_path: '.planning/phases/155-jj-workspaces/155-03-SUMMARY.md',
        shared_planning_violation: { quarantine: false },
      },
      diagnostics: { op_log: [{ id: 'feedbeef', summary: 'healthy sibling op' }] },
      recovery_preview: null,
    }, [
      {
        name: '155-01',
        plan_id: '155-01',
        path: '/tmp/workspaces/155-01',
        status: 'stale',
        result_manifest: {
          summary_path: '.planning/phases/155-jj-workspaces/155-01-SUMMARY.md',
          shared_planning_violation: { quarantine: false },
        },
        diagnostics: { op_log: [{ id: 'abc12345', summary: 'workspace became stale' }] },
        recovery_preview: {
          commands: [{ command: 'jj -R "/tmp/workspaces/155-01" workspace update-stale' }],
        },
      },
      {
        name: '155-02',
        plan_id: '155-02',
        path: '/tmp/workspaces/155-02',
        status: 'healthy',
        result_manifest: {
          summary_path: '.planning/phases/155-jj-workspaces/155-02-SUMMARY.md',
          shared_planning_violation: { quarantine: false },
        },
        diagnostics: { op_log: [] },
        recovery_preview: null,
      },
    ]);

    assert.strictEqual(summary.status, 'staged_ready');
    assert.strictEqual(summary.gating_sibling, '155-01');
    assert.strictEqual(summary.blocking_reason, 'stale');
    assert.match(summary.next_command, /workspace reconcile 155-01/);
    assert.match(summary.proof_artifacts.jj_op_log, /op log --limit 5/);
    assert.match(summary.proof_artifacts.reconcile_preview, /workspace reconcile 155-01/);
  });

  test('createWaveRecoverySummary preserves canonical blocker taxonomy for proof_missing and finalize_failed siblings', () => {
    const proofMissing = createWaveRecoverySummary({
      name: '155-02',
      plan_id: '155-02',
      path: '/tmp/workspaces/155-02',
      status: 'healthy',
      result_manifest: {
        summary_path: '.planning/phases/155-jj-workspaces/155-02-SUMMARY.md',
        shared_planning_violation: { quarantine: false },
      },
      diagnostics: { op_log: [] },
      recovery_preview: null,
    }, [
      {
        name: '155-01',
        plan_id: '155-01',
        path: '/tmp/workspaces/155-01',
        status: 'healthy',
        result_manifest: {
          summary_path: null,
          inspection_level: 'direct-proof',
          shared_planning_violation: { quarantine: false },
        },
        diagnostics: { op_log: [] },
        recovery_preview: null,
      },
    ]);

    assert.strictEqual(proofMissing.status, 'staged_ready');
    assert.strictEqual(proofMissing.gating_sibling, '155-01');
    assert.strictEqual(proofMissing.blocking_reason, 'proof_missing');

    const finalizeFailed = createWaveRecoverySummary({
      name: '155-02',
      plan_id: '155-02',
      path: '/tmp/workspaces/155-02',
      status: 'healthy',
      result_manifest: {
        summary_path: '.planning/phases/155-jj-workspaces/155-02-SUMMARY.md',
        shared_planning_violation: { quarantine: false },
      },
      diagnostics: { op_log: [] },
      recovery_preview: null,
    }, [
      {
        name: '155-01',
        plan_id: '155-01',
        path: '/tmp/workspaces/155-01',
        status: 'finalize_failed',
        result_manifest: {
          summary_path: '.planning/phases/155-jj-workspaces/155-01-SUMMARY.md',
          shared_planning_violation: { quarantine: false },
        },
        diagnostics: { op_log: [] },
        recovery_preview: null,
      },
    ]);

    assert.strictEqual(finalizeFailed.status, 'staged_ready');
    assert.strictEqual(finalizeFailed.gating_sibling, '155-01');
    assert.strictEqual(finalizeFailed.blocking_reason, 'finalize_failed');
    assert.match(finalizeFailed.next_command, /workspace reconcile 155-01/);
  });
});
