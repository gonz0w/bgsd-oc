'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');
const { getMilestoneInfo, cachedReadFile } = require('../lib/helpers');
const { generateMilestoneSummary } = require('../lib/reports/milestone-summary');

/**
 * Format milestone summary for TTY display
 */
function formatMilestoneSummary(result) {
  if (result.error) {
    return `Error: ${result.error}`;
  }
  
  if (result.saved_to && !result.report) {
    return `Report saved to: ${result.saved_to}`;
  }
  
  return result.report || result;
}

/**
 * Milestone summary command - display or save milestone summary report
 * Usage: bgsd-tools milestone:summary [version] [--format json] [--save] [--file <path>]
 */
function cmdMilestoneSummary(cwd, args, raw) {
  // Parse arguments
  let version = null;
  let format = 'console';
  let save = false;
  let filePath = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (arg === '--save') {
      save = true;
    } else if (arg === '--file' && args[i + 1]) {
      filePath = args[++i];
    } else if (!arg.startsWith('--')) {
      version = arg;
    }
  }
  
  // Generate report
  const result = generateMilestoneSummary(version, { format, save, filePath }, cwd);
  
  if (format === 'json') {
    output(result, { raw });
  } else {
    // Force pretty mode for milestone summary (rich formatted output)
    const prevMode = global._gsdOutputMode;
    global._gsdOutputMode = 'pretty';
    output(result, { formatter: formatMilestoneSummary, rawValue: formatMilestoneSummary(result) });
    global._gsdOutputMode = prevMode;
  }
}

/**
 * Milestone info command - display current milestone info
 */
function cmdMilestoneInfo(cwd, raw) {
  const milestone = getMilestoneInfo(cwd);
  output({ milestone: milestone.version, name: milestone.name }, raw);
}

module.exports = {
  cmdMilestoneSummary,
  cmdMilestoneInfo
};
