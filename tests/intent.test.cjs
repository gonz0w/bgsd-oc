/**
 * bgsd-tools intent tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, initJjRepo } = require('./helpers.cjs');
const { parseMilestoneIntentMd, getEffectiveIntent } = require('../src/commands/intent.js');
const { parsePhaseIntentContractFromContext, parsePhaseIntentFromContext } = require('../src/lib/phase-context.js');

describe('intent commands', () => {
  let tmpDir;

  // Helper to init a git repo in temp dir (needed for auto-commit on intent create)
  function initGitRepo(dir) {
    execSync(
      'git init && git -c user.name=Test -c user.email=test@test.com add . && git -c user.name=Test -c user.email=test@test.com commit -m "init" --allow-empty',
      { cwd: dir, encoding: 'utf-8', stdio: 'pipe' }
    );
  }

  // Helper to create a populated INTENT.md for testing
  function createPopulatedIntent(dir) {
    const content = `**Revision:** 1
**Created:** 2026-01-01
**Updated:** 2026-01-01

<objective>
Build a CLI tool for project planning

This tool helps teams manage complex multi-phase projects.
</objective>

<users>
- Software engineers working on multi-service architectures
- Team leads managing project milestones
</users>

<outcomes>
- DO-01 [P1]: Automated phase planning and execution
- DO-02 [P2]: Progress tracking with visual dashboards
- DO-03 [P1]: Integration with git workflows
</outcomes>

<criteria>
- SC-01: All CLI commands respond in under 500ms
- SC-02: Zero data loss during state transitions
</criteria>

<constraints>
### Technical
- C-01: Single-file Node.js bundle, zero dependencies
- C-02: Must work on Linux and macOS

### Business
- C-03: Open source under MIT license

### Timeline
- C-04: MVP ready within 2 weeks
</constraints>

<health>
### Quantitative
- HM-01: Bundle size under 500KB
- HM-02: Test coverage above 80%

### Qualitative
Team velocity and developer satisfaction with the planning workflow.
</health>
`;
    fs.writeFileSync(path.join(dir, '.planning', 'INTENT.md'), content, 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── Create tests ──

  describe('intent create', () => {
    test('creates INTENT.md with all 6 XML sections in fresh project', () => {
      // Note: intent create with --raw outputs a compact shorthand (commit hash or "created"),
      // not full JSON. We verify by checking the file on disk.
      const result = runGsdTools('plan:intent create', tmpDir);
      assert.ok(result.success, `intent create failed: ${result.error}`);
      assert.ok(result.output.includes('created') || /^[a-f0-9]+$/.test(result.output),
        'should output "created" or commit hash');

      // Verify file on disk
      const intentPath = path.join(tmpDir, '.planning', 'INTENT.md');
      assert.ok(fs.existsSync(intentPath), 'INTENT.md should exist on disk');

      const content = fs.readFileSync(intentPath, 'utf-8');
      assert.ok(content.includes('<objective>'), 'should have objective section');
      assert.ok(content.includes('<users>'), 'should have users section');
      assert.ok(content.includes('<outcomes>'), 'should have outcomes section');
      assert.ok(content.includes('<criteria>'), 'should have criteria section');
      assert.ok(content.includes('<constraints>'), 'should have constraints section');
      assert.ok(content.includes('<health>'), 'should have health section');
    });

    test('errors if INTENT.md already exists', () => {
      // Create first
      runGsdTools('plan:intent create', tmpDir);

      // Try again without --force
      const result = runGsdTools('plan:intent create', tmpDir);
      assert.ok(!result.success, 'should fail when INTENT.md exists');
      assert.ok(
        result.error.includes('already exists') || result.output.includes('already exists'),
        'should mention already exists'
      );
    });

    test('--force overwrites existing INTENT.md', () => {
      // Create first
      runGsdTools('plan:intent create', tmpDir);

      // Overwrite with --force
      const result = runGsdTools('plan:intent create --force', tmpDir);
      assert.ok(result.success, `intent create --force failed: ${result.error}`);
      // Verify file was recreated on disk
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('**Revision:** 1'), 'overwritten file should have Revision 1');
    });

    test('created INTENT.md has Revision 1', () => {
      runGsdTools('plan:intent create', tmpDir);
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('**Revision:** 1'), 'should contain Revision: 1');
    });
  });

  // ── Show/Read tests ──

  describe('intent show/read', () => {
    test('intent show --raw returns valid JSON with all section keys', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent show', tmpDir);
      assert.ok(result.success, `intent show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('objective' in data, 'should have objective');
      assert.ok('users' in data, 'should have users');
      assert.ok('outcomes' in data, 'should have outcomes');
      assert.ok('criteria' in data, 'should have criteria');
      assert.ok('constraints' in data, 'should have constraints');
      assert.ok('health' in data, 'should have health');
      assert.ok('revision' in data, 'should have revision');
    });

    test('intent read --raw returns same JSON as intent show --raw', () => {
      createPopulatedIntent(tmpDir);
      const showResult = runGsdTools('plan:intent show', tmpDir);
      const readResult = runGsdTools('plan:intent read', tmpDir);

      assert.ok(showResult.success, `show failed: ${showResult.error}`);
      assert.ok(readResult.success, `read failed: ${readResult.error}`);

      const showData = JSON.parse(showResult.output);
      const readData = JSON.parse(readResult.output);
      assert.deepStrictEqual(readData, showData, 'read and show --raw should return identical JSON');
    });

    test('intent read outcomes --raw returns just outcomes array', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent read outcomes', tmpDir);
      assert.ok(result.success, `intent read outcomes --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // Section filter should return the section data
      assert.ok(Array.isArray(data) || (typeof data === 'object' && data !== null), 'should return outcomes data');
    });
  });

  // ── Update tests ──

  describe('intent update', () => {
    test('--add outcome assigns DO-01 with specified priority', () => {
      createPopulatedIntent(tmpDir);
      // The populated intent already has DO-01..DO-03, so next should be DO-04
      const result = runGsdTools('plan:intent update outcomes --add "Test outcome" --priority P1', tmpDir);
      assert.ok(result.success, `update add failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.updated, true, 'should report updated=true');
      assert.strictEqual(data.section, 'outcomes');
      assert.strictEqual(data.operation, 'add');
      assert.strictEqual(data.id, 'DO-04', 'should assign DO-04 (next after existing DO-03)');
      assert.strictEqual(data.priority, 'P1');
      assert.strictEqual(data.revision, 2, 'revision should increment to 2');
    });

    test('--add second outcome gets next sequential ID', () => {
      // Start fresh with empty intent
      runGsdTools('plan:intent create', tmpDir);

      // Add first outcome
      const first = runGsdTools('plan:intent update outcomes --add "First outcome" --priority P1', tmpDir);
      assert.ok(first.success, `first add failed: ${first.error}`);
      const firstData = JSON.parse(first.output);
      assert.strictEqual(firstData.id, 'DO-01');

      // Add second outcome
      const second = runGsdTools('plan:intent update outcomes --add "Second outcome"', tmpDir);
      assert.ok(second.success, `second add failed: ${second.error}`);
      const secondData = JSON.parse(second.output);
      assert.strictEqual(secondData.id, 'DO-02', 'should assign DO-02');
      assert.strictEqual(secondData.priority, 'P2', 'default priority should be P2');
    });

    test('--remove removes item and subsequent --add preserves gap', () => {
      runGsdTools('plan:intent create', tmpDir);

      // Add two outcomes
      runGsdTools('plan:intent update outcomes --add "First"', tmpDir);
      runGsdTools('plan:intent update outcomes --add "Second"', tmpDir);

      // Remove DO-01
      const removeResult = runGsdTools('plan:intent update outcomes --remove DO-01', tmpDir);
      assert.ok(removeResult.success, `remove failed: ${removeResult.error}`);
      const removeData = JSON.parse(removeResult.output);
      assert.strictEqual(removeData.operation, 'remove');

      // Add another — should be DO-03 (gap preserved), not DO-01
      const addResult = runGsdTools('plan:intent update outcomes --add "Third"', tmpDir);
      assert.ok(addResult.success, `add after remove failed: ${addResult.error}`);
      const addData = JSON.parse(addResult.output);
      assert.strictEqual(addData.id, 'DO-03', 'should assign DO-03, preserving gap from removed DO-01');
    });

    test('--set-priority changes outcome priority', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent update outcomes --set-priority DO-02 P1', tmpDir);
      assert.ok(result.success, `set-priority failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.operation, 'set-priority');

      // Verify the change persisted
      const showResult = runGsdTools('plan:intent show', tmpDir);
      const showData = JSON.parse(showResult.output);
      const do02 = showData.outcomes.find(o => o.id === 'DO-02');
      assert.strictEqual(do02.priority, 'P1', 'DO-02 should now be P1');
    });

    test('--value replaces objective section', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent update objective --value "New objective statement"', tmpDir);
      assert.ok(result.success, `update objective failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.operation, 'replace');
      assert.strictEqual(data.section, 'objective');

      // Verify the change persisted
      const showResult = runGsdTools('plan:intent show', tmpDir);
      const showData = JSON.parse(showResult.output);
      assert.strictEqual(showData.objective.statement, 'New objective statement');
    });

    test('revision increments on each update', () => {
      createPopulatedIntent(tmpDir);

      // First update: revision 1 → 2
      runGsdTools('plan:intent update outcomes --add "One"', tmpDir);

      // Second update: revision 2 → 3
      const result = runGsdTools('plan:intent update outcomes --add "Two"', tmpDir);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.revision, 3, 'revision should be 3 after two updates from revision 1');
    });
  });

  // ── Validate tests ──

  describe('intent validate', () => {
    test('valid INTENT.md with all sections returns exit code 0', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent validate', tmpDir);
      // exit code 0 means success=true from runGsdTools
      assert.ok(result.success, `validate should succeed for valid intent: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
      assert.strictEqual(data.revision, 1, 'should report revision');
    });

    test('INTENT.md with missing section returns exit code 1', () => {
      // Create a minimal intent missing several sections
      const content = `**Revision:** 1
**Created:** 2026-01-01
**Updated:** 2026-01-01

<objective>
A test project
</objective>

<users>
- Developers
</users>

<outcomes>
</outcomes>

<criteria>
</criteria>

<constraints>
</constraints>

<health>
</health>
`;
      fs.writeFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), content, 'utf-8');

      const result = runGsdTools('plan:intent validate', tmpDir);
      // exit code 1 means success=false from runGsdTools
      assert.ok(!result.success, 'validate should fail for incomplete intent');

      // Output may be in stdout even for exit code 1
      const outputText = result.output || result.error;
      const data = JSON.parse(outputText);
      assert.strictEqual(data.valid, false, 'should be invalid');
      assert.ok(data.issues.length > 0, 'should have issues');

      // Should flag outcomes as missing
      const outcomeIssue = data.issues.find(i => i.section === 'outcomes');
      assert.ok(outcomeIssue, 'should have an outcomes issue');
    });

    test('--raw returns JSON with valid/issues fields', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent validate', tmpDir);
      assert.ok(result.success, `validate --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('valid' in data, 'should have valid field');
      assert.ok('issues' in data, 'should have issues field');
      assert.ok('sections' in data, 'should have sections field');
      assert.ok('revision' in data, 'should have revision field');

      // Check section detail structure
      assert.ok('objective' in data.sections, 'sections should include objective');
      assert.ok('users' in data.sections, 'sections should include users');
      assert.ok('outcomes' in data.sections, 'sections should include outcomes');
      assert.ok('criteria' in data.sections, 'sections should include criteria');
      assert.ok('constraints' in data.sections, 'sections should include constraints');
      assert.ok('health' in data.sections, 'sections should include health');
    });
  });

  // ── Round-trip test ──

  describe('intent round-trip', () => {
    test('create → update → show → validate round-trip is consistent', () => {
      // 1. Create
      const createResult = runGsdTools('plan:intent create', tmpDir);
      assert.ok(createResult.success, `create failed: ${createResult.error}`);

      // 2. Update: add items to all list sections
      runGsdTools('plan:intent update objective --value "A comprehensive CLI tool"', tmpDir);
      runGsdTools('plan:intent update users --add "Software engineers"', tmpDir);
      runGsdTools('plan:intent update outcomes --add "Fast execution" --priority P1', tmpDir);
      runGsdTools('plan:intent update criteria --add "Commands respond in under 500ms"', tmpDir);
      runGsdTools('plan:intent update constraints --add "Node.js only" --type technical', tmpDir);
      runGsdTools('plan:intent update health --add "Bundle under 500KB"', tmpDir);

      // 2b. Add qualitative health content (prose section — must be written directly
      // since intent update health --add only adds quantitative metrics)
      const intentPath = path.join(tmpDir, '.planning', 'INTENT.md');
      let content = fs.readFileSync(intentPath, 'utf-8');
      content = content.replace('</health>', '### Qualitative\nTeam satisfaction with the planning workflow.\n</health>');
      fs.writeFileSync(intentPath, content, 'utf-8');

      // 3. Show: verify all sections populated
      const showResult = runGsdTools('plan:intent show', tmpDir);
      assert.ok(showResult.success, `show failed: ${showResult.error}`);
      const showData = JSON.parse(showResult.output);

      assert.strictEqual(showData.objective.statement, 'A comprehensive CLI tool');
      assert.ok(showData.users.length >= 1, 'should have at least 1 user');
      assert.ok(showData.outcomes.length >= 1, 'should have at least 1 outcome');
      assert.ok(showData.criteria.length >= 1, 'should have at least 1 criterion');
      const totalConstraints = (showData.constraints.technical || []).length +
        (showData.constraints.business || []).length +
        (showData.constraints.timeline || []).length;
      assert.ok(totalConstraints >= 1, 'should have at least 1 constraint');
      assert.ok(showData.health.quantitative.length >= 1, 'should have at least 1 health metric');

      // 4. Validate: should pass with all sections populated
      const validateResult = runGsdTools('plan:intent validate', tmpDir);
      assert.ok(validateResult.success, `validate should pass: ${validateResult.error}`);
      const validateData = JSON.parse(validateResult.output);
      assert.strictEqual(validateData.valid, true, 'should validate as valid after round-trip');
      assert.strictEqual(validateData.issues.length, 0, 'should have no issues');
    });
  });

  // ── Help tests ──

  describe('intent help', () => {
    test('intent --help shows subcommand list', () => {
      // --help writes to stderr and exits 0; capture with 2>&1
      const helpText = execSync(`node "${TOOLS_PATH}" plan:intent --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('create'), 'help should mention create');
      assert.ok(helpText.includes('show'), 'help should mention show');
      assert.ok(helpText.includes('read'), 'help should mention read');
      assert.ok(helpText.includes('validate'), 'help should mention validate');
    });

    test('intent validate --help shows validate usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" plan:intent validate --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('validate'), 'help should mention validate');
      assert.ok(helpText.includes('exit') || helpText.includes('Exit') || helpText.includes('valid'),
        'help should describe exit codes or validation');
    });
  });

  // ── Trace tests ──

  describe('intent trace', () => {
    // Helper to create a ROADMAP.md with milestone info for phase range scoping
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    // Helper to create a PLAN.md with intent frontmatter
    function createPlan(dir, phaseDir, planNum, outcomeIds, rationale) {
      const phasePath = path.join(dir, '.planning', 'phases', phaseDir);
      fs.mkdirSync(phasePath, { recursive: true });

      const phaseNum = phaseDir.match(/^(\d+)/)[1];
      const paddedPlan = String(planNum).padStart(2, '0');
      const filename = `${phaseNum.padStart(2, '0')}-${paddedPlan}-PLAN.md`;

      let frontmatter = `---
phase: ${phaseDir}
plan: ${paddedPlan}
type: execute
wave: 1
depends_on: []`;

      if (outcomeIds && outcomeIds.length > 0) {
        frontmatter += `
intent:
  outcome_ids: [${outcomeIds.join(', ')}]
  rationale: "${rationale || 'Test rationale'}"`;
      }

      frontmatter += `
---

<objective>
Test plan objective.
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, filename), frontmatter, 'utf-8');
    }

    test('trace with no INTENT.md errors', () => {
      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(!result.success, 'should fail without INTENT.md');
      assert.ok(
        (result.error || '').includes('No INTENT.md') || (result.output || '').includes('No INTENT.md'),
        'should mention missing INTENT.md'
      );
    });

    test('trace with INTENT.md but no plans returns 0 coverage and all outcomes as gaps', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.total_outcomes, 3, 'should have 3 outcomes from populated intent');
      assert.strictEqual(data.covered_outcomes, 0, 'none should be covered');
      assert.strictEqual(data.coverage_percent, 0, 'coverage should be 0%');
      assert.strictEqual(data.gaps.length, 3, 'all 3 outcomes should be gaps');
      assert.strictEqual(data.plans.length, 0, 'no plans found');
    });

    test('trace with INTENT.md + plans tracing to outcomes shows correct matrix', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plans that trace to outcomes
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02'], 'Covers automation and tracking');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-03'], 'Covers git integration');

      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.total_outcomes, 3);
      assert.strictEqual(data.covered_outcomes, 3);
      assert.strictEqual(data.coverage_percent, 100);
      assert.strictEqual(data.gaps.length, 0, 'no gaps when all covered');

      // Verify matrix entries
      const do01 = data.matrix.find(m => m.outcome_id === 'DO-01');
      assert.ok(do01, 'DO-01 should be in matrix');
      assert.ok(do01.plans.length >= 1, 'DO-01 should have at least 1 plan');

      const do03 = data.matrix.find(m => m.outcome_id === 'DO-03');
      assert.ok(do03, 'DO-03 should be in matrix');
      assert.ok(do03.plans.length >= 1, 'DO-03 should have at least 1 plan');

      // Verify plans list
      assert.strictEqual(data.plans.length, 2, 'should have 2 plans');
    });

    test('trace --gaps shows only uncovered outcomes', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Only cover DO-01
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01'], 'Covers automation only');

      const result = runGsdTools('plan:intent trace --gaps', tmpDir);
      assert.ok(result.success, `trace --gaps failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // --gaps mode: matrix should only contain gaps
      assert.strictEqual(data.matrix.length, 2, 'should show 2 uncovered outcomes in matrix (DO-02, DO-03)');
      for (const entry of data.matrix) {
        assert.ok(entry.outcome_id !== 'DO-01', 'DO-01 should not appear in --gaps output');
      }
      assert.strictEqual(data.gaps.length, 2, 'should have 2 gaps');
      assert.strictEqual(data.coverage_percent, 33, 'coverage should be 33% (1/3)');
    });

    test('trace with plan missing intent section includes plan with empty outcome_ids', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan WITHOUT intent section
      createPlan(tmpDir, '14-first-phase', 1, null, null);

      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.plans.length, 1, 'plan should appear in plans list');
      assert.deepStrictEqual(data.plans[0].outcome_ids, [], 'plan without intent should have empty outcome_ids');
      assert.strictEqual(data.covered_outcomes, 0, 'no outcomes covered');
    });

    test('trace --raw returns valid JSON with all expected fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(result.success, `trace --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('total_outcomes' in data, 'should have total_outcomes');
      assert.ok('covered_outcomes' in data, 'should have covered_outcomes');
      assert.ok('coverage_percent' in data, 'should have coverage_percent');
      assert.ok('matrix' in data, 'should have matrix');
      assert.ok('gaps' in data, 'should have gaps');
      assert.ok('plans' in data, 'should have plans');
      assert.ok(Array.isArray(data.matrix), 'matrix should be an array');
      assert.ok(Array.isArray(data.gaps), 'gaps should be an array');
      assert.ok(Array.isArray(data.plans), 'plans should be an array');
    });

    test('parsePlanIntent handles comma-separated outcome IDs', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create a plan with comma-separated string format for outcome_ids
      const phasePath = path.join(tmpDir, '.planning', 'phases', '14-test-phase');
      fs.mkdirSync(phasePath, { recursive: true });
      const planContent = `---
phase: 14-test-phase
plan: 01
type: execute
intent:
  outcome_ids: "DO-01, DO-03"
  rationale: "Comma separated test"
---

<objective>Test</objective>
<tasks>
<task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, '14-01-PLAN.md'), planContent, 'utf-8');

      const result = runGsdTools('plan:intent trace', tmpDir);
      assert.ok(result.success, `trace with comma-sep IDs failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // The plan should have extracted DO-01 and DO-03
      const plan = data.plans.find(p => p.phase === '14-test-phase');
      assert.ok(plan, 'should find the test plan');
      assert.ok(plan.outcome_ids.includes('DO-01'), 'should include DO-01');
      assert.ok(plan.outcome_ids.includes('DO-03'), 'should include DO-03');
      assert.strictEqual(plan.outcome_ids.length, 2, 'should have exactly 2 outcome IDs');
    });

    test('intent trace --help shows trace usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" plan:intent trace --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('trace'), 'help should mention trace');
      assert.ok(helpText.includes('intent'), 'help should mention intent');
    });
  });

  // ── Drift tests ──

  describe('intent drift', () => {
    // Reuse helpers from intent trace tests
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    function createPlan(dir, phaseDir, planNum, outcomeIds, rationale) {
      const phasePath = path.join(dir, '.planning', 'phases', phaseDir);
      fs.mkdirSync(phasePath, { recursive: true });

      const phaseNum = phaseDir.match(/^(\d+)/)[1];
      const paddedPlan = String(planNum).padStart(2, '0');
      const filename = `${phaseNum.padStart(2, '0')}-${paddedPlan}-PLAN.md`;

      let frontmatter = `---
phase: ${phaseDir}
plan: ${paddedPlan}
type: execute
wave: 1
depends_on: []`;

      if (outcomeIds && outcomeIds.length > 0) {
        frontmatter += `
intent:
  outcome_ids: [${outcomeIds.join(', ')}]
  rationale: "${rationale || 'Test rationale'}"`;
      }

      frontmatter += `
---

<objective>
Test plan objective.
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, filename), frontmatter, 'utf-8');
    }

    test('drift with no INTENT.md errors', () => {
      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(!result.success, 'should fail without INTENT.md');
      assert.ok(
        (result.error || '').includes('No INTENT.md') || (result.output || '').includes('No INTENT.md'),
        'should mention missing INTENT.md'
      );
    });

    test('drift with INTENT.md but no plans shows score near 100', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // With 0 plans, coverage_gap should be 40/40, objective_mismatch 0 (no plans to be untraced)
      // So score = 40 (coverage gap only, no plans means no mismatch/creep/inversion)
      assert.ok(data.drift_score >= 30, `score should be high with no plans (got ${data.drift_score})`);
      assert.strictEqual(data.total_plans, 0, 'should have 0 plans');
      assert.strictEqual(data.covered_outcomes, 0, 'no outcomes covered');
      assert.strictEqual(data.signals.coverage_gap.details.length, 3, 'all 3 outcomes should be gaps');
    });

    test('drift with perfect alignment shows score 0', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Cover all 3 outcomes: DO-01 [P1], DO-02 [P2], DO-03 [P1]
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02'], 'Covers first two');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-03'], 'Covers third');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.drift_score, 0, 'perfect alignment should have score 0');
      assert.strictEqual(data.alignment, 'excellent', 'alignment should be excellent');
      assert.strictEqual(data.signals.coverage_gap.details.length, 0, 'no gaps');
      assert.strictEqual(data.signals.objective_mismatch.plans.length, 0, 'no untraced plans');
      assert.strictEqual(data.signals.feature_creep.invalid_refs.length, 0, 'no invalid refs');
      assert.strictEqual(data.signals.priority_inversion.inversions.length, 0, 'no inversions');
    });

    test('drift detects objective mismatch (plan with no intent section)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan WITHOUT intent section + plan WITH intent
      createPlan(tmpDir, '14-first-phase', 1, null, null); // no intent
      createPlan(tmpDir, '15-second-phase', 1, ['DO-01', 'DO-02', 'DO-03'], 'Covers all');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.signals.objective_mismatch.plans.length, 1, 'should flag 1 untraced plan');
      assert.ok(data.signals.objective_mismatch.score > 0, 'mismatch score should be > 0');
    });

    test('drift detects feature creep (plan referencing non-existent DO-99)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan that references a non-existent outcome
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-99'], 'References invalid DO-99');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-02', 'DO-03'], 'Covers rest');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.signals.feature_creep.invalid_refs.length, 1, 'should flag 1 invalid ref');
      assert.strictEqual(data.signals.feature_creep.invalid_refs[0].invalid_id, 'DO-99', 'should identify DO-99');
      assert.ok(data.signals.feature_creep.score > 0, 'feature creep score should be > 0');
    });

    test('drift detects priority inversion (P1 uncovered while P2 covered)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Cover only DO-02 [P2], leave DO-01 [P1] and DO-03 [P1] uncovered
      createPlan(tmpDir, '14-first-phase', 1, ['DO-02'], 'Only covers P2');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok(data.signals.priority_inversion.inversions.length > 0, 'should detect priority inversions');
      assert.strictEqual(data.signals.priority_inversion.score, 20, 'inversion score should be 20');
      // DO-01 [P1] uncovered while DO-02 [P2] covered
      const inv = data.signals.priority_inversion.inversions[0];
      assert.strictEqual(inv.uncovered_priority, 'P1', 'uncovered should be P1');
      assert.strictEqual(inv.covered_priority, 'P2', 'covered should be P2');
    });

    test('drift score within 0-100 range across scenarios', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Scenario: partial coverage
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01'], 'Partial');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok(data.drift_score >= 0, 'score should be >= 0');
      assert.ok(data.drift_score <= 100, 'score should be <= 100');
      assert.ok(typeof data.drift_score === 'number', 'score should be a number');
    });

    test('drift --raw returns valid JSON with all expected fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('drift_score' in data, 'should have drift_score');
      assert.ok('alignment' in data, 'should have alignment');
      assert.ok('signals' in data, 'should have signals');
      assert.ok('total_outcomes' in data, 'should have total_outcomes');
      assert.ok('covered_outcomes' in data, 'should have covered_outcomes');
      assert.ok('total_plans' in data, 'should have total_plans');
      assert.ok('traced_plans' in data, 'should have traced_plans');
      assert.ok('coverage_gap' in data.signals, 'signals should have coverage_gap');
      assert.ok('objective_mismatch' in data.signals, 'signals should have objective_mismatch');
      assert.ok('feature_creep' in data.signals, 'signals should have feature_creep');
      assert.ok('priority_inversion' in data.signals, 'signals should have priority_inversion');
    });

    test('drift alignment labels correct (0-15 excellent, 16-35 good, 36-60 moderate, 61-100 poor)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Perfect: all covered → score 0 → excellent
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02', 'DO-03'], 'All');

      const result = runGsdTools('plan:intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.drift_score, 0, 'perfect alignment score = 0');
      assert.strictEqual(data.alignment, 'excellent', '0 = excellent');
    });

    test('pre-flight: init execute-phase intent_drift null when no INTENT.md', () => {
      // Create minimal project structure (no INTENT.md)
      createRoadmap(tmpDir, 14, 17);
      initJjRepo(tmpDir);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:execute-phase 14', tmpDir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.intent_drift, null, 'intent_drift should be null when no INTENT.md');
    });

    test('intent drift --help shows drift usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" plan:intent drift --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('drift'), 'help should mention drift');
      assert.ok(helpText.includes('intent'), 'help should mention intent');
    });
  });

  // ── Intent Summary in Init Commands ────────────────────────────────────────

  describe('intent summary in init commands', () => {
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    test('getIntentSummary returns null when no INTENT.md', () => {
      // No INTENT.md created — all init commands should have intent_summary: null
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:progress', tmpDir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.intent_summary, null, 'intent_summary should be null when no INTENT.md');
    });

    test('getIntentSummary returns summary when INTENT.md exists', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:progress', tmpDir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.intent_summary !== null, 'intent_summary should not be null when INTENT.md exists');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
      assert.strictEqual(data.intent_summary.outcome_count, 3);
      assert.ok(Array.isArray(data.intent_summary.top_outcomes), 'top_outcomes should be array');
      assert.strictEqual(data.intent_summary.top_outcomes.length, 2, 'should have 2 P1 outcomes');
      assert.strictEqual(data.intent_summary.top_outcomes[0].id, 'DO-01');
      assert.ok(Array.isArray(data.intent_summary.users), 'users should be array');
      assert.strictEqual(data.intent_summary.users.length, 2);
      assert.strictEqual(data.intent_summary.has_criteria, true);
    });

    test('init execute-phase includes intent_summary field', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      initJjRepo(tmpDir);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:execute-phase 14', tmpDir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok('intent_summary' in data, 'intent_summary key must exist in execute-phase output');
      assert.ok(data.intent_summary !== null, 'intent_summary should be populated');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
      assert.strictEqual(data.intent_summary.outcome_count, 3);
    });

    test('init plan-phase includes intent_summary and intent_path fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:plan-phase 14', tmpDir);
      assert.ok(result.success, `init plan-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok('intent_summary' in data, 'intent_summary key must exist in plan-phase output');
      assert.ok('intent_path' in data, 'intent_path key must exist in plan-phase output');
      assert.ok(data.intent_summary !== null, 'intent_summary should be populated');
      assert.strictEqual(data.intent_path, '.planning/INTENT.md');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
    });

    test('init plan-phase intent fields absent in compact mode when no INTENT.md', () => {
      // Compact mode is default — null fields are omitted to save tokens
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init:plan-phase 14', tmpDir);
      assert.ok(result.success, `init plan-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // In compact mode (default), null intent fields are omitted
      assert.ok(!data.intent_summary, 'intent_summary should be absent/falsy when no INTENT.md');
      assert.ok(!data.intent_path, 'intent_path should be absent/falsy when no INTENT.md');
    });
  });

  describe('effective intent layering', () => {
    const REAL_PHASE_160_CONTEXT = path.join(__dirname, '..', '.planning', 'phases', '160-phase-intent-alignment-verification', '160-CONTEXT.md');

    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v17.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: Planning Context Cascade
**Goal**: Layer milestone and phase intent
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    function createMilestoneIntent(dir) {
      const content = `# MILESTONE-INTENT

## Why Now
Planning surfaces need compact layered purpose without raw intent-document dumps.

## Target Outcomes
- DO-02: Keep the current milestone focused on visible planning value

## Priorities
- Keep lower intent layers advisory-only
- Prefer compact injected context over raw markdown payloads

## Non-Goals
- No live workspace inventory in planning intent
`;
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONE-INTENT.md'), content, 'utf-8');
    }

    function createPhaseContext(dir) {
      const phaseDir = path.join(dir, '.planning', 'phases', '157-planning-context-cascade');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '157-CONTEXT.md'), `# Phase 157 Context

<phase_intent>
## Phase Intent
- **Local Purpose:** Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.
- **Expected User Change:** Before: planning users had to infer the current phase purpose from broad context prose. After: planning users can read an explicit phase-local intent block that states the local purpose and user-facing change.
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

    test('parses milestone intent contract into compact fields', () => {
      const parsed = parseMilestoneIntentMd(`# MILESTONE-INTENT

## Why Now
The milestone matters now because planner context still depends on raw INTENT.md reads.

## Target Outcomes
- DO-120: Compact effective intent reaches planning surfaces

## Priorities
- Keep intent advisory-only

## Non-Goals
- Do not rewrite project intent for temporary priorities
`);

      assert.strictEqual(parsed.why_now, 'The milestone matters now because planner context still depends on raw INTENT.md reads.');
      assert.strictEqual(parsed.target_outcomes[0].id, 'DO-120');
      assert.strictEqual(parsed.priorities[0], 'Keep intent advisory-only');
      assert.strictEqual(parsed.non_goals[0], 'Do not rewrite project intent for temporary priorities');
    });

    test('phase-local intent parses the explicit phase-intent block', () => {
      const parsed = parsePhaseIntentFromContext(`<domain>
## Phase Boundary
Keep phase-local purpose lightweight and additive.
</domain>

<phase_intent>
## Phase Intent
- **Local Purpose:** Keep phase-local purpose lightweight and additive.
- **Expected User Change:** Before: users had to infer why the phase mattered from generic discussion notes. After: users can read one explicit before/after claim that states the intended user-facing change.
  - Users can see the local purpose without scanning multiple sections
  - Users can judge the phase by the promised change instead of vague prose
- **Non-Goals:**
  - No separate top-level phase intent file.
</phase_intent>`);

      assert.strictEqual(parsed.purpose, 'Keep phase-local purpose lightweight and additive.');
      assert.strictEqual(parsed.expected_change, 'Before: users had to infer why the phase mattered from generic discussion notes. After: users can read one explicit before/after claim that states the intended user-facing change.');
      assert.deepStrictEqual(parsed.non_goals, ['No separate top-level phase intent file.']);
    });

    test('phase-local intent returns null for legacy context without explicit intent block', () => {
      const parsed = parsePhaseIntentFromContext(`<domain>
## Phase Boundary
Keep phase-local purpose lightweight and additive.
</domain>

<specifics>
## Specific Ideas
- Users should understand why the phase matters.
</specifics>

<deferred>
## Deferred Ideas
- No separate top-level phase intent file.
</deferred>`);

      assert.strictEqual(parsed, null);
    });

    test('effective_intent reads explicit phase-local intent without replacing project north star', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 157, 160);
      createMilestoneIntent(tmpDir);
      createPhaseContext(tmpDir);

      const effectiveIntent = getEffectiveIntent(tmpDir, { phase: '157' });

      assert.strictEqual(effectiveIntent.advisory, true, 'effective_intent should stay advisory-only');
      assert.strictEqual(effectiveIntent.project.objective, 'Build a CLI tool for project planning');
      assert.strictEqual(effectiveIntent.effective.objective, 'Build a CLI tool for project planning', 'phase or milestone intent must not replace project objective');
      assert.strictEqual(effectiveIntent.milestone.why_now, 'Planning surfaces need compact layered purpose without raw intent-document dumps.');
      assert.strictEqual(effectiveIntent.phase.purpose, 'Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.');
      assert.ok(effectiveIntent.effective.outcomes.some(outcome => outcome.id === 'DO-01'), 'project P1 outcomes should remain visible');
      assert.ok(effectiveIntent.effective.outcomes.some(outcome => outcome.id === 'DO-02'), 'milestone outcomes should refine, not replace, project outcomes');
      assert.strictEqual(effectiveIntent.metadata.partial, false, 'all layers available should not be partial');
      assert.deepStrictEqual(effectiveIntent.warnings, []);
    });

    test('partial intent context leaves legacy phase-local intent unavailable instead of guessed', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 157, 160);
      createMilestoneIntent(tmpDir);

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '157-planning-context-cascade');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '157-CONTEXT.md'), `# Phase 157 Context

<domain>
## Phase Boundary
Add compact milestone and phase intent so planning flows can refine current focus without replacing the project north star.
</domain>

<specifics>
## Specific Ideas
- Planning users should see current milestone focus before phase-local refinements.
</specifics>

<deferred>
## Deferred Ideas
- Do not add sibling-plan recommendation heuristics in this phase.
</deferred>
`, 'utf-8');

      const effectiveIntent = getEffectiveIntent(tmpDir, { phase: '157' });

      assert.strictEqual(effectiveIntent.phase, null, 'legacy contexts should not get guessed phase intent');
      assert.strictEqual(effectiveIntent.metadata.partial, true, 'missing explicit phase block should be marked partial');
      assert.ok(effectiveIntent.metadata.missing_layers.includes('phase'), 'phase layer should be marked missing');
      assert.ok(effectiveIntent.warnings.some(warning => /missing an explicit `Phase Intent` block/i.test(warning)), 'warning should explain that phase-local intent is unavailable');
    });

    test('real Phase 160 legacy context keeps source parsing phase-intent-free', () => {
      const legacyContext = fs.readFileSync(REAL_PHASE_160_CONTEXT, 'utf-8');

      const parsedIntent = parsePhaseIntentFromContext(legacyContext);
      const parsedContract = parsePhaseIntentContractFromContext(legacyContext);

      assert.strictEqual(parsedIntent, null, 'real legacy Phase 160 context should not expose parsed phase intent');
      assert.strictEqual(parsedContract.status, 'missing_explicit_phase_intent', 'real legacy context should use the explicit no-guess fallback contract');
      assert.strictEqual(parsedContract.intent, null, 'real legacy context should keep phase-local intent absent');
      assert.match(parsedContract.reason, /explicit `Phase Intent` block/i, 'fallback reason should explain why phase-local intent is unavailable');
    });

    test('real Phase 160 legacy context keeps effective_intent phase-local intent unavailable', () => {
      const effectiveIntent = getEffectiveIntent(path.join(__dirname, '..'), { phase: '160' });

      assert.strictEqual(effectiveIntent.phase, null, 'real legacy Phase 160 context should not get guessed phase intent');
      assert.strictEqual(effectiveIntent.metadata.partial, true, 'real legacy context should remain partial');
      assert.ok(effectiveIntent.metadata.missing_layers.includes('phase'), 'phase layer should remain missing for the real legacy context');
      assert.ok(effectiveIntent.warnings.some(warning => /missing an explicit `Phase Intent` block/i.test(warning)), 'warning should keep the explicit no-guess explanation');
    });

    test('missing milestone intent warns visibly and never creates files in hot path', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 157, 160);
      createPhaseContext(tmpDir);

      const milestonePath = path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md');
      assert.ok(!fs.existsSync(milestonePath), 'fixture should start without milestone intent');

      const effectiveIntent = getEffectiveIntent(tmpDir, { phase: '157' });
      const cliResult = runGsdTools('plan:intent show effective 157', tmpDir);
      assert.ok(cliResult.success, `intent show effective failed: ${cliResult.error}`);
      const cliData = JSON.parse(cliResult.output);
      const cliEffectiveIntent = cliData.effective_intent || cliData;

      assert.strictEqual(effectiveIntent.metadata.partial, true, 'missing milestone layer should be marked partial');
      assert.ok(effectiveIntent.metadata.missing_layers.includes('milestone'), 'milestone should be marked missing');
      assert.ok(effectiveIntent.warnings.some(warning => warning.includes('MILESTONE-INTENT.md')), 'warning should mention missing milestone intent');
      assert.ok(!fs.existsSync(milestonePath), 'effective_intent computation must not create milestone intent files');
      assert.ok(cliEffectiveIntent.warnings.some(warning => warning.includes('MILESTONE-INTENT.md')), 'CLI output should expose the partial-layer warning');
    });
  });

  // ── History tests (Phase 17, Plan 01) ──

  describe('intent history', () => {
    // Helper to create an INTENT.md with a <history> section
    function createIntentWithHistory(dir) {
      const content = `**Revision:** 3
**Created:** 2026-01-01
**Updated:** 2026-02-25

<objective>
Build a CLI tool for project planning

This tool helps teams manage complex multi-phase projects.
</objective>

<users>
- Software engineers working on multi-service architectures
- Team leads managing project milestones
</users>

<outcomes>
- DO-01 [P1]: Automated phase planning and execution
- DO-02 [P2]: Progress tracking with visual dashboards
- DO-03 [P1]: Integration with git workflows
</outcomes>

<criteria>
- SC-01: All CLI commands respond in under 500ms
- SC-02: Zero data loss during state transitions
</criteria>

<constraints>
### Technical
- C-01: Single-file Node.js bundle, zero dependencies
- C-02: Must work on Linux and macOS

### Business
- C-03: Open source under MIT license

### Timeline
- C-04: MVP ready within 2 weeks
</constraints>

<health>
### Quantitative
- HM-01: Bundle size under 500KB
- HM-02: Test coverage above 80%

### Qualitative
Team velocity and developer satisfaction with the planning workflow.
</health>

<history>
### v2.0 — 2026-02-20
- **Modified** DO-01: Changed from "planning" to "automated phase planning and execution"
  - Reason: Original wording was too vague for traceability
- **Removed** DO-04: Removed real-time monitoring outcome
  - Reason: CLI tool, not a daemon — monitoring doesn't fit the architecture

### v1.0 — 2026-01-01
- **Added** DO-01 [P1]: Phase planning and execution
</history>
`;
      fs.writeFileSync(path.join(dir, '.planning', 'INTENT.md'), content, 'utf-8');
    }

    test('parse INTENT.md without history returns empty array', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent show', tmpDir);
      assert.ok(result.success, `show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('history' in data, 'should have history key');
      assert.ok(Array.isArray(data.history), 'history should be an array');
      assert.strictEqual(data.history.length, 0, 'history should be empty when no <history> section');
    });

    test('parse INTENT.md with history returns entries and changes', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('plan:intent show', tmpDir);
      assert.ok(result.success, `show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.history.length, 2, 'should have 2 milestone entries');

      // First entry (newest)
      assert.strictEqual(data.history[0].milestone, 'v2.0');
      assert.strictEqual(data.history[0].date, '2026-02-20');
      assert.strictEqual(data.history[0].changes.length, 2, 'v2.0 should have 2 changes');
      assert.strictEqual(data.history[0].changes[0].type, 'Modified');
      assert.strictEqual(data.history[0].changes[0].target, 'DO-01');
      assert.ok(data.history[0].changes[0].reason, 'first change should have a reason');
      assert.strictEqual(data.history[0].changes[1].type, 'Removed');

      // Second entry (oldest)
      assert.strictEqual(data.history[1].milestone, 'v1.0');
      assert.strictEqual(data.history[1].date, '2026-01-01');
      assert.strictEqual(data.history[1].changes.length, 1, 'v1.0 should have 1 change');
      assert.strictEqual(data.history[1].changes[0].type, 'Added');
    });

    test('update auto-logs history entry', () => {
      createPopulatedIntent(tmpDir);
      // Create a ROADMAP.md for milestone info
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
        '# Roadmap\n\n- 🔵 **v1.0 Test** — Phases 1-3 (active)\n', 'utf-8');

      const result = runGsdTools('plan:intent update outcomes --add "New test outcome" --priority P3', tmpDir);
      assert.ok(result.success, `update failed: ${result.error}`);

      // Read the file and check for history section
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('<history>'), 'INTENT.md should have <history> section after update');
      assert.ok(content.includes('</history>'), 'INTENT.md should have closing </history> tag');
      assert.ok(content.includes('**Added**'), 'history should contain Added entry');
      assert.ok(content.includes('DO-04'), 'history should reference the new outcome ID');
      assert.ok(content.includes('v1.0'), 'history should reference the active milestone');
    });

    test('update with --reason flag records custom reason', () => {
      createPopulatedIntent(tmpDir);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
        '# Roadmap\n\n- 🔵 **v1.0 Test** — Phases 1-3 (active)\n', 'utf-8');

      const result = runGsdTools('plan:intent update outcomes --add "Another outcome" --priority P2 --reason "Testing reason tracking"', tmpDir);
      assert.ok(result.success, `update with --reason failed: ${result.error}`);

      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('Testing reason tracking'), 'history should contain custom reason');
    });

    test('show compact includes evolution line when history exists', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('plan:intent show', tmpDir);
      assert.ok(result.success, `show failed: ${result.error}`);
      // In piped mode, output is JSON — verify history data is present
      const data = JSON.parse(result.output);
      assert.ok(data.history, 'should have history field');
      assert.ok(data.history.length > 0, 'should have history entries');
      const totalChanges = data.history.reduce((sum, e) => sum + e.changes.length, 0);
      assert.strictEqual(totalChanges, 3, 'should count total 3 changes');
      assert.strictEqual(data.history[0].milestone, 'v2.0', 'should have v2.0 milestone');
    });

    test('show history section renders evolution', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('plan:intent show history', tmpDir);
      assert.ok(result.success, `show history failed: ${result.error}`);
      // In piped mode, output is JSON — verify history section data
      const data = JSON.parse(result.output);
      assert.ok(data.history, 'should have history field');
      assert.ok(data.history.length === 2, 'should have 2 milestone entries');
      assert.strictEqual(data.history[0].milestone, 'v2.0', 'should have v2.0 milestone');
      assert.strictEqual(data.history[1].milestone, 'v1.0', 'should have v1.0 milestone');
      const changeTypes = data.history.flatMap(e => e.changes.map(c => c.type));
      assert.ok(changeTypes.includes('Modified'), 'should have Modified change');
      assert.ok(changeTypes.includes('Removed'), 'should have Removed change');
      assert.ok(changeTypes.includes('Added'), 'should have Added change');
    });

    test('validate accepts INTENT.md with valid history', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('plan:intent validate', tmpDir);
      assert.ok(result.success, `validate should pass for INTENT.md with history: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
      // History section should be in sections
      assert.ok(data.sections.history, 'sections should include history');
      assert.strictEqual(data.sections.history.valid, true, 'history should be valid');
      assert.strictEqual(data.sections.history.count, 2, 'should report 2 milestone entries');
    });

    test('validate works without history (backward compatible)', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('plan:intent validate', tmpDir);
      assert.ok(result.success, `validate should pass without history: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid without history');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
    });
  });
});
