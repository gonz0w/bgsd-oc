/**
 * bgsd-tools init tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, runGsdToolsInRepo, createTempProject, cleanup } = require('./helpers.cjs');
const { getEffectiveIntent } = require('../src/commands/intent.js');

describe('init commands', () => {
  let tmpDir;

  function hasJj() {
    try {
      execSync('jj --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  function initGitRepo(dir) {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
    execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  }

  function initJjRepo(dir) {
    execSync('jj git init', { cwd: dir, stdio: 'pipe' });
  }

  function writeExecuteFixture(phaseNumber = '155', phaseDirName = '155-jj-execution-gate-workspace-lifecycle') {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, `${phaseNumber}-01-PLAN.md`), `---\nphase: ${phaseDirName}\nplan: 01\nwave: 1\nautonomous: true\ndepends_on: []\nfiles_modified:\n  - src/example.js\n---\n\n# Plan\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n### Phase ${Number(phaseNumber)}: JJ Execution Gate & Workspace Lifecycle\n**Goal:** Test execution gating\n**Plans:** 1 plans\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** ${phaseNumber} — JJ Execution Gate & Workspace Lifecycle\n**Current Plan:** 01\n**Total Plans in Phase:** 1\n**Status:** Ready to execute\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ mode: 'yolo' }, null, 2));
  }

  function writeCurrentPhaseState(phase = '152') {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** ${phase} — Cached Handoffs & Fresh-Context Delivery
**Current Plan:** 03
**Status:** Ready to execute
`);
  }

  function writePhaseFixture(phaseDirName = '152-cached-handoffs-fresh-context-delivery', planFile = '152-03-PLAN.md') {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, planFile), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 152: Cached Handoffs & Fresh-Context Delivery
**Goal:** Resume safely
**Plans:** 1 plans
`);
  }

  function writePlanningIntentFixture(phaseNumber = '157', phaseDirName = '157-planning-context-cascade') {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), `**Revision:** 1
**Created:** 2026-01-01
**Updated:** 2026-01-01

<objective>
Build a CLI tool for project planning

This tool helps teams manage complex multi-phase projects.
</objective>

<users>
- Software engineers working on multi-service architectures
</users>

<outcomes>
- DO-118 [P1]: JJ workspaces enable safe execution parallelism
- DO-120 [P1]: Effective intent reaches planning surfaces
</outcomes>

<criteria>
- SC-01: Keep planning context compact and additive
</criteria>
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md'), `# MILESTONE-INTENT

## Why Now
Planning surfaces need compact layered purpose without raw intent-document dumps.

## Target Outcomes
- DO-120: Compact effective intent reaches planning surfaces

## Priorities
- Prefer compact injected context over raw markdown payloads

## Non-Goals
- No live workspace inventory in planning intent
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Milestones

- 🔵 **v17.0 Test Milestone** — Phases ${phaseNumber}-${phaseNumber} (active)

## Phases

### Phase ${phaseNumber}: Planning Context Cascade
**Goal**: Layer milestone and phase intent
**Plans:** 1 plan
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** ${phaseNumber}
**Current Plan:** 01
**Status:** Ready
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      workspace: { base_path: '/tmp/planning-workspaces', max_concurrent: 4 },
    }, null, 2));
    fs.writeFileSync(path.join(phaseDir, `${phaseNumber}-01-PLAN.md`), `---
phase: ${phaseDirName}
plan: 01
type: execute
---

<objective>Test</objective>
`, 'utf-8');
    fs.writeFileSync(path.join(phaseDir, `${phaseNumber}-CONTEXT.md`), `# Phase ${phaseNumber} Context

<phase_intent>
## Phase Intent
- **Local Purpose:** Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.
- **Expected User Change:** Before: planning users had to infer the current phase purpose from broad context prose. After: planning users can read one explicit phase-local intent block with the promised user-facing change.
  - Planning users can see the local purpose without reconstructing it from multiple sections
  - Planning users can tell which adjacent improvements this phase is not trying to solve
- **Non-Goals:**
  - Do not add sibling-plan recommendation heuristics in this phase.
</phase_intent>

<domain>
## Phase Boundary
Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.
</domain>
    `, 'utf-8');
  }

  function writeRealLegacyPhase160Fixture() {
    const repoRoot = path.join(__dirname, '..');
    const sourcePlanningDir = path.join(repoRoot, '.planning');
    const legacyPhaseDir = '160-phase-intent-alignment-verification';
    const livePhasePath = path.join(sourcePlanningDir, 'phases', legacyPhaseDir);
    const archivedPhasePath = path.join(sourcePlanningDir, 'milestones', 'v17.0-phases', legacyPhaseDir);
    const phaseSourcePath = fs.existsSync(livePhasePath) ? livePhasePath : archivedPhasePath;

    fs.cpSync(path.join(sourcePlanningDir, 'INTENT.md'), path.join(tmpDir, '.planning', 'INTENT.md'));
    fs.cpSync(path.join(sourcePlanningDir, 'MILESTONE-INTENT.md'), path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md'));
    fs.cpSync(path.join(sourcePlanningDir, 'ROADMAP.md'), path.join(tmpDir, '.planning', 'ROADMAP.md'));
    fs.cpSync(phaseSourcePath, path.join(tmpDir, '.planning', 'phases', legacyPhaseDir), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 160
**Current Plan:** 02
**Status:** Ready
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }, null, 2));
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init execute-phase blocks Git-only repos with JJ guidance', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    initGitRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 155 --verbose', tmpDir);
    assert.ok(!result.success, 'Git-only repo should fail execution init');
    assert.match(result.error, /Jujutsu \(jj\) is required/i);
    assert.match(result.error, /jj git init/);
  });

  test('init quick blocks Git-only repos with JJ guidance', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    initGitRepo(tmpDir);

    const result = runGsdToolsInRepo('init:quick "test quick task" --verbose', tmpDir);
    assert.ok(!result.success, 'Git-only repo should fail quick init');
    assert.match(result.error, /init:quick/);
    assert.match(result.error, /jj git init/);
  });

  test('read-only init plan-phase remains available in Git-only repos', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n');
    initGitRepo(tmpDir);

    const result = runGsdTools('init:plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Read-only init should stay available: ${result.error}`);
  });

  test('init execute-phase returns workspace metadata in JJ-backed repos', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      mode: 'yolo',
      workspace: { base_path: '/tmp/gsd-jj-workspaces', max_concurrent: 5 },
    }, null, 2));
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 155 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.workspace_enabled, true);
    assert.strictEqual(output.workspace_config.base_path, '/tmp/gsd-jj-workspaces');
    assert.strictEqual(output.workspace_config.max_concurrent, 5);
    assert.ok(Array.isArray(output.workspace_active), 'workspace_active should be array');
    assert.strictEqual(output.worktree_enabled, undefined, 'legacy worktree_enabled should be absent');
    assert.strictEqual(output.worktree_config, undefined, 'legacy worktree_config should be absent');
    assert.strictEqual(output.worktree_active, undefined, 'legacy worktree_active should be absent');
  });

  test('init execute-phase returns live managed workspace inventory for the active phase', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      mode: 'yolo',
      workspace: { base_path: path.join(tmpDir, '.workspaces'), max_concurrent: 5 },
    }, null, 2));
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const addResult = runGsdToolsInRepo('workspace add 155-01', tmpDir);
    assert.ok(addResult.success, `workspace add failed: ${addResult.error}`);
    const workspacePath = JSON.parse(addResult.output).workspace.path;
    fs.writeFileSync(path.join(workspacePath, 'workspace-change.txt'), 'workspace-only change\n');

    const result = runGsdToolsInRepo('init:execute-phase 155 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.workspace_active.length, 1, 'should report the managed workspace for the active phase');
    assert.strictEqual(output.workspace_active[0].name, '155-01');
    assert.strictEqual(output.workspace_active[0].plan_id, '155-01');
    assert.strictEqual(output.workspace_active[0].status, 'healthy');
    assert.strictEqual(output.workspace_active[0].phase_matches_execution, true);
    assert.deepStrictEqual(output.workspace_active[0].tracked_plan, {
      plan_id: '155-01',
      wave: '1',
      files_modified: ['src/example.js'],
    });
    assert.ok(Array.isArray(output.workspace_active[0].diagnostics.evidence), 'workspace diagnostics should be included');
    assert.strictEqual(output.workspace_active[0].worktree_active, undefined, 'legacy worktree fields should stay absent');
  });

  test('executor-scoped init context keeps workspace metadata and excludes legacy worktree keys', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const addResult = runGsdToolsInRepo('workspace add 155-01', tmpDir);
    assert.ok(addResult.success, `workspace add failed: ${addResult.error}`);

    const result = runGsdToolsInRepo('init:execute-phase 155 --agent=bgsd-executor --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output._agent, 'bgsd-executor');
    assert.ok(Array.isArray(output.workspace_active), 'executor context should keep workspace_active');
    assert.strictEqual(output.workspace_active[0].plan_id, '155-01');
    assert.ok(output.workspace_active[0].tracked_plan, 'executor context should include per-plan workspace metadata');
    assert.strictEqual(output.worktree_active, undefined, 'legacy worktree_active should be absent');
    assert.strictEqual(output.worktree_config, undefined, 'legacy worktree_config should be absent');
  });

  test('legacy worktree config is rejected explicitly', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    writeExecuteFixture();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      worktree: { enabled: true },
    }, null, 2));
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 155 --verbose', tmpDir);
    assert.ok(!result.success, 'legacy worktree config should be rejected');
    assert.match(result.error, /config\.json\.worktree/);
    assert.match(result.error, /config\.json\.workspace/);
  });

  test('init execute-phase preserves plan inventory after snapshot-backed discovery', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), '# Summary 1');
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.plans, ['03-01-PLAN.md', '03-02-PLAN.md']);
    assert.deepStrictEqual(output.summaries, ['03-01-SUMMARY.md']);
    assert.deepStrictEqual(output.incomplete_plans, ['03-02-PLAN.md']);
    assert.strictEqual(output.plan_count, 2);
    assert.strictEqual(output.incomplete_count, 1);
  });

  test('init execute-phase exposes additive runtime freshness metadata for downstream verify flows', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const phaseDirName = '165-jj-execution-repo-local-verification';
    const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
    fs.mkdirSync(path.join(tmpDir, 'src', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'bin'), { recursive: true });
    fs.mkdirSync(phaseDir, { recursive: true });

    const sourcePath = path.join(tmpDir, 'src', 'commands', 'verify.js');
    const artifactPath = path.join(tmpDir, 'bin', 'bgsd-tools.cjs');
    fs.writeFileSync(sourcePath, '// verify command source\n');
    fs.writeFileSync(artifactPath, '// bundled runtime\n');
    const oldDate = new Date('2026-03-30T00:00:00Z');
    const newDate = new Date('2026-03-30T01:00:00Z');
    fs.utimesSync(artifactPath, oldDate, oldDate);
    fs.utimesSync(sourcePath, newDate, newDate);

    fs.writeFileSync(path.join(phaseDir, '165-02-PLAN.md'), `---\nphase: ${phaseDirName}\nplan: 02\nwave: 1\nautonomous: true\ndepends_on: []\nfiles_modified:\n  - src/commands/verify.js\nrequirements:\n  - EXEC-03\n---\n\n# Plan\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n### Phase 165: JJ Execution & Repo-Local Verification\n**Goal:** Runtime truth\n**Plans:** 1 plans\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** 165\n**Current Plan:** 02\n**Total Plans in Phase:** 1\n**Status:** Ready to execute\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ mode: 'yolo' }, null, 2));

    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 165 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.runtime_freshness, 'runtime freshness metadata should be present');
    assert.strictEqual(output.runtime_freshness.stale_sources, true, 'stale sources should be surfaced for downstream flows');
    assert.strictEqual(output.runtime_freshness.stale_runtime, true, 'stale runtime should be surfaced for downstream flows');
    assert.strictEqual(output.runtime_freshness.build_command, 'npm run build');
    assert.ok(output.runtime_freshness.artifacts.some((entry) => entry.path === 'bin/bgsd-tools.cjs' && entry.stale), 'CLI runtime artifact should be marked stale');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init:plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init plan-phase includes effective_intent and capability-only JJ planning context', () => {
    writePlanningIntentFixture();

    const result = runGsdTools('init:plan-phase 157 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.effective_intent.advisory, true);
    assert.strictEqual(output.effective_intent.metadata.partial, false);
    assert.strictEqual(output.effective_intent.phase.purpose, 'Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.');
    assert.strictEqual(output.jj_planning_context.advisory, true);
    assert.strictEqual(output.jj_planning_context.metadata.capability_only, true);
    assert.strictEqual(output.jj_planning_context.metadata.excludes_live_inventory, true);
    assert.strictEqual(output.jj_planning_context.metadata.automatic_routing, false);
    assert.strictEqual(output.jj_planning_context.workspace.base_path, '/tmp/planning-workspaces');
    assert.strictEqual(output.jj_planning_context.workspace.max_concurrent, 4);
    assert.match(output.jj_planning_context.sibling_work_advisory, /low-overlap sibling work/i);
    assert.strictEqual(output.jj_planning_context.workspace_active, undefined, 'planning context should not embed live workspace inventory');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init:progress --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init:phase-op 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init phase-op preserves roadmap-only fallback via snapshot metadata', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 4: Roadmap Only
**Goal:** Future work
**Requirements:** FLOW-99
`);

    const result = runGsdTools('init:phase-op 04 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.strictEqual(output.phase_number, '04');
    assert.strictEqual(output.phase_name, 'Roadmap Only');
    assert.strictEqual(output.phase_dir, null);
    assert.strictEqual(output.has_plans, false);
  });

  test('init new-milestone exposes compact effective intent and JJ planning capability context', () => {
    writePlanningIntentFixture();

    const result = runGsdTools('init:new-milestone --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.effective_intent.advisory, true);
    assert.strictEqual(output.effective_intent.phase, null, 'milestone init should stay phase-agnostic');
    assert.strictEqual(output.jj_planning_context.jj_required_for_execution, true);
    assert.strictEqual(output.jj_planning_context.workspace_backed_parallelism, true);
    assert.strictEqual(output.jj_planning_context.recovery_supported, true);
    assert.match(output.jj_planning_context.sibling_work_advisory, /planning and roadmapping may prefer/i);
  });

  test('init new-milestone creates a frozen lesson snapshot with inspectable remediation buckets', () => {
    writePlanningIntentFixture();
    const lessonsDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(lessonsDir, { recursive: true });
    const sourceLessons = [
      {
        id: 'lesson-jj-1',
        date: '2026-03-30T00:00:00Z',
        title: 'JJ workspace commit retries drift into sibling changes',
        severity: 'HIGH',
        type: 'workflow',
        root_cause: 'JJ workspace commit flow reused live dirty state.',
        prevention_rule: 'Use one JJ-safe commit path for dirty workspaces.',
        affected_agents: ['bgsd-executor'],
      },
      {
        id: 'lesson-verify-1',
        date: '2026-03-30T00:01:00Z',
        title: 'Verification helper missed must_haves coverage',
        severity: 'MEDIUM',
        type: 'tooling',
        root_cause: 'must_haves parsing drifted from current plan schema.',
        prevention_rule: 'Add regression coverage for verification helper extraction.',
        affected_agents: ['bgsd-verifier'],
      },
    ];
    const lessonsJson = JSON.stringify(sourceLessons, null, 2);
    fs.writeFileSync(path.join(lessonsDir, 'lessons.json'), lessonsJson, 'utf-8');

    const result = runGsdTools('init:new-milestone --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.lesson_snapshot_path, 'snapshot path should be exposed');
    assert.strictEqual(output.lesson_snapshot_lesson_count, 2, 'snapshot should record source lesson count');
    assert.ok(Array.isArray(output.remediation_buckets), 'remediation buckets should be exposed');
    assert.ok(output.remediation_buckets.every(bucket => Array.isArray(bucket.lesson_ids)), 'each bucket should expose exact lesson IDs');
    assert.strictEqual(output.remediation_summary.inspect_path, output.lesson_snapshot_path, 'summary should surface the frozen artifact path for inspection');

    const snapshotPath = path.join(tmpDir, output.lesson_snapshot_path);
    assert.ok(fs.existsSync(snapshotPath), 'snapshot artifact should exist on disk');

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    assert.strictEqual(snapshot.compact_summary.inspect_path, output.lesson_snapshot_path, 'snapshot should persist the inspect path');
    assert.strictEqual(snapshot.source.path, '.planning/memory/lessons.json');
    assert.strictEqual(snapshot.source.lesson_count, 2);
    assert.ok(typeof snapshot.source.source_hash === 'string' && snapshot.source.source_hash.length > 0, 'snapshot should store source hash');
    assert.ok(snapshot.buckets.some(bucket => bucket.lesson_ids.includes('lesson-jj-1')), 'JJ lesson should appear in a bucket');
    assert.ok(snapshot.buckets.some(bucket => bucket.lesson_ids.includes('lesson-verify-1')), 'verification lesson should appear in a bucket');
    assert.strictEqual(fs.readFileSync(path.join(lessonsDir, 'lessons.json'), 'utf-8'), lessonsJson, 'init:new-milestone must not rewrite canonical lessons.json');
  });

  test('init new-milestone reuses frozen snapshot instead of drifting with later lesson captures', () => {
    writePlanningIntentFixture();
    const lessonsDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(lessonsDir, { recursive: true });
    fs.writeFileSync(path.join(lessonsDir, 'lessons.json'), JSON.stringify([
      {
        id: 'lesson-foundation-1',
        date: '2026-03-30T00:00:00Z',
        title: 'Freeze lesson scope at milestone start',
        severity: 'MEDIUM',
        type: 'workflow',
        root_cause: 'Planning kept reading a moving live lesson list.',
        prevention_rule: 'Create one frozen milestone snapshot first.',
        affected_agents: ['bgsd-roadmapper'],
      },
    ], null, 2), 'utf-8');

    const first = JSON.parse(runGsdTools('init:new-milestone --verbose', tmpDir).output);
    const snapshotPath = path.join(tmpDir, first.lesson_snapshot_path);
    const firstSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

    fs.writeFileSync(path.join(lessonsDir, 'lessons.json'), JSON.stringify([
      {
        id: 'lesson-foundation-1',
        date: '2026-03-30T00:00:00Z',
        title: 'Freeze lesson scope at milestone start',
        severity: 'MEDIUM',
        type: 'workflow',
        root_cause: 'Planning kept reading a moving live lesson list.',
        prevention_rule: 'Create one frozen milestone snapshot first.',
        affected_agents: ['bgsd-roadmapper'],
      },
      {
        id: 'late-lesson-should-not-appear',
        date: '2026-03-30T02:00:00Z',
        title: 'Late lesson after milestone start',
        severity: 'LOW',
        type: 'tooling',
        root_cause: 'This lesson arrived after the frozen baseline.',
        prevention_rule: 'Do not let later lessons silently alter milestone scope.',
        affected_agents: ['bgsd-planner'],
      },
    ], null, 2), 'utf-8');

    const secondResult = runGsdTools('init:new-milestone --verbose', tmpDir);
    assert.ok(secondResult.success, `Command failed: ${secondResult.error}`);
    const second = JSON.parse(secondResult.output);
    const secondSnapshot = JSON.parse(fs.readFileSync(path.join(tmpDir, second.lesson_snapshot_path), 'utf-8'));

    assert.strictEqual(second.lesson_snapshot_lesson_count, 1, 'reused snapshot should keep original lesson count');
    assert.strictEqual(second.remediation_summary.inspect_path, second.lesson_snapshot_path, 'reused summary should keep the inspect path');
    assert.deepStrictEqual(secondSnapshot.lessons.map(lesson => lesson.id), ['lesson-foundation-1'], 'reused snapshot should ignore later live lessons');
    assert.deepStrictEqual(secondSnapshot, firstSnapshot, 'snapshot artifact should be reused as-is once frozen');
  });

  test('init verify-work exposes additive effective intent and capability-only JJ planning context', () => {
    writePlanningIntentFixture();

    const result = runGsdTools('init:verify-work 157 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.effective_intent.advisory, true);
    assert.strictEqual(output.effective_intent.metadata.phase, '157');
    assert.strictEqual(output.jj_planning_context.execution_backend, 'jj-workspace');
    assert.deepStrictEqual(output.jj_planning_context.workspace.config_keys, ['workspace.base_path', 'workspace.max_concurrent']);
    assert.strictEqual(output.jj_planning_context.metadata.excludes_live_inventory, true);
    assert.strictEqual(output.jj_planning_context.workspace_active, undefined, 'verify-work context should stay capability-only');
  });

  test('init verify-work keeps the real Phase 160 legacy context aligned with source fallback behavior', () => {
    writeRealLegacyPhase160Fixture();

    const result = runGsdTools('init:verify-work 160 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const sourceEffectiveIntent = getEffectiveIntent(tmpDir, { phase: '160' });

    assert.strictEqual(output.phase_dir, '.planning/phases/160-phase-intent-alignment-verification');
    assert.deepStrictEqual(output.effective_intent, sourceEffectiveIntent, 'rebuilt verify-work output should stay aligned with source effective_intent on the real legacy context');
    assert.strictEqual(output.effective_intent.phase, null, 'legacy Phase 160 should not gain guessed phase-local intent');
    assert.strictEqual(output.effective_intent.metadata.partial, true, 'legacy Phase 160 should remain partial');
    assert.ok(output.effective_intent.metadata.missing_layers.includes('phase'), 'phase layer should stay missing for the legacy fallback');
    assert.ok(output.effective_intent.warnings.some((warning) => /missing an explicit `Phase Intent` block/i.test(warning)), 'verify-work should explain the explicit no-guess fallback');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init:plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });

  test('init plan-phase normalizes legacy TDD metadata and rewrites plan files on read', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**TDD:** yes\n`);
    const planPath = path.join(phaseDir, '03-01-PLAN.md');
    fs.writeFileSync(planPath, `---\nphase: 03-api\nplan: 01\ntdd: true\ntdd_rationale: Legacy metadata said this plan should use TDD.\n---\n\n<objective>\nBuild API behavior\n</objective>\n\n<tasks>\n<task type="auto">\n  <name>Fixture task</name>\n  <files>src/api.js</files>\n  <action>Implement fixture behavior</action>\n  <done>Fixture done</done>\n</task>\n</tasks>\n`);

    const result = runGsdTools('init:plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.tdd, 'recommended', 'legacy roadmap hint should normalize for init output');

    const rewrittenPlan = fs.readFileSync(planPath, 'utf-8');
    assert.ok(rewrittenPlan.includes('type: tdd'), 'legacy plan metadata should normalize to canonical plan type');
    assert.ok(rewrittenPlan.includes('> **TDD Decision:** Selected — Legacy metadata said this plan should use TDD.'), 'plan should gain canonical visible TDD decision callout');
    assert.ok(!rewrittenPlan.includes('\ntdd: true\n'), 'legacy tdd frontmatter should be removed');
    assert.ok(!rewrittenPlan.includes('tdd_rationale:'), 'legacy rationale frontmatter should be removed');
  });

  // --compact flag tests

  test('init commands return full output with --verbose', () => {
    const result = runGsdTools('init:progress --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Full output must have model names, static paths, existence booleans
    assert.ok('state_path' in output, 'full output has state_path');
    assert.ok('roadmap_path' in output, 'full output has roadmap_path');
    assert.ok('project_path' in output, 'full output has project_path');
    assert.ok('config_path' in output, 'full output has config_path');
    assert.ok('state_exists' in output, 'full output has state_exists');
    assert.ok('roadmap_exists' in output, 'full output has roadmap_exists');
    assert.ok('executor_model' in output, 'full output has executor_model');
    assert.ok('planner_model' in output, 'full output has planner_model');
    assert.ok('commit_docs' in output, 'full output has commit_docs');
  });

  test('init progress --compact returns essential-only fields', () => {
    const result = runGsdTools('init:progress --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Must have essential keys
    assert.ok('milestone_version' in output, 'compact has milestone_version');
    assert.ok('phases' in output, 'compact has phases');
    assert.ok('phase_count' in output, 'compact has phase_count');
    assert.ok('completed_count' in output, 'compact has completed_count');
    assert.ok('current_phase' in output, 'compact has current_phase');
    assert.ok('session_diff' in output, 'compact has session_diff');

    // Must NOT have dropped keys
    assert.strictEqual(output.executor_model, undefined, 'compact drops executor_model');
    assert.strictEqual(output.planner_model, undefined, 'compact drops planner_model');
    assert.strictEqual(output.state_path, undefined, 'compact drops state_path');
    assert.strictEqual(output.roadmap_path, undefined, 'compact drops roadmap_path');
    assert.strictEqual(output.commit_docs, undefined, 'compact drops commit_docs');
    assert.strictEqual(output.state_exists, undefined, 'compact drops state_exists');
    assert.strictEqual(output.project_path, undefined, 'compact drops project_path');
  });

  test('compact default reduces init output size by at least 38% vs --verbose', () => {
    // Set up phase dir for commands that need one
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const commands = [
      'init:progress',
      'init:execute-phase 03',
      'init:plan-phase 03',
      'init:new-project',
      'init:new-milestone',
      'init:resume',
      'init:verify-work 03',
      'init:phase-op 03',
      'init:milestone-op',
      'init:map-codebase',
      'init:quick "test task"',
      'init:todos',
    ];

    const reductions = [];
    for (const cmd of commands) {
      const full = runGsdTools(`${cmd} --verbose`, tmpDir);
      const compact = runGsdTools(`${cmd}`, tmpDir);
      if (!full.success || !compact.success) continue;

      const fullSize = Buffer.byteLength(full.output, 'utf8');
      const compactSize = Buffer.byteLength(compact.output, 'utf8');
      if (fullSize === 0) continue;
      const reduction = (1 - compactSize / fullSize) * 100;
      reductions.push({ cmd, reduction, fullSize, compactSize });
    }

    const avgReduction = reductions.reduce((sum, r) => sum + r.reduction, 0) / reductions.length;
    assert.ok(
      avgReduction >= 38,
      `Average reduction across all ${reductions.length} commands: expected >=38%, got ${avgReduction.toFixed(1)}%`
    );
  });

  test('--compact and --fields can be used together', () => {
    const result = runGsdTools('init:progress --compact --fields milestone_version,phase_count', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const keys = Object.keys(output);
    assert.strictEqual(keys.length, 2, `expected 2 fields, got ${keys.length}: ${keys.join(', ')}`);
    assert.ok('milestone_version' in output, 'has milestone_version');
    assert.ok('phase_count' in output, 'has phase_count');
  });

  test('all init commands accept --compact without error', () => {
    // Set up phase dir for commands that need one
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const commands = [
      'init:progress',
      'init:execute-phase 03',
      'init:plan-phase 03',
      'init:new-project',
      'init:new-milestone',
      'init:resume',
      'init:verify-work 03',
      'init:phase-op 03',
      'init:milestone-op',
      'init:map-codebase',
      'init:quick "test task"',
      'init:todos',
    ];

    for (const cmd of commands) {
      const result = runGsdTools(`${cmd} --compact`, tmpDir);
      assert.ok(result.success, `${cmd} --compact failed: ${result.error}`);

      // Verify it returns valid JSON
      let parsed;
      try {
        parsed = JSON.parse(result.output);
      } catch (e) {
        assert.fail(`${cmd} --compact did not return valid JSON: ${result.output.substring(0, 100)}`);
      }
      assert.ok(typeof parsed === 'object' && parsed !== null, `${cmd} --compact returned non-object`);
    }
  });

  // --compact manifest tests

  test('compact --manifest output includes _manifest with files array', () => {
    const result = runGsdTools('init:progress --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('_manifest' in output, 'compact --manifest has _manifest');
    assert.ok(Array.isArray(output._manifest.files), '_manifest.files is array');
    for (const entry of output._manifest.files) {
      assert.ok(typeof entry.path === 'string', 'manifest entry has path string');
      assert.ok(typeof entry.required === 'boolean', 'manifest entry has required boolean');
    }
  });

  test('plan-phase --manifest includes requirements and state', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init:plan-phase 07 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');
    assert.ok(manifest.files.length >= 3, `expected >=3 files in manifest, got ${manifest.files.length}`);

    const paths = manifest.files.map(f => f.path);
    assert.ok(paths.some(p => p.includes('STATE.md')), 'manifest includes STATE.md');
    assert.ok(paths.some(p => p.includes('ROADMAP.md')), 'manifest includes ROADMAP.md');
    assert.ok(paths.some(p => p.includes('REQUIREMENTS.md')), 'manifest includes REQUIREMENTS.md');

    // Check STATE.md has sections
    const stateEntry = manifest.files.find(f => f.path.includes('STATE.md'));
    assert.ok(stateEntry.sections, 'STATE.md entry has sections');
    assert.ok(stateEntry.sections.includes('Current Position'), 'STATE.md has Current Position section');
    assert.ok(stateEntry.sections.includes('Accumulated Context'), 'STATE.md has Accumulated Context section');
  });

  test('execute-phase --manifest includes plan files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '06-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '06-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '06-02-PLAN.md'), '# Plan 2');
    // Create STATE.md and ROADMAP.md so they appear in manifest
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\nPhase: 6');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Phase 6\nTest');
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const result = runGsdToolsInRepo('init:execute-phase 06 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');

    const paths = manifest.files.map(f => f.path);
    assert.ok(paths.some(p => p.includes('06-01-PLAN.md')), 'manifest includes 06-01-PLAN.md');
    assert.ok(paths.some(p => p.includes('06-02-PLAN.md')), 'manifest includes 06-02-PLAN.md');
    assert.ok(paths.some(p => p.includes('STATE.md')), 'manifest includes STATE.md');
    assert.ok(paths.some(p => p.includes('ROADMAP.md')), 'manifest includes ROADMAP.md');
  });

  test('verify-work --manifest includes summary files from snapshot artifacts', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '06-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '06-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '06-01-SUMMARY.md'), '# Summary 1');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 6\nTest');

    const result = runGsdTools('init:verify-work 06 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const paths = output._manifest.files.map(f => f.path);
    assert.ok(paths.includes('.planning/phases/06-test/06-01-PLAN.md'), 'manifest includes plan file');
    assert.ok(paths.includes('.planning/phases/06-test/06-01-SUMMARY.md'), 'manifest includes summary file');
  });

  test('--manifest only references files that exist', () => {
    // Phase 07 with no context/research files
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-bare');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init:plan-phase 07 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');

    const paths = manifest.files.map(f => f.path);
    // No context/research files exist, so they should not appear
    assert.ok(!paths.some(p => p.includes('CONTEXT.md')), 'manifest does not include CONTEXT.md');
    assert.ok(!paths.some(p => p.includes('RESEARCH.md')), 'manifest does not include RESEARCH.md');
  });

  test('non-compact output does not include _manifest', () => {
    const result = runGsdTools('init:progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output._manifest, undefined, 'non-compact has no _manifest');
  });

  test('--compact without --manifest excludes _manifest', () => {
    const result = runGsdTools('init:progress --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output._manifest, undefined, 'compact-only has no _manifest');
  });

  test('--compact --manifest includes manifest and returns valid output for all commands', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');

    const allCommands = [
      'init:progress',
      'init:execute-phase 03',
      'init:plan-phase 03',
      'init:new-project',
      'init:new-milestone',
      'init:resume',
      'init:verify-work 03',
      'init:phase-op 03',
      'init:milestone-op',
      'init:map-codebase',
      'init:quick "test task"',
      'init:todos',
    ];

    for (const cmd of allCommands) {
      const result = runGsdTools(`${cmd} --compact --manifest`, tmpDir);
      if (!result.success) continue;
      const output = JSON.parse(result.output);
      // All should have _manifest when --manifest flag is used
      assert.ok('_manifest' in output, `${cmd} missing _manifest with --manifest flag`);
      assert.ok(Array.isArray(output._manifest.files), `${cmd} _manifest.files is not array`);
    }
  });

  test('init resume summary exposes exact resume inspect restart contract', () => {
    writeCurrentPhaseState();
    writePhaseFixture();
    let result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `handoff write failed: ${result.error}`);

    result = runGsdTools('init:resume --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'resume summary should be present when handoff artifacts exist');
    assert.strictEqual(output.resume_summary.latest_valid_step, 'plan');
    assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-execute-phase 152');
    assert.deepStrictEqual(
      output.resume_summary.options.map((option) => option.id),
      ['resume', 'inspect', 'restart'],
      'resume summary should expose the exact option contract'
    );
    assert.strictEqual(
      output.resume_summary.expected_fingerprint,
      output.resume_summary.inspection.latest_valid_artifact.source_fingerprint,
      'resume summary should expose the current expected fingerprint'
    );
    assert.strictEqual(output.resume_summary.inspection.produced_artifacts.length, 1, 'inspection should list produced artifacts');
  });

  test('init execute-phase resume summary fingerprint stays valid when canonical phase inputs are unchanged', () => {
    writeCurrentPhaseState();
    writePhaseFixture();
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const writeResult = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(writeResult.success, `handoff write failed: ${writeResult.error}`);

    const result = runGsdToolsInRepo('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'resume summary should be present');
    assert.strictEqual(output.resume_summary.valid, true, 'unchanged canonical inputs should stay resumable');
    assert.strictEqual(output.resume_summary.stale_sources, false, 'unchanged canonical inputs should not look stale');
    assert.strictEqual(
      output.resume_summary.expected_fingerprint,
      output.resume_summary.inspection.latest_valid_artifact.source_fingerprint,
      'expected fingerprint should match the stored handoff fingerprint when sources are unchanged'
    );
  });

  test('init execute-phase resume summary blocks stale source changes at the real entrypoint', () => {
    writeCurrentPhaseState();
    writePhaseFixture();
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    let result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `handoff write failed: ${result.error}`);

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '152-cached-handoffs-fresh-context-delivery');
    fs.writeFileSync(path.join(phaseDir, '152-03-PLAN.md'), '# Plan changed\nmeaningful runtime drift\n');

    result = runGsdToolsInRepo('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'resume summary should be present');
    assert.strictEqual(output.resume_summary.valid, false, 'meaningful canonical input changes should block resume');
    assert.strictEqual(output.resume_summary.stale_sources, true, 'meaningful canonical input changes should be reported as stale');
    assert.strictEqual(output.resume_summary.latest_valid_step, 'plan', 'latest valid step should still be surfaced');
    assert.strictEqual(output.resume_summary.repair_guidance.action, 'repair', 'repair guidance should be preserved');
  });

  test('init execute-phase resume summary falls back to latest valid artifact when newest is corrupt', () => {
    writeCurrentPhaseState();
    writePhaseFixture();
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    let result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Discuss done"', tmpDir);
    assert.ok(result.success, `discuss write failed: ${result.error}`);
    result = runGsdTools('verify:state handoff write --phase 152 --step research --summary "Research done"', tmpDir);
    assert.ok(result.success, `research write failed: ${result.error}`);

    const corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'plan.json');
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, '{bad json\n', 'utf-8');

    result = runGsdToolsInRepo('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'resume summary should be present');
    assert.strictEqual(output.resume_summary.latest_valid_step, 'research', 'should target the latest valid artifact');
    assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-plan phase 152');
    assert.strictEqual(output.resume_summary.inspection.invalid_artifacts.length, 1, 'corrupt artifact should remain inspectable');
    assert.ok(
      output.resume_summary.inspection.invalid_artifacts[0].file.endsWith('plan.json'),
      'invalid artifact should report the corrupt latest file'
    );
  });

  test('init execute-phase resume summary surfaces preserved TDD proof metadata when handoff context carries it', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 154 — End-to-End Fresh-Context Proof Delivery
**Current Plan:** 01
**Total Plans in Phase:** 1
**Status:** Ready to execute
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 154: End-to-End Fresh-Context Proof Delivery
**Goal:** Preserve TDD proof through the full fresh-context chain.
**Plans:** 1 plans
`);

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '154-end-to-end-fresh-context-proof-delivery');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '154-01-PLAN.md'), `---
phase: 154-end-to-end-fresh-context-proof-delivery
plan: 01
type: tdd
wave: 1
autonomous: true
depends_on: []
files_modified:
  - src/sum.js
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Resume proof delivery.
</objective>
`);
    fs.writeFileSync(path.join(phaseDir, '154-01-TDD-AUDIT.json'), JSON.stringify({
      phases: {
        red: { target_command: 'node --test tests/sum.test.cjs', exit_code: 1 },
        green: { target_command: 'node --test tests/sum.test.cjs', exit_code: 0 },
        refactor: { target_command: 'node --test tests/sum.test.cjs', exit_code: 0 },
      },
    }, null, 2));
    initGitRepo(tmpDir);
    initJjRepo(tmpDir);

    const writeResult = runGsdTools('verify:state handoff write --phase 154 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(writeResult.success, `handoff write failed: ${writeResult.error}`);

    const result = runGsdToolsInRepo('init:execute-phase 154 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'resume summary should be present');
    assert.ok(Array.isArray(output.resume_summary.inspection.latest_valid_artifact.tdd_audits), 'latest valid artifact should expose preserved TDD audits');
    assert.strictEqual(output.resume_summary.inspection.latest_valid_artifact.tdd_audits.length, 1, 'latest valid artifact should surface one preserved audit');
    assert.ok(output.resume_summary.inspection.latest_valid_artifact.tdd_audits[0].path.endsWith('154-01-TDD-AUDIT.json'), 'latest valid artifact should expose the canonical audit path');
    assert.deepStrictEqual(output.resume_summary.inspection.latest_valid_artifact.tdd_audits[0].stages, ['red', 'green', 'refactor'], 'latest valid artifact should expose deterministic stage coverage');
    assert.ok(Array.isArray(output.resume_summary.inspection.produced_artifacts[0].tdd_audits), 'produced artifacts should also expose preserved TDD audits');
    assert.ok(output.resume_summary.inspection.produced_artifacts[0].tdd_audits[0].path.endsWith('154-01-TDD-AUDIT.json'), 'produced artifact proof metadata should include the canonical audit path');
  });

  test('init resume summary keeps inspect and restart guidance when handoff validation fails', () => {
    writeCurrentPhaseState();
    const corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'execute.json');
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, '{bad json\n', 'utf-8');

    const result = runGsdTools('init:resume --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.resume_summary, 'invalid handoff set should still surface a resume summary');
    assert.strictEqual(output.resume_summary.valid, false, 'invalid handoff set should block resume');
    assert.strictEqual(output.resume_summary.repair_guidance.action, 'repair');
    assert.deepStrictEqual(
      output.resume_summary.options.map((option) => option.id),
      ['resume', 'inspect', 'restart'],
      'inspect and restart guidance should remain available'
    );
    assert.match(output.resume_summary.repair_guidance.commands[0], /verify:state handoff clear --phase 152/);
  });
});

describe('session-summary command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns valid JSON with all required fields when STATE.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** 03
**Status:** Executing
**Last Activity:** 2026-02-25

Progress: [██████████] 100% (5/5 phases)

## Accumulated Context

### Decisions

v4.0 decisions:
- [Phase 21]: Worktree config read directly from config.json

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 21-03-PLAN.md
Resume file: None
`);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('execute:session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Check all 4 top-level fields exist
    assert.ok(data.current_position, 'should have current_position');
    assert.ok(data.session_activity, 'should have session_activity');
    assert.ok(data.next_action, 'should have next_action');
    assert.ok(data.session_continuity, 'should have session_continuity');

    // Check position details
    assert.strictEqual(data.current_position.phase, '21 of 22');
    assert.strictEqual(data.current_position.phase_name, 'Worktree Parallelism');
    assert.strictEqual(data.current_position.plan, '03');
    assert.strictEqual(data.current_position.status, 'Executing');
  });

  test('returns error JSON when STATE.md is missing', () => {
    // Don't create STATE.md — just use the empty temp project
    const result = runGsdTools('execute:session-summary', tmpDir);
    assert.ok(result.success, `Command should succeed even without STATE.md: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.error, 'should have error field');
    assert.ok(data.error.includes('not found'), 'error should mention not found');
  });

  test('correctly identifies next action when current phase is complete', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-02-25

## Accumulated Context

### Decisions

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed phase 21
Resume file: None
`);

    // Create phase 22 directory with a plan
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish', '22-01-PLAN.md'), '# Plan');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('execute:session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Should suggest executing phase 22 (has plans, not yet complete)
    assert.ok(data.next_action.command.includes('22'), `next action should reference phase 22, got: ${data.next_action.command}`);
    assert.ok(data.next_action.command.includes('execute'), `should suggest execute since plans exist, got: ${data.next_action.command}`);
  });

  test('suggests plan-phase when next phase has no plans', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-02-25

## Accumulated Context

### Decisions

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed phase 21
Resume file: None
`);

    // Phase 22 dir exists but has no plans
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('execute:session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Should suggest planning phase 22 (no plans yet)
    assert.ok(data.next_action.command.includes('22'), `next action should reference phase 22, got: ${data.next_action.command}`);
    assert.ok(data.next_action.command.includes('plan'), `should suggest plan since no plans exist, got: ${data.next_action.command}`);
  });
});
