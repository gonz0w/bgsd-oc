'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { validateCommandIntegrity } = require('../src/lib/commandDiscovery');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 159 skill tail command guidance integrity', () => {
  test('remaining skill surfaces use current canonical command forms', () => {
    const dependencyGraph = read('skills/planner-dependency-graph/SKILL.md');
    const skillIndex = read('skills/skill-index/SKILL.md');

    assert.match(dependencyGraph, /bgsd-tools verify:verify plan-wave <phase-dir>/);
    assert.doesNotMatch(dependencyGraph, /bgsd-tools verify:plan-wave <phase-dir>/);

    assert.match(skillIndex, /phase-argument-parsing \| shared \| planner, executor, verifier, roadmapper \| Phase argument parsing and normalization — .*`bgsd-tools plan:find-phase` route/);
    assert.doesNotMatch(skillIndex, /validation via bgsd-tools find-phase/);
  });

  test('shared validator accepts the exact shipped skill tail surfaces', () => {
    const surfaces = [
      'skills/planner-dependency-graph/SKILL.md',
      'skills/skill-index/SKILL.md',
    ].map((relativePath) => ({
      surface: 'skill',
      path: relativePath,
      content: read(relativePath),
    }));

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
