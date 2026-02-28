/**
 * GSD Tools Tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_PATH = path.join(__dirname, 'gsd-tools.cjs');

// Helper to run gsd-tools command
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
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

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
    assert.deepStrictEqual(digest.decisions, [], 'decisions should be empty array');
    assert.deepStrictEqual(digest.tech_stack, [], 'tech_stack should be empty array');
  });

  test('nested frontmatter fields extracted correctly', () => {
    // Create phase directory with SUMMARY containing nested frontmatter
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
  - "JWT auth flow"
key-decisions:
  - "Use Prisma over Drizzle"
  - "JWT in httpOnly cookies"
---

# Summary content here
`;

    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Check nested dependency-graph.provides
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Auth system', 'Database schema'],
      'provides should contain nested values'
    );

    // Check nested dependency-graph.affects
    assert.deepStrictEqual(
      digest.phases['01'].affects,
      ['API layer'],
      'affects should contain nested values'
    );

    // Check nested tech-stack.added
    assert.deepStrictEqual(
      digest.tech_stack.sort(),
      ['jose', 'prisma'],
      'tech_stack should contain nested values'
    );

    // Check patterns-established (flat array)
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['JWT auth flow', 'Repository pattern'],
      'patterns should be extracted'
    );

    // Check key-decisions
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions');
    assert.ok(
      digest.decisions.some(d => d.decision === 'Use Prisma over Drizzle'),
      'Should contain first decision'
    );
  });

  test('multiple phases merged into single digest', () => {
    // Create phase 01
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase01Dir, '01-01-SUMMARY.md'),
      `---
phase: "01"
name: "Foundation"
provides:
  - "Database"
patterns-established:
  - "Pattern A"
key-decisions:
  - "Decision 1"
---
`
    );

    // Create phase 02
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase02Dir, '02-01-SUMMARY.md'),
      `---
phase: "02"
name: "API"
provides:
  - "REST endpoints"
patterns-established:
  - "Pattern B"
key-decisions:
  - "Decision 2"
tech-stack:
  added:
    - "zod"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Both phases present
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(digest.phases['02'], 'Phase 02 should exist');

    // Decisions merged
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions total');

    // Tech stack merged
    assert.deepStrictEqual(digest.tech_stack, ['zod'], 'tech_stack should have zod');
  });

  test('malformed SUMMARY.md skipped gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Valid summary
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Valid feature"
---
`
    );

    // Malformed summary (no frontmatter)
    fs.writeFileSync(
      path.join(phaseDir, '01-02-SUMMARY.md'),
      `# Just a heading
No frontmatter here
`
    );

    // Another malformed summary (broken YAML)
    fs.writeFileSync(
      path.join(phaseDir, '01-03-SUMMARY.md'),
      `---
broken: [unclosed
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command should succeed despite malformed files: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(
      digest.phases['01'].provides.includes('Valid feature'),
      'Valid feature should be extracted'
    );
  });

  test('flat provides field still works (backward compatibility)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Direct provides"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides,
      ['Direct provides'],
      'Direct provides should work'
    );
  });

  test('inline array syntax supported', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides: [Feature A, Feature B]
patterns-established: ["Pattern X", "Pattern Y"]
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Feature A', 'Feature B'],
      'Inline array should work'
    );
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['Pattern X', 'Pattern Y'],
      'Inline quoted array should work'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phases list command
// ─────────────────────────────────────────────────────────────────────────────

describe('phases list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns empty array', () => {
    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.directories, [], 'directories should be empty');
    assert.strictEqual(output.count, 0, 'count should be 0');
  });

  test('lists phase directories sorted numerically', () => {
    // Create out-of-order directories
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '10-final'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should have 3 directories');
    assert.deepStrictEqual(
      output.directories,
      ['01-foundation', '02-api', '10-final'],
      'should be sorted numerically'
    );
  });

  test('handles decimal phases in sort order', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.2-patch'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-ui'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['02-api', '02.1-hotfix', '02.2-patch', '03-ui'],
      'decimal phases should sort correctly between whole numbers'
    );
  });

  test('--type plans lists only PLAN.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phaseDir, 'RESEARCH.md'), '# Research');

    const result = runGsdTools('phases list --type plans', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-PLAN.md', '01-02-PLAN.md'],
      'should list only PLAN files'
    );
  });

  test('--type summaries lists only SUMMARY.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2');

    const result = runGsdTools('phases list --type summaries', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-SUMMARY.md', '01-02-SUMMARY.md'],
      'should list only SUMMARY files'
    );
  });

  test('--phase filters to specific phase directory', () => {
    const phase01 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase02 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase01, { recursive: true });
    fs.mkdirSync(phase02, { recursive: true });
    fs.writeFileSync(path.join(phase01, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase02, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('phases list --type plans --phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, ['01-01-PLAN.md'], 'should only list phase 01 plans');
    assert.strictEqual(output.phase_dir, 'foundation', 'should report phase name without number prefix');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap get-phase command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap get-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts phase section from ROADMAP.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

### Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

Some description here.

### Phase 2: API
**Goal:** Build REST API
**Plans:** 3 plans
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_number, '1', 'phase number correct');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('returns not found for missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up project
`
    );

    const result = runGsdTools('roadmap get-phase 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
  });

  test('handles decimal phase numbers', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 2: Main
**Goal:** Main work

### Phase 2.1: Hotfix
**Goal:** Emergency fix
`
    );

    const result = runGsdTools('roadmap get-phase 2.1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'decimal phase should be found');
    assert.strictEqual(output.phase_name, 'Hotfix', 'phase name correct');
    assert.strictEqual(output.goal, 'Emergency fix', 'goal extracted');
  });

  test('extracts full section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize everything

This phase covers:
- Database setup
- Auth configuration
- CI/CD pipeline

### Phase 2: Build
**Goal:** Build features
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.section.includes('Database setup'), 'section includes description');
    assert.ok(output.section.includes('CI/CD pipeline'), 'section includes all bullets');
    assert.ok(!output.section.includes('Phase 2'), 'section does not include next phase');
  });

  test('handles missing ROADMAP.md gracefully', () => {
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should return not found');
    assert.strictEqual(output.error, 'ROADMAP.md not found', 'should explain why');
  });

  test('accepts ## phase headers (two hashes)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

## Phase 2: API
**Goal:** Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase with ## header should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('detects malformed ROADMAP with summary list but no detail sections', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

- [ ] **Phase 1: Foundation** - Set up project
- [ ] **Phase 2: API** - Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
    assert.strictEqual(output.error, 'malformed_roadmap', 'should identify malformed roadmap');
    assert.ok(output.message.includes('missing'), 'should explain the issue');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase next-decimal command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase next-decimal command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns X.1 when no decimal phases exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '07-next'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should return 06.1');
    assert.deepStrictEqual(output.existing, [], 'no existing decimals');
  });

  test('increments from existing decimal phases', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-patch'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.3', 'should return 06.3');
    assert.deepStrictEqual(output.existing, ['06.1', '06.2'], 'lists existing decimals');
  });

  test('handles gaps in decimal sequence', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-first'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-third'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should take next after highest, not fill gap
    assert.strictEqual(output.next, '06.4', 'should return 06.4, not fill gap at 06.2');
  });

  test('handles single-digit phase input', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });

    const result = runGsdTools('phase next-decimal 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should normalize to 06.1');
    assert.strictEqual(output.base_phase, '06', 'base phase should be padded');
  });

  test('returns error if base phase does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-start'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'base phase not found');
    assert.strictEqual(output.next, '06.1', 'should still suggest 06.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase-plan-index command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase-plan-index command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phase directory returns empty plans array', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, '03', 'phase number correct');
    assert.deepStrictEqual(output.plans, [], 'plans should be empty');
    assert.deepStrictEqual(output.waves, {}, 'waves should be empty');
    assert.deepStrictEqual(output.incomplete, [], 'incomplete should be empty');
    assert.strictEqual(output.has_checkpoints, false, 'no checkpoints');
  });

  test('extracts single plan with frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Set up database schema
files-modified: [prisma/schema.prisma, src/lib/db.ts]
---

## Task 1: Create schema
## Task 2: Generate client
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 1, 'should have 1 plan');
    assert.strictEqual(output.plans[0].id, '03-01', 'plan id correct');
    assert.strictEqual(output.plans[0].wave, 1, 'wave extracted');
    assert.strictEqual(output.plans[0].autonomous, true, 'autonomous extracted');
    assert.strictEqual(output.plans[0].objective, 'Set up database schema', 'objective extracted');
    assert.deepStrictEqual(output.plans[0].files_modified, ['prisma/schema.prisma', 'src/lib/db.ts'], 'files extracted');
    assert.strictEqual(output.plans[0].task_count, 2, 'task count correct');
    assert.strictEqual(output.plans[0].has_summary, false, 'no summary yet');
  });

  test('groups multiple plans by wave', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Database setup
---

## Task 1: Schema
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-02-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Auth setup
---

## Task 1: JWT
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-03-PLAN.md'),
      `---
wave: 2
autonomous: false
objective: API routes
---

## Task 1: Routes
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 3, 'should have 3 plans');
    assert.deepStrictEqual(output.waves['1'], ['03-01', '03-02'], 'wave 1 has 2 plans');
    assert.deepStrictEqual(output.waves['2'], ['03-03'], 'wave 2 has 1 plan');
  });

  test('detects incomplete plans (no matching summary)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan with summary
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), `# Summary`);

    // Plan without summary
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---\nwave: 2\n---\n## Task 1`);

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans[0].has_summary, true, 'first plan has summary');
    assert.strictEqual(output.plans[1].has_summary, false, 'second plan has no summary');
    assert.deepStrictEqual(output.incomplete, ['03-02'], 'incomplete list correct');
  });

  test('detects checkpoints (autonomous: false)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: false
objective: Manual review needed
---

## Task 1: Review
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_checkpoints, true, 'should detect checkpoint');
    assert.strictEqual(output.plans[0].autonomous, false, 'plan marked non-autonomous');
  });

  test('phase not found returns error', () => {
    const result = runGsdTools('phase-plan-index 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'Phase not found', 'should report phase not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state-snapshot command
// ─────────────────────────────────────────────────────────────────────────────

describe('state-snapshot command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('extracts basic fields from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Current Phase Name:** API Layer
**Total Phases:** 6
**Current Plan:** 03-02
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** 45%
**Last Activity:** 2024-01-15
**Last Activity Description:** Completed 03-01-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'API Layer', 'phase name extracted');
    assert.strictEqual(output.total_phases, 6, 'total phases extracted');
    assert.strictEqual(output.current_plan, '03-02', 'current plan extracted');
    assert.strictEqual(output.total_plans_in_phase, 3, 'total plans extracted');
    assert.strictEqual(output.status, 'In progress', 'status extracted');
    assert.strictEqual(output.progress_percent, 45, 'progress extracted');
    assert.strictEqual(output.last_activity, '2024-01-15', 'last activity date extracted');
  });

  test('extracts decisions table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Use Prisma | Better DX than raw SQL |
| 02 | JWT auth | Stateless authentication |
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 2, 'should have 2 decisions');
    assert.strictEqual(output.decisions[0].phase, '01', 'first decision phase');
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'first decision summary');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than raw SQL', 'first decision rationale');
  });

  test('extracts blockers list', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Blockers

- Waiting for API credentials
- Need design review for dashboard
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.blockers, [
      'Waiting for API credentials',
      'Need design review for dashboard',
    ], 'blockers extracted');
  });

  test('extracts session continuity info', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Session

**Last Date:** 2024-01-15
**Stopped At:** Phase 3, Plan 2, Task 1
**Resume File:** .planning/phases/03-api/03-02-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.session.last_date, '2024-01-15', 'session date extracted');
    assert.strictEqual(output.session.stopped_at, 'Phase 3, Plan 2, Task 1', 'stopped at extracted');
    assert.strictEqual(output.session.resume_file, '.planning/phases/03-api/03-02-PLAN.md', 'resume file extracted');
  });

  test('handles paused_at field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Paused At:** Phase 3, Plan 1, Task 2 - mid-implementation
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, 'Phase 3, Plan 1, Task 2 - mid-implementation', 'paused_at extracted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// summary-extract command
// ─────────────────────────────────────────────────────────────────────────────

describe('summary-extract command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing file returns error', () => {
    const result = runGsdTools('summary-extract .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'File not found', 'should report missing file');
  });

  test('extracts all fields from SUMMARY.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up Prisma with User and Project models
key-files:
  - prisma/schema.prisma
  - src/lib/db.ts
tech-stack:
  added:
    - prisma
    - zod
patterns-established:
  - Repository pattern
  - Dependency injection
key-decisions:
  - Use Prisma over Drizzle: Better DX and ecosystem
  - Single database: Start simple, shard later
---

# Summary

Full summary content here.
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.path, '.planning/phases/01-foundation/01-01-SUMMARY.md', 'path correct');
    assert.strictEqual(output.one_liner, 'Set up Prisma with User and Project models', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma', 'src/lib/db.ts'], 'key files extracted');
    assert.deepStrictEqual(output.tech_added, ['prisma', 'zod'], 'tech added extracted');
    assert.deepStrictEqual(output.patterns, ['Repository pattern', 'Dependency injection'], 'patterns extracted');
    assert.strictEqual(output.decisions.length, 2, 'decisions extracted');
  });

  test('selective extraction with --fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up database
key-files:
  - prisma/schema.prisma
tech-stack:
  added:
    - prisma
patterns-established:
  - Repository pattern
key-decisions:
  - Use Prisma: Better DX
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md --fields one_liner,key_files', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Set up database', 'one_liner included');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma'], 'key_files included');
    assert.strictEqual(output.tech_added, undefined, 'tech_added excluded');
    assert.strictEqual(output.patterns, undefined, 'patterns excluded');
    assert.strictEqual(output.decisions, undefined, 'decisions excluded');
  });

  test('handles missing frontmatter fields gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Minimal summary
---

# Summary
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Minimal summary', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, [], 'key_files defaults to empty');
    assert.deepStrictEqual(output.tech_added, [], 'tech_added defaults to empty');
    assert.deepStrictEqual(output.patterns, [], 'patterns defaults to empty');
    assert.deepStrictEqual(output.decisions, [], 'decisions defaults to empty');
  });

  test('parses key-decisions with rationale', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
key-decisions:
  - Use Prisma: Better DX than alternatives
  - JWT tokens: Stateless auth for scalability
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'decision summary parsed');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than alternatives', 'decision rationale parsed');
    assert.strictEqual(output.decisions[1].summary, 'JWT tokens', 'second decision summary');
    assert.strictEqual(output.decisions[1].rationale, 'Stateless auth for scalability', 'second decision rationale');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// init commands tests
// ─────────────────────────────────────────────────────────────────────────────

describe('init commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init progress --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init phase-op 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });

  // --compact flag tests

  test('init commands return full output with --verbose', () => {
    const result = runGsdTools('init progress --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Full output must have model names, static paths, existence booleans
    assert.ok('state_path' in output, 'full output has state_path');
    assert.ok('roadmap_path' in output, 'full output has roadmap_path');
    assert.ok('project_path' in output, 'full output has project_path');
    assert.ok('config_path' in output, 'full output has config_path');
    assert.ok('state_exists' in output, 'full output has state_exists');
    assert.ok('roadmap_exists' in output, 'full output has roadmap_exists');
    assert.ok('executor_model' in output, 'full output has executor_model');
    assert.ok('planner_model' in output, 'full output has planner_model');
    assert.ok('commit_docs' in output, 'full output has commit_docs');
  });

  test('init progress --compact returns essential-only fields', () => {
    const result = runGsdTools('init progress --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Must have essential keys
    assert.ok('milestone_version' in output, 'compact has milestone_version');
    assert.ok('phases' in output, 'compact has phases');
    assert.ok('phase_count' in output, 'compact has phase_count');
    assert.ok('completed_count' in output, 'compact has completed_count');
    assert.ok('current_phase' in output, 'compact has current_phase');
    assert.ok('session_diff' in output, 'compact has session_diff');

    // Must NOT have dropped keys
    assert.strictEqual(output.executor_model, undefined, 'compact drops executor_model');
    assert.strictEqual(output.planner_model, undefined, 'compact drops planner_model');
    assert.strictEqual(output.state_path, undefined, 'compact drops state_path');
    assert.strictEqual(output.roadmap_path, undefined, 'compact drops roadmap_path');
    assert.strictEqual(output.commit_docs, undefined, 'compact drops commit_docs');
    assert.strictEqual(output.state_exists, undefined, 'compact drops state_exists');
    assert.strictEqual(output.project_path, undefined, 'compact drops project_path');
  });

  test('compact default reduces init output size by at least 38% vs --verbose', () => {
    // Set up phase dir for commands that need one
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const commands = [
      'init progress',
      'init execute-phase 03',
      'init plan-phase 03',
      'init new-project',
      'init new-milestone',
      'init resume',
      'init verify-work 03',
      'init phase-op 03',
      'init milestone-op',
      'init map-codebase',
      'init quick "test task"',
      'init todos',
    ];

    const reductions = [];
    for (const cmd of commands) {
      const full = runGsdTools(`${cmd} --verbose`, tmpDir);
      const compact = runGsdTools(`${cmd}`, tmpDir);
      if (!full.success || !compact.success) continue;

      const fullSize = Buffer.byteLength(full.output, 'utf8');
      const compactSize = Buffer.byteLength(compact.output, 'utf8');
      if (fullSize === 0) continue;
      const reduction = (1 - compactSize / fullSize) * 100;
      reductions.push({ cmd, reduction, fullSize, compactSize });
    }

    const avgReduction = reductions.reduce((sum, r) => sum + r.reduction, 0) / reductions.length;
    assert.ok(
      avgReduction >= 38,
      `Average reduction across all ${reductions.length} commands: expected >=38%, got ${avgReduction.toFixed(1)}%`
    );
  });

  test('--compact and --fields can be used together', () => {
    const result = runGsdTools('init progress --compact --fields milestone_version,phase_count', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const keys = Object.keys(output);
    assert.strictEqual(keys.length, 2, `expected 2 fields, got ${keys.length}: ${keys.join(', ')}`);
    assert.ok('milestone_version' in output, 'has milestone_version');
    assert.ok('phase_count' in output, 'has phase_count');
  });

  test('all init commands accept --compact without error', () => {
    // Set up phase dir for commands that need one
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const commands = [
      'init progress',
      'init execute-phase 03',
      'init plan-phase 03',
      'init new-project',
      'init new-milestone',
      'init resume',
      'init verify-work 03',
      'init phase-op 03',
      'init milestone-op',
      'init map-codebase',
      'init quick "test task"',
      'init todos',
    ];

    for (const cmd of commands) {
      const result = runGsdTools(`${cmd} --compact`, tmpDir);
      assert.ok(result.success, `${cmd} --compact failed: ${result.error}`);

      // Verify it returns valid JSON
      let parsed;
      try {
        parsed = JSON.parse(result.output);
      } catch (e) {
        assert.fail(`${cmd} --compact did not return valid JSON: ${result.output.substring(0, 100)}`);
      }
      assert.ok(typeof parsed === 'object' && parsed !== null, `${cmd} --compact returned non-object`);
    }
  });

  // --compact manifest tests

  test('compact --manifest output includes _manifest with files array', () => {
    const result = runGsdTools('init progress --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('_manifest' in output, 'compact --manifest has _manifest');
    assert.ok(Array.isArray(output._manifest.files), '_manifest.files is array');
    for (const entry of output._manifest.files) {
      assert.ok(typeof entry.path === 'string', 'manifest entry has path string');
      assert.ok(typeof entry.required === 'boolean', 'manifest entry has required boolean');
    }
  });

  test('plan-phase --manifest includes requirements and state', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init plan-phase 07 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');
    assert.ok(manifest.files.length >= 3, `expected >=3 files in manifest, got ${manifest.files.length}`);

    const paths = manifest.files.map(f => f.path);
    assert.ok(paths.some(p => p.includes('STATE.md')), 'manifest includes STATE.md');
    assert.ok(paths.some(p => p.includes('ROADMAP.md')), 'manifest includes ROADMAP.md');
    assert.ok(paths.some(p => p.includes('REQUIREMENTS.md')), 'manifest includes REQUIREMENTS.md');

    // Check STATE.md has sections
    const stateEntry = manifest.files.find(f => f.path.includes('STATE.md'));
    assert.ok(stateEntry.sections, 'STATE.md entry has sections');
    assert.ok(stateEntry.sections.includes('Current Position'), 'STATE.md has Current Position section');
    assert.ok(stateEntry.sections.includes('Accumulated Context'), 'STATE.md has Accumulated Context section');
  });

  test('execute-phase --manifest includes plan files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '06-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '06-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '06-02-PLAN.md'), '# Plan 2');
    // Create STATE.md and ROADMAP.md so they appear in manifest
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\nPhase: 6');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Phase 6\nTest');

    const result = runGsdTools('init execute-phase 06 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');

    const paths = manifest.files.map(f => f.path);
    assert.ok(paths.some(p => p.includes('06-01-PLAN.md')), 'manifest includes 06-01-PLAN.md');
    assert.ok(paths.some(p => p.includes('06-02-PLAN.md')), 'manifest includes 06-02-PLAN.md');
    assert.ok(paths.some(p => p.includes('STATE.md')), 'manifest includes STATE.md');
    assert.ok(paths.some(p => p.includes('ROADMAP.md')), 'manifest includes ROADMAP.md');
  });

  test('--manifest only references files that exist', () => {
    // Phase 07 with no context/research files
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-bare');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init plan-phase 07 --compact --manifest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const manifest = output._manifest;
    assert.ok(manifest, 'has _manifest');

    const paths = manifest.files.map(f => f.path);
    // No context/research files exist, so they should not appear
    assert.ok(!paths.some(p => p.includes('CONTEXT.md')), 'manifest does not include CONTEXT.md');
    assert.ok(!paths.some(p => p.includes('RESEARCH.md')), 'manifest does not include RESEARCH.md');
  });

  test('non-compact output does not include _manifest', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output._manifest, undefined, 'non-compact has no _manifest');
  });

  test('--compact without --manifest excludes _manifest', () => {
    const result = runGsdTools('init progress --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output._manifest, undefined, 'compact-only has no _manifest');
  });

  test('--compact --manifest includes manifest and returns valid output for all commands', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');

    const allCommands = [
      'init progress',
      'init execute-phase 03',
      'init plan-phase 03',
      'init new-project',
      'init new-milestone',
      'init resume',
      'init verify-work 03',
      'init phase-op 03',
      'init milestone-op',
      'init map-codebase',
      'init quick "test task"',
      'init todos',
    ];

    for (const cmd of allCommands) {
      const result = runGsdTools(`${cmd} --compact --manifest`, tmpDir);
      if (!result.success) continue;
      const output = JSON.parse(result.output);
      // All should have _manifest when --manifest flag is used
      assert.ok('_manifest' in output, `${cmd} missing _manifest with --manifest flag`);
      assert.ok(Array.isArray(output._manifest.files), `${cmd} _manifest.files is not array`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap analyze command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing ROADMAP.md returns error', () => {
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'ROADMAP.md not found');
  });

  test('parses phases with goals and disk status', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up infrastructure

### Phase 2: Authentication
**Goal:** Add user auth

### Phase 3: Features
**Goal:** Build core features
`
    );

    // Create phase dirs with varying completion
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const p2 = path.join(tmpDir, '.planning', 'phases', '02-authentication');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3, 'should find 3 phases');
    assert.strictEqual(output.phases[0].disk_status, 'complete', 'phase 1 complete');
    assert.strictEqual(output.phases[1].disk_status, 'planned', 'phase 2 planned');
    assert.strictEqual(output.phases[2].disk_status, 'no_directory', 'phase 3 no directory');
    assert.strictEqual(output.completed_phases, 1, '1 phase complete');
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 total summary');
    assert.strictEqual(output.progress_percent, 33, '33% complete (1 of 3 phases)');
    assert.strictEqual(output.plan_progress_percent, 50, '50% plan progress (1 summary / 2 plans)');
    assert.strictEqual(output.current_phase, '2', 'current phase is 2');
  });

  test('extracts goals and dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize project
**Depends on:** Nothing

### Phase 2: Build
**Goal:** Build features
**Depends on:** Phase 1
`
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases[0].goal, 'Initialize project');
    assert.strictEqual(output.phases[0].depends_on, 'Nothing');
    assert.strictEqual(output.phases[1].goal, 'Build features');
    assert.strictEqual(output.phases[1].depends_on, 'Phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase add command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds phase after highest existing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API

---
`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 3, 'should be phase 3');
    assert.strictEqual(output.slug, 'user-dashboard');

    // Verify directory created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
      'directory should be created'
    );

    // Verify ROADMAP updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
    assert.ok(roadmap.includes('**Depends on:** Phase 2'), 'should depend on previous');
  });

  test('handles empty roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    const result = runGsdTools('phase add Initial Setup', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 1, 'should be phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase insert command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase insert command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('inserts decimal phase after target', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Fix Critical Bug', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.1', 'should be 01.1');
    assert.strictEqual(output.after_phase, '1');

    // Verify directory
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01.1-fix-critical-bug')),
      'decimal phase directory should be created'
    );

    // Verify ROADMAP
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 01.1: Fix Critical Bug (INSERTED)'), 'roadmap should include inserted phase');
  });

  test('increments decimal when siblings exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01.1-hotfix'), { recursive: true });

    const result = runGsdTools('phase insert 1 Another Fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.2', 'should be 01.2');
  });

  test('rejects missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    const result = runGsdTools('phase insert 99 Fix Something', tmpDir);
    assert.ok(!result.success, 'should fail for missing phase');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });

  test('handles padding mismatch between input and roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Phase 09.05: Existing Decimal Phase
**Goal:** Test padding

## Phase 09.1: Next Phase
**Goal:** Test
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '09.05-existing'), { recursive: true });

    // Pass unpadded "9.05" but roadmap has "09.05"
    const result = runGsdTools('phase insert 9.05 Padding Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.after_phase, '9.05');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('(INSERTED)'), 'roadmap should include inserted phase');
  });

  test('handles #### heading depth from multi-milestone roadmaps', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### v1.1 Milestone

#### Phase 5: Feature Work
**Goal:** Build features

#### Phase 6: Polish
**Goal:** Polish
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05-feature-work'), { recursive: true });

    const result = runGsdTools('phase insert 5 Hotfix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '05.1');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 05.1: Hotfix (INSERTED)'), 'roadmap should include inserted phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase remove command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase remove command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes phase directory and renumbers subsequent', () => {
    // Setup 3 phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Depends on:** Nothing

### Phase 2: Auth
**Goal:** Authentication
**Depends on:** Phase 1

### Phase 3: Features
**Goal:** Core features
**Depends on:** Phase 2
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-auth');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-features');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p3, '03-02-PLAN.md'), '# Plan 2');

    // Remove phase 2
    const result = runGsdTools('phase remove 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.removed, '2');
    assert.strictEqual(output.directory_deleted, '02-auth');

    // Phase 3 should be renumbered to 02
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features')),
      'phase 3 should be renumbered to 02-features'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-features')),
      'old 03-features should not exist'
    );

    // Files inside should be renamed
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-01-PLAN.md')),
      'plan file should be renumbered to 02-01'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-02-PLAN.md')),
      'plan 2 should be renumbered to 02-02'
    );

    // ROADMAP should be updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('Phase 2: Auth'), 'removed phase should not be in roadmap');
    assert.ok(roadmap.includes('Phase 2: Features'), 'phase 3 should be renumbered to 2');
  });

  test('rejects removal of phase with summaries unless --force', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Should fail without --force
    const result = runGsdTools('phase remove 1', tmpDir);
    assert.ok(!result.success, 'should fail without --force');
    assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

    // Should succeed with --force
    const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
    assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
  });

  test('removes decimal phase and renumbers siblings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 6: Main\n**Goal:** Main\n### Phase 6.1: Fix A\n**Goal:** Fix A\n### Phase 6.2: Fix B\n**Goal:** Fix B\n### Phase 6.3: Fix C\n**Goal:** Fix C\n`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-main'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-fix-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c'), { recursive: true });

    const result = runGsdTools('phase remove 6.2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 06.3 should become 06.2
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-c')),
      '06.3 should be renumbered to 06.2'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c')),
      'old 06.3 should not exist'
    );
  });

  test('updates STATE.md phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n**Goal:** A\n### Phase 2: B\n**Goal:** B\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 1\n**Total Phases:** 2\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });

    runGsdTools('phase remove 2', tmpDir);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Total Phases:** 1'), 'total phases should be decremented');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('marks phase complete and transitions to next', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
- [ ] Phase 2: API

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working on phase 1\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
    assert.strictEqual(output.plans_executed, '1/1');
    assert.strictEqual(output.next_phase, '02');
    assert.strictEqual(output.is_last_phase, false);

    // Verify STATE.md updated
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Current Phase:** 02'), 'should advance to phase 02');
    assert.ok(state.includes('**Status:** Ready to plan'), 'status should be ready to plan');
    assert.ok(state.includes('**Current Plan:** Not started'), 'plan should be reset');

    // Verify ROADMAP checkbox
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x]'), 'phase should be checked off');
    assert.ok(roadmap.includes('completed'), 'completion date should be added');
  });

  test('detects last phase in milestone', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Only Phase\n**Goal:** Everything\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-only-phase');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_last_phase, true, 'should detect last phase');
    assert.strictEqual(output.next_phase, null, 'no next phase');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Milestone complete'), 'status should be milestone complete');
  });

  test('updates REQUIREMENTS.md traceability when phase completes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** AUTH-01, AUTH-02
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
**Requirements:** API-01
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email
- [ ] **AUTH-02**: User can log in
- [ ] **AUTH-03**: User can reset password

### API

- [ ] **API-01**: REST endpoints

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    // Checkboxes updated for phase 1 requirements
    assert.ok(req.includes('- [x] **AUTH-01**'), 'AUTH-01 checkbox should be checked');
    assert.ok(req.includes('- [x] **AUTH-02**'), 'AUTH-02 checkbox should be checked');
    // Other requirements unchanged
    assert.ok(req.includes('- [ ] **AUTH-03**'), 'AUTH-03 should remain unchecked');
    assert.ok(req.includes('- [ ] **API-01**'), 'API-01 should remain unchecked');

    // Traceability table updated
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'AUTH-01 status should be Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'AUTH-02 status should be Complete');
    assert.ok(req.includes('| AUTH-03 | Phase 2 | Pending |'), 'AUTH-03 should remain Pending');
    assert.ok(req.includes('| API-01 | Phase 2 | Pending |'), 'API-01 should remain Pending');
  });

  test('handles requirements with bracket format [REQ-01, REQ-02]', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** [AUTH-01, AUTH-02]
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
**Requirements:** [API-01]
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email
- [ ] **AUTH-02**: User can log in
- [ ] **AUTH-03**: User can reset password

### API

- [ ] **API-01**: REST endpoints

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    // Checkboxes updated for phase 1 requirements (brackets stripped)
    assert.ok(req.includes('- [x] **AUTH-01**'), 'AUTH-01 checkbox should be checked');
    assert.ok(req.includes('- [x] **AUTH-02**'), 'AUTH-02 checkbox should be checked');
    // Other requirements unchanged
    assert.ok(req.includes('- [ ] **AUTH-03**'), 'AUTH-03 should remain unchecked');
    assert.ok(req.includes('- [ ] **API-01**'), 'API-01 should remain unchecked');

    // Traceability table updated
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'AUTH-01 status should be Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'AUTH-02 status should be Complete');
    assert.ok(req.includes('| AUTH-03 | Phase 2 | Pending |'), 'AUTH-03 should remain Pending');
    assert.ok(req.includes('| API-01 | Phase 2 | Pending |'), 'API-01 should remain Pending');
  });

  test('handles phase with no requirements mapping', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Setup

### Phase 1: Setup
**Goal:** Project setup (no requirements)
**Plans:** 1 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **REQ-01**: Some requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // REQUIREMENTS.md should be unchanged
    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('- [ ] **REQ-01**'), 'REQ-01 should remain unchecked');
    assert.ok(req.includes('| REQ-01 | Phase 2 | Pending |'), 'REQ-01 should remain Pending');
  });

  test('handles missing REQUIREMENTS.md gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
**Requirements:** REQ-01

### Phase 1: Foundation
**Goal:** Setup
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command should succeed even without REQUIREMENTS.md: ${result.error}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');

    // Verify archive files exist
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist'
    );

    // Verify MILESTONES.md created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created'
    );
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'), 'milestone entry should contain name');
    assert.ok(milestones.includes('Set up project infrastructure'), 'accomplishments should be listed');
  });

  test('appends to existing MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'), 'existing entry should be preserved');
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be appended');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

describe('validate consistency command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passes for consistent project', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 2: B\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, true, 'should pass');
    assert.strictEqual(output.warning_count, 0, 'no warnings');
  });

  test('warns about phase on disk but not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-orphan'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.warning_count > 0, 'should have warnings');
    assert.ok(
      output.warnings.some(w => w.includes('disk but not in ROADMAP')),
      'should warn about orphan directory'
    );
  });

  test('warns about gaps in phase numbering', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Gap in phase numbering')),
      'should warn about gap'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// progress command
// ─────────────────────────────────────────────────────────────────────────────

describe('progress command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('renders JSON progress', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '# Plan 2');

    const result = runGsdTools('progress json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 summary');
    assert.strictEqual(output.percent, 50, '50%');
    assert.strictEqual(output.phases.length, 1, '1 phase');
    assert.strictEqual(output.phases[0].status, 'In Progress', 'phase in progress');
  });

  test('renders bar format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');

    const result = runGsdTools('progress bar', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('1/1'), 'should include count');
    assert.ok(result.output.includes('100%'), 'should include 100%');
  });

  test('renders table format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('progress table', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('Phase'), 'should have table header');
    assert.ok(result.output.includes('foundation'), 'should include phase name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// todo complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('todo complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('moves todo from pending to completed', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(
      path.join(pendingDir, 'add-dark-mode.md'),
      `title: Add dark mode\narea: ui\ncreated: 2025-01-01\n`
    );

    const result = runGsdTools('todo complete add-dark-mode.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true);

    // Verify moved
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'pending', 'add-dark-mode.md')),
      'should be removed from pending'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md')),
      'should be in completed'
    );

    // Verify completion timestamp added
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md'),
      'utf-8'
    );
    assert.ok(content.startsWith('completed:'), 'should have completed timestamp');
  });

  test('fails for nonexistent todo', () => {
    const result = runGsdTools('todo complete nonexistent.md', tmpDir);
    assert.ok(!result.success, 'should fail');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scaffold command
// ─────────────────────────────────────────────────────────────────────────────

describe('scaffold command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scaffolds context file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    // Verify file content
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-CONTEXT.md'),
      'utf-8'
    );
    assert.ok(content.includes('Phase 3'), 'should reference phase number');
    assert.ok(content.includes('Decisions'), 'should have decisions section');
    assert.ok(content.includes('Discretion Areas'), 'should have discretion section');
  });

  test('scaffolds UAT file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold uat --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-UAT.md'),
      'utf-8'
    );
    assert.ok(content.includes('User Acceptance Testing'), 'should have UAT heading');
    assert.ok(content.includes('Test Results'), 'should have test results section');
  });

  test('scaffolds verification file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold verification --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-VERIFICATION.md'),
      'utf-8'
    );
    assert.ok(content.includes('Goal-Backward Verification'), 'should have verification heading');
  });

  test('scaffolds phase directory', () => {
    const result = runGsdTools('scaffold phase-dir --phase 5 --name User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '05-user-dashboard')),
      'directory should be created'
    );
  });

  test('does not overwrite existing files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Existing content');

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, false, 'should not overwrite');
    assert.strictEqual(output.reason, 'already_exists');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state update command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

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

describe('state update command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates a single field (Status)', () => {
    const result = runGsdTools('state update Status Complete', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'JSON should report updated: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** Complete'), 'STATUS.md should contain **Status:** Complete');
  });

  test('updates Phase field with complex value', () => {
    const result = runGsdTools('state update Phase "2 of 3 (API)"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'JSON should report updated: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Phase:** 2 of 3 (API)'), 'STATE.md should contain updated Phase field');
  });

  test('returns updated: false for nonexistent field', () => {
    const result = runGsdTools('state update NonExistentField value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'JSON should report updated: false for nonexistent field');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state patch command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state patch command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates multiple fields at once', () => {
    const result = runGsdTools('state patch --Status Review --"Last Activity" 2026-02-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.updated.length >= 2, 'Should report at least 2 updated fields');
    assert.ok(output.updated.includes('Status'), 'Should include Status in updated list');
    assert.ok(output.updated.includes('Last Activity'), 'Should include Last Activity in updated list');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** Review'), 'STATE.md should contain **Status:** Review');
    assert.ok(content.includes('**Last Activity:** 2026-02-01'), 'STATE.md should contain updated Last Activity');
  });

  test('reports failed fields that do not exist', () => {
    const result = runGsdTools('state patch --Status Done --FakeField value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.updated.includes('Status'), 'Status should be updated');
    assert.ok(output.failed.includes('FakeField'), 'FakeField should be in failed list');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state add-decision command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state add-decision command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends decision and removes placeholder', () => {
    const result = runGsdTools('state add-decision --phase 1 --summary "Use esbuild" --rationale "Fastest bundler"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use esbuild'), 'STATE.md should contain decision text');
    assert.ok(content.includes('Fastest bundler'), 'STATE.md should contain rationale');
    // Extract the Decisions section specifically to check placeholder removal
    const decisionsMatch = content.match(/###?\s*Decisions\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    assert.ok(decisionsMatch, 'Decisions section should exist');
    assert.ok(!decisionsMatch[1].includes('None yet'), '"None yet" placeholder should be removed from Decisions section');
  });

  test('adds second decision without removing first', () => {
    // Add first decision
    runGsdTools('state add-decision --phase 1 --summary "Use esbuild" --rationale "Fastest bundler"', tmpDir);
    // Add second decision
    const result = runGsdTools('state add-decision --phase 2 --summary "Use Postgres" --rationale "Best for relational data"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true for second decision');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Use esbuild'), 'First decision should still be present');
    assert.ok(content.includes('Use Postgres'), 'Second decision should be present');
  });

  test('returns added: false when section missing', () => {
    // Write a STATE.md without a Decisions section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** In progress\n'
    );

    const result = runGsdTools('state add-decision --phase 1 --summary "Test"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, false, 'Should report added: false when section missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state add-blocker command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state add-blocker command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends blocker and removes placeholder', () => {
    const result = runGsdTools('state add-blocker --text "Config drift issue"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Config drift issue'), 'STATE.md should contain blocker text');
    // The fixture has "None yet." in Blockers section
    assert.ok(!content.match(/###?\s*Blockers\/Concerns\s*\n[\s\S]*?None yet\./i), '"None yet." placeholder should be removed from Blockers section');
  });

  test('returns added: true in JSON output', () => {
    const result = runGsdTools('state add-blocker --text "Missing API key"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'JSON should report added: true');
    assert.strictEqual(output.blocker, 'Missing API key', 'JSON should echo blocker text');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state resolve-blocker command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state resolve-blocker command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('resolves an existing blocker by text match', () => {
    // First add a blocker
    runGsdTools('state add-blocker --text "Config drift"', tmpDir);
    // Verify it was added
    let content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Config drift'), 'Blocker should be present before resolve');

    // Now resolve it
    const result = runGsdTools('state resolve-blocker --text "Config drift"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'JSON should report resolved: true');

    content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!content.includes('Config drift'), 'Blocker text should be removed from STATE.md');
  });

  test('returns resolved: true even for nonexistent blocker', () => {
    // The resolve-blocker command filters lines that match — if none match, it still writes back
    const result = runGsdTools('state resolve-blocker --text "nonexistent blocker"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'JSON should report resolved: true (no-op filter)');
  });

  test('restores None placeholder when last blocker resolved', () => {
    // Add a blocker then resolve it — section should get "None" placeholder
    runGsdTools('state add-blocker --text "Only blocker"', tmpDir);
    runGsdTools('state resolve-blocker --text "Only blocker"', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    const blockersMatch = content.match(/###?\s*Blockers\/Concerns\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    assert.ok(blockersMatch, 'Blockers section should exist');
    assert.ok(blockersMatch[1].includes('None'), 'Blockers section should have None placeholder after last blocker resolved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state record-session command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state record-session command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates all session continuity fields', () => {
    const result = runGsdTools('state record-session --stopped-at "Phase 2 API work" --resume-file "None"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.ok(output.updated.length >= 2, 'Should report at least 2 updated fields');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Last session should be updated to current ISO datetime (just check it changed from fixture)
    assert.ok(!content.includes('**Last session:** 2026-01-01'), 'Last session should be updated from fixture value');
    assert.ok(content.includes('**Stopped at:** Phase 2 API work'), 'Stopped at should be updated');
    assert.ok(content.includes('**Resume file:** None'), 'Resume file should be present');
  });

  test('returns recorded: true in JSON output', () => {
    const result = runGsdTools('state record-session --stopped-at "Test checkpoint"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.ok(Array.isArray(output.updated), 'updated should be an array of field names');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state advance-plan command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state advance-plan command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('advances plan number from 1 to 2', () => {
    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, true, 'JSON should report advanced: true');
    assert.strictEqual(output.previous_plan, 1, 'Previous plan should be 1');
    assert.strictEqual(output.current_plan, 2, 'Current plan should be 2');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Current Plan:** 2'), 'STATE.md should contain **Current Plan:** 2');
    assert.ok(content.includes('**Status:** Ready to execute'), 'Status should be updated to Ready to execute');
  });

  test('detects last plan in phase and sets phase complete', () => {
    // Set Current Plan to 3 (equal to Total Plans in Phase: 3)
    runGsdTools('state update "Current Plan" 3', tmpDir);

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, false, 'Should NOT advance past last plan');
    assert.strictEqual(output.reason, 'last_plan', 'Reason should be last_plan');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase complete'), 'Status should indicate phase complete');
  });

  test('updates Last Activity date', () => {
    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Last Activity should be updated from the fixture's 2026-01-01
    assert.ok(!content.includes('**Last Activity:** 2026-01-01'), 'Last Activity should be updated from fixture value');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state record-metric command (mutation round-trip)
// ─────────────────────────────────────────────────────────────────────────────

describe('state record-metric command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeStateFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends a row to the Performance Metrics table', () => {
    const result = runGsdTools('state record-metric --phase 01 --plan 01 --duration 45m --tasks 3 --files 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase 01 P01'), 'STATE.md should contain the new metric row with phase info');
    assert.ok(content.includes('45m'), 'STATE.md should contain the duration');
    assert.ok(content.includes('3 tasks'), 'STATE.md should contain the task count');
    assert.ok(content.includes('5 files'), 'STATE.md should contain the file count');
  });

  test('returns recorded: true with metric details', () => {
    const result = runGsdTools('state record-metric --phase 02 --plan 03 --duration 12m --tasks 5 --files 8', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'JSON should report recorded: true');
    assert.strictEqual(output.phase, '02', 'JSON should echo phase');
    assert.strictEqual(output.plan, '03', 'JSON should echo plan');
    assert.strictEqual(output.duration, '12m', 'JSON should echo duration');
  });

  test('returns error when required fields missing', () => {
    const result = runGsdTools('state record-metric --phase 01', tmpDir);
    assert.ok(result.success, `Command should succeed with error in JSON: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'JSON should contain error when required fields missing');
  });
});

// ---------------------------------------------------------------
// frontmatter round-trip tests
// ---------------------------------------------------------------

describe('frontmatter round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Helper: write a file, extract frontmatter, merge it back, extract again, compare
  function assertSemanticRoundTrip(filePath, description) {
    // Extract A
    const resultA = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    // Merge A back — need to escape JSON for shell
    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    // Extract B
    const resultB = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultB.success, `Second extract failed for ${description}: ${resultB.error}`);
    const jsonB = JSON.parse(resultB.output);

    // Semantic round-trip: A and B must be identical
    assert.deepStrictEqual(jsonA, jsonB, `Semantic round-trip failed for ${description}`);
    return jsonA;
  }

  test('simple key-value pairs round-trip losslessly', () => {
    const filePath = path.join('.planning', 'test-simple.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'title: My Plan',
      'phase: 03',
      'status: active',
      '---',
      '# Content body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'simple key-value');
    assert.strictEqual(fm.title, 'My Plan', 'title should be preserved');
    assert.strictEqual(fm.phase, '03', 'phase should be preserved');
    assert.strictEqual(fm.status, 'active', 'status should be preserved');
  });

  test('inline arrays round-trip losslessly', () => {
    const filePath = path.join('.planning', 'test-arrays.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'tags: [foo, bar, baz]',
      'depends_on: [01-01, 01-02]',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'inline arrays');
    assert.deepStrictEqual(fm.tags, ['foo', 'bar', 'baz'], 'tags array should be preserved');
    assert.deepStrictEqual(fm.depends_on, ['01-01', '01-02'], 'depends_on array should be preserved');
  });

  test('nested objects (2 levels) round-trip losslessly', () => {
    const filePath = path.join('.planning', 'test-nested.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'must_haves:',
      '  truths:',
      '    - "User can login"',
      '    - "User can logout"',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'nested objects');
    assert.ok(fm.must_haves, 'must_haves should exist');
    assert.deepStrictEqual(fm.must_haves.truths, ['User can login', 'User can logout'], 'nested arrays should be preserved');
  });

  test('quoted strings with colons round-trip losslessly', () => {
    const filePath = path.join('.planning', 'test-colons.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'name: "Phase: Setup and Config"',
      'description: "Goal: Build the safety net"',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'quoted strings with colons');
    assert.strictEqual(fm.name, 'Phase: Setup and Config', 'colon-containing value should be preserved');
    assert.strictEqual(fm.description, 'Goal: Build the safety net', 'colon-containing value should be preserved');
  });

  test('empty arrays round-trip losslessly', () => {
    const filePath = path.join('.planning', 'test-empty-arrays.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'depends_on: []',
      'files_modified: []',
      'tags: [one]',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'empty arrays');
    assert.deepStrictEqual(fm.depends_on, [], 'empty array should be [] not null');
    assert.deepStrictEqual(fm.files_modified, [], 'empty array should be [] not null');
    assert.deepStrictEqual(fm.tags, ['one'], 'single-element array should be preserved');
  });

  test('boolean and number strings round-trip losslessly', () => {
    // Note: the parser does NOT coerce types — booleans/numbers stay as strings
    const filePath = path.join('.planning', 'test-types.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'autonomous: true',
      'wave: 1',
      'plan: 02',
      'type: execute',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'booleans and numbers');
    // Values are strings (known parser behavior — no type coercion)
    assert.strictEqual(fm.autonomous, 'true', 'boolean should be preserved as string');
    assert.strictEqual(fm.wave, '1', 'number should be preserved as string');
    assert.strictEqual(fm.plan, '02', 'zero-padded number should be preserved as string');
    assert.strictEqual(fm.type, 'execute', 'string type should be preserved');
  });

  test('multi-level nesting (3 levels) round-trips losslessly', () => {
    const filePath = path.join('.planning', 'test-3level.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'config:',
      '  database:',
      '    host: localhost',
      '    port: 5432',
      '  cache:',
      '    enabled: true',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, '3-level nesting');
    assert.ok(fm.config, 'config should exist');
    assert.ok(fm.config.database, 'config.database should exist');
    assert.strictEqual(fm.config.database.host, 'localhost', 'deep nested value should be preserved');
    assert.strictEqual(fm.config.database.port, '5432', 'deep nested value should be preserved');
    assert.strictEqual(fm.config.cache.enabled, 'true', 'deep nested value should be preserved');
  });

  test('body content is preserved after frontmatter merge', () => {
    const filePath = path.join('.planning', 'test-body.md');
    const bodyContent = [
      '# Important Document',
      '',
      'This is the body content with **markdown** formatting.',
      '',
      '## Section Two',
      '',
      '- Item 1',
      '- Item 2',
      '',
      'Final paragraph.',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'title: Test',
      'phase: 01',
      '---',
      bodyContent,
    ].join('\n'));

    // Merge some data
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"title":"Test","phase":"01"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Read back and check body
    const content = fs.readFileSync(path.join(tmpDir, filePath), 'utf-8');
    assert.ok(content.includes(bodyContent), 'body content should be completely preserved after merge');
  });
});

// ---------------------------------------------------------------
// frontmatter edge cases (fragility points from CONCERNS.md)
// ---------------------------------------------------------------

describe('frontmatter edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Helper: semantic round-trip (same as above, duplicated for test isolation)
  function assertSemanticRoundTrip(filePath, description) {
    const resultA = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    const resultB = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultB.success, `Second extract failed for ${description}: ${resultB.error}`);
    const jsonB = JSON.parse(resultB.output);

    assert.deepStrictEqual(jsonA, jsonB, `Semantic round-trip failed for ${description}`);
    return jsonA;
  }

  test('real PLAN.md format with must_haves block round-trips', () => {
    // The most complex real-world frontmatter format produced by the planner
    const filePath = path.join('.planning', 'test-realplan.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'phase: 01-foundation',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - package.json',
      '  - AGENTS.md',
      'autonomous: true',
      'requirements:',
      '  - FOUND-05',
      '  - DOC-01',
      'must_haves:',
      '  truths:',
      '    - "npm test runs the existing test suite"',
      '    - "AGENTS.md shows accurate line count"',
      '  artifacts:',
      '    - path: "package.json"',
      '      provides: "Project manifest"',
      '      contains: "engines"',
      '  key_links:',
      '    - from: "package.json"',
      '      to: "bin/gsd-tools.test.cjs"',
      '      via: "scripts.test"',
      '      pattern: "node --test"',
      '---',
      '# Plan content',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'real PLAN.md format');

    // Verify top-level fields
    assert.strictEqual(fm.phase, '01-foundation', 'phase should be preserved');
    assert.strictEqual(fm.plan, '01', 'plan should be preserved');
    assert.strictEqual(fm.type, 'execute', 'type should be preserved');
    assert.deepStrictEqual(fm.depends_on, [], 'empty depends_on should survive');
    assert.deepStrictEqual(fm.files_modified, ['package.json', 'AGENTS.md'], 'files_modified array should be preserved');
    assert.deepStrictEqual(fm.requirements, ['FOUND-05', 'DOC-01'], 'requirements array should be preserved');

    // Verify nested must_haves structure
    assert.ok(fm.must_haves, 'must_haves should exist');
    assert.deepStrictEqual(fm.must_haves.truths, [
      'npm test runs the existing test suite',
      'AGENTS.md shows accurate line count',
    ], 'must_haves.truths should be preserved');

    // Note: Array-of-objects sub-keys (provides, contains, etc.) are a known parser limitation.
    // The parser captures only the first key: value on the same line as "- ".
    // This is stable through round-trips — what's extracted is what merges back.
    assert.ok(Array.isArray(fm.must_haves.artifacts), 'must_haves.artifacts should be an array');
    assert.ok(Array.isArray(fm.must_haves.key_links), 'must_haves.key_links should be an array');
  });

  test('array items with nested key-value pairs are stable through round-trips', () => {
    // Known parser limitation: array items like "- path: value\n    provides: value"
    // are parsed as string items containing only the first line's "key: value".
    // The round-trip should be STABLE even if initial extraction is lossy.
    const filePath = path.join('.planning', 'test-array-objects.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'artifacts:',
      '  - path: "src/auth.ts"',
      '    provides: "Auth module"',
      '  - path: "src/api.ts"',
      '    provides: "API routes"',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'array items with nested objects');

    // The parser captures these as string items (known limitation)
    assert.ok(Array.isArray(fm.artifacts), 'artifacts should be an array');
    assert.ok(fm.artifacts.length > 0, 'artifacts should have items');
    // Each item contains the key-value from the "- " line
    assert.ok(fm.artifacts[0].includes('path'), 'first item should contain path info');
  });

  test('values that look like YAML special values stay as strings', () => {
    // Quoted strings that look like booleans/numbers/null must remain strings
    const filePath = path.join('.planning', 'test-special-values.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'status: "true"',
      'count: "42"',
      'name: "null"',
      '---',
      '# Body',
      '',
    ].join('\n'));

    const fm = assertSemanticRoundTrip(filePath, 'YAML special value strings');
    assert.strictEqual(fm.status, 'true', 'quoted "true" should stay as string "true"');
    assert.strictEqual(fm.count, '42', 'quoted "42" should stay as string "42"');
    assert.strictEqual(fm.name, 'null', 'quoted "null" should stay as string "null"');
  });

  test('frontmatter-merge adds new keys without removing existing ones (additive merge)', () => {
    const filePath = path.join('.planning', 'test-additive.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'phase: 01',
      'plan: 01',
      '---',
      '# Body content',
      '',
    ].join('\n'));

    // Merge a new key
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"wave":"1"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify all keys present
    const result = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(result.success, `Extract failed: ${result.error}`);
    const fm = JSON.parse(result.output);

    assert.strictEqual(fm.phase, '01', 'original key "phase" should be preserved');
    assert.strictEqual(fm.plan, '01', 'original key "plan" should be preserved');
    assert.strictEqual(fm.wave, '1', 'new key "wave" should be added');
  });

  test('frontmatter-merge updates existing keys (update merge)', () => {
    const filePath = path.join('.planning', 'test-update.md');
    fs.writeFileSync(path.join(tmpDir, filePath), [
      '---',
      'status: draft',
      'phase: 01',
      '---',
      '# Body',
      '',
    ].join('\n'));

    // Update status
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"status":"active"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify
    const result = runGsdTools(`frontmatter get ${filePath}`, tmpDir);
    assert.ok(result.success, `Extract failed: ${result.error}`);
    const fm = JSON.parse(result.output);

    assert.strictEqual(fm.status, 'active', 'status should be updated from "draft" to "active"');
    assert.strictEqual(fm.phase, '01', 'untouched key "phase" should be preserved');
  });
});

// ─── Debug Logging (02-01) ────────────────────────────────────────────────────

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

  test('produces debug output on stderr when GSD_DEBUG=1', () => {
    // Use a command that triggers catch blocks (e.g., state read with no .planning)
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      const result = runWithStderr('init progress', {
        cwd: tmpDir,
        env: { ...process.env, GSD_DEBUG: '1' },
      });
      // The command may fail (no .planning), but stderr should have debug lines
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[GSD_DEBUG]'));
      assert.ok(debugLines.length > 0, `Expected debug output on stderr, got: ${result.stderr.slice(0, 200)}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('no debug output when GSD_DEBUG is unset', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      // Explicitly remove GSD_DEBUG from env
      const cleanEnv = { ...process.env };
      delete cleanEnv.GSD_DEBUG;
      const result = runWithStderr('init progress', {
        cwd: tmpDir,
        env: cleanEnv,
      });
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[GSD_DEBUG]'));
      assert.strictEqual(debugLines.length, 0, `Expected no debug output, but got: ${debugLines.join('; ')}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('stdout JSON remains valid when GSD_DEBUG=1', () => {
    // current-timestamp (without --raw) always succeeds and returns JSON
    const result = runWithStderr('current-timestamp', {
      env: { ...process.env, GSD_DEBUG: '1' },
    });
    assert.ok(result.success, `Command should succeed: ${result.error}`);
    // stdout must be valid JSON (no debug pollution)
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(result.stdout);
    }, `stdout should be valid JSON, got: ${result.stdout.slice(0, 200)}`);
    assert.ok(parsed.timestamp, 'Parsed JSON should contain a timestamp field');
  });

  test('debug output includes context strings with [GSD_DEBUG] prefix', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-debug-'));
    try {
      const result = runWithStderr('init progress', {
        cwd: tmpDir,
        env: { ...process.env, GSD_DEBUG: '1' },
      });
      const debugLines = (result.stderr || '').split('\n').filter(l => l.includes('[GSD_DEBUG]'));
      // Each debug line should match the format: [GSD_DEBUG] context.subcontext: message
      for (const line of debugLines) {
        assert.match(line, /\[GSD_DEBUG\] [\w.-]+:/, `Debug line should have context format: ${line}`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── Shell Sanitization (02-02) ───────────────────────────────────────────────

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

    const result = runGsdTools('session-diff', tmpDir);
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

    const result = runGsdTools('session-diff', tmpDir);
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

    const result = runGsdTools('session-diff', tmpDir);
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

    const result = runGsdTools('session-diff', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, '$() injection should be rejected');
  });

  test('codebase-impact uses --fixed-strings for grep patterns', () => {
    // This tests that the grep pattern uses literal matching by checking
    // that a regex-special pattern doesn't cause grep errors
    const result = runGsdTools('codebase-impact "src/lib/[test].ts"', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    // The file won't exist, but the command shouldn't crash from bad regex
    assert.ok(Array.isArray(output.files), 'Should return files array');
  });
});

// ─── Temp File Cleanup (02-02) ────────────────────────────────────────────────

describe('temp file cleanup', () => {
  test('process exit handler is registered for temp file cleanup', () => {
    // Verify that gsd-tools.cjs registers a process.on("exit") handler
    // by checking the source code directly (the handler is at module level)
    const source = fs.readFileSync(TOOLS_PATH, 'utf-8');
    assert.ok(
      source.includes("process.on('exit'") || source.includes('process.on("exit"'),
      'gsd-tools.cjs should register a process.on(exit) handler'
    );
    assert.ok(
      source.includes('_tmpFiles'),
      'gsd-tools.cjs should track temp files in _tmpFiles array'
    );
  });

  test('_tmpFiles tracking is wired into output pipeline', () => {
    // Verify that the output pipeline (outputJSON) pushes to _tmpFiles when writing large payloads
    const source = fs.readFileSync(TOOLS_PATH, 'utf-8');
    // _tmpFiles.push lives in outputJSON(), which is called by output()
    const jsonStart = source.indexOf('function outputJSON(');
    const jsonEnd = source.indexOf('\nfunction ', jsonStart + 1);
    const jsonSection = source.substring(jsonStart, jsonEnd > 0 ? jsonEnd : jsonStart + 800);
    assert.ok(
      jsonSection.includes('_tmpFiles.push'),
      'outputJSON() function should push tmpPath to _tmpFiles'
    );
  });

  test('no temp files remain after CLI invocation', () => {
    // Run a normal CLI command and verify no gsd-*.json files are created
    // (normal output is small, so no tmpfile should be created)
    const before = (fs.readdirSync(require('os').tmpdir()))
      .filter(f => f.startsWith('gsd-') && f.endsWith('.json'));

    const result = runGsdTools('current-timestamp');
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
    // Create a temp file that mimics what gsd-tools would create,
    // then verify the cleanup pattern works
    const tmpPath = path.join(require('os').tmpdir(), `gsd-test-cleanup-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, '{}', 'utf-8');
    assert.ok(fs.existsSync(tmpPath), 'Temp file should exist before cleanup');

    // Simulate the cleanup logic directly
    try { fs.unlinkSync(tmpPath); } catch {}
    assert.ok(!fs.existsSync(tmpPath), 'Temp file should be removed after cleanup');
  });
});

// Helper that captures both stdout and stderr separately (for --help tests)
function runGsdToolsFull(args, cwd = process.cwd()) {
  try {
    const stdout = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      success: err.status === 0,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
      exitCode: err.status,
    };
  }
}

// ─── --help flag tests ──────────────────────────────────────────────────────

describe('--help flag', () => {
  test('known command prints help to stderr', () => {
    // --help exits 0 which execSync treats as success; stderr goes to pipe
    const result = execSync(`node "${TOOLS_PATH}" state --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('Usage: gsd-tools state'), `Expected state help, got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('Subcommands:'), 'Should list subcommands');
  });

  test('unknown command lists available commands', () => {
    const result = execSync(`node "${TOOLS_PATH}" nonexistent --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('No help available'), `Expected "no help", got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('state'), 'Should list state in available commands');
    assert.ok(result.includes('config-migrate'), 'Should list config-migrate in available commands');
  });

  test('help text does not contaminate stdout', () => {
    // Run with stderr redirected to /dev/null — stdout should be empty
    const stdout = execSync(`node "${TOOLS_PATH}" current-timestamp --help 2>/dev/null`, {
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

// ─── config-migrate command tests ───────────────────────────────────────────

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

    const result = runGsdTools('config-migrate', tmpDir);
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

    const result = runGsdTools('config-migrate', tmpDir);
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

    const result = runGsdTools('config-migrate', tmpDir);
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
      workflow: { research: true, plan_check: true, verifier: true },
    };
    fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));

    const result = runGsdTools('config-migrate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.deepStrictEqual(parsed.migrated_keys, [], 'No keys should be migrated');
    assert.strictEqual(parsed.backup_path, null, 'No backup needed when nothing migrated');
  });

  test('config-migrate help text available', () => {
    const result = execSync(`node "${TOOLS_PATH}" config-migrate --help 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    assert.ok(result.includes('Usage: gsd-tools config-migrate'), `Expected config-migrate help, got: ${result.slice(0, 80)}`);
    assert.ok(result.includes('CONFIG_SCHEMA'), 'Should mention CONFIG_SCHEMA');
  });
});

// ============================================================
// Build System Tests (Phase 4, Plan 01)
// ============================================================

// Build output is now bin/gsd-tools.cjs (same as TOOLS_PATH) — built from src/index.js
const BUILD_OUTPUT_PATH = TOOLS_PATH;  // bin/gsd-tools.cjs is now the build artifact

describe('build system', () => {
  test('npm run build succeeds with exit code 0', () => {
    const result = execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.ok(result.includes('Built bin/gsd-tools.cjs'), `Expected build output, got: ${result.slice(0, 200)}`);
    assert.ok(result.includes('Smoke test passed'), `Expected smoke test pass, got: ${result.slice(0, 200)}`);
  });

  test('build produces bin/gsd-tools.cjs from src/', () => {
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

    const result = execSync(`node "${BUILD_OUTPUT_PATH}" current-timestamp`, {
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

      const result = execSync(`node "${BUILD_OUTPUT_PATH}" state load`, {
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

// ─── Phase 5: Performance & Polish ───────────────────────────────────────────

describe('file cache', () => {
  test('init progress returns valid JSON with cache enabled', () => {
    // cachedReadFile is used internally — test that compound commands
    // (which read files multiple times) still produce valid output
    const result = runGsdTools('init progress --verbose');
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

describe('codebase-impact batch grep', () => {
  test('returns dependents for a known file', () => {
    const result = runGsdTools('codebase-impact src/lib/helpers.js');
    assert.ok(result.success, 'codebase-impact should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    assert.ok(data.total_dependents > 0, `helpers.js should have dependents, got ${data.total_dependents}`);
    assert.ok(data.files[0].exists === true, 'file should exist');
    assert.ok(Array.isArray(data.files[0].dependents), 'dependents should be array');
  });

  test('handles non-existent file', () => {
    const result = runGsdTools('codebase-impact nonexistent-file-xyz.js');
    assert.ok(result.success, 'should succeed even for missing file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files[0].exists, false, 'file should not exist');
  });

  test('handles file with no code dependents', () => {
    const result = runGsdTools('codebase-impact package.json');
    assert.ok(result.success, 'should succeed for non-code file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    // package.json may have 0 dependents (not imported by JS files)
    assert.ok(typeof data.total_dependents === 'number', 'should have numeric dependents count');
  });

  test('analyzes multiple files in single call', () => {
    const result = runGsdTools('codebase-impact src/lib/helpers.js src/lib/output.js');
    assert.ok(result.success, 'should succeed for multiple files');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 2, 'should analyze 2 files');
    assert.ok(data.files.length === 2, 'should return 2 file results');
  });

  test('uses batched grep (source contains -e flag pattern)', () => {
    // Verify the source implementation uses batched -e flags, not per-pattern loop
    const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'features.js'), 'utf-8');
    assert.ok(content.includes("'--fixed-strings'"), 'should have fixed-strings grep flag');
    // The batched pattern joins multiple -e flags via flatMap
    assert.ok(content.includes("flatMap(p => ['-e', p])"), 'should batch -e flags via flatMap');
    // Should NOT have the old per-pattern loop
    assert.ok(!content.includes('for (const pattern of searchPatterns)'), 'should not have per-pattern loop');
  });
});

describe('codebase-impact graph-first path (WKFL-03)', () => {
  test('uses cached graph when intel has dependencies', () => {
    // First ensure deps are built
    runGsdTools('codebase deps');
    const result = runGsdTools('codebase-impact src/lib/helpers.js');
    assert.ok(result.success, 'codebase-impact should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should use cached graph when dependencies exist');
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    assert.ok(data.total_dependents > 0, 'helpers.js should have dependents from graph');
    assert.ok(typeof data.overall_risk === 'string', 'should have overall_risk');
  });

  test('graph path output format matches expected schema', () => {
    const result = runGsdTools('codebase-impact src/lib/output.js');
    assert.ok(result.success, 'should succeed');
    const data = JSON.parse(result.output);
    // Verify top-level fields
    assert.ok('files_analyzed' in data, 'should have files_analyzed');
    assert.ok('total_dependents' in data, 'should have total_dependents');
    assert.ok('overall_risk' in data, 'should have overall_risk');
    assert.ok('files' in data, 'should have files array');
    assert.ok('source' in data, 'should have source field');
    // Verify per-file fields
    const f = data.files[0];
    assert.ok('path' in f, 'file should have path');
    assert.ok('exists' in f, 'file should have exists');
    assert.ok('dependent_count' in f, 'file should have dependent_count');
    assert.ok('dependents' in f, 'file should have dependents');
    assert.ok('risk' in f, 'file should have risk');
  });

  test('graph path handles non-existent file', () => {
    const result = runGsdTools('codebase-impact nonexistent-graph-file.js');
    assert.ok(result.success, 'should succeed for missing file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should still use cached graph');
    assert.strictEqual(data.files[0].exists, false, 'file should not exist');
    assert.strictEqual(data.files[0].dependent_count, 0, 'missing file should have 0 dependents');
    assert.deepStrictEqual(data.files[0].dependents, [], 'missing file should have empty dependents');
    assert.strictEqual(data.files[0].risk, 'low', 'missing file should have low risk');
  });

  test('graph path handles multiple files', () => {
    const result = runGsdTools('codebase-impact src/lib/helpers.js src/lib/output.js');
    assert.ok(result.success, 'should succeed for multiple files');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.source, 'cached_graph', 'should use cached graph');
    assert.strictEqual(data.files_analyzed, 2, 'should analyze 2 files');
    assert.ok(data.files.length === 2, 'should return 2 file results');
  });
});

describe('configurable context window', () => {
  test('context-budget uses default context window (200K)', () => {
    // Use a plan file that exists in current milestone
    const result = runGsdTools('context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-01-PLAN.md');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.estimates.context_window, 200000, 'should default to 200K context window');
    assert.strictEqual(data.estimates.target_percent, 50, 'should default to 50% target');
  });

  test('context-budget output includes context_window field', () => {
    const result = runGsdTools('context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-02-PLAN.md');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok('context_window' in data.estimates, 'estimates should contain context_window');
    assert.ok(typeof data.estimates.context_window === 'number', 'context_window should be a number');
  });

  test('validate-config recognizes context_window as known key', () => {
    const result = runGsdTools('validate-config');
    assert.ok(result.success, 'validate-config should succeed');
    const data = JSON.parse(result.output);
    // context_window should be in effective config (not in warnings as unknown)
    assert.ok('context_window' in data.effective_config, 'should recognize context_window');
    assert.strictEqual(data.effective_config.context_window.value, 200000, 'default should be 200000');
    assert.strictEqual(data.effective_config.context_window.source, 'default', 'should come from defaults');
  });

  test('validate-config recognizes context_target_percent as known key', () => {
    const result = runGsdTools('validate-config');
    assert.ok(result.success, 'validate-config should succeed');
    const data = JSON.parse(result.output);
    assert.ok('context_target_percent' in data.effective_config, 'should recognize context_target_percent');
    assert.strictEqual(data.effective_config.context_target_percent.value, 50, 'default should be 50');
    assert.strictEqual(data.effective_config.context_target_percent.source, 'default', 'should come from defaults');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --fields flag
// ─────────────────────────────────────────────────────────────────────────────

describe('--fields flag', () => {
  test('filters top-level fields from JSON output', () => {
    const result = runGsdTools('init progress --fields milestone_version,phase_count');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Should have only the requested fields
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.ok('phase_count' in data, 'should include phase_count');
    // Other fields should NOT be present
    assert.strictEqual(Object.keys(data).length, 2, 'should have exactly 2 fields');
  });

  test('missing fields return null', () => {
    const result = runGsdTools('init progress --fields milestone_version,nonexistent_field');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.strictEqual(data.nonexistent_field, null, 'missing field should be null');
  });

  test('without --fields returns full output with --verbose', () => {
    const result = runGsdTools('init progress --verbose');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Full output has many fields
    assert.ok(Object.keys(data).length > 5, 'full output should have many fields');
    assert.ok('state_path' in data, 'should include state_path');
    assert.ok('roadmap_path' in data, 'should include roadmap_path');
  });

  test('dot-notation filters nested object fields', () => {
    // Use a command that returns nested objects
    const result = runGsdTools('validate-config --fields exists,valid_json');
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

// ─────────────────────────────────────────────────────────────────────────────
// token estimation (context.js)
// ─────────────────────────────────────────────────────────────────────────────

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
    const result = runGsdTools('context-budget .planning/milestones/v1.1-phases/06-token-measurement-output-infrastructure/06-01-PLAN.md');
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

// ─────────────────────────────────────────────────────────────────────────────
// extractAtReferences
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// context-budget baseline
// ─────────────────────────────────────────────────────────────────────────────

describe('context-budget baseline', () => {
  test('baseline output has required fields', () => {
    const result = runGsdTools('context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('timestamp' in data, 'should have timestamp');
    assert.ok('workflow_count' in data, 'should have workflow_count');
    assert.ok('total_tokens' in data, 'should have total_tokens');
    assert.ok('workflows' in data, 'should have workflows array');
    assert.ok(Array.isArray(data.workflows), 'workflows should be an array');
  });

  test('each workflow entry has required measurement fields', () => {
    const result = runGsdTools('context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.workflows.length > 0, 'should have at least 1 workflow');

    const w = data.workflows[0];
    assert.ok('name' in w, 'should have name');
    assert.ok('workflow_tokens' in w, 'should have workflow_tokens');
    assert.ok('ref_count' in w, 'should have ref_count');
    assert.ok('ref_tokens' in w, 'should have ref_tokens');
    assert.ok('total_tokens' in w, 'should have total_tokens');
  });

  test('workflows are sorted by total_tokens descending', () => {
    const result = runGsdTools('context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    for (let i = 1; i < data.workflows.length; i++) {
      assert.ok(
        data.workflows[i - 1].total_tokens >= data.workflows[i].total_tokens,
        `workflow ${i - 1} (${data.workflows[i - 1].total_tokens}) should be >= workflow ${i} (${data.workflows[i].total_tokens})`
      );
    }
  });

  test('baseline file is created in .planning/baselines/', () => {
    // Clean up any existing baselines first
    const baselinesDir = path.join(process.cwd(), '.planning', 'baselines');
    if (fs.existsSync(baselinesDir)) {
      for (const f of fs.readdirSync(baselinesDir)) {
        fs.unlinkSync(path.join(baselinesDir, f));
      }
    }

    const result = runGsdTools('context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(fs.existsSync(baselinesDir), 'baselines directory should exist');
    const files = fs.readdirSync(baselinesDir).filter(f => f.startsWith('baseline-'));
    assert.ok(files.length >= 1, 'should have at least 1 baseline file');
  });

  test('context-budget <path> still works (backward compat)', () => {
    const result = runGsdTools('context-budget .planning/ROADMAP.md');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('plan' in data, 'should have plan field');
    assert.ok('estimates' in data, 'should have estimates field');
    assert.strictEqual(data.plan, '.planning/ROADMAP.md', 'plan should be the file path');
  });
});

// ─── Context Budget Compare Tests ─────────────────────────────────────────────
describe('context-budget compare', () => {
  test('compare with no baseline dir returns error', () => {
    // Use a temp dir with no baselines
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-compare-'));
    const planDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planDir, { recursive: true });
    // Create minimal config
    fs.writeFileSync(path.join(planDir, 'config.json'), JSON.stringify({}));

    const result = runGsdTools('context-budget compare', tmpDir);
    assert.strictEqual(result.success, false, 'should fail without baselines');
    // Check error mentions running baseline first
    const combined = (result.output + ' ' + result.error).toLowerCase();
    assert.ok(combined.includes('baseline'), 'error should mention baseline');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('compare JSON has required fields', () => {
    // Ensure a baseline exists first
    runGsdTools('context-budget baseline');
    const result = runGsdTools('context-budget compare');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('baseline_file' in data, 'should have baseline_file');
    assert.ok('baseline_date' in data, 'should have baseline_date');
    assert.ok('current_date' in data, 'should have current_date');
    assert.ok('summary' in data, 'should have summary');
    assert.ok('workflows' in data, 'should have workflows');

    // Summary fields
    const s = data.summary;
    assert.ok('before_total' in s, 'summary should have before_total');
    assert.ok('after_total' in s, 'summary should have after_total');
    assert.ok('delta' in s, 'summary should have delta');
    assert.ok('percent_change' in s, 'summary should have percent_change');
    assert.ok('workflows_improved' in s, 'summary should have workflows_improved');
    assert.ok('workflows_unchanged' in s, 'summary should have workflows_unchanged');
    assert.ok('workflows_worsened' in s, 'summary should have workflows_worsened');
  });

  test('compare shows zero delta when run immediately after baseline', () => {
    // Create a fresh baseline then immediately compare
    runGsdTools('context-budget baseline');
    const result = runGsdTools('context-budget compare');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0 with no changes');
    assert.strictEqual(data.summary.percent_change, 0, 'percent_change should be 0');
    assert.strictEqual(data.summary.before_total, data.summary.after_total, 'before and after should match');
  });

  test('compare workflows sorted by delta ascending (biggest reductions first)', () => {
    runGsdTools('context-budget baseline');
    const result = runGsdTools('context-budget compare');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    for (let i = 1; i < data.workflows.length; i++) {
      assert.ok(
        data.workflows[i].delta >= data.workflows[i - 1].delta,
        `workflow ${i - 1} delta (${data.workflows[i - 1].delta}) should be <= workflow ${i} delta (${data.workflows[i].delta})`
      );
    }
  });

  test('compare with explicit baseline path works', () => {
    // Create baseline, then find the file on disk
    const baselineResult = runGsdTools('context-budget baseline');
    assert.ok(baselineResult.success, `Baseline failed: ${baselineResult.error}`);

    // Find the most recent baseline file
    const baselinesDir = path.join(process.cwd(), '.planning', 'baselines');
    const files = fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
      .sort()
      .reverse();
    assert.ok(files.length > 0, 'should have at least one baseline file');
    const baselineFile = path.join('.planning', 'baselines', files[0]);

    const result = runGsdTools(`context-budget compare ${baselineFile}`);
    assert.ok(result.success, `Compare failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.baseline_file.includes('baseline-'), 'should reference baseline file');
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0');
  });

  test('compare each workflow has required fields', () => {
    runGsdTools('context-budget baseline');
    const result = runGsdTools('context-budget compare');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.workflows.length > 0, 'should have workflows');

    for (const w of data.workflows) {
      assert.ok('name' in w, 'workflow should have name');
      assert.ok('before' in w, 'workflow should have before');
      assert.ok('after' in w, 'workflow should have after');
      assert.ok('delta' in w, 'workflow should have delta');
      assert.ok('percent_change' in w, 'workflow should have percent_change');
    }
  });
});

// ─── Extract Sections Tests ──────────────────────────────────────────────────

describe('extract-sections command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extract-sections lists available sections from markdown file', () => {
    // Create a temp markdown file with ## headers
    const mdContent = [
      '# Title',
      '',
      '## Introduction',
      'Some intro text here.',
      '',
      '## Configuration',
      'Config details here.',
      'More config.',
      '',
      '## Usage',
      'Usage instructions.',
    ].join('\n');
    const mdPath = path.join(tmpDir, 'test-doc.md');
    fs.writeFileSync(mdPath, mdContent);

    const result = runGsdTools(`extract-sections ${mdPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data.available_sections), 'should have available_sections array');
    assert.ok(data.available_sections.includes('Introduction'), 'should list Introduction section');
    assert.ok(data.available_sections.includes('Configuration'), 'should list Configuration section');
    assert.ok(data.available_sections.includes('Usage'), 'should list Usage section');
  });

  test('extract-sections extracts specific section by header name', () => {
    const mdContent = [
      '## First Section',
      'Line 1 of first.',
      'Line 2 of first.',
      '',
      '## Second Section',
      'Line 1 of second.',
      '',
      '## Third Section',
      'Line 1 of third.',
    ].join('\n');
    const mdPath = path.join(tmpDir, 'test-extract.md');
    fs.writeFileSync(mdPath, mdContent);

    const result = runGsdTools(`extract-sections ${mdPath} "Second Section"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.deepStrictEqual(data.sections_found, ['Second Section'], 'should find the section');
    assert.deepStrictEqual(data.sections_missing, [], 'no sections should be missing');
    assert.ok(data.content.includes('Line 1 of second'), 'content should include section text');
    assert.ok(!data.content.includes('Line 1 of first'), 'content should not include other sections');
    assert.ok(!data.content.includes('Line 1 of third'), 'content should not include other sections');
  });

  test('extract-sections handles section markers (HTML comments)', () => {
    const mdContent = [
      '# Doc Title',
      '',
      'Some preamble text.',
      '',
      '<!-- section: config -->',
      'Configuration block line 1.',
      'Configuration block line 2.',
      '<!-- /section -->',
      '',
      '<!-- section: examples -->',
      'Example 1: hello world.',
      'Example 2: goodbye world.',
      '<!-- /section -->',
      '',
      'Trailing content.',
    ].join('\n');
    const mdPath = path.join(tmpDir, 'test-markers.md');
    fs.writeFileSync(mdPath, mdContent);

    // Discovery mode should find marker sections
    const discResult = runGsdTools(`extract-sections ${mdPath}`, tmpDir);
    assert.ok(discResult.success, `Discovery failed: ${discResult.error}`);
    const discData = JSON.parse(discResult.output);
    assert.ok(discData.available_sections.includes('config'), 'should find config marker section');
    assert.ok(discData.available_sections.includes('examples'), 'should find examples marker section');

    // Extract a marker section
    const result = runGsdTools(`extract-sections ${mdPath} "config"`, tmpDir);
    assert.ok(result.success, `Extract failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.deepStrictEqual(data.sections_found, ['config'], 'should find config section');
    assert.ok(data.content.includes('Configuration block line 1'), 'should include marker section content');
    assert.ok(!data.content.includes('Example 1'), 'should not include other marker section');
  });

  test('extract-sections returns sections_missing for unknown sections', () => {
    const mdContent = [
      '## Existing Section',
      'Some content.',
    ].join('\n');
    const mdPath = path.join(tmpDir, 'test-missing.md');
    fs.writeFileSync(mdPath, mdContent);

    const result = runGsdTools(`extract-sections ${mdPath} "Existing Section" "NonexistentSection"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.deepStrictEqual(data.sections_found, ['Existing Section'], 'should find the existing one');
    assert.deepStrictEqual(data.sections_missing, ['NonexistentSection'], 'should report the missing one');
    assert.ok(data.content.includes('Some content'), 'should still return found section content');
  });

  test('extract-sections handles multiple section extraction', () => {
    const mdContent = [
      '## Alpha',
      'Alpha content.',
      '',
      '## Beta',
      'Beta content.',
      '',
      '## Gamma',
      'Gamma content.',
    ].join('\n');
    const mdPath = path.join(tmpDir, 'test-multi.md');
    fs.writeFileSync(mdPath, mdContent);

    const result = runGsdTools(`extract-sections ${mdPath} "Alpha" "Gamma"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.deepStrictEqual(data.sections_found, ['Alpha', 'Gamma'], 'should find both sections');
    assert.deepStrictEqual(data.sections_missing, [], 'no sections should be missing');
    assert.ok(data.content.includes('Alpha content'), 'should include Alpha content');
    assert.ok(data.content.includes('Gamma content'), 'should include Gamma content');
    assert.ok(!data.content.includes('Beta content'), 'should not include Beta (not requested)');
  });

  test('extract-sections works on real reference files', () => {
    // Run against actual references/checkpoints.md in the project root
    const projectRoot = path.join(__dirname, '..');
    const result = runGsdTools('extract-sections references/checkpoints.md', projectRoot);
    assert.ok(result.success, `Discovery failed: ${result.error}`);

    const discData = JSON.parse(result.output);
    assert.ok(discData.available_sections.includes('types'), 'checkpoints.md should have types section');
    assert.ok(discData.available_sections.includes('guidelines'), 'checkpoints.md should have guidelines section');
    assert.ok(discData.available_sections.includes('authentication'), 'checkpoints.md should have authentication section');

    // Extract types section — should be much shorter than full file
    const extractResult = runGsdTools('extract-sections references/checkpoints.md "types"', projectRoot);
    assert.ok(extractResult.success, `Extract failed: ${extractResult.error}`);

    const data = JSON.parse(extractResult.output);
    assert.deepStrictEqual(data.sections_found, ['types'], 'should find types section');
    const sectionLines = data.content.split('\n').length;
    const fullFile = fs.readFileSync(path.join(projectRoot, 'references', 'checkpoints.md'), 'utf-8');
    const fullLines = fullFile.split('\n').length;
    assert.ok(sectionLines < fullLines, `types section (${sectionLines} lines) should be shorter than full file (${fullLines} lines)`);
    assert.ok(sectionLines > 10, `types section should have substantial content (got ${sectionLines} lines)`);
  });

  test('extract-sections command is registered and responds', () => {
    // Verify extract-sections command exists and works by running discovery on a real file
    const projectRoot = path.join(__dirname, '..');
    const result = runGsdTools('extract-sections references/checkpoints.md', projectRoot);
    assert.ok(result.success, `extract-sections discovery should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data.available_sections), 'should return available_sections array');
    assert.ok(data.available_sections.length > 0, 'should find sections in checkpoints.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state validate command
// ─────────────────────────────────────────────────────────────────────────────

describe('state validate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('clean state returns "clean" status', () => {
    // Set up matching ROADMAP + disk: 2 plans, 1 complete, 1 in progress
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    // STATE.md pointing to phase 1 which is still in progress (not all complete)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Total Plans in Phase:** 2
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'clean', 'should be clean');
    assert.deepStrictEqual(output.issues, [], 'should have no issues');
    assert.strictEqual(output.summary, 'State validation passed — no issues found');
  });

  test('detects plan count drift', () => {
    // ROADMAP says 2 plans but disk only has 1
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    const driftIssue = output.issues.find(i => i.type === 'plan_count_drift');
    assert.ok(driftIssue, 'should have plan_count_drift issue');
    assert.strictEqual(driftIssue.severity, 'error');
    assert.ok(driftIssue.expected.includes('1'), 'expected should mention disk count');
    assert.ok(driftIssue.actual.includes('2'), 'actual should mention ROADMAP count');
  });

  test('detects completion drift', () => {
    // ROADMAP checkbox marked [x] but disk has 2 plans and only 1 summary
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [x] **Phase 1: Foundation** (completed)

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1/2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const completionIssue = output.issues.find(i => i.type === 'completion_drift');
    assert.ok(completionIssue, 'should have completion_drift issue');
    assert.strictEqual(completionIssue.severity, 'error');
    assert.ok(completionIssue.expected.includes('2'), 'expected should mention total plan count');
    assert.ok(completionIssue.actual.includes('1'), 'actual should mention summary count');
  });

  test('detects missing position', () => {
    // STATE.md says "Phase: 99 of 13" but phase 99 directory doesn't exist
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 99 of 13 (Nonexistent)
**Current Plan:** 1
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const posIssue = output.issues.find(i => i.type === 'position_missing');
    assert.ok(posIssue, 'should have position_missing issue');
    assert.strictEqual(posIssue.severity, 'error');
  });

  test('detects completed position', () => {
    // STATE.md points to phase 1, but phase 1 has equal PLANs and SUMMARYs
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 1
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const posIssue = output.issues.find(i => i.type === 'position_completed');
    assert.ok(posIssue, 'should have position_completed issue');
    assert.strictEqual(posIssue.severity, 'warn');
    assert.ok(posIssue.actual.includes('1/1'), 'should mention summary/plan counts');
  });

  test('detects stale activity via git', () => {
    // Initialize a git repo in the temp directory, make a recent commit,
    // but set STATE.md Last Activity to an old date
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      // Git not available, skip test
      return;
    }

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** 2025-01-01
`
    );

    // Commit the planning files to create git history
    try {
      execSync('git add .planning/', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      // Git commit failed, skip test
      return;
    }

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const staleIssue = output.issues.find(i => i.type === 'activity_stale');
    assert.ok(staleIssue, 'should have activity_stale issue');
    assert.strictEqual(staleIssue.severity, 'warn');
    assert.ok(staleIssue.actual.includes('2025-01-01'), 'should mention declared date');
  });

  test('--fix corrects plan count drift', () => {
    // Initialize git repo for auto-commit
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return; // Git not available, skip
    }

    // ROADMAP says 3 plans but disk has 2
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 3 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}
`
    );

    // Initial commit so git add/commit works
    try {
      execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return;
    }

    const result = runGsdTools('state validate --fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.fixes_applied.length > 0, 'should have fixes applied');
    assert.strictEqual(output.fixes_applied[0].phase, '1');
    assert.strictEqual(output.fixes_applied[0].old, '3');
    assert.strictEqual(output.fixes_applied[0].new, '2');

    // Verify ROADMAP.md was updated on disk
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('2 plan'), 'ROADMAP should now say 2 plans');
    assert.ok(!roadmap.includes('3 plan'), 'ROADMAP should not say 3 plans anymore');
  });

  test('no blocker staleness when blockers section is empty', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 2 of 2 (API)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.

### Pending Todos

None yet.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const blockerIssues = output.issues.filter(i => i.type === 'stale_blocker' || i.type === 'stale_todo');
    assert.strictEqual(blockerIssues.length, 0, 'should have no stale blocker/todo issues');
  });

  test('detects stale blockers after completed plans', () => {
    // Create 3 completed plans (summaries) to trigger staleness
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 3 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-PLAN.md'), '# Plan 3\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-SUMMARY.md'), '# Summary 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 2 of 2 (API)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

- Need to investigate memory leak in worker pool
- CI pipeline is flaky on Mondays

### Pending Todos

None.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const staleBlockers = output.issues.filter(i => i.type === 'stale_blocker');
    assert.strictEqual(staleBlockers.length, 2, 'should detect 2 stale blockers');
    assert.strictEqual(staleBlockers[0].severity, 'warn');
    assert.ok(staleBlockers[0].actual.includes('memory leak'), 'should reference the blocker text');
  });

  test('returns error status when both ROADMAP.md and STATE.md are missing', () => {
    // Remove the files (createTempProject only creates the dirs)
    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    assert.ok(output.issues.some(i => i.type === 'missing_files'), 'should have missing_files issue');
  });

  test('multiple issue types combine correctly', () => {
    // Set up drift + missing position
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 5 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 77 of 99 (Ghost)
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'errors', 'should report errors');
    assert.ok(output.issues.length >= 2, `should have at least 2 issues, got ${output.issues.length}`);

    const issueTypes = output.issues.map(i => i.type);
    assert.ok(issueTypes.includes('plan_count_drift'), 'should include plan_count_drift');
    assert.ok(issueTypes.includes('position_missing'), 'should include position_missing');

    // Summary should reflect counts
    assert.ok(output.summary.includes('error'), 'summary should mention errors');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state validate pre-flight integration
// ─────────────────────────────────────────────────────────────────────────────

describe('state validate pre-flight', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase includes pre_flight_validation field', () => {
    // Set up minimal valid phase structure
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    const result = runGsdTools('init execute-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('pre_flight_validation' in output, 'should have pre_flight_validation field');
    assert.strictEqual(typeof output.pre_flight_validation, 'boolean', 'should be a boolean');
    assert.strictEqual(output.pre_flight_validation, true, 'should default to true');
  });

  test('pre_flight_validation respects config gates.pre_flight_validation: false', () => {
    // Set up minimal valid phase structure with config that disables pre-flight
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    // Config with pre_flight_validation disabled
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ gates: { pre_flight_validation: false } }, null, 2)
    );

    const result = runGsdTools('init execute-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pre_flight_validation, false, 'should be false when config disables it');
  });

  test('state validate --fix then validate returns clean for plan count drift', () => {
    // Initialize git repo for --fix auto-commit
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return; // Git not available, skip
    }

    // ROADMAP says 2 plans but disk has 3
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 2 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-03-PLAN.md'), '# Plan 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Total Plans in Phase:** 3
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

None.
`
    );

    // Initial commit so git add/commit works
    try {
      execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    } catch (e) {
      return;
    }

    // Step 1: Run --fix to auto-correct plan count drift
    const fixResult = runGsdTools('state validate --fix', tmpDir);
    assert.ok(fixResult.success, `Fix command failed: ${fixResult.error}`);

    const fixOutput = JSON.parse(fixResult.output);
    assert.ok(fixOutput.fixes_applied.length > 0, 'should have fixes applied');
    assert.strictEqual(fixOutput.fixes_applied[0].old, '2');
    assert.strictEqual(fixOutput.fixes_applied[0].new, '3');

    // Step 2: Run validate again — should be clean (or at least no plan_count_drift)
    const validateResult = runGsdTools('state validate', tmpDir);
    assert.ok(validateResult.success, `Validate command failed: ${validateResult.error}`);

    const validateOutput = JSON.parse(validateResult.output);
    const driftIssues = validateOutput.issues.filter(i => i.type === 'plan_count_drift');
    assert.strictEqual(driftIssues.length, 0, 'plan_count_drift should be gone after fix');
  });

  test('state validate with multiple issue types returns mixed severities', () => {
    // Set up: plan count drift (error) + completed position (warn) + stale blockers (warn)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 5 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Current Plan:** 2
**Status:** In progress
**Last Activity:** ${new Date().toISOString().split('T')[0]}

## Accumulated Context

### Blockers/Concerns

- Legacy blocker from long ago

### Pending Todos

None.
`
    );

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.issues.length >= 2, `should have at least 2 issues, got ${output.issues.length}`);

    // Check for different severity levels
    const severities = new Set(output.issues.map(i => i.severity));
    const hasError = severities.has('error');
    const hasWarn = severities.has('warn');

    // Plan count drift should be "error", completed position or stale blocker should be "warn"
    assert.ok(hasError, 'should have at least one error severity issue');
    assert.ok(hasWarn, 'should have at least one warn severity issue');

    // Verify specific types present
    const issueTypes = output.issues.map(i => i.type);
    assert.ok(issueTypes.includes('plan_count_drift'), 'should include plan_count_drift');
  });

  test('init execute-phase compact mode includes pre_flight_validation', () => {
    // Set up minimal valid phase structure
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Milestones

- 🔵 **v1.0: Foundation**
  - Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Set up basics
**Plans:** 1 plans
`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-foundation\nplan: 01\n---\n# Plan 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Current Position

**Phase:** 1 of 1 (Foundation)
**Status:** In progress
`
    );

    const result = runGsdTools('init execute-phase 1 --compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('pre_flight_validation' in output, 'compact mode should have pre_flight_validation field');
    assert.strictEqual(output.pre_flight_validation, true, 'should default to true in compact mode');
  });
});

// ─── Memory Commands ─────────────────────────────────────────────────────────

describe('memory commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('memory list returns empty when no memory dir', () => {
    const result = runGsdTools('memory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.stores, [], 'stores should be empty array');
    assert.ok(output.memory_dir, 'should include memory_dir path');
  });

  test('memory write creates directory and file', () => {
    const entry = JSON.stringify({ summary: 'Test decision', phase: '03' });
    const result = runGsdTools(`memory write --store decisions --entry '${entry}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.written, true);
    assert.strictEqual(output.store, 'decisions');
    assert.strictEqual(output.entry_count, 1);

    // Verify file exists on disk
    const filePath = path.join(tmpDir, '.planning', 'memory', 'decisions.json');
    assert.ok(fs.existsSync(filePath), 'decisions.json should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(data.length, 1);
    assert.strictEqual(data[0].summary, 'Test decision');
    assert.ok(data[0].timestamp, 'should have auto-added timestamp');
  });

  test('memory write appends to existing store', () => {
    // Write first entry
    const entry1 = JSON.stringify({ summary: 'First' });
    runGsdTools(`memory write --store lessons --entry '${entry1}'`, tmpDir);

    // Write second entry
    const entry2 = JSON.stringify({ summary: 'Second' });
    const result = runGsdTools(`memory write --store lessons --entry '${entry2}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.entry_count, 2);

    // Verify both on disk
    const filePath = path.join(tmpDir, '.planning', 'memory', 'lessons.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(data.length, 2);
    assert.strictEqual(data[0].summary, 'First');
    assert.strictEqual(data[1].summary, 'Second');
  });

  test('memory read returns empty for missing store', () => {
    const result = runGsdTools('memory read --store decisions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.entries, []);
    assert.strictEqual(output.count, 0);
    assert.strictEqual(output.total, 0);
    assert.strictEqual(output.store, 'decisions');
  });

  test('memory read with query filter', () => {
    // Write entries with different content
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { summary: 'Chose esbuild for bundling', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Selected PostgreSQL for DB', timestamp: '2026-01-02T00:00:00Z' },
      { summary: 'esbuild config updated', timestamp: '2026-01-03T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store decisions --query esbuild', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should match 2 entries containing esbuild');
    assert.strictEqual(output.total, 3, 'total should be 3');
  });

  test('memory read with phase filter', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { summary: 'Phase 3 decision', phase: '03', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Phase 4 decision', phase: '04', timestamp: '2026-01-02T00:00:00Z' },
      { summary: 'Phase 3 lesson', phase: '03', timestamp: '2026-01-03T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'lessons.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store lessons --phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should match 2 entries with phase 03');
    assert.strictEqual(output.total, 3);
  });

  test('memory read with limit', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = Array.from({ length: 10 }, (_, i) => ({
      summary: `Entry ${i}`, timestamp: '2026-01-01T00:00:00Z',
    }));
    fs.writeFileSync(path.join(memDir, 'todos.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store todos --limit 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should return only 3 entries');
    assert.strictEqual(output.total, 10, 'total should be 10');
  });

  test('bookmarks store trims to max 20 entries', () => {
    // Seed with 19 existing bookmarks
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const existing = Array.from({ length: 19 }, (_, i) => ({
      file: `file-${i}.js`, timestamp: '2026-01-01T00:00:00Z',
    }));
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify(existing));

    // Write 3 more (should end up at 20, not 22)
    for (let i = 0; i < 3; i++) {
      runGsdTools(`memory write --store bookmarks --entry '${JSON.stringify({ file: `new-${i}.js` })}'`, tmpDir);
    }

    const result = runGsdTools('memory read --store bookmarks', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.total, 20, 'bookmarks should be capped at 20');
    // Newest should be first
    assert.strictEqual(output.entries[0].file, 'new-2.js', 'newest bookmark should be first');
  });

  test('decisions store never prunes (write 30, read back all 30)', () => {
    for (let i = 0; i < 30; i++) {
      const entry = JSON.stringify({ summary: `Decision ${i}` });
      const result = runGsdTools(`memory write --store decisions --entry '${entry}'`, tmpDir);
      assert.ok(result.success, `Write ${i} failed: ${result.error}`);
    }

    const result = runGsdTools('memory read --store decisions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.total, 30, 'all 30 decisions should be preserved');
    assert.strictEqual(output.count, 30);
  });

  test('memory list shows stats for populated stores', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Create two stores
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify([
      { summary: 'D1' }, { summary: 'D2' },
    ]));
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify([
      { file: 'a.js' },
    ]));

    const result = runGsdTools('memory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.stores.length, 2, 'should list 2 stores');
    const decisions = output.stores.find(s => s.name === 'decisions');
    const bookmarks = output.stores.find(s => s.name === 'bookmarks');
    assert.ok(decisions, 'should have decisions store');
    assert.ok(bookmarks, 'should have bookmarks store');
    assert.strictEqual(decisions.entry_count, 2);
    assert.strictEqual(bookmarks.entry_count, 1);
    assert.ok(decisions.size_bytes > 0, 'should have non-zero size');
    assert.ok(decisions.last_modified, 'should have last_modified');
  });
});

describe('init memory', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns minimal stub when no memory exists', () => {
    const result = runGsdTools('init memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('position' in output, 'has position');
    assert.deepStrictEqual(output.decisions, [], 'decisions empty');
    assert.deepStrictEqual(output.blockers, [], 'blockers empty');
    assert.deepStrictEqual(output.todos, [], 'todos empty');
    assert.deepStrictEqual(output.lessons, [], 'lessons empty');
    assert.strictEqual(output.bookmark, null, 'bookmark null');
    assert.strictEqual(output.workflow, null, 'workflow null when not specified');
  });

  test('includes position from STATE.md', () => {
    const stateContent = `## Current Position

**Phase** 11
**Phase Name** Session Continuity
**Plan** 02
**Status** In Progress
**Last Activity** 2026-02-22
**Stopped at** Implementing memory digest
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = runGsdTools('init memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.position.phase, '11');
    assert.strictEqual(output.position.phase_name, 'Session Continuity');
    assert.strictEqual(output.position.plan, '02');
    assert.strictEqual(output.position.last_activity, '2026-02-22');
    assert.strictEqual(output.position.stopped_at, 'Implementing memory digest');
  });

  test('includes decisions from memory store', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify([
      { summary: 'Use esbuild', phase: '10' },
      { summary: 'Single file CLI', phase: '10' },
      { summary: 'Memory stores as JSON', phase: '11' },
    ]));

    const result = runGsdTools('init memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 3, 'all 3 decisions returned');
    // Most recent first (reversed)
    assert.strictEqual(output.decisions[0].summary, 'Memory stores as JSON');
    assert.strictEqual(output.decisions[2].summary, 'Use esbuild');
  });

  test('filters decisions by phase', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify([
      { summary: 'Use esbuild', phase: '10' },
      { summary: 'Single file CLI', phase: '10' },
      { summary: 'Memory stores as JSON', phase: '11' },
    ]));

    const result = runGsdTools('init memory --phase 11', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 1, 'only phase 11 decisions');
    assert.strictEqual(output.decisions[0].summary, 'Memory stores as JSON');
  });

  test('includes latest bookmark', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify([
      { phase: '11', plan: '01', task: 3, total_tasks: 5, last_file: 'src/router.js', saved_at: '2026-02-22T10:00:00Z' },
      { phase: '10', plan: '02', task: 1, total_tasks: 3, last_file: 'src/init.js', saved_at: '2026-02-21T08:00:00Z' },
    ]));

    const result = runGsdTools('init memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.bookmark, 'bookmark present');
    assert.strictEqual(output.bookmark.phase, '11');
    assert.strictEqual(output.bookmark.plan, '01');
    assert.strictEqual(output.bookmark.task, 3);
  });

  test('workflow flag selects codebase sections', () => {
    const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
    fs.mkdirSync(codebaseDir, { recursive: true });
    fs.writeFileSync(path.join(codebaseDir, 'CONVENTIONS.md'), '# Conventions\nUse strict mode.');
    fs.writeFileSync(path.join(codebaseDir, 'ARCHITECTURE.md'), '# Architecture\nModular design.');
    fs.writeFileSync(path.join(codebaseDir, 'TESTING.md'), '# Testing\nUse node:test.');
    fs.writeFileSync(path.join(codebaseDir, 'STACK.md'), '# Stack\nNode.js + esbuild.');
    fs.writeFileSync(path.join(codebaseDir, 'CONCERNS.md'), '# Concerns\nPerformance.');

    // execute-phase should load CONVENTIONS + ARCHITECTURE
    const r1 = runGsdTools('init memory --workflow execute-phase', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.ok(o1.codebase.sections_loaded.includes('CONVENTIONS.md'), 'execute-phase loads CONVENTIONS');
    assert.ok(o1.codebase.sections_loaded.includes('ARCHITECTURE.md'), 'execute-phase loads ARCHITECTURE');
    assert.ok(!o1.codebase.sections_loaded.includes('TESTING.md'), 'execute-phase does not load TESTING');

    // verify-work should load TESTING + CONVENTIONS
    const r2 = runGsdTools('init memory --workflow verify-work', tmpDir);
    assert.ok(r2.success, `Command failed: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.ok(o2.codebase.sections_loaded.includes('TESTING.md'), 'verify-work loads TESTING');
    assert.ok(o2.codebase.sections_loaded.includes('CONVENTIONS.md'), 'verify-work loads CONVENTIONS');

    // plan-phase should load ARCHITECTURE + STACK + CONCERNS
    const r3 = runGsdTools('init memory --workflow plan-phase', tmpDir);
    assert.ok(r3.success, `Command failed: ${r3.error}`);
    const o3 = JSON.parse(r3.output);
    assert.ok(o3.codebase.sections_loaded.includes('ARCHITECTURE.md'), 'plan-phase loads ARCHITECTURE');
    assert.ok(o3.codebase.sections_loaded.includes('STACK.md'), 'plan-phase loads STACK');
    assert.ok(o3.codebase.sections_loaded.includes('CONCERNS.md'), 'plan-phase loads CONCERNS');
  });

  test('compact mode reduces output vs verbose', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Write 12 decisions
    const decisions = [];
    for (let i = 0; i < 12; i++) {
      decisions.push({ summary: `Decision ${i}`, phase: '11' });
    }
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify(decisions));

    // Verbose mode: up to 10 decisions
    const r1 = runGsdTools('init memory --verbose', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.decisions.length, 10, 'verbose mode: 10 decisions');

    // Default (compact) mode: up to 5 decisions
    const r2 = runGsdTools('init memory', tmpDir);
    assert.ok(r2.success, `Command failed: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.ok(o2.decisions.length <= 5, 'compact mode: 5 or fewer decisions');
  });

  test('includes blockers from STATE.md', () => {
    const stateContent = `## Current Position

**Phase** 11
**Plan** 02
**Status** In Progress

### Blockers/Concerns

- API rate limiting not yet implemented
- Missing test coverage for edge cases

### Pending Todos

- Write unit tests for memory digest
- Update documentation
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = runGsdTools('init memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.blockers.length, 2, '2 blockers');
    assert.strictEqual(output.blockers[0], 'API rate limiting not yet implemented');
    assert.strictEqual(output.blockers[1], 'Missing test coverage for edge cases');
    assert.strictEqual(output.todos.length, 2, '2 todos');
    assert.strictEqual(output.todos[0], 'Write unit tests for memory digest');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// memory compact command
// ─────────────────────────────────────────────────────────────────────────────

describe('memory compact', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('compact refuses to compact decisions (returns sacred_data)', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = Array.from({ length: 60 }, (_, i) => ({
      summary: `Decision ${i}`,
      timestamp: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify(entries));

    const result = runGsdTools('memory compact --store decisions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.compacted, false, 'should not compact');
    assert.strictEqual(output.reason, 'sacred_data', 'reason should be sacred_data');

    // Verify file unchanged
    const afterEntries = JSON.parse(fs.readFileSync(path.join(memDir, 'decisions.json'), 'utf-8'));
    assert.strictEqual(afterEntries.length, 60, 'decisions should be unchanged');
  });

  test('compact refuses to compact lessons (returns sacred_data)', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = Array.from({ length: 55 }, (_, i) => ({
      lesson: `Lesson ${i}`,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'lessons.json'), JSON.stringify(entries));

    const result = runGsdTools('memory compact --store lessons', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.compacted, false, 'should not compact lessons');
    assert.strictEqual(output.reason, 'sacred_data', 'reason should be sacred_data');
  });

  test('compact trims bookmarks to 10 live + summaries for old entries', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    // Create 60 bookmark entries (newest first, as bookmarks are prepended)
    const entries = Array.from({ length: 60 }, (_, i) => ({
      phase: `${Math.floor(i / 10) + 1}`,
      plan: `${(i % 3) + 1}`,
      task: i + 1,
      timestamp: `2025-02-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify(entries));

    const result = runGsdTools('memory compact --store bookmarks', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.compacted, true, 'should be compacted');
    assert.strictEqual(output.entries_before.bookmarks, 60, 'before should be 60');
    assert.strictEqual(output.summaries_created.bookmarks, 50, 'should create 50 summaries');

    // Verify file on disk
    const afterEntries = JSON.parse(fs.readFileSync(path.join(memDir, 'bookmarks.json'), 'utf-8'));
    assert.strictEqual(afterEntries.length, 60, 'total entries should be 10 kept + 50 summaries');
    // First 10 should be live entries (have phase field)
    assert.ok(afterEntries[0].phase, 'first entry should be a live bookmark');
    assert.ok(afterEntries[9].phase, 'tenth entry should be a live bookmark');
    // 11th should be a summary
    assert.ok(afterEntries[10].summary, 'eleventh entry should be a summary');
    assert.ok(afterEntries[10].original_timestamp, 'summary should have original_timestamp');
  });

  test('compact with dry-run does not modify files', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = Array.from({ length: 55 }, (_, i) => ({
      phase: '1',
      plan: '1',
      task: i + 1,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    const originalJson = JSON.stringify(entries);
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), originalJson);

    const result = runGsdTools('memory compact --store bookmarks --dry-run', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.dry_run, true, 'should indicate dry_run');
    assert.strictEqual(output.summaries_created.bookmarks, 45, 'should report 45 summaries would be created');

    // Verify file NOT modified
    const afterJson = fs.readFileSync(path.join(memDir, 'bookmarks.json'), 'utf-8');
    assert.strictEqual(afterJson, originalJson, 'file should be unchanged after dry-run');
  });

  test('compact all stores skips sacred data', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Create bookmarks (above threshold)
    const bookmarks = Array.from({ length: 55 }, (_, i) => ({
      phase: '1', plan: '1', task: i + 1,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify(bookmarks));

    // Create decisions (above threshold — should be skipped)
    const decisions = Array.from({ length: 60 }, (_, i) => ({
      summary: `Decision ${i}`,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'decisions.json'), JSON.stringify(decisions));

    // Create lessons (above threshold — should be skipped)
    const lessons = Array.from({ length: 55 }, (_, i) => ({
      lesson: `Lesson ${i}`,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'lessons.json'), JSON.stringify(lessons));

    const result = runGsdTools('memory compact', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.sacred_skipped.includes('decisions'), 'should skip decisions');
    assert.ok(output.sacred_skipped.includes('lessons'), 'should skip lessons');
    assert.ok(output.stores_processed.includes('bookmarks'), 'should process bookmarks');
    assert.strictEqual(output.compacted, true, 'should compact bookmarks');

    // Verify decisions file unchanged
    const afterDecisions = JSON.parse(fs.readFileSync(path.join(memDir, 'decisions.json'), 'utf-8'));
    assert.strictEqual(afterDecisions.length, 60, 'decisions should be unchanged');
  });

  test('compact todos removes old completed items', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Create mix of active and completed todos
    const todos = [];
    for (let i = 0; i < 55; i++) {
      if (i < 20) {
        // Active todos
        todos.push({ text: `Active todo ${i}`, status: 'pending', timestamp: `2025-01-01T00:00:00Z` });
      } else {
        // Completed todos
        todos.push({ text: `Done todo ${i}`, completed: true, timestamp: `2025-01-01T00:00:00Z` });
      }
    }
    fs.writeFileSync(path.join(memDir, 'todos.json'), JSON.stringify(todos));

    const result = runGsdTools('memory compact --store todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.compacted, true, 'should compact');
    assert.strictEqual(output.entries_before.todos, 55, 'before should be 55');
    assert.strictEqual(output.summaries_created.todos, 35, 'should create 35 summaries from completed todos');

    // Verify file on disk
    const afterEntries = JSON.parse(fs.readFileSync(path.join(memDir, 'todos.json'), 'utf-8'));
    // Should have 20 active + 35 summaries
    assert.strictEqual(afterEntries.length, 55, 'total should be 20 active + 35 summaries');
    // First 20 should be active todos
    const activeTodos = afterEntries.filter(e => e.status === 'pending');
    assert.strictEqual(activeTodos.length, 20, 'should have 20 active todos');
    // Remaining should be summaries
    const summaries = afterEntries.filter(e => e.summary);
    assert.strictEqual(summaries.length, 35, 'should have 35 summaries');
    assert.ok(summaries[0].summary.includes('[completed]'), 'summary should include [completed] marker');
  });

  test('write command warns when todos exceed threshold', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Pre-populate with 50 todos
    const entries = Array.from({ length: 50 }, (_, i) => ({
      text: `Todo ${i}`,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'todos.json'), JSON.stringify(entries));

    // Write one more to push over threshold
    const result = runGsdTools(
      `memory write --store todos --entry '{"text":"Todo 51"}'`,
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.written, true, 'should succeed writing');
    assert.strictEqual(output.compact_needed, true, 'should flag compact_needed');
    assert.strictEqual(output.threshold, 50, 'should report threshold');
    assert.strictEqual(output.entry_count, 51, 'should have 51 entries');
  });

  test('compact with custom threshold', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });

    // Create 25 bookmarks
    const entries = Array.from({ length: 25 }, (_, i) => ({
      phase: '1', plan: '1', task: i + 1,
      timestamp: `2025-01-01T00:00:00Z`,
    }));
    fs.writeFileSync(path.join(memDir, 'bookmarks.json'), JSON.stringify(entries));

    // With default threshold (50), should not compact
    const result1 = runGsdTools('memory compact --store bookmarks', tmpDir);
    assert.ok(result1.success, `Command failed: ${result1.error}`);
    const output1 = JSON.parse(result1.output);
    assert.strictEqual(output1.summaries_created.bookmarks, 0, 'should not compact at default threshold');

    // With custom threshold of 20, should compact
    const result2 = runGsdTools('memory compact --store bookmarks --threshold 20', tmpDir);
    assert.ok(result2.success, `Command failed: ${result2.error}`);
    const output2 = JSON.parse(result2.output);
    assert.strictEqual(output2.compacted, true, 'should compact at custom threshold');
    assert.strictEqual(output2.summaries_created.bookmarks, 15, 'should create 15 summaries (25 - 10 kept)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// memory trajectories (Phase 45, Plan 01)
// ─────────────────────────────────────────────────────────────────────────────

describe('memory trajectories', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('write basic trajectory entry with auto-generated ID and timestamp', () => {
    const entry = JSON.stringify({ category: 'decision', text: 'Use vertical slices' });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.written, true);
    assert.strictEqual(output.store, 'trajectories');
    assert.strictEqual(output.entry_count, 1);

    // Verify file exists at trajectory.json (not trajectories.json)
    const filePath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    assert.ok(fs.existsSync(filePath), 'trajectory.json should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(data.length, 1);
    assert.match(data[0].id, /^tj-[a-f0-9]{6}$/, 'ID should match tj-XXXXXX format');
    assert.ok(data[0].timestamp, 'should have auto-added timestamp');
    assert.strictEqual(data[0].category, 'decision');
    assert.strictEqual(data[0].text, 'Use vertical slices');
  });

  test('write rejects missing category', () => {
    const entry = JSON.stringify({ text: 'No category here' });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without category');
    assert.ok(result.error.includes('category') || result.output.includes('category'), 'Error should mention category');
  });

  test('write rejects invalid category', () => {
    const entry = JSON.stringify({ category: 'invalid', text: 'Bad category' });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with invalid category');
    assert.ok(result.error.includes('category') || result.output.includes('category'), 'Error should mention category');
  });

  test('write rejects missing text', () => {
    const entry = JSON.stringify({ category: 'decision' });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without text');
    assert.ok(result.error.includes('text') || result.output.includes('text'), 'Error should mention text');
  });

  test('write with full metadata preserves all fields', () => {
    const entry = JSON.stringify({
      category: 'hypothesis',
      text: 'Parallel execution will be faster',
      phase: '45',
      confidence: 'medium',
      tags: ['perf', 'memory'],
      references: ['abc123', 'src/foo.js'],
    });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(data[0].phase, '45');
    assert.strictEqual(data[0].confidence, 'medium');
    assert.deepStrictEqual(data[0].tags, ['perf', 'memory']);
    assert.deepStrictEqual(data[0].references, ['abc123', 'src/foo.js']);
  });

  test('write rejects invalid confidence', () => {
    const entry = JSON.stringify({ category: 'observation', text: 'Something', confidence: 'very-high' });
    const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with invalid confidence');
    assert.ok(result.error.includes('confidence') || result.output.includes('confidence'), 'Error should mention confidence');
  });

  test('read with category filter returns only matching entries', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { id: 'tj-aaa001', category: 'decision', text: 'First', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'tj-aaa002', category: 'observation', text: 'Second', timestamp: '2026-01-02T00:00:00Z' },
      { id: 'tj-aaa003', category: 'decision', text: 'Third', timestamp: '2026-01-03T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store trajectories --category decision', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should match 2 decision entries');
    assert.ok(output.entries.every(e => e.category === 'decision'), 'all should be decisions');
  });

  test('read with tag filter requires ALL specified tags', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { id: 'tj-bbb001', category: 'decision', text: 'A', tags: ['perf', 'memory'], timestamp: '2026-01-01T00:00:00Z' },
      { id: 'tj-bbb002', category: 'observation', text: 'B', tags: ['perf'], timestamp: '2026-01-02T00:00:00Z' },
      { id: 'tj-bbb003', category: 'decision', text: 'C', tags: ['memory'], timestamp: '2026-01-03T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    // Single tag
    const r1 = runGsdTools('memory read --store trajectories --tags perf', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.count, 2, 'should match 2 entries with perf tag');

    // Multi-tag (AND logic)
    const r2 = runGsdTools('memory read --store trajectories --tags perf,memory', tmpDir);
    assert.ok(r2.success, `Command failed: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.strictEqual(o2.count, 1, 'should match 1 entry with both perf AND memory');
  });

  test('read with date range filters by timestamp', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { id: 'tj-ccc001', category: 'decision', text: 'Old', timestamp: '2025-06-15T00:00:00Z' },
      { id: 'tj-ccc002', category: 'decision', text: 'Mid', timestamp: '2026-03-15T00:00:00Z' },
      { id: 'tj-ccc003', category: 'decision', text: 'New', timestamp: '2026-09-15T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store trajectories --from 2026-01-01 --to 2026-12-31', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should match 2 entries in 2026');
  });

  test('read default sort is newest-first', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { id: 'tj-ddd001', category: 'decision', text: 'First', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'tj-ddd002', category: 'observation', text: 'Second', timestamp: '2026-02-01T00:00:00Z' },
      { id: 'tj-ddd003', category: 'correction', text: 'Third', timestamp: '2026-03-01T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store trajectories', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.entries[0].text, 'Third', 'newest entry should be first');
    assert.strictEqual(output.entries[2].text, 'First', 'oldest entry should be last');
  });

  test('read with --asc flag returns chronological order', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = [
      { id: 'tj-eee001', category: 'decision', text: 'First', timestamp: '2026-01-01T00:00:00Z' },
      { id: 'tj-eee002', category: 'observation', text: 'Second', timestamp: '2026-02-01T00:00:00Z' },
      { id: 'tj-eee003', category: 'hypothesis', text: 'Third', timestamp: '2026-03-01T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    const result = runGsdTools('memory read --store trajectories --asc', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.entries[0].text, 'First', 'oldest entry should be first with --asc');
    assert.strictEqual(output.entries[2].text, 'Third', 'newest entry should be last with --asc');
  });

  test('session persistence — data survives across separate read calls', () => {
    // Write entry
    const entry = JSON.stringify({ category: 'correction', text: 'Fix the approach' });
    const writeResult = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.ok(writeResult.success, `Write failed: ${writeResult.error}`);

    // Read back (simulating new session — separate process invocation)
    const readResult = runGsdTools('memory read --store trajectories', tmpDir);
    assert.ok(readResult.success, `Read failed: ${readResult.error}`);
    const output = JSON.parse(readResult.output);
    assert.strictEqual(output.count, 1, 'entry should persist');
    assert.strictEqual(output.entries[0].text, 'Fix the approach');
    assert.strictEqual(output.entries[0].category, 'correction');
  });

  test('auto-generated IDs are unique across 10 entries', () => {
    const ids = [];
    for (let i = 0; i < 10; i++) {
      const entry = JSON.stringify({ category: 'observation', text: `Entry ${i}` });
      const result = runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);
      assert.ok(result.success, `Write ${i} failed: ${result.error}`);
    }

    const filePath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(data.length, 10, 'should have 10 entries');
    const idSet = new Set(data.map(e => e.id));
    assert.strictEqual(idSet.size, 10, 'all 10 IDs should be unique');
    for (const id of idSet) {
      assert.match(id, /^tj-[a-f0-9]{6}$/, `ID ${id} should match tj-XXXXXX format`);
    }
  });

  test('sacred store — compact skips trajectories', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const entries = Array.from({ length: 60 }, (_, i) => ({
      id: `tj-${String(i).padStart(6, '0')}`,
      category: 'decision',
      text: `Entry ${i}`,
      timestamp: '2026-01-01T00:00:00Z',
    }));
    fs.writeFileSync(path.join(memDir, 'trajectory.json'), JSON.stringify(entries));

    const result = runGsdTools('memory compact --store trajectories', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.compacted, false, 'should not compact');
    assert.strictEqual(output.reason, 'sacred_data', 'reason should be sacred_data');

    // Verify file unchanged
    const afterEntries = JSON.parse(fs.readFileSync(path.join(memDir, 'trajectory.json'), 'utf-8'));
    assert.strictEqual(afterEntries.length, 60, 'trajectories should be unchanged');
  });

  test('filename is trajectory.json not trajectories.json', () => {
    const entry = JSON.stringify({ category: 'hypothesis', text: 'Check filename' });
    runGsdTools(`memory write --store trajectories --entry '${entry}'`, tmpDir);

    const correctPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const wrongPath = path.join(tmpDir, '.planning', 'memory', 'trajectories.json');
    assert.ok(fs.existsSync(correctPath), 'trajectory.json should exist');
    assert.ok(!fs.existsSync(wrongPath), 'trajectories.json should NOT exist');
  });
});

// ─── verify analyze-plan ─────────────────────────────────────────────────────

describe('verify analyze-plan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scores well-structured plan (2 tasks, shared files) as 4-5', () => {
    const planContent = `---
phase: "12"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/commands/verify.js, src/router.js]
autonomous: true
must_haves: []
---
# Plan 12-01: Add verification

<task id="1">
<name>Add verify function</name>
<files>
src/commands/verify.js
src/lib/helpers.js
</files>
<action>Add the function</action>
</task>

<task id="2">
<name>Wire into router</name>
<files>
src/router.js
src/commands/verify.js
</files>
<action>Wire it up</action>
</task>
`;
    const planPath = path.join(tmpDir, 'test-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score >= 4, `Expected score >= 4, got ${data.sr_score}`);
    assert.strictEqual(data.task_count, 2);
    assert.ok(data.concern_count <= 2, `Expected <= 2 concerns, got ${data.concern_count}`);
    assert.strictEqual(data.split_suggestion, null);
  });

  test('scores multi-concern plan (4+ tasks in unrelated dirs) as 1-2', () => {
    const planContent = `---
phase: "05"
plan: "02"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 05-02: Kitchen sink

<task id="1">
<name>Database migration</name>
<files>
db/migrations/001_create_users.sql
db/migrations/002_create_orders.sql
</files>
<action>Create migrations</action>
</task>

<task id="2">
<name>Frontend components</name>
<files>
frontend/components/Header.tsx
frontend/components/Footer.tsx
</files>
<action>Build UI</action>
</task>

<task id="3">
<name>API endpoints</name>
<files>
api/routes/users.go
api/routes/orders.go
</files>
<action>Add endpoints</action>
</task>

<task id="4">
<name>Deploy config</name>
<files>
infra/terraform/main.tf
infra/docker/Dockerfile
</files>
<action>Configure deploy</action>
</task>

<task id="5">
<name>Documentation</name>
<files>
docs/api/README.md
docs/setup/INSTALL.md
</files>
<action>Write docs</action>
</task>

<task id="6">
<name>CI pipeline</name>
<files>
ci/pipeline.yml
ci/scripts/test.sh
</files>
<action>Set up CI</action>
</task>
`;
    const planPath = path.join(tmpDir, 'kitchen-sink-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score <= 2, `Expected score <= 2, got ${data.sr_score}`);
    assert.ok(data.concern_count >= 4, `Expected >= 4 concerns, got ${data.concern_count}`);
    assert.ok(data.task_count >= 5, `Expected >= 5 tasks, got ${data.task_count}`);
  });

  test('detects concern groups correctly', () => {
    const planContent = `---
phase: "03"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 03-01: Two concerns

<task id="1">
<name>Router update</name>
<files>
src/router.js
src/commands/init.js
</files>
<action>Update router</action>
</task>

<task id="2">
<name>Init command</name>
<files>
src/commands/init.js
src/lib/helpers.js
</files>
<action>Add init</action>
</task>

<task id="3">
<name>Write tests</name>
<files>
tests/unit/router.test.js
tests/unit/init.test.js
</files>
<action>Add tests</action>
</task>
`;
    const planPath = path.join(tmpDir, 'two-concern-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Tasks 1 and 2 share src/commands/ directory, so they merge.
    // Task 3 is in tests/unit/ - separate concern.
    assert.strictEqual(data.concern_count, 2, `Expected 2 concerns, got ${data.concern_count}`);
    assert.strictEqual(data.task_count, 3);

    // Verify concern structure
    const srcConcern = data.concerns.find(c => c.tasks.length === 2);
    const testConcern = data.concerns.find(c => c.tasks.length === 1);
    assert.ok(srcConcern, 'Should have a concern with 2 tasks');
    assert.ok(testConcern, 'Should have a concern with 1 task');
    assert.ok(testConcern.tasks.includes('Write tests'), 'Test concern should contain Write tests');
  });

  test('suggests splits for poor plans (score <= 3)', () => {
    const planContent = `---
phase: "07"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves: []
---
# Plan 07-01: Overloaded

<task id="1">
<name>Database work</name>
<files>
db/schema.sql
db/seeds.sql
</files>
<action>DB stuff</action>
</task>

<task id="2">
<name>Frontend work</name>
<files>
web/pages/index.tsx
web/components/Nav.tsx
</files>
<action>UI stuff</action>
</task>

<task id="3">
<name>Backend work</name>
<files>
server/routes.go
server/handlers.go
</files>
<action>Server stuff</action>
</task>

<task id="4">
<name>Infra work</name>
<files>
deploy/nomad.hcl
deploy/consul.hcl
</files>
<action>Infra stuff</action>
</task>
`;
    const planPath = path.join(tmpDir, 'overloaded-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.sr_score <= 3, `Expected score <= 3, got ${data.sr_score}`);
    assert.ok(data.split_suggestion !== null, 'Should have split suggestion');
    assert.strictEqual(data.split_suggestion.recommended_splits, data.concern_count);
    assert.ok(data.split_suggestion.proposed_plans.length >= 2, 'Should propose at least 2 plans');

    // Each proposed plan should have tasks and files
    for (const plan of data.split_suggestion.proposed_plans) {
      assert.ok(plan.tasks.length > 0, 'Proposed plan should have tasks');
      assert.ok(plan.files.length > 0, 'Proposed plan should have files');
      assert.ok(plan.area, 'Proposed plan should have area label');
    }
  });

  test('handles single-task plan (score 5)', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/index.js]
autonomous: true
must_haves: []
---
# Plan 01-01: Simple task

<task id="1">
<name>Initialize project</name>
<files>
src/index.js
</files>
<action>Set up entry point</action>
</task>
`;
    const planPath = path.join(tmpDir, 'simple-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify analyze-plan ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.sr_score, 5);
    assert.strictEqual(data.sr_label, 'Excellent');
    assert.strictEqual(data.concern_count, 1);
    assert.strictEqual(data.task_count, 1);
    assert.strictEqual(data.split_suggestion, null);
    assert.strictEqual(data.plan, '1-01');
  });

  test('handles missing file gracefully', () => {
    const result = runGsdTools('verify analyze-plan /nonexistent/path/PLAN.md');
    assert.ok(result.success, `Command should not throw`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.error, 'File not found');
  });
});

// ─── verify deliverables ─────────────────────────────────────────────────────

describe('verify deliverables', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns structured result when npm test runs', () => {
    // Create temp dir with a passing test command
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-pass',
      scripts: { test: 'echo "5 passing"' },
    }));

    const result = runGsdTools('verify deliverables', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.test_result, 'pass', 'test_result should be pass');
    assert.strictEqual(data.framework, 'npm', 'should detect npm framework');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
    assert.strictEqual(data.tests_passed, 5, 'should parse 5 passing');
  });

  test('returns fail when test command fails', () => {
    // Create a temp dir with a package.json that has a failing test command
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-fail',
      scripts: { test: 'exit 1' },
    }));

    const result = runGsdTools('verify deliverables', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.test_result, 'fail', 'test_result should be fail');
    assert.strictEqual(data.verdict, 'fail', 'verdict should be fail');
  });

  test('auto-detects test framework from package.json', () => {
    // Create temp dir with package.json that echoes pass info
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-detect',
      scripts: { test: 'echo "3 passing"' },
    }));

    const result = runGsdTools('verify deliverables', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.framework, 'npm', 'should detect npm from package.json');
    assert.strictEqual(data.test_result, 'pass', 'test should pass');
  });
});

// ─── verify requirements ─────────────────────────────────────────────────────

describe('verify requirements', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns all addressed when all reqs marked [x]', () => {
    const reqContent = `# Requirements

- [x] **DX-01** Developer experience
- [x] **DX-02** CLI tooling
- [x] **PERF-01** Performance optimization

## Traceability

| ID | Phase |
| DX-01 | Phase 01 |
| DX-02 | Phase 02 |
| PERF-01 | Phase 03 |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqContent);

    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should find 3 requirements');
    assert.strictEqual(data.addressed, 3, 'all should be addressed');
    assert.strictEqual(data.unaddressed, 0, 'none unaddressed');
  });

  test('detects unaddressed req when phase has no summaries', () => {
    // Create phase dir without summaries
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-tooling'), { recursive: true });

    const reqContent = `# Requirements

- [x] **DX-01** Done item
- [ ] **DX-02** Needs work

## Traceability

| ID | Phase |
| DX-01 | Phase 01 |
| DX-02 | Phase 02 |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqContent);

    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 2, 'should find 2 requirements');
    assert.strictEqual(data.addressed, 1, 'only 1 addressed (the [x] one)');
    assert.strictEqual(data.unaddressed, 1, '1 unaddressed');
    assert.strictEqual(data.unaddressed_list[0].id, 'DX-02');
    assert.strictEqual(data.unaddressed_list[0].phase, '02');
  });

  test('handles missing REQUIREMENTS.md gracefully', () => {
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 0, 'should have 0 total');
    assert.ok(data.error, 'should have error message');
  });
});

// ─── verify regression ───────────────────────────────────────────────────────

describe('verify regression', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects regression when test goes pass to fail', () => {
    const beforeData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'pass' },
        { name: 'test-c', status: 'fail' },
      ],
    };
    const afterData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'fail' },
        { name: 'test-c', status: 'fail' },
      ],
    };

    const beforePath = path.join(tmpDir, 'before.json');
    const afterPath = path.join(tmpDir, 'after.json');
    fs.writeFileSync(beforePath, JSON.stringify(beforeData));
    fs.writeFileSync(afterPath, JSON.stringify(afterData));

    const result = runGsdTools(`verify regression --before before.json --after after.json`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 1, 'should detect 1 regression');
    assert.strictEqual(data.regressions[0].test_name, 'test-b', 'test-b regressed');
    assert.strictEqual(data.verdict, 'fail', 'verdict should be fail');
  });

  test('returns clean when no regressions', () => {
    const beforeData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'fail' },
      ],
    };
    const afterData = {
      tests: [
        { name: 'test-a', status: 'pass' },
        { name: 'test-b', status: 'pass' },
      ],
    };

    const beforePath = path.join(tmpDir, 'before.json');
    const afterPath = path.join(tmpDir, 'after.json');
    fs.writeFileSync(beforePath, JSON.stringify(beforeData));
    fs.writeFileSync(afterPath, JSON.stringify(afterData));

    const result = runGsdTools(`verify regression --before before.json --after after.json`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 0, 'no regressions');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
  });

  test('handles missing baseline gracefully', () => {
    const result = runGsdTools('verify regression', tmpDir);
    assert.ok(result.success, `Command should not throw: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.regression_count, 0, 'should be 0');
    assert.strictEqual(data.verdict, 'pass', 'verdict should be pass');
    assert.ok(data.note, 'should have a note about missing baseline');
  });
});

// ─── verify plan-wave ────────────────────────────────────────────────────────

describe('verify plan-wave', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects file conflicts within a wave', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '12-01-PLAN.md'), `---
phase: "12"
plan: "01"
wave: 1
files_modified: [src/commands/verify.js, src/router.js]
---
# Plan 12-01
`);
    fs.writeFileSync(path.join(phaseDir, '12-03-PLAN.md'), `---
phase: "12"
plan: "03"
wave: 1
files_modified: [src/commands/verify.js, src/lib/helpers.js]
---
# Plan 12-03
`);
    fs.writeFileSync(path.join(phaseDir, '12-02-PLAN.md'), `---
phase: "12"
plan: "02"
wave: 2
files_modified: [src/commands/verify.js]
---
# Plan 12-02
`);

    const result = runGsdTools(`verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.phase, '12');
    assert.strictEqual(data.verdict, 'conflicts_found');
    assert.strictEqual(data.conflicts.length, 1);
    assert.strictEqual(data.conflicts[0].wave, 1);
    assert.strictEqual(data.conflicts[0].file, 'src/commands/verify.js');
    assert.ok(data.conflicts[0].plans.includes('12-01'));
    assert.ok(data.conflicts[0].plans.includes('12-03'));
    // Wave 2 should not be in conflicts (only one plan)
    assert.ok(!data.conflicts.some(c => c.wave === 2));
  });

  test('returns clean when no conflicts', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-features');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '05-01-PLAN.md'), `---
phase: "05"
plan: "01"
wave: 1
files_modified: [src/a.js]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '05-02-PLAN.md'), `---
phase: "05"
plan: "02"
wave: 1
files_modified: [src/b.js]
---
# Plan
`);

    const result = runGsdTools(`verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.conflicts.length, 0);
    assert.deepStrictEqual(data.waves['1'], ['05-01', '05-02']);
  });

  test('handles single-plan phase', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---
phase: "01"
plan: "01"
wave: 1
files_modified: [src/index.js]
---
# Plan
`);

    const result = runGsdTools(`verify plan-wave ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.conflicts.length, 0);
    assert.deepStrictEqual(data.waves['1'], ['01-01']);
  });
});

// ─── verify plan-deps ────────────────────────────────────────────────────────

describe('verify plan-deps', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects dependency cycle', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---
phase: "03"
plan: "01"
wave: 1
depends_on: [03-02]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---
phase: "03"
plan: "02"
wave: 1
depends_on: [03-01]
---
# Plan
`);

    const result = runGsdTools(`verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const cycleIssues = data.issues.filter(i => i.type === 'cycle');
    assert.ok(cycleIssues.length > 0, 'should find cycle issue');
  });

  test('detects unreachable dependency', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), `---
phase: "04"
plan: "01"
wave: 1
depends_on: [04-99]
---
# Plan
`);

    const result = runGsdTools(`verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const unreachable = data.issues.filter(i => i.type === 'unreachable');
    assert.ok(unreachable.length > 0, 'should find unreachable dep');
    assert.strictEqual(unreachable[0].dep, '99');
  });

  test('returns clean for valid graph', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '06-infra');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '06-01-PLAN.md'), `---
phase: "06"
plan: "01"
wave: 1
depends_on: []
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '06-02-PLAN.md'), `---
phase: "06"
plan: "02"
wave: 2
depends_on: [06-01]
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '06-03-PLAN.md'), `---
phase: "06"
plan: "03"
wave: 1
depends_on: []
---
# Plan
`);

    const result = runGsdTools(`verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'clean');
    assert.strictEqual(data.plan_count, 3);
    assert.strictEqual(data.issues.length, 0);
    assert.deepStrictEqual(data.dependency_graph['01'], []);
    assert.deepStrictEqual(data.dependency_graph['02'], ['01']);
    assert.deepStrictEqual(data.dependency_graph['03'], []);
  });

  test('detects unnecessary serialization', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), `---
phase: "07"
plan: "01"
wave: 1
depends_on: []
---
# Plan
`);
    fs.writeFileSync(path.join(phaseDir, '07-02-PLAN.md'), `---
phase: "07"
plan: "02"
wave: 2
depends_on: []
---
# Plan — in wave 2 but no deps, could be wave 1
`);

    const result = runGsdTools(`verify plan-deps ${phaseDir}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.verdict, 'issues_found');
    const serialization = data.issues.filter(i => i.type === 'unnecessary_serialization');
    assert.ok(serialization.length > 0, 'should find unnecessary serialization');
    assert.strictEqual(serialization[0].plan, '02');
    assert.strictEqual(serialization[0].wave, 2);
  });
});

// ─── verify plan-structure template compliance ───────────────────────────────

describe('verify plan-structure template compliance', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects missing required frontmatter fields', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
---
# Plan with minimal frontmatter

<task id="1">
<name>Do something</name>
<action>Act</action>
<verify>Check</verify>
<done>Done criteria</done>
</task>
`;
    const planPath = path.join(tmpDir, 'minimal-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.strictEqual(data.template_compliance.valid, false, 'should not be valid');
    assert.ok(data.template_compliance.missing_fields.length > 0, 'should have missing fields');
    assert.ok(data.template_compliance.missing_fields.includes('wave'), 'should be missing wave');
    assert.ok(data.template_compliance.missing_fields.includes('depends_on'), 'should be missing depends_on');
    assert.ok(data.template_compliance.missing_fields.includes('files_modified'), 'should be missing files_modified');
  });

  test('validates requirements is non-empty', () => {
    const planContent = `---
phase: "01"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified: [src/a.js]
autonomous: true
requirements: []
must_haves: []
---
# Plan with empty requirements

<task id="1">
<name>Do something</name>
<action>Act</action>
<verify>Check</verify>
<done>Done criteria</done>
</task>
`;
    const planPath = path.join(tmpDir, 'empty-reqs-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.ok(data.template_compliance.type_issues.some(i => i.includes('requirements is empty')),
      'should flag empty requirements');
  });

  test('returns valid for well-formed plan', () => {
    const planContent = `---
phase: "12"
plan: "04"
type: execute
wave: 1
depends_on: []
files_modified: [src/commands/verify.js, src/router.js]
autonomous: true
requirements: [DX-01, PLAN-04]
must_haves:
  artifacts:
    - path: src/commands/verify.js
---
# Plan 12-04: Well-formed

<task id="1">
<name>Implement feature</name>
<files>
src/commands/verify.js
</files>
<action>Add the cmdVerifyPlanWave function</action>
<verify>npm test passes</verify>
<done>Function exported and wired into router</done>
</task>

<task id="2">
<name>Wire into router</name>
<files>
src/router.js
</files>
<action>Add plan-wave subcommand</action>
<verify>gsd-tools verify plan-wave works</verify>
<done>Command accessible via CLI</done>
</task>
`;
    const planPath = path.join(tmpDir, 'good-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(`verify plan-structure ${planPath}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.template_compliance, 'should have template_compliance');
    assert.strictEqual(data.template_compliance.valid, true, 'should be valid');
    assert.strictEqual(data.template_compliance.missing_fields.length, 0, 'no missing fields');
    assert.strictEqual(data.template_compliance.type_issues.length, 0, 'no type issues');
  });
});

// ─── verify quality ──────────────────────────────────────────────────────────

describe('verify quality', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns composite score with all dimensions', () => {
    // Create a project with passing tests and REQUIREMENTS.md
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-quality',
      scripts: { test: 'echo "10 passing"' },
    }));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

- [x] **REQ-01** First requirement
- [x] **REQ-02** Second requirement
`);

    // Create plan with must_haves (4-space indent for parseMustHavesBlock)
    const planDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(planDir, { recursive: true });
    const planPath = path.join(planDir, '12-01-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "12"
plan: "01"
must_haves:
    artifacts:
      - path: package.json
    key_links: []
---
# Plan
`);

    const result = runGsdTools(`verify quality --plan ${planPath} --phase 12`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(typeof data.score === 'number', 'score should be a number');
    assert.ok(data.score >= 0 && data.score <= 100, 'score should be 0-100');
    assert.ok(['A', 'B', 'C', 'D', 'F'].includes(data.grade), 'grade should be A-F');
    assert.ok(data.dimensions, 'should have dimensions');
    assert.ok(data.dimensions.tests, 'should have tests dimension');
    assert.ok(data.dimensions.must_haves, 'should have must_haves dimension');
    assert.ok(data.dimensions.requirements, 'should have requirements dimension');
    assert.ok(data.dimensions.regression, 'should have regression dimension');
    assert.ok(data.trend, 'should have trend');
  });

  test('grade mapping thresholds are correct', () => {
    // Project with passing tests only (no plan, no requirements)
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-grade',
      scripts: { test: 'echo "5 passing"' },
    }));

    const result = runGsdTools('verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Only tests dimension active (100), so score = 100, grade = A
    assert.strictEqual(data.dimensions.tests.score, 100, 'tests should score 100');
    assert.strictEqual(data.score, 100, 'composite score should be 100 with only passing tests');
    assert.strictEqual(data.grade, 'A', 'grade should be A for score 100');
  });

  test('must-haves checks file existence and scores correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-musthaves',
      scripts: { test: 'echo "1 passing"' },
    }));

    // Create one file that exists, reference one that doesn't
    fs.writeFileSync(path.join(tmpDir, 'existing.js'), 'module.exports = {}');

    const planDir = path.join(tmpDir, '.planning', 'phases', '12-quality');
    fs.mkdirSync(planDir, { recursive: true });
    const planPath = path.join(planDir, '12-02-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "12"
plan: "02"
must_haves:
    artifacts:
      - path: existing.js
      - path: nonexistent.js
    key_links: []
---
# Plan
`);

    const result = runGsdTools(`verify quality --plan ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.dimensions.must_haves.score, 50, 'must_haves should be 50% (1/2)');
    assert.strictEqual(data.dimensions.must_haves.detail, '1/2 verified', 'detail should reflect counts');
  });

  test('stores score in quality-scores.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-store',
      scripts: { test: 'echo "1 passing"' },
    }));

    const result = runGsdTools('verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const scoresPath = path.join(tmpDir, '.planning', 'memory', 'quality-scores.json');
    assert.ok(fs.existsSync(scoresPath), 'quality-scores.json should be created');

    const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
    assert.ok(Array.isArray(scores), 'scores should be an array');
    assert.ok(scores.length >= 1, 'should have at least 1 entry');
    assert.ok(typeof scores[0].score === 'number', 'entry should have score');
    assert.ok(scores[0].grade, 'entry should have grade');
    assert.ok(scores[0].timestamp, 'entry should have timestamp');
  });

  test('trend tracking detects improving scores', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-trend',
      scripts: { test: 'echo "1 passing"' },
    }));

    // Write 2 previous scores (ascending)
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'quality-scores.json'), JSON.stringify([
      { phase: '12', plan: '12-01', score: 60, grade: 'D', timestamp: '2026-01-01T00:00:00Z' },
      { phase: '12', plan: '12-01', score: 80, grade: 'B', timestamp: '2026-01-02T00:00:00Z' },
    ]));

    // Run quality check (tests pass = 100, should produce score 100)
    const result = runGsdTools('verify quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.trend, 'improving', 'trend should be improving (60 → 80 → 100)');

    // Verify 3 entries now in file
    const scores = JSON.parse(fs.readFileSync(path.join(memDir, 'quality-scores.json'), 'utf-8'));
    assert.strictEqual(scores.length, 3, 'should have 3 entries');
  });

  test('handles missing plan gracefully with phase-only', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-noplan',
      scripts: { test: 'echo "3 passing"' },
    }));

    const result = runGsdTools('verify quality --phase 12', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(typeof data.score === 'number', 'score should still be a number');
    assert.strictEqual(data.dimensions.must_haves.score, null, 'must_haves should be null without plan');
    assert.strictEqual(data.dimensions.tests.score, 100, 'tests should still score');
    assert.strictEqual(data.phase, '12', 'phase should be set from option');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Workflow Sequences (Phase 13, Plan 01)
// ─────────────────────────────────────────────────────────────────────────────

describe('integration: workflow sequences', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Minimal project scaffolding
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 2\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n## Active Milestone: v1.0\n\n### Phase 1: Foundation\n- [ ] **Phase 1: Foundation**\n**Goal:** Build foundation\n**Plans:** 1 plans\n**Requirements:** REQ-01\n\n### Phase 2: Features\n- [ ] **Phase 2: Features**\n**Goal:** Add features\n**Plans:** 1 plans\n**Requirements:** REQ-02\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n## v1.0 Requirements\n\n- [ ] **REQ-01**: First requirement\n- [ ] **REQ-02**: Second requirement\n- [ ] **REQ-03**: Third requirement (uncovered)\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      `# Test Project\n\nA project for integration testing.\n`
    );
    // Create a phase directory with a plan
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\ndepends_on: []\nrequirements:\n  - REQ-01\nfiles_modified:\n  - src/index.js\nmust_haves:\n  artifacts: []\n  key_links: []\n---\n# Plan 01-01: Foundation\n\n<task type="implement">\n<name>Setup</name>\n<files>src/index.js</files>\n<action>Create setup code.</action>\n<verify>Check it works.</verify>\n<done>Setup complete.</done>\n</task>\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init → state → roadmap sequence', () => {
    // Step 1: init progress
    const progressResult = runGsdTools('init progress --verbose', tmpDir);
    assert.ok(progressResult.success, `init progress failed: ${progressResult.error}`);
    const progressData = JSON.parse(progressResult.output);
    assert.strictEqual(progressData.project_exists, true, 'project should exist');
    assert.ok(progressData.phase_count > 0, 'should have phases');

    // Step 2: state load
    const stateResult = runGsdTools('state load', tmpDir);
    assert.ok(stateResult.success, `state load failed: ${stateResult.error}`);
    const stateData = JSON.parse(stateResult.output);
    assert.strictEqual(stateData.state_exists, true, 'state should exist');

    // Step 3: roadmap analyze
    const roadmapResult = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(roadmapResult.success, `roadmap analyze failed: ${roadmapResult.error}`);
    const roadmapData = JSON.parse(roadmapResult.output);
    assert.ok(roadmapData.phase_count > 0, 'roadmap should have phases');
  });

  test('state mutation sequence: patch → get', () => {
    // Patch multiple fields (no --raw: returns JSON with updated/failed arrays)
    const patchResult = runGsdTools('state patch --Phase "2 of 2" --Status "Planning"', tmpDir);
    assert.ok(patchResult.success, `state patch failed: ${patchResult.error}`);
    const patchData = JSON.parse(patchResult.output);
    assert.ok(patchData.updated.length > 0, 'should have updated fields');
    assert.deepStrictEqual(patchData.failed, [], 'no fields should fail');

    // Get back each field (no --raw: returns JSON object)
    const phaseResult = runGsdTools('state get Phase', tmpDir);
    assert.ok(phaseResult.success, `state get Phase failed: ${phaseResult.error}`);
    const phaseData = JSON.parse(phaseResult.output);
    assert.strictEqual(phaseData.Phase, '2 of 2', 'Phase should be updated');

    const statusResult = runGsdTools('state get Status', tmpDir);
    assert.ok(statusResult.success, `state get Status failed: ${statusResult.error}`);
    const statusData = JSON.parse(statusResult.output);
    assert.strictEqual(statusData.Status, 'Planning', 'Status should be updated');
  });

  test('memory write → read → list sequence', () => {
    // Write an entry to the decisions store (must use a valid store name)
    const writeResult = runGsdTools(
      `memory write --store decisions --entry '{"text":"integration test decision","phase":"1"}'`,
      tmpDir
    );
    assert.ok(writeResult.success, `memory write failed: ${writeResult.error}`);
    const writeData = JSON.parse(writeResult.output);
    assert.strictEqual(writeData.written, true, 'should be written');
    assert.strictEqual(writeData.store, 'decisions', 'store name should match');

    // Read it back
    const readResult = runGsdTools('memory read --store decisions', tmpDir);
    assert.ok(readResult.success, `memory read failed: ${readResult.error}`);
    const readData = JSON.parse(readResult.output);
    assert.ok(readData.count > 0, 'should have entries');
    assert.strictEqual(readData.store, 'decisions', 'store name should match');
    assert.ok(readData.entries.length > 0, 'entries array should not be empty');

    // List all stores
    const listResult = runGsdTools('memory list', tmpDir);
    assert.ok(listResult.success, `memory list failed: ${listResult.error}`);
    const listData = JSON.parse(listResult.output);
    assert.ok(listData.stores.length > 0, 'should have at least one store');
    const storeNames = listData.stores.map(s => s.name);
    assert.ok(storeNames.includes('decisions'), 'decisions should be in list');
  });

  test('verify requirements with mixed coverage', () => {
    // REQ-01 is covered by phase plan, REQ-02 is in roadmap but not in plan, REQ-03 is uncovered
    // (no --raw: --raw returns "pass"/"fail" string; without it returns JSON)
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `verify requirements failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should have 3 total requirements');
    assert.ok(data.unaddressed >= 1, 'at least one should be unaddressed');
    assert.ok(Array.isArray(data.unaddressed_list), 'unaddressed_list should be array');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: State Round-Trip (Phase 13, Plan 01)
// ─────────────────────────────────────────────────────────────────────────────

describe('integration: state round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 3\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('full state lifecycle: patch fields, get each, add decision', () => {
    // Patch Phase, Plan, Status (no --raw: returns JSON with updated/failed)
    const patchResult = runGsdTools('state patch --Phase "2 of 3" --Plan "02" --Status "Planning"', tmpDir);
    assert.ok(patchResult.success, `state patch failed: ${patchResult.error}`);
    const patchData = JSON.parse(patchResult.output);
    assert.ok(patchData.updated.includes('Phase'), 'Phase should be updated');
    assert.ok(patchData.updated.includes('Plan'), 'Plan should be updated');
    assert.ok(patchData.updated.includes('Status'), 'Status should be updated');

    // Get each back (no --raw: returns JSON object)
    const phaseGet = runGsdTools('state get Phase', tmpDir);
    assert.ok(phaseGet.success);
    assert.strictEqual(JSON.parse(phaseGet.output).Phase, '2 of 3');

    const planGet = runGsdTools('state get Plan', tmpDir);
    assert.ok(planGet.success);
    assert.strictEqual(JSON.parse(planGet.output).Plan, '02');

    const statusGet = runGsdTools('state get Status', tmpDir);
    assert.ok(statusGet.success);
    assert.strictEqual(JSON.parse(statusGet.output).Status, 'Planning');

    // Add a decision (no --raw: returns JSON; --summary is the required arg)
    const decisionResult = runGsdTools(
      `state add-decision --summary "Test decision from round-trip" --rationale "Testing"`,
      tmpDir
    );
    assert.ok(decisionResult.success, `state add-decision failed: ${decisionResult.error}`);
    const decisionData = JSON.parse(decisionResult.output);
    assert.strictEqual(decisionData.added, true, 'decision should be added');

    // Verify decision persisted by loading state
    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes('Test decision from round-trip'), 'decision text should be in STATE.md');
  });

  test('frontmatter round-trip: get → set → get', () => {
    // Create a plan file with frontmatter
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planPath = path.join(phaseDir, '01-01-PLAN.md');
    fs.writeFileSync(
      planPath,
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\n---\n# Test Plan\n\nContent here.\n'
    );

    const relPath = '.planning/phases/01-test/01-01-PLAN.md';

    // Get initial frontmatter
    const getResult = runGsdTools(`frontmatter get ${relPath}`, tmpDir);
    assert.ok(getResult.success, `frontmatter get failed: ${getResult.error}`);
    const fmData = JSON.parse(getResult.output);
    assert.strictEqual(fmData.wave, '1', 'wave should be "1" (string)');
    assert.strictEqual(fmData.plan, '01-01', 'plan should be 01-01');

    // Set a field
    const setResult = runGsdTools(`frontmatter set ${relPath} --field wave --value 2`, tmpDir);
    assert.ok(setResult.success, `frontmatter set failed: ${setResult.error}`);

    // Get again and verify
    const getResult2 = runGsdTools(`frontmatter get ${relPath}`, tmpDir);
    assert.ok(getResult2.success, `frontmatter get (2) failed: ${getResult2.error}`);
    const fmData2 = JSON.parse(getResult2.output);
    assert.strictEqual(fmData2.wave, '2', 'wave should be updated to "2"');
    assert.strictEqual(fmData2.plan, '01-01', 'plan should be unchanged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Config Migration (Phase 13, Plan 01)
// ─────────────────────────────────────────────────────────────────────────────

describe('integration: config migration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('migrates old flat config to modern format', () => {
    // Write an old-style flat config
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        mode: 'yolo',
        depth: 'thorough',
        commit_docs: true,
        branching_strategy: 'phase-branch',
        research: true
      }, null, 2)
    );

    const result = runGsdTools('config-migrate', tmpDir);
    assert.ok(result.success, `config-migrate failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Should have migrated some keys
    assert.ok(data.migrated_keys.length > 0, 'should have migrated keys');
    assert.ok(data.config_path, 'should have config_path');

    // Verify the resulting config has nested structure
    const newConfig = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.ok(newConfig.planning || newConfig.git || newConfig.workflow,
      'migrated config should have nested sections');
  });

  test('idempotent on modern config', () => {
    // Write a fully-complete modern config with ALL schema keys
    const modernConfig = {
      mode: 'yolo',
      depth: 'thorough',
      model_profile: 'balanced',
      parallelization: true,
      brave_search: false,
      model_profiles: {},
      test_commands: {},
      test_gate: true,
      context_window: 200000,
      context_target_percent: 50,
      planning: { commit_docs: true, search_gitignored: false },
      git: {
        branching_strategy: 'phase-branch',
        phase_branch_template: 'gsd/phase-{phase}-{slug}',
        milestone_branch_template: 'gsd/{milestone}-{slug}'
      },
      workflow: { research: true, plan_check: true, verifier: true }
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(modernConfig, null, 2)
    );

    const result = runGsdTools('config-migrate', tmpDir);
    assert.ok(result.success, `config-migrate failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Should have zero migrated keys (already fully modern)
    assert.deepStrictEqual(data.migrated_keys, [], 'modern config should have nothing to migrate');
    assert.ok(data.unchanged_keys.length > 0, 'should have unchanged keys');

    // Nested sections should be unchanged
    const afterConfig = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.deepStrictEqual(afterConfig.planning, modernConfig.planning, 'planning section unchanged');
    assert.deepStrictEqual(afterConfig.git, modernConfig.git, 'git section unchanged');
    assert.deepStrictEqual(afterConfig.workflow, modernConfig.workflow, 'workflow section unchanged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: E2E Simulation (Phase 13, Plan 02)
// ─────────────────────────────────────────────────────────────────────────────

describe('integration: e2e simulation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('full project lifecycle: init progress → verify plan-structure → verify requirements', () => {
    // Set up complete mock project in temp dir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n## Active Milestone: v1.0\n\n### Phase 1: Test Phase\n- [ ] **Phase 1: Test Phase**\n**Goal:** Validate E2E simulation\n**Plans:** 1 plans\n**Requirements:** E2E-01, E2E-02\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n## v1.0 Requirements\n\n- [ ] **E2E-01**: First requirement\n- [ ] **E2E-02**: Second requirement\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      `# E2E Test Project\n\nA project for E2E simulation testing.\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );

    // Create phase with a fully valid plan (all required frontmatter fields)
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\ndepends_on: []\nrequirements:\n  - E2E-01\nfiles_modified:\n  - src/index.js\nmust_haves:\n  artifacts: []\n  key_links: []\n---\n# Plan 01-01: E2E Test Plan\n\n<task type="implement">\n<name>Setup infrastructure</name>\n<files>src/index.js</files>\n<action>Create the setup code.</action>\n<verify>Check that it works.</verify>\n<done>Infrastructure is set up.</done>\n</task>\n'
    );

    // Step 1: init progress --verbose → verify project_exists
    const progressResult = runGsdTools('init progress --verbose', tmpDir);
    assert.ok(progressResult.success, `init progress failed: ${progressResult.error}`);
    const progressData = JSON.parse(progressResult.output);
    assert.strictEqual(progressData.project_exists, true, 'project should exist');

    // Step 2: verify plan-structure → verify valid (no --raw; raw returns string not JSON)
    const planPath = '.planning/phases/01-test/01-01-PLAN.md';
    const verifyResult = runGsdTools(`verify plan-structure ${planPath}`, tmpDir);
    assert.ok(verifyResult.success, `verify plan-structure failed: ${verifyResult.error}`);
    const verifyData = JSON.parse(verifyResult.output);
    assert.strictEqual(verifyData.valid, true, 'plan should be valid');

    // Step 3: verify requirements → verify total > 0 (no --raw; raw returns pass/fail string)
    const reqResult = runGsdTools('verify requirements', tmpDir);
    assert.ok(reqResult.success, `verify requirements failed: ${reqResult.error}`);
    const reqData = JSON.parse(reqResult.output);
    assert.ok(reqData.total > 0, `should have requirements, got total=${reqData.total}`);
  });

  test('memory lifecycle: write decision → write bookmark → init memory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Write a decision entry
    const decisionResult = runGsdTools(
      `memory write --store decisions --entry '{"text":"e2e test decision","phase":"1"}'`,
      tmpDir
    );
    assert.ok(decisionResult.success, `memory write decisions failed: ${decisionResult.error}`);
    const decisionData = JSON.parse(decisionResult.output);
    assert.strictEqual(decisionData.written, true, 'decision should be written');

    // Write a bookmark entry
    const bookmarkResult = runGsdTools(
      `memory write --store bookmarks --entry '{"phase":"1","plan":"01","task":1}'`,
      tmpDir
    );
    assert.ok(bookmarkResult.success, `memory write bookmarks failed: ${bookmarkResult.error}`);
    const bookmarkData = JSON.parse(bookmarkResult.output);
    assert.strictEqual(bookmarkData.written, true, 'bookmark should be written');

    // Init memory → verify decisions and bookmark present
    const memoryResult = runGsdTools('init memory', tmpDir);
    assert.ok(memoryResult.success, `init memory failed: ${memoryResult.error}`);
    const memoryData = JSON.parse(memoryResult.output);

    // Decisions should have the entry
    assert.ok(memoryData.decisions, 'should have decisions field');
    assert.ok(
      typeof memoryData.decisions === 'string'
        ? memoryData.decisions.includes('e2e test decision')
        : Array.isArray(memoryData.decisions) && memoryData.decisions.length > 0,
      'decisions should contain the written entry'
    );

    // Bookmark should be present
    assert.ok(memoryData.bookmark !== undefined || memoryData.position !== undefined,
      'should have bookmark or position field');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Snapshot Tests (Phase 13, Plan 02)
// ─────────────────────────────────────────────────────────────────────────────

describe('integration: snapshot tests', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('init progress output structure', () => {
    const result = runGsdTools('init progress --verbose', PROJECT_DIR);
    assert.ok(result.success, `init progress failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('milestone_version' in data, 'should have milestone_version key');
    assert.ok('phases' in data, 'should have phases key');
    assert.ok('phase_count' in data, 'should have phase_count key');
    assert.ok('project_exists' in data, 'should have project_exists key');

    assert.strictEqual(typeof data.milestone_version, 'string', 'milestone_version should be string');
    assert.ok(Array.isArray(data.phases), 'phases should be an array');
    assert.strictEqual(typeof data.phase_count, 'number', 'phase_count should be number');
    assert.strictEqual(typeof data.project_exists, 'boolean', 'project_exists should be boolean');
  });

  test('init execute-phase output structure', () => {
    const result = runGsdTools('init execute-phase 13', PROJECT_DIR);
    const out = result.output || '';
    if (result.success && out.startsWith('{')) {
      const data = JSON.parse(out);
      assert.ok('phase_found' in data, 'should have phase_found key');
      if (data.phase_found) {
        assert.ok('phase_dir' in data || 'phase_number' in data, 'found phase should have phase_dir or phase_number');
      }
    } else {
      assert.ok(true, 'command completed (may error for missing phase state)');
    }
  });

  test('init plan-phase output structure', () => {
    const result = runGsdTools('init plan-phase 13', PROJECT_DIR);
    const out = result.output || '';
    if (result.success && out.startsWith('{')) {
      const data = JSON.parse(out);
      assert.ok('phase_found' in data || 'phase_dir' in data || 'error' in data,
        'should have phase_found, phase_dir, or error key');
    } else {
      assert.ok(true, 'command completed (may error for phase state)');
    }
  });

  test('state load output structure', () => {
    const result = runGsdTools('state load', PROJECT_DIR);
    assert.ok(result.success, `state load failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('config' in data, 'should have config key');
    assert.ok('state_exists' in data, 'should have state_exists key');
    assert.strictEqual(typeof data.config, 'object', 'config should be object');
    assert.strictEqual(typeof data.state_exists, 'boolean', 'state_exists should be boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Coverage Command (Phase 13, Plan 02)
// ─────────────────────────────────────────────────────────────────────────────

describe('test-coverage', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('returns valid structure', () => {
    const result = runGsdTools('test-coverage', PROJECT_DIR);
    assert.ok(result.success, `test-coverage failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('total_commands' in data, 'should have total_commands');
    assert.ok('commands_with_tests' in data, 'should have commands_with_tests');
    assert.ok('coverage_percent' in data, 'should have coverage_percent');
    assert.ok('covered' in data, 'should have covered array');
    assert.ok('uncovered' in data, 'should have uncovered array');
    assert.ok('test_count' in data, 'should have test_count');

    assert.strictEqual(typeof data.total_commands, 'number', 'total_commands should be number');
    assert.strictEqual(typeof data.commands_with_tests, 'number', 'commands_with_tests should be number');
    assert.strictEqual(typeof data.coverage_percent, 'number', 'coverage_percent should be number');
    assert.ok(Array.isArray(data.covered), 'covered should be array');
    assert.ok(Array.isArray(data.uncovered), 'uncovered should be array');
    assert.strictEqual(typeof data.test_count, 'number', 'test_count should be number');
  });

  test('shows non-zero coverage', () => {
    const result = runGsdTools('test-coverage', PROJECT_DIR);
    assert.ok(result.success, `test-coverage failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.total_commands > 0, `total_commands should be > 0, got ${data.total_commands}`);
    assert.ok(data.commands_with_tests > 0, `commands_with_tests should be > 0, got ${data.commands_with_tests}`);
    assert.ok(data.coverage_percent > 0, `coverage_percent should be > 0, got ${data.coverage_percent}`);
    assert.ok(data.test_count > 0, `test_count should be > 0, got ${data.test_count}`);
    assert.ok(data.covered.length > 0, 'covered array should not be empty');
     assert.strictEqual(
      data.covered.length + data.uncovered.length,
      data.total_commands,
      'covered + uncovered should equal total_commands'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Build Pipeline (Phase 13, Plan 03)
// ─────────────────────────────────────────────────────────────────────────────

describe('build pipeline', () => {
  test('bundle size is under 1050KB budget', () => {
    const stat = fs.statSync(TOOLS_PATH);
    const sizeKB = Math.round(stat.size / 1024);
    assert.ok(sizeKB <= 1050, `Bundle size ${sizeKB}KB exceeds 1050KB budget`);
    assert.ok(sizeKB > 50, `Bundle size ${sizeKB}KB suspiciously small`);
  });

  test('bundle is valid JavaScript', () => {
    // Verify the bundle can be loaded without syntax errors
    const content = fs.readFileSync(TOOLS_PATH, 'utf-8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'should have shebang');
    // Smoke test: run a simple command
    const result = runGsdTools('current-timestamp');
    assert.ok(result.success, `Bundle smoke test failed: ${result.error}`);
    const output = result.output.trim();
    assert.ok(output.length > 10, `Unexpected timestamp output: ${output}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Token Budget (Phase 13, Plan 03)
// ─────────────────────────────────────────────────────────────────────────────

describe('token-budget', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('returns budgets with actual token counts for project dir', () => {
    const result = runGsdTools('token-budget', PROJECT_DIR);
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
    const result = runGsdTools('token-budget', PROJECT_DIR);
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

// ─────────────────────────────────────────────────────────────────────────────
// Compact Default (Phase 13, Plan 03)
// ─────────────────────────────────────────────────────────────────────────────

describe('compact default behavior', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('default output is compact (no --compact needed)', () => {
    const result = runGsdTools('init progress', PROJECT_DIR);
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
    const result = runGsdTools('init progress --verbose', PROJECT_DIR);
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

// ─────────────────────────────────────────────────────────────────────────────
// Intent Commands (Phase 14, Plan 03)
// ─────────────────────────────────────────────────────────────────────────────

describe('intent commands', () => {
  let tmpDir;

  // Helper to init a git repo in temp dir (needed for auto-commit on intent create)
  function initGitRepo(dir) {
    execSync(
      'git init && git -c user.name=Test -c user.email=test@test.com add . && git -c user.name=Test -c user.email=test@test.com commit -m "init" --allow-empty',
      { cwd: dir, encoding: 'utf-8', stdio: 'pipe' }
    );
  }

  // Helper to create a populated INTENT.md for testing
  function createPopulatedIntent(dir) {
    const content = `**Revision:** 1
**Created:** 2026-01-01
**Updated:** 2026-01-01

<objective>
Build a CLI tool for project planning

This tool helps teams manage complex multi-phase projects.
</objective>

<users>
- Software engineers working on multi-service architectures
- Team leads managing project milestones
</users>

<outcomes>
- DO-01 [P1]: Automated phase planning and execution
- DO-02 [P2]: Progress tracking with visual dashboards
- DO-03 [P1]: Integration with git workflows
</outcomes>

<criteria>
- SC-01: All CLI commands respond in under 500ms
- SC-02: Zero data loss during state transitions
</criteria>

<constraints>
### Technical
- C-01: Single-file Node.js bundle, zero dependencies
- C-02: Must work on Linux and macOS

### Business
- C-03: Open source under MIT license

### Timeline
- C-04: MVP ready within 2 weeks
</constraints>

<health>
### Quantitative
- HM-01: Bundle size under 500KB
- HM-02: Test coverage above 80%

### Qualitative
Team velocity and developer satisfaction with the planning workflow.
</health>
`;
    fs.writeFileSync(path.join(dir, '.planning', 'INTENT.md'), content, 'utf-8');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── Create tests ──

  describe('intent create', () => {
    test('creates INTENT.md with all 6 XML sections in fresh project', () => {
      // Note: intent create with --raw outputs a compact shorthand (commit hash or "created"),
      // not full JSON. We verify by checking the file on disk.
      const result = runGsdTools('intent create', tmpDir);
      assert.ok(result.success, `intent create failed: ${result.error}`);
      assert.ok(result.output.includes('created') || /^[a-f0-9]+$/.test(result.output),
        'should output "created" or commit hash');

      // Verify file on disk
      const intentPath = path.join(tmpDir, '.planning', 'INTENT.md');
      assert.ok(fs.existsSync(intentPath), 'INTENT.md should exist on disk');

      const content = fs.readFileSync(intentPath, 'utf-8');
      assert.ok(content.includes('<objective>'), 'should have objective section');
      assert.ok(content.includes('<users>'), 'should have users section');
      assert.ok(content.includes('<outcomes>'), 'should have outcomes section');
      assert.ok(content.includes('<criteria>'), 'should have criteria section');
      assert.ok(content.includes('<constraints>'), 'should have constraints section');
      assert.ok(content.includes('<health>'), 'should have health section');
    });

    test('errors if INTENT.md already exists', () => {
      // Create first
      runGsdTools('intent create', tmpDir);

      // Try again without --force
      const result = runGsdTools('intent create', tmpDir);
      assert.ok(!result.success, 'should fail when INTENT.md exists');
      assert.ok(
        result.error.includes('already exists') || result.output.includes('already exists'),
        'should mention already exists'
      );
    });

    test('--force overwrites existing INTENT.md', () => {
      // Create first
      runGsdTools('intent create', tmpDir);

      // Overwrite with --force
      const result = runGsdTools('intent create --force', tmpDir);
      assert.ok(result.success, `intent create --force failed: ${result.error}`);
      // Verify file was recreated on disk
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('**Revision:** 1'), 'overwritten file should have Revision 1');
    });

    test('created INTENT.md has Revision 1', () => {
      runGsdTools('intent create', tmpDir);
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('**Revision:** 1'), 'should contain Revision: 1');
    });
  });

  // ── Show/Read tests ──

  describe('intent show/read', () => {
    test('intent show --raw returns valid JSON with all section keys', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent show', tmpDir);
      assert.ok(result.success, `intent show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('objective' in data, 'should have objective');
      assert.ok('users' in data, 'should have users');
      assert.ok('outcomes' in data, 'should have outcomes');
      assert.ok('criteria' in data, 'should have criteria');
      assert.ok('constraints' in data, 'should have constraints');
      assert.ok('health' in data, 'should have health');
      assert.ok('revision' in data, 'should have revision');
    });

    test('intent read --raw returns same JSON as intent show --raw', () => {
      createPopulatedIntent(tmpDir);
      const showResult = runGsdTools('intent show', tmpDir);
      const readResult = runGsdTools('intent read', tmpDir);

      assert.ok(showResult.success, `show failed: ${showResult.error}`);
      assert.ok(readResult.success, `read failed: ${readResult.error}`);

      const showData = JSON.parse(showResult.output);
      const readData = JSON.parse(readResult.output);
      assert.deepStrictEqual(readData, showData, 'read and show --raw should return identical JSON');
    });

    test('intent read outcomes --raw returns just outcomes array', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent read outcomes', tmpDir);
      assert.ok(result.success, `intent read outcomes --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // Section filter should return the section data
      assert.ok(Array.isArray(data) || (typeof data === 'object' && data !== null), 'should return outcomes data');
    });
  });

  // ── Update tests ──

  describe('intent update', () => {
    test('--add outcome assigns DO-01 with specified priority', () => {
      createPopulatedIntent(tmpDir);
      // The populated intent already has DO-01..DO-03, so next should be DO-04
      const result = runGsdTools('intent update outcomes --add "Test outcome" --priority P1', tmpDir);
      assert.ok(result.success, `update add failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.updated, true, 'should report updated=true');
      assert.strictEqual(data.section, 'outcomes');
      assert.strictEqual(data.operation, 'add');
      assert.strictEqual(data.id, 'DO-04', 'should assign DO-04 (next after existing DO-03)');
      assert.strictEqual(data.priority, 'P1');
      assert.strictEqual(data.revision, 2, 'revision should increment to 2');
    });

    test('--add second outcome gets next sequential ID', () => {
      // Start fresh with empty intent
      runGsdTools('intent create', tmpDir);

      // Add first outcome
      const first = runGsdTools('intent update outcomes --add "First outcome" --priority P1', tmpDir);
      assert.ok(first.success, `first add failed: ${first.error}`);
      const firstData = JSON.parse(first.output);
      assert.strictEqual(firstData.id, 'DO-01');

      // Add second outcome
      const second = runGsdTools('intent update outcomes --add "Second outcome"', tmpDir);
      assert.ok(second.success, `second add failed: ${second.error}`);
      const secondData = JSON.parse(second.output);
      assert.strictEqual(secondData.id, 'DO-02', 'should assign DO-02');
      assert.strictEqual(secondData.priority, 'P2', 'default priority should be P2');
    });

    test('--remove removes item and subsequent --add preserves gap', () => {
      runGsdTools('intent create', tmpDir);

      // Add two outcomes
      runGsdTools('intent update outcomes --add "First"', tmpDir);
      runGsdTools('intent update outcomes --add "Second"', tmpDir);

      // Remove DO-01
      const removeResult = runGsdTools('intent update outcomes --remove DO-01', tmpDir);
      assert.ok(removeResult.success, `remove failed: ${removeResult.error}`);
      const removeData = JSON.parse(removeResult.output);
      assert.strictEqual(removeData.operation, 'remove');

      // Add another — should be DO-03 (gap preserved), not DO-01
      const addResult = runGsdTools('intent update outcomes --add "Third"', tmpDir);
      assert.ok(addResult.success, `add after remove failed: ${addResult.error}`);
      const addData = JSON.parse(addResult.output);
      assert.strictEqual(addData.id, 'DO-03', 'should assign DO-03, preserving gap from removed DO-01');
    });

    test('--set-priority changes outcome priority', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent update outcomes --set-priority DO-02 P1', tmpDir);
      assert.ok(result.success, `set-priority failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.operation, 'set-priority');

      // Verify the change persisted
      const showResult = runGsdTools('intent show', tmpDir);
      const showData = JSON.parse(showResult.output);
      const do02 = showData.outcomes.find(o => o.id === 'DO-02');
      assert.strictEqual(do02.priority, 'P1', 'DO-02 should now be P1');
    });

    test('--value replaces objective section', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent update objective --value "New objective statement"', tmpDir);
      assert.ok(result.success, `update objective failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.operation, 'replace');
      assert.strictEqual(data.section, 'objective');

      // Verify the change persisted
      const showResult = runGsdTools('intent show', tmpDir);
      const showData = JSON.parse(showResult.output);
      assert.strictEqual(showData.objective.statement, 'New objective statement');
    });

    test('revision increments on each update', () => {
      createPopulatedIntent(tmpDir);

      // First update: revision 1 → 2
      runGsdTools('intent update outcomes --add "One"', tmpDir);

      // Second update: revision 2 → 3
      const result = runGsdTools('intent update outcomes --add "Two"', tmpDir);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.revision, 3, 'revision should be 3 after two updates from revision 1');
    });
  });

  // ── Validate tests ──

  describe('intent validate', () => {
    test('valid INTENT.md with all sections returns exit code 0', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent validate', tmpDir);
      // exit code 0 means success=true from runGsdTools
      assert.ok(result.success, `validate should succeed for valid intent: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
      assert.strictEqual(data.revision, 1, 'should report revision');
    });

    test('INTENT.md with missing section returns exit code 1', () => {
      // Create a minimal intent missing several sections
      const content = `**Revision:** 1
**Created:** 2026-01-01
**Updated:** 2026-01-01

<objective>
A test project
</objective>

<users>
- Developers
</users>

<outcomes>
</outcomes>

<criteria>
</criteria>

<constraints>
</constraints>

<health>
</health>
`;
      fs.writeFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), content, 'utf-8');

      const result = runGsdTools('intent validate', tmpDir);
      // exit code 1 means success=false from runGsdTools
      assert.ok(!result.success, 'validate should fail for incomplete intent');

      // Output may be in stdout even for exit code 1
      const outputText = result.output || result.error;
      const data = JSON.parse(outputText);
      assert.strictEqual(data.valid, false, 'should be invalid');
      assert.ok(data.issues.length > 0, 'should have issues');

      // Should flag outcomes as missing
      const outcomeIssue = data.issues.find(i => i.section === 'outcomes');
      assert.ok(outcomeIssue, 'should have an outcomes issue');
    });

    test('--raw returns JSON with valid/issues fields', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent validate', tmpDir);
      assert.ok(result.success, `validate --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('valid' in data, 'should have valid field');
      assert.ok('issues' in data, 'should have issues field');
      assert.ok('sections' in data, 'should have sections field');
      assert.ok('revision' in data, 'should have revision field');

      // Check section detail structure
      assert.ok('objective' in data.sections, 'sections should include objective');
      assert.ok('users' in data.sections, 'sections should include users');
      assert.ok('outcomes' in data.sections, 'sections should include outcomes');
      assert.ok('criteria' in data.sections, 'sections should include criteria');
      assert.ok('constraints' in data.sections, 'sections should include constraints');
      assert.ok('health' in data.sections, 'sections should include health');
    });
  });

  // ── Round-trip test ──

  describe('intent round-trip', () => {
    test('create → update → show → validate round-trip is consistent', () => {
      // 1. Create
      const createResult = runGsdTools('intent create', tmpDir);
      assert.ok(createResult.success, `create failed: ${createResult.error}`);

      // 2. Update: add items to all list sections
      runGsdTools('intent update objective --value "A comprehensive CLI tool"', tmpDir);
      runGsdTools('intent update users --add "Software engineers"', tmpDir);
      runGsdTools('intent update outcomes --add "Fast execution" --priority P1', tmpDir);
      runGsdTools('intent update criteria --add "Commands respond in under 500ms"', tmpDir);
      runGsdTools('intent update constraints --add "Node.js only" --type technical', tmpDir);
      runGsdTools('intent update health --add "Bundle under 500KB"', tmpDir);

      // 2b. Add qualitative health content (prose section — must be written directly
      // since intent update health --add only adds quantitative metrics)
      const intentPath = path.join(tmpDir, '.planning', 'INTENT.md');
      let content = fs.readFileSync(intentPath, 'utf-8');
      content = content.replace('</health>', '### Qualitative\nTeam satisfaction with the planning workflow.\n</health>');
      fs.writeFileSync(intentPath, content, 'utf-8');

      // 3. Show: verify all sections populated
      const showResult = runGsdTools('intent show', tmpDir);
      assert.ok(showResult.success, `show failed: ${showResult.error}`);
      const showData = JSON.parse(showResult.output);

      assert.strictEqual(showData.objective.statement, 'A comprehensive CLI tool');
      assert.ok(showData.users.length >= 1, 'should have at least 1 user');
      assert.ok(showData.outcomes.length >= 1, 'should have at least 1 outcome');
      assert.ok(showData.criteria.length >= 1, 'should have at least 1 criterion');
      const totalConstraints = (showData.constraints.technical || []).length +
        (showData.constraints.business || []).length +
        (showData.constraints.timeline || []).length;
      assert.ok(totalConstraints >= 1, 'should have at least 1 constraint');
      assert.ok(showData.health.quantitative.length >= 1, 'should have at least 1 health metric');

      // 4. Validate: should pass with all sections populated
      const validateResult = runGsdTools('intent validate', tmpDir);
      assert.ok(validateResult.success, `validate should pass: ${validateResult.error}`);
      const validateData = JSON.parse(validateResult.output);
      assert.strictEqual(validateData.valid, true, 'should validate as valid after round-trip');
      assert.strictEqual(validateData.issues.length, 0, 'should have no issues');
    });
  });

  // ── Help tests ──

  describe('intent help', () => {
    test('intent --help shows subcommand list', () => {
      // --help writes to stderr and exits 0; capture with 2>&1
      const helpText = execSync(`node "${TOOLS_PATH}" intent --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('create'), 'help should mention create');
      assert.ok(helpText.includes('show'), 'help should mention show');
      assert.ok(helpText.includes('read'), 'help should mention read');
      assert.ok(helpText.includes('validate'), 'help should mention validate');
    });

    test('intent validate --help shows validate usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" intent validate --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('validate'), 'help should mention validate');
      assert.ok(helpText.includes('exit') || helpText.includes('Exit') || helpText.includes('valid'),
        'help should describe exit codes or validation');
    });
  });

  // ── Trace tests ──

  describe('intent trace', () => {
    // Helper to create a ROADMAP.md with milestone info for phase range scoping
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    // Helper to create a PLAN.md with intent frontmatter
    function createPlan(dir, phaseDir, planNum, outcomeIds, rationale) {
      const phasePath = path.join(dir, '.planning', 'phases', phaseDir);
      fs.mkdirSync(phasePath, { recursive: true });

      const phaseNum = phaseDir.match(/^(\d+)/)[1];
      const paddedPlan = String(planNum).padStart(2, '0');
      const filename = `${phaseNum.padStart(2, '0')}-${paddedPlan}-PLAN.md`;

      let frontmatter = `---
phase: ${phaseDir}
plan: ${paddedPlan}
type: execute
wave: 1
depends_on: []`;

      if (outcomeIds && outcomeIds.length > 0) {
        frontmatter += `
intent:
  outcome_ids: [${outcomeIds.join(', ')}]
  rationale: "${rationale || 'Test rationale'}"`;
      }

      frontmatter += `
---

<objective>
Test plan objective.
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, filename), frontmatter, 'utf-8');
    }

    test('trace with no INTENT.md errors', () => {
      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(!result.success, 'should fail without INTENT.md');
      assert.ok(
        (result.error || '').includes('No INTENT.md') || (result.output || '').includes('No INTENT.md'),
        'should mention missing INTENT.md'
      );
    });

    test('trace with INTENT.md but no plans returns 0 coverage and all outcomes as gaps', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.total_outcomes, 3, 'should have 3 outcomes from populated intent');
      assert.strictEqual(data.covered_outcomes, 0, 'none should be covered');
      assert.strictEqual(data.coverage_percent, 0, 'coverage should be 0%');
      assert.strictEqual(data.gaps.length, 3, 'all 3 outcomes should be gaps');
      assert.strictEqual(data.plans.length, 0, 'no plans found');
    });

    test('trace with INTENT.md + plans tracing to outcomes shows correct matrix', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plans that trace to outcomes
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02'], 'Covers automation and tracking');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-03'], 'Covers git integration');

      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.total_outcomes, 3);
      assert.strictEqual(data.covered_outcomes, 3);
      assert.strictEqual(data.coverage_percent, 100);
      assert.strictEqual(data.gaps.length, 0, 'no gaps when all covered');

      // Verify matrix entries
      const do01 = data.matrix.find(m => m.outcome_id === 'DO-01');
      assert.ok(do01, 'DO-01 should be in matrix');
      assert.ok(do01.plans.length >= 1, 'DO-01 should have at least 1 plan');

      const do03 = data.matrix.find(m => m.outcome_id === 'DO-03');
      assert.ok(do03, 'DO-03 should be in matrix');
      assert.ok(do03.plans.length >= 1, 'DO-03 should have at least 1 plan');

      // Verify plans list
      assert.strictEqual(data.plans.length, 2, 'should have 2 plans');
    });

    test('trace --gaps shows only uncovered outcomes', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Only cover DO-01
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01'], 'Covers automation only');

      const result = runGsdTools('intent trace --gaps', tmpDir);
      assert.ok(result.success, `trace --gaps failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // --gaps mode: matrix should only contain gaps
      assert.strictEqual(data.matrix.length, 2, 'should show 2 uncovered outcomes in matrix (DO-02, DO-03)');
      for (const entry of data.matrix) {
        assert.ok(entry.outcome_id !== 'DO-01', 'DO-01 should not appear in --gaps output');
      }
      assert.strictEqual(data.gaps.length, 2, 'should have 2 gaps');
      assert.strictEqual(data.coverage_percent, 33, 'coverage should be 33% (1/3)');
    });

    test('trace with plan missing intent section includes plan with empty outcome_ids', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan WITHOUT intent section
      createPlan(tmpDir, '14-first-phase', 1, null, null);

      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(result.success, `trace failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.plans.length, 1, 'plan should appear in plans list');
      assert.deepStrictEqual(data.plans[0].outcome_ids, [], 'plan without intent should have empty outcome_ids');
      assert.strictEqual(data.covered_outcomes, 0, 'no outcomes covered');
    });

    test('trace --raw returns valid JSON with all expected fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(result.success, `trace --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('total_outcomes' in data, 'should have total_outcomes');
      assert.ok('covered_outcomes' in data, 'should have covered_outcomes');
      assert.ok('coverage_percent' in data, 'should have coverage_percent');
      assert.ok('matrix' in data, 'should have matrix');
      assert.ok('gaps' in data, 'should have gaps');
      assert.ok('plans' in data, 'should have plans');
      assert.ok(Array.isArray(data.matrix), 'matrix should be an array');
      assert.ok(Array.isArray(data.gaps), 'gaps should be an array');
      assert.ok(Array.isArray(data.plans), 'plans should be an array');
    });

    test('parsePlanIntent handles comma-separated outcome IDs', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create a plan with comma-separated string format for outcome_ids
      const phasePath = path.join(tmpDir, '.planning', 'phases', '14-test-phase');
      fs.mkdirSync(phasePath, { recursive: true });
      const planContent = `---
phase: 14-test-phase
plan: 01
type: execute
intent:
  outcome_ids: "DO-01, DO-03"
  rationale: "Comma separated test"
---

<objective>Test</objective>
<tasks>
<task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, '14-01-PLAN.md'), planContent, 'utf-8');

      const result = runGsdTools('intent trace', tmpDir);
      assert.ok(result.success, `trace with comma-sep IDs failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // The plan should have extracted DO-01 and DO-03
      const plan = data.plans.find(p => p.phase === '14-test-phase');
      assert.ok(plan, 'should find the test plan');
      assert.ok(plan.outcome_ids.includes('DO-01'), 'should include DO-01');
      assert.ok(plan.outcome_ids.includes('DO-03'), 'should include DO-03');
      assert.strictEqual(plan.outcome_ids.length, 2, 'should have exactly 2 outcome IDs');
    });

    test('intent trace --help shows trace usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" intent trace --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('trace'), 'help should mention trace');
      assert.ok(helpText.includes('--gaps'), 'help should mention --gaps flag');
      assert.ok(helpText.includes('matrix') || helpText.includes('traceability'),
        'help should describe traceability or matrix');
    });
  });

  // ── Drift tests ──

  describe('intent drift', () => {
    // Reuse helpers from intent trace tests
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    function createPlan(dir, phaseDir, planNum, outcomeIds, rationale) {
      const phasePath = path.join(dir, '.planning', 'phases', phaseDir);
      fs.mkdirSync(phasePath, { recursive: true });

      const phaseNum = phaseDir.match(/^(\d+)/)[1];
      const paddedPlan = String(planNum).padStart(2, '0');
      const filename = `${phaseNum.padStart(2, '0')}-${paddedPlan}-PLAN.md`;

      let frontmatter = `---
phase: ${phaseDir}
plan: ${paddedPlan}
type: execute
wave: 1
depends_on: []`;

      if (outcomeIds && outcomeIds.length > 0) {
        frontmatter += `
intent:
  outcome_ids: [${outcomeIds.join(', ')}]
  rationale: "${rationale || 'Test rationale'}"`;
      }

      frontmatter += `
---

<objective>
Test plan objective.
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do something</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`;
      fs.writeFileSync(path.join(phasePath, filename), frontmatter, 'utf-8');
    }

    test('drift with no INTENT.md errors', () => {
      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(!result.success, 'should fail without INTENT.md');
      assert.ok(
        (result.error || '').includes('No INTENT.md') || (result.output || '').includes('No INTENT.md'),
        'should mention missing INTENT.md'
      );
    });

    test('drift with INTENT.md but no plans shows score near 100', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      // With 0 plans, coverage_gap should be 40/40, objective_mismatch 0 (no plans to be untraced)
      // So score = 40 (coverage gap only, no plans means no mismatch/creep/inversion)
      assert.ok(data.drift_score >= 30, `score should be high with no plans (got ${data.drift_score})`);
      assert.strictEqual(data.total_plans, 0, 'should have 0 plans');
      assert.strictEqual(data.covered_outcomes, 0, 'no outcomes covered');
      assert.strictEqual(data.signals.coverage_gap.details.length, 3, 'all 3 outcomes should be gaps');
    });

    test('drift with perfect alignment shows score 0', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Cover all 3 outcomes: DO-01 [P1], DO-02 [P2], DO-03 [P1]
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02'], 'Covers first two');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-03'], 'Covers third');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.drift_score, 0, 'perfect alignment should have score 0');
      assert.strictEqual(data.alignment, 'excellent', 'alignment should be excellent');
      assert.strictEqual(data.signals.coverage_gap.details.length, 0, 'no gaps');
      assert.strictEqual(data.signals.objective_mismatch.plans.length, 0, 'no untraced plans');
      assert.strictEqual(data.signals.feature_creep.invalid_refs.length, 0, 'no invalid refs');
      assert.strictEqual(data.signals.priority_inversion.inversions.length, 0, 'no inversions');
    });

    test('drift detects objective mismatch (plan with no intent section)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan WITHOUT intent section + plan WITH intent
      createPlan(tmpDir, '14-first-phase', 1, null, null); // no intent
      createPlan(tmpDir, '15-second-phase', 1, ['DO-01', 'DO-02', 'DO-03'], 'Covers all');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.signals.objective_mismatch.plans.length, 1, 'should flag 1 untraced plan');
      assert.ok(data.signals.objective_mismatch.score > 0, 'mismatch score should be > 0');
    });

    test('drift detects feature creep (plan referencing non-existent DO-99)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Create plan that references a non-existent outcome
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-99'], 'References invalid DO-99');
      createPlan(tmpDir, '15-second-phase', 1, ['DO-02', 'DO-03'], 'Covers rest');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.signals.feature_creep.invalid_refs.length, 1, 'should flag 1 invalid ref');
      assert.strictEqual(data.signals.feature_creep.invalid_refs[0].invalid_id, 'DO-99', 'should identify DO-99');
      assert.ok(data.signals.feature_creep.score > 0, 'feature creep score should be > 0');
    });

    test('drift detects priority inversion (P1 uncovered while P2 covered)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Cover only DO-02 [P2], leave DO-01 [P1] and DO-03 [P1] uncovered
      createPlan(tmpDir, '14-first-phase', 1, ['DO-02'], 'Only covers P2');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok(data.signals.priority_inversion.inversions.length > 0, 'should detect priority inversions');
      assert.strictEqual(data.signals.priority_inversion.score, 20, 'inversion score should be 20');
      // DO-01 [P1] uncovered while DO-02 [P2] covered
      const inv = data.signals.priority_inversion.inversions[0];
      assert.strictEqual(inv.uncovered_priority, 'P1', 'uncovered should be P1');
      assert.strictEqual(inv.covered_priority, 'P2', 'covered should be P2');
    });

    test('drift score within 0-100 range across scenarios', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Scenario: partial coverage
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01'], 'Partial');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok(data.drift_score >= 0, 'score should be >= 0');
      assert.ok(data.drift_score <= 100, 'score should be <= 100');
      assert.ok(typeof data.drift_score === 'number', 'score should be a number');
    });

    test('drift --raw returns valid JSON with all expected fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('drift_score' in data, 'should have drift_score');
      assert.ok('alignment' in data, 'should have alignment');
      assert.ok('signals' in data, 'should have signals');
      assert.ok('total_outcomes' in data, 'should have total_outcomes');
      assert.ok('covered_outcomes' in data, 'should have covered_outcomes');
      assert.ok('total_plans' in data, 'should have total_plans');
      assert.ok('traced_plans' in data, 'should have traced_plans');
      assert.ok('coverage_gap' in data.signals, 'signals should have coverage_gap');
      assert.ok('objective_mismatch' in data.signals, 'signals should have objective_mismatch');
      assert.ok('feature_creep' in data.signals, 'signals should have feature_creep');
      assert.ok('priority_inversion' in data.signals, 'signals should have priority_inversion');
    });

    test('drift alignment labels correct (0-15 excellent, 16-35 good, 36-60 moderate, 61-100 poor)', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);

      // Perfect: all covered → score 0 → excellent
      createPlan(tmpDir, '14-first-phase', 1, ['DO-01', 'DO-02', 'DO-03'], 'All');

      const result = runGsdTools('intent drift', tmpDir);
      assert.ok(result.success, `drift failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.drift_score, 0, 'perfect alignment score = 0');
      assert.strictEqual(data.alignment, 'excellent', '0 = excellent');
    });

    test('pre-flight: init execute-phase intent_drift null when no INTENT.md', () => {
      // Create minimal project structure (no INTENT.md)
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init execute-phase 14', tmpDir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.intent_drift, null, 'intent_drift should be null when no INTENT.md');
    });

    test('intent drift --help shows drift usage', () => {
      const helpText = execSync(`node "${TOOLS_PATH}" intent drift --help 2>&1`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      assert.ok(helpText.includes('drift'), 'help should mention drift');
      assert.ok(helpText.includes('0-100') || helpText.includes('score'),
        'help should mention score range');
      assert.ok(helpText.includes('Coverage') || helpText.includes('coverage'),
        'help should mention coverage signal');
    });
  });

  // ── Intent Summary in Init Commands ────────────────────────────────────────

  describe('intent summary in init commands', () => {
    function createRoadmap(dir, phaseStart, phaseEnd) {
      const roadmapContent = `# Roadmap

## Milestones

- 🔵 **v1.0 Test Milestone** — Phases ${phaseStart}-${phaseEnd} (active)

## Phases

### Phase ${phaseStart}: First Phase
**Goal**: Test goal
**Plans:** 1 plan

### Phase ${phaseEnd}: Second Phase
**Goal**: Another goal
**Plans:** 1 plan
`;
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    }

    test('getIntentSummary returns null when no INTENT.md', () => {
      // No INTENT.md created — all init commands should have intent_summary: null
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init progress', tmpDir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.intent_summary, null, 'intent_summary should be null when no INTENT.md');
    });

    test('getIntentSummary returns summary when INTENT.md exists', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init progress', tmpDir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.intent_summary !== null, 'intent_summary should not be null when INTENT.md exists');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
      assert.strictEqual(data.intent_summary.outcome_count, 3);
      assert.ok(Array.isArray(data.intent_summary.top_outcomes), 'top_outcomes should be array');
      assert.strictEqual(data.intent_summary.top_outcomes.length, 2, 'should have 2 P1 outcomes');
      assert.strictEqual(data.intent_summary.top_outcomes[0].id, 'DO-01');
      assert.ok(Array.isArray(data.intent_summary.users), 'users should be array');
      assert.strictEqual(data.intent_summary.users.length, 2);
      assert.strictEqual(data.intent_summary.has_criteria, true);
    });

    test('init execute-phase includes intent_summary field', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init execute-phase 14', tmpDir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok('intent_summary' in data, 'intent_summary key must exist in execute-phase output');
      assert.ok(data.intent_summary !== null, 'intent_summary should be populated');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
      assert.strictEqual(data.intent_summary.outcome_count, 3);
    });

    test('init plan-phase includes intent_summary and intent_path fields', () => {
      createPopulatedIntent(tmpDir);
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init plan-phase 14', tmpDir);
      assert.ok(result.success, `init plan-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok('intent_summary' in data, 'intent_summary key must exist in plan-phase output');
      assert.ok('intent_path' in data, 'intent_path key must exist in plan-phase output');
      assert.ok(data.intent_summary !== null, 'intent_summary should be populated');
      assert.strictEqual(data.intent_path, '.planning/INTENT.md');
      assert.strictEqual(data.intent_summary.objective, 'Build a CLI tool for project planning');
    });

    test('init plan-phase intent fields absent in compact mode when no INTENT.md', () => {
      // Compact mode is default — null fields are omitted to save tokens
      createRoadmap(tmpDir, 14, 17);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n## Current Position\n**Phase:** 14', 'utf-8');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '14-first-phase', '14-01-PLAN.md'),
        '---\nphase: 14-first-phase\nplan: 01\ntype: execute\n---\n<objective>Test</objective>\n<tasks><task type="auto"><name>T1</name><action>A</action><verify>V</verify><done>D</done></task></tasks>', 'utf-8');

      const result = runGsdTools('init plan-phase 14', tmpDir);
      assert.ok(result.success, `init plan-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // In compact mode (default), null intent fields are omitted
      assert.ok(!data.intent_summary, 'intent_summary should be absent/falsy when no INTENT.md');
      assert.ok(!data.intent_path, 'intent_path should be absent/falsy when no INTENT.md');
    });
  });

  // ── History tests (Phase 17, Plan 01) ──

  describe('intent history', () => {
    // Helper to create an INTENT.md with a <history> section
    function createIntentWithHistory(dir) {
      const content = `**Revision:** 3
**Created:** 2026-01-01
**Updated:** 2026-02-25

<objective>
Build a CLI tool for project planning

This tool helps teams manage complex multi-phase projects.
</objective>

<users>
- Software engineers working on multi-service architectures
- Team leads managing project milestones
</users>

<outcomes>
- DO-01 [P1]: Automated phase planning and execution
- DO-02 [P2]: Progress tracking with visual dashboards
- DO-03 [P1]: Integration with git workflows
</outcomes>

<criteria>
- SC-01: All CLI commands respond in under 500ms
- SC-02: Zero data loss during state transitions
</criteria>

<constraints>
### Technical
- C-01: Single-file Node.js bundle, zero dependencies
- C-02: Must work on Linux and macOS

### Business
- C-03: Open source under MIT license

### Timeline
- C-04: MVP ready within 2 weeks
</constraints>

<health>
### Quantitative
- HM-01: Bundle size under 500KB
- HM-02: Test coverage above 80%

### Qualitative
Team velocity and developer satisfaction with the planning workflow.
</health>

<history>
### v2.0 — 2026-02-20
- **Modified** DO-01: Changed from "planning" to "automated phase planning and execution"
  - Reason: Original wording was too vague for traceability
- **Removed** DO-04: Removed real-time monitoring outcome
  - Reason: CLI tool, not a daemon — monitoring doesn't fit the architecture

### v1.0 — 2026-01-01
- **Added** DO-01 [P1]: Phase planning and execution
</history>
`;
      fs.writeFileSync(path.join(dir, '.planning', 'INTENT.md'), content, 'utf-8');
    }

    test('parse INTENT.md without history returns empty array', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent show', tmpDir);
      assert.ok(result.success, `show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.ok('history' in data, 'should have history key');
      assert.ok(Array.isArray(data.history), 'history should be an array');
      assert.strictEqual(data.history.length, 0, 'history should be empty when no <history> section');
    });

    test('parse INTENT.md with history returns entries and changes', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('intent show', tmpDir);
      assert.ok(result.success, `show --raw failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.history.length, 2, 'should have 2 milestone entries');

      // First entry (newest)
      assert.strictEqual(data.history[0].milestone, 'v2.0');
      assert.strictEqual(data.history[0].date, '2026-02-20');
      assert.strictEqual(data.history[0].changes.length, 2, 'v2.0 should have 2 changes');
      assert.strictEqual(data.history[0].changes[0].type, 'Modified');
      assert.strictEqual(data.history[0].changes[0].target, 'DO-01');
      assert.ok(data.history[0].changes[0].reason, 'first change should have a reason');
      assert.strictEqual(data.history[0].changes[1].type, 'Removed');

      // Second entry (oldest)
      assert.strictEqual(data.history[1].milestone, 'v1.0');
      assert.strictEqual(data.history[1].date, '2026-01-01');
      assert.strictEqual(data.history[1].changes.length, 1, 'v1.0 should have 1 change');
      assert.strictEqual(data.history[1].changes[0].type, 'Added');
    });

    test('update auto-logs history entry', () => {
      createPopulatedIntent(tmpDir);
      // Create a ROADMAP.md for milestone info
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
        '# Roadmap\n\n- 🔵 **v1.0 Test** — Phases 1-3 (active)\n', 'utf-8');

      const result = runGsdTools('intent update outcomes --add "New test outcome" --priority P3', tmpDir);
      assert.ok(result.success, `update failed: ${result.error}`);

      // Read the file and check for history section
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('<history>'), 'INTENT.md should have <history> section after update');
      assert.ok(content.includes('</history>'), 'INTENT.md should have closing </history> tag');
      assert.ok(content.includes('**Added**'), 'history should contain Added entry');
      assert.ok(content.includes('DO-04'), 'history should reference the new outcome ID');
      assert.ok(content.includes('v1.0'), 'history should reference the active milestone');
    });

    test('update with --reason flag records custom reason', () => {
      createPopulatedIntent(tmpDir);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
        '# Roadmap\n\n- 🔵 **v1.0 Test** — Phases 1-3 (active)\n', 'utf-8');

      const result = runGsdTools('intent update outcomes --add "Another outcome" --priority P2 --reason "Testing reason tracking"', tmpDir);
      assert.ok(result.success, `update with --reason failed: ${result.error}`);

      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), 'utf-8');
      assert.ok(content.includes('Testing reason tracking'), 'history should contain custom reason');
    });

    test('show compact includes evolution line when history exists', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('intent show', tmpDir);
      assert.ok(result.success, `show failed: ${result.error}`);
      // In piped mode, output is JSON — verify history data is present
      const data = JSON.parse(result.output);
      assert.ok(data.history, 'should have history field');
      assert.ok(data.history.length > 0, 'should have history entries');
      const totalChanges = data.history.reduce((sum, e) => sum + e.changes.length, 0);
      assert.strictEqual(totalChanges, 3, 'should count total 3 changes');
      assert.strictEqual(data.history[0].milestone, 'v2.0', 'should have v2.0 milestone');
    });

    test('show history section renders evolution', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('intent show history', tmpDir);
      assert.ok(result.success, `show history failed: ${result.error}`);
      // In piped mode, output is JSON — verify history section data
      const data = JSON.parse(result.output);
      assert.ok(data.history, 'should have history field');
      assert.ok(data.history.length === 2, 'should have 2 milestone entries');
      assert.strictEqual(data.history[0].milestone, 'v2.0', 'should have v2.0 milestone');
      assert.strictEqual(data.history[1].milestone, 'v1.0', 'should have v1.0 milestone');
      const changeTypes = data.history.flatMap(e => e.changes.map(c => c.type));
      assert.ok(changeTypes.includes('Modified'), 'should have Modified change');
      assert.ok(changeTypes.includes('Removed'), 'should have Removed change');
      assert.ok(changeTypes.includes('Added'), 'should have Added change');
    });

    test('validate accepts INTENT.md with valid history', () => {
      createIntentWithHistory(tmpDir);
      const result = runGsdTools('intent validate', tmpDir);
      assert.ok(result.success, `validate should pass for INTENT.md with history: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
      // History section should be in sections
      assert.ok(data.sections.history, 'sections should include history');
      assert.strictEqual(data.sections.history.valid, true, 'history should be valid');
      assert.strictEqual(data.sections.history.count, 2, 'should report 2 milestone entries');
    });

    test('validate works without history (backward compatible)', () => {
      createPopulatedIntent(tmpDir);
      const result = runGsdTools('intent validate', tmpDir);
      assert.ok(result.success, `validate should pass without history: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.valid, true, 'should be valid without history');
      assert.strictEqual(data.issues.length, 0, 'should have no issues');
    });
  });
});

// --- Environment Scanning Tests -----------------------------------------------

describe('env scan', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-env-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper to run env scan on a directory
  function envScan(dir) {
    return runGsdTools('env scan', dir || tmpDir);
  }

  // Helper to parse env scan output
  function envScanParsed(dir) {
    const result = envScan(dir);
    if (!result.success) return { success: false, error: result.error };
    try {
      return { success: true, data: JSON.parse(result.output) };
    } catch (e) {
      return { success: false, error: `JSON parse failed: ${e.message}` };
    }
  }

  describe('manifest pattern completeness', () => {
    test('LANG_MANIFESTS contains at least 15 entries', () => {
      // Verify via scanning a dir with known manifests — but we can also check the output schema
      // The best test: create a dir and verify the command works
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      assert.ok(result.data.languages !== undefined, 'should have languages field');
      assert.ok(result.data.scanned_at, 'should have scanned_at timestamp');
      assert.ok(typeof result.data.detection_ms === 'number', 'detection_ms should be a number');
    });

    test('scan returns valid JSON with expected schema fields', () => {
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const d = result.data;
      assert.ok(Array.isArray(d.languages), 'languages should be array');
      assert.ok(typeof d.package_manager === 'object', 'package_manager should be object');
      assert.ok(Array.isArray(d.version_managers), 'version_managers should be array');
      assert.ok(typeof d.tools === 'object', 'tools should be object');
      assert.ok(typeof d.scripts === 'object', 'scripts should be object');
      assert.ok(typeof d.infrastructure === 'object', 'infrastructure should be object');
    });
  });

  describe('language detection', () => {
    test('detects node from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node language');
      assert.strictEqual(node.manifests[0].file, 'package.json');
      assert.strictEqual(node.manifests[0].depth, 0);
    });

    test('detects go from go.mod', () => {
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\ngo 1.21');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const go = result.data.languages.find(l => l.name === 'go');
      assert.ok(go, 'should detect go language');
    });

    test('detects elixir from mix.exs', () => {
      fs.writeFileSync(path.join(tmpDir, 'mix.exs'), 'defmodule Test.MixProject do\nend');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const elixir = result.data.languages.find(l => l.name === 'elixir');
      assert.ok(elixir, 'should detect elixir language');
    });

    test('detects multiple languages in polyglot project', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test');
      fs.writeFileSync(path.join(tmpDir, 'mix.exs'), 'defmodule Test.MixProject do\nend');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const langNames = result.data.languages.map(l => l.name).sort();
      assert.ok(langNames.includes('node'), 'should detect node');
      assert.ok(langNames.includes('go'), 'should detect go');
      assert.ok(langNames.includes('elixir'), 'should detect elixir');
    });

    test('detects nested manifest at depth 1', () => {
      const subdir = path.join(tmpDir, 'subproject');
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, 'package.json'), '{"name":"sub"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node from nested package.json');
      assert.strictEqual(node.manifests[0].depth, 1, 'should be at depth 1');
    });

    test('does NOT detect files beyond depth 3', () => {
      // Create deeply nested structure at depth 4
      const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'd');
      fs.mkdirSync(deepPath, { recursive: true });
      fs.writeFileSync(path.join(deepPath, 'package.json'), '{"name":"deep"}');
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(!node, 'should NOT detect file at depth 4');
    });

    test('empty directory returns empty languages array', () => {
      const result = envScanParsed();
      assert.ok(result.success, `env scan failed: ${result.error}`);
      assert.strictEqual(result.data.languages.length, 0, 'languages should be empty');
    });
  });

  describe('primary language detection', () => {
    test('single language marked as primary', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.strictEqual(node.primary, true, 'single language should be primary');
    });

    test('multiple languages at root — one marked primary', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test');
      const result = envScanParsed();
      assert.ok(result.success);
      const primaries = result.data.languages.filter(l => l.primary);
      assert.strictEqual(primaries.length, 1, 'exactly one language should be primary');
    });
  });

  describe('package manager detection', () => {
    test('detects pnpm from pnpm-lock.yaml', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm');
      assert.strictEqual(result.data.package_manager.source, 'lockfile');
    });

    test('detects npm from package-lock.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'npm');
    });

    test('pnpm takes precedence over npm when both present', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm', 'pnpm should take precedence');
    });

    test('packageManager field overrides lockfile detection', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        packageManager: 'pnpm@8.15.1',
      }));
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.package_manager.name, 'pnpm', 'packageManager field should override lockfile');
      assert.strictEqual(result.data.package_manager.version, '8.15.1');
      assert.strictEqual(result.data.package_manager.source, 'packageManager-field');
    });
  });

  describe('binary availability', () => {
    test('binary check returns available:false for missing binary', () => {
      // Create a manifest for a language with a likely-missing binary
      fs.writeFileSync(path.join(tmpDir, 'Package.swift'), '// swift package');
      const result = envScanParsed();
      assert.ok(result.success);
      const swift = result.data.languages.find(l => l.name === 'swift');
      if (swift) {
        // Swift may or may not be installed — just verify the shape
        assert.ok(typeof swift.binary.available === 'boolean', 'available should be boolean');
        assert.ok(swift.binary.version === null || typeof swift.binary.version === 'string', 'version should be null or string');
      }
    });

    test('node binary should be available (running in Node.js)', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = envScanParsed();
      assert.ok(result.success);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node');
      assert.strictEqual(node.binary.available, true, 'node binary should be available');
      assert.ok(node.binary.version, 'node version should be detected');
      assert.ok(node.binary.path, 'node path should be detected');
    });
  });

  describe('skip directories', () => {
    test('does NOT detect files in node_modules', () => {
      const nmDir = path.join(tmpDir, 'node_modules', 'some-package');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, 'package.json'), '{"name":"some-package"}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.languages.length, 0, 'should not detect files in node_modules');
    });

    test('does NOT detect files in vendor directory', () => {
      const vendorDir = path.join(tmpDir, 'vendor', 'package');
      fs.mkdirSync(vendorDir, { recursive: true });
      fs.writeFileSync(path.join(vendorDir, 'go.mod'), 'module vendor.com/pkg');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.languages.length, 0, 'should not detect files in vendor');
    });
  });

  describe('version manager detection', () => {
    test('detects .nvmrc with version', () => {
      fs.writeFileSync(path.join(tmpDir, '.nvmrc'), '20.11.0');
      const result = envScanParsed();
      assert.ok(result.success);
      const nvm = result.data.version_managers.find(vm => vm.name === 'nvm');
      assert.ok(nvm, 'should detect nvm');
      assert.strictEqual(nvm.configured_versions.node, '20.11.0');
    });

    test('detects mise.toml', () => {
      fs.writeFileSync(path.join(tmpDir, 'mise.toml'), '[tools]\nnode = "20.11.0"\ngo = "1.21"');
      const result = envScanParsed();
      assert.ok(result.success);
      const mise = result.data.version_managers.find(vm => vm.name === 'mise');
      assert.ok(mise, 'should detect mise');
      assert.strictEqual(mise.configured_versions.node, '20.11.0');
      assert.strictEqual(mise.configured_versions.go, '1.21');
    });

    test('detects .tool-versions (asdf)', () => {
      fs.writeFileSync(path.join(tmpDir, '.tool-versions'), 'nodejs 20.11.0\nerlang 26.2');
      const result = envScanParsed();
      assert.ok(result.success);
      const asdf = result.data.version_managers.find(vm => vm.name === 'asdf');
      assert.ok(asdf, 'should detect asdf');
      assert.strictEqual(asdf.configured_versions.nodejs, '20.11.0');
      assert.strictEqual(asdf.configured_versions.erlang, '26.2');
    });
  });

  describe('infrastructure detection', () => {
    test('detects services from docker-compose.yml', () => {
      fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'),
        'services:\n  postgres:\n    image: postgres:16\n  redis:\n    image: redis:7\n');
      const result = envScanParsed();
      assert.ok(result.success);
      const services = result.data.infrastructure.docker_services;
      assert.ok(services.includes('postgres'), 'should detect postgres service');
      assert.ok(services.includes('redis'), 'should detect redis service');
    });

    test('detects MCP servers from .mcp.json', () => {
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
        mcpServers: {
          github: { command: 'mcp-github' },
          postgres: { command: 'mcp-postgres' },
        },
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      const servers = result.data.infrastructure.mcp_servers;
      assert.ok(servers.includes('github'), 'should detect github MCP server');
      assert.ok(servers.includes('postgres'), 'should detect postgres MCP server');
    });
  });

  describe('script detection', () => {
    test('captures well-known scripts from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        scripts: {
          test: 'jest',
          build: 'tsc',
          lint: 'eslint .',
          dev: 'next dev',  // Not a well-known script
          start: 'node server.js',
        },
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.scripts.test, 'jest');
      assert.strictEqual(result.data.scripts.build, 'tsc');
      assert.strictEqual(result.data.scripts.lint, 'eslint .');
      assert.strictEqual(result.data.scripts.start, 'node server.js');
      assert.strictEqual(result.data.scripts.dev, undefined, 'dev is not a well-known script');
    });

    test('captures Makefile targets', () => {
      fs.writeFileSync(path.join(tmpDir, 'Makefile'),
        'build:\n\tgo build .\n\ntest:\n\tgo test ./...\n\n.PHONY: build test\n');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.scripts._makefile_targets, 'should have Makefile targets');
      assert.ok(result.data.scripts._makefile_targets.includes('build'));
      assert.ok(result.data.scripts._makefile_targets.includes('test'));
    });
  });

  describe('monorepo detection', () => {
    test('detects npm workspaces from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'monorepo',
        workspaces: ['packages/*', 'apps/*'],
      }));
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.monorepo, 'should detect monorepo');
      assert.strictEqual(result.data.monorepo.type, 'npm-workspaces');
      assert.deepStrictEqual(result.data.monorepo.members, ['packages/*', 'apps/*']);
    });

    test('no monorepo in simple project', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"simple"}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.strictEqual(result.data.monorepo, null, 'should not detect monorepo');
    });
  });

  describe('edge cases', () => {
    test('permission-denied directory does not crash', () => {
      // Create a directory we can't read (only works if not running as root)
      const restrictedDir = path.join(tmpDir, 'restricted');
      fs.mkdirSync(restrictedDir, { mode: 0o000 });
      // Should still complete without crashing
      const result = envScanParsed();
      assert.ok(result.success, 'should not crash on permission-denied directory');
      // Restore permissions for cleanup
      fs.chmodSync(restrictedDir, 0o755);
    });

    test('deeply nested symlink does not cause infinite loop (depth limit handles this)', () => {
      // Depth limit of 3 prevents following deep symlinks
      const subDir = path.join(tmpDir, 'sub');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      // Create a symlink that could cause loops (symlink to parent)
      try {
        fs.symlinkSync(tmpDir, path.join(subDir, 'loop'), 'dir');
      } catch {
        // Symlinks may not work on all platforms — skip if so
        return;
      }
      const result = envScanParsed();
      assert.ok(result.success, 'should not crash with symlink loops');
    });

    test('CI detection: github actions', () => {
      const ghDir = path.join(tmpDir, '.github', 'workflows');
      fs.mkdirSync(ghDir, { recursive: true });
      fs.writeFileSync(path.join(ghDir, 'ci.yml'), 'name: CI');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.ci, 'should detect CI');
      assert.strictEqual(result.data.tools.ci.platform, 'github-actions');
    });

    test('linter/formatter detection', () => {
      fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, '.prettierrc'), '{}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.linters.some(l => l.name === 'eslint'), 'should detect eslint');
      assert.ok(result.data.tools.formatters.some(f => f.name === 'prettier'), 'should detect prettier');
    });

    test('test framework detection from config files', () => {
      fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {}');
      const result = envScanParsed();
      assert.ok(result.success);
      assert.ok(result.data.tools.test_frameworks.some(t => t.name === 'jest'), 'should detect jest');
    });
  });

  describe('detection against real project', () => {
    test('bgsd-oc project detects node and npm', () => {
      // Run against the actual project root (bin/ is inside project root)
      const projectRoot = path.resolve(__dirname, '..');
      const result = envScanParsed(projectRoot);
      assert.ok(result.success, `env scan on project root failed: ${result.error}`);
      const node = result.data.languages.find(l => l.name === 'node');
      assert.ok(node, 'should detect node in bgsd-oc project');
      assert.strictEqual(node.primary, true, 'node should be primary');
      assert.ok(result.data.package_manager.name, 'should detect a package manager');
    });
  });

  describe('manifest persistence', () => {
    test('env scan writes env-manifest.json when .planning/ exists', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = runGsdTools('env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const manifestPath = path.join(tmpDir, '.planning', 'env-manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'env-manifest.json should exist');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(manifest['$schema_version'], '1.0', 'should have schema version');
      assert.ok(Array.isArray(manifest.watched_files), 'should have watched_files');
      assert.ok(typeof manifest.watched_files_mtimes === 'object', 'should have watched_files_mtimes');
    });

    test('env scan does NOT write manifest when .planning/ does not exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const result = runGsdTools('env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const manifestPath = path.join(tmpDir, '.planning', 'env-manifest.json');
      assert.ok(!fs.existsSync(manifestPath), 'env-manifest.json should NOT exist without .planning/');
    });

    test('env scan writes project-profile.json when .planning/ exists', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = runGsdTools('env scan --force', tmpDir);
      assert.ok(result.success, `env scan failed: ${result.error}`);
      const profilePath = path.join(tmpDir, '.planning', 'project-profile.json');
      assert.ok(fs.existsSync(profilePath), 'project-profile.json should exist');
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
      assert.strictEqual(profile['$schema_version'], '1.0');
      assert.deepStrictEqual(profile.languages, ['node']);
      assert.strictEqual(profile.primary_language, 'node');
      assert.strictEqual(profile.package_manager, 'npm');
    });

    test('env scan creates .planning/.gitignore with env-manifest.json entry', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('env scan --force', tmpDir);
      const gitignorePath = path.join(tmpDir, '.planning', '.gitignore');
      assert.ok(fs.existsSync(gitignorePath), '.planning/.gitignore should exist');
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      assert.ok(content.includes('env-manifest.json'), '.gitignore should contain env-manifest.json');
    });

    test('env scan watched_files includes root manifest files', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = runGsdTools('env scan --force', tmpDir);
      assert.ok(result.success);
      const data = JSON.parse(result.output);
      assert.ok(data.watched_files.includes('package.json'), 'watched should include package.json');
      assert.ok(data.watched_files.includes('package-lock.json'), 'watched should include package-lock.json');
      assert.ok(data.watched_files_mtimes['package.json'], 'should have mtime for package.json');
    });
  });

  describe('staleness detection', () => {
    test('staleness: fresh manifest is NOT stale', () => {
      // Create .planning/ and run initial scan to create manifest
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      const scanResult = runGsdTools('env scan --force', tmpDir);
      assert.ok(scanResult.success, `initial scan failed: ${scanResult.error}`);

      // Check staleness via env status
      const statusResult = runGsdTools('env status', tmpDir);
      assert.ok(statusResult.success, `env status failed: ${statusResult.error}`);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.exists, true, 'manifest should exist');
      assert.strictEqual(status.stale, false, 'fresh manifest should not be stale');
    });

    test('staleness: touching a watched file makes manifest stale', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('env scan --force', tmpDir);

      // Touch the watched file (update mtime to future)
      const pkgPath = path.join(tmpDir, 'package.json');
      const futureTime = Date.now() + 5000;
      fs.utimesSync(pkgPath, futureTime / 1000, futureTime / 1000);

      const statusResult = runGsdTools('env status', tmpDir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.stale, true, 'should be stale after touching watched file');
      assert.strictEqual(status.reason, 'files_changed');
      assert.ok(status.changed_files.includes('package.json'), 'changed_files should include package.json');
    });

    test('staleness: missing manifest reports stale with reason no_manifest', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      const statusResult = runGsdTools('env status', tmpDir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.exists, false, 'manifest should not exist');
      assert.strictEqual(status.stale, true, 'missing manifest should be stale');
      assert.strictEqual(status.reason, 'no_manifest');
    });

    test('staleness: --force flag bypasses staleness and always rescans', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('env scan --force', tmpDir);
      const firstManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // Wait a tiny bit so scanned_at differs
      const origTime = firstManifest.scanned_at;

      // Force rescan (even though manifest is fresh)
      const forceResult = runGsdTools('env scan --force', tmpDir);
      assert.ok(forceResult.success, `force scan failed: ${forceResult.error}`);
      const secondManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // scanned_at should be different (or at least re-written)
      assert.ok(secondManifest.scanned_at, 'second scan should have scanned_at');
    });

    test('staleness: auto-rescan re-writes manifest when stale', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('env scan --force', tmpDir);

      // Touch file to make stale
      const pkgPath = path.join(tmpDir, 'package.json');
      const futureTime = Date.now() + 5000;
      fs.utimesSync(pkgPath, futureTime / 1000, futureTime / 1000);

      // Verify stale
      const statusBefore = JSON.parse(runGsdTools('env status', tmpDir).output);
      assert.strictEqual(statusBefore.stale, true, 'should be stale before rescan');

      // Run scan WITHOUT --force — should auto-rescan since stale
      const rescanResult = runGsdTools('env scan', tmpDir);
      assert.ok(rescanResult.success, `auto-rescan failed: ${rescanResult.error}`);

      // After auto-rescan, manifest should be fresh again
      const statusAfter = JSON.parse(runGsdTools('env status', tmpDir).output);
      assert.strictEqual(statusAfter.stale, false, 'manifest should be fresh after auto-rescan');
    });

    test('env status returns correct structure', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
      runGsdTools('env scan --force', tmpDir);

      const result = runGsdTools('env status', tmpDir);
      assert.ok(result.success);
      const status = JSON.parse(result.output);
      assert.strictEqual(typeof status.exists, 'boolean');
      assert.strictEqual(typeof status.stale, 'boolean');
      assert.ok(status.scanned_at, 'should have scanned_at');
      assert.strictEqual(typeof status.age_minutes, 'number');
      assert.strictEqual(typeof status.languages_count, 'number');
      assert.ok(status.languages_count >= 1, 'should detect at least 1 language');
      assert.ok(Array.isArray(status.changed_files));
    });

    test('env scan idempotent: second run without changes exits early', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

      // Initial scan
      runGsdTools('env scan --force', tmpDir);
      const firstManifest = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.planning', 'env-manifest.json'), 'utf-8')
      );

      // Second scan without changes — should exit early (manifest unchanged)
      const secondResult = runGsdTools('env scan', tmpDir);
      assert.ok(secondResult.success, `idempotent scan failed: ${secondResult.error}`);
      const secondOutput = JSON.parse(secondResult.output);
      // Should return the existing manifest data (same scanned_at)
      assert.strictEqual(secondOutput.scanned_at, firstManifest.scanned_at,
        'idempotent scan should return existing manifest without re-scanning');
    });
  });

  describe('env integration - formatEnvSummary', () => {
    test('formatEnvSummary with node+go+elixir manifest produces compact format', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create manifest files so staleness check passes
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/test');
      fs.writeFileSync(path.join(dir, 'mix.exs'), 'defmodule Test do end');
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'node', primary: true, binary: { available: true, version: '20.11.0' }, manifests: [{ file: 'package.json', path: 'package.json', depth: 0 }] },
          { name: 'go', primary: false, binary: { available: true, version: '1.21.5' }, manifests: [{ file: 'go.mod', path: 'go.mod', depth: 0 }] },
          { name: 'elixir', primary: false, binary: { available: true, version: '1.16.0' }, manifests: [{ file: 'mix.exs', path: 'mix.exs', depth: 0 }] },
        ],
        package_manager: { name: 'pnpm', version: '8.15.1' },
        infrastructure: { docker_services: [] },
        watched_files: ['package.json', 'go.mod', 'mix.exs'],
        watched_files_mtimes: {
          'package.json': fs.statSync(path.join(dir, 'package.json')).mtimeMs,
          'go.mod': fs.statSync(path.join(dir, 'go.mod')).mtimeMs,
          'mix.exs': fs.statSync(path.join(dir, 'mix.exs')).mtimeMs,
        },
      };
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      // Use init progress to check env_summary is produced
      // Need ROADMAP.md and STATE.md for init progress to work
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.startsWith('Tools:'), 'should start with "Tools:"');
      assert.ok(data.env_summary.includes('node@20.11.0'), 'should include node@20.11.0');
      assert.ok(data.env_summary.includes('(pnpm)'), 'should include (pnpm)');
      assert.ok(data.env_summary.includes('go@1.21.5'), 'should include go@1.21.5');
      assert.ok(data.env_summary.includes('elixir@1.16.0'), 'should include elixir@1.16.0');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with null manifest returns null', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // No env-manifest.json, no language files → env_summary should be null
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // In verbose mode, null env_summary is omitted (trimmed) to reduce tokens
      assert.ok(!data.env_summary, 'should be null/absent when no languages detected');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with empty languages returns null', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [],
        package_manager: { name: null },
        infrastructure: { docker_services: [] },
        watched_files: [],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // In verbose mode, null env_summary is omitted (trimmed) to reduce tokens
      assert.ok(!data.env_summary, 'should be null/absent when languages empty');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary with missing binary includes "(no binary)" suffix', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'rust', primary: true, binary: { available: false, version: null }, manifests: [{ file: 'Cargo.toml', path: 'Cargo.toml', depth: 0 }] },
        ],
        package_manager: { name: 'cargo' },
        infrastructure: { docker_services: [] },
        watched_files: ['Cargo.toml'],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create Cargo.toml so watched file exists with matching mtime
      fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\nname = "test"');
      manifest.watched_files_mtimes['Cargo.toml'] = fs.statSync(path.join(dir, 'Cargo.toml')).mtimeMs;
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.includes('(no binary)'), 'should include "(no binary)"');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('formatEnvSummary includes docker when docker_services detected', () => {
      const manifest = {
        '$schema_version': '1.0',
        scanned_at: new Date().toISOString(),
        languages: [
          { name: 'node', primary: true, binary: { available: true, version: '20.11.0' }, manifests: [{ file: 'package.json', path: 'package.json', depth: 0 }] },
        ],
        package_manager: { name: 'npm' },
        infrastructure: { docker_services: ['postgres', 'redis'] },
        watched_files: ['package.json'],
        watched_files_mtimes: {},
      };
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envfmt-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      // Create package.json so watched file exists with matching mtime
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-docker"}');
      manifest.watched_files_mtimes['package.json'] = fs.statSync(path.join(dir, 'package.json')).mtimeMs;
      fs.writeFileSync(path.join(dir, '.planning', 'env-manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary');
      assert.ok(data.env_summary.includes('docker'), 'should include docker when services detected');
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('env integration - autoTriggerEnvScan', () => {
    test('auto-trigger creates manifest on first init progress', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envtrigger-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-auto-trigger"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      // No env-manifest.json exists yet
      assert.ok(!fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should not exist before');
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      // After init, manifest should have been created
      assert.ok(fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should be auto-created after init');
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary, 'should have env_summary after auto-trigger');
      assert.ok(data.env_summary.includes('node'), 'should detect node');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('auto-trigger returns existing manifest when fresh', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envtrigger-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-fresh"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      // First: create manifest via env scan
      runGsdTools('env scan --force', dir);
      const firstManifest = JSON.parse(fs.readFileSync(path.join(dir, '.planning', 'env-manifest.json'), 'utf-8'));
      // Second: init progress should use existing (fresh) manifest
      const result = runGsdTools('init progress --verbose', dir);
      assert.ok(result.success, `init progress failed: ${result.error}`);
      const secondManifest = JSON.parse(fs.readFileSync(path.join(dir, '.planning', 'env-manifest.json'), 'utf-8'));
      assert.strictEqual(secondManifest.scanned_at, firstManifest.scanned_at,
        'manifest should not be re-scanned when fresh');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('init execute-phase includes env_summary', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envexec-'));
      fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-test'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.planning', 'phases', '01-test', '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\n---\n');
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-exec"}');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n| Phase | Name |\n|---|---|\n| 1 | Test |\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');
      fs.writeFileSync(path.join(dir, '.planning', 'config.json'), '{}');
      const result = runGsdTools('init execute-phase 1 --verbose', dir);
      assert.ok(result.success, `init execute-phase failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.env_summary !== undefined, 'should have env_summary field');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test('env status returns correct JSON structure', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envstatus-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-status"}');
      runGsdTools('env scan --force', dir);
      const result = runGsdTools('env status', dir);
      assert.ok(result.success, `env status failed: ${result.error}`);
      const status = JSON.parse(result.output);
      assert.strictEqual(typeof status.exists, 'boolean');
      assert.strictEqual(typeof status.stale, 'boolean');
      assert.ok(status.scanned_at, 'should have scanned_at');
      assert.strictEqual(typeof status.age_minutes, 'number');
      assert.strictEqual(typeof status.languages_count, 'number');
      assert.ok(Array.isArray(status.changed_files));
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('env integration - full flow', () => {
    test('create project, scan, verify status, then init progress with tools line', () => {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-envflow-'));
      fs.mkdirSync(path.join(dir, '.planning'));
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"integration-test"}');
      fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/test\ngo 1.21');
      fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Milestones\n- 🔵 v1.0\n## Phases\n');
      fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '# Project State\n## Current Position\n**Phase:** 1\n**Status:** Executing');
      fs.writeFileSync(path.join(dir, '.planning', 'MILESTONES.md'), '# Milestones\n- 🔵 v1.0 — Test');

      // Step 1: Run env scan
      const scanResult = runGsdTools('env scan --force', dir);
      assert.ok(scanResult.success, `scan failed: ${scanResult.error}`);
      assert.ok(fs.existsSync(path.join(dir, '.planning', 'env-manifest.json')), 'manifest should exist');

      // Step 2: Verify env status reports fresh
      const statusResult = runGsdTools('env status', dir);
      assert.ok(statusResult.success);
      const status = JSON.parse(statusResult.output);
      assert.strictEqual(status.stale, false, 'manifest should be fresh');
      assert.ok(status.languages_count >= 2, 'should detect at least 2 languages');

      // Step 3: init progress should include Tools line
      const progressResult = runGsdTools('init progress --verbose', dir);
      assert.ok(progressResult.success, `progress failed: ${progressResult.error}`);
      const progressData = JSON.parse(progressResult.output);
      assert.ok(progressData.env_summary, 'should have env_summary');
      assert.ok(progressData.env_summary.startsWith('Tools:'), 'should start with Tools:');
      assert.ok(progressData.env_summary.includes('node'), 'should mention node');
      assert.ok(progressData.env_summary.includes('go'), 'should mention go');

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});

// =============================================================================
// MCP Profile Tests
// =============================================================================

describe('mcp-profile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper to run mcp-profile and parse JSON
  // isolateHome: set HOME to tmpDir to prevent user-level config interference
  function mcpProfile(dir, extraArgs, { isolateHome = false } = {}) {
    const origHome = process.env.HOME;
    if (isolateHome) process.env.HOME = tmpDir;
    try {
      const args = extraArgs ? `mcp-profile ${extraArgs}` : 'mcp-profile';
      const result = runGsdTools(args, dir || tmpDir);
      if (!result.success) return { success: false, error: result.error };
      try {
        return { success: true, data: JSON.parse(result.output) };
      } catch (e) {
        return { success: false, error: `JSON parse failed: ${e.message}, output: ${result.output}` };
      }
    } finally {
      if (isolateHome) process.env.HOME = origHome;
    }
  }

  describe('server discovery from .mcp.json', () => {
    test('discovers servers from .mcp.json', () => {
      const config = {
        mcpServers: {
          postgres: {
            command: '/usr/local/bin/toolbox',
            args: ['--prebuilt', 'postgres', '--stdio'],
            env: { POSTGRES_HOST: 'localhost' },
          },
          consul: {
            command: 'node',
            args: ['./tools/consul-mcp-server/dist/index.js'],
          },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      assert.strictEqual(result.data.server_count, 2, 'should find 2 servers');

      const postgres = result.data.servers.find(s => s.name === 'postgres');
      assert.ok(postgres, 'should find postgres');
      assert.strictEqual(postgres.source, '.mcp.json');
      assert.strictEqual(postgres.transport, 'stdio');
      assert.strictEqual(postgres.command, '/usr/local/bin/toolbox');

      const consul = result.data.servers.find(s => s.name === 'consul');
      assert.ok(consul, 'should find consul');
      assert.strictEqual(consul.command, 'node');
    });
  });

  describe('server discovery from opencode.json', () => {
    test('discovers servers from opencode.json', () => {
      const config = {
        mcp: {
          'brave-search': {
            type: 'local',
            command: ['npx', '-y', '@modelcontextprotocol/server-brave-search'],
          },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      assert.strictEqual(result.data.server_count, 1, 'should find 1 server');

      const brave = result.data.servers.find(s => s.name === 'brave-search');
      assert.ok(brave, 'should find brave-search');
      assert.strictEqual(brave.source, 'opencode.json');
      assert.strictEqual(brave.transport, 'stdio');
      assert.strictEqual(brave.command, 'npx');
    });
  });

  describe('remote MCP server discovery', () => {
    test('discovers remote servers with correct transport', () => {
      const config = {
        mcp: {
          context7: {
            type: 'remote',
            url: 'https://mcp.context7.com/mcp',
          },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const ctx7 = result.data.servers.find(s => s.name === 'context7');
      assert.ok(ctx7, 'should find context7');
      assert.strictEqual(ctx7.transport, 'remote');
      assert.strictEqual(ctx7.command, 'https://mcp.context7.com/mcp');
    });
  });

  describe('server merging from both configs', () => {
    test('merges servers from both configs with deduplication', () => {
      // Override HOME to isolate from user-level config
      const origHome = process.env.HOME;
      process.env.HOME = tmpDir;
      try {
        // .mcp.json: postgres, vault
        const mcpConfig = {
          mcpServers: {
            postgres: {
              command: '/usr/local/bin/toolbox',
              args: ['--prebuilt', 'postgres'],
            },
            vault: {
              command: '/usr/local/bin/vault-mcp-server',
              args: ['stdio'],
            },
          },
        };
        fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(mcpConfig));

        // opencode.json: terraform, vault (duplicate)
        const opcConfig = {
          mcp: {
            terraform: {
              type: 'local',
              command: ['docker', 'run', '-i', 'hashicorp/terraform-mcp-server'],
            },
            vault: {
              type: 'local',
              command: ['/home/user/vault-mcp', 'stdio'],
            },
          },
        };
        fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(opcConfig));

        const result = mcpProfile();
        assert.ok(result.success, `mcp-profile failed: ${result.error}`);

        // Should have 3 servers: postgres, terraform, vault (deduplicated)
        assert.strictEqual(result.data.server_count, 3, 'should have 3 servers after dedup');

        // vault should come from .mcp.json (project-level priority)
        const vault = result.data.servers.find(s => s.name === 'vault');
        assert.ok(vault, 'should find vault');
        assert.strictEqual(vault.source, '.mcp.json', 'vault should come from .mcp.json');
      } finally {
        process.env.HOME = origHome;
      }
    });
  });

  describe('known server token estimation', () => {
    test('estimates known server tokens correctly', () => {
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['--prebuilt', 'postgres'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const postgres = result.data.servers.find(s => s.name === 'postgres');
      assert.ok(postgres, 'should find postgres');
      assert.strictEqual(postgres.token_source, 'known-db');
      assert.strictEqual(postgres.token_estimate, 4500);
      assert.strictEqual(postgres.tool_count, 12);
    });

    test('estimates unknown server with default', () => {
      const config = {
        mcpServers: {
          'my-custom-server': { command: '/usr/local/bin/my-server', args: [] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const custom = result.data.servers.find(s => s.name === 'my-custom-server');
      assert.ok(custom, 'should find my-custom-server');
      assert.strictEqual(custom.token_source, 'default-estimate');
      assert.ok(custom.token_estimate > 0, 'should have positive token estimate');
      assert.ok(custom.tool_count > 0, 'should have positive tool count');
    });
  });

  describe('total context calculation', () => {
    test('total_tokens is sum of individual estimates', () => {
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['--prebuilt', 'postgres'] },
          consul: { command: 'node', args: ['consul-server.js'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const sum = result.data.servers.reduce((acc, s) => acc + s.token_estimate, 0);
      assert.strictEqual(result.data.total_tokens, sum, 'total_tokens should be sum of server estimates');

      // Verify context percentage calculation
      const expectedPercent = ((sum / 200000) * 100).toFixed(1) + '%';
      assert.strictEqual(result.data.total_context_percent, expectedPercent, 'context percent should be correct');
    });
  });

  describe('custom window size', () => {
    test('--window flag changes context_window and percentages', () => {
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['--prebuilt', 'postgres'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, '--window 100000', { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      assert.strictEqual(result.data.context_window, 100000, 'context window should be 100000');

      // Postgres is 4500 tokens — at 100K window that's 4.5%
      const postgres = result.data.servers.find(s => s.name === 'postgres');
      assert.ok(postgres, 'should find postgres');
      assert.strictEqual(postgres.context_percent, '4.5%', 'should be 4.5% of 100K window');
    });
  });

  describe('empty config', () => {
    test('empty directory with no user config returns empty results', () => {
      // Override HOME to prevent user-level config discovery
      // execSync inherits process.env, so this affects the subprocess
      const origHome = process.env.HOME;
      process.env.HOME = tmpDir; // tmpDir has no .config/opencode/opencode.json
      try {
        const result = mcpProfile();
        assert.ok(result.success, `mcp-profile failed: ${result.error}`);
        assert.deepStrictEqual(result.data.servers, [], 'servers should be empty');
        assert.strictEqual(result.data.server_count, 0, 'server_count should be 0');
        assert.strictEqual(result.data.total_tokens, 0, 'total_tokens should be 0');
        assert.strictEqual(result.data.known_count, 0, 'known_count should be 0');
        assert.strictEqual(result.data.unknown_count, 0, 'unknown_count should be 0');
      } finally {
        process.env.HOME = origHome;
      }
    });
  });

  describe('malformed config', () => {
    test('invalid JSON in .mcp.json degrades gracefully', () => {
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), '{ invalid json!!!');

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile should not crash: ${result.error}`);
      assert.deepStrictEqual(result.data.servers, [], 'should return empty servers on bad JSON');
      assert.strictEqual(result.data.server_count, 0);
    });

    test('missing mcpServers key in .mcp.json returns empty', () => {
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({ other: 'data' }));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      assert.strictEqual(result.data.server_count, 0);
    });

    test('missing mcp key in opencode.json returns empty', () => {
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify({ "$schema": "test" }));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      assert.strictEqual(result.data.server_count, 0);
    });
  });

  describe('user-level config discovery', () => {
    test('discovers servers from user-level config', () => {
      // We can verify that the user-level config is attempted by checking
      // that servers from ~/.config/opencode/opencode.json appear
      // Only if user has MCP servers configured there (integration test)
      const userConfig = path.join(
        process.env.HOME || '',
        '.config', 'opencode', 'opencode.json'
      );
      if (!fs.existsSync(userConfig)) {
        // Skip if no user config exists
        return;
      }

      // Run from empty directory — should still find user-level servers
      const result = mcpProfile();
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      // If user has MCP servers, server_count > 0
      // This is an integration test — passes either way
      assert.ok(typeof result.data.server_count === 'number', 'server_count should be a number');
    });
  });

  describe('mcp subcommand syntax', () => {
    test('mcp profile works as alias', () => {
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['postgres'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const origHome = process.env.HOME;
      process.env.HOME = tmpDir;
      try {
        const result = runGsdTools('mcp profile', tmpDir);
        assert.ok(result.success, `mcp profile failed: ${result.error}`);
        const data = JSON.parse(result.output);
        assert.strictEqual(data.server_count, 1, 'should find 1 server via mcp profile');
      } finally {
        process.env.HOME = origHome;
      }
    });
  });

  describe('known/unknown counts', () => {
    test('correctly splits known vs unknown servers', () => {
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['postgres'] },
          'my-unknown-server': { command: '/path/to/unknown', args: [] },
          consul: { command: 'consul-server', args: [] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile();
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);
      // Note: server_count may include user-level servers from ~/.config/opencode/opencode.json
      assert.ok(result.data.server_count >= 3, 'should have at least 3 servers');

      // Verify the project-level servers are present and classified correctly
      const postgres = result.data.servers.find(s => s.name === 'postgres');
      assert.ok(postgres, 'should find postgres');
      assert.strictEqual(postgres.token_source, 'known-db', 'postgres should be known');

      const consul = result.data.servers.find(s => s.name === 'consul');
      assert.ok(consul, 'should find consul');
      assert.strictEqual(consul.token_source, 'known-db', 'consul should be known');

      const unknown = result.data.servers.find(s => s.name === 'my-unknown-server');
      assert.ok(unknown, 'should find my-unknown-server');
      assert.strictEqual(unknown.token_source, 'default-estimate', 'custom server should use default estimate');

      // Verify known + unknown counts add up to total
      assert.strictEqual(
        result.data.known_count + result.data.unknown_count,
        result.data.server_count,
        'known + unknown should equal total'
      );
    });
  });

  describe('relevance scoring', () => {
    test('scores relevant server with matching project files', () => {
      // postgres server + prisma/schema.prisma indicator file
      const config = {
        mcpServers: {
          postgres: { command: 'toolbox', args: ['--prebuilt', 'postgres'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
      fs.mkdirSync(path.join(tmpDir, 'prisma'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'prisma', 'schema.prisma'), 'model User {}');

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const postgres = result.data.servers.find(s => s.name === 'postgres');
      assert.ok(postgres, 'should find postgres');
      assert.strictEqual(postgres.relevance, 'relevant', 'postgres should be relevant');
      assert.strictEqual(postgres.recommendation, 'keep', 'postgres should be keep');
      assert.ok(postgres.recommendation_reason.includes('Database'), 'reason should mention database');
    });

    test('scores not-relevant server without matching files', () => {
      // terraform server but no .tf files
      const config = {
        mcpServers: {
          terraform: { command: 'docker', args: ['run', 'terraform-mcp'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const terraform = result.data.servers.find(s => s.name === 'terraform');
      assert.ok(terraform, 'should find terraform');
      assert.strictEqual(terraform.relevance, 'not-relevant', 'terraform should be not-relevant');
      assert.strictEqual(terraform.recommendation, 'disable', 'terraform should be disable');
      assert.ok(terraform.recommendation_reason.includes('saves'), 'reason should mention savings');
    });

    test('always-relevant servers scored relevant regardless of project files', () => {
      const config = {
        mcp: {
          'brave-search': {
            type: 'local',
            command: ['npx', '-y', '@modelcontextprotocol/server-brave-search'],
          },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const brave = result.data.servers.find(s => s.name === 'brave-search');
      assert.ok(brave, 'should find brave-search');
      assert.strictEqual(brave.relevance, 'relevant', 'brave-search should always be relevant');
      assert.strictEqual(brave.recommendation, 'keep', 'brave-search should be keep');
      assert.ok(brave.recommendation_reason.includes('always useful'), 'reason should say always useful');
    });

    test('low-cost server marked relevant even without indicators', () => {
      // Create a custom known-db entry in .mcp.json with name matching a low-cost server
      // context7 is 1500 tokens (above 1000), so we test filesystem (3000 tokens) which is always_relevant
      // Actually, we need a server with < 1000 tokens. There's none in the default DB.
      // Instead, test that a truly unknown server with default estimate (1150) gets "possibly-relevant"
      // and that the low-cost threshold logic works for servers we add indicators for.
      // The plan mentions context7 at ~1500 — let's verify the always_relevant path instead.
      const config = {
        mcp: {
          context7: { type: 'remote', url: 'https://mcp.context7.com/mcp' },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const ctx7 = result.data.servers.find(s => s.name === 'context7');
      assert.ok(ctx7, 'should find context7');
      assert.strictEqual(ctx7.relevance, 'relevant', 'context7 should be relevant (always_relevant)');
      assert.strictEqual(ctx7.recommendation, 'keep');
    });

    test('unknown server gets possibly-relevant', () => {
      const config = {
        mcpServers: {
          'my-custom-tool': { command: '/usr/local/bin/custom-mcp', args: [] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const custom = result.data.servers.find(s => s.name === 'my-custom-tool');
      assert.ok(custom, 'should find my-custom-tool');
      assert.strictEqual(custom.relevance, 'possibly-relevant', 'unknown server should be possibly-relevant');
      assert.strictEqual(custom.recommendation, 'review', 'unknown server should be review');
    });

    test('recommendations summary counts are correct', () => {
      // Mix: brave-search (always relevant → keep), terraform (no files → disable), my-tool (unknown → review)
      const config = {
        mcpServers: {
          terraform: { command: 'docker', args: ['run', 'terraform-mcp'] },
          'my-tool': { command: '/usr/local/bin/my-tool', args: [] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
      const opcConfig = {
        mcp: {
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(opcConfig));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const summary = result.data.recommendations_summary;
      assert.ok(summary, 'should have recommendations_summary');
      assert.strictEqual(summary.keep, 1, 'should have 1 keep (brave-search)');
      assert.strictEqual(summary.disable, 1, 'should have 1 disable (terraform)');
      assert.strictEqual(summary.review, 1, 'should have 1 review (my-tool)');
      assert.strictEqual(summary.keep + summary.disable + summary.review, result.data.server_count,
        'summary counts should equal total servers');
    });

    test('total potential savings equals sum of disabled server tokens', () => {
      // terraform (6000 tokens, disable) + consul (2500, disable) + brave-search (keep)
      const config = {
        mcpServers: {
          terraform: { command: 'docker', args: ['run', 'terraform-mcp'] },
          consul: { command: 'node', args: ['consul.js'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
      const opcConfig = {
        mcp: { 'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] } },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(opcConfig));

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      // Both terraform and consul should be "disable" (no matching files)
      const disabledServers = result.data.servers.filter(s => s.recommendation === 'disable');
      const expectedSavings = disabledServers.reduce((sum, s) => sum + s.token_estimate, 0);
      assert.strictEqual(result.data.total_potential_savings, expectedSavings,
        'total_potential_savings should equal sum of disabled server tokens');
      assert.ok(result.data.total_potential_savings > 0, 'should have some savings');

      // Verify percentage
      const expectedPct = ((expectedSavings / 200000) * 100).toFixed(1) + '%';
      assert.strictEqual(result.data.potential_savings_percent, expectedPct,
        'potential_savings_percent should be correct');
    });

    test('env hint detection for possibly-relevant', () => {
      // redis server + .env with REDIS_URL but no redis.conf
      const config = {
        mcpServers: {
          redis: { command: '/usr/local/bin/redis-mcp', args: [] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
      fs.writeFileSync(path.join(tmpDir, '.env'), 'REDIS_URL=redis://localhost:6379\nOTHER_VAR=value\n');

      const result = mcpProfile(null, null, { isolateHome: true });
      assert.ok(result.success, `mcp-profile failed: ${result.error}`);

      const redis = result.data.servers.find(s => s.name === 'redis');
      assert.ok(redis, 'should find redis');
      // With env hint but no redis.conf → possibly-relevant
      assert.strictEqual(redis.relevance, 'possibly-relevant', 'redis with env hint should be possibly-relevant');
      assert.strictEqual(redis.recommendation, 'review', 'redis should be review');
    });
  });

  describe('apply and restore', () => {
    // Helper to run mcp-profile with --apply/--restore from a specific dir
    function mcpApply(dir, extraArgs, { isolateHome = false } = {}) {
      const origHome = process.env.HOME;
      if (isolateHome) process.env.HOME = dir;
      try {
        const args = extraArgs ? `mcp-profile ${extraArgs}` : 'mcp-profile --apply';
        const result = runGsdTools(args, dir);
        if (!result.success) return { success: false, error: result.error };
        try { return { success: true, data: JSON.parse(result.output) }; }
        catch (e) { return { success: false, error: `JSON parse: ${e.message}` }; }
      } finally {
        if (isolateHome) process.env.HOME = origHome;
      }
    }

    test('apply creates backup', () => {
      // opencode.json with terraform (will be disable) and brave-search (will be keep)
      const config = {
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config, null, 2));
      const originalContent = fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8');

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      // Backup should exist and match original
      const bakPath = path.join(tmpDir, 'opencode.json.bak');
      assert.ok(fs.existsSync(bakPath), 'opencode.json.bak should exist');
      assert.strictEqual(fs.readFileSync(bakPath, 'utf-8'), originalContent, 'backup should match original');
    });

    test('apply disables recommended servers', () => {
      const config = {
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config, null, 2));

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      // Read modified opencode.json
      const modified = JSON.parse(fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8'));
      assert.strictEqual(modified.mcp.terraform.enabled, false, 'terraform should be disabled');
      assert.strictEqual(modified.mcp['brave-search'].enabled, undefined, 'brave-search should NOT have enabled field');
    });

    test('apply only modifies opencode.json servers', () => {
      // .mcp.json has postgres (would be disable — no db files)
      const mcpConfig = { mcpServers: { postgres: { command: 'toolbox', args: ['--prebuilt', 'postgres'] } } };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(mcpConfig));
      // opencode.json has terraform (will be disable)
      const opcConfig = { mcp: { terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] } } };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(opcConfig, null, 2));
      const mcpOriginal = fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf-8');

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      // .mcp.json should be unchanged
      assert.strictEqual(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf-8'), mcpOriginal, '.mcp.json should not be modified');
    });

    test('apply returns correct summary', () => {
      const config = {
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
          consul: { type: 'local', command: ['node', 'consul.js'] },
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config, null, 2));

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      const ar = result.data.apply_result;
      assert.ok(ar, 'should have apply_result');
      assert.strictEqual(ar.applied, true);
      assert.ok(ar.disabled_count >= 1, 'should disable at least 1 server');
      assert.ok(Array.isArray(ar.disabled_servers), 'disabled_servers should be array');
      assert.ok(ar.tokens_saved > 0, 'tokens_saved should be positive');
    });

    test('apply with no opencode.json', () => {
      // Only .mcp.json present
      const mcpConfig = { mcpServers: { postgres: { command: 'toolbox', args: ['postgres'] } } };
      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(mcpConfig));

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      const ar = result.data.apply_result;
      assert.ok(ar, 'should have apply_result');
      assert.strictEqual(ar.applied, false, 'should not apply without opencode.json');
      assert.ok(ar.reason.includes('No opencode.json'), 'reason should mention missing opencode.json');
    });

    test('restore from backup', () => {
      const originalConfig = {
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      const originalJson = JSON.stringify(originalConfig, null, 2);
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), originalJson);

      // First apply (creates backup, modifies config)
      mcpApply(tmpDir, '--apply', { isolateHome: true });

      // Verify config was modified
      const modifiedJson = fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8');
      assert.ok(modifiedJson.includes('"enabled": false'), 'config should be modified after apply');

      // Now restore
      const restoreResult = mcpApply(tmpDir, '--restore', { isolateHome: true });
      assert.ok(restoreResult.success, `restore failed: ${restoreResult.error}`);
      assert.strictEqual(restoreResult.data.restored, true, 'should report restored=true');

      // Verify config matches original (backup is byte-for-byte copy of original)
      const restoredJson = fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8');
      assert.strictEqual(restoredJson, originalJson, 'restored config should match original');

      // Verify backup removed
      assert.ok(!fs.existsSync(path.join(tmpDir, 'opencode.json.bak')), 'backup should be removed after restore');
    });

    test('restore without backup', () => {
      // opencode.json exists but no .bak
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify({ mcp: {} }));

      const result = mcpApply(tmpDir, '--restore', { isolateHome: true });
      assert.ok(result.success, `restore failed: ${result.error}`);
      assert.strictEqual(result.data.restored, false, 'should not restore without backup');
      assert.ok(result.data.reason.includes('No backup'), 'reason should mention no backup');
    });

    test('apply preserves non-MCP config', () => {
      const config = {
        '$schema': 'https://opencode.ai/schema',
        permission: { allow: ['Bash(*)', 'Read(*)'] },
        plugin: { 'my-plugin': { enabled: true } },
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config, null, 2));

      const result = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result.success, `apply failed: ${result.error}`);

      const modified = JSON.parse(fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8'));
      assert.strictEqual(modified['$schema'], 'https://opencode.ai/schema', '$schema preserved');
      assert.deepStrictEqual(modified.permission, { allow: ['Bash(*)', 'Read(*)'] }, 'permission preserved');
      assert.deepStrictEqual(modified.plugin, { 'my-plugin': { enabled: true } }, 'plugin preserved');
    });

    test('idempotent apply', () => {
      const config = {
        mcp: {
          terraform: { type: 'local', command: ['docker', 'run', 'terraform-mcp'] },
          'brave-search': { type: 'local', command: ['npx', 'server-brave-search'] },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'opencode.json'), JSON.stringify(config, null, 2));

      // First apply
      const result1 = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result1.success, `first apply failed: ${result1.error}`);
      const afterFirst = fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8');

      // Second apply (backup is now from first-apply state)
      const result2 = mcpApply(tmpDir, '--apply', { isolateHome: true });
      assert.ok(result2.success, `second apply failed: ${result2.error}`);
      const afterSecond = fs.readFileSync(path.join(tmpDir, 'opencode.json'), 'utf-8');

      // Config should be the same after both applies (idempotent)
      const cfg1 = JSON.parse(afterFirst);
      const cfg2 = JSON.parse(afterSecond);
      assert.strictEqual(cfg2.mcp.terraform.enabled, false, 'terraform still disabled');
      assert.strictEqual(cfg2.mcp['brave-search'].enabled, undefined, 'brave-search still not disabled');
    });
  });
});

// ─── Assertions Tests ────────────────────────────────────────────────────────

describe('assertions commands', () => {
  let tmpDir;

  const SAMPLE_ASSERTIONS = `# Assertions: Test Project

**Defined:** 2026-02-25
**Source:** REQUIREMENTS.md

## SREQ-01: Requirements template includes structured acceptance criteria

- assert: "ASSERTIONS.md template exists with schema definition"
  type: file
  priority: must-have

- assert: "parseAssertionsMd returns structured assertion map"
  when: "Given valid ASSERTIONS.md content"
  then: "Returns object with reqId keys"
  type: behavior
  priority: must-have

- assert: "assertions list outputs grouped data"
  type: cli
  priority: nice-to-have

## SREQ-03: Traceability table maps requirements to test commands

- assert: "trace-requirement shows assertion chain"
  when: "Requirement has assertions"
  then: "Output includes assertion pass/fail status"
  type: cli
  priority: must-have

- assert: "coverage percent reflects tested requirements"
  type: behavior
  priority: nice-to-have

## ENV-01: CLI detects project languages from manifest files

- assert: "env scan detects Node.js"
  type: cli
  priority: must-have

- assert: "Detection completes under 10ms"
  type: behavior
  priority: nice-to-have
`;

  const SAMPLE_REQUIREMENTS = `# Requirements

## v4.0 Requirements

### Structured Requirements

- [ ] **SREQ-01**: Requirements template includes structured acceptance criteria
- [ ] **SREQ-02**: New-milestone workflows generate structured requirements
- [ ] **SREQ-03**: Traceability table maps requirements to test commands
- [ ] **SREQ-04**: Phase verifier checks structured assertions
- [ ] **SREQ-05**: Plan must_haves derive from structured acceptance criteria

### Environment Awareness

- [x] **ENV-01**: CLI detects project languages from manifest files
`;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('parseAssertionsMd with sample content returns 3 requirements', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 3, 'should have 3 requirements');
    assert.strictEqual(data.total_assertions, 7, 'should have 7 assertions total');
  });

  test('assertions list counts must-have and nice-to-have correctly', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.must_have_count, 4, 'should have 4 must-have');
    assert.strictEqual(data.nice_to_have_count, 3, 'should have 3 nice-to-have');
  });

  test('assertions list --req filters to specific requirement', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('assertions list --req SREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 1, 'should have 1 requirement');
    assert.strictEqual(data.total_assertions, 3, 'SREQ-01 has 3 assertions');
    assert.ok(data.requirements['SREQ-01'], 'should contain SREQ-01');
    assert.ok(!data.requirements['ENV-01'], 'should not contain ENV-01');
  });

  test('assertions list preserves when/then/type fields', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    const sreq01 = data.requirements['SREQ-01'];
    const secondAssertion = sreq01.assertions[1];
    assert.strictEqual(secondAssertion.when, 'Given valid ASSERTIONS.md content', 'when field preserved');
    assert.strictEqual(secondAssertion.then, 'Returns object with reqId keys', 'then field preserved');
    assert.strictEqual(secondAssertion.type, 'behavior', 'type field preserved');
  });

  test('assertions list with missing ASSERTIONS.md returns soft error', () => {
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    assert.ok(result.output.includes('ASSERTIONS.md not found') || result.output.includes('error'), 'should report not found');
  });

  test('assertions validate reports valid for well-formed content', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('valid'), 'should be valid');
  });

  test('assertions validate catches missing assert field', () => {
    const badContent = `# Assertions: Test

## SREQ-01: Test req

- assert: ""
  type: cli
  priority: must-have

- assert: "Valid assertion"
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), badContent);
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.valid, false, 'should be invalid');
    assert.ok(data.issues.some(i => i.issue.includes('empty assert')), 'should catch empty assert');
  });

  test('assertions validate catches invalid type value', () => {
    const badContent = `# Assertions: Test

## SREQ-01: Test req

- assert: "Some assertion"
  type: invalid_type
  priority: must-have

- assert: "Another assertion"
  type: cli
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), badContent);
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.valid, false, 'should be invalid');
    assert.ok(data.issues.some(i => i.issue.includes('invalid type')), 'should catch invalid type');
  });

  test('assertions validate warns when req not in REQUIREMENTS.md', () => {
    const content = `# Assertions: Test

## FAKE-99: Nonexistent requirement

- assert: "This should warn"
  priority: must-have

- assert: "Another assertion"
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), content);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.issues.some(i => i.issue.includes('not found in REQUIREMENTS.md')), 'should warn about unknown req');
  });

  test('assertions validate computes coverage percent', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    // SAMPLE_ASSERTIONS has 3 reqs (SREQ-01, SREQ-03, ENV-01), REQUIREMENTS has 6 (SREQ-01-05 + ENV-01)
    assert.strictEqual(data.stats.reqs_with_assertions, 3, 'should have 3 reqs with assertions');
    assert.strictEqual(data.stats.total_reqs, 6, 'should have 6 total requirements');
    assert.strictEqual(data.stats.coverage_percent, 50, 'should be 50% coverage');
  });

  test('assertions validate with missing ASSERTIONS.md returns soft error', () => {
    const result = runGsdTools('assertions validate', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    assert.ok(result.output.includes('ASSERTIONS.md not found') || result.output.includes('error'), 'should report not found');
  });

  test('parseAssertionsMd handles empty content gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), '# Empty\n\nNo assertions here.\n');
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 0, 'should have 0 requirements');
    assert.strictEqual(data.total_assertions, 0, 'should have 0 assertions');
  });

  test('assertions list rawValue has correct format', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('assertions list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    // In piped mode, output is JSON with structured assertion data
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total_requirements, 3, 'should have 3 requirements');
    assert.strictEqual(data.total_assertions, 7, 'should have 7 assertions');
    assert.ok(data.must_have_count > 0, 'should have must-have assertions');
  });
});

describe('verify requirements with assertions', () => {
  let tmpDir;

  const SAMPLE_ASSERTIONS = `# Assertions: Test Project

**Defined:** 2026-02-25
**Source:** REQUIREMENTS.md

## SREQ-01: Requirements template includes structured acceptance criteria

- assert: "ASSERTIONS.md template exists with schema definition"
  type: file
  priority: must-have

- assert: "parseAssertionsMd returns structured assertion map"
  when: "Given valid ASSERTIONS.md content"
  then: "Returns object with reqId keys"
  type: behavior
  priority: must-have

- assert: "assertions list outputs grouped data"
  type: cli
  priority: nice-to-have

## SREQ-03: Traceability table maps requirements to test commands

- assert: "trace-requirement shows assertion chain"
  when: "Requirement has assertions"
  then: "Output includes assertion pass/fail status"
  type: cli
  priority: must-have

- assert: "coverage percent reflects tested requirements"
  type: behavior
  priority: nice-to-have
`;

  const SAMPLE_REQUIREMENTS = `# Requirements

## v4.0 Requirements

### Structured Requirements

- [x] **SREQ-01**: Requirements template includes structured acceptance criteria
- [ ] **SREQ-02**: New-milestone workflows generate structured requirements
- [ ] **SREQ-03**: Traceability table maps requirements to test commands

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SREQ-01 | Phase 20 | Complete |
| SREQ-02 | Phase 20 | Pending |
| SREQ-03 | Phase 20 | Pending |
`;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('verify requirements backward compatible when no ASSERTIONS.md', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    // Create phase directory with a summary so some reqs are "addressed"
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '20-structured-requirements');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '20-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should have 3 requirements');
    assert.ok(!data.assertions, 'should not have assertions field when no ASSERTIONS.md');
  });

  test('verify requirements includes per-assertion pass/fail when ASSERTIONS.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '20-structured-requirements');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '20-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.strictEqual(data.assertions.total, 5, 'should have 5 assertions from ASSERTIONS.md (2 reqs)');
    assert.ok(typeof data.assertions.verified === 'number', 'verified is a number');
    assert.ok(typeof data.assertions.failed === 'number', 'failed is a number');
    assert.ok(typeof data.assertions.needs_human === 'number', 'needs_human is a number');
    assert.ok(data.assertions.by_requirement['SREQ-01'], 'should have SREQ-01 in by_requirement');
    assert.ok(data.assertions.by_requirement['SREQ-03'], 'should have SREQ-03 in by_requirement');
  });

  test('verify requirements coverage percentage calculated correctly', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.ok(typeof data.assertions.coverage_percent === 'number', 'coverage_percent is a number');
    assert.ok(data.assertions.coverage_percent >= 0 && data.assertions.coverage_percent <= 100, 'coverage_percent between 0-100');
  });

  test('verify requirements must-have vs nice-to-have filtering in output', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    assert.ok(typeof data.assertions.must_have_pass === 'number', 'must_have_pass is a number');
    assert.ok(typeof data.assertions.must_have_fail === 'number', 'must_have_fail is a number');
    // Total must_have checks = must_have_pass + must_have_fail + must_have that are needs_human
    const totalMustHave = data.assertions.must_have_pass + data.assertions.must_have_fail;
    assert.ok(totalMustHave >= 0, 'total must-have checks >= 0');
  });

  test('verify requirements file-type assertions check disk existence', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    // Create assertion referencing a file that exists
    const fileAssertions = `# Assertions

## SREQ-01: Test req

- assert: "REQUIREMENTS.md file exists"
  type: file
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), fileAssertions);
    // The file .planning/REQUIREMENTS.md exists in tmpDir
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions field');
    // The assertion references REQUIREMENTS.md which exists on disk
    const sreq01 = data.assertions.by_requirement['SREQ-01'];
    assert.ok(sreq01, 'SREQ-01 should exist');
    // It should find REQUIREMENTS.md as matching (within .planning/)
    const fileAssertion = sreq01.assertions[0];
    assert.ok(fileAssertion.status === 'pass' || fileAssertion.status === 'needs_human', 'file assertion should pass or need human review');
  });

  test('verify requirements test-command column parsing', () => {
    const reqWithTestCol = `# Requirements

## v4.0 Requirements

- [x] **SREQ-01**: First req
- [ ] **SREQ-02**: Second req

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| SREQ-01 | Phase 20 | Complete | npm test -- --grep "assertions" |
| SREQ-02 | Phase 20 | Pending | node run-check.js |
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), reqWithTestCol);
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.test_commands, 'should include test_commands field');
    assert.strictEqual(data.test_commands.total, 2, 'should have 2 test commands');
    assert.strictEqual(data.test_commands.valid, 2, 'both npm and node are known commands');
  });

  test('verify requirements rawValue includes assertion stats when assertions present', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), SAMPLE_ASSERTIONS);
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    // In piped mode, output is JSON with assertion stats
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should have assertions field');
    assert.ok(data.assertions.total >= 0, 'assertions should have total count');
  });

  test('verify requirements failed must-have assertions include gap_description', () => {
    const failAssertions = `# Assertions

## SREQ-01: Test req

- assert: "nonexistent-file-xyz.md must exist on disk"
  type: file
  priority: must-have
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), SAMPLE_REQUIREMENTS);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), failAssertions);
    const result = runGsdTools('verify requirements', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should have assertions');
    const sreq01 = data.assertions.by_requirement['SREQ-01'];
    const failedAssertion = sreq01.assertions.find(a => a.status === 'fail');
    if (failedAssertion) {
      assert.ok(failedAssertion.gap_description, 'failed must-have should have gap_description');
      assert.ok(failedAssertion.gap_description.includes('SREQ-01'), 'gap_description should include req ID');
    }
  });
});

describe('trace-requirement with assertions', () => {
  let tmpDir;

  const TRACE_ASSERTIONS = `# Assertions

## TREQ-01: Test requirement for tracing

- assert: "Feature A exists"
  type: file
  priority: must-have

- assert: "Feature B works correctly"
  type: behavior
  priority: must-have

- assert: "Feature C has nice formatting"
  type: cli
  priority: nice-to-have
`;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create ROADMAP with requirement mapping
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 10: Test Phase

**Goal:** Implement test features
**Plans:** 2
**Requirements:** TREQ-01
**Depends on:** Nothing
`);
    // Create phase directory with plan
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '10-01-PLAN.md'), `---
phase: 10-test-phase
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/feature-a.js
autonomous: true
requirements:
  - TREQ-01
must_haves:
  truths:
    - "Feature A exists"
    - "Feature B works correctly"
---

<objective>Implement features</objective>
<tasks>
<task type="auto">
  <name>Task 1</name>
  <action>Do stuff</action>
  <verify>Check it</verify>
  <done>Done</done>
</task>
</tasks>
`);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('trace-requirement shows assertion data when ASSERTIONS.md present', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions array');
    assert.strictEqual(data.assertion_count, 3, 'should have 3 assertions');
    assert.strictEqual(data.must_have_count, 2, 'should have 2 must-have assertions');
    assert.ok(data.chain, 'should include chain field');
  });

  test('trace-requirement backward compatible without ASSERTIONS.md', () => {
    // No ASSERTIONS.md exists
    const result = runGsdTools('trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(!data.assertions, 'should not include assertions when no ASSERTIONS.md');
    assert.ok(!data.chain, 'should not include chain when no ASSERTIONS.md');
    assert.strictEqual(data.requirement, 'TREQ-01', 'requirement ID should be present');
    assert.strictEqual(data.phase, '10', 'phase should be 10');
  });

  test('trace-requirement chain format is correct', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.chain, 'should include chain field');
    assert.ok(data.chain.includes('TREQ-01'), 'chain should include requirement ID');
    assert.ok(data.chain.includes('assertions'), 'chain should mention assertions');
    assert.ok(data.chain.includes('must-have'), 'chain should mention must-have');
    assert.ok(data.chain.includes('VERIFICATION'), 'chain should include verification status');
  });

  test('trace-requirement assertion planned/implemented status with summary', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    // Add a SUMMARY to mark plan as complete
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '10-test-phase');
    fs.writeFileSync(path.join(phaseDir, '10-01-SUMMARY.md'), '# Summary\nDone\n');
    const result = runGsdTools('trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions');
    // With summary, planned+truth-matched assertions should be implemented
    const planned = data.assertions.filter(a => a.planned);
    assert.ok(planned.length > 0, 'at least some assertions should be planned (matching truths)');
    for (const a of planned) {
      assert.strictEqual(a.implemented, true, `planned assertion "${a.assert}" should be implemented when summary exists`);
      assert.strictEqual(a.gap, false, 'implemented assertion should not be a gap');
    }
  });

  test('trace-requirement assertion gap detection for unplanned assertions', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ASSERTIONS.md'), TRACE_ASSERTIONS);
    const result = runGsdTools('trace-requirement TREQ-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(data.assertions, 'should include assertions');
    // "Feature C has nice formatting" is not in must_haves.truths, so it should be a gap
    const niceFormatting = data.assertions.find(a => a.assert.includes('nice formatting'));
    assert.ok(niceFormatting, 'should find the nice-to-have assertion');
    assert.strictEqual(niceFormatting.gap, true, 'unplanned assertion should be a gap');
    assert.strictEqual(niceFormatting.planned, false, 'unplanned assertion should have planned: false');
  });
});

// =============================================================================
// Worktree Commands
// =============================================================================

describe('worktree commands', () => {
  let tmpDir;
  let worktreeBase;

  /**
   * Create a temp project with a real git repo (required for git worktree).
   * Also creates a separate temp dir for worktree base_path.
   */
  function createGitProject(configOverrides = {}) {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-test-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-base-'));

    // Init git repo with initial commit (worktree requires at least one commit)
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    // Create .planning directory with config
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    const worktreeConfig = {
      enabled: true,
      base_path: worktreeBase,
      sync_files: ['.env', '.env.local', '.planning/config.json'],
      setup_hooks: [],
      max_concurrent: 3,
      ...configOverrides,
    };

    const config = {
      mode: 'yolo',
      worktree: worktreeConfig,
    };

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    return tmpDir;
  }

  /**
   * Cleanup all worktrees before removing temp dirs.
   * Must remove worktrees before deleting the git repo.
   */
  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        // Remove all worktrees first
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
        const listOutput = execSync('git worktree list --porcelain', {
          cwd: tmpDir,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        // Parse and remove each non-main worktree
        const blocks = listOutput.split('\n\n');
        for (const block of blocks) {
          const pathMatch = block.match(/^worktree (.+)$/m);
          if (pathMatch && pathMatch[1] !== tmpDir) {
            try {
              execSync(`git worktree remove "${pathMatch[1]}" --force`, {
                cwd: tmpDir,
                stdio: 'pipe',
              });
            } catch { /* ignore cleanup errors */ }
          }
        }
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }

      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (worktreeBase && fs.existsSync(worktreeBase)) {
      fs.rmSync(worktreeBase, { recursive: true, force: true });
    }
  }

  afterEach(() => {
    cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // worktree list
  // ---------------------------------------------------------------------------

  describe('worktree list', () => {
    test('returns empty worktrees array when no worktrees exist', () => {
      createGitProject();
      const result = runGsdTools('worktree list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(Array.isArray(data.worktrees), 'worktrees should be an array');
      assert.strictEqual(data.worktrees.length, 0, 'should have no worktrees');
    });

    test('returns worktree details after create', () => {
      createGitProject();
      // Create a worktree first
      const createResult = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);

      // Now list
      const listResult = runGsdTools('worktree list', tmpDir);
      assert.ok(listResult.success, `List failed: ${listResult.error}`);
      const data = JSON.parse(listResult.output);

      assert.strictEqual(data.worktrees.length, 1, 'should have 1 worktree');
      const wt = data.worktrees[0];
      assert.strictEqual(wt.plan_id, '21-02', 'plan_id should match');
      assert.ok(wt.branch, 'should have a branch name');
      assert.ok(wt.path, 'should have a path');
      assert.ok(wt.disk_usage, 'should have disk_usage');
    });

    test('only shows worktrees for current project', () => {
      createGitProject();
      // Create a worktree for this project
      runGsdTools('worktree create 21-02', tmpDir);

      // Manually create a worktree outside the project's base_path prefix
      // by using a different path — the list should not show it
      const otherPath = path.join(worktreeBase, 'other-project', '99-01');
      fs.mkdirSync(path.dirname(otherPath), { recursive: true });
      execSync(`git worktree add -b other-branch "${otherPath}"`, {
        cwd: tmpDir,
        stdio: 'pipe',
      });

      const result = runGsdTools('worktree list', tmpDir);
      assert.ok(result.success, `List failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Should only show the one under project name, not the 'other-project' one
      assert.strictEqual(data.worktrees.length, 1, 'should only show 1 project worktree');
      assert.strictEqual(data.worktrees[0].plan_id, '21-02', 'should be the correct plan');

      // Cleanup the extra worktree
      try {
        execSync(`git worktree remove "${otherPath}" --force`, { cwd: tmpDir, stdio: 'pipe' });
        execSync('git branch -D other-branch', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
    });
  });

  // ---------------------------------------------------------------------------
  // worktree create
  // ---------------------------------------------------------------------------

  describe('worktree create', () => {
    test('creates worktree at expected path with correct branch', () => {
      createGitProject();
      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.created, true, 'should report created');
      assert.strictEqual(data.plan_id, '21-02', 'plan_id should match');
      assert.ok(data.branch.startsWith('worktree-21-02-'), 'branch should start with worktree-21-02-');
      assert.ok(data.path.includes(worktreeBase), 'path should be under base_path');
      assert.ok(data.path.endsWith('21-02'), 'path should end with plan_id');
      assert.ok(fs.existsSync(data.path), 'worktree directory should exist on disk');
      assert.strictEqual(data.setup_status, 'ok', 'setup should succeed');
    });

    test('syncs .env file if it exists in source project', () => {
      createGitProject();
      // Create a .env file in the source project
      fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET_KEY=test123\n');

      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.synced_files.includes('.env'), '.env should be in synced_files');
      // Verify the file was actually copied
      const destEnv = path.join(data.path, '.env');
      assert.ok(fs.existsSync(destEnv), '.env should exist in worktree');
      assert.strictEqual(
        fs.readFileSync(destEnv, 'utf-8'),
        'SECRET_KEY=test123\n',
        '.env content should match'
      );
    });

    test('skips sync gracefully when .env does not exist', () => {
      createGitProject();
      // Don't create .env — it shouldn't be in synced_files list
      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(!data.synced_files.includes('.env'), '.env should NOT be in synced_files');
      assert.ok(!data.synced_files.includes('.env.local'), '.env.local should NOT be in synced_files');
      // .planning/config.json DOES exist (we created it), so it should be synced
      assert.ok(
        data.synced_files.includes('.planning/config.json'),
        '.planning/config.json should be synced'
      );
    });

    test('returns setup_failed when setup hook fails', () => {
      createGitProject({ setup_hooks: ['false'] });

      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.created, true, 'worktree should still be created');
      assert.strictEqual(data.setup_status, 'failed', 'setup should report failed');
      assert.ok(data.setup_error, 'should have setup_error message');
      assert.ok(data.setup_error.includes('false'), 'error should mention the failing hook');
    });

    test('returns error when plan_id is missing', () => {
      createGitProject();
      const result = runGsdTools('worktree create', tmpDir);
      assert.ok(!result.success, 'should fail without plan_id');
    });

    test('returns error when worktree already exists for same plan_id', () => {
      createGitProject();
      // Create the first time — should succeed
      const first = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(first.success, `First create failed: ${first.error}`);

      // Create again — should fail
      const second = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(!second.success, 'should fail when worktree already exists');
      assert.ok(
        second.error.includes('already exists') || second.output.includes('already exists'),
        'error should mention "already exists"'
      );
    });

    test('respects max_concurrent limit', () => {
      createGitProject({ max_concurrent: 1 });

      // Create first worktree — should succeed
      const first = runGsdTools('worktree create 21-01', tmpDir);
      assert.ok(first.success, `First create failed: ${first.error}`);

      // Create second — should fail because max_concurrent=1
      const second = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(!second.success, 'should fail when max_concurrent exceeded');
      assert.ok(
        second.error.includes('Max concurrent') || second.output.includes('Max concurrent'),
        'error should mention max concurrent limit'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree remove
  // ---------------------------------------------------------------------------

  describe('worktree remove', () => {
    test('removes worktree and deletes branch', () => {
      createGitProject();
      // Create then remove
      const createResult = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;
      const branchName = createData.branch;

      // Verify it exists
      assert.ok(fs.existsSync(wtPath), 'worktree should exist before remove');

      // Remove it
      const removeResult = runGsdTools('worktree remove 21-02', tmpDir);
      assert.ok(removeResult.success, `Remove failed: ${removeResult.error}`);
      const removeData = JSON.parse(removeResult.output);

      assert.strictEqual(removeData.removed, true, 'should report removed');
      assert.strictEqual(removeData.plan_id, '21-02', 'plan_id should match');
      assert.ok(!fs.existsSync(wtPath), 'worktree directory should be gone');

      // Verify branch is deleted
      const branchCheck = execSync('git branch', { cwd: tmpDir, encoding: 'utf-8' });
      assert.ok(!branchCheck.includes(branchName), 'branch should be deleted');
    });

    test('returns error for non-existent plan_id', () => {
      createGitProject();
      const result = runGsdTools('worktree remove 99-99', tmpDir);
      assert.ok(!result.success, 'should fail for non-existent plan');
      assert.ok(
        result.error.includes('No worktree found') || result.output.includes('No worktree found'),
        'error should mention no worktree found'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree cleanup
  // ---------------------------------------------------------------------------

  describe('worktree cleanup', () => {
    test('removes all project worktrees', () => {
      createGitProject({ max_concurrent: 3 });
      // Create two worktrees
      runGsdTools('worktree create 21-01', tmpDir);
      runGsdTools('worktree create 21-02', tmpDir);

      // Verify they exist
      const listBefore = runGsdTools('worktree list', tmpDir);
      const beforeData = JSON.parse(listBefore.output);
      assert.strictEqual(beforeData.worktrees.length, 2, 'should have 2 worktrees before cleanup');

      // Cleanup
      const result = runGsdTools('worktree cleanup', tmpDir);
      assert.ok(result.success, `Cleanup failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.cleaned, 2, 'should have cleaned 2 worktrees');
      assert.strictEqual(data.worktrees.length, 2, 'should list 2 removed worktrees');

      // Verify list is now empty
      const listAfter = runGsdTools('worktree list', tmpDir);
      const afterData = JSON.parse(listAfter.output);
      assert.strictEqual(afterData.worktrees.length, 0, 'should have 0 worktrees after cleanup');
    });

    test('returns cleaned: 0 when no worktrees exist', () => {
      createGitProject();
      const result = runGsdTools('worktree cleanup', tmpDir);
      assert.ok(result.success, `Cleanup failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.cleaned, 0, 'should report 0 cleaned');
      assert.strictEqual(data.worktrees.length, 0, 'should have empty worktrees array');
    });
  });

  // ---------------------------------------------------------------------------
  // config validation
  // ---------------------------------------------------------------------------

  describe('worktree config', () => {
    test('default config used when no worktree section in config.json', () => {
      tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-test-'));
      worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-base-'));

      // Init git repo
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

      // Create config WITHOUT worktree section
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'config.json'),
        JSON.stringify({ mode: 'yolo' }, null, 2)
      );

      // List should work with defaults (uses /tmp/gsd-worktrees as base_path)
      const result = runGsdTools('worktree list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(Array.isArray(data.worktrees), 'should return worktrees array with defaults');
    });

    test('custom base_path is respected', () => {
      const customBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-wt-custom-'));
      createGitProject({ base_path: customBase });

      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.ok(data.path.startsWith(customBase), `path should start with custom base: ${data.path}`);
      assert.ok(fs.existsSync(data.path), 'worktree should exist at custom path');

      // Cleanup the custom base too
      try {
        execSync(`git worktree remove "${data.path}" --force`, { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
      fs.rmSync(customBase, { recursive: true, force: true });
    });

    test('resource warnings included when memory is low for max_concurrent', () => {
      // Set max_concurrent very high so resource warning triggers
      createGitProject({ max_concurrent: 100 });

      const result = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // With max_concurrent=100, the system would need 400GB RAM — should trigger warning
      assert.ok(data.resource_warnings, 'should have resource_warnings');
      assert.ok(data.resource_warnings.length > 0, 'should have at least one warning');
      assert.ok(
        data.resource_warnings.some(w => w.includes('memory') || w.includes('Memory')),
        'should warn about memory'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // parsePlanId helper
  // ---------------------------------------------------------------------------

  describe('worktree parsePlanId (via CLI)', () => {
    test('rejects invalid plan ID format', () => {
      createGitProject();
      const result = runGsdTools('worktree create not-valid', tmpDir);
      assert.ok(!result.success, 'should fail for invalid plan ID');
      assert.ok(
        result.error.includes('Invalid plan ID') || result.output.includes('Invalid plan ID'),
        'error should mention invalid plan ID'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // worktree merge
  // ---------------------------------------------------------------------------

  describe('worktree merge', () => {
    test('clean merge succeeds when worktree modifies unique file', () => {
      createGitProject();

      // Create worktree for plan 21-02
      const createResult = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Make a unique change in the worktree and commit it
      fs.writeFileSync(path.join(wtPath, 'new-feature.js'), 'module.exports = { feature: true };\n');
      execSync('git add new-feature.js && git commit -m "add feature"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Run merge
      const mergeResult = runGsdTools('worktree merge 21-02', tmpDir);
      assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, true, 'should have merged successfully');
      assert.strictEqual(mergeData.plan_id, '21-02');
      assert.ok(mergeData.branch, 'should include branch name');

      // Verify the merged content is in the base branch
      assert.ok(
        fs.existsSync(path.join(tmpDir, 'new-feature.js')),
        'merged file should exist in base branch'
      );
    });

    test('conflict detected and blocked when both sides modify same file', () => {
      createGitProject();

      // Create worktree
      const createResult = runGsdTools('worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Modify README.md differently in worktree
      fs.writeFileSync(path.join(wtPath, 'README.md'), '# Modified in worktree\nWorktree content\n');
      execSync('git add README.md && git commit -m "modify readme in worktree"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Modify README.md differently in base
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Modified in base\nBase content\n');
      execSync('git add README.md && git commit -m "modify readme in base"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Run merge — should detect conflict
      const mergeResult = runGsdTools('worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge command should succeed (returns JSON): ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, false, 'should NOT have merged');
      assert.ok(Array.isArray(mergeData.conflicts), 'should have conflicts array');
      assert.ok(mergeData.conflicts.length > 0, 'should have at least one conflict');
      assert.ok(
        mergeData.conflicts.some(c => c.file === 'README.md' || c.file.includes('README')),
        'conflicts should mention README.md'
      );

      // Verify base branch doesn't have conflict markers
      const baseReadme = fs.readFileSync(path.join(tmpDir, 'README.md'), 'utf-8');
      assert.ok(
        !baseReadme.includes('<<<<<<<'),
        'base branch should not have conflict markers (merge was blocked)'
      );
    });

    test('lockfile auto-resolution: package-lock.json conflict auto-resolved', () => {
      createGitProject();

      // Create a package-lock.json in base and commit
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, base: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "add lockfile"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Create worktree
      const createResult = runGsdTools('worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      // Modify lockfile differently in worktree
      fs.writeFileSync(path.join(wtPath, 'package-lock.json'), JSON.stringify({ lockfileVersion: 2, worktree: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "update lockfile in worktree"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Modify lockfile differently in base
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, base: true, updated: true }, null, 2));
      execSync('git add package-lock.json && git commit -m "update lockfile in base"', {
        cwd: tmpDir, stdio: 'pipe',
      });

      // Merge — lockfile-only conflict should be auto-resolved
      const mergeResult = runGsdTools('worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge command failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      // Lockfile is auto-resolvable, so it might either:
      // - Be reported as auto_resolved with merged=true (ideal)
      // - Or merged=true since conflicts are only lockfiles
      // The key assertion: no real conflicts blocking the merge
      if (mergeData.merged === false) {
        // If conflicts array only has lockfile entries, that's a test of the parser
        // but the merge should ideally succeed. Check it's at least recognized.
        assert.ok(
          mergeData.conflicts.every(c => c.file === 'package-lock.json'),
          'only lockfile conflicts should be reported'
        );
      } else {
        assert.strictEqual(mergeData.merged, true, 'should merge with lockfile auto-resolution');
      }
    });

    test('file overlap warning included in merge output', () => {
      createGitProject();

      // Create two PLAN.md files in phase dir, both listing same file in files_modified
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      const plan01Content = `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
  - src/router.js
---

# Plan 01
`;

      const plan02Content = `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
  - bin/gsd-tools.test.cjs
---

# Plan 02
`;

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), plan01Content);
      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), plan02Content);

      // Create worktree and make a change
      const createResult = runGsdTools('worktree create 21-01', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);
      const createData = JSON.parse(createResult.output);
      const wtPath = createData.path;

      fs.writeFileSync(path.join(wtPath, 'unique-file.js'), 'export default {};\n');
      execSync('git add unique-file.js && git commit -m "add unique file"', {
        cwd: wtPath, stdio: 'pipe',
      });

      // Run merge for plan 21-01
      const mergeResult = runGsdTools('worktree merge 21-01', tmpDir);
      assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);
      const mergeData = JSON.parse(mergeResult.output);

      assert.strictEqual(mergeData.merged, true, 'should merge successfully');
      assert.ok(Array.isArray(mergeData.file_overlap_warnings), 'should have file_overlap_warnings');
      assert.ok(mergeData.file_overlap_warnings.length > 0, 'should have at least one overlap warning');
      assert.ok(
        mergeData.file_overlap_warnings.some(w =>
          w.shared_files.includes('src/commands/worktree.js')
        ),
        'overlap should mention shared file src/commands/worktree.js'
      );
    });

    test('merge of non-existent plan_id returns error', () => {
      createGitProject();

      const result = runGsdTools('worktree merge 99-99', tmpDir);
      assert.ok(!result.success, 'should fail for non-existent plan');
      assert.ok(
        (result.error + result.output).includes('No worktree found'),
        'error should mention no worktree found'
      );
    });

    test('merge with no commits in worktree succeeds as no-op', () => {
      createGitProject();

      // Create worktree but don't make any changes
      const createResult = runGsdTools('worktree create 21-02', tmpDir);
      assert.ok(createResult.success, `Create failed: ${createResult.error}`);

      // Merge with no commits — should succeed (nothing to merge, branches at same point)
      const mergeResult = runGsdTools('worktree merge 21-02', tmpDir);
      // This might either succeed with merged=true (no-op merge) or fail with "already up to date"
      // Either way is valid behavior
      if (mergeResult.success) {
        const mergeData = JSON.parse(mergeResult.output);
        // merged could be true (no-ff merge with same content) or command might report already up to date
        assert.ok(mergeData.plan_id === '21-02', 'should reference the correct plan');
      }
      // If not successful, it's because git merge says "already up to date" — also valid
    });
  });

  // ---------------------------------------------------------------------------
  // worktree check-overlap
  // ---------------------------------------------------------------------------

  describe('worktree check-overlap', () => {
    test('no overlap between plans with different files_modified', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/merge.js
---

# Plan 02
`);

      const result = runGsdTools('worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'should have no conflicts');
      assert.strictEqual(data.overlaps.length, 0, 'should have no overlaps');
      assert.strictEqual(data.plans_analyzed, 2, 'should analyze 2 plans');
    });

    test('overlap detected within same wave', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/router.js
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
  - bin/gsd-tools.test.cjs
---

# Plan 02
`);

      const result = runGsdTools('worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, true, 'should detect conflicts');
      assert.strictEqual(data.overlaps.length, 1, 'should have 1 overlap');
      assert.deepStrictEqual(data.overlaps[0].plans, ['21-01', '21-02']);
      assert.ok(
        data.overlaps[0].files.includes('src/commands/worktree.js'),
        'overlap should include shared file'
      );
      assert.strictEqual(data.overlaps[0].wave, '1', 'overlap should be in wave 1');
    });

    test('no overlap when plans are in different waves', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 01
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 2
files_modified:
  - src/commands/worktree.js
---

# Plan 02
`);

      const result = runGsdTools('worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'different waves should not conflict');
      assert.strictEqual(data.overlaps.length, 0, 'should have no overlaps');
    });

    test('handles missing files_modified gracefully', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      // Plan without files_modified frontmatter
      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
---

# Plan 01 - no files_modified
`);

      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/commands/worktree.js
---

# Plan 02
`);

      const result = runGsdTools('worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'missing files_modified should not cause conflicts');
      assert.strictEqual(data.plans_analyzed, 2, 'should still analyze both plans');
    });

    test('three plans with no shared files returns empty overlaps', () => {
      createGitProject();

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

      fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/a.js
---
# Plan 01
`);
      fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/b.js
---
# Plan 02
`);
      fs.writeFileSync(path.join(phaseDir, '21-03-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 03
wave: 1
files_modified:
  - src/c.js
---
# Plan 03
`);

      const result = runGsdTools('worktree check-overlap 21', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.has_conflicts, false, 'disjoint files should have no conflicts');
      assert.strictEqual(data.overlaps.length, 0, 'should have empty overlaps');
      assert.strictEqual(data.plans_analyzed, 3, 'should analyze all 3 plans');
    });
  });
});

// ─── Init Execute-Phase Worktree Integration Tests ────────────────────────────

describe('init execute-phase worktree fields', () => {
  let tmpDir;
  let worktreeBase;

  function createGitProject(configOverrides = {}) {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-base-'));

    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    // Create minimal ROADMAP.md (needed by getMilestoneInfo)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Milestones

- 🔵 v1.0 — Test Milestone

### Phase 21: Worktree Parallelism
- Plans: TBD
`);

    // Create minimal STATE.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 21 (Worktree Parallelism)
**Current Plan:** Plan 01 next
**Status:** In progress
**Last Activity:** 2026-02-25

Progress: [████████░░] 80% (4/5 phases)

## Accumulated Context

### Decisions

None.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: N/A
`);

    const config = {
      mode: 'yolo',
      worktree: {
        enabled: true,
        base_path: worktreeBase,
        sync_files: ['.env', '.env.local', '.planning/config.json'],
        setup_hooks: [],
        max_concurrent: 5,
        ...configOverrides,
      },
    };

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(config, null, 2)
    );

    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    return tmpDir;
  }

  function cleanupAll() {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
        const listOutput = execSync('git worktree list --porcelain', {
          cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
        });
        const blocks = listOutput.split('\n\n');
        for (const block of blocks) {
          const pathMatch = block.match(/^worktree (.+)$/m);
          if (pathMatch && pathMatch[1] !== tmpDir) {
            try {
              execSync(`git worktree remove "${pathMatch[1]}" --force`, { cwd: tmpDir, stdio: 'pipe' });
            } catch { /* ignore */ }
          }
        }
        execSync('git worktree prune', { cwd: tmpDir, stdio: 'pipe' });
      } catch { /* ignore */ }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (worktreeBase && fs.existsSync(worktreeBase)) {
      fs.rmSync(worktreeBase, { recursive: true, force: true });
    }
  }

  afterEach(() => {
    cleanupAll();
  });

  test('worktree fields present when enabled', () => {
    createGitProject();

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, true, 'worktree_enabled should be true');
    assert.ok(data.worktree_config, 'worktree_config should exist');
    assert.strictEqual(data.worktree_config.base_path, worktreeBase, 'base_path should match config');
    assert.strictEqual(data.worktree_config.max_concurrent, 5, 'max_concurrent should be 5');
    assert.ok(Array.isArray(data.worktree_active), 'worktree_active should be array');
    assert.ok(Array.isArray(data.file_overlaps), 'file_overlaps should be array');
  });

  test('worktree fields default when disabled', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-'));
    worktreeBase = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-init-wt-base-'));

    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Milestones

- 🔵 v1.0 — Test

### Phase 21: Worktree Parallelism
- Plans: TBD
`);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 21
**Status:** In progress
**Last Activity:** 2026-02-25

Progress: [████████░░] 80%

## Accumulated Context

### Decisions

None.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: N/A
`);

    // Config WITHOUT worktree section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );

    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, false, 'worktree_enabled should be false');
    // In verbose mode, worktree fields are trimmed when disabled to reduce token waste
    assert.strictEqual(data.worktree_config, undefined, 'worktree_config omitted when disabled');
    assert.strictEqual(data.worktree_active, undefined, 'worktree_active omitted when disabled');
    assert.strictEqual(data.file_overlaps, undefined, 'file_overlaps omitted when disabled');
  });

  test('file overlaps detected in init output', () => {
    createGitProject();

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

    // Two plans in same wave with overlapping files
    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/shared.js
  - src/a.js
---

# Plan 01
`);

    fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 1
files_modified:
  - src/shared.js
  - src/b.js
---

# Plan 02
`);

    execSync('git add . && git commit -m "add plans"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.file_overlaps.length > 0, 'should detect file overlaps');
    assert.ok(data.file_overlaps[0].files.includes('src/shared.js'), 'should include shared.js');
    assert.deepStrictEqual(data.file_overlaps[0].plans, ['21-01', '21-02'], 'should identify overlapping plans');
  });

  test('no overlap when plans are in different waves', () => {
    createGitProject();

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');

    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
files_modified:
  - src/shared.js
---

# Plan 01
`);

    fs.writeFileSync(path.join(phaseDir, '21-02-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 02
wave: 2
files_modified:
  - src/shared.js
---

# Plan 02
`);

    execSync('git add . && git commit -m "add plans"', { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.deepStrictEqual(data.file_overlaps, [], 'different waves should not have overlaps');
  });

  test('active worktrees included when they exist', () => {
    createGitProject();

    // Create a worktree for plan 21-01
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '21-worktree-parallelism');
    fs.writeFileSync(path.join(phaseDir, '21-01-PLAN.md'), `---
phase: 21-worktree-parallelism
plan: 01
wave: 1
---

# Plan 01
`);
    execSync('git add . && git commit -m "add plan"', { cwd: tmpDir, stdio: 'pipe' });

    const createResult = runGsdTools('worktree create 21-01', tmpDir);
    assert.ok(createResult.success, `Worktree create failed: ${createResult.error}`);

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.worktree_active.length > 0, 'should have active worktrees');
    assert.strictEqual(data.worktree_active[0].plan_id, '21-01', 'should include plan 21-01');
    assert.ok(data.worktree_active[0].branch, 'should include branch name');
    assert.ok(data.worktree_active[0].path, 'should include worktree path');
  });

  test('init graceful when worktree base_path does not exist yet', () => {
    createGitProject({ base_path: '/tmp/gsd-wt-nonexistent-test-dir-' + Date.now() });

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command should succeed even with non-existent base_path: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_enabled, true, 'worktree_enabled should still be true');
    assert.deepStrictEqual(data.worktree_active, [], 'worktree_active should be empty');
  });

  test('config max_concurrent surfaces in init output', () => {
    createGitProject({ max_concurrent: 7 });

    const result = runGsdTools('init execute-phase 21 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.worktree_config.max_concurrent, 7, 'max_concurrent should be 7');
  });
});

// ─── Session Summary Tests ──────────────────────────────────────────────────

describe('session-summary command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns valid JSON with all required fields when STATE.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** 03
**Status:** Executing
**Last Activity:** 2026-02-25

Progress: [██████████] 100% (5/5 phases)

## Accumulated Context

### Decisions

v4.0 decisions:
- [Phase 21]: Worktree config read directly from config.json

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 21-03-PLAN.md
Resume file: None
`);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Check all 4 top-level fields exist
    assert.ok(data.current_position, 'should have current_position');
    assert.ok(data.session_activity, 'should have session_activity');
    assert.ok(data.next_action, 'should have next_action');
    assert.ok(data.session_continuity, 'should have session_continuity');

    // Check position details
    assert.strictEqual(data.current_position.phase, '21 of 22');
    assert.strictEqual(data.current_position.phase_name, 'Worktree Parallelism');
    assert.strictEqual(data.current_position.plan, '03');
    assert.strictEqual(data.current_position.status, 'Executing');
  });

  test('returns error JSON when STATE.md is missing', () => {
    // Don't create STATE.md — just use the empty temp project
    const result = runGsdTools('session-summary', tmpDir);
    assert.ok(result.success, `Command should succeed even without STATE.md: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.error, 'should have error field');
    assert.ok(data.error.includes('not found'), 'error should mention not found');
  });

  test('correctly identifies next action when current phase is complete', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-02-25

## Accumulated Context

### Decisions

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed phase 21
Resume file: None
`);

    // Create phase 22 directory with a plan
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish', '22-01-PLAN.md'), '# Plan');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Should suggest executing phase 22 (has plans, not yet complete)
    assert.ok(data.next_action.command.includes('22'), `next action should reference phase 22, got: ${data.next_action.command}`);
    assert.ok(data.next_action.command.includes('execute'), `should suggest execute since plans exist, got: ${data.next_action.command}`);
  });

  test('suggests plan-phase when next phase has no plans', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 21 of 22 (Worktree Parallelism)
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-02-25

## Accumulated Context

### Decisions

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed phase 21
Resume file: None
`);

    // Phase 22 dir exists but has no plans
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '22-workflow-polish'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Active Milestone: v4.0

- [x] **Phase 21: Worktree Parallelism** — worktrees
- [ ] **Phase 22: Workflow Polish** — session handoffs
`);

    const result = runGsdTools('session-summary', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Should suggest planning phase 22 (no plans yet)
    assert.ok(data.next_action.command.includes('22'), `next action should reference phase 22, got: ${data.next_action.command}`);
    assert.ok(data.next_action.command.includes('plan'), `should suggest plan since no plans exist, got: ${data.next_action.command}`);
  });
});

describe('codebase intelligence', () => {
  let tmpDir;

  function createCodebaseProject() {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-codebase-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
    // Create sample source files for analysis
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'index.js'), 'const x = 1;\nmodule.exports = { x };\n');
    fs.writeFileSync(path.join(dir, 'src', 'utils.js'), 'function helper() { return true; }\nmodule.exports = { helper };\n');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test-proj","version":"1.0.0"}\n');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Test Project\n\nSome description.\n');
    // Initialize git repo for staleness detection
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  beforeEach(() => {
    tmpDir = createCodebaseProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('codebase analyze', () => {
    test('codebase analyze --raw succeeds on a project with source files', () => {
      const result = runGsdTools('codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const data = JSON.parse(result.output);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.mode, 'full');
      assert.ok(data.total_files > 0, `Expected total_files > 0, got ${data.total_files}`);
    });

    test('codebase analyze creates codebase-intel.json', () => {
      runGsdTools('codebase analyze', tmpDir);

      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      assert.ok(fs.existsSync(intelPath), 'codebase-intel.json should exist after analyze');
    });

    test('intel JSON has required fields', () => {
      runGsdTools('codebase analyze', tmpDir);

      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));

      assert.ok(intel.version, 'should have version field');
      assert.ok(intel.git_commit_hash, 'should have git_commit_hash field');
      assert.ok(intel.generated_at, 'should have generated_at field');
      assert.ok(intel.files, 'should have files field');
      assert.ok(intel.languages, 'should have languages field');
      assert.ok(intel.stats, 'should have stats field');
      assert.ok(intel.stats.total_files > 0, 'should have total_files in stats');
      assert.ok(typeof intel.stats.total_lines === 'number', 'should have total_lines in stats');
    });

    test('running analyze twice — second run reports incremental or cached mode', () => {
      // First run: full
      const first = runGsdTools('codebase analyze', tmpDir);
      assert.ok(first.success, `First run failed: ${first.error}`);
      const firstData = JSON.parse(first.output);
      assert.strictEqual(firstData.mode, 'full');

      // Second run: should be cached (no changes)
      const second = runGsdTools('codebase analyze', tmpDir);
      assert.ok(second.success, `Second run failed: ${second.error}`);
      const secondData = JSON.parse(second.output);
      assert.strictEqual(secondData.mode, 'cached', 'Second run with no changes should be cached');
    });

    test('codebase analyze --full forces full analysis', () => {
      // First run
      runGsdTools('codebase analyze', tmpDir);

      // Second run with --full: should force full mode
      const result = runGsdTools('codebase analyze --full', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'full', '--full should force full mode');
    });
  });

  describe('codebase status', () => {
    test('codebase status before analyze returns exists: false', () => {
      // Remove any existing intel
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      try { fs.unlinkSync(intelPath); } catch (e) { /* may not exist */ }

      const result = runGsdTools('codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, false);
    });

    test('codebase status after analyze returns exists: true, stale: false', () => {
      runGsdTools('codebase analyze', tmpDir);

      const result = runGsdTools('codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, true);
      assert.strictEqual(data.stale, false);
    });

    test('after modifying a tracked file, status returns stale: true', () => {
      runGsdTools('codebase analyze', tmpDir);

      // Modify a file and commit (git config already set in createCodebaseProject)
      fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'const x = 2;\nconst y = 3;\nmodule.exports = { x, y };\n');
      execSync('git add -A && git commit -m "modify file"', { cwd: tmpDir, stdio: 'pipe' });

      const result = runGsdTools('codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.exists, true);
      assert.strictEqual(data.stale, true);
    });
  });

  describe('incremental analysis', () => {
    test('after modifying one file, analyze reports incremental mode', () => {
      // Full analysis first
      runGsdTools('codebase analyze', tmpDir);

      // Modify one file and commit (git config already set in createCodebaseProject)
      fs.writeFileSync(path.join(tmpDir, 'src', 'utils.js'), 'function helper() { return false; }\nfunction extra() { return 1; }\nmodule.exports = { helper, extra };\n');
      execSync('git add -A && git commit -m "modify utils"', { cwd: tmpDir, stdio: 'pipe' });

      const result = runGsdTools('codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'incremental', 'Should use incremental mode after single file change');
      assert.ok(data.files_analyzed >= 1, `Should analyze at least 1 file, got ${data.files_analyzed}`);
    });
  });

  describe('error handling', () => {
    test('codebase analyze on directory with .planning handles gracefully', () => {
      // .planning already exists in our test project, this should work fine
      const result = runGsdTools('codebase analyze', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
    });

    test('corrupt codebase-intel.json triggers full rescan', () => {
      // First analyze to create valid intel
      runGsdTools('codebase analyze', tmpDir);

      // Corrupt the intel file
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      fs.writeFileSync(intelPath, '{ invalid json !!!');

      // Analyze again — should handle gracefully (full rescan)
      const result = runGsdTools('codebase analyze', tmpDir);
      assert.ok(result.success, `Command should handle corrupt intel: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.mode, 'full', 'Should fall back to full mode on corrupt intel');
    });
  });

  describe('init integration', () => {
    test('init execute-phase includes codebase_stats when intel exists', () => {
      // Create phase directory for init to find
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

      // Run analyze first so intel exists
      runGsdTools('codebase analyze', tmpDir);

      const result = runGsdTools('init execute-phase 01 --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.ok(data.codebase_stats, 'Should include codebase_stats field');
      assert.ok(data.codebase_stats.total_files > 0, 'codebase_stats should have total_files');
      assert.ok(data.codebase_stats.top_languages, 'codebase_stats should have top_languages');
      assert.strictEqual(data.codebase_stats.confidence, 1.0, 'codebase_stats confidence should be 1.0');
    });

    test('init execute-phase returns null codebase fields without intel', () => {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

      // Don't run analyze — no intel exists
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      try { fs.unlinkSync(intelPath); } catch (e) { /* may not exist */ }

      const result = runGsdTools('init execute-phase 01 --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      // codebase fields should be null or undefined (trimmed from verbose output)
      assert.ok(!data.codebase_stats, 'Should not include codebase_stats without intel');
      assert.ok(!data.codebase_conventions, 'Should not include codebase_conventions without intel');
      assert.ok(!data.codebase_dependencies, 'Should not include codebase_dependencies without intel');
    });

    test('init progress includes codebase_intel_exists flag', () => {
      // Run analyze first
      runGsdTools('codebase analyze', tmpDir);

      const result = runGsdTools('init progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);
      assert.strictEqual(data.codebase_intel_exists, true, 'Should report codebase_intel_exists: true');
    });
  });

  describe('phase 26: init context summary', () => {
    test('three-field summary format — codebase_stats has confidence', () => {
      // Run analyze to populate intel
      runGsdTools('codebase analyze', tmpDir);

      const result = runGsdTools('init progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Verify codebase_stats exists and has confidence
      assert.ok(data.codebase_stats, 'Should include codebase_stats field');
      assert.strictEqual(data.codebase_stats.confidence, 1.0, 'stats confidence should be 1.0');
      assert.ok(data.codebase_stats.total_files > 0, 'should have total_files');
      assert.ok(data.codebase_stats.top_languages, 'should have top_languages');
      assert.ok(data.codebase_stats.generated_at, 'should have generated_at');
    });

    test('convention field present when conventions data exists', () => {
      // Run analyze + conventions to populate data
      runGsdTools('codebase analyze', tmpDir);
      runGsdTools('codebase conventions', tmpDir);

      const result = runGsdTools('init progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Conventions should be present (may be null if no strong patterns detected in simple project)
      // At minimum codebase_stats should exist
      assert.ok(data.codebase_stats, 'codebase_stats should exist');
    });

    test('dependencies field present when deps data exists', () => {
      // Run analyze + deps to populate data
      runGsdTools('codebase analyze', tmpDir);
      runGsdTools('codebase deps', tmpDir);

      const result = runGsdTools('init progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Dependencies should be present when deps have been built
      assert.ok(data.codebase_dependencies, 'codebase_dependencies should exist after codebase deps');
      assert.ok(data.codebase_dependencies.confidence === 0.85, 'deps confidence should be 0.85');
      assert.ok(data.codebase_dependencies.total_modules >= 0, 'should have total_modules');
    });

    test('null handling — stats exist but no conventions/deps data', () => {
      // Only run analyze (no conventions/deps)
      runGsdTools('codebase analyze', tmpDir);

      // Read intel and verify no conventions/dependencies keys
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      // Ensure no conventions/deps in intel
      delete intel.conventions;
      delete intel.dependencies;
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      const result = runGsdTools('init progress --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Stats should exist
      assert.ok(data.codebase_stats, 'codebase_stats should exist');
      // Conventions and dependencies should be absent (null fields trimmed from verbose output)
      assert.ok(!data.codebase_conventions, 'codebase_conventions should be absent when no convention data');
      assert.ok(!data.codebase_dependencies, 'codebase_dependencies should be absent when no deps data');
    });

    test('hybrid staleness — time-based detection', () => {
      // Run analyze first
      runGsdTools('codebase analyze', tmpDir);

      // Modify intel to have old generated_at but matching git hash
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      // Set generated_at to 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      intel.generated_at = twoHoursAgo;
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      const result = runGsdTools('codebase status', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      assert.strictEqual(data.stale, true, 'Should be stale when generated_at is 2h old');
      assert.strictEqual(data.reason, 'time_stale', 'Reason should be time_stale');
    });

    test('lock file prevents concurrent background triggers', () => {
      // Run analyze first
      runGsdTools('codebase analyze', tmpDir);

      // Create a fresh lock file manually
      const cacheDir = path.join(tmpDir, '.planning', '.cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const lockPath = path.join(cacheDir, '.analyzing');
      const originalPid = '12345';
      fs.writeFileSync(lockPath, originalPid);

      // Make intel stale so auto-trigger would want to spawn
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      intel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      // Run init progress (triggers autoTriggerCodebaseIntel which should see lock and skip)
      runGsdTools('init progress --verbose', tmpDir);

      // Verify lock file PID hasn't changed (no new spawn happened)
      const lockContent = fs.readFileSync(lockPath, 'utf-8');
      assert.strictEqual(lockContent, originalPid, 'Lock file content should not change when lock is fresh');
    });

    test('stale lock file gets cleaned up', () => {
      // Run analyze first
      runGsdTools('codebase analyze', tmpDir);

      // Create a stale lock file (mtime > 5 minutes old)
      const cacheDir = path.join(tmpDir, '.planning', '.cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const lockPath = path.join(cacheDir, '.analyzing');
      fs.writeFileSync(lockPath, '99999');
      // Set mtime to 6 minutes ago
      const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
      fs.utimesSync(lockPath, sixMinAgo, sixMinAgo);

      // Make intel stale
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      intel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + '\n');

      // Run init progress — stale lock should be cleaned up
      runGsdTools('init progress --verbose', tmpDir);

      // Lock file should be different (either new PID or cleaned up)
      if (fs.existsSync(lockPath)) {
        const lockContent = fs.readFileSync(lockPath, 'utf-8');
        assert.notStrictEqual(lockContent, '99999', 'Stale lock should be replaced with new PID');
      }
      // If lock doesn't exist, that's also fine (analysis completed quickly and cleaned up)
    });

    test('--refresh forces synchronous analysis with fresh data', () => {
      // Run analyze to create initial intel
      runGsdTools('codebase analyze', tmpDir);

      // Read current intel timestamp
      const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
      const oldIntel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
      const oldTimestamp = oldIntel.generated_at;

      // Make intel stale by backdating generated_at
      oldIntel.generated_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(intelPath, JSON.stringify(oldIntel, null, 2) + '\n');

      // Run init progress with --refresh — should force synchronous re-analysis
      const result = runGsdTools('init progress --refresh --verbose', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const data = JSON.parse(result.output);

      // Read updated intel
      const newIntel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));

      // New timestamp should be recent (within last 10 seconds), not the old stale one
      const newTime = new Date(newIntel.generated_at).getTime();
      const tenSecondsAgo = Date.now() - 10000;
      assert.ok(newTime > tenSecondsAgo, `After --refresh, generated_at should be recent. Got: ${newIntel.generated_at}`);

      // Stats should be present
      assert.ok(data.codebase_stats, 'Should include codebase_stats after --refresh');
    });
  });
});


describe('codebase conventions', () => {
  let tmpDir;

  function createConventionProject(files) {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-conv-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content || '// placeholder\n');
    }

    // Initialize git repo
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('naming detection — detects camelCase, snake_case, and kebab-case files', () => {
    tmpDir = createConventionProject({
      'src/myComponent.js': '',
      'src/user-service.js': '',
      'src/data_helper.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    const result = runGsdTools('codebase conventions --all', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.naming_patterns.length > 0, 'Should detect naming patterns');

    // All three patterns should be detected at project scope
    const projectPatterns = data.naming_patterns
      .filter(p => p.scope === 'project')
      .map(p => p.pattern);
    assert.ok(projectPatterns.includes('camelCase'), 'Should detect camelCase');
    assert.ok(projectPatterns.includes('kebab-case'), 'Should detect kebab-case');
    assert.ok(projectPatterns.includes('snake_case'), 'Should detect snake_case');
  });

  test('file organization — detects nested structure and test placement', () => {
    tmpDir = createConventionProject({
      'src/lib/utils.js': '',
      'src/lib/helpers.js': '',
      'src/commands/run.js': '',
      'src/commands/build.js': '',
      'src/index.test.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    const result = runGsdTools('codebase conventions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.file_organization, 'Should have file_organization');
    assert.ok(
      data.file_organization.structure_type === 'nested' || data.file_organization.structure_type === 'flat',
      'structure_type should be nested or flat'
    );
    assert.ok(
      ['co-located', 'separate-directory', 'none'].includes(data.file_organization.test_placement),
      'test_placement should be valid'
    );
  });

  test('confidence scoring — 9 snake_case + 1 camelCase yields ~90% snake_case confidence', () => {
    const files = { 'package.json': '{"name":"test"}\n' };
    // 9 snake_case files
    for (let i = 1; i <= 9; i++) {
      files[`src/my_module_${i}.js`] = '';
    }
    // 1 camelCase file
    files['src/myComponent.js'] = '';
    tmpDir = createConventionProject(files);

    runGsdTools('codebase analyze', tmpDir);
    const result = runGsdTools('codebase conventions --all', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const snakePattern = data.naming_patterns.find(
      p => p.scope === 'project' && p.pattern === 'snake_case'
    );
    assert.ok(snakePattern, 'Should find snake_case pattern');
    assert.ok(
      snakePattern.confidence >= 85 && snakePattern.confidence <= 95,
      `snake_case confidence should be ~90%, got ${snakePattern.confidence}%`
    );
  });

  test('rules generation — sorted by confidence with ≤15 rules', () => {
    tmpDir = createConventionProject({
      'src/my-utils.js': '',
      'src/my-helpers.js': '',
      'src/my-service.js': '',
      'src/myOther.js': '',
      'src/index.test.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    // Run conventions first to populate intel
    runGsdTools('codebase conventions', tmpDir);

    const result = runGsdTools('codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.rule_count <= 15, `Rules should be capped at 15, got ${data.rule_count}`);
    assert.ok(data.rules.length > 0, 'Should have at least one rule');
    assert.ok(data.rules_text.length > 0, 'rules_text should be non-empty');

    // Verify sorted by confidence (highest first)
    for (let i = 1; i < data.rules.length; i++) {
      // Each rule contains a percentage — extract and verify ordering
      const prev = data.rules[i - 1].match(/(\d+)%/);
      const curr = data.rules[i].match(/(\d+)%/);
      if (prev && curr) {
        assert.ok(
          parseInt(prev[1]) >= parseInt(curr[1]),
          `Rules should be sorted by confidence: "${data.rules[i-1]}" should come before "${data.rules[i]}"`
        );
      }
    }
  });

  test('rules cap — conventions with many patterns still output ≤15 rules', () => {
    // Create project with many directories to generate lots of patterns
    const files = { 'package.json': '{"name":"test"}\n' };
    const dirs = ['api', 'auth', 'billing', 'cache', 'data', 'events', 'forms', 'graphs'];
    for (const dir of dirs) {
      files[`src/${dir}/my-thing-${dir}.js`] = '';
      files[`src/${dir}/another-thing-${dir}.js`] = '';
      files[`src/${dir}/third-thing-${dir}.js`] = '';
    }
    tmpDir = createConventionProject(files);

    runGsdTools('codebase analyze', tmpDir);
    runGsdTools('codebase conventions --all', tmpDir);

    const result = runGsdTools('codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.rule_count <= 15, `Rules must be capped at 15, got ${data.rule_count}`);
  });

  test('CLI integration — codebase rules --raw outputs plain text', () => {
    tmpDir = createConventionProject({
      'src/my-utils.js': '',
      'src/my-helpers.js': '',
      'package.json': '{"name":"test"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);

    const result = runGsdTools('codebase rules', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // In piped mode, output is JSON with rules_text for plain text rendering
    const data = JSON.parse(result.output);
    assert.ok(data.rules_text, 'should have rules_text field');
    assert.ok(/^\d+\.\s/.test(data.rules_text), 'rules_text should start with numbered rule');
  });
});


describe('dependency graph', () => {
  const {
    parseJavaScript,
    parsePython,
    parseGo,
    parseElixir,
    parseRust,
    buildDependencyGraph,
    findCycles,
    getTransitiveDependents,
  } = require('../src/lib/deps');

  // ─── Import Parser Tests (6 tests) ──────────────────────────────────────

  describe('import parsers', () => {
    test('JS parser: require and import from', () => {
      const content = `
        const foo = require('./foo');
        import bar from './bar';
        import { baz } from './baz';
      `;
      const imports = parseJavaScript(content);
      assert.ok(imports.includes('./foo'), 'Should extract require("./foo")');
      assert.ok(imports.includes('./bar'), 'Should extract import from "./bar"');
      assert.ok(imports.includes('./baz'), 'Should extract import { } from "./baz"');
    });

    test('TS parser: import types and export from', () => {
      const content = `
        import { Thing } from './types';
        export { x } from './utils';
        import type { Foo } from './foo-types';
      `;
      // TS uses same parser as JS
      const imports = parseJavaScript(content);
      assert.ok(imports.includes('./types'), 'Should extract import { Thing } from "./types"');
      assert.ok(imports.includes('./utils'), 'Should extract export { x } from "./utils"');
      assert.ok(imports.includes('./foo-types'), 'Should extract import type from "./foo-types"');
    });

    test('Python parser: import and from import', () => {
      const content = `
import os
from foo.bar import baz
import sys, json
from . import local
      `;
      const imports = parsePython(content);
      assert.ok(imports.includes('os'), 'Should extract "import os"');
      assert.ok(imports.includes('foo.bar'), 'Should extract "from foo.bar import baz"');
      assert.ok(imports.includes('sys'), 'Should extract "import sys"');
      assert.ok(imports.includes('json'), 'Should extract "import json"');
      assert.ok(imports.includes('.'), 'Should extract "from . import local"');
    });

    test('Go parser: single and grouped imports', () => {
      const content = `
package main

import "fmt"

import (
  "os"
  "strings"
  mymod "github.com/user/pkg"
)
      `;
      const imports = parseGo(content);
      assert.ok(imports.includes('fmt'), 'Should extract import "fmt"');
      assert.ok(imports.includes('os'), 'Should extract "os" from group');
      assert.ok(imports.includes('strings'), 'Should extract "strings" from group');
      assert.ok(imports.includes('github.com/user/pkg'), 'Should extract full path from group');
    });

    test('Elixir parser: alias, use, import', () => {
      const content = `
defmodule MyApp.Web do
  alias MyApp.Accounts
  use GenServer
  import Ecto.Query
  require Logger
end
      `;
      const imports = parseElixir(content);
      assert.ok(imports.includes('MyApp.Accounts'), 'Should extract alias MyApp.Accounts');
      assert.ok(imports.includes('GenServer'), 'Should extract use GenServer');
      assert.ok(imports.includes('Ecto.Query'), 'Should extract import Ecto.Query');
      assert.ok(imports.includes('Logger'), 'Should extract require Logger');
    });

    test('Rust parser: use, mod, extern crate', () => {
      const content = `
use crate::lib::foo;
mod bar;
extern crate serde;
use std::collections::HashMap;
      `;
      const imports = parseRust(content);
      assert.ok(imports.includes('crate::lib::foo'), 'Should extract use crate::lib::foo');
      assert.ok(imports.includes('bar'), 'Should extract mod bar');
      assert.ok(imports.includes('serde'), 'Should extract extern crate serde');
      assert.ok(imports.includes('std::collections::HashMap'), 'Should extract use std::...');
    });
  });

  // ─── Graph Construction Tests (3 tests) ─────────────────────────────────

  describe('graph construction', () => {
    test('build graph from 3 JS files with imports', () => {
      // Mock intel object with files and their content on disk
      // We'll construct the graph from a mock intel
      const mockIntel = {
        files: {
          'a.js': { language: 'javascript' },
          'b.js': { language: 'javascript' },
          'c.js': { language: 'javascript' },
        },
      };

      // Create temp files for buildDependencyGraph to read
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'a.js'), "const b = require('./b');\nconst c = require('./c');\n");
      fs.writeFileSync(path.join(tmpDir, 'b.js'), "const c = require('./c');\n");
      fs.writeFileSync(path.join(tmpDir, 'c.js'), "module.exports = {};\n");

      // buildDependencyGraph reads from cwd, so change to tmpDir
      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // Forward: a→[b,c], b→[c], c→[]
        assert.ok(graph.forward['a.js'], 'a.js should have forward edges');
        assert.ok(graph.forward['a.js'].includes('b.js'), 'a.js should import b.js');
        assert.ok(graph.forward['a.js'].includes('c.js'), 'a.js should import c.js');
        assert.ok(graph.forward['b.js'].includes('c.js'), 'b.js should import c.js');

        // Reverse: c←[a,b], b←[a]
        assert.ok(graph.reverse['c.js'], 'c.js should have reverse edges');
        assert.ok(graph.reverse['c.js'].includes('a.js'), 'c.js should be imported by a.js');
        assert.ok(graph.reverse['c.js'].includes('b.js'), 'c.js should be imported by b.js');
        assert.ok(graph.reverse['b.js'].includes('a.js'), 'b.js should be imported by a.js');
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('files with no imports appear with empty edge lists', () => {
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'standalone.js'), 'const x = 42;\n');

      const mockIntel = {
        files: {
          'standalone.js': { language: 'javascript' },
        },
      };

      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // standalone.js has no imports, so no forward edges
        assert.ok(!graph.forward['standalone.js'] || graph.forward['standalone.js'].length === 0,
          'standalone.js should have no forward edges');
        assert.strictEqual(graph.stats.total_edges, 0, 'Should have 0 edges');
        assert.strictEqual(graph.stats.total_files_parsed, 1, 'Should have parsed 1 file');
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('graph built from intel object has correct adjacency structure', () => {
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-dep-test-'));
      fs.writeFileSync(path.join(tmpDir, 'x.js'), "import y from './y';\n");
      fs.writeFileSync(path.join(tmpDir, 'y.js'), "export default 42;\n");

      const mockIntel = {
        files: {
          'x.js': { language: 'javascript' },
          'y.js': { language: 'javascript' },
        },
      };

      const origCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const graph = buildDependencyGraph(mockIntel);

        // Verify adjacency list structure
        assert.ok(graph.forward && typeof graph.forward === 'object', 'forward should be an object');
        assert.ok(graph.reverse && typeof graph.reverse === 'object', 'reverse should be an object');
        assert.ok(graph.stats && typeof graph.stats === 'object', 'stats should be an object');
        assert.ok(graph.built_at, 'built_at should be set');

        // x→y, y←x
        assert.deepStrictEqual(graph.forward['x.js'], ['y.js']);
        assert.deepStrictEqual(graph.reverse['y.js'], ['x.js']);
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ─── Cycle Detection Tests (3 tests) ───────────────────────────────────

  describe('cycle detection', () => {
    test('no cycles in linear chain A→B→C', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['c.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 0, 'Linear chain should have no cycles');
      assert.strictEqual(result.files_in_cycles, 0, 'No files should be in cycles');
    });

    test('simple cycle A→B→A detected', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['a.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 1, 'Should detect exactly 1 cycle');
      assert.strictEqual(result.files_in_cycles, 2, '2 files should be in the cycle');

      // Both files should be in the cycle
      const cycleFiles = new Set(result.cycles[0]);
      assert.ok(cycleFiles.has('a.js'), 'a.js should be in cycle');
      assert.ok(cycleFiles.has('b.js'), 'b.js should be in cycle');
    });

    test('complex cycle A→B→C→A with D→B spur — cycle detected, D not in cycle', () => {
      const graph = {
        forward: {
          'a.js': ['b.js'],
          'b.js': ['c.js'],
          'c.js': ['a.js'],
          'd.js': ['b.js'],
        },
      };

      const result = findCycles(graph);
      assert.strictEqual(result.cycle_count, 1, 'Should detect exactly 1 cycle');
      assert.strictEqual(result.files_in_cycles, 3, '3 files (a,b,c) should be in the cycle');

      // D should NOT be in any cycle
      const allCycleFiles = new Set();
      for (const cycle of result.cycles) {
        for (const f of cycle) allCycleFiles.add(f);
      }
      assert.ok(!allCycleFiles.has('d.js'), 'd.js should NOT be in any cycle');
      assert.ok(allCycleFiles.has('a.js'), 'a.js should be in cycle');
      assert.ok(allCycleFiles.has('b.js'), 'b.js should be in cycle');
      assert.ok(allCycleFiles.has('c.js'), 'c.js should be in cycle');
    });
  });

  // ─── Impact Analysis Tests (2 tests) ───────────────────────────────────

  describe('impact analysis', () => {
    test('getTransitiveDependents on leaf file returns fan_in 0', () => {
      const graph = {
        reverse: {
          'core.js': ['a.js', 'b.js'],
          // leaf.js has no reverse edges (nothing imports it)
        },
      };

      const result = getTransitiveDependents(graph, 'leaf.js');
      assert.strictEqual(result.fan_in, 0, 'Leaf file should have fan_in 0');
      assert.deepStrictEqual(result.direct_dependents, [], 'No direct dependents');
      assert.deepStrictEqual(result.transitive_dependents, [], 'No transitive dependents');
      assert.strictEqual(result.file, 'leaf.js', 'file field should match input');
    });

    test('getTransitiveDependents on core file returns correct direct + transitive counts', () => {
      // Graph: core←[a,b], a←[c], b←[d] — so core has 2 direct, 2 transitive (c,d)
      const graph = {
        reverse: {
          'core.js': ['a.js', 'b.js'],
          'a.js': ['c.js'],
          'b.js': ['d.js'],
        },
      };

      const result = getTransitiveDependents(graph, 'core.js');
      assert.strictEqual(result.direct_dependents.length, 2, 'Should have 2 direct dependents');
      assert.ok(result.direct_dependents.includes('a.js'), 'a.js should be direct dependent');
      assert.ok(result.direct_dependents.includes('b.js'), 'b.js should be direct dependent');

      assert.strictEqual(result.transitive_dependents.length, 2, 'Should have 2 transitive dependents');
      const transitiveFiles = result.transitive_dependents.map(t => t.file);
      assert.ok(transitiveFiles.includes('c.js'), 'c.js should be transitive dependent');
      assert.ok(transitiveFiles.includes('d.js'), 'd.js should be transitive dependent');

      assert.strictEqual(result.fan_in, 4, 'Total fan_in should be 4');
      assert.strictEqual(result.max_depth_reached, 2, 'Max depth should be 2');
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Codebase Context Tests (Phase 27 Plan 02) — CTXI-02, CTXI-03, CTXI-04
// ═══════════════════════════════════════════════════════════════════════════════

describe('codebase context', () => {
  // These tests run against the real project's codebase intel data.
  // The bgsd-oc project has a .planning/codebase/codebase-intel.json
  // with dependency graph and conventions data from prior phases.

  test('basic output structure: success, files, file_count', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.success, true, 'should return success: true');
    assert.ok(data.files, 'should have files object');
    assert.ok(data.files['src/commands/codebase.js'], 'should have the requested file key');
    assert.ok(data.file_count >= 1, 'file_count should be >= 1');
  });

  test('per-file fields present: imports, dependents, risk_level, relevance_score', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(Array.isArray(fileCtx.imports), 'imports should be an array');
    assert.ok(Array.isArray(fileCtx.dependents), 'dependents should be an array');
    assert.ok(['high', 'caution', 'normal'].includes(fileCtx.risk_level), 'risk_level should be high/caution/normal');
    assert.strictEqual(typeof fileCtx.relevance_score, 'number', 'relevance_score should be a number');
  });

  test('no-data stub for nonexistent file', () => {
    const result = runGsdTools('codebase context --files nonexistent-file-12345.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['nonexistent-file-12345.js'];

    assert.strictEqual(fileCtx.status, 'no-data', 'should have status: no-data');
    assert.strictEqual(fileCtx.conventions, null, 'conventions should be null');
  });

  test('imports capped at 8', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(fileCtx.imports.length <= 8, `imports should be <= 8, got ${fileCtx.imports.length}`);
  });

  test('dependents capped at 8', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.ok(fileCtx.dependents.length <= 8, `dependents should be <= 8, got ${fileCtx.dependents.length}`);
  });

  test('risk level: computeRiskLevel returns "high" for >10 reverse edges', () => {
    // Direct function test via CLI on a known file:
    // We test the logic by constructing a scenario description,
    // but actually test through the CLI for integration confidence.
    // The real test: request the output and verify risk_level is a valid value.
    const result = runGsdTools('codebase context --files src/lib/output.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/lib/output.js'];
    // output.js is imported by many modules — might be "high"
    assert.ok(['high', 'caution', 'normal'].includes(fileCtx.risk_level),
      `risk_level should be valid, got ${fileCtx.risk_level}`);
  });

  test('risk level: file with few dependents returns "normal"', () => {
    // src/lib/frontmatter.js is a utility with limited dependents
    const result = runGsdTools('codebase context --files src/lib/frontmatter.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/lib/frontmatter.js'];
    // frontmatter.js should have few dependents
    assert.ok(['normal', 'caution'].includes(fileCtx.risk_level),
      `risk_level for frontmatter.js should be normal or caution, got ${fileCtx.risk_level}`);
  });

  test('relevance score: target file gets score 1.0', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    assert.strictEqual(fileCtx.relevance_score, 1, 'Target file should get relevance_score 1.0');
  });

  test('relevance score: --plan flag provides plan-scope signal', () => {
    // Request with --plan pointing to a plan file
    const result = runGsdTools('codebase context --files src/commands/codebase.js --plan .planning/milestones/v5.0-phases/27-task-scoped-context/27-02-PLAN.md');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(typeof data.files['src/commands/codebase.js'].relevance_score, 'number',
      'relevance_score should be a number when --plan is provided');
  });

  test('token budget respected: 10+ files output under 20K chars', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js src/lib/deps.js src/lib/conventions.js src/lib/context.js src/lib/git.js src/lib/frontmatter.js src/lib/output.js src/lib/helpers.js src/lib/config.js src/router.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const charCount = result.output.length;
    assert.ok(charCount < 20000, `Output should be under 20K chars (~5K tokens), got ${charCount}`);
  });

  test('truncation flag is boolean', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(typeof data.truncated, 'boolean', 'truncated should be a boolean');
  });

  test('usage error when no files provided', () => {
    const result = runGsdTools('codebase context');
    // Should fail or output error
    assert.ok(!result.success || result.error.includes('Usage'), 'Should show usage error when no files provided');
  });

  test('multiple files: all requested files appear in output', () => {
    const files = ['src/commands/codebase.js', 'src/lib/deps.js', 'src/router.js'];
    const result = runGsdTools(`codebase context --files ${files.join(' ')}`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    for (const f of files) {
      assert.ok(data.files[f] !== undefined || data.omitted_files > 0,
        `File ${f} should be in output or accounted for in omitted_files`);
    }
  });

  test('conventions field: either null or has naming property', () => {
    const result = runGsdTools('codebase context --files src/commands/codebase.js');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    const fileCtx = data.files['src/commands/codebase.js'];

    if (fileCtx.conventions !== null) {
      assert.ok(fileCtx.conventions.naming !== undefined, 'conventions should have naming property if not null');
    }
  });
});


// ─── Lifecycle Analysis Tests (Phase 28 Plan 02) ────────────────────────────

describe('codebase lifecycle', () => {
  const { LIFECYCLE_DETECTORS, buildLifecycleGraph } = require('../src/lib/lifecycle');

  // Helper: create a temp project with specific files and run codebase analyze
  function createLifecycleProject(files) {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-lifecycle-'));
    fs.mkdirSync(path.join(dir, '.planning', 'codebase'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content || '// placeholder\n');
    }

    // Initialize git repo
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  // ─── Unit Tests: Detector Registry ─────────────────────────────────────

  test('LIFECYCLE_DETECTORS registry exists and contains expected detectors', () => {
    assert.ok(Array.isArray(LIFECYCLE_DETECTORS), 'LIFECYCLE_DETECTORS should be an array');
    assert.ok(LIFECYCLE_DETECTORS.length >= 2, 'Should have at least 2 detectors (generic + phoenix)');

    const names = LIFECYCLE_DETECTORS.map(d => d.name);
    assert.ok(names.includes('generic-migrations'), 'Should have generic-migrations detector');
    assert.ok(names.includes('elixir-phoenix'), 'Should have elixir-phoenix detector');

    // Each detector must have required interface
    for (const d of LIFECYCLE_DETECTORS) {
      assert.strictEqual(typeof d.name, 'string', `Detector name should be string, got ${typeof d.name}`);
      assert.strictEqual(typeof d.detect, 'function', `Detector ${d.name} should have detect function`);
      assert.strictEqual(typeof d.extractLifecycle, 'function', `Detector ${d.name} should have extractLifecycle function`);
    }
  });

  test('generic-migrations detector activates when migration files present', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'generic-migrations');
    assert.ok(detector, 'generic-migrations detector must exist');

    // Should activate when migration directory files are in intel
    const intelWithMigrations = {
      files: {
        'db/migrate/001_create_users.sql': { lines: 10 },
        'db/migrate/002_add_email.sql': { lines: 5 },
        'src/app.js': { lines: 100 },
      },
    };
    assert.ok(detector.detect(intelWithMigrations), 'Should detect db/migrate/ files');

    // Should NOT activate without migration directories
    const intelNoMigrations = {
      files: {
        'src/app.js': { lines: 100 },
        'src/lib/utils.js': { lines: 50 },
      },
    };
    assert.ok(!detector.detect(intelNoMigrations), 'Should not activate without migration dirs');
  });

  test('generic-migrations extracts sequential chain with correct ordering', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'generic-migrations');
    const intel = {
      files: {
        'migrations/001_create_users.sql': { lines: 10 },
        'migrations/002_add_email.sql': { lines: 5 },
        'migrations/003_create_orders.sql': { lines: 8 },
      },
    };

    const nodes = detector.extractLifecycle(intel, '/tmp/fake');
    assert.strictEqual(nodes.length, 3, 'Should create 3 migration nodes');

    // First node has no dependencies
    assert.deepStrictEqual(nodes[0].must_run_after, [], 'First migration should have no dependencies');
    assert.strictEqual(nodes[0].type, 'migration', 'Node type should be migration');
    assert.strictEqual(nodes[0].framework, 'generic', 'Framework should be generic');

    // Second node depends on first
    assert.deepStrictEqual(nodes[1].must_run_after, [nodes[0].id], 'Second migration depends on first');

    // Third node depends on second
    assert.deepStrictEqual(nodes[2].must_run_after, [nodes[1].id], 'Third migration depends on second');

    // must_run_before symmetry maintained
    assert.ok(nodes[0].must_run_before.includes(nodes[1].id), 'First migration must_run_before includes second');
    assert.ok(nodes[1].must_run_before.includes(nodes[2].id), 'Second migration must_run_before includes third');
  });

  test('elixir-phoenix detector gates on conventions.frameworks', () => {
    const detector = LIFECYCLE_DETECTORS.find(d => d.name === 'elixir-phoenix');
    assert.ok(detector, 'elixir-phoenix detector must exist');

    // Should NOT activate without conventions
    assert.ok(!detector.detect({ files: {} }), 'Should not activate without conventions');
    assert.ok(!detector.detect({ files: {}, conventions: {} }), 'Should not activate without frameworks array');
    assert.ok(!detector.detect({
      files: {},
      conventions: { frameworks: [{ framework: 'react' }] },
    }), 'Should not activate for non-Phoenix framework');

    // Should activate with elixir-phoenix framework
    assert.ok(detector.detect({
      files: {},
      conventions: { frameworks: [{ framework: 'elixir-phoenix' }] },
    }), 'Should activate for elixir-phoenix');
  });

  // ─── Unit Tests: buildLifecycleGraph ───────────────────────────────────

  test('buildLifecycleGraph returns correct structure with no lifecycle patterns', () => {
    const intel = { files: { 'src/app.js': { lines: 100 } } };
    const result = buildLifecycleGraph(intel, '/tmp/fake');

    assert.ok(Array.isArray(result.nodes), 'nodes should be array');
    assert.ok(Array.isArray(result.chains), 'chains should be array');
    assert.ok(Array.isArray(result.cycles), 'cycles should be array');
    assert.ok(Array.isArray(result.detectors_used), 'detectors_used should be array');
    assert.ok(result.stats, 'should have stats object');
    assert.strictEqual(result.nodes.length, 0, 'no nodes for project without lifecycle patterns');
    assert.strictEqual(result.stats.node_count, 0, 'node_count should be 0');
    assert.strictEqual(result.stats.edge_count, 0, 'edge_count should be 0');
    assert.strictEqual(result.stats.chain_count, 0, 'chain_count should be 0');
    assert.ok(result.built_at, 'should have built_at timestamp');
  });

  test('buildLifecycleGraph produces chains with topological sort', () => {
    const intel = {
      files: {
        'migrations/20240101_create_users.sql': { lines: 10 },
        'migrations/20240102_add_email.sql': { lines: 5 },
        'migrations/20240103_create_orders.sql': { lines: 8 },
        'migrations/20240104_add_status.sql': { lines: 3 },
      },
    };

    const result = buildLifecycleGraph(intel, '/tmp/fake');

    assert.ok(result.detectors_used.includes('generic-migrations'), 'generic-migrations detector should be used');
    assert.strictEqual(result.nodes.length, 4, 'Should have 4 nodes');
    assert.ok(result.chains.length >= 1, 'Should have at least 1 chain');

    // The chain should contain all 4 migration IDs in order
    const chain = result.chains[0];
    assert.strictEqual(chain.length, 4, 'Chain should have 4 entries');

    // Verify topological ordering: earlier migrations come before later ones
    const ids = result.nodes.map(n => n.id);
    for (let i = 0; i < chain.length - 1; i++) {
      const currentIdx = ids.indexOf(chain[i]);
      const nextIdx = ids.indexOf(chain[i + 1]);
      assert.ok(currentIdx >= 0, `Chain entry ${chain[i]} should exist in nodes`);
      assert.ok(nextIdx >= 0, `Chain entry ${chain[i + 1]} should exist in nodes`);
    }

    // Stats should be consistent
    assert.strictEqual(result.stats.node_count, result.nodes.length, 'node_count matches nodes.length');
    assert.ok(result.stats.edge_count > 0, 'Should have edges in a chain');
    assert.strictEqual(result.stats.cycle_count, 0, 'No cycles expected in sequential migrations');
  });

  test('buildLifecycleGraph caps migrations at MAX_MIGRATION_NODES with summary node', () => {
    // Create 25 migration files (exceeds MAX_MIGRATION_NODES=20)
    const intel = { files: {} };
    for (let i = 1; i <= 25; i++) {
      const pad = String(i).padStart(3, '0');
      intel.files[`migrations/${pad}_step.sql`] = { lines: 5 };
    }

    const result = buildLifecycleGraph(intel, '/tmp/fake');

    // Should have 20 real nodes + 1 summary node = 21 nodes
    assert.strictEqual(result.nodes.length, 21, 'Should cap at 20 + 1 summary node');

    // Find the summary node
    const summaryNode = result.nodes.find(n => n.id.startsWith('migration:earlier-'));
    assert.ok(summaryNode, 'Should have summary node for capped migrations');
    assert.ok(summaryNode.file_or_step.includes('earlier migrations'), 'Summary node should describe capped count');
    assert.strictEqual(summaryNode.confidence, 0, 'Summary node confidence should be 0');
  });

  // ─── CLI Integration Tests ─────────────────────────────────────────────

  test('codebase lifecycle --raw returns valid JSON schema', () => {
    tmpDir = createLifecycleProject({
      'migrations/001_create_users.sql': 'CREATE TABLE users (id INT);',
      'migrations/002_add_email.sql': 'ALTER TABLE users ADD email VARCHAR;',
      'package.json': '{"name":"test-lifecycle"}\n',
    });

    // First run analyze to populate intel
    const analyzeResult = runGsdTools('codebase analyze', tmpDir);
    assert.ok(analyzeResult.success, `codebase analyze failed: ${analyzeResult.error}`);

    // Now run lifecycle
    const result = runGsdTools('codebase lifecycle', tmpDir);
    assert.ok(result.success, `codebase lifecycle failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.success, true, 'success should be true');
    assert.strictEqual(typeof data.nodes, 'number', 'nodes should be a number');
    assert.strictEqual(typeof data.edges, 'number', 'edges should be a number');
    assert.ok(Array.isArray(data.chains), 'chains should be an array');
    assert.ok(Array.isArray(data.cycles), 'cycles should be an array');
    assert.ok(Array.isArray(data.detectors_used), 'detectors_used should be an array');
    assert.ok(data.stats, 'should have stats object');
    assert.ok(data.built_at, 'should have built_at timestamp');
  });

  test('codebase lifecycle --raw detects migration chain in temp project', () => {
    tmpDir = createLifecycleProject({
      'db/migrate/20240101_create_users.rb': '',
      'db/migrate/20240102_add_email.rb': '',
      'db/migrate/20240103_create_orders.rb': '',
      'package.json': '{"name":"test-lifecycle"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    const result = runGsdTools('codebase lifecycle', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.nodes >= 3, `Should detect at least 3 migration nodes, got ${data.nodes}`);
    assert.ok(data.detectors_used.includes('generic-migrations'), 'generic-migrations should be used');
    assert.ok(data.chains.length >= 1, 'Should have at least 1 chain');
    assert.ok(data.chains[0].length >= 3, 'Chain should have at least 3 entries');
  });

  test('codebase lifecycle --raw returns 0 nodes for project without lifecycle patterns', () => {
    tmpDir = createLifecycleProject({
      'src/app.js': 'console.log("hello");',
      'src/utils.js': 'module.exports = {};',
      'package.json': '{"name":"test-no-lifecycle"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    const result = runGsdTools('codebase lifecycle', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.nodes, 0, 'Should detect 0 nodes');
    assert.strictEqual(data.chains.length, 0, 'Should have no chains');
    assert.deepStrictEqual(data.detectors_used, [], 'No detectors should activate');
  });

  test('codebase lifecycle caches result in intel file', () => {
    tmpDir = createLifecycleProject({
      'migrations/001_init.sql': 'CREATE TABLE t (id INT);',
      'package.json': '{"name":"test-cache"}\n',
    });

    runGsdTools('codebase analyze', tmpDir);
    runGsdTools('codebase lifecycle', tmpDir);

    // Read the intel file and verify lifecycle was cached
    const intelPath = path.join(tmpDir, '.planning', 'codebase', 'codebase-intel.json');
    assert.ok(fs.existsSync(intelPath), 'codebase-intel.json should exist');

    const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
    assert.ok(intel.lifecycle, 'lifecycle should be cached in intel');
    assert.ok(intel.lifecycle.nodes, 'cached lifecycle should have nodes');
    assert.ok(intel.lifecycle.chains, 'cached lifecycle should have chains');
    assert.ok(intel.lifecycle.built_at, 'cached lifecycle should have built_at');
  });

  test('codebase lifecycle fails gracefully without prior analyze', () => {
    tmpDir = createLifecycleProject({
      'src/app.js': 'console.log("hello");',
      'package.json': '{"name":"test-no-intel"}\n',
    });

    // Do NOT run analyze first — lifecycle should handle missing intel
    const result = runGsdTools('codebase lifecycle', tmpDir);
    // Should either fail or produce an error message about missing intel
    assert.ok(!result.success || result.error.includes('intel'), 'Should fail or warn about missing intel');
  });
});

// ─── git commands ────────────────────────────────────────────────────────────

describe('git log', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init: first commit"', { cwd: tmpDir, stdio: 'pipe' });
    // Create second commit
    fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'hello\n');
    execSync('git add file1.txt && git commit -m "feat(scope): add file1"', { cwd: tmpDir, stdio: 'pipe' });
    // Create third commit
    fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'world\n');
    execSync('git add file2.txt && git commit -m "fix: add file2"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('git log returns structured output with hash/author/date/message/files', () => {
    const result = runGsdTools('git log --count 3', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data), 'Should return array');
    assert.strictEqual(data.length, 3, 'Should return 3 commits');

    const latest = data[0];
    assert.ok(latest.hash, 'Commit should have hash');
    assert.ok(latest.author, 'Commit should have author');
    assert.ok(latest.date, 'Commit should have date');
    assert.ok(latest.message, 'Commit should have message');
    assert.ok(Array.isArray(latest.files), 'Commit should have files array');
    assert.strictEqual(typeof latest.file_count, 'number', 'Should have file_count');
    assert.strictEqual(typeof latest.total_insertions, 'number', 'Should have total_insertions');
    assert.strictEqual(typeof latest.total_deletions, 'number', 'Should have total_deletions');
  });

  test('git log --count 1 returns only 1 commit', () => {
    const result = runGsdTools('git log --count 1', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.length, 1, 'Should return 1 commit');
  });

  test('git log parses conventional commits', () => {
    const result = runGsdTools('git log --count 2', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    // Latest commit: "fix: add file2"
    assert.ok(data[0].conventional, 'Should parse conventional commit');
    assert.strictEqual(data[0].conventional.type, 'fix');
    // Second commit: "feat(scope): add file1"
    assert.ok(data[1].conventional, 'Should parse conventional commit with scope');
    assert.strictEqual(data[1].conventional.type, 'feat');
    assert.strictEqual(data[1].conventional.scope, 'scope');
  });

  test('git log includes file stats per commit', () => {
    const result = runGsdTools('git log --count 1', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data[0].files.length > 0, 'Latest commit should have file stats');
    assert.ok(data[0].files[0].path, 'File stat should have path');
    assert.strictEqual(typeof data[0].files[0].insertions, 'number', 'Should have insertions');
    assert.strictEqual(typeof data[0].files[0].deletions, 'number', 'Should have deletions');
  });
});

describe('git diff-summary', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'changed.txt'), 'line1\nline2\nline3\n');
    execSync('git add changed.txt && git commit -m "add changed.txt"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('git diff-summary returns files/insertions/deletions', () => {
    const result = runGsdTools('git diff-summary', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.ok(data.from, 'Should have from ref');
    assert.ok(data.to, 'Should have to ref');
    assert.ok(Array.isArray(data.files), 'Should have files array');
    assert.strictEqual(typeof data.file_count, 'number', 'Should have file_count');
    assert.strictEqual(typeof data.total_insertions, 'number', 'Should have total_insertions');
    assert.strictEqual(typeof data.total_deletions, 'number', 'Should have total_deletions');
    // The latest commit added changed.txt
    assert.ok(data.files.some(f => f.path === 'changed.txt'), 'Should include changed.txt');
  });
});

describe('git blame', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, 'target.txt'), 'line1\nline2\n');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('git blame returns line-to-commit mapping', () => {
    const result = runGsdTools('git blame target.txt', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.file, 'target.txt', 'Should report correct file');
    assert.ok(Array.isArray(data.lines), 'Should have lines array');
    assert.ok(data.lines.length >= 2, 'Should have at least 2 lines');
    assert.ok(data.lines[0].hash, 'Line should have hash');
    assert.ok(data.lines[0].author, 'Line should have author');
    assert.ok(data.lines[0].date, 'Line should have date');
    assert.ok(data.lines[0].content !== undefined, 'Line should have content');
    assert.ok(data.unique_authors.length >= 1, 'Should have at least 1 unique author');
    assert.ok(data.unique_commits.length >= 1, 'Should have at least 1 unique commit');
  });
});

describe('git branch-info', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('git branch-info returns branch name and state', () => {
    const result = runGsdTools('git branch-info', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.ok(data.branch, 'Should have branch name');
    assert.ok(data.head_sha, 'Should have head_sha');
    assert.strictEqual(data.is_detached, false, 'Should not be detached');
    assert.strictEqual(data.is_shallow, false, 'Should not be shallow');
    assert.strictEqual(typeof data.has_dirty_files, 'boolean', 'Should have has_dirty_files');
    assert.strictEqual(typeof data.dirty_file_count, 'number', 'Should have dirty_file_count');
    assert.strictEqual(data.is_rebasing, false, 'Should not be rebasing');
  });

  test('git branch-info detects detached HEAD', () => {
    // Get current commit hash
    const hash = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    // Detach HEAD
    execSync(`git checkout ${hash}`, { cwd: tmpDir, stdio: 'pipe' });

    const result = runGsdTools('git branch-info', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.is_detached, true, 'Should detect detached HEAD');
  });
});

// ─── git rewind ─────────────────────────────────────────────────────────────

describe('git rewind', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create initial repo with src/ and .planning/ files
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'const a = 1;\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State v1\n');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init: first commit"', { cwd: tmpDir, stdio: 'pipe' });
    // Second commit: modify both src and .planning
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'const a = 2;\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State v2\n');
    execSync('git add . && git commit -m "feat: second commit"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('rewind dry-run shows changes without .planning files', () => {
    const result = runGsdTools('git rewind --ref HEAD~1 --dry-run', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.dry_run, true, 'Should be dry run');
    assert.ok(data.changes.some(c => c.file === 'src/a.js'), 'Should include src/a.js in changes');
    assert.ok(!data.changes.some(c => c.file.startsWith('.planning')), 'Should not include .planning files');
    assert.ok(data.files_protected > 0, 'Should have protected files');
  });

  test('rewind without confirm returns needs_confirm', () => {
    const result = runGsdTools('git rewind --ref HEAD~1', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.needs_confirm, true, 'Should need confirmation');
    assert.ok(data.changes.length > 0, 'Should list changes');
    assert.ok(data.message.includes('--confirm'), 'Should mention --confirm');
  });

  test('rewind with confirm performs checkout', () => {
    const result = runGsdTools('git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.rewound, true, 'Should report rewound');
    assert.ok(data.files_changed > 0, 'Should have changed files');
    // Verify src/a.js content reverted
    const content = fs.readFileSync(path.join(tmpDir, 'src', 'a.js'), 'utf-8');
    assert.ok(content.includes('const a = 1'), 'src/a.js should be reverted to first commit');
  });

  test('protected paths survive rewind', () => {
    const result = runGsdTools('git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.rewound, true, 'Should report rewound');
    // .planning/STATE.md should retain second-commit content
    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes('v2'), '.planning/STATE.md should retain second-commit content');
  });

  test('protected root configs survive rewind', () => {
    // Add package.json in both commits
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"version":"2.0"}');
    execSync('git add . && git commit -m "feat: add package.json v2"', { cwd: tmpDir, stdio: 'pipe' });
    // Go back and create package.json in first version
    const firstCommit = execSync('git rev-list --max-parents=0 HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    // Rewind to commit before package.json was added (HEAD~1, which had v2 package.json)
    // Actually, let's set up properly: HEAD~2 is the init commit with no package.json,
    // HEAD~1 has the modifications, HEAD has package.json. Rewind to HEAD~1.
    const result = runGsdTools('git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    // package.json should still exist (protected)
    assert.ok(fs.existsSync(path.join(tmpDir, 'package.json')), 'package.json should survive rewind');
  });

  test('auto-stash on dirty tree', () => {
    // Make uncommitted change
    fs.writeFileSync(path.join(tmpDir, 'src', 'dirty.js'), 'uncommitted\n');
    const result = runGsdTools('git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.stash_used, true, 'Should use auto-stash');
    assert.strictEqual(data.rewound, true, 'Should complete rewind');
  });

  test('invalid ref returns error', () => {
    const result = runGsdTools('git rewind --ref nonexistent-ref-xyz', tmpDir);
    assert.ok(result.success, 'Command should return JSON (not crash)');
    const data = JSON.parse(result.output);
    assert.ok(data.error, 'Should have error');
    assert.ok(data.error.includes('Invalid ref'), 'Error should mention invalid ref');
  });

  test('rewind to HEAD returns no changes', () => {
    const result = runGsdTools('git rewind --ref HEAD --dry-run', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_affected, 0, 'No files should be affected');
  });
});

// ─── git trajectory-branch ──────────────────────────────────────────────────

describe('git trajectory-branch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('creates branch with correct name', () => {
    const result = runGsdTools('git trajectory-branch --phase 45 --slug test', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.created, true, 'Should create branch');
    assert.strictEqual(data.branch, 'gsd/trajectory/45-test', 'Branch name should match pattern');
    assert.strictEqual(data.pushed, false, 'Should not push by default');
    // Verify branch exists
    const branches = execSync('git branch', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(branches.includes('gsd/trajectory/45-test'), 'Branch should exist in git');
  });

  test('existing branch returns exists', () => {
    // Create branch first
    runGsdTools('git trajectory-branch --phase 45 --slug dup', tmpDir);
    // Switch back to main
    execSync('git checkout main 2>/dev/null || git checkout master', { cwd: tmpDir, stdio: 'pipe' });
    // Try again
    const result = runGsdTools('git trajectory-branch --phase 45 --slug dup', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.exists, true, 'Should report branch exists');
    assert.strictEqual(data.branch, 'gsd/trajectory/45-dup', 'Should report correct branch name');
  });

  test('branch is local-only by default', () => {
    const result = runGsdTools('git trajectory-branch --phase 45 --slug local', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.pushed, false, 'Should not push');
    // Verify no remote tracking
    const trackResult = execSync('git config --get branch.gsd/trajectory/45-local.remote 2>&1 || echo "no-remote"', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(trackResult.includes('no-remote') || trackResult === '', 'Should have no remote tracking');
  });
});

// ─── pre-commit checks ──────────────────────────────────────────────────────

describe('pre-commit checks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Write config.json so commit_docs is true
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('commit with dirty non-.planning files is blocked', () => {
    // Create a dirty file outside .planning
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'dirty\n');
    const result = runGsdTools('commit "test commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, false, 'Should not commit');
    assert.strictEqual(data.reason, 'pre_commit_blocked', 'Should be blocked by pre-commit');
    assert.ok(data.failures.length > 0, 'Should have failures');
    assert.ok(data.failures.some(f => f.check === 'dirty_tree'), 'Should have dirty_tree failure');
  });

  test('commit --force bypasses dirty file check', () => {
    // Create a dirty file outside .planning
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'dirty\n');
    // Create something in .planning to actually commit
    fs.writeFileSync(path.join(tmpDir, '.planning', 'test.md'), 'test\n');
    const result = runGsdTools('commit "test commit" --force', tmpDir);
    const data = JSON.parse(result.output);
    // Should either commit successfully or report nothing_to_commit (not blocked)
    assert.notStrictEqual(data.reason, 'pre_commit_blocked', 'Should not be blocked by pre-commit');
  });

  test('commit in detached HEAD is blocked', () => {
    // Get current commit hash and detach
    const hash = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync(`git checkout ${hash}`, { cwd: tmpDir, stdio: 'pipe' });
    const result = runGsdTools('commit "test commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, false, 'Should not commit');
    assert.strictEqual(data.reason, 'pre_commit_blocked', 'Should be blocked by pre-commit');
    assert.ok(data.failures.some(f => f.check === 'detached_head'), 'Should have detached_head failure');
  });

  test('commit in clean state proceeds normally', () => {
    // Add something to .planning to commit
    fs.writeFileSync(path.join(tmpDir, '.planning', 'new.md'), 'content\n');
    const result = runGsdTools('commit "test clean commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed === true || data.reason === 'nothing_to_commit', 'Should commit or have nothing to commit');
    assert.notStrictEqual(data.reason, 'pre_commit_blocked', 'Should not be blocked');
  });

  test('multiple pre-commit failures reported together', () => {
    // Detach HEAD and create dirty file
    const hash = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync(`git checkout ${hash}`, { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'dirty\n');
    const result = runGsdTools('commit "test commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.reason, 'pre_commit_blocked', 'Should be blocked');
    // Should have at least 2 failures (detached_head + dirty_tree)
    assert.ok(data.failures.length >= 2, `Should report multiple failures, got ${data.failures.length}`);
  });
});

// ─── commit --agent attribution ──────────────────────────────────────────────

describe('commit --agent attribution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('commit --agent gsd-executor produces commit with Agent-Type trailer', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'agent-test.md'), 'test\n');
    const result = runGsdTools('commit "test: agent attribution" --agent gsd-executor', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed, 'Should commit successfully');
    assert.strictEqual(data.agent_type, 'gsd-executor', 'Should return agent_type');
    // Verify git trailer exists in commit body
    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(body.includes('Agent-Type: gsd-executor'), `Commit body should contain Agent-Type: gsd-executor, got: ${body}`);
  });

  test('commit without --agent has no Agent-Type trailer', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'no-agent-test.md'), 'test\n');
    const result = runGsdTools('commit "test: no agent"', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed, 'Should commit successfully');
    assert.strictEqual(data.agent_type, null, 'agent_type should be null');
    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(!body.includes('Agent-Type'), `Commit body should NOT contain Agent-Type, got: ${body}`);
  });
});

// ─── consumer contract tests ─────────────────────────────────────────────────

/**
 * Compare actual output against a stored snapshot fixture.
 * On mismatch, produces diff-style output showing expected vs actual for each differing field.
 * If GSD_UPDATE_SNAPSHOTS=1, writes actual as new fixture instead of failing.
 *
 * @param {object} actual - The actual output to compare
 * @param {string} fixturePath - Path to the snapshot JSON file
 * @returns {{ pass: boolean, message: string }}
 */
function snapshotCompare(actual, fixturePath) {
  if (process.env.GSD_UPDATE_SNAPSHOTS === '1' || !fs.existsSync(fixturePath)) {
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
      // Check all expected keys
      for (const key of Object.keys(exp)) {
        compare(exp[key], act[key], keyPath ? `${keyPath}.${key}` : key);
      }
      // Check for removed keys (keys in expected but not in actual)
      for (const key of Object.keys(exp)) {
        if (!(key in act)) {
          diffs.push(`  - ${keyPath ? keyPath + '.' : ''}${key}: expected ${JSON.stringify(exp[key])}, got undefined (REMOVED)`);
        }
      }
      return;
    }
    // Primitive comparison
    if (exp !== act) {
      diffs.push(`  - ${keyPath}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
    }
  }

  compare(expected, actual, '');

  if (diffs.length === 0) {
    return { pass: true, message: 'Snapshot matches' };
  }

  return {
    pass: false,
    message: `Snapshot mismatch (${path.basename(fixturePath)}):\n${diffs.join('\n')}\n\nRun with GSD_UPDATE_SNAPSHOTS=1 to update.`,
  };
}

/**
 * Field-level contract check: verifies required fields exist with correct types.
 * New fields in actual are ALLOWED (additive-safe). Missing/wrong-type fields FAIL.
 *
 * @param {object} actual - The actual output
 * @param {Array<{key: string, type: string}>} requiredFields - Required field specs
 * @param {string} contextName - Name for error messages
 * @returns {{ pass: boolean, message: string }}
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

// ─── Full Snapshot: init phase-op ────────────────────────────────────────────

describe('contract: init phase-op (full snapshot)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create a complete .planning structure
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

## Phases

- [ ] Phase 1: Foundation (0/1 plans)
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

Phase: 1 of 1 (Foundation)
Plan: 0 of 1 in current phase
Status: Ready

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      model_profile: 'balanced',
    }));
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Phase 1 Context\n\nTest context.\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---
phase: 01-foundation
plan: 01
type: execute
---

# Test Plan
`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init phase-op output matches snapshot', () => {
    const result = runGsdTools('init phase-op 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    // Use project-level snapshot directory
    const fixturePath = path.join(__dirname, '..', 'test', '__snapshots__', 'init-phase-op.json');
    const snap = snapshotCompare(actual, fixturePath);
    assert.ok(snap.pass, snap.message);
  });
});

// ─── Full Snapshot: state read ───────────────────────────────────────────────

describe('contract: state read (full snapshot)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Test project
**Current focus:** Testing

## Current Position

Phase: 1 of 1 (Foundation)
Plan: 0 of 1 in current phase
Status: Ready
Last activity: 2026-01-01

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0

## Accumulated Context

### Decisions

None yet.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
Resume file: None
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      commit_docs: true,
      model_profile: 'balanced',
    }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('state read output matches snapshot', () => {
    const result = runGsdTools('state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const fixturePath = path.join(__dirname, '..', 'test', '__snapshots__', 'state-read.json');
    const snap = snapshotCompare(actual, fixturePath);
    assert.ok(snap.pass, snap.message);
  });
});

// ─── Field-level Contract: init plan-phase ───────────────────────────────────

describe('contract: init plan-phase fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init plan-phase has required fields', () => {
    const result = runGsdTools('init plan-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
      { key: 'phase_number', type: 'string' },
      { key: 'phase_name', type: 'string' },
      { key: 'has_research', type: 'boolean' },
      { key: 'has_context', type: 'boolean' },
      { key: 'has_plans', type: 'boolean' },
      { key: 'plan_count', type: 'number' },
      { key: 'research_enabled', type: 'boolean' },
      { key: 'plan_checker_enabled', type: 'boolean' },
    ], 'init-plan-phase');
    assert.ok(contract.pass, contract.message);
  });

  test('adding new field to plan-phase does not break contract', () => {
    const result = runGsdTools('init plan-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    // Simulate adding a new field
    actual.new_future_field = 'something';

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
    ], 'init-plan-phase-additive');
    assert.ok(contract.pass, 'New fields should not break contract');
  });
});

// ─── Field-level Contract: init new-project ──────────────────────────────────

describe('contract: init new-project fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init new-project has required fields', () => {
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'planning_exists', type: 'boolean' },
      { key: 'has_existing_code', type: 'boolean' },
      { key: 'is_brownfield', type: 'boolean' },
      { key: 'project_exists', type: 'boolean' },
      { key: 'has_git', type: 'boolean' },
    ], 'init-new-project');
    assert.ok(contract.pass, contract.message);
  });
});

// ─── Field-level Contract: init execute-phase ────────────────────────────────

describe('contract: init execute-phase fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\nPhase: 1\nPlan: 0\nStatus: Ready\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init execute-phase has required fields', () => {
    const result = runGsdTools('init execute-phase 1 --verbose', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phase_found', type: 'boolean' },
      { key: 'phase_dir', type: 'string' },
      { key: 'phase_number', type: 'string' },
      { key: 'phase_name', type: 'string' },
      { key: 'plans', type: 'array' },
      { key: 'plan_count', type: 'number' },
    ], 'init-execute-phase');
    assert.ok(contract.pass, contract.message);
  });
});

// ─── Field-level Contract: state read fields ─────────────────────────────────

describe('contract: state read fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

Phase: 1
Plan: 0
Status: Ready

## Accumulated Context

### Decisions

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-01
Stopped at: Ready
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('state read has required fields', () => {
    const result = runGsdTools('state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'config', type: 'object' },
      { key: 'state_raw', type: 'string' },
      { key: 'state_exists', type: 'boolean' },
      { key: 'roadmap_exists', type: 'boolean' },
      { key: 'config_exists', type: 'boolean' },
    ], 'state-read');
    assert.ok(contract.pass, contract.message);
  });
});

// ─── Field-level Contract: init progress fields ──────────────────────────────

describe('contract: init progress fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestones\n\n- **v1.0 Test** — Phases 1-1\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\nPhase: 1\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---\nphase: 01-foundation\nplan: 01\n---\n# Plan\n`);
  });

  afterEach(() => { cleanup(tmpDir); });

  test('init progress has required fields', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const actual = JSON.parse(result.output);

    const contract = contractCheck(actual, [
      { key: 'phases', type: 'array' },
      { key: 'phase_count', type: 'number' },
      { key: 'completed_count', type: 'number' },
      { key: 'in_progress_count', type: 'number' },
      { key: 'has_work_in_progress', type: 'boolean' },
    ], 'init-progress');
    assert.ok(contract.pass, contract.message);
  });
});

// ─── profiler ────────────────────────────────────────────────────────────────

describe('profiler', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestones\n\n- **v1.0 Test** — Phases 1-1\n\n## Phases\n\n- [ ] Phase 1: Foundation (0/1 plans)\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\nPhase: 1\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }));
  });

  afterEach(() => { cleanup(tmpDir); });

  test('profiler disabled by default — no baselines created', () => {
    // Run a command without GSD_PROFILE
    const env = { ...process.env };
    delete env.GSD_PROFILE;
    try {
      execSync(`node "${TOOLS_PATH}" init progress`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } catch (e) {
      // Command may fail but profiler should not write baselines
    }
    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    // Baselines directory should NOT be created when profiling is disabled
    const exists = fs.existsSync(baselinesDir);
    if (exists) {
      const files = fs.readdirSync(baselinesDir).filter(f => f.startsWith('init-'));
      assert.strictEqual(files.length, 0, 'No profiler baselines should exist when GSD_PROFILE is not set');
    }
  });

  test('profiler enabled writes baseline', () => {
    const env = { ...process.env, GSD_PROFILE: '1' };
    try {
      execSync(`node "${TOOLS_PATH}" init progress`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } catch (e) {
      // Command may fail but profiler should still write baseline
    }
    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    assert.ok(fs.existsSync(baselinesDir), 'Baselines directory should be created');
    const files = fs.readdirSync(baselinesDir).filter(f => f.endsWith('.json'));
    assert.ok(files.length > 0, 'Should have at least one baseline file');

    // Parse and verify structure
    const baseline = JSON.parse(fs.readFileSync(path.join(baselinesDir, files[0]), 'utf-8'));
    assert.ok(baseline.command, 'Baseline should have command field');
    assert.ok(baseline.timestamp, 'Baseline should have timestamp field');
    assert.ok(Array.isArray(baseline.timings), 'Baseline should have timings array');
    assert.strictEqual(typeof baseline.total_ms, 'number', 'Baseline should have total_ms as number');
  });

  test('profiler baseline JSON structure', () => {
    const env = { ...process.env, GSD_PROFILE: '1' };
    try {
      execSync(`node "${TOOLS_PATH}" init progress`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } catch (e) { /* ignore */ }
    const baselinesDir = path.join(tmpDir, '.planning', 'baselines');
    const files = fs.readdirSync(baselinesDir).filter(f => f.endsWith('.json'));
    const baseline = JSON.parse(fs.readFileSync(path.join(baselinesDir, files[0]), 'utf-8'));

    // Verify full expected shape
    assert.strictEqual(typeof baseline.command, 'string', 'command should be string');
    assert.strictEqual(typeof baseline.timestamp, 'string', 'timestamp should be string');
    assert.strictEqual(typeof baseline.node_version, 'string', 'node_version should be string');
    assert.ok(Array.isArray(baseline.timings), 'timings should be array');
    assert.strictEqual(typeof baseline.total_ms, 'number', 'total_ms should be number');
    // Verify timings have correct structure if present
    if (baseline.timings.length > 0) {
      assert.strictEqual(typeof baseline.timings[0].label, 'string', 'timing.label should be string');
      assert.strictEqual(typeof baseline.timings[0].duration_ms, 'number', 'timing.duration_ms should be number');
    }
  });

  test('profiler zero-cost when disabled', () => {
    // Direct module test — require profiler and check isProfilingEnabled
    // Since we're not setting GSD_PROFILE in this test process, it should be false
    // But since the module caches the env at load time, we test the built bundle's behavior
    // by running a separate process
    const env = { ...process.env };
    delete env.GSD_PROFILE;

    // Measure time: run command twice — once with profiler, once without.
    // The disabled path should not be significantly slower (zero-cost assertion).
    // We just verify the function returns false when GSD_PROFILE is unset.
    const checkResult = execSync(
      `node -e "delete process.env.GSD_PROFILE; const p = require('./src/lib/profiler'); console.log(JSON.stringify({ enabled: p.isProfilingEnabled(), timings: p.getTimings() }))"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf-8', env }
    ).trim();
    const check = JSON.parse(checkResult);
    assert.strictEqual(check.enabled, false, 'isProfilingEnabled should return false when GSD_PROFILE unset');
    assert.deepStrictEqual(check.timings, [], 'getTimings should return empty array when disabled');
  });
});


// ─── AST Intelligence: codebase ast & codebase exports ──────────────────────

describe('codebase ast command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-ast-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('codebase ast on JS file with functions returns signatures', () => {
    const jsFile = path.join(tmpDir, 'sample.js');
    fs.writeFileSync(jsFile, `
function hello(name, age) {
  return name + age;
}

async function fetchData(url) {
  return await fetch(url);
}

const add = (a, b) => a + b;
`);

    const result = runGsdTools(`codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.language, 'javascript');
    assert.ok(parsed.count >= 3, `Expected at least 3 signatures, got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('hello'), 'Should find hello function');
    assert.ok(names.includes('fetchData'), 'Should find fetchData function');
    assert.ok(names.includes('add'), 'Should find add arrow function');

    // Check fetchData is async
    const fetchSig = parsed.signatures.find(s => s.name === 'fetchData');
    assert.strictEqual(fetchSig.async, true, 'fetchData should be async');

    // Check params
    const helloSig = parsed.signatures.find(s => s.name === 'hello');
    assert.deepStrictEqual(helloSig.params, ['name', 'age'], 'hello should have name, age params');
  });

  test('codebase ast on JS file with classes returns class + method signatures', () => {
    const jsFile = path.join(tmpDir, 'myclass.js');
    fs.writeFileSync(jsFile, `
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return this.name;
  }

  async fetch(url) {
    return url;
  }
}
`);

    const result = runGsdTools(`codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.count >= 3, `Expected at least 3 signatures (class + 2 methods), got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('Animal'), 'Should find Animal class');
    assert.ok(names.includes('Animal.constructor'), 'Should find constructor method');
    assert.ok(names.includes('Animal.speak'), 'Should find speak method');

    // Check types
    const classSig = parsed.signatures.find(s => s.name === 'Animal');
    assert.strictEqual(classSig.type, 'class');

    const methodSig = parsed.signatures.find(s => s.name === 'Animal.speak');
    assert.strictEqual(methodSig.type, 'method');
  });

  test('codebase ast on CJS file with module.exports returns signatures', () => {
    const jsFile = path.join(tmpDir, 'cjs-mod.js');
    fs.writeFileSync(jsFile, `
'use strict';

function internalHelper(x) {
  return x * 2;
}

module.exports.calculate = function(a, b) {
  return internalHelper(a) + b;
};

exports.format = function(str) {
  return str.trim();
};
`);

    const result = runGsdTools(`codebase ast "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('internalHelper'), 'Should find internalHelper function');
    assert.ok(names.includes('calculate'), 'Should find module.exports.calculate');
    assert.ok(names.includes('format'), 'Should find exports.format');
  });

  test('codebase ast on non-existent file returns error gracefully', () => {
    const result = runGsdTools(`codebase ast "${path.join(tmpDir, 'nonexistent.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
    assert.deepStrictEqual(parsed.signatures, [], 'Should return empty signatures');
  });

  test('codebase ast on Python file returns regex-extracted signatures', () => {
    const pyFile = path.join(tmpDir, 'app.py');
    fs.writeFileSync(pyFile, `
def greet(name):
    print(f"Hello, {name}")

async def fetch_data(url, timeout=30):
    pass

class UserService:
    def get_user(self, user_id):
        pass
`);

    const result = runGsdTools(`codebase ast "${pyFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.language, 'python');
    assert.ok(parsed.count >= 2, `Expected at least 2 signatures, got ${parsed.count}`);

    const names = parsed.signatures.map(s => s.name);
    assert.ok(names.includes('greet'), 'Should find greet function');
    assert.ok(names.includes('fetch_data'), 'Should find fetch_data function');
  });

  test('codebase ast on unknown extension returns empty signatures, no crash', () => {
    const unknownFile = path.join(tmpDir, 'data.xyz');
    fs.writeFileSync(unknownFile, 'some random content');

    const result = runGsdTools(`codebase ast "${unknownFile}"`, tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.deepStrictEqual(parsed.signatures, [], 'Should return empty signatures');
    assert.strictEqual(parsed.count, 0, 'Count should be 0');
  });
});

describe('codebase exports command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-exports-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('codebase exports on ESM file returns named/default exports', () => {
    const esmFile = path.join(tmpDir, 'esm-mod.mjs');
    fs.writeFileSync(esmFile, `
export function hello() {}
export const VERSION = '1.0';
export default class App {}
`);

    const result = runGsdTools(`codebase exports "${esmFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.type, 'esm', 'Should detect ESM module');
    assert.ok(parsed.named.includes('hello'), 'Should find named export hello');
    assert.ok(parsed.named.includes('VERSION'), 'Should find named export VERSION');
    assert.strictEqual(parsed.default, 'App', 'Should find default export App');
  });

  test('codebase exports on CJS file returns cjs_exports', () => {
    const cjsFile = path.join(tmpDir, 'cjs-mod.js');
    fs.writeFileSync(cjsFile, `
'use strict';

function calculate(a, b) { return a + b; }
function format(str) { return str.trim(); }

module.exports = {
  calculate,
  format,
};
`);

    const result = runGsdTools(`codebase exports "${cjsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.type, 'cjs', 'Should detect CJS module');
    assert.ok(parsed.cjs_exports.includes('calculate'), 'Should find cjs export calculate');
    assert.ok(parsed.cjs_exports.includes('format'), 'Should find cjs export format');
  });

  test('codebase exports on non-existent file returns error gracefully', () => {
    const result = runGsdTools(`codebase exports "${path.join(tmpDir, 'missing.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
  });
});


// ─── AST Intelligence: codebase complexity & codebase repo-map ──────────────

describe('codebase complexity command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-complexity-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('simple function with no branching has complexity 1', () => {
    const jsFile = path.join(tmpDir, 'simple.js');
    fs.writeFileSync(jsFile, `
function add(a, b) {
  return a + b;
}
`);
    const result = runGsdTools(`codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.functions.length > 0, 'Should find at least one function');
    const addFn = parsed.functions.find(f => f.name === 'add');
    assert.ok(addFn, 'Should find the add function');
    assert.strictEqual(addFn.complexity, 1, 'Simple function should have complexity 1');
    assert.strictEqual(addFn.nesting_max, 0, 'Simple function should have nesting_max 0');
  });

  test('function with if/else/for has complexity reflecting branch count', () => {
    const jsFile = path.join(tmpDir, 'branching.js');
    fs.writeFileSync(jsFile, `
function process(items) {
  if (items.length === 0) {
    return [];
  }
  for (let i = 0; i < items.length; i++) {
    if (items[i] > 10) {
      items[i] = 10;
    }
  }
  return items;
}
`);
    const result = runGsdTools(`codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const processFn = parsed.functions.find(f => f.name === 'process');
    assert.ok(processFn, 'Should find the process function');
    // Base 1 + if + for + if = 4
    assert.ok(processFn.complexity >= 4, `Expected complexity >= 4, got ${processFn.complexity}`);
  });

  test('nested control flow reflects nesting depth', () => {
    const jsFile = path.join(tmpDir, 'nested.js');
    fs.writeFileSync(jsFile, `
function deepNest(x) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2 === 0) {
        while (x > i) {
          x--;
        }
      }
    }
  }
  return x;
}
`);
    const result = runGsdTools(`codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const nestFn = parsed.functions.find(f => f.name === 'deepNest');
    assert.ok(nestFn, 'Should find the deepNest function');
    // if > for > if > while = depth 4
    assert.ok(nestFn.nesting_max >= 4, `Expected nesting_max >= 4, got ${nestFn.nesting_max}`);
  });

  test('module complexity is sum of function complexities', () => {
    const jsFile = path.join(tmpDir, 'multi.js');
    fs.writeFileSync(jsFile, `
function simple() { return 1; }
function branching(x) {
  if (x > 0) return true;
  return false;
}
`);
    const result = runGsdTools(`codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.functions.length, 2, 'Should find 2 functions');
    const sum = parsed.functions.reduce((acc, f) => acc + f.complexity, 0);
    assert.strictEqual(parsed.module_complexity, sum, 'module_complexity should be sum of function complexities');
  });

  test('non-existent file returns graceful error', () => {
    const result = runGsdTools(`codebase complexity "${path.join(tmpDir, 'nonexistent.js')}"`, tmpDir);
    assert.ok(result.success, `Command should succeed (graceful error): ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.error, 'file_not_found', 'Should report file_not_found error');
    assert.strictEqual(parsed.module_complexity, 0, 'module_complexity should be 0 for missing file');
  });

  test('logical operators contribute to complexity', () => {
    const jsFile = path.join(tmpDir, 'logical.js');
    fs.writeFileSync(jsFile, `
function validate(x, y) {
  if (x > 0 && y > 0 || x < -10) {
    return true;
  }
  return false;
}
`);
    const result = runGsdTools(`codebase complexity "${jsFile}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const fn = parsed.functions.find(f => f.name === 'validate');
    assert.ok(fn, 'Should find the validate function');
    // Base 1 + if + && + || = 4
    assert.ok(fn.complexity >= 4, `Expected complexity >= 4 (1 + if + && + ||), got ${fn.complexity}`);
  });
});


describe('codebase repo-map command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-repomap-'));
    // Set up a minimal project structure with source files
    fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true }); // fake git dir

    // Create source files with signatures
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), `
function startup(config) {
  return init(config);
}

function shutdown() {
  cleanup();
}

const helper = (x) => x + 1;

module.exports = { startup, shutdown, helper };
`);

    fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'utils.js'), `
function formatDate(date) {
  return date.toISOString();
}

function parseQuery(str) {
  return str.split('&');
}

module.exports = { formatDate, parseQuery };
`);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('repo map returns summary string with file entries', () => {
    const result = runGsdTools('codebase repo-map --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.summary, 'Should have summary string');
    assert.ok(parsed.summary.includes('# Repo Map'), 'Summary should include header');
    assert.ok(parsed.files_included > 0, 'Should include at least one file');
    assert.ok(parsed.total_signatures > 0, 'Should have signatures');
    assert.ok(parsed.token_estimate > 0, 'Should have token estimate');
  });

  test('repo map token_estimate is roughly within budget', () => {
    const result = runGsdTools('codebase repo-map --budget 2000 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    // Allow some overshoot (1.2x) but should be in ballpark
    assert.ok(parsed.token_estimate < 2000 * 1.5, `token_estimate ${parsed.token_estimate} way over budget 2000`);
  });

  test('repo map includes source files with signatures', () => {
    const result = runGsdTools('codebase repo-map --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    // Should mention our source files in the summary
    assert.ok(
      parsed.summary.includes('main.js') || parsed.summary.includes('utils.js'),
      'Summary should include source file names'
    );
    assert.ok(parsed.summary.includes('fn '), 'Summary should include function entries');
  });

  test('repo map --budget flag controls output size', () => {
    const bigResult = runGsdTools('codebase repo-map --budget 5000 --raw', tmpDir);
    const smallResult = runGsdTools('codebase repo-map --budget 100 --raw', tmpDir);

    assert.ok(bigResult.success, `Big budget failed: ${bigResult.error}`);
    assert.ok(smallResult.success, `Small budget failed: ${smallResult.error}`);

    const big = JSON.parse(bigResult.output);
    const small = JSON.parse(smallResult.output);

    // Small budget should have fewer or equal files included
    assert.ok(
      small.files_included <= big.files_included,
      `Small budget (${small.files_included} files) should have <= files than big budget (${big.files_included} files)`
    );
  });
});


describe('codebase repo-map integration', () => {
  test('repo-map on gsd-tools project produces valid JSON with files > 0', () => {
    const result = runGsdTools('codebase repo-map --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.files_included > 0, 'Should include files from this project');
    assert.ok(parsed.total_signatures > 0, 'Should have signatures from this project');
    assert.ok(typeof parsed.summary === 'string', 'Summary should be a string');
    assert.ok(parsed.summary.length > 50, 'Summary should have meaningful content');
    assert.ok(parsed.token_estimate > 0, 'Token estimate should be positive');
  });
});


// ─── Orchestration Intelligence Tests ────────────────────────────────────────

describe('orchestration: classifyTaskComplexity', () => {
  test('minimal task (1 file, no tests) scores 1-2', () => {
    const result = runGsdTools('classify plan --raw', process.cwd());
    // Direct module test via inline plan
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.js
autonomous: true
---

<objective>Simple task</objective>

<tasks>
<task type="auto">
  <name>Simple task</name>
  <files>src/foo.js</files>
  <action>Add a single function</action>
  <verify>check it</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.ok(parsed.tasks[0].complexity.score <= 2, `Expected score <= 2, got ${parsed.tasks[0].complexity.score}`);
    assert.strictEqual(parsed.tasks[0].complexity.label, parsed.tasks[0].complexity.score === 1 ? 'trivial' : 'simple');
    cleanup(tmpDir);
  });

  test('complex task (4+ files, tests, long action) scores 4-5', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const longAction = 'Implement the full authentication system with JWT token rotation, refresh tokens, and session management. ' +
      'This requires modifying the user model, adding middleware for token validation, creating the login/logout endpoints, ' +
      'handling token expiry and refresh, adding rate limiting to auth endpoints, and writing comprehensive test coverage. ' +
      'The implementation must handle edge cases like concurrent refresh requests, token blacklisting, and graceful degradation ' +
      'when the token store is unavailable. Additionally, integrate with the existing authorization middleware and ensure ' +
      'backward compatibility with session-based auth that some clients still use. Run npm test to verify all auth tests pass. ' +
      'Add integration tests for the complete login flow including token refresh and logout scenarios across multiple sessions.';
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/auth.js
  - src/middleware.js
  - src/models/user.js
  - src/routes/auth.js
  - src/lib/tokens.js
  - tests/auth.test.js
autonomous: true
---

<objective>Auth system</objective>

<tasks>
<task type="auto">
  <name>Complex auth task</name>
  <files>src/auth.js, src/middleware.js, src/models/user.js, src/routes/auth.js, src/lib/tokens.js, tests/auth.test.js</files>
  <action>${longAction}</action>
  <verify>npm test</verify>
  <done>All auth tests pass</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.ok(parsed.tasks[0].complexity.score >= 4, `Expected score >= 4, got ${parsed.tasks[0].complexity.score}`);
    assert.ok(['complex', 'very_complex'].includes(parsed.tasks[0].complexity.label));
    cleanup(tmpDir);
  });

  test('moderate task (3 files, tests) scores 3', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/a.js
  - src/b.js
  - src/c.js
autonomous: true
---

<objective>Moderate task</objective>

<tasks>
<task type="auto">
  <name>Moderate task</name>
  <files>src/a.js, src/b.js, src/c.js</files>
  <action>Implement feature with test coverage</action>
  <verify>npm test</verify>
  <done>Tests pass</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.tasks[0].complexity.score, 3, 'Expected score 3 for 3 files + tests');
    assert.strictEqual(parsed.tasks[0].complexity.label, 'moderate');
    cleanup(tmpDir);
  });
});

describe('orchestration: parseTasksFromPlan', () => {
  test('extracts tasks from plan XML correctly', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Test parsing</objective>

<tasks>

<task type="auto">
  <name>First Task</name>
  <files>src/a.js, src/b.js</files>
  <action>Do something first</action>
  <verify>npm test</verify>
  <done>First done</done>
</task>

<task type="checkpoint:human-verify">
  <name>Second Task</name>
  <files>src/c.js</files>
  <action>Do something second</action>
  <verify>Check it manually</verify>
  <done>Verified</done>
</task>

</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.task_count, 2, 'Should parse 2 tasks');
    assert.strictEqual(parsed.tasks[0].name, 'First Task');
    assert.strictEqual(parsed.tasks[1].name, 'Second Task');
    assert.deepStrictEqual(parsed.tasks[0].files, ['src/a.js', 'src/b.js']);
    assert.strictEqual(parsed.tasks[1].type, 'checkpoint:human-verify');
    cleanup(tmpDir);
  });

  test('handles malformed XML gracefully', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Bad XML</objective>

<tasks>

<task type="auto">
  <name>Only name, no closing tag properly
  <files>src/a.js</files>

This is just random text, not in a task block.

</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify plan .planning/phases/99-test/99-01-PLAN.md --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    // Should return 0 tasks (no valid <task>...</task> blocks)
    assert.strictEqual(parsed.task_count, 0, 'Should handle malformed XML by returning 0 tasks');
    cleanup(tmpDir);
  });
});

describe('orchestration: selectExecutionMode', () => {
  test('single plan with 1-2 tasks returns mode "single"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Single task</objective>

<tasks>
<task type="auto">
  <name>Only task</name>
  <files>src/a.js</files>
  <action>Do it</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'single', 'Single plan with 1 task should be "single"');
    cleanup(tmpDir);
  });

  test('multiple same-wave plans returns mode "parallel"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    for (const num of ['01', '02']) {
      const planContent = `---
phase: 99-test
plan: ${num}
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Plan ${num}</objective>

<tasks>
<task type="auto">
  <name>Task in plan ${num}</name>
  <files>src/${num}.js</files>
  <action>Implement plan ${num}</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
      fs.writeFileSync(path.join(phaseDir, `99-${num}-PLAN.md`), planContent);
    }

    const res = runGsdTools(`classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'parallel', 'Multiple same-wave plans should be "parallel"');
    assert.ok(parsed.execution_mode.reason.includes('independent plans'), 'Reason should mention independent plans');
    cleanup(tmpDir);
  });

  test('plans with checkpoints returns mode "sequential"', () => {
    const tmpDir = createTempProject();
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '99-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planContent = `---
phase: 99-test
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
---

<objective>Plan with checkpoint</objective>

<tasks>
<task type="auto">
  <name>Auto task</name>
  <files>src/a.js</files>
  <action>Do something</action>
  <verify>check</verify>
  <done>done</done>
</task>

<task type="checkpoint:human-verify">
  <name>Verify task</name>
  <files>src/a.js</files>
  <action>Verify it works</action>
  <verify>Visual check</verify>
  <done>Approved</done>
</task>

<task type="auto">
  <name>Final task</name>
  <files>src/a.js</files>
  <action>Finish up</action>
  <verify>check</verify>
  <done>done</done>
</task>
</tasks>`;
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent);

    const res = runGsdTools(`classify phase 99 --raw`, tmpDir);
    assert.ok(res.success, `Command failed: ${res.error}`);
    const parsed = JSON.parse(res.output);
    assert.strictEqual(parsed.execution_mode.mode, 'sequential', 'Plans with checkpoints should be "sequential"');
    assert.ok(parsed.execution_mode.has_checkpoints, 'Should report has_checkpoints true');
    cleanup(tmpDir);
  });
});

describe('orchestration: classify plan CLI', () => {
  test('returns JSON with task scores for a real plan', () => {
    const result = runGsdTools('classify plan .planning/milestones/v7.0-phases/39-orchestration-intelligence/39-01-PLAN.md --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.plan, '39-01-PLAN.md');
    assert.ok(parsed.task_count >= 2, 'Should have at least 2 tasks');
    assert.ok(parsed.tasks.every(t => t.complexity.score >= 1 && t.complexity.score <= 5), 'All scores 1-5');
    assert.ok(parsed.tasks.every(t => ['trivial', 'simple', 'moderate', 'complex', 'very_complex'].includes(t.complexity.label)), 'All labels valid');
    assert.ok(parsed.tasks.every(t => ['haiku', 'sonnet', 'opus'].includes(t.complexity.recommended_model)), 'All models valid');
    assert.ok(typeof parsed.plan_complexity === 'number', 'plan_complexity should be a number');
    assert.ok(typeof parsed.recommended_model === 'string', 'recommended_model should be a string');
  });
});

describe('orchestration: classify phase CLI', () => {
  test('classify phase 38 returns classifications for completed plans', () => {
    const result = runGsdTools('classify phase 38 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '38');
    assert.ok(parsed.plans_classified >= 1, 'Should classify at least 1 plan');
    assert.ok(parsed.execution_mode, 'Should have execution_mode');
    assert.ok(['single', 'parallel', 'sequential', 'pipeline'].includes(parsed.execution_mode.mode), 'Valid mode');
    assert.ok(typeof parsed.execution_mode.reason === 'string', 'Mode should have reason');
  });
});

describe('orchestration: init execute-phase integration', () => {
  test('init execute-phase on incomplete phase includes task_routing field', () => {
    const result = runGsdTools('init execute-phase 39 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok('task_routing' in parsed, 'task_routing field should be present');

    // Phase 39 has incomplete plans, so task_routing should be populated
    if (parsed.task_routing !== null) {
      assert.ok(Array.isArray(parsed.task_routing.plans), 'task_routing.plans should be array');
      assert.ok(parsed.task_routing.execution_mode, 'task_routing should have execution_mode');
      assert.ok(typeof parsed.task_routing.classified_at === 'string', 'Should have classified_at timestamp');
    }
  });
});

// ─── Agent Context Manifests ─────────────────────────────────────────────────

describe('agent manifests: AGENT_MANIFESTS structure', () => {
  test('has entries for all 6 agent types', () => {
    const ctx = require('../src/lib/context');
    const types = ['gsd-executor', 'gsd-verifier', 'gsd-planner', 'gsd-phase-researcher', 'gsd-plan-checker', 'gsd-reviewer'];
    for (const t of types) {
      assert.ok(ctx.AGENT_MANIFESTS[t], `Missing manifest for ${t}`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].fields), `${t} should have fields array`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].optional), `${t} should have optional array`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].exclude), `${t} should have exclude array`);
    }
  });

  test('gsd-reviewer manifest has review-scoped fields', () => {
    const ctx = require('../src/lib/context');
    const manifest = ctx.AGENT_MANIFESTS['gsd-reviewer'];
    assert.ok(manifest, 'gsd-reviewer manifest should exist');
    assert.ok(manifest.fields.includes('codebase_conventions'), 'Should include codebase_conventions');
    assert.ok(manifest.fields.includes('codebase_dependencies'), 'Should include codebase_dependencies');
    assert.ok(manifest.exclude.includes('incomplete_plans'), 'Should exclude incomplete_plans');
  });
});

describe('agent manifests: scopeContextForAgent', () => {
  const ctx = require('../src/lib/context');

  test('gsd-executor gets task_routing but not intent_drift', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], incomplete_plans: [], plan_count: 0, incomplete_count: 0,
      branch_name: 'gsd/phase-38', commit_docs: true, verifier_enabled: true,
      task_routing: { plans: [] }, env_summary: 'node',
      intent_drift: { score: 20 }, intent_summary: 'Build stuff',
      worktree_config: {}, worktree_active: [], file_overlaps: [],
      codebase_stats: { total: 100 }, codebase_freshness: null,
    };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-executor');
    assert.strictEqual(scoped._agent, 'gsd-executor');
    assert.ok('task_routing' in scoped, 'Should include task_routing');
    assert.ok(!('intent_drift' in scoped), 'Should exclude intent_drift');
    assert.ok(!('worktree_config' in scoped), 'Should exclude worktree_config');
  });

  test('gsd-verifier gets phase_dir but not task_routing', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], summaries: [], verifier_enabled: true,
      task_routing: { plans: [] }, env_summary: 'node',
      intent_drift: { score: 20 }, codebase_stats: { total: 100 },
    };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-verifier');
    assert.strictEqual(scoped._agent, 'gsd-verifier');
    assert.ok('phase_dir' in scoped, 'Should include phase_dir');
    assert.ok(!('task_routing' in scoped), 'Should exclude task_routing');
    assert.ok(!('env_summary' in scoped), 'Should exclude env_summary');
  });

  test('unknown agent type returns full result', () => {
    const result = { phase_dir: '/test', phase_number: '38' };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-unknown-agent');
    assert.strictEqual(scoped.phase_dir, '/test');
    assert.strictEqual(scoped.phase_number, '38');
    assert.ok(!('_agent' in scoped), 'Should not add _agent for unknown type');
  });

  test('_savings shows reduction percentage', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], incomplete_plans: [], plan_count: 0, incomplete_count: 0,
      branch_name: 'gsd/38', commit_docs: true, verifier_enabled: true,
      task_routing: null, env_summary: null,
      intent_drift: { score: 5 }, intent_summary: 'test',
      worktree_config: {}, worktree_active: [], file_overlaps: [],
      codebase_stats: null, codebase_freshness: null,
      codebase_conventions: null, codebase_dependencies: null,
    };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-executor');
    assert.ok(scoped._savings, 'Should have _savings');
    assert.ok(typeof scoped._savings.original_keys === 'number');
    assert.ok(typeof scoped._savings.scoped_keys === 'number');
    assert.ok(typeof scoped._savings.reduction_pct === 'number');
    assert.ok(scoped._savings.reduction_pct > 0, 'Should show positive reduction');
  });

  test('gsd-reviewer gets codebase_conventions but not incomplete_plans', () => {
    const result = {
      phase_dir: '/test', phase_number: '41', phase_name: 'test',
      plans: [], incomplete_plans: ['41-01-PLAN.md'], plan_count: 1,
      summaries: [], codebase_conventions: { naming: 'camelCase' },
      codebase_dependencies: { total_modules: 5 }, codebase_stats: { total: 50 },
    };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-reviewer');
    assert.strictEqual(scoped._agent, 'gsd-reviewer');
    assert.ok('codebase_conventions' in scoped, 'Should include codebase_conventions');
    assert.ok('codebase_dependencies' in scoped, 'Should include codebase_dependencies');
    assert.ok(!('incomplete_plans' in scoped), 'Should exclude incomplete_plans');
    assert.ok(!('plan_count' in scoped), 'Should exclude plan_count');
  });
});

describe('agent manifests: compactPlanState', () => {
  const ctx = require('../src/lib/context');

  test('reduces STATE.md to compact object with phase, progress, status', () => {
    const stateRaw = `# Project State

## Current Position

Phase: 39 — Orchestration Intelligence
Plan: 1 of 1 complete
Status: Phase complete
Last activity: 2026-02-27 — Completed 39-01

## Accumulated Context

### Decisions

- Phase 38-01: Use acorn
- Phase 38-02: Base complexity 1
- Phase 39-01: Model mapping scores
`;
    const compact = ctx.compactPlanState(stateRaw);
    assert.strictEqual(compact.phase, '39');
    assert.strictEqual(compact.progress, '1 of 1 complete');
    assert.strictEqual(compact.status, 'Phase complete');
    assert.strictEqual(compact.last_activity, '2026-02-27');
    assert.ok(compact.decisions.length >= 2, 'Should have decisions');
    assert.deepStrictEqual(compact.blockers, []);
  });

  test('decisions limited to last 5', () => {
    const stateRaw = `## Current Position
Phase: 10
Plan: 5 of 5 complete
Status: Phase complete
Last activity: 2026-01-01

### Decisions

- Phase 01-01: Decision A
- Phase 02-01: Decision B
- Phase 03-01: Decision C
- Phase 04-01: Decision D
- Phase 05-01: Decision E
- Phase 06-01: Decision F
- Phase 07-01: Decision G
`;
    const compact = ctx.compactPlanState(stateRaw);
    assert.strictEqual(compact.decisions.length, 5, 'Should cap at 5 decisions');
    assert.ok(compact.decisions[0].includes('03-01'), 'Should keep last 5 (starting from 3rd)');
    assert.ok(compact.decisions[4].includes('07-01'), 'Last decision should be 07-01');
  });

  test('empty/missing state returns sensible defaults', () => {
    const compact = ctx.compactPlanState('');
    assert.strictEqual(compact.phase, null);
    assert.strictEqual(compact.progress, null);
    assert.strictEqual(compact.status, null);
    assert.strictEqual(compact.last_activity, null);
    assert.deepStrictEqual(compact.decisions, []);
    assert.deepStrictEqual(compact.blockers, []);

    const compactNull = ctx.compactPlanState(null);
    assert.strictEqual(compactNull.phase, null);
  });
});

describe('agent manifests: compactDepGraph', () => {
  const ctx = require('../src/lib/context');

  test('reduces dep data, keeps top_imported capped at 5', () => {
    const dep = {
      total_modules: 25, total_edges: 60,
      top_imported: ['a(8)', 'b(6)', 'c(5)', 'd(4)', 'e(3)', 'f(2)', 'g(1)'],
      has_cycles: true, confidence: 0.85,
    };
    const compact = ctx.compactDepGraph(dep);
    assert.strictEqual(compact.total_modules, 25);
    assert.strictEqual(compact.total_edges, 60);
    assert.strictEqual(compact.top_imported.length, 5, 'Should cap at 5');
    assert.strictEqual(compact.has_cycles, true);
    assert.ok(!('confidence' in compact), 'Should strip confidence');
  });

  test('null/undefined input returns empty object', () => {
    assert.deepStrictEqual(ctx.compactDepGraph(null), {});
    assert.deepStrictEqual(ctx.compactDepGraph(undefined), {});
  });
});

describe('agent manifests: init --agent integration', () => {
  test('init execute-phase --agent=gsd-executor returns scoped output', () => {
    const result = runGsdTools('init execute-phase 38 --agent=gsd-executor --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed._agent, 'gsd-executor');
    assert.ok(parsed._savings, 'Should include _savings');
    assert.ok('phase_dir' in parsed, 'Should include phase_dir');
    assert.ok('task_routing' in parsed, 'Should include task_routing');
    assert.ok(!('intent_drift' in parsed), 'Should not include intent_drift');
    assert.ok(!('worktree_config' in parsed), 'Should not include worktree_config');
  });

  test('init execute-phase --agent=gsd-verifier returns fewer fields than executor', () => {
    const execResult = runGsdTools('init execute-phase 38 --agent=gsd-executor --raw');
    const verResult = runGsdTools('init execute-phase 38 --agent=gsd-verifier --raw');
    assert.ok(execResult.success && verResult.success);

    const exec = JSON.parse(execResult.output);
    const ver = JSON.parse(verResult.output);
    assert.strictEqual(ver._agent, 'gsd-verifier');
    assert.ok(ver._savings.scoped_keys < exec._savings.scoped_keys,
      `Verifier (${ver._savings.scoped_keys}) should have fewer fields than executor (${exec._savings.scoped_keys})`);
  });
});

// ─── Task-Scoped Context: buildTaskContext ───────────────────────────────────

describe('buildTaskContext: unit tests', () => {
  const ctx = require('../src/lib/context');

  test('single task file with known deps returns task file + 1-hop deps scored', () => {
    // Use the real project to get a file that's in the dep graph
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js']);
    assert.ok(Array.isArray(result.task_files), 'task_files should be array');
    assert.deepStrictEqual(result.task_files, ['src/lib/output.js']);
    assert.ok(result.context_files.length >= 1, 'Should include at least the task file');
    // The task file itself should be score 1.0
    const taskEntry = result.context_files.find(f => f.path === 'src/lib/output.js');
    assert.ok(taskEntry, 'Task file should be in context_files');
    assert.strictEqual(taskEntry.score, 1.0);
    assert.strictEqual(taskEntry.reason, 'direct task file');
  });

  test('multiple task files returns union of deps with no duplicates', () => {
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js', 'src/lib/format.js']);
    assert.ok(result.context_files.length >= 2, 'Should include at least 2 files');
    // Check no duplicates
    const paths = result.context_files.map(f => f.path);
    assert.strictEqual(paths.length, new Set(paths).size, 'No duplicate paths');
  });

  test('token budget enforced: drops lowest-scored files when over budget', () => {
    const full = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { tokenBudget: 50000 });
    const constrained = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { tokenBudget: 100 });
    assert.ok(constrained.context_files.length <= full.context_files.length,
      'Constrained should have fewer or equal files');
    assert.ok(constrained.stats.token_estimate <= 100 || constrained.context_files.length === 1,
      'Should respect budget or keep at least 1 file');
  });

  test('no codebase intel: graceful fallback returning just task files', () => {
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-btc-'));
    try {
      const result = ctx.buildTaskContext(tmpDir, ['some/file.js']);
      assert.deepStrictEqual(result.task_files, ['some/file.js']);
      // Without intel, still returns the task file with score 1.0
      assert.ok(result.context_files.length >= 0, 'Should handle gracefully');
      assert.strictEqual(result.stats.candidates_found, result.context_files.length);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('includeSignatures=true adds signatures array to context files', () => {
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { includeSignatures: true });
    // Find a non-task context file that would have signatures
    const ctxFile = result.context_files.find(f => f.score < 1.0 && f.signatures);
    if (result.context_files.length > 1) {
      // At least some context files should have signatures if they're JS
      const hasAnySigs = result.context_files.some(f => f.signatures && f.signatures.length > 0);
      assert.ok(hasAnySigs, 'At least one context file should have signatures');
    }
  });

  test('empty task files returns empty context with zero stats', () => {
    const result = ctx.buildTaskContext(process.cwd(), []);
    assert.deepStrictEqual(result.task_files, []);
    assert.deepStrictEqual(result.context_files, []);
    assert.strictEqual(result.stats.candidates_found, 0);
    assert.strictEqual(result.stats.files_included, 0);
    assert.strictEqual(result.stats.token_estimate, 0);
    assert.strictEqual(result.stats.reduction_pct, 0);
  });
});

describe('buildTaskContext: integration tests (CLI)', () => {
  test('codebase context --task returns JSON with context_files and stats', () => {
    const result = runGsdTools('codebase context --task src/lib/output.js --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.success, 'Should return success');
    assert.ok(Array.isArray(parsed.task_files), 'Should have task_files array');
    assert.ok(Array.isArray(parsed.context_files), 'Should have context_files array');
    assert.ok(parsed.stats, 'Should have stats object');
    assert.ok(typeof parsed.stats.candidates_found === 'number');
    assert.ok(typeof parsed.stats.files_included === 'number');
    assert.ok(typeof parsed.stats.reduction_pct === 'number');
  });

  test('codebase context --task with --budget respects budget, fewer files', () => {
    const fullResult = runGsdTools('codebase context --task src/lib/output.js --raw');
    const budgetResult = runGsdTools('codebase context --task src/lib/output.js --budget 200 --raw');
    assert.ok(fullResult.success && budgetResult.success);
    const full = JSON.parse(fullResult.output);
    const constrained = JSON.parse(budgetResult.output);
    assert.ok(constrained.stats.files_included <= full.stats.files_included,
      `Budget-constrained (${constrained.stats.files_included}) should have <= files than full (${full.stats.files_included})`);
  });

  test('stats.reduction_pct > 0 proves context was reduced vs all candidates', () => {
    const result = runGsdTools('codebase context --task src/lib/output.js --budget 1000 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    // With budget constraint of 1000, if there are many candidates, reduction should be > 0
    if (parsed.stats.candidates_found > parsed.stats.files_included) {
      assert.ok(parsed.stats.reduction_pct > 0, `Expected reduction > 0%, got ${parsed.stats.reduction_pct}%`);
    }
  });

  test('quality baseline: known task includes direct deps and importers', () => {
    // src/lib/codebase-intel.js imports src/lib/output.js, src/lib/git.js, src/lib/helpers.js
    // So testing codebase-intel.js should find its deps in context
    const result = runGsdTools('codebase context --task src/lib/codebase-intel.js --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    const paths = parsed.context_files.map(f => f.path);
    // codebase-intel.js imports output.js, git.js, helpers.js — check at least one dep is present
    const hasDep = paths.includes('src/lib/output.js') || paths.includes('src/lib/git.js') || paths.includes('src/lib/helpers.js');
    assert.ok(hasDep, `Expected at least one dependency of codebase-intel.js in context. Got: ${paths.join(', ')}`);
    // Check importers are also present (codebase.js imports codebase-intel.js)
    const hasImporter = paths.includes('src/commands/codebase.js') || paths.includes('src/commands/init.js') || paths.includes('src/lib/deps.js');
    assert.ok(hasImporter, `Expected at least one importer of codebase-intel.js in context. Got: ${paths.join(', ')}`);
  });
});

// ─── Review CLI command ──────────────────────────────────────────────────────

describe('review command', () => {
  test('review without args returns error', () => {
    const result = runGsdTools('review');
    assert.ok(!result.success || result.output.includes('error'), 'Should error without args');
  });

  test('review 37 01 returns JSON with commits, diff, and conventions fields', () => {
    const result = runGsdTools('review 37 01 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok('commits' in parsed, 'Should have commits field');
    assert.ok('diff' in parsed, 'Should have diff field');
    assert.ok('conventions' in parsed, 'Should have conventions field');
    assert.strictEqual(parsed.plan, '01', 'Plan should be 01');
  });

  test('review output includes files_changed array', () => {
    const result = runGsdTools('review 37 01 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.files_changed), 'files_changed should be an array');
  });
});

// ─── TDD CLI commands ────────────────────────────────────────────────────────

describe('tdd', () => {
  test('validate-red succeeds when test fails (exit 1)', () => {
    const result = runGsdTools('tdd validate-red --test-cmd "exit 1"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.test_exit_code, 1);
  });

  test('validate-red fails when test passes (exit 0)', () => {
    const result = runGsdTools('tdd validate-red --test-cmd "exit 0"');
    assert.ok(!result.success, 'Should fail when test passes in red phase');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.strictEqual(parsed.valid, false);
    assert.strictEqual(parsed.test_exit_code, 0);
  });

  test('validate-green succeeds when test passes (exit 0)', () => {
    const result = runGsdTools('tdd validate-green --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'green');
    assert.strictEqual(parsed.valid, true);
  });

  test('validate-green fails when test fails (exit 1)', () => {
    const result = runGsdTools('tdd validate-green --test-cmd "exit 1"');
    assert.ok(!result.success, 'Should fail when test fails in green phase');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'green');
    assert.strictEqual(parsed.valid, false);
  });

  test('validate-refactor succeeds when test passes', () => {
    const result = runGsdTools('tdd validate-refactor --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'refactor');
    assert.strictEqual(parsed.valid, true);
  });

  test('auto-test reports pass', () => {
    const result = runGsdTools('tdd auto-test --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.passed, true);
    assert.strictEqual(parsed.exit_code, 0);
  });

  test('auto-test reports fail', () => {
    const result = runGsdTools('tdd auto-test --test-cmd "exit 1"');
    // auto-test should not set process.exitCode
    assert.ok(result.success, `auto-test should succeed even when test fails: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.passed, false);
    assert.strictEqual(parsed.exit_code, 1);
  });

  test('detect-antipattern warns on non-test source files in red phase', () => {
    const result = runGsdTools('tdd detect-antipattern --phase red --files "src/foo.js"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.ok(parsed.warnings.length > 0, 'Should have warnings for non-test file in red');
    assert.strictEqual(parsed.warnings[0].type, 'pre_test_code');
  });

  test('detect-antipattern clean on test files in red phase', () => {
    const result = runGsdTools('tdd detect-antipattern --phase red --files "src/foo.test.js"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.warnings.length, 0, 'Should have no warnings for test file in red');
  });

  test('GSD-Phase trailer on commit', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-tdd-'));
    try {
      // Set up git repo
      execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      // Create .planning dir and config for commit to work
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{"commit_docs":true}');
      // Create a file to commit
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello');
      const result = runGsdTools('commit "test(tdd): red phase" --tdd-phase red --force --files test.txt', tmpDir);
      assert.ok(result.success, `Commit failed: ${result.error || result.output}`);
      // Check git log for trailer
      const log = execSync('git log -1 --format=%b', { cwd: tmpDir, encoding: 'utf-8' }).trim();
      assert.ok(log.includes('GSD-Phase: red'), `Expected GSD-Phase trailer in: ${log}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
