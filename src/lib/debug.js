// ─── Debug Module ────────────────────────────────────────────────────────────
// Debugging and troubleshooting utilities.
// Provides trace, context dump, and state inspection capabilities.
//
// Exports:
//   Trace:       trace, traceError, traceStack, getTrace
//   Context:     dumpContext, dumpState, dumpConfig
//   Inspection:  inspectState, inspectPhase, inspectRoadmap, inspectPlans
//   Flags:       parseDebugFlags, isDebugEnabled, isTraceEnabled

'use strict';

const fs = require('fs');
const path = require('path');
const format = require('./format.js');
const error = require('./error.js');

// ─── Debug State ────────────────────────────────────────────────────────────

let _debugEnabled = false;
let _traceEnabled = false;
let _traceBuffer = [];
const MAX_TRACE_ENTRIES = 100;

// ─── Trace Functions ────────────────────────────────────────────────────────

/**
 * Log a trace message with timestamp.
 * @param {string} message - Trace message
 * @param {*} [data] - Optional data to log
 * @param {string} [level='info'] - Trace level: debug, info, warn, error
 */
function trace(message, data, level = 'info') {
  if (!_debugEnabled && !_traceEnabled) return;
  
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data !== undefined ? data : null,
    stack: level === 'error' ? new Error().stack : null,
  };
  
  // Add to buffer
  _traceBuffer.push(entry);
  if (_traceBuffer.length > MAX_TRACE_ENTRIES) {
    _traceBuffer.shift();
  }
  
  // Output based on level
  const levelColors = {
    debug: format.color.gray,
    info: format.color.blue,
    warn: format.color.yellow,
    error: format.color.red,
  };
  
  const colorFn = levelColors[level] || format.color.blue;
  const prefix = colorFn(`[${level.toUpperCase()}]`);
  const timeStr = format.color.dim(new Date().toISOString());
  
  let output = `${timeStr} ${prefix} ${message}`;
  if (data !== undefined) {
    output += ' ' + format.color.dim(JSON.stringify(data, null, 2));
  }
  
  process.stderr.write(output + '\n');
}

/**
 * Trace an error with formatted output.
 * @param {Error} err - Error to trace
 */
function traceError(err) {
  const errObj = err instanceof error.BgsdError ? err : new error.BgsdError({
    type: 'Error',
    message: err.message,
    suggestion: err.suggestion,
  });
  
  trace(err.message, {
    type: errObj.type,
    code: errObj.code,
    file: errObj.file,
    line: errObj.line,
    stack: err.stack,
  }, 'error');
  
  return error.formatError(errObj);
}

/**
 * Get the current stack trace.
 * @param {number} [depth=10] - Number of frames to capture
 * @returns {string[]} Array of stack frame strings
 */
function traceStack(depth = 10) {
  const stack = new Error().stack;
  const frames = stack.split('\n').slice(3, 3 + depth);
  return frames.map(f => f.trim());
}

/**
 * Get all trace entries.
 * @returns {Object[]} Array of trace entries
 */
function getTrace() {
  return [..._traceBuffer];
}

/**
 * Clear trace buffer.
 */
function clearTrace() {
  _traceBuffer = [];
}

// ─── Context Dump Functions ─────────────────────────────────────────────────

const SECRET_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /api[_-]?key/i,
  /auth/i,
];

/**
 * Filter sensitive environment variables.
 * @param {Object} env - Environment variables
 * @returns {Object} Filtered environment
 */
function _filterEnv(env) {
  const filtered = {};
  for (const [key, value] of Object.entries(env)) {
    const isSecret = SECRET_PATTERNS.some(pattern => pattern.test(key));
    filtered[key] = isSecret ? '***REDACTED***' : value;
  }
  return filtered;
}

/**
 * Capture and format current execution context.
 * @param {Object} [options]
 * @param {boolean} [options.includeEnv=true] - Include environment variables
 * @param {boolean} [options.includeFiles=true] - Include recently modified files
 * @returns {string}
 */
function dumpContext(options = {}) {
  const {
    includeEnv = true,
    includeFiles = true,
  } = options;
  
  const lines = [];
  lines.push(format.sectionHeader('Context Dump'));
  
  // Working directory
  lines.push(format.color.bold('Working Directory:') + ' ' + process.cwd());
  
  // Node version
  lines.push(format.color.bold('Node Version:') + ' ' + process.version);
  
  // Command line
  lines.push(format.color.bold('Command:') + ' ' + process.argv.join(' '));
  
  // Environment (filtered)
  if (includeEnv) {
    lines.push('');
    lines.push(format.color.bold('Environment (filtered):'));
    const env = _filterEnv(process.env);
    const envLines = Object.entries(env)
      .slice(0, 20)
      .map(([k, v]) => `  ${k}=${v}`);
    lines.push(envLines.join('\n'));
    if (Object.keys(env).length > 20) {
      lines.push(format.color.dim('  ... and ' + (Object.keys(env).length - 20) + ' more'));
    }
  }
  
  // Current phase/plan from STATE.md
  const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    lines.push('');
    lines.push(format.color.bold('Current Planning State:'));
    try {
      const stateContent = fs.readFileSync(statePath, 'utf-8');
      const phaseMatch = stateContent.match(/\*\*Phase:\*\* (\d+)/);
      const statusMatch = stateContent.match(/\*\*Status:\*\* ([^\n]+)/);
      if (phaseMatch) {
        lines.push(`  Phase: ${phaseMatch[1]}`);
      }
      if (statusMatch) {
        lines.push(`  Status: ${statusMatch[1]}`);
      }
    } catch (e) {
      lines.push(format.color.dim('  (Unable to read STATE.md)'));
    }
  }
  
  return lines.join('\n');
}

/**
 * Read and format STATE.md.
 * @returns {string}
 */
function dumpState() {
  const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
  
  if (!fs.existsSync(statePath)) {
    return format.color.yellow('STATE.md not found');
  }
  
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    return format.box('Current project state from STATE.md\n\n' + format.color.dim(content.slice(0, 500)), 'info');
  } catch (e) {
    return format.color.red('Error reading STATE.md: ' + e.message);
  }
}

/**
 * Show current configuration.
 * @returns {string}
 */
function dumpConfig() {
  const configPath = path.join(process.cwd(), '.planning', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    return format.color.yellow('Config not found');
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return format.box('Current configuration\n\n' + format.color.dim(JSON.stringify(config, null, 2)), 'info');
  } catch (e) {
    return format.color.red('Error reading config: ' + e.message);
  }
}

// ─── State Inspection Functions ──────────────────────────────────────────────

/**
 * Read and parse STATE.md.
 * @returns {Object|null}
 */
function inspectState() {
  const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
  
  if (!fs.existsSync(statePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    return { content, path: statePath };
  } catch (e) {
    return null;
  }
}

/**
 * Read phase details.
 * @param {number|string} phaseNum - Phase number
 * @returns {Object|null}
 */
function inspectPhase(phaseNum) {
  const phaseDir = path.join(process.cwd(), '.planning', 'phases');
  const normalized = String(phaseNum).replace(/^0+/, '') || '0';

  // Find phase directory using normalized comparison
  let targetDir = null;
  try {
    const entries = fs.readdirSync(phaseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (!dirMatch) continue;
      const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
      if (dirPhaseNum === normalized) {
        targetDir = entry.name;
        break;
      }
    }
  } catch (e) {
    return null;
  }

  if (!targetDir) {
    return null;
  }

  const phasePath = path.join(phaseDir, targetDir);
  const contextPath = path.join(phasePath, normalized + '-CONTEXT.md');
  
  if (!fs.existsSync(contextPath)) {
    return { path: phasePath, exists: true, hasContext: false };
  }
  
  try {
    const content = fs.readFileSync(contextPath, 'utf-8');
    return { path: phasePath, content, hasContext: true };
  } catch (e) {
    return null;
  }
}

/**
 * Show roadmap overview.
 * @returns {Object|null}
 */
function inspectRoadmap() {
  const roadmapPath = path.join(process.cwd(), '.planning', 'ROADMAP.md');
  
  if (!fs.existsSync(roadmapPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    return { content, path: roadmapPath };
  } catch (e) {
    return null;
  }
}

/**
 * List plans for a phase.
 * @param {number|string} phaseNum - Phase number
 * @returns {string[]}
 */
function inspectPlans(phaseNum) {
  const phaseDir = path.join(process.cwd(), '.planning', 'phases');
  const normalized = String(phaseNum).replace(/^0+/, '') || '0';

  // Find phase directory using normalized comparison
  let targetDir = null;
  try {
    const entries = fs.readdirSync(phaseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirMatch = entry.name.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (!dirMatch) continue;
      const dirPhaseNum = dirMatch[1].replace(/^0+/, '') || '0';
      if (dirPhaseNum === normalized) {
        targetDir = entry.name;
        break;
      }
    }
  } catch (e) {
    return [];
  }

  if (!targetDir) {
    return [];
  }

  const plansPath = path.join(phaseDir, targetDir);
  const files = fs.readdirSync(plansPath);

  return files
    .filter(f => f.endsWith('-PLAN.md'))
    .sort();
}

// ─── Debug Flag Integration ─────────────────────────────────────────────────

/**
 * Parse CLI arguments for debug/trace flags.
 * @param {string[]} args - Arguments array (e.g., process.argv.slice(2))
 * @returns {Object} { debug: boolean, trace: boolean }
 */
function parseDebugFlags(args) {
  // args should be process.argv.slice(2) - work on it directly to remove flags
  if (!Array.isArray(args)) {
    args = (args || process.argv).slice(2);
  }
  
  const debugIdx = args.indexOf('--debug');
  const traceIdx = args.indexOf('--trace');
  
  _debugEnabled = debugIdx !== -1;
  _traceEnabled = traceIdx !== -1;
  
  // Trace enables debug too
  if (_traceEnabled) {
    _debugEnabled = true;
  }
  
  // Enable colors when debug is on
  if (_debugEnabled && !args.includes('--no-color')) {
    format.setColorMode('force');
  }
  
  // Remove flags from args
  if (traceIdx !== -1) {
    args.splice(traceIdx, 1);
  }
  if (debugIdx !== -1) {
    args.splice(debugIdx, 1);
  }
  
  return {
    debug: _debugEnabled,
    trace: _traceEnabled,
  };
}

/**
 * Check if debug mode is enabled.
 * @returns {boolean}
 */
function isDebugEnabled() {
  return _debugEnabled;
}

/**
 * Check if trace mode is enabled.
 * @returns {boolean}
 */
function isTraceEnabled() {
  return _traceEnabled;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Trace
  trace,
  traceError,
  traceStack,
  getTrace,
  clearTrace,
  
  // Context
  dumpContext,
  dumpState,
  dumpConfig,
  
  // Inspection
  inspectState,
  inspectPhase,
  inspectRoadmap,
  inspectPlans,
  
  // Flags
  parseDebugFlags,
  isDebugEnabled,
  isTraceEnabled,
};
