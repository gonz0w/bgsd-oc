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

describe('Phase 159 workflow planning-prep guidance', () => {
  test('workflow surfaces use canonical planning-family commands with concrete phase arguments', () => {
    const newProject = read('workflows/new-project.md');
    const newMilestone = read('workflows/new-milestone.md');
    const progress = read('workflows/progress.md');
    const assumptions = read('workflows/list-phase-assumptions.md');
    const discuss = read('workflows/discuss-phase.md');
    const research = read('workflows/research-phase.md');

    assert.match(newProject, /`\/bgsd-plan discuss 1 --auto`/, 'new-project should auto-advance with the canonical discuss command');
    assert.match(newProject, /`\/bgsd-plan discuss 1`/, 'new-project should show the canonical interactive discuss command');
    assert.doesNotMatch(newProject, /\/bgsd-discuss-phase 1/, 'new-project should not keep the legacy discuss alias');

    assert.match(newMilestone, /`\/bgsd-plan discuss \[N\]`/, 'new-milestone should point the next step to /bgsd-plan discuss');
    assert.match(newMilestone, /Also: `\/bgsd-plan phase \[N\]` — skip discussion, plan directly/, 'new-milestone should keep direct planning on the canonical phase subcommand');
    assert.doesNotMatch(newMilestone, /\/bgsd-discuss-phase \[N\]|\/bgsd-plan-phase \[N\]/, 'new-milestone should not surface legacy planning-prep aliases');

    assert.match(progress, /`\/bgsd-plan discuss \{phase\}` — gather context and clarify approach/, 'progress should route missing-context follow-up through /bgsd-plan discuss');
    assert.match(progress, /- `\/bgsd-plan assumptions \{phase\}` — see the agent's assumptions/, 'progress should route assumptions follow-up through /bgsd-plan assumptions');
    assert.match(progress, /`\/bgsd-plan discuss \{Z\+1\}` — gather context and clarify approach/, 'progress should use /bgsd-plan discuss for next-phase follow-up');
    assert.doesNotMatch(progress, /\/bgsd-discuss-phase \{phase\}|\/bgsd-discuss-phase \{Z\+1\}|\/bgsd-list-assumptions \{phase\}/, 'progress should not surface legacy planning-prep aliases');

    assert.match(assumptions, /Usage: \/bgsd-plan assumptions \[phase-number\]/, 'list-phase-assumptions should advertise the canonical assumptions command');
    assert.match(assumptions, /Example: \/bgsd-plan assumptions 3/, 'list-phase-assumptions should keep the phase number in its canonical example');
    assert.match(assumptions, /Discuss context \(\/bgsd-plan discuss \$\{PHASE\}\)/, 'list-phase-assumptions should offer /bgsd-plan discuss as the next step');
    assert.doesNotMatch(assumptions, /\/bgsd-list-assumptions|\/bgsd-discuss-phase/, 'list-phase-assumptions should not keep legacy planning-prep aliases');

    assert.match(discuss, /reference-style standalone `\/bgsd-plan discuss \[phase\]` behavior/, 'discuss should describe the canonical standalone entrypoint');
    assert.match(discuss, /--next-command "\/bgsd-plan research \$\{PHASE\}"/, 'discuss handoff guidance should point to canonical research routing');
    assert.doesNotMatch(discuss, /\/bgsd-discuss-phase|\/bgsd-research-phase/, 'discuss should not keep legacy discuss or research aliases');

    assert.match(research, /Usage: \/bgsd-plan research <phase-number>/, 'research should advertise the canonical research command');
    assert.match(research, /Example: \/bgsd-plan research 92/, 'research should keep the required phase number in its canonical example');
    assert.doesNotMatch(research, /\/bgsd-research-phase/, 'research should not keep the legacy research alias');
  });

  test('workflow and persisted handoff surfaces pass the shared command-integrity validator', () => {
    const surfaces = [
      {
        surface: 'workflow',
        path: 'workflows/new-project.md',
        content: 'Auto: `/bgsd-plan discuss 1 --auto`. Interactive: `/bgsd-plan discuss 1`.',
      },
      {
        surface: 'workflow',
        path: 'workflows/new-milestone.md',
        content: 'Next: `/bgsd-plan discuss 159`. Also: `/bgsd-plan phase 159`.',
      },
      {
        surface: 'workflow',
        path: 'workflows/progress.md',
        content: 'No context: `/bgsd-plan discuss 159`. Also available: `/bgsd-plan phase 159` and `/bgsd-plan assumptions 159`. Next phase: `/bgsd-plan discuss 160` and `/bgsd-plan phase 160`.',
      },
      {
        surface: 'workflow',
        path: 'workflows/list-phase-assumptions.md',
        content: 'Usage: `/bgsd-plan assumptions 159`. Next: `/bgsd-plan discuss 159` and `/bgsd-plan phase 159`.',
      },
      {
        surface: 'workflow',
        path: 'workflows/discuss-phase.md',
        content: 'Durable handoff next command: `/bgsd-plan research 159`.',
      },
      {
        surface: 'runtime',
        path: 'src/commands/init.js',
        content: 'Resume summary uses `/bgsd-plan research 159` and restart guidance uses `/bgsd-plan discuss 159`.',
      },
      {
        surface: 'workflow',
        path: 'workflows/research-phase.md',
        content: 'Usage: `/bgsd-plan research 92`. For integrated planning use `/bgsd-plan phase 92`.',
      },
      {
        surface: 'handoff',
        path: '.planning/phase-handoffs/159/discuss.json',
        content: read('.planning/phase-handoffs/159/discuss.json'),
      },
    ];

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, 'expected validator to accept the canonical workflow and handoff examples');
    assert.equal(result.issueCount, 0, 'expected no validator issues on touched workflow and handoff surfaces');

    const handoff = JSON.parse(read('.planning/phase-handoffs/159/discuss.json'));
    assert.equal(handoff.resume_target.next_command, '/bgsd-plan research 159', 'discuss handoff should persist the canonical research follow-up with the concrete phase number');
  });
});
