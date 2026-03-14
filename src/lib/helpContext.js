/**
 * helpContext.js - Command history tracking for contextual help
 * Part of Phase 97: UX Polish - Task 1
 * 
 * Tracks recent commands and provides contextual suggestions based on history.
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), '.planning', '.cache');
const HISTORY_FILE = path.join(CACHE_DIR, 'command-history.json');
const MAX_HISTORY = 20;
const MAX_AGE_DAYS = 7;

/**
 * Ensure cache directory exists.
 * Only creates .cache/ if .planning/ already exists — never creates .planning/ as a side effect.
 */
function ensureCacheDir() {
  const planningDir = path.join(process.cwd(), '.planning');
  if (!fs.existsSync(planningDir)) return;
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load command history from disk
 */
function loadHistory() {
  ensureCacheDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // If corrupted, start fresh
  }
  return { commands: [], lastUpdated: null };
}

/**
 * Save command history to disk
 */
function saveHistory(history) {
  ensureCacheDir();
  history.lastUpdated = new Date().toISOString();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Clean old entries from history
 */
function cleanHistory(history) {
  const now = Date.now();
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  
  history.commands = history.commands.filter(cmd => {
    const age = now - new Date(cmd.timestamp).getTime();
    return age < maxAgeMs;
  });
  
  return history;
}

/**
 * Track a command execution
 * @param {string} namespace - Command namespace (e.g., 'plan', 'execute')
 * @param {string} command - Command name (e.g., 'phase', 'verify')
 * @param {Array} args - Command arguments
 */
function trackCommand(namespace, command, args = []) {
  const history = loadHistory();
  
  const entry = {
    namespace,
    command,
    args,
    timestamp: new Date().toISOString()
  };
  
  history.commands.unshift(entry);
  
  // Keep only MAX_HISTORY entries
  if (history.commands.length > MAX_HISTORY) {
    history.commands = history.commands.slice(0, MAX_HISTORY);
  }
  
  // Clean old entries
  cleanHistory(history);
  
  saveHistory(history);
  return history;
}

/**
 * Get recent commands
 * @param {number} limit - Maximum number of commands to return
 */
function getRecentCommands(limit = 10) {
  const history = loadHistory();
  return history.commands.slice(0, limit);
}

/**
 * Get contextual suggestions based on command history
 */
function getContextualSuggestions() {
  const history = loadHistory();
  const recent = history.commands.slice(0, 10);
  
  if (recent.length === 0) {
    return { suggestions: [], message: 'No recent commands to base suggestions on.' };
  }
  
  const suggestions = [];
  
  // Suggest next steps based on workflow patterns
  const lastCommand = recent[0];
  const secondLast = recent[1];
  
  // Pattern: After "plan:phase", suggest "execute:phase"
  if (lastCommand?.command === 'phase' && lastCommand?.namespace === 'plan') {
    suggestions.push({
      suggestion: 'execute:phase',
      reason: 'Execute the plan you just created',
      basedOn: `${lastCommand.namespace}:${lastCommand.command}`
    });
  }
  
  // Pattern: After "execute:*", suggest "verify:state"
  if (lastCommand?.namespace === 'execute') {
    suggestions.push({
      suggestion: 'verify:state',
      reason: 'Verify the execution results',
      basedOn: `${lastCommand.namespace}:${lastCommand.command}`
    });
  }
  
  // Pattern: After "verify:state", suggest "verify:review"
  if (lastCommand?.command === 'state' && lastCommand?.namespace === 'verify') {
    suggestions.push({
      suggestion: 'verify:review',
      reason: 'Review the verification results',
      basedOn: `${lastCommand.namespace}:${lastCommand.command}`
    });
  }
  
  // Pattern: After "plan:roadmap", suggest "plan:phase"
  if (lastCommand?.command === 'roadmap' && lastCommand?.namespace === 'plan') {
    suggestions.push({
      suggestion: 'plan:phase',
      reason: 'Start planning a phase from the roadmap',
      basedOn: `${lastCommand.namespace}:${lastCommand.command}`
    });
  }
  
  // Group suggestions by workflow stage
  const grouped = {
    plan: suggestions.filter(s => s.suggestion.startsWith('plan:')),
    execute: suggestions.filter(s => s.suggestion.startsWith('execute:')),
    verify: suggestions.filter(s => s.suggestion.startsWith('verify:')),
    util: suggestions.filter(s => s.suggestion.startsWith('util:'))
  };
  
  return {
    suggestions,
    grouped,
    recentCommands: recent.slice(0, 5).map(c => `${c.namespace}:${c.command}`),
    message: suggestions.length > 0 
      ? `Based on your recent "${lastCommand?.namespace}:${lastCommand?.command}" command`
      : 'Keep using commands to build up history for better suggestions.'
  };
}

/**
 * Clear command history
 */
function clearHistory() {
  const history = { commands: [], lastUpdated: new Date().toISOString() };
  saveHistory(history);
  return { success: true, message: 'Command history cleared.' };
}

/**
 * Show command history with formatting
 */
function showHistory(limit = 10, format = 'text') {
  const history = getRecentCommands(limit);
  
  if (format === 'json') {
    return { commands: history, count: history.length };
  }
  
  if (history.length === 0) {
    return 'No command history yet. Start using bgsd-tools commands!';
  }
  
  const lines = ['Recent Commands:', ''];
  history.forEach((cmd, idx) => {
    const time = new Date(cmd.timestamp).toLocaleString();
    const argsStr = cmd.args?.length > 0 ? ` ${cmd.args.join(' ')}` : '';
    lines.push(`${idx + 1}. ${cmd.namespace}:${cmd.command}${argsStr} (${time})`);
  });
  
  return lines.join('\n');
}

module.exports = {
  trackCommand,
  getRecentCommands,
  getContextualSuggestions,
  clearHistory,
  showHistory,
  HISTORY_FILE,
  CACHE_DIR
};
