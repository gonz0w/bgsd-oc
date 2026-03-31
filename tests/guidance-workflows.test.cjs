'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROGRESS_PATH = path.join(ROOT, 'workflows', 'progress.md');
const DISCUSS_PATH = path.join(ROOT, 'workflows', 'discuss-phase.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('canonical workflow guidance for planning follow-ups', () => {
  test('progress workflow prefers canonical planning-family follow-ups', () => {
    const workflow = read(PROGRESS_PATH);

    assert.match(workflow, /`\/bgsd-plan phase \{phase-number\}`/, 'progress should send ready-to-plan users to the canonical phase subcommand');
    assert.match(workflow, /- `\/bgsd-plan phase \{phase\}` — skip discussion, plan directly/, 'progress should keep skip-discussion guidance on the canonical phase subcommand');
    assert.match(workflow, /`\/bgsd-plan gaps \{phase\}`/, 'progress should send gap-planning guidance to the canonical gaps subcommand');
    assert.match(workflow, /- `\/bgsd-plan phase \{Z\+1\}` — skip discussion, plan directly/, 'progress should use the canonical phase subcommand for next-phase planning');
    assert.match(workflow, /offer `\/bgsd-plan phase \[next\]`/, 'progress edge-case guidance should mention the canonical phase subcommand');
    assert.doesNotMatch(workflow, /`\/bgsd-plan-phase \{phase-number\}`/, 'progress should not keep the legacy phase alias as the preferred ready-to-plan path');
    assert.doesNotMatch(workflow, /`\/bgsd-plan-phase \{phase\} --gaps`/, 'progress should not keep the legacy gap-planning alias as the preferred gap path');
  });

  test('discuss workflow prefers canonical planning-family follow-ups and auto-advance prompts', () => {
    const workflow = read(DISCUSS_PATH);

    assert.match(workflow, /`\/bgsd-plan phase \$\{PHASE\}`/, 'discuss should point the next step to the canonical phase subcommand');
    assert.match(workflow, /- `\/bgsd-plan phase \$\{PHASE\} --skip-research` — plan without research/, 'discuss should keep skip-research guidance on the canonical phase subcommand');
    assert.match(workflow, /Run \/bgsd-plan phase \$\{PHASE\} --auto\./, 'discuss auto-advance should invoke the canonical phase subcommand');
    assert.match(workflow, /Auto-advance stopped: Planning needs input\. \/bgsd-plan phase \$\{PHASE\}/, 'discuss checkpoint messaging should point back to the canonical phase subcommand');
    assert.doesNotMatch(workflow, /`\/bgsd-plan-phase \$\{PHASE\}`/, 'discuss should not keep the legacy alias as the preferred next step');
    assert.doesNotMatch(workflow, /Run \/bgsd-plan-phase \$\{PHASE\} --auto\./, 'discuss auto-advance should not prefer the legacy alias');
  });
});
