/**
 * commandDiscovery.js - Command discoverability with autocomplete hints
 * Part of Phase 97: UX Polish - Task 2
 * 
 * Provides command suggestions, aliases, and fuzzy matching.
 */

const COMMAND_ALIASES = {
  'p': 'plan',
  'p:p': 'plan:phase',
  'p:r': 'plan:roadmap',
  'p:ph': 'plan:phases',
  'p:m': 'plan:milestone',
  'e': 'execute',
  'e:p': 'execute:phase',
  'e:q': 'execute:quick',
  'e:c': 'execute:commit',
  'v': 'verify',
  'v:s': 'verify:state',
  'v:r': 'verify:review',
  'u': 'util',
  'u:c': 'util:config-get',
  'u:cs': 'util:config-set',
  'u:h': 'util:history-digest',
  'u:p': 'util:progress',
  'i': 'init',
  'i:n': 'init:new-project',
  'i:e': 'init:execute-phase'
};

const COMMAND_CATEGORIES = {
  workflow: {
    name: 'Workflow',
    commands: ['init:new-project', 'init:execute-phase', 'init:plan-phase', 'plan:phase', 'execute:phase', 'verify:state']
  },
  planning: {
    name: 'Planning',
    commands: ['plan:roadmap', 'plan:phases', 'plan:milestone', 'plan:requirements', 'plan:intent']
  },
  analysis: {
    name: 'Analysis',
    commands: ['util:codebase', 'util:progress', 'util:velocity', 'verify:review']
  },
  utility: {
    name: 'Utility',
    commands: ['util:config-get', 'util:config-set', 'util:env', 'util:memory', 'util:cache']
  },
  research: {
    name: 'Research',
    commands: ['research:capabilities', 'research:collect', 'research:yt-search', 'research:nlm-create']
  }
};

/**
 * Get autocomplete hints for partial input
 * @param {string} partial - Partial command input
 */
function getAutocompleteHints(partial) {
  const hints = [];
  const input = partial.toLowerCase().trim();
  
  if (!input) {
    // Return categorized commands when no input
    return {
      categories: COMMAND_CATEGORIES,
      message: 'Type a command to get suggestions'
    };
  }
  
  // Check aliases first
  if (COMMAND_ALIASES[input]) {
    hints.push({
      command: COMMAND_ALIASES[input],
      type: 'alias',
      original: input
    });
  }
  
  // Get all known commands from constants
  const knownCommands = getAllCommands();
  
  // Exact match
  const exactMatch = knownCommands.find(c => c.toLowerCase() === input);
  if (exactMatch) {
    hints.push({ command: exactMatch, type: 'exact' });
  }
  
  // Prefix match (e.g., "plan" matches "plan:phase")
  const prefixMatches = knownCommands.filter(c => 
    c.toLowerCase().startsWith(input) && c.toLowerCase() !== input
  );
  prefixMatches.forEach(cmd => {
    hints.push({ command: cmd, type: 'prefix' });
  });
  
  // Contains match (e.g., "phase" matches "plan:phase")
  const containsMatches = knownCommands.filter(c =>
    c.toLowerCase().includes(input) && !hints.find(h => h.command === c)
  );
  containsMatches.forEach(cmd => {
    hints.push({ command: cmd, type: 'contains' });
  });
  
  return {
    input: partial,
    hints: hints.slice(0, 10),
    message: hints.length > 0 
      ? `Found ${hints.length} command(s) matching "${partial}"`
      : `No commands found matching "${partial}"`
  };
}

/**
 * Get command aliases map
 */
function getCommandAliases() {
  return COMMAND_ALIASES;
}

/**
 * Expand alias to full command
 * @param {string} input - Potential alias
 */
function expandAlias(input) {
  return COMMAND_ALIASES[input.toLowerCase()] || input;
}

/**
 * Find similar commands using Levenshtein distance
 * @param {string} input - Input to match against
 * @param {number} threshold - Maximum distance for fuzzy match
 */
function getSimilarCommands(input, threshold = 2) {
  const knownCommands = getAllCommands();
  const results = [];
  
  knownCommands.forEach(cmd => {
    const distance = levenshteinDistance(input.toLowerCase(), cmd.toLowerCase());
    if (distance > 0 && distance <= threshold) {
      results.push({
        command: cmd,
        distance,
        suggestion: `Did you mean: ${cmd}?`
      });
    }
  });
  
  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Get commands grouped by category
 */
function getCommandCategories() {
  return COMMAND_CATEGORIES;
}

/**
 * Get all known commands (from COMMAND_HELP keys)
 */
function getAllCommands() {
  try {
    const { COMMAND_HELP } = require('./constants');
    return Object.keys(COMMAND_HELP).sort();
  } catch (e) {
    // Fallback to hardcoded list
    return [
      'init:execute-phase', 'init:plan-phase', 'init:new-project', 'init:new-milestone',
      'init:quick', 'init:resume', 'init:verify-work', 'init:phase-op', 'init:milestone-op',
      'plan:intent', 'plan:requirements', 'plan:roadmap', 'plan:phases', 'plan:find-phase',
      'plan:milestone', 'plan:phase',
      'execute:commit', 'execute:rollback-info', 'execute:session-diff', 'execute:session-summary',
      'execute:velocity', 'execute:worktree', 'execute:tdd', 'execute:test-run', 'execute:trajectory',
      'verify:state', 'verify:verify', 'verify:assertions', 'verify:search-decisions', 'verify:search-lessons',
      'verify:review', 'verify:context-budget', 'verify:token-budget',
      'util:config-get', 'util:config-set', 'util:env', 'util:current-timestamp', 'util:list-todos',
      'util:todo', 'util:memory', 'util:mcp', 'util:classify', 'util:frontmatter', 'util:progress',
      'util:websearch', 'util:history-digest', 'util:trace-requirement', 'util:codebase', 'util:cache',
      'util:agent', 'util:git',
      'research:capabilities', 'research:collect', 'research:yt-search', 'research:yt-transcript',
      'research:nlm-create', 'research:nlm-add-source', 'research:nlm-ask', 'research:nlm-report'
    ];
  }
}

/**
 * Generate manifest.json structure for command metadata
 */
function generateCommandManifest() {
  const commands = getAllCommands();
  const manifest = {
    version: '1.0',
    generated: new Date().toISOString(),
    commands: {}
  };
  
  commands.forEach(cmd => {
    const [namespace, command] = cmd.split(':');
    manifest.commands[cmd] = {
      namespace,
      command,
      category: getCategoryForCommand(cmd),
      aliases: Object.entries(COMMAND_ALIASES)
        .filter(([alias, full]) => full === cmd)
        .map(([alias]) => alias),
      autocomplete_hint: cmd,
      related_commands: getRelatedCommands(cmd)
    };
  });
  
  return manifest;
}

/**
 * Get category for a command
 */
function getCategoryForCommand(cmd) {
  for (const [key, cat] of Object.entries(COMMAND_CATEGORIES)) {
    if (cat.commands.includes(cmd)) {
      return key;
    }
  }
  return 'utility';
}

/**
 * Get related commands for a given command
 */
function getRelatedCommands(cmd) {
  const relationships = {
    'plan:phase': ['execute:phase', 'verify:state'],
    'execute:phase': ['verify:state', 'plan:phase'],
    'verify:state': ['verify:review', 'execute:phase'],
    'plan:roadmap': ['plan:phase', 'plan:milestone'],
    'util:codebase': ['util:context', 'util:progress'],
    'init:new-project': ['plan:requirements', 'plan:roadmap']
  };
  
  return relationships[cmd] || [];
}

module.exports = {
  getAutocompleteHints,
  getCommandAliases,
  expandAlias,
  getSimilarCommands,
  getCommandCategories,
  generateCommandManifest,
  getAllCommands
};
