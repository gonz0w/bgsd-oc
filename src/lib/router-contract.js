'use strict';

const ROUTER_CONTRACT = {
  init: ['execute-phase', 'plan-phase', 'new-project', 'new-milestone', 'quick', 'resume', 'review', 'security', 'release', 'verify-work', 'phase-op', 'todos', 'milestone-op', 'map-codebase', 'progress', 'memory'],
  plan: {
    intent: {
      create: null,
      show: null,
      read: null,
      update: null,
      validate: null,
      trace: null,
      drift: null,
    },
    requirements: ['mark-complete'],
    roadmap: ['get-phase', 'analyze', 'update-plan-progress'],
    phases: ['list'],
    'find-phase': null,
    milestone: ['complete', 'summary', 'info'],
    phase: ['next-decimal', 'add', 'insert', 'remove', 'complete'],
    generate: null,
  },
  phase: ['snapshot'],
  workspace: ['add', 'list', 'forget', 'cleanup', 'reconcile'],
  execute: {
    commit: null,
    'rollback-info': null,
    'session-diff': null,
    'session-summary': null,
    velocity: null,
    tdd: null,
    'test-run': null,
    trajectory: ['checkpoint', 'list', 'pivot', 'compare', 'choose', 'dead-ends'],
  },
  verify: {
    regression: null,
    quality: null,
    review: null,
    state: ['update', 'get', 'patch', 'advance-plan', 'record-metric', 'update-progress', 'add-decision', 'add-blocker', 'resolve-blocker', 'record-session', 'complete-plan', 'handoff', 'validate'],
    verify: ['plan-structure', 'phase-completeness', 'references', 'commits', 'artifacts', 'key-links', 'analyze-plan', 'deliverables', 'requirements', 'regression', 'plan-wave', 'plan-deps', 'quality'],
    assertions: ['list', 'validate'],
    'search-decisions': null,
    'search-lessons': null,
    'context-budget': ['baseline', 'compare', 'measure'],
    'token-budget': null,
    summary: null,
    validate: ['consistency', 'health', 'roadmap'],
    'validate-dependencies': null,
    'validate-config': null,
    'test-coverage': null,
    handoff: null,
    agents: null,
    generate: null,
  },
  review: ['scan', 'readiness'],
  security: ['scan'],
  release: null,
  util: {
    'config-get': null,
    'config-set': null,
    settings: null,
    env: ['scan', 'status'],
    'current-timestamp': null,
    'list-todos': null,
    todo: ['complete'],
    memory: ['write', 'read', 'list', 'ensure-dir', 'compact'],
    mcp: ['profile'],
    classify: ['plan', 'phase'],
    frontmatter: ['get', 'set', 'merge', 'validate'],
    progress: null,
    websearch: null,
    'history-digest': null,
    'trace-requirement': null,
    codebase: ['analyze', 'status', 'conventions', 'rules', 'deps', 'impact', 'context', 'lifecycle', 'ast', 'exports', 'complexity', 'repo-map'],
    cache: ['research-stats', 'research-clear', 'status', 'clear', 'warm'],
    agent: ['audit', 'list', 'validate-contracts'],
    'resolve-model': null,
    template: ['select', 'fill'],
    'generate-slug': null,
    'verify-path-exists': null,
    'config-ensure-section': null,
    scaffold: null,
    'phase-plan-index': null,
    'state-snapshot': null,
    'summary-extract': null,
    'summary-generate': null,
    'quick-summary': null,
    'extract-sections': null,
    git: ['log', 'diff-summary', 'blame', 'branch-info', 'rewind', 'trajectory-branch'],
    tools: null,
    runtime: null,
    measure: null,
    recovery: null,
    history: null,
    examples: null,
    'validate-commands': null,
    'validate-artifacts': null,
  },
  memory: ['list', 'add', 'remove', 'prune'],
  research: ['capabilities', 'yt-search', 'yt-transcript', 'collect', 'nlm-create', 'nlm-add-source', 'nlm-ask', 'nlm-report', 'score', 'gaps'],
  cache: ['research-stats', 'research-clear', 'status', 'clear', 'warm'],
  audit: ['scan'],
  decisions: ['list', 'inspect', 'evaluate', 'savings'],
  detect: ['tools', 'gh-preflight'],
  lessons: ['capture', 'list', 'migrate', 'analyze', 'suggest', 'compact', 'deviation-capture'],
  skills: ['list', 'install', 'validate', 'remove'],
  workflow: ['baseline', 'compare', 'verify-structure', 'savings'],
  questions: ['audit', 'list', 'validate'],
};

function collectRouterCommands(namespace, value, prefix = '') {
  const base = prefix ? `${prefix} ${namespace}` : namespace;
  if (value === null) return [base];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (entry === '') return [base];
      return [base, `${base} ${entry}`];
    });
  }

  if (typeof value === 'object') {
    const direct = [base];
    for (const [subKey, subValue] of Object.entries(value)) {
      direct.push(...collectRouterCommands(subKey, subValue, base));
    }
    return direct;
  }

  return [base];
}

function getContractNode(pathTokens = []) {
  let node = ROUTER_CONTRACT;
  for (const token of pathTokens) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
    node = node[token];
    if (node === undefined) return null;
  }
  return node;
}

function listAvailableSubcommands(pathTokens = []) {
  const node = getContractNode(pathTokens);
  if (node === null) return [];
  if (Array.isArray(node)) return [...node];
  if (typeof node === 'object') return Object.keys(node);
  return [];
}

function formatAvailableSubcommands(pathTokens = []) {
  return listAvailableSubcommands(pathTokens).join(', ');
}

function getTopLevelNamespaces() {
  return Object.keys(ROUTER_CONTRACT);
}

function getRouterCommandInventory() {
  const routed = [];
  for (const [namespace, value] of Object.entries(ROUTER_CONTRACT)) {
    routed.push(...collectRouterCommands(namespace, value));
  }
  return Array.from(new Set(routed)).sort();
}

module.exports = {
  ROUTER_CONTRACT,
  collectRouterCommands,
  getContractNode,
  listAvailableSubcommands,
  formatAvailableSubcommands,
  getTopLevelNamespaces,
  getRouterCommandInventory,
};
