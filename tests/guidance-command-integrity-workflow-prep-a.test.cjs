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

describe('Phase 175 sibling-route guidance integrity', () => {
  test('roadmap add|insert|remove surfaces teach canonical /bgsd-plan umbrella only', () => {
    const addPhase = read('workflows/add-phase.md');
    const insertPhase = read('workflows/insert-phase.md');
    const removePhase = read('workflows/remove-phase.md');

    // add-phase checks
    assert.match(addPhase, /`\/bgsd-plan roadmap add "Add authentication"`/);
    assert.match(addPhase, /Usage: \/bgsd-plan roadmap add <description>/);
    assert.match(addPhase, /Example: \/bgsd-plan roadmap add "Add authentication system"/);
    assert.match(addPhase, /`\/bgsd-plan phase \{N\}`/);
    assert.match(addPhase, /`\/bgsd-plan roadmap add "<description>"` — add another phase/);
    assert.doesNotMatch(addPhase, /\/bgsd-add-phase/);
    assert.doesNotMatch(addPhase, /\/bgsd-plan-phase/);

    // insert-phase checks
    assert.match(insertPhase, /`\/bgsd-plan roadmap insert \d+ .+`/);
    assert.match(insertPhase, /Usage: \/bgsd-plan roadmap insert <after> <description>/);
    assert.match(insertPhase, /Example: \/bgsd-plan roadmap insert 72 Fix critical auth bug/);
    assert.doesNotMatch(insertPhase, /\/bgsd-insert-phase/);
    assert.doesNotMatch(insertPhase, /\/bgsd-plan-phase/);

    // remove-phase checks
    assert.match(removePhase, /`\/bgsd-plan roadmap remove <phase-number>`/);
    assert.match(removePhase, /Usage: \/bgsd-plan roadmap remove <phase-number>/);
    assert.match(removePhase, /Example: \/bgsd-plan roadmap remove 17/);
    assert.doesNotMatch(removePhase, /\/bgsd-remove-phase/);
    assert.doesNotMatch(removePhase, /\/bgsd-plan-phase/);
  });

  test('todo add|check surfaces teach canonical /bgsd-plan umbrella only', () => {
    const addTodo = read('workflows/add-todo.md');
    const checkTodos = read('workflows/check-todos.md');

    // add-todo checks
    assert.match(addTodo, /`\/bgsd-plan todo add "Add auth token refresh"`/);
    assert.match(addTodo, /View all todos \(\/bgsd-plan todo check\)/);
    assert.doesNotMatch(addTodo, /\/bgsd-add-todo|\/bgsd-check-todos/);
    assert.doesNotMatch(addTodo, /\/bgsd-plan-todo/);

    // check-todos checks
    assert.match(checkTodos, /`\/bgsd-plan todo check`/);
    assert.match(checkTodos, /\/bgsd-plan todo check \[area\]/);
    assert.match(checkTodos, /\/bgsd-plan todo check api/);
    assert.doesNotMatch(checkTodos, /\/bgsd-check-todos/);
    assert.doesNotMatch(checkTodos, /\/bgsd-plan-todo/);
  });

  test('gaps surface teaches canonical /bgsd-plan gaps entrypoint', () => {
    const milestoneGaps = read('workflows/plan-milestone-gaps.md');

    assert.match(milestoneGaps, /`\/bgsd-plan gaps \{N\}`/);
    assert.match(milestoneGaps, /`\/bgsd-execute-phase \{N\} --gaps-only`/);
    assert.doesNotMatch(milestoneGaps, /`\/bgsd-plan phase \{N\}`|`\/bgsd-execute-phase \{N\}` — if plans already exist/);
  });

  test('shared validator accepts the shipped roadmap/todo/gaps workflow surfaces', () => {
    const surfaces = [
      { surface: 'workflow', path: 'workflows/add-phase.md', content: read('workflows/add-phase.md') },
      { surface: 'workflow', path: 'workflows/insert-phase.md', content: read('workflows/insert-phase.md') },
      { surface: 'workflow', path: 'workflows/remove-phase.md', content: read('workflows/remove-phase.md') },
      { surface: 'workflow', path: 'workflows/plan-milestone-gaps.md', content: read('workflows/plan-milestone-gaps.md') },
      { surface: 'workflow', path: 'workflows/add-todo.md', content: read('workflows/add-todo.md') },
      { surface: 'workflow', path: 'workflows/check-todos.md', content: read('workflows/check-todos.md') },
    ];

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
