const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CONFIG_SCHEMA } = require('./constants');
const { debugLog } = require('./output');

// ─── Configuration ───────────────────────────────────────────────────────────

function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  // Build defaults from CONFIG_SCHEMA
  const defaults = {};
  for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
    defaults[key] = def.default;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Lookup priority: flat key → nested path → aliases
    const get = (key, def) => {
      if (parsed[key] !== undefined) return parsed[key];
      if (def.nested && parsed[def.nested.section] && parsed[def.nested.section][def.nested.field] !== undefined) {
        return parsed[def.nested.section][def.nested.field];
      }
      for (const alias of def.aliases) {
        if (parsed[alias] !== undefined) return parsed[alias];
      }
      return undefined;
    };

    const result = {};
    for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
      if (def.coerce === 'parallelization') {
        // Special coercion: {enabled: true} → true
        const val = get(key, def);
        if (typeof val === 'boolean') { result[key] = val; }
        else if (typeof val === 'object' && val !== null && 'enabled' in val) { result[key] = val.enabled; }
        else { result[key] = def.default; }
      } else {
        result[key] = get(key, def) ?? def.default;
      }
    }
    return result;
  } catch (e) {
    debugLog('config.load', 'parse config.json failed, using defaults', e);
    return defaults;
  }
}

function isGitIgnored(cwd, targetPath) {
  try {
    execSync('git check-ignore -q -- ' + targetPath.replace(/[^a-zA-Z0-9._\-/]/g, ''), {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch (e) {
    debugLog('git.checkIgnore', 'exec failed', e);
    return false;
  }
}

module.exports = { loadConfig, isGitIgnored };
