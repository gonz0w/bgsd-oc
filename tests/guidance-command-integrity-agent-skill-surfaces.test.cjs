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

const VALIDATOR_SURFACES = [
  {
    surface: 'agent',
    path: 'agents/bgsd-phase-researcher.md',
    content: 'Spawned by `/bgsd-plan phase 159 --research` (integrated) or `/bgsd-plan research 159` (standalone). Context comes from `/bgsd-plan discuss 159`.',
  },
  {
    surface: 'agent',
    path: 'agents/bgsd-planner.md',
    content: [
      'Standard planning uses `/bgsd-plan phase 159`.',
      'Niche research should use `/bgsd-plan research 159` before `/bgsd-plan phase 159`.',
      'Fix verification issues with `/bgsd-plan gaps 159`.',
    ].join('\n'),
  },
  {
    surface: 'agent',
    path: 'agents/bgsd-plan-checker.md',
    content: 'Plan checking runs after `/bgsd-plan phase 159` and validates context captured by `/bgsd-plan discuss 159`.',
  },
  {
    surface: 'agent',
    path: 'agents/bgsd-roadmapper.md',
    content: 'ROADMAP.md feeds `/bgsd-plan phase 159`.',
  },
  {
    surface: 'agent',
    path: 'agents/bgsd-verifier.md',
    content: 'Gap closure output should route to `/bgsd-plan gaps 159`.',
  },
  {
    surface: 'agent',
    path: 'agents/bgsd-codebase-mapper.md',
    content: 'Planning consumers load these docs from `/bgsd-plan phase 159` execution.',
  },
  {
    surface: 'skill',
    path: 'skills/continuation-format/SKILL.md',
    content: 'Phase complete next step: `/bgsd-plan phase 3`.',
  },
  {
    surface: 'skill',
    path: 'skills/model-profiles/SKILL.md',
    content: 'Switching profiles uses `/bgsd-settings profile quality`.',
  },
  {
    surface: 'skill',
    path: 'skills/raci/SKILL.md',
    content: [
      'This matrix uses reference-style route shapes for ownership only.',
      'Phase discussion uses `/bgsd-plan discuss 159`.',
      'Phase research uses `/bgsd-plan research 159`.',
      'Plan creation uses `/bgsd-plan phase 159`.',
      'Gap closure planning uses `/bgsd-plan gaps 159`.',
      'Progress reporting uses `/bgsd-inspect progress`.',
    ].join('\n'),
  },
];

describe('Phase 159 agent and skill guidance surfaces', () => {
  test('touched agents and skills prefer canonical executable commands', () => {
    const phaseResearcher = read('agents/bgsd-phase-researcher.md');
    const planner = read('agents/bgsd-planner.md');
    const checker = read('agents/bgsd-plan-checker.md');
    const roadmapper = read('agents/bgsd-roadmapper.md');
    const verifier = read('agents/bgsd-verifier.md');
    const mapper = read('agents/bgsd-codebase-mapper.md');
    const continuation = read('skills/continuation-format/SKILL.md');
    const profiles = read('skills/model-profiles/SKILL.md');
    const raci = read('skills/raci/SKILL.md');

    assert.match(phaseResearcher, /`\/bgsd-plan phase \[phase\] --research` \(integrated\) or `\/bgsd-plan research \[phase\]` \(standalone\)/);
    assert.doesNotMatch(phaseResearcher, /\/bgsd-plan-phase|\/bgsd-research-phase|\/bgsd-discuss-phase/);

    assert.match(planner, /`\/bgsd-plan phase \[phase\]` orchestrator \(standard phase planning\)/);
    assert.match(planner, /`\/bgsd-plan gaps \[phase\]` orchestrator \(gap closure from verification failures\)/);
    assert.match(planner, /suggest `\/bgsd-plan research \[phase\]` before `\/bgsd-plan phase \[phase\]`/);
    assert.doesNotMatch(planner, /\/bgsd-plan-phase|\/bgsd-research-phase|\/bgsd-discuss-phase/);

    assert.match(checker, /`\/bgsd-plan phase \[phase\]` orchestration/);
    assert.doesNotMatch(checker, /\/bgsd-plan-phase|\/bgsd-discuss-phase/);

    assert.match(roadmapper, /`\/bgsd-plan phase \[phase\]`/);
    assert.match(verifier, /`\/bgsd-plan gaps \[phase\]`/);
    assert.match(mapper, /`\/bgsd-plan phase \[phase\]`/);

    assert.match(continuation, /`\/bgsd-plan phase 3`/);
    assert.doesNotMatch(continuation, /`\/bgsd-plan-phase 3`/);

    assert.match(profiles, /`\/bgsd-settings profile quality`/);
    assert.doesNotMatch(profiles, /`\/bgsd-set-profile/);

    assert.match(raci, /\| phase-discussion \| User \| \/bgsd-plan discuss \[phase\] \| — \|/);
    assert.match(raci, /\| phase-research \| phase-researcher \| \/bgsd-plan research \[phase\] \| — \|/);
    assert.match(raci, /\| gap-closure-planning \| planner \| \/bgsd-plan gaps \[phase\] \| verifier, debugger \|/);
    assert.match(raci, /\| progress-reporting \| executor \| \/bgsd-inspect progress \| — \|/);
    assert.match(raci, /This matrix uses reference-style route shapes for ownership only\./);
    assert.doesNotMatch(raci, /\/bgsd-discuss-phase|\/bgsd-plan-phase(?!rs)|\/bgsd-set-profile|\/bgsd-progress/);
  });

  test('touched agents and skills pass the shared command integrity validator', () => {
    const result = validateCommandIntegrity({ cwd: ROOT, surfaces: VALIDATOR_SURFACES });

    assert.equal(
      result.valid,
      true,
      `Expected touched agent/skill surfaces to pass command validation, got:\n${JSON.stringify(result.groupedIssues, null, 2)}`
    );
  });

  test('skills/raci ownership table stays validator-clean with placeholder phase references', () => {
    const result = validateCommandIntegrity({
      cwd: ROOT,
      surfaces: [
        {
          surface: 'skill',
          path: 'skills/raci/SKILL.md',
          content: read('skills/raci/SKILL.md'),
        },
      ],
    });

    assert.equal(
      result.valid,
      true,
      `Expected skills/raci/SKILL.md to pass command validation, got:\n${JSON.stringify(result.groupedIssues, null, 2)}`
    );
  });
});
