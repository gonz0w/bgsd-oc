const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup, runGsdTools, runGsdToolsFull } = require('./helpers.cjs');

function writePlan(tmpDir, phaseDirName, fileName, content) {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseDirName);
  fs.mkdirSync(phaseDir, { recursive: true });
  const planPath = path.join(phaseDir, fileName);
  fs.writeFileSync(planPath, content);
  return planPath;
}

function writeFile(tmpDir, relativePath, content) {
  const fullPath = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function parseCommandJson(result) {
  const payload = result.stdout || result.output;
  assert.ok(payload, `expected command JSON output, got: ${JSON.stringify(result)}`);
  return JSON.parse(payload);
}

test.describe('verifier metadata truthfulness', () => {
  let tmpDir;

  test.beforeEach(() => {
    tmpDir = createTempProject();
  });

  test.afterEach(() => {
    cleanup(tmpDir);
  });

  test('verify:verify artifacts accepts nested, inline-array, and plain-string artifact metadata', () => {
    writeFile(tmpDir, 'src/nested.js', 'module.exports = { nested: true };\n');
    writeFile(tmpDir, 'src/inline.js', 'module.exports = { inline: true };\n');
    writeFile(tmpDir, 'tests/inline.test.cjs', 'test("inline", () => {});\n');
    writeFile(tmpDir, 'src/plain.js', 'module.exports = { plain: true };\n');

    const nestedPlan = writePlan(tmpDir, '164-truthfulness', '164-01-PLAN.md', `---
phase: 164-truthfulness
plan: 01
must_haves:
  artifacts:
    - path: src/nested.js
      contains: nested: true
---
`);
    const inlinePlan = writePlan(tmpDir, '164-truthfulness', '164-02-PLAN.md', `---
phase: 164-truthfulness
plan: 02
must_haves:
  artifacts: [src/inline.js, tests/inline.test.cjs]
---
`);
    const plainPlan = writePlan(tmpDir, '164-truthfulness', '164-03-PLAN.md', `---
phase: 164-truthfulness
plan: 03
must_haves:
  artifacts: src/plain.js
---
`);

    const nested = parseCommandJson(runGsdTools(`verify:verify artifacts ${nestedPlan}`, tmpDir));
    const inline = parseCommandJson(runGsdTools(`verify:verify artifacts ${inlinePlan}`, tmpDir));
    const plain = parseCommandJson(runGsdTools(`verify:verify artifacts ${plainPlan}`, tmpDir));

    assert.strictEqual(nested.all_passed, true);
    assert.strictEqual(nested.total, 1);
    assert.strictEqual(inline.all_passed, true);
    assert.strictEqual(inline.total, 2);
    assert.deepStrictEqual(inline.artifacts.map((item) => item.path), ['src/inline.js', 'tests/inline.test.cjs']);
    assert.strictEqual(plain.all_passed, true);
    assert.strictEqual(plain.total, 1);
    assert.deepStrictEqual(plain.artifacts.map((item) => item.path), ['src/plain.js']);
  });

  test('verify:verify key-links accepts nested, inline-array, and plain-string link metadata', () => {
    writeFile(tmpDir, 'src/nested-link.js', "require('./router');\nconst x = 'src/router.js';\n");
    writeFile(tmpDir, 'src/inline-link.js', "const route = 'src/router.js';\n");
    writeFile(tmpDir, 'src/plain-link.js', "const route = 'src/router.js';\n");
    writeFile(tmpDir, 'src/router.js', 'module.exports = {};\n');

    const nestedPlan = writePlan(tmpDir, '164-links', '164-01-PLAN.md', `---
phase: 164-links
plan: 01
must_haves:
  key_links:
    - from: src/nested-link.js
      to: src/router.js
---
`);
    const inlinePlan = writePlan(tmpDir, '164-links', '164-02-PLAN.md', `---
phase: 164-links
plan: 02
must_haves:
  key_links: ["src/inline-link.js -> src/router.js via require('./inline-link')"]
---
`);
    const plainPlan = writePlan(tmpDir, '164-links', '164-03-PLAN.md', `---
phase: 164-links
plan: 03
must_haves:
  key_links: "src/plain-link.js -> src/router.js via require('./plain-link')"
---
`);

    const nested = parseCommandJson(runGsdTools(`verify:verify key-links ${nestedPlan}`, tmpDir));
    const inline = parseCommandJson(runGsdTools(`verify:verify key-links ${inlinePlan}`, tmpDir));
    const plain = parseCommandJson(runGsdTools(`verify:verify key-links ${plainPlan}`, tmpDir));

    assert.strictEqual(nested.all_verified, true);
    assert.strictEqual(nested.total, 1);
    assert.strictEqual(inline.all_verified, true);
    assert.strictEqual(inline.total, 1);
    assert.deepStrictEqual(inline.links.map((item) => ({ from: item.from, to: item.to })), [{ from: 'src/inline-link.js', to: 'src/router.js' }]);
    assert.strictEqual(plain.all_verified, true);
    assert.strictEqual(plain.total, 1);
    assert.deepStrictEqual(plain.links.map((item) => ({ from: item.from, to: item.to })), [{ from: 'src/plain-link.js', to: 'src/router.js' }]);
  });

  test('artifact and key-link verification distinguish missing metadata from inconclusive extraction', () => {
    const missingPlan = writePlan(tmpDir, '164-status', '164-01-PLAN.md', `---
phase: 164-status
plan: 01
must_haves:
  truths: ["only truths here"]
---
`);
    const inconclusivePlan = writePlan(tmpDir, '164-status', '164-02-PLAN.md', `---
phase: 164-status
plan: 02
must_haves:
  artifacts:
    - provides: verifier sees metadata but no path
  key_links:
    - via: verifier sees metadata but no endpoints
---
`);

    const missingArtifacts = parseCommandJson(runGsdToolsFull(`verify:verify artifacts ${missingPlan}`, tmpDir));
    const inconclusiveArtifacts = parseCommandJson(runGsdToolsFull(`verify:verify artifacts ${inconclusivePlan}`, tmpDir));
    const missingLinks = parseCommandJson(runGsdToolsFull(`verify:verify key-links ${missingPlan}`, tmpDir));
    const inconclusiveLinks = parseCommandJson(runGsdToolsFull(`verify:verify key-links ${inconclusivePlan}`, tmpDir));

    assert.strictEqual(missingArtifacts.status, 'missing');
    assert.match(missingArtifacts.error, /missing/i);
    assert.strictEqual(inconclusiveArtifacts.status, 'inconclusive');
    assert.match(inconclusiveArtifacts.error, /inconclusive|actionable/i);

    assert.strictEqual(missingLinks.status, 'missing');
    assert.match(missingLinks.error, /missing/i);
    assert.strictEqual(inconclusiveLinks.status, 'inconclusive');
    assert.match(inconclusiveLinks.error, /inconclusive|actionable/i);
  });

  test('verify:verify quality reuses the normalized contract and loud-fails inconclusive extraction', () => {
    writeFile(tmpDir, 'src/inline-quality.js', "const route = 'src/router.js';\nmodule.exports = {};\n");
    writeFile(tmpDir, 'src/plain-quality.js', "const route = 'src/router.js';\nmodule.exports = {};\n");
    writeFile(tmpDir, 'src/router.js', 'module.exports = {};\n');

    const inlinePlan = writePlan(tmpDir, '164-quality', '164-01-PLAN.md', `---
phase: 164-quality
plan: 01
must_haves:
  artifacts: [src/inline-quality.js]
  key_links: ["src/inline-quality.js -> src/router.js via require('./inline-quality')"]
---
`);
    const plainPlan = writePlan(tmpDir, '164-quality', '164-02-PLAN.md', `---
phase: 164-quality
plan: 02
must_haves:
  artifacts: src/plain-quality.js
  key_links: "src/plain-quality.js -> src/router.js via require('./plain-quality')"
---
`);
    const inconclusivePlan = writePlan(tmpDir, '164-quality', '164-03-PLAN.md', `---
phase: 164-quality
plan: 03
must_haves:
  artifacts:
    - provides: missing actionable artifact path
  key_links:
    - via: missing actionable link endpoints
---
`);

    const inline = parseCommandJson(runGsdTools(`verify:verify quality --plan ${inlinePlan}`, tmpDir));
    const plain = parseCommandJson(runGsdTools(`verify:verify quality --plan ${plainPlan}`, tmpDir));
    const inconclusive = parseCommandJson(runGsdTools(`verify:verify quality --plan ${inconclusivePlan}`, tmpDir));

    assert.strictEqual(inline.dimensions.must_haves.score, 100);
    assert.strictEqual(inline.dimensions.must_haves.detail, '2/2 verified');
    assert.strictEqual(plain.dimensions.must_haves.score, 100);
    assert.strictEqual(plain.dimensions.must_haves.detail, '2/2 verified');

    assert.strictEqual(inconclusive.dimensions.must_haves.score, 0);
    assert.match(inconclusive.dimensions.must_haves.detail, /inconclusive|actionable/i);
    assert.notStrictEqual(inconclusive.dimensions.must_haves.detail, 'no must_haves defined');
  });
});
