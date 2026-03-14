/**
 * yq CLI Tool Wrapper Module
 * 
 * Provides YAML processing functionality using yq.
 * Gracefully falls back when yq is unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable, withToolFallback } = require('./fallback.js');
const path = require('path');
const os = require('os');
const fs = require('fs');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Common yq filter presets for convenience
 */
const FILTER_PRESETS = {
  keys: '.[] | key',
  values: '.[] | value',
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
 * Write content to temp file for yq processing
 */
function writeTempFile(content) {
  const crypto = require('crypto');
  const tempPath = path.join(os.tmpdir(), `yq-input-${crypto.randomBytes(8).toString('hex')}.yaml`);
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600 });
  return tempPath;
}

/**
 * Parse YAML string to JSON
 * @param {string} yamlString - Input YAML string
 * @param {object} options - Parse options
 * @returns {object} - { success, usedFallback, result, error }
 */
function parseYAML(yamlString, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'yq',
    () => {
      // Python yq doesn't support stdin, write to temp file
      const tempFile = writeTempFile(yamlString);
      try {
        const output = execFileSync('yq', ['.', tempFile], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout,
          windowsHide: true
        });
        return JSON.parse(output.trim());
      } finally {
        fs.unlinkSync(tempFile);
      }
    },
    () => {
      // Node.js fallback - basic YAML parsing
      // Try to use js-yaml if available, otherwise basic parsing
      try {
        const jsYaml = require('js-yaml');
        return jsYaml.load(yamlString);
      } catch (e) {
        // Basic fallback for simple YAML (key: value)
        const lines = yamlString.trim().split('\n');
        const result = {};
        
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim();
            
            // Try to parse value as JSON if possible
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as string
            }
            
            result[key] = value;
          }
        }
        
        return Object.keys(result).length > 0 ? result : null;
      }
    }
  );
}

/**
 * Transform YAML using yq filter expressions
 * @param {string} yamlString - Input YAML string
 * @param {string} expression - yq filter expression
 * @param {object} options - Transform options
 * @returns {object} - { success, usedFallback, result, error }
 */
function transformYAML(yamlString, expression, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'yq',
    () => {
      // Python yq doesn't support stdin, write to temp file
      const tempFile = writeTempFile(yamlString);
      try {
        const output = execFileSync('yq', [expression, tempFile], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout,
          windowsHide: true
        });
        return JSON.parse(output.trim());
      } finally {
        fs.unlinkSync(tempFile);
      }
    },
    () => {
      // Node.js fallback - basic YAML transformation
      const input = parseYAML(yamlString, options);
      
      // Simple filter implementation for common cases
      let result;
      
      if (expression === '.[]' || expression === 'keys') {
        result = Array.isArray(input) ? input : Object.values(input);
      } else if (expression === 'to_entries[]' || expression === 'entries') {
        result = Object.entries(input).map(([k, v]) => ({ key: k, value: v }));
      } else if (expression === 'length') {
        result = Array.isArray(input) ? input.length : Object.keys(input).length;
      } else if (expression.startsWith('.')) {
        // Basic property access
        const key = expression.slice(1);
        result = input[key];
      } else {
        result = input;
      }
      
      return result;
    }
  );
}

/**
 * Convert YAML to JSON string
 * @param {string} yamlString - Input YAML string
 * @param {object} options - Convert options
 * @returns {object} - { success, usedFallback, result, error }
 */
function YAMLtoJSON(yamlString, options = {}) {
  const {
    pretty = false,
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'yq',
    () => {
      // Python yq doesn't support stdin, write to temp file
      const tempFile = writeTempFile(yamlString);
      try {
        const output = execFileSync('yq', ['.', tempFile], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout,
          windowsHide: true
        });
        
        const parsed = JSON.parse(output.trim());
        return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      } finally {
        fs.unlinkSync(tempFile);
      }
    },
    () => {
      // Node.js fallback
      try {
        const jsYaml = require('js-yaml');
        const parsed = jsYaml.load(yamlString);
        return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      } catch {
        // Basic fallback
        const parsed = parseYAML(yamlString, options);
        return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
      }
    }
  );
}

/**
 * Transform YAML with a preset filter
 * @param {string} yamlString - Input YAML
 * @param {string} presetName - Name of preset filter
 * @param {object} options - Transform options
 * @returns {object}
 */
function transformWithPreset(yamlString, presetName, options = {}) {
  const filter = FILTER_PRESETS[presetName];
  if (!filter) {
    return {
      success: false,
      error: `Unknown preset: ${presetName}. Available: ${Object.keys(FILTER_PRESETS).join(', ')}`
    };
  }
  return transformYAML(yamlString, filter, options);
}

/**
 * Get available filter presets
 * @returns {object}
 */
function getFilterPresets() {
  return { ...FILTER_PRESETS };
}

/**
 * Check if yq is available
 * @returns {boolean}
 */
function isYqAvailable() {
  return isToolAvailable('yq');
}

module.exports = {
  parseYAML,
  transformYAML,
  YAMLtoJSON,
  transformWithPreset,
  getFilterPresets,
  FILTER_PRESETS,
  isYqAvailable
};
