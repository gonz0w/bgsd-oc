// E2E TDD Validator Test - Proves full RED→GREEN→REFACTOR cycle
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Find the bgsd-tools binary
function findBgsdTools() {
  const binPath = path.join(__dirname, '..', 'bin', 'bgsd-tools.cjs');
  if (fs.existsSync(binPath)) {
    return `node ${binPath}`;
  }
  // Fallback to project root
  const rootBin = path.join(__dirname, '..', '..', 'bin', 'bgsd-tools.cjs');
  if (fs.existsSync(rootBin)) {
    return `node ${rootBin}`;
  }
  throw new Error('bgsd-tools.cjs not found');
}

const BGSD_TOOLS = findBgsdTools();
const TEST_CMD = 'node test/fixture/calc.test.cjs';
const TEST_FILE = 'test/fixture/calc.test.cjs';
const CALC_FILE = 'test/fixture/calc.cjs';
const PHASE_DIR = '.planning/phases/206-tdd-validator-shipping';

describe('E2E TDD Validator', () => {
  let originalCalcContent;
  let originalTestContent;

  test('setup: backup original fixture files', () => {
    originalCalcContent = fs.readFileSync(path.join(__dirname, '..', CALC_FILE), 'utf8');
    originalTestContent = fs.readFileSync(path.join(__dirname, '..', TEST_FILE), 'utf8');
  });

  test('RED phase: validate-red detects semantic failure', () => {
    // Remove add() from calc.js to create RED state
    const redCalcContent = `// Fixture: Simple calculator module for TDD E2E testing
// RED phase: add() does not exist yet
module.exports = {
  // add: (a, b) => a + b,  // Commented out to simulate missing behavior
};`;
    fs.writeFileSync(path.join(__dirname, '..', CALC_FILE), redCalcContent);

    // Run validate-red with proper shell command
    const cmd = `${BGSD_TOOLS} execute:tdd validate-red --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
    const result = spawnSync(cmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const output = JSON.parse(result.stdout);
    
    assert.equal(output.stage, 'red', 'Stage should be red');
    assert.equal(output.failed, true, 'RED should fail');
    assert.equal(output.semanticFailure, true, 'Failure should be semantic');
    assert.notEqual(output.exitCode, 0, 'Exit code should be non-zero');
  });

  test('GREEN phase: validate-green detects passing tests', () => {
    // Restore add() to create GREEN state
    const greenCalcContent = `// Fixture: Simple calculator module for TDD E2E testing
// GREEN phase: add() is implemented
module.exports = {
  add: (a, b) => a + b,
};`;
    fs.writeFileSync(path.join(__dirname, '..', CALC_FILE), greenCalcContent);

    // Run validate-green with proper shell command
    const cmd = `${BGSD_TOOLS} execute:tdd validate-green --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
    const result = spawnSync(cmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const output = JSON.parse(result.stdout);
    
    assert.equal(output.stage, 'green', 'Stage should be green');
    assert.equal(output.passed, true, 'GREEN should pass');
    assert.equal(output.testFileUnmodified, true, 'Test file should be unmodified');
    assert.equal(output.exitCode, 0, 'Exit code should be zero');
  });

  test('REFACTOR phase: validate-refactor detects unchanged test count', () => {
    // Get test count from GREEN phase
    const greenCmd = `${BGSD_TOOLS} execute:tdd validate-green --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
    const greenResult = spawnSync(greenCmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const greenOutput = JSON.parse(greenResult.stdout);
    const prevCount = greenOutput.testCount;

    // Refactor: add a comment to calc.js (no behavior change)
    const refactorCalcContent = `// Fixture: Simple calculator module for TDD E2E testing
// REFACTOR phase: add() refactored with inline comment
module.exports = {
  // Simple addition - kept inline for clarity
  add: (a, b) => a + b,
};`;
    fs.writeFileSync(path.join(__dirname, '..', CALC_FILE), refactorCalcContent);

    // Run validate-refactor with proper shell command
    const cmd = `${BGSD_TOOLS} execute:tdd validate-refactor --test-cmd "${TEST_CMD}" --prev-count ${prevCount || 0} --json`;
    const result = spawnSync(cmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const output = JSON.parse(result.stdout);
    
    assert.equal(output.stage, 'refactor', 'Stage should be refactor');
    assert.equal(output.passed, true, 'REFACTOR should pass');
    assert.equal(output.countUnchanged, true, 'Test count should be unchanged');
    assert.equal(output.exitCode, 0, 'Exit code should be zero');
  });

  test('cleanup: restore original fixture files', () => {
    fs.writeFileSync(path.join(__dirname, '..', CALC_FILE), originalCalcContent);
    fs.writeFileSync(path.join(__dirname, '..', TEST_FILE), originalTestContent);
  });
});