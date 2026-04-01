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

describe('Phase 159 remaining surfaced guidance integrity', () => {
  test('exact shipped remaining surfaces keep canonical executable guidance', () => {
    const commandsDoc = read('docs/commands.md');
    const workflowsDoc = read('docs/workflows.md');
    const planPhase = read('workflows/plan-phase.md');
    const researchPhase = read('workflows/research-phase.md');
    const assumptionsPhase = read('workflows/list-phase-assumptions.md');

    assert.match(commandsDoc, /Reference-style planning-family index:/);
    assert.match(commandsDoc, /`phase`, `discuss`, `research`, and `assumptions` are family labels inside `\/bgsd-plan`, not runnable shorthand\./);
    assert.match(commandsDoc, /`\/bgsd-plan phase 159 --research`/);
    assert.doesNotMatch(commandsDoc, /`\/bgsd-plan 159`/);

    assert.match(workflowsDoc, /User types \/bgsd-plan phase 1/);
    assert.match(workflowsDoc, /`\/bgsd-plan assumptions <phase>`/);
    assert.match(workflowsDoc, /`\/bgsd-plan discuss <phase>`/);
    assert.match(workflowsDoc, /`\/bgsd-plan research <phase>`/);
    assert.match(workflowsDoc, /`\/bgsd-plan phase <phase>`/);
    assert.match(workflowsDoc, /`\/bgsd-inspect progress`/);
    assert.match(workflowsDoc, /`\/bgsd-plan roadmap add "Description"`/);
    assert.match(workflowsDoc, /Reference-only compatibility note:/);
    assert.doesNotMatch(workflowsDoc, /\| `list-phase-assumptions\.md` \| `\/bgsd-list-assumptions` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `progress\.md` \| `\/bgsd-progress` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `plan-phase\.md` \| `\/bgsd-plan phase \[phase\]` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `discuss-phase\.md` \| `\/bgsd-plan discuss \[phase\]` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `list-phase-assumptions\.md` \| `\/bgsd-plan assumptions \[phase\]` \|/);
    assert.doesNotMatch(workflowsDoc, /\| `research-phase\.md` \| `\/bgsd-plan research \[phase\]` \|/);

    assert.match(planPhase, /Use \/bgsd-inspect progress to see available phases\./);
    assert.match(planPhase, /routed or copied `\/bgsd-plan phase <phase-number>` execution/);
    assert.match(planPhase, /Reference-only compatibility note/);
    assert.doesNotMatch(planPhase, /Use \/bgsd-progress to see available phases\./);
    assert.doesNotMatch(planPhase, /routed or copied `\/bgsd-plan phase` execution/);

    assert.match(researchPhase, /Usage: \/bgsd-plan research <phase-number>/);
    assert.match(researchPhase, /routed or copied `\/bgsd-plan research <phase-number>` execution/);
    assert.doesNotMatch(researchPhase, /routed or copied `\/bgsd-plan research` execution/);

    assert.match(assumptionsPhase, /Usage: \/bgsd-plan assumptions <phase-number>/);
    assert.match(assumptionsPhase, /Use \/bgsd-inspect progress to see available phases\./);
    assert.doesNotMatch(assumptionsPhase, /Usage: \/bgsd-plan assumptions \[phase-number\]/);
  });

  test('shared validator accepts the exact shipped remaining surfaces', () => {
    const surfaces = [
      'docs/commands.md',
      'docs/workflows.md',
      'workflows/plan-phase.md',
      'workflows/research-phase.md',
      'workflows/list-phase-assumptions.md',
    ].map((relativePath) => ({
      surface: relativePath.endsWith('.md') ? 'docs' : 'runtime',
      path: relativePath,
      content: read(relativePath),
    }));

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
