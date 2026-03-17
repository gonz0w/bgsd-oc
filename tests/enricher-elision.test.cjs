/**
 * Conditional elision test suite — Phase 137 Plan 01
 *
 * Tests the elideConditionalSections() function and its integration
 * into enrichCommand(). Covers:
 *   - Basic elision (false condition → remove section)
 *   - Basic preservation (true condition → keep section)
 *   - Decision lookup (enrichment.decisions[key].value)
 *   - Fail-open (missing key → keep section)
 *   - Unconditional sections (no if= → never modified)
 *   - Multiple conditional sections (independent processing)
 *   - Mixed conditional/unconditional content
 *   - Empty enrichment (all sections preserved)
 *   - Nested content preservation (multi-line removal)
 *   - Integration test (enrichCommand flow with mock output.parts)
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_PATH = path.resolve(__dirname, '..', 'plugin.js');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SECTION_WITH_TDD = `<!-- section: tdd_execution if="is_tdd" -->
TDD content: load skill and follow RED/GREEN/REFACTOR cycle.
<!-- /section -->`;

const SECTION_WITH_CI = `<!-- section: ci_quality_gate if="ci_enabled" -->
CI gate content here.
Quality checks run.
<!-- /section -->`;

const SECTION_UNCONDITIONAL = `<!-- section: execute -->
Always visible execute content.
<!-- /section -->`;

const SECTION_WITH_AUTO_TEST = `<!-- section: auto_test if="has_test_command" -->
Auto-test after edit.
<!-- /section -->`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal temp project for integration tests.
 */
function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgsd-elision-test-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(path.join(planningDir, 'phases', '01-test'), { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'),
    '# Roadmap\n\n## Milestone: Test 1.0\n\n### Phase 1 — Test\n\n**Status:** In Progress\n');
  fs.writeFileSync(path.join(planningDir, 'STATE.md'),
    '# State\n\n## Current Position\n\n**Phase:** 1\n**Last Activity:** 2026-01-01\n\n## Session Continuity\n\n**Last session:** 2026-01-01\n');
  return dir;
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Test groups
// ---------------------------------------------------------------------------

describe('elideConditionalSections: basic elision', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('is exported as a function from plugin.js', () => {
    assert.strictEqual(typeof elide, 'function', 'elideConditionalSections should be a function');
  });

  it('test 1: basic elision — section with if="is_tdd" removed when is_tdd is falsy', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: false });
    assert.strictEqual(result.sections_elided, 1, 'should elide 1 section');
    assert.ok(result.elided_names.includes('tdd_execution'), 'should include section name in elided_names');
    assert.ok(!result.text.includes('TDD content'), 'TDD content should be removed');
    assert.ok(!result.text.includes('<!-- section: tdd_execution'), 'opening marker should be removed');
    assert.ok(!result.text.includes('<!-- /section -->'), 'closing marker should be removed');
  });

  it('test 2: basic preservation — section with if="is_tdd" kept when is_tdd is truthy', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: true });
    assert.strictEqual(result.sections_elided, 0, 'should not elide any sections');
    assert.ok(result.text.includes('TDD content'), 'TDD content should be preserved');
  });

  it('basic elision with zero value is falsy', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: 0 });
    assert.strictEqual(result.sections_elided, 1, 'zero is falsy — should elide');
  });

  it('basic elision with null value is falsy', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: null });
    assert.strictEqual(result.sections_elided, 1, 'null is falsy — should elide');
  });

  it('basic preservation with non-empty string is truthy', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: 'yes' });
    assert.strictEqual(result.sections_elided, 0, 'non-empty string is truthy — should keep');
  });
});

describe('elideConditionalSections: decision lookup', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('test 3: decision lookup — section removed when decisions[ci_enabled].value is false', () => {
    const enrichment = {
      decisions: { ci_enabled: { value: false } },
    };
    const result = elide(SECTION_WITH_CI, enrichment);
    assert.strictEqual(result.sections_elided, 1, 'should elide ci_quality_gate');
    assert.ok(!result.text.includes('CI gate content'), 'CI content should be removed');
  });

  it('decision lookup — section kept when decisions[ci_enabled].value is true', () => {
    const enrichment = {
      decisions: { ci_enabled: { value: true } },
    };
    const result = elide(SECTION_WITH_CI, enrichment);
    assert.strictEqual(result.sections_elided, 0, 'should not elide when decision is true');
    assert.ok(result.text.includes('CI gate content'), 'CI content should be preserved');
  });

  it('direct field takes priority over decision lookup', () => {
    // Direct field is false, but decision says true — direct field wins
    const enrichment = {
      ci_enabled: false,
      decisions: { ci_enabled: { value: true } },
    };
    const result = elide(SECTION_WITH_CI, enrichment);
    assert.strictEqual(result.sections_elided, 1, 'direct field (false) should take priority');
  });
});

describe('elideConditionalSections: fail-open behavior', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('test 4: fail-open — section with unknown key preserved', () => {
    const result = elide(SECTION_WITH_TDD, { some_other_key: false });
    assert.strictEqual(result.sections_elided, 0, 'missing key should not elide (fail-open)');
    assert.ok(result.text.includes('TDD content'), 'content should be preserved on missing key');
  });

  it('test 8: empty enrichment — all conditional sections preserved', () => {
    const text = SECTION_WITH_TDD + '\n' + SECTION_WITH_CI;
    const result = elide(text, {});
    assert.strictEqual(result.sections_elided, 0, 'empty enrichment should preserve all sections (fail-open)');
  });

  it('null enrichment returns text unchanged', () => {
    const result = elide(SECTION_WITH_TDD, null);
    assert.strictEqual(result.sections_elided, 0, 'null enrichment should not elide');
    assert.ok(result.text.includes('TDD content'), 'text should be unchanged with null enrichment');
  });

  it('null text returns empty string safely', () => {
    const result = elide(null, { is_tdd: false });
    assert.strictEqual(result.text, '', 'null text should return empty string');
    assert.strictEqual(result.sections_elided, 0);
  });
});

describe('elideConditionalSections: unconditional sections', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('test 5: unconditional sections preserved regardless of enrichment', () => {
    const result = elide(SECTION_UNCONDITIONAL, { execute: false, is_tdd: false });
    assert.strictEqual(result.sections_elided, 0, 'unconditional section should never be elided');
    assert.ok(result.text.includes('Always visible execute content'), 'unconditional content should remain');
  });

  it('unconditional section with matching name field not elided', () => {
    // Even if enrichment has a field matching the section name, unconditional sections are kept
    const result = elide(SECTION_UNCONDITIONAL, { execute: false });
    assert.strictEqual(result.sections_elided, 0, 'section without if= is never conditional');
  });
});

describe('elideConditionalSections: multiple sections', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('test 6: multiple conditional sections — only false ones removed', () => {
    const text = SECTION_WITH_TDD + '\n\n' + SECTION_WITH_CI;
    // is_tdd=true (keep), ci_enabled=false (remove)
    const result = elide(text, { is_tdd: true, ci_enabled: false });
    assert.strictEqual(result.sections_elided, 1, 'only one section should be elided');
    assert.ok(result.text.includes('TDD content'), 'TDD section should be kept');
    assert.ok(!result.text.includes('CI gate content'), 'CI section should be removed');
  });

  it('multiple conditional sections — both removed when both false', () => {
    const text = SECTION_WITH_TDD + '\n\n' + SECTION_WITH_CI;
    const result = elide(text, { is_tdd: false, ci_enabled: false });
    assert.strictEqual(result.sections_elided, 2, 'both sections should be elided');
    assert.ok(!result.text.includes('TDD content'), 'TDD content removed');
    assert.ok(!result.text.includes('CI gate content'), 'CI content removed');
  });

  it('test 7: mixed conditional/unconditional — only false conditional sections removed', () => {
    const text = SECTION_WITH_TDD + '\n\n' + SECTION_UNCONDITIONAL + '\n\n' + SECTION_WITH_CI;
    const result = elide(text, { is_tdd: false, ci_enabled: false });
    assert.strictEqual(result.sections_elided, 2, 'two conditional sections elided');
    assert.ok(!result.text.includes('TDD content'), 'TDD content removed');
    assert.ok(!result.text.includes('CI gate content'), 'CI content removed');
    assert.ok(result.text.includes('Always visible execute content'), 'unconditional content preserved');
  });

  it('three conditional sections, only middle one elided', () => {
    const text = SECTION_WITH_TDD + '\n\n' + SECTION_WITH_AUTO_TEST + '\n\n' + SECTION_WITH_CI;
    // TDD=true, auto_test=false, CI=true
    const result = elide(text, { is_tdd: true, has_test_command: false, ci_enabled: true });
    assert.strictEqual(result.sections_elided, 1, 'only middle section elided');
    assert.strictEqual(result.elided_names[0], 'auto_test', 'correct section name recorded');
    assert.ok(!result.text.includes('Auto-test after edit'), 'auto_test content removed');
    assert.ok(result.text.includes('TDD content'), 'TDD content preserved');
    assert.ok(result.text.includes('CI gate content'), 'CI content preserved');
  });
});

describe('elideConditionalSections: content removal', () => {
  let elide;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    elide = mod.elideConditionalSections;
  });

  it('test 9: nested content fully removed (including HTML comments)', () => {
    const text = `<!-- section: tdd_execution if="is_tdd" -->
Line 1
<!-- nested comment: something -->
Line 3
Code block:
\`\`\`bash
some code
\`\`\`
<!-- /section -->`;
    const result = elide(text, { is_tdd: false });
    assert.strictEqual(result.sections_elided, 1, 'section should be elided');
    assert.ok(!result.text.includes('Line 1'), 'nested content fully removed');
    assert.ok(!result.text.includes('nested comment'), 'nested HTML comment removed');
    assert.ok(!result.text.includes('some code'), 'code block removed');
    assert.strictEqual(result.text.trim(), '', 'result should be empty (or just whitespace)');
  });

  it('tokens_saved_estimate is positive for elided content', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: false });
    assert.ok(result.tokens_saved_estimate > 0, 'should estimate token savings');
  });

  it('tokens_saved_estimate is 0 when no sections elided', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: true });
    assert.strictEqual(result.tokens_saved_estimate, 0, 'no savings when no sections elided');
  });

  it('unclosed section treated as extending to EOF', () => {
    const text = `<!-- section: ci_quality_gate if="ci_enabled" -->
CI content without closing marker`;
    const result = elide(text, { ci_enabled: false });
    assert.strictEqual(result.sections_elided, 1, 'unclosed section should be elided to EOF');
    assert.ok(!result.text.includes('CI content'), 'content removed to EOF');
  });

  it('boolean string "true" keeps section', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: 'true' });
    assert.strictEqual(result.sections_elided, 0, '"true" string should keep section');
  });

  it('boolean string "false" elides section', () => {
    const result = elide(SECTION_WITH_TDD, { is_tdd: 'false' });
    assert.strictEqual(result.sections_elided, 1, '"false" string should elide section');
  });
});

describe('elideConditionalSections: integration with enrichCommand', () => {
  let enrichCommand;
  let tempDir;

  before(async () => {
    const mod = await import(PLUGIN_PATH);
    enrichCommand = mod.enrichCommand;
    tempDir = makeTempProject();
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('test 10: integration test — elision occurs when output.parts has conditional content', () => {
    // Simulate enrichCommand with output.parts containing workflow content
    const input = { command: 'bgsd-execute-phase', parts: ['bgsd-execute-phase'] };
    const output = {
      parts: [{
        type: 'text',
        text: [
          '<!-- section: ci_quality_gate if="ci_enabled" -->',
          'CI gate step content.',
          '<!-- /section -->',
          '',
          '<!-- section: execute -->',
          'Core execution step.',
          '<!-- /section -->',
        ].join('\n'),
      }],
    };

    // ci_enabled not in config → defaults to false
    enrichCommand(input, output, tempDir);

    // output.parts[0] is now bgsd-context (unshifted), output.parts[1] is workflow
    assert.ok(output.parts.length >= 2, 'output.parts should have at least 2 items');

    const ctxText = output.parts[0].text;
    assert.ok(ctxText.startsWith('<bgsd-context>'), 'parts[0] should be bgsd-context');

    const workflowPart = output.parts[1];
    assert.ok(!workflowPart.text.includes('CI gate step content'), 'CI content should be elided');
    assert.ok(workflowPart.text.includes('Core execution step'), 'execute content should be preserved');

    // Verify elision_applied flag in bgsd-context
    const ctx = JSON.parse(ctxText.slice('<bgsd-context>'.length + 1, -'</bgsd-context>'.length - 1).trim());
    assert.strictEqual(ctx.elision_applied, true, 'elision_applied should be true in bgsd-context');
    assert.ok(ctx._elision, '_elision stats should be present');
    assert.strictEqual(ctx._elision.sections_elided, 1, 'should report 1 section elided');
  });

  it('integration: no elision when output.parts has no conditional markers', () => {
    const input = { command: 'bgsd-execute-phase', parts: ['bgsd-execute-phase'] };
    const output = {
      parts: [{
        type: 'text',
        text: '<!-- section: execute -->\nCore step.\n<!-- /section -->',
      }],
    };

    enrichCommand(input, output, tempDir);

    const ctxText = output.parts[0].text;
    const ctx = JSON.parse(ctxText.slice('<bgsd-context>'.length + 1, -'</bgsd-context>'.length - 1).trim());
    assert.strictEqual(ctx.elision_applied, undefined, 'elision_applied should not be set when no elision occurred');
  });

  it('integration: bgsd-context block not processed for elision', () => {
    // The bgsd-context block itself should not be scanned for section markers
    const input = { command: 'bgsd-execute-phase', parts: ['bgsd-execute-phase'] };
    const output = { parts: [] };

    enrichCommand(input, output, tempDir);

    // No workflow content in parts (starts empty), only bgsd-context block
    // Confirm enrichment worked and no errors
    assert.ok(output.parts.length > 0, 'output.parts should have context block');
    assert.ok(output.parts[0].text.startsWith('<bgsd-context>'), 'parts[0] is bgsd-context');
  });
});
