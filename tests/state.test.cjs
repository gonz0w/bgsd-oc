/**
 * bgsd-tools state tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, STATE_FIXTURE, writeStateFixture, hasJj, initJjRepo } = require('./helpers.cjs');

describe('state-snapshot command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('extracts basic fields from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Current Phase Name:** API Layer
**Total Phases:** 6
**Current Plan:** 03-02
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** 45%
**Last Activity:** 2024-01-15
**Last Activity Description:** Completed 03-01-PLAN.md
`
    );

    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'API Layer', 'phase name extracted');
    assert.strictEqual(output.total_phases, 6, 'total phases extracted');
    assert.strictEqual(output.current_plan, '03-02', 'current plan extracted');
    assert.strictEqual(output.total_plans_in_phase, 3, 'total plans extracted');
    assert.strictEqual(output.status, 'In progress', 'status extracted');
    assert.strictEqual(output.progress_percent, 45, 'progress extracted');
    assert.strictEqual(output.last_activity, '2024-01-15', 'last activity date extracted');
  });

  test('extracts decisions table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Use Prisma | Better DX than raw SQL |
| 02 | JWT auth | Stateless authentication |
`
    );

    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 2, 'should have 2 decisions');
    assert.strictEqual(output.decisions[0].phase, '01', 'first decision phase');
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'first decision summary');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than raw SQL', 'first decision rationale');
  });

  test('extracts blockers list', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Blockers

- Waiting for API credentials
- Need design review for dashboard
`
    );

    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.blockers, [
      'Waiting for API credentials',
      'Need design review for dashboard',
    ], 'blockers extracted');
  });

  test('extracts session continuity info', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Session

**Last Date:** 2024-01-15
**Stopped At:** Phase 3, Plan 2, Task 1
**Resume File:** .planning/phases/03-api/03-02-PLAN.md
`
    );

    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.session.last_date, '2024-01-15', 'session date extracted');
    assert.strictEqual(output.session.stopped_at, 'Phase 3, Plan 2, Task 1', 'stopped at extracted');
    assert.strictEqual(output.session.resume_file, '.planning/phases/03-api/03-02-PLAN.md', 'resume file extracted');
  });

  test('handles paused_at field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Paused At:** Phase 3, Plan 1, Task 2 - mid-implementation
`
    );

    const result = runGsdTools('util:state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, 'Phase 3, Plan 1, Task 2 - mid-implementation', 'paused_at extracted');
  });
});

describe('state update command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates a single field (Status)', () => {
    const result = runGsdTools('verify:state update Status Complete', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'JSON should report updated: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** Complete'), 'STATUS.md should contain **Status:** Complete');
  });

  test('updates Phase field with complex value', () => {
    const result = runGsdTools('verify:state update Phase "2 of 3 (API)"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'JSON should report updated: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Phase:** 2 of 3 (API)'), 'STATE.md should contain updated Phase field');
  });

  test('returns updated: false for nonexistent field', () => {
    const result = runGsdTools('verify:state update NonExistentField value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'JSON should report updated: false for nonexistent field');
  });
});

describe('state patch command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates multiple fields at once', () => {
    const result = runGsdTools('verify:state patch --Status Review --"Last Activity" 2026-02-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.updated.length >= 2, 'Should report at least 2 updated fields');
    assert.ok(output.updated.includes('Status'), 'Should include Status in updated list');
    assert.ok(output.updated.includes('Last Activity'), 'Should include Last Activity in updated list');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** Review'), 'STATE.md should contain **Status:** Review');
    assert.ok(content.includes('**Last Activity:** 2026-02-01'), 'STATE.md should contain updated Last Activity');
  });

  test('reports failed fields that do not exist', () => {
    const result = runGsdTools('verify:state patch --Status Done --FakeField value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.updated.includes('Status'), 'Status should be updated');
    assert.ok(output.failed.includes('FakeField'), 'FakeField should be in failed list');
  });
});

describe('state add-decision command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends decision and removes placeholder', () => {
    const result = runGsdTools('verify:state add-decision --phase 1 --summary "Use esbuild" --rationale "Fastest bundler"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use esbuild'), 'STATE.md should contain decision text');
    assert.ok(content.includes('Fastest bundler'), 'STATE.md should contain rationale');
    // Extract the Decisions section specifically to check placeholder removal
    const decisionsMatch = content.match(/###?\s*Decisions\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    assert.ok(decisionsMatch, 'Decisions section should exist');
    assert.ok(!decisionsMatch[1].includes('None yet'), '"None yet" placeholder should be removed from Decisions section');
  });

  test('adds second decision without removing first', () => {
    // Add first decision
    runGsdTools('verify:state add-decision --phase 1 --summary "Use esbuild" --rationale "Fastest bundler"', tmpDir);
    // Add second decision
    const result = runGsdTools('verify:state add-decision --phase 2 --summary "Use Postgres" --rationale "Best for relational data"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true for second decision');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use esbuild'), 'First decision should still be present');
    assert.ok(content.includes('Use Postgres'), 'Second decision should be present');
  });

  test('returns added: false when section missing', () => {
    // Write a STATE.md without a Decisions section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** In progress\n'
    );

    const result = runGsdTools('verify:state add-decision --phase 1 --summary "Test"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, false, 'Should report added: false when section missing');
  });
});

describe('state add-blocker command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends blocker and removes placeholder', () => {
    const result = runGsdTools('verify:state add-blocker --text "Config drift issue"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Config drift issue'), 'STATE.md should contain blocker text');
    // The fixture has "None yet." in Blockers section
    assert.ok(!content.match(/###?\s*Blockers\/Concerns\s*\n[\s\S]*?None yet\./i), '"None yet." placeholder should be removed from Blockers section');
  });

  test('returns added: true in JSON output', () => {
    const result = runGsdTools('verify:state add-blocker --text "Missing API key"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');
    assert.strictEqual(output.blocker, 'Missing API key', 'JSON should echo blocker text');
  });
});

describe('state resolve-blocker command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('resolves an existing blocker by text match', () => {
    // First add a blocker
    runGsdTools('verify:state add-blocker --text "Config drift"', tmpDir);
    // Verify it was added
    let content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Config drift'), 'Blocker should be present before resolve');

    // Now resolve it
    const result = runGsdTools('verify:state resolve-blocker --text "Config drift"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'JSON should report resolved: true');

    content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!content.includes('Config drift'), 'Blocker text should be removed from STATE.md');
  });

  test('returns resolved: true even for nonexistent blocker', () => {
    // The resolve-blocker command filters lines that match — if none match, it still writes back
    const result = runGsdTools('verify:state resolve-blocker --text "nonexistent blocker"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'JSON should report resolved: true (no-op filter)');
  });

  test('restores None placeholder when last blocker resolved', () => {
    // Add a blocker then resolve it — section should get "None" placeholder
    runGsdTools('verify:state add-blocker --text "Only blocker"', tmpDir);
    runGsdTools('verify:state resolve-blocker --text "Only blocker"', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    const blockersMatch = content.match(/###?\s*Blockers\/Concerns\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    assert.ok(blockersMatch, 'Blockers section should exist');
    assert.ok(blockersMatch[1].includes('None'), 'Blockers section should have None placeholder after last blocker resolved');
  });
});

describe('state record-session command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates all session continuity fields', () => {
    const result = runGsdTools('verify:state record-session --stopped-at "Phase 2 API work" --resume-file "None"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.ok(output.updated.length >= 2, 'Should report at least 2 updated fields');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Last session should be updated to current ISO datetime (just check it changed from fixture)
    assert.ok(!content.includes('**Last session:** 2026-01-01'), 'Last session should be updated from fixture value');
    assert.ok(content.includes('**Stopped at:** Phase 2 API work'), 'Stopped at should be updated');
    assert.ok(content.includes('**Resume file:** None'), 'Resume file should be present');
  });

  test('returns recorded: true in JSON output', () => {
    const result = runGsdTools('verify:state record-session --stopped-at "Test checkpoint"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.ok(Array.isArray(output.updated), 'updated should be an array of field names');
  });
});

describe('state advance-plan command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('advances plan number from 1 to 2', () => {
    const result = runGsdTools('verify:state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, true, 'JSON should report advanced: true');
    assert.strictEqual(output.previous_plan, 1, 'Previous plan should be 1');
    assert.strictEqual(output.current_plan, 2, 'Current plan should be 2');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'), 'STATE.md should contain **Current Plan:** 2');
    assert.ok(content.includes('**Status:** Ready to execute'), 'Status should be updated to Ready to execute');
  });

  test('detects last plan in phase and sets phase complete', () => {
    // Set Current Plan to 3 (equal to Total Plans in Phase: 3)
    runGsdTools('verify:state update "Current Plan" 3', tmpDir);

    const result = runGsdTools('verify:state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, false, 'Should NOT advance past last plan');
    assert.strictEqual(output.reason, 'last_plan', 'Reason should be last_plan');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase complete'), 'Status should indicate phase complete');
  });

  test('updates Last Activity date', () => {
    const result = runGsdTools('verify:state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Last Activity should be updated from the fixture's 2026-01-01
    assert.ok(!content.includes('**Last Activity:** 2026-01-01'), 'Last Activity should be updated from fixture value');
  });
});

describe('state record-metric command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends a row to the Performance Metrics table', () => {
    const result = runGsdTools('verify:state record-metric --phase 01 --plan 01 --duration 45m --tasks 3 --files 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase 01 P01'), 'STATE.md should contain the new metric row with phase info');
    assert.ok(content.includes('45m'), 'STATE.md should contain the duration');
    assert.ok(content.includes('3 tasks'), 'STATE.md should contain the task count');
    assert.ok(content.includes('5 files'), 'STATE.md should contain the file count');
  });

  test('returns recorded: true with metric details', () => {
    const result = runGsdTools('verify:state record-metric --phase 02 --plan 03 --duration 12m --tasks 5 --files 8', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.strictEqual(output.phase, '02', 'JSON should echo phase');
    assert.strictEqual(output.plan, '03', 'JSON should echo plan');
    assert.strictEqual(output.duration, '12m', 'JSON should echo duration');
  });

  test('returns error when required fields missing', () => {
    const result = runGsdTools('verify:state record-metric --phase 01', tmpDir);
    assert.ok(result.success, `Command should succeed with error in JSON: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'JSON should contain error when required fields missing');
  });
});

describe('state complete-plan command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('batches core plan completion updates in one command', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    const result = runGsdTools('verify:state complete-plan --phase 151 --plan 03 --duration "12 min" --tasks 2 --files 5 --decision-summary "Batched plan finalization" --decision-rationale "Keep core state writes together" --stopped-at "Completed 151-03-PLAN.md" --resume-file "None"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true, 'command should succeed');
    assert.strictEqual(output.core.current_plan, 2, 'should advance plan');
    assert.strictEqual(output.core.progress, 50, 'should refresh progress from summaries on disk');
    assert.deepStrictEqual(output.warnings, [], 'should have no warnings on happy path');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'), 'STATE.md should advance current plan');
    assert.ok(content.includes('**Progress:** [█████░░░░░] 50%'), 'STATE.md should update progress');
    assert.ok(content.includes('Batched plan finalization'), 'STATE.md should append decision');
    assert.ok(content.includes('Phase 151 P03'), 'STATE.md should append metric row');
    assert.ok(content.includes('**Stopped at:** Completed 151-03-PLAN.md'), 'STATE.md should update session continuity');
  });

  test('reports tail warnings when metric append cannot be written', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      STATE_FIXTURE.replace(/## Performance Metrics[\s\S]*?## Accumulated Context/, '## Accumulated Context')
    );

    const result = runGsdTools('verify:state complete-plan --phase 151 --plan 03 --duration "12 min" --tasks 2 --files 5 --decision-summary "Batched plan finalization" --stopped-at "Completed 151-03-PLAN.md" --resume-file "None"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true, 'core should still succeed');
    assert.strictEqual(output.warnings.length, 1, 'should emit one tail warning');
    assert.strictEqual(output.warnings[0].step, 'record-metric');
    assert.match(output.warnings[0].recovery, /verify:state record-metric/, 'warning should include recovery guidance');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'), 'core updates should persist');
    assert.ok(content.includes('Batched plan finalization'), 'decision should still be written');
  });

  test('refreshes stale plan totals and current focus from on-disk phase truth', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '151-execution-realism');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '151-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '151-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '151-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '151-02-SUMMARY.md'), '# Summary 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Project Reference

**Current focus:** stale focus text from the previous plan

## Current Position

**Phase:** 151 of 200 (Execution Realism)
**Current Plan:** 1
**Total Plans in Phase:** 9
**Status:** In progress
**Last Activity:** 2026-03-30

**Progress:** [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None.

## Session Continuity

**Last session:** 2026-03-30T00:00:00.000Z
**Stopped at:** Completed 151-01-PLAN.md
**Resume file:** None
`
    );

    const result = runGsdTools('verify:state complete-plan --phase 151 --plan 02 --duration "12 min" --tasks 3 --files 4 --stopped-at "Completed 151-02-PLAN.md" --resume-file "None"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true, 'command should succeed');
    assert.strictEqual(output.core.current_plan, 2, 'last completed plan should stay aligned to disk truth');
    assert.strictEqual(output.core.total_plans, 2, 'should recompute total plans from phase inventory');
    assert.deepStrictEqual(output.warnings, [], 'should repair stale fields inline instead of warning');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'), 'STATE.md should repair current plan from disk truth');
    assert.ok(content.includes('**Total Plans in Phase:** 2'), 'STATE.md should repair total plans from disk truth');
    assert.ok(content.includes('**Current focus:** Phase 151 complete — ready for verification'), 'STATE.md should repair stale focus text');
    assert.ok(content.includes('**Status:** Phase complete — ready for verification'), 'STATE.md should mark the phase complete');
  });

  test('roadmap update-plan-progress repairs stale progress wording from on-disk truth', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '151-execution-realism');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '151-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '151-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '151-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '151-02-SUMMARY.md'), '# Summary 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] **Phase 151: Execution Realism**

### Phase 151: Execution Realism
**Goal:** Keep completion metadata truthful
**Plans:** 1/9 plans executed

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 151. Execution Realism | 1/9 | In Progress|  |
`
    );

    const result = runGsdTools('plan:roadmap update-plan-progress 151', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('- [x] **Phase 151: Execution Realism** (completed '), 'Checklist summary should be repaired to complete');
    assert.ok(roadmap.includes('**Plans:** 2/2 plans complete'), 'Detail summary should be repaired from disk truth');
    assert.ok(roadmap.includes('| 151. Execution Realism | 2/2 | Complete'), 'Progress table row should be repaired from disk truth');
    assert.ok(!roadmap.includes('1/9'), 'Stale roadmap wording should be removed');
  });
});

describe('state validate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('clean state returns "clean" status', () => {
    // Set up matching ROADMAP + disk: 2 plans, 1 complete, 1 in progress
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    // STATE.md pointing to phase 1 which is still in progress (not all complete)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Total Plans in Phase:** 2
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'clean', 'should be clean');
    assert.deepStrictEqual(output.issues, [], 'should have no issues');
    assert.strictEqual(output.summary, 'State validation passed — no issues found');
  });

  test('detects plan count drift', () => {
    // ROADMAP says 2 plans but disk only has 1
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    const driftIssue = output.issues.find(i => i.type === 'plan_count_drift');
    assert.ok(driftIssue, 'should have plan_count_drift issue');
    assert.strictEqual(driftIssue.severity, 'error');
    assert.ok(driftIssue.expected.includes('1'), 'expected should mention disk count');
    assert.ok(driftIssue.actual.includes('2'), 'actual should mention ROADMAP count');
  });

  test('detects completion drift', () => {
    // ROADMAP checkbox marked [x] but disk has 2 plans and only 1 summary
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [x] **Phase 1: Foundation** (completed)

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1/2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const completionIssue = output.issues.find(i => i.type === 'completion_drift');
    assert.ok(completionIssue, 'should have completion_drift issue');
    assert.strictEqual(completionIssue.severity, 'error');
    assert.ok(completionIssue.expected.includes('2'), 'expected should mention total plan count');
    assert.ok(completionIssue.actual.includes('1'), 'actual should mention summary count');
  });

  test('detects missing position', () => {
    // STATE.md says "Phase: 99 of 13" but phase 99 directory doesn't exist
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 99 of 13 (Nonexistent)
**Current Plan:** 1
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const posIssue = output.issues.find(i => i.type === 'position_missing');
    assert.ok(posIssue, 'should have position_missing issue');
    assert.strictEqual(posIssue.severity, 'error');
  });

  test('detects completed position', () => {
    // STATE.md points to phase 1, but phase 1 has equal PLANs and SUMMARYs
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 1
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const posIssue = output.issues.find(i => i.type === 'position_completed');
    assert.ok(posIssue, 'should have position_completed issue');
    assert.strictEqual(posIssue.severity, 'warn');
    assert.ok(posIssue.actual.includes('1/1'), 'should mention summary/plan counts');
  });

  test('detects stale activity via git', () => {
    // Initialize a git repo in the temp directory, make a recent commit,
    // but set STATE.md Last Activity to an old date
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      // Git not available, skip test
      return;
    }

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** 2025-01-01
`
    );

    // Commit the planning files to create git history
    try {
      execSync('git add .planning/', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      // Git commit failed, skip test
      return;
    }

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const staleIssue = output.issues.find(i => i.type === 'activity_stale');
    assert.ok(staleIssue, 'should have activity_stale issue');
    assert.strictEqual(staleIssue.severity, 'warn');
    assert.ok(staleIssue.actual.includes('2025-01-01'), 'should mention declared date');
  });

  test('--fix corrects plan count drift', () => {
    // Initialize git repo for auto-commit
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return; // Git not available, skip
    }

    // ROADMAP says 3 plans but disk has 2
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 3 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    // Initial commit so git add/commit works
    try {
      execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return;
    }

    const result = runGsdTools('verify:state validate --fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.fixes_applied.length > 0, 'should have fixes applied');
    assert.strictEqual(output.fixes_applied[0].phase, '1');
    assert.strictEqual(output.fixes_applied[0].old, '3');
    assert.strictEqual(output.fixes_applied[0].new, '2');

    // Verify ROADMAP.md was updated on disk
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('2 plan'), 'ROADMAP should now say 2 plans');
    assert.ok(!roadmap.includes('3 plan'), 'ROADMAP should not say 3 plans anymore');
  });

  test('no blocker staleness when blockers section is empty', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 2 of 2 (API)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.

### Pending Todos

None yet.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const blockerIssues = output.issues.filter(i => i.type === 'stale_blocker' || i.type === 'stale_todo');
    assert.strictEqual(blockerIssues.length, 0, 'should have no stale blocker/todo issues');
  });

  test('detects stale blockers after completed plans', () => {
    // Create 3 completed plans (summaries) to trigger staleness
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 3 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-PLAN.md'), '# Plan 3\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-SUMMARY.md'), '# Summary 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 2 of 2 (API)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

- Need to investigate memory leak in worker pool
- CI pipeline is flaky on Mondays

### Pending Todos

None.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const staleBlockers = output.issues.filter(i => i.type === 'stale_blocker');
    assert.strictEqual(staleBlockers.length, 2, 'should detect 2 stale blockers');
    assert.strictEqual(staleBlockers[0].severity, 'warn');
    assert.ok(staleBlockers[0].actual.includes('memory leak'), 'should reference the blocker text');
  });

  test('returns error status when both ROADMAP.md and STATE.md are missing', () => {
    // Remove the files (createTempProject only creates the dirs)
    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    assert.ok(output.issues.some(i => i.type === 'missing_files'), 'should have missing_files issue');
  });

  test('multiple issue types combine correctly', () => {
    // Set up drift + missing position
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 5 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 77 of 99 (Ghost)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    assert.ok(output.issues.length >= 2, `should have at least 2 issues, got ${output.issues.length}`);

    const issueTypes = output.issues.map(i => i.type);
    assert.ok(issueTypes.includes('plan_count_drift'), 'should include plan_count_drift');
    assert.ok(issueTypes.includes('position_missing'), 'should include position_missing');

    // Summary should reflect counts
    assert.ok(output.summary.includes('error'), 'summary should mention errors');
  });
});

describe('state validate pre-flight', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase includes pre_flight_validation field', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    // Set up minimal valid phase structure
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    initJjRepo(tmpDir);

    const result = runGsdTools('init:execute-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('pre_flight_validation' in output, 'should have pre_flight_validation field');
    assert.strictEqual(typeof output.pre_flight_validation, 'boolean', 'should be a boolean');
    assert.strictEqual(output.pre_flight_validation, true, 'should default to true');
  });

  test('pre_flight_validation respects config gates.pre_flight_validation: false', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    // Set up minimal valid phase structure with config that disables pre-flight
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    // Config with pre_flight_validation disabled
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ gates: { pre_flight_validation: false } }, null, 2)
    );

    initJjRepo(tmpDir);

    const result = runGsdTools('init:execute-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pre_flight_validation, false, 'should be false when config disables it');
  });

  test('state validate --fix then validate returns clean for plan count drift', () => {
    // Initialize git repo for --fix auto-commit
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return; // Git not available, skip
    }

    // ROADMAP says 2 plans but disk has 3
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-PLAN.md'), '# Plan 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Total Plans in Phase:** 3
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    // Initial commit so git add/commit works
    try {
      execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return;
    }

    // Step 1: Run --fix to auto-correct plan count drift
    const fixResult = runGsdTools('verify:state validate --fix', tmpDir);
    assert.ok(fixResult.success, `Fix command failed: ${fixResult.error}`);

    const fixOutput = JSON.parse(fixResult.output);
    assert.ok(fixOutput.fixes_applied.length > 0, 'should have fixes applied');
    assert.strictEqual(fixOutput.fixes_applied[0].old, '2');
    assert.strictEqual(fixOutput.fixes_applied[0].new, '3');

    // Step 2: Run validate again — should be clean (or at least no plan_count_drift)
    const validateResult = runGsdTools('verify:state validate', tmpDir);
    assert.ok(validateResult.success, `Validate command failed: ${validateResult.error}`);

    const validateOutput = JSON.parse(validateResult.output);
    const driftIssues = validateOutput.issues.filter(i => i.type === 'plan_count_drift');
    assert.strictEqual(driftIssues.length, 0, 'plan_count_drift should be gone after fix');
  });

  test('state validate with multiple issue types returns mixed severities', () => {
    // Set up: plan count drift (error) + completed position (warn) + stale blockers (warn)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 5 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

- Legacy blocker from long ago

### Pending Todos

None.
`
    );

    const result = runGsdTools('verify:state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.issues.length >= 2, `should have at least 2 issues, got ${output.issues.length}`);

    // Check for different severity levels
    const severities = new Set(output.issues.map(i => i.severity));
    const hasError = severities.has('error');
    const hasWarn = severities.has('warn');

    // Plan count drift should be "error", completed position or stale blocker should be "warn"
    assert.ok(hasError, 'should have at least one error severity issue');
    assert.ok(hasWarn, 'should have at least one warn severity issue');

    // Verify specific types present
    const issueTypes = output.issues.map(i => i.type);
    assert.ok(issueTypes.includes('plan_count_drift'), 'should include plan_count_drift');
  });

  test('init execute-phase compact mode includes pre_flight_validation', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    // Set up minimal valid phase structure
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    initJjRepo(tmpDir);

    const result = runGsdTools('init:execute-phase 1 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('pre_flight_validation' in output, 'compact mode should have pre_flight_validation field');
    assert.strictEqual(output.pre_flight_validation, true, 'should default to true in compact mode');
  });
});

describe('state handoff command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes a phase handoff artifact and selects the latest valid step', () => {
    let result = runGsdTools('verify:state handoff write --phase 152 --step discuss --run-id run-1 --source-fingerprint fp-1 --summary "Discuss done"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.written, true, 'write should succeed');
    assert.strictEqual(output.latest_valid_step, 'discuss', 'latest step should start at discuss');

    result = runGsdTools('verify:state handoff write --phase 152 --step plan --run-id run-1 --source-fingerprint fp-1 --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.latest_valid_step, 'plan', 'latest step should advance to plan');

    const validate = runGsdTools('verify:state handoff validate --phase 152', tmpDir);
    assert.ok(validate.success, `Validate failed: ${validate.error}`);
    const validateOutput = JSON.parse(validate.output);
    assert.strictEqual(validateOutput.valid, true, 'handoff should be resumable');
    assert.strictEqual(validateOutput.latest_valid_step, 'plan', 'validate should return plan as latest valid step');
    assert.strictEqual(validateOutput.selected_run_id, 'run-1', 'validate should preserve run id');
  });

  test('phase handoff write derives canonical payload defaults for production callers', () => {
    const result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Discuss done" --resume-file ".planning/phases/152/152-CONTEXT.md" --next-command "/bgsd-plan research 152"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.written, true, 'write should succeed without manual run inputs');
    assert.match(output.artifact.run_id, /^152-/, 'run id should be derived from the phase');
    assert.match(output.artifact.source_fingerprint, /^[0-9a-f]{16}$/, 'source fingerprint should be derived automatically');
    assert.strictEqual(output.artifact.resume_target.resume_file, '.planning/phases/152/152-CONTEXT.md', 'resume target should include resume file');
    assert.strictEqual(output.artifact.resume_target.next_command, '/bgsd-plan research 152', 'resume target should include next command');
  });

  test('source fingerprint stays stable across same-phase run refreshes', () => {
    let result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Discuss done"', tmpDir);
    assert.ok(result.success, `Discuss write failed: ${result.error}`);
    const discussOutput = JSON.parse(result.output);

    result = runGsdTools('verify:state handoff write --phase 152 --step research --summary "Research done"', tmpDir);
    assert.ok(result.success, `Research write failed: ${result.error}`);
    const researchOutput = JSON.parse(result.output);

    assert.strictEqual(researchOutput.artifact.run_id, discussOutput.artifact.run_id, 'same run should be reused after discuss');
    assert.strictEqual(researchOutput.artifact.source_fingerprint, discussOutput.artifact.source_fingerprint, 'same run should reuse the fingerprint');
  });

  test('falls back to the previous valid step when the newest artifact is corrupt', () => {
    let result = runGsdTools('verify:state handoff write --phase 152 --step discuss --run-id run-1 --source-fingerprint fp-1', tmpDir);
    assert.ok(result.success, `Discuss write failed: ${result.error}`);
    result = runGsdTools('verify:state handoff write --phase 152 --step research --run-id run-1 --source-fingerprint fp-1', tmpDir);
    assert.ok(result.success, `Research write failed: ${result.error}`);

    const corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'plan.json');
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, '{not valid json\n', 'utf-8');

    const validate = runGsdTools('verify:state handoff validate --phase 152', tmpDir);
    assert.ok(validate.success, `Validate failed: ${validate.error}`);
    const output = JSON.parse(validate.output);
    assert.strictEqual(output.valid, true, 'older valid artifact should still be resumable');
    assert.strictEqual(output.latest_valid_step, 'research', 'should fall back to research');
    assert.strictEqual(output.invalid_artifacts.length, 1, 'should report the corrupt artifact');
  });

  test('replaces the previous same-phase run once a new run artifact is valid', () => {
    let result = runGsdTools('verify:state handoff write --phase 152 --step execute --run-id run-old --source-fingerprint fp-old', tmpDir);
    assert.ok(result.success, `Old run write failed: ${result.error}`);

    result = runGsdTools('verify:state handoff write --phase 152 --step discuss --run-id run-new --source-fingerprint fp-new', tmpDir);
    assert.ok(result.success, `New run write failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.replaced_runs, ['run-old'], 'new valid run should replace old run');

    const validate = runGsdTools('verify:state handoff validate --phase 152', tmpDir);
    assert.ok(validate.success, `Validate failed: ${validate.error}`);
    const validateOutput = JSON.parse(validate.output);
    assert.strictEqual(validateOutput.selected_run_id, 'run-new', 'new run should be selected');
    assert.strictEqual(validateOutput.valid_artifacts.length, 1, 'old run artifacts should be removed');
    assert.strictEqual(validateOutput.latest_valid_step, 'discuss', 'new run latest step should be discuss');
  });

  test('same-phase run restart keeps the old chain until the new discuss handoff is valid', () => {
    let result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `Initial write failed: ${result.error}`);
    const firstOutput = JSON.parse(result.output);

    result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Restarted discuss"', tmpDir);
    assert.ok(result.success, `Restart write failed: ${result.error}`);
    const secondOutput = JSON.parse(result.output);

    assert.notStrictEqual(secondOutput.artifact.run_id, firstOutput.artifact.run_id, 'restart discuss should create a fresh run id');
    assert.deepStrictEqual(secondOutput.replaced_runs, [firstOutput.artifact.run_id], 'previous run should only be replaced after the new discuss write succeeds');
  });

  test('reports repair guidance when the source fingerprint is stale', () => {
    const result = runGsdTools('verify:state handoff write --phase 152 --step plan --run-id run-1 --source-fingerprint fp-1', tmpDir);
    assert.ok(result.success, `Write failed: ${result.error}`);

    const validate = runGsdTools('verify:state handoff validate --phase 152 --expected-fingerprint fp-2', tmpDir);
    assert.ok(validate.success, `Validate command should still succeed: ${validate.error}`);
    const output = JSON.parse(validate.output);
    assert.strictEqual(output.valid, false, 'stale fingerprint should block resume');
    assert.strictEqual(output.stale_sources, true, 'stale source flag should be set');
    assert.strictEqual(output.latest_valid_step, 'plan', 'latest valid step should still be reported');
    assert.strictEqual(output.repair_guidance.action, 'repair', 'repair guidance should be returned');
    assert.match(output.repair_guidance.commands[0], /verify:state handoff clear --phase 152/, 'repair guidance should point to clear command');
  });

  test('phase handoff write preserves discovered TDD proof metadata across later step refreshes', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0152-proof-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '0152-01-TDD-AUDIT.json'), JSON.stringify({
      phases: {
        red: { target_command: 'node --test tests/proof.test.cjs', exit_code: 1 },
        green: { target_command: 'node --test tests/proof.test.cjs', exit_code: 0 }
      }
    }, null, 2));

    let result = runGsdTools('verify:state handoff write --phase 152 --step execute --summary "Execution complete"', tmpDir);
    assert.ok(result.success, `execute handoff write failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.ok(output.artifact.context.tdd_audits.some((entry) => entry.path.endsWith('0152-01-TDD-AUDIT.json')), 'execute write should discover the canonical TDD audit artifact');
    assert.deepStrictEqual(output.artifact.context.tdd_audits[0].stages, ['red', 'green'], 'discovered metadata should preserve deterministic stage coverage');

    result = runGsdTools('verify:state handoff write --phase 152 --step verify --summary "Verification complete"', tmpDir);
    assert.ok(result.success, `verify handoff write failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.ok(output.artifact.context.tdd_audits.some((entry) => entry.path.endsWith('0152-01-TDD-AUDIT.json')), 'later handoff writes should carry forward proof metadata without re-passing context');
  });

  test('same-phase discuss restart does not inherit proof metadata from the replaced run', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0152-proof-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '0152-01-TDD-AUDIT.json'), JSON.stringify({
      phases: {
        red: { target_command: 'node --test tests/proof.test.cjs', exit_code: 1 }
      }
    }, null, 2));

    let result = runGsdTools('verify:state handoff write --phase 152 --step execute --summary "Execution complete"', tmpDir);
    assert.ok(result.success, `execute handoff write failed: ${result.error}`);

    fs.unlinkSync(path.join(phaseDir, '0152-01-TDD-AUDIT.json'));
    result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Restarted discuss"', tmpDir);
    assert.ok(result.success, `discuss restart failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.artifact.context, {}, 'new discuss run should start clean when no current proof artifact exists');
  });
});
