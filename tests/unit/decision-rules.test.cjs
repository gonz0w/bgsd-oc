/**
 * Phase 202-02: Kahn topological sort tests for resolvePhaseDependencies
 * RED phase - tests should fail until function is implemented
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resolvePhaseDependencies } = require('../../src/lib/decision-rules');

describe('resolvePhaseDependencies', () => {
  it('returns phases in wave order when no dependencies', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: null },
    ];
    const result = resolvePhaseDependencies({ phases });
    assert.strictEqual(result.value.verification.valid, true);
    assert.deepStrictEqual(result.value.waves, { '1': 1, '2': 1, '3': 1 });
  });

  it('assigns dependents to wave after their dependencies', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: ['1'] },
      { number: '3', depends_on: ['2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    assert.strictEqual(result.value.waves['1'], 1);
    assert.strictEqual(result.value.waves['2'], 2);
    assert.strictEqual(result.value.waves['3'], 3);
  });

  it('parallel phases in same wave when no interdependency', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: ['1', '2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    assert.strictEqual(result.value.waves['1'], 1);
    assert.strictEqual(result.value.waves['2'], 1);
    assert.strictEqual(result.value.waves['3'], 2);
  });

  it('detects cycle and returns valid: false', () => {
    const phases = [
      { number: '1', depends_on: ['3'] },
      { number: '2', depends_on: ['1'] },
      { number: '3', depends_on: ['2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    assert.strictEqual(result.value.verification.valid, false);
    assert.match(result.value.verification.errors[0], /cycle/i);
  });

  it('verification pass catches self-reference cycle', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: ['3'] }, // self-reference
    ];
    const result = resolvePhaseDependencies({ phases });
    // Self-reference cycle detected
    assert.strictEqual(result.value.verification.valid, false);
  });
});
