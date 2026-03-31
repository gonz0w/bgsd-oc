'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function readDoc(name) {
  return fs.readFileSync(path.join(process.cwd(), 'docs', name), 'utf-8');
}

describe('Phase 158 canonical docs guidance', () => {
  test('getting started teaches canonical planning-family commands', () => {
    const gettingStarted = readDoc('getting-started.md');

    assert.match(gettingStarted, /Next up: \/bgsd-plan phase 1/);
    assert.match(gettingStarted, /```\n\/bgsd-plan phase 1\n```/);
    assert.match(gettingStarted, /Routes to `\/bgsd-plan phase`/);
    assert.match(gettingStarted, /\/bgsd-plan phase 2/);
    assert.match(gettingStarted, /\/bgsd-plan phase 1 --skip-research/);
    assert.match(gettingStarted, /`\/bgsd-plan-phase`, treat it as a compatibility alias for canonical `\/bgsd-plan phase`/);
    assert.doesNotMatch(gettingStarted, /Next up: \/bgsd-plan-phase 1/);
    assert.doesNotMatch(gettingStarted, /```\n\/bgsd-plan-phase 1\n```/);
  });

  test('workflows reference page prefers canonical planning and settings families', () => {
    const workflows = readDoc('workflows.md');

    assert.match(workflows, /User types \/bgsd-plan phase 1/);
    assert.match(workflows, /\| `plan-phase\.md` \| `\/bgsd-plan phase` \|/);
    assert.match(workflows, /\| `discuss-phase\.md` \| `\/bgsd-plan discuss` \|/);
    assert.match(workflows, /\| `research-phase\.md` \| `\/bgsd-plan research` \|/);
    assert.match(workflows, /\| `plan-milestone-gaps\.md` \| `\/bgsd-plan gaps` \|/);
    assert.match(workflows, /\| `set-profile\.md` \| `\/bgsd-settings profile` \|/);
    assert.match(workflows, /\/bgsd-plan phase:\n  Spawn gsd-planner/);
    assert.match(workflows, /Legacy names like `\/bgsd-plan-phase` still resolve as compatibility aliases/);
    assert.match(workflows, /Legacy names like `\/bgsd-set-profile` remain compatibility aliases only/);
    assert.doesNotMatch(workflows, /\| `plan-phase\.md` \| `\/bgsd-plan-phase` \|/);
    assert.doesNotMatch(workflows, /\| `plan-milestone-gaps\.md` \| `\/bgsd-plan-gaps` \|/);
    assert.doesNotMatch(workflows, /\| `set-profile\.md` \| `\/bgsd-set-profile` \|/);
  });
});
