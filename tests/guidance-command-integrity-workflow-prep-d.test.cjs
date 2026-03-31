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

describe('Phase 159 workflow prep D guidance integrity', () => {
  test('new-milestone keeps canonical runnable guidance and reference-only metadata', () => {
    const newMilestone = read('workflows/new-milestone.md');

    assert.match(newMilestone, /Check for MILESTONE-CONTEXT\.md \(reference-only: created by the milestone discuss flow, not a standalone command\)/);
    assert.match(newMilestone, /`\/bgsd-plan discuss \[N\]`/);
    assert.match(newMilestone, /Also: `\/bgsd-plan phase \[N\]` — skip discussion, plan directly/);
    assert.doesNotMatch(newMilestone, /\/bgsd-discuss-milestone|\/bgsd-plan-phase \[N\]/);
  });

  test('shared validator accepts the shipped new-milestone workflow surface', () => {
    const surfaces = [
      {
        surface: 'workflow',
        path: 'workflows/new-milestone.md',
        content: read('workflows/new-milestone.md'),
      },
    ];

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
