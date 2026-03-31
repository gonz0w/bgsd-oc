const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, runGsdToolsFull, cleanup } = require('./helpers.cjs');

function createProject(options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-readiness-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

  const scripts = options.scripts || {};
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'readiness-test',
    version: '1.0.0',
    scripts,
  }, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 1;\n');
  if (options.withChangelog !== false) {
    fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n');
  }

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git add -A && git commit -m "init: setup"', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

function writeReport(tmpDir, name, total) {
  fs.writeFileSync(path.join(tmpDir, '.planning', name), JSON.stringify({
    summary: { total },
    findings: Array.from({ length: total }, (_, index) => ({ id: index + 1 })),
  }, null, 2));
}

describe('review:readiness', () => {
  let tmpDir;

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('json output includes stable check keys and summary metadata', () => {
    tmpDir = createProject({
      scripts: {
        test: 'node -e "process.exit(0)"',
        lint: 'node -e "process.exit(0)"',
      },
    });
    writeReport(tmpDir, 'review-report.json', 0);
    writeReport(tmpDir, 'security-report.json', 0);
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n');
    fs.appendFileSync(path.join(tmpDir, 'CHANGELOG.md'), '- Added readiness contract\n');

    const result = runGsdTools('review:readiness', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.command, 'review:readiness');
    assert.strictEqual(output.advisory, true);
    assert.deepStrictEqual(output.ordered_checks.map((entry) => entry.key), ['tests', 'lint', 'review', 'security', 'todo_diff', 'changelog']);
    assert.deepStrictEqual(Object.keys(output.checks), ['tests', 'lint', 'review', 'security', 'todo_diff', 'changelog']);
    assert.deepStrictEqual(output.summary, { pass: 6, fail: 0, skip: 0, total: 6 });
    assert.strictEqual(output.ready, true);
  });

  test('missing scripts or artifacts become skip with explicit reasons', () => {
    tmpDir = createProject({ scripts: {}, withChangelog: false });

    const result = runGsdTools('review:readiness', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.checks.tests.status, 'skip');
    assert.match(output.checks.tests.reason, /does not define a test script/);
    assert.strictEqual(output.checks.lint.status, 'skip');
    assert.strictEqual(output.checks.review.status, 'skip');
    assert.strictEqual(output.checks.security.status, 'skip');
    assert.strictEqual(output.checks.changelog.status, 'skip');
    assert.strictEqual(output.checks.todo_diff.status, 'pass');
  });

  test('only executed failures become fail while missing checks stay skip', () => {
    tmpDir = createProject({
      scripts: {
        test: 'node -e "process.exit(1)"',
      },
    });
    writeReport(tmpDir, 'review-report.json', 2);
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n// TODO: clean this up\n');

    const result = runGsdTools('review:readiness', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.ready, false);
    assert.strictEqual(output.checks.tests.status, 'fail');
    assert.strictEqual(output.checks.lint.status, 'skip');
    assert.strictEqual(output.checks.review.status, 'fail');
    assert.strictEqual(output.checks.security.status, 'skip');
    assert.strictEqual(output.checks.todo_diff.status, 'fail');
    assert.strictEqual(output.checks.changelog.status, 'fail');
    assert.strictEqual(output.summary.fail, 4);
    assert.strictEqual(output.summary.skip, 2);
  });

  test('pretty output is board-first, color-capable, and advisory-only', () => {
    tmpDir = createProject({
      scripts: {
        test: 'node -e "process.exit(0)"',
        lint: 'node -e "process.exit(0)"',
      },
    });
    writeReport(tmpDir, 'review-report.json', 0);
    writeReport(tmpDir, 'security-report.json', 0);
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n');
    fs.appendFileSync(path.join(tmpDir, 'CHANGELOG.md'), '- Updated release notes\n');

    const stdout = execSync(`node "${TOOLS_PATH}" review:readiness --pretty`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    assert.match(stdout, /review:readiness/);
    assert.match(stdout, /advisory/i);
    assert.match(stdout, /Tests/);
    assert.match(stdout, /PASS/);
    assert.match(stdout, /Board: 6 pass, 0 fail, 0 skip/);
    assert.match(stdout, /\x1b\[/);

    const failing = runGsdToolsFull('review:readiness --pretty', tmpDir);
    assert.ok(failing.success, failing.stderr);
  });

  test('help and release routing are discoverable', () => {
    tmpDir = createProject();

    const readinessHelp = runGsdTools('review:readiness --help', tmpDir);
    assert.ok(readinessHelp.success, readinessHelp.error);

    const releaseHelp = runGsdTools('release:bump --help', tmpDir);
    assert.ok(releaseHelp.success, releaseHelp.error);

    const releaseCmd = runGsdTools('release:bump', tmpDir);
    assert.ok(releaseCmd.success, releaseCmd.error);
    const output = JSON.parse(releaseCmd.output);
    assert.strictEqual(output.command, 'release:bump');
    assert.strictEqual(output.status, 'ok');
  });
});
