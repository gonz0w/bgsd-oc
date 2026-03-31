/**
 * bgsd-tools memory tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');
const { getDb, closeAll, MapDatabase } = require('../src/lib/db');
const { PlanningCache } = require('../src/lib/planning-cache');
const { createMilestoneLessonSnapshot, deriveLessonRemediationBuckets } = require('../src/commands/lessons');

describe('memory commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('memory list returns empty when no memory dir', () => {
    const result = runGsdTools('util:memory list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.stores, [], 'stores should be empty array');
    assert.ok(output.memory_dir, 'should include memory_dir path');
  });

  test('memory write creates directory and file', () => {
    const entry = JSON.stringify({ summary: 'Test decision', phase: '03' });
    const result = runGsdTools(`util:memory write --store decisions --entry '${entry}'`, tmpDir);
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
    runGsdTools(`util:memory write --store lessons --entry '${entry1}'`, tmpDir);

    // Write second entry
    const entry2 = JSON.stringify({ summary: 'Second' });
    const result = runGsdTools(`util:memory write --store lessons --entry '${entry2}'`, tmpDir);
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
    const result = runGsdTools('util:memory read --store decisions', tmpDir);
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

    const result = runGsdTools('util:memory read --store decisions --query esbuild', tmpDir);
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

    const result = runGsdTools('util:memory read --store lessons --phase 03', tmpDir);
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

    const result = runGsdTools('util:memory read --store todos --limit 3', tmpDir);
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
      runGsdTools(`util:memory write --store bookmarks --entry '${JSON.stringify({ file: `new-${i}.js` })}'`, tmpDir);
    }

    const result = runGsdTools('util:memory read --store bookmarks', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.total, 20, 'bookmarks should be capped at 20');
    // Newest should be first
    assert.strictEqual(output.entries[0].file, 'new-2.js', 'newest bookmark should be first');
  });

  test('decisions store never prunes (write 30, read back all 30)', () => {
    for (let i = 0; i < 30; i++) {
      const entry = JSON.stringify({ summary: `Decision ${i}` });
      const result = runGsdTools(`util:memory write --store decisions --entry '${entry}'`, tmpDir);
      assert.ok(result.success, `Write ${i} failed: ${result.error}`);
    }

    const result = runGsdTools('util:memory read --store decisions', tmpDir);
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

    const result = runGsdTools('util:memory list', tmpDir);
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

describe('lesson snapshot helpers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('createMilestoneLessonSnapshot preserves lessons.json bytes and records source metadata', () => {
    const memoryDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
    const lessonsJson = JSON.stringify([
      {
        id: 'lesson-a',
        date: '2026-03-30T00:00:00Z',
        title: 'JJ commit retries need a safe path',
        severity: 'HIGH',
        type: 'workflow',
        root_cause: 'Dirty JJ workspaces caused repeated commit retries.',
        prevention_rule: 'Use a JJ-safe commit flow.',
        affected_agents: ['bgsd-executor'],
      },
    ], null, 2);
    fs.writeFileSync(path.join(memoryDir, 'lessons.json'), lessonsJson, 'utf-8');

    const snapshotResult = createMilestoneLessonSnapshot(tmpDir, { version: 'v18.0', name: 'Test Milestone' });
    assert.ok(snapshotResult.snapshot_path.endsWith('v18.0-lessons-snapshot.json'), 'snapshot path should be milestone-owned');
    assert.strictEqual(snapshotResult.snapshot.compact_summary.inspect_path, snapshotResult.snapshot_path, 'snapshot summary should expose its inspect path');
    assert.strictEqual(snapshotResult.snapshot.source.path, '.planning/memory/lessons.json');
    assert.strictEqual(snapshotResult.snapshot.source.lesson_count, 1);
    assert.ok(snapshotResult.snapshot.source.source_hash, 'snapshot should record source hash');
    assert.strictEqual(fs.readFileSync(path.join(memoryDir, 'lessons.json'), 'utf-8'), lessonsJson, 'helper must not mutate lessons.json');
  });

  test('deriveLessonRemediationBuckets emits stable named buckets with exact lesson IDs', () => {
    const buckets = deriveLessonRemediationBuckets([
      {
        id: 'lesson-jj',
        title: 'JJ workspace commit retries',
        root_cause: 'JJ workspace commit flow drifted.',
        prevention_rule: 'Use the JJ-safe path.',
        severity: 'HIGH',
        type: 'workflow',
        affected_agents: ['bgsd-executor'],
      },
      {
        id: 'lesson-guidance',
        title: 'Workflow guidance drifted from the shipped command surface',
        root_cause: 'Workflow guidance referenced stale commands.',
        prevention_rule: 'Keep command-surface guidance in sync.',
        severity: 'MEDIUM',
        type: 'tooling',
        affected_agents: ['bgsd-planner'],
      },
    ]);

    assert.ok(buckets.some(bucket => bucket.id === 'jj-safe-commit-reliability' && bucket.lesson_ids.includes('lesson-jj')));
    assert.ok(buckets.some(bucket => bucket.id === 'workflow-guidance-integrity' && bucket.lesson_ids.includes('lesson-guidance')));
    assert.ok(buckets.every(bucket => typeof bucket.name === 'string' && bucket.name.length > 0), 'bucket names should be stable and human-readable');
    assert.ok(buckets.every(bucket => Array.isArray(bucket.lesson_ids)), 'bucket schema should include lesson_ids');
  });
});

describe('structured MEMORY.md commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function memoryFile() {
    return path.join(tmpDir, '.planning', 'MEMORY.md');
  }

  function readMemoryFile() {
    return fs.readFileSync(memoryFile(), 'utf-8');
  }

  test('memory:list bootstraps MEMORY.md with five required sections', () => {
    const result = runGsdTools('memory:list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.ok(fs.existsSync(memoryFile()), 'MEMORY.md should be created');
    assert.deepStrictEqual(payload.section_order, [
      'Active / Recent',
      'Project Facts',
      'User Preferences',
      'Environment Patterns',
      'Correction History',
    ]);

    const content = readMemoryFile();
    for (const section of payload.section_order) {
      assert.ok(content.includes(`## ${section}`), `Expected section ${section}`);
    }
  });

  test('memory:add writes deterministic IDs and metadata timestamps', () => {
    const add1 = runGsdTools('memory:add --section "Project Facts" --type project-fact --text "CLI stays single-file" --source AGENTS.md', tmpDir);
    assert.ok(add1.success, `First add failed: ${add1.error}`);
    const add2 = runGsdTools('memory:add --section "User Preferences" --type user-preference --text "Prefer predictable structure" --keep always --status active', tmpDir);
    assert.ok(add2.success, `Second add failed: ${add2.error}`);

    const content = readMemoryFile();
    assert.match(content, /\*\*MEM-001\*\* \[project-fact\] CLI stays single-file/);
    assert.match(content, /\*\*MEM-002\*\* \[user-preference\] Prefer predictable structure/);
    assert.match(content, /- Added: \d{4}-\d{2}-\d{2}/);
    assert.match(content, /- Updated: \d{4}-\d{2}-\d{2}/);
    assert.ok(content.includes('  - Keep: always'), 'Keep metadata should be written when present');
    assert.ok(content.includes('  - Status: active'), 'Status metadata should be written when present');
  });

  test('parser and serializer preserve supported hand-edited metadata fields', () => {
    const handEdited = `# Agent Memory

## Active / Recent

## Project Facts
- **MEM-001** [project-fact] CLI is single-file and zero-dependency.
  - Added: 2026-03-28
  - Updated: 2026-03-28
  - Source: AGENTS.md
  - Keep: always
  - Status: active
  - Expires: 2026-12-31

- **MEM-002** [project-fact] Old duplicate fact.
  - Added: 2026-01-01
  - Updated: 2026-01-01
  - Replaces: MEM-001

## User Preferences

## Environment Patterns

## Correction History
`;
    fs.writeFileSync(memoryFile(), handEdited);

    const remove = runGsdTools('memory:remove --id MEM-002', tmpDir);
    assert.ok(remove.success, `Remove failed: ${remove.error}`);

    const content = readMemoryFile();
    assert.ok(content.includes('**MEM-001** [project-fact] CLI is single-file and zero-dependency.'), 'Primary entry should remain');
    assert.ok(content.includes('  - Source: AGENTS.md'), 'Source metadata should round-trip');
    assert.ok(content.includes('  - Keep: always'), 'Keep metadata should round-trip');
    assert.ok(content.includes('  - Status: active'), 'Status metadata should round-trip');
    assert.ok(content.includes('  - Expires: 2026-12-31'), 'Expires metadata should round-trip');
    assert.ok(!content.includes('MEM-002'), 'Removed entry should be gone');
  });

  test('memory:list groups entries by canonical section order', () => {
    fs.writeFileSync(memoryFile(), `# Agent Memory

## Active / Recent
- **MEM-001** [project-fact] Recently used fact.
  - Added: 2026-03-28
  - Updated: 2026-03-28

## Project Facts
- **MEM-002** [project-fact] CLI bundles to one file.
  - Added: 2026-03-20
  - Updated: 2026-03-20

## User Preferences

## Environment Patterns
- **MEM-003** [environment-pattern] Tests run with node:test.
  - Added: 2026-03-18
  - Updated: 2026-03-18

## Correction History
`);

    const result = runGsdTools('memory:list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.deepStrictEqual(payload.sections.map(section => section.name), payload.section_order);
    assert.strictEqual(payload.sections[0].entries[0].id, 'MEM-001');
    assert.strictEqual(payload.sections[1].entries[0].id, 'MEM-002');
    assert.strictEqual(payload.sections[3].entries[0].id, 'MEM-003');
  });

  test('memory:remove removes by stable ID and leaves neighbors untouched', () => {
    runGsdTools('memory:add --section "Project Facts" --text "First fact"', tmpDir);
    runGsdTools('memory:add --section "Project Facts" --text "Second fact"', tmpDir);
    runGsdTools('memory:add --section "Project Facts" --text "Third fact"', tmpDir);

    const remove = runGsdTools('memory:remove --id MEM-002', tmpDir);
    assert.ok(remove.success, `Remove failed: ${remove.error}`);

    const content = readMemoryFile();
    assert.ok(content.includes('**MEM-001** [project-fact] First fact'));
    assert.ok(!content.includes('**MEM-002** [project-fact] Second fact'));
    assert.ok(content.includes('**MEM-003** [project-fact] Third fact'));
  });

  test('memory:prune preview reports threshold, section, reason, and age', () => {
    fs.writeFileSync(memoryFile(), `# Agent Memory

## Active / Recent

## Project Facts

## User Preferences

## Environment Patterns

## Correction History
- **MEM-010** [correction] Stop suggesting hidden global config edits.
  - Added: 2025-01-01
  - Updated: 2025-01-01
  - Status: inactive
`);

    const result = runGsdTools('memory:prune --threshold 30', tmpDir);
    assert.ok(result.success, `Prune preview failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.preview, true);
    assert.strictEqual(payload.threshold_days, 30);
    assert.strictEqual(payload.candidate_count, 1);
    assert.strictEqual(payload.candidates[0].id, 'MEM-010');
    assert.strictEqual(payload.candidates[0].section, 'Correction History');
    assert.strictEqual(payload.candidates[0].reason, 'inactive');
    assert.ok(typeof payload.candidates[0].age_days === 'number' && payload.candidates[0].age_days >= 30);
  });

  test('memory:prune excludes pinned and active entries from candidates', () => {
    fs.writeFileSync(memoryFile(), `# Agent Memory

## Active / Recent
- **MEM-001** [project-fact] Current focus belongs here.
  - Added: 2025-01-01
  - Updated: 2025-01-01

## Project Facts
- **MEM-002** [project-fact] This is pinned forever.
  - Added: 2025-01-01
  - Updated: 2025-01-01
  - Keep: always

## User Preferences

## Environment Patterns
- **MEM-003** [environment-pattern] Old non-pinned pattern.
  - Added: 2025-01-01
  - Updated: 2025-01-01

## Correction History
`);

    const result = runGsdTools('memory:prune --threshold 30', tmpDir);
    assert.ok(result.success, `Prune preview failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    const ids = payload.candidates.map(candidate => candidate.id);
    assert.deepStrictEqual(ids, ['MEM-003']);
  });

  test('memory:prune only mutates file with --apply', () => {
    fs.writeFileSync(memoryFile(), `# Agent Memory

## Active / Recent

## Project Facts
- **MEM-001** [project-fact] Replace me.
  - Added: 2025-01-01
  - Updated: 2025-01-01

- **MEM-002** [project-fact] Newer replacement.
  - Added: 2026-03-01
  - Updated: 2026-03-01
  - Replaces: MEM-001

## User Preferences

## Environment Patterns

## Correction History
`);

    const before = readMemoryFile();
    const preview = runGsdTools('memory:prune --threshold 30', tmpDir);
    assert.ok(preview.success, `Preview failed: ${preview.error}`);
    assert.strictEqual(readMemoryFile(), before, 'Preview must not change file');

    const apply = runGsdTools('memory:prune --threshold 30 --apply', tmpDir);
    assert.ok(apply.success, `Apply failed: ${apply.error}`);
    const payload = JSON.parse(apply.output);
    assert.strictEqual(payload.applied, true);
    assert.deepStrictEqual(payload.removed_ids, ['MEM-001']);

    const after = readMemoryFile();
    assert.ok(!after.includes('**MEM-001**'), 'Applied prune should remove candidate');
    assert.ok(after.includes('**MEM-002**'), 'Replacement entry should remain');
  });

  test('legacy util:memory commands still work alongside structured memory commands', () => {
    const legacy = runGsdTools(`util:memory write --store decisions --entry '{"summary":"Legacy decision"}'`, tmpDir);
    assert.ok(legacy.success, `Legacy util:memory write failed: ${legacy.error}`);

    const structured = runGsdTools('memory:add --section "Project Facts" --text "Structured fact"', tmpDir);
    assert.ok(structured.success, `Structured memory add failed: ${structured.error}`);

    const decisionsPath = path.join(tmpDir, '.planning', 'memory', 'decisions.json');
    assert.ok(fs.existsSync(decisionsPath), 'Legacy JSON store should still exist');
    assert.ok(fs.existsSync(memoryFile()), 'Structured MEMORY.md should also exist');
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
    const result = runGsdTools('init:memory', tmpDir);
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

    const result = runGsdTools('init:memory', tmpDir);
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

    const result = runGsdTools('init:memory', tmpDir);
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

    const result = runGsdTools('init:memory --phase 11', tmpDir);
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

    const result = runGsdTools('init:memory', tmpDir);
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
    const r1 = runGsdTools('init:memory --workflow execute-phase', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.ok(o1.codebase.sections_loaded.includes('CONVENTIONS.md'), 'execute-phase loads CONVENTIONS');
    assert.ok(o1.codebase.sections_loaded.includes('ARCHITECTURE.md'), 'execute-phase loads ARCHITECTURE');
    assert.ok(!o1.codebase.sections_loaded.includes('TESTING.md'), 'execute-phase does not load TESTING');

    // verify-work should load TESTING + CONVENTIONS
    const r2 = runGsdTools('init:memory --workflow verify-work', tmpDir);
    assert.ok(r2.success, `Command failed: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.ok(o2.codebase.sections_loaded.includes('TESTING.md'), 'verify-work loads TESTING');
    assert.ok(o2.codebase.sections_loaded.includes('CONVENTIONS.md'), 'verify-work loads CONVENTIONS');

    // plan-phase should load ARCHITECTURE + STACK + CONCERNS
    const r3 = runGsdTools('init:memory --workflow plan-phase', tmpDir);
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
    const r1 = runGsdTools('init:memory --verbose', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.decisions.length, 10, 'verbose mode: 10 decisions');

    // Default (compact) mode: up to 5 decisions
    const r2 = runGsdTools('init:memory', tmpDir);
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

    const result = runGsdTools('init:memory', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.blockers.length, 2, '2 blockers');
    assert.strictEqual(output.blockers[0], 'API rate limiting not yet implemented');
    assert.strictEqual(output.blockers[1], 'Missing test coverage for edge cases');
    assert.strictEqual(output.todos.length, 2, '2 todos');
    assert.strictEqual(output.todos[0], 'Write unit tests for memory digest');
  });
});

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

    const result = runGsdTools('util:memory compact --store decisions', tmpDir);
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

    const result = runGsdTools('util:memory compact --store lessons', tmpDir);
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

    const result = runGsdTools('util:memory compact --store bookmarks', tmpDir);
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

    const result = runGsdTools('util:memory compact --store bookmarks --dry-run', tmpDir);
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

    const result = runGsdTools('util:memory compact', tmpDir);
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

    const result = runGsdTools('util:memory compact --store todos', tmpDir);
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
      `util:memory write --store todos --entry '{"text":"Todo 51"}'`,
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
    const result1 = runGsdTools('util:memory compact --store bookmarks', tmpDir);
    assert.ok(result1.success, `Command failed: ${result1.error}`);
    const output1 = JSON.parse(result1.output);
    assert.strictEqual(output1.summaries_created.bookmarks, 0, 'should not compact at default threshold');

    // With custom threshold of 20, should compact
    const result2 = runGsdTools('util:memory compact --store bookmarks --threshold 20', tmpDir);
    assert.ok(result2.success, `Command failed: ${result2.error}`);
    const output2 = JSON.parse(result2.output);
    assert.strictEqual(output2.compacted, true, 'should compact at custom threshold');
    assert.strictEqual(output2.summaries_created.bookmarks, 15, 'should create 15 summaries (25 - 10 kept)');
  });
});

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
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
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
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail without category');
    assert.ok(result.error.includes('category') || result.output.includes('category'), 'Error should mention category');
  });

  test('write rejects invalid category', () => {
    const entry = JSON.stringify({ category: 'invalid', text: 'Bad category' });
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.strictEqual(result.success, false, 'Should fail with invalid category');
    assert.ok(result.error.includes('category') || result.output.includes('category'), 'Error should mention category');
  });

  test('write rejects missing text', () => {
    const entry = JSON.stringify({ category: 'decision' });
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
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
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
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
    const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
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

    const result = runGsdTools('util:memory read --store trajectories --category decision', tmpDir);
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
    const r1 = runGsdTools('util:memory read --store trajectories --tags perf', tmpDir);
    assert.ok(r1.success, `Command failed: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.count, 2, 'should match 2 entries with perf tag');

    // Multi-tag (AND logic)
    const r2 = runGsdTools('util:memory read --store trajectories --tags perf,memory', tmpDir);
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

    const result = runGsdTools('util:memory read --store trajectories --from 2026-01-01 --to 2026-12-31', tmpDir);
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

    const result = runGsdTools('util:memory read --store trajectories', tmpDir);
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

    const result = runGsdTools('util:memory read --store trajectories --asc', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.entries[0].text, 'First', 'oldest entry should be first with --asc');
    assert.strictEqual(output.entries[2].text, 'Third', 'newest entry should be last with --asc');
  });

  test('session persistence — data survives across separate read calls', () => {
    // Write entry
    const entry = JSON.stringify({ category: 'correction', text: 'Fix the approach' });
    const writeResult = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
    assert.ok(writeResult.success, `Write failed: ${writeResult.error}`);

    // Read back (simulating new session — separate process invocation)
    const readResult = runGsdTools('util:memory read --store trajectories', tmpDir);
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
      const result = runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);
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

    const result = runGsdTools('util:memory compact --store trajectories', tmpDir);
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
    runGsdTools(`util:memory write --store trajectories --entry '${entry}'`, tmpDir);

    const correctPath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
    const wrongPath = path.join(tmpDir, '.planning', 'memory', 'trajectories.json');
    assert.ok(fs.existsSync(correctPath), 'trajectory.json should exist');
    assert.ok(!fs.existsSync(wrongPath), 'trajectories.json should NOT exist');
  });
});

// ---------------------------------------------------------------------------
// Group: memory SQLite migration (MEM-02)
// ---------------------------------------------------------------------------

describe('memory SQLite migration', () => {
  let tmpDir;
  let db;
  let cache;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-mem-mig-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });
    closeAll();
    db = getDb(tmpDir);
    cache = new PlanningCache(db);
  });

  afterEach(() => {
    closeAll();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('migrateMemoryStores imports decisions from JSON', () => {
    const entries = [
      { summary: 'Decision one', phase: '01', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Decision two', phase: '01', timestamp: '2026-01-02T00:00:00Z' },
      { summary: 'Decision three', phase: '02', timestamp: '2026-01-03T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'decisions.json'), JSON.stringify(entries));

    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'migrateMemoryStores should return result');
    assert.strictEqual(result.migrated.decisions, 3, 'should migrate 3 decisions');

    // Verify via SQL
    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM memory_decisions WHERE cwd = ?').get(tmpDir);
    assert.strictEqual(countRow.cnt, 3, 'SQLite should have 3 decision rows');

    // Verify original JSON file is untouched
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'memory', 'decisions.json'), 'utf-8'));
    assert.strictEqual(onDisk.length, 3, 'JSON file should be unchanged after migration');
  });

  test('migrateMemoryStores imports lessons from JSON', () => {
    const entries = [
      { summary: 'Lesson one', phase: '01', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Lesson two', phase: '01', timestamp: '2026-01-02T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'lessons.json'), JSON.stringify(entries));

    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'should return result');
    assert.strictEqual(result.migrated.lessons, 2, 'should migrate 2 lessons');

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM memory_lessons WHERE cwd = ?').get(tmpDir);
    assert.strictEqual(countRow.cnt, 2, 'SQLite should have 2 lesson rows');
  });

  test('migrateMemoryStores imports trajectories from trajectory.json', () => {
    const entries = [
      { id: 'tj-aaa001', category: 'checkpoint', text: 'First', phase: '01', scope: 'phase', timestamp: '2026-01-01T00:00:00Z', tags: ['checkpoint'] },
      { id: 'tj-aaa002', category: 'decision', text: 'Second', phase: '01', scope: 'task', timestamp: '2026-01-02T00:00:00Z', tags: [] },
      { id: 'tj-aaa003', category: 'observation', text: 'Third', phase: '02', scope: 'phase', timestamp: '2026-01-03T00:00:00Z', tags: [] },
    ];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'trajectory.json'), JSON.stringify(entries));

    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'should return result');
    assert.strictEqual(result.migrated.trajectories, 3, 'should migrate 3 trajectories');

    const rows = db.prepare('SELECT entry_id, category FROM memory_trajectories WHERE cwd = ?').all(tmpDir);
    assert.strictEqual(rows.length, 3, 'SQLite should have 3 trajectory rows');
    const ids = rows.map(r => r.entry_id);
    assert.ok(ids.includes('tj-aaa001'), 'entry_id column should be populated');
    assert.ok(ids.includes('tj-aaa002'));
  });

  test('migrateMemoryStores imports bookmarks from bookmarks.json', () => {
    const entries = [
      { phase: '11', plan: '01', task: 3, total_tasks: 5, git_head: 'abc123', timestamp: '2026-01-03T00:00:00Z' },
      { phase: '10', plan: '02', task: 1, total_tasks: 3, git_head: 'def456', timestamp: '2026-01-02T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'bookmarks.json'), JSON.stringify(entries));

    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'should return result');
    assert.strictEqual(result.migrated.bookmarks, 2, 'should migrate 2 bookmarks');

    const rows = db.prepare('SELECT phase, plan, task FROM memory_bookmarks WHERE cwd = ?').all(tmpDir);
    assert.strictEqual(rows.length, 2, 'SQLite should have 2 bookmark rows');
    // phase/plan/task columns should be populated
    assert.ok(rows.some(r => r.phase === '11' && r.plan === '01' && r.task === 3), 'phase/plan/task columns populated');
  });

  test('migration is idempotent — second call does not duplicate', () => {
    const entries = [
      { summary: 'Decision one', phase: '01', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Decision two', phase: '01', timestamp: '2026-01-02T00:00:00Z' },
    ];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'decisions.json'), JSON.stringify(entries));

    cache.migrateMemoryStores(tmpDir);
    cache.migrateMemoryStores(tmpDir); // second call

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM memory_decisions WHERE cwd = ?').get(tmpDir);
    assert.strictEqual(countRow.cnt, 2, 'second migration should not duplicate entries');
  });

  test('migration handles missing JSON files gracefully', () => {
    // No .planning/memory/ content at all — just the empty directory
    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'should return result without error');
    assert.strictEqual(result.migrated.decisions, 0, 'decisions should be 0');
    assert.strictEqual(result.migrated.lessons, 0, 'lessons should be 0');
    assert.strictEqual(result.migrated.trajectories, 0, 'trajectories should be 0');
    assert.strictEqual(result.migrated.bookmarks, 0, 'bookmarks should be 0');
  });

  test('migration handles corrupt JSON gracefully', () => {
    // Write invalid JSON to decisions.json
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'decisions.json'), 'not valid json {{');

    // Write valid lessons.json
    const lessons = [{ summary: 'Valid lesson', phase: '01', timestamp: '2026-01-01T00:00:00Z' }];
    fs.writeFileSync(path.join(tmpDir, '.planning', 'memory', 'lessons.json'), JSON.stringify(lessons));

    const result = cache.migrateMemoryStores(tmpDir);
    assert.ok(result, 'should return result without throwing');
    assert.strictEqual(result.migrated.decisions, 0, 'corrupt decisions should be skipped');
    assert.strictEqual(result.migrated.lessons, 1, 'valid lessons should still migrate');
    assert.ok(result.skipped.includes('decisions'), 'decisions should be in skipped list');
  });
});

// ---------------------------------------------------------------------------
// Group: memory SQL search (MEM-01)
// ---------------------------------------------------------------------------

describe('memory SQL search', () => {
  let tmpDir;
  let db;
  let cache;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-mem-sql-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });
    closeAll();
    db = getDb(tmpDir);
    cache = new PlanningCache(db);
  });

  afterEach(() => {
    closeAll();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('searchMemory finds decisions by keyword', () => {
    // Insert 5 decisions, 2 mentioning "auth"
    const entries = [
      { summary: 'Use auth middleware', phase: '01', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Add JWT auth tokens', phase: '01', timestamp: '2026-01-02T00:00:00Z' },
      { summary: 'Switch to esbuild', phase: '01', timestamp: '2026-01-03T00:00:00Z' },
      { summary: 'Memory store design', phase: '02', timestamp: '2026-01-04T00:00:00Z' },
      { summary: 'Prisma schema layout', phase: '02', timestamp: '2026-01-05T00:00:00Z' },
    ];
    for (const entry of entries) {
      cache.writeMemoryEntry(tmpDir, 'decisions', entry);
    }

    const result = cache.searchMemory(tmpDir, 'decisions', 'auth');
    assert.ok(result, 'searchMemory should return result on SQLite backend');
    assert.strictEqual(result.entries.length, 2, 'should find exactly 2 auth entries');
    assert.ok(result.entries.every(e => e.summary.toLowerCase().includes('auth')), 'all returned entries should match auth');
  });

  test('searchMemory filters by phase', () => {
    // Insert decisions for phases 118, 119, 120
    const entries = [
      { summary: 'Phase 118 decision', phase: '118', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Phase 119 decision A', phase: '119', timestamp: '2026-01-02T00:00:00Z' },
      { summary: 'Phase 119 decision B', phase: '119', timestamp: '2026-01-03T00:00:00Z' },
      { summary: 'Phase 120 decision', phase: '120', timestamp: '2026-01-04T00:00:00Z' },
    ];
    for (const entry of entries) {
      cache.writeMemoryEntry(tmpDir, 'decisions', entry);
    }

    const result = cache.searchMemory(tmpDir, 'decisions', null, { phase: '119' });
    assert.ok(result, 'searchMemory should return result');
    assert.strictEqual(result.entries.length, 2, 'should return only phase 119 entries');
    assert.ok(result.entries.every(e => e.phase === '119'), 'all returned entries should be phase 119');
  });

  test('searchMemory returns results ordered by timestamp DESC', () => {
    // Insert 3 decisions with known timestamps
    const entries = [
      { summary: 'Old decision', phase: '01', timestamp: '2026-01-01T00:00:00Z' },
      { summary: 'Middle decision', phase: '01', timestamp: '2026-02-01T00:00:00Z' },
      { summary: 'New decision', phase: '01', timestamp: '2026-03-01T00:00:00Z' },
    ];
    for (const entry of entries) {
      cache.writeMemoryEntry(tmpDir, 'decisions', entry);
    }

    const result = cache.searchMemory(tmpDir, 'decisions', null);
    assert.ok(result, 'should return result');
    assert.strictEqual(result.entries.length, 3);
    // Newest first
    assert.strictEqual(result.entries[0].summary, 'New decision', 'first entry should be newest');
    assert.strictEqual(result.entries[2].summary, 'Old decision', 'last entry should be oldest');
  });

  test('searchMemory with limit and offset', () => {
    // Insert 10 decisions
    for (let i = 0; i < 10; i++) {
      cache.writeMemoryEntry(tmpDir, 'decisions', {
        summary: `Decision ${i}`,
        phase: '01',
        timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      });
    }

    const result = cache.searchMemory(tmpDir, 'decisions', null, { limit: 3 });
    assert.ok(result, 'should return result');
    assert.strictEqual(result.entries.length, 3, 'should return exactly 3 entries with limit=3');
    assert.strictEqual(result.total, 10, 'total should reflect all 10 entries');
  });

  test('searchMemory returns null on Map backend', () => {
    const mapDb = new MapDatabase();
    const mapCache = new PlanningCache(mapDb);

    const result = mapCache.searchMemory(tmpDir, 'decisions', 'auth');
    assert.strictEqual(result, null, 'searchMemory should return null on Map backend');
  });
});

// ---------------------------------------------------------------------------
// Group: memory dual-write via CLI (MEM-03)
// ---------------------------------------------------------------------------

describe('memory dual-write via CLI', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    closeAll();
    cleanup(tmpDir);
  });

  test('memory write creates entry in both JSON and SQLite', () => {
    const entry = JSON.stringify({ summary: 'dual-write test decision', phase: '121' });
    const result = runGsdTools(`util:memory write --store decisions --entry '${entry}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Verify JSON
    const jsonPath = path.join(tmpDir, '.planning', 'memory', 'decisions.json');
    assert.ok(fs.existsSync(jsonPath), 'decisions.json should exist');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    assert.ok(data.some(e => e.summary === 'dual-write test decision'), 'entry should exist in JSON');

    // Verify SQLite
    closeAll();
    const dbCwd = fs.realpathSync(tmpDir);
    const db = getDb(tmpDir);
    const row = db.prepare('SELECT * FROM memory_decisions WHERE cwd = ? AND summary = ?').get(dbCwd, 'dual-write test decision');
    assert.ok(row, 'entry should exist in SQLite memory_decisions table');
  });

  test('memory write bookmark dual-writes to SQLite', () => {
    const entry = JSON.stringify({ phase: '121', plan: '03', task: 1, total_tasks: 2, git_head: 'abc1234' });
    const result = runGsdTools(`util:memory write --store bookmarks --entry '${entry}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Verify SQLite
    closeAll();
    const dbCwd = fs.realpathSync(tmpDir);
    const db = getDb(tmpDir);
    const row = db.prepare('SELECT * FROM memory_bookmarks WHERE cwd = ? AND phase = ?').get(dbCwd, '121');
    assert.ok(row, 'bookmark should exist in SQLite memory_bookmarks table');
    assert.strictEqual(row.plan, '03', 'plan column should match');
    assert.strictEqual(row.task, 1, 'task column should match');
  });

  test('memory read --query uses SQL search', () => {
    // Write 5 decisions, only 2 contain 'middleware'
    const entries = [
      { summary: 'Use auth middleware layer' },
      { summary: 'Route middleware for logging' },
      { summary: 'Prisma schema design' },
      { summary: 'esbuild bundling config' },
      { summary: 'Test coverage goals' },
    ];
    for (const e of entries) {
      const entryJson = JSON.stringify(e);
      runGsdTools(`util:memory write --store decisions --entry '${entryJson}'`, tmpDir);
    }

    const result = runGsdTools('util:memory read --store decisions --query middleware', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should find exactly 2 middleware entries');
    // source field indicates SQL was used
    if (output.entries.length > 0 && 'source' in output.entries[0]) {
      assert.strictEqual(output.entries[0].source, 'sql', 'source should be sql when SQLite is available');
    }
  });
});
