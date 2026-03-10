/**
 * bgsd-tools orchestration tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('orchestration: classifyTaskComplexity', () => {
  test('minimal task (1 file, no tests) scores 1-2', () => {
    const result = runGsdTools('util:classify plan --raw', process.cwd());
    // Direct module test via inline plan
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.js
autonomous: true
---

<objective>Simple task</objective>

<tasks>
<task type="auto">
  <name>Simple task</name>
  <files>src/foo.js</files>
  <action>Add a single function</action>
  <verify>check it</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.ok(parsed.tasks[0].complexity.score <= 2, `Expected score <= 2, got ${parsed.tasks[0].complexity.score}`);
    assert.strictEqual(parsed.tasks[0].complexity.label, parsed.tasks[0].complexity.score === 1 ? 'trivial' : 'simple');
    cleanup(tmpDir);
  });

  test('complex task (4+ files, tests, long action) scores 4-5', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const longAction = 'Implement the full authentication system with JWT token rotation, refresh tokens, and session management. ' +
      'This requires modifying the user model, adding middleware for token validation, creating the login/logout endpoints, ' +
      'handling token expiry and refresh, adding rate limiting to auth endpoints, and writing comprehensive test coverage. ' +
      'The implementation must handle edge cases like concurrent refresh requests, token blacklisting, and graceful degradation ' +
      'when the token store is unavailable. Additionally, integrate with the existing authorization middleware and ensure ' +
      'backward compatibility with session-based auth that some clients still use. Run npm test to verify all auth tests pass. ' +
      'Add integration tests for the complete login flow including token refresh and logout scenarios across multiple sessions.';
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/auth.js
  - src/middleware.js
  - src/models/user.js
  - src/routes/auth.js
  - src/lib/tokens.js
  - tests/auth.test.js
autonomous: true
---

<objective>Auth system</objective>

<tasks>
<task type="auto">
  <name>Complex auth task</name>
  <files>src/auth.js, src/middleware.js, src/models/user.js, src/routes/auth.js, src/lib/tokens.js, tests/auth.test.js</files>
  <action>${longAction}</action>
  <verify>npm test</verify>
  <done>All auth tests pass</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.ok(parsed.tasks[0].complexity.score >= 4, `Expected score >= 4, got ${parsed.tasks[0].complexity.score}`);
    assert.ok(['complex', 'very_complex'].includes(parsed.tasks[0].complexity.label));
    cleanup(tmpDir);
  });

  test('moderate task (3 files, tests) scores 3', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/a.js
  - src/b.js
  - src/c.js
autonomous: true
---

<objective>Moderate task</objective>

<tasks>
<task type="auto">
  <name>Moderate task</name>
  <files>src/a.js, src/b.js, src/c.js</files>
  <action>Implement feature with test coverage</action>
  <verify>npm test</verify>
  <done>Tests pass</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.tasks[0].complexity.score, 3, 'Expected score 3 for 3 files + tests');
    assert.strictEqual(parsed.tasks[0].complexity.label, 'moderate');
    cleanup(tmpDir);
  });
});

describe('orchestration: parseTasksFromPlan', () => {
  test('extracts tasks from plan XML correctly', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Test parsing</objective>

<tasks>

<task type="auto">
  <name>First Task</name>
  <files>src/a.js, src/b.js</files>
  <action>Do something first</action>
  <verify>npm test</verify>
  <done>First done</done>
</task>

<task type="checkpoint:human-verify">
  <name>Second Task</name>
  <files>src/c.js</files>
  <action>Do something second</action>
  <verify>Check it manually</verify>
  <done>Verified</done>
</task>

</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.task_count, 2, 'Should parse 2 tasks');
    assert.strictEqual(parsed.tasks[0].name, 'First Task');
    assert.strictEqual(parsed.tasks[1].name, 'Second Task');
    assert.deepStrictEqual(parsed.tasks[0].files, ['src/a.js', 'src/b.js']);
    assert.strictEqual(parsed.tasks[1].type, 'checkpoint:human-verify');
    cleanup(tmpDir);
  });

  test('handles malformed XML gracefully', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Bad XML</objective>

<tasks>

<task type="auto">
  <name>Only name, no closing tag properly
  <files>src/a.js</files>

This is just random text, not in a task block.

</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    // Should return 0 tasks (no valid <task>...</task> blocks)
    assert.strictEqual(parsed.task_count, 0, 'Should handle malformed XML by returning 0 tasks');
    cleanup(tmpDir);
  });
});

describe('orchestration: selectExecutionMode', () => {
  test('single plan with 1-2 tasks returns mode "single"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Single task</objective>

<tasks>
<task type="auto">
  <name>Only task</name>
  <files>src/a.js</files>
  <action>Do it</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'single', 'Single plan with 1 task should be "single"');
    cleanup(tmpDir);
  });

  test('multiple same-wave plans returns mode "parallel"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    for (const num of ['01', '02']) {
      const planContent = `---
phase: 99-test
plan: ${num}
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Plan ${num}</objective>

<tasks>
<task type="auto">
  <name>Task in plan ${num}</name>
  <files>src/${num}.js</files>
  <action>Implement plan ${num}</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
      fs.writeFileSync(path.join(phaseDir, `99-${num}-PLAN.md`), planContent);
    }

    const res = runGsdTools(`util:classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'parallel', 'Multiple same-wave plans should be "parallel"');
    assert.ok(parsed.execution_mode.reason.includes('independent plans'), 'Reason should mention independent plans');
    cleanup(tmpDir);
  });

  test('plans with checkpoints returns mode "sequential"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Plan with checkpoint</objective>

<tasks>
<task type="auto">
  <name>Auto task</name>
  <files>src/a.js</files>
  <action>Do something</action>
  <verify>check</verify>
  <done>done</done>
</task>

<task type="checkpoint:human-verify">
  <name>Verify task</name>
  <files>src/a.js</files>
  <action>Verify it works</action>
  <verify>Visual check</verify>
  <done>Approved</done>
</task>

<task type="auto">
  <name>Final task</name>
  <files>src/a.js</files>
  <action>Finish up</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`util:classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'sequential', 'Plans with checkpoints should be "sequential"');
    assert.ok(parsed.execution_mode.has_checkpoints, 'Should report has_checkpoints true');
    cleanup(tmpDir);
  });
});

describe('orchestration: classify plan CLI', () => {
  test('returns JSON with task scores for a real plan', () => {
    const result = runGsdTools('util:classify plan .planning/milestones/v7.0-phases/39-orchestration-intelligence/39-01-PLAN.md --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.plan, '39-01-PLAN.md');
    assert.ok(parsed.task_count >= 2, 'Should have at least 2 tasks');
    assert.ok(parsed.tasks.every(t => t.complexity.score >= 1 && t.complexity.score <= 5), 'All scores 1-5');
    assert.ok(parsed.tasks.every(t => ['trivial', 'simple', 'moderate', 'complex', 'very_complex'].includes(t.complexity.label)), 'All labels valid');
    assert.ok(parsed.tasks.every(t => ['haiku', 'sonnet', 'opus'].includes(t.complexity.recommended_model)), 'All models valid');
    assert.ok(typeof parsed.plan_complexity === 'number', 'plan_complexity should be a number');
    assert.ok(typeof parsed.recommended_model === 'string', 'recommended_model should be a string');
  });
});

describe('orchestration: classify phase CLI', () => {
  test('classify phase 38 returns classifications for completed plans', () => {
    const result = runGsdTools('util:classify phase 38 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '38');
    assert.ok(parsed.plans_classified >= 1, 'Should classify at least 1 plan');
    assert.ok(parsed.execution_mode, 'Should have execution_mode');
    assert.ok(['single', 'parallel', 'sequential', 'pipeline'].includes(parsed.execution_mode.mode), 'Valid mode');
    assert.ok(typeof parsed.execution_mode.reason === 'string', 'Mode should have reason');
  });
});

describe('orchestration: init execute-phase integration', () => {
  test('init execute-phase on incomplete phase includes task_routing field', () => {
    const result = runGsdTools('init:execute-phase 39 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok('task_routing' in parsed, 'task_routing field should be present');

    // Phase 39 has incomplete plans, so task_routing should be populated
    if (parsed.task_routing !== null) {
      assert.ok(Array.isArray(parsed.task_routing.plans), 'task_routing.plans should be array');
      assert.ok(parsed.task_routing.execution_mode, 'task_routing should have execution_mode');
      assert.ok(typeof parsed.task_routing.classified_at === 'string', 'Should have classified_at timestamp');
    }
  });
});

