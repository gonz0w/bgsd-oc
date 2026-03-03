'use strict';

const fs = require('fs');
const path = require('path');
const { checkBinary } = require('../commands/env');
const { loadConfig } = require('../lib/config');
const { debugLog } = require('../lib/output');

// ─── CLI Tool Detection ──────────────────────────────────────────────────────

/**
 * Detect CLI research tools (yt-dlp, notebooklm-py).
 * Uses config overrides for paths if set, otherwise auto-detects via checkBinary.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Tool detection results keyed by tool name
 */
function detectCliTools(cwd) {
  const config = loadConfig(cwd);

  const results = {
    'yt-dlp': { available: false, version: null, path: null, install_hint: 'pip install yt-dlp' },
    'notebooklm-py': { available: false, version: null, path: null, install_hint: 'pip install notebooklm-py' },
  };

  // yt-dlp: check config override first, then auto-detect
  if (config.ytdlp_path) {
    debugLog('research.cli', `checking configured yt-dlp path: ${config.ytdlp_path}`);
    try {
      if (fs.existsSync(config.ytdlp_path)) {
        const binary = checkBinary(config.ytdlp_path, '--version');
        results['yt-dlp'].available = binary.available;
        results['yt-dlp'].version = binary.version;
        results['yt-dlp'].path = config.ytdlp_path;
      }
    } catch {
      debugLog('research.cli', `configured yt-dlp path not accessible: ${config.ytdlp_path}`);
    }
  } else {
    const binary = checkBinary('yt-dlp', '--version');
    results['yt-dlp'].available = binary.available;
    results['yt-dlp'].version = binary.version;
    results['yt-dlp'].path = binary.path;
  }

  // notebooklm-py: check config override, then try 'notebooklm-py', then fallback to 'nlm'
  if (config.nlm_path) {
    debugLog('research.cli', `checking configured nlm path: ${config.nlm_path}`);
    try {
      if (fs.existsSync(config.nlm_path)) {
        const binary = checkBinary(config.nlm_path, '--version');
        results['notebooklm-py'].available = binary.available;
        results['notebooklm-py'].version = binary.version;
        results['notebooklm-py'].path = config.nlm_path;
      }
    } catch {
      debugLog('research.cli', `configured nlm path not accessible: ${config.nlm_path}`);
    }
  } else {
    // Try 'notebooklm-py' first
    let binary = checkBinary('notebooklm-py', '--version');
    if (binary.available) {
      results['notebooklm-py'].available = true;
      results['notebooklm-py'].version = binary.version;
      results['notebooklm-py'].path = binary.path;
    } else {
      // Fallback: try 'nlm'
      debugLog('research.cli', 'notebooklm-py not found, trying nlm');
      binary = checkBinary('nlm', '--version');
      if (binary.available) {
        results['notebooklm-py'].available = true;
        results['notebooklm-py'].version = binary.version;
        results['notebooklm-py'].path = binary.path;
      }
    }
  }

  return results;
}

// ─── MCP Server Detection ────────────────────────────────────────────────────

/**
 * Known MCP research server patterns for keyword matching.
 * Case-insensitive matching on server name keys.
 */
const MCP_RESEARCH_SERVERS = [
  { id: 'brave-search', keywords: ['brave'] },
  { id: 'context7',     keywords: ['context7'] },
  { id: 'exa',          keywords: ['exa'] },
];

/**
 * Detect configured MCP research servers by reading the editor's MCP config file.
 * Does NOT probe servers at runtime — only checks configuration.
 *
 * @param {string} cwd - Project root directory
 * @returns {object} Server detection results keyed by server id, plus optional warning
 */
function detectMcpServers(cwd) {
  const config = loadConfig(cwd);

  const results = {
    'brave-search': { configured: false, enabled: false, name_match: null },
    'context7':     { configured: false, enabled: false, name_match: null },
    'exa':          { configured: false, enabled: false, name_match: null },
  };

  // Determine MCP config file path
  let mcpConfigPath = config.mcp_config_path;

  if (!mcpConfigPath) {
    // Smart defaults: try known editor config locations
    const homedir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPaths = [
      path.join(homedir, '.config', 'oc', 'opencode.json'),
      path.join(homedir, '.config', 'opencode', 'opencode.json'),
    ];

    for (const p of defaultPaths) {
      try {
        if (fs.existsSync(p)) {
          mcpConfigPath = p;
          debugLog('research.mcp', `auto-detected MCP config: ${p}`);
          break;
        }
      } catch {
        // Skip inaccessible paths
      }
    }
  }

  if (!mcpConfigPath) {
    debugLog('research.mcp', 'no MCP config file found');
    results.warning = 'MCP config not found — set mcp_config_path in config or place opencode.json in ~/.config/oc/';
    return results;
  }

  // Read and parse the config file
  let configData;
  try {
    const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
    configData = JSON.parse(raw);
  } catch (e) {
    debugLog('research.mcp', `failed to read MCP config: ${e.message}`);
    results.warning = `MCP config unreadable at ${mcpConfigPath}: ${e.message}`;
    return results;
  }

  // Extract server entries — handle both shapes:
  // Shape 1: { mcpServers: { name: {...} } }  (e.g., .mcp.json)
  // Shape 2: { mcp: { name: {...} } }          (e.g., opencode.json)
  // Shape 3: { mcp: { servers: { name: {...} } } }
  let servers = null;

  if (configData.mcpServers && typeof configData.mcpServers === 'object') {
    servers = configData.mcpServers;
  } else if (configData.mcp && typeof configData.mcp === 'object') {
    if (configData.mcp.servers && typeof configData.mcp.servers === 'object') {
      servers = configData.mcp.servers;
    } else {
      // mcp directly contains server entries (opencode.json pattern)
      // Filter out non-object values that might be config flags
      servers = {};
      for (const [key, val] of Object.entries(configData.mcp)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          servers[key] = val;
        }
      }
    }
  }

  if (!servers || Object.keys(servers).length === 0) {
    debugLog('research.mcp', 'no mcpServers found in config');
    results.warning = `No MCP servers found in ${mcpConfigPath}`;
    return results;
  }

  // Match server names against research server keywords
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    const nameLower = serverName.toLowerCase();

    for (const research of MCP_RESEARCH_SERVERS) {
      const matched = research.keywords.some(kw => nameLower.includes(kw));
      if (matched) {
        results[research.id].configured = true;
        results[research.id].name_match = serverName;

        // Check for disabled flag
        if (serverConfig && serverConfig.disabled === true) {
          results[research.id].enabled = false;
        } else {
          results[research.id].enabled = true;
        }

        debugLog('research.mcp', `matched ${serverName} → ${research.id} (enabled: ${results[research.id].enabled})`);
        break; // One match per server entry
      }
    }
  }

  return results;
}

module.exports = { detectCliTools, detectMcpServers };
