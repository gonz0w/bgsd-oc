import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const TOOL_NAMES = ['ripgrep', 'fd', 'jq', 'yq', 'ast_grep', 'sd', 'hyperfine', 'bat', 'gh'];
export const TOOL_CACHE_TTL_MS = 30 * 60 * 1000;

export function createUnknownToolAvailability() {
  return Object.fromEntries(TOOL_NAMES.map((name) => [name, null]));
}

export function computeCapabilityLevel(toolAvailability) {
  const values = Object.values(toolAvailability || {});
  const knownCount = values.filter((value) => value === true || value === false).length;

  if (knownCount === 0) return 'UNKNOWN';

  const toolCount = values.filter((value) => value === true).length;
  if (toolCount >= 5) return 'HIGH';
  if (toolCount <= 1) return 'LOW';
  return 'MEDIUM';
}

function getCachePath(projectDir) {
  return join(projectDir, '.planning', '.cache', 'tools.json');
}

function resolveCliPath() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.BGSD_PLUGIN_DIR ? join(process.env.BGSD_PLUGIN_DIR, 'bin', 'bgsd-tools.cjs') : null,
    join(currentDir, '..', '..', 'bin', 'bgsd-tools.cjs'),
    join(currentDir, 'bin', 'bgsd-tools.cjs'),
    join(currentDir, '..', 'bin', 'bgsd-tools.cjs'),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  throw new Error('Could not locate bgsd-tools.cjs');
}

function mapResultsToAvailability(results) {
  const availability = createUnknownToolAvailability();

  for (const toolName of TOOL_NAMES) {
    if (results && Object.prototype.hasOwnProperty.call(results, toolName)) {
      availability[toolName] = Boolean(results[toolName] && results[toolName].available);
    }
  }

  return availability;
}

function mapDetectToolsOutput(entries) {
  const availability = createUnknownToolAvailability();

  if (!Array.isArray(entries)) return availability;

  for (const entry of entries) {
    const toolName = entry && typeof entry.name === 'string' ? entry.name : null;
    if (toolName && TOOL_NAMES.includes(toolName)) {
      availability[toolName] = entry.available === true ? true : entry.available === false ? false : null;
    }
  }

  return availability;
}

function inspectToolCache(projectDir) {
  const cachePath = getCachePath(projectDir);

  if (!existsSync(cachePath)) {
    return { state: 'missing', cachePath, timestamp: null, ageMs: null, results: null };
  }

  try {
    const cacheData = JSON.parse(readFileSync(cachePath, 'utf-8'));
    if (!cacheData || typeof cacheData !== 'object' || !cacheData.timestamp || !cacheData.results) {
      return { state: 'malformed', cachePath, timestamp: null, ageMs: null, results: null };
    }

    const ageMs = Date.now() - cacheData.timestamp;
    return {
      state: ageMs < TOOL_CACHE_TTL_MS ? 'fresh' : 'stale',
      cachePath,
      timestamp: cacheData.timestamp,
      ageMs,
      results: cacheData.results,
    };
  } catch {
    return { state: 'malformed', cachePath, timestamp: null, ageMs: null, results: null };
  }
}

function refreshToolAvailability(projectDir) {
  const cliPath = resolveCliPath();
  const output = execFileSync(process.execPath, [cliPath, 'detect:tools', '--raw'], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(String(output || '[]').trim() || '[]');
  return mapDetectToolsOutput(parsed);
}

export function getToolAvailability(projectDir, options = {}) {
  const { refreshIfNeeded = true } = options;
  const cache = inspectToolCache(projectDir);

  if (cache.state === 'fresh') {
    return {
      tool_availability: mapResultsToAvailability(cache.results),
      tool_availability_meta: {
        state: 'fresh',
        source: 'cache',
        cache_path: cache.cachePath,
        cache_timestamp: cache.timestamp,
        cache_age_ms: cache.ageMs,
        cache_ttl_ms: TOOL_CACHE_TTL_MS,
      },
    };
  }

  if (refreshIfNeeded) {
    try {
      const refreshed = refreshToolAvailability(projectDir);
      const refreshedCache = inspectToolCache(projectDir);
      return {
        tool_availability: refreshed,
        tool_availability_meta: {
          state: 'fresh',
          source: 'cli-refresh',
          refresh_reason: cache.state,
          cache_path: refreshedCache.cachePath,
          cache_timestamp: refreshedCache.timestamp,
          cache_age_ms: refreshedCache.ageMs,
          cache_ttl_ms: TOOL_CACHE_TTL_MS,
        },
      };
    } catch (error) {
      return {
        tool_availability: createUnknownToolAvailability(),
        tool_availability_meta: {
          state: 'unknown',
          source: 'fallback',
          refresh_reason: cache.state,
          refresh_error: error.message || String(error),
          cache_path: cache.cachePath,
          cache_timestamp: cache.timestamp,
          cache_age_ms: cache.ageMs,
          cache_ttl_ms: TOOL_CACHE_TTL_MS,
        },
      };
    }
  }

  return {
    tool_availability: createUnknownToolAvailability(),
    tool_availability_meta: {
      state: cache.state === 'fresh' ? 'fresh' : 'unknown',
      source: cache.state === 'fresh' ? 'cache' : 'fallback',
      cache_path: cache.cachePath,
      cache_timestamp: cache.timestamp,
      cache_age_ms: cache.ageMs,
      cache_ttl_ms: TOOL_CACHE_TTL_MS,
    },
  };
}
