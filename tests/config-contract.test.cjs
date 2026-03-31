const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { CONFIG_SCHEMA } = require('../src/lib/constants');
const { buildDefaultConfig, migrateConfig, normalizeConfig } = require('../src/lib/config-contract');
const { loadConfig, invalidateConfigCache } = require('../src/lib/config');
const { cmdConfigMigrate } = require('../src/commands/misc');

function captureStdout(fn) {
  const writes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk, encoding, callback) => {
    writes.push(typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf-8'));
    if (typeof callback === 'function') callback();
    return true;
  };
  try {
    return { result: fn(), stdout: writes.join('') };
  } finally {
    process.stdout.write = original;
  }
}

async function withProject(run) {
  const tmpDir = createTempProject();
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Project State\n', 'utf-8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
  const pluginModule = await import('../plugin.js');

  try {
    return await run({ tmpDir, pluginModule });
  } finally {
    invalidateConfigCache();
    if (pluginModule?.invalidateConfig) pluginModule.invalidateConfig();
    cleanup(tmpDir);
  }
}

test('default config file shape derives from CONFIG_SCHEMA', async () => {
  await withProject(async () => {
    const defaults = buildDefaultConfig();

    for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
      if (def.nested) {
        assert.ok(defaults[def.nested.section], `expected nested section ${def.nested.section}`);
        assert.deepStrictEqual(defaults[def.nested.section][def.nested.field], def.default, `${key} default should come from CONFIG_SCHEMA`);
      } else {
        assert.deepStrictEqual(defaults[key], def.default, `${key} default should come from CONFIG_SCHEMA`);
      }
    }
  });
});

test('CLI and plugin normalization share nested coercion and workflow alias handling', async () => {
  await withProject(async ({ tmpDir, pluginModule }) => {
    const rawConfig = {
      planning: { commit_docs: false },
      git: { branching_strategy: 'parallel' },
      workflow: { research: false, plan_check: false, verifier: false },
      parallelization: { enabled: false },
    };
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(rawConfig, null, 2), 'utf-8');

    const normalized = normalizeConfig(rawConfig, { freeze: false });
    const cliConfig = loadConfig(tmpDir);
    const pluginConfig = pluginModule.parseConfig(tmpDir);

    assert.strictEqual(normalized.commit_docs, false);
    assert.strictEqual(normalized.branching_strategy, 'parallel');
    assert.strictEqual(normalized.research, false);
    assert.strictEqual(normalized.plan_checker, false);
    assert.strictEqual(normalized.verifier, false);
    assert.strictEqual(normalized.parallelization, false);

    for (const key of ['commit_docs', 'branching_strategy', 'research', 'plan_checker', 'verifier', 'parallelization']) {
      assert.deepStrictEqual(cliConfig[key], normalized[key], `CLI should normalize ${key} through shared contract`);
      assert.deepStrictEqual(pluginConfig[key], normalized[key], `plugin should normalize ${key} through shared contract`);
    }
  });
});

test('migrate adds schema defaults without overriding aliased workflow values', async () => {
  await withProject(async ({ tmpDir }) => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ model_profile: 'quality', workflow: { plan_check: false } }, null, 2), 'utf-8');

    captureStdout(() => cmdConfigMigrate(tmpDir, true));

    const migrated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const directMigration = migrateConfig({ model_profile: 'quality', workflow: { plan_check: false } });

    assert.strictEqual(migrated.model_profile, 'quality');
    assert.strictEqual(migrated.workflow.plan_check, false);
    assert.strictEqual(migrated.planning.commit_docs, true);
    assert.strictEqual(migrated.git.branching_strategy, CONFIG_SCHEMA.branching_strategy.default);
    assert.deepStrictEqual(migrated, directMigration.config, 'CLI migrate should write the shared migrated shape');
    assert.strictEqual(loadConfig(tmpDir).plan_checker, false, 'aliased workflow value should stay intact after migrate');
  });
});

test('idle validator repairs corrupt config with shared default document', async () => {
  await withProject(async ({ tmpDir, pluginModule }) => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{broken', 'utf-8');

    const notifier = { notify: async () => {} };
    const fileWatcher = { trackSelfWrite: () => {} };
    const validator = pluginModule.createIdleValidator(tmpDir, notifier, fileWatcher, {
      idle_validation: {
        enabled: true,
        cooldown_seconds: 0,
        staleness_threshold_hours: 2,
      },
    });

    await validator.onIdle();

    const repaired = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.deepStrictEqual(repaired, buildDefaultConfig(), 'corrupt repair should write the shared schema-driven default file');
  });
});
