/**
 * Unit tests for the scaffold merge library (Phase 136 Plan 01).
 * Tests marker constants, markSection(), parseMarkedSections(),
 * mergeScaffold(), and formatFrontmatter().
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  DATA_MARKER,
  JUDGMENT_MARKER,
  DATA_END,
  JUDGMENT_END,
  markSection,
  parseMarkedSections,
  mergeScaffold,
  formatFrontmatter,
} = require('../src/lib/scaffold');

// ─── Marker Constants ─────────────────────────────────────────────────────────

describe('marker constants', () => {
  it('DATA_MARKER is correct HTML comment', () => {
    assert.strictEqual(DATA_MARKER, '<!-- data -->');
  });

  it('JUDGMENT_MARKER is correct HTML comment', () => {
    assert.strictEqual(JUDGMENT_MARKER, '<!-- judgment -->');
  });

  it('DATA_END is correct HTML comment', () => {
    assert.strictEqual(DATA_END, '<!-- /data -->');
  });

  it('JUDGMENT_END is correct HTML comment', () => {
    assert.strictEqual(JUDGMENT_END, '<!-- /judgment -->');
  });
});

// ─── markSection ─────────────────────────────────────────────────────────────

describe('markSection()', () => {
  it('wraps data section with data markers', () => {
    const result = markSection('content', 'data');
    assert.strictEqual(result, '<!-- data -->\ncontent\n<!-- /data -->');
  });

  it('wraps judgment section with judgment markers', () => {
    const result = markSection('content', 'judgment');
    assert.strictEqual(result, '<!-- judgment -->\ncontent\n<!-- /judgment -->');
  });

  it('handles multi-line content', () => {
    const result = markSection('line1\nline2\nline3', 'data');
    assert.strictEqual(result, '<!-- data -->\nline1\nline2\nline3\n<!-- /data -->');
  });

  it('handles empty content', () => {
    const result = markSection('', 'judgment');
    assert.strictEqual(result, '<!-- judgment -->\n\n<!-- /judgment -->');
  });
});

// ─── parseMarkedSections ──────────────────────────────────────────────────────

describe('parseMarkedSections()', () => {
  it('returns empty Map for empty input', () => {
    const result = parseMarkedSections('');
    assert.ok(result instanceof Map);
    assert.strictEqual(result.size, 0);
  });

  it('returns empty Map for null input', () => {
    const result = parseMarkedSections(null);
    assert.ok(result instanceof Map);
    assert.strictEqual(result.size, 0);
  });

  it('parses a document with data and judgment sections', () => {
    const doc = `---
phase: "136"
plan: "01"
---

# Title

## Objective

<!-- data -->
Phase goal goes here
<!-- /data -->

## Tasks

<!-- judgment -->
TODO: Fill in tasks
<!-- /judgment -->
`;
    const result = parseMarkedSections(doc);
    assert.strictEqual(result.size, 2);

    const obj = result.get('Objective');
    assert.ok(obj, 'Objective section exists');
    assert.strictEqual(obj.markerType, 'data');
    assert.ok(obj.content.includes('Phase goal goes here'));

    const tasks = result.get('Tasks');
    assert.ok(tasks, 'Tasks section exists');
    assert.strictEqual(tasks.markerType, 'judgment');
    assert.ok(tasks.content.includes('TODO:'));
  });

  it('sets markerType null for sections with no markers', () => {
    const doc = `## Section One

Plain content here

## Section Two

More content
`;
    const result = parseMarkedSections(doc);
    assert.strictEqual(result.size, 2);
    assert.strictEqual(result.get('Section One').markerType, null);
    assert.strictEqual(result.get('Section Two').markerType, null);
  });

  it('strips frontmatter before parsing', () => {
    const doc = `---
phase: "136"
---

## My Section

<!-- data -->
data content
<!-- /data -->
`;
    const result = parseMarkedSections(doc);
    assert.strictEqual(result.size, 1);
    assert.ok(result.has('My Section'));
    assert.strictEqual(result.get('My Section').markerType, 'data');
  });

  it('handles document with no headings', () => {
    const doc = `Just some text without any ## headings`;
    const result = parseMarkedSections(doc);
    assert.strictEqual(result.size, 0);
  });
});

// ─── mergeScaffold ────────────────────────────────────────────────────────────

describe('mergeScaffold()', () => {
  const judgmentHeadings = ['Tasks', 'Must-Haves'];

  function makeFreshDoc(objectiveContent, tasksContent) {
    return `---
phase: "136"
plan: "01"
---

# Plan 01: Test Plan

## Objective

<!-- data -->
${objectiveContent}
<!-- /data -->

## Tasks

<!-- judgment -->
${tasksContent}
<!-- /judgment -->
`;
  }

  it('returns freshText unchanged when existingText is null', () => {
    const fresh = makeFreshDoc('Phase objective here', 'TODO: Fill tasks');
    const result = mergeScaffold(null, fresh, judgmentHeadings);
    assert.strictEqual(result, fresh);
  });

  it('returns freshText unchanged when existingText is undefined', () => {
    const fresh = makeFreshDoc('Phase objective here', 'TODO: Fill tasks');
    const result = mergeScaffold(undefined, fresh, judgmentHeadings);
    assert.strictEqual(result, fresh);
  });

  it('preserves LLM-written judgment section (no TODO)', () => {
    const existing = makeFreshDoc('Phase objective', 'Task 1: Do something\nTask 2: Do more');
    const fresh = makeFreshDoc('Updated objective', 'TODO: Fill tasks');
    const result = mergeScaffold(existing, fresh, judgmentHeadings);
    // Tasks should be preserved from existing
    assert.ok(result.includes('Task 1: Do something'), 'LLM task content preserved');
    assert.ok(result.includes('Task 2: Do more'), 'LLM task content preserved');
    // Objective should be refreshed from fresh
    assert.ok(result.includes('Updated objective'), 'Data section refreshed');
  });

  it('replaces TODO judgment section with fresh content', () => {
    const existing = makeFreshDoc('Old objective', 'TODO: Fill tasks');
    const fresh = makeFreshDoc('New objective', 'TODO: New task template');
    const result = mergeScaffold(existing, fresh, judgmentHeadings);
    assert.ok(result.includes('TODO: New task template'), 'Fresh TODO used');
    assert.ok(result.includes('New objective'), 'Data section refreshed');
  });

  it('always refreshes data sections regardless of content', () => {
    const existing = makeFreshDoc('Old data content', 'TODO: tasks');
    const fresh = makeFreshDoc('New data content', 'TODO: tasks');
    const result = mergeScaffold(existing, fresh, judgmentHeadings);
    assert.ok(result.includes('New data content'), 'Data section uses fresh');
    assert.ok(!result.includes('Old data content'), 'Old data section replaced');
  });

  it('is idempotent — running twice produces identical output', () => {
    const existing = makeFreshDoc('Phase objective', 'Task 1: Implement feature');
    const fresh = makeFreshDoc('Phase objective', 'TODO: Fill tasks');
    const firstMerge = mergeScaffold(existing, fresh, judgmentHeadings);
    const secondMerge = mergeScaffold(firstMerge, fresh, judgmentHeadings);
    assert.strictEqual(firstMerge, secondMerge, 'Output is idempotent');
  });

  it('handles existing file with no sections (empty merge)', () => {
    const existing = `---\nphase: "136"\n---\n\n# Plan\n`;
    const fresh = makeFreshDoc('Objective', 'TODO: tasks');
    const result = mergeScaffold(existing, fresh, judgmentHeadings);
    // Should fall back to fresh for all sections
    assert.ok(result.includes('Objective'), 'Fresh content used');
    assert.ok(result.includes('TODO: tasks'), 'Fresh judgment used');
  });
});

// ─── formatFrontmatter ────────────────────────────────────────────────────────

describe('formatFrontmatter()', () => {
  it('serializes simple string values', () => {
    const result = formatFrontmatter({ phase: '136', plan: '01' });
    assert.ok(result.includes('phase: 136'), 'phase present');
    assert.ok(result.includes('plan: 01'), 'plan present');
  });

  it('serializes arrays inline when short', () => {
    const result = formatFrontmatter({ requirements: ['SCAF-01', 'SCAF-02'] });
    assert.ok(result.includes('requirements:'), 'requirements key present');
    assert.ok(result.includes('SCAF-01') && result.includes('SCAF-02'), 'values present');
  });

  it('serializes longer arrays as multi-line', () => {
    const result = formatFrontmatter({
      files_modified: ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js'],
    });
    assert.ok(result.includes('files_modified:'), 'key present');
    // Multi-line format uses "- " prefix
    assert.ok(result.includes('  - src/a.js'), 'multi-line array format used');
  });

  it('serializes empty arrays', () => {
    const result = formatFrontmatter({ depends_on: [] });
    assert.ok(result.includes('depends_on: []'), 'empty array serialized');
  });

  it('serializes nested objects', () => {
    const result = formatFrontmatter({
      must_haves: { truths: [], artifacts: [] },
    });
    assert.ok(result.includes('must_haves:'), 'nested key present');
  });

  it('handles values with colons by quoting', () => {
    const result = formatFrontmatter({ title: 'Scaffold: The Plan' });
    // Values with colons should be quoted
    assert.ok(result.includes('"Scaffold: The Plan"'), 'colon value quoted');
  });

  it('skips null/undefined values', () => {
    const result = formatFrontmatter({ phase: '136', title: null, plan: undefined });
    assert.ok(result.includes('phase: 136'), 'non-null present');
    assert.ok(!result.includes('title:'), 'null skipped');
    assert.ok(!result.includes('plan:'), 'undefined skipped');
  });
});
