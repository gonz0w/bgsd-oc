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
  'i:e': 'init:execute-phase',
  'd': 'decisions',
  'd:l': 'decisions:list',
  'd:i': 'decisions:inspect',
  'd:e': 'decisions:evaluate',
  'd:s': 'decisions:savings',
  's:l': 'skills:list',
  's:i': 'skills:install',
  's:v': 'skills:validate',
  's:r': 'skills:remove',
   'w': 'workflow',
   'w:b': 'workflow:baseline',
   'w:c': 'workflow:compare',
   'w:v': 'workflow:verify-structure',
   'w:s': 'workflow:savings'
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
    commands: ['util:codebase', 'util:progress', 'util:velocity', 'verify:review', 'decisions:list', 'decisions:inspect', 'decisions:evaluate', 'decisions:savings', 'audit:scan']
  },
  utility: {
    name: 'Utility',
    commands: ['util:config-get', 'util:config-set', 'util:env', 'util:memory', 'util:cache']
  },
  research: {
    name: 'Research',
    commands: ['research:capabilities', 'research:collect', 'research:yt-search', 'research:nlm-create', 'research:score', 'research:gaps']
  },
  lessons: {
    name: 'Lessons',
    commands: ['lessons:capture', 'lessons:list', 'lessons:migrate', 'lessons:deviation-capture']
  },
  skills: {
    name: 'Skills',
    commands: ['skills:list', 'skills:install', 'skills:validate', 'skills:remove']
  },
  measurement: {
    name: 'Measurement',
    commands: ['workflow:baseline', 'workflow:compare', 'workflow:savings']
  }
};

const COMMAND_TREE = {
  'init': {
    'execute-phase': null,
    'plan-phase': null,
    'new-project': null,
    'new-milestone': null,
    'quick': null,
    'resume': null,
    'verify-work': null
  },
  'plan': {
    'intent': null,
    'requirements': null,
    'roadmap': null,
    'phases': null,
    'find-phase': null,
    'milestone': null,
    'phase': null
  },
  'execute': {
    'commit': null,
    'rollback-info': null,
    'session-diff': null,
    'session-summary': null,
    'velocity': null,
    'worktree': null,
    'tdd': null,
    'test-run': null,
    'trajectory': null
  },
  'verify': {
    'state': null,
    'verify': null,
    'assertions': null,
    'search-decisions': null,
    'search-lessons': null,
    'review': null,
    'context-budget': null,
    'token-budget': null
  },
  'util': {
    'config-get': null,
    'config-set': null,
    'env': null,
    'memory': null,
    'cache': null,
    'agent': null,
    'codebase': null
  },
  'research': {
    'capabilities': null,
    'collect': null,
    'yt-search': null,
    'yt-transcript': null,
    'nlm-create': null,
    'nlm-add-source': null,
    'nlm-ask': null,
    'nlm-report': null,
    'score': null,
    'gaps': null
  },
  'lessons': {
    'capture': null,
    'list': null,
    'migrate': null,
    'analyze': null,
    'suggest': null,
    'compact': null,
    'deviation-capture': null
  },
  'skills': {
    'list': null,
    'install': null,
    'validate': null,
    'remove': null
  },
  'workflow': {
    'baseline': null,
    'compare': null,
    'verify-structure': null,
    'savings': null
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
 * @param {Object} options - Options object
 * @param {number} [options.threshold=0.9] - Minimum confidence percentage (0-1) to suggest
 * @param {string} [options.thresholdType='high'] - 'high' (90%) or 'low' (60%) threshold
 * @returns {Array} Array of similar commands with confidence score
 */
function getSimilarCommands(input, options = {}) {
  // Support legacy threshold parameter (number) for backward compatibility
  let threshold = 0.9;
  let thresholdType = 'high';
  
  if (typeof options === 'number') {
    // Legacy: threshold as second argument (convert distance threshold to confidence)
    // Old behavior: threshold was max distance (e.g., 2)
    // New behavior: threshold is minimum confidence (e.g., 0.9 = 90%)
    threshold = 1 - (options / 10); // Convert distance 2 to 80% confidence
    thresholdType = 'low';
  } else if (typeof options === 'object' && options !== null) {
    threshold = options.threshold !== undefined ? options.threshold : 0.9;
    thresholdType = options.thresholdType || 'high';
  }
  
  // Apply threshold type adjustments
  // High threshold (90%) = only suggest when very confident
  // Low threshold (60%) = suggest with moderate confidence
  let minConfidence;
  if (thresholdType === 'high') {
    minConfidence = Math.max(90, threshold * 100); // At least 90% for high threshold
  } else {
    minConfidence = threshold * 100;
  }
  
  const knownCommands = getAllCommands();
  const results = [];
  const inputLen = input.toLowerCase().length;
  
  knownCommands.forEach(cmd => {
    const distance = levenshteinDistance(input.toLowerCase(), cmd.toLowerCase());
    const cmdLen = cmd.length;
    
    // Calculate confidence based on distance and length relationship
    // Longer commands have more room for typos, so we give more leeway
    const maxDistance = Math.max(inputLen, cmdLen);
    const confidenceRaw = Math.max(0, 1 - (distance / maxDistance));
    const confidence = Math.round(confidenceRaw * 100);
    
    // Filter by distance > 0 (don't suggest exact matches)
    // and confidence >= minConfidence
    if (distance > 0 && confidence >= minConfidence) {
      results.push({
        command: cmd,
        distance,
        confidence,
        suggestion: `Did you mean: ${cmd}?`
      });
    }
  });
  
  return results.sort((a, b) => {
    // Sort by confidence (descending), then by distance (ascending)
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.distance - b.distance;
  });
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
      'research:nlm-create', 'research:nlm-add-source', 'research:nlm-ask', 'research:nlm-report',
      'research:score', 'research:gaps'
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

/**
 * Validate that all commands in COMMAND_HELP have routing implementations
 * Returns validation result with any mismatches found
 */
function validateCommandRegistry() {
  const { COMMAND_HELP } = require('./constants');
  const commands = Object.keys(COMMAND_HELP).sort();
  
  const issues = [];
  const validCommands = [];
  
  // Router command implementations - mapping of namespace -> valid subcommands
  // This is derived from the router.js case statements
  // Includes nested subcommands
  const routerImplementations = {
    'init': ['execute-phase', 'plan-phase', 'new-project', 'new-milestone', 'quick', 'resume', 'verify-work', 'phase-op', 'todos', 'milestone-op', 'map-codebase', 'progress', 'memory'],
    'plan': {
      'intent': {
        'create': null,
        'show': null,
        'read': null,
        'update': null,
        'validate': null,
        'trace': null,
        'drift': null
      },
      'requirements': ['mark-complete'],
      'roadmap': ['get-phase', 'analyze', 'update-plan-progress'],
      'phases': null,
      'find-phase': null,
      'milestone': ['complete', 'summary', 'info'],
      'phase': null
    },
    'execute': {
      'commit': null,
      'rollback-info': null,
      'session-diff': null,
      'session-summary': null,
      'velocity': null,
      'worktree': ['create', 'list', 'remove', 'cleanup', 'merge', 'check-overlap'],
      'tdd': null,
      'test-run': null,
      'trajectory': {
        'checkpoint': null,
        'list': null,
        'pivot': null,
        'compare': null,
        'choose': null,
        'dead-ends': null
      }
    },
    'verify': {
      'state': ['update', 'get', 'patch', 'advance-plan', 'record-metric', 'update-progress', 'add-decision', 'add-blocker', 'resolve-blocker', 'record-session', 'validate'],
      'verify': null,
      'assertions': null,
      'search-decisions': null,
      'search-lessons': null,
      'review': null,
      'context-budget': null,
      'token-budget': null,
      'regression': null,
      'quality': null,
      'handoff': null,
      'agents': null,
      'summary': null,
      'validate': {
        'consistency': null,
        'health': null
      },
      'validate-config': null,
      'validate-dependencies': null
    },
    'util': {
      'config-get': null,
      'config-set': null,
      'env': ['scan', 'status'],
      'current-timestamp': null,
      'list-todos': null,
      'todo': ['complete'],
      'memory': ['write', 'read', 'list', 'ensure-dir', 'compact'],
      'mcp': ['profile'],
      'classify': {
        'plan': null,
        'phase': null
      },
      'frontmatter': ['get', 'set', 'merge', 'validate'],
      'progress': null,
      'websearch': null,
      'history-digest': null,
      'trace-requirement': null,
      'codebase': {
        'analyze': null,
        'status': null,
        'conventions': null,
        'rules': null,
        'deps': null,
        'impact': null,
        'context': null,
        'lifecycle': null,
        'ast': null,
        'exports': null,
        'complexity': null,
        'repo-map': null
      },
      'cache': ['research-stats', 'research-clear', 'status', 'clear', 'warm'],
      'agent': ['audit', 'list', 'validate-contracts'],
      'git': ['log', 'diff-summary', 'blame', 'branch-info', 'rewind', 'trajectory-branch'],
      'config-migrate': null,
      'resolve-model': null,
      'template': ['select', 'fill'],
      'generate-slug': null,
      'verify-path-exists': null,
      'config-ensure-section': null,
      'scaffold': null,
      'phase-plan-index': null,
      'state-snapshot': null,
      'summary-extract': null,
      'summary-generate': null,
      'quick-summary': null,
      'extract-sections': null,
      'validate-commands': null,
      'validate-artifacts': null,
      'settings': null,
      'parity-check': null,
      'verify-path-exists': null,
      'config-ensure-section': null,
      'scaffold': null,
      'phase-plan-index': null,
      'state-snapshot': null,
      'summary-extract': null,
      'summary-generate': null,
      'quick-summary': null,
      'extract-sections': null,
      'tools': null,
      'runtime': null,
      'recovery': null,
      'history': null,
      'examples': null,
      'analyze-deps': null,
      'estimate-scope': null,
      'test-coverage': null
    },
    'research': {
      'capabilities': null,
      'yt-search': null,
      'yt-transcript': null,
      'collect': {
        '': null,  // base collect command
        '--resume': null  // collect --resume flag variant
      },
      'nlm-create': null,
      'nlm-add-source': null,
      'nlm-ask': null,
      'nlm-report': null,
      'score': null,
      'gaps': null
    },
    'lessons': {
      'capture': null,
      'list': null,
      'migrate': null,
      'analyze': null,
      'suggest': null,
      'compact': null,
      'deviation-capture': null
    },
    'skills': {
      'list': null,
      'install': null,
      'validate': null,
      'remove': null
    },
    'audit': {
      'scan': null
    },
    'cache': ['research-stats', 'research-clear', 'status', 'clear', 'warm'],
    'decisions': {
      'list': null,
      'inspect': null,
      'evaluate': null,
      'savings': null
    },
    'profile': null
  };
  
  // Commands with space format (alternative to colon)
  const spaceFormatCommands = [
    'research capabilities', 'research collect', 'research collect --resume',
    'research nlm-add-source', 'research nlm-ask', 'research nlm-create',
    'research nlm-report', 'research yt-search', 'research yt-transcript',
    'research score', 'research gaps'
  ];
  
  // Known format differences - commands in help use combined subcommand names
  // but router handles them as separate nested subcommands
  const knownFormatDifferences = [
    'execute:trajectory choose', 'execute:trajectory compare', 
    'execute:trajectory dead-ends', 'execute:trajectory pivot',
    'plan:intent show', 'util:classify phase', 'util:classify plan',
    'util:codebase ast', 'util:codebase complexity', 'util:codebase context',
    'util:codebase exports', 'util:codebase repo-map', 'research:collect --resume',
    'verify:validate consistency', 'verify:validate health'
  ];
  
  commands.forEach(cmd => {
    // Handle known format differences - these are documented inconsistencies
    // between help text format and router implementation
    if (knownFormatDifferences.includes(cmd)) {
      validCommands.push(cmd);
      return;
    }
    
    // Handle space format commands
    if (spaceFormatCommands.includes(cmd)) {
      validCommands.push(cmd);
      return;
    }
    
    const parts = cmd.includes(':') ? cmd.split(':') : [cmd];
    const namespace = parts[0];
    
    // Standalone commands (no colon)
    if (parts.length === 1) {
      if (['research', 'profile'].includes(namespace)) {
        validCommands.push(cmd);
      } else if (routerImplementations[namespace] !== undefined) {
        validCommands.push(cmd);
      } else {
        issues.push({ command: cmd, issue: `Unknown standalone command: ${namespace}` });
      }
      return;
    }
    
    // Namespaced commands (e.g., init:execute-phase)
    const namespaceImpl = routerImplementations[namespace];
    if (!namespaceImpl) {
      issues.push({ command: cmd, issue: `Unknown namespace: ${namespace}` });
      return;
    }
    
    // Handle arrays (simple subcommand list like cache:*, or null for direct commands)
    if (Array.isArray(namespaceImpl)) {
      const subcommand = parts[1];
      if (!namespaceImpl.includes(subcommand)) {
        issues.push({ command: cmd, issue: `Unknown subcommand: ${subcommand} for namespace ${namespace}` });
        return;
      }
      validCommands.push(cmd);
      return;
    }
    
    // Handle null (no subcommands, direct command like util:settings)
    if (namespaceImpl === null) {
      validCommands.push(cmd);
      return;
    }
    
    // Handle nested subcommands (object with sub-subs like util:codebase)
    if (typeof namespaceImpl === 'object' && namespaceImpl !== null) {
      const subcommand = parts[1];
      const validSubs = namespaceImpl[subcommand];
      
      if (validSubs === undefined) {
        issues.push({ command: cmd, issue: `Unknown subcommand: ${subcommand} for namespace ${namespace}` });
        return;
      }
      
      // If there are nested subcommands, check for them
      if (validSubs !== null && parts.length > 2) {
        const subSubCommand = parts.slice(2).join(' ');
        if (!validSubs.includes(subSubCommand) && !validSubs.includes(parts[2])) {
          issues.push({ command: cmd, issue: `Unknown nested subcommand: ${subSubCommand} for ${namespace}:${subcommand}` });
          return;
        }
      }
      
      validCommands.push(cmd);
      return;
    }
    
    // Fallback
    issues.push({ command: cmd, issue: `Unhandled command format: ${cmd}` });
  });
  
  return {
    valid: issues.length === 0,
    totalCommands: commands.length,
    validCount: validCommands.length,
    issueCount: issues.length,
    issues,
    validCommands
  };
}

module.exports = {
  COMMAND_TREE,
  getAutocompleteHints,
  getCommandAliases,
  expandAlias,
  getSimilarCommands,
  getCommandCategories,
  generateCommandManifest,
  getAllCommands,
  validateCommandRegistry,
  validateArtifacts
};

/**
 * Validate planning artifacts (MILESTONES.md, PROJECT.md, etc.)
 * Checks for common structural issues that cause build/deploy problems
 */
function validateArtifacts(cwd = process.cwd()) {
  const fs = require('fs');
  const path = require('path');
  
  const errors = [];
  const warnings = [];
  
  // Check .planning directory exists
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    errors.push({ file: '.planning', issue: 'Directory does not exist' });
    return { valid: false, errors, warnings };
  }
  
  // Validate MILESTONES.md
  const milestonesPath = path.join(planningDir, 'MILESTONES.md');
  if (fs.existsSync(milestonesPath)) {
    const content = fs.readFileSync(milestonesPath, 'utf8');
    
    // Check for balanced ## headers (should be even for details/summary pairs)
    const h2Matches = content.match(/^##\s+.+$/gm) || [];
    if (h2Matches.length % 2 !== 0) {
      warnings.push({ file: 'MILESTONES.md', issue: `Unbalanced ## headers (${h2Matches.length} found) - check for missing closing headers` });
    }
    
    // Check for valid date formats (YYYY-MM-DD)
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const dates = content.match(datePattern) || [];
    for (const date of dates) {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        errors.push({ file: 'MILESTONES.md', issue: `Invalid date format: ${date}` });
      }
    }
  } else {
    warnings.push({ file: 'MILESTONES.md', issue: 'File not found' });
  }
  
  // Validate PROJECT.md
  const projectPath = path.join(planningDir, 'PROJECT.md');
  if (fs.existsSync(projectPath)) {
    const content = fs.readFileSync(projectPath, 'utf8');
    
    // Check for balanced <details> tags
    const openDetails = (content.match(/<details>/g) || []).length;
    const closeDetails = (content.match(/<\/details>/g) || []).length;
    if (openDetails !== closeDetails) {
      errors.push({ file: 'PROJECT.md', issue: `Unbalanced <details> tags: ${openDetails} open, ${closeDetails} close` });
    }
    
    // Check for strikethrough in out-of-scope section
    const outOfScopeMatch = content.match(/## Out of Scope\n([\s\S]*?)(?=\n## |\n---)/i);
    if (outOfScopeMatch) {
      const outOfScopeContent = outOfScopeMatch[1];
      if (outOfScopeContent.includes('~~')) {
        errors.push({ file: 'PROJECT.md', issue: 'Found strikethrough (~~) in out-of-scope section - use other formatting instead' });
      }
    }
    
    // Check for orphaned </details> without opening
    const orphanClose = content.match(/<\/details>/g) || [];
    if (orphanClose.length > 0 && openDetails === 0) {
      errors.push({ file: 'PROJECT.md', issue: 'Found </details> without any <details> opening tags' });
    }
  } else {
    warnings.push({ file: 'PROJECT.md', issue: 'File not found' });
  }
  
  // Validate STATE.md exists
  const statePath = path.join(planningDir, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    warnings.push({ file: 'STATE.md', issue: 'File not found' });
  }
  
  // Validate ROADMAP.md exists
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    warnings.push({ file: 'ROADMAP.md', issue: 'File not found' });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length
  };
}
