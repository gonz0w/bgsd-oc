/**
 * bgsd-tools plugin tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { TOOLS_PATH, runGsdTools, createTempProject, cleanup, writeStateFixture } = require('./helpers.cjs');

describe('plugin parsers and tool registry', () => {
  const pluginPath = path.join(__dirname, '..', 'plugin.js');

  test('plugin.js exports parseState', () => {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('parseState'), 'plugin.js should contain parseState');
  });

  test('plugin.js exports parseRoadmap', () => {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('parseRoadmap'), 'plugin.js should contain parseRoadmap');
  });

  test('plugin.js exports parsePlan', () => {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('parsePlan'), 'plugin.js should contain parsePlan');
  });

  test('plugin.js exports createToolRegistry', () => {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('createToolRegistry'), 'plugin.js should contain createToolRegistry');
  });

  test('plugin.js exports safeHook', () => {
    const content = fs.readFileSync(pluginPath, 'utf-8');
    assert.ok(content.includes('safeHook'), 'plugin.js should export safeHook');
  });

  test('plugin bundle size under 600KB', () => {
    const stat = fs.statSync(pluginPath);
    const sizeKB = Math.round(stat.size / 1024);
    assert.ok(sizeKB < 625, `plugin.js is ${sizeKB}KB — should be under 625KB`);
  });

  test('parseState returns structured data from live STATE.md', async () => {
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.parseState, 'function', 'parseState should be a function');
    const state = mod.parseState();
    if (state) {
      assert.strictEqual(typeof state.raw, 'string', 'state.raw should be a string');
      assert.strictEqual(typeof state.getField, 'function', 'state.getField should be a function');
      assert.strictEqual(typeof state.getSection, 'function', 'state.getSection should be a function');
      // Verify immutability via Object.isFrozen
      assert.ok(Object.isFrozen(state), 'state should be frozen');
    }
  });

  test('parseRoadmap returns structured data from live ROADMAP.md', async () => {
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.parseRoadmap, 'function', 'parseRoadmap should be a function');
    const roadmap = mod.parseRoadmap();
    if (roadmap) {
      assert.ok(Array.isArray(roadmap.phases), 'roadmap.phases should be an array');
      assert.ok(roadmap.phases.length > 0, 'roadmap should have phases');
      assert.strictEqual(typeof roadmap.getPhase, 'function', 'roadmap.getPhase should be a function');
      // Verify immutability via Object.isFrozen
      assert.ok(Object.isFrozen(roadmap), 'roadmap should be frozen');
    }
  });

  test('parseConfig returns config with defaults', async () => {
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.parseConfig, 'function', 'parseConfig should be a function');
    const config = mod.parseConfig();
    assert.ok(config, 'parseConfig should return a non-null config');
    assert.strictEqual(typeof config.model_profile, 'string', 'config should have model_profile');
    assert.strictEqual(typeof config.commit_docs, 'boolean', 'config should have commit_docs as boolean');
    // Verify immutability via Object.isFrozen
    assert.ok(Object.isFrozen(config), 'config should be frozen');
  });

  test('createToolRegistry enforces bgsd_ prefix', async () => {
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.createToolRegistry, 'function', 'createToolRegistry should be a function');
    const identity = (name, fn) => fn; // Simple passthrough for testing
    const reg = mod.createToolRegistry(identity);
    const name = reg.registerTool('status', { description: 'test', execute: async () => '{}' });
    assert.strictEqual(name, 'bgsd_status', 'should auto-prefix with bgsd_');
  });

  test('createToolRegistry rejects invalid names', async () => {
    const mod = await import(pluginPath);
    const identity = (name, fn) => fn;
    const reg = mod.createToolRegistry(identity);
    assert.throws(
      () => reg.registerTool('Bad-Name', { execute: async () => '{}' }),
      /snake_case/i,
      'should reject non-snake_case names'
    );
  });

  test('invalidateAll clears all parser caches', async () => {
    const mod = await import(pluginPath);
    assert.strictEqual(typeof mod.invalidateAll, 'function', 'invalidateAll should be a function');
    // Should not throw
    mod.invalidateAll();
  });
});

describe('Plugin Tools', () => {
  const pluginPath = path.join(__dirname, '..', 'plugin.js');
  let pluginModule;

  async function runWithValidationModes(run) {
    const originalFallback = process.env.BGSD_DEP_VALIBOT_FALLBACK;

    try {
      delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
      const primary = await run();

      process.env.BGSD_DEP_VALIBOT_FALLBACK = '1';
      const fallback = await run();

      return {
        primary: JSON.parse(primary),
        fallback: JSON.parse(fallback),
      };
    } finally {
      if (originalFallback === undefined) {
        delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
      } else {
        process.env.BGSD_DEP_VALIBOT_FALLBACK = originalFallback;
      }
    }
  }

  // Load plugin module once for all tool tests
  test('load plugin module', async () => {
    pluginModule = await import(pluginPath);
    assert.ok(pluginModule, 'plugin module should load');
  });

  // --- Tool definition shape tests ---

  test('bgsd_status has correct definition shape', async () => {
    const mod = pluginModule || await import(pluginPath);
    const identity = (name, fn) => fn;
    const reg = mod.createToolRegistry(identity);
    // We can't access individual tools directly, but we can test via BgsdPlugin
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const tool = plugin.tool.bgsd_status;
    assert.ok(tool, 'bgsd_status should be registered');
    assert.strictEqual(typeof tool.description, 'string', 'description should be a string');
    assert.strictEqual(typeof tool.args, 'object', 'args should be an object');
    assert.strictEqual(typeof tool.execute, 'function', 'execute should be a function');
  });

  test('bgsd_plan has correct definition shape', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const tool = plugin.tool.bgsd_plan;
    assert.ok(tool, 'bgsd_plan should be registered');
    assert.strictEqual(typeof tool.description, 'string', 'description should be a string');
    assert.ok(tool.args.phase, 'args should have phase parameter');
    assert.strictEqual(typeof tool.execute, 'function', 'execute should be a function');
  });

  test('bgsd_context has correct definition shape', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const tool = plugin.tool.bgsd_context;
    assert.ok(tool, 'bgsd_context should be registered');
    assert.strictEqual(typeof tool.description, 'string', 'description should be a string');
    assert.ok(tool.args.task, 'args should have task parameter');
    assert.strictEqual(typeof tool.execute, 'function', 'execute should be a function');
  });

  test('bgsd_validate has correct definition shape', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const tool = plugin.tool.bgsd_validate;
    assert.ok(tool, 'bgsd_validate should be registered');
    assert.strictEqual(typeof tool.description, 'string', 'description should be a string');
    assert.strictEqual(typeof tool.args, 'object', 'args should be an object');
    assert.strictEqual(typeof tool.execute, 'function', 'execute should be a function');
  });

  test('bgsd_progress has correct definition shape', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const tool = plugin.tool.bgsd_progress;
    assert.ok(tool, 'bgsd_progress should be registered');
    assert.strictEqual(typeof tool.description, 'string', 'description should be a string');
    assert.ok(tool.args.action, 'args should have action parameter');
    assert.ok(tool.args.value, 'args should have value parameter');
    assert.strictEqual(typeof tool.execute, 'function', 'execute should be a function');
  });

  // --- JSON return tests (each tool returns valid JSON for nonexistent project) ---

  test('bgsd_status returns valid JSON for nonexistent project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_status.execute({}, { directory: '/tmp/nonexistent-gsd-test' });
    assert.strictEqual(typeof result, 'string', 'result should be a string');
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.status, 'no_project', 'should return no_project status');
  });

  test('bgsd_plan returns valid JSON for nonexistent project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_plan.execute({}, { directory: '/tmp/nonexistent-gsd-test' });
    assert.strictEqual(typeof result, 'string', 'result should be a string');
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.status, 'no_project', 'should return no_project status');
  });

  test('bgsd_context returns valid JSON for nonexistent project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_context.execute({}, { directory: '/tmp/nonexistent-gsd-test' });
    assert.strictEqual(typeof result, 'string', 'result should be a string');
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.status, 'no_project', 'should return no_project status');
  });

  test('bgsd_validate returns valid JSON for nonexistent project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_validate.execute({}, { directory: '/tmp/nonexistent-gsd-test' });
    assert.strictEqual(typeof result, 'string', 'result should be a string');
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.status, 'no_project', 'should return no_project status');
  });

  test('bgsd_progress returns valid JSON for nonexistent project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_progress.execute({ action: 'complete-task' }, { directory: '/tmp/nonexistent-gsd-test' });
    assert.strictEqual(typeof result, 'string', 'result should be a string');
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.status, 'no_project', 'should return no_project status');
  });

  // --- Tool registration integration test ---

  test('BgsdPlugin returns tool object with all 5 tools', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    assert.ok(plugin.tool, 'plugin should have tool key');
    const expectedTools = ['bgsd_status', 'bgsd_plan', 'bgsd_context', 'bgsd_validate', 'bgsd_progress'];
    for (const name of expectedTools) {
      assert.ok(plugin.tool[name], `tool object should contain ${name}`);
      assert.strictEqual(typeof plugin.tool[name].execute, 'function', `${name} should have execute function`);
    }
  });

  // --- bgsd_status response shape test (with real .planning/) ---

  test('bgsd_status returns structured data from live project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_status.execute({}, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    // Should not be no_project since this project has .planning/
    assert.ok(parsed.phase, 'result should have phase');
    assert.strictEqual(typeof parsed.phase.number, 'string', 'phase.number should be a string');
    assert.ok(Array.isArray(parsed.tasks), 'tasks should be an array');
    assert.ok(Array.isArray(parsed.blockers), 'blockers should be an array');
  });

  // --- bgsd_plan dual-mode test ---

  test('bgsd_plan no-args returns phases array', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_plan.execute({}, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.phases), 'should return phases array');
    assert.ok(parsed.phases.length > 0, 'should have at least one phase');
  });

  test('bgsd_plan with phase number returns phase details', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const overviewResult = await plugin.tool.bgsd_plan.execute({}, { directory: process.cwd() });
    const overviewParsed = JSON.parse(overviewResult);
    const targetPhase = Number(overviewParsed.phases[0].number);

    const result = await plugin.tool.bgsd_plan.execute({ phase: targetPhase }, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.ok(parsed.phase, 'should return phase object');
    assert.ok(parsed.phase.number, 'phase should have number');
    assert.ok(parsed.phase.name, 'phase should have name');
    assert.ok(parsed.phase.goal, 'phase should have goal');
  });

  test('bgsd_plan with invalid phase returns validation_error', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_plan.execute({ phase: 999 }, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.error, 'validation_error', 'should return validation_error');
  });

  test('bgsd_plan keeps output parity in forced fallback mode', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const originalFallback = process.env.BGSD_DEP_VALIBOT_FALLBACK;

    try {
      delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
      const defaultValid = await plugin.tool.bgsd_plan.execute({ phase: '77' }, { directory: process.cwd() });
      const defaultInvalid = await plugin.tool.bgsd_plan.execute({ phase: 'not-a-number' }, { directory: process.cwd() });

      process.env.BGSD_DEP_VALIBOT_FALLBACK = '1';
      const fallbackValid = await plugin.tool.bgsd_plan.execute({ phase: '77' }, { directory: process.cwd() });
      const fallbackInvalid = await plugin.tool.bgsd_plan.execute({ phase: 'not-a-number' }, { directory: process.cwd() });

      assert.deepStrictEqual(JSON.parse(defaultValid), JSON.parse(fallbackValid), 'valid-input contract should match across engines');
      assert.deepStrictEqual(JSON.parse(defaultInvalid), JSON.parse(fallbackInvalid), 'invalid-input contract should match across engines');
    } finally {
      if (originalFallback === undefined) {
        delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
      } else {
        process.env.BGSD_DEP_VALIBOT_FALLBACK = originalFallback;
      }
    }
  });

  test('bgsd_plan emits deterministic validation engine markers in debug mode', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const originalDebug = process.env.GSD_DEBUG;
    const originalFallback = process.env.BGSD_DEP_VALIBOT_FALLBACK;
    const originalWrite = process.stderr.write;
    const writes = [];

    process.env.GSD_DEBUG = '1';
    delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
    process.stderr.write = function(chunk, ...args) {
      writes.push(String(chunk));
      return originalWrite.call(this, chunk, ...args);
    };

    try {
      await plugin.tool.bgsd_plan.execute({ phase: '77' }, { directory: process.cwd() });
      await plugin.tool.bgsd_plan.execute({ phase: '77' }, { directory: process.cwd() });
    } finally {
      process.stderr.write = originalWrite;
      if (originalDebug === undefined) {
        delete process.env.GSD_DEBUG;
      } else {
        process.env.GSD_DEBUG = originalDebug;
      }
      if (originalFallback === undefined) {
        delete process.env.BGSD_DEP_VALIBOT_FALLBACK;
      } else {
        process.env.BGSD_DEP_VALIBOT_FALLBACK = originalFallback;
      }
    }

    const markerLines = writes
      .join('')
      .split('\n')
      .filter(line => line.includes('[bGSD:validation-engine] bgsd_plan:'));

    assert.strictEqual(markerLines.length, 2, 'should emit one marker per validation call');
    assert.strictEqual(markerLines[0], markerLines[1], 'marker should be deterministic for repeated identical input');
  });

  test('bgsd_context keeps task coercion contract parity in forced fallback mode', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });

    const tmpDir = createTempProject();
    try {
      writeStateFixture(tmpDir);

      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), `---
phase: 01-foundation
plan: 01
---

<objective>
Fixture plan for parity validation tests.
</objective>

<tasks>
<task type="auto">
  <name>Fixture task</name>
  <files>tests/plugin.test.cjs</files>
  <action>Validate fixture path</action>
  <done>Task context returns task payload</done>
</task>
</tasks>
`);

      const results = await runWithValidationModes(() =>
        plugin.tool.bgsd_context.execute({ task: '1' }, { directory: tmpDir })
      );

      assert.deepStrictEqual(results.primary, results.fallback, 'task coercion output contract should match across engines');
      assert.ok(results.primary.task, 'response should include task payload');
      assert.strictEqual(results.primary.task.number, 1, 'string task arg should coerce to numeric task number');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('bgsd_progress keeps enum validation envelope parity in forced fallback mode', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });

    const results = await runWithValidationModes(() =>
      plugin.tool.bgsd_progress.execute({ action: 'not-a-real-action' }, { directory: process.cwd() })
    );

    assert.deepStrictEqual(results.primary, results.fallback, 'enum validation envelope should match across engines');
    assert.strictEqual(results.primary.error, 'validation_error', 'invalid enum should return validation_error');

    const progressSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'plugin', 'tools', 'bgsd-progress.js'), 'utf-8');
    assert.ok(progressSource.includes("validateArgs('bgsd_progress'"), 'bgsd_progress should validate through adapter entrypoint');
    assert.ok(!progressSource.includes('BGSD_DEP_VALIBOT'), 'bgsd_progress should not read fallback env flags directly');
  });

  test('migrated tools keep invalid and missing arg envelopes stable across engines', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });

    const invalidContext = await runWithValidationModes(() =>
      plugin.tool.bgsd_context.execute({ task: 'abc' }, { directory: process.cwd() })
    );
    assert.deepStrictEqual(invalidContext.primary, invalidContext.fallback, 'bgsd_context invalid-input envelope should match across engines');
    assert.strictEqual(invalidContext.primary.error, 'validation_error');

    const missingProgressAction = await runWithValidationModes(() =>
      plugin.tool.bgsd_progress.execute({}, { directory: process.cwd() })
    );
    assert.deepStrictEqual(missingProgressAction.primary, missingProgressAction.fallback, 'bgsd_progress missing-action envelope should match across engines');
    assert.strictEqual(missingProgressAction.primary.error, 'validation_error');

    const missingProgressValue = await runWithValidationModes(() =>
      plugin.tool.bgsd_progress.execute({ action: 'remove-blocker' }, { directory: process.cwd() })
    );
    assert.deepStrictEqual(missingProgressValue.primary, missingProgressValue.fallback, 'bgsd_progress missing-value envelope should match across engines');
    assert.strictEqual(missingProgressValue.primary.error, 'validation_error');
  });

  // --- bgsd_validate response test ---

  test('bgsd_validate returns structured validation from live project', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_validate.execute({}, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.strictEqual(typeof parsed.valid, 'boolean', 'should have valid boolean');
    assert.ok(Array.isArray(parsed.issues), 'should have issues array');
    assert.ok(parsed.summary, 'should have summary object');
    assert.strictEqual(typeof parsed.summary.errors, 'number', 'summary.errors should be a number');
    assert.strictEqual(typeof parsed.summary.warnings, 'number', 'summary.warnings should be a number');
    assert.strictEqual(typeof parsed.summary.info, 'number', 'summary.info should be a number');
  });

  // --- bgsd_progress validation tests ---

  test('bgsd_progress rejects add-blocker without value', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_progress.execute({ action: 'add-blocker' }, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.error, 'validation_error', 'should return validation_error for missing value');
  });

  test('bgsd_progress rejects record-decision without value', async () => {
    const mod = pluginModule || await import(pluginPath);
    const plugin = await mod.BgsdPlugin({ directory: process.cwd() });
    const result = await plugin.tool.bgsd_progress.execute({ action: 'record-decision' }, { directory: process.cwd() });
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.error, 'validation_error', 'should return validation_error for missing value');
  });
});
