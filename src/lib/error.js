// ─── Error Module ────────────────────────────────────────────────────────────
// Structured error handling with context and recovery suggestions.
// Works with format.js for color-coded output.
//
// Exports:
//   Error Classes: BgsdError, ValidationError, FileError, CommandError, ConfigError
//   Formatting:   formatError, formatErrors
//   Utilities:   createErrorHandler, wrapAsync, isBgsdError, getErrorCode

'use strict';

const format = require('./format.js');

// ─── Error Classes ────────────────────────────────────────────────────────────

/**
 * Base error class for bGSD with context and recovery suggestions.
 */
class BgsdError extends Error {
  /**
   * @param {Object} options
   * @param {string} options.type - Error category (ValidationError, FileError, CommandError, ConfigError)
   * @param {string} options.message - User-friendly error message
   * @param {string} [options.file] - File path where error occurred
   * @param {number} [options.line] - Line number
   * @param {string} [options.suggestion] - Recovery action
   * @param {string} [options.code] - Error code for programmatic handling
   * @param {string} [options.oneLine] - Brief single-line summary for terminal status
   * @param {Array<string>} [options.examples] - Array of example commands or usage
   */
  constructor(options) {
    const message = typeof options === 'string' ? options : options.message;
    super(message);
    
    this.name = 'BgsdError';
    this.type = options.type || 'Error';
    this.message = message;
    this.file = options.file || null;
    this.line = options.line || null;
    this.suggestion = options.suggestion || null;
    this.code = options.code || null;
    this.oneLine = options.oneLine || null;
    this.examples = options.examples || [];
    
    // Capture stack trace properly
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for invalid input validation.
 */
class ValidationError extends BgsdError {
  constructor(options) {
    super({ ...options, type: 'ValidationError' });
    this.name = 'ValidationError';
  }
}

/**
 * Error for file-related issues.
 */
class FileError extends BgsdError {
  constructor(options) {
    super({ ...options, type: 'FileError' });
    this.name = 'FileError';
  }
}

/**
 * Error for command execution failures.
 */
class CommandError extends BgsdError {
  constructor(options) {
    super({ ...options, type: 'CommandError' });
    this.name = 'CommandError';
  }
}

/**
 * Error for configuration issues.
 */
class ConfigError extends BgsdError {
  constructor(options) {
    super({ ...options, type: 'ConfigError' });
    this.name = 'ConfigError';
  }
}

// ─── Error Formatting ───────────────────────────────────────────────────────

/**
 * Format a brief one-line error summary for terminal status.
 * @param {Error|BgsdError} error - Error to format
 * @returns {string} Brief one-line error message
 */
function formatErrorBrief(error) {
  // Use custom oneLine if provided
  if (error.oneLine) {
    return format.color.red('[ERROR]') + ' ' + error.oneLine;
  }
  
  // Generate brief summary from available information
  let brief = error.message;
  
  // Add suggestion if present
  if (error.suggestion) {
    brief += ' - ' + error.suggestion;
  }
  
  // Truncate if too long
  if (brief.length > 120) {
    brief = brief.substring(0, 117) + '...';
  }
  
  return format.color.red('[ERROR]') + ' ' + brief;
}

/**
 * Format a single error with color and recovery suggestions.
 * @param {Error|BgsdError} error - Error to format
 * @param {Object} [options]
 * @param {boolean} [options.verbose] - Show stack trace
 * @param {boolean} [options.isWarning] - Format as warning (yellow)
 * @returns {string}
 */
function formatError(error, options = {}) {
  const { verbose = false, isWarning = false } = options;
  
  const prefix = isWarning ? '[WARN]' : '[ERROR]';
  const prefixColor = isWarning ? format.color.yellow : format.color.red;
  const typeColor = format.color.bold;
  
  const lines = [];
  lines.push(prefixColor(prefix) + ' ' + typeColor(error.type || 'Error') + ': ' + error.message);
  
  // Add file:line if present
  if (error.file) {
    let fileInfo = 'File: ' + error.file;
    if (error.line) {
      fileInfo += ':' + error.line;
    }
    lines.push('       ' + format.color.dim(fileInfo));
  }
  
  // Add suggestion if present
  if (error.suggestion) {
    lines.push('       ' + format.color.green('Try: ') + error.suggestion);
  }
  
  // Add examples if present
  if (error.examples && error.examples.length > 0) {
    lines.push('');
    lines.push('       ' + format.color.bold('Examples:'));
    error.examples.forEach(example => {
      lines.push('         ' + format.color.dim('$ ' + example));
    });
  }
  
  // Add error code if present
  if (error.code) {
    lines.push('       ' + format.color.dim('Code: ' + error.code));
  }
  
  // Add stack trace in verbose mode
  if (verbose && error.stack) {
    lines.push('');
    lines.push(format.color.dim(error.stack));
  }
  
  return lines.join('\n');
}

/**
 * Format multiple errors.
 * @param {Error[]|BgsdError[]} errors - Errors to format
 * @param {Object} [options]
 * @returns {string}
 */
function formatErrors(errors, options = {}) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return '';
  }
  
  if (errors.length === 1) {
    return formatError(errors[0], options);
  }
  
  const lines = [];
  lines.push(format.color.bold(`Found ${errors.length} errors:\n`));
  
  for (let i = 0; i < errors.length; i++) {
    lines.push(formatError(errors[i], options));
    if (i < errors.length - 1) {
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// ─── Error Utilities ────────────────────────────────────────────────────────

/**
 * Create an error handler for CLI commands.
 * @param {string} commandName - Name of the command
 * @returns {Function} Error handler function
 */
function createErrorHandler(commandName) {
  return (error) => {
    const isWarning = error.isWarning || false;
    const exitCode = isWarning ? 0 : 1;
    
    // Format and output the error
    const formatted = formatError(error, { verbose: process.argv.includes('--verbose') });
    process.stderr.write(formatted + '\n');
    
    // Exit with appropriate code
    process.exit(exitCode);
  };
}

/**
 * Wrap an async function with error handling.
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function wrapAsync(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handler = createErrorHandler(fn.name || 'unknown');
      handler(error);
    }
  };
}

/**
 * Type guard for BgsdError.
 * @param {any} error - Value to check
 * @returns {boolean}
 */
function isBgsdError(error) {
  return error instanceof BgsdError;
}

/**
 * Extract error code or return 'UNKNOWN'.
 * @param {Error|BgsdError} error
 * @returns {string}
 */
function getErrorCode(error) {
  if (error instanceof BgsdError && error.code) {
    return error.code;
  }
  return 'UNKNOWN';
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Error Classes
  BgsdError,
  ValidationError,
  FileError,
  CommandError,
  ConfigError,
  
  // Formatting
  formatError,
  formatErrorBrief,
  formatErrors,
  
  // Utilities
  createErrorHandler,
  wrapAsync,
  isBgsdError,
  getErrorCode,
};
