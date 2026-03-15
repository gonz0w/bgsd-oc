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
  keys: 'keys',
  values: '[.[]]',
  entries: 'to_entries[]',
  flatten: 'flatten',
  unique: 'unique',
  sortBy: 'sort_by(.key)',
  mapKeys: 'keys',
  first: 'first',
  last: 'last',
  length: 'length'
};

/**
 * Apply a jq-compatible filter expression to a JavaScript value.
 * Handles: property access, array iteration, length, keys, values, select,
 * map, pipe chains, nested dot-paths, and array indexing.
 * @param {*} input - Input value
 * @param {string} filter - jq filter expression
 * @returns {*} - Filtered/transformed result
 */
function applyJqFilter(input, filter) {
  const f = filter.trim();

  // Pipe chain: split on top-level | (not inside parens/brackets)
  const pipeIdx = findTopLevelPipe(f);
  if (pipeIdx !== -1) {
    const left = f.slice(0, pipeIdx).trim();
    const right = f.slice(pipeIdx + 1).trim();
    const leftResult = applyJqFilter(input, left);
    // If left produced an array, apply right to each element (like jq streaming)
    if (Array.isArray(leftResult)) {
      return leftResult.map(item => applyJqFilter(item, right));
    }
    return applyJqFilter(leftResult, right);
  }

  // Array wrapping: [expr]
  if (f.startsWith('[') && f.endsWith(']')) {
    const inner = f.slice(1, -1).trim();
    const result = applyJqFilter(input, inner);
    return Array.isArray(result) ? result : [result];
  }

  // .[] — iterate array/object values
  if (f === '.[]') {
    return Array.isArray(input) ? input : Object.values(input);
  }

  // keys
  if (f === 'keys') {
    return Array.isArray(input) ? input.map((_, i) => i) : Object.keys(input).sort();
  }

  // values
  if (f === 'values' || f === '[.[]]') {
    return Array.isArray(input) ? input : Object.values(input);
  }

  // length
  if (f === 'length') {
    if (typeof input === 'string') return input.length;
    if (Array.isArray(input)) return input.length;
    if (input && typeof input === 'object') return Object.keys(input).length;
    return 0;
  }

  // to_entries[] or entries
  if (f === 'to_entries[]' || f === 'entries') {
    return Object.entries(input).map(([k, v]) => ({ key: k, value: v }));
  }

  // select(condition) — filter array elements
  if (f.startsWith('select(') && f.endsWith(')')) {
    const condExpr = f.slice('select('.length, -1).trim();
    // Apply condition to input; return input if truthy, else null
    try {
      const condResult = applyJqFilter(input, condExpr);
      return condResult ? input : undefined;
    } catch {
      return undefined;
    }
  }

  // map(expr) — transform each element
  if (f.startsWith('map(') && f.endsWith(')')) {
    const mapExpr = f.slice('map('.length, -1).trim();
    const arr = Array.isArray(input) ? input : Object.values(input);
    return arr.map(item => applyJqFilter(item, mapExpr));
  }

  // .key comparison: .available == true, .x > 1, etc. (for select conditions)
  const compMatch = f.match(/^\.(\w+)\s*(==|!=|>|>=|<|<=)\s*(.+)$/);
  if (compMatch) {
    const [, key, op, rawVal] = compMatch;
    const actual = input != null ? input[key] : undefined;
    let expected;
    try { expected = JSON.parse(rawVal.trim()); } catch { expected = rawVal.trim(); }
    switch (op) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>': return actual > expected;
      case '>=': return actual >= expected;
      case '<': return actual < expected;
      case '<=': return actual <= expected;
      default: return false;
    }
  }

  // .[N] — array index access
  const arrIdxMatch = f.match(/^\.\[(\d+)\]$/);
  if (arrIdxMatch) {
    return Array.isArray(input) ? input[parseInt(arrIdxMatch[1], 10)] : undefined;
  }

  // . — identity
  if (f === '.') {
    return input;
  }

  // .key or .key.subkey — dot-path property access
  if (f.startsWith('.') && !f.includes('(') && !f.includes('[')) {
    const parts = f.slice(1).split('.').filter(Boolean);
    let val = input;
    for (const part of parts) {
      if (val == null) return undefined;
      val = val[part];
    }
    return val;
  }

  // Fallback: return input as-is for unknown filters
  return input;
}

/**
 * Find the index of a top-level pipe character (not inside parens/brackets).
 * @param {string} str - Filter expression
 * @returns {number} - Index of pipe or -1
 */
function findTopLevelPipe(str) {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '|' && depth === 0) return i;
  }
  return -1;
}

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
      // Node.js fallback - comprehensive jq-compatible JSON manipulation
      const input = typeof inputJson === 'string' 
        ? JSON.parse(inputJson) 
        : inputJson;
      
      const result = applyJqFilter(input, filter);
      
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
