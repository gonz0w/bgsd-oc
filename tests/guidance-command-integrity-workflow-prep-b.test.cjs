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

describe('Phase 159 discuss-phase workflow-prep guidance', () => {
  test('discuss-phase keeps canonical progress and discuss guidance', () => {
    const discuss = read('workflows/discuss-phase.md');

    assert.match(discuss, /Use \/bgsd-inspect progress to see available phases\./);
    assert.match(discuss, /reference-style standalone `\/bgsd-plan discuss \[phase\]` behavior/);
    assert.match(discuss, /--next-command "\/bgsd-plan research \$\{PHASE\}"/);
    assert.doesNotMatch(discuss, /\/bgsd-progress|\/bgsd-discuss-phase/);
    assert.doesNotMatch(discuss, /standalone `\/bgsd-plan discuss` behavior/);
  });

  test('shared validator accepts the exact shipped discuss-phase workflow', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'workflow',
          path: 'workflows/discuss-phase.md',
          content: read('workflows/discuss-phase.md'),
        },
      ],
    });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
