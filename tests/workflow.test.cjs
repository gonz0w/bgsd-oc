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
