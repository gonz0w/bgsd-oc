/**
 * CLI Tool Detection Module
 * 
 * Detects availability of CLI tools (ripgrep, fd, jq, yq, bat, gh) with 5-minute caching.
 * Uses execFileSync with array args to prevent shell injection.
 */

const { execFileSync } = require('child_process');

// Cache for tool detection results
const toolCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Supported tools configuration
 */
const TOOLS = {
  ripgrep: {
    name: 'ripgrep',
    aliases: ['rg'],
    description: 'Ultra-fast grep alternative that respects .gitignore'
  },
  fd: {
    name: 'fd',
    aliases: ['fd-find'],
    description: 'Fast find alternative that respects .gitignore'
  },
  jq: {
    name: 'jq',
    aliases: [],
    description: 'Lightweight JSON processor'
  },
  yq: {
    name: 'yq',
    aliases: [],
    description: 'YAML processor'
  },
  bat: {
    name: 'bat',
    aliases: [],
    description: 'Syntax-highlighted cat alternative'
  },
  gh: {
    name: 'gh',
    aliases: [],
    description: 'GitHub CLI'
  }
};

/**
 * Check if a cached result is still valid
 * @param {object} cached - Cached result object
 * @returns {boolean} - True if cache is valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return (Date.now() - cached.timestamp) < CACHE_TTL_MS;
}

/**
 * Detect if a tool is available on the system
 * @param {string} toolName - Tool name or alias to detect
 * @returns {object} - { available: boolean, path?: string, name: string, version?: string }
 */
function detectTool(toolName) {
  // Normalize tool name
  const normalizedName = toolName.toLowerCase();
  
  // Check cache first
  const cacheKey = normalizedName;
  if (toolCache.has(cacheKey)) {
    const cached = toolCache.get(cacheKey);
    if (isCacheValid(cached)) {
      return cached.result;
    }
  }

  // Find tool config
  let toolConfig = null;
  let primaryName = normalizedName;
  
  for (const [key, config] of Object.entries(TOOLS)) {
    if (key === normalizedName || config.aliases.includes(normalizedName)) {
      toolConfig = config;
      primaryName = key;
      break;
    }
  }

  if (!toolConfig) {
    // Unknown tool - don't cache, return unavailable
    return {
      available: false,
      name: toolName,
      error: 'Unknown tool'
    };
  }

  // Try primary name and aliases
  const namesToTry = [toolConfig.name, ...toolConfig.aliases];
  let result = {
    available: false,
    name: primaryName,
    description: toolConfig.description
  };

  for (const binaryName of namesToTry) {
    try {
      // Use execFileSync with array args to prevent shell injection
      const path = execFileSync('which', [binaryName], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (path) {
        result.available = true;
        result.path = path;
        
        // Try to get version
        try {
          const version = execFileSync(binaryName, ['--version'], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 3000
          }).trim().split('\n')[0];
          result.version = version;
        } catch {
          // Version detection failed, that's okay
        }
        
        break;
      }
    } catch {
      // Tool not found, try next name
      continue;
    }
  }

  // Cache the result
  toolCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });

  return result;
}

/**
 * Get status for all supported tools
 * @returns {object} - { toolName: { available, path, name, description, version? } }
 */
function getToolStatus() {
  const status = {};
  
  for (const toolName of Object.keys(TOOLS)) {
    const result = detectTool(toolName);
    status[toolName] = {
      available: result.available,
      path: result.path || null,
      name: result.name,
      description: TOOLS[toolName].description,
      version: result.version || null
    };
  }
  
  return status;
}

/**
 * Clear the tool detection cache
 * Useful for testing or forcing re-detection
 */
function clearCache() {
  toolCache.clear();
}

module.exports = {
  TOOLS,
  detectTool,
  getToolStatus,
  clearCache
};
