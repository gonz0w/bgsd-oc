/**
 * Contract tests for summary generation (Phase 113: Programmatic Summary Generation).
 * Tests cmdSummaryGenerate happy path, merge/preserve, edge cases, and CLI integration.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract JSON from CLI output that may contain banner lines or pretty-printed JSON.
 */
function extractJson(output) {
  // Find the first '{' and parse from there
  const idx = output.indexOf('{');
  if (idx === -1) throw new Error('No JSON found in output: ' + output);
  return JSON.parse(output.slice(idx));
}

/**
 * Create a git-initialized temp project with a PLAN.md, make scoped commits.
 */
function createTestProject(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-sumgen-'));
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '0050-test-phase');
  fs.mkdirSync(phaseDir, { recursive: true });

  // Init git repo
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  // Write PLAN.md
  const planContent = opts.planContent || `---
phase: 0050-test-phase
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main.js
  - tests/main.test.js
autonomous: true
requirements: [REQ-01, REQ-02]
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Build the main module with tests.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Implement main module</name>
  <files>src/main.js</files>
  <action>Create the main module.</action>
  <verify>Module exists.</verify>
  <done>Module works.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests</name>
  <files>tests/main.test.js</files>
  <action>Create tests.</action>
  <verify>Tests pass.</verify>
  <done>Tests exist.</done>
</task>

</tasks>
`;
  fs.writeFileSync(path.join(phaseDir, '0050-01-PLAN.md'), planContent);

  // Initial commit
  execSync('git add -A && git commit -m "init: project setup"', { cwd: tmpDir, stdio: 'pipe' });

  if (!opts.skipCommits) {
    // Make scoped commits
    const srcDir = path.join(tmpDir, 'src');
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'main.js'), 'module.exports = { hello: () => "world" };');
    execSync('git add -A && git commit -m "feat(0050-01): implement main module"', { cwd: tmpDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(testsDir, 'main.test.js'), 'const m = require("../src/main"); console.assert(m.hello() === "world");');
    execSync('git add -A && git commit -m "test(0050-01): add tests for main module"', { cwd: tmpDir, stdio: 'pipe' });
  }

  return tmpDir;
}

// ─── Happy Path Tests ────────────────────────────────────────────────────────

describe('summary-generate: happy path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('generates SUMMARY.md at expected path', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.ok(json.path, 'Should have path in output');
    assert.ok(json.path.includes('0050-01-SUMMARY.md'), `Path should contain summary filename, got: ${json.path}`);

    const summaryPath = path.join(tmpDir, json.path);
    assert.ok(fs.existsSync(summaryPath), 'SUMMARY.md should exist on disk');
  });

  it('finds scoped commits', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.commits_found >= 2, `Should find at least 2 scoped commits, got: ${json.commits_found}`);
  });

  it('finds changed files', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.files_found >= 2, `Should find at least 2 files, got: ${json.files_found}`);
  });

  it('ignores unrelated dirty workspace files when scoped commits exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'scratch.txt'), 'ambient workspace noise');

    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(content.includes('src/main.js'), 'Should still include scoped commit files');
    assert.ok(!content.includes('scratch.txt'), 'Should not include unrelated dirty workspace files');
  });

  it('frontmatter has required fields', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    // Check frontmatter fields
    assert.ok(content.includes('phase: 0050-test-phase'), 'Should have phase');
    assert.ok(content.includes('plan: 01'), 'Should have plan');
    assert.ok(content.includes('subsystem:'), 'Should have subsystem');
    assert.ok(content.includes('tags:'), 'Should have tags');
    assert.ok(content.includes('key-files:'), 'Should have key-files');
    assert.ok(content.includes('requirements-completed:'), 'Should have requirements-completed');
    assert.ok(content.includes('REQ-01'), 'Should preserve REQ-01');
    assert.ok(content.includes('REQ-02'), 'Should preserve REQ-02');
    assert.ok(content.includes('duration:'), 'Should have duration');
    assert.ok(content.includes('completed:'), 'Should have completed');
  });

  it('performance section has data', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(content.includes('## Performance'), 'Should have Performance section');
    assert.ok(content.includes('**Tasks:** 2'), 'Should show 2 tasks');
    assert.ok(content.includes('**Files modified:**'), 'Should have files modified');
  });

  it('task commits section lists task names with hashes', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(content.includes('## Task Commits'), 'Should have Task Commits section');
    assert.ok(content.includes('Task 1: Implement main module'), 'Should list task 1 name');
    assert.ok(content.includes('Task 2: Add tests'), 'Should list task 2 name');
    // Check for commit hash pattern (7-char hex)
    assert.ok(/`[0-9a-f]{7}`/.test(content), 'Should have commit hashes');
  });

  it('files section lists files with insertion/deletion counts', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(content.includes('## Files Created/Modified'), 'Should have Files section');
    assert.ok(content.includes('src/main.js'), 'Should list main.js');
    assert.ok(/\[\+\d+\/-\d+\]/.test(content), 'Should have [+N/-N] format');
  });

  it('judgment sections have TODO markers', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(content.includes('TODO: accomplishments'), 'Should have accomplishments TODO');
    assert.ok(content.includes('TODO: decisions'), 'Should have decisions TODO');
    assert.ok(content.includes('TODO: deviations'), 'Should have deviations TODO');
    assert.ok(content.includes('TODO: issues'), 'Should have issues TODO');
    assert.ok(content.includes('TODO: next-phase-readiness'), 'Should have next-phase TODO');
    assert.ok(content.includes('TODO: one-liner'), 'Should have one-liner TODO');
  });

  it('JSON output has correct counts', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);

    assert.strictEqual(typeof json.commits_found, 'number');
    assert.strictEqual(typeof json.files_found, 'number');
    assert.strictEqual(typeof json.todos_remaining, 'number');
    assert.ok(json.commits_found >= 2, 'Should find commits');
    assert.ok(json.files_found >= 2, 'Should find files');
    assert.ok(json.todos_remaining > 0, 'Should have TODOs remaining');
  });
});

// ─── Merge/Preserve Tests ────────────────────────────────────────────────────

describe('summary-generate: merge/preserve', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('preserves LLM-filled sections on re-run', () => {
    // First run generates scaffold
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');

    // Manually fill some judgment sections
    let content = fs.readFileSync(summaryPath, 'utf-8');
    content = content.replace(
      'TODO: accomplishments (2-3 bullets, what changed and why)',
      '- Built the main module\n- Added comprehensive tests'
    );
    content = content.replace(
      'TODO: decisions (key decisions with brief rationale, or "None - followed plan as specified")',
      'Used CommonJS modules for compatibility.'
    );
    fs.writeFileSync(summaryPath, content);

    // Second run should preserve filled sections
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const merged = fs.readFileSync(summaryPath, 'utf-8');

    assert.ok(merged.includes('Built the main module'), 'Should preserve filled accomplishments');
    assert.ok(merged.includes('Used CommonJS modules'), 'Should preserve filled decisions');
    // Unfilled sections should still have TODO markers
    assert.ok(merged.includes('TODO: deviations'), 'Should keep unfilled deviations');
    assert.ok(merged.includes('TODO: issues'), 'Should keep unfilled issues');
  });

  it('regenerates data sections on re-run', () => {
    // First run
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');

    // Add another commit
    fs.writeFileSync(path.join(tmpDir, 'src', 'helper.js'), 'module.exports = {};');
    execSync('git add -A && git commit -m "feat(0050-01): add helper module"', { cwd: tmpDir, stdio: 'pipe' });

    // Re-run should pick up new commit
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.commits_found >= 3, `Should find 3+ commits after addition, got: ${json.commits_found}`);
  });

  it('preserves filled one-liner on re-run', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');

    let content = fs.readFileSync(summaryPath, 'utf-8');
    content = content.replace(
      /\*\*TODO: one-liner.*?\*\*/,
      '**Main module with hello-world functionality and tests**'
    );
    fs.writeFileSync(summaryPath, content);

    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const merged = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(merged.includes('Main module with hello-world functionality'), 'Should preserve filled one-liner');
  });
});

// ─── No Scoped Commits ──────────────────────────────────────────────────────

describe('summary-generate: no scoped commits', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject({ skipCommits: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('does not error with no scoped commits', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const json = extractJson(result.output);
    assert.strictEqual(json.commits_found, 0, 'Should report 0 commits');
  });

  it('includes warning about no commits', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.warnings.length > 0, 'Should have warnings');
    assert.ok(json.warnings[0].includes('No scoped commits'), 'Warning should mention no commits');
  });

  it('task commits section indicates no commits found', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('No scoped commits found'), 'Should indicate no commits in body');
  });

  it('falls back to declared plan files instead of ambient dirty workspace files', () => {
    fs.writeFileSync(path.join(tmpDir, 'ambient-noise.js'), 'module.exports = "noise";');

    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.strictEqual(json.files_found, 2, 'Should count declared plan files when no scoped commits exist');

    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('src/main.js'), 'Should include declared plan file fallback');
    assert.ok(content.includes('tests/main.test.js'), 'Should include declared task file fallback');
    assert.ok(!content.includes('ambient-noise.js'), 'Should ignore unrelated dirty workspace files');
  });

  it('TODO markers present for all judgment sections', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('TODO: accomplishments'), 'accomplishments TODO');
    assert.ok(content.includes('TODO: decisions'), 'decisions TODO');
    assert.ok(content.includes('TODO: deviations'), 'deviations TODO');
    assert.ok(content.includes('TODO: issues'), 'issues TODO');
    assert.ok(content.includes('TODO: next-phase-readiness'), 'next-phase TODO');
  });
});

// ─── Missing PLAN.md ────────────────────────────────────────────────────────

describe('summary-generate: missing plan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Write a placeholder file so git has something to commit
    fs.writeFileSync(path.join(tmpDir, '.planning', 'README.md'), '# Planning');
    // Init git so findPhaseInternal works
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns error JSON for non-existent phase', () => {
    const result = runGsdTools('util:summary-generate 999 01 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.error, 'Should have error field');
    assert.strictEqual(json.fallback, true, 'Should have fallback: true');
  });
});

// ─── Scope Normalization ────────────────────────────────────────────────────

describe('summary-generate: scope normalization', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  it('matches commits scoped as both 0050-01 and 50-01', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-scope-'));
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0050-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });

    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

    // Write PLAN.md
    fs.writeFileSync(path.join(phaseDir, '0050-01-PLAN.md'), `---
phase: 0050-test-phase
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>Test scope normalization.</objective>

<tasks>
<task type="auto">
  <name>Task 1: Alpha</name>
  <files>a.js</files>
  <action>Create file.</action>
  <verify>File exists.</verify>
  <done>Done.</done>
</task>
<task type="auto">
  <name>Task 2: Beta</name>
  <files>b.js</files>
  <action>Create file.</action>
  <verify>File exists.</verify>
  <done>Done.</done>
</task>
</tasks>
`);

    execSync('git add -A && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    // Commit with zero-padded scope
    fs.writeFileSync(path.join(tmpDir, 'a.js'), '// alpha');
    execSync('git add -A && git commit -m "feat(0050-01): alpha"', { cwd: tmpDir, stdio: 'pipe' });

    // Commit with non-padded scope
    fs.writeFileSync(path.join(tmpDir, 'b.js'), '// beta');
    execSync('git add -A && git commit -m "feat(50-01): beta"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const json = extractJson(result.output);

    // Should find both commits (padded and unpadded)
    assert.ok(json.commits_found >= 2, `Should find both scope variants, got: ${json.commits_found}`);
  });
});

// ─── CLI Integration ────────────────────────────────────────────────────────

describe('summary-generate: CLI integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('produces valid JSON via --raw flag', () => {
    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, 'CLI should succeed');

    // Parse JSON from output (may have banner lines)
    let json;
    assert.doesNotThrow(() => { json = extractJson(result.output); }, 'Output should contain valid JSON');

    assert.ok('path' in json, 'JSON should have path');
    assert.ok('commits_found' in json, 'JSON should have commits_found');
    assert.ok('files_found' in json, 'JSON should have files_found');
    assert.ok('todos_remaining' in json, 'JSON should have todos_remaining');
  });

  it('writes file to disk when run via CLI', () => {
    runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0050-test-phase', '0050-01-SUMMARY.md');
    assert.ok(fs.existsSync(summaryPath), 'File should exist after CLI run');
  });

  it('surfaces trailer-derived TDD audit fields when audit artifact exists', () => {
    cleanup(tmpDir);
    tmpDir = createTestProject({
      skipCommits: true,
      planContent: `---
phase: 0050-test-phase
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/main.js
  - tests/main.test.js
autonomous: true
requirements: [REQ-TDD]
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Prove TDD summary audit output.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Deliver feature through TDD</name>
  <files>src/main.js, tests/main.test.js</files>
  <action>Run RED/GREEN/REFACTOR.</action>
  <verify>Proof exists.</verify>
  <done>Done.</done>
</task>
</tasks>
`
    });

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0050-test-phase');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'main.test.js'), 'console.log("red")');
    execSync('git add -A && git commit -m "test(0050-01): add failing test" -m "GSD-Phase: red"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), 'module.exports = { hello: () => "world" };');
    execSync('git add -A && git commit -m "feat(0050-01): implement feature" -m "GSD-Phase: green"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), 'function hello(){ return "world"; } module.exports = { hello };');
    execSync('git add -A && git commit -m "refactor(0050-01): clean up feature" -m "GSD-Phase: refactor"', { cwd: tmpDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(phaseDir, '0050-01-TDD-AUDIT.json'), JSON.stringify({
      phases: {
        red: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 1, matched_evidence_snippet: 'not ok 1 - hello', expected_outcome: 'fail', observed_outcome: 'fail' },
        green: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 0, matched_evidence_snippet: 'ok 1 - hello', expected_outcome: 'pass', observed_outcome: 'pass' },
        refactor: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 0, matched_evidence_snippet: 'ok 1 - hello', expected_outcome: 'pass', observed_outcome: 'pass' }
      }
    }, null, 2));

    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.strictEqual(json.tdd_audit_stages, 3, 'Should report three TDD audit stages');

    const summaryPath = path.join(phaseDir, '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('## TDD Audit Trail'), 'Should include TDD audit section');
    assert.ok(content.includes('**GSD-Phase:** red'), 'Should include red trailer');
    assert.ok(content.includes('**GSD-Phase:** refactor'), 'Should include refactor trailer');
    assert.ok(content.includes('**Target command:** `node --test tests/main.test.js --test-name-pattern "hello"`'), 'Should include target command');
    assert.ok(content.includes('**Exit status:** `1`'), 'Should include red exit status');
    assert.ok(content.includes('### Machine-Readable Stage Proof'), 'Should include machine-readable audit section');
    assert.ok(content.includes('"gsd_phase": "refactor"'), 'Should include refactor machine-readable proof');
  });

  it('still renders the TDD audit trail when resumable handoff artifacts preserve proof metadata', () => {
    cleanup(tmpDir);
    tmpDir = createTestProject({
      skipCommits: true,
      planContent: `---
phase: 0050-test-phase
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/main.js
autonomous: true
requirements: [TDD-06, FLOW-08]
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Prove resumed summary rendering keeps TDD proof.
</objective>
`
    });

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0050-test-phase');
    const handoffDir = path.join(tmpDir, '.planning', 'phase-handoffs', '50');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '0050-01-TDD-AUDIT.json'), JSON.stringify({
      phases: {
        red: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 1, matched_evidence_snippet: 'not ok 1 - hello' },
        green: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 0, matched_evidence_snippet: 'ok 1 - hello' },
        refactor: { target_command: 'node --test tests/main.test.js --test-name-pattern "hello"', exit_code: 0, matched_evidence_snippet: 'ok 1 - hello' },
      },
    }, null, 2));
    fs.writeFileSync(path.join(handoffDir, 'verify.json'), JSON.stringify({
      version: 1,
      kind: 'phase-handoff',
      phase: '50',
      step: 'verify',
      status: 'complete',
      run_id: '154-run',
      source_fingerprint: 'fp-154',
      created_at: '2026-03-29T00:00:00.000Z',
      updated_at: '2026-03-29T00:00:00.000Z',
      summary: 'Verification complete',
      resume_target: { next_command: '/bgsd-transition' },
      context: {
        tdd_audits: [
          {
            path: '.planning/phases/0050-test-phase/0050-01-TDD-AUDIT.json',
            plan: '01',
            stages: ['red', 'green', 'refactor'],
          },
        ],
      },
    }, null, 2));

    execSync('git add -A && git commit -m "test(0050-01): add proof history" -m "GSD-Phase: red"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "feat(0050-01): implement proof history" -m "GSD-Phase: green"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "refactor(0050-01): clean up proof history" -m "GSD-Phase: refactor"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('util:summary-generate 50 01 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.strictEqual(json.tdd_audit_stages, 3, 'Should still report three TDD audit stages after resume-oriented handoffs');

    const summaryPath = path.join(phaseDir, '0050-01-SUMMARY.md');
    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('## TDD Audit Trail'), 'Should keep rendering the TDD audit section');
    assert.ok(content.includes('**Target command:** `node --test tests/main.test.js --test-name-pattern "hello"`'), 'Should keep rendering the preserved proof target command');
    assert.ok(content.includes('"gsd_phase": "refactor"'), 'Should keep rendering machine-readable refactor proof');
  });
});
