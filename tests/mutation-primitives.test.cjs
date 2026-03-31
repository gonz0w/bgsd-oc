const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  acquireProjectLock,
  resolveLockDir,
  withProjectLock,
} = require('../src/lib/project-lock');
const {
  buildAtomicTempPath,
  writeFileAtomic,
} = require('../src/lib/atomic-write');

function createProjectDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-mutation-primitives-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  return dir;
}

function cleanupProjectDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('project lock helper', () => {
  test('acquires and releases a project-scoped lock directory', () => {
    const projectDir = createProjectDir();
    try {
      const lock = acquireProjectLock(projectDir);
      const lockDir = resolveLockDir(projectDir);

      assert.ok(fs.existsSync(lockDir), 'lock directory should exist while held');

      lock.release();

      assert.ok(!fs.existsSync(lockDir), 'lock directory should be removed after release');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });

  test('breaks a stale lock before reacquiring it', () => {
    const projectDir = createProjectDir();
    try {
      const lockDir = resolveLockDir(projectDir);
      fs.mkdirSync(lockDir, { recursive: true });
      const staleDate = new Date(Date.now() - 60_000);
      fs.utimesSync(lockDir, staleDate, staleDate);

      const lock = acquireProjectLock(projectDir, { staleMs: 500 });

      assert.ok(fs.existsSync(lockDir), 'reacquired lock should exist');
      lock.release();
      assert.ok(!fs.existsSync(lockDir), 'reacquired lock should be releasable');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });

  test('releases the lock when a protected mutation throws', () => {
    const projectDir = createProjectDir();
    try {
      assert.throws(
        () => withProjectLock(projectDir, () => {
          throw new Error('mutation failed');
        }),
        /mutation failed/
      );

      assert.ok(!fs.existsSync(resolveLockDir(projectDir)), 'lock should be released after failure');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });
});

describe('atomic publish helper', () => {
  test('writes replacement content through a temp file and rename', () => {
    const projectDir = createProjectDir();
    try {
      const targetPath = path.join(projectDir, '.planning', 'state.json');
      fs.writeFileSync(targetPath, '{"before":true}\n', 'utf-8');

      const result = writeFileAtomic(targetPath, '{"after":true}\n');

      assert.strictEqual(fs.readFileSync(targetPath, 'utf-8'), '{"after":true}\n');
      assert.ok(!fs.existsSync(result.tempPath), 'temp file should not remain after publish');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });

  test('creates temp files beside the target path', () => {
    const tempPath = buildAtomicTempPath('/tmp/example.json', { suffix: 'fixed' });
    assert.strictEqual(tempPath, path.join('/tmp', '.example.json.tmp-fixed'));
  });

  test('keeps the old file visible until rename completes', () => {
    const projectDir = createProjectDir();
    try {
      const targetPath = path.join(projectDir, '.planning', 'memory.json');
      fs.writeFileSync(targetPath, '{"entries":["before"]}\n', 'utf-8');

      writeFileAtomic(targetPath, '{"entries":["after"]}\n', {
        beforeRename({ tempPath }) {
          assert.strictEqual(
            fs.readFileSync(targetPath, 'utf-8'),
            '{"entries":["before"]}\n',
            'target should still expose the previous committed content before rename'
          );
          assert.strictEqual(
            fs.readFileSync(tempPath, 'utf-8'),
            '{"entries":["after"]}\n',
            'replacement content should be fully staged in the temp file before rename'
          );
        },
      });

      assert.strictEqual(fs.readFileSync(targetPath, 'utf-8'), '{"entries":["after"]}\n');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });

  test('removes the temp file if publish fails before rename', () => {
    const projectDir = createProjectDir();
    try {
      const targetPath = path.join(projectDir, '.planning', 'handoff.json');
      const tempPath = buildAtomicTempPath(targetPath, { suffix: 'cleanup-check' });

      assert.throws(
        () => writeFileAtomic(targetPath, '{"status":"pending"}\n', {
          tempPath,
          beforeRename() {
            throw new Error('stop before publish');
          },
        }),
        /stop before publish/
      );

      assert.ok(!fs.existsSync(tempPath), 'temp file should be cleaned up after a failed publish');
      assert.ok(!fs.existsSync(targetPath), 'failed publish should not create the target file');
    } finally {
      cleanupProjectDir(projectDir);
    }
  });
});
