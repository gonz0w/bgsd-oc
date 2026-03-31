const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { cmdVerifyGenerate } = require('../src/commands/scaffold');
const {
  createPlanMetadataContext,
  readPlanMetadata,
  normalizeMustHaves,
} = require('../src/lib/plan-metadata');

function writePlan(tmpDir, phaseDirName, fileName, content) {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
  fs.mkdirSync(phaseDir, { recursive: true });
  const planPath = path.join(phaseDir, fileName);
  fs.writeFileSync(planPath, content);
  return planPath;
}

function captureStdout(run) {
  const originalWrite = process.stdout.write;
  let output = '';
  process.stdout.write = (chunk, encoding, callback) => {
    output += typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
    if (typeof callback === 'function') callback();
    return true;
  };
  try {
    run();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

test.describe('plan metadata normalization contract', () => {
  let tmpDir;

  test.beforeEach(() => {
    tmpDir = createTempProject();
  });

  test.afterEach(() => {
    cleanup(tmpDir);
  });

  test('normalizes nested blocks, inline arrays, and plain strings into one stable contract', () => {
    const nested = normalizeMustHaves({
      truths: ['nested truth'],
      artifacts: [{ path: 'src/nested.js', provides: 'nested module' }],
      key_links: [{ from: 'src/nested.js', to: 'src/router.js', via: "require('./nested')" }],
    });
    assert.strictEqual(nested.status, 'present');
    assert.deepStrictEqual(nested.truths.items.map((item) => item.text), ['nested truth']);
    assert.deepStrictEqual(nested.artifacts.items.map((item) => item.path), ['src/nested.js']);
    assert.deepStrictEqual(nested.keyLinks.items.map((item) => ({ from: item.from, to: item.to, via: item.via })), [
      { from: 'src/nested.js', to: 'src/router.js', via: "require('./nested')" },
    ]);

    const inline = normalizeMustHaves({
      truths: ['inline truth', 'second truth'],
      artifacts: ['src/inline.js', 'tests/inline.test.cjs'],
      key_links: ["src/inline.js -> src/router.js via require('./inline')"],
    });
    assert.strictEqual(inline.status, 'present');
    assert.deepStrictEqual(inline.truths.items.map((item) => item.text), ['inline truth', 'second truth']);
    assert.deepStrictEqual(inline.artifacts.items.map((item) => item.path), ['src/inline.js', 'tests/inline.test.cjs']);
    assert.deepStrictEqual(inline.keyLinks.items.map((item) => ({ from: item.from, to: item.to, via: item.via })), [
      { from: 'src/inline.js', to: 'src/router.js', via: "require('./inline')" },
    ]);

    const plain = normalizeMustHaves({
      truths: 'plain truth',
      artifacts: 'src/plain.js',
      key_links: "src/plain.js -> src/router.js via require('./plain')",
    });
    assert.strictEqual(plain.status, 'present');
    assert.deepStrictEqual(plain.truths.items.map((item) => item.text), ['plain truth']);
    assert.deepStrictEqual(plain.artifacts.items.map((item) => item.path), ['src/plain.js']);
    assert.deepStrictEqual(plain.keyLinks.items.map((item) => ({ from: item.from, to: item.to, via: item.via })), [
      { from: 'src/plain.js', to: 'src/router.js', via: "require('./plain')" },
    ]);
  });

  test('reuses cached plan metadata and workspace evidence inside one analysis pass', () => {
    const planPath = writePlan(tmpDir, '164-contract-test', '164-01-PLAN.md', `---
phase: 164-contract-test
plan: 01
must_haves:
  truths: ["cache truth"]
  artifacts: [src/cache.js]
  key_links: ["src/cache.js -> src/router.js"]
---
`);
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'cache.js'), 'module.exports = {}\n');

    let planReadCount = 0;
    let workspaceExistsCount = 0;
    let workspaceReadCount = 0;

    const context = createPlanMetadataContext({
      cwd: tmpDir,
      readFile(filePath) {
        planReadCount += 1;
        return fs.readFileSync(filePath, 'utf8');
      },
      workspace: {
        existsSync(filePath) {
          workspaceExistsCount += 1;
          return fs.existsSync(filePath);
        },
        readFile(filePath) {
          workspaceReadCount += 1;
          return fs.readFileSync(filePath, 'utf8');
        },
      },
    });

    const first = readPlanMetadata(planPath, { context });
    const second = readPlanMetadata(planPath, { context });
    assert.strictEqual(first.mustHaves.status, 'present');
    assert.strictEqual(second.mustHaves.status, 'present');
    assert.strictEqual(planReadCount, 1, 'plan metadata should be read once per analysis pass');

    const firstEvidence = context.workspace.get('src/cache.js');
    const secondEvidence = context.workspace.get('src/cache.js');
    assert.strictEqual(firstEvidence.exists, true);
    assert.strictEqual(secondEvidence.exists, true);
    assert.strictEqual(workspaceExistsCount, 1, 'workspace existence checks should be cached');
    assert.strictEqual(workspaceReadCount, 1, 'workspace content reads should be cached');
  });

  test('verify:generate reuses normalized frontmatter contract for string-style artifacts and key links', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n### Phase 50: Metadata Contract\n**Goal:** Verify must_haves normalization\n`);
    writePlan(tmpDir, '0050-metadata-contract', '0050-01-PLAN.md', `---
phase: "0050"
plan: "01"
type: execute
requirements: []
depends_on: []
files_modified:
  - src/feature.js
wave: 1
must_haves:
  truths: "feature ships"
  artifacts: [src/feature.js, tests/feature.test.cjs]
  key_links: ["src/feature.js -> src/router.js via require('./feature')"]
---

# Plan 01
`);

    const rawOutput = captureStdout(() => cmdVerifyGenerate(tmpDir, { phase: 50 }, true));
    const json = JSON.parse(rawOutput);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('src/feature.js'), 'generated verification should include normalized artifact paths');
    assert.ok(content.includes('tests/feature.test.cjs'), 'generated verification should include string artifact entries');
    assert.ok(content.includes('src/router.js'), 'generated verification should include parsed string key links');
  });
});
