const COMMAND_CATEGORIES = {
  'Getting Started': {
    description: 'Start new projects or milestones',
    commands: [
      'init:new-project',
      'init:new-milestone'
    ]
  },
  'Planning': {
    description: 'Plan and organize work',
    commands: [
      'init:plan-phase',
      'plan:roadmap',
      'plan:phases',
      'plan:find-phase',
      'plan:requirements',
      'plan:intent'
    ]
  },
  'Execution': {
    description: 'Run and manage tasks',
    commands: [
      'init:execute-phase',
      'init:quick',
      'init:resume',
      'execute:tdd',
      'execute:test-run',
      'execute:ci'
    ]
  },
  'Tracking': {
    description: 'Monitor progress and velocity',
    commands: [
      'init:progress',
      'execute:session-summary',
      'execute:session-diff',
      'execute:velocity'
    ]
  },
  'Verification': {
    description: 'Verify and validate work',
    commands: [
      'init:verify-work',
      'verify:verify',
      'verify:state',
      'verify:assertions',
      'verify:context-budget',
      'verify:token-budget'
    ]
  },
  'Research': {
    description: 'Research and gather information',
    commands: [
      'research:capabilities',
      'research:yt-search',
      'research:yt-transcript',
      'research:collect',
      'research:nlm-create',
      'research:nlm-ask',
      'research:nlm-report'
    ]
  },
  'Analysis': {
    description: 'Analyze code and dependencies',
    commands: [
      'execute:codebase-impact',
      'execute:analyze-deps',
      'execute:validate-deps',
      'execute:trace-requirement',
      'execute:search-decisions',
      'execute:search-lessons'
    ]
  },
  'Configuration': {
    description: 'Manage settings and environment',
    commands: [
      'util:config-get',
      'util:config-set',
      'util:env',
      'util:cache'
    ]
  },
  'Utilities': {
    description: 'Miscellaneous helpful commands',
    commands: [
      'util:current-timestamp',
      'util:list-todos',
      'util:todo',
      'util:memory',
      'util:progress',
      'util:classify',
      'util:frontmatter',
      'util:websearch',
      'util:agent'
    ]
  }
};

const COMMAND_BRIEF = {
  'init:new-project': 'Start a new project with planning structure',
  'init:new-milestone': 'Start a new milestone',
  'init:plan-phase': 'Plan a specific phase',
  'init:execute-phase': 'Execute plans in a phase',
  'init:quick': 'Quick task execution',
  'init:resume': 'Resume work on existing project',
  'init:verify-work': 'Verify completed work',
  'init:progress': 'Show project progress and status',
  'init:todos': 'Show and manage todos',
  'init:map-codebase': 'Map the codebase structure',
  'init:memory': 'Memory and context operations',
  'init:milestone-op': 'Milestone operations (complete, archive)',
  'init:phase-op': 'Phase operations (complete, skip)',
  
  'plan:roadmap': 'Show and manage roadmap',
  'plan:phases': 'List all phases',
  'plan:find-phase': 'Find a specific phase',
  'plan:requirements': 'Manage requirements',
  'plan:intent': 'Manage project intent',
  'plan:milestone': 'Milestone operations',
  
  'execute:velocity': 'Show execution velocity metrics',
  'execute:session-summary': 'Show session summary',
  'execute:session-diff': 'Show changes since last session',
  'execute:commit': 'Commit changes with proper messages',
  'execute:rollback-info': 'Get rollback info for a plan',
  'execute:tdd': 'Run TDD workflow',
  'execute:test-run': 'Run project tests',
  'execute:ci': 'GitHub CI - push, PR, code scanning, fix, auto-merge',
  'execute:worktree': 'Manage git worktrees',
  'execute:trajectory': 'Manage execution trajectories',
  'execute:codebase-impact': 'Analyze codebase changes',
  'execute:analyze-deps': 'Analyze dependencies',
  'execute:validate-deps': 'Validate dependency graph',
  'execute:search-decisions': 'Search past decisions',
  'execute:search-lessons': 'Search completed lessons',
  'execute:trace-requirement': 'Trace requirement to files',
  
  'verify:verify': 'Verify plan/phase completion',
  'verify:state': 'Verify STATE.md consistency',
  'verify:assertions': 'Verify assertions',
  'verify:context-budget': 'Check context usage',
  'verify:token-budget': 'Check token usage',
  'verify:review': 'Review code changes',
  'verify:orphans': 'Find orphaned code',
  'verify:search-decisions': 'Search decisions',
  'verify:search-lessons': 'Search lessons learned',
  
  'research:capabilities': 'Show research tool capabilities',
  'research:yt-search': 'Search YouTube videos',
  'research:yt-transcript': 'Get YouTube transcript',
  'research:collect': 'Collect research data',
  'research:nlm-create': 'Create NotebookLM notebook',
  'research:nlm-ask': 'Ask NotebookLM question',
  'research:nlm-report': 'Generate NotebookLM report',
  'research:nlm-add-source': 'Add source to notebook',
  
  'util:config-get': 'Get configuration value',
  'util:config-set': 'Set configuration value',
  'util:env': 'Scan and show environment',
  'util:cache': 'Manage cache',
  'util:current-timestamp': 'Get current timestamp',
  'util:list-todos': 'List todos',
  'util:todo': 'Manage todos',
  'util:memory': 'Memory operations',
  'util:progress': 'Show progress',
  'util:classify': 'Classify code (plan/phase)',
  'util:frontmatter': 'Manage file frontmatter',
  'util:websearch': 'Web search',
  'util:agent': 'Agent operations',
  'util:codebase': 'Codebase analysis tools',
  
  'milestone:summary': 'Show milestone summary',
  'milestone:info': 'Show milestone info',
  
  'cache:clear': 'Clear cache',
  'cache:status': 'Show cache status',
  'cache:warm': 'Warm up cache',
  'cache:research-stats': 'Research cache stats',
  'cache:research-clear': 'Clear research cache',
  
  'agent:list': 'List all agents',
  'agent:audit': 'Audit agent configurations',
  'agent:validate-contracts': 'Validate agent contracts'
};

const COMMAND_RELATED = {
  'init:new-project': ['init:new-milestone', 'plan:roadmap'],
  'init:new-milestone': ['init:new-project', 'milestone:summary'],
  'init:plan-phase': ['init:execute-phase', 'plan:requirements'],
  'init:execute-phase': ['init:plan-phase', 'init:verify-work', 'execute:tdd'],
  'init:quick': ['init:execute-phase', 'execute:test-run'],
  'init:resume': ['init:progress', 'execute:session-summary'],
  'init:verify-work': ['verify:verify', 'verify:assertions'],
  'init:progress': ['execute:velocity', 'execute:session-summary', 'milestone:summary'],
  
  'plan:roadmap': ['plan:phases', 'plan:find-phase'],
  'plan:phases': ['plan:roadmap', 'plan:find-phase'],
  'plan:find-phase': ['plan:phases', 'plan:requirements'],
  'plan:requirements': ['verify:verify', 'execute:trace-requirement'],
  'plan:intent': ['verify:search-decisions', 'execute:search-lessons'],
  
  'execute:velocity': ['execute:session-summary', 'init:progress'],
  'execute:session-summary': ['execute:velocity', 'execute:session-diff'],
  'execute:session-diff': ['execute:session-summary', 'execute:commit'],
  'execute:tdd': ['execute:test-run', 'init:execute-phase'],
  'execute:test-run': ['execute:tdd', 'verify:verify'],
  'execute:ci': ['execute:commit', 'execute:test-run', 'init:verify-work'],
  'execute:codebase-impact': ['execute:analyze-deps', 'util:codebase'],
  'execute:analyze-deps': ['execute:validate-deps', 'execute:codebase-impact'],
  'execute:search-decisions': ['verify:search-decisions', 'execute:search-lessons'],
  'execute:search-lessons': ['verify:search-lessons', 'execute:search-decisions'],
  
  'verify:verify': ['verify:assertions', 'verify:state'],
  'verify:state': ['verify:verify', 'init:progress'],
  'verify:assertions': ['verify:verify', 'verify:review'],
  'verify:context-budget': ['verify:token-budget', 'execute:session-summary'],
  'verify:token-budget': ['verify:context-budget', 'execute:session-summary'],
  'verify:review': ['verify:verify', 'execute:codebase-impact'],
  
  'research:capabilities': ['research:yt-search', 'research:collect'],
  'research:yt-search': ['research:yt-transcript', 'research:capabilities'],
  'research:collect': ['research:capabilities', 'cache:research-stats'],
  'research:nlm-create': ['research:nlm-ask', 'research:nlm-report'],
  'research:nlm-ask': ['research:nlm-create', 'research:nlm-report'],
  'research:nlm-report': ['research:nlm-create', 'research:nlm-ask'],
  
  'util:config-get': ['util:config-set', 'util:env'],
  'util:config-set': ['util:config-get', 'util:env'],
  'util:env': ['util:cache', 'util:config-get'],
  'util:cache': ['cache:clear', 'cache:status'],
  'util:list-todos': ['util:todo', 'init:todos'],
  'util:memory': ['init:memory', 'util:progress'],
  'util:classify': ['plan:find-phase', 'execute:trace-requirement'],
  'util:frontmatter': ['util:codebase', 'verify:verify'],
  
  'milestone:summary': ['milestone:info', 'init:progress'],
  'milestone:info': ['milestone:summary', 'init:progress'],
  
  'cache:clear': ['cache:status', 'cache:warm'],
  'cache:status': ['cache:clear', 'cache:warm'],
  
  'agent:list': ['agent:audit', 'agent:validate-contracts'],
  'agent:audit': ['agent:list', 'agent:validate-contracts']
};

const NATURAL_LANGUAGE_ALIASES = {
  'start project': 'init:new-project',
  'new project': 'init:new-project',
  'start milestone': 'init:new-milestone',
  'new milestone': 'init:new-milestone',
  'plan': 'init:plan-phase',
  'plan phase': 'init:plan-phase',
  'execute': 'init:execute-phase',
  'execute phase': 'init:execute-phase',
  'run': 'init:quick',
  'quick task': 'init:quick',
  'resume': 'init:resume',
  'continue': 'init:resume',
  'verify': 'init:verify-work',
  'progress': 'init:progress',
  'status': 'init:progress',
  'roadmap': 'plan:roadmap',
  'phases': 'plan:phases',
  'find phase': 'plan:find-phase',
  'requirements': 'plan:requirements',
  'intent': 'plan:intent',
  'velocity': 'execute:velocity',
  'speed': 'execute:velocity',
  'session': 'execute:session-summary',
  'summary': 'execute:session-summary',
  'diff': 'execute:session-diff',
  'changes': 'execute:session-diff',
  'commit': 'execute:commit',
  'tdd': 'execute:tdd',
  'test': 'execute:test-run',
  'tests': 'execute:test-run',
  'ci': 'execute:ci',
  'github ci': 'execute:ci',
  'pr': 'execute:ci',
  'pull request': 'execute:ci',
  'merge': 'execute:ci',
  'worktree': 'execute:worktree',
  'impact': 'execute:codebase-impact',
  'dependencies': 'execute:analyze-deps',
  'deps': 'execute:analyze-deps',
  'search': 'execute:search-decisions',
  'decisions': 'execute:search-decisions',
  'lessons': 'execute:search-lessons',
  'trace': 'execute:trace-requirement',
  'config': 'util:config-get',
  'configuration': 'util:config-get',
  'setting': 'util:config-get',
  'settings': 'util:config-get',
  'env': 'util:env',
  'environment': 'util:env',
  'cache': 'util:cache',
  'timestamp': 'util:current-timestamp',
  'time': 'util:current-timestamp',
  'todos': 'util:list-todos',
  'todo': 'util:todo',
  'memory': 'util:memory',
  'classify': 'util:classify',
  'frontmatter': 'util:frontmatter',
  'search web': 'util:websearch',
  'web search': 'util:websearch',
  'agent': 'util:agent',
  'agents': 'agent:list',
  'codebase': 'util:codebase',
  'map': 'util:codebase',
  'capabilities': 'research:capabilities',
  'tools': 'research:capabilities',
  'youtube': 'research:yt-search',
  'video': 'research:yt-search',
  'transcript': 'research:yt-transcript',
  'research': 'research:collect',
  'notebook': 'research:nlm-create',
  'notebooklm': 'research:nlm-create',
  'ask': 'research:nlm-ask',
  'question': 'research:nlm-ask',
  'report': 'research:nlm-report',
  'milestone': 'milestone:summary',
  'summary': 'milestone:summary'
};

function getAllCommandsByCategory() {
  const result = {};
  for (const [category, data] of Object.entries(COMMAND_CATEGORIES)) {
    result[category] = {
      description: data.description,
      commands: data.commands.map(cmd => ({
        name: cmd,
        brief: COMMAND_BRIEF[cmd] || '',
        related: COMMAND_RELATED[cmd] || []
      }))
    };
  }
  return result;
}

function findCommandByAlias(query) {
  if (!query) return null;
  const normalized = query.toLowerCase().trim();
  
  if (COMMAND_BRIEF[normalized]) {
    return normalized;
  }
  
  if (NATURAL_LANGUAGE_ALIASES[normalized]) {
    return NATURAL_LANGUAGE_ALIASES[normalized];
  }
  
  for (const [alias, cmd] of Object.entries(NATURAL_LANGUAGE_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return cmd;
    }
  }
  
  for (const [cmd, brief] of Object.entries(COMMAND_BRIEF)) {
    if (brief.toLowerCase().includes(normalized) || cmd.includes(normalized)) {
      return cmd;
    }
  }
  
  return null;
}

function getRelatedCommands(command) {
  return COMMAND_RELATED[command] || [];
}

function getCommandBrief(command) {
  return COMMAND_BRIEF[command] || '';
}

function getAllCommands() {
  return Object.keys(COMMAND_BRIEF);
}

function searchCommands(query) {
  const results = [];
  const normalized = query.toLowerCase().trim();
  
  for (const [cmd, brief] of Object.entries(COMMAND_BRIEF)) {
    const score = calculateMatchScore(cmd, brief, normalized);
    if (score > 0) {
      results.push({ command: cmd, brief, score });
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

function calculateMatchScore(cmd, brief, query) {
  let score = 0;
  
  if (cmd.includes(query)) score += 10;
  if (cmd.startsWith(query)) score += 5;
  if (brief.toLowerCase().includes(query)) score += 8;
  
  const cmdParts = cmd.split(':');
  for (const part of cmdParts) {
    if (part.includes(query)) score += 3;
  }
  
  const queryWords = query.split(' ');
  for (const word of queryWords) {
    if (word.length > 2) {
      if (cmd.includes(word)) score += 2;
      if (brief.toLowerCase().includes(word)) score += 2;
    }
  }
  
  return score;
}

module.exports = {
  COMMAND_CATEGORIES,
  COMMAND_BRIEF,
  COMMAND_RELATED,
  NATURAL_LANGUAGE_ALIASES,
  getAllCommandsByCategory,
  findCommandByAlias,
  getRelatedCommands,
  getCommandBrief,
  getAllCommands,
  searchCommands
};
