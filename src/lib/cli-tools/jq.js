/**
 * jq CLI Tool Wrapper Module
 * 
 * Provides JSON transformation functionality using jq.
 * Gracefully falls back when jq is unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable } = require('./fallback.js');
const { withToolFallback } = require('./fallback.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Common jq filter presets for convenience
 */
const FILTER_PRESETS = {
  keys: '.[]',
  values: '.[]',
  entries: 'to_entries[]',
  flatten: 'flatten',
  unique: 'unique',
  sortBy: 'sort_by(.key)',
  mapKeys: 'map_keys[]',
  first: 'first',
  last: 'last',
  length: 'length'
};

/**
 * Transform JSON using jq
 * @param {string|object} inputJson - Input JSON (string or parsed object)
 * @param {string} filter - jq filter expression
 * @param {object} options - Transform options
 * @returns {object} - { success, usedFallback, result, error }
 */
function transformJson(inputJson, filter, options = {}) {
  const {
    compact = false,      // -c flag
    raw = false,          // -r flag (raw output)
    stream = false,       // --stream flag
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  // Build jq arguments
  const args = [];
  
  if (compact) args.push('-c');
  if (raw) args.push('-r');
  if (stream) args.push('--stream');
  
  args.push(filter);

  // Convert input to string if it's an object
  const inputStr = typeof inputJson === 'string' 
    ? inputJson 
    : JSON.stringify(inputJson);

  // Use fallback wrapper for graceful degradation
  return withToolFallback(
    'jq',
    () => {
      const output = execFileSync('jq', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        input: inputStr,
        timeout,
        windowsHide: true
      });
      
      return output.trim();
    },
    () => {
      // Node.js fallback - basic JSON manipulation
      const input = typeof inputJson === 'string' 
        ? JSON.parse(inputJson) 
        : inputJson;
      
      // Simple filter implementation for common cases
      let result;
      
      if (filter === '.[]' || filter === 'keys') {
        // Array values or object keys
        result = Array.isArray(input) ? input : Object.values(input);
      } else if (filter === 'to_entries[]' || filter === 'entries') {
        // Object to entries
        result = Object.entries(input).map(([k, v]) => ({ key: k, value: v }));
      } else if (filter === 'length') {
        // Length
        result = Array.isArray(input) ? input.length : Object.keys(input).length;
      } else if (filter.startsWith('.')) {
        // Basic property access
        const key = filter.slice(1);
        result = input[key];
      } else {
        // Fallback: return input as-is for unknown filters
        result = input;
      }
      
      // Apply options
      if (compact) {
        return JSON.stringify(result);
      }
      if (raw && typeof result === 'string') {
        return result;
      }
      
      return JSON.stringify(result, null, raw ? null : 2);
    }
  );
}

/**
 * Transform JSON with a preset filter
 * @param {string|object} inputJson - Input JSON
 * @param {string} presetName - Name of preset filter
 * @param {object} options - Transform options
 * @returns {object}
 */
function transformWithPreset(inputJson, presetName, options = {}) {
  const filter = FILTER_PRESETS[presetName];
  if (!filter) {
    return {
      success: false,
      error: `Unknown preset: ${presetName}. Available: ${Object.keys(FILTER_PRESETS).join(', ')}`
    };
  }
  return transformJson(inputJson, filter, options);
}

/**
 * Get available filter presets
 * @returns {object}
 */
function getFilterPresets() {
  return { ...FILTER_PRESETS };
}

/**
 * Check if jq is available
 * @returns {boolean}
 */
function isJqAvailable() {
  return isToolAvailable('jq');
}

module.exports = {
  transformJson,
  transformWithPreset,
  getFilterPresets,
  FILTER_PRESETS,
  isJqAvailable
};
