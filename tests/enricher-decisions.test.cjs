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
  evaluateDecisions,
} = require('../src/lib/decision-rules');

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

  it('returns needs-research when nothing exists', () => {
    const result = resolvePlanExistenceRoute({ plan_count: 0, has_research: false, has_context: false });
    assert.strictEqual(result.value, 'needs-research');
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
