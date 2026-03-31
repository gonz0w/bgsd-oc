const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, cleanup } = require('./helpers.cjs');

function git(tmpDir, command) {
  return execSync(command, { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function runToolWithEnv(args, cwd, env = {}) {
  try {
    const output = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout || '').toString(),
      error: (err.stderr || '').toString().trim(),
    };
  }
}

function writeFakeGh(tmpDir) {
  const binDir = path.join(tmpDir, 'fake-bin');
  const ghPath = path.join(binDir, 'gh');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(ghPath, [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then',
    '  printf "gh version 2.89.1\\n"',
    '  exit 0',
    'fi',
    'if [ "$1" = "auth" ] && [ "$2" = "status" ]; then',
    '  printf "✓ Logged in to github.com account test-user\\n"',
    '  exit 0',
    'fi',
    'if [ "$1" = "pr" ] && [ "$2" = "create" ]; then',
    '  printf "https://github.com/example/repo/pull/42\\n"',
    '  exit 0',
    'fi',
    'printf "unexpected gh invocation: %s %s\\n" "$1" "$2" >&2',
    'exit 1',
    '',
  ].join('\n'), 'utf-8');
  fs.chmodSync(ghPath, 0o755);
  return binDir;
}

function createProject(options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-release-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '148-release'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'release-test',
    version: options.version || '1.2.3',
  }, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({
    name: 'release-test',
    version: options.version || '1.2.3',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'release-test',
        version: options.version || '1.2.3',
      },
    },
  }, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'VERSION'), `${options.version || '1.2.3'}\n`);
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'module.exports = 1;\n');
  if (options.withChangelog !== false) {
    fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n');
  }

  git(tmpDir, 'git init');
  git(tmpDir, 'git config user.email "test@test.com"');
  git(tmpDir, 'git config user.name "Test"');
  git(tmpDir, 'git add -A');
  git(tmpDir, 'git commit -m "chore: initial release baseline"');
  if (options.tag !== false) {
    git(tmpDir, `git tag v${options.version || '1.2.3'}`);
  }

  return tmpDir;
}

function commitFile(tmpDir, message, fileName = 'src/index.js', content = null) {
  const fullPath = path.join(tmpDir, fileName);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content || `${message}\n`);
  git(tmpDir, 'git add -A');
  git(tmpDir, `git commit -m ${JSON.stringify(message)}`);
}

function addSummary(tmpDir, fileName, oneLiner) {
  const filePath = path.join(tmpDir, '.planning', 'phases', '148-release', fileName);
  fs.writeFileSync(filePath, [
    '---',
    'phase: 148-release',
    'plan: 01',
    `one-liner: "${oneLiner}"`,
    '---',
    '',
    '# Release summary',
    '',
    `**${oneLiner}**`,
    '',
  ].join('\n'));
  git(tmpDir, 'git add -A');
  git(tmpDir, `git commit -m ${JSON.stringify(`docs: add ${fileName}`)}`);
}

describe('release analysis', () => {
  let tmpDir;

  afterEach(() => cleanup(tmpDir));

  test('release:bump recommends major, minor, and patch from conventional commits', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat!: drop old config format');
    let result = runGsdTools('release:bump', tmpDir);
    let output = JSON.parse(result.output);
    assert.ok(result.success, result.error);
    assert.strictEqual(output.proposed_bump, 'major');
    assert.strictEqual(output.proposed_version, '2.0.0');

    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add release summary parsing');
    result = runGsdTools('release:bump', tmpDir);
    output = JSON.parse(result.output);
    assert.ok(result.success, result.error);
    assert.strictEqual(output.proposed_bump, 'minor');
    assert.strictEqual(output.proposed_version, '1.3.0');

    tmpDir = createProject();
    commitFile(tmpDir, 'fix: tighten changelog formatting');
    result = runGsdTools('release:bump', tmpDir);
    output = JSON.parse(result.output);
    assert.ok(result.success, result.error);
    assert.strictEqual(output.proposed_bump, 'patch');
    assert.strictEqual(output.proposed_version, '1.2.4');
  });

  test('ambiguous history falls back conservatively to patch with reason metadata', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'update docs without conventional prefix');

    const result = runGsdTools('release:bump', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.proposed_bump, 'patch');
    assert.strictEqual(output.source, 'conservative-fallback');
    assert.strictEqual(output.ambiguity.ambiguous, true);
    assert.match(output.reason, /conventional/i);
  });

  test('manual override wins over automatic bump detection', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'fix: patch-only change');

    const result = runGsdTools('release:bump --override minor', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.proposed_bump, 'minor');
    assert.strictEqual(output.proposed_version, '1.3.0');
    assert.strictEqual(output.source, 'manual-override');
    assert.strictEqual(output.override.applied, true);
  });

  test('release:changelog groups conventional commits and includes plan summary notes', () => {
    tmpDir = createProject();
    addSummary(tmpDir, '148-01-SUMMARY.md', 'Advisory readiness board with deterministic skip/fail semantics');
    commitFile(tmpDir, 'feat: add release bump preview');
    commitFile(tmpDir, 'fix: clarify ambiguity messaging');

    const result = runGsdTools('release:changelog', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.target_version, '1.3.0');
    assert.ok(output.summary_files.length >= 1);
    assert.match(output.draft_markdown, /Highlights/);
    assert.match(output.draft_markdown, /Advisory readiness board/);
    assert.match(output.draft_markdown, /### Features/);
    assert.match(output.draft_markdown, /### Fixes/);
  });

  test('release:changelog builds a baseline preview when CHANGELOG is absent', () => {
    tmpDir = createProject({ withChangelog: false });
    commitFile(tmpDir, 'feat: add release notes draft');

    const result = runGsdTools('release:changelog', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.baseline_created, true);
    assert.match(output.file_preview, /^# Changelog/m);
    assert.match(output.file_preview, /## Unreleased/);
    assert.match(output.file_preview, /## \[1\.3\.0\]/);
  });

  test('dry-run commands preview release decisions without mutating git state', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add preview output');
    const beforeHead = git(tmpDir, 'git rev-parse HEAD');
    const beforeChangelog = fs.readFileSync(path.join(tmpDir, 'CHANGELOG.md'), 'utf-8');

    const bumpResult = runGsdTools('release:bump', tmpDir);
    const changelogResult = runGsdTools('release:changelog', tmpDir);
    assert.ok(bumpResult.success, bumpResult.error);
    assert.ok(changelogResult.success, changelogResult.error);

    const afterHead = git(tmpDir, 'git rev-parse HEAD');
    const afterChangelog = fs.readFileSync(path.join(tmpDir, 'CHANGELOG.md'), 'utf-8');
    assert.strictEqual(afterHead, beforeHead);
    assert.strictEqual(afterChangelog, beforeChangelog);
  });

  test('help output is available for release commands', () => {
    tmpDir = createProject();
    const stderr = execSync(`node "${TOOLS_PATH}" release:bump --help`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.ok(typeof stderr === 'string');
  });

  test('release:tag synchronizes package.json, package-lock.json, and VERSION with resume state', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add resumable release mutations');

    const result = runGsdTools('release:tag', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package-lock.json'), 'utf-8'));
    const versionFile = fs.readFileSync(path.join(tmpDir, 'VERSION'), 'utf-8').trim();
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'release-state.json'), 'utf-8'));

    assert.strictEqual(output.target_version, '1.3.0');
    assert.strictEqual(pkg.version, '1.3.0');
    assert.strictEqual(lock.version, '1.3.0');
    assert.strictEqual(lock.packages[''].version, '1.3.0');
    assert.strictEqual(versionFile, '1.3.0');
    assert.deepStrictEqual(state.completed_steps, ['version-files-updated', 'changelog-updated', 'tag-created']);
    assert.strictEqual(state.next_safe_step, 'release-pr');
    assert.strictEqual(state.next_safe_command, 'node bin/bgsd-tools.cjs release:pr --resume');
  });

  test('release:tag creates a local annotated tag when prerequisites are met', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add tag automation');

    const result = runGsdTools('release:tag', tmpDir);
    assert.ok(result.success, result.error);
    assert.strictEqual(git(tmpDir, 'git tag --list v1.3.0'), 'v1.3.0');
  });

  test('release:pr fails gh preflight before mutating files when gh is unavailable', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add release PR automation');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ tools_gh: false }, null, 2));

    const result = runGsdTools('release:pr', tmpDir);
    assert.ok(!result.success, 'expected release:pr to fail without gh');
    const output = JSON.parse(result.output);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'release-state.json'), 'utf-8'));

    assert.strictEqual(output.status, 'blocked');
    assert.match(output.message, /gh/i);
    assert.strictEqual(pkg.version, '1.2.3');
    assert.deepStrictEqual(state.completed_steps, []);
    assert.strictEqual(state.next_safe_step, 'gh-preflight');
  });

  test('release:pr creates a PR with github-ci compatible handoff metadata', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add release handoff contract');

    const remotePath = path.join(tmpDir, 'origin.git');
    git(tmpDir, `git init --bare ${JSON.stringify(remotePath)}`);
    git(tmpDir, `git remote add origin ${JSON.stringify(remotePath)}`);

    const fakeBin = writeFakeGh(tmpDir);
    const result = runToolWithEnv('release:pr', tmpDir, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'release-state.json'), 'utf-8'));

    assert.strictEqual(output.status, 'ok');
    assert.strictEqual(output.pr.url, 'https://github.com/example/repo/pull/42');
    assert.strictEqual(output.github_ci.branch_name, 'release/v1.3.0');
    assert.strictEqual(output.github_ci.base_branch, 'main');
    assert.strictEqual(output.github_ci.scope, 'release-1.3.0');
    assert.ok(state.completed_steps.includes('remote-pushed'));
    assert.ok(state.completed_steps.includes('pr-created'));
    assert.strictEqual(git(tmpDir, 'git branch --show-current'), 'release/v1.3.0');
  });

  test('release:pr records the last safe step and only performs obviously safe cleanup on push failure', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add resumable release recovery');

    const fakeBin = writeFakeGh(tmpDir);
    const result = runToolWithEnv('release:pr', tmpDir, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.ok(!result.success, 'expected release:pr to fail without a remote');
    const output = JSON.parse(result.output);
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'release-state.json'), 'utf-8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package-lock.json'), 'utf-8'));
    const versionFile = fs.readFileSync(path.join(tmpDir, 'VERSION'), 'utf-8').trim();

    assert.strictEqual(output.status, 'blocked');
    assert.strictEqual(pkg.version, '1.3.0');
    assert.strictEqual(lock.packages[''].version, '1.3.0');
    assert.strictEqual(versionFile, '1.3.0');
    assert.strictEqual(git(tmpDir, 'git tag --list v1.3.0'), '');
    assert.deepStrictEqual(state.completed_steps, ['version-files-updated', 'changelog-updated']);
    assert.strictEqual(state.last_safe_completed_step, 'changelog-updated');
    assert.ok(state.cleanup.performed.includes('deleted-local-tag:v1.3.0'));
    assert.strictEqual(state.next_safe_step, 'tag-create');
    assert.match(state.next_safe_command, /git remote add origin <url> && node bin\/bgsd-tools\.cjs release:pr --resume/);
  });

  test('release:pr resume guidance points to the next safe command instead of rerunning blindly', () => {
    tmpDir = createProject();
    commitFile(tmpDir, 'feat: add explicit resume guidance');

    const fakeBin = writeFakeGh(tmpDir);
    const result = runToolWithEnv('release:pr', tmpDir, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.ok(!result.success, 'expected release:pr to stop for resume guidance');
    const output = JSON.parse(result.output);

    assert.match(output.state.next_safe_command, /release:pr --resume/);
    assert.doesNotMatch(output.state.next_safe_command, /release:tag(?!.*--resume)/);
    assert.strictEqual(output.state.next_safe_step, 'tag-create');
  });
});
