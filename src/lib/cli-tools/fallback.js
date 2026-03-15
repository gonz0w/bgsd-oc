/**
 * CLI Tool Fallback Wrapper Module
 * 
 * Provides graceful fallback from CLI tools to Node.js implementations.
 * Enables operations to gracefully degrade when CLI tools are unavailable.
 */

const { detectTool } = require('./detector.js');
const { getInstallGuidance } = require('./install-guidance.js');
const { loadConfig } = require('../config');

/**
 * Check if a tool is enabled in config AND available on the system.
 * If config explicitly sets tools_<name> to false, returns false regardless of detection.
 * Falls through to detectTool() when config is not set or doesn't exist.
 * 
 * @param {string} toolName - Name of the tool (e.g., 'ripgrep', 'fd', 'jq')
 * @returns {boolean} - True if tool is enabled in config and available on system
 */
function isToolEnabled(toolName) {
  try {
    const config = loadConfig(process.cwd());
    const configKey = `tools_${toolName}`;
    if (config[configKey] === false) {
      return false;
    }
  } catch {
    // Config may not exist (no .planning/ directory) — fall through to detection
  }
  // Config doesn't explicitly disable it — check actual detection
  const toolResult = detectTool(toolName);
  return toolResult.available;
}

function withToolFallback(toolName, cliFn, nodeJsFallback) {
  // Check config toggle first — if explicitly disabled, skip to fallback
  const enabled = isToolEnabled(toolName);
  
  // Check if tool is available (also respects config via isToolEnabled)
  if (enabled) {
    try {
      const result = cliFn();
      return {
        success: true,
        usedFallback: false,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        usedFallback: false,
        error: error.message || String(error)
      };
    }
  }
  
  // Tool not available, use Node.js fallback
  try {
    const guidance = getInstallGuidance(toolName);
    const result = nodeJsFallback();
    
    return {
      success: true,
      usedFallback: true,
      guidance: guidance ? {
        name: guidance.name,
        description: guidance.description,
        installCommand: guidance.installCommand,
        installInstructions: guidance.installInstructions
      } : null,
      result: result
    };
  } catch (error) {
    const guidance = getInstallGuidance(toolName);
    return {
      success: false,
      usedFallback: true,
      guidance: guidance ? {
        name: guidance.name,
        description: guidance.description,
        installCommand: guidance.installCommand,
        installInstructions: guidance.installInstructions
      } : null,
      error: error.message || String(error)
    };
  }
}

/**
 * Check if a tool is available without executing any operation
 * @param {string} toolName - Name of the tool to check
 * @returns {boolean} - True if tool is available
 */
function isToolAvailable(toolName) {
  const result = detectTool(toolName);
  return result.available;
}

/**
 * Get guidance for a tool without executing any operation
 * @param {string} toolName - Name of the tool
 * @returns {object|null} - Guidance object or null if tool not found
 */
function getToolGuidance(toolName) {
  return getInstallGuidance(toolName);
}

module.exports = {
  withToolFallback,
  isToolAvailable,
  isToolEnabled,
  getToolGuidance
};
