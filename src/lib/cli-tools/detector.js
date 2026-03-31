/**
 * CLI Tool Detection Module
 * 
 * Detects availability of CLI tools (ripgrep, fd, jq, yq, ast-grep, sd, hyperfine, bat, gh) with 30-minute caching.
 * Uses execFileSync with array args to prevent shell injection.
 * Supports file-based cache (cross-invocation persistence), cross-platform PATH resolution,
 * and version comparison for feature flagging.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cache for tool detection results (in-memory)
const toolCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// File cache path override (for testing)
let cachePath = null;

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
  ast_grep: {
    name: 'ast-grep',
    aliases: ['sg'],
    description: 'Syntax-aware structural code search and rewrite'
  },
  sd: {
    name: 'sd',
    aliases: [],
    description: 'Intuitive find and replace CLI'
  },
  hyperfine: {
    name: 'hyperfine',
    aliases: [],
    description: 'Command-line benchmarking tool'
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
 * Get the default cache path
 * @returns {string} - Path to cache file
 */
function getDefaultCachePath() {
  return path.join(process.cwd(), '.planning', '.cache', 'tools.json');
}

/**
 * Set custom cache path (for testing)
 * @param {string} newPath - Custom path to use
 */
function setCachePath(newPath) {
  cachePath = newPath;
}

/**
 * Load file cache if it exists and is valid
 * @returns {object|null} - Cached results or null if invalid/missing
 */
function loadFileCache() {
  try {
    const filePath = cachePath || getDefaultCachePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const contents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(contents);
    
    // Check if cache is still valid (< 30 minutes old)
    if (!data.timestamp || (Date.now() - data.timestamp) >= CACHE_TTL_MS) {
      return null;
    }
    
    return data.results || null;
  } catch {
    // Silent failure - file I/O errors just fall back to detection
    return null;
  }
}

/**
 * Save results to file cache
 * @param {object} results - Detection results to cache
 */
function saveFileCache(results) {
  try {
    const filePath = cachePath || getDefaultCachePath();
    const dir = path.dirname(filePath);
    
    // Create cache directory if needed
    fs.mkdirSync(dir, { recursive: true });
    
    const data = {
      timestamp: Date.now(),
      results
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Silent failure - file I/O errors don't break detection
  }
}

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
 * Resolve tool path using platform-aware command
 * @param {string} binaryName - Binary name to locate
 * @returns {string|null} - Full path to binary or null if not found
 */
function resolveToolPath(binaryName) {
  try {
    const command = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = execFileSync(command, [binaryName], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    // For where.exe, take first line if multiple results
    if (process.platform === 'win32' && result) {
      return result.split('\n')[0];
    }
    
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Parse version string to extract semver
 * @param {string} versionString - Version string from --version output
 * @returns {object|null} - { major, minor, patch } or null if no version found
 */
function parseVersion(versionString) {
  if (!versionString) return null;
  
  // Try full semver first: X.Y.Z
  let match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }
  
  // Try X.Y format
  match = versionString.match(/(\d+)\.(\d+)/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: 0
    };
  }
  
  // Try X format
  match = versionString.match(/(\d+)/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: 0,
      patch: 0
    };
  }
  
  return null;
}

/**
 * Check if current version meets minimum requirement
 * @param {string} toolName - Tool name to check
 * @param {string} minVersionStr - Minimum version required (e.g., "1.7.0")
 * @returns {object} - { meets: boolean, current: string|null, required: string }
 */
function meetsMinVersion(toolName, minVersionStr) {
  const toolInfo = detectTool(toolName);
  const requiredVersion = parseVersion(minVersionStr);
  
  if (!requiredVersion) {
    return {
      meets: false,
      current: toolInfo.version || null,
      required: minVersionStr
    };
  }
  
  if (!toolInfo.available || !toolInfo.version) {
    return {
      meets: false,
      current: toolInfo.version || null,
      required: minVersionStr
    };
  }
  
  const currentVersion = parseVersion(toolInfo.version);
  if (!currentVersion) {
    return {
      meets: false,
      current: toolInfo.version || null,
      required: minVersionStr
    };
  }
  
  // Compare versions: major.minor.patch
  if (currentVersion.major > requiredVersion.major) return {
    meets: true,
    current: toolInfo.version,
    required: minVersionStr
  };
  if (currentVersion.major < requiredVersion.major) return {
    meets: false,
    current: toolInfo.version,
    required: minVersionStr
  };
  
  // Major equal, compare minor
  if (currentVersion.minor > requiredVersion.minor) return {
    meets: true,
    current: toolInfo.version,
    required: minVersionStr
  };
  if (currentVersion.minor < requiredVersion.minor) return {
    meets: false,
    current: toolInfo.version,
    required: minVersionStr
  };
  
  // Major and minor equal, compare patch
  const meets = currentVersion.patch >= requiredVersion.patch;
  return {
    meets,
    current: toolInfo.version,
    required: minVersionStr
  };
}

/**
 * Detect if a tool is available on the system
 * @param {string} toolName - Tool name or alias to detect
 * @returns {object} - { available: boolean, path?: string, name: string, version?: string }
 */
function detectTool(toolName) {
  // Normalize tool name
  const normalizedName = toolName.toLowerCase();
  
  // Check in-memory cache first
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
    const toolPath = resolveToolPath(binaryName);
    
    if (toolPath) {
      result.available = true;
      result.path = toolPath;
      
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
  }

  // Cache the result in memory
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
function detectAllTools() {
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

function refreshToolStatus() {
  const status = detectAllTools();

  // Save to file cache for next invocation
  saveFileCache(status);

  return status;
}

function getToolStatus() {
  // Try loading from file cache first
  const fileCached = loadFileCache();

  if (fileCached) {
    // Use file cache and populate in-memory cache
    for (const [toolName, toolInfo] of Object.entries(fileCached)) {
      toolCache.set(toolName.toLowerCase(), {
        result: toolInfo,
        timestamp: Date.now()
      });
    }
    return fileCached;
  }

  // Perform fresh detection
  const status = refreshToolStatus();

  return status;
}

/**
 * Clear the tool detection cache (both in-memory and file)
 * Useful for testing or forcing re-detection
 */
function clearCache() {
  toolCache.clear();
  
  try {
    const filePath = cachePath || getDefaultCachePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Silent failure - deletion errors don't break normal operation
  }
}

module.exports = {
  TOOLS,
  detectTool,
  getToolStatus,
  refreshToolStatus,
  clearCache,
  parseVersion,
  meetsMinVersion,
  resolveToolPath,
  setCachePath,
  CACHE_TTL_MS
};
