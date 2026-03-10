/**
 * bgsd-tools memory tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

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

