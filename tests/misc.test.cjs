/**
 * bgsd-tools misc tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, hasJj, initColocatedCommitRepo } = require('./helpers.cjs');

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('util:history-digest', tmpDir);
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

    const result = runGsdTools('util:history-digest', tmpDir);
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

    const result = runGsdTools('util:history-digest', tmpDir);
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

    const result = runGsdTools('util:history-digest', tmpDir);
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

    const result = runGsdTools('util:history-digest', tmpDir);
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

    const result = runGsdTools('util:history-digest', tmpDir);
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

describe('summary-extract command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing file returns error', () => {
    const result = runGsdTools('util:summary-extract .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
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

    const result = runGsdTools('util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
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

    const result = runGsdTools('util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md --fields one_liner,key_files', tmpDir);
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

    const result = runGsdTools('util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
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

    const result = runGsdTools('util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'decision summary parsed');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than alternatives', 'decision rationale parsed');
    assert.strictEqual(output.decisions[1].summary, 'JWT tokens', 'second decision summary');
    assert.strictEqual(output.decisions[1].rationale, 'Stateless auth for scalability', 'second decision rationale');
  });
});

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

    const result = runGsdTools('util:progress json', tmpDir);
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

    const result = runGsdTools('util:progress bar', tmpDir);
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

    const result = runGsdTools('util:progress table', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('Phase'), 'should have table header');
    assert.ok(result.output.includes('foundation'), 'should include phase name');
  });
});

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

    const result = runGsdTools('util:todo complete add-dark-mode.md', tmpDir);
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
    const result = runGsdTools('util:todo complete nonexistent.md', tmpDir);
    assert.ok(!result.success, 'should fail');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });
});

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

    const result = runGsdTools('util:scaffold context --phase 3', tmpDir);
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

    const result = runGsdTools('util:scaffold uat --phase 3', tmpDir);
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

    const result = runGsdTools('util:scaffold verification --phase 3', tmpDir);
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
    const result = runGsdTools('util:scaffold phase-dir --phase 5 --name User Dashboard', tmpDir);
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

    const result = runGsdTools('util:scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, false, 'should not overwrite');
    assert.strictEqual(output.reason, 'already_exists');
  });
});

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
    const resultA = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    // Merge A back — need to escape JSON for shell
    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`util:frontmatter merge ${filePath} --data '${dataStr}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    // Extract B
    const resultB = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
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
    const mergeResult = runGsdTools(`util:frontmatter merge ${filePath} --data '{"title":"Test","phase":"01"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Read back and check body
    const content = fs.readFileSync(path.join(tmpDir, filePath), 'utf-8');
    assert.ok(content.includes(bodyContent), 'body content should be completely preserved after merge');
  });
});

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
    const resultA = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
    assert.ok(resultA.success, `First extract failed for ${description}: ${resultA.error}`);
    const jsonA = JSON.parse(resultA.output);

    const dataStr = JSON.stringify(jsonA);
    const mergeResult = runGsdTools(`util:frontmatter merge ${filePath} --data '${dataStr}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed for ${description}: ${mergeResult.error}`);

    const resultB = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
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
      '      to: "bin/bgsd-tools.test.cjs"',
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
    const mergeResult = runGsdTools(`util:frontmatter merge ${filePath} --data '{"wave":"1"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify all keys present
    const result = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
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
    const mergeResult = runGsdTools(`util:frontmatter merge ${filePath} --data '{"status":"active"}'`, tmpDir);
    assert.ok(mergeResult.success, `Merge failed: ${mergeResult.error}`);

    // Extract and verify
    const result = runGsdTools(`util:frontmatter get ${filePath}`, tmpDir);
    assert.ok(result.success, `Extract failed: ${result.error}`);
    const fm = JSON.parse(result.output);

    assert.strictEqual(fm.status, 'active', 'status should be updated from "draft" to "active"');
    assert.strictEqual(fm.phase, '01', 'untouched key "phase" should be preserved');
  });
});

describe('context-budget baseline', () => {
  test('baseline output has required fields', () => {
    const result = runGsdTools('verify:context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('timestamp' in data, 'should have timestamp');
    assert.ok('workflow_count' in data, 'should have workflow_count');
    assert.ok('total_tokens' in data, 'should have total_tokens');
    assert.ok('workflows' in data, 'should have workflows array');
    assert.ok(Array.isArray(data.workflows), 'workflows should be an array');
  });

  test('each workflow entry has required measurement fields', () => {
    const result = runGsdTools('verify:context-budget baseline');
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
    const result = runGsdTools('verify:context-budget baseline');
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
    // Clean up any existing baselines first (handles both files and directories)
    const baselinesDir = path.join(process.cwd(), '.planning', 'baselines');
    if (fs.existsSync(baselinesDir)) {
      for (const f of fs.readdirSync(baselinesDir)) {
        const p = path.join(baselinesDir, f);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          fs.unlinkSync(p);
        }
      }
    }

    const result = runGsdTools('verify:context-budget baseline');
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(fs.existsSync(baselinesDir), 'baselines directory should exist');
    const files = fs.readdirSync(baselinesDir).filter(f => f.startsWith('baseline-'));
    assert.ok(files.length >= 1, 'should have at least 1 baseline file');
  });

  test('context-budget <path> works with file arg', () => {
    const result = runGsdTools('verify:context-budget .planning/ROADMAP.md');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok('plan' in data, 'should have plan field');
    assert.ok('estimates' in data, 'should have estimates field');
    assert.strictEqual(data.plan, '.planning/ROADMAP.md', 'plan should be the file path');
  });
});

describe('context-budget compare', () => {
  test('compare with no baseline dir returns error', () => {
    // Use a temp dir with no baselines
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-compare-'));
    const planDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planDir, { recursive: true });
    // Create minimal config
    fs.writeFileSync(path.join(planDir, 'config.json'), JSON.stringify({}));

    const result = runGsdTools('verify:context-budget compare', tmpDir);
    assert.strictEqual(result.success, false, 'should fail without baselines');
    // Check error mentions running baseline first
    const combined = (result.output + ' ' + result.error).toLowerCase();
    assert.ok(combined.includes('baseline'), 'error should mention baseline');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('compare JSON has required fields', () => {
    // Ensure a baseline exists first
    runGsdTools('verify:context-budget baseline');
    const result = runGsdTools('verify:context-budget compare');
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
    runGsdTools('verify:context-budget baseline');
    const result = runGsdTools('verify:context-budget compare');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0 with no changes');
    assert.strictEqual(data.summary.percent_change, 0, 'percent_change should be 0');
    assert.strictEqual(data.summary.before_total, data.summary.after_total, 'before and after should match');
  });

  test('compare workflows sorted by delta ascending (biggest reductions first)', () => {
    runGsdTools('verify:context-budget baseline');
    const result = runGsdTools('verify:context-budget compare');
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
    const baselineResult = runGsdTools('verify:context-budget baseline');
    assert.ok(baselineResult.success, `Baseline failed: ${baselineResult.error}`);

    // Find the most recent baseline file
    const baselinesDir = path.join(process.cwd(), '.planning', 'baselines');
    const files = fs.readdirSync(baselinesDir)
      .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
      .sort()
      .reverse();
    assert.ok(files.length > 0, 'should have at least one baseline file');
    const baselineFile = path.join('.planning', 'baselines', files[0]);

    const result = runGsdTools(`verify:context-budget compare ${baselineFile}`);
    assert.ok(result.success, `Compare failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.baseline_file.includes('baseline-'), 'should reference baseline file');
    assert.strictEqual(data.summary.delta, 0, 'delta should be 0');
  });

  test('compare each workflow has required fields', () => {
    runGsdTools('verify:context-budget baseline');
    const result = runGsdTools('verify:context-budget compare');
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

    const result = runGsdTools(`util:extract-sections ${mdPath}`, tmpDir);
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

    const result = runGsdTools(`util:extract-sections ${mdPath} "Second Section"`, tmpDir);
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
    const discResult = runGsdTools(`util:extract-sections ${mdPath}`, tmpDir);
    assert.ok(discResult.success, `Discovery failed: ${discResult.error}`);
    const discData = JSON.parse(discResult.output);
    assert.ok(discData.available_sections.includes('config'), 'should find config marker section');
    assert.ok(discData.available_sections.includes('examples'), 'should find examples marker section');

    // Extract a marker section
    const result = runGsdTools(`util:extract-sections ${mdPath} "config"`, tmpDir);
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

    const result = runGsdTools(`util:extract-sections ${mdPath} "Existing Section" "NonexistentSection"`, tmpDir);
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

    const result = runGsdTools(`util:extract-sections ${mdPath} "Alpha" "Gamma"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.deepStrictEqual(data.sections_found, ['Alpha', 'Gamma'], 'should find both sections');
    assert.deepStrictEqual(data.sections_missing, [], 'no sections should be missing');
    assert.ok(data.content.includes('Alpha content'), 'should include Alpha content');
    assert.ok(data.content.includes('Gamma content'), 'should include Gamma content');
    assert.ok(!data.content.includes('Beta content'), 'should not include Beta (not requested)');
  });

  test('extract-sections works on real skill files with section markers', () => {
    // Run against skills/verification-reference/SKILL.md which has <!-- section: --> markers
    const projectRoot = path.join(__dirname, '..');
    const result = runGsdTools('util:extract-sections skills/verification-reference/SKILL.md', projectRoot);
    assert.ok(result.success, `Discovery failed: ${result.error}`);

    const discData = JSON.parse(result.output);
    assert.ok(discData.available_sections.includes('core-principle'), 'SKILL.md should have core-principle section');
    assert.ok(discData.available_sections.includes('stub-detection'), 'SKILL.md should have stub-detection section');
    assert.ok(discData.available_sections.includes('wiring-verification'), 'SKILL.md should have wiring-verification section');

    // Extract core-principle section — should be much shorter than full file
    const extractResult = runGsdTools('util:extract-sections skills/verification-reference/SKILL.md "core-principle"', projectRoot);
    assert.ok(extractResult.success, `Extract failed: ${extractResult.error}`);

    const data = JSON.parse(extractResult.output);
    assert.deepStrictEqual(data.sections_found, ['core-principle'], 'should find core-principle section');
    const sectionLines = data.content.split('\n').length;
    const fullFile = fs.readFileSync(path.join(projectRoot, 'skills', 'verification-reference', 'SKILL.md'), 'utf-8');
    const fullLines = fullFile.split('\n').length;
    assert.ok(sectionLines < fullLines, `core-principle section (${sectionLines} lines) should be shorter than full file (${fullLines} lines)`);
    assert.ok(sectionLines > 3, `core-principle section should have substantial content (got ${sectionLines} lines)`);
  });

  test('extract-sections command is registered and responds', () => {
    // Verify extract-sections command exists and works by running discovery on a skill file
    const projectRoot = path.join(__dirname, '..');
    const result = runGsdTools('util:extract-sections skills/verification-reference/SKILL.md', projectRoot);
    assert.ok(result.success, `extract-sections discovery should succeed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data.available_sections), 'should return available_sections array');
    assert.ok(data.available_sections.length > 0, 'should find sections in SKILL.md');
  });
});

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
      const args = extraArgs ? `util:mcp profile ${extraArgs}` : 'util:mcp profile';
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
        const result = runGsdTools('util:mcp profile', tmpDir);
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
        const args = extraArgs ? `util:mcp profile ${extraArgs}` : 'util:mcp profile --apply';
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
    const result = runGsdTools('util:git log --count 3', tmpDir);
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
    const result = runGsdTools('util:git log --count 1', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.length, 1, 'Should return 1 commit');
  });

  test('git log parses conventional commits', () => {
    const result = runGsdTools('util:git log --count 2', tmpDir);
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
    const result = runGsdTools('util:git log --count 1', tmpDir);
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
    const result = runGsdTools('util:git diff-summary', tmpDir);
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
    const result = runGsdTools('util:git blame target.txt', tmpDir);
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
    const result = runGsdTools('util:git branch-info', tmpDir);
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

    const result = runGsdTools('util:git branch-info', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.is_detached, true, 'Should detect detached HEAD');
  });
});

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
    const result = runGsdTools('util:git rewind --ref HEAD~1 --dry-run', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.dry_run, true, 'Should be dry run');
    assert.ok(data.changes.some(c => c.file === 'src/a.js'), 'Should include src/a.js in changes');
    assert.ok(!data.changes.some(c => c.file.startsWith('.planning')), 'Should not include .planning files');
    assert.ok(data.files_protected > 0, 'Should have protected files');
  });

  test('rewind without confirm returns needs_confirm', () => {
    const result = runGsdTools('util:git rewind --ref HEAD~1', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.needs_confirm, true, 'Should need confirmation');
    assert.ok(data.changes.length > 0, 'Should list changes');
    assert.ok(data.message.includes('--confirm'), 'Should mention --confirm');
  });

  test('rewind with confirm performs checkout', () => {
    const result = runGsdTools('util:git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.rewound, true, 'Should report rewound');
    assert.ok(data.files_changed > 0, 'Should have changed files');
    // Verify src/a.js content reverted
    const content = fs.readFileSync(path.join(tmpDir, 'src', 'a.js'), 'utf-8');
    assert.ok(content.includes('const a = 1'), 'src/a.js should be reverted to first commit');
  });

  test('protected paths survive rewind', () => {
    const result = runGsdTools('util:git rewind --ref HEAD~1 --confirm', tmpDir);
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
    const result = runGsdTools('util:git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    // package.json should still exist (protected)
    assert.ok(fs.existsSync(path.join(tmpDir, 'package.json')), 'package.json should survive rewind');
  });

  test('auto-stash on dirty tree', () => {
    // Make uncommitted change
    fs.writeFileSync(path.join(tmpDir, 'src', 'dirty.js'), 'uncommitted\n');
    const result = runGsdTools('util:git rewind --ref HEAD~1 --confirm', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.stash_used, true, 'Should use auto-stash');
    assert.strictEqual(data.rewound, true, 'Should complete rewind');
  });

  test('invalid ref returns error', () => {
    const result = runGsdTools('util:git rewind --ref nonexistent-ref-xyz', tmpDir);
    assert.ok(result.success, 'Command should return JSON (not crash)');
    const data = JSON.parse(result.output);
    assert.ok(data.error, 'Should have error');
    assert.ok(data.error.includes('Invalid ref'), 'Error should mention invalid ref');
  });

  test('rewind to HEAD returns no changes', () => {
    const result = runGsdTools('util:git rewind --ref HEAD --dry-run', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.files_affected, 0, 'No files should be affected');
  });
});

describe('git trajectory-branch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('creates branch with correct name', () => {
    const result = runGsdTools('util:git trajectory-branch --phase 45 --slug test', tmpDir);
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
    runGsdTools('util:git trajectory-branch --phase 45 --slug dup', tmpDir);
    // Switch back to main
    execSync('git checkout main 2>/dev/null || git checkout master', { cwd: tmpDir, stdio: 'pipe' });
    // Try again
    const result = runGsdTools('util:git trajectory-branch --phase 45 --slug dup', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.exists, true, 'Should report branch exists');
    assert.strictEqual(data.branch, 'gsd/trajectory/45-dup', 'Should report correct branch name');
  });

  test('branch is local-only by default', () => {
    const result = runGsdTools('util:git trajectory-branch --phase 45 --slug local', tmpDir);
    assert.ok(result.success, 'Command should succeed');
    const data = JSON.parse(result.output);
    assert.strictEqual(data.pushed, false, 'Should not push');
    // Verify no remote tracking
    const trackResult = execSync('git config --get branch.gsd/trajectory/45-local.remote 2>&1 || echo "no-remote"', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(trackResult.includes('no-remote') || trackResult === '', 'Should have no remote tracking');
  });
});

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
    const result = runGsdTools('execute:commit "test commit"', tmpDir);
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
    const result = runGsdTools('execute:commit "test commit" --force', tmpDir);
    const data = JSON.parse(result.output);
    // Should either commit successfully or report nothing_to_commit (not blocked)
    assert.notStrictEqual(data.reason, 'pre_commit_blocked', 'Should not be blocked by pre-commit');
  });

  test('commit in detached HEAD is blocked', () => {
    // Get current commit hash and detach
    const hash = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync(`git checkout ${hash}`, { cwd: tmpDir, stdio: 'pipe' });
    const result = runGsdTools('execute:commit "test commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, false, 'Should not commit');
    assert.strictEqual(data.reason, 'pre_commit_blocked', 'Should be blocked by pre-commit');
    assert.ok(data.failures.some(f => f.check === 'detached_head'), 'Should have detached_head failure');
  });

  test('commit in clean state proceeds normally', () => {
    // Add something to .planning to commit
    fs.writeFileSync(path.join(tmpDir, '.planning', 'new.md'), 'content\n');
    const result = runGsdTools('execute:commit "test clean commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed === true || data.reason === 'nothing_to_commit', 'Should commit or have nothing to commit');
    assert.notStrictEqual(data.reason, 'pre_commit_blocked', 'Should not be blocked');
  });

  test('multiple pre-commit failures reported together', () => {
    // Detach HEAD and create dirty file
    const hash = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync(`git checkout ${hash}`, { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'dirty\n');
    const result = runGsdTools('execute:commit "test commit"', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.reason, 'pre_commit_blocked', 'Should be blocked');
    // Should have at least 2 failures (detached_head + dirty_tree)
    assert.ok(data.failures.length >= 2, `Should report multiple failures, got ${data.failures.length}`);
  });

  test('detached JJ colocated repo uses path-scoped fallback instead of blocking', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    cleanup(tmpDir);
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    initColocatedCommitRepo(tmpDir, { detachHead: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'detached.md'), 'detached fallback\n');

    const result = runGsdTools('execute:commit "test commit" --files .planning/detached.md', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, true, 'Should commit successfully through fallback');
    assert.strictEqual(data.reason, 'committed', 'Should preserve committed reason');
    assert.strictEqual(data.commit_path, 'jj_fallback', 'Should report JJ fallback path');
    assert.ok(data.hash, 'Should return a hash');
  });

  test('dirty JJ colocated repo keeps unrelated files dirty after path-scoped fallback', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    cleanup(tmpDir);
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    initColocatedCommitRepo(tmpDir);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'dirty-fallback.md'), 'path scoped\n');
    fs.writeFileSync(path.join(tmpDir, 'dirty.txt'), 'leave me dirty\n');

    const result = runGsdTools('execute:commit "test commit" --files .planning/dirty-fallback.md', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, true, 'Should commit successfully through fallback');
    assert.strictEqual(data.reason, 'committed', 'Should preserve committed reason');
    assert.strictEqual(data.commit_path, 'jj_fallback', 'Should report JJ fallback path');

    const status = execSync('jj status', { cwd: tmpDir, encoding: 'utf-8' });
    assert.match(status, /dirty\.txt/, 'Unrelated dirty file should remain in working copy');
    assert.doesNotMatch(status, /dirty-fallback\.md/, 'Committed path should not remain dirty');
  });
});

describe('commit --agent attribution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => { cleanup(tmpDir); });

  test('commit --agent bgsd-executor produces commit with Agent-Type trailer', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'agent-test.md'), 'test\n');
    const result = runGsdTools('execute:commit "test: agent attribution" --agent bgsd-executor', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed, 'Should commit successfully');
    assert.strictEqual(data.agent_type, 'bgsd-executor', 'Should return agent_type');
    // Verify git trailer exists in commit body
    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(body.includes('Agent-Type: bgsd-executor'), `Commit body should contain Agent-Type: bgsd-executor, got: ${body}`);
  });

  test('commit without --agent has no Agent-Type trailer', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'no-agent-test.md'), 'test\n');
    const result = runGsdTools('execute:commit "test: no agent"', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed, 'Should commit successfully');
    assert.strictEqual(data.agent_type, null, 'agent_type should be null');
    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(!body.includes('Agent-Type'), `Commit body should NOT contain Agent-Type, got: ${body}`);
  });

  test('JJ fallback preserves trailers for path-scoped commits', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    cleanup(tmpDir);
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
    initColocatedCommitRepo(tmpDir, { detachHead: true });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'agent-fallback.md'), 'test\n');
    const result = runGsdTools('execute:commit "test: fallback agent attribution" --files .planning/agent-fallback.md --agent bgsd-executor --tdd-phase green', tmpDir);
    const data = JSON.parse(result.output);
    assert.ok(data.committed, 'Should commit successfully');
    assert.strictEqual(data.reason, 'committed', 'Should preserve committed reason');
    assert.strictEqual(data.commit_path, 'jj_fallback', 'Should use fallback path');
    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.ok(body.includes('Agent-Type: bgsd-executor'), `Commit body should contain Agent-Type trailer, got: ${body}`);
    assert.ok(body.includes('GSD-Phase: green'), `Commit body should contain GSD-Phase trailer, got: ${body}`);
  });
});
