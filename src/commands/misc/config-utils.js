'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../../lib/output');
const { loadConfig, invalidateConfigCache } = require('../../lib/config');
const { applyConfigValue, buildDefaultConfig, deepMerge, serializeConfig } = require('../../lib/config-contract');
const { CONFIG_SCHEMA } = require('../../lib/constants');
const { writeFileAtomic } = require('../../lib/atomic-write');

function cmdConfigEnsureSection(cwd, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // Ensure .planning directory exists (recursive: true is a no-op if it already exists)
  try {
    fs.mkdirSync(planningDir, { recursive: true });
  } catch (err) {
    debugLog('config.ensure', 'mkdir failed', err);
    error('Failed to create .planning directory: ' + err.message);
  }

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Load user-level defaults from ~/.gsd/defaults.json if available
  const globalDefaultsPath = path.join(homedir, '.gsd', 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
    }
  } catch (err) {
    debugLog('config.ensure', 'read failed', err);
    // Ignore malformed global defaults, fall back to hardcoded
  }

  const defaults = deepMerge(
    buildDefaultConfig({ overrides: { brave_search: hasBraveSearch } }),
    userDefaults
  );

  // Use exclusive-create flag to atomically check existence + write (no TOCTOU race)
  let fd;
  try {
    fd = fs.openSync(configPath, 'wx');
  } catch (err) {
    if (err.code === 'EEXIST') {
      const result = { created: false, reason: 'already_exists' };
      output(result, raw, 'exists');
      return;
    }
    debugLog('config.ensure', 'write failed', err);
    error('Failed to create config.json: ' + err.message);
  }
  try {
    fs.writeFileSync(fd, serializeConfig(defaults), 'utf-8');
    invalidateConfigCache(cwd);
    const result = { created: true, path: '.planning/config.json' };
    output(result, raw, 'created');
  } catch (err) {
    debugLog('config.ensure', 'write failed', err);
    error('Failed to create config.json: ' + err.message);
  } finally {
    fs.closeSync(fd);
  }
}

function cmdConfigSet(cwd, keyPath, value, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-set <key.path> <value>');
  }

  // Parse value (handle booleans and numbers)
  let parsedValue = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(value) && value !== '') parsedValue = Number(value);

  // Load existing config or start with empty object
  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    debugLog('config.set', 'read failed', err);
    error('Failed to read config.json: ' + err.message);
  }

  try {
    config = applyConfigValue(config, keyPath, parsedValue);
  } catch (err) {
    error(err.message);
  }

  // Write back
  try {
    writeFileAtomic(configPath, serializeConfig(config));
    invalidateConfigCache(cwd);
    const result = { updated: true, key: keyPath, value: parsedValue };
    output(result, raw, `${keyPath}=${parsedValue}`);
  } catch (err) {
    debugLog('config.set', 'write failed', err);
    error('Failed to write config.json: ' + err.message);
  }
}

function cmdConfigGet(cwd, keyPath, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-get <key.path>');
  }

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      error('No config.json found at ' + configPath);
    }
  } catch (err) {
    debugLog('config.get', 'read failed', err);
    if (err.message.startsWith('No config.json')) throw err;
    error('Failed to read config.json: ' + err.message);
  }

  // Traverse dot-notation path (e.g., "workflow.auto_advance")
  const keys = keyPath.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      error(`Key not found: ${keyPath}`);
    }
    current = current[key];
  }

  if (current === undefined) {
    error(`Key not found: ${keyPath}`);
  }

  output(current, raw, String(current));
}

function cmdSettingsList(cwd, raw) {
  const config = loadConfig(cwd);

  // Build output with all config keys including optimization flags
  const outputLines = [];
  outputLines.push('=== bGSD Settings ===');
  outputLines.push('');

  // Group keys by category
  const categories = {
    'General': ['model_profile', 'mode', 'depth', 'commit_docs', 'test_gate', 'context_window', 'context_target_percent'],
    'Model Settings': ['model_settings'],
    'Workflow': ['research', 'plan_checker', 'verifier', 'parallelization', 'brave_search'],
    'Git': ['branching_strategy', 'phase_branch_template', 'milestone_branch_template'],
    'Research': ['rag_enabled', 'rag_timeout', 'ytdlp_path', 'nlm_path', 'mcp_config_path'],
    'Optimization': ['optimization_valibot', 'optimization_discovery', 'optimization_compile_cache', 'optimization_sqlite_cache'],
  };

  for (const [category, keys] of Object.entries(categories)) {
    outputLines.push(`--- ${category} ---`);
    for (const key of keys) {
      const def = CONFIG_SCHEMA[key];
      if (!def) continue;

      const value = config[key];
      const desc = def.description || '';
      const env = def.env ? ` (env: ${def.env})` : '';

      outputLines.push(`${key}: ${value}${env} - ${desc}`);
    }
    outputLines.push('');
  }

  const outputText = outputLines.join('\n');

  // Output as both structured data and text
  const structured = {
    categories: {},
  };

  for (const [category, keys] of Object.entries(categories)) {
    structured.categories[category] = {};
    for (const key of keys) {
      if (config[key] !== undefined) {
        const def = CONFIG_SCHEMA[key];
        structured.categories[category][key] = {
          value: config[key],
          description: def?.description || '',
          env_var: def?.env || null,
        };
      }
    }
  }

  output(structured, raw, outputText);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let result;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  output({ timestamp: result }, raw, result);
}

function cmdGenerateSlug(text, raw) {
  const { generateSlugInternal } = require('../../lib/helpers');
  const { output } = require('../../lib/output');

  if (!text) {
    output({ error: 'Text required' }, raw);
    return;
  }
  const slug = generateSlugInternal(text);
  output({ slug }, raw, slug);
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  const fs = require('fs');
  const path = require('path');
  const { output } = require('../../lib/output');

  if (!targetPath) {
    output({ error: 'path required' }, raw);
    return;
  }
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  const exists = fs.existsSync(fullPath);
  output({ path: targetPath, exists }, raw, exists ? 'exists' : 'not found');
}

function cmdResolveModel(cwd, agentType, raw) {
  const { resolveConfiguredModelStateFromConfig } = require('../../lib/helpers');
  const { output } = require('../../lib/output');
  const { loadConfig } = require('../../lib/config');

  const config = loadConfig(cwd);
  const resolved = resolveConfiguredModelStateFromConfig(config, agentType);
  output({ resolved_model: resolved.resolved_model, provider: resolved.provider, warning: resolved.warning || null }, raw, resolved.resolved_model);
}

function cmdFindPhase(cwd, phase, raw) {
  const { findPhaseInternal } = require('../../lib/helpers');
  const { output } = require('../../lib/output');

  if (!phase) {
    output({ error: 'phase required' }, raw);
    return;
  }
  const result = findPhaseInternal(cwd, phase);
  output(result, raw);
}

function cmdPhasePlanIndex(cwd, phase, raw) {
  const { findPhaseInternal } = require('../../lib/helpers');
  const path = require('path');
  const fs = require('fs');
  const { output } = require('../../lib/output');

  if (!phase) {
    output({ error: 'phase required' }, raw);
    return;
  }
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: `Phase ${phase} not found` }, raw);
    return;
  }
  const phaseDir = path.join(cwd, phaseInfo.directory);
  let plans = [];
  try {
    const files = fs.readdirSync(phaseDir);
    plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md')
      .map(f => f.replace(/\.md$/, ''));
  } catch (e) {
    // ignore
  }
  output({ phase, directory: phaseInfo.directory, plans }, raw);
}

function cmdStateSnapshot(cwd, raw) {
  const path = require('path');
  const fs = require('fs');
  const { output } = require('../../lib/output');

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  const state = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf-8') : null;
  const roadmap = fs.existsSync(roadmapPath) ? fs.readFileSync(roadmapPath, 'utf-8') : null;

  output({ state: state ? state.slice(0, 500) : null, roadmap: roadmap ? roadmap.slice(0, 500) : null }, raw);
}

function cmdProgressRender(cwd, format, raw) {
  const { output } = require('../../lib/output');

  format = format || 'json';
  if (format === 'json') {
    output({ message: 'Progress rendering not yet implemented' }, raw);
  } else {
    output('Progress rendering not yet implemented', raw);
  }
}

function cmdWebsearch(query, options, raw) {
  const { output } = require('../../lib/output');

  if (!query) {
    output({ error: 'query required' }, raw);
    return;
  }
  output({ message: 'Websearch not yet implemented', query }, raw);
}

module.exports = {
  cmdConfigEnsureSection,
  cmdConfigSet,
  cmdConfigGet,
  cmdSettingsList,
  cmdCurrentTimestamp,
  cmdGenerateSlug,
  cmdVerifyPathExists,
  cmdResolveModel,
  cmdFindPhase,
  cmdPhasePlanIndex,
  cmdStateSnapshot,
  cmdProgressRender,
  cmdWebsearch,
};
