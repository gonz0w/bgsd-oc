'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 158 documentation guidance gaps', () => {
  test('architecture and operational docs prefer canonical planning and settings commands', () => {
    const architecture = read('docs/architecture.md');
    const planningSystem = read('docs/planning-system.md');
    const agents = read('docs/agents.md');
    const configuration = read('docs/configuration.md');
    const troubleshooting = read('docs/troubleshooting.md');

    assert.match(architecture, /\/bgsd-plan phase 1/, 'architecture should show the canonical phase planning command');
    assert.doesNotMatch(architecture, /\/bgsd-plan-phase 1/, 'architecture should not keep the legacy phase alias as the example');
    assert.match(planningSystem, /\/bgsd-plan phase N/, 'planning-system should use the canonical phase planning command in the artifact flow');
    assert.doesNotMatch(planningSystem, /\/bgsd-plan-phase N/, 'planning-system should not regress to the legacy phase alias');
    assert.match(agents, /\*\*Spawned by:\*\* `\/bgsd-plan phase`, `\/bgsd-quick`/, 'agents should show the canonical planner spawn command');
    assert.match(agents, /\*\*Spawned by:\*\* `\/bgsd-plan phase` \(when `plan_checker` enabled\)/, 'agents should show the canonical plan-checker spawn command');
    assert.match(agents, /\*\*Spawned by:\*\* `\/bgsd-plan phase --research`, `\/bgsd-plan research`/, 'agents should show canonical research entrypoints');
    assert.doesNotMatch(agents, /\*\*Spawned by:\*\* `\/bgsd-plan-phase`/, 'agents should not keep /bgsd-plan-phase as the primary spawn command');
    assert.match(configuration, /\/bgsd-settings profile quality\s+# Quick model switch/, 'configuration should use the canonical settings profile command');
    assert.doesNotMatch(configuration, /\/bgsd-set-profile quality/, 'configuration should not keep /bgsd-set-profile as the quick-switch example');
    assert.match(troubleshooting, /\/bgsd-plan phase 1 --skip-verify/, 'troubleshooting should use the canonical phase planning command for skip-verify guidance');
    assert.doesNotMatch(troubleshooting, /\/bgsd-plan-phase 1 --skip-verify/, 'troubleshooting should not keep the legacy phase alias in the primary fix guidance');
  });

  test('expert guide prefers canonical planning and gap commands', () => {
    const expertGuide = read('docs/expert-guide.md');

    assert.match(expertGuide, /```\n\/bgsd-plan phase 1\n```/, 'expert guide should teach /bgsd-plan phase as the main planning step');
    assert.match(expertGuide, /Only executes plans created by `\/bgsd-plan gaps`/, 'expert guide should route gaps-only execution through the canonical gaps command');
    assert.match(expertGuide, /```\n\/bgsd-plan gaps\s+# Creates fix phases for all gaps\n```/, 'expert guide should use /bgsd-plan gaps for milestone gap closure');
    assert.match(expertGuide, /\/bgsd-plan phase 1 --research\s+# Plan with domain research/, 'expert guide examples should use canonical research planning');
    assert.match(expertGuide, /\/bgsd-plan gaps 1\s+# Plan fixes for gaps/, 'expert guide examples should use the canonical phase gap-planning command');
    assert.match(expertGuide, /\/bgsd-plan gaps\s+# Fix any integration gaps/, 'expert guide examples should use the canonical milestone gaps command');
    assert.doesNotMatch(expertGuide, /\/bgsd-plan-phase 1(?! --auto)/, 'expert guide should not keep legacy /bgsd-plan-phase examples on these evidence surfaces');
    assert.doesNotMatch(expertGuide, /\/bgsd-plan-gaps/, 'expert guide should not keep /bgsd-plan-gaps as the primary gaps guidance');
  });
});
