const fs = require('fs');
const path = require('path');

const DEFAULT_LOCK_PATH = path.join('.planning', '.lock');
const DEFAULT_STALE_MS = 10_000;
const DEFAULT_RETRY_MS = 50;

function resolveLockDir(projectDir, options = {}) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('projectDir is required');
  }
  return path.join(projectDir, options.lockPath || DEFAULT_LOCK_PATH);
}

function releaseProjectLock(lockHandle) {
  if (!lockHandle || !lockHandle.lockDir) return;
  if (lockHandle.released) return;
  fs.rmSync(lockHandle.lockDir, { recursive: true, force: true });
  lockHandle.released = true;
}

function acquireProjectLock(projectDir, options = {}) {
  const lockDir = resolveLockDir(projectDir, options);
  const staleMs = Number.isFinite(options.staleMs) ? options.staleMs : DEFAULT_STALE_MS;
  const retryMs = Number.isFinite(options.retryMs) ? options.retryMs : DEFAULT_RETRY_MS;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 0;
  const deadline = Date.now() + Math.max(0, timeoutMs);

  fs.mkdirSync(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      return {
        lockDir,
        release() {
          releaseProjectLock(this);
        },
        released: false,
      };
    } catch (err) {
      if (!err || err.code !== 'EEXIST') throw err;

      let shouldRetry = false;
      try {
        const lockStat = fs.statSync(lockDir);
        const ageMs = Date.now() - lockStat.mtimeMs;
        if (ageMs > staleMs) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          shouldRetry = true;
        }
      } catch (statErr) {
        if (statErr && statErr.code === 'ENOENT') {
          shouldRetry = true;
        } else {
          throw new Error('Failed to inspect project lock state.');
        }
      }

      if (shouldRetry) continue;
      if (Date.now() >= deadline) {
        const error = new Error('Another operation in progress. Try again.');
        error.code = 'ELOCKED';
        throw error;
      }

      sleepSync(Math.max(1, retryMs));
    }
  }
}

function withProjectLock(projectDir, task, options = {}) {
  const lock = acquireProjectLock(projectDir, options);
  try {
    const result = task(lock);
    if (result && typeof result.then === 'function') {
      return result.finally(() => releaseProjectLock(lock));
    }
    releaseProjectLock(lock);
    return result;
  } catch (error) {
    releaseProjectLock(lock);
    throw error;
  }
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

module.exports = {
  DEFAULT_LOCK_PATH,
  DEFAULT_RETRY_MS,
  DEFAULT_STALE_MS,
  acquireProjectLock,
  releaseProjectLock,
  resolveLockDir,
  withProjectLock,
};
