'use strict';

const { diagnoseParity } = require('../adapters/discovery.js');

/**
 * Normalize a flag value to a boolean or null.
 * @param {string|boolean|undefined} value 
 * @returns {boolean|null}
 */
function normalizeFlag(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  const enabledValues = new Set(['1', 'true', 'yes', 'on']);
  const disabledValues = new Set(['0', 'false', 'no', 'off']);

  if (enabledValues.has(normalized)) {
    return true;
  }
  if (disabledValues.has(normalized)) {
    return false;
  }
  return null;
}

/**
 * Parse Node version to get major and minor.
 * @param {string} version - Node version string (e.g., 'v22.5.0')
 * @returns {number[]}
 */
function parseNodeVersion(version) {
  return version.slice(1).split('.').map(n => parseInt(n, 10));
}

/**
 * Check compile-cache capability.
 * @param {object} options - Options including env overrides
 * @returns {object} - Parity check result
 */
function checkCompileCache(options = {}) {
  const env = options.env || process.env;
  const compileCacheEnabled = normalizeFlag(env.BGSD_COMPILE_CACHE);
  
  // Detect Node version capability (Node 10.4+)
  const nodeVersion = parseNodeVersion(process.version);
  const major = nodeVersion[0] || 0;
  const minor = nodeVersion[1] || 0;
  
  const supportsCompileCache = major > 10 || (major === 10 && minor >= 4);
  
  // Check if we can actually use compile cache
  const canUse = compileCacheEnabled !== false && supportsCompileCache;
  
  return {
    optimization: 'compile_cache',
    match: true, // compile-cache is always "in parity" since it's a capability detection
    details: {
      enabled: compileCacheEnabled,
      nodeVersion: process.version,
      supportsCompileCache,
      canUse,
    },
    onlyLegacy: [],
    onlyOptimized: [],
  };
}

/**
 * Check sqlite statement cache capability.
 * @param {object} options - Options including env overrides
 * @returns {object} - Parity check result
 */
function checkSqliteCache(options = {}) {
  const env = options.env || process.env;
  const sqliteCacheEnabled = normalizeFlag(env.BGSD_SQLITE_STATEMENT_CACHE);
  
  // Detect Node version capability (node:sqlite available in v22.5+)
  const nodeVersion = parseNodeVersion(process.version);
  const major = nodeVersion[0] || 0;
  const minor = nodeVersion[1] || 0;
  
  const supportsSqlite = major > 22 || (major === 22 && minor >= 5);
  
  // Auto-enable if supported and not explicitly disabled
  const shouldEnable = sqliteCacheEnabled !== false && supportsSqlite;
  
  return {
    optimization: 'sqlite_cache',
    match: true,
    details: {
      enabled: sqliteCacheEnabled,
      nodeVersion: process.version,
      supportsSqlite,
      shouldEnable,
    },
    onlyLegacy: [],
    onlyOptimized: [],
  };
}

/**
 * Check valibot validation engine status.
 * @param {object} options - Options including env overrides
 * @returns {object} - Parity check result
 */
function checkValibotParity(options = {}) {
  const env = options.env || process.env;
  const valibotFlag = normalizeFlag(env.BGSD_DEP_VALIBOT);
  const valibotEnabled = valibotFlag !== false;

  return {
    optimization: 'valibot',
    match: true,
    details: {
      valibotEnabled,
      activeEngine: 'valibot',
    },
    onlyLegacy: [],
    onlyOptimized: [],
  };
}

/**
 * Check discovery parity using the diagnoseParity function from discovery.js
 * @param {object} options - Options including cwd
 * @returns {object} - Parity check result
 */
function checkDiscoveryParity(options = {}) {
  const cwd = options.cwd || process.cwd();
  
  // Known build artifacts that may differ between legacy and optimized
  const knownDiffs = new Set([
    'build-output.txt',
    'test-results.txt',
    '.tsbuildinfo',
    'tsconfig.tsbuildinfo',
  ]);
  
  try {
    const diagnosis = diagnoseParity(cwd);
    
    // Filter out known differences
    const relevantOnlyLegacy = diagnosis.walkFiles.onlyLegacy.filter(f => !knownDiffs.has(f));
    const relevantOnlyOptimized = diagnosis.walkFiles.onlyOptimized.filter(f => !knownDiffs.has(f));
    
    const relevantMatch = relevantOnlyLegacy.length === 0 && relevantOnlyOptimized.length === 0;
    
    return {
      optimization: 'discovery',
      match: relevantMatch,
      details: {
        sourceDirs: {
          match: diagnosis.sourceDirs.match,
          legacy: diagnosis.sourceDirs.legacy,
          optimized: diagnosis.sourceDirs.optimized,
        },
        walkFiles: {
          match: diagnosis.walkFiles.match,
          legacyCount: diagnosis.walkFiles.legacy.length,
          optimizedCount: diagnosis.walkFiles.optimized.length,
        },
        relevantOnlyLegacy,
        relevantOnlyOptimized,
      },
      onlyLegacy: diagnosis.walkFiles.onlyLegacy,
      onlyOptimized: diagnosis.walkFiles.onlyOptimized,
    };
  } catch (e) {
    return {
      optimization: 'discovery',
      match: false,
      details: {
        error: e.message,
      },
      onlyLegacy: [],
      onlyOptimized: [],
    };
  }
}

/**
 * Generalized parity check for dependency-backed optimizations.
 * @param {string} optimizationName - Name of the optimization: 'valibot', 'discovery', 'compile_cache', 'sqlite_cache'
 * @param {object} options - Options for the check
 * @returns {Promise<object>} - Parity check result
 */
async function checkParity(optimizationName, options = {}) {
  const supported = ['valibot', 'discovery', 'compile_cache', 'sqlite_cache'];
  
  if (!supported.includes(optimizationName)) {
    return {
      optimization: optimizationName,
      match: null,
      details: {
        error: `Unsupported optimization: ${optimizationName}. Supported: ${supported.join(', ')}`,
      },
      onlyLegacy: [],
      onlyOptimized: [],
    };
  }

  switch (optimizationName) {
    case 'valibot':
      return checkValibotParity(options);
    case 'discovery':
      return checkDiscoveryParity(options);
    case 'compile_cache':
      return checkCompileCache(options);
    case 'sqlite_cache':
      return checkSqliteCache(options);
    default:
      return {
        optimization: optimizationName,
        match: null,
        details: { error: 'Unreachable' },
        onlyLegacy: [],
        onlyOptimized: [],
      };
  }
}

/**
 * Check all optimizations and return results.
 * @param {object} options - Options for each check
 * @returns {Promise<object[]>} - Array of parity check results
 */
async function checkAllParity(options = {}) {
  const optimizations = ['valibot', 'discovery', 'compile_cache', 'sqlite_cache'];
  const results = [];

  for (const opt of optimizations) {
    const result = await checkParity(opt, options);
    results.push(result);
  }

  return results;
}

module.exports = {
  checkParity,
  checkAllParity,
  checkValibotParity,
  checkDiscoveryParity,
  checkCompileCache,
  checkSqliteCache,
  normalizeFlag,
};
