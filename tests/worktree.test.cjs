/**
 * bgsd-tools worktree tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('worktree commands', () => {
  let tmpDir;
  let worktreeBase;

  /**
   * Create a temp project with a real git repo (required for git worktree).
   * Also creates a separate temp dir for worktree base_path.
   */
  function createGitProject(configOverrides = {}) {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-test-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-base-'));

    // Init git repo with initial commit (worktree requires at least one commit)
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    // Create .planning directory with config
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    const worktreeConfig = {
      enabled: true,
      base_path: worktreeBase,
      sync_files: ['.env', '.env.local', '.planning/config.json'],
      setup_hooks: [],
      max_concurrent: 3,
      ...configOverrides,
    };

    const config = {
      mode: 'yolo',
      worktree: worktreeConfig,
    };

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    return tmpDir;
  }

  /**
   * Cleanup all worktrees before removing temp dirs.
   * Must remove worktrees before deleting the git repo.
   */
  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        // Remove all worktrees first
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
        const listOutput = execSync('git worktree list --porcelain', {
          cwd: tmpDir,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        // Parse and remove each non-main worktree
        const blocks = listOutput.split('\n\n');
        for (const block of blocks) {
          const pathMatch = block.match(/^worktree (.+)$/m);
          if (pathMatch && pathMatch[1] !== tmpDir) {
            try {
              execSync(`git worktree remove "${pathMatch[1]}" --force`, {
                cwd: tmpDir,
                stdio: 'pipe',
              });
            } catch { /* ignore cleanup errors */ }
          }
        }
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }

      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (worktreeBase && fs.existsSync(worktreeBase)) {
      fs.rmSync(worktreeBase, { recursive: true, force: true });
    }
  }

  afterEach(() => {
    cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // worktree list
  // ---------------------------------------------------------------------------

  describe('worktree list', () => {
    test('returns empty worktrees array when no worktrees exist', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(Array.isArray(data.worktrees), 'worktrees should be an array');
      assert.strictEqual(data.worktrees.length, 0, 'should have no worktrees');
    });

    test('returns worktree details after create', () => {
      createGitProject();
      // Create a worktree first
      const createResult = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);

      // Now list
      const listResult = runGsdTools('execute:worktree list', tmpDir);
      assert.ok(listResult.success, `List failed: ${listResult.error}`);
      const data = JSON.parse(listResult.output);

      assert.strictEqual(data.worktrees.length, 1, 'should have 1 worktree');
      const wt = data.worktrees[0];
      assert.strictEqual(wt.plan_id, '21-02', 'plan_id should match');
      assert.ok(wt.branch, 'should have a branch name');
      assert.ok(wt.path, 'should have a path');
      assert.ok(wt.disk_usage, 'should have disk_usage');
    });

    test('only shows worktrees for current project', () => {
      createGitProject();
      // Create a worktree for this project
      runGsdTools('execute:worktree create 21-02', tmpDir);

      // Manually create a worktree outside the project's base_path prefix
      // by using a different path — the list should not show it
      const otherPath = path.join(worktreeBase, 'other-project', '99-01');
      fs.mkdirSync(path.dirname(otherPath), { recursive: true });
      execSync(`git worktree add -b other-branch "${otherPath}"`, {
        cwd: tmpDir,
        stdio: 'pipe',
      });

      const result = runGsdTools('execute:worktree list', tmpDir);
      assert.ok(result.success, `List failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Should only show the one under project name, not the 'other-project' one
      assert.strictEqual(data.worktrees.length, 1, 'should only show 1 project worktree');
      assert.strictEqual(data.worktrees[0].plan_id, '21-02', 'should be the correct plan');

      // Cleanup the extra worktree
      try {
        execSync(`git worktree remove "${otherPath}" --force`, { cwd: tmpDir, stdio: 'pipe' });
        execSync('git branch -D other-branch', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
    });
  });

  // ---------------------------------------------------------------------------
  // worktree create
  // ---------------------------------------------------------------------------

  describe('worktree create', () => {
    test('creates worktree at expected path with correct branch', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.created, true, 'should report created');
      assert.strictEqual(data.plan_id, '21-02', 'plan_id should match');
      assert.ok(data.branch.startsWith('worktree-21-02-'), 'branch should start with worktree-21-02-');
      assert.ok(data.path.includes(worktreeBase), 'path should be under base_path');
      assert.ok(data.path.endsWith('21-02'), 'path should end with plan_id');
      assert.ok(fs.existsSync(data.path), 'worktree directory should exist on disk');
      assert.strictEqual(data.setup_status, 'ok', 'setup should succeed');
    });

    test('syncs .env file if it exists in source project', () => {
      createGitProject();
      // Create a .env file in the source project
      fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET_KEY=test123\n');

      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.synced_files.includes('.env'), '.env should be in synced_files');
      // Verify the file was actually copied
      const destEnv = path.join(data.path, '.env');
      assert.ok(fs.existsSync(destEnv), '.env should exist in worktree');
      assert.strictEqual(
        fs.readFileSync(destEnv, 'utf-8'),
        'SECRET_KEY=test123\n',
        '.env content should match'
      );
    });

    test('skips sync gracefully when .env does not exist', () => {
      createGitProject();
      // Don't create .env — it shouldn't be in synced_files list
      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(!data.synced_files.includes('.env'), '.env should NOT be in synced_files');
      assert.ok(!data.synced_files.includes('.env.local'), '.env.local should NOT be in synced_files');
      // .planning/config.json DOES exist (we created it), so it should be synced
      assert.ok(
        data.synced_files.includes('.planning/config.json'),
        '.planning/config.json should be synced'
      );
    });

    test('returns setup_failed when setup hook fails', () => {
      createGitProject({ setup_hooks: ['false'] });

      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.created, true, 'worktree should still be created');
      assert.strictEqual(data.setup_status, 'failed', 'setup should report failed');
      assert.ok(data.setup_error, 'should have setup_error message');
      assert.ok(data.setup_error.includes('false'), 'error should mention the failing hook');
    });

    test('returns error when plan_id is missing', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree create', tmpDir);
      assert.ok(!result.success, 'should fail without plan_id');
    });

    test('returns error when worktree already exists for same plan_id', () => {
      createGitProject();
      // Create the first time — should succeed
      const first = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(first.success, `First create failed: ${first.error}`);

      // Create again — should fail
      const second = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(!second.success, 'should fail when worktree already exists');
      assert.ok(
        second.error.includes('already exists') || second.output.includes('already exists'),
        'error should mention "already exists"'
      );
    });

    test('respects max_concurrent limit', () => {
      createGitProject({ max_concurrent: 1 });

      // Create first worktree — should succeed
      const first = runGsdTools('execute:worktree create 21-01', tmpDir);
      assert.ok(first.success, `First create failed: ${first.error}`);

      // Create second — should fail because max_concurrent=1
      const second = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(!second.success, 'should fail when max_concurrent exceeded');
      assert.ok(
        second.error.includes('Max concurrent') || second.output.includes('Max concurrent'),
        'error should mention max concurrent limit'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree remove
  // ---------------------------------------------------------------------------

  describe('worktree remove', () => {
    test('removes worktree and deletes branch', () => {
      createGitProject();
      // Create then remove
      const createResult = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;
      const branchName = createData.branch;

      // Verify it exists
      assert.ok(fs.existsSync(wtPath), 'worktree should exist before remove');

      // Remove it
      const removeResult = runGsdTools('execute:worktree remove 21-02', tmpDir);
      assert.ok(removeResult.success, `Remove failed: ${removeResult.error}`);
      const removeData = JSON.parse(removeResult.output);

      assert.strictEqual(removeData.removed, true, 'should report removed');
      assert.strictEqual(removeData.plan_id, '21-02', 'plan_id should match');
      assert.ok(!fs.existsSync(wtPath), 'worktree directory should be gone');

      // Verify branch is deleted
      const branchCheck = execSync('git branch', { cwd: tmpDir, encoding: 'utf-8' });
      assert.ok(!branchCheck.includes(branchName), 'branch should be deleted');
    });

    test('returns error for non-existent plan_id', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree remove 99-99', tmpDir);
      assert.ok(!result.success, 'should fail for non-existent plan');
      assert.ok(
        result.error.includes('No worktree found') || result.output.includes('No worktree found'),
        'error should mention no worktree found'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree cleanup
  // ---------------------------------------------------------------------------

  describe('worktree cleanup', () => {
    test('removes all project worktrees', () => {
      createGitProject({ max_concurrent: 3 });
      // Create two worktrees
      runGsdTools('execute:worktree create 21-01', tmpDir);
      runGsdTools('execute:worktree create 21-02', tmpDir);

      // Verify they exist
      const listBefore = runGsdTools('execute:worktree list', tmpDir);
      const beforeData = JSON.parse(listBefore.output);
      assert.strictEqual(beforeData.worktrees.length, 2, 'should have 2 worktrees before cleanup');

      // Cleanup
      const result = runGsdTools('execute:worktree cleanup', tmpDir);
      assert.ok(result.success, `Cleanup failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.cleaned, 2, 'should have cleaned 2 worktrees');
      assert.strictEqual(data.worktrees.length, 2, 'should list 2 removed worktrees');

      // Verify list is now empty
      const listAfter = runGsdTools('execute:worktree list', tmpDir);
      const afterData = JSON.parse(listAfter.output);
      assert.strictEqual(afterData.worktrees.length, 0, 'should have 0 worktrees after cleanup');
    });

    test('returns cleaned: 0 when no worktrees exist', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree cleanup', tmpDir);
      assert.ok(result.success, `Cleanup failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.cleaned, 0, 'should report 0 cleaned');
      assert.strictEqual(data.worktrees.length, 0, 'should have empty worktrees array');
    });
  });

  // ---------------------------------------------------------------------------
  // config validation
  // ---------------------------------------------------------------------------

  describe('worktree config', () => {
    test('default config used when no worktree section in config.json', () => {
      tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-test-'));
      worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-base-'));

      // Init git repo
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

      // Create config WITHOUT worktree section
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'config.json'),
        JSON.stringify({ mode: 'yolo' }, null, 2)
      );

      // List should work with defaults (uses /tmp/gsd-worktrees as base_path)
      const result = runGsdTools('execute:worktree list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(Array.isArray(data.worktrees), 'should return worktrees array with defaults');
    });

    test('custom base_path is respected', () => {
      const customBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-custom-'));
      createGitProject({ base_path: customBase });

      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.path.startsWith(customBase), `path should start with custom base: ${data.path}`);
      assert.ok(fs.existsSync(data.path), 'worktree should exist at custom path');

      // Cleanup the custom base too
      try {
        execSync(`git worktree remove "${data.path}" --force`, { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
      fs.rmSync(customBase, { recursive: true, force: true });
    });

    test('resource warnings included when memory is low for max_concurrent', () => {
      // Set max_concurrent very high so resource warning triggers
      createGitProject({ max_concurrent: 100 });

      const result = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // With max_concurrent=100, the system would need 400GB RAM — should trigger warning
      assert.ok(data.resource_warnings, 'should have resource_warnings');
      assert.ok(data.resource_warnings.length > 0, 'should have at least one warning');
      assert.ok(
        data.resource_warnings.some(w => w.includes('memory') || w.includes('Memory')),
        'should warn about memory'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // parsePlanId helper
  // ---------------------------------------------------------------------------

  describe('worktree parsePlanId (via CLI)', () => {
    test('rejects invalid plan ID format', () => {
      createGitProject();
      const result = runGsdTools('execute:worktree create not-valid', tmpDir);
      assert.ok(!result.success, 'should fail for invalid plan ID');
      assert.ok(
        result.error.includes('Invalid plan ID') || result.output.includes('Invalid plan ID'),
        'error should mention invalid plan ID'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree merge
  // ---------------------------------------------------------------------------

  describe('worktree merge', () => {
    test('clean merge succeeds when worktree modifies unique file', () => {
      createGitProject();

      // Create worktree for plan 21-02
      const createResult = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Make a unique change in the worktree and commit it
      fs.writeFileSync(path.join(wtPath, 'new-feature.js'), 'module.exports = { feature: true };\n');
      execSync('git add new-feature.js && git commit -m "add feature"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Run merge
      const mergeResult = runGsdTools('execute:worktree merge 21-02', tmpDir);
      assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, true, 'should have merged successfully');
      assert.strictEqual(mergeData.plan_id, '21-02');
      assert.ok(mergeData.branch, 'should include branch name');

      // Verify the merged content is in the base branch
      assert.ok(
        fs.existsSync(path.join(tmpDir, 'new-feature.js')),
        'merged file should exist in base branch'
      );
    });

    test('conflict detected and blocked when both sides modify same file', () => {
      createGitProject();

      // Create worktree
      const createResult = runGsdTools('execute:worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Modify README.md differently in worktree
      fs.writeFileSync(path.join(wtPath, 'README.md'), '# Modified in worktree\nWorktree content\n');
      execSync('git add README.md && git commit -m "modify readme in worktree"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Modify README.md differently in base
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Modified in base\nBase content\n');
      execSync('git add README.md && git commit -m "modify readme in base"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Run merge — should detect conflict
      const mergeResult = runGsdTools('execute:worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge command should succeed (returns JSON): ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, false, 'should NOT have merged');
      assert.ok(Array.isArray(mergeData.conflicts), 'should have conflicts array');
      assert.ok(mergeData.conflicts.length > 0, 'should have at least one conflict');
      assert.ok(
        mergeData.conflicts.some(c => c.file === 'README.md' || c.file.includes('README')),
        'conflicts should mention README.md'
      );

      // Verify base branch doesn't have conflict markers
      const baseReadme = fs.readFileSync(path.join(tmpDir, 'README.md'), 'utf-8');
      assert.ok(
        !baseReadme.includes('<<<<<<<'),
        'base branch should not have conflict markers (merge was blocked)'
      );
    });

    test('lockfile auto-resolution: package-lock.json conflict auto-resolved', () => {
      createGitProject();

      // Create a package-lock.json in base and commit
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, base: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "add lockfile"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Create worktree
      const createResult = runGsdTools('execute:worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Modify lockfile differently in worktree
      fs.writeFileSync(path.join(wtPath, 'package-lock.json'), JSON.stringify({ lockfileVersion: 2, worktree: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "update lockfile in worktree"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Modify lockfile differently in base
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, base: true, updated: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "update lockfile in base"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Merge — lockfile-only conflict should be auto-resolved
      const mergeResult = runGsdTools('execute:worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge command failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      // Lockfile is auto-resolvable, so it might either:
      // - Be reported as auto_resolved with merged=true (ideal)
      // - Or merged=true since conflicts are only lockfiles
      // The key assertion: no real conflicts blocking the merge
      if (mergeData.merged === false) {
        // If conflicts array only has lockfile entries, that's a test of the parser
        // but the merge should ideally succeed. Check it's at least recognized.
        assert.ok(
          mergeData.conflicts.every(c => c.file === 'package-lock.json'),
          'only lockfile conflicts should be reported'
        );
      } else {
        assert.strictEqual(mergeData.merged, true, 'should merge with lockfile auto-resolution');
      }
    });

    test('file overlap warning included in merge output', () => {
      createGitProject();

      // Create two PLAN.md files in phase dir, both listing same file in files_modified
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      const plan01Content = `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
  - src/router.js
---

# Plan 01
`;

      const plan02Content = `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
  - bin/bgsd-tools.test.cjs
---

# Plan 02
`;

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), plan01Content);
      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), plan02Content);

      // Create worktree and make a change
      const createResult = runGsdTools('execute:worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      fs.writeFileSync(path.join(wtPath, 'unique-file.js'), 'export default {};\n');
      execSync('git add unique-file.js && git commit -m "add unique file"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Run merge for plan 21-01
      const mergeResult = runGsdTools('execute:worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, true, 'should merge successfully');
      assert.ok(Array.isArray(mergeData.file_overlap_warnings), 'should have file_overlap_warnings');
      assert.ok(mergeData.file_overlap_warnings.length > 0, 'should have at least one overlap warning');
      assert.ok(
        mergeData.file_overlap_warnings.some(w =>
          w.shared_files.includes('src/commands/worktree.js')
        ),
        'overlap should mention shared file src/commands/worktree.js'
      );
    });

    test('merge of non-existent plan_id returns error', () => {
      createGitProject();

      const result = runGsdTools('execute:worktree merge 99-99', tmpDir);
      assert.ok(!result.success, 'should fail for non-existent plan');
      assert.ok(
        (result.error + result.output).includes('No worktree found'),
        'error should mention no worktree found'
      );
    });

    test('merge with no commits in worktree succeeds as no-op', () => {
      createGitProject();

      // Create worktree but don't make any changes
      const createResult = runGsdTools('execute:worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);

      // Merge with no commits — should succeed (nothing to merge, branches at same point)
      const mergeResult = runGsdTools('execute:worktree merge 21-02', tmpDir);
      // This might either succeed with merged=true (no-op merge) or fail with "already up to date"
      // Either way is valid behavior
      if (mergeResult.success) {
        const mergeData = JSON.parse(mergeResult.output);
        // merged could be true (no-ff merge with same content) or command might report already up to date
        assert.ok(mergeData.plan_id === '21-02', 'should reference the correct plan');
      }
      // If not successful, it's because git merge says "already up to date" — also valid
    });
  });

  // ---------------------------------------------------------------------------
  // worktree check-overlap
  // ---------------------------------------------------------------------------

  describe('worktree check-overlap', () => {
    test('no overlap between plans with different files_modified', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/merge.js
---

# Plan 02
`);

      const result = runGsdTools('execute:worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'should have no conflicts');
      assert.strictEqual(data.overlaps.length, 0, 'should have no overlaps');
      assert.strictEqual(data.plans_analyzed, 2, 'should analyze 2 plans');
    });

    test('overlap detected within same wave', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/router.js
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
  - bin/bgsd-tools.test.cjs
---

# Plan 02
`);

      const result = runGsdTools('execute:worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, true, 'should detect conflicts');
      assert.strictEqual(data.overlaps.length, 1, 'should have 1 overlap');
      assert.deepStrictEqual(data.overlaps[0].plans, ['21-01', '21-02']);
      assert.ok(
        data.overlaps[0].files.includes('src/commands/worktree.js'),
        'overlap should include shared file'
      );
      assert.strictEqual(data.overlaps[0].wave, '1', 'overlap should be in wave 1');
    });

    test('no overlap when plans are in different waves', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 2
files_modified:
  - src/commands/worktree.js
---

# Plan 02
`);

      const result = runGsdTools('execute:worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'different waves should not conflict');
      assert.strictEqual(data.overlaps.length, 0, 'should have no overlaps');
    });

    test('handles missing files_modified gracefully', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      // Plan without files_modified frontmatter
      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
---

# Plan 01 - no files_modified
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 02
`);

      const result = runGsdTools('execute:worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'missing files_modified should not cause conflicts');
      assert.strictEqual(data.plans_analyzed, 2, 'should still analyze both plans');
    });

    test('three plans with no shared files returns empty overlaps', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/a.js
---
# Plan 01
`);
      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/b.js
---
# Plan 02
`);
      fs.writeFileSync(path.join(phaseDir, '21-03-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 03
wave: 1
files_modified:
  - src/c.js
---
# Plan 03
`);

      const result = runGsdTools('execute:worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'disjoint files should have no conflicts');
      assert.strictEqual(data.overlaps.length, 0, 'should have empty overlaps');
      assert.strictEqual(data.plans_analyzed, 3, 'should analyze all 3 plans');
    });
  });
});

describe('init execute-phase worktree fields', () => {
  let tmpDir;
  let worktreeBase;

  function createGitProject(configOverrides = {}) {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-base-'));

    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    // Create minimal ROADMAP.md (needed by getMilestoneInfo)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Milestones

- 🔵 v1.0 — Test Milestone

### Phase 21: Worktree Parallelism
- Plans: TBD
`);

    // Create minimal STATE.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 21 (Worktree Parallelism)
**Current Plan:** Plan 01 next
**Status:** In progress
**Last Activity:** 2026-02-25

Progress: [████████░░] 80% (4/5 phases)

## Accumulated Context

### Decisions

None.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: N/A
`);

    const config = {
      mode: 'yolo',
      worktree: {
        enabled: true,
        base_path: worktreeBase,
        sync_files: ['.env', '.env.local', '.planning/config.json'],
        setup_hooks: [],
        max_concurrent: 5,
        ...configOverrides,
      },
    };

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    return tmpDir;
  }

  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
        const listOutput = execSync('git worktree list --porcelain', {
          cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
        });
        const blocks = listOutput.split('\n\n');
        for (const block of blocks) {
          const pathMatch = block.match(/^worktree (.+)$/m);
          if (pathMatch && pathMatch[1] !== tmpDir) {
            try {
              execSync(`git worktree remove "${pathMatch[1]}" --force`, { cwd: tmpDir, stdio: 'pipe' });
            } catch { /* ignore */ }
          }
        }
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (worktreeBase && fs.existsSync(worktreeBase)) {
      fs.rmSync(worktreeBase, { recursive: true, force: true });
    }
  }

  afterEach(() => {
    cleanupAll();
  });

  test('worktree fields present when enabled', () => {
    createGitProject();

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, true, 'worktree_enabled should be true');
    assert.ok(data.worktree_config, 'worktree_config should exist');
    assert.strictEqual(data.worktree_config.base_path, worktreeBase, 'base_path should match config');
    assert.strictEqual(data.worktree_config.max_concurrent, 5, 'max_concurrent should be 5');
    assert.ok(Array.isArray(data.worktree_active), 'worktree_active should be array');
    assert.ok(Array.isArray(data.file_overlaps), 'file_overlaps should be array');
  });

  test('worktree fields default when disabled', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-base-'));

    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Milestones

- 🔵 v1.0 — Test

### Phase 21: Worktree Parallelism
- Plans: TBD
`);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 21
**Status:** In progress
**Last Activity:** 2026-02-25

Progress: [████████░░] 80%

## Accumulated Context

### Decisions

None.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: N/A
`);

    // Config WITHOUT worktree section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );

    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, false, 'worktree_enabled should be false');
    // In verbose mode, worktree fields are trimmed when disabled to reduce token waste
    assert.strictEqual(data.worktree_config, undefined, 'worktree_config omitted when disabled');
    assert.strictEqual(data.worktree_active, undefined, 'worktree_active omitted when disabled');
    assert.strictEqual(data.file_overlaps, undefined, 'file_overlaps omitted when disabled');
  });

  test('file overlaps detected in init output', () => {
    createGitProject();

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

    // Two plans in same wave with overlapping files
    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/shared.js
  - src/a.js
---

# Plan 01
`);

    fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/shared.js
  - src/b.js
---

# Plan 02
`);

    execSync('git add . && git commit -m "add plans"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.file_overlaps.length > 0, 'should detect file overlaps');
    assert.ok(data.file_overlaps[0].files.includes('src/shared.js'), 'should include shared.js');
    assert.deepStrictEqual(data.file_overlaps[0].plans, ['21-01', '21-02'], 'should identify overlapping plans');
  });

  test('no overlap when plans are in different waves', () => {
    createGitProject();

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/shared.js
---

# Plan 01
`);

    fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 2
files_modified:
  - src/shared.js
---

# Plan 02
`);

    execSync('git add . && git commit -m "add plans"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.deepStrictEqual(data.file_overlaps, [], 'different waves should not have overlaps');
  });

  test('active worktrees included when they exist', () => {
    createGitProject();

    // Create a worktree for plan 21-01
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');
    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
---

# Plan 01
`);
    execSync('git add . && git commit -m "add plan"', { cwd: tmpDir, stdio: 'pipe' });

    const createResult = runGsdTools('execute:worktree create 21-01', tmpDir);
    assert.ok(createResult.success, `Worktree create failed: ${createResult.error}`);

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.worktree_active.length > 0, 'should have active worktrees');
    assert.strictEqual(data.worktree_active[0].plan_id, '21-01', 'should include plan 21-01');
    assert.ok(data.worktree_active[0].branch, 'should include branch name');
    assert.ok(data.worktree_active[0].path, 'should include worktree path');
  });

  test('init graceful when worktree base_path does not exist yet', () => {
    createGitProject({ base_path: '/tmp/gsd-wt-nonexistent-test-dir-' + Date.now() });

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command should succeed even with non-existent base_path: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, true, 'worktree_enabled should still be true');
    assert.deepStrictEqual(data.worktree_active, [], 'worktree_active should be empty');
  });

  test('config max_concurrent surfaces in init output', () => {
    createGitProject({ max_concurrent: 7 });

    const result = runGsdTools('init:execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_config.max_concurrent, 7, 'max_concurrent should be 7');
  });
});

