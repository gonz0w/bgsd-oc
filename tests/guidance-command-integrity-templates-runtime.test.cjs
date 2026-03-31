'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 159 template and runtime command integrity', () => {
  test('templates keep canonical commands with required arguments on known flows', () => {
    const discovery = read('templates/discovery.md');
    const uat = read('templates/UAT.md');
    const research = read('templates/research.md');
    const assertions = read('templates/assertions.md');

    assert.match(discovery, /`\/bgsd-plan research 12`/, 'discovery should show the canonical research command with a concrete phase argument');
    assert.doesNotMatch(discovery, /\/bgsd-research-phase/, 'discovery should not surface the legacy research alias');

    assert.match(research, /`\/bgsd-plan discuss 12`/, 'research should show the canonical discuss command with a concrete phase argument');
    assert.doesNotMatch(research, /\/bgsd-discuss-phase/, 'research should not surface the legacy discuss alias');

    assert.match(assertions, /`\/bgsd-plan phase 12`/, 'assertions should show the canonical phase planning command with a concrete phase argument');
    assert.doesNotMatch(assertions, /\/bgsd-plan-phase/, 'assertions should not surface the legacy phase alias');

    assert.match(uat, /`\/bgsd-plan gaps 12`/, 'UAT should show the canonical gaps command with a concrete phase argument');
    assert.doesNotMatch(uat, /\/bgsd-plan-phase --gaps/, 'UAT should not surface the legacy gap-planning alias');
  });

  test('runtime source and bundle stay aligned on canonical executable guidance', () => {
    const contextSource = read('src/plugin/tools/bgsd-context.js');
    const idleValidatorSource = read('src/plugin/idle-validator.js');
    const pluginBundle = read('plugin.js');

    const phaseAwarePattern = /const nextCommand = phaseNumber \? `\/bgsd-plan phase \$\{phaseNumber\}` : ["']\/bgsd-inspect progress["'];/;

    assert.match(contextSource, phaseAwarePattern, 'runtime source should include the current phase number in missing-plan guidance when known');
    assert.match(contextSource, /Run \$\{nextCommand\} to create plans\./, 'runtime source should render missing-plan guidance from the canonical next command');
    assert.doesNotMatch(contextSource, /\/bgsd-plan-phase/, 'runtime source should not regress to the legacy phase alias');

    assert.match(idleValidatorSource, /Next: \/bgsd-plan phase \$\{nextPhase\.number\}/, 'idle-validator should keep canonical next-phase guidance with a concrete phase number');
    assert.doesNotMatch(idleValidatorSource, /\/bgsd-plan-phase/, 'idle-validator should not regress to the legacy phase alias');

    assert.match(pluginBundle, phaseAwarePattern, 'plugin bundle should preserve the phase-aware canonical missing-plan command');
    assert.match(pluginBundle, /Run \$\{nextCommand\} to create plans\./, 'plugin bundle should stay aligned with runtime missing-plan guidance');
    assert.match(pluginBundle, /Next: \/bgsd-plan phase \$\{nextPhase\.number\}/, 'plugin bundle should stay aligned with runtime next-phase guidance');
    assert.doesNotMatch(pluginBundle, /\/bgsd-plan-phase/, 'plugin bundle should not ship the legacy phase alias on these surfaces');
  });
});

describe('Phase 165 repo-local runtime freshness contracts', () => {
  test('runtime freshness rules map plugin source edits to rebuilt local plugin output', () => {
    const helpers = read('src/lib/helpers.js');

    assert.match(helpers, /id: 'plugin-bundle'/, 'helpers should expose a dedicated plugin runtime freshness rule');
    assert.match(helpers, /sourcePrefixes: \['src\/plugin\/'\]/, 'plugin runtime freshness should watch src\/plugin edits');
    assert.match(helpers, /artifactPath: 'plugin\.js'/, 'plugin runtime freshness should point at the shipped plugin bundle');
    assert.match(helpers, /buildCommand: 'npm run build'/, 'plugin runtime freshness should teach the local rebuild command');
    assert.match(helpers, /Local runtime artifacts are stale for the active checkout\./, 'runtime freshness should explain the repo-local stale-checkout condition');
    assert.match(helpers, /before trusting deliverables verification\./, 'runtime freshness should require rebuild before trusting local verification output');
  });

  test('idle-validator source and bundle stay aligned on repo-local rebuild guidance', () => {
    const idleValidatorSource = read('src/plugin/idle-validator.js');
    const pluginBundle = read('plugin.js');

    for (const text of [idleValidatorSource, pluginBundle]) {
      assert.match(text, /Verify against this repo's current checkout/i, 'runtime guidance should point users to the repo-local checkout truth');
      assert.match(text, /rebuild the local runtime before trusting generated guidance if runtime surfaces changed/i, 'runtime guidance should require rebuild before trusting generated artifacts');
      assert.match(text, /Next: \/bgsd-plan phase \$\{nextPhase\.number\}/, 'runtime guidance should preserve the canonical next command');
    }
  });
});
