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

describe('Phase 159 workflow prep guidance slice C', () => {
  test('check-todos and new-project keep canonical executable guidance', () => {
    const checkTodos = read('workflows/check-todos.md');
    const newProject = read('workflows/new-project.md');

    assert.match(checkTodos, /\/bgsd-plan todo add/, 'check-todos should point todo capture to the canonical planning-family route');
    assert.match(checkTodos, /\/bgsd-inspect progress/, 'check-todos should route status follow-up through inspect progress');
    assert.match(checkTodos, /\/bgsd-plan todo check(?: \[area\]| api)?/, 'check-todos should keep canonical todo check guidance');
    assert.match(checkTodos, /\/bgsd-plan roadmap add \[description from todo\]/, 'check-todos should route phase creation through the canonical roadmap family');
    assert.doesNotMatch(checkTodos, /\/bgsd-add-todo|\/bgsd-check-todos|\/bgsd-progress|\/bgsd-add-phase/, 'check-todos should not surface stale todo, progress, or add-phase aliases as runnable guidance');

    assert.match(newProject, /use `\/bgsd-inspect progress`/, 'new-project should point existing projects to inspect progress');
    assert.match(newProject, /`\/bgsd-plan discuss 1 --auto`/, 'new-project should keep the canonical auto next step');
    assert.match(newProject, /`\/bgsd-plan discuss 1`/, 'new-project should keep the canonical interactive next step');
    assert.doesNotMatch(newProject, /\/bgsd-progress/, 'new-project should not surface the stale progress alias');
  });

  test('validator accepts the touched workflow prep slice', () => {
    const surfaces = [
      {
        surface: 'workflow',
        path: 'workflows/check-todos.md',
        content: read('workflows/check-todos.md'),
      },
      {
        surface: 'workflow',
        path: 'workflows/new-project.md',
        content: read('workflows/new-project.md'),
      },
    ];

    const result = validateCommandIntegrity({ cwd: ROOT, surfaces });

    assert.equal(result.valid, true, JSON.stringify(result.groupedIssues, null, 2));
    assert.equal(result.issueCount, 0);
  });
});
