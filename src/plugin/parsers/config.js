import { readFileSync } from 'fs';
import { join } from 'path';
import configContract from '../../lib/config-contract.js';

const { buildDefaultConfig, normalizeConfig, serializeConfig } = configContract;

/**
 * config.json parser for in-process reading.
 * Extracts configuration from .planning/config.json with schema defaults.
 *
 * Parsing logic reuses the shared config contract so CLI and plugin touched
 * settings stay aligned on one schema-driven normalization path.
 */

// Module-level cache: cwd → frozen parsed config
const _cache = new Map();

/**
 * Inline schema defaults — avoids importing from constants.js which would
 * pull the entire CLI dependency graph into the plugin bundle.
 */
const CONFIG_DEFAULTS = Object.freeze({
  staleness_threshold: 2,
  // Phase 75: Event-driven state sync settings
  idle_validation: Object.freeze({
    enabled: true,
    cooldown_seconds: 5,
    staleness_threshold_hours: 2,
  }),
  notifications: Object.freeze({
    enabled: true,
    os_notifications: true,
    dnd_mode: false,
    rate_limit_per_minute: 5,
    sound: false,
  }),
  stuck_detection: Object.freeze({
    error_threshold: 3,
    spinning_threshold: 5,
  }),
  file_watcher: Object.freeze({
    debounce_ms: 200,
    max_watched_paths: 500,
  }),
  // Phase 76: Advisory guardrails settings
  advisory_guardrails: Object.freeze({
    enabled: true,
    conventions: true,
    planning_protection: true,
    test_suggestions: true,
    convention_confidence_threshold: 70,
    dedup_threshold: 3,
    test_debounce_ms: 500,
    // Phase 144: Destructive command detection (GARD-04)
    destructive_commands: Object.freeze({
      enabled: true,
      sandbox_mode: 'auto',
      categories: Object.freeze({
        filesystem: true,
        database: true,
        git: true,
        system: true,
        'supply-chain': true,
      }),
      disabled_patterns: [],
      custom_patterns: [],
    }),
  }),
});

/**
 * Parse config.json from the given working directory (or CWD).
 * Returns a frozen object with all config fields and defaults applied.
 * Returns default config if file is missing or corrupt.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {object} Frozen config object (never null — defaults always applied)
 */
export function parseConfig(cwd) {
  const resolvedCwd = cwd || process.cwd();

  // Check cache
  if (_cache.has(resolvedCwd)) {
    return _cache.get(resolvedCwd);
  }

  const configPath = join(resolvedCwd, '.planning', 'config.json');

  let parsed = {};
  try {
    const raw = readFileSync(configPath, 'utf-8');
    parsed = JSON.parse(raw);
  } catch {
    // File missing or corrupt — use all defaults
    const defaults = normalizeConfig({}, { extraDefaults: CONFIG_DEFAULTS });
    _cache.set(resolvedCwd, defaults);
    return defaults;
  }

  const frozen = normalizeConfig(parsed, { extraDefaults: CONFIG_DEFAULTS });
  _cache.set(resolvedCwd, frozen);
  return frozen;
}

export function buildDefaultConfigText() {
  return serializeConfig(buildDefaultConfig());
}

/**
 * Invalidate cached config for a given CWD (or all if no CWD).
 * @param {string} [cwd] - Specific CWD to invalidate, or all if omitted
 */
export function invalidateConfig(cwd) {
  if (cwd) {
    _cache.delete(cwd);
  } else {
    _cache.clear();
  }
}
