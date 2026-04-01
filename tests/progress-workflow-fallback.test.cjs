'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('progress workflow routed fallback', () => {
  test('progress rebuilds read-only context when bgsd-context is absent', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), 'workflows', 'progress.md'), 'utf-8');

    assert.match(workflow, /Treat this as a routed or copied command execution where the slash-command hook was bypassed/i);
    assert.match(workflow, /bgsd-tools\.cjs init:progress --raw/);
    assert.match(workflow, /Load progress context from `<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(workflow, /If no `<bgsd-context>` found:\*\* Stop and tell the user/i);
  });
});
