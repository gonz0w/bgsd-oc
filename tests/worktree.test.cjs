/**
 * Legacy worktree command regression tests
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const { runGsdTools } = require('./helpers.cjs');

function hasJj() {
  const result = spawnSync('jj', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function createJjProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-legacy-wt-'));
  const workspaceBase = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-legacy-ws-'));
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
  execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('jj git init --colocate .', { cwd: tmpDir, stdio: 'pipe' });
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
    mode: 'yolo',
    workspace: { base_path: workspaceBase, max_concurrent: 3 },
  }, null, 2));
  return { tmpDir, workspaceBase };
}

describe('legacy execute:worktree command removal', () => {
  test('execute:worktree is unsupported while workspace list succeeds', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    const { tmpDir, workspaceBase } = createJjProject();
    try {
      const workspaceList = runGsdTools('workspace list', tmpDir);
      assert.ok(workspaceList.success, `workspace list failed: ${workspaceList.error}`);

      const legacy = runGsdTools('execute:worktree list', tmpDir);
      assert.ok(!legacy.success, 'legacy command should fail');
      assert.match(legacy.error, /Unknown execute subcommand: worktree/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(workspaceBase, { recursive: true, force: true });
    }
  });
});
