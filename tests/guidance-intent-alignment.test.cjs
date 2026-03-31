'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

describe('Phase 160 intent-alignment guidance contract', () => {
  test('verifier-facing surfaces lock verdict names, fallback wording, and core-miss rule', () => {
    const verifier = read('agents/bgsd-verifier.md');
    const execute = read('workflows/execute-phase.md');
    const report = read('templates/verification-report.md');

    for (const content of [verifier, execute, report]) {
      assert.match(content, /aligned \| partial \| misaligned/i);
      assert.match(content, /not assessed|unavailable/i);
      assert.match(content, /core expected user change did not land/i);
      assert.match(content, /cannot be `partial`|must be `misaligned`/i);
      assert.match(content, /Intent Alignment/i);
      assert.match(content, /Requirements? Coverage/i);
    }
  });

  test('UAT guidance keeps intent alignment separate from requirement coverage with explicit fallback', () => {
    const workflow = read('workflows/verify-work.md');
    const template = read('templates/UAT.md');

    assert.match(workflow, /separate Intent Alignment judgment/i);
    assert.match(workflow, /aligned`, `partial`, or `misaligned`/i);
    assert.match(workflow, /not assessed\s*\/ unavailable|not assessed|unavailable/i);
    assert.match(workflow, /before or alongside Requirement Coverage/i);

    assert.match(template, /## Intent Alignment/);
    assert.match(template, /verdict: aligned \| partial \| misaligned \| not assessed/i);
    assert.match(template, /## Requirement Coverage/);
    assert.match(template, /separate_from_intent_alignment: true/);
    assert.match(template, /core expected user change did not land|do not use `partial`/i);
  });

  test('templates present intent alignment before requirement coverage', () => {
    const report = read('templates/verification-report.md');
    const uat = read('templates/UAT.md');

    assert.ok(report.indexOf('## Intent Alignment') < report.indexOf('## Requirements Coverage'));
    assert.ok(uat.indexOf('## Intent Alignment') < uat.indexOf('## Requirement Coverage'));
  });
});
