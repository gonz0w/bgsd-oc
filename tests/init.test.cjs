/**
 * bgsd-tools init tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('init commands', () => {
  let tmpDir;

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

    const result = runGsdTools('init:execute-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
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

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init:plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
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

    const result = runGsdTools('init:execute-phase 06 --compact --manifest', tmpDir);
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

