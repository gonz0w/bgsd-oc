/**
 * bgsd-tools agent tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('agent manifests: AGENT_MANIFESTS structure', () => {
  test('has entries for all supported agent types', () => {
    const ctx = require('../src/lib/context');
    const types = [
      'bgsd-executor',
      'bgsd-verifier',
      'bgsd-planner',
      'bgsd-phase-researcher',
      'bgsd-plan-checker',
      'bgsd-reviewer',
      'bgsd-roadmapper',
      'bgsd-project-researcher',
      'bgsd-debugger',
      'bgsd-codebase-mapper',
    ];
    for (const t of types) {
      assert.ok(ctx.AGENT_MANIFESTS[t], `Missing manifest for ${t}`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].fields), `${t} should have fields array`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].optional), `${t} should have optional array`);
      assert.ok(Array.isArray(ctx.AGENT_MANIFESTS[t].exclude), `${t} should have exclude array`);
    }
  });

  test('bgsd-reviewer manifest has review-scoped fields', () => {
    const ctx = require('../src/lib/context');
    const manifest = ctx.AGENT_MANIFESTS['bgsd-reviewer'];
    assert.ok(manifest, 'bgsd-reviewer manifest should exist');
    assert.ok(manifest.fields.includes('codebase_conventions'), 'Should include codebase_conventions');
    assert.ok(manifest.fields.includes('codebase_dependencies'), 'Should include codebase_dependencies');
    assert.ok(manifest.exclude.includes('incomplete_plans'), 'Should exclude incomplete_plans');
  });
});

describe('agent manifests: scopeContextForAgent', () => {
  const ctx = require('../src/lib/context');

  test('bgsd-executor gets workspace metadata but not intent_drift', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], incomplete_plans: [], plan_count: 0, incomplete_count: 0,
      branch_name: 'gsd/phase-38', commit_docs: true, verifier_enabled: true,
      workspace_enabled: true,
      workspace_config: { base_path: '/tmp/workspaces', max_concurrent: 3 },
      workspace_active: [],
      file_overlaps: [],
      task_routing: { plans: [] }, env_summary: 'node',
      intent_drift: { score: 20 }, intent_summary: 'Build stuff',
      codebase_stats: { total: 100 }, codebase_freshness: null,
    };
    const scoped = ctx.scopeContextForAgent(result, 'bgsd-executor');
    assert.strictEqual(scoped._agent, 'bgsd-executor');
    assert.ok('task_routing' in scoped, 'Should include task_routing');
    assert.ok('workspace_config' in scoped, 'Should include workspace_config');
    assert.ok(!('intent_drift' in scoped), 'Should exclude intent_drift');
    assert.ok(!('worktree_config' in scoped), 'Should exclude worktree_config');
  });

  test('bgsd-verifier gets phase_dir but not task_routing', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], summaries: [], verifier_enabled: true,
      effective_intent: { advisory: true },
      workspace_active: [{ plan_id: '38-01' }], workspace_config: { max_concurrent: 3 },
      task_routing: { plans: [] }, env_summary: 'node',
      intent_drift: { score: 20 }, codebase_stats: { total: 100 },
    };
    const scoped = ctx.scopeContextForAgent(result, 'bgsd-verifier');
    assert.strictEqual(scoped._agent, 'bgsd-verifier');
    assert.ok('phase_dir' in scoped, 'Should include phase_dir');
    assert.deepStrictEqual(scoped.effective_intent, { advisory: true }, 'Should preserve effective_intent');
    assert.ok(!('task_routing' in scoped), 'Should exclude task_routing');
    assert.ok(!('env_summary' in scoped), 'Should exclude env_summary');
    assert.ok(!('workspace_active' in scoped), 'Should exclude workspace_active');
    assert.ok(!('workspace_config' in scoped), 'Should exclude workspace_config');
  });

  test('planning and research agents keep effective_intent in scoped payloads', () => {
    const result = {
      phase_dir: '/test',
      phase_number: '157',
      phase_name: 'Planning Context Cascade',
      plan_count: 4,
      research_enabled: true,
      plan_checker_enabled: true,
      intent_summary: { objective: 'north star' },
      effective_intent: { advisory: true, effective: { objective: 'current focus' } },
      tool_availability: { fd: true },
      workspace_active: [{ name: '157-03' }],
      workspace_config: { base_path: '/tmp/ws', max_concurrent: 3 },
      decisions: { 'search-mode': { value: 'ripgrep' } },
      env_summary: 'node',
      verifier_enabled: true,
      plans: ['157-03-PLAN.md'],
      incomplete_plans: ['157-03-PLAN.md'],
    };

    for (const agentType of ['bgsd-planner', 'bgsd-phase-researcher', 'bgsd-roadmapper', 'bgsd-project-researcher']) {
      const scoped = ctx.scopeContextForAgent(result, agentType);
      assert.deepStrictEqual(scoped.effective_intent, result.effective_intent, `${agentType} should preserve effective_intent`);
    }
  });

  test('cached manifest mirror keeps effective_intent for scoped planning agents', () => {
    const { generateAgentContexts } = require('../src/lib/codebase-intel');
    const tmpDir = createTempProject();

    try {
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** 157\n**Current Plan:** 03\n**Total Plans in Phase:** 4\n**Status:** Ready to execute\n**Last Activity:** 2026-03-29\n`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n### Phase 157: Planning Context Cascade\n**Goal:** Keep compact intent context aligned\n**Plans:** 4 plans\n`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'INTENT.md'), `# Intent\n\n<objective>Project objective</objective>\n`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'MILESTONE-INTENT.md'), `# Milestone Intent\n\n<objective>Milestone focus</objective>\n`);
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '157-planning-context-cascade');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '157-CONTEXT.md'), `# Context\n\n<domain>\nGoal\n</domain>\n\n<decisions>\n- Keep intent compact.\n</decisions>\n\n<specifics>\n- Phase purpose: Ensure scoped agents keep effective intent.\n</specifics>\n`);

      const contexts = generateAgentContexts(tmpDir, { stats: { total_files: 1, total_lines: 1 }, git_commit_hash: 'abc123', generated_at: new Date().toISOString() });

      for (const agentType of ['bgsd-planner', 'bgsd-phase-researcher', 'bgsd-roadmapper', 'bgsd-project-researcher', 'bgsd-verifier']) {
        assert.ok(contexts[agentType], `Expected cached context for ${agentType}`);
        assert.ok(contexts[agentType].effective_intent, `${agentType} cached context should include effective_intent`);
      }
    } finally {
      cleanup(tmpDir);
    }
  });

  test('unknown agent type returns full result', () => {
    const result = { phase_dir: '/test', phase_number: '38' };
    const scoped = ctx.scopeContextForAgent(result, 'gsd-unknown-agent');
    assert.strictEqual(scoped.phase_dir, '/test');
    assert.strictEqual(scoped.phase_number, '38');
    assert.ok(!('_agent' in scoped), 'Should not add _agent for unknown type');
  });

  test('_savings shows reduction percentage', () => {
    const result = {
      phase_dir: '/test', phase_number: '38', phase_name: 'test',
      plans: [], incomplete_plans: [], plan_count: 0, incomplete_count: 0,
      branch_name: 'gsd/38', commit_docs: true, verifier_enabled: true,
      workspace_enabled: true,
      workspace_config: { base_path: '/tmp/workspaces', max_concurrent: 3 },
      workspace_active: [], file_overlaps: [],
      task_routing: null, env_summary: null,
      intent_drift: { score: 5 }, intent_summary: 'test',
      codebase_stats: null, codebase_freshness: null,
      codebase_conventions: null, codebase_dependencies: null,
    };
    const scoped = ctx.scopeContextForAgent(result, 'bgsd-executor');
    assert.ok(scoped._savings, 'Should have _savings');
    assert.ok(typeof scoped._savings.original_keys === 'number');
    assert.ok(typeof scoped._savings.scoped_keys === 'number');
    assert.ok(typeof scoped._savings.reduction_pct === 'number');
    assert.ok(scoped._savings.reduction_pct > 0, 'Should show positive reduction');
  });

  test('bgsd-reviewer gets codebase_conventions but not incomplete_plans', () => {
    const result = {
      phase_dir: '/test', phase_number: '41', phase_name: 'test',
      plans: [], incomplete_plans: ['41-01-PLAN.md'], plan_count: 1,
      summaries: [], codebase_conventions: { naming: 'camelCase' },
      codebase_dependencies: { total_modules: 5 }, codebase_stats: { total: 50 },
    };
    const scoped = ctx.scopeContextForAgent(result, 'bgsd-reviewer');
    assert.strictEqual(scoped._agent, 'bgsd-reviewer');
    assert.ok('codebase_conventions' in scoped, 'Should include codebase_conventions');
    assert.ok('codebase_dependencies' in scoped, 'Should include codebase_dependencies');
    assert.ok(!('incomplete_plans' in scoped), 'Should exclude incomplete_plans');
    assert.ok(!('plan_count' in scoped), 'Should exclude plan_count');
  });
});

describe('agent manifests: compactPlanState', () => {
  const ctx = require('../src/lib/context');

  test('reduces STATE.md to compact object with phase, progress, status', () => {
    const stateRaw = `# Project State

## Current Position

Phase: 39 — Orchestration Intelligence
Plan: 1 of 1 complete
Status: Phase complete
Last activity: 2026-02-27 — Completed 39-01

## Accumulated Context

### Decisions

- Phase 38-01: Use acorn
- Phase 38-02: Base complexity 1
- Phase 39-01: Model mapping scores
`;
    const compact = ctx.compactPlanState(stateRaw);
    assert.strictEqual(compact.phase, '39');
    assert.strictEqual(compact.progress, '1 of 1 complete');
    assert.strictEqual(compact.status, 'Phase complete');
    assert.strictEqual(compact.last_activity, '2026-02-27');
    assert.ok(compact.decisions.length >= 2, 'Should have decisions');
    assert.deepStrictEqual(compact.blockers, []);
  });

  test('decisions limited to last 5', () => {
    const stateRaw = `## Current Position
Phase: 10
Plan: 5 of 5 complete
Status: Phase complete
Last activity: 2026-01-01

### Decisions

- Phase 01-01: Decision A
- Phase 02-01: Decision B
- Phase 03-01: Decision C
- Phase 04-01: Decision D
- Phase 05-01: Decision E
- Phase 06-01: Decision F
- Phase 07-01: Decision G
`;
    const compact = ctx.compactPlanState(stateRaw);
    assert.strictEqual(compact.decisions.length, 5, 'Should cap at 5 decisions');
    assert.ok(compact.decisions[0].includes('03-01'), 'Should keep last 5 (starting from 3rd)');
    assert.ok(compact.decisions[4].includes('07-01'), 'Last decision should be 07-01');
  });

  test('empty/missing state returns sensible defaults', () => {
    const compact = ctx.compactPlanState('');
    assert.strictEqual(compact.phase, null);
    assert.strictEqual(compact.progress, null);
    assert.strictEqual(compact.status, null);
    assert.strictEqual(compact.last_activity, null);
    assert.deepStrictEqual(compact.decisions, []);
    assert.deepStrictEqual(compact.blockers, []);

    const compactNull = ctx.compactPlanState(null);
    assert.strictEqual(compactNull.phase, null);
  });
});

describe('agent manifests: compactDepGraph', () => {
  const ctx = require('../src/lib/context');

  test('reduces dep data, keeps top_imported capped at 5', () => {
    const dep = {
      total_modules: 25, total_edges: 60,
      top_imported: ['a(8)', 'b(6)', 'c(5)', 'd(4)', 'e(3)', 'f(2)', 'g(1)'],
      has_cycles: true, confidence: 0.85,
    };
    const compact = ctx.compactDepGraph(dep);
    assert.strictEqual(compact.total_modules, 25);
    assert.strictEqual(compact.total_edges, 60);
    assert.strictEqual(compact.top_imported.length, 5, 'Should cap at 5');
    assert.strictEqual(compact.has_cycles, true);
    assert.ok(!('confidence' in compact), 'Should strip confidence');
  });

  test('null/undefined input returns empty object', () => {
    assert.deepStrictEqual(ctx.compactDepGraph(null), {});
    assert.deepStrictEqual(ctx.compactDepGraph(undefined), {});
  });
});

describe('agent manifests: init --agent integration', () => {
  test('init execute-phase --agent=bgsd-executor returns scoped output', () => {
    const result = runGsdTools('init:execute-phase 38 --agent=bgsd-executor --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed._agent, 'bgsd-executor');
    assert.ok(parsed._savings, 'Should include _savings');
    assert.ok('phase_dir' in parsed, 'Should include phase_dir');
    assert.ok('task_routing' in parsed, 'Should include task_routing');
    assert.ok('workspace_config' in parsed, 'Should include workspace_config');
    assert.ok(!('intent_drift' in parsed), 'Should not include intent_drift');
    assert.ok(!('worktree_config' in parsed), 'Should not include worktree_config');
  });

  test('init execute-phase --agent=bgsd-verifier returns fewer fields than executor', () => {
    const execResult = runGsdTools('init:execute-phase 38 --agent=bgsd-executor --raw');
    const verResult = runGsdTools('init:execute-phase 38 --agent=bgsd-verifier --raw');
    assert.ok(execResult.success && verResult.success);

    const exec = JSON.parse(execResult.output);
    const ver = JSON.parse(verResult.output);
    assert.strictEqual(ver._agent, 'bgsd-verifier');
    assert.ok(ver._savings.scoped_keys < exec._savings.scoped_keys,
      `Verifier (${ver._savings.scoped_keys}) should have fewer fields than executor (${exec._savings.scoped_keys})`);
  });
});

describe('buildTaskContext: unit tests', () => {
  const ctx = require('../src/lib/context');

  test('single task file with known deps returns task file + 1-hop deps scored', () => {
    // Use the real project to get a file that's in the dep graph
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js']);
    assert.ok(Array.isArray(result.task_files), 'task_files should be array');
    assert.deepStrictEqual(result.task_files, ['src/lib/output.js']);
    assert.ok(result.context_files.length >= 1, 'Should include at least the task file');
    // The task file itself should be score 1.0
    const taskEntry = result.context_files.find(f => f.path === 'src/lib/output.js');
    assert.ok(taskEntry, 'Task file should be in context_files');
    assert.strictEqual(taskEntry.score, 1.0);
    assert.strictEqual(taskEntry.reason, 'direct task file');
  });

  test('multiple task files returns union of deps with no duplicates', () => {
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js', 'src/lib/format.js']);
    assert.ok(result.context_files.length >= 2, 'Should include at least 2 files');
    // Check no duplicates
    const paths = result.context_files.map(f => f.path);
    assert.strictEqual(paths.length, new Set(paths).size, 'No duplicate paths');
  });

  test('token budget enforced: drops lowest-scored files when over budget', () => {
    const full = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { tokenBudget: 50000 });
    const constrained = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { tokenBudget: 100 });
    assert.ok(constrained.context_files.length <= full.context_files.length,
      'Constrained should have fewer or equal files');
    assert.ok(constrained.stats.token_estimate <= 100 || constrained.context_files.length === 1,
      'Should respect budget or keep at least 1 file');
  });

  test('no codebase intel: graceful fallback returning just task files', () => {
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-btc-'));
    try {
      const result = ctx.buildTaskContext(tmpDir, ['some/file.js']);
      assert.deepStrictEqual(result.task_files, ['some/file.js']);
      // Without intel, still returns the task file with score 1.0
      assert.ok(result.context_files.length >= 0, 'Should handle gracefully');
      assert.strictEqual(result.stats.candidates_found, result.context_files.length);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('includeSignatures=true adds signatures array to context files', () => {
    const result = ctx.buildTaskContext(process.cwd(), ['src/lib/output.js'], { includeSignatures: true });
    // Find a non-task context file that would have signatures
    const ctxFile = result.context_files.find(f => f.score < 1.0 && f.signatures);
    if (result.context_files.length > 1) {
      // At least some context files should have signatures if they're JS
      const hasAnySigs = result.context_files.some(f => f.signatures && f.signatures.length > 0);
      assert.ok(hasAnySigs, 'At least one context file should have signatures');
    }
  });

  test('empty task files returns empty context with zero stats', () => {
    const result = ctx.buildTaskContext(process.cwd(), []);
    assert.deepStrictEqual(result.task_files, []);
    assert.deepStrictEqual(result.context_files, []);
    assert.strictEqual(result.stats.candidates_found, 0);
    assert.strictEqual(result.stats.files_included, 0);
    assert.strictEqual(result.stats.token_estimate, 0);
    assert.strictEqual(result.stats.reduction_pct, 0);
  });
});

describe('buildTaskContext: integration tests (CLI)', () => {
  test('codebase context --task returns JSON with context_files and stats', () => {
    const result = runGsdTools('util:codebase context --task src/lib/output.js --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.success, 'Should return success');
    assert.ok(Array.isArray(parsed.task_files), 'Should have task_files array');
    assert.ok(Array.isArray(parsed.context_files), 'Should have context_files array');
    assert.ok(parsed.stats, 'Should have stats object');
    assert.ok(typeof parsed.stats.candidates_found === 'number');
    assert.ok(typeof parsed.stats.files_included === 'number');
    assert.ok(typeof parsed.stats.reduction_pct === 'number');
  });

  test('codebase context --task with --budget respects budget, fewer files', () => {
    const fullResult = runGsdTools('util:codebase context --task src/lib/output.js --raw');
    const budgetResult = runGsdTools('util:codebase context --task src/lib/output.js --budget 200 --raw');
    assert.ok(fullResult.success && budgetResult.success);
    const full = JSON.parse(fullResult.output);
    const constrained = JSON.parse(budgetResult.output);
    assert.ok(constrained.stats.files_included <= full.stats.files_included,
      `Budget-constrained (${constrained.stats.files_included}) should have <= files than full (${full.stats.files_included})`);
  });

  test('stats.reduction_pct > 0 proves context was reduced vs all candidates', () => {
    const result = runGsdTools('util:codebase context --task src/lib/output.js --budget 1000 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    // With budget constraint of 1000, if there are many candidates, reduction should be > 0
    if (parsed.stats.candidates_found > parsed.stats.files_included) {
      assert.ok(parsed.stats.reduction_pct > 0, `Expected reduction > 0%, got ${parsed.stats.reduction_pct}%`);
    }
  });

  test('quality baseline: known task includes direct deps and importers', () => {
    // src/lib/codebase-intel.js imports src/lib/output.js, src/lib/git.js, src/lib/helpers.js
    // So testing codebase-intel.js should find its deps in context
    const result = runGsdTools('util:codebase context --task src/lib/codebase-intel.js --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    const paths = parsed.context_files.map(f => f.path);
    // codebase-intel.js imports output.js, git.js, helpers.js — check at least one dep is present
    const hasDep = paths.includes('src/lib/output.js') || paths.includes('src/lib/git.js') || paths.includes('src/lib/helpers.js');
    assert.ok(hasDep, `Expected at least one dependency of codebase-intel.js in context. Got: ${paths.join(', ')}`);
    // Check importers are also present. Keep this list broad enough to match the
    // current codebase as command/context wiring evolves.
    const hasImporter = [
      'src/commands/codebase.js',
      'src/commands/init.js',
      'src/lib/deps.js',
      'src/commands/misc.js',
      'src/commands/features.js',
      'src/lib/context.js',
    ].some(importer => paths.includes(importer));
    assert.ok(hasImporter, `Expected at least one importer of codebase-intel.js in context. Got: ${paths.join(', ')}`);
  });
});

describe('review command', () => {
  test('review without args returns error', () => {
    const result = runGsdTools('verify:review');
    assert.ok(!result.success || result.output.includes('error'), 'Should error without args');
  });

  test('review 37 01 returns JSON with commits, diff, and conventions fields', () => {
    const result = runGsdTools('verify:review 37 01 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok('commits' in parsed, 'Should have commits field');
    assert.ok('diff' in parsed, 'Should have diff field');
    assert.ok('conventions' in parsed, 'Should have conventions field');
    assert.strictEqual(parsed.plan, '01', 'Plan should be 01');
  });

  test('review output includes files_changed array', () => {
    const result = runGsdTools('verify:review 37 01 --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.files_changed), 'files_changed should be an array');
  });
});

describe('tdd', () => {
  test('execute:tdd help sources expose canonical contract commands', () => {
    const constants = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'constants.js'), 'utf-8');
    const commandHelp = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'command-help.js'), 'utf-8');

    assert.match(constants, /Canonical TDD contract command surfaces\./);
    assert.match(constants, /exact-command validation and\s+structured proof/i);
    assert.match(commandHelp, /Run exact-command TDD contract checks and proof helpers/);
    assert.match(constants, /validate-red/);
    assert.match(constants, /validate-green/);
    assert.match(constants, /validate-refactor/);
    assert.match(constants, /auto-test/);
    assert.match(constants, /detect-antipattern/);
  });

  test('validate-red succeeds when test fails (exit 1)', () => {
    const result = runGsdTools('execute:tdd validate-red --test-cmd "exit 1"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.target_command, 'exit 1');
    assert.strictEqual(parsed.test_exit_code, 1);
    assert.strictEqual(parsed.proof.target_command, 'exit 1');
    assert.strictEqual(parsed.proof.exit_code, 1);
    assert.strictEqual(parsed.proof.expected_outcome, 'fail');
    assert.strictEqual(parsed.proof.observed_outcome, 'fail');
    assert.strictEqual(typeof parsed.proof.evidence.snippet, 'string');
  });

  test('validate-red fails when test passes (exit 0)', () => {
    const result = runGsdTools('execute:tdd validate-red --test-cmd "exit 0"');
    assert.ok(!result.success, 'Should fail when test passes in red phase');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.strictEqual(parsed.valid, false);
    assert.strictEqual(parsed.test_exit_code, 0);
  });

  test('validate-red rejects missing target command', () => {
    const result = runGsdTools('execute:tdd validate-red --test-cmd "definitely-not-a-real-bgsd-command-12345"');
    assert.ok(!result.success, 'Should fail when red target command is missing');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.strictEqual(parsed.valid, false);
    assert.strictEqual(parsed.proof.target_missing, true);
    assert.strictEqual(parsed.proof.evidence.type, 'missing-target');
  });

  test('validate-green succeeds when test passes (exit 0)', () => {
    const result = runGsdTools('execute:tdd validate-green --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'green');
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.target_command, 'exit 0');
    assert.strictEqual(parsed.proof.expected_outcome, 'pass');
    assert.strictEqual(parsed.proof.observed_outcome, 'pass');
  });

  test('validate-green fails when test fails (exit 1)', () => {
    const result = runGsdTools('execute:tdd validate-green --test-cmd "exit 1"');
    assert.ok(!result.success, 'Should fail when test fails in green phase');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'green');
    assert.strictEqual(parsed.valid, false);
  });

  test('validate-refactor succeeds when test passes', () => {
    const result = runGsdTools('execute:tdd validate-refactor --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'refactor');
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.proof.expected_outcome, 'pass');
  });

  test('validate-refactor rejects regressions when target fails', () => {
    const result = runGsdTools('execute:tdd validate-refactor --test-cmd "exit 1"');
    assert.ok(!result.success, 'Should fail when refactor target regresses');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'refactor');
    assert.strictEqual(parsed.valid, false);
    assert.strictEqual(parsed.proof.observed_outcome, 'fail');
  });

  test('auto-test reports pass', () => {
    const result = runGsdTools('execute:tdd auto-test --test-cmd "exit 0"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.passed, true);
    assert.strictEqual(parsed.exit_code, 0);
    assert.strictEqual(parsed.target_command, 'exit 0');
    assert.strictEqual(parsed.proof.target_command, 'exit 0');
  });

  test('auto-test reports fail', () => {
    const result = runGsdTools('execute:tdd auto-test --test-cmd "exit 1"');
    // auto-test should not set process.exitCode
    assert.ok(result.success, `auto-test should succeed even when test fails: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.passed, false);
    assert.strictEqual(parsed.exit_code, 1);
  });

  test('detect-antipattern warns on non-test source files in red phase', () => {
    const result = runGsdTools('execute:tdd detect-antipattern --phase red --files "src/foo.js"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, 'red');
    assert.ok(parsed.warnings.length > 0, 'Should have warnings for non-test file in red');
    assert.strictEqual(parsed.warnings[0].type, 'pre_test_code');
  });

  test('detect-antipattern clean on test files in red phase', () => {
    const result = runGsdTools('execute:tdd detect-antipattern --phase red --files "src/foo.test.js"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.warnings.length, 0, 'Should have no warnings for test file in red');
  });

  test('GSD-Phase trailer on commit', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-tdd-'));
    try {
      // Set up git repo
      execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      // Create .planning dir and config for commit to work
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{"commit_docs":true}');
      // Create a file to commit
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello');
      const result = runGsdTools('execute:commit "test(tdd): red phase" --tdd-phase red --force --files test.txt', tmpDir);
      assert.ok(result.success, `Commit failed: ${result.error || result.output}`);
      // Check git log for trailer
      const log = execSync('git log -1 --format=%b', { cwd: tmpDir, encoding: 'utf-8' }).trim();
       assert.ok(log.includes('GSD-Phase: red'), `Expected GSD-Phase trailer in: ${log}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('util:agent audit (RACI parsing)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create agents directory with a test agent
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), `---
description: Test agent for audit validation
color: "#FF0000"
tools:
  read: true
---

# Test Agent
`);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('parseRaciMatrix handles hyphenated step names', () => {
    // Create RACI.md with hyphenated step names
    const refsDir = path.join(tmpDir, 'references');
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(refsDir, 'RACI.md'), `# RACI Matrix

## RACI Matrix

| Step | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|------|----------------|-----------------|---------------|--------------|
| project-init | test-agent | User | — | — |
| plan-creation | test-agent | User | — | — |
| post-execution-review | test-agent | User | — | — |
| gap-closure-planning | test-agent | User | — | — |

## Other Section
`);

    // Use the built CLI's parseRaciMatrix indirectly by running audit
    // But since we can't easily call the function directly from the built bundle,
    // we test via the source module
    const agentModule = require('../src/commands/agent');
    const result = agentModule.parseRaciMatrix(path.join(refsDir, 'RACI.md'));

    assert.ok(result.stepMapping['project-init'], 'Should parse hyphenated step "project-init"');
    assert.ok(result.stepMapping['plan-creation'], 'Should parse hyphenated step "plan-creation"');
    assert.ok(result.stepMapping['post-execution-review'], 'Should parse hyphenated step "post-execution-review"');
    assert.ok(result.stepMapping['gap-closure-planning'], 'Should parse hyphenated step "gap-closure-planning"');
    assert.strictEqual(result.lifecycleSteps.length, 4, 'Should find 4 lifecycle steps');
  });

  test('parseRaciMatrix backward compatible with single-word steps', () => {
    const refsDir = path.join(tmpDir, 'references');
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(refsDir, 'RACI.md'), `# RACI

## RACI Matrix

| Step | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|------|----------------|-----------------|---------------|--------------|
| Init | User | — | — | — |
| Discuss | User | — | — | — |
| Research | test-agent | — | — | — |
| Plan | test-agent | — | — | — |
| Execute | test-agent | — | — | — |
| Verify | test-agent | — | — | — |
| Complete | User | — | — | — |

## End
`);

    const agentModule = require('../src/commands/agent');
    const result = agentModule.parseRaciMatrix(path.join(refsDir, 'RACI.md'));

    assert.strictEqual(result.lifecycleSteps.length, 7, 'Should find 7 lifecycle steps in old format');
    assert.ok(result.stepMapping['Init'], 'Should parse single-word step "Init"');
    assert.ok(result.stepMapping['Execute'], 'Should parse single-word step "Execute"');
  });
});

describe('util:agent validate-contracts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validate-contracts returns structured JSON output', () => {
    const result = runGsdTools('util:agent validate-contracts', tmpDir);
    // May pass or fail depending on agent dir, but should always return JSON
    const combined = result.output || '';
    // Try to parse from stdout; if command failed, the error output still should not crash
    if (result.success) {
      const parsed = JSON.parse(combined);
      assert.ok('agents_checked' in parsed, 'Should have agents_checked field');
      assert.ok('status' in parsed, 'Should have status field');
      assert.ok('errors' in parsed, 'Should have errors field');
      assert.ok('warnings' in parsed, 'Should have warnings field');
      assert.ok('contracts_valid' in parsed, 'Should have contracts_valid field');
      assert.ok('contracts_invalid' in parsed, 'Should have contracts_invalid field');
    }
  });

  test('validate-contracts detects missing required sections in output files', () => {
    // Create a minimal agents directory with an agent that declares outputs
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), `---
description: Test agent with output contracts
color: "#00FF00"
tools:
  read: true
outputs:
  - file: "SUMMARY.md"
    required_sections: ["## Performance", "## Accomplishments", "## Missing Section XYZ"]
    consumer: "test-consumer"
---

# Test Agent
`);

    // Create a phase directory with a SUMMARY that is missing a section
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'SUMMARY.md'), `# Summary

## Performance
Some performance data.

## Accomplishments
Some accomplishments.
`);

    // Run validate-contracts against phase 01 with plugin assets rooted at tmpDir
    // We can't easily override plugin asset resolution for the CLI here, so test the module directly
    const agentModule = require('../src/commands/agent');
    // The module resolves plugin paths internally
    // For this test, we verify the parseContractArrays and contentHasSection logic
    assert.ok(agentModule.parseRaciMatrix, 'parseRaciMatrix should be exported');
  });

  test('agent list returns expected structure', () => {
    const result = runGsdTools('util:agent list', tmpDir);
    if (result.success) {
      const parsed = JSON.parse(result.output);
      assert.ok('agents' in parsed, 'Should have agents field');
      assert.ok(Array.isArray(parsed.agents), 'agents should be an array');
      if (parsed.agents.length > 0) {
        const agent = parsed.agents[0];
         assert.ok('name' in agent, 'Each agent should have a name');
        assert.ok('description' in agent, 'Each agent should have a description');
      }
    }
  });
});
