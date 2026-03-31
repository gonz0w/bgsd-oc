'use strict';

const { getToolStatus, TOOLS } = require('../lib/cli-tools/detector');
const { getInstallCommand, getInstallGuidance } = require('../lib/cli-tools/install-guidance');
const { transformJson } = require('../lib/cli-tools/jq');
const { output } = require('../lib/output');

/**
 * CLI command to check tool availability
 * Shows which CLI tools are available vs unavailable
 */
function cmdToolsStatus(cwd, raw) {
  const status = getToolStatus();
  
  // Separate available and unavailable tools
  const available = [];
  const unavailable = [];
  
  for (const [toolName, toolInfo] of Object.entries(status)) {
    if (toolInfo.available) {
      available.push({ name: toolName, ...toolInfo });
    } else {
      unavailable.push({ name: toolName, ...toolInfo });
    }
  }
  
  // Format output for display
  const lines = [];
  lines.push('=== CLI Tool Status ===');
  lines.push('');
  
  if (available.length > 0) {
    lines.push('Available:');
    for (const tool of available) {
      const version = tool.version ? ` (${tool.version.split('\n')[0]})` : '';
      lines.push(`  ✓ ${tool.name.padEnd(8)} ${tool.path || '-'.padEnd(20)} ${tool.description}${version}`);
    }
    lines.push('');
  }
  
  if (unavailable.length > 0) {
    lines.push('Unavailable:');
    for (const tool of unavailable) {
      const guidance = getInstallGuidance(tool.name);
      const installCmd = guidance ? guidance.installCommand : 'N/A';
      lines.push(`  ✗ ${tool.name.padEnd(8)} -`.padEnd(30) + ` ${tool.description}`);
      lines.push(`                 Install: ${installCmd}`);
    }
  }
  
  // Use jq to extract available tool names as a summary (with JS fallback)
  const statusArray = [...available, ...unavailable].map(t => ({ name: t.name, available: t.available }));
  let availableSummary;
  const jqResult = transformJson(statusArray, '[.[] | select(.available == true) | .name]', { compact: true });
  if (jqResult.success) {
    try { availableSummary = JSON.parse(jqResult.result); } catch { availableSummary = available.map(t => t.name); }
  } else {
    availableSummary = available.map(t => t.name);
  }

  const result = {
    available: available.map(t => ({ name: t.name, path: t.path, version: t.version })),
    unavailable: unavailable.map(t => ({ name: t.name, installCommand: getInstallGuidance(t.name)?.installCommand })),
    summary: {
      total: Object.keys(status).length,
      availableCount: available.length,
      unavailableCount: unavailable.length,
      available_summary: availableSummary
    }
  };
  
  // Output formatted or raw
  if (raw) {
    output(result, raw);
  } else {
    console.log(lines.join('\n'));
  }
}

/**
 * Detect available tools and output as flat JSON array
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - Output raw JSON (flag not used, always outputs JSON)
 */
function cmdDetectTools(cwd, raw) {
  const status = getToolStatus();
  const result = Object.entries(status).map(([key, info]) => ({
    name: info.name,
    cmd: TOOLS[key]?.aliases?.[0] || key,
    available: info.available,
    ...(info.version ? { version: info.version } : {}),
    ...(info.path ? { path: info.path } : {}),
    ...(!info.available ? { install: getInstallCommand(key) } : {})
  }));
  
  output(result, raw);
}

/**
 * Pre-flight validation for GitHub CI workflow.
 * Checks gh availability (with version blocklist), then authentication.
 * Returns structured JSON for the workflow to consume before spawning the CI agent.
 *
 * Per CONTEXT.md: error-and-stop behavior — when gh is unavailable/blocked,
 * returns errors array with clear message and usable: false. No partial completion.
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} raw - Output raw JSON
 */
function cmdGhPreflight(cwd, raw) {
  const { isGhUsable, checkAuth } = require('../lib/cli-tools');

  const result = {
    usable: false,
    authenticated: false,
    version: null,
    errors: []
  };

  // Step 1: Check gh availability and version (includes blocklist check)
  const ghCheck = isGhUsable();
  if (!ghCheck.usable) {
    result.errors.push(ghCheck.message);
    output(result, raw);
    return;
  }

  result.usable = true;
  result.version = ghCheck.version;

  // Step 2: Check authentication
  try {
    const authResult = checkAuth();
    if (authResult.success && authResult.result && authResult.result.authenticated) {
      result.authenticated = true;
    } else {
      result.errors.push('Not authenticated to GitHub. Run: gh auth login');
    }
  } catch (e) {
    result.errors.push('Auth check failed: ' + (e.message || String(e)));
  }

  output(result, raw);
}

module.exports = {
  cmdToolsStatus,
  cmdDetectTools,
  cmdGhPreflight
};
