'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 158 workflow guidance gaps', () => {
  test('lifecycle and phase-management workflows use canonical planning-family follow-ups', () => {
    const transition = read('workflows/transition.md');
    const insertPhase = read('workflows/insert-phase.md');
    const milestoneGaps = read('workflows/plan-milestone-gaps.md');
    const addPhase = read('workflows/add-phase.md');

    assert.match(transition, /CONTEXT\.md → `\/bgsd-plan phase \[X\+1\] --auto`, else `\/bgsd-plan discuss \[X\+1\] --auto`/, 'transition should use canonical discuss and phase follow-ups');
    assert.match(transition, /`\/bgsd-plan discuss \[X\+1\]` \(no context\) or `\/bgsd-plan phase \[X\+1\]` \(has context\)/, 'transition should keep canonical interactive next-step guidance');
    assert.doesNotMatch(transition, /\/bgsd-plan-phase \[X\+1\]|\/bgsd-discuss-phase \[X\+1\]/, 'transition should not regress to legacy top-level planning aliases');
    assert.match(insertPhase, /`\/bgsd-plan phase \{decimal_phase\}`/, 'insert-phase should point users to /bgsd-plan phase for direct follow-up planning');
    assert.match(insertPhase, /Don't create plans yet \(that's \/bgsd-plan phase\)/, 'insert-phase should name the canonical planning command in anti-pattern guidance');
    assert.doesNotMatch(insertPhase, /\/bgsd-plan-phase \{decimal_phase\}/, 'insert-phase should not keep the legacy planning alias as the next step');
    assert.match(milestoneGaps, /`\/bgsd-plan phase \{N\}`/, 'plan-milestone-gaps should route the next step through /bgsd-plan phase');
    assert.match(milestoneGaps, /User knows to run `\/bgsd-plan phase` next/, 'plan-milestone-gaps should teach the canonical planning command');
    assert.doesNotMatch(milestoneGaps, /\/bgsd-plan-phase \{N\}|`\/bgsd-plan-phase`/, 'plan-milestone-gaps should not keep /bgsd-plan-phase as the primary next step');
    assert.match(addPhase, /`\/bgsd-plan phase \{N\}`/, 'add-phase should point to the canonical planning-family command');
    assert.doesNotMatch(addPhase, /`\/bgsd-plan-phase \{N\}`/, 'add-phase should not regress to the legacy planning alias');
  });

  test('resume, debug, and audit workflows use canonical discuss, phase, and gaps commands', () => {
    const resumeProject = read('workflows/resume-project.md');
    const assumptions = read('workflows/list-phase-assumptions.md');
    const debugWorkflow = read('workflows/debug.md');
    const auditMilestone = read('workflows/audit-milestone.md');

    assert.match(resumeProject, /`\/bgsd-plan phase \[N\]`/, 'resume-project should route direct planning through /bgsd-plan phase');
    assert.match(resumeProject, /\*\*Also available:\*\* `\/bgsd-plan discuss \[N\]`/, 'resume-project should route discussion follow-up through /bgsd-plan discuss');
    assert.doesNotMatch(resumeProject, /\/bgsd-plan-phase \[N\]|\/bgsd-discuss-phase \[N\]/, 'resume-project should not regress to legacy planning aliases');
    assert.match(assumptions, /Plan this phase \(\/bgsd-plan phase \$\{PHASE\}\) - Create detailed execution plans/, 'list-phase-assumptions should use /bgsd-plan phase for the planning next step');
    assert.doesNotMatch(assumptions, /Plan this phase \(\/bgsd-plan-phase \$\{PHASE\}\)/, 'list-phase-assumptions should not keep /bgsd-plan-phase as the suggested planning command');
    assert.match(debugWorkflow, /"Plan fix" - suggest \/bgsd-plan gaps/, 'debug should suggest /bgsd-plan gaps for fix planning');
    assert.doesNotMatch(debugWorkflow, /\/bgsd-plan-phase --gaps/, 'debug should not suggest the legacy gap-planning form');
    assert.match(auditMilestone, /Next: `\/bgsd-plan gaps`/, 'audit-milestone should point gap follow-up to /bgsd-plan gaps');
    assert.match(auditMilestone, /Options: A\) `\/bgsd-complete-milestone \{version\}` B\) `\/bgsd-plan gaps`/, 'audit-milestone tech-debt route should keep the canonical gaps command');
    assert.doesNotMatch(auditMilestone, /\/bgsd-plan-gaps/, 'audit-milestone should not keep /bgsd-plan-gaps as the primary gap command');
  });
});
