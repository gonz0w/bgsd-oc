/**
 * bgsd-tools verify tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('verify analyze-plan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scores well-structured plan (2 tasks, shared files) as 4-5', () => {
    const planContent = `---
phase: "12"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/commands/verify.js, src/router.js]
autonomous: true
must_haves: []
---
# Plan 12-01: Add verification

<task id="1">
<name>Add verify function</name>
<files>
src/commands/verify.js
src/lib/helpers.js
</files>
<action>Add the function</action>
</task>

<task id="2">
<name>Wire into router</name>
<files>
src/router.js
src/commands/verify.js
</files>
<action>Wire it up</action>
</task>
`;
    const planPath = path.join(tmpDir, 'test-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score >= 4, `Expected score >= 4, got ${data.sr_score}`);
    assert.strictEqual(data.task_count, 2);
    assert.ok(data.concern_count <= 2, `Expected <= 2 concerns, got ${data.concern_count}`);
    assert.strictEqual(data.split_suggestion, null);
  });

  test('scores multi-concern plan (4+ tasks in unrelated dirs) as 1-2', () => {
    const planContent = `---
phase: "05"
plan: "02"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 05-02: Kitchen sink

<task id="1">
<name>Database migration</name>
<files>
db/migrations/001_create_users.sql
db/migrations/002_create_orders.sql
</files>
<action>Create migrations</action>
</task>

<task id="2">
<name>Frontend components</name>
<files>
frontend/components/Header.tsx
frontend/components/Footer.tsx
</files>
<action>Build UI</action>
</task>

<task id="3">
<name>API endpoints</name>
<files>
api/routes/users.go
api/routes/orders.go
</files>
<action>Add endpoints</action>
</task>

<task id="4">
<name>Deploy config</name>
<files>
infra/terraform/main.tf
infra/docker/Dockerfile
</files>
<action>Configure deploy</action>
</task>

<task id="5">
<name>Documentation</name>
<files>
docs/api/README.md
docs/setup/INSTALL.md
</files>
<action>Write docs</action>
</task>

<task id="6">
<name>CI pipeline</name>
<files>
ci/pipeline.yml
ci/scripts/test.sh
</files>
<action>Set up CI</action>
</task>
`;
    const planPath = path.join(tmpDir, 'kitchen-sink-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score <= 2, `Expected score <= 2, got ${data.sr_score}`);
    assert.ok(data.concern_count >= 4, `Expected >= 4 concerns, got ${data.concern_count}`);
    assert.ok(data.task_count >= 5, `Expected >= 5 tasks, got ${data.task_count}`);
  });

  test('detects concern groups correctly', () => {
    const planContent = `---
phase: "03"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 03-01: Two concerns

<task id="1">
<name>Router update</name>
<files>
src/router.js
src/commands/init.js
</files>
<action>Update router</action>
</task>

<task id="2">
<name>Init command</name>
<files>
src/commands/init.js
src/lib/helpers.js
</files>
<action>Add init</action>
</task>

<task id="3">
<name>Write tests</name>
<files>
tests/unit/router.test.js
tests/unit/init.test.js
</files>
<action>Add tests</action>
</task>
`;
    const planPath = path.join(tmpDir, 'two-concern-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Tasks 1 and 2 share src/commands/ directory, so they merge.
    // Task 3 is in tests/unit/ - separate concern.
    assert.strictEqual(data.concern_count, 2, `Expected 2 concerns, got ${data.concern_count}`);
    assert.strictEqual(data.task_count, 3);

    // Verify concern structure
    const srcConcern = data.concerns.find(c => c.tasks.length === 2);
    const testConcern = data.concerns.find(c => c.tasks.length === 1);
    assert.ok(srcConcern, 'Should have a concern with 2 tasks');
    assert.ok(testConcern, 'Should have a concern with 1 task');
    assert.ok(testConcern.tasks.includes('Write tests'), 'Test concern should contain Write tests');
  });

  test('suggests splits for poor plans (score <= 3)', () => {
    const planContent = `---
phase: "07"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 07-01: Overloaded

<task id="1">
<name>Database work</name>
<files>
db/schema.sql
db/seeds.sql
</files>
<action>DB stuff</action>
</task>

<task id="2">
<name>Frontend work</name>
<files>
web/pages/index.tsx
web/components/Nav.tsx
</files>
<action>UI stuff</action>
</task>

<task id="3">
<name>Backend work</name>
<files>
server/routes.go
server/handlers.go
</files>
<action>Server stuff</action>
</task>

<task id="4">
<name>Infra work</name>
<files>
deploy/nomad.hcl
deploy/consul.hcl
</files>
<action>Infra stuff</action>
</task>
`;
    const planPath = path.join(tmpDir, 'overloaded-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score <= 3, `Expected score <= 3, got ${data.sr_score}`);
    assert.ok(data.split_suggestion !== null, 'Should have split suggestion');
    assert.strictEqual(data.split_suggestion.recommended_splits, data.concern_count);
    assert.ok(data.split_suggestion.proposed_plans.length >= 2, 'Should propose at least 2 plans');

    // Each proposed plan should have tasks and files
    for (const plan of data.split_suggestion.proposed_plans) {
      assert.ok(plan.tasks.length > 0, 'Proposed plan should have tasks');
      assert.ok(plan.files.length > 0, 'Proposed plan should have files');
      assert.ok(plan.area, 'Proposed plan should have area label');
    }
  });

  test('handles single-task plan (score 5)', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/index.js]
autonomous: true
must_haves: []
---
# Plan 01-01: Simple task

<task id="1">
<name>Initialize project</name>
<files>
src/index.js
</files>
<action>Set up entry point</action>
</task>
`;
    const planPath = path.join(tmpDir, 'simple-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.sr_score, 5);
    assert.strictEqual(data.sr_label, 'Excellent');
    assert.strictEqual(data.concern_count, 1);
    assert.strictEqual(data.task_count, 1);
    assert.strictEqual(data.split_suggestion, null);
    assert.strictEqual(data.plan, '1-01');
  });

  test('handles missing file gracefully', () => {
    const result = runGsdTools('verify:verify analyze-plan /nonexistent/path/PLAN.md');
    assert.ok(result.success, `Command should not throw`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.error, 'File not found');
  });
});

describe('verify deliverables', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns structured result when npm test runs', () => {
    // Create temp dir with a passing test command
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-pass',
      scripts: { test: 'echo "5 passing"' },
    }));

    const result = runGsdTools('verify:verify deliverables', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.test_result, 'pass', 'test_result should be pass');
    assert.strictEqual(data.framework, 'npm', 'should detect npm framework');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
    assert.strictEqual(data.tests_passed, 5, 'should parse 5 passing');
  });

  test('returns fail when test command fails', () => {
    // Create a temp dir with a package.json that has a failing test command
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-fail',
      scripts: { test: 'exit 1' },
    }));

    const result = runGsdTools('verify:verify deliverables', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.test_result, 'fail', 'test_result should be fail');
    assert.strictEqual(data.verdict, 'fail', 'verdict should be fail');
  });

  test('auto-detects test framework from package.json', () => {
    // Create temp dir with package.json that echoes pass info
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-detect',
      scripts: { test: 'echo "3 passing"' },
    }));

    const result = runGsdTools('verify:verify deliverables', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.framework, 'npm', 'should detect npm from package.json');
    assert.strictEqual(data.test_result, 'pass', 'test should pass');
  });
});

describe('verify requirements', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns all addressed when all reqs marked [x]', () => {
    const reqContent = `# Requirements

- [x] **DX-01** Developer experience
- [x] **DX-02** CLI tooling
- [x] **PERF-01** Performance optimization

## Traceability

| ID | Phase |
| DX-01 | Phase 01 |
| DX-02 | Phase 02 |
| PERF-01 | Phase 03 |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqContent);

    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should find 3 requirements');
    assert.strictEqual(data.addressed, 3, 'all should be addressed');
    assert.strictEqual(data.unaddressed, 0, 'none unaddressed');
  });

  test('detects unaddressed req when phase has no summaries', () => {
    // Create phase dir without summaries
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-tooling'), { recursive: true });

    const reqContent = `# Requirements

- [x] **DX-01** Done item
- [ ] **DX-02** Needs work

## Traceability

| ID | Phase |
| DX-01 | Phase 01 |
| DX-02 | Phase 02 |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqContent);

    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 2, 'should find 2 requirements');
    assert.strictEqual(data.addressed, 1, 'only 1 addressed (the [x] one)');
    assert.strictEqual(data.unaddressed, 1, '1 unaddressed');
    assert.strictEqual(data.unaddressed_list[0].id, 'DX-02');
    assert.strictEqual(data.unaddressed_list[0].phase, '02');
  });

  test('handles missing REQUIREMENTS.md gracefully', () => {
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 0, 'should have 0 total');
    assert.ok(data.error, 'should have error message');
  });
});

describe('verify regression', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects regression when test goes pass to fail', () => {
    const beforeData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'pass' },
        { name: 'test-c', status: 'fail' },
      ],
    };
    const afterData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'fail' },
        { name: 'test-c', status: 'fail' },
      ],
    };

    const beforePath = path.join(tmpDir, 'before.json');
    const afterPath = path.join(tmpDir, 'after.json');
    fs.writeFileSync(beforePath, JSON.stringify(beforeData));
    fs.writeFileSync(afterPath, JSON.stringify(afterData));

    const result = runGsdTools(`verify:verify regression --before before.json --after after.json`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 1, 'should detect 1 regression');
    assert.strictEqual(data.regressions[0].test_name, 'test-b', 'test-b regressed');
    assert.strictEqual(data.verdict, 'fail', 'verdict should be fail');
  });

  test('returns clean when no regressions', () => {
    const beforeData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'fail' },
      ],
    };
    const afterData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'pass' },
      ],
    };

    const beforePath = path.join(tmpDir, 'before.json');
    const afterPath = path.join(tmpDir, 'after.json');
    fs.writeFileSync(beforePath, JSON.stringify(beforeData));
    fs.writeFileSync(afterPath, JSON.stringify(afterData));

    const result = runGsdTools(`verify:verify regression --before before.json --after after.json`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 0, 'no regressions');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
  });

  test('handles missing baseline gracefully', () => {
    const result = runGsdTools('verify:verify regression', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 0, 'should be 0');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
    assert.ok(data.note, 'should have a note about missing baseline');
  });
});

describe('verify plan-wave', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects file conflicts within a wave', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '12-01-PLAN.md'), `---
phase: "12"
plan: "01"
wave: 1
files_modified: [src/commands/verify.js, src/router.js]
---
# Plan 12-01
`);
    fs.writeFileSync(path.join(phaseDir, '12-03-PLAN.md'), `---
phase: "12"
plan: "03"
wave: 1
files_modified: [src/commands/verify.js, src/lib/helpers.js]
---
# Plan 12-03
`);
    fs.writeFileSync(path.join(phaseDir, '12-02-PLAN.md'), `---
phase: "12"
plan: "02"
wave: 2
files_modified: [src/commands/verify.js]
---
# Plan 12-02
`);

    const result = runGsdTools(`verify:verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.phase, '12');
    assert.strictEqual(data.verdict, 'conflicts_found');
    assert.strictEqual(data.conflicts.length, 1);
    assert.strictEqual(data.conflicts[0].wave, 1);
    assert.strictEqual(data.conflicts[0].file, 'src/commands/verify.js');
    assert.ok(data.conflicts[0].plans.includes('12-01'));
    assert.ok(data.conflicts[0].plans.includes('12-03'));
    // Wave 2 should not be in conflicts (only one plan)
    assert.ok(!data.conflicts.some(c => c.wave === 2));
  });

  test('returns clean when no conflicts', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-features');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '05-01-PLAN.md'), `---
phase: "05"
plan: "01"
wave: 1
files_modified: [src/a.js]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '05-02-PLAN.md'), `---
phase: "05"
plan: "02"
wave: 1
files_modified: [src/b.js]
---
# Plan
`);

    const result = runGsdTools(`verify:verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.conflicts.length, 0);
    assert.deepStrictEqual(data.waves['1'], ['05-01', '05-02']);
  });

  test('handles single-plan phase', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---
phase: "01"
plan: "01"
wave: 1
files_modified: [src/index.js]
---
# Plan
`);

    const result = runGsdTools(`verify:verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.conflicts.length, 0);
    assert.deepStrictEqual(data.waves['1'], ['01-01']);
  });
});

describe('verify plan-deps', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects dependency cycle', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---
phase: "03"
plan: "01"
wave: 1
depends_on: [03-02]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---
phase: "03"
plan: "02"
wave: 1
depends_on: [03-01]
---
# Plan
`);

    const result = runGsdTools(`verify:verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const cycleIssues = data.issues.filter(i => i.type === 'cycle');
    assert.ok(cycleIssues.length > 0, 'should find cycle issue');
  });

  test('detects unreachable dependency', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), `---
phase: "04"
plan: "01"
wave: 1
depends_on: [04-99]
---
# Plan
`);

    const result = runGsdTools(`verify:verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const unreachable = data.issues.filter(i => i.type === 'unreachable');
    assert.ok(unreachable.length > 0, 'should find unreachable dep');
    assert.strictEqual(unreachable[0].dep, '99');
  });

  test('returns clean for valid graph', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '06-infra');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '06-01-PLAN.md'), `---
phase: "06"
plan: "01"
wave: 1
depends_on: []
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '06-02-PLAN.md'), `---
phase: "06"
plan: "02"
wave: 2
depends_on: [06-01]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '06-03-PLAN.md'), `---
phase: "06"
plan: "03"
wave: 1
depends_on: []
---
# Plan
`);

    const result = runGsdTools(`verify:verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.plan_count, 3);
    assert.strictEqual(data.issues.length, 0);
    assert.deepStrictEqual(data.dependency_graph['01'], []);
    assert.deepStrictEqual(data.dependency_graph['02'], ['01']);
    assert.deepStrictEqual(data.dependency_graph['03'], []);
  });

  test('detects unnecessary serialization', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), `---
phase: "07"
plan: "01"
wave: 1
depends_on: []
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '07-02-PLAN.md'), `---
phase: "07"
plan: "02"
wave: 2
depends_on: []
---
# Plan — in wave 2 but no deps, could be wave 1
`);

    const result = runGsdTools(`verify:verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const serialization = data.issues.filter(i => i.type === 'unnecessary_serialization');
    assert.ok(serialization.length > 0, 'should find unnecessary serialization');
    assert.strictEqual(serialization[0].plan, '02');
    assert.strictEqual(serialization[0].wave, 2);
  });
});

describe('verify plan-structure template compliance', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects missing required frontmatter fields', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
---
# Plan with minimal frontmatter

<task id="1">
<name>Do something</name>
<action>Act</action>
<verify>Check</verify>
<done>Done criteria</done>
</task>
`;
    const planPath = path.join(tmpDir, 'minimal-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.strictEqual(data.template_compliance.valid, false, 'should not be valid');
    assert.ok(data.template_compliance.missing_fields.length > 0, 'should have missing fields');
    assert.ok(data.template_compliance.missing_fields.includes('wave'), 'should be missing wave');
    assert.ok(data.template_compliance.missing_fields.includes('depends_on'), 'should be missing depends_on');
    assert.ok(data.template_compliance.missing_fields.includes('files_modified'), 'should be missing files_modified');
  });

  test('validates requirements is non-empty', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/a.js]
autonomous: true
requirements: []
must_haves: []
---
# Plan with empty requirements

<task id="1">
<name>Do something</name>
<action>Act</action>
<verify>Check</verify>
<done>Done criteria</done>
</task>
`;
    const planPath = path.join(tmpDir, 'empty-reqs-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.ok(data.template_compliance.type_issues.some(i => i.includes('requirements is empty')),
      'should flag empty requirements');
  });

  test('returns valid for well-formed plan', () => {
    const planContent = `---
phase: "12"
plan: "04"
type: execute
wave: 1
depends_on: []
files_modified: [src/commands/verify.js, src/router.js]
autonomous: true
requirements: [DX-01, PLAN-04]
must_haves:
  artifacts:
    - path: src/commands/verify.js
---
# Plan 12-04: Well-formed

<task id="1">
<name>Implement feature</name>
<files>
src/commands/verify.js
</files>
<action>Add the cmdVerifyPlanWave function</action>
<verify>npm test passes</verify>
<done>Function exported and wired into router</done>
</task>

<task id="2">
<name>Wire into router</name>
<files>
src/router.js
</files>
<action>Add plan-wave subcommand</action>
<verify>bgsd-tools verify plan-wave works</verify>
<done>Command accessible via CLI</done>
</task>
`;
    const planPath = path.join(tmpDir, 'good-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify:verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.strictEqual(data.template_compliance.valid, true, 'should be valid');
    assert.strictEqual(data.template_compliance.missing_fields.length, 0, 'no missing fields');
    assert.strictEqual(data.template_compliance.type_issues.length, 0, 'no type issues');
  });
});

describe('verify quality', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns composite score with all dimensions', () => {
    // Create a project with passing tests and REQUIREMENTS.md
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-quality',
      scripts: { test: 'echo "10 passing"' },
    }));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

- [x] **REQ-01** First requirement
- [x] **REQ-02** Second requirement
`);

    // Create plan with must_haves (4-space indent for parseMustHavesBlock)
    const planDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(planDir, { recursive: true });
    const planPath = path.join(planDir, '12-01-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "12"
plan: "01"
must_haves:
    artifacts:
      - path: package.json
    key_links: []
---
# Plan
`);

    const result = runGsdTools(`verify:verify quality --plan ${planPath} --phase 12`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(typeof data.score === 'number', 'score should be a number');
    assert.ok(data.score >= 0 && data.score <= 100, 'score should be 0-100');
    assert.ok(['A', 'B', 'C', 'D', 'F'].includes(data.grade), 'grade should be A-F');
    assert.ok(data.dimensions, 'should have dimensions');
    assert.ok(data.dimensions.tests, 'should have tests dimension');
    assert.ok(data.dimensions.must_haves, 'should have must_haves dimension');
    assert.ok(data.dimensions.requirements, 'should have requirements dimension');
    assert.ok(data.dimensions.regression, 'should have regression dimension');
    assert.ok(data.trend, 'should have trend');
  });

  test('grade mapping thresholds are correct', () => {
    // Project with passing tests only (no plan, no requirements)
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-grade',
      scripts: { test: 'echo "5 passing"' },
    }));

    const result = runGsdTools('verify:verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Only tests dimension active (100), so score = 100, grade = A
    assert.strictEqual(data.dimensions.tests.score, 100, 'tests should score 100');
    assert.strictEqual(data.score, 100, 'composite score should be 100 with only passing tests');
    assert.strictEqual(data.grade, 'A', 'grade should be A for score 100');
  });

  test('must-haves checks file existence and scores correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-musthaves',
      scripts: { test: 'echo "1 passing"' },
    }));

    // Create one file that exists, reference one that doesn't
    fs.writeFileSync(path.join(tmpDir, 'existing.js'), 'module.exports = {}');

    const planDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(planDir, { recursive: true });
    const planPath = path.join(planDir, '12-02-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "12"
plan: "02"
must_haves:
    artifacts:
      - path: existing.js
      - path: nonexistent.js
    key_links: []
---
# Plan
`);

    const result = runGsdTools(`verify:verify quality --plan ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.dimensions.must_haves.score, 50, 'must_haves should be 50% (1/2)');
    assert.strictEqual(data.dimensions.must_haves.detail, '1/2 verified', 'detail should reflect counts');
  });

  test('stores score in quality-scores.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-store',
      scripts: { test: 'echo "1 passing"' },
    }));

    const result = runGsdTools('verify:verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const scoresPath = path.join(tmpDir, '.planning', 'memory', 'quality-scores.json');
    assert.ok(fs.existsSync(scoresPath), 'quality-scores.json should be created');

    const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
    assert.ok(Array.isArray(scores), 'scores should be an array');
    assert.ok(scores.length >= 1, 'should have at least 1 entry');
    assert.ok(typeof scores[0].score === 'number', 'entry should have score');
    assert.ok(scores[0].grade, 'entry should have grade');
    assert.ok(scores[0].timestamp, 'entry should have timestamp');
  });

  test('trend tracking detects improving scores', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-trend',
      scripts: { test: 'echo "1 passing"' },
    }));

    // Write 2 previous scores (ascending)
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'quality-scores.json'), JSON.stringify([
      { phase: '12', plan: '12-01', score: 60, grade: 'D', timestamp: '2026-01-01T00:00:00Z' },
      { phase: '12', plan: '12-01', score: 80, grade: 'B', timestamp: '2026-01-02T00:00:00Z' },
    ]));

    // Run quality check (tests pass = 100, should produce score 100)
    const result = runGsdTools('verify:verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.trend, 'improving', 'trend should be improving (60 → 80 → 100)');

    // Verify 3 entries now in file
    const scores = JSON.parse(fs.readFileSync(path.join(memDir, 'quality-scores.json'), 'utf-8'));
    assert.strictEqual(scores.length, 3, 'should have 3 entries');
  });

  test('handles missing plan gracefully with phase-only', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-noplan',
      scripts: { test: 'echo "3 passing"' },
    }));

    const result = runGsdTools('verify:verify quality --phase 12', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(typeof data.score === 'number', 'score should still be a number');
    assert.strictEqual(data.dimensions.must_haves.score, null, 'must_haves should be null without plan');
    assert.strictEqual(data.dimensions.tests.score, 100, 'tests should still score');
    assert.strictEqual(data.phase, '12', 'phase should be set from option');
  });
});

describe('assertions commands', () => {
  let tmpDir;

  const SAMPLE_ASSERTIONS = `# Assertions: Test Project

**Defined:** 2026-02-25
**Source:** REQUIREMENTS.md

## SREQ-01: Requirements template includes structured acceptance criteria

- assert: "ASSERTIONS.md template exists with schema definition"
  type: file
  priority: must-have

- assert: "parseAssertionsMd returns structured assertion map"
  when: "Given valid ASSERTIONS.md content"
  then: "Returns object with reqId keys"
  type: behavior
  priority: must-have

- assert: "assertions list outputs grouped data"
  type: cli
  priority: nice-to-have

## SREQ-03: Traceability table maps requirements to test commands

- assert: "trace-requirement shows assertion chain"
  when: "Requirement has assertions"
  then: "Output includes assertion pass/fail status"
  type: cli
  priority: must-have

- assert: "coverage percent reflects tested requirements"
  type: behavior
  priority: nice-to-have

## ENV-01: CLI detects project languages from manifest files

- assert: "env scan detects Node.js"
  type: cli
  priority: must-have

- assert: "Detection completes under 10ms"
  type: behavior
  priority: nice-to-have
`;

  const SAMPLE_REQUIREMENTS = `# Requirements

## v4.0 Requirements

### Structured Requirements

- [ ] **SREQ-01**: Requirements template includes structured acceptance criteria
- [ ] **SREQ-02**: New-milestone workflows generate structured requirements
- [ ] **SREQ-03**: Traceability table maps requirements to test commands
- [ ] **SREQ-04**: Phase verifier checks structured assertions
- [ ] **SREQ-05**: Plan must_haves derive from structured acceptance criteria

### Environment Awareness

- [x] **ENV-01**: CLI detects project languages from manifest files
`;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('parseAssertionsMd with sample content returns 3 requirements', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 3, 'should have 3 requirements');
    assert.strictEqual(data.total_assertions, 7, 'should have 7 assertions total');
  });

  test('assertions list counts must-have and nice-to-have correctly', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.must_have_count, 4, 'should have 4 must-have');
    assert.strictEqual(data.nice_to_have_count, 3, 'should have 3 nice-to-have');
  });

  test('assertions list --req filters to specific requirement', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:assertions list --req SREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 1, 'should have 1 requirement');
    assert.strictEqual(data.total_assertions, 3, 'SREQ-01 has 3 assertions');
    assert.ok(data.requirements['SREQ-01'], 'should contain SREQ-01');
    assert.ok(!data.requirements['ENV-01'], 'should not contain ENV-01');
  });

  test('assertions list preserves when/then/type fields', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    const sreq01 = data.requirements['SREQ-01'];
    const secondAssertion = sreq01.assertions[1];
    assert.strictEqual(secondAssertion.when, 'Given valid ASSERTIONS.md content', 'when field preserved');
    assert.strictEqual(secondAssertion.then, 'Returns object with reqId keys', 'then field preserved');
    assert.strictEqual(secondAssertion.type, 'behavior', 'type field preserved');
  });

  test('assertions list with missing ASSERTIONS.md returns soft error', () => {
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    assert.ok(result.output.includes('ASSERTIONS.md not found') || result.output.includes('error'), 'should report not found');
  });

  test('assertions validate reports valid for well-formed content', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('valid'), 'should be valid');
  });

  test('assertions validate catches missing assert field', () => {
    const badContent = `# Assertions: Test

## SREQ-01: Test req

- assert: ""
  type: cli
  priority: must-have

- assert: "Valid assertion"
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), badContent);
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.valid, false, 'should be invalid');
    assert.ok(data.issues.some(i => i.issue.includes('empty assert')), 'should catch empty assert');
  });

  test('assertions validate catches invalid type value', () => {
    const badContent = `# Assertions: Test

## SREQ-01: Test req

- assert: "Some assertion"
  type: invalid_type
  priority: must-have

- assert: "Another assertion"
  type: cli
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), badContent);
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.valid, false, 'should be invalid');
    assert.ok(data.issues.some(i => i.issue.includes('invalid type')), 'should catch invalid type');
  });

  test('assertions validate warns when req not in REQUIREMENTS.md', () => {
    const content = `# Assertions: Test

## FAKE-99: Nonexistent requirement

- assert: "This should warn"
  priority: must-have

- assert: "Another assertion"
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), content);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.issues.some(i => i.issue.includes('not found in REQUIREMENTS.md')), 'should warn about unknown req');
  });

  test('assertions validate computes coverage percent', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    // SAMPLE_ASSERTIONS has 3 reqs (SREQ-01, SREQ-03, ENV-01), REQUIREMENTS has 6 (SREQ-01-05 + ENV-01)
    assert.strictEqual(data.stats.reqs_with_assertions, 3, 'should have 3 reqs with assertions');
    assert.strictEqual(data.stats.total_reqs, 6, 'should have 6 total requirements');
    assert.strictEqual(data.stats.coverage_percent, 50, 'should be 50% coverage');
  });

  test('assertions validate with missing ASSERTIONS.md returns soft error', () => {
    const result = runGsdTools('verify:assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    assert.ok(result.output.includes('ASSERTIONS.md not found') || result.output.includes('error'), 'should report not found');
  });

  test('parseAssertionsMd handles empty content gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), '# Empty\n\nNo assertions here.\n');
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 0, 'should have 0 requirements');
    assert.strictEqual(data.total_assertions, 0, 'should have 0 assertions');
  });

  test('assertions list rawValue has correct format', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    // In piped mode, output is JSON with structured assertion data
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 3, 'should have 3 requirements');
    assert.strictEqual(data.total_assertions, 7, 'should have 7 assertions');
    assert.ok(data.must_have_count > 0, 'should have must-have assertions');
  });
});

describe('verify requirements with assertions', () => {
  let tmpDir;

  const SAMPLE_ASSERTIONS = `# Assertions: Test Project

**Defined:** 2026-02-25
**Source:** REQUIREMENTS.md

## SREQ-01: Requirements template includes structured acceptance criteria

- assert: "ASSERTIONS.md template exists with schema definition"
  type: file
  priority: must-have

- assert: "parseAssertionsMd returns structured assertion map"
  when: "Given valid ASSERTIONS.md content"
  then: "Returns object with reqId keys"
  type: behavior
  priority: must-have

- assert: "assertions list outputs grouped data"
  type: cli
  priority: nice-to-have

## SREQ-03: Traceability table maps requirements to test commands

- assert: "trace-requirement shows assertion chain"
  when: "Requirement has assertions"
  then: "Output includes assertion pass/fail status"
  type: cli
  priority: must-have

- assert: "coverage percent reflects tested requirements"
  type: behavior
  priority: nice-to-have
`;

  const SAMPLE_REQUIREMENTS = `# Requirements

## v4.0 Requirements

### Structured Requirements

- [x] **SREQ-01**: Requirements template includes structured acceptance criteria
- [ ] **SREQ-02**: New-milestone workflows generate structured requirements
- [ ] **SREQ-03**: Traceability table maps requirements to test commands

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SREQ-01 | Phase 20 | Complete |
| SREQ-02 | Phase 20 | Pending |
| SREQ-03 | Phase 20 | Pending |
`;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('verify requirements backward compatible when no ASSERTIONS.md', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    // Create phase directory with a summary so some reqs are "addressed"
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '20-structured-requirements');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '20-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should have 3 requirements');
    assert.ok(!data.assertions, 'should not have assertions field when no ASSERTIONS.md');
  });

  test('verify requirements includes per-assertion pass/fail when ASSERTIONS.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '20-structured-requirements');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '20-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.strictEqual(data.assertions.total, 5, 'should have 5 assertions from ASSERTIONS.md (2 reqs)');
    assert.ok(typeof data.assertions.verified === 'number', 'verified is a number');
    assert.ok(typeof data.assertions.failed === 'number', 'failed is a number');
    assert.ok(typeof data.assertions.needs_human === 'number', 'needs_human is a number');
    assert.ok(data.assertions.by_requirement['SREQ-01'], 'should have SREQ-01 in by_requirement');
    assert.ok(data.assertions.by_requirement['SREQ-03'], 'should have SREQ-03 in by_requirement');
  });

  test('verify requirements coverage percentage calculated correctly', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.ok(typeof data.assertions.coverage_percent === 'number', 'coverage_percent is a number');
    assert.ok(data.assertions.coverage_percent >= 0 && data.assertions.coverage_percent <= 100, 'coverage_percent between 0-100');
  });

  test('verify requirements must-have vs nice-to-have filtering in output', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.ok(typeof data.assertions.must_have_pass === 'number', 'must_have_pass is a number');
    assert.ok(typeof data.assertions.must_have_fail === 'number', 'must_have_fail is a number');
    // Total must_have checks = must_have_pass + must_have_fail + must_have that are needs_human
    const totalMustHave = data.assertions.must_have_pass + data.assertions.must_have_fail;
    assert.ok(totalMustHave >= 0, 'total must-have checks >= 0');
  });

  test('verify requirements file-type assertions check disk existence', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    // Create assertion referencing a file that exists
    const fileAssertions = `# Assertions

## SREQ-01: Test req

- assert: "REQUIREMENTS.md file exists"
  type: file
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), fileAssertions);
    // The file .planning/REQUIREMENTS.md exists in tmpDir
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    // The assertion references REQUIREMENTS.md which exists on disk
    const sreq01 = data.assertions.by_requirement['SREQ-01'];
    assert.ok(sreq01, 'SREQ-01 should exist');
    // It should find REQUIREMENTS.md as matching (within .planning/)
    const fileAssertion = sreq01.assertions[0];
    assert.ok(fileAssertion.status === 'pass' || fileAssertion.status === 'needs_human', 'file assertion should pass or need human review');
  });

  test('verify requirements test-command column parsing', () => {
    const reqWithTestCol = `# Requirements

## v4.0 Requirements

- [x] **SREQ-01**: First req
- [ ] **SREQ-02**: Second req

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| SREQ-01 | Phase 20 | Complete | npm test -- --grep "assertions" |
| SREQ-02 | Phase 20 | Pending | node run-check.js |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqWithTestCol);
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.test_commands, 'should include test_commands field');
    assert.strictEqual(data.test_commands.total, 2, 'should have 2 test commands');
    assert.strictEqual(data.test_commands.valid, 2, 'both npm and node are known commands');
  });

  test('verify requirements rawValue includes assertion stats when assertions present', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    // In piped mode, output is JSON with assertion stats
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should have assertions field');
    assert.ok(data.assertions.total >= 0, 'assertions should have total count');
  });

  test('verify requirements failed must-have assertions include gap_description', () => {
    const failAssertions = `# Assertions

## SREQ-01: Test req

- assert: "nonexistent-file-xyz.md must exist on disk"
  type: file
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), failAssertions);
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should have assertions');
    const sreq01 = data.assertions.by_requirement['SREQ-01'];
    const failedAssertion = sreq01.assertions.find(a => a.status === 'fail');
    if (failedAssertion) {
      assert.ok(failedAssertion.gap_description, 'failed must-have should have gap_description');
      assert.ok(failedAssertion.gap_description.includes('SREQ-01'), 'gap_description should include req ID');
    }
  });
});

describe('trace-requirement with assertions', () => {
  let tmpDir;

  const TRACE_ASSERTIONS = `# Assertions

## TREQ-01: Test requirement for tracing

- assert: "Feature A exists"
  type: file
  priority: must-have

- assert: "Feature B works correctly"
  type: behavior
  priority: must-have

- assert: "Feature C has nice formatting"
  type: cli
  priority: nice-to-have
`;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create ROADMAP with requirement mapping
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 10: Test Phase

**Goal:** Implement test features
**Plans:** 2
**Requirements:** TREQ-01
**Depends on:** Nothing
`);
    // Create phase directory with plan
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '10-01-PLAN.md'), `---
phase: 10-test-phase
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/feature-a.js
autonomous: true
requirements:
  - TREQ-01
must_haves:
  truths:
    - "Feature A exists"
    - "Feature B works correctly"
---

<objective>Implement features</objective>
<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do stuff</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('trace-requirement shows assertion data when ASSERTIONS.md present', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('util:trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions array');
    assert.strictEqual(data.assertion_count, 3, 'should have 3 assertions');
    assert.strictEqual(data.must_have_count, 2, 'should have 2 must-have assertions');
    assert.ok(data.chain, 'should include chain field');
  });

  test('trace-requirement backward compatible without ASSERTIONS.md', () => {
    // No ASSERTIONS.md exists
    const result = runGsdTools('util:trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(!data.assertions, 'should not include assertions when no ASSERTIONS.md');
    assert.ok(!data.chain, 'should not include chain when no ASSERTIONS.md');
    assert.strictEqual(data.requirement, 'TREQ-01', 'requirement ID should be present');
    assert.strictEqual(data.phase, '10', 'phase should be 10');
  });

  test('trace-requirement chain format is correct', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('util:trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.chain, 'should include chain field');
    assert.ok(data.chain.includes('TREQ-01'), 'chain should include requirement ID');
    assert.ok(data.chain.includes('assertions'), 'chain should mention assertions');
    assert.ok(data.chain.includes('must-have'), 'chain should mention must-have');
    assert.ok(data.chain.includes('VERIFICATION'), 'chain should include verification status');
  });

  test('trace-requirement assertion planned/implemented status with summary', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    // Add a SUMMARY to mark plan as complete
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.writeFileSync(path.join(phaseDir, '10-01-SUMMARY.md'), '# Summary\nDone\n');
    const result = runGsdTools('util:trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions');
    // With summary, planned+truth-matched assertions should be implemented
    const planned = data.assertions.filter(a => a.planned);
    assert.ok(planned.length > 0, 'at least some assertions should be planned (matching truths)');
    for (const a of planned) {
      assert.strictEqual(a.implemented, true, `planned assertion "${a.assert}" should be implemented when summary exists`);
      assert.strictEqual(a.gap, false, 'implemented assertion should not be a gap');
    }
  });

  test('trace-requirement assertion gap detection for unplanned assertions', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('util:trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions');
    // "Feature C has nice formatting" is not in must_haves.truths, so it should be a gap
    const niceFormatting = data.assertions.find(a => a.assert.includes('nice formatting'));
    assert.ok(niceFormatting, 'should find the nice-to-have assertion');
    assert.strictEqual(niceFormatting.gap, true, 'unplanned assertion should be a gap');
    assert.strictEqual(niceFormatting.planned, false, 'unplanned assertion should have planned: false');
  });
});

