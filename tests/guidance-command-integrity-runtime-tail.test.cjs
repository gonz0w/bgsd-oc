'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 159 runtime guidance tail integrity', () => {
  test('runtime source uses canonical inspect guidance and avoids bare plan fallbacks', () => {
    const contextTool = read('src/plugin/tools/bgsd-context.js');
    const contextBuilder = read('src/plugin/context-builder.js');
    const commandEnricher = read('src/plugin/command-enricher.js');
    const planTool = read('src/plugin/tools/bgsd-plan.js');
    const notificationSource = read('src/plugin/notification.js');

    assert.match(contextTool, /phaseNumber\s*\?\s*`\/bgsd-plan phase \$\{phaseNumber\}`\s*:\s*'\/bgsd-inspect progress'/, 'missing-plan source should switch to inspect guidance when phase context is unavailable');
    assert.match(contextTool, /Run \$\{nextCommand\} to confirm the current phase before planning\./, 'missing-plan source should explain the inspect-first fallback');
    assert.doesNotMatch(contextTool, /'\/bgsd-plan phase'/, 'missing-plan source should not emit a bare planning command fallback');

    assert.match(contextBuilder, /\/bgsd-inspect health to diagnose\./, 'context builder should route state-load diagnostics through the canonical inspect health command');
    assert.doesNotMatch(contextBuilder, /\/bgsd-health/, 'context builder should not surface the stale health alias');

    assert.match(commandEnricher, /\/bgsd-inspect health to diagnose\./, 'command enricher should route diagnostics through inspect health');
    assert.doesNotMatch(commandEnricher, /\/bgsd-health/, 'command enricher should not surface the stale health alias');

    assert.match(planTool, /\/bgsd-inspect health to diagnose\./, 'plan tool should route roadmap parse diagnostics through inspect health');
    assert.doesNotMatch(planTool, /\/bgsd-health/, 'plan tool should not surface the stale health alias');

    assert.match(notificationSource, /not replayable by command/, 'notification source should mark DND summaries as informational instead of pointing to a nonexistent command');
    assert.doesNotMatch(notificationSource, /\/bgsd-notifications/, 'notification source should not surface the nonexistent notifications command');
  });

  test('rebuilt plugin bundle stays aligned with the runtime guidance fixes', () => {
    const pluginBundle = read('plugin.js');

    assert.match(pluginBundle, /phaseNumber\s*\?\s*[`'"]\\?\/bgsd-plan phase \$\{phaseNumber\}[`'"]\s*:\s*['"]\\?\/bgsd-inspect progress['"]/, 'plugin bundle should preserve the inspect-first fallback when phase context is unavailable');
    assert.match(pluginBundle, /Run \$\{nextCommand\} to confirm the current phase before planning\./, 'plugin bundle should preserve the inspect-first missing-plan message');
    assert.match(pluginBundle, /\/bgsd-inspect health to diagnose\./, 'plugin bundle should preserve canonical inspect health diagnostics');
    assert.match(pluginBundle, /not replayable by command/, 'plugin bundle should preserve the informational DND summary wording');

    assert.doesNotMatch(pluginBundle, /\/bgsd-health/, 'plugin bundle should not ship the stale health alias on this runtime slice');
    assert.doesNotMatch(pluginBundle, /\/bgsd-notifications/, 'plugin bundle should not ship the nonexistent notifications command on this runtime slice');
    assert.doesNotMatch(pluginBundle, /phaseNumber\s*\?\s*[`'"]\\?\/bgsd-plan phase \$\{phaseNumber\}[`'"]\s*:\s*['"]\\?\/bgsd-plan phase['"]/, 'plugin bundle should not regress to the bare planning fallback');
  });
});
