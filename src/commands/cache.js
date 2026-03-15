'use strict';

const fs = require('fs');
const path = require('path');
const { output, debugLog } = require('../lib/output');

// Lazy-loaded cache engine
let _cacheEngine = null;

function getCacheEngine() {
  if (!_cacheEngine) {
    try {
      const { CacheEngine } = require('../lib/cache');
      _cacheEngine = new CacheEngine();
    } catch (e) {
      debugLog('cache', 'failed to load CacheEngine', e);
      return null;
    }
  }
  return _cacheEngine;
}

/**
 * Discover all .planning/ files recursively.
 * Walks .planning/ directory and returns all .md files.
 */
function discoverPlanningFiles(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const files = [];
  
  if (!fs.existsSync(planningDir)) {
    return files;
  }
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath); // recurse
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      debugLog('cache', 'failed to walk directory', e);
    }
  }
  
  walk(planningDir);
  return files;
}

/**
 * Cache status command - reports backend type, entry count, hit/miss stats
 */
function cmdCacheStatus(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ 
      backend: 'unavailable', 
      count: 0, 
      hits: 0, 
      misses: 0,
      error: 'CacheEngine failed to load'
    }, raw, 'Cache unavailable');
    return;
  }
  
  const status = cacheEngine.status();
  output(status, raw, `${status.backend}: ${status.count} entries`);
}

/**
 * Cache clear command - clears all cache entries (global + project-local .cache.db)
 */
function cmdCacheClear(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ cleared: false, error: 'CacheEngine failed to load' }, raw, 'Failed to clear cache');
    return;
  }
  
  cacheEngine.clear();

  // Also clear project-local database (.planning/.cache.db)
  const planningDir = path.join(cwd, '.planning');
  if (fs.existsSync(planningDir)) {
    const dbFiles = ['.cache.db', '.cache.db-wal', '.cache.db-shm'];
    let localCleared = false;
    for (const dbFile of dbFiles) {
      const dbPath = path.join(planningDir, dbFile);
      if (fs.existsSync(dbPath)) {
        try {
          // Close the db connection first if it's open
          try {
            const { closeAll } = require('../lib/db');
            closeAll();
          } catch { /* db module may not be loaded */ }
          fs.unlinkSync(dbPath);
          localCleared = true;
        } catch (e) {
          debugLog('cache', 'failed to remove ' + dbFile, e);
        }
      }
    }
    if (localCleared) {
      debugLog('cache', 'cleared project-local .cache.db');
    }
  }

  output({ cleared: true }, raw, 'Cache cleared');
}

/**
 * Cache warm command - populates cache with file contents
 */
function cmdCacheWarm(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ warmed: 0, error: 'CacheEngine failed to load' }, raw, 'Failed to warm cache');
    return;
  }
  
  // Get file paths from args (skip 'cache' and 'warm' subcommands)
  const filePaths = args.slice(2);
  
  let resolvedPaths;
  
  // Auto-discovery: if no file paths provided, discover all .planning/ files
  if (filePaths.length === 0) {
    resolvedPaths = discoverPlanningFiles(cwd);
    
    if (resolvedPaths.length === 0) {
      output({ warmed: 0, error: 'No .planning/ files found' }, raw, 'No files to warm');
      return;
    }
  } else {
    // Resolve relative paths to absolute
    resolvedPaths = filePaths.map(p => {
      if (path.isAbsolute(p)) return p;
      return path.join(cwd, p);
    });
  }
  
  // Time the warming operation
  const start = Date.now();
  const warmed = cacheEngine.warm(resolvedPaths);
  const elapsed = Date.now() - start;
  
  output({ warmed, elapsed_ms: elapsed }, raw, `Warmed ${warmed} files in ${elapsed}ms`);
}

/**
 * Research cache stats command - reports entry count and hit/miss stats
 */
function cmdCacheResearchStats(cwd, args, raw) {
  const cacheEngine = getCacheEngine();

  if (!cacheEngine) {
    output({
      count: 0,
      hits: 0,
      misses: 0,
      error: 'CacheEngine failed to load'
    }, raw, 'Research cache unavailable');
    return;
  }

  const researchStatus = cacheEngine.statusResearch();
  output(researchStatus, raw, `research cache: ${researchStatus.count} entries, ${researchStatus.hits} hits, ${researchStatus.misses} misses`);
}

/**
 * Research cache clear command - clears all research cache entries
 */
function cmdCacheResearchClear(cwd, args, raw) {
  const cacheEngine = getCacheEngine();

  if (!cacheEngine) {
    output({ cleared: false, error: 'CacheEngine failed to load' }, raw, 'Failed to clear research cache');
    return;
  }

  cacheEngine.clearResearch();
  output({ cleared: true }, raw, 'Research cache cleared');
}

/**
 * Register cache commands with router
 * Called from router.js to add cache command handling
 */
function registerCacheCommand(router) {
  // This function is kept for API compatibility but commands are 
  // handled directly in router.js via the 'cache' case
  return router;
}

module.exports = {
  cmdCacheStatus,
  cmdCacheClear,
  cmdCacheWarm,
  cmdCacheResearchStats,
  cmdCacheResearchClear,
};
