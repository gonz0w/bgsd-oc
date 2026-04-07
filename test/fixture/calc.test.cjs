// Fixture: Tests for calc module TDD E2E testing
const { test } = require('node:test');
const assert = require('node:assert');
const { add } = require('./calc.cjs');

test('add returns sum', () => {
  assert.equal(add(2, 3), 5);
});

test('add handles zero', () => {
  assert.equal(add(0, 0), 0);
});

test('add handles negative numbers', () => {
  assert.equal(add(-1, -1), -2);
});