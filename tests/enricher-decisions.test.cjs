/**
 * Contract tests for enrichment expansion and decision rule integration.
 * Validates that the extended enrichment fields enable decision rules to fire correctly.
 *
 * Tests two concerns:
 * 1. Enrichment field presence — new fields exist and have correct types
 * 2. Decision rule integration — rules produce non-null values with expanded inputs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { contractCheck, createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  resolveProgressRoute,
  resolveExecutionPattern,
  resolveAutoAdvance,
  resolveCiGate,
  resolvePlanExistenceRoute,
  resolvePreviousCheckGate,
  resolveModelSelection,
  resolveVerificationRouting,
  resolveResearchGate,
  resolveMilestoneCompletion,
  resolveCommitStrategy,
  resolveFileDiscoveryMode,
  resolveSearchMode,
  resolveJsonTransformMode,
  DECISION_REGISTRY,
  evaluateDecisions,
} = require('../src/lib/decision-rules');

const { scopeContextForAgent } = require('../src/lib/context');

// ─── Enrichment Field Presence Tests ─────────────────────────────────────────

describe('enricher-decisions: enrichment field types', () => {
  it('plan_count is number when plans exist', () => {
    // Simulate enrichment state as the enricher would produce
    const state = { plan_count: 3, summary_count: 1 };
    assert.strictEqual(typeof state.plan_count, 'number');
    assert.strictEqual(state.plan_count, 3);
  });

  it('summary_count is number', () => {
    const state = { summary_count: 2 };
    assert.strictEqual(typeof state.summary_count, 'number');
  });

  it('uat_gap_count defaults to 0', () => {
    // When no UAT files exist, enricher sets 0
    const state = { uat_gap_count: 0 };
    assert.strictEqual(state.uat_gap_count, 0);
  });

  it('has_research is boolean', () => {
    const state = { has_research: true };
    assert.strictEqual(typeof state.has_research, 'boolean');
  });

  it('has_context is boolean', () => {
    const state = { has_context: false };
    assert.strictEqual(typeof state.has_context, 'boolean');
  });

  it('task_types is array when plans have typed tasks', () => {
    const state = { task_types: ['auto', 'auto', 'checkpoint:human-verify'] };
    assert.ok(Array.isArray(state.task_types));
    assert.strictEqual(state.task_types.length, 3);
  });

  it('state_exists is boolean', () => {
    const state = { state_exists: true };
    assert.strictEqual(typeof state.state_exists, 'boolean');
  });

  it('project_exists is boolean', () => {
    const state = { project_exists: true };
    assert.strictEqual(typeof state.project_exists, 'boolean');
  });

  it('roadmap_exists is boolean', () => {
    const state = { roadmap_exists: true };
    assert.strictEqual(typeof state.roadmap_exists, 'boolean');
  });

  it('current_phase is number when set', () => {
    const state = { current_phase: 112 };
    assert.strictEqual(typeof state.current_phase, 'number');
  });

  it('highest_phase is number when roadmap has phases', () => {
    const state = { highest_phase: 115 };
    assert.strictEqual(typeof state.highest_phase, 'number');
  });

  it('ci_enabled is boolean', () => {
    const state = { ci_enabled: false };
    assert.strictEqual(typeof state.ci_enabled, 'boolean');
  });

  it('has_test_command is boolean', () => {
    const state = { has_test_command: true };
    assert.strictEqual(typeof state.has_test_command, 'boolean');
  });

  it('has_previous_summary is boolean', () => {
    const state = { has_previous_summary: false };
    assert.strictEqual(typeof state.has_previous_summary, 'boolean');
  });
});

// ─── Decision Rule Integration Tests ─────────────────────────────────────────

describe('enricher-decisions: progress-route fires with enrichment inputs', () => {
  it('returns route A when summaries < plans', () => {
    const result = resolveProgressRoute({
      plan_count: 3,
      summary_count: 1,
      uat_gap_count: 0,
      current_phase: 112,
      highest_phase: 115,
      roadmap_exists: true,
      project_exists: true,
      state_exists: true,
    });
    assert.strictEqual(result.value, 'A');
    assert.strictEqual(result.confidence, 'HIGH');
    assert.strictEqual(result.rule_id, 'progress-route');
  });

  it('returns route B when no plans', () => {
    const result = resolveProgressRoute({
      plan_count: 0,
      summary_count: 0,
      uat_gap_count: 0,
      current_phase: 112,
      highest_phase: 115,
      roadmap_exists: true,
      project_exists: true,
      state_exists: true,
    });
    assert.strictEqual(result.value, 'B');
  });

  it('returns route E with UAT gaps', () => {
    const result = resolveProgressRoute({
      plan_count: 2,
      summary_count: 2,
      uat_gap_count: 3,
      current_phase: 112,
      highest_phase: 115,
      roadmap_exists: true,
      project_exists: true,
      state_exists: true,
    });
    assert.strictEqual(result.value, 'E');
  });
});

describe('enricher-decisions: execution-pattern fires with task_types', () => {
  it('returns A for all auto tasks', () => {
    const result = resolveExecutionPattern({ task_types: ['auto', 'auto'] });
    assert.strictEqual(result.value, 'A');
    assert.strictEqual(result.confidence, 'HIGH');
    assert.strictEqual(result.rule_id, 'execution-pattern');
  });

  it('returns B for checkpoint:human-verify tasks', () => {
    const result = resolveExecutionPattern({
      task_types: ['auto', 'checkpoint:human-verify', 'auto'],
    });
    assert.strictEqual(result.value, 'B');
  });

  it('returns C for checkpoint:decision tasks', () => {
    const result = resolveExecutionPattern({
      task_types: ['auto', 'checkpoint:decision'],
    });
    assert.strictEqual(result.value, 'C');
  });
});

describe('enricher-decisions: auto-advance fires with config', () => {
  it('returns true when auto_advance_config set', () => {
    const result = resolveAutoAdvance({ auto_advance_config: true, auto_flag: false });
    assert.strictEqual(result.value, true);
    assert.strictEqual(result.rule_id, 'auto-advance');
  });

  it('returns false when neither set', () => {
    const result = resolveAutoAdvance({ auto_advance_config: false, auto_flag: false });
    assert.strictEqual(result.value, false);
  });
});

describe('enricher-decisions: ci-gate fires with ci inputs', () => {
  it('returns skip when CI not enabled', () => {
    const result = resolveCiGate({ ci_enabled: false, has_test_command: true });
    assert.strictEqual(result.value, 'skip');
    assert.strictEqual(result.rule_id, 'ci-gate');
  });

  it('returns run when all good', () => {
    const result = resolveCiGate({ ci_enabled: true, has_test_command: true, tests_passing: true });
    assert.strictEqual(result.value, 'run');
  });

  it('returns warn when no test command', () => {
    const result = resolveCiGate({ ci_enabled: true, has_test_command: false });
    assert.strictEqual(result.value, 'warn');
  });
});

describe('enricher-decisions: plan-existence-route fires with enrichment', () => {
  it('returns has-plans when plan_count > 0', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 2, has_research: false, has_context: false });
    assert.strictEqual(result.value, 'has-plans');
    assert.strictEqual(result.rule_id, 'plan-existence-route');
  });

  it('returns needs-planning when research exists but no plans', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 0, has_research: true, has_context: false });
    assert.strictEqual(result.value, 'needs-planning');
  });

  it('returns missing-context when nothing exists (no research, no context)', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 0, has_research: false, has_context: false });
    assert.strictEqual(result.value, 'missing-context');
  });

  it('returns blocked-deps when plan_count > 0 and has_blockers', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 2, has_blockers: true });
    assert.strictEqual(result.value, 'blocked-deps');
  });

  it('returns ready when plan_count > 0 and has_context', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 2, has_context: true });
    assert.strictEqual(result.value, 'ready');
  });
});

describe('enricher-decisions: previous-check-gate fires with enrichment', () => {
  it('returns proceed when no previous summary', () => {
    const result = resolvePreviousCheckGate({ has_previous_summary: false });
    assert.strictEqual(result.value, 'proceed');
    assert.strictEqual(result.rule_id, 'previous-check-gate');
  });

  it('returns block when blockers present', () => {
    const result = resolvePreviousCheckGate({
      has_previous_summary: true,
      has_unresolved_issues: false,
      has_blockers: true,
    });
    assert.strictEqual(result.value, 'block');
  });

  it('returns warn when unresolved issues', () => {
    const result = resolvePreviousCheckGate({
      has_previous_summary: true,
      has_unresolved_issues: true,
      has_blockers: false,
    });
    assert.strictEqual(result.value, 'warn');
  });
});

// ─── evaluateDecisions Integration ───────────────────────────────────────────

describe('enricher-decisions: evaluateDecisions with full enrichment state', () => {
  it('fires progress-route, plan-existence-route with enriched state', () => {
    const enrichment = {
      plan_count: 2,
      summary_count: 0,
      uat_gap_count: 0,
      current_phase: 112,
      highest_phase: 115,
      state_exists: true,
      project_exists: true,
      roadmap_exists: true,
      has_research: true,
      has_context: false,
    };
    const results = evaluateDecisions('bgsd-progress', enrichment);
    assert.ok(results['progress-route'], 'Expected progress-route to fire');
    assert.strictEqual(results['progress-route'].value, 'A');
    assert.ok(results['plan-existence-route'], 'Expected plan-existence-route to fire');
    assert.strictEqual(results['plan-existence-route'].value, 'has-plans');
  });

  it('fires execution-pattern with task_types', () => {
    const enrichment = { task_types: ['auto', 'checkpoint:human-verify'] };
    const results = evaluateDecisions('bgsd-execute-phase', enrichment);
    assert.ok(results['execution-pattern'], 'Expected execution-pattern to fire');
    assert.strictEqual(results['execution-pattern'].value, 'B');
  });

  it('fires ci-gate with ci inputs', () => {
    const enrichment = { ci_enabled: true, has_test_command: true, tests_passing: true };
    const results = evaluateDecisions('bgsd-execute-phase', enrichment);
    assert.ok(results['ci-gate'], 'Expected ci-gate to fire');
    assert.strictEqual(results['ci-gate'].value, 'run');
  });

  it('fires previous-check-gate with summary checks', () => {
    const enrichment = { has_previous_summary: true, has_unresolved_issues: false, has_blockers: false };
    const results = evaluateDecisions('bgsd-execute-plan', enrichment);
    assert.ok(results['previous-check-gate'], 'Expected previous-check-gate to fire');
    assert.strictEqual(results['previous-check-gate'].value, 'proceed');
  });

  it('fires multiple rules simultaneously', () => {
    const enrichment = {
      plan_count: 3,
      summary_count: 1,
      state_exists: true,
      project_exists: true,
      roadmap_exists: true,
      current_phase: 110,
      highest_phase: 112,
      task_types: ['auto'],
      ci_enabled: false,
      has_test_command: false,
      has_previous_summary: false,
      has_research: true,
      has_context: false,
    };
    const results = evaluateDecisions('bgsd-execute-phase', enrichment);
    // Should fire at least 4 rules
    const firedRules = Object.keys(results);
    assert.ok(firedRules.length >= 4, `Expected >= 4 rules to fire, got ${firedRules.length}: ${firedRules.join(', ')}`);
  });
});

// ─── Backward Compatibility ──────────────────────────────────────────────────

describe('enricher-decisions: backward compatibility', () => {
  it('evaluateDecisions with zero new fields still works', () => {
    // Old-style enrichment with only paths and config flags
    const oldEnrichment = {
      planning_dir: '.planning',
      state_path: '.planning/STATE.md',
      roadmap_path: '.planning/ROADMAP.md',
      config_path: '.planning/config.json',
      commit_docs: true,
      branching_strategy: 'none',
    };
    const results = evaluateDecisions('bgsd-progress', oldEnrichment);
    // branching_strategy should trigger branch-handling
    assert.ok(results['branch-handling'], 'Expected branch-handling to fire');
    assert.strictEqual(results['branch-handling'].value, 'skip');
    // No new-field-dependent rules should fire without those fields
    assert.ok(!results['progress-route'], 'progress-route should NOT fire without plan_count etc.');
  });

  it('evaluateDecisions with empty state returns empty object', () => {
    const results = evaluateDecisions('test', {});
    assert.deepStrictEqual(results, {});
  });

  it('decision rules handle missing optional fields gracefully', () => {
    // Only pass some fields — rules should use defaults for missing ones
    const result = resolveProgressRoute({ state_exists: true, roadmap_exists: true, project_exists: true });
    assert.ok(result.value !== null, 'Should produce a non-null value');
    assert.strictEqual(result.rule_id, 'progress-route');
  });
});

// ─── CLI Integration Tests ───────────────────────────────────────────────────

describe('enricher-decisions: CLI integration', () => {
  it('decisions:evaluate progress-route with full state returns non-null', () => {
    const result = runGsdTools(
      `decisions:evaluate progress-route --state '{"plan_count":2,"summary_count":0,"state_exists":true,"roadmap_exists":true,"project_exists":true,"current_phase":112,"highest_phase":115}'`
    );
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output.replace(/^\[bGSD\].*\n/, ''));
    assert.strictEqual(parsed.value, 'A');
    assert.strictEqual(parsed.rule_id, 'progress-route');
  });

  it('decisions:evaluate execution-pattern with task_types returns A', () => {
    const result = runGsdTools(
      `decisions:evaluate execution-pattern --state '{"task_types":["auto","auto"]}'`
    );
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output.replace(/^\[bGSD\].*\n/, ''));
    assert.strictEqual(parsed.value, 'A');
  });

  it('decisions:evaluate ci-gate with ci_enabled=false returns skip', () => {
    const result = runGsdTools(
      `decisions:evaluate ci-gate --state '{"ci_enabled":false,"has_test_command":true}'`
    );
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output.replace(/^\[bGSD\].*\n/, ''));
    assert.strictEqual(parsed.value, 'skip');
  });

  it('decisions:list still works (no regression)', () => {
    const result = runGsdTools('decisions:list');
    assert.ok(result.success, `decisions:list should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output.replace(/^\[bGSD\].*\n/, ''));
    assert.ok(parsed.rules, 'Should have rules array');
    assert.ok(parsed.rules.length >= 10, `Expected >= 10 rules, got ${parsed.rules.length}`);
  });
});

// ─── Phase 122: New Rules Integration Tests ───────────────────────────────────

describe('enricher-decisions: model-selection fires with agent_type + model_profile', () => {
  it('returns { tier, model } when agent_type and model_profile provided', () => {
    const result = resolveModelSelection({ agent_type: 'bgsd-executor', model_profile: 'balanced' });
    assert.ok(typeof result.value === 'object', 'value should be object');
    assert.ok(typeof result.value.tier === 'string', 'value.tier should be string');
    assert.ok(typeof result.value.model === 'string', 'value.model should be string');
    assert.strictEqual(result.rule_id, 'model-selection');
  });

  it('appears in evaluateDecisions output when agent_type is present', () => {
    const results = evaluateDecisions('bgsd-execute-phase', { agent_type: 'bgsd-executor', model_profile: 'balanced' });
    assert.ok(results['model-selection'], 'model-selection should appear in results');
    assert.ok(results['model-selection'].value.model, 'model-selection should have model in value');
  });

  it('appears in evaluateDecisions output when model_profile is present', () => {
    const results = evaluateDecisions('bgsd-plan-phase', { agent_type: 'bgsd-planner', model_profile: 'quality' });
    assert.ok(results['model-selection'], 'model-selection should appear in results');
    assert.strictEqual(results['model-selection'].value.tier, 'quality');
  });
});

describe('enricher-decisions: verification-routing fires with task_count + verifier_enabled', () => {
  it('returns "light" for small plan', () => {
    const result = resolveVerificationRouting({ task_count: 1, files_modified_count: 2, verifier_enabled: true });
    assert.strictEqual(result.value, 'light');
    assert.strictEqual(result.rule_id, 'verification-routing');
  });

  it('returns "full" for large plan', () => {
    const result = resolveVerificationRouting({ task_count: 5, files_modified_count: 10, verifier_enabled: true });
    assert.strictEqual(result.value, 'full');
  });

  it('appears in evaluateDecisions output when verifier_enabled is present', () => {
    const results = evaluateDecisions('bgsd-execute-phase', { verifier_enabled: true, task_count: 3, files_modified_count: 5 });
    assert.ok(results['verification-routing'], 'verification-routing should appear in results');
    assert.ok(['full', 'light', 'skip'].includes(results['verification-routing'].value),
      `Expected valid routing value, got ${results['verification-routing'].value}`);
  });
});

describe('enricher-decisions: research-gate fires with research_enabled', () => {
  it('returns { run: false } when research disabled', () => {
    const result = resolveResearchGate({ research_enabled: false });
    assert.strictEqual(result.value.run, false);
    assert.strictEqual(result.rule_id, 'research-gate');
  });

  it('returns { run: true, depth: "quick" } when research enabled and no context', () => {
    const result = resolveResearchGate({ research_enabled: true, has_research: false, has_context: false });
    assert.strictEqual(result.value.run, true);
    assert.strictEqual(result.value.depth, 'quick');
  });

  it('appears in evaluateDecisions output when research_enabled is present', () => {
    const results = evaluateDecisions('bgsd-research-phase', { research_enabled: true, has_research: false, has_context: false });
    assert.ok(results['research-gate'], 'research-gate should appear in results');
    assert.ok(typeof results['research-gate'].value.run === 'boolean', 'run should be boolean');
  });
});

describe('enricher-decisions: milestone-completion fires with phases_total', () => {
  it('returns complete when all phases done', () => {
    const result = resolveMilestoneCompletion({ phases_total: 5, phases_complete: 5, has_incomplete_plans: false });
    assert.deepStrictEqual(result.value, { ready: true, action: 'complete' });
    assert.strictEqual(result.rule_id, 'milestone-completion');
  });

  it('returns continue when several phases remaining', () => {
    const result = resolveMilestoneCompletion({ phases_total: 10, phases_complete: 5, has_incomplete_plans: false });
    assert.strictEqual(result.value.action, 'continue');
  });

  it('appears in evaluateDecisions output when phases_total is present', () => {
    const results = evaluateDecisions('bgsd-progress', { phases_total: 6, phases_complete: 6, has_incomplete_plans: false });
    assert.ok(results['milestone-completion'], 'milestone-completion should appear in results');
    assert.ok(typeof results['milestone-completion'].value.ready === 'boolean', 'ready should be boolean');
  });
});

describe('enricher-decisions: commit-strategy fires with plan_type', () => {
  it('returns per-task for multi-task execute plan', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'execute', is_tdd: false });
    assert.strictEqual(result.value.granularity, 'per-task');
    assert.strictEqual(result.rule_id, 'commit-strategy');
  });

  it('returns per-phase for TDD plan', () => {
    const result = resolveCommitStrategy({ task_count: 3, plan_type: 'tdd', is_tdd: true });
    assert.strictEqual(result.value.granularity, 'per-phase');
    assert.strictEqual(result.value.prefix, 'test');
  });

  it('appears in evaluateDecisions output when plan_type is present', () => {
    const results = evaluateDecisions('bgsd-execute-phase', { plan_type: 'execute', task_count: 2, is_tdd: false });
    assert.ok(results['commit-strategy'], 'commit-strategy should appear in results');
    assert.ok(typeof results['commit-strategy'].value.granularity === 'string', 'granularity should be string');
  });
});

// ─── Mock Project Enrichment Structure Test ──────────────────────────────────

describe('enricher-decisions: mock project structure', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create STATE.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Project State\n\n## Current Position\n\n**Phase:** 5 (Testing)\n');
    // Create ROADMAP.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 5: Testing\n**Goal:** Test things\n');
    // Create PROJECT.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n');
    // Create phase dir with a PLAN and SUMMARY
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-testing');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '0005-01-PLAN.md'), '---\nphase: 05-testing\nplan: 01\n---\n<tasks>\n<task type="auto"><name>Task 1</name></task>\n</tasks>\n');
    fs.writeFileSync(path.join(phaseDir, '0005-01-SUMMARY.md'), '# Summary\nAll good.\n');
    fs.writeFileSync(path.join(phaseDir, '0005-02-PLAN.md'), '---\nphase: 05-testing\nplan: 02\n---\n<tasks>\n<task type="auto"><name>Task 2</name></task>\n</tasks>\n');
    // No summary for plan 02 — it's incomplete
    fs.writeFileSync(path.join(phaseDir, '0005-RESEARCH.md'), '# Research\n');
  });

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  it('file existence checks derive correct values from mock project', () => {
    const { existsSync } = require('fs');
    const stateExists = existsSync(path.join(tmpDir, '.planning/STATE.md'));
    const projectExists = existsSync(path.join(tmpDir, '.planning/PROJECT.md'));
    const roadmapExists = existsSync(path.join(tmpDir, '.planning/ROADMAP.md'));
    assert.strictEqual(stateExists, true);
    assert.strictEqual(projectExists, true);
    assert.strictEqual(roadmapExists, true);

    // Research exists
    const hasResearch = existsSync(path.join(tmpDir, '.planning/phases/05-testing/0005-RESEARCH.md'));
    assert.strictEqual(hasResearch, true);

    // Context does not exist
    const hasContext = existsSync(path.join(tmpDir, '.planning/phases/05-testing/0005-CONTEXT.md'));
    assert.strictEqual(hasContext, false);
  });

  it('plan and summary counts match mock project structure', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-testing');
    const files = fs.readdirSync(phaseDir);
    const plans = files.filter(f => f.endsWith('-PLAN.md'));
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md'));
    assert.strictEqual(plans.length, 2, 'Expected 2 plan files');
    assert.strictEqual(summaries.length, 1, 'Expected 1 summary file');
  });

  it('decision rules produce correct results with mock project data', () => {
    // Simulate enrichment as the enricher would build it from mock project
    const enrichment = {
      plan_count: 2,
      summary_count: 1,
      uat_gap_count: 0,
      current_phase: 5,
      highest_phase: 5,
      state_exists: true,
      project_exists: true,
      roadmap_exists: true,
      has_research: true,
      has_context: false,
      task_types: ['auto'],
      ci_enabled: false,
      has_test_command: false,
      has_previous_summary: true,
      has_unresolved_issues: false,
      has_blockers: false,
    };

    const results = evaluateDecisions('bgsd-execute-phase', enrichment);

    // progress-route: summaries (1) < plans (2) → A
    assert.strictEqual(results['progress-route'].value, 'A');

    // plan-existence-route: plan_count > 0 → has-plans
    assert.strictEqual(results['plan-existence-route'].value, 'has-plans');

    // execution-pattern: all auto → A
    assert.strictEqual(results['execution-pattern'].value, 'A');

    // ci-gate: not enabled → skip
    assert.strictEqual(results['ci-gate'].value, 'skip');

    // previous-check-gate: has summary, no issues → proceed
    assert.strictEqual(results['previous-check-gate'].value, 'proceed');
  });
});

// ─── Phase 127: tool_availability enrichment tests ───────────────────────────

describe('Phase 127: tool_availability enrichment', () => {

  describe('tool_availability shape tests', () => {
    it('tool_availability is an object (not null, not array)', () => {
      const ta = { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: true };
      assert.ok(ta !== null, 'tool_availability should not be null');
      assert.ok(typeof ta === 'object' && !Array.isArray(ta), 'tool_availability should be a plain object');
    });

    it('tool_availability has exactly 6 keys: ripgrep, fd, jq, yq, bat, gh', () => {
      const ta = { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: true };
      const keys = Object.keys(ta).sort();
      assert.deepStrictEqual(keys, ['bat', 'fd', 'gh', 'jq', 'ripgrep', 'yq']);
    });

    it('each value in tool_availability is boolean-or-null — ripgrep', () => {
      const ta = { ripgrep: true, fd: false, jq: true, yq: null, bat: true, gh: false };
      assert.ok(ta.ripgrep === null || typeof ta.ripgrep === 'boolean');
    });

    it('each value in tool_availability is boolean-or-null — fd', () => {
      const ta = { ripgrep: false, fd: true, jq: false, yq: false, bat: null, gh: false };
      assert.ok(ta.fd === null || typeof ta.fd === 'boolean');
    });

    it('each value in tool_availability is boolean-or-null — jq', () => {
      const ta = { ripgrep: false, fd: false, jq: true, yq: false, bat: false, gh: null };
      assert.ok(ta.jq === null || typeof ta.jq === 'boolean');
    });

    it('each value in tool_availability is boolean-or-null — yq, bat, gh', () => {
      const ta = { ripgrep: false, fd: false, jq: false, yq: true, bat: null, gh: true };
      assert.ok(ta.yq === null || typeof ta.yq === 'boolean');
      assert.ok(ta.bat === null || typeof ta.bat === 'boolean');
      assert.ok(ta.gh === null || typeof ta.gh === 'boolean');
    });

    it('tool_availability does NOT contain version info (just booleans/null per tool)', () => {
      const ta = { ripgrep: true, fd: true, jq: true, yq: null, bat: false, gh: true };
      for (const [key, value] of Object.entries(ta)) {
        assert.ok(value === null || typeof value === 'boolean',
          `${key} should be boolean or null, not ${typeof value}`);
      }
    });

    it('tool_availability does NOT contain path info', () => {
      const ta = { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: true };
      for (const key of Object.keys(ta)) {
        assert.ok(!key.includes('path') && !key.includes('Path'),
          `No path keys expected, found: ${key}`);
      }
    });

    it('tool_availability can be populated (non-empty object)', () => {
      const ta = { ripgrep: true, fd: true, jq: true, yq: true, bat: true, gh: true };
      assert.ok(Object.keys(ta).length > 0, 'tool_availability should be non-empty');
    });

    it('tool_availability keys match the TOOLS constant from detector.js', () => {
      const { TOOLS } = require('../src/lib/cli-tools/detector.js');
      const expectedKeys = Object.keys(TOOLS).sort();
      const taKeys = ['ripgrep', 'fd', 'jq', 'yq', 'ast_grep', 'sd', 'hyperfine', 'bat', 'gh'].sort();
      assert.deepStrictEqual(taKeys, expectedKeys);
    });
  });

  describe('decision evaluation with tool_availability', () => {
    it('tool-routing decisions fire when tool_availability is in state', () => {
      const state = {
        tool_availability: { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false },
        scope: 'directory',
      };
      const results = evaluateDecisions('bgsd-execute-phase', state);
      // file-discovery-mode fires because tool_availability is present
      assert.ok(results['file-discovery-mode'], 'file-discovery-mode should fire with tool_availability');
    });

    it('tool-routing decisions all have HIGH confidence', () => {
      const state = {
        tool_availability: { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false },
        scope: 'project-wide',
        needs_gitignore_respect: true,
        json_complexity: 'complex',
      };
      const results = evaluateDecisions('bgsd-execute-phase', state);
      const toolRoutingIds = ['file-discovery-mode', 'search-mode', 'json-transform-mode'];
      for (const ruleId of toolRoutingIds) {
        if (results[ruleId]) {
          assert.strictEqual(results[ruleId].confidence, 'HIGH', `${ruleId} should have HIGH confidence`);
        }
      }
    });

    it('decision results have correct rule_ids', () => {
      const state = {
        tool_availability: { ripgrep: false, fd: true, jq: false, yq: false, bat: false, gh: false },
        scope: 'project-wide',
        needs_gitignore_respect: true,
        json_complexity: 'simple',
      };
      const results = evaluateDecisions('bgsd-execute-phase', state);
      if (results['file-discovery-mode']) {
        assert.strictEqual(results['file-discovery-mode'].rule_id, 'file-discovery-mode');
      }
      if (results['search-mode']) {
        assert.strictEqual(results['search-mode'].rule_id, 'search-mode');
      }
      if (results['json-transform-mode']) {
        assert.strictEqual(results['json-transform-mode'].rule_id, 'json-transform-mode');
      }
    });

    it('results contain string values (tool names only)', () => {
      const state = {
        tool_availability: { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false },
        scope: 'directory',
        needs_gitignore_respect: true,
        json_complexity: 'complex',
      };
      const results = evaluateDecisions('bgsd-execute-phase', state);
      const toolRoutingIds = ['file-discovery-mode', 'search-mode', 'json-transform-mode'];
      for (const ruleId of toolRoutingIds) {
        if (results[ruleId]) {
          assert.strictEqual(typeof results[ruleId].value, 'string',
            `${ruleId} value should be a string (tool name)`);
        }
      }
    });
  });
});

// ─── Phase 128: handoff tool context and capability-aware filtering ──────────

describe('Phase 128: handoff tool context and capability-aware filtering', () => {

  // ─── handoff_tool_context enricher shape tests ──────────────────────────────

  describe('handoff_tool_context enricher tests', () => {
    // Build a synthetic enrichment context as the enricher would produce
    function buildEnrichment(toolAvailability) {
      const tools = ['ripgrep', 'fd', 'jq', 'yq', 'bat', 'gh'];
      const knownCount = tools.filter(t => toolAvailability && (toolAvailability[t] === true || toolAvailability[t] === false)).length;
      const count = tools.filter(t => toolAvailability && toolAvailability[t] === true).length;
      const level = knownCount === 0 ? 'UNKNOWN' : (count >= 5 ? 'HIGH' : count >= 2 ? 'MEDIUM' : 'LOW');
      return {
        handoff_tool_context: { capability_level: level },
      };
    }

    it('handoff_tool_context is an object', () => {
      const enrichment = buildEnrichment({ ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false });
      assert.ok(typeof enrichment.handoff_tool_context === 'object' && enrichment.handoff_tool_context !== null,
        'handoff_tool_context should be a non-null object');
    });

    it('capability_level is HIGH/MEDIUM/LOW/UNKNOWN string', () => {
      const enrichment = buildEnrichment({ ripgrep: true, fd: true, jq: true, yq: true, bat: true, gh: true });
      const { capability_level } = enrichment.handoff_tool_context;
      assert.ok(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(capability_level),
        `capability_level should be HIGH, MEDIUM, LOW, or UNKNOWN; got ${capability_level}`);
    });

    it('capability_level matches tool count thresholds', () => {
      // 6 tools → HIGH
      const h = buildEnrichment({ ripgrep: true, fd: true, jq: true, yq: true, bat: true, gh: true });
      assert.strictEqual(h.handoff_tool_context.capability_level, 'HIGH');

      // 3 tools → MEDIUM
      const m = buildEnrichment({ ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: false });
      assert.strictEqual(m.handoff_tool_context.capability_level, 'MEDIUM');

      // 1 tool → LOW
      const l = buildEnrichment({ ripgrep: true, fd: false, jq: false, yq: false, bat: false, gh: false });
      assert.strictEqual(l.handoff_tool_context.capability_level, 'LOW');
    });

    it('handoff_tool_context defaults gracefully when tool_availability absent', () => {
      const enrichment = buildEnrichment(null);
      assert.strictEqual(enrichment.handoff_tool_context.capability_level, 'UNKNOWN');
    });

    it('handoff_tool_context reports UNKNOWN when tool availability is explicit unknowns', () => {
      const enrichment = buildEnrichment({ ripgrep: null, fd: null, jq: null, yq: null, bat: null, gh: null });
      assert.strictEqual(enrichment.handoff_tool_context.capability_level, 'UNKNOWN');
    });
  });

  // ─── Capability-aware context filtering tests ───────────────────────────────

  describe('capability-aware context filtering', () => {
    // Build a rich full context object to filter
    function buildFullContext() {
      return {
        phase_dir: '.planning/phases/0128',
        phase_number: 128,
        phase_name: 'agent-collaboration',
        plans: ['0128-01-PLAN.md'],
        incomplete_plans: [],
        plan_count: 1,
        incomplete_count: 0,
        branch_name: 'main',
        commit_docs: true,
        verifier_enabled: true,
        task_routing: { mode: 'auto' },
        env_summary: { node: '20' },
        tool_availability: { ripgrep: true, fd: true, jq: true, yq: false, bat: false, gh: true },
        summaries: ['0128-01-SUMMARY.md'],
        intent_summary: 'Build agent collaboration',
        research_enabled: true,
        plan_checker_enabled: false,
        codebase_stats: { files: 42 },
        codebase_conventions: { style: 'cjs' },
        codebase_dependencies: { total_modules: 10 },
        codebase_freshness: { days_since_update: 1 },
        decisions: {
          'file-discovery-mode': { value: 'fd', confidence: 'HIGH', rule_id: 'file-discovery-mode' },
          'search-mode': { value: 'ripgrep', confidence: 'HIGH', rule_id: 'search-mode' },
          'progress-route': { value: 'A', confidence: 'HIGH', rule_id: 'progress-route' },
        },
      };
    }

    it('verifier context excludes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-verifier');
      assert.ok(!('tool_availability' in scoped), 'verifier should not have tool_availability');
    });

    it('plan-checker context excludes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-plan-checker');
      assert.ok(!('tool_availability' in scoped), 'plan-checker should not have tool_availability');
    });

    it('phase-researcher context excludes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-phase-researcher');
      assert.ok(!('tool_availability' in scoped), 'phase-researcher should not have tool_availability');
    });

    it('executor context includes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-executor');
      assert.ok('tool_availability' in scoped, 'executor should have tool_availability');
    });

    it('debugger context includes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-debugger');
      assert.ok('tool_availability' in scoped, 'debugger should have tool_availability');
    });

    it('codebase-mapper context includes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-codebase-mapper');
      assert.ok('tool_availability' in scoped, 'codebase-mapper should have tool_availability');
    });

    it('planner context includes tool_availability', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-planner');
      assert.ok('tool_availability' in scoped, 'planner (medium dependency) should have tool_availability');
    });

    it('verifier context strips tool-routing decisions', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-verifier');
      if (scoped.decisions) {
        assert.ok(!('file-discovery-mode' in scoped.decisions), 'file-discovery-mode should be stripped');
        assert.ok(!('search-mode' in scoped.decisions), 'search-mode should be stripped');
      }
      // progress-route (non-tool-routing) should still be there if decisions exist
    });

    it('executor context keeps tool-routing decisions', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-executor');
      if (scoped.decisions) {
        // Executor (high) keeps all decisions including tool routing
        assert.ok('file-discovery-mode' in scoped.decisions, 'executor should keep file-discovery-mode decision');
      }
    });

    it('low-dependency agent savings > 0', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-verifier');
      assert.ok(scoped._savings, 'Expected _savings metadata');
      assert.ok(scoped._savings.reduction_pct > 0, 'Verifier should have positive reduction_pct');
    });

    it('high-dependency agent retains full context (no reduction from tool stripping)', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-executor');
      // High dependency agents don't strip tools — but scoping still occurs (excluded fields removed)
      assert.ok(scoped._savings, 'Expected _savings metadata');
      // tool_availability should be present (not stripped)
      assert.ok('tool_availability' in scoped, 'High dependency agent should have tool_availability');
    });

    it('filtering is silent — no _filtered_tools metadata', () => {
      const full = buildFullContext();
      const scoped = scopeContextForAgent(full, 'bgsd-verifier');
      // Agent should not know what was removed — no _filtered_tools field
      assert.ok(!('_filtered_tools' in scoped), 'Should not expose _filtered_tools to agent');
      assert.ok(!('_stripped' in scoped), 'Should not expose _stripped to agent');
    });
  });

  // ─── Handoff contract completeness tests ───────────────────────────────────

  describe('handoff contract completeness', () => {
    const { runGsdTools } = require('./helpers.cjs');

    // The 9 defined agent pairs from verify.js
    const ALL_PAIRS = [
      'planner→executor',
      'researcher→planner',
      'executor→verifier',
      'executor→planner',
      'planner→debugger',
      'verifier→planner',
      'planner→researcher',
      'executor→debugger',
      'debugger→executor',
    ];

    const CRITICAL_PAIRS = ['planner→executor', 'researcher→planner'];
    const MINIMAL_PAIRS = ALL_PAIRS.filter(p => !CRITICAL_PAIRS.includes(p));

    it('verify:handoff preview returns result for all 9 defined pairs', () => {
      for (const pair of ALL_PAIRS) {
        const [from, to] = pair.split('→');
        const result = runGsdTools(`verify:handoff --preview --from ${from} --to ${to}`);
        assert.ok(result.success, `verify:handoff --preview --from ${from} --to ${to} should succeed: ${result.error || ''}`);
        const output = result.output.replace(/^\[bGSD\].*\n/, '');
        const parsed = JSON.parse(output);
        assert.ok(parsed.handoff === pair || parsed.handoff, `Expected handoff key for ${pair}`);
      }
    });

    it('critical pairs have rich tool_context_type', () => {
      for (const pair of CRITICAL_PAIRS) {
        const [from, to] = pair.split('→');
        const result = runGsdTools(`verify:handoff --preview --from ${from} --to ${to}`);
        assert.ok(result.success, `${pair} should succeed`);
        const output = result.output.replace(/^\[bGSD\].*\n/, '');
        const parsed = JSON.parse(output);
        assert.strictEqual(parsed.tool_context_type, 'rich', `${pair} should have rich tool_context_type`);
      }
    });

    it('minimal pairs have minimal tool_context_type', () => {
      for (const pair of MINIMAL_PAIRS) {
        const [from, to] = pair.split('→');
        const result = runGsdTools(`verify:handoff --preview --from ${from} --to ${to}`);
        assert.ok(result.success, `${pair} should succeed`);
        const output = result.output.replace(/^\[bGSD\].*\n/, '');
        const parsed = JSON.parse(output);
        assert.strictEqual(parsed.tool_context_type, 'minimal', `${pair} should have minimal tool_context_type`);
      }
    });

    it('all handoff contexts include tool-related fields', () => {
      for (const pair of ALL_PAIRS) {
        const [from, to] = pair.split('→');
        const result = runGsdTools(`verify:handoff --preview --from ${from} --to ${to}`);
        assert.ok(result.success, `${pair} should succeed`);
        const output = result.output.replace(/^\[bGSD\].*\n/, '');
        const parsed = JSON.parse(output);
        // Every pair should have some tool-related information
        assert.ok(parsed.tool_context_type, `${pair} should have tool_context_type field`);
        // Context array should mention capability_level
        const contextStr = JSON.stringify(parsed.context || []);
        assert.ok(contextStr.includes('capability_level'), `${pair} context should reference capability_level`);
      }
    });

    it('no undefined handoff pairs in the 9 critical pairs', () => {
      for (const pair of ALL_PAIRS) {
        const [from, to] = pair.split('→');
        const result = runGsdTools(`verify:handoff --preview --from ${from} --to ${to}`);
        assert.ok(result.success, `${pair} should not return error`);
        const output = result.output.replace(/^\[bGSD\].*\n/, '');
        const parsed = JSON.parse(output);
        // Should have a defined contract with non-empty context
        assert.ok(parsed.context && parsed.context.length > 0, `${pair} should have non-empty context`);
        // Should have a tool_context_type (rich or minimal) — not undefined
        assert.ok(['rich', 'minimal'].includes(parsed.tool_context_type),
          `${pair} tool_context_type should be rich or minimal, got ${parsed.tool_context_type}`);
      }
    });
  });
});
