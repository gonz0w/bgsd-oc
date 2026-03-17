/**
 * Integration tests for scaffold generators (Phase 136 Plans 02 & 03).
 * Tests plan:generate and verify:generate CLI commands end-to-end:
 * fresh generation, auto-numbering, idempotent merge, error handling,
 * and cross-command full idempotency.
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { runGsdTools, cleanup } = require('./helpers.cjs');

// ─── Test Project Setup ───────────────────────────────────────────────────────

/**
 * Extract JSON from CLI output that may contain banner lines.
 */
function extractJson(output) {
  const idx = output.indexOf('{');
  if (idx === -1) throw new Error('No JSON found in output: ' + output.substring(0, 200));
  return JSON.parse(output.slice(idx));
}

/**
 * Create a minimal temp project with .planning/ structure and ROADMAP.md.
 */
function createTestProject(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-scafgen-'));
  const planningDir = path.join(tmpDir, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  fs.mkdirSync(phasesDir, { recursive: true });

  // Init git repo (required by bgsd-tools)
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com" && git config user.name "Test"', {
    cwd: tmpDir,
    stdio: 'pipe',
    shell: true,
  });

  // ROADMAP.md with a test phase
  const roadmapContent = opts.roadmapContent || `# Project Roadmap

## Phases

- [ ] **Phase 50: Test Scaffold Phase**

### Phase 50: Test Scaffold Phase
**Goal**: Build a reusable test scaffold with marker support
**Depends on**: Nothing
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. User can run the test command and get output
  2. Test output contains marker sections

**Plans**: 2 plans
`;
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmapContent);

  // REQUIREMENTS.md
  const requirementsContent = opts.requirementsContent || `# Requirements: Test Project

## Test Requirements

### TEST — Test Phase

- [ ] **TEST-01:** User can run the test command and get output
- [ ] **TEST-02:** Test output contains marker sections

## Traceability

| REQ ID | Phase | Plan | Status |
|--------|-------|------|--------|
| TEST-01 | 50 | — | Pending |
| TEST-02 | 50 | — | Pending |
`;
  fs.writeFileSync(path.join(planningDir, 'REQUIREMENTS.md'), requirementsContent);

  // Create the phase directory if given a phase
  if (opts.phaseDir) {
    fs.mkdirSync(path.join(phasesDir, opts.phaseDir), { recursive: true });
  } else {
    fs.mkdirSync(path.join(phasesDir, '0050-test-scaffold-phase'), { recursive: true });
  }

  // Initial git commit
  execSync('git add -A && git commit -m "init: project setup"', {
    cwd: tmpDir,
    stdio: 'pipe',
    shell: true,
  });

  return tmpDir;
}

// ─── plan:generate tests ──────────────────────────────────────────────────────

describe('plan:generate — fresh generation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('generates PLAN.md at expected path', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.ok(json.created, 'created should be true');
    assert.ok(json.path, 'path should be present');
    assert.ok(fs.existsSync(json.path), 'PLAN.md should exist on disk');
  });

  it('auto-numbers the first plan as 01', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.strictEqual(json.plan, '01', 'First plan should be 01');
    assert.ok(json.path.includes('0050-01-PLAN.md'), `Path should contain 0050-01-PLAN.md, got: ${json.path}`);
  });

  it('has <!-- data --> markers on data sections', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('<!-- data -->'), 'Should have data markers');
    assert.ok(content.includes('<!-- /data -->'), 'Should have data end markers');
    assert.ok(json.sections.data >= 3, `Should have at least 3 data sections, got: ${json.sections.data}`);
  });

  it('has <!-- judgment --> markers on judgment sections', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('<!-- judgment -->'), 'Should have judgment markers');
    assert.ok(content.includes('<!-- /judgment -->'), 'Should have judgment end markers');
    assert.ok(json.sections.judgment >= 3, `Should have at least 3 judgment sections, got: ${json.sections.judgment}`);
  });

  it('pre-fills objective with phase goal from ROADMAP.md', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(
      content.includes('Build a reusable test scaffold with marker support'),
      'Objective should contain phase goal from ROADMAP.md'
    );
  });

  it('pre-fills requirements section with requirement descriptions', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('TEST-01'), 'Should include TEST-01 requirement');
    assert.ok(content.includes('TEST-02'), 'Should include TEST-02 requirement');
  });

  it('pre-fills frontmatter with requirements from ROADMAP.md', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    // Check frontmatter has requirements array
    assert.ok(content.includes('requirements:'), 'Frontmatter should have requirements');
    assert.ok(content.includes('TEST-01'), 'Frontmatter should have TEST-01');
  });

  it('includes context @references to ROADMAP.md and STATE.md', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('@.planning/ROADMAP.md'), 'Should reference ROADMAP.md');
    assert.ok(content.includes('@.planning/STATE.md'), 'Should reference STATE.md');
  });

  it('Tasks and Must-Haves sections have TODO markers (judgment)', () => {
    const result = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    // Judgment sections should have TODO
    assert.ok(content.includes('TODO:'), 'Should have TODO markers in judgment sections');
  });
});

// ─── plan:generate auto-numbering ────────────────────────────────────────────

describe('plan:generate — auto-numbering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('auto-numbers second plan as 02 when 01 already exists', () => {
    // Create first plan
    const result1 = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    assert.ok(result1.success, `First plan failed: ${result1.error || result1.output}`);

    // Create second plan (should auto-detect 01 exists and generate 02)
    const result2 = runGsdTools('plan:generate --phase 50 --raw', tmpDir);
    assert.ok(result2.success, `Second plan failed: ${result2.error || result2.output}`);
    const json2 = extractJson(result2.output);
    assert.strictEqual(json2.plan, '02', 'Second plan should be 02');
    assert.ok(json2.path.includes('0050-02-PLAN.md'), `Path should be 0050-02-PLAN.md, got: ${json2.path}`);
  });

  it('--plan flag overrides auto-detection', () => {
    const result = runGsdTools('plan:generate --phase 50 --plan 05 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.strictEqual(json.plan, '05', 'Plan should be 05 as specified');
    assert.ok(json.path.includes('0050-05-PLAN.md'), 'Path should contain specified plan number');
  });
});

// ─── plan:generate idempotent merge ──────────────────────────────────────────

describe('plan:generate — idempotent merge', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('preserves LLM-filled judgment section on re-run', () => {
    // Generate initial scaffold
    const result1 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    assert.ok(result1.success, `First generation failed: ${result1.error || result1.output}`);
    const json1 = extractJson(result1.output);

    // Simulate LLM filling the Tasks section (remove TODO, add real content)
    let content = fs.readFileSync(json1.path, 'utf8');
    content = content.replace(
      /<!-- judgment -->\nTODO: Break down the work.+?<!-- \/judgment -->/s,
      '<!-- judgment -->\n### Task 1: Implement the feature\n\n- **Type:** auto\n- **Files:** `src/feature.js`\n<!-- /judgment -->'
    );
    fs.writeFileSync(json1.path, content);

    // Re-run plan:generate on the same file
    const result2 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    assert.ok(result2.success, `Second generation failed: ${result2.error || result2.output}`);

    const mergedContent = fs.readFileSync(json1.path, 'utf8');
    assert.ok(
      mergedContent.includes('Task 1: Implement the feature'),
      'LLM-written task content should be preserved after re-run'
    );
    // Data section should be refreshed
    assert.ok(
      mergedContent.includes('Build a reusable test scaffold'),
      'Data section (objective) should still be present'
    );
  });

  it('replaces TODO judgment section with fresh content on re-run', () => {
    const result1 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    const json1 = extractJson(result1.output);
    const originalContent = fs.readFileSync(json1.path, 'utf8');

    // Re-run without editing (Tasks still has TODO)
    const result2 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    assert.ok(result2.success, `Re-run failed: ${result2.error || result2.output}`);
    const mergedContent = fs.readFileSync(json1.path, 'utf8');

    // TODO content should still be there (wasn't filled by LLM)
    assert.ok(mergedContent.includes('TODO:'), 'TODO judgment content should remain');
  });
});

// ─── plan:generate error handling ────────────────────────────────────────────

describe('plan:generate — error handling', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns error for missing --phase', () => {
    const result = runGsdTools('plan:generate --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.error, 'Should have error field');
  });

  it('returns error for phase not found', () => {
    const result = runGsdTools('plan:generate --phase 999 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.error, 'Should have error field for missing phase');
  });
});

// ─── verify:generate tests ────────────────────────────────────────────────────

describe('verify:generate — fresh generation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('generates VERIFICATION.md at expected path', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    assert.ok(json.created, 'created should be true');
    assert.ok(json.path, 'path should be present');
    assert.ok(fs.existsSync(json.path), 'VERIFICATION.md should exist on disk');
  });

  it('file is named <phase>-VERIFICATION.md', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.path.includes('0050-VERIFICATION.md'), `Path should contain 0050-VERIFICATION.md, got: ${json.path}`);
  });

  it('has <!-- data --> markers on pre-filled sections', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('<!-- data -->'), 'Should have data markers');
    assert.ok(json.sections.data >= 4, `Should have at least 4 data sections, got: ${json.sections.data}`);
  });

  it('has <!-- judgment --> markers on LLM-fill sections', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('<!-- judgment -->'), 'Should have judgment markers');
    assert.ok(json.sections.judgment >= 2, `Should have at least 2 judgment sections, got: ${json.sections.judgment}`);
  });

  it('frontmatter has status: pending', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('status: pending'), 'Frontmatter should have status: pending');
  });

  it('Observable Truths table contains success criteria from ROADMAP.md', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(
      content.includes('User can run the test command and get output'),
      'Observable Truths should contain ROADMAP.md success criteria'
    );
    assert.ok(
      content.includes('Test output contains marker sections'),
      'Observable Truths should contain all success criteria'
    );
    assert.ok(json.criteria_count >= 2, `criteria_count should be >= 2, got: ${json.criteria_count}`);
  });

  it('Requirements Coverage table has rows matching requirement IDs', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('TEST-01'), 'Requirements Coverage should have TEST-01');
    assert.ok(content.includes('TEST-02'), 'Requirements Coverage should have TEST-02');
    assert.strictEqual(json.requirement_count, 2, 'requirement_count should be 2');
  });

  it('Gaps Summary section has judgment marker with TODO', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('## Gaps Summary'), 'Should have Gaps Summary section');
    // Should be inside a judgment block
    const gapsSectionMatch = content.match(/## Gaps Summary\s*\n\s*<!-- judgment -->/);
    assert.ok(gapsSectionMatch, 'Gaps Summary should be a judgment section');
  });

  it('Result section has judgment marker with TODO', () => {
    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    assert.ok(content.includes('## Result'), 'Should have Result section');
    const resultSectionMatch = content.match(/## Result\s*\n\s*<!-- judgment -->/);
    assert.ok(resultSectionMatch, 'Result should be a judgment section');
  });
});

// ─── verify:generate — pre-fill from plan must-haves ─────────────────────────

describe('verify:generate — pre-fill from plan must-haves', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('Required Artifacts table includes artifacts from plan must-haves yaml block', () => {
    // Create a PLAN.md with must_haves in yaml block
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0050-test-scaffold-phase');
    const planContent = `---
phase: "0050"
plan: "01"
type: standard
requirements: [TEST-01]
depends_on: []
files_modified:
  - src/feature.js
wave: 1
---

# Plan 01: Feature Implementation

## Objective

Build the feature.

## Must-Haves

\`\`\`yaml
must_haves:
  truths:
    - "src/feature.js exports a working function"
  artifacts:
    - path: "src/feature.js"
      provides: "The main feature module"
    - path: "tests/feature.test.cjs"
      provides: "Unit tests for feature"
  key_links:
    - from: "src/feature.js"
      to: "src/router.js"
      via: "require('./feature')"
\`\`\`
`;
    fs.writeFileSync(path.join(phaseDir, '0050-01-PLAN.md'), planContent);

    const result = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error || result.output}`);
    const json = extractJson(result.output);
    const content = fs.readFileSync(json.path, 'utf8');
    // Artifacts from plan must-haves should appear
    assert.ok(content.includes('src/feature.js'), 'Required Artifacts should include src/feature.js');
    assert.ok(content.includes('tests/feature.test.cjs'), 'Required Artifacts should include test file');
    assert.ok(content.includes('src/router.js'), 'Key Links should include router.js');
  });
});

// ─── verify:generate — idempotent merge ──────────────────────────────────────

describe('verify:generate — idempotent merge', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('preserves LLM-filled Gaps Summary on re-run', () => {
    const result1 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json1 = extractJson(result1.output);

    // Simulate LLM filling Gaps Summary
    let content = fs.readFileSync(json1.path, 'utf8');
    content = content.replace(
      /<!-- judgment -->\nTODO: List any gaps.+?<!-- \/judgment -->/s,
      '<!-- judgment -->\nNo gaps found — all criteria verified.\n<!-- /judgment -->'
    );
    fs.writeFileSync(json1.path, content);

    // Re-run verify:generate
    const result2 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    assert.ok(result2.success, `Re-run failed: ${result2.error || result2.output}`);

    const mergedContent = fs.readFileSync(json1.path, 'utf8');
    assert.ok(
      mergedContent.includes('No gaps found — all criteria verified.'),
      'LLM-written Gaps Summary should be preserved'
    );
    // Data sections should still be present
    assert.ok(
      mergedContent.includes('User can run the test command'),
      'Observable Truths data section should still be present'
    );
  });

  it('refreshes Observable Truths on re-run (data section)', () => {
    const result1 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json1 = extractJson(result1.output);

    // Re-run (no edits to data sections)
    const result2 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json2 = extractJson(result2.output);
    const content = fs.readFileSync(json1.path, 'utf8');
    assert.ok(
      content.includes('User can run the test command and get output'),
      'Data section should still have criteria'
    );
  });
});

// ─── verify:generate — error handling ────────────────────────────────────────

describe('verify:generate — error handling', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('returns error for missing --phase', () => {
    const result = runGsdTools('verify:generate --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.error, 'Should have error field');
  });

  it('returns error for phase not found', () => {
    const result = runGsdTools('verify:generate --phase 999 --raw', tmpDir);
    const json = extractJson(result.output);
    assert.ok(json.error, 'Should have error field for missing phase');
  });
});

// ─── Full idempotency: both commands ─────────────────────────────────────────

describe('full idempotency — both commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTestProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('plan:generate produces identical output on re-run with unchanged source data', () => {
    const result1 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    const json1 = extractJson(result1.output);
    const content1 = fs.readFileSync(json1.path, 'utf8');

    // Re-run with same arguments
    const result2 = runGsdTools('plan:generate --phase 50 --plan 01 --raw', tmpDir);
    assert.ok(result2.success, `Re-run failed: ${result2.error || result2.output}`);
    const content2 = fs.readFileSync(json1.path, 'utf8');

    // Comparing: content should be identical (same TODO in judgment sections)
    // Note: we exclude any timestamp differences in frontmatter
    const normalizeContent = (c) => c.replace(/verified: \d{4}-\d{2}-\d{2}/, 'verified: DATE');
    assert.strictEqual(
      normalizeContent(content1),
      normalizeContent(content2),
      'plan:generate output should be byte-identical on re-run'
    );
  });

  it('verify:generate produces identical output on re-run with unchanged source data', () => {
    const result1 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    const json1 = extractJson(result1.output);
    const content1 = fs.readFileSync(json1.path, 'utf8');

    // Re-run with same arguments
    const result2 = runGsdTools('verify:generate --phase 50 --raw', tmpDir);
    assert.ok(result2.success, `Re-run failed: ${result2.error || result2.output}`);
    const content2 = fs.readFileSync(json1.path, 'utf8');

    const normalizeContent = (c) => c.replace(/verified: \d{4}-\d{2}-\d{2}/, 'verified: DATE');
    assert.strictEqual(
      normalizeContent(content1),
      normalizeContent(content2),
      'verify:generate output should be byte-identical on re-run'
    );
  });
});
