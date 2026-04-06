// Fixture: Simple calculator module for TDD E2E testing
// RED phase: add() does not exist yet - tests will fail
// GREEN phase: add() is implemented - tests pass
// REFACTOR phase: add() is refactored - tests still pass

module.exports = {
  add: (a, b) => a + b,
};