/**
 * bgsd-tools workflow:baseline, workflow:compare, and workflow:verify-structure tests
 *
 * Unit tests for structural fingerprint extraction and compare logic.
 * Unit tests for verify-structure comparison logic.
 * Integration tests for CLI commands via runGsdTools.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { TOOLS_PATH, runGsdTools, runGsdToolsFull, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Unit: extractStructuralFingerprint ─────────────────────────────────────

describe('extractStructuralFingerprint', () => {
  // Load from source directly (not the built binary) for unit testing
  const { extractStructuralFingerprint } = require('../src/commands/workflow');

  test('detects Task() calls in content', () => {
    const content = `
# Workflow

Task(1) does something.
task('foo') does another.
Task("bar baz") does a third.
`;
    const result = extractStructuralFingerprint(content);
    assert.ok(Array.isArray(result.task_calls), 'task_calls should be an array');
    assert.strictEqual(result.task_calls.length, 3, 'should detect 3 Task() calls');
  });

  test('detects CLI commands (bgsd-tools invocations) in code blocks', () => {
    const content = `
# Workflow

\`\`\`bash
node bin/bgsd-tools.cjs workflow:baseline --raw
bgsd-tools workflow:compare a.json b.json
\`\`\`

Inline: \`bgsd-tools util:config-get\`
`;
    const result = extractStructuralFingerprint(content);
    assert.ok(Array.isArray(result.cli_commands), 'cli_commands should be an array');
    assert.ok(result.cli_commands.length >= 2, `should detect at least 2 CLI commands, got ${result.cli_commands.length}`);
  });

  test('detects section markers', () => {
    const content = `
<!-- section: executor -->
Some content here.
<!-- /section -->

<!-- section: planner -->
More content.
<!-- /section -->
`;
    const result = extractStructuralFingerprint(content);
    assert.ok(Array.isArray(result.section_markers), 'section_markers should be an array');
    assert.strictEqual(result.section_markers.length, 2, 'should detect 2 section markers');
    assert.ok(result.section_markers.includes('executor'), 'should include "executor"');
    assert.ok(result.section_markers.includes('planner'), 'should include "planner"');
  });

  test('detects question blocks', () => {
    const content = `
<question>What is your project name?</question>

<question type="optional">
Do you want research?
</question>
`;
    const result = extractStructuralFingerprint(content);
    assert.ok(Array.isArray(result.question_blocks), 'question_blocks should be an array');
    assert.strictEqual(result.question_blocks.length, 2, 'should detect 2 question blocks');
  });

  test('detects key XML tags (step, process, purpose)', () => {
    const content = `
<step name="load">Load the file</step>
<process>Do the thing</process>
<purpose>This workflow does X</purpose>
<step name="save">Save the result</step>
`;
    const result = extractStructuralFingerprint(content);
    assert.ok(Array.isArray(result.xml_tags), 'xml_tags should be an array');
    assert.strictEqual(result.xml_tags.length, 4, 'should detect 4 XML tags');
    const tagNames = result.xml_tags;
    assert.ok(tagNames.includes('step'), 'should include step');
    assert.ok(tagNames.includes('process'), 'should include process');
    assert.ok(tagNames.includes('purpose'), 'should include purpose');
  });

  test('returns empty arrays for content with no structural elements', () => {
    const content = 'Just plain text with no special elements.';
    const result = extractStructuralFingerprint(content);
    assert.strictEqual(result.task_calls.length, 0, 'task_calls should be empty');
    assert.strictEqual(result.cli_commands.length, 0, 'cli_commands should be empty');
    assert.strictEqual(result.section_markers.length, 0, 'section_markers should be empty');
    assert.strictEqual(result.question_blocks.length, 0, 'question_blocks should be empty');
    assert.strictEqual(result.xml_tags.length, 0, 'xml_tags should be empty');
  });

  test('handles empty string without throwing', () => {
    const result = extractStructuralFingerprint('');
    assert.ok(result, 'should return a result');
    assert.strictEqual(result.task_calls.length, 0);
    assert.strictEqual(result.cli_commands.length, 0);
  });
});

// ─── Unit: compare logic ─────────────────────────────────────────────────────

describe('workflow compare logic (unit)', () => {
  /**
   * Simulate the compare logic by calling compare with two temp baseline files.
   * We use the CLI so we don't need to import internal helpers.
   */

  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'baselines'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function makeSnapshot(workflows, timestamp) {
    const total = workflows.reduce((s, w) => s + w.total_tokens, 0);
    return {
      version: 1,
      timestamp: timestamp || new Date().toISOString(),
      workflow_count: workflows.length,
      total_tokens: total,
      workflows,
    };
  }

  function writeSnapshot(dir, name, snapshot) {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return filePath;
  }

  test('computes correct delta and percent_change for two snapshots', () => {
    const snapshotA = makeSnapshot([
      { name: 'execute-phase.md', workflow_tokens: 1000, ref_count: 0, ref_tokens: 0, total_tokens: 1000 },
      { name: 'plan-phase.md', workflow_tokens: 500, ref_count: 0, ref_tokens: 0, total_tokens: 500 },
    ], '2026-01-01T00:00:00.000Z');

    const snapshotB = makeSnapshot([
      { name: 'execute-phase.md', workflow_tokens: 700, ref_count: 0, ref_tokens: 0, total_tokens: 700 },
      { name: 'plan-phase.md', workflow_tokens: 500, ref_count: 0, ref_tokens: 0, total_tokens: 500 },
    ], '2026-01-02T00:00:00.000Z');

    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    const pathA = writeSnapshot(baselinesDir, 'workflow-baseline-a.json', snapshotA);
    const pathB = writeSnapshot(baselinesDir, 'workflow-baseline-b.json', snapshotB);

    const result = runGsdTools(`workflow:compare "${pathA}" "${pathB}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.before_total, 1500, 'before_total should be 1500');
    assert.strictEqual(data.summary.after_total, 1200, 'after_total should be 1200');
    assert.strictEqual(data.summary.delta, -300, 'delta should be -300');
    // percent_change: -300/1500 * 100 = -20.0
    assert.strictEqual(data.summary.percent_change, -20, 'percent_change should be -20');
    assert.strictEqual(data.summary.workflows_improved, 1, 'workflows_improved should be 1');
    assert.strictEqual(data.summary.workflows_unchanged, 1, 'workflows_unchanged should be 1');
    assert.strictEqual(data.summary.workflows_worsened, 0, 'workflows_worsened should be 0');
  });

  test('handles added workflows (worsened) and removed workflows (improved)', () => {
    const snapshotA = makeSnapshot([
      { name: 'old-workflow.md', workflow_tokens: 1000, ref_count: 0, ref_tokens: 0, total_tokens: 1000 },
    ], '2026-01-01T00:00:00.000Z');

    const snapshotB = makeSnapshot([
      { name: 'new-workflow.md', workflow_tokens: 200, ref_count: 0, ref_tokens: 0, total_tokens: 200 },
    ], '2026-01-02T00:00:00.000Z');

    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    const pathA = writeSnapshot(baselinesDir, 'workflow-baseline-a.json', snapshotA);
    const pathB = writeSnapshot(baselinesDir, 'workflow-baseline-b.json', snapshotB);

    const result = runGsdTools(`workflow:compare "${pathA}" "${pathB}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.workflows_improved, 1, 'removed workflow counts as improved');
    assert.strictEqual(data.summary.workflows_worsened, 1, 'added workflow counts as worsened');

    // Check per-workflow statuses
    const removedEntry = data.workflows.find(w => w.name === 'old-workflow.md');
    assert.ok(removedEntry, 'old-workflow.md should appear in comparison');
    assert.strictEqual(removedEntry.status, 'removed');

    const addedEntry = data.workflows.find(w => w.name === 'new-workflow.md');
    assert.ok(addedEntry, 'new-workflow.md should appear in comparison');
    assert.strictEqual(addedEntry.status, 'added');
  });

  test('auto-selects two most recent baselines when no args given', () => {
    const snapshotA = makeSnapshot([
      { name: 'execute-phase.md', workflow_tokens: 1000, ref_count: 0, ref_tokens: 0, total_tokens: 1000 },
    ], '2026-01-01T00:00:00.000Z');

    const snapshotB = makeSnapshot([
      { name: 'execute-phase.md', workflow_tokens: 800, ref_count: 0, ref_tokens: 0, total_tokens: 800 },
    ], '2026-01-02T00:00:00.000Z');

    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    // Name files so alphabetical sort produces correct order
    writeSnapshot(baselinesDir, 'workflow-baseline-2026-01-01T00-00-00-000Z.json', snapshotA);
    writeSnapshot(baselinesDir, 'workflow-baseline-2026-01-02T00-00-00-000Z.json', snapshotB);

    const result = runGsdTools('workflow:compare', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.summary, 'should have summary');
    assert.ok(Array.isArray(data.workflows), 'should have workflows array');
    assert.strictEqual(data.summary.delta, -200, 'should compute delta between the two snapshots');
  });

  test('returns error for nonexistent file path', () => {
    const result = runGsdTools('workflow:compare /nonexistent/path.json', tmpDir);
    assert.ok(!result.success, 'Should fail for nonexistent file');
  });

  test('returns error for invalid JSON file', () => {
    const badFile = path.join(tmpDir, '.planning', 'baselines', 'bad.json');
    fs.writeFileSync(badFile, 'not valid json', 'utf-8');
    const result = runGsdTools(`workflow:compare "${badFile}"`, tmpDir);
    assert.ok(!result.success, 'Should fail for invalid JSON');
  });
});

// ─── Integration: workflow:baseline ─────────────────────────────────────────

// Helper: run workflow:baseline and read the saved JSON from .planning/baselines/
// Note: workflow:baseline --raw outputs @file: reference (editor temp file, deleted on read).
// Instead, we run without --raw and read the newest saved baseline file from disk.
function runBaselineAndRead(cwd) {
  const baseCwd = cwd || process.cwd();
  const result = runGsdTools('workflow:baseline', baseCwd);
  if (!result.success) return { success: false, error: result.error };
  const baselinesDir = path.join(baseCwd, '.planning', 'baselines');
  let files;
  try {
    files = fs.readdirSync(baselinesDir).filter(f => f.endsWith('.json')).sort();
  } catch {
    return { success: false, error: 'No baselines directory found' };
  }
  if (files.length === 0) return { success: false, error: 'No baseline files saved' };
  const newest = files[files.length - 1];
  const filePath = path.join(baselinesDir, newest);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { success: true, data, filePath: path.join('.planning', 'baselines', newest) };
  } catch (e) {
    return { success: false, error: `Failed to parse ${filePath}: ${e.message}` };
  }
}

describe('workflow:baseline (integration)', () => {
  test('returns valid JSON with expected top-level fields', () => {
    const r = runBaselineAndRead();
    assert.ok(r.success, `workflow:baseline failed: ${r.error}`);
    const data = r.data;

    assert.ok(typeof data.timestamp === 'string', 'timestamp should be a string');
    assert.ok(typeof data.workflow_count === 'number', 'workflow_count should be a number');
    assert.ok(typeof data.total_tokens === 'number', 'total_tokens should be a number');
    assert.ok(Array.isArray(data.workflows), 'workflows should be an array');
  });

  test('workflow_count is at least 40', () => {
    const r = runBaselineAndRead();
    assert.ok(r.success, `workflow:baseline failed: ${r.error}`);
    assert.ok(r.data.workflow_count >= 40, `Expected at least 40 workflows, got ${r.data.workflow_count}`);
  });

  test('each workflow entry has required fields and structure fingerprint', () => {
    const r = runBaselineAndRead();
    assert.ok(r.success, `workflow:baseline failed: ${r.error}`);

    for (const w of r.data.workflows) {
      assert.ok(typeof w.name === 'string', `workflow.name should be string, got ${typeof w.name}`);
      assert.ok(typeof w.workflow_tokens === 'number', `${w.name}: workflow_tokens should be number`);
      assert.ok(typeof w.ref_count === 'number', `${w.name}: ref_count should be number`);
      assert.ok(typeof w.ref_tokens === 'number', `${w.name}: ref_tokens should be number`);
      assert.ok(typeof w.total_tokens === 'number', `${w.name}: total_tokens should be number`);
      assert.ok(w.structure && typeof w.structure === 'object', `${w.name}: structure should be object`);
      assert.ok(Array.isArray(w.structure.task_calls), `${w.name}: structure.task_calls should be array`);
      assert.ok(Array.isArray(w.structure.cli_commands), `${w.name}: structure.cli_commands should be array`);
      assert.ok(Array.isArray(w.structure.section_markers), `${w.name}: structure.section_markers should be array`);
      assert.ok(Array.isArray(w.structure.question_blocks), `${w.name}: structure.question_blocks should be array`);
      assert.ok(Array.isArray(w.structure.xml_tags), `${w.name}: structure.xml_tags should be array`);
    }
  });

  test('saves baseline file to .planning/baselines/', () => {
    const r = runBaselineAndRead();
    assert.ok(r.success, `workflow:baseline failed: ${r.error}`);

    assert.ok(r.filePath.startsWith('.planning/baselines/'), 'baseline should be in .planning/baselines/');
    assert.ok(r.filePath.endsWith('.json'), 'baseline should be a JSON file');
    assert.ok(fs.existsSync(r.filePath), `Baseline file should exist on disk: ${r.filePath}`);
  });

  test('total_tokens equals sum of workflow total_tokens', () => {
    const r = runBaselineAndRead();
    assert.ok(r.success, `workflow:baseline failed: ${r.error}`);

    const computedTotal = r.data.workflows.reduce((s, w) => s + w.total_tokens, 0);
    assert.strictEqual(r.data.total_tokens, computedTotal, 'total_tokens should equal sum of workflow totals');
  });
});

// ─── Integration: workflow:compare ──────────────────────────────────────────

describe('workflow:compare (integration)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'baselines'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function makeSnapshot(workflows, timestamp) {
    const total = workflows.reduce((s, w) => s + w.total_tokens, 0);
    return {
      version: 1,
      timestamp: timestamp || new Date().toISOString(),
      workflow_count: workflows.length,
      total_tokens: total,
      workflows,
    };
  }

  test('compares two saved baseline files (two args)', () => {
    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');

    const snapshotA = makeSnapshot([
      { name: 'foo.md', workflow_tokens: 1000, ref_count: 0, ref_tokens: 0, total_tokens: 1000 },
      { name: 'bar.md', workflow_tokens: 400, ref_count: 0, ref_tokens: 0, total_tokens: 400 },
    ], '2026-01-01T00:00:00.000Z');

    const snapshotB = makeSnapshot([
      { name: 'foo.md', workflow_tokens: 600, ref_count: 0, ref_tokens: 0, total_tokens: 600 },
      { name: 'bar.md', workflow_tokens: 400, ref_count: 0, ref_tokens: 0, total_tokens: 400 },
    ], '2026-01-02T00:00:00.000Z');

    const pathA = path.join(baselinesDir, 'workflow-baseline-a.json');
    const pathB = path.join(baselinesDir, 'workflow-baseline-b.json');
    fs.writeFileSync(pathA, JSON.stringify(snapshotA, null, 2));
    fs.writeFileSync(pathB, JSON.stringify(snapshotB, null, 2));

    const result = runGsdTools(`workflow:compare "${pathA}" "${pathB}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.summary, 'should have summary');
    assert.ok(typeof data.summary.delta === 'number', 'summary.delta should be a number');
    assert.ok(Array.isArray(data.workflows), 'workflows should be array');
    assert.strictEqual(data.summary.delta, -400, 'delta should be -400');
    assert.ok(typeof data.summary.percent_change === 'number', 'percent_change should be a number');
  });

  test('produces error for nonexistent snapshot path', () => {
    const result = runGsdTools('workflow:compare /does/not/exist.json /also/not/exist.json', tmpDir);
    assert.ok(!result.success, 'Should fail for nonexistent paths');
  });

  test('produces error for no-arg mode with no baselines directory', () => {
    // tmpDir has no baselines with workflow-baseline- prefix
    const result = runGsdTools('workflow:compare', tmpDir);
    assert.ok(!result.success, 'Should fail when no baselines found');
  });

  test('output has snapshot_a, snapshot_b, date_a, date_b fields', () => {
    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');

    const snapshotA = makeSnapshot([
      { name: 'test.md', workflow_tokens: 200, ref_count: 0, ref_tokens: 0, total_tokens: 200 },
    ], '2026-01-01T00:00:00.000Z');

    const snapshotB = makeSnapshot([
      { name: 'test.md', workflow_tokens: 150, ref_count: 0, ref_tokens: 0, total_tokens: 150 },
    ], '2026-01-02T00:00:00.000Z');

    const pathA = path.join(baselinesDir, 'snap-a.json');
    const pathB = path.join(baselinesDir, 'snap-b.json');
    fs.writeFileSync(pathA, JSON.stringify(snapshotA, null, 2));
    fs.writeFileSync(pathB, JSON.stringify(snapshotB, null, 2));

    const result = runGsdTools(`workflow:compare "${pathA}" "${pathB}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(typeof data.snapshot_a === 'string', 'snapshot_a should be a string');
    assert.ok(typeof data.snapshot_b === 'string', 'snapshot_b should be a string');
    assert.ok(typeof data.date_a === 'string', 'date_a should be a string');
    assert.ok(typeof data.date_b === 'string', 'date_b should be a string');
  });
});

// ─── Unit: verify-structure comparison logic ─────────────────────────────────

describe('workflow:verify-structure (unit)', () => {
  /**
   * Tests use the CLI via execSync with BGSD_PLUGIN_DIR set to a temp directory.
   * This avoids interfering with the test runner's stdout while still validating
   * the comparison logic end-to-end.
   */
  const { execSync } = require('child_process');

  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'baselines'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'workflows'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function makeBaseline(workflows, timestamp) {
    return {
      version: 1,
      timestamp: timestamp || new Date().toISOString(),
      workflow_count: workflows.length,
      total_tokens: 0,
      workflows,
    };
  }

  function writeBaseline(name, baseline) {
    const filePath = path.join(tmpDir, '.planning', 'baselines', name);
    fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2), 'utf-8');
    return filePath;
  }

  function writeWorkflow(name, content) {
    fs.writeFileSync(path.join(tmpDir, 'workflows', name), content, 'utf-8');
  }

  function runVerify(baselinePath) {
    try {
      const stdout = execSync(
        `BGSD_PLUGIN_DIR="${tmpDir}" node "${TOOLS_PATH}" workflow:verify-structure "${baselinePath}" --raw`,
        { cwd: tmpDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return { success: true, exitCode: 0, data: JSON.parse(stdout.trim()) };
    } catch (err) {
      const stdout = (err.stdout || '').trim();
      return {
        success: false,
        exitCode: err.status || 1,
        data: stdout ? JSON.parse(stdout) : null,
      };
    }
  }

  test('all elements preserved → all pass', () => {
    writeWorkflow('test.md', `
Task("foo") does something.
\`\`\`bash
bgsd-tools workflow:baseline
\`\`\`
<!-- section: executor -->
<question>What is your name?</question>
<step name="load">Load the file</step>
`);
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: ['Task("foo")'],
        cli_commands: ['bgsd-tools workflow:baseline'],
        section_markers: ['executor'],
        question_blocks: ['<question>What is your name?</question>'],
        xml_tags: ['step'],
      },
    }]));

    const { data, exitCode } = runVerify(bPath);
    assert.strictEqual(exitCode, 0, 'exit code should be 0 when all pass');
    assert.strictEqual(data.summary.passed, 1, 'should have 1 passed');
    assert.strictEqual(data.summary.failed, 0, 'should have 0 failed');
    assert.strictEqual(data.results[0].status, 'pass');
    assert.strictEqual(data.results[0].missing.length, 0);
  });

  test('one Task() call removed → fail with correct missing entry', () => {
    writeWorkflow('test.md', 'Just some text without any task calls.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: ['Task("foo")'],
        cli_commands: [],
        section_markers: [],
        question_blocks: [],
        xml_tags: [],
      },
    }]));

    const { data, exitCode } = runVerify(bPath);
    assert.strictEqual(exitCode, 1, 'exit code should be 1 when regression detected');
    assert.strictEqual(data.summary.failed, 1, 'should have 1 failed');
    const result = data.results[0];
    assert.strictEqual(result.status, 'fail');
    assert.ok(result.missing.some(m => m.type === 'task_call' && m.value === 'Task("foo")'),
      'should report missing task_call Task("foo")');
  });

  test('one CLI command removed → fail', () => {
    writeWorkflow('test.md', 'No CLI commands here.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: [],
        cli_commands: ['bgsd-tools workflow:compare'],
        section_markers: [],
        question_blocks: [],
        xml_tags: [],
      },
    }]));

    const { data } = runVerify(bPath);
    assert.strictEqual(data.summary.failed, 1);
    assert.ok(data.results[0].missing.some(m => m.type === 'cli_command' && m.value === 'bgsd-tools workflow:compare'),
      'should report missing cli_command');
  });

  test('section marker removed → fail', () => {
    writeWorkflow('test.md', 'No section markers here.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: [],
        cli_commands: [],
        section_markers: ['executor'],
        question_blocks: [],
        xml_tags: [],
      },
    }]));

    const { data } = runVerify(bPath);
    assert.strictEqual(data.summary.failed, 1);
    assert.ok(data.results[0].missing.some(m => m.type === 'section_marker' && m.value === 'executor'),
      'should report missing section_marker');
  });

  test('question block removed → fail', () => {
    writeWorkflow('test.md', 'No question blocks here.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: [],
        cli_commands: [],
        section_markers: [],
        question_blocks: ['<question>What is your name?</question>'],
        xml_tags: [],
      },
    }]));

    const { data } = runVerify(bPath);
    assert.strictEqual(data.summary.failed, 1);
    assert.ok(data.results[0].missing.some(m => m.type === 'question_block'),
      'should report missing question_block');
  });

  test('new elements added (not in baseline) → still pass', () => {
    // Workflow now has MORE Task() calls than baseline — additions are fine
    writeWorkflow('test.md', `
Task("original") does original thing.
Task("new") does new thing.
`);
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: {
        task_calls: ['Task("original")'],
        cli_commands: [],
        section_markers: [],
        question_blocks: [],
        xml_tags: [],
      },
    }]));

    const { data, exitCode } = runVerify(bPath);
    assert.strictEqual(exitCode, 0, 'exit code should be 0 when only additions');
    assert.strictEqual(data.summary.passed, 1, 'should pass when additions only');
    assert.strictEqual(data.summary.failed, 0);
    assert.strictEqual(data.results[0].status, 'pass');
  });

  test('workflow removed entirely → fail with removed:true', () => {
    // No file written for 'missing.md' — it doesn't exist in workflows/
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'missing.md',
      total_tokens: 100,
      structure: {
        task_calls: ['Task("foo")'],
        cli_commands: [],
        section_markers: [],
        question_blocks: [],
        xml_tags: [],
      },
    }]));

    const { data, exitCode } = runVerify(bPath);
    assert.strictEqual(exitCode, 1, 'exit code should be 1 when workflow removed');
    assert.strictEqual(data.summary.failed, 1, 'removed workflow should be a failure');
    const result = data.results[0];
    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.removed, true, 'should have removed:true flag');
  });

  test('workflow added (not in baseline) → not a regression (pass)', () => {
    // extra.md exists in workflows/ but isn't in the baseline — should be ignored
    writeWorkflow('extra.md', 'Task("extra") new workflow.');
    writeWorkflow('existing.md', 'Task("existing") kept workflow.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'existing.md',
      total_tokens: 100,
      structure: { task_calls: ['Task("existing")'], cli_commands: [], section_markers: [], question_blocks: [], xml_tags: [] },
    }]));

    const { data, exitCode } = runVerify(bPath);
    // Only baseline workflows are checked; extra.md should not appear in results
    assert.strictEqual(exitCode, 0, 'exit code should be 0 — new workflow is not a regression');
    assert.strictEqual(data.results.length, 1, 'only baseline workflows checked');
    assert.strictEqual(data.results[0].name, 'existing.md');
    assert.strictEqual(data.results[0].status, 'pass');
    assert.strictEqual(data.summary.failed, 0, 'new workflow is not a failure');
  });

  test('empty baseline structural elements → all pass', () => {
    writeWorkflow('test.md', 'Task("something") with content.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'test.md',
      total_tokens: 100,
      structure: { task_calls: [], cli_commands: [], section_markers: [], question_blocks: [], xml_tags: [] },
    }]));

    const { data } = runVerify(bPath);
    assert.strictEqual(data.summary.passed, 1, 'empty baseline structure should always pass');
    assert.strictEqual(data.summary.failed, 0);
  });

  test('workflow with no structural elements → pass', () => {
    writeWorkflow('plain.md', 'Just plain markdown text with no special elements.');
    const bPath = writeBaseline('workflow-baseline-test.json', makeBaseline([{
      name: 'plain.md',
      total_tokens: 50,
      structure: { task_calls: [], cli_commands: [], section_markers: [], question_blocks: [], xml_tags: [] },
    }]));

    const { data } = runVerify(bPath);
    assert.strictEqual(data.summary.passed, 1);
    assert.strictEqual(data.results[0].status, 'pass');
  });
});

// ─── Integration: workflow:verify-structure ───────────────────────────────────

describe('workflow:verify-structure (integration)', () => {
  test('verify-structure --raw with valid baseline → JSON output with summary', () => {
    // Create a baseline (without --raw to avoid @file: temp file issue)
    const baselineResult = runGsdTools('workflow:baseline');
    assert.ok(baselineResult.success, `workflow:baseline failed: ${baselineResult.error}`);

    // Now verify against the most recent saved baseline
    const result = runGsdTools('workflow:verify-structure --raw');
    assert.ok(result.success, `workflow:verify-structure failed: ${result.error}`);

    let data;
    try {
      data = JSON.parse(result.output);
    } catch (e) {
      assert.fail(`Output is not valid JSON: ${result.output.slice(0, 200)}`);
    }

    assert.ok(typeof data.baseline_file === 'string', 'baseline_file should be string');
    assert.ok(typeof data.baseline_date === 'string', 'baseline_date should be string');
    assert.ok(typeof data.verified_at === 'string', 'verified_at should be string');
    assert.ok(data.summary && typeof data.summary === 'object', 'summary should be object');
    assert.ok(typeof data.summary.total_workflows === 'number', 'summary.total_workflows should be number');
    assert.ok(typeof data.summary.passed === 'number', 'summary.passed should be number');
    assert.ok(typeof data.summary.failed === 'number', 'summary.failed should be number');
    assert.ok(Array.isArray(data.results), 'results should be array');
  });

  test('verify-structure passes all workflows against fresh baseline', () => {
    const baselineResult = runGsdTools('workflow:baseline');
    assert.ok(baselineResult.success, `workflow:baseline failed: ${baselineResult.error}`);

    const result = runGsdTools('workflow:verify-structure --raw');
    assert.ok(result.success, `workflow:verify-structure failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.failed, 0, `Expected 0 failures, got ${data.summary.failed}`);
    assert.ok(data.summary.passed > 0, 'should have at least one passed workflow');
  });

  test('verify-structure with nonexistent baseline → error', () => {
    const result = runGsdTools('workflow:verify-structure /nonexistent/baseline.json --raw');
    assert.ok(!result.success, 'Should fail for nonexistent baseline path');
  });

  test('verify-structure exit code is 1 when regression detected', () => {
    // Create a temp dir with a controlled workflows dir to simulate a regression
    const tmpDir = createTempProject();
    const { execSync } = require('child_process');
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'baselines'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'workflows'), { recursive: true });

      // Create baseline referencing a Task() call
      const baseline = {
        version: 1,
        timestamp: new Date().toISOString(),
        workflow_count: 1,
        total_tokens: 100,
        workflows: [{
          name: 'sample.md',
          workflow_tokens: 100,
          ref_count: 0,
          ref_tokens: 0,
          total_tokens: 100,
          structure: {
            task_calls: ['Task("original")'],
            cli_commands: [],
            section_markers: [],
            question_blocks: [],
            xml_tags: [],
          },
        }],
      };
      const bFile = path.join(tmpDir, '.planning', 'baselines', 'workflow-baseline-test.json');
      fs.writeFileSync(bFile, JSON.stringify(baseline, null, 2), 'utf-8');

      // Write workflow WITHOUT the Task() call — regression!
      fs.writeFileSync(path.join(tmpDir, 'workflows', 'sample.md'),
        'No task calls here anymore.\n', 'utf-8');

      // Run verify-structure with BGSD_PLUGIN_DIR pointing to tmpDir
      let exitCode = 0;
      let stdout = '';
      try {
        stdout = execSync(
          `BGSD_PLUGIN_DIR="${tmpDir}" node "${TOOLS_PATH}" workflow:verify-structure "${bFile}" --raw`,
          { cwd: tmpDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
      } catch (err) {
        exitCode = err.status || 1;
        stdout = (err.stdout || '').trim();
      }

      // Should exit with code 1 on regression
      assert.strictEqual(exitCode, 1, 'exit code should be 1 when regression detected');

      // JSON output should report the failure
      if (stdout) {
        const data = JSON.parse(stdout);
        assert.ok(data.summary.failed > 0, `should report at least 1 failure, got: ${JSON.stringify(data.summary)}`);
        assert.ok(data.results[0].missing.some(m => m.type === 'task_call'),
          'should report missing task_call in results');
      }
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe('Phase 150 TDD execution semantics contract', () => {
  test('canonical skill, workflow, template, and help share exact-command TDD language', () => {
    const skill = fs.readFileSync(path.join(process.cwd(), 'skills', 'tdd-execution', 'SKILL.md'), 'utf-8');
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'tdd.md'), 'utf-8');
    const executePlan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-plan.md'), 'utf-8');
    const template = fs.readFileSync(path.join(process.cwd(), 'templates', 'plans', 'tdd.md'), 'utf-8');
    const constants = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'constants.js'), 'utf-8');

    assert.match(skill, /single authoritative source/i);
    assert.match(skill, /Each RED \/ GREEN \/ REFACTOR step declares the exact target command to run\./i);
    assert.match(workflow, /exact-command targeting/i);
    assert.match(executePlan, /exact declared target commands/i);
    assert.match(template, /Each phase declares its exact target command\./);
    assert.match(constants, /exact-command validation and\s+structured proof/i);

    for (const token of ['validate-red', 'validate-green', 'validate-refactor', 'auto-test']) {
      assert.match(skill, new RegExp(token));
      assert.match(workflow, new RegExp(token));
      assert.match(constants, new RegExp(token));
    }
  });

  test('reference and workflow lock Phase 150 semantics without reopening Phase 149 selection scope', () => {
    const reference = fs.readFileSync(path.join(process.cwd(), 'skills', 'tdd-execution', 'tdd-reference.md'), 'utf-8');
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'tdd.md'), 'utf-8');

    assert.match(reference, /exact-command validation per phase/i);
    assert.match(reference, /It does \*\*not\*\* reopen Phase 149 TDD selection or severity rules\./);
    assert.match(workflow, /does not reopen Phase 149 selection or severity rules\./);
  });

  test('template and workflow require targeted proof details', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'tdd.md'), 'utf-8');
    const template = fs.readFileSync(path.join(process.cwd(), 'templates', 'plans', 'tdd.md'), 'utf-8');

    assert.match(template, /<tdd-targets>/);
    assert.match(template, /exact target command, exit status, and evidence snippet/i);
    assert.match(workflow, /structured proof \(`target_command`, `exit_code`, matched evidence snippet\)/i);
    assert.match(workflow, /GREEN and REFACTOR stay targeted-only by default/i);
    assert.match(workflow, /durable proof source reused by fresh-context handoffs, resume inspection, and summary generation/i);
  });

  test('plan-phase workflow preserves the checker severity ladder including omitted-hint info output', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'plan-phase.md'), 'utf-8');

    assert.match(workflow, /`Selected` plans use `type: tdd`, `Skipped` plans use `type: execute`/i);
    assert.match(workflow, /Do not emit a `Selected` callout on an `execute` plan/i);
    assert.match(workflow, /`recommended` upgrades TDD-eligible `type: execute` plans to checker warnings/i);
    assert.match(workflow, /`required` upgrades them to blockers/i);
    assert.match(workflow, /omitted hints still produce checker info/i);
    assert.match(workflow, /selection\/rationale\/type consistency only, not Phase 150 `execute:tdd` semantic enforcement/i);
  });
});

describe('Phase 164 planning metadata approval contract', () => {
  test('plan approval workflow and agent prompts require the semantic plan-structure gate', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'plan-phase.md'), 'utf-8');
    const planner = fs.readFileSync(path.join(process.cwd(), 'agents', 'bgsd-planner.md'), 'utf-8');
    const checker = fs.readFileSync(path.join(process.cwd(), 'agents', 'bgsd-plan-checker.md'), 'utf-8');

    assert.match(workflow, /Before plans are treated as approval-ready, run `verify:verify plan-structure`/i);
    assert.match(workflow, /malformed or inconclusive verifier-facing `must_haves` artifacts\/key_links metadata as blockers/i);
    assert.match(planner, /approval-time semantic gate for verifier-facing metadata/i);
    assert.match(planner, /Do not treat a visible `must_haves` field as sufficient/i);
    assert.match(checker, /A plan is not approval-ready unless `verify:verify plan-structure` confirms the shared verifier-consumable metadata contract/i);
    assert.match(checker, /Do \*\*not\*\* rely on `util:frontmatter get \.\.\. --field must_haves` or field presence alone for approval/i);
  });
});

describe('Phase 151 workflow acceleration contracts', () => {
  test('verify-work keeps one-at-a-time as default and adds batch drill-down semantics', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');
    const command = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-verify-work.md'), 'utf-8');

    assert.match(workflow, /No `--batch` → keep the default one-test-at-a-time flow\./);
    assert.match(workflow, /`--batch N` → enable grouped verification mode with batch size `N`/);
    assert.match(workflow, /present a compact grouped summary first/i);
    assert.match(workflow, /if the group passes cleanly, mark every test in that group passed/i);
    assert.match(workflow, /if the group does \*\*not\*\* pass cleanly, drill down into that group only using the normal exact one-test-at-a-time flow/i);
    assert.match(workflow, /after the failing group is resolved, return to grouped mode for later clean-path groups/i);
    assert.match(command, /Optional grouped mode: `--batch N`/);
  });

  test('canonical planning wrapper does not mention removed discuss aliases', () => {
    const command = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-plan.md'), 'utf-8');

    assert.doesNotMatch(command, /\/bgsd-discuss-phase|\/bgsd-research-phase|\/bgsd-list-assumptions/i);
  });
});

describe('Phase 152 downstream handoff gating contracts', () => {
  test('repair guidance and latest valid artifact rules stay explicit across downstream workflows', () => {
    const research = fs.readFileSync(path.join(process.cwd(), 'workflows', 'research-phase.md'), 'utf-8');
    const plan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'plan-phase.md'), 'utf-8');
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(research, /fail closed/i);
    assert.match(research, /latest valid artifact/i);
    assert.match(research, /repair or restart guidance/i);
    assert.match(research, /current expected fingerprint/i);

    assert.match(plan, /fail closed/i);
    assert.match(plan, /repair_guidance/i);
    assert.match(plan, /latest-valid-artifact based/i);
    assert.match(plan, /current expected fingerprint/i);

    assert.match(execute, /Use `resume_summary` as the authoritative continuation contract/i);
    assert.match(execute, /latest valid artifact/i);
    assert.match(execute, /stale_sources/i);
    assert.match(execute, /rebuild from source/i);
    assert.match(execute, /expected fingerprint/i);

    assert.match(verify, /repair_guidance/i);
    assert.match(verify, /latest valid artifact/i);
    assert.match(verify, /corrupt/i);
    assert.match(verify, /current expected fingerprint/i);
  });

  test('standalone downstream commands remain explicit even after chain gating is added', () => {
    const research = fs.readFileSync(path.join(process.cwd(), 'workflows', 'research-phase.md'), 'utf-8');
    const plan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'plan-phase.md'), 'utf-8');
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(research, /standalone research continues normally/i);
    assert.match(plan, /standalone `\/bgsd-plan phase <phase-number>` works normally, and the legacy standalone phase alias remains reference-only compatibility guidance/i);
    assert.match(execute, /standalone `\/bgsd-execute-phase` works normally/i);
    assert.match(verify, /standalone `\/bgsd-verify-work` continues to work normally/i);
  });

  test('proof continuity wording stays explicit across TDD execute and verify workflows', () => {
    const tdd = fs.readFileSync(path.join(process.cwd(), 'workflows', 'tdd.md'), 'utf-8');
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(tdd, /durable proof source reused by fresh-context handoffs, resume inspection, and summary generation/i);
    assert.match(tdd, /execute → verify handoff refreshes preserve one deterministic proof package/i);
    assert.match(tdd, /resumable fresh-context chains and downstream summaries should continue to re-render/i);
    assert.match(execute, /resume inspection, the execute → verify boundary, and downstream summary rendering/i);
    assert.match(verify, /resume inspection, downstream resume, and summary steps/i);
  });
});

describe('Phase 156 JJ-first workspace guidance contracts', () => {
  test('workspace help surfaces teach inspection and recovery instead of legacy worktree behavior', () => {
    const constants = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'constants.js'), 'utf-8');
    const help = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'command-help.js'), 'utf-8');
    const discovery = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'commandDiscovery.js'), 'utf-8');
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');

    assert.match(constants, /Manage JJ workspaces for local execution isolation and recovery\./);
    assert.match(constants, /preview reconcile actions/i);
    assert.match(constants, /recovery-needed runs/i);
    assert.doesNotMatch(constants, /Phase 155 reconcile context/);

    assert.match(help, /JJ-first workspace execution and recovery guidance/i);
    assert.match(help, /Inspect, recover, and clean up JJ execution workspaces/);
    assert.match(help, /workspace recovery/);

    assert.match(discovery, /JJ-first workspace autocomplete hints/i);
    assert.match(discovery, /Workspace Recovery/);

    assert.match(execute, /`workspace add \{plan_id\}` for each runnable plan/i);
    assert.match(execute, /returned status\/recovery preview/i);
    assert.match(execute, /partial-wave outcomes honestly/i);
    assert.doesNotMatch(execute, /manual follow-up may still be required/);
  });
});

describe('Phase 183 workspace ownership workflow contracts', () => {
  test('execute workflows keep shared planning updates behind finalize and teach inspection escalation', () => {
    const executePhase = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const executePlan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-plan.md'), 'utf-8');

    assert.match(executePhase, /workspace reconcile remains preview-only/i);
    assert.match(executePhase, /auto-call `execute:finalize-plan \{plan_id\}`/i);
    assert.match(executePhase, /trusted main-checkout state/i);
    assert.match(executePhase, /routine manual approval stop/i);
    assert.match(executePhase, /Reserve human review for explicit exception cases only/i);
    assert.match(executePhase, /summary-first inspection by default/i);
    assert.match(executePhase, /direct proof review for major completion claims or risky runtime\/shared-state work/i);
    assert.match(executePlan, /forbids shared planning mutations before finalize/i);
    assert.match(executePlan, /first clearly containable shared-planning write/i);
    assert.match(executePlan, /repeated or serious violations escalate to quarantine/i);
    assert.match(executePlan, /post-finalize outcome/i);
  });
});

describe('Phase 184 partial-wave recovery workflow contracts', () => {
  test('execute-phase teaches summary-first recovery and trusted-main finalize-wave reruns', () => {
    const executePhase = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');

    assert.match(executePhase, /canonical recovery summary/i);
    assert.match(executePhase, /gating sibling/i);
    assert.match(executePhase, /next command/i);
    assert.match(executePhase, /execute:finalize-wave/i);
    assert.match(executePhase, /trusted main-checkout state/i);
    assert.match(executePhase, /instead of teaching workspace-local retries/i);
  });
});

describe('Phase 157 planning context cascade workflow contracts', () => {
  test('new-milestone gives milestone strategy a single owned home', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'new-milestone.md'), 'utf-8');
    const template = fs.readFileSync(path.join(process.cwd(), 'templates', 'MILESTONE-INTENT.md'), 'utf-8');

    assert.match(template, /milestone-local direction/i);
    assert.match(template, /\.planning\/MILESTONE-INTENT\.md/);
    assert.match(template, /\.planning\/INTENT\.md` = enduring project north star/i);

    assert.match(workflow, /create or refresh `?\.planning\/MILESTONE-INTENT\.md`?/i);
    assert.match(workflow, /single owned home for milestone-specific why-now strategy/i);
    assert.match(workflow, /project north star and durable outcomes/i);
    assert.match(workflow, /Do \*\*not\*\* evolve `?\.planning\/INTENT\.md`? just to capture temporary milestone focus/i);
    assert.match(workflow, /Roadmapper inputs must distinguish the two layers explicitly/i);
  });

  test('plan-phase research-phase and verify-work prefer effective intent plus advisory JJ capability context', () => {
    const plan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'plan-phase.md'), 'utf-8');
    const research = fs.readFileSync(path.join(process.cwd(), 'workflows', 'research-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(plan, /`effective_intent` is the default compact contract/i);
    assert.match(plan, /`jj_planning_context` is advisory capability context only/i);
    assert.match(plan, /may manually prefer safe low-overlap sibling work/i);
    assert.match(plan, /do not depend on live workspace inventory/i);
    assert.doesNotMatch(plan, /Also read: \.planning\/INTENT\.md/);

    assert.match(research, /Treat injected `effective_intent` as the default planning-alignment contract/i);
    assert.match(research, /Do not depend on live workspace inventory/i);
    assert.match(research, /manual preference for safe low-overlap sibling work/i);
    assert.doesNotMatch(research, /- \.planning\/INTENT\.md \(Project intent/i);

    assert.match(verify, /Use injected `effective_intent` as the default intent contract/i);
    assert.match(verify, /Use injected `jj_planning_context` only as advisory capability context/i);
    assert.match(verify, /manually prefer safe low-overlap sibling work/i);
    assert.doesNotMatch(verify, /Also read \.planning\/INTENT\.md if it exists/i);
  });
});

describe('Phase 158 canonical wrapper contracts', () => {
  test('quick canonical command points at the quick workflow', () => {
    const quick = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-quick.md'), 'utf-8');

    assert.match(quick, /canonical quick-entry command/i);
    assert.match(quick, /preferred quick-entry command/i);
    assert.match(quick, /@__OPENCODE_CONFIG__\/bgsd-oc\/workflows\/quick\.md/);
    assert.match(quick, /all provided arguments/i);
  });

  test('canonical plan and inspect wrappers exist as executable family entrypoints', () => {
    const plan = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-plan.md'), 'utf-8');
    const inspect = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-inspect.md'), 'utf-8');
    const settings = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-settings.md'), 'utf-8');

    assert.match(plan, /canonical planning-family command/i);
    assert.match(plan, /canonical planning umbrella/i);
    assert.match(plan, /phase <phase-number> \[flags\].*plan-phase\.md/is);
    assert.match(plan, /discuss <phase-number> \[flags\].*discuss-phase\.md/is);
    assert.match(plan, /research <phase-number> \[flags\].*research-phase\.md/is);
    assert.match(plan, /assumptions <phase-number> \[flags\].*list-phase-assumptions\.md/is);
    assert.match(plan, /roadmap add\|insert\|remove.*roadmap mutation/is);
    assert.match(plan, /todo add\|check.*plan-scoped todo/is);
    assert.match(plan, /Settings and read-only inspection remain separate canonical families/i);
    assert.match(plan, /Do not preload sibling planning-family workflows into context/i);
    assert.match(plan, /operational command invocation, not a request to inspect or explain the planning-family router itself/i);
    assert.match(plan, /immediately execute the selected workflow and continue that workflow's planning or planning-prep behavior/i);
    assert.match(plan, /use the Read tool to load only the selected workflow file/i);
    assert.match(plan, /Do not read non-selected sibling workflows unless the selected workflow explicitly requires them/i);

    assert.match(inspect, /canonical read-only diagnostics command family/i);
    assert.match(inspect, /canonical read-only diagnostics hub/i);
    assert.match(inspect, /Do not preload sibling inspect-family workflows into context/i);
    assert.match(inspect, /use the Read tool to load only the selected workflow file/i);
    assert.match(inspect, /operational command invocation, not a request to modify or audit the command family itself/i);
    assert.match(inspect, /immediately execute the selected workflow and return that workflow's diagnostic result/i);
    assert.match(inspect, /velocity[\s\S]*cmd-velocity\.md/i);
    assert.match(inspect, /context-budget[\s\S]*cmd-context-budget\.md/i);
    assert.match(inspect, /session-diff[\s\S]*cmd-session-diff\.md/i);
    assert.match(inspect, /rollback-info[\s\S]*cmd-rollback-info\.md/i);
    assert.match(inspect, /validate-deps[\s\S]*cmd-validate-deps\.md/i);
    assert.match(inspect, /read-only diagnostics boundary/i);

    assert.match(settings, /canonical settings-family command/i);
    assert.match(settings, /Do not preload sibling settings-family workflows into context/i);
    assert.match(settings, /use the Read tool to load only the selected workflow file/i);
  });

  test('canonical plan inspect and settings wrappers do not reference removed alias commands', () => {
    const plan = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-plan.md'), 'utf-8');
    const inspect = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-inspect.md'), 'utf-8');
    const settings = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-settings.md'), 'utf-8');

    assert.doesNotMatch(plan, /\/bgsd-plan-phase|\/bgsd-discuss-phase|\/bgsd-research-phase|\/bgsd-list-assumptions|\/bgsd-add-phase|\/bgsd-insert-phase|\/bgsd-remove-phase|\/bgsd-plan-gaps|\/bgsd-add-todo|\/bgsd-check-todos/i);
    assert.doesNotMatch(inspect, /\/bgsd-progress|\/bgsd-health|\/bgsd-impact|\/bgsd-trace|\/bgsd-search-decisions|\/bgsd-search-lessons|\/bgsd-velocity|\/bgsd-context-budget|\/bgsd-session-diff|\/bgsd-rollback-info|\/bgsd-validate-deps/i);
    assert.doesNotMatch(settings, /\/bgsd-set-profile|\/bgsd-validate-config/i);
  });

  test('command wrappers keep file includes inside execution_context blocks only', () => {
    const commandDir = path.join(process.cwd(), 'commands');
    const commandFiles = fs.readdirSync(commandDir).filter((name) => name.endsWith('.md'));

    for (const file of commandFiles) {
      const content = fs.readFileSync(path.join(commandDir, file), 'utf-8');
      const sanitized = content.replace(/<execution_context>[\s\S]*?<\/execution_context>/gi, '<execution_context></execution_context>');
      assert.doesNotMatch(
        sanitized,
        /@__OPENCODE_CONFIG__\/bgsd-oc\//,
        `${file} should not contain OpenCode file references outside execution_context`
      );
    }
  });

  test('runtime handoff defaults prefer canonical planning-family commands', () => {
    const initCommand = fs.readFileSync(path.join(process.cwd(), 'src', 'commands', 'init.js'), 'utf-8');

    assert.match(initCommand, /return `\/bgsd-plan research \$\{safePhase\}`;/, 'discuss-step handoffs should default to canonical research routing');
    assert.match(initCommand, /`\/bgsd-plan discuss \$\{safePhase\}`/, 'restart guidance should default to canonical discuss routing');
    assert.doesNotMatch(initCommand, /\/bgsd-research-phase \$\{safePhase\}|\/bgsd-discuss-phase \$\{safePhase\}/, 'runtime handoff defaults should not regress to legacy planning-prep aliases');
  });

  test('settings canonical family stays on one shared settings contract', () => {
    const settings = fs.readFileSync(path.join(process.cwd(), 'commands', 'bgsd-settings.md'), 'utf-8');

    assert.match(settings, /canonical settings family/i);
    assert.match(settings, /`profile <name>`/i);
    assert.match(settings, /`validate \[config-path\]`/i);
    assert.match(settings, /keep `\/bgsd-settings` separate from the canonical planning and read-only inspection families/i);
    assert.doesNotMatch(settings, /\/bgsd-set-profile|\/bgsd-validate-config/i);
  });

  test('help workflow prefers canonical planning inspect and settings family names on touched surfaces', () => {
    const help = fs.readFileSync(path.join(process.cwd(), 'workflows', 'help.md'), 'utf-8');

    assert.match(help, /\/bgsd-plan phase 1/);
    assert.match(help, /\/bgsd-plan roadmap insert 12/);
    assert.match(help, /\/bgsd-plan todo add "Fix modal z-index"/);
    assert.match(help, /\/bgsd-settings profile quality/);
    assert.match(help, /\/bgsd-settings validate \.planning\/config\.json/);
    assert.match(help, /\/bgsd-inspect health/);
    assert.match(help, /\/bgsd-inspect trace CMD-04/);
  });
});

describe('Phase 165 repo-local rebuilt-runtime workflow contracts', () => {
  test('execute and verify workflows require repo-local current-checkout proof plus rebuilt local runtime validation', () => {
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(execute, /repo-local current checkout plus the rebuilt local runtime/i);
    assert.match(execute, /Never trust stale generated artifacts/i);
    assert.match(execute, /run `npm run build`, then rerun the focused proof/i);

    assert.match(verify, /depends on generated runtime artifacts/i);
    assert.match(verify, /validate the repo-local current checkout and rebuild the local runtime before asking the user to trust shipped output/i);
    assert.match(verify, /The agent runs `npm run build`, reruns the focused proof against the rebuilt local runtime/i);
  });
});

describe('Phase 181 workspace proof-first workflow contracts', () => {
  test('execute-phase keeps proof-first sequential fallback wording explicit', () => {
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');

    assert.match(execute, /`workspace prove \{plan_id\}` immediately after workspace creation/i);
    assert.match(execute, /before executor plan work starts/i);
    assert.match(execute, /Only if proof succeeds may the workflow continue with workspace-parallel execution/i);
    assert.match(execute, /fall back to Mode B sequential execution before any plan work begins/i);
    assert.match(execute, /observed executor cwd, observed `jj workspace root`, and one generic fallback reason/i);
    assert.match(execute, /before any plan work, summary creation, plan-local outputs, or other repo-relative work begin/i);
  });

  test('execute-plan keeps workspace-rooted output containment explicit', () => {
    const executePlan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-plan.md'), 'utf-8');

    assert.match(executePlan, /executor's current repo root is the assigned workspace root/i);
    assert.match(executePlan, /repo-relative reads, writes, and plan-local outputs rooted there/i);
    assert.match(executePlan, /Do not create `SUMMARY\.md`, workspace proof sidecars, or other plan-local artifacts until workspace proof status is known/i);
    assert.match(executePlan, /inside the assigned workspace checkout while workspace mode remains active/i);
  });

  test('phase 182 route-aware workflow and report surfaces keep proof buckets separate', () => {
    const execute = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-phase.md'), 'utf-8');
    const verify = fs.readFileSync(path.join(process.cwd(), 'workflows', 'verify-work.md'), 'utf-8');
    const report = fs.readFileSync(path.join(process.cwd(), 'templates', 'verification-report.md'), 'utf-8');

    for (const content of [verify, report]) {
      assert.match(content, /Behavior Proof/i);
      assert.match(content, /Regression Proof/i);
      assert.match(content, /Human Verification/i);
      assert.match(content, /not required/i);
    }

    assert.match(execute, /structural proof only/i);
    assert.match(execute, /named focused proof plus smoke regression/i);
    assert.match(execute, /one broad regression gate/i);
    assert.match(verify, /route-exempt buckets as `not required`/i);
  });
});

describe('Phase 166 completion metadata workflow contracts', () => {
  test('execute-plan uses the repaired completion path and readback repair wording', () => {
    const executePlan = fs.readFileSync(path.join(process.cwd(), 'workflows', 'execute-plan.md'), 'utf-8');

    assert.match(executePlan, /verify:state complete-plan/i, 'workflow should use the batched completion command');
    assert.match(executePlan, /verify:state validate/i, 'workflow should gate progression on post-write validation');
    assert.match(executePlan, /immediately follow any batched state write/i, 'workflow should require validation after batched writes');
    assert.match(executePlan, /retry once/i, 'workflow should allow one transient retry');
    assert.match(executePlan, /fail closed/i, 'workflow should stop on repeated validation failure');
    assert.match(executePlan, /read back and repair stale STATE or ROADMAP summary fields/i, 'workflow should require focused metadata readback repair');
    assert.match(executePlan, /active plan rather than ambient workspace noise/i, 'workflow should describe the plan-scoped completion contract');
  });
});
