/**
 * bgsd-tools contracts tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, snapshotCompare, contractCheck } = require('./helpers.cjs');

describe('contract: init phase-op (full snapshot)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create a complete .planning structure
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Phases

- [ ] Phase 1: Foundation (0/1 plans)
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

Phase: 1 of 1 (Foundation)
Plan: 0 of 1 in current phase
Status: Ready

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      model_profile: 'balanced',
    }));
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Phase 1 Context\n\nTest context.\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---
phase: 01-foundation
plan: 01
type: execute
---

# Test Plan
`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init phase-op output matches snapshot', () => {
    const result = runGsdTools('init:phase-op 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    // Use project-level snapshot directory
    const fixturePath = path.join(__dirname, '..', 'test', '__snapshots__', 'init-phase-op.json');
    const snap = snapshotCompare(actual, fixturePath);
    assert.ok(snap.pass, snap.message);
  });
});

describe('contract: state read (full snapshot)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Test project
**Current focus:** Testing

## Current Position

Phase: 1 of 1 (Foundation)
Plan: 0 of 1 in current phase
Status: Ready
Last activity: 2026-01-01

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0

## Accumulated Context

### Decisions

None yet.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
Resume file: None
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      model_profile: 'balanced',
    }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('state read output matches snapshot', () => {
    const result = runGsdTools('verify:state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const fixturePath = path.join(__dirname, '..', 'test', '__snapshots__', 'state-read.json');
    const snap = snapshotCompare(actual, fixturePath);
    assert.ok(snap.pass, snap.message);
  });
});

describe('contract: init plan-phase fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init plan-phase has required fields', () => {
    const result = runGsdTools('init:plan-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
      { key: 'phase_number', type: 'string' },
      { key: 'phase_name', type: 'string' },
      { key: 'has_research', type: 'boolean' },
      { key: 'has_context', type: 'boolean' },
      { key: 'has_plans', type: 'boolean' },
      { key: 'plan_count', type: 'number' },
      { key: 'research_enabled', type: 'boolean' },
      { key: 'plan_checker_enabled', type: 'boolean' },
    ], 'init-plan-phase');
    assert.ok(contract.pass, contract.message);
  });

  test('adding new field to plan-phase does not break contract', () => {
    const result = runGsdTools('init:plan-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    // Simulate adding a new field
    actual.new_future_field = 'something';

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
    ], 'init-plan-phase-additive');
    assert.ok(contract.pass, 'New fields should not break contract');
  });
});

describe('contract: init new-project fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init new-project has required fields', () => {
    const result = runGsdTools('init:new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'planning_exists', type: 'boolean' },
      { key: 'has_existing_code', type: 'boolean' },
      { key: 'is_brownfield', type: 'boolean' },
      { key: 'project_exists', type: 'boolean' },
      { key: 'has_git', type: 'boolean' },
    ], 'init-new-project');
    assert.ok(contract.pass, contract.message);
  });
});

describe('contract: init execute-phase fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\nPhase: 1\nPlan: 0\nStatus: Ready\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init execute-phase has required fields', () => {
    const result = runGsdTools('init:execute-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
      { key: 'phase_number', type: 'string' },
      { key: 'phase_name', type: 'string' },
      { key: 'plans', type: 'array' },
      { key: 'plan_count', type: 'number' },
    ], 'init-execute-phase');
    assert.ok(contract.pass, contract.message);
  });
});

describe('contract: state read fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

Phase: 1
Plan: 0
Status: Ready

## Accumulated Context

### Decisions

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('state read has required fields', () => {
    const result = runGsdTools('verify:state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'config', type: 'object' },
      { key: 'state_raw', type: 'string' },
      { key: 'state_exists', type: 'boolean' },
      { key: 'roadmap_exists', type: 'boolean' },
      { key: 'config_exists', type: 'boolean' },
    ], 'state-read');
    assert.ok(contract.pass, contract.message);
  });
});

describe('contract: init progress fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestones\n\n- **v1.0 Test** — Phases 1-1\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\nPhase: 1\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init progress has required fields', () => {
    const result = runGsdTools('init:progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phases', type: 'array' },
      { key: 'phase_count', type: 'number' },
      { key: 'completed_count', type: 'number' },
      { key: 'in_progress_count', type: 'number' },
      { key: 'has_work_in_progress', type: 'boolean' },
    ], 'init-progress');
    assert.ok(contract.pass, contract.message);
  });
});

