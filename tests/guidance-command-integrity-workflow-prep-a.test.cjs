'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { validateCommandIntegrity } = require('../src/lib/commandDiscovery');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Phase 159 workflow prep A guidance integrity', () => {
  test('add-phase and add-todo keep canonical runnable guidance only', () => {
    const addPhase = read('workflows/add-phase.md');
    const addTodo = read('workflows/add-todo.md');

    assert.match(addPhase, /`\/bgsd-plan roadmap add "Add authentication"`/);
    assert.match(addPhase, /Usage: \/bgsd-plan roadmap add <description>/);
    assert.match(addPhase, /Example: \/bgsd-plan roadmap add "Add authentication system"/);
    assert.match(addPhase, /`\/bgsd-plan phase \{N\}`/);
    assert.match(addPhase, /`\/bgsd-plan roadmap add "<description>"` — add another phase/);
    assert.doesNotMatch(addPhase, /\/bgsd-add-phase/);

    assert.match(addTodo, /`\/bgsd-plan todo add "Add auth token refresh"`/);
    assert.match(addTodo, /View all todos \(\/bgsd-plan todo check\)/);
    assert.doesNotMatch(addTodo, /\/bgsd-add-todo|\/bgsd-check-todos/);
  });

  test('shared validator accepts the shipped add-phase and add-todo workflow surfaces', () => {
    const surfaces = [
      {
        surface: 'workflow',
        path: 'workflows/add-phase.md',
        content: read('workflows/add-phase.md'),
      },
      {
        surface: 'workflow',
        path: 'workflows/add-todo.md',
        content: read('workflows/add-todo.md'),
      },
    ];

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
