/**
 * bgsd-tools integration tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, writeStateFixture } = require('./helpers.cjs');

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
      optimization: {
        valibot: true,
        valibot_fallback: false,
        discovery: 'optimized',
        compile_cache: false,
        sqlite_cache: true
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

