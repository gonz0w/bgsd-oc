const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { runGsdTools, runGsdToolsFull, cleanup } = require('./helpers.cjs');

function createReviewProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-review-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}));
  fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 1;\n');
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git add -A && git commit -m "init: setup"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

describe('review:scan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createReviewProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('staged diff is chosen by default when staged changes exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\nconsole.log(2);\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.status, 'ok');
    assert.strictEqual(output.target.mode, 'staged');
    assert.strictEqual(output.target.files.length, 1);
    assert.strictEqual(output.target.files[0].path, 'src/tracked.js');
    assert.ok(output.target.files[0].hunks.length >= 1);
  });

  test('empty staged state returns promptable fallback preferring commit-range review', () => {
    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.status, 'needs-input');
    assert.strictEqual(output.target.mode, 'needs-input');
    assert.strictEqual(output.target.suggested_mode, 'commit-range');
    assert.ok(output.target.suggested_commit_range.range.includes('...'));
  });

  test('nearby unstaged or untracked changes produce incomplete-scope warning', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'src', 'neighbor.js'), 'module.exports = 3;\n');

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.warnings.length, 1);
    assert.strictEqual(output.warnings[0].code, 'incomplete-scope');
    assert.ok(output.warnings[0].nearby_untracked.includes('src/neighbor.js'));
  });

  test('exclusion entries match only exact rule_id plus normalized path', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'review-exclusions.json'), JSON.stringify({
      version: 1,
      exclusions: [
        { rule_id: 'js-unused-import', path: './src/tracked.js', reason: 'intentional fixture' }
      ]
    }, null, 2));
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [
      { rule_id: 'js-unused-import', path: 'src/tracked.js', severity: 'WARNING' },
      { rule_id: 'js-unused-import', path: 'src/other.js', severity: 'WARNING' },
      { rule_id: 'other-rule', path: 'src/tracked.js', severity: 'WARNING' }
    ] }, null, 2));

    const result = runGsdTools(`review:scan --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.findings.length, 2);
    assert.strictEqual(output.suppressed.length, 1);
    assert.strictEqual(output.suppressed[0].path, 'src/tracked.js');
  });

  test('exclusion entries require a reason and matched findings stay hidden', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'review-exclusions.json'), JSON.stringify({
      version: 1,
      exclusions: [
        { rule_id: 'missing-reason', path: 'src/tracked.js' },
        { rule_id: 'js-unused-import', path: 'src/tracked.js', reason: 'documented false positive' }
      ]
    }, null, 2));
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify([
      { rule_id: 'js-unused-import', path: 'src/tracked.js', severity: 'WARNING' }
    ], null, 2));

    const result = runGsdTools(`review:scan --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.findings.length, 0);
    assert.strictEqual(output.suppressed.length, 1);
    assert.ok(output.exclusions.errors.some(msg => msg.includes('reason is required')));
  });

  test('json output includes target metadata for downstream workflow stages', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.ok(output.target.git.command.length > 0);
    assert.ok(Array.isArray(output.target.files));
    assert.ok('summary' in output);
    assert.strictEqual(output.summary.target_mode, 'staged');
    assert.ok('confidence_threshold' in output.config);
  });

  test('scan detects changed debug leftovers from the diff only', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\nconsole.log("debug");\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.ok(output.findings.some(finding => finding.rule_id === 'debug-leftovers'));
    assert.ok(output.findings.every(finding => finding.path === 'src/tracked.js'));
  });

  test('scan detects changed unused imports with structured metadata', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'import path from "node:path";\nmodule.exports = 2;\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);
    const finding = output.findings.find(entry => entry.rule_id === 'js-unused-import');

    assert.ok(finding, 'expected unused import finding');
    assert.strictEqual(finding.category, 'maintainability');
    assert.strictEqual(finding.line, 1);
    assert.ok(finding.confidence >= 0.8);
    assert.ok(finding.fix.mechanical);
  });

  test('mechanical findings auto-fix silently and update the file', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\nconsole.log("debug");\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('review:scan', tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.summary.autofixed, 1);
    assert.strictEqual(output.findings[0].route, 'AUTO-FIX');
    assert.ok(!fs.readFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'utf-8').includes('console.log'));
  });

  test('failed mechanical fixes degrade to ASK instead of aborting review', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [{
      rule_id: 'debug-leftovers',
      path: 'src/tracked.js',
      line: 1,
      category: 'maintainability',
      severity: 'WARNING',
      confidence: 0.99,
      message: 'debug leftover',
      theme: 'debug-cleanup',
      fix: { kind: 'line-delete', line: 1, expected: 'not the real line', replacement: '', mechanical: true }
    }] }, null, 2));

    const result = runGsdTools(`review:scan --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.summary.autofixed, 0);
    assert.strictEqual(output.summary.asks, 1);
    assert.strictEqual(output.findings[0].route, 'ASK');
    assert.strictEqual(output.findings[0].route_reason, 'mechanical-fix-degraded');
  });

  test('low-confidence findings are suppressed and counted internally', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [{
      rule_id: 'trust-boundary',
      path: 'src/tracked.js',
      line: 1,
      category: 'security',
      severity: 'WARNING',
      confidence: 0.4,
      message: 'possible trust boundary',
      theme: 'trust-boundary',
      requires_judgment: true
    }] }, null, 2));

    const result = runGsdTools(`review:scan --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.findings.length, 0);
    assert.strictEqual(output.summary.suppressed, 1);
    assert.strictEqual(output.suppressed[0].suppressed_reason, 'confidence-threshold');
  });

  test('ask findings are grouped by theme while preserving individual findings', () => {
    const findingsPath = path.join(tmpDir, 'findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [
      {
        rule_id: 'trust-boundary',
        path: 'src/tracked.js',
        line: 1,
        category: 'security',
        severity: 'WARNING',
        confidence: 0.95,
        message: 'review trust boundary 1',
        theme: 'trust-boundary',
        requires_judgment: true
      },
      {
        rule_id: 'trust-boundary',
        path: 'src/tracked.js',
        line: 2,
        category: 'security',
        severity: 'WARNING',
        confidence: 0.95,
        message: 'review trust boundary 2',
        theme: 'trust-boundary',
        requires_judgment: true
      }
    ] }, null, 2));

    const result = runGsdTools(`review:scan --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(result.success, result.error);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.ask_groups.length, 1);
    assert.strictEqual(output.ask_groups[0].theme, 'trust-boundary');
    assert.strictEqual(output.ask_groups[0].findings.length, 2);
    assert.strictEqual(output.findings.filter(finding => finding.route === 'ASK').length, 2);
  });

  test('pretty output is severity-led and quiet on clean review results', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'tracked.js'), 'module.exports = 2;\n');
    execSync('git add src/tracked.js', { cwd: tmpDir, stdio: 'pipe' });

    const clean = runGsdToolsFull('review:scan --pretty', tmpDir);
    assert.ok(clean.success, clean.stderr);
    assert.ok(clean.stdout.includes('No findings in reviewed diff.'));
    assert.ok(!/success/i.test(clean.stdout));

    const findingsPath = path.join(tmpDir, 'pretty-findings.json');
    fs.writeFileSync(findingsPath, JSON.stringify({ findings: [{
      rule_id: 'trust-boundary',
      path: 'src/tracked.js',
      line: 1,
      category: 'security',
      severity: 'BLOCKER',
      confidence: 0.95,
      message: 'dangerous trust boundary',
      theme: 'trust-boundary',
      requires_judgment: true
    }] }, null, 2));

    const flagged = runGsdToolsFull(`review:scan --pretty --range HEAD~1...HEAD --findings-file ${findingsPath}`, tmpDir);
    assert.ok(flagged.success, flagged.stderr);
    assert.ok(flagged.stdout.includes('BLOCKER'));
    assert.ok(flagged.stdout.includes('[ASK] src/tracked.js:1'));
  });

  test('help is routed and documented', () => {
    const result = runGsdTools('review:scan --help', tmpDir);
    assert.ok(result.success, result.error);
  });
});
