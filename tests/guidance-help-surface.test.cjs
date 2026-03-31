'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const HELP_PATH = path.join(__dirname, '..', 'workflows', 'help.md');

function readHelp() {
  return fs.readFileSync(HELP_PATH, 'utf-8');
}

describe('help surface guidance contract', () => {
  test('main help is organized around a compact core path and advanced families', () => {
    const help = readHelp();

    assert.match(help, /## Core Path/, 'help should lead with a core path section');
    assert.match(help, /## Advanced Command Families/, 'help should keep deeper guidance under advanced families');
    assert.match(help, /4\. `\/bgsd-review` — scan the current change for code-review issues before shipping/, 'help should include /bgsd-review in the primary path');
    assert.doesNotMatch(help, /### Project Lifecycle/, 'help should not regress to the old flat project lifecycle menu');
    assert.doesNotMatch(help, /### Execution\s+[\s\S]*`\/bgsd-quick-task`/, 'help should not resurface the old execution menu with /bgsd-quick-task as a primary command');
  });

  test('main help examples stay canonical and runnable', () => {
    const help = readHelp();

    assert.match(help, /`\/bgsd-plan phase 12`/, 'help should show a canonical planning example with a concrete phase number');
    assert.match(help, /`\/bgsd-execute-phase 12`/, 'help should show an executable phase run example with a concrete phase number');
    assert.match(help, /`\/bgsd-inspect progress`/, 'help should route progress guidance through the canonical inspect family');
    assert.match(help, /`\/bgsd-plan roadmap insert 12 "Critical security fix"`/, 'help should include required arguments for roadmap insert examples');
    assert.match(help, /`\/bgsd-settings validate \.planning\/config\.json`/, 'help should include the concrete config path for validate examples');
    assert.doesNotMatch(help, /`\/bgsd-progress`/, 'help should not surface legacy progress guidance');
    assert.doesNotMatch(help, /`\/bgsd-plan-gaps`/, 'help should not surface legacy planning aliases');
    assert.doesNotMatch(help, /`\/bgsd-quick-task`/, 'help should not surface deprecated quick-task guidance on the main help surface');
  });
});
