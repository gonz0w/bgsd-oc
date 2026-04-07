// E2E TDD Gate Hardening Test - Proves validate-tdd-plan, enhanced GREEN/REFACTOR gates
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

describe('E2E TDD Gate Hardening', () => {
  let originalCalcContent;
  let originalTestContent;

  test('setup: backup original fixture files', () => {
    originalCalcContent = fs.readFileSync(path.join(__dirname, '..', CALC_FILE), 'utf8');
    originalTestContent = fs.readFileSync(path.join(__dirname, '..', TEST_FILE), 'utf8');
  });

  describe('validate-tdd-plan', () => {
    test('validate-tdd-plan accepts well-formed type:tdd plans', () => {
      const cmd = `${BGSD_TOOLS} execute:tdd validate-tdd-plan --plan-file .planning/phases/209-tdd-gate-hardening/209-01-PLAN.md --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.valid === true || output.skipped === true, true, 'Plan should be valid or skipped');
    });

    test('validate-tdd-plan rejects non-type:tdd plans', () => {
      const cmd = `${BGSD_TOOLS} execute:tdd validate-tdd-plan --plan-file .planning/PROJECT.md --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.skipped, true, 'Non-tdd plans should be skipped');
    });
  });

  describe('validate-green with mtime+size fast path', () => {
    test('GREEN fast path: method is mtime+size when file unchanged', () => {
      const cmd = `${BGSD_TOOLS} execute:tdd validate-green --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.stage, 'green', 'Stage should be green');
      assert.equal(output.passed, true, 'GREEN should pass');
      assert.equal(output.method, 'mtime+size', 'Fast path should be used');
      assert.equal(output.testFileUnmodified, true, 'Test file should be unmodified');
    });

    test('GREEN returns structured proof with required fields', () => {
      const cmd = `${BGSD_TOOLS} execute:tdd validate-green --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.stage, 'green', 'Stage should be green');
      assert.equal(typeof output.testFileUnmodified, 'boolean', 'testFileUnmodified should be boolean');
      assert.equal(typeof output.method, 'string', 'method should be string');
      assert.ok(['mtime+size', 'semantic-diff'].includes(output.method), 'method should be mtime+size or semantic-diff');
    });
  });

  describe('validate-refactor with test count verification', () => {
    test('REFACTOR passes when test count matches prev-count', () => {
      const greenCmd = `${BGSD_TOOLS} execute:tdd validate-green --test-cmd "${TEST_CMD}" --test-file "${TEST_FILE}" --json`;
      const greenResult = spawnSync(greenCmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const greenOutput = JSON.parse(greenResult.stdout);
      const prevCount = greenOutput.testCount;

      const cmd = `${BGSD_TOOLS} execute:tdd validate-refactor --test-cmd "${TEST_CMD}" --prev-count ${prevCount} --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.stage, 'refactor', 'Stage should be refactor');
      assert.equal(output.countUnchanged, true, 'Test count should match');
    });

    test('REFACTOR fails when test count does not match prev-count', () => {
      const cmd = `${BGSD_TOOLS} execute:tdd validate-refactor --test-cmd "${TEST_CMD}" --prev-count 999 --json`;
      const result = spawnSync(cmd, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const output = JSON.parse(result.stdout);
      assert.equal(output.stage, 'refactor', 'Stage should be refactor');
      assert.equal(output.countUnchanged, false, 'Test count should not match');
    });
  });

  test('cleanup: restore original fixture files', () => {
    fs.writeFileSync(path.join(__dirname, '..', CALC_FILE), originalCalcContent);
    fs.writeFileSync(path.join(__dirname, '..', TEST_FILE), originalTestContent);
  });
});