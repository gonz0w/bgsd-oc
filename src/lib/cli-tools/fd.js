/**
 * fd CLI Tool Wrapper Module
 * 
 * Provides file discovery functionality using fd with .gitignore respect.
 * Gracefully falls back when fd is unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable } = require('./fallback.js');
const { withToolFallback } = require('./fallback.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Find files using fd
 * @param {string} pattern - Search pattern (regex or glob)
 * @param {object} options - Search options
 * @returns {object} - { success, usedFallback, result, error }
 */
function findFiles(pattern, options = {}) {
  const {
    extension = null,      // -e flag
    type = null,           // -t flag (f=file, d=directory)
    exclude = null,        // --exclude flag
    hidden = false,        // -H flag (show hidden)
    maxDepth = null,       // -d flag
    absolutePath = false,  // -a flag
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  // Build fd arguments
  const args = [];
  
  if (hidden) args.push('-H');
  if (absolutePath) args.push('-a');
  if (exclude) args.push('--exclude', exclude);
  if (maxDepth !== null) args.push('-d', String(maxDepth));
  if (type) args.push('-t', type);
  if (extension) {
    // Use glob pattern for extension search
    args.push('--glob', `*.${extension}`);
  } else if (pattern) {
    // Use --glob for glob patterns, otherwise treat as regex
    if (pattern.includes('*') || pattern.includes('?')) {
      args.push('--glob', pattern);
    } else {
      args.push(pattern);
    }
  }

  // Use fallback wrapper for graceful degradation
  return withToolFallback(
    'fd',
    () => {
      const output = execFileSync('fd', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      // Parse output - split by newline, filter empty lines
      const files = output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      return files;
    },
    () => {
      // Node.js fallback - basic glob implementation using fast-glob
      const fg = require('fast-glob');
      const path = require('path');
      
      let globPattern = pattern;
      
      // Convert fd pattern to glob pattern
      if (extension) {
        globPattern = `**/*.${extension}`;
      } else if (!pattern || (!pattern.includes('*') && !pattern.includes('.'))) {
        globPattern = '**/*';
      }
      
      const fgOptions = {
        dot: true,
        ignore: ['node_modules/**', '.git/**'],
        absolute: absolutePath,
        onlyFiles: type !== 'd',
        onlyDirectories: type === 'd',
        suppressErrors: true,
      };
      if (maxDepth !== null) fgOptions.deep = maxDepth;
      
      const files = fg.sync(globPattern, fgOptions);
      return files;
    }
  );
}

/**
 * Find directories using fd
 * @param {string} pattern - Search pattern
 * @param {object} options - Search options
 * @returns {object} - { success, usedFallback, result, error }
 */
function findDirectories(pattern, options = {}) {
  return findFiles(pattern, { ...options, type: 'd' });
}

/**
 * Find files by extension
 * @param {string} extension - File extension (without dot)
 * @param {object} options - Search options
 * @returns {object} - { success, usedFallback, result, error }
 */
function findByExtension(extension, options = {}) {
  return findFiles('', { ...options, extension });
}

/**
 * Check if fd is available
 * @returns {boolean}
 */
function isFdAvailable() {
  return isToolAvailable('fd');
}

module.exports = {
  findFiles,
  findDirectories,
  findByExtension,
  isFdAvailable
};
