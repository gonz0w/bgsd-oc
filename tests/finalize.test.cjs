/**
 * Finalize coordinator tests.
 */

'use strict';

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  runGsdToolsInRepo,
  hasJj,
  initWorkspaceProject,
  createManagedWorkspace,
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
});
