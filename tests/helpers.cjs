/**
 * Shared test helpers for bgsd-tools test suite.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_PATH = path.join(__dirname, '..', 'bin', 'bgsd-tools.cjs');

// Resolve @file: references in output (used by bgsd-tools for large JSON outputs)
function resolveFileRef(output) {
  const trimmed = (output || '').trim();
  if (trimmed.startsWith('@file:')) {
    const filePath = trimmed.slice('@file:'.length).trim();
    try {
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch {
      return trimmed; // return as-is if file can't be read
    }
  }
  return trimmed;
}

// Helper to run bgsd-tools command
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: resolveFileRef(result) };
  } catch (err) {
    return {
      success: false,
      output: resolveFileRef(err.stdout?.toString()) || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Helper that captures both stdout and stderr separately
function runGsdToolsFull(args, cwd = process.cwd()) {
  try {
    const stdout = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout: resolveFileRef(stdout), stderr: '' };
  } catch (err) {
    return {
      success: err.status === 0,
      stdout: resolveFileRef(err.stdout || ''),
      stderr: (err.stderr || '').trim(),
      exitCode: err.status,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ── State fixture ──────────────────────────────────────────────────────────

const STATE_FIXTURE = `# Project State

## Current Position

**Phase:** 1 of 3 (Foundation)
**Current Plan:** 1
**Total Plans in Phase:** 3
**Plan:** 01-01 — Setup
**Status:** In progress
**Last Activity:** 2026-01-01

**Progress:** [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

**Last session:** 2026-01-01
**Stopped at:** Phase 1 setup
**Resume file:** None
`;

function writeStateFixture(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), STATE_FIXTURE);
}

// ── Contract helpers ───────────────────────────────────────────────────────

/**
 * Compare actual output against a stored snapshot fixture.
 */
function snapshotCompare(actual, fixturePath) {
  if (process.env.BGSD_UPDATE_SNAPSHOTS === '1' || !fs.existsSync(fixturePath)) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, JSON.stringify(actual, null, 2) + '\n', 'utf-8');
    return { pass: true, message: 'Snapshot written (bootstrap mode)' };
  }

  const expected = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  const diffs = [];

  function compare(exp, act, keyPath) {
    if (exp === null || exp === undefined) {
      if (act !== null && act !== undefined) {
        diffs.push(`  - ${keyPath}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
      }
      return;
    }
    if (Array.isArray(exp)) {
      if (!Array.isArray(act)) {
        diffs.push(`  - ${keyPath}: expected array, got ${typeof act}`);
        return;
      }
      if (exp.length !== act.length) {
        diffs.push(`  - ${keyPath}: expected array length ${exp.length}, got ${act.length}`);
      }
      const len = Math.max(exp.length, act.length);
      for (let i = 0; i < len; i++) {
        compare(exp[i], act[i], `${keyPath}[${i}]`);
      }
      return;
    }
    if (typeof exp === 'object') {
      if (typeof act !== 'object' || act === null) {
        diffs.push(`  - ${keyPath}: expected object, got ${typeof act}`);
        return;
      }
      for (const key of Object.keys(exp)) {
        compare(exp[key], act[key], `${keyPath}.${key}`);
      }
      return;
    }
    if (exp !== act) {
      diffs.push(`  - ${keyPath}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
    }
  }

  compare(expected, actual, '$');

  if (diffs.length === 0) {
    return { pass: true, message: 'Snapshot matches' };
  }

  return {
    pass: false,
    message: `Snapshot mismatch (${diffs.length} differences):\n${diffs.join('\n')}\n\nSet BGSD_UPDATE_SNAPSHOTS=1 to update.`,
  };
}

/**
 * Field-level contract check: verifies required fields exist with correct types.
 */
function contractCheck(actual, requiredFields, contextName) {
  const violations = [];

  for (const { key, type } of requiredFields) {
    const parts = key.split('.');
    let value = actual;
    for (const part of parts) {
      if (value === null || value === undefined) {
        value = undefined;
        break;
      }
      value = value[part];
    }

    if (value === undefined) {
      violations.push(`  - ${key}: expected ${type}, got undefined`);
      continue;
    }

    if (type === 'any') continue;

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== type) {
      violations.push(`  - ${key}: expected ${type}, got ${actualType}`);
    }
  }

  if (violations.length === 0) {
    return { pass: true, message: 'Contract satisfied' };
  }

  return {
    pass: false,
    message: `Contract violation in ${contextName}:\n${violations.join('\n')}`,
  };
}

/**
 * Create a deterministic parity test project with git init and optional .gitignore rules.
 * Supports nested .gitignore files, hidden dirs, root-level source files, and symlinks.
 *
 * @param {Object} opts
 * @param {Record<string, string>} opts.files - File map { relPath: content }
 * @param {string[]} [opts.gitignoreRules] - Root .gitignore lines
 * @param {Record<string, string[]>} [opts.nestedGitignores] - { relDir: lines[] }
 * @param {Array<{target: string, link: string}>} [opts.symlinks] - Symlinks to create
 * @returns {string} tmpDir path
 */
function createParityProject(opts) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-parity-'));

  // Create files
  for (const [relPath, content] of Object.entries(opts.files || {})) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content || '');
  }

  // Root .gitignore
  if (opts.gitignoreRules) {
    fs.writeFileSync(path.join(dir, '.gitignore'), opts.gitignoreRules.join('\n') + '\n');
  }

  // Nested .gitignore files
  if (opts.nestedGitignores) {
    for (const [relDir, lines] of Object.entries(opts.nestedGitignores)) {
      const ignoreDir = path.join(dir, relDir);
      fs.mkdirSync(ignoreDir, { recursive: true });
      fs.writeFileSync(path.join(ignoreDir, '.gitignore'), lines.join('\n') + '\n');
    }
  }

  // Symlinks
  if (opts.symlinks) {
    for (const { target, link } of opts.symlinks) {
      const linkPath = path.join(dir, link);
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });
      try {
        fs.symlinkSync(path.join(dir, target), linkPath);
      } catch {
        // Symlinks may fail on some platforms — skip gracefully
      }
    }
  }

  // Init git repo (required for legacy path's execGit check-ignore calls)
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  // Stage all including .gitignore before first commit
  execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });

  return dir;
}

module.exports = {
  TOOLS_PATH,
  runGsdTools,
  runGsdToolsFull,
  createTempProject,
  createParityProject,
  cleanup,
  STATE_FIXTURE,
  writeStateFixture,
  snapshotCompare,
  contractCheck,
};
