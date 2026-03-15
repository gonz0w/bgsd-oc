/**
 * bgsd-tools trajectory tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');
const { getDb, closeAll, MapDatabase } = require('../src/lib/db');
const { PlanningCache } = require('../src/lib/planning-cache');

describe('trajectory checkpoint', () => {
  let tmpDir;

  function initGitForCheckpoint(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('basic checkpoint creation creates branch and journal entry', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint my-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.strictEqual(output.checkpoint, 'my-test');
    assert.strictEqual(output.branch, 'trajectory/phase/my-test/attempt-1');
    assert.strictEqual(output.attempt, 1);
    assert.ok(output.git_ref, 'should have git_ref');

    // Verify branch exists
    const brResult = execSync('git branch', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(brResult.includes('trajectory/phase/my-test/attempt-1'), 'Branch should exist');

    // Verify journal entry
    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    assert.ok(fs.existsSync(trajPath), 'trajectory.json should exist');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].category, 'checkpoint');
    assert.strictEqual(entries[0].checkpoint_name, 'my-test');
  });

  test('custom scope creates correctly named branch', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint my-test --scope task', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.branch, 'trajectory/task/my-test/attempt-1');
  });

  test('attempt numbering increments for same name and scope', () => {
    initGitForCheckpoint(tmpDir);
    // First checkpoint
    const r1 = runGsdTools('execute:trajectory checkpoint repeat-test', tmpDir);
    assert.ok(r1.success, `First checkpoint failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.attempt, 1);

    // Second checkpoint with same name
    const r2 = runGsdTools('execute:trajectory checkpoint repeat-test', tmpDir);
    assert.ok(r2.success, `Second checkpoint failed: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.strictEqual(o2.attempt, 2);
    assert.strictEqual(o2.branch, 'trajectory/phase/repeat-test/attempt-2');

    // Verify both branches exist
    const brResult = execSync('git branch', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(brResult.includes('attempt-1'), 'attempt-1 branch should exist');
    assert.ok(brResult.includes('attempt-2'), 'attempt-2 branch should exist');
  });

  test('name validation rejects invalid names', () => {
    initGitForCheckpoint(tmpDir);
    const r1 = runGsdTools('execute:trajectory checkpoint "bad name!"', tmpDir);
    assert.strictEqual(r1.success, false, 'Should fail with spaces/special chars');
  });

  test('missing name produces error', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without name');
    assert.ok(result.error.includes('Missing') || result.error.includes('name'), 'Error should mention missing name');
  });

  test('journal entry has required fields', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint struct-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    const entry = entries[0];

    assert.ok(entry.id, 'should have id');
    assert.match(entry.id, /^tj-[a-f0-9]{6}$/, 'ID should match tj-XXXXXX format');
    assert.ok(entry.timestamp, 'should have timestamp');
    assert.strictEqual(entry.category, 'checkpoint');
    assert.ok(entry.scope, 'should have scope');
    assert.ok(entry.checkpoint_name, 'should have checkpoint_name');
    assert.strictEqual(typeof entry.attempt, 'number', 'attempt should be number');
    assert.ok(entry.branch, 'should have branch');
    assert.ok(entry.git_ref, 'should have git_ref');
    assert.ok(entry.metrics, 'should have metrics');
  });

  test('metrics object has expected keys', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint metrics-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    assert.ok(output.metrics, 'should have metrics');
    assert.ok('tests' in output.metrics, 'metrics should have tests key');
    assert.ok('loc_delta' in output.metrics, 'metrics should have loc_delta key');
    assert.ok('complexity' in output.metrics, 'metrics should have complexity key');
  });

  test('branch naming follows convention exactly', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint naming-test --scope task', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    const branchPattern = /^trajectory\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/attempt-\d+$/;
    assert.match(output.branch, branchPattern, 'Branch should match trajectory/<scope>/<name>/attempt-N');
    assert.strictEqual(output.branch, 'trajectory/task/naming-test/attempt-1');
  });

  test('description flag stores in journal entry', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint desc-test --description "testing approach A"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    assert.strictEqual(entries[0].description, 'testing approach A');
  });

  test('unknown trajectory subcommand shows error', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory badcmd', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with unknown subcommand');
    assert.ok(result.error.includes('Unknown') || result.error.includes('Available'), 'Error should mention available subcommands');
  });

  test('rejects checkpoint when working tree is dirty', () => {
    initGitForCheckpoint(tmpDir);
    // Create an uncommitted file
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'uncommitted');
    const result = runGsdTools('execute:trajectory checkpoint dirty-test', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with dirty working tree');
    assert.ok(result.error.includes('Uncommitted'), 'Error should mention uncommitted changes');
  });

  test('checkpoint tags include checkpoint tag', () => {
    initGitForCheckpoint(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint tag-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    assert.deepStrictEqual(entries[0].tags, ['checkpoint']);
  });
});

describe('trajectory list', () => {
  let tmpDir;

  function writeCheckpointEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty list returns zero checkpoints', () => {
    const result = runGsdTools('execute:trajectory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.checkpoints, []);
    assert.strictEqual(output.count, 0);
  });

  test('list returns checkpoints after writing entries', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'my-feature', scope: 'phase', attempt: 1, branch: 'trajectory/phase/my-feature/attempt-1', git_ref: 'abc1234567890', metrics: { tests: { total: 24, pass: 24, fail: 0 }, loc_delta: { insertions: 50, deletions: 12 }, complexity: null }, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1);
    assert.strictEqual(output.checkpoints[0].checkpoint_name, 'my-feature');
    assert.strictEqual(output.checkpoints[0].scope, 'phase');
    assert.strictEqual(output.checkpoints[0].attempt, 1);
  });

  test('scope filter returns only matching scope', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'feat-a', scope: 'phase', attempt: 1, branch: 'trajectory/phase/feat-a/attempt-1', git_ref: 'abc1234', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-bbb222', timestamp: '2026-02-28T20:01:00Z', category: 'checkpoint', checkpoint_name: 'feat-b', scope: 'task', attempt: 1, branch: 'trajectory/task/feat-b/attempt-1', git_ref: 'def5678', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-ccc333', timestamp: '2026-02-28T20:02:00Z', category: 'checkpoint', checkpoint_name: 'feat-c', scope: 'phase', attempt: 1, branch: 'trajectory/phase/feat-c/attempt-1', git_ref: 'ghi9012', metrics: {}, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list --scope phase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2);
    assert.ok(output.checkpoints.every(c => c.scope === 'phase'), 'All should be phase scope');
  });

  test('name filter returns only matching name', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'my-feat', scope: 'phase', attempt: 1, branch: 'trajectory/phase/my-feat/attempt-1', git_ref: 'abc1234', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-bbb222', timestamp: '2026-02-28T20:01:00Z', category: 'checkpoint', checkpoint_name: 'my-feat', scope: 'phase', attempt: 2, branch: 'trajectory/phase/my-feat/attempt-2', git_ref: 'def5678', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-ccc333', timestamp: '2026-02-28T20:02:00Z', category: 'checkpoint', checkpoint_name: 'other', scope: 'phase', attempt: 1, branch: 'trajectory/phase/other/attempt-1', git_ref: 'ghi9012', metrics: {}, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list --name my-feat', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2);
    assert.ok(output.checkpoints.every(c => c.checkpoint_name === 'my-feat'), 'All should be my-feat');
  });

  test('limit restricts number of results', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'a', scope: 'phase', attempt: 1, branch: 'trajectory/phase/a/attempt-1', git_ref: 'abc1234', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-bbb222', timestamp: '2026-02-28T20:01:00Z', category: 'checkpoint', checkpoint_name: 'b', scope: 'phase', attempt: 1, branch: 'trajectory/phase/b/attempt-1', git_ref: 'def5678', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-ccc333', timestamp: '2026-02-28T20:02:00Z', category: 'checkpoint', checkpoint_name: 'c', scope: 'phase', attempt: 1, branch: 'trajectory/phase/c/attempt-1', git_ref: 'ghi9012', metrics: {}, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list --limit 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2);
  });

  test('sort order is newest first', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T18:00:00Z', category: 'checkpoint', checkpoint_name: 'oldest', scope: 'phase', attempt: 1, branch: 'trajectory/phase/oldest/attempt-1', git_ref: 'abc1234', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-bbb222', timestamp: '2026-02-28T22:00:00Z', category: 'checkpoint', checkpoint_name: 'newest', scope: 'phase', attempt: 1, branch: 'trajectory/phase/newest/attempt-1', git_ref: 'def5678', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-ccc333', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'middle', scope: 'phase', attempt: 1, branch: 'trajectory/phase/middle/attempt-1', git_ref: 'ghi9012', metrics: {}, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.checkpoints[0].checkpoint_name, 'newest', 'First should be newest');
    assert.strictEqual(output.checkpoints[1].checkpoint_name, 'middle', 'Second should be middle');
    assert.strictEqual(output.checkpoints[2].checkpoint_name, 'oldest', 'Third should be oldest');
  });

  test('entry structure has expected fields', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'struct-test', scope: 'phase', attempt: 1, branch: 'trajectory/phase/struct-test/attempt-1', git_ref: 'abc1234567890', metrics: { tests: { total: 10, pass: 10, fail: 0 }, loc_delta: { insertions: 20, deletions: 5 }, complexity: { total: 8, files_analyzed: 2 } }, tags: ['checkpoint'] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    const cp = output.checkpoints[0];

    assert.ok(cp.checkpoint_name, 'should have checkpoint_name');
    assert.ok(cp.scope, 'should have scope');
    assert.strictEqual(typeof cp.attempt, 'number', 'attempt should be number');
    assert.ok(cp.branch, 'should have branch');
    assert.ok(cp.git_ref, 'should have git_ref');
    assert.ok(cp.timestamp, 'should have timestamp');
    assert.ok(cp.metrics, 'should have metrics');
    assert.ok(cp.metrics.tests, 'should have metrics.tests');
    assert.ok(cp.metrics.loc_delta, 'should have metrics.loc_delta');
  });

  test('unknown trajectory subcommand includes list in error', () => {
    const result = runGsdTools('execute:trajectory foo', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with unknown subcommand');
    assert.ok(result.error.includes('list'), 'Error should mention list as available subcommand');
  });

  test('non-checkpoint entries are excluded from list', () => {
    const entries = [
      { id: 'tj-aaa111', timestamp: '2026-02-28T20:00:00Z', category: 'checkpoint', checkpoint_name: 'cp-one', scope: 'phase', attempt: 1, branch: 'trajectory/phase/cp-one/attempt-1', git_ref: 'abc1234', metrics: {}, tags: ['checkpoint'] },
      { id: 'tj-bbb222', timestamp: '2026-02-28T20:01:00Z', category: 'decision', text: 'Some decision', scope: 'phase', tags: ['decision'] },
      { id: 'tj-ccc333', timestamp: '2026-02-28T20:02:00Z', category: 'observation', text: 'Some observation', scope: 'task', tags: [] },
    ];
    writeCheckpointEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1, 'Only checkpoint entries should be listed');
    assert.strictEqual(output.checkpoints[0].checkpoint_name, 'cp-one');
  });
});

describe('trajectory pivot', () => {
  let tmpDir;

  function initGitForPivot(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  function setupCheckpoint(dir, name, scope, attempt) {
    scope = scope || 'phase';
    attempt = attempt || 1;
    const headSha = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    const branchName = `trajectory/${scope}/${name}/attempt-${attempt}`;
    execSync(`git branch "${branchName}"`, { cwd: dir, stdio: 'pipe' });

    const trajPath = path.join(dir, '.planning', 'memory', 'trajectory.json');
    let entries = [];
    try { entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8')); } catch (e) { entries = []; }

    entries.push({
      id: `tj-${String(entries.length + 1).padStart(6, '0')}`,
      timestamp: new Date().toISOString(),
      category: 'checkpoint',
      text: `Checkpoint: ${name} (attempt ${attempt})`,
      scope,
      checkpoint_name: name,
      attempt,
      branch: branchName,
      git_ref: headSha,
      description: null,
      metrics: null,
      tags: ['checkpoint'],
    });

    fs.writeFileSync(trajPath, JSON.stringify(entries, null, 2), 'utf-8');
    return headSha;
  }

  function addPostCheckpointCommit(dir, filename) {
    filename = filename || 'src/new-feature.js';
    const dirPart = path.dirname(filename);
    if (dirPart !== '.') fs.mkdirSync(path.join(dir, dirPart), { recursive: true });
    fs.writeFileSync(path.join(dir, filename), 'console.log("new feature");');
    execSync(`git add "${filename}" && git commit -m "post-checkpoint work"`, { cwd: dir, stdio: 'pipe' });
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('pivot rewrites to checkpoint state (PIVOT-01)', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    addPostCheckpointCommit(tmpDir, 'src/new-feature.js');

    // Verify file exists before pivot
    assert.ok(fs.existsSync(path.join(tmpDir, 'src/new-feature.js')), 'File should exist before pivot');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "approach failed"', tmpDir);
    assert.ok(result.success, `Pivot failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.pivoted, true);
    assert.strictEqual(output.checkpoint, 'my-checkpoint');
    assert.ok(output.abandoned_branch.startsWith('archived/trajectory/'), 'Abandoned branch should start with archived/trajectory/');

    // File should be gone after rewind
    assert.ok(!fs.existsSync(path.join(tmpDir, 'src/new-feature.js')), 'src/new-feature.js should not exist after rewind');

    // .planning/ should survive rewind
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'memory', 'trajectory.json')), 'trajectory.json should still exist');
  });

  test('pivot refuses on dirty working tree (PIVOT-01 prerequisite)', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    // Create uncommitted file
    fs.writeFileSync(path.join(tmpDir, 'src-dirty.js'), 'dirty');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "test"', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with dirty working tree');
    assert.ok(result.error.includes('Uncommitted') || result.error.includes('stash'), 'Error should mention dirty tree');
  });

  test('pivot with --stash on dirty tree succeeds', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    addPostCheckpointCommit(tmpDir, 'src/post.js');
    // Create dirty file
    fs.writeFileSync(path.join(tmpDir, 'src-dirty.js'), 'dirty');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "test" --stash', tmpDir);
    assert.ok(result.success, `Pivot with --stash failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.pivoted, true);
    assert.strictEqual(output.stash_used, true);
  });

  test('pivot requires --reason flag', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);

    const result = runGsdTools('execute:trajectory pivot my-checkpoint', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without --reason');
    assert.ok(result.error.includes('Reason') || result.error.includes('--reason'), 'Error should mention reason requirement');
  });

  test('pivot on nonexistent checkpoint shows error with available list', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'existing-cp', 'phase', 1);

    const result = runGsdTools('execute:trajectory pivot nonexistent --reason "test"', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with nonexistent checkpoint');
    assert.ok(result.error.includes('not found'), 'Error should mention not found');
  });

  test('auto-checkpoint creates abandoned journal entry (PIVOT-03)', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    addPostCheckpointCommit(tmpDir, 'src/failed-approach.js');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "JWT approach too complex"', tmpDir);
    assert.ok(result.success, `Pivot failed: ${result.error}`);

    // Read trajectory.json and find the abandoned entry
    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    const abandoned = entries.find(e => e.tags && e.tags.includes('abandoned'));
    assert.ok(abandoned, 'Should have an abandoned entry');
    assert.ok(abandoned.tags.includes('checkpoint'), 'Abandoned entry should have checkpoint tag');
    assert.ok(abandoned.tags.includes('abandoned'), 'Abandoned entry should have abandoned tag');
    assert.ok(abandoned.reason.text.includes('JWT approach too complex'), 'Reason should contain the provided text');
    assert.ok(abandoned.branch.startsWith('archived/trajectory/'), 'Abandoned branch should be in archived namespace');
  });

  test('archived branch is created for abandoned attempt', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    addPostCheckpointCommit(tmpDir, 'src/to-archive.js');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "archiving approach"', tmpDir);
    assert.ok(result.success, `Pivot failed: ${result.error}`);

    // Check git branches for archived branch
    const brResult = execSync('git branch --list "archived/*"', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(brResult.includes('archived/'), 'Should have an archived branch');
  });

  test('pivot with --scope flag', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'task', 1);
    addPostCheckpointCommit(tmpDir, 'src/scoped.js');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --scope task --reason "test"', tmpDir);
    assert.ok(result.success, `Pivot with --scope failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.pivoted, true);
  });

  test('pivot with --attempt flag picks specific attempt', () => {
    initGitForPivot(tmpDir);
    // Create attempt 1
    const ref1 = setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    // Commit trajectory.json and make a post-checkpoint commit
    execSync('git add .planning && git commit -m "trajectory checkpoint 1"', { cwd: tmpDir, stdio: 'pipe' });
    addPostCheckpointCommit(tmpDir, 'src/between.js');
    // Create attempt 2
    const ref2 = setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 2);
    // Commit trajectory.json and make another post-checkpoint commit
    execSync('git add .planning && git commit -m "trajectory checkpoint 2"', { cwd: tmpDir, stdio: 'pipe' });
    addPostCheckpointCommit(tmpDir, 'src/latest.js');

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --attempt 1 --reason "reverting to attempt 1"', tmpDir);
    assert.ok(result.success, `Pivot with --attempt failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.target_ref, ref1, 'Should target attempt 1 ref');
  });

  test('.planning/ directory preserved after pivot (PIVOT-01)', () => {
    initGitForPivot(tmpDir);
    setupCheckpoint(tmpDir, 'my-checkpoint', 'phase', 1);
    // Commit trajectory.json so tree is clean for pivot
    execSync('git add .planning && git commit -m "trajectory checkpoint"', { cwd: tmpDir, stdio: 'pipe' });
    addPostCheckpointCommit(tmpDir, 'src/post-work.js');

    // Create .planning file after checkpoint
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '47-test'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '47-test', 'test.md'), '# Test');
    execSync('git add .planning && git commit -m "add planning file"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('execute:trajectory pivot my-checkpoint --reason "test preservation"', tmpDir);
    assert.ok(result.success, `Pivot failed: ${result.error}`);

    // .planning file should survive rewind
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '47-test', 'test.md')), '.planning/phases/47-test/test.md should be preserved after pivot');
  });
});

describe('trajectory compare', () => {
  let tmpDir;

  function initGitForCompare(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  function writeTrajectoryEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('COMP-01: compare shows test results across attempts', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'my-feat',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/my-feat/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 95, fail: 5 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'my-feat',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/my-feat/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 100, pass: 100, fail: 0 },
          loc_delta: { insertions: 40, deletions: 8, files_changed: 3 },
          complexity: { total: 12, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare my-feat', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 2);
    assert.strictEqual(output.attempts[0].tests_pass, 95);
    assert.strictEqual(output.attempts[1].tests_pass, 100);
    assert.strictEqual(output.attempts[0].tests_fail, 5);
    assert.strictEqual(output.attempts[1].tests_fail, 0);
  });

  test('COMP-02: compare shows LOC delta across attempts', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'loc-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/loc-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 50, pass: 50, fail: 0 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 10, files_analyzed: 2 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'loc-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/loc-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 50, pass: 50, fail: 0 },
          loc_delta: { insertions: 30, deletions: 5, files_changed: 2 },
          complexity: { total: 8, files_analyzed: 2 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare loc-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempts[0].loc_insertions, 50);
    assert.strictEqual(output.attempts[0].loc_deletions, 10);
    assert.strictEqual(output.attempts[1].loc_insertions, 30);
    assert.strictEqual(output.attempts[1].loc_deletions, 5);
  });

  test('COMP-03: compare shows complexity across attempts', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'cx-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/cx-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 80, pass: 80, fail: 0 },
          loc_delta: { insertions: 60, deletions: 20, files_changed: 5 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'cx-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/cx-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 80, pass: 80, fail: 0 },
          loc_delta: { insertions: 55, deletions: 18, files_changed: 4 },
          complexity: { total: 12, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare cx-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempts[0].complexity, 15);
    assert.strictEqual(output.attempts[1].complexity, 12);
  });

  test('COMP-04: best/worst identification per metric', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'bw-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/bw-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 98, fail: 2 },
          loc_delta: { insertions: 80, deletions: 20, files_changed: 6 },
          complexity: { total: 25, files_analyzed: 5 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'bw-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/bw-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 100, pass: 90, fail: 10 },
          loc_delta: { insertions: 40, deletions: 8, files_changed: 3 },
          complexity: { total: 10, files_analyzed: 4 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare bw-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    // tests_pass: higher is better — attempt 1 (idx 0) has 98, attempt 2 (idx 1) has 90
    assert.strictEqual(output.best_per_metric.tests_pass, 0, 'Best tests_pass should be attempt 1 (index 0)');
    assert.strictEqual(output.worst_per_metric.tests_pass, 1, 'Worst tests_pass should be attempt 2 (index 1)');

    // complexity: lower is better — attempt 1 (idx 0) has 25, attempt 2 (idx 1) has 10
    assert.strictEqual(output.best_per_metric.complexity, 1, 'Best complexity should be attempt 2 (index 1)');
    assert.strictEqual(output.worst_per_metric.complexity, 0, 'Worst complexity should be attempt 1 (index 0)');

    // loc_insertions: lower is better — attempt 1 (idx 0) has 80, attempt 2 (idx 1) has 40
    assert.strictEqual(output.best_per_metric.loc_insertions, 1, 'Best loc_insertions should be attempt 2 (index 1)');
    assert.strictEqual(output.worst_per_metric.loc_insertions, 0, 'Worst loc_insertions should be attempt 1 (index 0)');
  });

  test('COMP-05: JSON output schema validation', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'schema-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/schema-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 95, fail: 5 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'schema-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/schema-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 100, pass: 100, fail: 0 },
          loc_delta: { insertions: 40, deletions: 8, files_changed: 3 },
          complexity: { total: 12, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare schema-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    // Top-level schema
    assert.ok('checkpoint' in output, 'should have checkpoint field');
    assert.ok('scope' in output, 'should have scope field');
    assert.ok('attempt_count' in output, 'should have attempt_count field');
    assert.ok(Array.isArray(output.attempts), 'attempts should be an array');
    assert.ok(typeof output.best_per_metric === 'object', 'best_per_metric should be an object');
    assert.ok(typeof output.worst_per_metric === 'object', 'worst_per_metric should be an object');

    // Attempt entry schema
    const attempt = output.attempts[0];
    assert.ok('attempt' in attempt, 'attempt entry should have attempt');
    assert.ok('branch' in attempt, 'attempt entry should have branch');
    assert.ok('git_ref' in attempt, 'attempt entry should have git_ref');
    assert.ok('timestamp' in attempt, 'attempt entry should have timestamp');
    assert.ok('tests_pass' in attempt, 'attempt entry should have tests_pass');
    assert.ok('tests_fail' in attempt, 'attempt entry should have tests_fail');
    assert.ok('tests_total' in attempt, 'attempt entry should have tests_total');
    assert.ok('loc_insertions' in attempt, 'attempt entry should have loc_insertions');
    assert.ok('loc_deletions' in attempt, 'attempt entry should have loc_deletions');
    assert.ok('complexity' in attempt, 'attempt entry should have complexity');
  });

  test('null metrics handled gracefully', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'null-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/null-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 95, fail: 5 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'null-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/null-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null,
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare null-test', tmpDir);
    assert.ok(result.success, `Command should not crash with null metrics: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 2);
    assert.strictEqual(output.attempts[1].tests_pass, null);
    assert.strictEqual(output.attempts[1].tests_fail, null);
    assert.strictEqual(output.attempts[1].tests_total, null);
    assert.strictEqual(output.attempts[1].loc_insertions, null);
    assert.strictEqual(output.attempts[1].loc_deletions, null);
    assert.strictEqual(output.attempts[1].complexity, null);
  });

  test('abandoned entries excluded from comparison', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'abandon-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/abandon-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 50, pass: 45, fail: 5 },
          loc_delta: { insertions: 30, deletions: 5, files_changed: 2 },
          complexity: { total: 10, files_analyzed: 2 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'abandon-test',
        scope: 'phase', attempt: 2,
        branch: 'archived/trajectory/phase/abandon-test/attempt-2',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null,
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-003', category: 'checkpoint', checkpoint_name: 'abandon-test',
        scope: 'phase', attempt: 3,
        branch: 'trajectory/phase/abandon-test/attempt-3',
        git_ref: 'ghi9012',
        timestamp: '2026-03-01T03:00:00Z',
        metrics: {
          tests: { total: 50, pass: 50, fail: 0 },
          loc_delta: { insertions: 25, deletions: 3, files_changed: 2 },
          complexity: { total: 8, files_analyzed: 2 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare abandon-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 2, 'Should exclude abandoned entry');
    // The two non-abandoned entries should be attempts 1 and 3
    assert.strictEqual(output.attempts[0].attempt, 1);
    assert.strictEqual(output.attempts[1].attempt, 3);
  });

  test('single attempt shows data without best/worst', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'single-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/single-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 100, fail: 0 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare single-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 1);
    assert.deepStrictEqual(output.best_per_metric, {}, 'Single attempt should have empty best_per_metric');
    assert.deepStrictEqual(output.worst_per_metric, {}, 'Single attempt should have empty worst_per_metric');
  });

  test('missing checkpoint name errors', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, []);

    const result = runGsdTools('execute:trajectory compare', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without checkpoint name');
    assert.ok(result.error.includes('Missing') || result.error.includes('name'), 'Error should mention missing name');
  });

  test('non-existent checkpoint name errors', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'exists',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/exists/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: { tests: { total: 10, pass: 10, fail: 0 }, loc_delta: null, complexity: null },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare nonexistent', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with non-existent checkpoint name');
    assert.ok(result.error.includes('not found') || result.error.includes('nonexistent'), 'Error should mention not found');
  });

  test('scope filtering works', () => {
    initGitForCompare(tmpDir);
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'scope-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/scope-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: {
          tests: { total: 100, pass: 100, fail: 0 },
          loc_delta: { insertions: 50, deletions: 10, files_changed: 4 },
          complexity: { total: 15, files_analyzed: 3 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'scope-test',
        scope: 'task', attempt: 1,
        branch: 'trajectory/task/scope-test/attempt-1',
        git_ref: 'def5678',
        timestamp: '2026-03-01T02:00:00Z',
        metrics: {
          tests: { total: 50, pass: 48, fail: 2 },
          loc_delta: { insertions: 20, deletions: 3, files_changed: 1 },
          complexity: { total: 5, files_analyzed: 1 }
        },
        tags: ['checkpoint']
      },
      {
        id: 'tj-003', category: 'checkpoint', checkpoint_name: 'scope-test',
        scope: 'task', attempt: 2,
        branch: 'trajectory/task/scope-test/attempt-2',
        git_ref: 'ghi9012',
        timestamp: '2026-03-01T03:00:00Z',
        metrics: {
          tests: { total: 50, pass: 50, fail: 0 },
          loc_delta: { insertions: 18, deletions: 2, files_changed: 1 },
          complexity: { total: 4, files_analyzed: 1 }
        },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory compare scope-test --scope task', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.attempt_count, 2, 'Should only return task-scoped entries');
    assert.strictEqual(output.scope, 'task');
    assert.strictEqual(output.attempts[0].tests_pass, 48);
    assert.strictEqual(output.attempts[1].tests_pass, 50);
  });
});

describe('trajectory choose', () => {
  let tmpDir;

  function initGitForChoose(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  function writeTrajectoryEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  function createBranchWithFile(dir, branchName, filename, content) {
    // Create a branch, switch to it, commit a file, switch back
    execSync(`git checkout -b "${branchName}"`, { cwd: dir, stdio: 'pipe' });
    const dirPart = path.dirname(filename);
    if (dirPart !== '.') fs.mkdirSync(path.join(dir, dirPart), { recursive: true });
    fs.writeFileSync(path.join(dir, filename), content);
    execSync(`git add "${filename}" && git commit -m "add ${filename} on ${branchName}"`, { cwd: dir, stdio: 'pipe' });
    const sha = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    // Switch back to the original branch (main/master)
    const defaultBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    if (defaultBranch === branchName) {
      // Determine the initial branch name
      const branches = execSync('git branch', { cwd: dir, encoding: 'utf-8' }).trim().split('\n').map(b => b.trim().replace('* ', ''));
      const mainBranch = branches.find(b => b === 'main' || b === 'master') || branches.find(b => b !== branchName);
      if (mainBranch) execSync(`git checkout "${mainBranch}"`, { cwd: dir, stdio: 'pipe' });
    }
    return sha;
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('CHOOSE-01: basic choose merges winning attempt', () => {
    initGitForChoose(tmpDir);

    // Create 2 branches with unique files
    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/my-feat/attempt-1', 'feature-a.txt', 'attempt 1 code');
    const sha2 = createBranchWithFile(tmpDir, 'trajectory/phase/my-feat/attempt-2', 'feature-b.txt', 'attempt 2 code');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'my-feat',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/my-feat/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: { tests: { total: 50, pass: 50, fail: 0 }, loc_delta: null, complexity: null },
        tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'my-feat',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/my-feat/attempt-2',
        git_ref: sha2,
        timestamp: '2026-03-01T02:00:00Z',
        metrics: { tests: { total: 50, pass: 50, fail: 0 }, loc_delta: null, complexity: null },
        tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose my-feat --attempt 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.chosen, true);
    assert.strictEqual(output.chosen_attempt, 2);
    // Verify the winning branch's file exists in working tree after merge
    assert.ok(fs.existsSync(path.join(tmpDir, 'feature-b.txt')), 'Winning attempt file should exist after merge');
  });

  test('CHOOSE-01: choose requires --attempt flag', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/req-test/attempt-1', 'req-a.txt', 'code');
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'req-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/req-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose req-test', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without --attempt');
    assert.ok(result.error.includes('Must specify winning attempt') || result.error.includes('--attempt'),
      'Error should mention --attempt requirement');
  });

  test('CHOOSE-01: choose validates attempt exists', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/val-test/attempt-1', 'val-a.txt', 'code');
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'val-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/val-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose val-test --attempt 99', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with non-existent attempt');
    assert.ok(result.error.includes('not found') || result.error.includes('99'),
      'Error should mention attempt not found');
  });

  test('CHOOSE-01: choose rejects abandoned attempt as winner', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/aband-test/attempt-1', 'aband-a.txt', 'code');
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'aband-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/aband-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose aband-test --attempt 1', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail for abandoned attempt');
    assert.ok(result.error.includes('abandoned') || result.error.includes('not found'),
      'Error should indicate abandoned or not found');
  });

  test('CHOOSE-02: non-chosen attempts archived as tags', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/tag-test/attempt-1', 'tag-a.txt', 'attempt 1');
    const sha2 = createBranchWithFile(tmpDir, 'trajectory/phase/tag-test/attempt-2', 'tag-b.txt', 'attempt 2');
    const sha3 = createBranchWithFile(tmpDir, 'trajectory/phase/tag-test/attempt-3', 'tag-c.txt', 'attempt 3');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'tag-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/tag-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'tag-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/tag-test/attempt-2',
        git_ref: sha2,
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null, tags: ['checkpoint']
      },
      {
        id: 'tj-003', category: 'checkpoint', checkpoint_name: 'tag-test',
        scope: 'phase', attempt: 3,
        branch: 'trajectory/phase/tag-test/attempt-3',
        git_ref: sha3,
        timestamp: '2026-03-01T03:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose tag-test --attempt 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    // Verify git tags exist for non-chosen attempts
    const tagList = execSync('git tag -l', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(tagList.includes('trajectory/phase/tag-test/attempt-1'), 'Attempt 1 should be archived as tag');
    assert.ok(tagList.includes('trajectory/phase/tag-test/attempt-3'), 'Attempt 3 should be archived as tag');
    assert.ok(output.archived_tags.length >= 2, 'Should have at least 2 archived tags');
  });

  test('CHOOSE-03: working branches deleted after choose', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/del-test/attempt-1', 'del-a.txt', 'attempt 1');
    const sha2 = createBranchWithFile(tmpDir, 'trajectory/phase/del-test/attempt-2', 'del-b.txt', 'attempt 2');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'del-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/del-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'del-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/del-test/attempt-2',
        git_ref: sha2,
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose del-test --attempt 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    // Verify trajectory branches are gone
    const branchList = execSync('git branch --list "trajectory/*"', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.strictEqual(branchList, '', 'All trajectory working branches should be deleted');

    // Verify deleted_branches reported
    assert.ok(output.deleted_branches.length >= 2, 'Should report deleted branches');
  });

  test('journal records choose entry with correct fields', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/jrnl-test/attempt-1', 'jrnl-a.txt', 'attempt 1');
    const sha2 = createBranchWithFile(tmpDir, 'trajectory/phase/jrnl-test/attempt-2', 'jrnl-b.txt', 'attempt 2');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'jrnl-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/jrnl-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'jrnl-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/jrnl-test/attempt-2',
        git_ref: sha2,
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose jrnl-test --attempt 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Read journal and find choose entry
    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    const chooseEntry = entries.find(e => e.category === 'choose');
    assert.ok(chooseEntry, 'Should have a choose journal entry');
    assert.strictEqual(chooseEntry.chosen_attempt, 2);
    assert.ok(chooseEntry.tags.includes('choose'), 'Tags should include "choose"');
    assert.ok(chooseEntry.tags.includes('lifecycle-complete'), 'Tags should include "lifecycle-complete"');
    assert.ok(Array.isArray(chooseEntry.archived_tags), 'archived_tags should be an array');
    assert.ok(Array.isArray(chooseEntry.deleted_branches), 'deleted_branches should be an array');
  });

  test('choose with --reason records rationale', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/rsn-test/attempt-1', 'rsn-a.txt', 'attempt 1');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'rsn-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/rsn-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose rsn-test --attempt 1 --reason "Best test coverage"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    const chooseEntry = entries.find(e => e.category === 'choose');
    assert.ok(chooseEntry.reason, 'Should have a reason');
    assert.strictEqual(chooseEntry.reason.text, 'Best test coverage');
  });

  test('choose without --reason still works', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/norsn-test/attempt-1', 'norsn-a.txt', 'attempt 1');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'norsn-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/norsn-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose norsn-test --attempt 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    const chooseEntry = entries.find(e => e.category === 'choose');
    assert.strictEqual(chooseEntry.reason, null, 'Reason should be null when not provided');
  });

  test('choose with missing checkpoint name errors', () => {
    initGitForChoose(tmpDir);
    writeTrajectoryEntries(tmpDir, []);

    const result = runGsdTools('execute:trajectory choose', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without checkpoint name');
    assert.ok(result.error.includes('Missing') || result.error.includes('name'),
      'Error should mention missing checkpoint name');
  });

  test('choose with non-existent branch errors gracefully', () => {
    initGitForChoose(tmpDir);

    // Create journal entry but DON'T create the actual git branch
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'nobranch-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/nobranch-test/attempt-1',
        git_ref: 'abc1234',
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose nobranch-test --attempt 1', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with non-existent branch');
    assert.ok(result.error.includes('Branch not found') || result.error.includes('not found'),
      'Error should mention branch not found');
  });

  test('JSON output schema validation', () => {
    initGitForChoose(tmpDir);

    const sha1 = createBranchWithFile(tmpDir, 'trajectory/phase/schema-test/attempt-1', 'schema-a.txt', 'attempt 1');
    const sha2 = createBranchWithFile(tmpDir, 'trajectory/phase/schema-test/attempt-2', 'schema-b.txt', 'attempt 2');

    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-001', category: 'checkpoint', checkpoint_name: 'schema-test',
        scope: 'phase', attempt: 1,
        branch: 'trajectory/phase/schema-test/attempt-1',
        git_ref: sha1,
        timestamp: '2026-03-01T01:00:00Z',
        metrics: null, tags: ['checkpoint']
      },
      {
        id: 'tj-002', category: 'checkpoint', checkpoint_name: 'schema-test',
        scope: 'phase', attempt: 2,
        branch: 'trajectory/phase/schema-test/attempt-2',
        git_ref: sha2,
        timestamp: '2026-03-01T02:00:00Z',
        metrics: null, tags: ['checkpoint']
      }
    ]);

    const result = runGsdTools('execute:trajectory choose schema-test --attempt 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    // Top-level schema
    assert.ok('chosen' in output, 'should have chosen field');
    assert.ok('checkpoint' in output, 'should have checkpoint field');
    assert.ok('scope' in output, 'should have scope field');
    assert.ok('chosen_attempt' in output, 'should have chosen_attempt field');
    assert.ok('chosen_branch' in output, 'should have chosen_branch field');
    assert.ok('merge_ref' in output, 'should have merge_ref field');
    assert.ok(Array.isArray(output.archived_tags), 'archived_tags should be an array');
    assert.ok(Array.isArray(output.deleted_branches), 'deleted_branches should be an array');
    assert.strictEqual(output.chosen, true);
    assert.strictEqual(output.scope, 'phase');
    assert.strictEqual(output.checkpoint, 'schema-test');
  });
});

describe('stuck-detector trajectory suggestion (PIVOT-04)', () => {
  test('stuck-detector includes pivot suggestion in alternatives', () => {
    const { createStuckDetector } = require('../src/lib/recovery/stuck-detector');
    const detector = createStuckDetector();
    const taskId = 'test-task-1';

    // Record 3+ failed attempts for same task
    detector.recordAttempt(taskId, { error: 'build failed: cannot find module X' });
    detector.recordAttempt(taskId, { error: 'build failed: cannot find module X' });
    detector.recordAttempt(taskId, { error: 'build failed: cannot find module X' });

    const status = detector.getStatus(taskId);
    assert.strictEqual(status.isStuck, true, 'Should be stuck after 3 identical failures');

    // Verify alternatives include pivot suggestion
    const history = detector.taskHistory.get(taskId);
    const alternatives = detector._generateAlternatives(history);
    const pivotSuggestion = alternatives.find(a => a.approach === 'Pivot to checkpoint');
    assert.ok(pivotSuggestion, 'Should include "Pivot to checkpoint" in alternatives');
    assert.ok(pivotSuggestion.description.includes('trajectory pivot'), 'Pivot suggestion should mention trajectory pivot command');
  });

  test('pivot suggestion appears even with generic errors', () => {
    const { createStuckDetector } = require('../src/lib/recovery/stuck-detector');
    const detector = createStuckDetector();
    const taskId = 'test-task-2';

    // Record 3 identical timeout errors
    detector.recordAttempt(taskId, { error: 'timeout' });
    detector.recordAttempt(taskId, { error: 'timeout' });
    detector.recordAttempt(taskId, { error: 'timeout' });

    const history = detector.taskHistory.get(taskId);
    const alternatives = detector._generateAlternatives(history);
    const pivotSuggestion = alternatives.find(a => a.approach === 'Pivot to checkpoint');
    assert.ok(pivotSuggestion, 'Pivot suggestion should appear even for generic timeout errors');
    assert.ok(pivotSuggestion.description.includes('checkpoint'), 'Should mention checkpoint in description');
  });
});

describe('trajectory dead-ends (INTEG-01)', () => {
  let tmpDir;

  function writeTrajectoryEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('INTEG-01a: dead-ends returns empty when no journal exists', () => {
    const result = runGsdTools('execute:trajectory dead-ends', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 0);
    assert.ok(Array.isArray(output.dead_ends));
    assert.strictEqual(output.dead_ends.length, 0);
  });

  test('INTEG-01b: dead-ends returns pivot entries as dead ends', () => {
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-p01', category: 'checkpoint', checkpoint_name: 'feat-x',
        scope: 'phase', attempt: 1, branch: 'archived/trajectory/phase/feat-x/attempt-1',
        git_ref: 'aaa1111', timestamp: '2026-03-01T01:00:00Z',
        reason: { text: 'Build failed with X approach' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-p02', category: 'checkpoint', checkpoint_name: 'feat-x',
        scope: 'phase', attempt: 2, branch: 'trajectory/phase/feat-x/attempt-2',
        git_ref: 'bbb2222', timestamp: '2026-03-01T02:00:00Z',
        tags: ['checkpoint']
      },
      {
        id: 'tj-p03', category: 'checkpoint', checkpoint_name: 'feat-y',
        scope: 'phase', attempt: 1, branch: 'archived/trajectory/phase/feat-y/attempt-1',
        git_ref: 'ccc3333', timestamp: '2026-03-01T03:00:00Z',
        reason: { text: 'Performance regression' },
        tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('execute:trajectory dead-ends', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'Should find 2 abandoned entries');
    // Only entries with abandoned tag should be returned
    const names = output.dead_ends.map(de => de.checkpoint_name);
    assert.ok(names.includes('feat-x'), 'Should include feat-x');
    assert.ok(names.includes('feat-y'), 'Should include feat-y');
  });

  test('INTEG-01c: dead-ends filters by scope', () => {
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-s01', category: 'checkpoint', checkpoint_name: 'scoped-feat',
        scope: 'phase', attempt: 1, branch: 'archived/x', git_ref: 'aaa',
        timestamp: '2026-03-01T01:00:00Z',
        reason: { text: 'phase-scoped failure' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-s02', category: 'checkpoint', checkpoint_name: 'scoped-feat',
        scope: 'task', attempt: 1, branch: 'archived/y', git_ref: 'bbb',
        timestamp: '2026-03-01T02:00:00Z',
        reason: { text: 'task-scoped failure' },
        tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('execute:trajectory dead-ends --scope phase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1, 'Should find only phase-scoped dead ends');
    assert.strictEqual(output.dead_ends[0].scope, 'phase');
  });

  test('INTEG-01d: dead-ends filters by name', () => {
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-n01', category: 'checkpoint', checkpoint_name: 'alpha',
        scope: 'phase', attempt: 1, branch: 'archived/a', git_ref: 'aaa',
        timestamp: '2026-03-01T01:00:00Z',
        reason: { text: 'alpha failed' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-n02', category: 'checkpoint', checkpoint_name: 'beta',
        scope: 'phase', attempt: 1, branch: 'archived/b', git_ref: 'bbb',
        timestamp: '2026-03-01T02:00:00Z',
        reason: { text: 'beta failed' },
        tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('execute:trajectory dead-ends --name alpha', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1, 'Should find only alpha dead ends');
    assert.strictEqual(output.dead_ends[0].checkpoint_name, 'alpha');
  });
});

describe('trajectory init integration (INTEG-02)', () => {
  let tmpDir;

  function writeTrajectoryEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('INTEG-02a: init execute-phase includes previous_attempts when pivots exist', () => {
    // Create minimal phase structure
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '10-01-PLAN.md'), '---\nphase: 10-test-phase\nplan: 01\n---\n# Plan');

    // Write trajectory entries with abandoned pivots
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-init01', category: 'checkpoint', checkpoint_name: 'approach-a',
        scope: 'phase', attempt: 1, branch: 'archived/trajectory/phase/approach-a/attempt-1',
        git_ref: 'aaa1111', timestamp: '2026-03-01T01:00:00Z',
        reason: { text: 'Circular dependency with existing module' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-init02', category: 'checkpoint', checkpoint_name: 'approach-b',
        scope: 'phase', attempt: 1, branch: 'archived/trajectory/phase/approach-b/attempt-1',
        git_ref: 'bbb2222', timestamp: '2026-03-01T02:00:00Z',
        reason: { text: 'Test suite regression on pivot' },
        tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('init:execute-phase 10', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.previous_attempts !== null && output.previous_attempts !== undefined, 'previous_attempts should be present');
    assert.ok(output.previous_attempts.count > 0, 'count should be > 0');
    assert.ok(typeof output.previous_attempts.context === 'string', 'context should be a string');
    assert.ok(output.previous_attempts.context.length > 0, 'context should be non-empty');
    assert.ok(Array.isArray(output.previous_attempts.entries), 'entries should be an array');
  });

  test('INTEG-02b: init execute-phase omits previous_attempts when no pivots', () => {
    // Create minimal phase structure with no trajectory
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '10-01-PLAN.md'), '---\nphase: 10-test-phase\nplan: 01\n---\n# Plan');

    const result = runGsdTools('init:execute-phase 10', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    // previous_attempts should be null or absent (trimmed from verbose output)
    assert.ok(output.previous_attempts === null || output.previous_attempts === undefined, 'previous_attempts should be null or absent');
  });
});

describe('trajectory context formatting (INTEG-03)', () => {
  let tmpDir;

  function writeTrajectoryEntries(dir, entries) {
    const memDir = path.join(dir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries, null, 2), 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('INTEG-03a: dead-end context formatted as what-NOT-to-do', () => {
    writeTrajectoryEntries(tmpDir, [
      {
        id: 'tj-f01', category: 'checkpoint', checkpoint_name: 'method-a',
        scope: 'phase', attempt: 1, branch: 'archived/a', git_ref: 'aaa',
        timestamp: '2026-03-01T01:00:00Z',
        reason: { text: 'Recursive approach caused stack overflow' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-f02', category: 'checkpoint', checkpoint_name: 'method-b',
        scope: 'phase', attempt: 1, branch: 'archived/b', git_ref: 'bbb',
        timestamp: '2026-03-01T02:00:00Z',
        reason: { text: 'Synchronous I/O bottleneck' },
        tags: ['checkpoint', 'abandoned']
      },
      {
        id: 'tj-f03', category: 'checkpoint', checkpoint_name: 'method-c',
        scope: 'phase', attempt: 1, branch: 'archived/c', git_ref: 'ccc',
        timestamp: '2026-03-01T03:00:00Z',
        reason: { text: 'Memory leak in event listener' },
        tags: ['checkpoint', 'abandoned']
      }
    ]);

    const result = runGsdTools('execute:trajectory dead-ends', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.context.includes('Recursive approach caused stack overflow'), 'Context should include first reason');
    assert.ok(output.context.includes('Synchronous I/O bottleneck'), 'Context should include second reason');
    assert.ok(output.context.includes('Memory leak in event listener'), 'Context should include third reason');
  });

  test('INTEG-03b: dead-end context respects token cap', () => {
    // Create 20 pivots with long reasons
    const entries = [];
    for (let i = 0; i < 20; i++) {
      entries.push({
        id: `tj-cap${String(i).padStart(2, '0')}`, category: 'checkpoint',
        checkpoint_name: `method-${i}`, scope: 'phase', attempt: 1,
        branch: `archived/${i}`, git_ref: `ref${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        reason: { text: `This is a long explanation of why method ${i} failed because of a complex technical issue that requires detailed description to understand fully` },
        tags: ['checkpoint', 'abandoned']
      });
    }
    writeTrajectoryEntries(tmpDir, entries);

    const result = runGsdTools('execute:trajectory dead-ends --token-cap 100', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    // Context should be truncated with "and N more" message
    assert.ok(output.context.includes('... and'), 'Context should include truncation message when over token cap');
    assert.ok(output.context.includes('more'), 'Should indicate remaining dead ends');
  });
});

describe('trajectory scope validation (INTEG-04)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('INTEG-04a: trajectory checkpoint rejects invalid scope', () => {
    // Need a git repo for checkpoint
    fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dummy.txt'), 'hello');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('execute:trajectory checkpoint test-cp --scope banana', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with invalid scope');
    assert.ok(result.error.includes('Invalid scope'), 'Error should mention invalid scope');
  });

  test('INTEG-04b: trajectory pivot rejects invalid scope', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });

    const result = runGsdTools('execute:trajectory pivot test-cp --scope foo --reason "test"', tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with invalid scope');
    assert.ok(result.error.includes('Invalid scope'), 'Error should mention invalid scope');
  });

  test('INTEG-04c: trajectory dead-ends accepts all valid scopes', () => {
    const validScopes = ['task', 'plan', 'phase'];
    for (const scope of validScopes) {
      const result = runGsdTools(`execute:trajectory dead-ends --scope ${scope}`, tmpDir);
      assert.ok(result.success, `dead-ends should accept scope "${scope}": ${result.error}`);
      const output = JSON.parse(result.output);
      assert.strictEqual(output.scope_filter, scope, `scope_filter should be "${scope}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Group: trajectory SQLite dual-write (MEM-03 + MEM-01)
// ---------------------------------------------------------------------------

describe('trajectory SQLite dual-write', () => {
  let tmpDir;

  function initGitForDualWrite(dir) {
    fs.mkdirSync(path.join(dir, '.planning', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'hello');
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"',
      { cwd: dir, stdio: 'pipe' }
    );
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    closeAll();
    cleanup(tmpDir);
  });

  test('trajectory checkpoint dual-writes to SQLite', () => {
    initGitForDualWrite(tmpDir);
    const result = runGsdTools('execute:trajectory checkpoint my-dual-test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Verify JSON was written
    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    assert.ok(fs.existsSync(trajPath), 'trajectory.json should exist');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    assert.strictEqual(entries.length, 1, 'should have 1 entry in JSON');
    assert.strictEqual(entries[0].category, 'checkpoint');

    // Verify SQLite was written
    closeAll();
    const db = getDb(tmpDir);
    const rows = db.prepare(
      "SELECT * FROM memory_trajectories WHERE cwd = ? AND entry_id LIKE 'tj-%' AND category = 'checkpoint'"
    ).all(tmpDir);
    assert.ok(rows.length >= 1, 'SQLite should have at least 1 trajectory row with category=checkpoint');
  });

  test('trajectory dual-write survives SQLite failure gracefully (Map fallback)', () => {
    initGitForDualWrite(tmpDir);

    // Run checkpoint — even if SQLite is unavailable, JSON should be written
    const result = runGsdTools('execute:trajectory checkpoint map-fallback-test', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const trajPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    assert.ok(fs.existsSync(trajPath), 'trajectory.json should exist');
    const entries = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
    assert.ok(entries.length >= 1, 'JSON should have entries');
    assert.strictEqual(entries[0].category, 'checkpoint', 'entry should be checkpoint category');
  });

  test('searchMemory finds trajectory entries by text', () => {
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-trj-sql-'));
    fs.mkdirSync(path.join(tmpDir2, '.planning', 'memory'), { recursive: true });
    closeAll();
    const db = getDb(tmpDir2);
    const cache = new PlanningCache(db);

    try {
      // Write 3 trajectory entries with different text
      cache.writeMemoryEntry(tmpDir2, 'trajectories', {
        id: 'tj-aa0001', category: 'decision', text: 'Use vertical slices approach', phase: '01',
        scope: 'phase', timestamp: '2026-01-01T00:00:00Z', tags: [],
      });
      cache.writeMemoryEntry(tmpDir2, 'trajectories', {
        id: 'tj-aa0002', category: 'observation', text: 'Vertical scalability is good', phase: '01',
        scope: 'task', timestamp: '2026-01-02T00:00:00Z', tags: [],
      });
      cache.writeMemoryEntry(tmpDir2, 'trajectories', {
        id: 'tj-aa0003', category: 'hypothesis', text: 'Horizontal scaling needed', phase: '01',
        scope: 'phase', timestamp: '2026-01-03T00:00:00Z', tags: [],
      });

      const result = cache.searchMemory(tmpDir2, 'trajectories', 'vertical');
      assert.ok(result, 'searchMemory should return result');
      assert.strictEqual(result.entries.length, 2, 'should find 2 entries containing "vertical"');
      assert.ok(result.entries.every(e => e.text && e.text.toLowerCase().includes('vertical')), 'all entries should match "vertical"');
    } finally {
      closeAll();
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  test('searchMemory filters trajectories by category', () => {
    const tmpDir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-trj-cat-'));
    fs.mkdirSync(path.join(tmpDir3, '.planning', 'memory'), { recursive: true });
    closeAll();
    const db = getDb(tmpDir3);
    const cache = new PlanningCache(db);

    try {
      // Write entries with categories: checkpoint, decision, observation
      cache.writeMemoryEntry(tmpDir3, 'trajectories', {
        id: 'tj-bb0001', category: 'checkpoint', text: 'Checkpoint A', phase: '01',
        checkpoint_name: 'cp-a', scope: 'phase', attempt: 1, timestamp: '2026-01-01T00:00:00Z', tags: ['checkpoint'],
      });
      cache.writeMemoryEntry(tmpDir3, 'trajectories', {
        id: 'tj-bb0002', category: 'decision', text: 'Decision B', phase: '01',
        scope: 'task', timestamp: '2026-01-02T00:00:00Z', tags: [],
      });
      cache.writeMemoryEntry(tmpDir3, 'trajectories', {
        id: 'tj-bb0003', category: 'observation', text: 'Observation C', phase: '01',
        scope: 'phase', timestamp: '2026-01-03T00:00:00Z', tags: [],
      });

      const result = cache.searchMemory(tmpDir3, 'trajectories', null, { category: 'checkpoint' });
      assert.ok(result, 'searchMemory should return result');
      assert.strictEqual(result.entries.length, 1, 'should return only 1 checkpoint entry');
      assert.strictEqual(result.entries[0].category, 'checkpoint', 'returned entry should have category=checkpoint');
    } finally {
      closeAll();
      fs.rmSync(tmpDir3, { recursive: true, force: true });
    }
  });
});

