/**
 * Ripgrep CLI Tool Wrapper Module
 * 
 * Provides search functionality using ripgrep with JSON output parsing.
 * Gracefully falls back when ripgrep is unavailable.
 */

const { execFileSync } = require('child_process');
const { detectTool } = require('./detector.js');
const { withToolFallback, isToolAvailable } = require('./fallback.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Parse JSON Lines output from ripgrep
 * @param {string} output - Raw output from ripgrep --json
 * @returns {array} - Array of match objects
 */
function parseRipgrepJson(output) {
  if (!output || !output.trim()) {
    return [];
  }
  
  const lines = output.split('\n').filter(line => line.trim());
  const matches = [];
  
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      // Only include actual match objects
      if (obj.type === 'match') {
        matches.push({
          path: obj.data?.path?.text || obj.data?.path || '',
          lineNumber: obj.data?.line_number || 0,
          line: obj.data?.lines?.text || obj.data?.line || '',
          offset: obj.data?.offset || 0,
          // Preserve full data for advanced use
          _raw: obj.data
        });
      }
    } catch {
      // Skip invalid JSON lines
      continue;
    }
  }
  
  return matches;
}

/**
 * Search using ripgrep with JSON output
 * @param {string} pattern - Search pattern
 * @param {object} options - Search options
 * @returns {object} - { success, usedFallback, result, error }
 */
function searchRipgrep(pattern, options = {}) {
  const {
    paths = ['.'],
    ignoreCase = false,
    wordRegexp = false,
    hidden = false,
    maxCount = 0,
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  // Build ripgrep arguments
  const args = ['--json'];
  
  if (ignoreCase) args.push('-i');
  if (wordRegexp) args.push('-w');
  if (hidden) args.push('-H');
  if (maxCount > 0) args.push('--max-count', String(maxCount));
  
  args.push(pattern);
  
  // Add paths
  if (Array.isArray(paths)) {
    args.push(...paths);
  } else {
    args.push(paths);
  }

  // Use fallback wrapper for graceful degradation
  return withToolFallback(
    'ripgrep',
    () => {
      const output = execFileSync('rg', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        // Ignore exit code 1 (no matches)
        windowsHide: true
      });
      
      // Return parsed results directly (wrapper will add success/usedFallback)
      return parseRipgrepJson(output);
    },
    () => {
      // Node.js fallback - simple grep implementation
      const results = [];
      
      // Use basic pattern matching fallback
      for (const path of Array.isArray(paths) ? paths : [paths]) {
        const { globSync } = require('glob');
        const files = globSync('**/*', { 
          cwd: path,
          ignore: ['node_modules/**', '.git/**']
        });
        
        for (const file of files) {
          const fullPath = require('path').join(path, file);
          try {
            const content = require('fs').readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              const regex = ignoreCase 
                ? new RegExp(pattern, 'i') 
                : new RegExp(pattern);
              if (regex.test(line)) {
                results.push({
                  path: file,
                  lineNumber: idx + 1,
                  line: line.trim(),
                  offset: idx,
                  _raw: null
                });
              }
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
      
      return results;
    }
  );
}

/**
 * Check if ripgrep is available
 * @returns {boolean}
 */
function isRipgrepAvailable() {
  return isToolAvailable('ripgrep');
}

module.exports = {
  searchRipgrep,
  parseRipgrepJson,
  isRipgrepAvailable
};
