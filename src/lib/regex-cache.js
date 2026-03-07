// ─── Regex Cache ─────────────────────────────────────────────────────────────
// Pre-compiled regex patterns used across the codebase.
// Avoids repeated `new RegExp()` construction in hot paths.
// Each pattern is compiled once at module load time and reused.

/**
 * LRU-bounded regex cache for dynamically-constructed patterns.
 * Prevents unbounded memory growth while caching hot patterns.
 */
const MAX_CACHE_SIZE = 200;
const _dynamicRegexCache = new Map();

/**
 * Get or create a cached RegExp from a pattern string + flags.
 * Uses an LRU eviction strategy when cache exceeds MAX_CACHE_SIZE.
 *
 * @param {string} pattern - Regex pattern string
 * @param {string} [flags=''] - Regex flags (e.g., 'i', 'gi')
 * @returns {RegExp} Compiled regex
 */
function cachedRegex(pattern, flags = '') {
  const key = `${pattern}|||${flags}`;
  if (_dynamicRegexCache.has(key)) {
    // Move to end (most recently used)
    const regex = _dynamicRegexCache.get(key);
    _dynamicRegexCache.delete(key);
    _dynamicRegexCache.set(key, regex);
    return regex;
  }

  // Evict oldest entry if at capacity
  if (_dynamicRegexCache.size >= MAX_CACHE_SIZE) {
    const oldest = _dynamicRegexCache.keys().next().value;
    _dynamicRegexCache.delete(oldest);
  }

  const regex = new RegExp(pattern, flags);
  _dynamicRegexCache.set(key, regex);
  return regex;
}

// ─── Pre-compiled Patterns ──────────────────────────────────────────────────
// Patterns used frequently across multiple modules.

/** Match frontmatter delimiters */
const FRONTMATTER_DELIMITERS = /^---\n([\s\S]+?)\n---/;

/** Match phase header in ROADMAP.md: "## Phase N: Name" or "### Phase N: Name" */
const PHASE_HEADER = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;

/** Match milestone line with active marker */
const ACTIVE_MILESTONE = /[-*]\s*🔵\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/;

/** Match "(active)" tag on milestone line */
const ACTIVE_TAG_MILESTONE = /[-*]\s*(?:🔵\s*)?\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*\(active\)[^\n]*)/i;

/** Match version string like "v1.0" */
const VERSION_PATTERN = /v(\d+\.\d+)/;

/** Match date string YYYY-MM-DD */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Match phase number from directory name */
const PHASE_DIR_NUMBER = /^(\d+(?:\.\d+)?)-?(.*)/;

/** Match commit SHA (7-40 hex chars) */
const COMMIT_SHA = /\b([a-f0-9]{7,40})\b/g;

/** Match unchecked roadmap phase checkbox */
const UNCHECKED_PHASE = /- \[ \] \*\*Phase/g;

module.exports = {
  cachedRegex,
  PHASE_DIR_NUMBER,
};
