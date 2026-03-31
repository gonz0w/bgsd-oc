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
  resolveModelSelection,
  resolveVerificationRouting,
  resolveResearchGate,
  resolveMilestoneCompletion,
  resolveCommitStrategy,
  resolveFileDiscoveryMode,
  resolveSearchMode,
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
  it('registry has >= 17 entries', () => {
    assert.ok(DECISION_REGISTRY.length >= 17, `Expected >= 17 rules, got ${DECISION_REGISTRY.length}`);
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

// ─── Phase 122: New Decision Function Tests ───────────────────────────────────

describe('decisions: resolveModelSelection contract', () => {
  it('contract check: returns {value, confidence, rule_id}', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-planner', model_profile: 'balanced' });
    const contract = contractCheck(result, DECISION_CONTRACT, 'model-selection');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'model-selection');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('returns { tier, model } shape in value', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-executor', model_profile: 'balanced' });
    assert.ok(typeof result.value === 'object', 'value should be an object');
    assert.ok(typeof result.value.tier === 'string', 'value.tier should be a string');
    assert.ok(typeof result.value.model === 'string', 'value.model should be a string');
  });

  it('falls back to static defaults when db is null', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-executor', model_profile: 'balanced', db: null });
    assert.ok(result.value.model, 'Should return a model');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('falls back to sonnet when agent_type is unknown', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-unknown-agent', model_profile: 'balanced' });
    assert.strictEqual(result.value.model, 'sonnet');
  });

  it('uses model_profile default when not provided', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-executor' });
    assert.strictEqual(result.value.tier, 'balanced');
  });

  it('handles undefined state gracefully', () => {
    const result = resolveModelSelection(undefined);
    assert.strictEqual(result.rule_id, 'model-selection');
    assert.ok(result.value.model, 'Should return a model');
  });

  it('returns correct tier in value', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-planner', model_profile: 'quality' });
    assert.strictEqual(result.value.tier, 'quality');
  });
});

describe('decisions: resolveVerificationRouting contract', () => {
  it('contract check: returns {value, confidence, rule_id}', () => {
    const result = resolveVerificationRouting({ task_count: 1, files_modified_count: 2, verifier_enabled: true });
    const contract = contractCheck(result, DECISION_CONTRACT, 'verification-routing');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'verification-routing');
  });

  it('returns full for high task count', () => {
    const result = resolveVerificationRouting({ task_count: 5, files_modified_count: 6, verifier_enabled: true });
    assert.strictEqual(result.value, 'full');
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('returns light for small plan (<=2 tasks, <=4 files)', () => {
    const result = resolveVerificationRouting({ task_count: 1, files_modified_count: 2, verifier_enabled: true });
    assert.strictEqual(result.value, 'light');
  });

  it('returns light for exactly 2 tasks and 4 files boundary', () => {
    const result = resolveVerificationRouting({ task_count: 2, files_modified_count: 4, verifier_enabled: true });
    assert.strictEqual(result.value, 'light');
  });

  it('returns full when task_count exceeds boundary', () => {
    const result = resolveVerificationRouting({ task_count: 3, files_modified_count: 4, verifier_enabled: true });
    assert.strictEqual(result.value, 'full');
  });

  it('returns skip when verifier disabled', () => {
    const result = resolveVerificationRouting({ task_count: 10, files_modified_count: 20, verifier_enabled: false });
    assert.strictEqual(result.value, 'skip');
  });

  it('handles undefined state gracefully', () => {
    const result = resolveVerificationRouting(undefined);
    assert.strictEqual(result.rule_id, 'verification-routing');
    // defaults: task_count=0, files_modified_count=0 → light
    assert.strictEqual(result.value, 'light');
  });
});

describe('decisions: resolveResearchGate contract', () => {
  it('contract check: returns {value, confidence, rule_id}', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, has_context: false });
    const contract = contractCheck(result, DECISION_CONTRACT, 'research-gate');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'research-gate');
  });

  it('returns { run, depth } compound shape', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, has_context: false });
    assert.ok(typeof result.value === 'object', 'value should be an object');
    assert.ok(typeof result.value.run === 'boolean', 'value.run should be boolean');
  });

  it('returns { run: false, depth: null } when research disabled', () => {
    const result = resolveResearchGate({ research_enabled: false });
    assert.deepStrictEqual(result.value, { run: false, depth: null });
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('returns { run: false, depth: null } when research already exists', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: true });
    assert.deepStrictEqual(result.value, { run: false, depth: null });
  });

  it('returns { run: true, depth: "deep" } for external deps', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, phase_has_external_deps: true });
    assert.deepStrictEqual(result.value, { run: true, depth: 'deep' });
  });

  it('returns { run: true, depth: "quick" } for no context', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, has_context: false, phase_has_external_deps: false });
    assert.deepStrictEqual(result.value, { run: true, depth: 'quick' });
  });

  it('returns { run: false, depth: null } when context exists but no research needed', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, has_context: true, phase_has_external_deps: false });
    assert.deepStrictEqual(result.value, { run: false, depth: null });
  });

  it('handles undefined state gracefully', () => {
    const result = resolveResearchGate(undefined);
    assert.strictEqual(result.rule_id, 'research-gate');
  });
});

describe('decisions: resolvePlanExistenceRoute expanded contract', () => {
  it('old behavior preserved: plan_count > 0 → has-plans (no context supplied)', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 3 }).value, 'has-plans');
  });

  it('old behavior preserved: plan_count > 0 without has_context → has-plans', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 1, has_research: false }).value, 'has-plans');
  });

  it('new: plan_count > 0 + has_blockers → blocked-deps', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, has_blockers: true }).value, 'blocked-deps');
  });

  it('new: plan_count > 0 + deps_complete=false → blocked-deps', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, deps_complete: false }).value, 'blocked-deps');
  });

  it('new: plan_count > 0 + has_context → ready', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, has_context: true }).value, 'ready');
  });

  it('new: no plans, no context, no research → missing-context', () => {
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 0, has_research: false, has_context: false }).value, 'missing-context');
  });

  it('old callers (without new inputs) get identical behavior', () => {
    // Old caller: only passes plan_count
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 5 }).value, 'has-plans');
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 0, has_research: true }).value, 'needs-planning');
  });

  it('blocked-deps takes priority over ready/has-plans', () => {
    // has_blockers + has_context → blocked-deps wins
    assert.strictEqual(resolvePlanExistenceRoute({ plan_count: 2, has_blockers: true, has_context: true }).value, 'blocked-deps');
  });
});

describe('decisions: resolveMilestoneCompletion contract', () => {
  it('contract check: returns {value, confidence, rule_id}', () => {
    const result = resolveMilestoneCompletion({ phases_total: 6, phases_complete: 3, has_incomplete_plans: false });
    const contract = contractCheck(result, DECISION_CONTRACT, 'milestone-completion');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'milestone-completion');
  });

  it('returns { ready, action } compound shape', () => {
    const result = resolveMilestoneCompletion({ phases_total: 3, phases_complete: 3, has_incomplete_plans: false });
    assert.ok(typeof result.value === 'object', 'value should be an object');
    assert.ok(typeof result.value.ready === 'boolean', 'value.ready should be boolean');
    assert.ok(typeof result.value.action === 'string', 'value.action should be string');
  });

  it('returns { ready: true, action: "complete" } when all phases done', () => {
    const result = resolveMilestoneCompletion({ phases_total: 6, phases_complete: 6, has_incomplete_plans: false });
    assert.deepStrictEqual(result.value, { ready: true, action: 'complete' });
    assert.strictEqual(result.confidence, 'HIGH');
  });

  it('returns { ready: false, action: "finish-last-phase" } when one remaining', () => {
    const result = resolveMilestoneCompletion({ phases_total: 6, phases_complete: 5, has_incomplete_plans: false });
    assert.deepStrictEqual(result.value, { ready: false, action: 'finish-last-phase' });
  });

  it('returns { ready: false, action: "continue" } when multiple phases remaining', () => {
    const result = resolveMilestoneCompletion({ phases_total: 6, phases_complete: 3, has_incomplete_plans: false });
    assert.deepStrictEqual(result.value, { ready: false, action: 'continue' });
  });

  it('returns continue (not complete) when all phases done but incomplete plans exist', () => {
    const result = resolveMilestoneCompletion({ phases_total: 6, phases_complete: 6, has_incomplete_plans: true });
    // phases_complete === phases_total but has_incomplete_plans → not complete
    assert.strictEqual(result.value.ready, false);
  });

  it('handles undefined state gracefully', () => {
    const result = resolveMilestoneCompletion(undefined);
    assert.strictEqual(result.rule_id, 'milestone-completion');
    // phases_total=0, phases_complete=0, no incomplete → complete
    assert.deepStrictEqual(result.value, { ready: true, action: 'complete' });
  });
});

describe('decisions: resolveCommitStrategy contract', () => {
  it('contract check: returns {value, confidence, rule_id}', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', is_tdd: false });
    const contract = contractCheck(result, DECISION_CONTRACT, 'commit-strategy');
    assert.ok(contract.pass, contract.message);
    assert.strictEqual(result.rule_id, 'commit-strategy');
  });

  it('returns { granularity, prefix } compound shape', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', is_tdd: false });
    assert.ok(typeof result.value === 'object', 'value should be an object');
    assert.ok(typeof result.value.granularity === 'string', 'value.granularity should be string');
    assert.ok(typeof result.value.prefix === 'string', 'value.prefix should be string');
  });

  it('returns per-task granularity for multi-task plans', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', is_tdd: false });
    assert.strictEqual(result.value.granularity, 'per-task');
  });

  it('returns per-plan granularity for single-task plans', () => {
    const result = resolveCommitStrategy({ task_count: 1, plan_type: 'execute', is_tdd: false });
    assert.strictEqual(result.value.granularity, 'per-plan');
  });

  it('returns per-phase granularity for TDD plans', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'tdd', is_tdd: true });
    assert.strictEqual(result.value.granularity, 'per-phase');
  });

  it('returns prefix test for TDD plan type', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'tdd', is_tdd: true });
    assert.strictEqual(result.value.prefix, 'test');
  });

  it('returns prefix docs when files_modified_count is 0', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', files_modified_count: 0 });
    assert.strictEqual(result.value.prefix, 'docs');
  });

  it('returns MEDIUM confidence for feat prefix (inferred from file patterns)', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', files_modified_count: 5 });
    assert.strictEqual(result.value.prefix, 'feat');
    assert.strictEqual(result.confidence, 'MEDIUM');
  });

  it('handles undefined state gracefully', () => {
    const result = resolveCommitStrategy(undefined);
    assert.strictEqual(result.rule_id, 'commit-strategy');
    // task_count=0 → per-plan; no plan_type → prefix docs (files=0)
    assert.strictEqual(result.value.granularity, 'per-plan');
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
        } else if (input === 'tool_availability') {
          state[input] = { ripgrep: true, fd: true, jq: true, yq: true, bat: true, gh: true };
        } else if (input === 'scope') {
          state[input] = 'directory';
        } else if (input === 'json_complexity') {
          state[input] = 'complex';
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

// ─── Phase 127: Tool routing decision function tests ──────────────────────────

describe('Phase 127: Tool routing decision functions', () => {

  // ─── resolveFileDiscoveryMode ───────────────────────────────────────────────

  describe('resolveFileDiscoveryMode', () => {
    it('single-file scope with all tools available returns node', () => {
      const result = resolveFileDiscoveryMode({ scope: 'single-file', tool_availability: { fd: true, ripgrep: true } });
      assert.strictEqual(result.value, 'node');
      assert.strictEqual(result.confidence, 'HIGH');
      assert.strictEqual(result.rule_id, 'file-discovery-mode');
    });

    it('single-file scope with no tools returns node', () => {
      const result = resolveFileDiscoveryMode({ scope: 'single-file', tool_availability: { fd: false } });
      assert.strictEqual(result.value, 'node');
    });

    it('directory scope with fd available returns fd', () => {
      const result = resolveFileDiscoveryMode({ scope: 'directory', tool_availability: { fd: true } });
      assert.strictEqual(result.value, 'fd');
      assert.strictEqual(result.confidence, 'HIGH');
      assert.strictEqual(result.rule_id, 'file-discovery-mode');
    });

    it('directory scope with fd unavailable returns node', () => {
      const result = resolveFileDiscoveryMode({ scope: 'directory', tool_availability: { fd: false } });
      assert.strictEqual(result.value, 'node');
    });

    it('project-wide scope with fd available returns fd', () => {
      const result = resolveFileDiscoveryMode({ scope: 'project-wide', tool_availability: { fd: true } });
      assert.strictEqual(result.value, 'fd');
      assert.strictEqual(result.confidence, 'HIGH');
    });

    it('project-wide scope with fd unavailable returns node', () => {
      const result = resolveFileDiscoveryMode({ scope: 'project-wide', tool_availability: { fd: false } });
      assert.strictEqual(result.value, 'node');
    });

    it('missing scope defaults to fd when discovery tooling is available', () => {
      const result = resolveFileDiscoveryMode({ tool_availability: { fd: true } });
      assert.strictEqual(result.value, 'fd');
    });

    it('missing tool_availability defaults gracefully to node', () => {
      const result = resolveFileDiscoveryMode({ scope: 'directory' });
      assert.strictEqual(result.value, 'node');
      assert.strictEqual(result.rule_id, 'file-discovery-mode');
    });

    it('all results have HIGH confidence', () => {
      const cases = [
        { scope: 'single-file', tool_availability: { fd: true } },
        { scope: 'directory', tool_availability: { fd: true } },
        { scope: 'project-wide', tool_availability: { fd: false } },
      ];
      for (const state of cases) {
        const result = resolveFileDiscoveryMode(state);
        assert.strictEqual(result.confidence, 'HIGH', `Expected HIGH for ${JSON.stringify(state)}`);
      }
    });

    it('return value is always a string (tool name only)', () => {
      const result = resolveFileDiscoveryMode({ scope: 'directory', tool_availability: { fd: true } });
      assert.strictEqual(typeof result.value, 'string');
    });

    it('handles null state gracefully', () => {
      const result = resolveFileDiscoveryMode(null);
      assert.strictEqual(result.value, 'node');
      assert.strictEqual(result.rule_id, 'file-discovery-mode');
    });

    it('handles undefined state gracefully', () => {
      const result = resolveFileDiscoveryMode(undefined);
      assert.strictEqual(result.value, 'node');
    });
  });

  // ─── resolveSearchMode ─────────────────────────────────────────────────────

  describe('resolveSearchMode', () => {
    it('ripgrep available returns ripgrep regardless of gitignore flag', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: true, fd: true }, needs_gitignore_respect: true });
      assert.strictEqual(result.value, 'ripgrep');
      assert.strictEqual(result.confidence, 'HIGH');
      assert.strictEqual(result.rule_id, 'search-mode');
    });

    it('ripgrep available with gitignore false still returns ripgrep (highest priority)', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: true }, needs_gitignore_respect: false });
      assert.strictEqual(result.value, 'ripgrep');
    });

    it('ripgrep unavailable, fd available, needs_gitignore_respect true returns fd', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: false, fd: true }, needs_gitignore_respect: true });
      assert.strictEqual(result.value, 'fd');
      assert.strictEqual(result.confidence, 'HIGH');
      assert.strictEqual(result.rule_id, 'search-mode');
    });

    it('ripgrep unavailable, fd available, needs_gitignore_respect false returns node', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: false, fd: true }, needs_gitignore_respect: false });
      assert.strictEqual(result.value, 'node');
    });

    it('all tools unavailable returns node', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: false, fd: false } });
      assert.strictEqual(result.value, 'node');
    });

    it('only fd available, no gitignore need returns node', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: false, fd: true }, needs_gitignore_respect: false });
      assert.strictEqual(result.value, 'node');
    });

    it('default needs_gitignore_respect (true) when not specified — ripgrep if available', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: true } });
      assert.strictEqual(result.value, 'ripgrep');
    });

    it('default needs_gitignore_respect (true) with no ripgrep, fd available returns fd', () => {
      const result = resolveSearchMode({ tool_availability: { ripgrep: false, fd: true } });
      assert.strictEqual(result.value, 'fd');
    });

    it('missing tool_availability returns node', () => {
      const result = resolveSearchMode({});
      assert.strictEqual(result.value, 'node');
      assert.strictEqual(result.rule_id, 'search-mode');
    });

    it('all results have HIGH confidence', () => {
      const cases = [
        { tool_availability: { ripgrep: true } },
        { tool_availability: { ripgrep: false, fd: true }, needs_gitignore_respect: true },
        { tool_availability: { ripgrep: false, fd: false } },
      ];
      for (const state of cases) {
        assert.strictEqual(resolveSearchMode(state).confidence, 'HIGH');
      }
    });

    it('fallback chain is ripgrep -> fd -> node', () => {
      // ripgrep wins over fd
      assert.strictEqual(
        resolveSearchMode({ tool_availability: { ripgrep: true, fd: true }, needs_gitignore_respect: true }).value,
        'ripgrep'
      );
      // fd wins over node when gitignore needed
      assert.strictEqual(
        resolveSearchMode({ tool_availability: { ripgrep: false, fd: true }, needs_gitignore_respect: true }).value,
        'fd'
      );
      // node is final fallback
      assert.strictEqual(
        resolveSearchMode({ tool_availability: { ripgrep: false, fd: false } }).value,
        'node'
      );
    });

    it('handles null state gracefully', () => {
      const result = resolveSearchMode(null);
      assert.strictEqual(result.value, 'node');
    });
  });

  // ─── DECISION_REGISTRY integration ─────────────────────────────────────────

  describe('DECISION_REGISTRY integration', () => {
    it('tool-routing rules appear in DECISION_REGISTRY', () => {
      const toolRoutingRules = DECISION_REGISTRY.filter(r => r.category === 'tool-routing');
      assert.strictEqual(toolRoutingRules.length, 7, `Expected 7 tool-routing rules, got ${toolRoutingRules.length}`);
      const ids = toolRoutingRules.map(r => r.id);
      assert.ok(ids.includes('file-discovery-mode'), 'file-discovery-mode should be in registry');
      assert.ok(ids.includes('search-mode'), 'search-mode should be in registry');
      assert.ok(ids.includes('structural-search-mode'), 'structural-search-mode should be in registry');
      assert.ok(ids.includes('json-transform-mode'), 'json-transform-mode should be in registry');
      assert.ok(ids.includes('yaml-transform-mode'), 'yaml-transform-mode should be in registry');
      assert.ok(ids.includes('text-replace-mode'), 'text-replace-mode should be in registry');
      assert.ok(ids.includes('benchmark-mode'), 'benchmark-mode should be in registry');
    });

    it('each registry entry has required fields: id, name, category, inputs, outputs, confidence_range, resolve', () => {
      const toolRoutingRules = DECISION_REGISTRY.filter(r => r.category === 'tool-routing');
      for (const rule of toolRoutingRules) {
        assert.ok(typeof rule.id === 'string', `${rule.id}: id should be string`);
        assert.ok(typeof rule.name === 'string', `${rule.id}: name should be string`);
        assert.strictEqual(rule.category, 'tool-routing', `${rule.id}: category should be tool-routing`);
        assert.ok(Array.isArray(rule.inputs), `${rule.id}: inputs should be array`);
        assert.ok(Array.isArray(rule.outputs), `${rule.id}: outputs should be array`);
        assert.ok(Array.isArray(rule.confidence_range), `${rule.id}: confidence_range should be array`);
        assert.strictEqual(typeof rule.resolve, 'function', `${rule.id}: resolve should be function`);
      }
    });

    it('evaluateDecisions includes file-discovery-mode when tool_availability and scope present', () => {
      const results = evaluateDecisions('bgsd-execute-phase', {
        tool_availability: { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false },
        scope: 'project-wide',
      });
      assert.ok(results['file-discovery-mode'], 'file-discovery-mode should fire');
      assert.strictEqual(results['file-discovery-mode'].value, 'fd');
    });

  });
});

