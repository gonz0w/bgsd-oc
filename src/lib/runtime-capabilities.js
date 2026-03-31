/**
 * Runtime capability detection for compile-cache support.
 *
 * Provides compile-cache (V8 code cache) detection to enable faster CLI
 * startup on repeated invocations. Uses graceful fallback for unsupported
 * runtimes.
 *
 * Usage:
 *   const { detectCompileCacheSupport } = require('./lib/runtime-capabilities');
 *   const { supported, reason } = detectCompileCacheSupport();
 *
 * Environment controls:
 *   BGSD_COMPILE_CACHE=1 - Enable compile-cache (if supported)
 *   BGSD_COMPILE_CACHE=0 - Explicitly disable
 *   Default: disabled (for safety, matches RUNT-03 fallback requirement)
 */

const os = require('os');
const { isDebugEnabled, writeDebugDiagnostic } = require('./output');

let _compileCacheEnvMemo = null;

function readCompileCacheEnvState() {
  const rawValue = process.env.BGSD_COMPILE_CACHE;
  if (_compileCacheEnvMemo && _compileCacheEnvMemo.rawValue === rawValue) {
    return _compileCacheEnvMemo;
  }

  let state;
  if (rawValue === undefined) {
    state = { rawValue, enabled: false, source: 'default', invalid: false, warned: false };
  } else if (rawValue === '1' || rawValue === 'true') {
    state = { rawValue, enabled: true, source: 'env', invalid: false, warned: false };
  } else if (rawValue === '0' || rawValue === 'false') {
    state = { rawValue, enabled: false, source: 'env', invalid: false, warned: false };
  } else {
    state = { rawValue, enabled: false, source: 'env-invalid', invalid: true, warned: false };
  }

  _compileCacheEnvMemo = state;
  return state;
}

function emitInvalidCompileCacheWarning(envValue) {
  writeDebugDiagnostic(
    '[runtime-capabilities]',
    `Invalid BGSD_COMPILE_CACHE value: ${envValue}. Expected 0, 1, true, or false.`,
    { allowVerbose: true }
  );
}

/**
 * Parse Node.js version string into comparable parts.
 * @param {string} version - Node.js version (e.g., "v25.7.0")
 * @returns {object} - { major, minor, patch }
 */
function parseNodeVersion(version) {
  const match = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Detect if the current runtime supports V8 compile-cache.
 *
 * Compile-cache (--experimental-code-cache) was introduced in Node 10.4.0.
 * In Node 22+, it's enabled by default in certain conditions, but we still
 * check for flag support to ensure graceful fallback.
 *
 * @returns {object} - { supported: boolean, reason: string }
 *   supported: true if compile-cache can be enabled
 *   reason: Human-readable explanation of support status
 */
function detectCompileCacheSupport() {
  const version = parseNodeVersion(process.version);

  // Node 10.0.0+ required for --experimental-code-cache flag
  if (version.major < 10) {
    return {
      supported: false,
      reason: `Node.js ${process.version} is too old. Compile-cache requires Node 10.4.0+.`,
    };
  }

  // Node 10.4.0+ has the --experimental-code-cache flag
  if (version.major === 10 && version.minor < 4) {
    return {
      supported: false,
      reason: `Node.js ${process.version} predates compile-cache flag. Requires Node 10.4.0+.`,
    };
  }

  // Node 22+ has compile-cache enabled by default, but flag still works
  if (version.major >= 22) {
    return {
      supported: true,
      reason: `Node.js ${process.version} supports compile-cache (enabled by default in 22+).`,
    };
  }

  // Node 10.4+ to 21.x
  return {
    supported: true,
    reason: `Node.js ${process.version} supports --experimental-code-cache flag.`,
  };
}

/**
 * Check if compile-cache is enabled via environment variable.
 *
 * @returns {object} - { enabled: boolean, source: string }
 *   enabled: true if compile-cache should be used
 *   source: Where the setting came from ("env", "config", "default")
 */
function isCompileCacheEnabled() {
  const envState = readCompileCacheEnvState();
  if (envState.source === 'env') {
    return { enabled: envState.enabled, source: envState.source };
  }
  if (envState.source === 'env-invalid') {
    if (!envState.warned) {
      emitInvalidCompileCacheWarning(envState.rawValue);
      envState.warned = true;
    }
    return { enabled: false, source: 'env-invalid' };
  }

  // Default: disabled for safety (RUNT-03 requirement)
  return { enabled: false, source: 'default' };
}

/**
 * Get the compile-cache startup arguments if applicable.
 *
 * Checks both runtime support and user preference, returns the appropriate
 * Node.js flag to enable compile-cache.
 *
 * @returns {object} - { useCache: boolean, args: string[], reason: string }
 *   useCache: true if compile-cache should be active
 *   args: Array of CLI arguments to prepend (empty if not using cache)
 *   reason: Explanation of decision
 */
function getCompileCacheArgs() {
  const { supported, reason: supportReason } = detectCompileCacheSupport();
  const { enabled, source } = isCompileCacheEnabled();

  // Case 1: User explicitly disabled
  if (source === 'env' && !enabled) {
    return {
      useCache: false,
      args: [],
      reason: 'BGSD_COMPILE_CACHE=0 - explicitly disabled by user',
    };
  }

  // Case 2: User enabled, but runtime doesn't support
  if (enabled && !supported) {
    return {
      useCache: false,
      args: [],
      reason: `BGSD_COMPILE_CACHE=1 but unsupported: ${supportReason}`,
    };
  }

  // Case 3: User enabled and runtime supports
  if (enabled && supported) {
    return {
      useCache: true,
      args: ['--experimental-code-cache'],
      reason: `BGSD_COMPILE_CACHE=1 enabled, runtime supports: ${supportReason}`,
    };
  }

  // Case 4: Default (disabled) - no cache args
  return {
    useCache: false,
    args: [],
    reason: source === 'env-invalid'
      ? 'Invalid BGSD_COMPILE_CACHE value - compile-cache stays disabled until set to 0, 1, true, or false'
      : 'Default: compile-cache disabled for safety (RUNT-03 fallback)',
  };
}

/**
 * Emit a startup diagnostic message if compile-cache is relevant.
 *
 * Called during CLI initialization to provide visibility into
 * compile-cache decisions.
 *
 * @param {object} options - Diagnostic options
 * @param {boolean} options.verbose - Whether to show info messages (default: false)
 */
function diagnoseCompileCache(options = {}) {
  const verbose = options.verbose || isDebugEnabled({ allowVerbose: true });
  const { supported, reason: supportReason } = detectCompileCacheSupport();
  const { enabled, source } = isCompileCacheEnabled();
  const { useCache, args, reason } = getCompileCacheArgs();

  if (verbose) {
    writeDebugDiagnostic('[runtime-capabilities]', 'Compile-cache diagnostics:', { allowVerbose: true });
    writeDebugDiagnostic('[runtime-capabilities]', `  Runtime support: ${supported ? 'YES' : 'NO'} - ${supportReason}`, { allowVerbose: true });
    writeDebugDiagnostic('[runtime-capabilities]', `  User setting: ${source} - ${enabled ? 'enabled' : 'disabled'}`, { allowVerbose: true });
    writeDebugDiagnostic('[runtime-capabilities]', `  Active: ${useCache ? 'YES' : 'NO'} - ${reason}`, { allowVerbose: true });
  }

  return {
    runtimeSupported: supported,
    userEnabled: enabled,
    settingSource: source,
    useCache,
    args,
    reason,
  };
}

module.exports = {
  detectCompileCacheSupport,
  isCompileCacheEnabled,
  getCompileCacheArgs,
  diagnoseCompileCache,
};
