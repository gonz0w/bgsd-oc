/**
 * Bun Runtime Detection Module
 * 
 * Detects Bun runtime availability with session caching.
 * Uses execFileSync with array args to prevent shell injection.
 */

const { execFileSync } = require('child_process');

// Session cache for Bun detection (Map, cleared on process exit - no TTL)
const sessionCache = new Map();

/**
 * Detect if Bun runtime is available on the system
 * Detection order: bun --version first (3s timeout), fallback to which bun
 * @returns {object} - { available: boolean, name: string, version?: string, path?: string }
 */
function detectBun() {
  const cacheKey = 'bun';
  
  // Check session cache first
  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey);
  }
  
  let result = {
    available: false,
    name: 'bun'
  };
  
  // Method 1: Try bun --version first (with 3s timeout)
  try {
    const version = execFileSync('bun', ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000
    }).trim();
    
    if (version) {
      result.available = true;
      result.version = version;
      
      // Get path
      try {
        const path = execFileSync('which', ['bun'], {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        result.path = path;
      } catch {
        // PATH lookup failed, but we have version
      }
      
      sessionCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Fallback to PATH-only detection
  }
  
  // Method 2: Fallback to PATH lookup only
  try {
    const path = execFileSync('which', ['bun'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    if (path) {
      result.available = true;
      result.path = path;
    }
  } catch {
    // Not available
  }
  
  sessionCache.set(cacheKey, result);
  return result;
}

/**
 * Check if running under Bun runtime
 * @returns {object} - { isBun: boolean, version?: string }
 */
function isRunningUnderBun() {
  // Method 1: Check process.versions.bun
  if (process.versions && process.versions.bun) {
    return { isBun: true, version: process.versions.bun };
  }
  
  // Method 2: Check global Bun object
  try {
    if (typeof Bun !== 'undefined') {
      return { isBun: true, version: Bun.version };
    }
  } catch {
    // Bun not defined
  }
  
  // Method 3: Check globalThis
  try {
    if (globalThis && 'Bun' in globalThis) {
      return { isBun: true, version: globalThis.Bun?.version };
    }
  } catch {
    // globalThis not available
  }
  
  return { isBun: false };
}

/**
 * Benchmark startup time comparing Node.js vs Bun
 * @param {string} scriptPath - Path to script to benchmark
 * @param {number} runs - Number of runs (default 10)
 * @returns {object} - { node: number, bun: number, speedup: number }
 */
function benchmarkStartup(scriptPath, runs = 10) {
  const results = {
    node: [],
    bun: []
  };
  
  // Benchmark Node.js
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    try {
      execFileSync('node', [scriptPath], {
        stdio: 'pipe',
        timeout: 5000
      });
      results.node.push(Date.now() - start);
    } catch {
      // Script execution failed, skip this run
    }
  }
  
  // Benchmark Bun (if available)
  const bunStatus = detectBun();
  if (bunStatus.available) {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execFileSync('bun', [scriptPath], {
          stdio: 'pipe',
          timeout: 5000
        });
        results.bun.push(Date.now() - start);
      } catch {
        // Script execution failed, skip this run
      }
    }
  }
  
  // Calculate averages
  const avgNode = results.node.length > 0
    ? results.node.reduce((a, b) => a + b, 0) / results.node.length
    : 0;
  
  const avgBun = results.bun.length > 0
    ? results.bun.reduce((a, b) => a + b, 0) / results.bun.length
    : 0;
  
  const speedup = avgBun > 0 ? (avgNode / avgBun) : 0;
  
  return {
    node: parseFloat(avgNode.toFixed(2)),
    bun: parseFloat(avgBun.toFixed(2)),
    speedup: parseFloat(speedup.toFixed(2)),
    nodeRuns: results.node.length,
    bunRuns: results.bun.length
  };
}

/**
 * Clear the session cache
 * Useful for testing or forcing re-detection
 */
function clearCache() {
  sessionCache.clear();
}

/**
 * Get cached result without re-detecting
 * @returns {object|null} - Cached result or null
 */
function getCachedResult() {
  return sessionCache.get('bun') || null;
}

module.exports = {
  detectBun,
  isRunningUnderBun,
  benchmarkStartup,
  clearCache,
  getCachedResult
};
