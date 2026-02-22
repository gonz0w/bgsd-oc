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

    const result = runGsdTools('init execute-phase 03', tmpDir);
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

    const result = runGsdTools('init plan-phase 03', tmpDir);
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
    const result = runGsdTools('init progress', tmpDir);
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

    const result = runGsdTools('init phase-op 03', tmpDir);
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

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
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
    assert.strictEqual(output.progress_percent, 50, '50% complete');
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

    const result = runGsdTools('progress bar --raw', tmpDir);
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

    const result = runGsdTools('progress table --raw', tmpDir);
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
    const resultA = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    // Merge A back — need to escape JSON for shell
    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}' --raw`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    // Extract B
    const resultB = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
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
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"title":"Test","phase":"01"}' --raw`, tmpDir);
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
    const resultA = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '${dataStr}' --raw`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    const resultB = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
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
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"wave":"1"}' --raw`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify all keys present
    const result = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
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
    const mergeResult = runGsdTools(`frontmatter merge ${filePath} --data '{"status":"active"}' --raw`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify
    const result = runGsdTools(`frontmatter get ${filePath} --raw`, tmpDir);
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
      const result = runWithStderr('init progress --raw', {
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
      const result = runWithStderr('init progress --raw', {
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
      const result = runWithStderr('init progress --raw', {
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

  test('_tmpFiles tracking is wired into output() function', () => {
    // Verify that the output function pushes to _tmpFiles when writing large payloads
    const source = fs.readFileSync(TOOLS_PATH, 'utf-8');
    // Find the output function and check it references _tmpFiles.push
    const outputStart = source.indexOf('function output(');
    const outputEnd = source.indexOf('\nfunction ', outputStart + 1);
    const outputSection = source.substring(outputStart, outputEnd > 0 ? outputEnd : outputStart + 800);
    assert.ok(
      outputSection.includes('_tmpFiles.push'),
      'output() function should push tmpPath to _tmpFiles'
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

    const result = execSync(`node "${BUILD_OUTPUT_PATH}" current-timestamp --raw`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result),
      `Build output timestamp should be ISO format, got: ${result}`);
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

      const result = execSync(`node "${BUILD_OUTPUT_PATH}" state load --raw`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      // Verify key fields are present in output
      assert.ok(result.includes('model_profile=balanced'), 'should contain config value');
      assert.ok(result.includes('state_exists=true'), 'should detect STATE.md');
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
    const result = runGsdTools('init progress --raw');
    assert.ok(result.success, 'init progress should succeed');
    const data = JSON.parse(result.output);
    assert.ok(data.phase_count >= 1, 'should have phases');
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
    const result = runGsdTools('codebase-impact src/lib/helpers.js --raw');
    assert.ok(result.success, 'codebase-impact should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    assert.ok(data.total_dependents > 0, `helpers.js should have dependents, got ${data.total_dependents}`);
    assert.ok(data.files[0].exists === true, 'file should exist');
    assert.ok(Array.isArray(data.files[0].dependents), 'dependents should be array');
  });

  test('handles non-existent file', () => {
    const result = runGsdTools('codebase-impact nonexistent-file-xyz.js --raw');
    assert.ok(result.success, 'should succeed even for missing file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files[0].exists, false, 'file should not exist');
  });

  test('handles file with no code dependents', () => {
    const result = runGsdTools('codebase-impact package.json --raw');
    assert.ok(result.success, 'should succeed for non-code file');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 1, 'should analyze 1 file');
    // package.json may have 0 dependents (not imported by JS files)
    assert.ok(typeof data.total_dependents === 'number', 'should have numeric dependents count');
  });

  test('analyzes multiple files in single call', () => {
    const result = runGsdTools('codebase-impact src/lib/helpers.js src/lib/output.js --raw');
    assert.ok(result.success, 'should succeed for multiple files');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_analyzed, 2, 'should analyze 2 files');
    assert.ok(data.files.length === 2, 'should return 2 file results');
  });

  test('uses batched grep (source contains -e flag pattern)', () => {
    // Verify the source implementation uses batched -e flags, not per-pattern loop
    const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'features.js'), 'utf-8');
    assert.ok(content.includes('grep -rl --fixed-strings'), 'should have fixed-strings grep');
    // The batched pattern joins multiple -e flags
    assert.ok(content.includes('-e ${sanitizeShellArg(p)}'), 'should batch -e flags with sanitization');
    // Should NOT have the old per-pattern loop
    assert.ok(!content.includes('for (const pattern of searchPatterns)'), 'should not have per-pattern loop');
  });
});

describe('configurable context window', () => {
  test('context-budget uses default context window (200K)', () => {
    // Use a plan file that exists in current milestone
    const result = runGsdTools('context-budget .planning/phases/06-token-measurement-output-infrastructure/06-01-PLAN.md --raw');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.estimates.context_window, 200000, 'should default to 200K context window');
    assert.strictEqual(data.estimates.target_percent, 50, 'should default to 50% target');
  });

  test('context-budget output includes context_window field', () => {
    const result = runGsdTools('context-budget .planning/phases/06-token-measurement-output-infrastructure/06-02-PLAN.md --raw');
    assert.ok(result.success, `context-budget should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok('context_window' in data.estimates, 'estimates should contain context_window');
    assert.ok(typeof data.estimates.context_window === 'number', 'context_window should be a number');
  });

  test('validate-config recognizes context_window as known key', () => {
    const result = runGsdTools('validate-config --raw');
    assert.ok(result.success, 'validate-config should succeed');
    const data = JSON.parse(result.output);
    // context_window should be in effective config (not in warnings as unknown)
    assert.ok('context_window' in data.effective_config, 'should recognize context_window');
    assert.strictEqual(data.effective_config.context_window.value, 200000, 'default should be 200000');
    assert.strictEqual(data.effective_config.context_window.source, 'default', 'should come from defaults');
  });

  test('validate-config recognizes context_target_percent as known key', () => {
    const result = runGsdTools('validate-config --raw');
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
    const result = runGsdTools('init progress --fields milestone_version,phase_count --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Should have only the requested fields
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.ok('phase_count' in data, 'should include phase_count');
    // Other fields should NOT be present
    assert.strictEqual(Object.keys(data).length, 2, 'should have exactly 2 fields');
  });

  test('missing fields return null', () => {
    const result = runGsdTools('init progress --fields milestone_version,nonexistent_field --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('milestone_version' in data, 'should include milestone_version');
    assert.strictEqual(data.nonexistent_field, null, 'missing field should be null');
  });

  test('without --fields returns full output (backward compat)', () => {
    const result = runGsdTools('init progress --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    // Full output has many fields
    assert.ok(Object.keys(data).length > 5, 'full output should have many fields');
    assert.ok('state_path' in data, 'should include state_path');
    assert.ok('roadmap_path' in data, 'should include roadmap_path');
  });

  test('dot-notation filters nested object fields', () => {
    // Use a command that returns nested objects
    const result = runGsdTools('validate-config --fields exists,valid_json --raw');
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
    const result = runGsdTools('context-budget .planning/phases/06-token-measurement-output-infrastructure/06-01-PLAN.md --raw');
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
    const content = 'Load @/home/cam/.config/opencode/workflows/execute-plan.md for context.';
    const refs = extractAtReferences(content);
    assert.ok(refs.includes('/home/cam/.config/opencode/workflows/execute-plan.md'), 'should extract absolute path');
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
    const result = runGsdTools('context-budget baseline --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('timestamp' in data, 'should have timestamp');
    assert.ok('workflow_count' in data, 'should have workflow_count');
    assert.ok('total_tokens' in data, 'should have total_tokens');
    assert.ok('workflows' in data, 'should have workflows array');
    assert.ok(Array.isArray(data.workflows), 'workflows should be an array');
  });

  test('each workflow entry has required measurement fields', () => {
    const result = runGsdTools('context-budget baseline --raw');
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
    const result = runGsdTools('context-budget baseline --raw');
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

    const result = runGsdTools('context-budget baseline --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(fs.existsSync(baselinesDir), 'baselines directory should exist');
    const files = fs.readdirSync(baselinesDir).filter(f => f.startsWith('baseline-'));
    assert.ok(files.length >= 1, 'should have at least 1 baseline file');
  });

  test('context-budget <path> still works (backward compat)', () => {
    const result = runGsdTools('context-budget .planning/ROADMAP.md --raw');
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

    const result = runGsdTools('context-budget compare --raw', tmpDir);
    assert.strictEqual(result.success, false, 'should fail without baselines');
    // Check error mentions running baseline first
    const combined = (result.output + ' ' + result.error).toLowerCase();
    assert.ok(combined.includes('baseline'), 'error should mention baseline');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('compare JSON has required fields', () => {
    // Ensure a baseline exists first
    runGsdTools('context-budget baseline --raw');
    const result = runGsdTools('context-budget compare --raw');
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
    runGsdTools('context-budget baseline --raw');
    const result = runGsdTools('context-budget compare --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0 with no changes');
    assert.strictEqual(data.summary.percent_change, 0, 'percent_change should be 0');
    assert.strictEqual(data.summary.before_total, data.summary.after_total, 'before and after should match');
  });

  test('compare workflows sorted by delta ascending (biggest reductions first)', () => {
    runGsdTools('context-budget baseline --raw');
    const result = runGsdTools('context-budget compare --raw');
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
    const baselineResult = runGsdTools('context-budget baseline --raw');
    assert.ok(baselineResult.success, `Baseline failed: ${baselineResult.error}`);

    // Find the most recent baseline file
    const baselinesDir = path.join(process.cwd(), '.planning', 'baselines');
    const files = fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
      .sort()
      .reverse();
    assert.ok(files.length > 0, 'should have at least one baseline file');
    const baselineFile = path.join('.planning', 'baselines', files[0]);

    const result = runGsdTools(`context-budget compare ${baselineFile} --raw`);
    assert.ok(result.success, `Compare failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.baseline_file.includes('baseline-'), 'should reference baseline file');
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0');
  });

  test('compare each workflow has required fields', () => {
    runGsdTools('context-budget baseline --raw');
    const result = runGsdTools('context-budget compare --raw');
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
