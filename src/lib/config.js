const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeConfig } = require('./config-contract');
const { debugLog, error } = require('./output');

// ─── Configuration ───────────────────────────────────────────────────────────

/** Module-level config cache — keyed by cwd, lives for single CLI invocation */
const _configCache = new Map();

function readRawConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'worktree')) {
    error('Legacy `.planning/config.json.worktree` is no longer supported. Migrate to `.planning/config.json.workspace` with supported JJ settings like `base_path` and `max_concurrent` before running bGSD commands.');
  }

  return parsed;
}

function loadConfig(cwd) {
  if (_configCache.has(cwd)) {
    debugLog('config.load', `cache hit: ${cwd}`);
    return _configCache.get(cwd);
  }

  try {
    const result = normalizeConfig(readRawConfig(cwd), { freeze: false });
    _configCache.set(cwd, result);
    return result;
  } catch (e) {
    debugLog('config.load', 'parse config.json failed, using defaults', e);
    const defaults = normalizeConfig({}, { freeze: false });
    _configCache.set(cwd, defaults);
    return defaults;
  }
}

function invalidateConfigCache(cwd) {
  if (cwd) {
    _configCache.delete(cwd);
  } else {
    _configCache.clear();
  }
}

function isGitIgnored(cwd, targetPath) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', targetPath], {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch (e) {
    debugLog('git.checkIgnore', 'exec failed', e);
    return false;
  }
}

module.exports = { loadConfig, readRawConfig, isGitIgnored, invalidateConfigCache };
