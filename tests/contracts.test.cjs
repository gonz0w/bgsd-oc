/**
 * bgsd-tools contracts tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, snapshotCompare, contractCheck, hasJj, initJjRepo } = require('./helpers.cjs');

function writeRealLegacyPhase160Fixture(tmpDir) {
  const repoRoot = path.join(__dirname, '..');
  const sourcePlanningDir = path.join(repoRoot, '.planning');
  const legacyPhaseDir = '160-phase-intent-alignment-verification';

  fs.cpSync(path.join(sourcePlanningDir, 'INTENT.md'), path.join(tmpDir, '.planning', 'INTENT.md'));
  fs.cpSync(path.join(sourcePlanningDir, 'MILESTONE-INTENT.md'), path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md'));
  fs.cpSync(path.join(sourcePlanningDir, 'ROADMAP.md'), path.join(tmpDir, '.planning', 'ROADMAP.md'));
  fs.cpSync(
    path.join(sourcePlanningDir, 'phases', legacyPhaseDir),
    path.join(tmpDir, '.planning', 'phases', legacyPhaseDir),
    { recursive: true }
  );

  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 160
**Current Plan:** 02
**Status:** Ready
`, 'utf-8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }, null, 2));
}

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

  test('init execute-phase has required fields', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initJjRepo(tmpDir);
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

describe('contract: init verify-work fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Phase 1\nTest\n`);
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init verify-work has required fields', () => {
    const result = runGsdTools('init:verify-work 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
      { key: 'phase_number', type: 'string' },
      { key: 'phase_name', type: 'string' },
      { key: 'has_verification', type: 'boolean' },
      { key: 'commit_docs', type: 'boolean' },
    ], 'init-verify-work');
    assert.ok(contract.pass, contract.message);
  });
});

describe('contract: phase 157 planning init context is additive', () => {
  let tmpDir;

  function writePlanningContextFixture() {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '157-planning-context-cascade');
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

- 🔵 **v17.0 Test Milestone** — Phases 157-157 (active)

## Phases

### Phase 157: Planning Context Cascade
**Goal**: Layer milestone and phase intent
**Plans:** 1 plan
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 157
**Current Plan:** 01
**Status:** Ready
`, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      workspace: { base_path: '/tmp/planning-workspaces', max_concurrent: 4 },
    }, null, 2));
    fs.writeFileSync(path.join(phaseDir, '157-01-PLAN.md'), `---
phase: 157-planning-context-cascade
plan: 01
type: execute
---

# Plan
`, 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '157-01-SUMMARY.md'), '# Summary\n', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '157-CONTEXT.md'), `# Phase 157 Context

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

  beforeEach(() => {
    tmpDir = createTempProject();
    writePlanningContextFixture();
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init plan-phase exposes new additive planning fields', () => {
    const result = runGsdTools('init:plan-phase 157 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'effective_intent', type: 'object' },
      { key: 'jj_planning_context', type: 'object' },
    ], 'init-plan-phase-phase-157-additive');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(actual.effective_intent.metadata.partial, false);
    assert.strictEqual(actual.jj_planning_context.metadata.capability_only, true);
    assert.strictEqual(actual.jj_planning_context.metadata.automatic_routing, false);
    assert.ok(!('workspace_active' in actual.jj_planning_context), 'JJ planning context should stay capability-only');
  });

  test('init verify-work exposes new additive verification fields', () => {
    const result = runGsdTools('init:verify-work 157 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'effective_intent', type: 'object' },
      { key: 'jj_planning_context', type: 'object' },
    ], 'init-verify-work-phase-157-additive');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(actual.effective_intent.metadata.phase, '157');
    assert.strictEqual(actual.jj_planning_context.metadata.excludes_live_inventory, true);
  });

  test('init new-milestone keeps new planning fields additive', () => {
    const result = runGsdTools('init:new-milestone --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'current_milestone', type: 'string' },
      { key: 'effective_intent', type: 'object' },
      { key: 'jj_planning_context', type: 'object' },
    ], 'init-new-milestone-phase-157-additive');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(actual.effective_intent.phase, null);
    assert.match(actual.jj_planning_context.sibling_work_advisory, /low-overlap sibling work/i);
  });

  test('planning init fields stay absent rather than breaking callers when intent layers are missing', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md'));
    fs.rmSync(path.join(tmpDir, '.planning', 'INTENT.md'));

    const planPhase = JSON.parse(runGsdTools('init:plan-phase 157', tmpDir).output);
    const verifyWork = JSON.parse(runGsdTools('init:verify-work 157', tmpDir).output);

    assert.strictEqual(planPhase.effective_intent, undefined, 'compact plan-phase output should omit missing effective_intent');
    assert.strictEqual(verifyWork.effective_intent, undefined, 'compact verify-work output should omit missing effective_intent');
    assert.ok(verifyWork.jj_planning_context, 'capability context should still be available without intent layers');
  });
});

describe('contract: real phase 160 legacy intent fallback stays additive', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRealLegacyPhase160Fixture(tmpDir);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init verify-work keeps phase-local intent absent for the real legacy context', () => {
    const result = runGsdTools('init:verify-work 160 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const actual = JSON.parse(result.output);

    assert.strictEqual(actual.effective_intent.phase, null, 'legacy init output should keep phase intent absent');
    assert.strictEqual(actual.effective_intent.metadata.partial, true, 'legacy init output should remain additive/partial');
    assert.ok(actual.effective_intent.metadata.missing_layers.includes('phase'), 'legacy init output should mark the phase layer missing');
    assert.ok(actual.effective_intent.warnings.some((warning) => /missing an explicit `Phase Intent` block/i.test(warning)), 'legacy init output should explain the explicit no-guess fallback');
  });

  test('init verify-work matches plan:intent effective output on the real legacy context', () => {
    const intentResult = runGsdTools('plan:intent show effective 160', tmpDir);
    const verifyResult = runGsdTools('init:verify-work 160 --verbose', tmpDir);
    assert.ok(intentResult.success, `intent show effective failed: ${intentResult.error}`);
    assert.ok(verifyResult.success, `init verify-work failed: ${verifyResult.error}`);

    const intentOutput = JSON.parse(intentResult.output);
    const verifyOutput = JSON.parse(verifyResult.output);

    assert.deepStrictEqual(verifyOutput.effective_intent, intentOutput.effective_intent, 'init verify-work should stay in contract parity with effective intent output for legacy contexts');
  });
});

describe('contract: live repo phase 160 runtime spot checks stay stable', () => {
  test('plan:intent show effective 160 and init:verify-work 160 keep phase intent absent', () => {
    const repoRoot = path.join(__dirname, '..');
    const intentResult = runGsdTools('plan:intent show effective 160', repoRoot);
    const verifyResult = runGsdTools('init:verify-work 160 --verbose', repoRoot);
    assert.ok(intentResult.success, `plan:intent show effective 160 failed: ${intentResult.error}`);
    assert.ok(verifyResult.success, `init:verify-work 160 --verbose failed: ${verifyResult.error}`);

    const intentOutput = JSON.parse(intentResult.output);
    const verifyOutput = JSON.parse(verifyResult.output);

    assert.strictEqual(intentOutput.effective_intent.phase, null, 'live effective intent output should keep phase-local intent absent');
    assert.strictEqual(verifyOutput.effective_intent.phase, null, 'live verify-work output should keep phase-local intent absent');
    assert.deepStrictEqual(verifyOutput.effective_intent, intentOutput.effective_intent, 'both live runtime commands should agree on the legacy fallback contract');
    assert.ok(verifyOutput.effective_intent.warnings.some((warning) => /missing an explicit `Phase Intent` block/i.test(warning)), 'live spot check should keep the explicit no-guess warning');
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

describe('Phase 149 TDD roadmap contract guidance', () => {
  test('roadmap template matches checker severity meanings and Phase 150 boundary', () => {
    const roadmap = fs.readFileSync(path.join(process.cwd(), 'templates', 'roadmap.md'), 'utf-8');

    assert.match(roadmap, /`recommended`[\s\S]*warnings/i);
    assert.match(roadmap, /`required`[\s\S]*blockers/i);
    assert.match(roadmap, /Omit the field[\s\S]*info instead of staying silent/i);
    assert.match(roadmap, /does \*\*not\*\* add Phase 150 `execute:tdd` semantic enforcement/i);
  });
});

describe('Phase 156 workspace config contracts', () => {
  test('shipped config templates publish supported workspace settings only', () => {
    const configTemplate = fs.readFileSync(path.join(process.cwd(), 'templates', 'config.json'), 'utf-8');
    const fullConfigTemplate = fs.readFileSync(path.join(process.cwd(), 'templates', 'config-full.json'), 'utf-8');

    assert.match(configTemplate, /"workspace"\s*:/);
    assert.match(fullConfigTemplate, /"workspace"\s*:/);
    assert.match(configTemplate, /"base_path"\s*:\s*"\/tmp\/gsd-workspaces"/);
    assert.match(fullConfigTemplate, /"max_concurrent"\s*:\s*3/);
    assert.doesNotMatch(configTemplate, /"worktree"\s*:/);
    assert.doesNotMatch(fullConfigTemplate, /"worktree"\s*:/);
  });

  test('runtime schema and migration guidance stay aligned with workspace config', () => {
    const constants = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'constants.js'), 'utf-8');
    const config = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'config.js'), 'utf-8');

    assert.match(constants, /workspace_base_path/);
    assert.match(constants, /Base path for managed JJ execution workspaces/);
    assert.match(constants, /workspace_max_concurrent/);
    assert.match(config, /Legacy `\.planning\/config\.json\.worktree` is no longer supported/);
    assert.match(config, /supported JJ settings like `base_path` and `max_concurrent`/);
  });
});

describe('Phase 158 inspect family contracts', () => {
  test('canonical inspect wrapper keeps the read-only boundary while covering remaining aliases', () => {
    const inspect = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-inspect.md'), 'utf-8');

    assert.match(inspect, /- `impact`/);
    assert.match(inspect, /- `trace`/);
    assert.match(inspect, /- `search decisions`/);
    assert.match(inspect, /- `search lessons`/);
    assert.match(inspect, /- `health`/);
    assert.match(inspect, /- `velocity`/);
    assert.match(inspect, /- `context-budget`/);
    assert.match(inspect, /- `session-diff`/);
    assert.match(inspect, /- `rollback-info`/);
    assert.match(inspect, /- `validate-deps`/);
    assert.match(inspect, /Representative compatibility shims that must stay equivalent to this contract:/);
    assert.match(inspect, /\/bgsd-health` -> `\/bgsd-inspect health`/);
    assert.match(inspect, /Mutating actions and repair flows/);
    assert.match(inspect, /Review, security, readiness, and release families/);
  });

  test('remaining inspect aliases preserve canonical parity through shared workflow contracts', () => {
    const expectations = [
      ['bgsd-health.md', /\/bgsd-inspect health/i, /workflows\/health\.md/],
      ['bgsd-impact.md', /\/bgsd-inspect impact/i, /workflows\/cmd-codebase-impact\.md/],
      ['bgsd-trace.md', /\/bgsd-inspect trace/i, /workflows\/cmd-trace-requirement\.md/],
      ['bgsd-search-decisions.md', /\/bgsd-inspect search decisions/i, /workflows\/cmd-search-decisions\.md/],
      ['bgsd-search-lessons.md', /\/bgsd-inspect search lessons/i, /workflows\/cmd-search-lessons\.md/],
      ['bgsd-velocity.md', /\/bgsd-inspect velocity/i, /workflows\/cmd-velocity\.md/],
      ['bgsd-context-budget.md', /\/bgsd-inspect context-budget/i, /workflows\/cmd-context-budget\.md/],
      ['bgsd-session-diff.md', /\/bgsd-inspect session-diff/i, /workflows\/cmd-session-diff\.md/],
      ['bgsd-rollback-info.md', /\/bgsd-inspect rollback-info/i, /workflows\/cmd-rollback-info\.md/],
      ['bgsd-validate-deps.md', /\/bgsd-inspect validate-deps/i, /workflows\/cmd-validate-deps\.md/]
    ];

    for (const [fileName, canonicalPattern, workflowPattern] of expectations) {
      const commandText = fs.readFileSync(path.join(process.cwd(), 'commands', fileName), 'utf-8');
      assert.match(commandText, /Compatibility alias for `\/bgsd-inspect/i);
      assert.match(commandText, canonicalPattern);
      assert.match(commandText, workflowPattern);
      assert.match(commandText, /Keep this alias read-only and compatibility-focused/i);
    }
  });
});

describe('Phase 158 planning family alias normalization contracts', () => {
  test('roadmap gap and todo aliases stay on one normalized planning-family contract', () => {
    const plan = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-plan.md'), 'utf-8');
    const expectations = [
      ['bgsd-add-phase.md', /\/bgsd-plan roadmap add \$ARGUMENTS/i, /Do not present this alias as the preferred path/i],
      ['bgsd-insert-phase.md', /\/bgsd-plan roadmap insert \$ARGUMENTS/i, /Do not present this alias as the preferred path/i],
      ['bgsd-remove-phase.md', /\/bgsd-plan roadmap remove \$ARGUMENTS/i, /Do not present this alias as the preferred path/i],
      ['bgsd-plan-gaps.md', /\/bgsd-plan gaps \$ARGUMENTS/i, /existing gap-planning entrypoint/i],
      ['bgsd-add-todo.md', /\/bgsd-plan todo add \$ARGUMENTS/i, /plan-scoped/i],
      ['bgsd-check-todos.md', /\/bgsd-plan todo check \$ARGUMENTS/i, /plan-scoped/i]
    ];

    assert.match(plan, /Normalize the first argument onto the existing planning-family workflow contract:/i);
    assert.match(plan, /Legacy planning aliases should resolve through these same normalized sub-actions rather than owning separate behavior\./i);
    assert.match(plan, /Representative compatibility shims that must stay equivalent to this contract:/i);
    assert.doesNotMatch(plan, /preferred alias wording/i, 'canonical contract should not encode legacy-preferred wording');

    for (const [fileName, canonicalPattern, boundaryPattern] of expectations) {
      const commandText = fs.readFileSync(path.join(process.cwd(), 'commands', fileName), 'utf-8');
      assert.match(commandText, /@__OPENCODE_CONFIG__\/bgsd-oc\/commands\/bgsd-plan\.md/);
      assert.match(commandText, canonicalPattern);
      assert.match(commandText, boundaryPattern);
    }
  });
});

describe('Phase 158 settings family reference contracts', () => {
  test('settings command wrappers keep canonical family routing and compatibility alias wording', () => {
    const settings = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-settings.md'), 'utf-8');
    const setProfile = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-set-profile.md'), 'utf-8');
    const validateConfig = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-validate-config.md'), 'utf-8');

    assert.match(settings, /canonical settings-family command/i);
    assert.match(settings, /\/bgsd-set-profile/);
    assert.match(settings, /\/bgsd-validate-config/);
    assert.match(settings, /workflows\/settings\.md/);
    assert.match(settings, /workflows\/set-profile\.md/);
    assert.match(settings, /workflows\/cmd-validate-config\.md/);

    assert.match(setProfile, /Compatibility alias for `\/bgsd-settings profile`/i);
    assert.match(setProfile, /\/bgsd-settings profile \$ARGUMENTS/i);
    assert.match(validateConfig, /Compatibility alias for `\/bgsd-settings validate`/i);
    assert.match(validateConfig, /\/bgsd-settings validate \$ARGUMENTS/i);
  });

  test('command reference advertises canonical families while keeping settings aliases compatibility-only', () => {
    const commandsDoc = fs.readFileSync(path.join(process.cwd(), 'docs', 'commands.md'), 'utf-8');

    assert.match(commandsDoc, /Preferred canonical command families:/);
    assert.match(commandsDoc, /`\/bgsd-plan \.\.\.` for planning, roadmap, gaps, and plan-scoped todo flows/i);
    assert.match(commandsDoc, /`\/bgsd-inspect \.\.\.` for read-only diagnostics and search\/history flows/i);
    assert.match(commandsDoc, /`\/bgsd-settings \.\.\.` for configuration profile switching and config validation/i);
    assert.match(commandsDoc, /`phase`, `discuss`, `research`, and `assumptions` are family labels inside `\/bgsd-plan`/i);
    assert.match(commandsDoc, /Preferred canonical roadmap routes: `\/bgsd-plan roadmap add`/i);
    assert.match(commandsDoc, /Preferred canonical todo routes: `\/bgsd-plan todo add` and `\/bgsd-plan todo check`/i);
  });
});
