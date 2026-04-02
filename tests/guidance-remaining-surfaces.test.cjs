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
  test('docs and help surfaces prefer canonical planning and settings families only', () => {
    const commandsDoc = read('docs/commands.md');
    const helpWorkflow = read('workflows/help.md');

    assert.match(commandsDoc, /Preferred canonical command families:/, 'docs reference should keep the canonical family heading');
    assert.match(helpWorkflow, /\/bgsd-plan gaps/, 'help should surface the canonical gaps command');
    assert.doesNotMatch(helpWorkflow, /\/bgsd-plan-gaps/, 'help should not keep the removed gaps alias on the primary help surface');
  });

  test('workflow follow-ups prefer canonical plan and settings commands', () => {
    const verifyWorkflow = read('workflows/verify-work.md');
    const milestoneWorkflow = read('workflows/new-milestone.md');
    const executeWorkflow = read('workflows/execute-phase.md');
    const settingsWorkflow = read('workflows/settings.md');

    assert.match(verifyWorkflow, /VERIFY_NEXT_COMMAND="\/bgsd-inspect progress"/, 'verify-work should route clean completion through /bgsd-inspect progress');
    assert.match(verifyWorkflow, /VERIFY_NEXT_COMMAND="\/bgsd-plan gaps \$\{PHASE\}"/, 'verify-work should route gap closure through /bgsd-plan gaps');
    assert.match(executeWorkflow, /offer `\/bgsd-plan gaps \{X\}`/, 'execute-phase should offer the canonical gaps subcommand after gaps are found');
    assert.match(executeWorkflow, /Do not surface a separate transition command\./, 'execute-phase should keep transition inside the execute flow');
    assert.match(settingsWorkflow, /These settings apply to future \/bgsd-plan phase and \/bgsd-execute-phase runs\./, 'settings should reference the canonical planning family');
    assert.match(settingsWorkflow, /\/bgsd-settings profile <profile> — switch the selected project profile/, 'settings should prefer /bgsd-settings profile');
    assert.doesNotMatch(settingsWorkflow, /\/bgsd-set-profile/, 'settings should not keep the removed profile alias');
  });

  test('planning advisory source and bundle prefer canonical /bgsd-plan phase guidance', () => {
    const advisorySource = read('src/plugin/advisory-guardrails.js');
    const pluginBundle = read('plugin.js');

    assert.match(advisorySource, /'PLAN\.md': \['\/bgsd-plan phase \[phase\]'\]/, 'plugin advisory source should recommend the canonical planning-family command for PLAN.md edits');
    assert.doesNotMatch(advisorySource, /'PLAN\.md': \['\/bgsd-plan-phase'\]/, 'plugin advisory source should not regress to the legacy planning alias');
    assert.match(pluginBundle, /"PLAN\.md": \["\/bgsd-plan phase \[phase\]"\]/, 'plugin bundle should keep the canonical planning advisory in sync');
    assert.doesNotMatch(pluginBundle, /"PLAN\.md": \["\/bgsd-plan-phase"\]/, 'plugin bundle should not ship the legacy planning advisory');
  });
});
