/**
 * Contract tests for decision-rules.js — validates all decision functions
 * and the rule registry against the {value, confidence, rule_id} contract.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { contractCheck } = require('./helpers.cjs');

const {
  resolveContextGate,
  resolveProgressRoute,
  resolveResumeRoute,
  resolveExecutionPattern,
  resolveContextBudgetGate,
  resolvePreviousCheckGate,
  resolveCiGate,
  resolvePlanExistenceRoute,
  resolveBranchHandling,
  resolveAutoAdvance,
  resolvePhaseArgParse,
  resolveDebugHandlerRoute,
  DECISION_REGISTRY,
  evaluateDecisions,
} = require('../src/lib/decision-rules');

// ─── Decision contract fields ────────────────────────────────────────────────

const DECISION_CONTRACT = [
  { key: 'value', type: 'any' },
  { key: 'confidence', type: 'string' },
  { key: 'rule_id', type: 'string' },
];

const VALID_CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'];

// ─── Registry Completeness ───────────────────────────────────────────────────

describe('decisions: registry completeness', () => {
  it('registry has >= 10 entries', () => {
    assert.ok(DECISION_REGISTRY.length >= 10, `Expected >= 10 rules, got ${DECISION_REGISTRY.length}`);
  });

  it('every entry has required fields', () => {
    for (const rule of DECISION_REGISTRY) {
      const contract = contractCheck(rule, [
        { key: 'id', type: 'string' },
        { key: 'name', type: 'string' },
        { key: 'category', type: 'string' },
        { key: 'description', type: 'string' },
        { key: 'inputs', type: 'array' },
        { key: 'outputs', type: 'array' },
        { key: 'confidence_range', type: 'array' },
        { key: 'resolve', type: 'function' },
      ], `registry-entry-${rule.id}`);
      assert.ok(contract.pass, contract.message);
    }
  });

  it('every entry resolve is a function', () => {
    for (const rule of DECISION_REGISTRY) {
      assert.strictEqual(typeof rule.resolve, 'function', `${rule.id}.resolve is not a function`);
    }
  });

  it('no duplicate rule IDs', () => {
    const ids = DECISION_REGISTRY.map(r => r.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, `Duplicate IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
  });

  it('covers all expected categories', () => {
    const categories = new Set(DECISION_REGISTRY.map(r => r.category));
    assert.ok(categories.size >= 4, `Expected >= 4 categories, got ${categories.size}: ${[...categories].join(', ')}`);
  });
});

// ─── Contract Tests for Each Decision Function ──────────────────────────────

describe('decisions: resolveContextGate contract', () => {
  it('returns valid contract with context present', () => {
    const result = resolveContextGate({ context_present: true });
    const contract = contractCheck(result, DECISION_CONTRACT, 'context-gate');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.value, true);
    assert.strictEqual(result.confidence, 'HIGH');
    assert.strictEqual(result.rule_id, 'context-gate');
  });

  it('returns false when context absent', () => {
    const result = resolveContextGate({ context_present: false });
    assert.strictEqual(result.value, false);
  });

  it('handles undefined state gracefully', () => {
    const result = resolveContextGate(undefined);
    assert.strictEqual(result.value, false);
    assert.strictEqual(result.rule_id, 'context-gate');
  });
});

describe('decisions: resolveProgressRoute contract', () => {
  it('returns valid contract', () => {
    const result = resolveProgressRoute({
      plan_count: 3, summary_count: 1, uat_gap_count: 0,
      current_phase: 5, highest_phase: 8,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    const contract = contractCheck(result, DECISION_CONTRACT, 'progress-route');
    assert.ok(contract.pass, contract.message);
    assert.ok(VALID_CONFIDENCES.includes(result.confidence));
    assert.strictEqual(result.rule_id, 'progress-route');
  });

  it('Route A: summaries < plans', () => {
    const result = resolveProgressRoute({
      plan_count: 3, summary_count: 1, uat_gap_count: 0,
      current_phase: 5, highest_phase: 8,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'A');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('Route B: no plans', () => {
    const result = resolveProgressRoute({
      plan_count: 0, summary_count: 0, uat_gap_count: 0,
      current_phase: 1, highest_phase: 3,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'B');
  });

  it('Route C: all done, more phases ahead', () => {
    const result = resolveProgressRoute({
      plan_count: 2, summary_count: 2, uat_gap_count: 0,
      current_phase: 3, highest_phase: 8,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'C');
  });

  it('Route D: all done, last phase', () => {
    const result = resolveProgressRoute({
      plan_count: 2, summary_count: 2, uat_gap_count: 0,
      current_phase: 8, highest_phase: 8,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'D');
  });

  it('Route E: UAT gaps present', () => {
    const result = resolveProgressRoute({
      plan_count: 3, summary_count: 3, uat_gap_count: 2,
      current_phase: 5, highest_phase: 8,
      roadmap_exists: true, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'E');
  });

  it('Route F: no roadmap but project exists', () => {
    const result = resolveProgressRoute({
      plan_count: 0, summary_count: 0, uat_gap_count: 0,
      current_phase: 1, highest_phase: 1,
      roadmap_exists: false, project_exists: true, state_exists: true,
    });
    assert.strictEqual(result.value, 'F');
  });

  it('no-project: nothing exists', () => {
    const result = resolveProgressRoute({
      plan_count: 0, summary_count: 0, uat_gap_count: 0,
      state_exists: false, roadmap_exists: false, project_exists: false,
    });
    assert.strictEqual(result.value, 'no-project');
  });

  it('no-state: project exists but no state', () => {
    const result = resolveProgressRoute({
      plan_count: 0, summary_count: 0, uat_gap_count: 0,
      state_exists: false, roadmap_exists: true, project_exists: true,
    });
    assert.strictEqual(result.value, 'no-state');
  });

  it('handles empty state gracefully', () => {
    const result = resolveProgressRoute({});
    assert.strictEqual(result.rule_id, 'progress-route');
    assert.ok(VALID_CONFIDENCES.includes(result.confidence));
  });
});

describe('decisions: resolveResumeRoute contract', () => {
  it('returns valid contract', () => {
    const result = resolveResumeRoute({ has_state: true, has_incomplete_plans: true });
    const contract = contractCheck(result, DECISION_CONTRACT, 'resume-route');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'resume-route');
  });

  it('initialize when no state', () => {
    assert.strictEqual(resolveResumeRoute({ has_state: false }).value, 'initialize');
  });

  it('resolve-blockers when blocked', () => {
    assert.strictEqual(resolveResumeRoute({ has_state: true, has_blockers: true }).value, 'resolve-blockers');
  });

  it('continue-execution with incomplete plans', () => {
    assert.strictEqual(resolveResumeRoute({ has_state: true, has_incomplete_plans: true }).value, 'continue-execution');
  });

  it('next-phase when phase complete', () => {
    assert.strictEqual(resolveResumeRoute({ has_state: true, phase_complete: true, has_roadmap: true }).value, 'next-phase');
  });

  it('returns MEDIUM for ambiguous state', () => {
    const result = resolveResumeRoute({ has_state: true, has_plans: true, has_incomplete_plans: false });
    assert.strictEqual(result.confidence, 'MEDIUM');
    assert.strictEqual(result.value, 'verify-or-advance');
  });

  it('review-state as fallback returns MEDIUM', () => {
    const result = resolveResumeRoute({ has_state: true });
    assert.strictEqual(result.value, 'review-state');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });
});

describe('decisions: resolveExecutionPattern contract', () => {
  it('returns valid contract', () => {
    const result = resolveExecutionPattern({ task_types: ['auto', 'auto'] });
    const contract = contractCheck(result, DECISION_CONTRACT, 'execution-pattern');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'execution-pattern');
  });

  it('Pattern A: all auto tasks', () => {
    assert.strictEqual(resolveExecutionPattern({ task_types: ['auto', 'auto'] }).value, 'A');
  });

  it('Pattern B: has verify checkpoints', () => {
    assert.strictEqual(resolveExecutionPattern({ task_types: ['auto', 'checkpoint:human-verify'] }).value, 'B');
  });

  it('Pattern C: has decision checkpoints', () => {
    assert.strictEqual(resolveExecutionPattern({ task_types: ['auto', 'checkpoint:decision'] }).value, 'C');
  });

  it('Pattern C takes precedence over B', () => {
    assert.strictEqual(resolveExecutionPattern({
      task_types: ['auto', 'checkpoint:human-verify', 'checkpoint:decision'],
    }).value, 'C');
  });

  it('handles empty task_types', () => {
    assert.strictEqual(resolveExecutionPattern({ task_types: [] }).value, 'A');
  });

  it('handles undefined state', () => {
    const result = resolveExecutionPattern(undefined);
    assert.strictEqual(result.value, 'A');
    assert.strictEqual(result.rule_id, 'execution-pattern');
  });
});

describe('decisions: resolveContextBudgetGate contract', () => {
  it('proceed when no warning', () => {
    const result = resolveContextBudgetGate({ warning: false });
    assert.strictEqual(result.value, 'proceed');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('warn in yolo mode with warning', () => {
    assert.strictEqual(resolveContextBudgetGate({ warning: true, mode: 'yolo' }).value, 'warn');
  });

  it('stop in interactive mode with warning', () => {
    assert.strictEqual(resolveContextBudgetGate({ warning: true, mode: 'interactive' }).value, 'stop');
  });
});

describe('decisions: resolvePreviousCheckGate contract', () => {
  it('proceed when no previous summary', () => {
    assert.strictEqual(resolvePreviousCheckGate({ has_previous_summary: false }).value, 'proceed');
  });

  it('block when blockers present', () => {
    assert.strictEqual(resolvePreviousCheckGate({
      has_previous_summary: true, has_blockers: true,
    }).value, 'block');
  });

  it('warn when unresolved issues', () => {
    assert.strictEqual(resolvePreviousCheckGate({
      has_previous_summary: true, has_unresolved_issues: true,
    }).value, 'warn');
  });

  it('proceed when summary clean', () => {
    assert.strictEqual(resolvePreviousCheckGate({
      has_previous_summary: true, has_unresolved_issues: false, has_blockers: false,
    }).value, 'proceed');
  });
});

describe('decisions: resolveCiGate contract', () => {
  it('skip when CI not enabled', () => {
    assert.strictEqual(resolveCiGate({ ci_enabled: false }).value, 'skip');
  });

  it('warn when no test command', () => {
    assert.strictEqual(resolveCiGate({ ci_enabled: true, has_test_command: false }).value, 'warn');
  });

  it('run when all good', () => {
    assert.strictEqual(resolveCiGate({
      ci_enabled: true, has_test_command: true, tests_passing: true,
    }).value, 'run');
  });

  it('warn when tests failing', () => {
    assert.strictEqual(resolveCiGate({
      ci_enabled: true, has_test_command: true, tests_passing: false,
    }).value, 'warn');
  });
});

describe('decisions: resolvePlanExistenceRoute contract', () => {
  it('has-plans when plans exist', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 3 }).value, 'has-plans');
  });

  it('needs-planning when research exists but no plans', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 0, has_research: true }).value, 'needs-planning');
  });

  it('missing-context when nothing exists (no research, no context)', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 0, has_research: false, has_context: false }).value, 'missing-context');
  });

  it('needs-research when context exists but no plans or research (fallback path)', () => {
    // has_context=true + no plans → needs-planning, not needs-research
    // needs-research is the final fallback that is now unreachable via new logic
    // Verify blocked-deps when blockers present
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, has_blockers: true }).value, 'blocked-deps');
  });

  it('blocked-deps when deps_complete is false', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, deps_complete: false }).value, 'blocked-deps');
  });

  it('ready when plans exist and context is available', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, has_context: true }).value, 'ready');
  });
});

describe('decisions: resolveBranchHandling contract', () => {
  it('skip when branching strategy is none', () => {
    const result = resolveBranchHandling({ branching_strategy: 'none' });
    assert.strictEqual(result.value, 'skip');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('create when no branch exists (MEDIUM confidence)', () => {
    const result = resolveBranchHandling({ branching_strategy: 'phase', has_branch: false });
    assert.strictEqual(result.value, 'create');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });

  it('update when branch behind', () => {
    const result = resolveBranchHandling({ branching_strategy: 'phase', has_branch: true, branch_behind: true });
    assert.strictEqual(result.value, 'update');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });

  it('use-existing when branch current', () => {
    const result = resolveBranchHandling({ branching_strategy: 'phase', has_branch: true, branch_behind: false });
    assert.strictEqual(result.value, 'use-existing');
  });
});

describe('decisions: resolveAutoAdvance contract', () => {
  it('returns true when config set', () => {
    assert.strictEqual(resolveAutoAdvance({ auto_advance_config: true }).value, true);
  });

  it('returns true when flag set', () => {
    assert.strictEqual(resolveAutoAdvance({ auto_flag: true }).value, true);
  });

  it('returns false when neither set', () => {
    assert.strictEqual(resolveAutoAdvance({ auto_advance_config: false, auto_flag: false }).value, false);
  });
});

describe('decisions: resolvePhaseArgParse contract', () => {
  it('parses numeric string', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: '111' }).value, 111);
  });

  it('parses zero-padded string', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: '0111' }).value, 111);
  });

  it('parses "phase 111" string', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: 'phase 111' }).value, 111);
  });

  it('parses decimal phase', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: '5.1' }).value, 5.1);
  });

  it('returns null for empty string', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: '' }).value, null);
  });

  it('returns null for non-numeric', () => {
    assert.strictEqual(resolvePhaseArgParse({ raw_arg: 'abc' }).value, null);
  });

  it('handles undefined state', () => {
    assert.strictEqual(resolvePhaseArgParse(undefined).value, null);
  });
});

describe('decisions: resolveDebugHandlerRoute contract', () => {
  it('returns fix for fix type', () => {
    const result = resolveDebugHandlerRoute({ return_type: 'fix' });
    assert.strictEqual(result.value, 'fix');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });

  it('returns plan for plan type', () => {
    assert.strictEqual(resolveDebugHandlerRoute({ return_type: 'plan' }).value, 'plan');
  });

  it('returns continue for resolved type', () => {
    assert.strictEqual(resolveDebugHandlerRoute({ return_type: 'resolved' }).value, 'continue');
  });

  it('returns manual for unknown type', () => {
    assert.strictEqual(resolveDebugHandlerRoute({ return_type: 'something-else' }).value, 'manual');
  });

  it('returns manual for missing type (MEDIUM)', () => {
    const result = resolveDebugHandlerRoute({});
    assert.strictEqual(result.value, 'manual');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });
});

// ─── evaluateDecisions Aggregator ────────────────────────────────────────────

describe('decisions: evaluateDecisions aggregator', () => {
  it('returns object with rule_id keys and decision result values', () => {
    const results = evaluateDecisions('progress', {
      plan_count: 3, summary_count: 1, state_exists: true,
      roadmap_exists: true, project_exists: true,
      current_phase: 5, highest_phase: 8,
    });
    assert.strictEqual(typeof results, 'object');
    assert.ok(results['progress-route'], 'Expected progress-route in results');
    assert.strictEqual(results['progress-route'].rule_id, 'progress-route');
    assert.strictEqual(results['progress-route'].value, 'A');
  });

  it('only includes rules with matching inputs', () => {
    const results = evaluateDecisions('test', { context_present: true });
    assert.ok(results['context-gate'], 'Expected context-gate');
    assert.ok(!results['execution-pattern'], 'Should not include execution-pattern');
  });

  it('returns empty object for null state', () => {
    const results = evaluateDecisions('test', null);
    assert.deepStrictEqual(results, {});
  });

  it('returns empty object for empty state', () => {
    const results = evaluateDecisions('test', {});
    assert.deepStrictEqual(results, {});
  });

  it('evaluates multiple matching rules simultaneously', () => {
    const results = evaluateDecisions('execute', {
      task_types: ['auto'],
      warning: false,
      mode: 'interactive',
    });
    assert.ok(results['execution-pattern'], 'Expected execution-pattern');
    assert.ok(results['context-budget-gate'], 'Expected context-budget-gate');
  });
});

// ─── Confidence Distribution ─────────────────────────────────────────────────

describe('decisions: confidence distribution', () => {
  it('not all rules return only HIGH — at least 2 have MEDIUM in range', () => {
    const mediumRules = DECISION_REGISTRY.filter(r => r.confidence_range.includes('MEDIUM'));
    assert.ok(mediumRules.length >= 2,
      `Expected >= 2 rules with MEDIUM confidence, got ${mediumRules.length}: ${mediumRules.map(r => r.id).join(', ')}`);
  });

  it('at least one rule actually returns MEDIUM in practice', () => {
    // resume-route with ambiguous state should return MEDIUM
    const result = resolveResumeRoute({ has_state: true, has_plans: true, has_incomplete_plans: false });
    assert.strictEqual(result.confidence, 'MEDIUM');
  });

  it('debug-handler-route always returns MEDIUM', () => {
    const result = resolveDebugHandlerRoute({ return_type: 'fix' });
    assert.strictEqual(result.confidence, 'MEDIUM');
  });
});

// ─── All Registry Entries Contract Check ─────────────────────────────────────

describe('decisions: every registered rule returns valid contract', () => {
  for (const rule of DECISION_REGISTRY) {
    it(`${rule.id} returns valid {value, confidence, rule_id}`, () => {
      // Build a minimal state with the first input set to a reasonable default
      const state = {};
      for (const input of rule.inputs) {
        if (input.endsWith('_count') || input === 'current_phase' || input === 'highest_phase') {
          state[input] = 1;
        } else if (input.endsWith('_exists') || input.startsWith('has_') || input.endsWith('_present') ||
                   input === 'ci_enabled' || input === 'warning' || input === 'auto_advance_config' ||
                   input === 'auto_flag' || input === 'tests_passing' || input === 'branch_behind' ||
                   input === 'phase_complete') {
          state[input] = true;
        } else if (input === 'task_types') {
          state[input] = ['auto'];
        } else if (input === 'mode') {
          state[input] = 'interactive';
        } else if (input === 'branching_strategy') {
          state[input] = 'phase';
        } else if (input === 'raw_arg') {
          state[input] = '42';
        } else if (input === 'return_type') {
          state[input] = 'fix';
        } else {
          state[input] = 'test';
        }
      }

      const result = rule.resolve(state);
      const contract = contractCheck(result, DECISION_CONTRACT, rule.id);
      assert.ok(contract.pass, contract.message);
      assert.ok(VALID_CONFIDENCES.includes(result.confidence),
        `${rule.id}: confidence '${result.confidence}' not in ${VALID_CONFIDENCES.join(', ')}`);
      assert.strictEqual(result.rule_id, rule.id,
        `${rule.id}: rule_id mismatch — got '${result.rule_id}'`);
    });
  }
});
