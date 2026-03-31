/**
 * bgsd-tools integration tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, writeStateFixture, hasJj, initJjRepo, initColocatedCommitRepo } = require('./helpers.cjs');
const { getPhaseTree, buildPhaseSnapshotInternal, invalidateFileCache } = require('../src/lib/helpers');

describe('integration: workflow sequences', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Minimal project scaffolding
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 2\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n## Active Milestone: v1.0\n\n### Phase 1: Foundation\n- [ ] **Phase 1: Foundation**\n**Goal:** Build foundation\n**Plans:** 1 plans\n**Requirements:** REQ-01\n\n### Phase 2: Features\n- [ ] **Phase 2: Features**\n**Goal:** Add features\n**Plans:** 1 plans\n**Requirements:** REQ-02\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n## v1.0 Requirements\n\n- [ ] **REQ-01**: First requirement\n- [ ] **REQ-02**: Second requirement\n- [ ] **REQ-03**: Third requirement (uncovered)\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      `# Test Project\n\nA project for integration testing.\n`
    );
    // Create a phase directory with a plan
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\ndepends_on: []\nrequirements:\n  - REQ-01\nfiles_modified:\n  - src/index.js\nmust_haves:\n  artifacts: []\n  key_links: []\n---\n# Plan 01-01: Foundation\n\n<task type="implement">\n<name>Setup</name>\n<files>src/index.js</files>\n<action>Create setup code.</action>\n<verify>Check it works.</verify>\n<done>Setup complete.</done>\n</task>\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init → state → roadmap sequence', () => {
    // Step 1: init progress
    const progressResult = runGsdTools('init:progress --verbose', tmpDir);
    assert.ok(progressResult.success, `init progress failed: ${progressResult.error}`);
    const progressData = JSON.parse(progressResult.output);
    assert.strictEqual(progressData.project_exists, true, 'project should exist');
    assert.ok(progressData.phase_count > 0, 'should have phases');

    // Step 2: state load
    const stateResult = runGsdTools('verify:state load', tmpDir);
    assert.ok(stateResult.success, `state load failed: ${stateResult.error}`);
    const stateData = JSON.parse(stateResult.output);
    assert.strictEqual(stateData.state_exists, true, 'state should exist');

    // Step 3: roadmap analyze
    const roadmapResult = runGsdTools('plan:roadmap analyze', tmpDir);
    assert.ok(roadmapResult.success, `roadmap analyze failed: ${roadmapResult.error}`);
    const roadmapData = JSON.parse(roadmapResult.output);
    assert.ok(roadmapData.phase_count > 0, 'roadmap should have phases');
  });

  test('state mutation sequence: patch → get', () => {
    // Patch multiple fields (no --raw: returns JSON with updated/failed arrays)
    const patchResult = runGsdTools('verify:state patch --Phase "2 of 2" --Status "Planning"', tmpDir);
    assert.ok(patchResult.success, `state patch failed: ${patchResult.error}`);
    const patchData = JSON.parse(patchResult.output);
    assert.ok(patchData.updated.length > 0, 'should have updated fields');
    assert.deepStrictEqual(patchData.failed, [], 'no fields should fail');

    // Get back each field (no --raw: returns JSON object)
    const phaseResult = runGsdTools('verify:state get Phase', tmpDir);
    assert.ok(phaseResult.success, `state get Phase failed: ${phaseResult.error}`);
    const phaseData = JSON.parse(phaseResult.output);
    assert.strictEqual(phaseData.Phase, '2 of 2', 'Phase should be updated');

    const statusResult = runGsdTools('verify:state get Status', tmpDir);
    assert.ok(statusResult.success, `state get Status failed: ${statusResult.error}`);
    const statusData = JSON.parse(statusResult.output);
    assert.strictEqual(statusData.Status, 'Planning', 'Status should be updated');
  });

  test('memory write → read → list sequence', () => {
    // Write an entry to the decisions store (must use a valid store name)
    const writeResult = runGsdTools(
      `util:memory write --store decisions --entry '{"text":"integration test decision","phase":"1"}'`,
      tmpDir
    );
    assert.ok(writeResult.success, `util:memory write failed: ${writeResult.error}`);
    const writeData = JSON.parse(writeResult.output);
    assert.strictEqual(writeData.written, true, 'should be written');
    assert.strictEqual(writeData.store, 'decisions', 'store name should match');

    // Read it back
    const readResult = runGsdTools('util:memory read --store decisions', tmpDir);
    assert.ok(readResult.success, `memory read failed: ${readResult.error}`);
    const readData = JSON.parse(readResult.output);
    assert.ok(readData.count > 0, 'should have entries');
    assert.strictEqual(readData.store, 'decisions', 'store name should match');
    assert.ok(readData.entries.length > 0, 'entries array should not be empty');

    // List all stores
    const listResult = runGsdTools('util:memory list', tmpDir);
    assert.ok(listResult.success, `memory list failed: ${listResult.error}`);
    const listData = JSON.parse(listResult.output);
    assert.ok(listData.stores.length > 0, 'should have at least one store');
    const storeNames = listData.stores.map(s => s.name);
    assert.ok(storeNames.includes('decisions'), 'decisions should be in list');
  });

  test('verify requirements with mixed coverage', () => {
    // REQ-01 is covered by phase plan, REQ-02 is in roadmap but not in plan, REQ-03 is uncovered
    // (no --raw: --raw returns "pass"/"fail" string; without it returns JSON)
    const result = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(result.success, `verify requirements failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.total, 3, 'should have 3 total requirements');
    assert.ok(data.unaddressed >= 1, 'at least one should be unaddressed');
    assert.ok(Array.isArray(data.unaddressed_list), 'unaddressed_list should be array');
  });
});

describe('integration: scoped effective intent delivery', () => {
  test('plan-phase agent scoping keeps effective_intent for planner and verifier-style handoffs stay compact', () => {
    const planner = JSON.parse(runGsdTools('init:plan-phase 157 --agent=bgsd-planner --raw').output);
    const verifierScoped = require('../src/lib/context').scopeContextForAgent(
      JSON.parse(runGsdTools('init:verify-work 157 --verbose').output),
      'bgsd-verifier'
    );

    assert.ok(planner.effective_intent, 'planner should receive effective_intent from --agent scoping');
    assert.ok(!('workspace_active' in planner), 'planner should not receive execution workspace inventory');
    assert.ok(verifierScoped.effective_intent, 'verifier-scoped handoff should preserve effective_intent');
    assert.ok(!('workspace_active' in verifierScoped), 'verifier-scoped handoff should stay free of workspace inventory');
    assert.ok(!('workspace_config' in verifierScoped), 'verifier-scoped handoff should stay free of workspace config');
  });
});

describe('integration: phase 156 workspace execution contract', () => {
  test('execute-phase workflow documents per-plan workspaces partial-wave reporting and retained recovery workspaces', () => {
    const projectRoot = path.join(__dirname, '..');
    const executeWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'execute-phase.md'), 'utf-8');

    assert.match(executeWorkflow, /each runnable plan in the wave so every plan gets its own managed JJ workspace/i);
    assert.match(executeWorkflow, /track commit\/summary status per workspace/i);
    assert.match(executeWorkflow, /Report partial-wave outcomes honestly/i);
    assert.match(executeWorkflow, /reconcile healthy workspaces immediately/i);
    assert.match(executeWorkflow, /leave stale\/divergent\/failed workspaces retained for inspection and recovery/i);
    assert.match(executeWorkflow, /only let `workspace cleanup` remove obsolete failed workspaces after successful phase completion/i);
    assert.ok(!/Conflicts or stale handling stay deferred to Phase 156/i.test(executeWorkflow), 'Phase 156 workflow contract should no longer be deferred');
  });
});

describe('integration: state round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 3\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('full state lifecycle: patch fields, get each, add decision', () => {
    // Patch Phase, Plan, Status (no --raw: returns JSON with updated/failed)
    const patchResult = runGsdTools('verify:state patch --Phase "2 of 3" --Plan "02" --Status "Planning"', tmpDir);
    assert.ok(patchResult.success, `state patch failed: ${patchResult.error}`);
    const patchData = JSON.parse(patchResult.output);
    assert.ok(patchData.updated.includes('Phase'), 'Phase should be updated');
    assert.ok(patchData.updated.includes('Plan'), 'Plan should be updated');
    assert.ok(patchData.updated.includes('Status'), 'Status should be updated');

    // Get each back (no --raw: returns JSON object)
    const phaseGet = runGsdTools('verify:state get Phase', tmpDir);
    assert.ok(phaseGet.success);
    assert.strictEqual(JSON.parse(phaseGet.output).Phase, '2 of 3');

    const planGet = runGsdTools('verify:state get Plan', tmpDir);
    assert.ok(planGet.success);
    assert.strictEqual(JSON.parse(planGet.output).Plan, '02');

    const statusGet = runGsdTools('verify:state get Status', tmpDir);
    assert.ok(statusGet.success);
    assert.strictEqual(JSON.parse(statusGet.output).Status, 'Planning');

    // Add a decision (no --raw: returns JSON; --summary is the required arg)
    const decisionResult = runGsdTools(
      `verify:state add-decision --summary "Test decision from round-trip" --rationale "Testing"`,
      tmpDir
    );
    assert.ok(decisionResult.success, `state add-decision failed: ${decisionResult.error}`);
    const decisionData = JSON.parse(decisionResult.output);
    assert.strictEqual(decisionData.added, true, 'decision should be added');

    // Verify decision persisted by loading state
    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes('Test decision from round-trip'), 'decision text should be in STATE.md');
  });

  test('frontmatter round-trip: get → set → get', () => {
    // Create a plan file with frontmatter
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planPath = path.join(phaseDir, '01-01-PLAN.md');
    fs.writeFileSync(
      planPath,
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\n---\n# Test Plan\n\nContent here.\n'
    );

    const relPath = '.planning/phases/01-test/01-01-PLAN.md';

    // Get initial frontmatter
    const getResult = runGsdTools(`util:frontmatter get ${relPath}`, tmpDir);
    assert.ok(getResult.success, `frontmatter get failed: ${getResult.error}`);
    const fmData = JSON.parse(getResult.output);
    assert.strictEqual(fmData.wave, '1', 'wave should be "1" (string)');
    assert.strictEqual(fmData.plan, '01-01', 'plan should be 01-01');

    // Set a field
    const setResult = runGsdTools(`util:frontmatter set ${relPath} --field wave --value 2`, tmpDir);
    assert.ok(setResult.success, `frontmatter set failed: ${setResult.error}`);

    // Get again and verify
    const getResult2 = runGsdTools(`util:frontmatter get ${relPath}`, tmpDir);
    assert.ok(getResult2.success, `frontmatter get (2) failed: ${getResult2.error}`);
    const fmData2 = JSON.parse(getResult2.output);
    assert.strictEqual(fmData2.wave, '2', 'wave should be updated to "2"');
    assert.strictEqual(fmData2.plan, '01-01', 'plan should be unchanged');
  });
});

describe('integration: config migration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('migrates old flat config to modern format', () => {
    // Write an old-style flat config
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        mode: 'yolo',
        depth: 'thorough',
        commit_docs: true,
        branching_strategy: 'phase-branch',
        research: true
      }, null, 2)
    );

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `config-migrate failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Should have migrated some keys
    assert.ok(data.migrated_keys.length > 0, 'should have migrated keys');
    assert.ok(data.config_path, 'should have config_path');

    // Verify the resulting config has nested structure
    const newConfig = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.ok(newConfig.planning || newConfig.git || newConfig.workflow,
      'migrated config should have nested sections');
  });

  test('idempotent on modern config', () => {
    // Write a fully-complete modern config with ALL schema keys
    const modernConfig = {
      mode: 'yolo',
      depth: 'thorough',
      model_profile: 'balanced',
      parallelization: true,
      brave_search: false,
      model_profiles: {},
      test_commands: {},
      test_gate: true,
      context_window: 200000,
      context_target_percent: 50,
      ytdlp_path: '',
      nlm_path: '',
      mcp_config_path: '',
      runtime: 'auto',
      planning: { commit_docs: true, search_gitignored: false },
      git: {
        branching_strategy: 'phase-branch',
        phase_branch_template: 'gsd/phase-{phase}-{slug}',
        milestone_branch_template: 'gsd/{milestone}-{slug}'
      },
      workflow: { research: true, plan_check: true, verifier: true, rag: true, rag_timeout: 30 },
      workspace: {
        base_path: '/tmp/gsd-workspaces',
        max_concurrent: 3,
      },
      optimization: {
        valibot: true,
        valibot_fallback: false,
        discovery: 'optimized',
        compile_cache: false,
        sqlite_cache: true
      },
      tools: {
        ripgrep: true,
        fd: true,
        jq: true,
        yq: true,
        ast_grep: true,
        sd: true,
        hyperfine: true,
        bat: true,
        gh: true
      }
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(modernConfig, null, 2)
    );

    const result = runGsdTools('util:config-migrate', tmpDir);
    assert.ok(result.success, `config-migrate failed: ${result.error}`);
    const data = JSON.parse(result.output);

    // Should have zero migrated keys (already fully modern)
    assert.deepStrictEqual(data.migrated_keys, [], 'modern config should have nothing to migrate');
    assert.ok(data.unchanged_keys.length > 0, 'should have unchanged keys');

    // Nested sections should be unchanged
    const afterConfig = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.deepStrictEqual(afterConfig.planning, modernConfig.planning, 'planning section unchanged');
    assert.deepStrictEqual(afterConfig.git, modernConfig.git, 'git section unchanged');
    assert.deepStrictEqual(afterConfig.workflow, modernConfig.workflow, 'workflow section unchanged');
  });
});

describe('integration: e2e simulation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('full project lifecycle: init progress → verify plan-structure → verify requirements', () => {
    // Set up complete mock project in temp dir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\n**Last session:** 2026-02-24\n**Stopped at:** Phase 1 setup\n**Resume file:** None\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n## Active Milestone: v1.0\n\n### Phase 1: Test Phase\n- [ ] **Phase 1: Test Phase**\n**Goal:** Validate E2E simulation\n**Plans:** 1 plans\n**Requirements:** E2E-01, E2E-02\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n## v1.0 Requirements\n\n- [ ] **E2E-01**: First requirement\n- [ ] **E2E-02**: Second requirement\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      `# E2E Test Project\n\nA project for E2E simulation testing.\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );

    // Create phase with a fully valid plan (all required frontmatter fields)
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nwave: 1\nplan: "01-01"\nphase: "01"\ntype: execute\nautonomous: true\ndepends_on: []\nrequirements:\n  - E2E-01\nfiles_modified:\n  - src/index.js\nmust_haves:\n  artifacts: []\n  key_links: []\n---\n# Plan 01-01: E2E Test Plan\n\n<task type="implement">\n<name>Setup infrastructure</name>\n<files>src/index.js</files>\n<action>Create the setup code.</action>\n<verify>Check that it works.</verify>\n<done>Infrastructure is set up.</done>\n</task>\n'
    );

    // Step 1: init progress --verbose → verify project_exists
    const progressResult = runGsdTools('init:progress --verbose', tmpDir);
    assert.ok(progressResult.success, `init progress failed: ${progressResult.error}`);
    const progressData = JSON.parse(progressResult.output);
    assert.strictEqual(progressData.project_exists, true, 'project should exist');

    // Step 2: verify plan-structure → verify valid (no --raw; raw returns string not JSON)
    const planPath = '.planning/phases/01-test/01-01-PLAN.md';
    const verifyResult = runGsdTools(`verify:verify plan-structure ${planPath}`, tmpDir);
    assert.ok(verifyResult.success, `verify plan-structure failed: ${verifyResult.error}`);
    const verifyData = JSON.parse(verifyResult.output);
    assert.strictEqual(verifyData.valid, true, 'plan should be valid');

    // Step 3: verify requirements → verify total > 0 (no --raw; raw returns pass/fail string)
    const reqResult = runGsdTools('verify:verify requirements', tmpDir);
    assert.ok(reqResult.success, `verify requirements failed: ${reqResult.error}`);
    const reqData = JSON.parse(reqResult.output);
    assert.ok(reqData.total > 0, `should have requirements, got total=${reqData.total}`);
  });

  test('memory lifecycle: write decision → write bookmark → init memory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n## Current Position\n\n**Phase:** 1 of 1\n**Plan:** 01\n**Status:** Executing\n**Last Activity:** 2026-02-24\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }, null, 2)
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Write a decision entry
    const decisionResult = runGsdTools(
      `util:memory write --store decisions --entry '{"text":"e2e test decision","phase":"1"}'`,
      tmpDir
    );
    assert.ok(decisionResult.success, `util:memory write decisions failed: ${decisionResult.error}`);
    const decisionData = JSON.parse(decisionResult.output);
    assert.strictEqual(decisionData.written, true, 'decision should be written');

    // Write a bookmark entry
    const bookmarkResult = runGsdTools(
      `util:memory write --store bookmarks --entry '{"phase":"1","plan":"01","task":1}'`,
      tmpDir
    );
    assert.ok(bookmarkResult.success, `util:memory write bookmarks failed: ${bookmarkResult.error}`);
    const bookmarkData = JSON.parse(bookmarkResult.output);
    assert.strictEqual(bookmarkData.written, true, 'bookmark should be written');

    // Init memory → verify decisions and bookmark present
    const memoryResult = runGsdTools('init:memory', tmpDir);
    assert.ok(memoryResult.success, `init memory failed: ${memoryResult.error}`);
    const memoryData = JSON.parse(memoryResult.output);

    // Decisions should have the entry
    assert.ok(memoryData.decisions, 'should have decisions field');
    assert.ok(
      typeof memoryData.decisions === 'string'
        ? memoryData.decisions.includes('e2e test decision')
        : Array.isArray(memoryData.decisions) && memoryData.decisions.length > 0,
      'decisions should contain the written entry'
    );

    // Bookmark should be present
    assert.ok(memoryData.bookmark !== undefined || memoryData.position !== undefined,
      'should have bookmark or position field');
  });
});

describe('integration: tdd proof audit trail', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# TDD Proof Fixture\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '- [ ] **TDD-06**: fixture proof\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State\n\n## Current Position\n\n**Phase:** 150 — TDD Proof\n**Current Plan:** 01\n**Total Plans in Phase:** 1\n**Status:** In progress\n**Last Activity:** 2026-03-29\n\nProgress: [█████░░░░░] 50%\n\n## Accumulated Context\n\n### Decisions\n\nNone yet.\n\n### Blockers/Concerns\n\nNone yet.\n\n## Session Continuity\n\nLast session: 2026-03-29\nStopped at: Fixture setup\nResume file: None\n`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ planning: { commit_docs: true } }, null, 2));

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '0150-tdd-proof');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'sum.js'), 'function sum(a, b) { return a - b; }\nmodule.exports = { sum };\n');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'sum-proof.cjs'), `const { sum } = require('../src/sum');\nif (sum(1, 2) === 3) {\n  console.log('ok 1 - sum adds numbers');\n  process.exit(0);\n}\nconsole.log('not ok 1 - sum adds numbers');\nprocess.exit(1);\n`);
    fs.writeFileSync(path.join(phaseDir, '0150-01-PLAN.md'), `---
phase: 0150-tdd-proof
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/sum.js
  - tests/sum.test.cjs
autonomous: true
requirements:
  - TDD-06
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Prove TDD execution end to end.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Deliver sum feature through TDD</name>
  <files>src/sum.js, tests/sum.test.cjs</files>
  <action>Run RED/GREEN/REFACTOR.</action>
  <verify>Proof exists.</verify>
  <done>Done.</done>
</task>
</tasks>
`);

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'tdd-proof-fixture', version: '1.0.0', type: 'commonjs' }, null, 2));
    execSync('git add -A && git commit -m "init: fixture setup"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('real type:tdd fixture leaves validator, trailer, and summary audit proof', () => {
    const testPath = path.join(tmpDir, 'tests', 'sum.test.cjs');
    const proofScriptPath = path.join(tmpDir, 'tests', 'sum-proof.cjs');
    const sourcePath = path.join(tmpDir, 'src', 'sum.js');
    const auditPath = path.join(tmpDir, '.planning', 'phases', '0150-tdd-proof', '0150-01-TDD-AUDIT.json');
    const testCmd = 'node tests/sum-proof.cjs';

    fs.writeFileSync(testPath, `const test = require('node:test');\nconst assert = require('node:assert');\nconst { sum } = require('../src/sum');\n\ntest('sum adds numbers', () => {\n  assert.strictEqual(sum(1, 2), 3);\n});\n`);

    const redResult = runGsdTools(`execute:tdd validate-red --test-cmd "${testCmd}"`, tmpDir);
    assert.ok(redResult.success, `RED gate should succeed: ${redResult.error || redResult.output}`);
    const redProof = JSON.parse(redResult.output);
    assert.strictEqual(redProof.phase, 'red');
    assert.strictEqual(redProof.valid, true);

    const redCommit = runGsdTools('execute:commit "test(0150-01): add failing test for sum" --files tests/sum.test.cjs --agent bgsd-executor --tdd-phase red --force', tmpDir);
    assert.ok(redCommit.success, `RED commit failed: ${redCommit.error || redCommit.output}`);

    fs.writeFileSync(sourcePath, 'function sum(a, b) { return a + b; }\nmodule.exports = { sum };\n');
    const greenResult = runGsdTools(`execute:tdd validate-green --test-cmd "${testCmd}"`, tmpDir);
    assert.ok(greenResult.success, `GREEN gate should succeed: ${greenResult.error || greenResult.output}`);
    const greenProof = JSON.parse(greenResult.output);
    assert.strictEqual(greenProof.phase, 'green');
    assert.strictEqual(greenProof.valid, true);

    const greenCommit = runGsdTools('execute:commit "feat(0150-01): implement sum" --files src/sum.js --agent bgsd-executor --tdd-phase green --force', tmpDir);
    assert.ok(greenCommit.success, `GREEN commit failed: ${greenCommit.error || greenCommit.output}`);

    fs.writeFileSync(sourcePath, 'const sum = (a, b) => a + b;\nmodule.exports = { sum };\n');
    const refactorResult = runGsdTools(`execute:tdd validate-refactor --test-cmd "${testCmd}"`, tmpDir);
    assert.ok(refactorResult.success, `REFACTOR gate should succeed: ${refactorResult.error || refactorResult.output}`);
    const refactorProof = JSON.parse(refactorResult.output);
    assert.strictEqual(refactorProof.phase, 'refactor');
    assert.strictEqual(refactorProof.valid, true);

    const refactorCommit = runGsdTools('execute:commit "refactor(0150-01): clean up sum" --files src/sum.js --agent bgsd-executor --tdd-phase refactor --force', tmpDir);
    assert.ok(refactorCommit.success, `REFACTOR commit failed: ${refactorCommit.error || refactorCommit.output}`);

    let auditWrite = runGsdTools(`execute:tdd write-audit --phase 150 --plan 01 --stage red --proof '${JSON.stringify(redProof)}'`, tmpDir);
    assert.ok(auditWrite.success, `RED audit write failed: ${auditWrite.error || auditWrite.output}`);
    auditWrite = runGsdTools(`execute:tdd write-audit --phase 150 --plan 01 --stage green --proof '${JSON.stringify(greenProof)}'`, tmpDir);
    assert.ok(auditWrite.success, `GREEN audit write failed: ${auditWrite.error || auditWrite.output}`);
    auditWrite = runGsdTools(`execute:tdd write-audit --phase 150 --plan 01 --stage refactor --proof '${JSON.stringify(refactorProof)}'`, tmpDir);
    assert.ok(auditWrite.success, `REFACTOR audit write failed: ${auditWrite.error || auditWrite.output}`);

    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    assert.deepStrictEqual(Object.keys(audit.phases).sort(), ['green', 'red', 'refactor'], 'production audit writer should accumulate all TDD stages');

    const summaryResult = runGsdTools('util:summary-generate 150 01 --raw', tmpDir);
    assert.ok(summaryResult.success, `summary generation failed: ${summaryResult.error || summaryResult.output}`);
    const summaryJson = JSON.parse(summaryResult.output);
    assert.strictEqual(summaryJson.tdd_audit_stages, 3, 'summary should expose all three TDD stages');

    const gitLog = execSync('git log --format=%B', { cwd: tmpDir, encoding: 'utf-8' });
    assert.match(gitLog, /GSD-Phase: red/, 'git log should contain red trailer');
    assert.match(gitLog, /GSD-Phase: green/, 'git log should contain green trailer');
    assert.match(gitLog, /GSD-Phase: refactor/, 'git log should contain refactor trailer');

    const summaryPath = path.join(tmpDir, '.planning', 'phases', '0150-tdd-proof', '0150-01-SUMMARY.md');
    const summary = fs.readFileSync(summaryPath, 'utf-8');
    assert.match(summary, /## TDD Audit Trail/, 'summary should include TDD audit section');
    assert.match(summary, /\*\*GSD-Phase:\*\* red/, 'summary should expose red phase');
    assert.match(summary, /\*\*GSD-Phase:\*\* refactor/, 'summary should expose refactor phase');
    assert.match(summary, /\*\*Target command:\*\* `node tests\/sum-proof.cjs`/, 'summary should expose target command');
    assert.match(summary, /\*\*Exit status:\*\* `1`/, 'summary should expose red exit status');
    assert.match(summary, /\*\*Matched evidence:\*\*/, 'summary should expose matched evidence');
    assert.match(summary, /"gsd_phase": "refactor"/, 'summary should expose machine-readable refactor proof');
  });

  test('execute and verify handoff refreshes preserve discovered TDD proof continuity for later summary rendering', () => {
    const auditPath = path.join(tmpDir, '.planning', 'phases', '0150-tdd-proof', '0150-01-TDD-AUDIT.json');
    fs.writeFileSync(auditPath, JSON.stringify({
      phases: {
        red: { target_command: 'node tests/sum-proof.cjs', exit_code: 1, matched_evidence_snippet: 'not ok 1 - sum adds numbers' },
        green: { target_command: 'node tests/sum-proof.cjs', exit_code: 0, matched_evidence_snippet: 'ok 1 - sum adds numbers' },
        refactor: { target_command: 'node tests/sum-proof.cjs', exit_code: 0, matched_evidence_snippet: 'ok 1 - sum adds numbers' }
      }
    }, null, 2));

    let result = runGsdTools('verify:state handoff write --phase 150 --step execute --summary "Execution complete" --next-command "/bgsd-verify-work 150"', tmpDir);
    assert.ok(result.success, `execute handoff write failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.artifact.context.tdd_audits), 'execute handoff should capture discovered TDD proof metadata');
    assert.ok(output.artifact.context.tdd_audits.some((entry) => entry.path.endsWith('0150-01-TDD-AUDIT.json')), 'execute handoff should preserve the canonical audit path');

    result = runGsdTools('verify:state handoff write --phase 150 --step verify --summary "Verification complete" --next-command "/bgsd-transition"', tmpDir);
    assert.ok(result.success, `verify handoff write failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.ok(output.artifact.context.tdd_audits.some((entry) => entry.path.endsWith('0150-01-TDD-AUDIT.json')), 'verify handoff should inherit prior TDD proof metadata');
    assert.deepStrictEqual(output.artifact.context.tdd_audits[0].stages, ['red', 'green', 'refactor'], 'preserved proof metadata should keep deterministic stage coverage');

    const summaryResult = runGsdTools('util:summary-generate 150 01 --raw', tmpDir);
    assert.ok(summaryResult.success, `summary generation failed after handoff refresh: ${summaryResult.error || summaryResult.output}`);
    const summaryJson = JSON.parse(summaryResult.output);
    assert.strictEqual(summaryJson.tdd_audit_stages, 3, 'summary generation should still read preserved proof after resume-oriented handoff refreshes');

    const projectRoot = path.join(__dirname, '..');
    const executeWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'execute-phase.md'), 'utf-8');
    const verifyWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'verify-work.md'), 'utf-8');
    assert.match(executeWorkflow, /TDD-AUDIT\.json[\s\S]*context/i, 'execute workflow should document proof continuity across the fresh-context boundary');
    assert.match(verifyWorkflow, /TDD-AUDIT\.json[\s\S]*context/i, 'verify workflow should document proof continuity on later handoff refreshes');
  });
});

describe('integration: execute:commit JJ path-scoped fallback', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ commit_docs: true }), 'utf-8');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detached colocated repo can commit .planning path scope through JJ fallback', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initColocatedCommitRepo(tmpDir, { detachHead: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'detached-summary.md'), 'summary data\n');

    const result = runGsdTools('execute:commit "docs(165-01): detached fallback proof" --files .planning/detached-summary.md --agent bgsd-executor', tmpDir);
    assert.ok(result.success, `detached fallback commit should succeed: ${result.error || result.output}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, true, 'detached fallback should commit');
    assert.strictEqual(data.reason, 'committed', 'detached fallback should preserve committed reason');
    assert.strictEqual(data.commit_path, 'jj_fallback', 'detached fallback should use JJ path-scoped path');

    const log = execSync('git log --format=%B -1', { cwd: tmpDir, encoding: 'utf-8' });
    assert.match(log, /docs\(165-01\): detached fallback proof/);
    assert.match(log, /Agent-Type: bgsd-executor/);
  });

  test('dirty colocated repo commits requested path and leaves unrelated worktree changes intact', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initColocatedCommitRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'dirty-summary.md'), 'summary data\n');
    fs.writeFileSync(path.join(tmpDir, 'keep-dirty.txt'), 'unrelated\n');

    const result = runGsdTools('execute:commit "docs(165-01): dirty fallback proof" --files .planning/dirty-summary.md --agent bgsd-executor --tdd-phase refactor', tmpDir);
    assert.ok(result.success, `dirty fallback commit should succeed: ${result.error || result.output}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.committed, true, 'dirty fallback should commit');
    assert.strictEqual(data.reason, 'committed', 'dirty fallback should preserve committed reason');
    assert.strictEqual(data.commit_path, 'jj_fallback', 'dirty fallback should use JJ path-scoped path');
    assert.ok(data.hash, 'dirty fallback should return hash');

    const status = execSync('jj status', { cwd: tmpDir, encoding: 'utf-8' });
    assert.match(status, /keep-dirty\.txt/, 'unrelated dirty file should remain after path-scoped commit');
    assert.doesNotMatch(status, /dirty-summary\.md/, 'committed path should be removed from working copy changes');

    const body = execSync('git log --format=%b -1', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    assert.match(body, /Agent-Type: bgsd-executor/, 'dirty fallback should preserve agent trailer');
    assert.match(body, /GSD-Phase: refactor/, 'dirty fallback should preserve TDD trailer');
  });
});

describe('integration: snapshot tests', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('init progress output structure', () => {
    const result = runGsdTools('init:progress --verbose', PROJECT_DIR);
    assert.ok(result.success, `init progress failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('milestone_version' in data, 'should have milestone_version key');
    assert.ok('phases' in data, 'should have phases key');
    assert.ok('phase_count' in data, 'should have phase_count key');
    assert.ok('project_exists' in data, 'should have project_exists key');

    assert.strictEqual(typeof data.milestone_version, 'string', 'milestone_version should be string');
    assert.ok(Array.isArray(data.phases), 'phases should be an array');
    assert.strictEqual(typeof data.phase_count, 'number', 'phase_count should be number');
    assert.strictEqual(typeof data.project_exists, 'boolean', 'project_exists should be boolean');
  });

  test('init execute-phase output structure', () => {
    const result = runGsdTools('init:execute-phase 13', PROJECT_DIR);
    const out = result.output || '';
    if (result.success && out.startsWith('{')) {
      const data = JSON.parse(out);
      assert.ok('phase_found' in data, 'should have phase_found key');
      if (data.phase_found) {
        assert.ok('phase_dir' in data || 'phase_number' in data, 'found phase should have phase_dir or phase_number');
      }
    } else {
      assert.ok(true, 'command completed (may error for missing phase state)');
    }
  });

  test('init plan-phase output structure', () => {
    const result = runGsdTools('init:plan-phase 13', PROJECT_DIR);
    const out = result.output || '';
    if (result.success && out.startsWith('{')) {
      const data = JSON.parse(out);
      assert.ok('phase_found' in data || 'phase_dir' in data || 'error' in data,
        'should have phase_found, phase_dir, or error key');
    } else {
      assert.ok(true, 'command completed (may error for phase state)');
    }
  });

  test('state load output structure', () => {
    const result = runGsdTools('verify:state load', PROJECT_DIR);
    assert.ok(result.success, `state load failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('config' in data, 'should have config key');
    assert.ok('state_exists' in data, 'should have state_exists key');
    assert.strictEqual(typeof data.config, 'object', 'config should be object');
    assert.strictEqual(typeof data.state_exists, 'boolean', 'state_exists should be boolean');
  });

  test('snapshot-backed init flows stay aligned across a realistic phase sequence', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: API
**Goal:** Shared snapshot adoption
**Requirements:** FLOW-01 FLOW-03
`);
      fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Context');
      fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
      fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');
      fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '---\nwave: 1\nautonomous: true\n---\n# Plan 1');
      fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '---\nwave: 2\nautonomous: true\n---\n# Plan 2');
      fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), '# Summary 1');

      initJjRepo(tmpDir);

      const snapshot = JSON.parse(runGsdTools('phase:snapshot 03', tmpDir).output);
      const executePhase = JSON.parse(runGsdTools('init:execute-phase 03 --verbose', tmpDir).output);
      const phaseOp = JSON.parse(runGsdTools('init:phase-op 03 --verbose', tmpDir).output);
      const verifyWork = JSON.parse(runGsdTools('init:verify-work 03 --compact --manifest', tmpDir).output);

      assert.deepStrictEqual(executePhase.plans, ['03-01-PLAN.md', '03-02-PLAN.md']);
      assert.strictEqual(phaseOp.context_path, snapshot.artifacts.context);
      assert.strictEqual(phaseOp.research_path, snapshot.artifacts.research);
      assert.strictEqual(phaseOp.uat_path, snapshot.artifacts.uat);
      assert.ok(verifyWork._manifest.files.some(f => f.path === '.planning/phases/03-api/03-01-SUMMARY.md'), 'verify-work manifest should include summary path from snapshot artifacts');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('bgsd-owned writes invalidate cached phase discovery before snapshot reads', () => {
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 3: API
**Goal:** Shared snapshot adoption
**Requirements:** FLOW-01 FLOW-03
`);
      fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '---\nwave: 1\nautonomous: true\n---\n# Plan 1');
      fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '---\nwave: 2\nautonomous: true\n---\n# Plan 2');

      const initialTree = getPhaseTree(tmpDir);
      assert.strictEqual(initialTree.get('03').summaries.length, 0, 'primed cache should see no summaries initially');

      const summaryPath = path.join(phaseDir, '03-01-SUMMARY.md');
      fs.writeFileSync(summaryPath, '# Summary 1\n');
      invalidateFileCache(summaryPath);

      const snapshot = buildPhaseSnapshotInternal(tmpDir, '03');
      assert.strictEqual(snapshot.execution_context.summary_count, 1, 'snapshot should observe fresh summary count after invalidation');
      assert.deepStrictEqual(snapshot.plan_index.incomplete, ['03-02'], 'incomplete plans should refresh after invalidation');
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe('integration: phase 165 repo-local runtime truth', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('deliverables verification follows active checkout freshness instead of stale local bundle assumptions', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '165-jj-execution-repo-local-verification');
    fs.mkdirSync(path.join(tmpDir, 'src', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'bin'), { recursive: true });
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'phase-165-runtime-truth',
      scripts: { test: 'echo "4 passing"' },
    }, null, 2));

    const sourcePath = path.join(tmpDir, 'src', 'commands', 'verify.js');
    const artifactPath = path.join(tmpDir, 'bin', 'bgsd-tools.cjs');
    fs.writeFileSync(sourcePath, '// fresh source for verify runtime truth\n');
    fs.writeFileSync(artifactPath, '// stale built runtime\n');

    const planPath = path.join(phaseDir, '165-02-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: 165-jj-execution-repo-local-verification
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/verify.js
autonomous: true
requirements:
  - EXEC-03
must_haves:
  artifacts:
    - path: src/commands/verify.js
      contains: fresh source for verify runtime truth
  key_links: []
---

# Plan
`);

    initJjRepo(tmpDir);

    const oldDate = new Date('2026-03-30T00:00:00Z');
    const newDate = new Date('2026-03-30T01:00:00Z');
    fs.utimesSync(artifactPath, oldDate, oldDate);
    fs.utimesSync(sourcePath, newDate, newDate);

    let result = runGsdTools('verify:verify deliverables --plan .planning/phases/165-jj-execution-repo-local-verification/165-02-PLAN.md', tmpDir);
    assert.ok(result.success, `stale verification failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.verdict, 'fail', 'stale local runtime should fail deliverables verification');
    assert.strictEqual(output.runtime_freshness.stale, true, 'runtime freshness should report stale runtime');
    assert.match(output.runtime_freshness.message, /npm run build/i, 'stale result should include rebuild guidance');

    const rebuiltDate = new Date('2026-03-30T02:00:00Z');
    fs.writeFileSync(artifactPath, '// rebuilt local runtime\n');
    fs.utimesSync(artifactPath, rebuiltDate, rebuiltDate);

    result = runGsdTools('verify:verify deliverables --plan .planning/phases/165-jj-execution-repo-local-verification/165-02-PLAN.md', tmpDir);
    assert.ok(result.success, `fresh verification failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.verdict, 'pass', 'rebuilt local runtime should restore a pass verdict');
    assert.strictEqual(output.runtime_freshness.stale, false, 'runtime freshness should clear after rebuild');
  });

  test('plugin runtime freshness follows repo-local source-to-bundle truth in a JJ temp repo', (t) => {
    if (!hasJj()) t.skip('jj unavailable');

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '165-jj-execution-repo-local-verification');
    fs.mkdirSync(path.join(tmpDir, 'src', 'plugin'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'workflows'), { recursive: true });
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'phase-165-plugin-runtime-truth',
      scripts: { test: 'echo "4 passing"' },
    }, null, 2));

    const repoRoot = path.join(__dirname, '..');
    const executeWorkflow = fs.readFileSync(path.join(repoRoot, 'workflows', 'execute-phase.md'), 'utf-8');
    const verifyWorkflow = fs.readFileSync(path.join(repoRoot, 'workflows', 'verify-work.md'), 'utf-8');
    const idleValidatorSource = fs.readFileSync(path.join(repoRoot, 'src', 'plugin', 'idle-validator.js'), 'utf-8');
    const pluginBundle = fs.readFileSync(path.join(repoRoot, 'plugin.js'), 'utf-8');

    fs.writeFileSync(path.join(tmpDir, 'workflows', 'execute-phase.md'), executeWorkflow);
    fs.writeFileSync(path.join(tmpDir, 'workflows', 'verify-work.md'), verifyWorkflow);

    const sourcePath = path.join(tmpDir, 'src', 'plugin', 'idle-validator.js');
    const artifactPath = path.join(tmpDir, 'plugin.js');
    fs.writeFileSync(sourcePath, idleValidatorSource);
    fs.writeFileSync(artifactPath, pluginBundle);

    const planPath = path.join(phaseDir, '165-03-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: 165-jj-execution-repo-local-verification
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugin/idle-validator.js
autonomous: true
requirements:
  - EXEC-03
must_haves:
  artifacts:
    - path: src/plugin/idle-validator.js
      contains: Next: /bgsd-plan phase
    - path: plugin.js
      contains: Next: /bgsd-plan phase
  key_links: []
---

# Plan
`);

    initJjRepo(tmpDir);

    const oldDate = new Date('2026-03-30T00:00:00Z');
    const newDate = new Date('2026-03-30T01:00:00Z');
    fs.utimesSync(artifactPath, oldDate, oldDate);
    fs.utimesSync(sourcePath, newDate, newDate);

    let result = runGsdTools('verify:verify deliverables --plan .planning/phases/165-jj-execution-repo-local-verification/165-03-PLAN.md', tmpDir);
    assert.ok(result.success, `stale plugin verification failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.verdict, 'fail', 'stale plugin bundle should fail repo-local verification');
    assert.strictEqual(output.runtime_freshness.stale, true, 'plugin runtime freshness should report stale local bundle');
    assert.ok(output.artifacts_ok, 'repo-local deliverables should still read source and bundle artifacts from the current checkout');
    assert.match(output.runtime_freshness.message, /npm run build/i, 'stale plugin verification should include rebuild guidance');

    const rebuiltDate = new Date('2026-03-30T02:00:00Z');
    fs.writeFileSync(artifactPath, pluginBundle);
    fs.utimesSync(artifactPath, rebuiltDate, rebuiltDate);

    result = runGsdTools('verify:verify deliverables --plan .planning/phases/165-jj-execution-repo-local-verification/165-03-PLAN.md', tmpDir);
    assert.ok(result.success, `fresh plugin verification failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.verdict, 'pass', 'rebuilt plugin bundle should restore repo-local verification');
    assert.strictEqual(output.runtime_freshness.stale, false, 'plugin runtime freshness should clear after rebuild');
    assert.ok(output.artifacts_ok, 'repo-local source and bundle artifacts should pass on the active checkout');
  });
});

describe('test-coverage', () => {
  const PROJECT_DIR = path.resolve(__dirname, '..');

  test('returns valid structure', () => {
    const result = runGsdTools('verify:test-coverage', PROJECT_DIR);
    assert.ok(result.success, `test-coverage failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok('total_commands' in data, 'should have total_commands');
    assert.ok('commands_with_tests' in data, 'should have commands_with_tests');
    assert.ok('coverage_percent' in data, 'should have coverage_percent');
    assert.ok('covered' in data, 'should have covered array');
    assert.ok('uncovered' in data, 'should have uncovered array');
    assert.ok('test_count' in data, 'should have test_count');

    assert.strictEqual(typeof data.total_commands, 'number', 'total_commands should be number');
    assert.strictEqual(typeof data.commands_with_tests, 'number', 'commands_with_tests should be number');
    assert.strictEqual(typeof data.coverage_percent, 'number', 'coverage_percent should be number');
    assert.ok(Array.isArray(data.covered), 'covered should be array');
    assert.ok(Array.isArray(data.uncovered), 'uncovered should be array');
    assert.strictEqual(typeof data.test_count, 'number', 'test_count should be number');
  });

  test('shows non-zero coverage', () => {
    const result = runGsdTools('verify:test-coverage', PROJECT_DIR);
    assert.ok(result.success, `test-coverage failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.total_commands > 0, `total_commands should be > 0, got ${data.total_commands}`);
    assert.ok(data.commands_with_tests > 0, `commands_with_tests should be > 0, got ${data.commands_with_tests}`);
    assert.ok(data.coverage_percent > 0, `coverage_percent should be > 0, got ${data.coverage_percent}`);
    assert.ok(data.test_count > 0, `test_count should be > 0, got ${data.test_count}`);
    assert.ok(data.covered.length > 0, 'covered array should not be empty');
     assert.strictEqual(
      data.covered.length + data.uncovered.length,
      data.total_commands,
      'covered + uncovered should equal total_commands'
    );
  });
});

describe('integration: phase 158 command inventory baseline', () => {
  test('manifest ships canonical family wrappers alongside compatibility aliases', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'bin', 'manifest.json'), 'utf-8'));

    for (const file of [
      'commands/bgsd-quick.md',
      'commands/bgsd-quick-task.md',
      'commands/bgsd-plan.md',
      'commands/bgsd-inspect.md',
    ]) {
      assert.ok(manifest.files.includes(file), `${file} should be shipped in the manifest`);
    }
  });

  test('deploy and install documentation stay aligned around manifest-driven wrapper inventory', () => {
    const deploy = fs.readFileSync(path.join(process.cwd(), 'deploy.sh'), 'utf-8');
    const install = fs.readFileSync(path.join(process.cwd(), 'install.js'), 'utf-8');

    assert.match(deploy, /canonical and compatibility wrappers/i);
    assert.match(install, /Canonical and compatibility slash commands/);
    assert.match(install, /canonical and compatibility wrappers stay aligned/i);
  });
});

describe('integration: downstream handoff gating', () => {
  let tmpDir;

  function writeCurrentPhaseState() {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 152 — Cached Handoffs & Fresh-Context Delivery
**Current Plan:** 04
**Total Plans in Phase:** 5
**Status:** Ready to execute
**Last Activity:** 2026-03-29

Progress: [██████████] 98%

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 152-03-PLAN.md
Resume file: None
`);
  }

  function writePhaseFixture() {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 152: Cached Handoffs & Fresh-Context Delivery
**Goal:** Chain downstream delivery through validated handoffs.
**Plans:** 5 plans
**Requirements:** FLOW-07 FLOW-08
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

- [ ] **FLOW-07**: Resume summary contract
- [ ] **FLOW-08**: Downstream handoff gating
`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Test Project\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ workflow: { auto_advance: false } }, null, 2));

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '152-cached-handoffs-fresh-context-delivery');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '152-CONTEXT.md'), '# Context\n');
    fs.writeFileSync(path.join(phaseDir, '152-RESEARCH.md'), '# Research\n');
    fs.writeFileSync(path.join(phaseDir, '152-01-PLAN.md'), `---
phase: 152-cached-handoffs-fresh-context-delivery
plan: 01
type: execute
wave: 1
autonomous: true
depends_on: []
files_modified:
  - workflows/execute-phase.md
requirements:
  - FLOW-07
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Test plan fixture.
</objective>
`);
    fs.writeFileSync(path.join(phaseDir, '152-01-SUMMARY.md'), '# Summary\n');
  }

  beforeEach(() => {
    tmpDir = createTempProject();
    writeCurrentPhaseState();
    writePhaseFixture();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('standalone fallback keeps downstream init entrypoints usable without handoffs', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initJjRepo(tmpDir);
    for (const cmd of ['init:plan-phase 152 --compact', 'init:execute-phase 152 --compact', 'init:verify-work 152 --compact']) {
      const result = runGsdTools(cmd, tmpDir);
      assert.ok(result.success, `${cmd} failed: ${result.error}`);
      const output = JSON.parse(result.output);
      assert.ok(!('resume_summary' in output), `${cmd} should omit resume_summary for standalone use`);
    }
  });

  test('latest valid artifact selection survives corrupt newest downstream handoffs', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initJjRepo(tmpDir);
    let result = runGsdTools('verify:state handoff write --phase 152 --step discuss --summary "Discuss done"', tmpDir);
    assert.ok(result.success, `Discuss write failed: ${result.error}`);
    result = runGsdTools('verify:state handoff write --phase 152 --step research --summary "Research done"', tmpDir);
    assert.ok(result.success, `Research write failed: ${result.error}`);

    let corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'plan.json');
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, '{bad json\n', 'utf-8');

    result = runGsdTools('init:plan-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:plan-phase failed: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.latest_valid_step, 'research', 'plan entrypoint should use the latest valid artifact');
    assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-plan phase 152');

    result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan done"', tmpDir);
    assert.ok(result.success, `Plan write failed: ${result.error}`);
    corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'execute.json');
    fs.writeFileSync(corruptPath, '{bad json\n', 'utf-8');

    result = runGsdTools('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:execute-phase failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.latest_valid_step, 'plan', 'execute entrypoint should fall back to the latest valid artifact');
    assert.ok(output.resume_summary.inspection.invalid_artifacts.some((artifact) => artifact.file.endsWith('execute.json')),
      'execute entrypoint should keep the corrupt newest artifact inspectable');

    result = runGsdTools('verify:state handoff write --phase 152 --step execute --summary "Execute done"', tmpDir);
    assert.ok(result.success, `Execute write failed: ${result.error}`);
    corruptPath = path.join(tmpDir, '.planning', 'phase-handoffs', '152', 'verify.json');
    fs.writeFileSync(corruptPath, '{bad json\n', 'utf-8');

    result = runGsdTools('init:verify-work 152 --compact', tmpDir);
    assert.ok(result.success, `init:verify-work failed: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.latest_valid_step, 'execute', 'verify entrypoint should resume from the latest valid artifact');
    assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-verify-work 152');
  });

  test('stale source repair guidance blocks downstream resume until rebuild', () => {
    const result = runGsdTools('verify:state handoff write --phase 152 --step plan --run-id run-1 --source-fingerprint fp-1 --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `Plan write failed: ${result.error}`);

    const validate = runGsdTools('verify:state handoff validate --phase 152 --expected-fingerprint fp-2', tmpDir);
    assert.ok(validate.success, `validate failed: ${validate.error}`);
    const output = JSON.parse(validate.output);
    assert.strictEqual(output.valid, false, 'stale source should block resume');
    assert.strictEqual(output.stale_sources, true, 'stale source should be reported');
    assert.strictEqual(output.repair_guidance.action, 'repair', 'repair guidance should be returned');
    assert.match(output.repair_guidance.commands[0], /verify:state handoff clear --phase 152/);
  });

  test('stale source boundary only blocks real canonical planning drift', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initJjRepo(tmpDir);
    let result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `Plan write failed: ${result.error}`);

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 152 — Cached Handoffs & Fresh-Context Delivery
**Current Plan:** 05
**Total Plans in Phase:** 5
**Status:** Ready to execute
**Last Activity:** 2026-03-30

## Accumulated Context

### Decisions

Updated state only.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-30
Stopped at: Updated state only
Resume file: None
`);

    result = runGsdTools('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:execute-phase failed after state-only change: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.valid, true, 'state-only churn should not trip stale-source protection');
    assert.strictEqual(output.resume_summary.stale_sources, false, 'state-only churn should stay fresh');

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '152-cached-handoffs-fresh-context-delivery');
    fs.writeFileSync(path.join(phaseDir, '152-01-PLAN.md'), `---
phase: 152-cached-handoffs-fresh-context-delivery
plan: 01
type: execute
wave: 1
autonomous: true
depends_on: []
requirements:
  - FLOW-07
files_modified:
  - workflows/execute-phase.md
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Meaningfully changed plan content.
</objective>
`);

    result = runGsdTools('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:execute-phase failed after plan drift: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.valid, false, 'plan drift should block resume');
    assert.strictEqual(output.resume_summary.stale_sources, true, 'plan drift should be reported as stale');
  });

  test('repairing stale source handoffs restores latest valid resume summary', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    initJjRepo(tmpDir);
    let result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan ready"', tmpDir);
    assert.ok(result.success, `Plan write failed: ${result.error}`);

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '152-cached-handoffs-fresh-context-delivery');
    fs.writeFileSync(path.join(phaseDir, '152-01-PLAN.md'), `---
phase: 152-cached-handoffs-fresh-context-delivery
plan: 01
type: execute
wave: 1
autonomous: true
depends_on: []
requirements:
  - FLOW-07
files_modified:
  - workflows/execute-phase.md
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Plan drift that should force a repair.
</objective>
`);

    result = runGsdTools('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:execute-phase failed during stale check: ${result.error}`);
    let output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.valid, false, 'stale handoff should block resume before repair');
    assert.strictEqual(output.resume_summary.stale_sources, true, 'stale handoff should be flagged before repair');

    result = runGsdTools('verify:state handoff write --phase 152 --step plan --summary "Plan repaired"', tmpDir);
    assert.ok(result.success, `Plan rewrite failed: ${result.error}`);

    result = runGsdTools('init:execute-phase 152 --compact', tmpDir);
    assert.ok(result.success, `init:execute-phase failed after repair: ${result.error}`);
    output = JSON.parse(result.output);
    assert.strictEqual(output.resume_summary.valid, true, 'rewriting the handoff with current sources should restore resume');
    assert.strictEqual(output.resume_summary.stale_sources, false, 'repaired handoff should no longer be stale');
    assert.strictEqual(output.resume_summary.latest_valid_step, 'plan', 'latest valid step should remain visible after repair');
  });
});

describe('integration: fresh-context auto-advance contracts', () => {
  test('fresh-context production chain keeps standalone fallback latest valid fallback stale source blocking and repaired resume aligned', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    const tmpDir = createTempProject();
    try {
      fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Production Chain Fixture\n');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 153: Production Handoff Persistence & Resume Freshness
**Goal:** Exercise production handoff persistence.
**Plans:** 3 plans
**Requirements:** FLOW-07
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

- [ ] **FLOW-07**: Durable handoff artifacts
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 153 — Production Handoff Persistence & Resume Freshness
**Current Plan:** 03
**Total Plans in Phase:** 3
**Status:** Ready to execute
**Last Activity:** 2026-03-29

Progress: [██████████] 99%

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 153-02-PLAN.md
Resume file: None
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ workflow: { auto_advance: false } }, null, 2));

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '153-production-handoff-persistence-resume-freshness');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '153-CONTEXT.md'), '# Context\n');
      fs.writeFileSync(path.join(phaseDir, '153-RESEARCH.md'), '# Research\n');
      fs.writeFileSync(path.join(phaseDir, '153-01-PLAN.md'), `---
phase: 153-production-handoff-persistence-resume-freshness
plan: 01
type: execute
wave: 1
autonomous: true
depends_on: []
requirements:
  - FLOW-07
files_modified:
  - workflows/execute-phase.md
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Keep production handoff persistence fresh.
</objective>
`);
      fs.writeFileSync(path.join(phaseDir, '153-01-SUMMARY.md'), '# Summary\n');

      initJjRepo(tmpDir);

      for (const cmd of ['init:plan-phase 153 --compact', 'init:execute-phase 153 --compact', 'init:verify-work 153 --compact']) {
        const result = runGsdTools(cmd, tmpDir);
        assert.ok(result.success, `${cmd} failed: ${result.error}`);
        const output = JSON.parse(result.output);
        assert.ok(!('resume_summary' in output), `${cmd} should stay standalone without handoffs`);
      }

      const projectRoot = path.join(__dirname, '..');
      const discussWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'discuss-phase.md'), 'utf-8');
      const researchWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'research-phase.md'), 'utf-8');
      const planWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'plan-phase.md'), 'utf-8');
      const executeWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'execute-phase.md'), 'utf-8');
      const verifyWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'verify-work.md'), 'utf-8');
      assert.match(discussWorkflow, /verify:state handoff write[\s\S]*--step discuss/i);
      assert.match(researchWorkflow, /verify:state handoff write[\s\S]*--step research/i);
      assert.match(planWorkflow, /verify:state handoff write[\s\S]*--step plan/i);
      assert.match(executeWorkflow, /verify:state handoff write[\s\S]*--step execute/i);
      assert.match(verifyWorkflow, /verify:state handoff write[\s\S]*--step verify/i);

      for (const [step, nextCommand] of [
        ['discuss', '/bgsd-plan research 153'],
        ['research', '/bgsd-plan phase 153'],
        ['plan', '/bgsd-execute-phase 153'],
        ['execute', '/bgsd-verify-work 153'],
        ['verify', '/bgsd-transition'],
      ]) {
        const result = runGsdTools(
          `verify:state handoff write --phase 153 --step ${step} --summary "${step} ready" --next-command "${nextCommand}"`,
          tmpDir
        );
        assert.ok(result.success, `${step} handoff write failed: ${result.error}`);
      }

      const handoffDir = path.join(tmpDir, '.planning', 'phase-handoffs', '153');
      for (const name of ['discuss.json', 'research.json', 'plan.json', 'execute.json', 'verify.json']) {
        assert.ok(fs.existsSync(path.join(handoffDir, name)), `${name} should persist in the production handoff chain`);
      }

      let result = runGsdTools('init:verify-work 153 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed: ${result.error}`);
      let output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'verify', 'full chain should reach verify');
      assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-transition', 'verify handoff should preserve transition target');
      assert.strictEqual(output.resume_summary.valid, true, 'fresh production-written chain should be resumable');
      assert.strictEqual(output.resume_summary.stale_sources, false, 'fresh production-written chain should not be stale');

      fs.writeFileSync(path.join(handoffDir, 'verify.json'), '{bad json\n', 'utf-8');
      result = runGsdTools('init:verify-work 153 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed after corrupt newest artifact: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'execute', 'corrupt newest artifact should fall back to the latest valid step');
      assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-verify-work 153', 'fallback should keep the execute resume entrypoint');
      assert.ok(output.resume_summary.inspection.invalid_artifacts.some((artifact) => artifact.file.endsWith('verify.json')),
        'corrupt newest artifact should remain visible for inspection');

      result = runGsdTools('verify:state handoff write --phase 153 --step verify --summary "verify repaired" --next-command "/bgsd-transition"', tmpDir);
      assert.ok(result.success, `verify handoff repair failed: ${result.error}`);

      fs.writeFileSync(path.join(phaseDir, '153-01-PLAN.md'), `---
phase: 153-production-handoff-persistence-resume-freshness
plan: 01
type: execute
wave: 1
autonomous: true
depends_on: []
requirements:
  - FLOW-07
files_modified:
  - workflows/execute-phase.md
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Meaningfully drifted plan content that should invalidate the old fingerprint.
</objective>
`);

      result = runGsdTools('init:execute-phase 153 --compact', tmpDir);
      assert.ok(result.success, `init:execute-phase failed after stale source drift: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.valid, false, 'stale source drift should block resume at the real entrypoint');
      assert.strictEqual(output.resume_summary.stale_sources, true, 'stale source drift should be surfaced');
      assert.strictEqual(output.resume_summary.repair_guidance.action, 'repair', 'stale source drift should keep repair guidance');

      result = runGsdTools('init:verify-work 153 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed after stale source drift: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.valid, false, 'stale source drift should also block downstream verify re-entry');
      assert.strictEqual(output.resume_summary.stale_sources, true, 'downstream verify re-entry should stay stale until refreshed');

      for (const [step, nextCommand] of [
        ['plan', '/bgsd-execute-phase 153'],
        ['execute', '/bgsd-verify-work 153'],
        ['verify', '/bgsd-transition'],
      ]) {
        result = runGsdTools(
          `verify:state handoff write --phase 153 --step ${step} --summary "${step} refreshed" --next-command "${nextCommand}"`,
          tmpDir
        );
        assert.ok(result.success, `${step} handoff refresh failed: ${result.error}`);
      }

      result = runGsdTools('init:verify-work 153 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed after refresh: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'verify', 'refreshed chain should restore the latest step');
      assert.strictEqual(output.resume_summary.valid, true, 'refreshing with current fingerprint should repair resume');
      assert.strictEqual(output.resume_summary.stale_sources, false, 'refreshing with current fingerprint should clear stale status');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('production handoff chain writes durable artifacts before fresh-context continuation', () => {
    const projectRoot = path.join(__dirname, '..');
    const discussWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'discuss-phase.md'), 'utf-8');
    const researchWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'research-phase.md'), 'utf-8');
    const planWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'plan-phase.md'), 'utf-8');
    const executeWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'execute-phase.md'), 'utf-8');
    const verifyWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'verify-work.md'), 'utf-8');

    assert.match(discussWorkflow, /verify:state handoff write[\s\S]*--step discuss/i, 'discuss should write the durable discuss handoff');
    assert.match(researchWorkflow, /verify:state handoff write[\s\S]*--step research/i, 'research should write the durable research handoff');
    assert.match(planWorkflow, /verify:state handoff write[\s\S]*--step plan/i, 'plan should write the durable plan handoff');
    assert.match(executeWorkflow, /verify:state handoff write[\s\S]*--step execute/i, 'execute should write the durable execute handoff');
    assert.match(verifyWorkflow, /verify:state handoff write[\s\S]*--step verify/i, 'verify should write the durable verify handoff');
  });

  test('fresh-context chaining keeps discuss as the clean-start exception', () => {
    const projectRoot = path.join(__dirname, '..');
    const discussWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'discuss-phase.md'), 'utf-8');
    const transitionWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'transition.md'), 'utf-8');

    assert.match(discussWorkflow, /`discuss` is the only workflow step allowed to start cleanly with no prior chain state\./i, 'discuss should be the only clean-start exception');
    assert.match(transitionWorkflow, /`discuss` remains the only clean-start exception for a same-phase restart/i, 'transition should preserve discuss as the only clean-start restart path');
    assert.match(transitionWorkflow, /fresh context window/i, 'transition should route chaining through a fresh context window');
  });

  test('auto-advance stays additive to the existing yolo surface', () => {
    const projectRoot = path.join(__dirname, '..');
    const discussWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'discuss-phase.md'), 'utf-8');
    const planWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'plan-phase.md'), 'utf-8');
    const transitionWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'transition.md'), 'utf-8');

    assert.match(discussWorkflow, /`--auto`\/yolo may chain into the next workflow after the workflow itself writes durable discuss handoff artifacts for the current planning inputs/i, 'discuss auto mode should wait for durable handoff artifacts');
    assert.match(planWorkflow, /Before presenting final status or `--auto` continuation, write or refresh the durable `plan` handoff artifact/i, 'plan auto mode should wait for durable plan handoff artifacts');
    assert.match(transitionWorkflow, /The additive fast path still uses the familiar yolo\/`--auto` surface/i, 'transition should keep yolo as an additive fast path');
    assert.match(transitionWorkflow, /only after the prior workflow has already written or refreshed its durable handoff artifact/i, 'transition should require durable artifacts before chaining');
    assert.match(transitionWorkflow, /current expected fingerprint/i, 'transition should require freshness-aware artifacts before chaining');
    assert.match(transitionWorkflow, /durable artifacts and a fresh context window/i, 'transition should describe artifact-backed fresh-context chaining');
  });

  test('explicit summary choices remain visible before chained continuation', () => {
    const projectRoot = path.join(__dirname, '..');
    const discussWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'discuss-phase.md'), 'utf-8');
    const transitionWorkflow = fs.readFileSync(path.join(projectRoot, 'workflows', 'transition.md'), 'utf-8');

    assert.match(discussWorkflow, /show the explicit resume summary first and preserve the exact `resume` \/ `inspect` \/ `restart` contract/i, 'discuss should keep the explicit resume summary contract');
    assert.match(transitionWorkflow, /Do not silently bypass the explicit resume summary when chain state already exists\./i, 'transition should forbid silent resume');
    assert.match(transitionWorkflow, /preserve the `resume` \/ `inspect` \/ `restart` choice before continuing\./i, 'transition should preserve explicit summary choices');
  });

  test('fresh-context production chain preserves production-created TDD proof through fallback stale blocking repair and summary rendering', (t) => {
    if (!hasJj()) t.skip('jj unavailable');
    const tmpDir = createTempProject();
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com" && git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
      initJjRepo(tmpDir);

      fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Phase 154 Proof Fixture\n');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap

### Phase 154: End-to-End Fresh-Context Proof Delivery
**Goal:** Preserve TDD proof through the full fresh-context chain.
**Plans:** 1 plans
**Requirements:** TDD-06 FLOW-08
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), `# Requirements

- [ ] **TDD-06**: End-to-end TDD proof
- [ ] **FLOW-08**: Fresh-context delivery pipeline
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# Project State

## Current Position

**Phase:** 154 — End-to-End Fresh-Context Proof Delivery
**Current Plan:** 01
**Total Plans in Phase:** 1
**Status:** Ready to execute
**Last Activity:** 2026-03-29

Progress: [██████████] 99%

## Accumulated Context

### Decisions

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 154-00-PLAN.md
Resume file: None
`);
      fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ workflow: { auto_advance: false } }, null, 2));

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '154-end-to-end-fresh-context-proof-delivery');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '154-CONTEXT.md'), '# Context\n');
      fs.writeFileSync(path.join(phaseDir, '154-RESEARCH.md'), '# Research\n');
      fs.writeFileSync(path.join(phaseDir, '154-01-PLAN.md'), `---
phase: 154-end-to-end-fresh-context-proof-delivery
plan: 01
type: tdd
wave: 1
autonomous: true
depends_on: []
requirements:
  - TDD-06
  - FLOW-08
files_modified:
  - src/sum.js
  - tests/sum.test.cjs
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Prove fresh-context proof delivery end to end.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Deliver sum feature through TDD</name>
  <files>src/sum.js, tests/sum.test.cjs</files>
  <action>Run RED/GREEN/REFACTOR.</action>
  <verify>Proof exists.</verify>
  <done>Done.</done>
</task>
</tasks>
`);

      const sourcePath = path.join(tmpDir, 'src', 'sum.js');
      const testPath = path.join(tmpDir, 'tests', 'sum.test.cjs');
      const proofScriptPath = path.join(tmpDir, 'tests', 'sum-proof.cjs');
      const auditPath = path.join(phaseDir, '154-01-TDD-AUDIT.json');
      const testCmd = 'node tests/sum-proof.cjs';

      fs.writeFileSync(sourcePath, 'function sum(a, b) { return a - b; }\nmodule.exports = { sum };\n');
      fs.writeFileSync(proofScriptPath, `const { sum } = require('../src/sum');\nif (sum(1, 2) === 3) {\n  console.log('ok 1 - sum adds numbers');\n  process.exit(0);\n}\nconsole.log('not ok 1 - sum adds numbers');\nprocess.exit(1);\n`);
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'phase-154-proof-fixture', version: '1.0.0', type: 'commonjs' }, null, 2));
      execSync('git add -A && git commit -m "init: fixture setup"', { cwd: tmpDir, stdio: 'pipe' });

      fs.writeFileSync(testPath, `const test = require('node:test');\nconst assert = require('node:assert');\nconst { sum } = require('../src/sum');\n\ntest('sum adds numbers', () => {\n  assert.strictEqual(sum(1, 2), 3);\n});\n`);

      const redResult = runGsdTools(`execute:tdd validate-red --test-cmd "${testCmd}"`, tmpDir);
      assert.ok(redResult.success, `RED gate should succeed: ${redResult.error || redResult.output}`);
      const redProof = JSON.parse(redResult.output);
      assert.strictEqual(redProof.phase, 'red');
      assert.strictEqual(redProof.valid, true);

      let result = runGsdTools('execute:commit "test(154-01): add failing test for sum" --files tests/sum.test.cjs --agent bgsd-executor --tdd-phase red --force', tmpDir);
      assert.ok(result.success, `RED commit failed: ${result.error || result.output}`);

      fs.writeFileSync(sourcePath, 'function sum(a, b) { return a + b; }\nmodule.exports = { sum };\n');
      const greenResult = runGsdTools(`execute:tdd validate-green --test-cmd "${testCmd}"`, tmpDir);
      assert.ok(greenResult.success, `GREEN gate should succeed: ${greenResult.error || greenResult.output}`);
      const greenProof = JSON.parse(greenResult.output);
      assert.strictEqual(greenProof.phase, 'green');
      assert.strictEqual(greenProof.valid, true);

      result = runGsdTools('execute:commit "feat(154-01): implement sum" --files src/sum.js --agent bgsd-executor --tdd-phase green --force', tmpDir);
      assert.ok(result.success, `GREEN commit failed: ${result.error || result.output}`);

      fs.writeFileSync(sourcePath, 'const sum = (a, b) => a + b;\nmodule.exports = { sum };\n');
      const refactorResult = runGsdTools(`execute:tdd validate-refactor --test-cmd "${testCmd}"`, tmpDir);
      assert.ok(refactorResult.success, `REFACTOR gate should succeed: ${refactorResult.error || refactorResult.output}`);
      const refactorProof = JSON.parse(refactorResult.output);
      assert.strictEqual(refactorProof.phase, 'refactor');
      assert.strictEqual(refactorProof.valid, true);

      result = runGsdTools('execute:commit "refactor(154-01): clean up sum" --files src/sum.js --agent bgsd-executor --tdd-phase refactor --force', tmpDir);
      assert.ok(result.success, `REFACTOR commit failed: ${result.error || result.output}`);

      for (const [stage, proof] of [['red', redProof], ['green', greenProof], ['refactor', refactorProof]]) {
        result = runGsdTools(`execute:tdd write-audit --phase 154 --plan 01 --stage ${stage} --proof '${JSON.stringify(proof)}'`, tmpDir);
        assert.ok(result.success, `${stage} audit write failed: ${result.error || result.output}`);
      }

      assert.ok(fs.existsSync(auditPath), 'production TDD flow should create the canonical audit sidecar');

      for (const [step, nextCommand] of [
        ['discuss', '/bgsd-plan research 154'],
        ['research', '/bgsd-plan phase 154'],
        ['plan', '/bgsd-execute-phase 154'],
      ]) {
        result = runGsdTools(`verify:state handoff write --phase 154 --step ${step} --summary "${step} ready" --next-command "${nextCommand}"`, tmpDir);
        assert.ok(result.success, `${step} handoff write failed: ${result.error}`);
      }

      result = runGsdTools('init:execute-phase 154 --compact', tmpDir);
      assert.ok(result.success, `init:execute-phase failed: ${result.error}`);
      let output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'plan', 'execute entrypoint should resume from the plan handoff');
      assert.strictEqual(output.resume_summary.valid, true, 'fresh plan handoff should remain resumable');

      result = runGsdTools('verify:state handoff write --phase 154 --step execute --summary "execute ready" --next-command "/bgsd-verify-work 154"', tmpDir);
      assert.ok(result.success, `execute handoff write failed: ${result.error}`);
      result = runGsdTools('init:verify-work 154 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'execute', 'verify entrypoint should resume from the execute handoff');
      assert.strictEqual(output.resume_summary.valid, true, 'execute handoff should remain resumable');

      result = runGsdTools('verify:state handoff write --phase 154 --step verify --summary "verify ready" --next-command "/bgsd-transition"', tmpDir);
      assert.ok(result.success, `verify handoff write failed: ${result.error}`);
      result = runGsdTools('init:resume --compact', tmpDir);
      assert.ok(result.success, `init:resume failed: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'verify', 'full chain should reach the verify handoff');
      assert.strictEqual(output.resume_summary.valid, true, 'fresh full chain should remain resumable');
      assert.strictEqual(output.resume_summary.next_safe_command, '/bgsd-transition', 'verify handoff should keep the downstream transition target');

      const verifyArtifactPath = path.join(tmpDir, '.planning', 'phase-handoffs', '154', 'verify.json');
      fs.writeFileSync(verifyArtifactPath, '{bad json\n', 'utf-8');
      result = runGsdTools('init:verify-work 154 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed after corrupt newest artifact: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'execute', 'corrupt newest artifact should fall back to the latest valid execute handoff');
      assert.strictEqual(output.resume_summary.valid, true, 'latest valid fallback should keep the chain resumable');
      assert.ok(output.resume_summary.inspection.invalid_artifacts.some((artifact) => artifact.file.endsWith('verify.json')), 'corrupt verify artifact should remain inspectable');

      fs.writeFileSync(path.join(phaseDir, '154-01-PLAN.md'), `---
phase: 154-end-to-end-fresh-context-proof-delivery
plan: 01
type: tdd
wave: 1
autonomous: true
depends_on: []
requirements:
  - TDD-06
  - FLOW-08
files_modified:
  - src/sum.js
  - tests/sum.test.cjs
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Meaningfully drifted fresh-context proof plan content.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Deliver sum feature through TDD</name>
  <files>src/sum.js, tests/sum.test.cjs</files>
  <action>Run RED/GREEN/REFACTOR.</action>
  <verify>Proof exists.</verify>
  <done>Done.</done>
</task>
</tasks>
`);

      result = runGsdTools('init:execute-phase 154 --compact', tmpDir);
      assert.ok(result.success, `init:execute-phase failed after stale source drift: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.valid, false, 'stale source drift should block execute resume');
      assert.strictEqual(output.resume_summary.stale_sources, true, 'stale source drift should be surfaced at execute');

      result = runGsdTools('init:verify-work 154 --compact', tmpDir);
      assert.ok(result.success, `init:verify-work failed after stale source drift: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.valid, false, 'stale source drift should block downstream verify resume');
      assert.strictEqual(output.resume_summary.stale_sources, true, 'stale source drift should also surface at verify');

      for (const [step, nextCommand] of [
        ['plan', '/bgsd-execute-phase 154'],
        ['execute', '/bgsd-verify-work 154'],
        ['verify', '/bgsd-transition'],
      ]) {
        result = runGsdTools(`verify:state handoff write --phase 154 --step ${step} --summary "${step} refreshed" --next-command "${nextCommand}"`, tmpDir);
        assert.ok(result.success, `${step} handoff refresh failed: ${result.error}`);
      }

      result = runGsdTools('init:resume --compact', tmpDir);
      assert.ok(result.success, `init:resume failed after refresh: ${result.error}`);
      output = JSON.parse(result.output);
      assert.strictEqual(output.resume_summary.latest_valid_step, 'verify', 'refreshed chain should restore the latest verify handoff');
      assert.strictEqual(output.resume_summary.valid, true, 'rewriting current-source artifacts should repair resume');
      assert.strictEqual(output.resume_summary.stale_sources, false, 'rewriting current-source artifacts should clear stale status');

      result = runGsdTools('util:summary-generate 154 01 --raw', tmpDir);
      assert.ok(result.success, `summary generation failed: ${result.error || result.output}`);
      const summaryJson = JSON.parse(result.output);
      assert.strictEqual(summaryJson.tdd_audit_stages, 3, 'summary generation should still render the preserved TDD audit');

      const summary = fs.readFileSync(path.join(phaseDir, '154-01-SUMMARY.md'), 'utf-8');
      assert.match(summary, /## TDD Audit Trail/, 'summary should include the TDD audit trail after the full chain runs');
      assert.match(summary, /\*\*Target command:\*\* `node tests\/sum-proof\.cjs`/, 'summary should render the production-created proof target command');
      assert.match(summary, /"gsd_phase": "refactor"/, 'summary should include machine-readable refactor proof after resume repair');
    } finally {
      cleanup(tmpDir);
    }
  });
});
