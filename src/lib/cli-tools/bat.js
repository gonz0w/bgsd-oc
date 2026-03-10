/**
 * bat CLI Tool Wrapper Module
 * 
 * Provides syntax highlighting functionality using bat.
 * Gracefully falls back when bat is unavailable.
 */

const { execFileSync } = require('child_process');
const { isToolAvailable, withToolFallback } = require('./fallback.js');

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Common bat style presets
 */
const STYLE_PRESETS = {
  full: 'full',
  header: 'header',
  numbers: 'numbers',
  grid: 'grid',
  none: 'none'
};

/**
 * Output file with syntax highlighting
 * @param {string} filePath - Path to file to display
 * @param {object} options - Display options
 * @returns {object} - { success, usedFallback, result, error }
 */
function catWithHighlight(filePath, options = {}) {
  const {
    style = 'header,grid',
    theme = 'auto',
    language = 'auto',
    color = 'auto',
    lineRange = null,
    timeout = DEFAULT_TIMEOUT_MS
  } = options;

  return withToolFallback(
    'bat',
    () => {
      const args = [];
      
      // Style options
      if (style) args.push('--style', style);
      
      // Theme
      if (theme) args.push('--theme', theme);
      
      // Language
      if (language && language !== 'auto') args.push('--language', language);
      
      // Color mode
      if (color) args.push('--color', color);
      
      // Line range
      if (lineRange) {
        args.push('--line-range', `${lineRange.start}:${lineRange.end}`);
      }
      
      // Add file path
      args.push(filePath);
      
      const output = execFileSync('bat', args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      return output;
    },
    () => {
      // Node.js fallback - basic cat without colors
      const fs = require('fs');
      return fs.readFileSync(filePath, 'utf8');
    }
  );
}

/**
 * Detect appropriate theme for a file
 * @param {string} filePath - Path to file
 * @returns {object} - { success, usedFallback, result, error }
 */
function getFileTheme(filePath) {
  return withToolFallback(
    'bat',
    () => {
      // Get language for file
      const langResult = getLanguage(filePath);
      const language = langResult.success ? langResult.result : null;
      
      // Return default theme recommendations based on language
      const themeMap = {
        javascript: 'Monokai',
        typescript: 'Monokai',
        python: 'Monokai',
        rust: 'Monokai',
        go: 'Monokai',
        json: 'GitHub',
        yaml: 'OneHalfDark',
        markdown: 'GitHub',
        html: 'OneHalfDark',
        css: 'OneHalfDark',
        shell: 'Solarized (dark)',
        bash: 'Solarized (dark)'
      };
      
      return language ? (themeMap[language] || 'Monokai') : 'Monokai';
    },
    () => {
      // No theme in fallback - return default
      return 'default';
    }
  );
}

/**
 * List available bat themes
 * @param {object} options - Options
 * @returns {object} - { success, usedFallback, result, error }
 */
function listThemes(options = {}) {
  const { timeout = 5000 } = options;

  return withToolFallback(
    'bat',
    () => {
      const output = execFileSync('bat', ['--list-themes'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true
      });
      
      // Parse theme names from output
      const themes = output
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('[') && !line.startsWith('Theme'))
        .map(line => line.trim().split(/\s+/)[0])
        .filter(Boolean);
      
      return themes;
    },
    () => {
      // Return default themes as fallback
      return ['Monokai', 'GitHub', 'OneHalfDark', 'Solarized (dark)', 'Dracula'];
    }
  );
}

/**
 * Detect language from file extension
 * @param {string} filePath - Path to file
 * @returns {object} - { success, usedFallback, result, error }
 */
function getLanguage(filePath) {
  return withToolFallback(
    'bat',
    () => {
      const output = execFileSync('bat', ['--language', filePath], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      
      // bat outputs the language to stderr, so we need to check
      return 'auto';
    },
    () => {
      // Node.js fallback - detect from extension
      const path = require('path');
      const ext = path.extname(filePath).toLowerCase().slice(1);
      
      const extMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'rb': 'ruby',
        'rs': 'rust',
        'go': 'go',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less',
        'md': 'markdown',
        'markdown': 'markdown',
        'sh': 'shell',
        'bash': 'bash',
        'zsh': 'bash',
        'sql': 'sql',
        'dockerfile': 'dockerfile',
        'toml': 'toml',
        'ini': 'ini',
        'conf': 'ini',
        'txt': 'plaintext'
      };
      
      return extMap[ext] || 'auto';
    }
  );
}

/**
 * Get available style presets
 * @returns {object}
 */
function getStylePresets() {
  return { ...STYLE_PRESETS };
}

/**
 * Check if bat is available
 * @returns {boolean}
 */
function isBatAvailable() {
  return isToolAvailable('bat');
}

module.exports = {
  catWithHighlight,
  getFileTheme,
  listThemes,
  getLanguage,
  getStylePresets,
  STYLE_PRESETS,
  isBatAvailable
};
