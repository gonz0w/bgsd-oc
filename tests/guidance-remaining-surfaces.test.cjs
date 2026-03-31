'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 158 remaining canonical guidance surfaces', () => {
  test('docs and help surfaces prefer canonical planning and settings families', () => {
    const commandsDoc = read('docs/commands.md');
    const helpWorkflow = read('workflows/help.md');

    assert.match(commandsDoc, /Auto-advance to canonical `\/bgsd-plan phase` after/, 'docs reference should point discuss auto-advance to the canonical phase subcommand');
    assert.match(commandsDoc, /Compatibility alias only — prefer canonical `\/bgsd-plan phase`\./, 'docs reference should demote /bgsd-plan-phase to compatibility-only wording');
    assert.match(commandsDoc, /Compatibility alias only — prefer canonical `\/bgsd-plan gaps`\./, 'docs reference should demote /bgsd-plan-gaps to compatibility-only wording');
    assert.match(commandsDoc, /Compatibility alias only — prefer canonical `\/bgsd-settings profile`\./, 'docs reference should demote /bgsd-set-profile to compatibility-only wording');
    assert.match(helpWorkflow, /\| `\/bgsd-plan gaps \[phase\]` \| Create phases from audit gaps \(`\/bgsd-plan-gaps` remains a compatibility alias\) \|/, 'help should surface the canonical gaps command and keep the legacy alias as compatibility-only');
    assert.doesNotMatch(helpWorkflow, /\| `\/bgsd-plan-gaps` \|/, 'help should not keep the legacy gaps alias as the primary surfaced command');
  });

  test('workflow follow-ups prefer canonical plan and settings commands', () => {
    const verifyWorkflow = read('workflows/verify-work.md');
    const milestoneWorkflow = read('workflows/new-milestone.md');
    const executeWorkflow = read('workflows/execute-phase.md');
    const settingsWorkflow = read('workflows/settings.md');

    assert.match(verifyWorkflow, /VERIFY_NEXT_COMMAND="\/bgsd-plan gaps \$\{PHASE\}"/, 'verify-work should route gap closure through /bgsd-plan gaps');
    assert.match(milestoneWorkflow, /Also: `\/bgsd-plan phase \[N\]` — skip discussion, plan directly \(`\/bgsd-plan-phase \[N\]` remains a compatibility alias\)/, 'new-milestone should recommend the canonical phase subcommand and demote the legacy alias');
    assert.match(executeWorkflow, /offer `\/bgsd-plan gaps \{X\}`/, 'execute-phase should offer the canonical gaps subcommand after gaps are found');
    assert.match(settingsWorkflow, /These settings apply to future \/bgsd-plan phase and \/bgsd-execute-phase runs\./, 'settings should reference the canonical planning family');
    assert.match(settingsWorkflow, /\/bgsd-settings profile <profile> — switch model profile \(`\/bgsd-set-profile` remains a compatibility alias\)/, 'settings should prefer /bgsd-settings profile and keep the legacy alias compatibility-only');
    assert.doesNotMatch(settingsWorkflow, /Quick commands:\n- \/bgsd-set-profile <profile>/, 'settings should not keep the legacy profile command as the primary quick command');
  });

  test('planning advisory source and bundle prefer canonical /bgsd-plan phase guidance', () => {
    const advisorySource = read('src/plugin/advisory-guardrails.js');
    const pluginBundle = read('plugin.js');

    assert.match(advisorySource, /'PLAN\.md': \['\/bgsd-plan phase'\]/, 'plugin advisory source should recommend the canonical planning-family command for PLAN.md edits');
    assert.doesNotMatch(advisorySource, /'PLAN\.md': \['\/bgsd-plan-phase'\]/, 'plugin advisory source should not regress to the legacy planning alias');
    assert.match(pluginBundle, /"PLAN\.md": \["\/bgsd-plan phase"\]/, 'plugin bundle should keep the canonical planning advisory in sync');
    assert.doesNotMatch(pluginBundle, /"PLAN\.md": \["\/bgsd-plan-phase"\]/, 'plugin bundle should not ship the legacy planning advisory');
  });
});
