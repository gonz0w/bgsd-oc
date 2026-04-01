'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function readWorkflow(name) {
  return fs.readFileSync(path.join(process.cwd(), 'workflows', name), 'utf-8');
}

describe('planning-family workflow routed fallbacks', () => {
  test('phase discussion and research workflows rebuild context when bgsd-context is absent', () => {
    const plan = readWorkflow('plan-phase.md');
    const discuss = readWorkflow('discuss-phase.md');
    const research = readWorkflow('research-phase.md');

    assert.match(plan, /routed or copied `\/bgsd-plan phase` execution/i);
    assert.match(plan, /bgsd-tools\.cjs init:plan-phase "\$\{PHASE\}" --raw/);
    assert.match(plan, /Load planning context from `<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(plan, /If no `<bgsd-context>` found:\*\* Stop and tell the user/i);

    assert.match(discuss, /routed or copied `\/bgsd-plan discuss` execution/i);
    assert.match(discuss, /bgsd-tools\.cjs init:phase-op "\$\{PHASE\}" --raw/);
    assert.match(discuss, /Load phase discussion context from `<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(discuss, /<skill:bgsd-context-init\s*\/>/i);

    assert.match(research, /routed or copied `\/bgsd-plan research` execution/i);
    assert.match(research, /bgsd-tools\.cjs init:plan-phase "\$\{PHASE\}" --raw/);
    assert.match(research, /Load research context from `<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(research, /If no `<bgsd-context>` found:\*\* Stop and tell the user/i);
  });

  test('roadmap mutation workflows rebuild context through canonical init commands', () => {
    const add = readWorkflow('add-phase.md');
    const insert = readWorkflow('insert-phase.md');
    const remove = readWorkflow('remove-phase.md');

    assert.match(add, /routed or copied `\/bgsd-plan roadmap add` execution/i);
    assert.match(add, /bgsd-tools\.cjs init:progress --raw/);
    assert.match(add, /`<bgsd-context>` JSON or `BGSD_CONTEXT`/);

    assert.match(insert, /routed or copied `\/bgsd-plan roadmap insert` execution/i);
    assert.match(insert, /bgsd-tools\.cjs init:progress --raw/);
    assert.match(insert, /`<bgsd-context>` JSON or `BGSD_CONTEXT`/);

    assert.match(remove, /routed or copied `\/bgsd-plan roadmap remove` execution/i);
    assert.match(remove, /bgsd-tools\.cjs init:phase-op "\$\{target\}" --raw/);
    assert.match(remove, /`<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(remove, /If no `<bgsd-context>` found:\*\* Stop and tell the user/i);
  });

  test('todo workflows rebuild todo context when routed through /bgsd-plan', () => {
    const addTodo = readWorkflow('add-todo.md');
    const checkTodos = readWorkflow('check-todos.md');

    assert.match(addTodo, /routed or copied `\/bgsd-plan todo add` execution/i);
    assert.match(addTodo, /bgsd-tools\.cjs init:todos --raw/);
    assert.match(addTodo, /`<bgsd-context>` JSON or `BGSD_CONTEXT`/);

    assert.match(checkTodos, /routed or copied `\/bgsd-plan todo check` execution/i);
    assert.match(checkTodos, /Extract optional `AREA` from the first argument in `\$ARGUMENTS`/);
    assert.match(checkTodos, /bgsd-tools\.cjs init:todos "\$\{AREA\}" --raw/);
    assert.match(checkTodos, /bgsd-tools\.cjs init:todos --raw/);
    assert.match(checkTodos, /`<bgsd-context>` JSON or `BGSD_CONTEXT`/);
    assert.doesNotMatch(checkTodos, /If no `<bgsd-context>` found:\*\* Stop and tell the user/i);
  });
});
