/**
 * Finalize coordinator tests.
 */

'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  runGsdToolsInRepo,
  hasJj,
  initWorkspaceProject,
  createManagedWorkspace,
  markWorkspaceStale,
} = require('./helpers.cjs');

describe('execute:finalize-plan', () => {
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

  function writePlanningFiles(repoDir) {
    fs.mkdirSync(path.join(repoDir, '.planning', 'phases', '183-plan-local-workspace-ownership'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** 183 of 186 (Plan-Local Workspace Ownership)\n**Current Plan:** 1\n**Total Plans in Phase:** 1\n**Plan:** 183-02 — Finalize\n**Status:** In progress\n**Current focus:** Phase 183 — Plan-Local Workspace Ownership plan 01 of 01\n**Last Activity:** 2026-04-01\n\n**Progress:** [░░░░░░░░░░] 0%\n\n## Performance Metrics\n\n**Velocity:**\n- Total plans completed: 0\n- Average duration: -\n- Total execution time: 0 hours\n\n**By Phase:**\n\n| Phase | Plans | Total | Avg/Plan |\n|-------|-------|-------|----------|\n| - | - | - | - |\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-04-01\n**Stopped at:** Phase 183 plan work\n**Resume file:** None\n`);
    fs.writeFileSync(path.join(repoDir, '.planning', 'ROADMAP.md'), `# Roadmap: Test\n\n## Phases\n\n- [ ] **Phase 183: Plan-Local Workspace Ownership**\n\n### Phase 183: Plan-Local Workspace Ownership\n**Goal:** Finalize shared planning state through one command\n**Depends on:** Phase 182\n**Requirements:** JJ-02, FIN-01\n**Plans:** 0/1 plans executed\n\n## Progress\n\n| Phase | Plans Complete | Status | Completed |\n|-------|----------------|--------|-----------|\n| 183. Plan-Local Workspace Ownership | 0/1 | In Progress |  |\n`);
    fs.writeFileSync(path.join(repoDir, '.planning', 'REQUIREMENTS.md'), `# Requirements\n\n- [x] **JJ-02**: Plan-local outputs are isolated until finalize\n- [ ] **FIN-01**: Shared planning state is updated through one finalize path\n\n## Traceability\n\n| Requirement | Phase | Status | Test Command |\n|-------------|-------|--------|--------------|\n| JJ-02 | Phase 183 | Complete | TBD |\n| FIN-01 | Phase 183 | Pending | TBD |\n`);
    fs.writeFileSync(path.join(repoDir, '.planning', 'phases', '183-plan-local-workspace-ownership', '183-02-PLAN.md'), `---\nphase: 183-plan-local-workspace-ownership\nplan: 02\nverification_route: full\nrequirements:\n  - JJ-02\n  - FIN-01\nfiles_modified:\n  - src/commands/misc/finalize.js\n  - src/router.js\n---\n`);
  }

  function writeWavePlanningFiles(repoDir, planIds = ['184-01', '184-02', '184-03']) {
    const phaseDir = path.join(repoDir, '.planning', 'phases', '184-deterministic-finalize-partial-wave-recovery');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** 184 of 186 (Deterministic Finalize & Partial-Wave Recovery)\n**Current Plan:** 1\n**Total Plans in Phase:** 3\n**Plan:** 184-01 — Recovery\n**Status:** In progress\n**Current focus:** Phase 184 — Deterministic Finalize & Partial-Wave Recovery plan 01 of 03\n**Last Activity:** 2026-04-01\n\n**Progress:** [░░░░░░░░░░] 0%\n\n## Performance Metrics\n\n**Velocity:**\n- Total plans completed: 0\n- Average duration: -\n- Total execution time: 0 hours\n\n**By Phase:**\n\n| Phase | Plans | Total | Avg/Plan |\n|-------|-------|-------|----------|\n| - | - | - | - |\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-04-01\n**Stopped at:** Phase 184 plan work\n**Resume file:** None\n`);
    fs.writeFileSync(path.join(repoDir, '.planning', 'ROADMAP.md'), `# Roadmap: Test\n\n## Phases\n\n- [ ] **Phase 184: Deterministic Finalize & Partial-Wave Recovery**\n\n### Phase 184: Deterministic Finalize & Partial-Wave Recovery\n**Goal:** Finalize shared planning state deterministically across wave siblings\n**Depends on:** Phase 183\n**Requirements:** FIN-02, FIN-03, FIN-04\n**Plans:** 0/${planIds.length} plans executed\n\n## Progress\n\n| Phase | Plans Complete | Status | Completed |\n|-------|----------------|--------|-----------|\n| 184. Deterministic Finalize & Partial-Wave Recovery | 0/${planIds.length} | In Progress |  |\n`);
    fs.writeFileSync(path.join(repoDir, '.planning', 'REQUIREMENTS.md'), `# Requirements\n\n- [ ] **FIN-02**: Healthy sibling workspaces can reconcile and report useful status even when another workspace in the same wave fails, goes stale, or needs recovery\n- [ ] **FIN-03**: Final shared planning state is deterministic regardless of the order in which healthy workspaces finish or are finalized\n- [ ] **FIN-04**: System preserves inspectable recovery metadata when a workspace becomes stale, divergent, or finalize fails partway through\n\n## Traceability\n\n| Requirement | Phase | Status | Test Command |\n|-------------|-------|--------|--------------|\n| FIN-02 | Phase 184 | Pending | TBD |\n| FIN-03 | Phase 184 | Pending | TBD |\n| FIN-04 | Phase 184 | Pending | TBD |\n`);

    for (const planId of planIds) {
      fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `---\nphase: 184-deterministic-finalize-partial-wave-recovery\nplan: ${planId.split('-')[1]}\nwave: 2\nverification_route: full\nrequirements:\n  - FIN-02\n  - FIN-03\n  - FIN-04\nfiles_modified:\n  - src/commands/misc/finalize.js\n  - src/router.js\n  - tests/finalize.test.cjs\n---\n`);
    }
  }

  function writeWorkspaceArtifacts(workspaceDir, options = {}) {
    const phaseDir = path.join(workspaceDir, '.planning', 'phases', '183-plan-local-workspace-ownership');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '183-02-PLAN.md'), `---\nphase: 183-plan-local-workspace-ownership\nplan: 02\nverification_route: full\nrequirements:\n  - JJ-02\n  - FIN-01\nfiles_modified:\n  - src/commands/misc/finalize.js\n  - src/router.js\n---\n`);
    fs.writeFileSync(path.join(phaseDir, '183-02-SUMMARY.md'), '# Summary\n\nImplemented finalize coordinator.\n');
    if (options.withProof !== false) {
      fs.writeFileSync(path.join(phaseDir, '183-02-TDD-AUDIT.json'), JSON.stringify({ green: true }, null, 2));
    }
    if (options.quarantine) {
      fs.writeFileSync(path.join(workspaceDir, '.planning', 'STATE.md'), '# workspace-only state write\n');
      fs.writeFileSync(path.join(workspaceDir, '.planning', 'ROADMAP.md'), '# workspace-only roadmap write\n');
    }
  }

  function writeWaveWorkspaceArtifacts(workspaceDir, planId) {
    const phaseDir = path.join(workspaceDir, '.planning', 'phases', '184-deterministic-finalize-partial-wave-recovery');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `---\nphase: 184-deterministic-finalize-partial-wave-recovery\nplan: ${planId.split('-')[1]}\nwave: 2\nverification_route: full\nrequirements:\n  - FIN-02\n  - FIN-03\n  - FIN-04\nfiles_modified:\n  - src/commands/misc/finalize.js\n  - src/router.js\n  - tests/finalize.test.cjs\n---\n`);
    fs.writeFileSync(path.join(phaseDir, `${planId}-SUMMARY.md`), `# Summary\n\nImplemented ${planId}.\n`);
    fs.writeFileSync(path.join(phaseDir, `${planId}-TDD-AUDIT.json`), JSON.stringify({ planId, green: true }, null, 2));
  }

  function snapshotSharedPlanning(repoDir) {
    return {
      state: fs.readFileSync(path.join(repoDir, '.planning', 'STATE.md'), 'utf-8')
        .replace(/\*\*Last session:\*\* .*\n/, '**Last session:** <normalized>\n'),
      roadmap: fs.readFileSync(path.join(repoDir, '.planning', 'ROADMAP.md'), 'utf-8'),
      requirements: fs.readFileSync(path.join(repoDir, '.planning', 'REQUIREMENTS.md'), 'utf-8'),
    };
  }

  afterEach(() => cleanupAll());

  test('healthy workspace finalizes through the canonical shared-state mutators', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlanningFiles(tmpDir);

    const workspace = createManagedWorkspace(tmpDir, '183-02');
    writeWorkspaceArtifacts(workspace.path);

    const result = runGsdToolsInRepo('execute:finalize-plan 183-02', tmpDir);
    assert.ok(result.success, `finalize command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.finalized, true);
    assert.strictEqual(data.workspace.name, '183-02');
    assert.deepStrictEqual(data.mutators, [
      'verify:state complete-plan',
      'plan:roadmap update-plan-progress',
      'plan:requirements mark-complete',
    ]);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const requirements = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(roadmap, /1\/1 plans complete/i);
    assert.match(requirements, /- \[x\] \*\*FIN-01\*\*/i);
    assert.match(state, /Phase complete/i);
  });

  test('missing proof blocks finalize before any shared planning write', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlanningFiles(tmpDir);

    const workspace = createManagedWorkspace(tmpDir, '183-02');
    writeWorkspaceArtifacts(workspace.path, { withProof: false });

    const beforeRoadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const beforeRequirements = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    const result = runGsdToolsInRepo('execute:finalize-plan 183-02', tmpDir);
    assert.ok(!result.success, 'missing proof should block finalize');
    assert.match(result.error, /missing proof/i);
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8'), beforeRoadmap);
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8'), beforeRequirements);
  });

  test('quarantined shared-planning violations block finalize and keep the workspace inspectable', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writePlanningFiles(tmpDir);

    const workspace = createManagedWorkspace(tmpDir, '183-02');
    writeWorkspaceArtifacts(workspace.path, { quarantine: true });

    const result = runGsdToolsInRepo('execute:finalize-plan 183-02', tmpDir);
    assert.ok(!result.success, 'quarantined workspace should block finalize');
    assert.match(result.error, /quarantine|policy-violating/i);
    assert.ok(fs.existsSync(path.join(workspace.path, '.planning', 'phases', '183-plan-local-workspace-ownership', '183-02-SUMMARY.md')));
    assert.doesNotMatch(fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8'), /- \[x\] \*\*FIN-01\*\*/i);
  });

  test('wave finalize promotes healthy siblings in canonical plan order regardless of finish order', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const firstProject = initWorkspaceProject();
    const secondProject = initWorkspaceProject();
    t.after(() => {
      fs.rmSync(firstProject.tmpDir, { recursive: true, force: true });
      fs.rmSync(firstProject.workspaceBase, { recursive: true, force: true });
      fs.rmSync(secondProject.tmpDir, { recursive: true, force: true });
      fs.rmSync(secondProject.workspaceBase, { recursive: true, force: true });
    });

    writeWavePlanningFiles(firstProject.tmpDir, ['184-01', '184-02']);
    writeWavePlanningFiles(secondProject.tmpDir, ['184-01', '184-02']);

    for (const planId of ['184-02', '184-01']) {
      const workspace = createManagedWorkspace(firstProject.tmpDir, planId);
      writeWaveWorkspaceArtifacts(workspace.path, planId);
    }

    for (const planId of ['184-01', '184-02']) {
      const workspace = createManagedWorkspace(secondProject.tmpDir, planId);
      writeWaveWorkspaceArtifacts(workspace.path, planId);
    }

    const firstResult = runGsdToolsInRepo('execute:finalize-wave 184 --wave 2', firstProject.tmpDir);
    const secondResult = runGsdToolsInRepo('execute:finalize-wave 184 --wave 2', secondProject.tmpDir);

    assert.ok(firstResult.success, `first finalize-wave failed: ${firstResult.error}`);
    assert.ok(secondResult.success, `second finalize-wave failed: ${secondResult.error}`);

    const firstData = JSON.parse(firstResult.output);
    const secondData = JSON.parse(secondResult.output);
    assert.deepStrictEqual(firstData.finalized_plans, ['184-01', '184-02']);
    assert.deepStrictEqual(secondData.finalized_plans, ['184-01', '184-02']);
    assert.strictEqual(firstData.status, 'finalized');
    assert.strictEqual(secondData.status, 'finalized');

    assert.deepStrictEqual(snapshotSharedPlanning(firstProject.tmpDir), snapshotSharedPlanning(secondProject.tmpDir));
  });

  test('wave finalize preserves staged-ready healthy siblings behind a blocker and promotes them on rerun after recovery', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const project = initWorkspaceProject();
    tmpDir = project.tmpDir;
    workspaceBase = project.workspaceBase;
    writeWavePlanningFiles(tmpDir);
    execSync('jj status', { cwd: tmpDir, stdio: 'pipe' });
    execSync('jj commit -m "wave setup"', { cwd: tmpDir, stdio: 'pipe' });

    const first = createManagedWorkspace(tmpDir, '184-01');
    const second = createManagedWorkspace(tmpDir, '184-02');
    const third = createManagedWorkspace(tmpDir, '184-03');
    writeWaveWorkspaceArtifacts(first.path, '184-01');
    writeWaveWorkspaceArtifacts(second.path, '184-02');
    writeWaveWorkspaceArtifacts(third.path, '184-03');
    markWorkspaceStale(tmpDir, first.path);

    const blockedResult = runGsdToolsInRepo('execute:finalize-wave 184 --wave 2', tmpDir);
    assert.ok(blockedResult.success, `blocked finalize-wave failed: ${blockedResult.error}`);

    const blockedData = JSON.parse(blockedResult.output);
    assert.strictEqual(blockedData.status, 'recovery-needed');
    assert.strictEqual(blockedData.gating_sibling, '184-01');
    assert.deepStrictEqual(blockedData.finalized_plans, []);
    assert.deepStrictEqual(blockedData.staged_ready_plans, ['184-02', '184-03']);

    const recoverySummaryPath = path.join(tmpDir, '.planning', 'phases', '184-deterministic-finalize-partial-wave-recovery', '184-wave-2-recovery.json');
    assert.ok(fs.existsSync(recoverySummaryPath), 'wave recovery summary should be written to shared planning state');
    const blockedSummary = JSON.parse(fs.readFileSync(recoverySummaryPath, 'utf-8'));
    assert.strictEqual(blockedSummary.status, 'recovery-needed');
    assert.strictEqual(blockedSummary.gating_sibling, '184-01');
    assert.deepStrictEqual(blockedSummary.staged_ready, ['184-02', '184-03']);

    execSync(`jj -R ${JSON.stringify(first.path)} workspace update-stale`, { cwd: tmpDir, stdio: 'pipe' });

    const rerunResult = runGsdToolsInRepo('execute:finalize-wave 184 --wave 2', tmpDir);
    assert.ok(rerunResult.success, `rerun finalize-wave failed: ${rerunResult.error}`);

    const rerunData = JSON.parse(rerunResult.output);
    assert.strictEqual(rerunData.status, 'finalized');
    assert.deepStrictEqual(rerunData.finalized_plans, ['184-01', '184-02', '184-03']);
    assert.deepStrictEqual(rerunData.staged_ready_plans, []);

    const rerunSummary = JSON.parse(fs.readFileSync(recoverySummaryPath, 'utf-8'));
    assert.strictEqual(rerunSummary.status, 'finalized');
    assert.deepStrictEqual(rerunSummary.finalized, ['184-01', '184-02', '184-03']);
    assert.deepStrictEqual(rerunSummary.staged_ready, []);
    assert.match(fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8'), /3\/3 plans complete/i);
    assert.match(fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8'), /- \[x\] \*\*FIN-03\*\*/i);
  });
});
