'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Phase 176 truth reconciliation', () => {
  test('Phase 176 truth reconciliation uses an explicit shared output context for the touched hotspot surfaces', () => {
    const outputContextPath = path.join(ROOT, 'src', 'lib', 'output-context.js');
    const routerSource = readRepoFile('src/router.js');
    const outputSource = readRepoFile('src/lib/output.js');
    const debugContractSource = readRepoFile('src/plugin/debug-contract.js');

    assert.equal(
      fs.existsSync(outputContextPath),
      true,
      'Phase 176 claimed shared output state encapsulation, so src/lib/output-context.js must exist'
    );

    assert.match(routerSource, /output-context/, 'router should route touched output state through output-context');
    assert.doesNotMatch(
      routerSource,
      /global\._gsd(?:OutputMode|RequestedFields|CompactMode|ManifestMode|DbNotices)/,
      'router should no longer touch the focused shared output globals directly'
    );

    assert.match(outputSource, /output-context/, 'output helpers should read shared state through output-context');
    assert.doesNotMatch(
      outputSource,
      /global\._gsd(?:OutputMode|RequestedFields|CompactMode)/,
      'output helpers should no longer read the focused shared output globals directly'
    );

    assert.match(debugContractSource, /output-context/, 'debug contract should read compact mode through output-context');
    assert.doesNotMatch(
      debugContractSource,
      /global\._gsdCompactMode/,
      'debug contract should no longer read compact mode from ambient globals directly'
    );
  });
});
