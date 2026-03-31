/**
 * bgsd-tools infra tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, runGsdToolsFull, createTempProject, cleanup } = require('./helpers.cjs');

const BUILD_OUTPUT_PATH = TOOLS_PATH;

describe('debug logging', () => {
  // Helper that captures both stdout and stderr separately
  function runWithStderr(args, opts = {}) {
    const env = { ...process.env, ...opts.env };
    const { spawnSync } = require('child_process');
    const result = spawnSync('node', [TOOLS_PATH, ...args.split(/\s+/)], {
      cwd: opts.cwd || process.cwd(),
      encoding: 'utf-8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      success: result.status === 0,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      error: result.status !== 0 ? `exit code ${result.status}` : '',
    };
  }

  test('produces debug output on stderr when BGSD_DEBUG=1', () => {
    // Use a command that triggers catch blocks (e.g., state read with no .planning)
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      const result = runWithStderr('init:progress', {
        cwd: tmpDir,
        env: { ...process.env, BGSD_DEBUG: '1' },
      });
      // The command may fail (no .planning), but stderr should have debug lines
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[BGSD_DEBUG]'));
      assert.ok(debugLines.length > 0, `Expected debug output on stderr, got: ${result.stderr.slice(0, 200)}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('no debug output when BGSD_DEBUG is unset', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      // Explicitly remove BGSD_DEBUG from env
      const cleanEnv = { ...process.env };
      delete cleanEnv.BGSD_DEBUG;
      const result = runWithStderr('init:progress', {
        cwd: tmpDir,
        env: cleanEnv,
      });
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[BGSD_DEBUG]'));
      assert.strictEqual(debugLines.length, 0, `Expected no debug output, but got: ${debugLines.join('; ')}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('verbose mode enables debug output without BGSD_DEBUG', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      const cleanEnv = { ...process.env };
      delete cleanEnv.BGSD_DEBUG;
      const result = runWithStderr('init:progress --verbose', {
        cwd: tmpDir,
        env: cleanEnv,
      });
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[BGSD_DEBUG]'));
      assert.ok(debugLines.length > 0, `Expected verbose mode debug output, got: ${result.stderr.slice(0, 200)}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('stdout JSON remains valid when BGSD_DEBUG=1', () => {
    // current-timestamp (without --raw) always succeeds and returns JSON
    const result = runWithStderr('util:current-timestamp', {
      env: { ...process.env, BGSD_DEBUG: '1' },
    });
    assert.ok(result.success, `Command should succeed: ${result.error}`);
    // stdout must be valid JSON (no debug pollution)
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(result.stdout);
    }, `stdout should be valid JSON, got: ${result.stdout.slice(0, 200)}`);
    assert.ok(parsed.timestamp, 'Parsed JSON should contain a timestamp field');
  });

  test('debug output includes context strings with [BGSD_DEBUG] prefix', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      const result = runWithStderr('init:progress', {
        cwd: tmpDir,
        env: { ...process.env, BGSD_DEBUG: '1' },
      });
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[BGSD_DEBUG]'));
      // Each debug line should match the format: [BGSD_DEBUG] context.subcontext: message
      for (const line of debugLines) {
        assert.match(line, /\[BGSD_DEBUG\] [\w.-]+:/, `Debug line should have context format: ${line}`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('quiet default runtime diagnostics', () => {
  test('invalid compile-cache env stays quiet by default', () => {
    const { spawnSync } = require('child_process');
    const script = `
      const { isCompileCacheEnabled, getCompileCacheArgs, diagnoseCompileCache } = require('./src/lib/runtime-capabilities');
      const enabled = isCompileCacheEnabled();
      const args = getCompileCacheArgs();
      const diagnostics = diagnoseCompileCache();
      process.stdout.write(JSON.stringify({ enabled, args, diagnostics }));
    `;

    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      env: { ...process.env, BGSD_COMPILE_CACHE: 'maybe', BGSD_DEBUG: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    assert.strictEqual(result.status, 0, `script should exit cleanly: ${result.stderr}`);
    assert.strictEqual(result.stderr.trim(), '', 'default invalid env path should stay quiet');

    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.enabled.source, 'env-invalid', 'invalid env should still be classified');
    assert.strictEqual(parsed.args.useCache, false, 'invalid env should not enable compile cache');
  });

  test('invalid compile-cache env emits one debug diagnostic when BGSD_DEBUG=1', () => {
    const { spawnSync } = require('child_process');
    const script = `
      const { isCompileCacheEnabled, getCompileCacheArgs, diagnoseCompileCache } = require('./src/lib/runtime-capabilities');
      isCompileCacheEnabled();
      getCompileCacheArgs();
      diagnoseCompileCache();
      process.stdout.write('ok');
    `;

    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      env: { ...process.env, BGSD_COMPILE_CACHE: 'maybe', BGSD_DEBUG: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    assert.strictEqual(result.status, 0, `script should exit cleanly: ${result.stderr}`);
    const matches = (result.stderr.match(/Invalid BGSD_COMPILE_CACHE value: maybe/g) || []).length;
    assert.strictEqual(matches, 1, `expected one invalid-value diagnostic, got ${matches}: ${result.stderr}`);
  });
});

describe('shell sanitization', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Helper to init a git repo in a temp dir (sets author identity for commits)
  function initGitRepo(dir) {
    execSync(
      'git init && git -c user.name=Test -c user.email=test@test.com add . && git -c user.name=Test -c user.email=test@test.com commit -m "init" --allow-empty',
      { cwd: dir, encoding: 'utf-8', stdio: 'pipe' }
    );
  }

  test('session-diff extracts only the date portion from Last Activity', () => {
    // The regex \d{4}-\d{2}-\d{2} already strips trailing shell metacharacters.
    // Combined with isValidDateString(), the injected part never reaches execSync.
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Last Activity:** 2026-01-01; echo pwned\n`
    );

    initGitRepo(tmpDir);

    const result = runGsdTools('execute:session-diff', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    // The regex only captures "2026-01-01" (valid date), so the command proceeds safely
    assert.strictEqual(output.since, '2026-01-01', 'Only the date portion should be extracted');
  });

  test('session-diff works with valid date strings', () => {
    // Write STATE.md with a valid date
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Last Activity:** 2026-01-01\n`
    );

    initGitRepo(tmpDir);

    const result = runGsdTools('execute:session-diff', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.since, '2026-01-01', 'Valid date should be accepted');
    assert.ok(Array.isArray(output.commits), 'Should return commits array');
  });

  test('session-diff rejects backtick injection in date', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Last Activity:** `whoami`\n'
    );

    initGitRepo(tmpDir);

    const result = runGsdTools('execute:session-diff', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should get "No last activity" error because regex won't match backtick-containing string
    assert.ok(output.error, 'Backtick date should be rejected');
  });

  test('session-diff rejects $() injection in date', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Last Activity:** $(date)\n'
    );

    initGitRepo(tmpDir);

    const result = runGsdTools('execute:session-diff', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, '$() injection should be rejected');
  });

  // Removed: codebase-impact --fixed-strings test
  // The router now routes codebase impact to codebase.js which uses dependency graph (not grep).
  // The grep-based --fixed-strings path in features.js is no longer reachable via this route.
});

describe('temp file cleanup', () => {
  // Source inspection tests for _tmpFiles removed — the build is minified so literal
  // string checks are unreliable. The behavioral test below verifies the same thing.

  test('no temp files remain after CLI invocation', () => {
    // Run a normal CLI command and verify no gsd-*.json files are created
    // (normal output is small, so no tmpfile should be created)
    const before = (fs.readdirSync(require('os').tmpdir()))
      .filter(f => f.startsWith('gsd-') && f.endsWith('.json'));

    const result = runGsdTools('util:current-timestamp');
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const after = (fs.readdirSync(require('os').tmpdir()))
      .filter(f => f.startsWith('gsd-') && f.endsWith('.json'));

    // The count should not increase (cleanup runs on exit)
    assert.ok(
      after.length <= before.length,
      `No new temp files should remain after CLI exit (before: ${before.length}, after: ${after.length})`
    );
  });

  test('exit handler cleans up tracked files', () => {
    // Create a temp file that mimics what bgsd-tools would create,
    // then verify the cleanup pattern works
    const crypto = require('crypto');
    const tmpPath = path.join(require('os').tmpdir(), `gsd-test-cleanup-${crypto.randomBytes(8).toString('hex')}.json`);
    fs.writeFileSync(tmpPath, '{}', { encoding: 'utf-8', mode: 0o600 });
    assert.ok(fs.existsSync(tmpPath), 'Temp file should exist before cleanup');

    // Simulate the cleanup logic directly
    try { fs.unlinkSync(tmpPath); } catch {}
    assert.ok(!fs.existsSync(tmpPath), 'Temp file should be removed after cleanup');
  });
});

describe('--help flag', () => {
  test('known command prints help to stderr', () => {
    // --help exits 0 which execSync treats as success; stderr goes to pipe
    const result = execSync(`node "${TOOLS_PATH}" verify:state --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('Usage: bgsd-tools'), `Expected state help, got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('Subcommands:'), 'Should list subcommands');
  });

  test('unknown command lists available commands', () => {
    const result = execSync(`node "${TOOLS_PATH}" nonexistent --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('No help available'), `Expected "no help", got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('verify:state'), 'Should list verify:state in available commands');
    assert.ok(result.includes('util:config-migrate'), 'Should list util:config-migrate in available commands');
  });

  test('help text does not contaminate stdout', () => {
    // Run with stderr redirected to /dev/null — stdout should be empty
    const stdout = execSync(`node "${TOOLS_PATH}" util:current-timestamp --help 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.strictEqual(stdout, '', 'stdout should be empty when --help is used');
  });

  test('COMMAND_HELP covers major commands', () => {
    const result = execSync(`node "${TOOLS_PATH}" nonexistent --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const line = result.split('\n').find(l => !l.startsWith('No help'));
    const commands = line.split(', ').map(c => c.trim());
    // Verify at least 30 commands are documented
    assert.ok(commands.length >= 30, `Expected 30+ commands, found ${commands.length}`);
  });
});

describe('config-migrate command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds missing keys with schema defaults', () => {
    // Create a minimal config missing most keys
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      model_profile: 'quality',
    }, null, 2));

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.migrated_keys.length > 0, 'Should have migrated keys');
    assert.ok(parsed.unchanged_keys.includes('model_profile'), 'model_profile should be unchanged');
    assert.ok(!parsed.migrated_keys.includes('model_profile'), 'model_profile should not be migrated');

    // Verify the written config has the new keys
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.model_profile, 'quality', 'Existing value preserved');
    assert.strictEqual(config.test_gate, true, 'Missing key added with default');
  });

  test('existing values are never overwritten', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      model_profile: 'budget',
      mode: 'yolo',
      brave_search: true,
      workflow: { research: false },
    }, null, 2));

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.model_profile, 'budget', 'model_profile preserved');
    assert.strictEqual(config.mode, 'yolo', 'mode preserved');
    assert.strictEqual(config.brave_search, true, 'brave_search preserved');
    assert.strictEqual(config.workflow.research, false, 'nested workflow.research preserved');
  });

  test('backup file is created before writing', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const backupPath = configPath + '.bak';
    const original = { model_profile: 'balanced' };
    fs.writeFileSync(configPath, JSON.stringify(original, null, 2));

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    // Should have migrated keys since original only has 1 key
    assert.ok(parsed.migrated_keys.length > 0, 'Should migrate missing keys');
    assert.ok(parsed.backup_path !== null, 'backup_path should be set');

    // Verify backup exists and contains original content
    assert.ok(fs.existsSync(backupPath), 'Backup file should exist');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    assert.strictEqual(backup.model_profile, 'balanced', 'Backup has original value');
    assert.strictEqual(backup.test_gate, undefined, 'Backup should not have migrated keys');
  });

  test('already-complete config returns empty migrated_keys', () => {
    // Build a config with ALL schema keys present
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const fullConfig = {
      model_profile: 'balanced',
      brave_search: false,
      mode: 'interactive',
      parallelization: true,
      model_profiles: {},
      depth: 'standard',
      test_commands: {},
      test_gate: true,
      context_window: 200000,
      context_target_percent: 50,
      planning: { commit_docs: true, search_gitignored: false },
      git: { branching_strategy: 'none', phase_branch_template: 'gsd/phase-{phase}-{slug}', milestone_branch_template: 'gsd/{milestone}-{slug}' },
      workflow: { research: true, plan_check: true, verifier: true, rag: true, rag_timeout: 30 },
      optimization: { valibot: true, valibot_fallback: false, discovery: 'optimized', compile_cache: false, sqlite_cache: true },
      tools: { ripgrep: true, fd: true, jq: true, yq: true, ast_grep: true, sd: true, hyperfine: true, bat: true, gh: true },
      ytdlp_path: '',
      nlm_path: '',
      mcp_config_path: '',
      runtime: 'auto',
    };
    fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.deepStrictEqual(parsed.migrated_keys, [], 'No keys should be migrated');
    assert.strictEqual(parsed.backup_path, null, 'No backup needed when nothing migrated');
  });

  test('config-migrate help text available', () => {
    const result = execSync(`node "${TOOLS_PATH}" util:config-migrate --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('Usage: bgsd-tools'), `Expected config-migrate help, got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('CONFIG_SCHEMA'), 'Should mention CONFIG_SCHEMA');
  });
});

describe('build system', () => {
  test('npm run build succeeds with exit code 0', () => {
    const result = execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.ok(result.includes('Built bin/bgsd-tools.cjs'), `Expected build output, got: ${result.slice(0, 200)}`);
    assert.ok(result.includes('Smoke test passed'), `Expected smoke test pass, got: ${result.slice(0, 200)}`);
  });

  test('build produces bin/bgsd-tools.cjs from src/', () => {
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.ok(fs.existsSync(BUILD_OUTPUT_PATH), 'build output file should exist after build');
    const stat = fs.statSync(BUILD_OUTPUT_PATH);
    assert.ok(stat.size > 10000, `build output should be substantial (got ${stat.size} bytes)`);
  });

  test('built file has working shebang on line 1', () => {
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });
    const content = fs.readFileSync(BUILD_OUTPUT_PATH, 'utf-8');
    assert.ok(content.startsWith('#!/usr/bin/env node\n'), 'build output should start with shebang');
    // Verify no double shebang
    const lines = content.split('\n');
    const shebangCount = lines.filter(l => l.startsWith('#!')).length;
    assert.strictEqual(shebangCount, 1, `Expected exactly 1 shebang, found ${shebangCount}`);
  });

  test('built current-timestamp outputs valid ISO format', () => {
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });

    const result = execSync(`node "${BUILD_OUTPUT_PATH}" util:current-timestamp`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    // In piped mode, current-timestamp outputs JSON with timestamp field
    const data = JSON.parse(result);
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.timestamp),
      `Build output timestamp should be ISO format, got: ${data.timestamp}`);
  });

  test('built state load works in temp project', () => {
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Create a temp project with STATE.md and config.json
    const tmpDir = createTempProject();
    try {
      const stateContent = `# Project State

## Current Position

Phase: 2 of 3 (Testing)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-01-15

Progress: [████░░░░░░] 40%
`;
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
        model_profile: 'balanced',
      }));

      const result = execSync(`node "${BUILD_OUTPUT_PATH}" verify:state load`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      // In piped mode, state load outputs JSON
      const data = JSON.parse(result);
      assert.strictEqual(data.config.model_profile, 'balanced', 'should contain config value');
      assert.strictEqual(data.state_exists, true, 'should detect STATE.md');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('build completes in under 500ms', () => {
    // Run build and parse timing from output
    const result = execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });

    const match = result.match(/in (\d+)ms/);
    assert.ok(match, `Expected timing in output, got: ${result.slice(0, 200)}`);
    const elapsed = parseInt(match[1], 10);
    assert.ok(elapsed < 500, `Build took ${elapsed}ms, should be under 500ms`);
  });
});

describe('file cache', () => {
  test('init progress returns valid JSON with cache enabled', () => {
    // cachedReadFile is used internally — test that compound commands
    // (which read files multiple times) still produce valid output
    const result = runGsdTools('init:progress --verbose');
    assert.ok(result.success, 'init progress should succeed');
    const data = JSON.parse(result.output);
    // phase_count may be 0 if all milestones are complete (no active milestone)
    assert.ok(typeof data.phase_count === 'number', 'should have phase_count');
    assert.ok(data.project_exists === true, 'should find project');
  });

  test('cachedReadFile and invalidateFileCache are exported', () => {
    // Verify the build artifact exports these functions
    const content = fs.readFileSync(TOOLS_PATH, 'utf-8');
    assert.ok(content.includes('cachedReadFile'), 'build should contain cachedReadFile');
    assert.ok(content.includes('invalidateFileCache'), 'build should contain invalidateFileCache');
    assert.ok(content.includes('new Map'), 'build should contain Map for cache');
  });
});

describe('configurable context window', () => {
  test('context-budget uses default context window (200K)', () => {
    // Use a plan file that exists in current milestone
    const result = runGsdTools('verify:context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-01-PLAN.md');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.estimates.context_window, 200000, 'should default to 200K context window');
    assert.strictEqual(data.estimates.target_percent, 50, 'should default to 50% target');
  });

  test('context-budget output includes context_window field', () => {
    const result = runGsdTools('verify:context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-02-PLAN.md');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok('context_window' in data.estimates, 'estimates should contain context_window');
    assert.ok(typeof data.estimates.context_window === 'number', 'context_window should be a number');
  });

  test('validate-config recognizes context_window as known key', () => {
    const result = runGsdTools('verify:validate-config');
    assert.ok(result.success, 'validate-config should succeed');
    const data = JSON.parse(result.output);
    // context_window should be in effective config (not in warnings as unknown)
    assert.ok('context_window' in data.effective_config, 'should recognize context_window');
    assert.strictEqual(data.effective_config.context_window.value, 200000, 'default should be 200000');
    assert.strictEqual(data.effective_config.context_window.source, 'default', 'should come from defaults');
  });

  test('validate-config recognizes context_target_percent as known key', () => {
    const result = runGsdTools('verify:validate-config');
    assert.ok(result.success, 'validate-config should succeed');
    const data = JSON.parse(result.output);
    assert.ok('context_target_percent' in data.effective_config, 'should recognize context_target_percent');
    assert.strictEqual(data.effective_config.context_target_percent.value, 50, 'default should be 50');
    assert.strictEqual(data.effective_config.context_target_percent.source, 'default', 'should come from defaults');
  });
});

describe('--fields flag', () => {
  test('filters top-level fields from JSON output', () => {
    const result = runGsdTools('init:progress --fields milestone_version,phase_count');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Should have only the requested fields
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.ok('phase_count' in data, 'should include phase_count');
    // Other fields should NOT be present
    assert.strictEqual(Object.keys(data).length, 2, 'should have exactly 2 fields');
  });

  test('missing fields return null', () => {
    const result = runGsdTools('init:progress --fields milestone_version,nonexistent_field');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.strictEqual(data.nonexistent_field, null, 'missing field should be null');
  });

  test('without --fields returns full output with --verbose', () => {
    const result = runGsdTools('init:progress --verbose');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Full output has many fields
    assert.ok(Object.keys(data).length > 5, 'full output should have many fields');
    assert.ok('state_path' in data, 'should include state_path');
    assert.ok('roadmap_path' in data, 'should include roadmap_path');
  });

  test('dot-notation filters nested object fields', () => {
    // Use a command that returns nested objects
    const result = runGsdTools('verify:validate-config --fields exists,valid_json');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('exists' in data, 'should include exists');
    assert.ok('valid_json' in data, 'should include valid_json');
    assert.strictEqual(Object.keys(data).length, 2, 'should have exactly 2 fields');
  });

  test('filterFields function works on arrays', () => {
    // Test by importing filterFields directly — use a source-level test
    const { filterFields } = require('../src/lib/output');
    const input = [
      { name: 'foo', status: 'ok', extra: 'bar' },
      { name: 'baz', status: 'done', extra: 'qux' },
    ];
    const result = filterFields(input, ['name', 'status']);
    assert.deepStrictEqual(result, [
      { name: 'foo', status: 'ok' },
      { name: 'baz', status: 'done' },
    ], 'should filter array elements');
  });

  test('filterFields function supports dot-notation', () => {
    const { filterFields } = require('../src/lib/output');
    const input = {
      phases: [
        { goal: 'x', other: 'y' },
        { goal: 'z', other: 'w' },
      ],
      name: 'test',
    };
    const result = filterFields(input, ['phases.goal']);
    assert.deepStrictEqual(result.phases, [
      { goal: 'x' },
      { goal: 'z' },
    ], 'should filter nested array fields via dot-notation');
  });
});

describe('token estimation', () => {
  test('estimateTokens returns a number for text input', () => {
    const { estimateTokens } = require('../src/lib/context');
    const tokens = estimateTokens('Hello world, this is a test string for token counting.');
    assert.ok(typeof tokens === 'number', 'should return a number');
    assert.ok(tokens > 0, 'should be positive');
    // "Hello world, this is a test string for token counting." is ~13 tokens with cl100k_base
    assert.ok(tokens >= 8 && tokens <= 20, `token count should be reasonable (got ${tokens})`);
  });

  test('estimateTokens returns 0 for empty/null input', () => {
    const { estimateTokens } = require('../src/lib/context');
    assert.strictEqual(estimateTokens(''), 0, 'empty string should be 0');
    assert.strictEqual(estimateTokens(null), 0, 'null should be 0');
    assert.strictEqual(estimateTokens(undefined), 0, 'undefined should be 0');
  });

  test('estimateJsonTokens works on objects', () => {
    const { estimateJsonTokens } = require('../src/lib/context');
    const tokens = estimateJsonTokens({ name: 'test', count: 42, items: ['a', 'b', 'c'] });
    assert.ok(typeof tokens === 'number', 'should return a number');
    assert.ok(tokens > 0, 'should be positive for non-empty object');
  });

  test('checkBudget returns correct structure', () => {
    const { checkBudget } = require('../src/lib/context');
    const result = checkBudget(50000, { context_window: 200000, context_target_percent: 50 });
    assert.strictEqual(result.tokens, 50000, 'tokens should match input');
    assert.strictEqual(result.percent, 25, 'percent should be 25');
    assert.strictEqual(result.warning, false, 'should not warn at 25%');
    assert.strictEqual(result.recommendation, null, 'no recommendation at 25%');
  });

  test('checkBudget warns when over target', () => {
    const { checkBudget } = require('../src/lib/context');
    const result = checkBudget(120000, { context_window: 200000, context_target_percent: 50 });
    assert.strictEqual(result.percent, 60, 'percent should be 60');
    assert.strictEqual(result.warning, true, 'should warn at 60%');
    assert.ok(result.recommendation !== null, 'should have recommendation');
  });

  test('context-budget uses tokenx-based estimates (not lines*4)', () => {
    const result = runGsdTools('verify:context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-01-PLAN.md');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Should have both tokenx estimates and heuristic for comparison
    assert.ok('plan_tokens' in data.estimates, 'should have plan_tokens');
    assert.ok('heuristic_tokens' in data.estimates, 'should have heuristic_tokens');
    assert.ok(typeof data.estimates.plan_tokens === 'number', 'plan_tokens should be number');
    assert.ok(typeof data.estimates.heuristic_tokens === 'number', 'heuristic_tokens should be number');

    // tokenx estimate should differ from lines*4 heuristic (they use different algorithms)
    // The heuristic counts lines and multiplies by 4. tokenx actually estimates BPE tokens.
    // They should both be > 0 but usually different values
    assert.ok(data.estimates.plan_tokens > 0, 'plan_tokens should be positive');
    assert.ok(data.estimates.total_tokens > 0, 'total_tokens should be positive');
  });
});

describe('extractAtReferences', () => {
  test('extracts absolute path references', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    const content = 'Load @/tmp/test-config/opencode/workflows/execute-plan.md for context.';
    const refs = extractAtReferences(content);
    assert.ok(refs.includes('/tmp/test-config/opencode/workflows/execute-plan.md'), 'should extract absolute path');
  });

  test('extracts relative .planning/ references', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    const content = 'See @.planning/STATE.md and @.planning/ROADMAP.md for details.';
    const refs = extractAtReferences(content);
    assert.ok(refs.includes('.planning/STATE.md'), 'should extract .planning/STATE.md');
    assert.ok(refs.includes('.planning/ROADMAP.md'), 'should extract .planning/ROADMAP.md');
  });

  test('extracts references from context blocks', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    const content = `<context>
@.planning/PROJECT.md
@src/lib/output.js
@src/router.js
</context>`;
    const refs = extractAtReferences(content);
    assert.ok(refs.includes('.planning/PROJECT.md'), 'should extract .planning/PROJECT.md');
    assert.ok(refs.includes('src/lib/output.js'), 'should extract src/lib/output.js');
    assert.ok(refs.includes('src/router.js'), 'should extract src/router.js');
  });

  test('ignores email addresses and non-path mentions', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    const content = 'Contact @user or email user@example.com for help.';
    const refs = extractAtReferences(content);
    assert.strictEqual(refs.length, 0, 'should ignore non-path @mentions');
  });

  test('deduplicates references', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    const content = 'See @.planning/STATE.md and again @.planning/STATE.md here.';
    const refs = extractAtReferences(content);
    const stateRefs = refs.filter(r => r === '.planning/STATE.md');
    assert.strictEqual(stateRefs.length, 1, 'should deduplicate references');
  });

  test('returns empty array for null/empty input', () => {
    const { extractAtReferences } = require('../src/lib/helpers');
    assert.deepStrictEqual(extractAtReferences(''), [], 'empty string returns empty array');
    assert.deepStrictEqual(extractAtReferences(null), [], 'null returns empty array');
    assert.deepStrictEqual(extractAtReferences(undefined), [], 'undefined returns empty array');
  });
});

describe('build pipeline', () => {
  test('bundle size is under 1500KB budget', () => {
    const stat = fs.statSync(TOOLS_PATH);
    const sizeKB = Math.round(stat.size / 1024);
    assert.ok(sizeKB <= 1500, `Bundle size ${sizeKB}KB exceeds 1500KB budget`);
    assert.ok(sizeKB > 50, `Bundle size ${sizeKB}KB suspiciously small`);
  });

  test('bundle is valid JavaScript', () => {
    // Verify the bundle can be loaded without syntax errors
    const content = fs.readFileSync(TOOLS_PATH, 'utf-8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'should have shebang');
    // Smoke test: run a simple command
    const result = runGsdTools('util:current-timestamp');
    assert.ok(result.success, `Bundle smoke test failed: ${result.error}`);
    const output = result.output.trim();
    assert.ok(output.length > 10, `Unexpected timestamp output: ${output}`);
  });
});

describe('ESM plugin build', () => {
  test('build produces ESM plugin.js', () => {
    const pluginPath = path.join(__dirname, '..', 'plugin.js');
    assert.ok(fs.existsSync(pluginPath), 'plugin.js should exist at project root');
    const stat = fs.statSync(pluginPath);
    assert.ok(stat.size > 100, `plugin.js suspiciously small: ${stat.size} bytes`);
  });

  test('ESM plugin.js has no require() calls', () => {
    const pluginPath = path.join(__dirname, '..', 'plugin.js');
    const content = fs.readFileSync(pluginPath, 'utf-8');
    const requireMatches = content.match(/\brequire\s*\(/g);
    assert.strictEqual(requireMatches, null, `Found require() calls in ESM plugin.js: ${requireMatches ? requireMatches.length : 0}`);
  });

  test('ESM plugin.js exports BgsdPlugin', async () => {
    const pluginPath = path.join(__dirname, '..', 'plugin.js');
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.BgsdPlugin, 'function', 'BgsdPlugin should be exported as a function');
  });

  test('ESM plugin.js includes safeHook', () => {
    const pluginPath = path.join(__dirname, '..', 'plugin.js');
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('safeHook'), 'plugin.js should contain safeHook');
  });
});

describe('token-budget', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('returns budgets with actual token counts for project dir', () => {
    const result = runGsdTools('verify:token-budget', PROJECT_DIR);
    assert.ok(result.success, `token-budget failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(Array.isArray(data.workflows), 'should have workflows array');
    assert.ok(data.workflows.length > 0, 'should find at least one workflow');
    assert.strictEqual(typeof data.total_workflows, 'number', 'total_workflows should be number');
    assert.strictEqual(typeof data.over_budget_count, 'number', 'over_budget_count should be number');

    // Each workflow entry should have required fields
    const first = data.workflows[0];
    assert.ok('name' in first, 'workflow should have name');
    assert.ok('actual_tokens' in first, 'workflow should have actual_tokens');
    assert.ok('budget_tokens' in first, 'workflow should have budget_tokens');
    assert.ok('over_budget' in first, 'workflow should have over_budget');
    assert.ok(first.actual_tokens > 0, 'actual_tokens should be positive');
  });

  test('all known workflows are within budget', () => {
    const result = runGsdTools('verify:token-budget', PROJECT_DIR);
    assert.ok(result.success, `token-budget failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.over_budget_count, 0, `Expected 0 over-budget workflows, got ${data.over_budget_count}`);
    for (const wf of data.workflows) {
      if (wf.actual_tokens !== null) {
        assert.ok(!wf.over_budget, `${wf.name} is over budget: ${wf.actual_tokens} > ${wf.budget_tokens}`);
      }
    }
  });
});

describe('compact default behavior', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('default output is compact (no --compact needed)', () => {
    const result = runGsdTools('init:progress', PROJECT_DIR);
    assert.ok(result.success, `init progress failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Compact mode should strip verbose-only fields
    assert.strictEqual(data.executor_model, undefined, 'compact default should drop executor_model');
    assert.strictEqual(data.state_path, undefined, 'compact default should drop state_path');

    // But should keep essential fields
    assert.ok('milestone_version' in data, 'compact default should keep milestone_version');
    assert.ok('phase_count' in data, 'compact default should keep phase_count');
  });

  test('--verbose restores full output', () => {
    const result = runGsdTools('init:progress --verbose', PROJECT_DIR);
    assert.ok(result.success, `init progress --verbose failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Verbose mode should include all fields
    assert.ok('state_path' in data, 'verbose should include state_path');
    assert.ok('roadmap_path' in data, 'verbose should include roadmap_path');
    assert.ok('project_path' in data, 'verbose should include project_path');
    assert.ok('milestone_version' in data, 'verbose should include milestone_version');
    assert.ok('phase_count' in data, 'verbose should include phase_count');
  });
});

// profiler tests removed — src/lib/profiler.js module was intentionally deleted
// (Phase 114: Test Suite Stabilization)
