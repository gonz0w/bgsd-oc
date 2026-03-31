'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { validateCommandIntegrity } = require('../src/lib/commandDiscovery');

const ROOT = path.join(__dirname, '..');
const DOC_FILES = [
  'docs/commands.md',
  'docs/planning-system.md',
  'docs/troubleshooting.md',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Phase 159 documentation command integrity', () => {
  test('full shipped blocker docs keep canonical-only executable guidance', () => {
    const commands = read('docs/commands.md');
    const planningSystem = read('docs/planning-system.md');
    const troubleshooting = read('docs/troubleshooting.md');

    assert.match(commands, /\/bgsd-plan discuss 159/);
    assert.match(commands, /\/bgsd-plan assumptions 159/);
    assert.match(commands, /\/bgsd-plan research 159/);
    assert.match(commands, /Reference-style planning-family index:/);
    assert.match(commands, /\/bgsd-plan roadmap add "Add export functionality"/);
    assert.match(commands, /\/bgsd-settings profile quality/);
    assert.match(commands, /Canonical route: `\/bgsd-inspect progress`/);
    assert.match(commands, /Canonical inspection route: `\/bgsd-inspect health`/);
    assert.match(commands, /Canonical route: `\/bgsd-inspect search decisions <query>`/);
    assert.match(commands, /Canonical route: `\/bgsd-inspect search lessons <query>`/);
    assert.match(commands, /Canonical route: `\/bgsd-inspect trace <req-id>`/);
    assert.match(commands, /node bin\/bgsd-tools\.cjs util:validate-commands --raw/);
    assert.doesNotMatch(commands, /`\/bgsd-plan (?:assumptions|discuss|research|phase)`/);
    assert.doesNotMatch(commands, /\/bgsd-(discuss-phase|list-assumptions|research-phase|plan-phase|plan-gaps|set-profile|quick-task|add-phase|insert-phase|remove-phase)/);
    assert.match(commands, /## Direct CLI \(`bgsd-tools\.cjs`\)/);

    assert.match(planningSystem, /from \/bgsd-plan discuss 37/);
    assert.match(planningSystem, /from \/bgsd-plan research 37/);
    assert.match(planningSystem, /\/bgsd-inspect trace REQ-01/);
    assert.match(planningSystem, /\/bgsd-inspect search decisions "database"/);
    assert.match(planningSystem, /\/bgsd-inspect search lessons "auth"/);
    assert.doesNotMatch(planningSystem, /\/bgsd-(discuss-phase|research-phase)/);
    assert.doesNotMatch(planningSystem, /\/bgsd-context-budget/);
    assert.doesNotMatch(planningSystem, /\/bgsd-(trace|search-decisions|search-lessons)/);

    assert.match(troubleshooting, /\/bgsd-plan discuss 1/);
    assert.match(troubleshooting, /\/bgsd-plan assumptions 1/);
    assert.match(troubleshooting, /\/bgsd-inspect health/);
    assert.match(troubleshooting, /\/bgsd-inspect progress/);
    assert.match(troubleshooting, /node bin\/bgsd-tools\.cjs plan:find-phase <N>/);
    assert.doesNotMatch(troubleshooting, /\/bgsd-(discuss-phase|list-assumptions)/);
    assert.doesNotMatch(troubleshooting, /\/bgsd-(rollback-info|context-budget)/);
    assert.doesNotMatch(troubleshooting, /\/bgsd-(health|progress)/);
  });

  test('shared validator accepts the exact shipped blocker docs', () => {
    const surfaces = DOC_FILES.map((relativePath) => ({
      surface: 'docs',
      path: relativePath,
      content: read(relativePath),
    }));

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });
    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
