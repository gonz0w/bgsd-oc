/**
 * commandDiscovery.js - Command discoverability with JJ-first workspace autocomplete hints
 * Part of Phase 97: UX Polish - Task 2
 *
 * Provides command suggestions, aliases, fuzzy matching, and command-integrity validation.
 */

const fs = require('fs');
const path = require('path');

const { loadPlanningCommandSurface } = require('./planning-command-surface');
const { getRouterCommandInventory } = require('./router-contract');

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
    'w:s': 'workflow:savings',
    'w:h': 'workflow:hotpath'
};

const COMMAND_CATEGORIES = {
  workflow: {
    name: 'Workflow',
      commands: ['init:new-project', 'init:execute-phase', 'init:plan-phase', 'plan:phase', 'execute:phase', 'verify:state']
  },
  workspace: {
    name: 'Workspace Recovery',
    commands: ['workspace']
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
    commands: ['lessons:capture', 'lessons:list', 'lessons:analyze', 'lessons:suggest', 'lessons:compact', 'lessons:deviation-capture']
  },
  skills: {
    name: 'Skills',
    commands: ['skills:list', 'skills:install', 'skills:validate', 'skills:remove']
  },
  measurement: {
    name: 'Measurement',
    commands: ['workflow:baseline', 'workflow:compare', 'workflow:savings', 'workflow:hotpath']
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
    'tdd': null,
    'test-run': null,
    'trajectory': null
  },
  'workspace': {
    'add': null,
    'list': null,
    'forget': null,
    'cleanup': null,
    'reconcile': null
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
      'execute:velocity', 'execute:tdd', 'execute:test-run', 'execute:trajectory', 'workspace', 'workspace add', 'workspace list', 'workspace forget', 'workspace cleanup', 'workspace prove', 'workspace reconcile',
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
    'workspace': ['add', 'list', 'forget', 'cleanup', 'reconcile'],
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

const VALIDATION_SURFACE_SPECS = [
  { root: 'docs', extensions: ['.md'], surface: 'docs' },
  { root: 'workflows', extensions: ['.md'], surface: 'workflow' },
  { root: 'agents', extensions: ['.md'], surface: 'agent' },
  { root: 'skills', extensions: ['.md'], surface: 'skill' },
  { root: 'templates', extensions: ['.md'], surface: 'template' },
  { root: 'plugin.js', extensions: ['.js'], surface: 'runtime' },
];

const KNOWN_FORMAT_DIFFERENCES = [
  'execute:trajectory choose', 'execute:trajectory compare',
  'execute:trajectory dead-ends', 'execute:trajectory pivot',
  'plan:intent show', 'util:classify phase', 'util:classify plan',
  'util:codebase ast', 'util:codebase complexity', 'util:codebase context',
  'util:codebase exports', 'util:codebase repo-map', 'research:collect --resume',
  'verify:validate consistency', 'verify:validate health',
];

const NAMED_EXCLUSION_CLASSES = [
  'reference-style-mention',
  'reference-output-fence',
  'workflow-bootstrap-reconstruction',
  'transition-output-heading',
  'workflow-self-reference',
];

function normalizeSlashCommandExample(example) {
  if (!example) return '';
  const cleaned = example
    .replace(/`/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const token of tokens) {
    if (
      token === '$ARGUMENTS' ||
      token === '[flags]' ||
      token === '[options]' ||
      /^\[[^\]]+\]$/.test(token) ||
      /^\{[^}]+\}$/.test(token) ||
      /^<[^>]+>$/.test(token) ||
      token.includes('$')
    ) {
      break;
    }
    kept.push(token.replace(/[),.;:]+$/, ''));
  }
  return kept.join(' ').trim();
}

function walkFiles(rootPath, allowedExtensions, collected = []) {
  if (!fs.existsSync(rootPath)) return collected;
  const stats = fs.statSync(rootPath);
  if (stats.isFile()) {
    if (allowedExtensions.includes(path.extname(rootPath))) {
      collected.push(rootPath);
    }
    return collected;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, allowedExtensions, collected);
      continue;
    }
    if (allowedExtensions.includes(path.extname(entry.name))) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function inferSlashAliasMetadata(commandPath, content) {
  const slashCommand = `/${path.basename(commandPath, '.md')}`;
  const aliasPatterns = [
    /routing to (?:the )?canonical `([^`]+)` behavior/i,
    /Translate the request to canonical `([^`]+)` behavior/i,
    /compatibility alias for `([^`]+)`/i,
  ];

  for (const pattern of aliasPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return {
        slashCommand,
        isAlias: true,
        canonical: normalizeSlashCommandExample(match[1]),
      };
    }
  }

  return {
    slashCommand,
    isAlias: false,
    canonical: slashCommand,
  };
}

function getSlashCommandInventory(cwd = process.cwd()) {
  const manifestPath = path.join(cwd, 'bin', 'manifest.json');
  const commandsDir = path.join(cwd, 'commands');

  let commandFiles = [];
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      commandFiles = (manifest.files || []).filter(file => /^commands\/bgsd-[^/]+\.md$/.test(file));
    } catch {
      commandFiles = [];
    }
  }

  if (commandFiles.length === 0 && fs.existsSync(commandsDir)) {
    commandFiles = fs.readdirSync(commandsDir)
      .filter(file => /^bgsd-[^/]+\.md$/.test(file))
      .map(file => path.join('commands', file));
  }

  const slashCommands = new Set();
  const canonicalCommands = new Set();
  const aliasToCanonical = new Map();

  for (const relativeFile of commandFiles) {
    const fullPath = path.join(cwd, relativeFile);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const metadata = inferSlashAliasMetadata(fullPath, content);
    slashCommands.add(metadata.slashCommand);
    if (metadata.isAlias) {
      aliasToCanonical.set(metadata.slashCommand, metadata.canonical || metadata.slashCommand);
      if (metadata.canonical) canonicalCommands.add(metadata.canonical);
    } else {
      canonicalCommands.add(metadata.slashCommand);
    }
  }

  return {
    slashCommands: Array.from(slashCommands).sort(),
    canonicalCommands: Array.from(canonicalCommands).sort(),
    aliasToCanonical: Object.fromEntries(Array.from(aliasToCanonical.entries()).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function getCliCommandInventory() {
  const routedCommands = getCliRoutedCommandInventory();
  try {
    const { COMMAND_HELP } = require('./constants');
    return Array.from(new Set([...Object.keys(COMMAND_HELP), ...routedCommands])).sort();
  } catch {
    return Array.from(new Set([...getAllCommands(), ...routedCommands])).sort();
  }
}

function getCliRoutedCommandInventory() {
  const routed = getRouterCommandInventory();
  const colonized = routed
    .filter((command) => command.includes(' '))
    .map((command) => {
      const tokens = command.split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return command;
      return `${tokens[0]}:${tokens[1]}${tokens.length > 2 ? ` ${tokens.slice(2).join(' ')}` : ''}`;
    });

  return Array.from(new Set([...routed, ...colonized, ...KNOWN_FORMAT_DIFFERENCES])).sort();
}

function collectValidationSurfaces(cwd = process.cwd()) {
  const surfaces = [];

  for (const spec of VALIDATION_SURFACE_SPECS) {
    const fullRoot = path.join(cwd, spec.root);
    for (const filePath of walkFiles(fullRoot, spec.extensions)) {
      surfaces.push({
        surface: spec.surface,
        path: path.relative(cwd, filePath).replace(/\\/g, '/'),
        content: fs.readFileSync(filePath, 'utf8'),
      });
    }
  }

  return surfaces.sort((a, b) => a.path.localeCompare(b.path));
}

function cleanCommandCapture(command) {
  return command
    .trim()
    .replace(/[),.;:]+$/, '')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCommandTextForValidation(mention) {
  const command = mention.text || '';
  const lineText = mention.lineText || '';
  if (!command || !lineText.includes(command)) return command;

  const normalizedCommand = command.trim();
  const inlineSegments = Array.from(lineText.matchAll(/`([^`]*)`/g), (match) => match[1]);
  const segment = inlineSegments.find((candidate) => candidate.includes(normalizedCommand));
  if (segment) return segment.trim().replace(/\s+/g, ' ');

  const backtickMatch = lineText.match(new RegExp('`' + escapeRegExp(command) + '([^`]*)`'));
  if (!backtickMatch) return command;

  return cleanCommandCapture(`${command}${backtickMatch[1] || ''}`);
}

function getSlashCommandTextForValidation(mention) {
  const command = mention.text || '';
  const lineText = mention.lineText || '';
  if (/^\/bgsd-[a-z0-9-]+/i.test(command)) return command;
  if (!lineText) return command;

  const inlineSegments = Array.from(lineText.matchAll(/`([^`]*)`/g), (match) => match[1]);
  const inlineSlash = inlineSegments.find((candidate) => /\/bgsd-[a-z0-9-]+/i.test(candidate));
  if (inlineSlash) return cleanCommandCapture(inlineSlash);

  const directMatch = lineText.match(/\/bgsd-[a-z0-9-]+(?:\s+(?:"[^"]+"|'[^']+'|\[[^\]]+\]|\{[^}]+\}|<[^>]+>|[^\s`"'<>()[\]{}]+))*/i);
  return directMatch ? cleanCommandCapture(directMatch[0]) : command;
}

function countSlashCommandsInLine(lineText = '') {
  return (lineText.match(/\/bgsd-[a-z0-9-]+/gi) || []).length;
}

function hasReferenceSyntax(command = '') {
  return /(\[[^\]]+\]|\{[^}]+\}|<[^>]+>|\|)/.test(command);
}

function isReferenceOnlyMetadataLine(lineText = '') {
  return /^\s*description\s*:/i.test(lineText || '');
}

function isXmlTagMention(mention) {
  const lineText = mention.lineText || '';
  const command = mention.text || '';
  const tagName = command.replace(/^\//, '');
  return lineText.includes(`<${tagName}>`) || lineText.includes(`</${tagName}>`);
}

function getWorkflowSelfCommand(surfacePath) {
  if (!/^workflows\/.+\.md$/i.test(surfacePath || '')) return null;
  const base = path.basename(surfacePath, '.md');
  if (!base) return null;
  const commandName = base.startsWith('cmd-') ? base.slice(4) : base;
  return `/bgsd-${commandName}`;
}

function getPlanningCommandSurface(cwd = process.cwd()) {
  try {
    return loadPlanningCommandSurface(cwd);
  } catch {
    return {
      subactions: ['phase', 'discuss', 'research', 'assumptions', 'roadmap', 'gaps', 'todo'],
      routeEntries: [],
      routes: {},
      legacyAliases: {
        '/bgsd-plan-phase': ['/bgsd-plan', 'phase'],
        '/bgsd-discuss-phase': ['/bgsd-plan', 'discuss'],
        '/bgsd-research-phase': ['/bgsd-plan', 'research'],
        '/bgsd-assumptions-phase': ['/bgsd-plan', 'assumptions'],
      },
    };
  }
}

function getLegacyPlanningAliasSuggestions(planningSurface) {
  const entries = Object.entries((planningSurface && planningSurface.legacyAliases) || {});
  return Object.fromEntries(entries.map(([alias, tokens]) => [alias, tokens.join(' ')]));
}

function getPlanningRouteMatches(args, planningSurface) {
  if (!Array.isArray(args) || args.length === 0) return [];
  return (planningSurface.routeEntries || []).filter((entry) =>
    entry.literalPrefix.every((token, index) => args[index] === token)
  );
}

function validatePlanningSlashCommand(baseCommand, args, mention, surfacePath, surfaceType, planningSurface) {
  const issues = [];
  const subactions = new Set((planningSurface.subactions || []).filter(Boolean));
  const routeMatches = getPlanningRouteMatches(args, planningSurface);

  if (args.length === 0) {
    issues.push({
      kind: 'unsupported-command',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      suggestion: '/bgsd-plan phase <phase-number>',
      message: '/bgsd-plan requires an explicit supported sub-action',
    });
    return issues;
  }

  if (routeMatches.length > 0) {
    const exactRoute = routeMatches.sort((a, b) => b.literalPrefix.length - a.literalPrefix.length)[0];
    const providedOperands = args.length - exactRoute.literalPrefix.length;
    if (providedOperands < exactRoute.requiredOperandCount) {
      issues.push({
        kind: 'missing-argument',
        surface: surfaceType,
        file: surfacePath,
        line: mention.line,
        command: mention.text,
        message: `${baseCommand} ${exactRoute.literalPrefix.join(' ')} requires additional arguments`,
      });
    }
    return issues;
  }

  if (subactions.has(args[0])) {
    const nextTokens = Array.from(new Set((planningSurface.routeEntries || [])
      .filter((entry) => entry.literalPrefix[0] === args[0] && entry.literalPrefix.length > 1)
      .map((entry) => entry.literalPrefix[1])
      .filter(Boolean)));

    issues.push({
      kind: 'missing-argument',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      message: nextTokens.length > 0
        ? `${baseCommand} ${args[0]} requires one of: ${nextTokens.join(', ')}`
        : `${baseCommand} ${args[0]} requires additional arguments`,
    });
    return issues;
  }

  issues.push({
    kind: 'unsupported-command',
    surface: surfaceType,
    file: surfacePath,
    line: mention.line,
    command: mention.text,
    suggestion: '/bgsd-plan phase <phase-number>',
    message: '/bgsd-plan surfaced guidance must start with an explicit supported sub-action',
  });
  return issues;
}

function isWorkflowSelfReference(surfacePath, mention) {
  const selfCommand = getWorkflowSelfCommand(surfacePath);
  if (!selfCommand) return false;
  const baseCommand = (mention.text || '').split(/\s+/)[0];
  return baseCommand === selfCommand;
}

function isWorkflowFallbackReconstructionContext(surfacePath, mention) {
  if (!/workflows\/(?:plan-phase|discuss-phase)\.md$/i.test(surfacePath || '')) return false;

  const lineText = mention.lineText || '';
  const baseCommand = (mention.text || '').split(/\s+/)[0];
  const context = [lineText, mention.fenceLabel || '', mention.fenceLeadIn || ''].join('\n');

  if (
    baseCommand === '/bgsd-plan' &&
    /\b(routed|copied)\b/i.test(lineText) &&
    /hook was bypassed/i.test(lineText)
  ) {
    return true;
  }

  if (/^node(?:js)?\b/i.test(mention.text || '')) {
    return (/if no `<bgsd-context>` found|reconstruct the same/i.test(context) && /hook was bypassed/i.test(context)) ||
      (/BGSD_CONTEXT=\$\(/.test(lineText) && /\binit:(?:plan-phase|phase-op)\b/.test(mention.text || ''));
  }

  return false;
}

function isReferenceOutputFence(mention) {
  if (!mention.inFence) return false;
  const context = `${mention.fenceLabel || ''}\n${mention.fenceLeadIn || ''}`;
  return /(usage|example|examples|display format|format and display results|present|completion summary|footer|errors|warnings|info|would you like|if no .*provided|if repairs were performed|if errors exist|if warnings exist|if info exists)/i.test(context);
}

function isTransitionOutputHeading(mention) {
  const lineText = mention.lineText || '';
  return /^\s*##\s*(?:▶\s*)?Next Up:/i.test(lineText);
}

function isReferenceStyleMention(mention) {
  const lineText = mention.lineText || '';
  const commandText = getCommandTextForValidation(mention);
  const markdownTableLine = /^\s*\|/.test(lineText);
  const referenceHints = /\b(reference|references|matrix|ownership|owner|index|table|routes?|family|families|canonical planning-family|sub-action|responsible|accountable|consulted|preferred canonical|compatibility alias|historical context)\b/i.test(lineText);
  const runnableHints = /\b(run|next|then|continue|fix|switch|execute|retry)\b/i.test(lineText);
  const slashCommandCount = countSlashCommandsInLine(lineText);
  const usageLine = /^\s*(#{1,6}\s+`?\/bgsd-|\*\*Usage:\*\*)/i.test(lineText);
  const antiPatternLine = /^\s*-\s+do(?:\s+not|n't)\b/i.test(lineText);
  const variableAssignmentLine = /^\s*[A-Z0-9_]+\s*=\s*["'`].*\/bgsd-/i.test(lineText);
  const firstSlashIndex = lineText.search(/\/bgsd-[a-z0-9-]+/i);
  const mentionIndex = mention.text ? lineText.indexOf(mention.text) : -1;

   if (isXmlTagMention(mention) || isReferenceOutputFence(mention) || usageLine || antiPatternLine || variableAssignmentLine || /\.\.\./.test(commandText) || (commandText === '/bgsd-plan' && /not runnable shorthand|reference-style planning-family index|family labels inside/i.test(lineText))) {
     return true;
    }

  if (/compatibility alias/i.test(lineText) && mentionIndex > firstSlashIndex) {
    return true;
  }

   if (isReferenceOnlyMetadataLine(lineText) && !runnableHints) {
    return true;
  }

  if (markdownTableLine && hasReferenceSyntax(mention.text)) {
    return true;
  }

  if (!runnableHints && referenceHints && (hasReferenceSyntax(mention.text) || slashCommandCount > 1 || /\bnot runnable\b|family labels inside|reference-style planning-family index/i.test(lineText))) {
    return true;
  }

  return false;
}

function extractCommandMentions(content) {
  const mentions = [];
  const lines = content.split(/\r?\n/);
  const slashRegex = /(^|[\s`"'([<{|:;-])(?<command>\/bgsd-[a-z0-9-]+(?:\s+(?:"[^"]+"|'[^']+'|\[[^\]]+\]|\{[^}]+\}|<[^>]+>|[^\s`"'<>()[\]{}]+))*)/gi;
  const cliRegex = /(?:^|[^a-z0-9-])((?:(?:bgsd-tools|gsd-tools)\s+(?:[a-z0-9-]+(?::[a-z0-9-]+)?)(?:\s+(?:--[a-z0-9-]+(?:=[^\s`"'<>()[\]{}]+)?|[a-z0-9./:_-]+))*|node\s+[^\s`"'<>()[\]{}]*bgsd-tools\.cjs\s+(?:[a-z0-9-]+(?::[a-z0-9-]+)?)(?:\s+(?:--[a-z0-9-]+(?:=[^\s`"'<>()[\]{}]+)?|[a-z0-9./:_-]+))*))/gi;
  let inFence = false;
  let fenceLabel = '';
  let fenceLeadIn = '';
  let lastNonEmptyLine = '';
  let previousNonEmptyLine = '';

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      if (!inFence) {
        inFence = true;
        fenceLabel = lastNonEmptyLine;
        fenceLeadIn = previousNonEmptyLine;
      } else {
        inFence = false;
        fenceLabel = '';
        fenceLeadIn = '';
      }
      return;
    }

    let match;
    while ((match = slashRegex.exec(line)) !== null) {
      const text = cleanCommandCapture(match.groups?.command || match[0]);
      const nextChar = line[match.index + match[0].length] || '';
      if (nextChar === '/') continue;
      mentions.push({
        type: 'slash',
        line: index + 1,
        text,
        lineText: line,
        inFence,
        fenceLabel,
        fenceLeadIn,
      });
    }
    while ((match = cliRegex.exec(line)) !== null) {
      mentions.push({
        type: 'cli',
        line: index + 1,
        text: cleanCommandCapture(match[1]),
        lineText: line,
        inFence,
        fenceLabel,
        fenceLeadIn,
      });
    }

    if (trimmed) {
      previousNonEmptyLine = lastNonEmptyLine;
      lastNonEmptyLine = line;
    }
  });

  return mentions;
}

function detectGapContext(surfacePath, lineText) {
  return /gap/i.test(surfacePath) || /\bgaps?\b/i.test(lineText);
}

function buildSlashSuggestion(baseCommand, args, aliasToCanonical) {
  const canonical = aliasToCanonical[baseCommand];
  if (!canonical) return null;
  return [canonical, ...args].filter(Boolean).join(' ').trim();
}

function validateSlashMention(mention, surfacePath, surfaceType, slashInventory, planningSurface = getPlanningCommandSurface()) {
  const issues = [];
  const commandText = getSlashCommandTextForValidation(mention);
  const tokens = commandText.split(/\s+/).filter(Boolean);
  const baseCommand = tokens[0];
  const args = tokens.slice(1);
  const slashSet = new Set(slashInventory.slashCommands);
  const planningAliasSuggestions = getLegacyPlanningAliasSuggestions(planningSurface);
  const legacyCanonical = slashInventory.aliasToCanonical[baseCommand] || planningAliasSuggestions[baseCommand] || null;
  const referenceStyle = isReferenceStyleMention(mention) || isWorkflowSelfReference(surfacePath, mention) || isWorkflowFallbackReconstructionContext(surfacePath, mention) || isTransitionOutputHeading(mention);

  if (referenceStyle) {
    return issues;
  }

  if (!slashSet.has(baseCommand) && !legacyCanonical) {
    issues.push({
      kind: 'nonexistent-command',
        surface: surfaceType,
        file: surfacePath,
        line: mention.line,
        command: commandText,
        message: `Unknown slash command ${baseCommand}`,
      });
    return issues;
  }

  if (legacyCanonical) {
    issues.push({
      kind: 'legacy-command',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: commandText,
      suggestion: buildSlashSuggestion(baseCommand, args, { ...planningAliasSuggestions, ...slashInventory.aliasToCanonical }),
      message: `${baseCommand} is a compatibility alias and should not appear in surfaced guidance`,
    });
  }

  if (!referenceStyle && baseCommand === '/bgsd-plan') {
    issues.push(...validatePlanningSlashCommand(baseCommand, args, { ...mention, text: commandText }, surfacePath, surfaceType, planningSurface));
  }

  if (!referenceStyle && baseCommand === '/bgsd-settings' && args[0] === 'profile' && (!args[1] || args[1].startsWith('--'))) {
    issues.push({
      kind: 'missing-argument',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      message: '/bgsd-settings profile requires a profile argument',
    });
  }

  if (!referenceStyle && baseCommand === '/bgsd-execute-phase' && detectGapContext(surfacePath, mention.lineText) && !args.includes('--gaps-only')) {
    issues.push({
      kind: 'missing-flag',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      suggestion: `${mention.text} --gaps-only`.trim(),
      message: '/bgsd-execute-phase must include --gaps-only in gap-focused guidance',
    });
  }

  if (!referenceStyle && baseCommand === '/bgsd-plan' && detectGapContext(surfacePath, mention.lineText) && args[0] === 'phase') {
    issues.push({
      kind: 'wrong-command',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      suggestion: ['/bgsd-plan gaps', args[1]].filter(Boolean).join(' '),
      message: 'Gap-focused guidance should use /bgsd-plan gaps rather than /bgsd-plan phase',
    });
  }

  return issues;
}

function stripShellRedirectArtifacts(args, lineText = '') {
  const cleaned = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (/^(?:\d*>>?|<<?|\|\|?|&&)$/.test(token)) break;
    if (/^\d+$/.test(token) && lineText.includes(`${token}>`)) break;
    cleaned.push(token);
  }
  return cleaned;
}

function validateCliMention(mention, surfacePath, surfaceType, cliInventory) {
  const issues = [];
  const tokens = mention.text.split(/\s+/).filter(Boolean);
  const binary = tokens.shift();
  const args = stripShellRedirectArtifacts(tokens, mention.lineText || '');
  const referenceStyle = isReferenceStyleMention(mention) || isWorkflowFallbackReconstructionContext(surfacePath, mention);

  if (referenceStyle) {
    return issues;
  }

  let commandBinary = binary;
  if ((binary === 'node' || binary === 'nodejs') && args[0] && /(?:^|[\\/])bgsd-tools\.cjs$/i.test(args[0])) {
    commandBinary = 'bgsd-tools';
    args.shift();
  }

  const firstArg = args[0] || '';
  const knownRoots = new Set(
    cliInventory.flatMap(command => {
      const firstToken = command.split(/\s+/)[0];
      return [firstToken, firstToken.split(':')[0]];
    })
  );

  if (firstArg && !firstArg.includes(':') && !firstArg.includes('-') && !knownRoots.has(firstArg)) {
    return issues;
  }

  if (commandBinary === 'gsd-tools') {
    issues.push({
      kind: 'legacy-command',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      suggestion: ['bgsd-tools', ...args].join(' '),
      message: 'Use bgsd-tools instead of the legacy gsd-tools binary name',
    });
  }

  const candidates = [];
  for (let length = Math.min(3, args.length); length >= 1; length -= 1) {
    candidates.push(args.slice(0, length).join(' '));
  }
  const matched = candidates.find(candidate => cliInventory.includes(candidate));

  if (!matched) {
    issues.push({
      kind: 'nonexistent-command',
      surface: surfaceType,
      file: surfacePath,
      line: mention.line,
      command: mention.text,
      message: `Unknown CLI command in surfaced guidance: ${mention.text}`,
    });
  }

  return issues;
}

function groupIntegrityIssues(issues) {
  const groups = new Map();

  for (const issue of issues) {
    const key = `${issue.surface}:${issue.file}`;
    if (!groups.has(key)) {
      groups.set(key, {
        surface: issue.surface,
        file: issue.file,
        issueCount: 0,
        issues: [],
      });
    }
    const group = groups.get(key);
    group.issueCount += 1;
    group.issues.push(issue);
  }

  return Array.from(groups.values()).sort((a, b) => a.file.localeCompare(b.file));
}

function validateCommandIntegrity(options = {}) {
  const cwd = options.cwd || process.cwd();
  const slashInventory = options.slashInventory || getSlashCommandInventory(cwd);
  const cliInventory = options.cliInventory || getCliCommandInventory();
  const planningSurface = options.planningSurface || getPlanningCommandSurface(cwd);
  const surfaces = Array.isArray(options.surfaces) ? options.surfaces : collectValidationSurfaces(cwd);
  const issues = [];

  for (const surface of surfaces) {
    for (const mention of extractCommandMentions(surface.content || '')) {
      if (mention.type === 'slash') {
        issues.push(...validateSlashMention(mention, surface.path, surface.surface || 'surface', slashInventory, planningSurface));
      } else if (mention.type === 'cli') {
        issues.push(...validateCliMention(mention, surface.path, surface.surface || 'surface', cliInventory));
      }
    }
  }

  const groupedIssues = groupIntegrityIssues(issues);

  return {
    valid: issues.length === 0,
    surfaceCount: surfaces.length,
    issueCount: issues.length,
    groupedIssueCount: groupedIssues.length,
    message: issues.length === 0
      ? `All ${surfaces.length} surfaced files passed command integrity validation`
      : `${issues.length} command integrity issue(s) found across ${groupedIssues.length} surfaced file(s)`,
    inventories: {
      slashCommands: slashInventory.slashCommands,
      canonicalSlashCommands: slashInventory.canonicalCommands,
      cliCommands: cliInventory,
    },
    proofInventory: {
      surfacesChecked: surfaces.map((surface) => surface.path),
      surfaceTypes: Array.from(new Set(surfaces.map((surface) => surface.surface || 'surface'))).sort(),
      slashContractSource: 'commands/bgsd-plan.md',
      cliContractSources: ['src/lib/router-contract.js', 'src/lib/constants.js'],
      namedExclusions: NAMED_EXCLUSION_CLASSES,
    },
    issues,
    groupedIssues,
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
  validateArtifacts,
  validateCommandIntegrity,
  getSlashCommandInventory,
  collectValidationSurfaces,
};

/**
 * Validate planning artifacts (MILESTONES.md, PROJECT.md, etc.)
 * Checks for common structural issues that cause build/deploy problems
 */
function validateArtifacts(cwd = process.cwd()) {
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
    
    // Check that milestone sections are separated cleanly to avoid malformed merges.
    const h2Matches = content.match(/^##\s+.+$/gm) || [];
    const separators = content.match(/^---$/gm) || [];
    if (h2Matches.length > 0 && separators.length > 0 && separators.length !== h2Matches.length) {
      warnings.push({ file: 'MILESTONES.md', issue: `Milestone section separators mismatch (${h2Matches.length} headings, ${separators.length} separators)` });
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
