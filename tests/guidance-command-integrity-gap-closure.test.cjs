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

describe('Phase 159 gap-closure command guidance integrity', () => {
  test('exact shipped gap-closure surfaces keep canonical commands or explicit reference-only wording', () => {
    const gettingStarted = read('docs/getting-started.md');
    const milestones = read('docs/milestones.md');
    const expertGuide = read('docs/expert-guide.md');
    const researchWorkflow = read('workflows/research-phase.md');
    const milestoneGaps = read('workflows/plan-milestone-gaps.md');
    const stateTemplate = read('templates/state.md');
    const phaseArgumentSkill = read('skills/phase-argument-parsing/SKILL.md');
    const scopeSkill = read('skills/planner-scope-estimation/SKILL.md');
    const githubCiAgent = read('agents/bgsd-github-ci.md');

    assert.match(gettingStarted, /\/bgsd-inspect progress/);
    assert.match(gettingStarted, /`\/bgsd-plan phase 2`/);
    assert.match(gettingStarted, /node bin\/bgsd-tools\.cjs execute:trajectory checkpoint auth-flow/);
    assert.match(gettingStarted, /node bin\/bgsd-tools\.cjs util:memory write --store trajectories/);
    assert.doesNotMatch(gettingStarted, /\/bgsd-progress|\/bgsd-plan-phase|node bin\/gsd-tools\.cjs/);

    assert.match(milestones, /`bgsd-tools execute:trajectory checkpoint <name>`/);
    assert.match(milestones, /`bgsd-tools util:git rewind --ref <ref>`/);
    assert.match(milestones, /`bgsd-tools plan:milestone complete`/);
    assert.doesNotMatch(milestones, /`gsd-tools /);

    assert.match(expertGuide, /node bin\/bgsd-tools\.cjs plan:intent show/);
    assert.match(expertGuide, /\/bgsd-plan todo add "Fix the edge case in user validation"/);
    assert.match(expertGuide, /node bin\/bgsd-tools\.cjs execute:trajectory compare auth-strategy/);
    assert.match(expertGuide, /node bin\/bgsd-tools\.cjs util:git trajectory-branch --phase 5 --slug auth-refactor/);
    assert.match(expertGuide, /node bin\/bgsd-tools\.cjs verify:quality --phase 1 --raw/);
    assert.doesNotMatch(expertGuide, /\/bgsd-add-todo|\/bgsd-check-todos|node bin\/gsd-tools\.cjs/);

    assert.match(researchWorkflow, /`\/bgsd-plan phase <phase-number>`/);
    assert.match(researchWorkflow, /Use \/bgsd-inspect progress to see available phases\./);
    assert.doesNotMatch(researchWorkflow, /\/bgsd-progress/);

    assert.match(milestoneGaps, /`\/bgsd-plan gaps \{N\}`/);
    assert.match(milestoneGaps, /`\/bgsd-execute-phase \{N\} --gaps-only`/);
    assert.doesNotMatch(milestoneGaps, /`\/bgsd-plan phase \{N\}`|`\/bgsd-execute-phase \{N\}` — if plans already exist/);

    assert.match(stateTemplate, /`\/bgsd-plan todo add "\.\.\."`/);
    assert.match(stateTemplate, /\/bgsd-plan todo check/);
    assert.doesNotMatch(stateTemplate, /\/bgsd-add-todo|\/bgsd-check-todos/);

    assert.match(phaseArgumentSkill, /description: Phase argument parsing and normalization — .*`bgsd-tools plan:find-phase` route/);
    assert.match(phaseArgumentSkill, /### Using `bgsd-tools plan:find-phase` \(Recommended\)/);
    assert.doesNotMatch(phaseArgumentSkill, /validation via bgsd-tools find-phase/);

    assert.match(scopeSkill, /bgsd-tools verify:verify plan-wave <phase-dir>/);
    assert.match(scopeSkill, /bgsd-tools util:estimate-scope <plan-path>/);
    assert.doesNotMatch(scopeSkill, /bgsd-tools verify:plan-wave <phase-dir>/);

    assert.match(githubCiAgent, /using the current namespaced CLI routes/);
  });

  test('shared validator accepts the exact shipped gap-closure surfaces', () => {
    const surfaces = [
      'docs/getting-started.md',
      'docs/milestones.md',
      'docs/expert-guide.md',
      'workflows/research-phase.md',
      'workflows/plan-milestone-gaps.md',
      'templates/state.md',
      'skills/phase-argument-parsing/SKILL.md',
      'skills/planner-scope-estimation/SKILL.md',
      'agents/bgsd-github-ci.md',
    ].map((relativePath) => ({
      surface: relativePath.startsWith('docs/') ? 'docs'
        : relativePath.startsWith('workflows/') ? 'workflow'
        : relativePath.startsWith('templates/') ? 'template'
        : relativePath.startsWith('skills/') ? 'skill'
        : 'agent',
      path: relativePath,
      content: read(relativePath),
    }));

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
