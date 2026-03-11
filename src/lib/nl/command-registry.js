// Command registry for natural language command mapping
// Maps phrases to canonical commands and provides alias/intent data

// Phrase to command mapping
const PHRASES = [
  { phrase: 'plan phase', command: 'plan:phase', intent: 'plan' },
  { phrase: 'create plan', command: 'plan:phase', intent: 'plan' },
  { phrase: 'new phase', command: 'plan:phase', intent: 'plan' },
  { phrase: 'add phase', command: 'plan:phase', intent: 'plan' },
  
  { phrase: 'execute phase', command: 'execute:phase', intent: 'execute' },
  { phrase: 'run phase', command: 'execute:phase', intent: 'execute' },
  { phrase: 'run the tests', command: 'execute:quick', intent: 'execute' },
  { phrase: 'run tests', command: 'execute:quick', intent: 'execute' },
  { phrase: 'run all', command: 'execute:phase', intent: 'execute' },
  
  { phrase: 'verify work', command: 'verify:work', intent: 'verify' },
  { phrase: 'check work', command: 'verify:work', intent: 'verify' },
  { phrase: 'verify phase', command: 'verify:phase', intent: 'verify' },
  { phrase: 'validate phase', command: 'verify:phase', intent: 'verify' },
  
  { phrase: 'show progress', command: 'session:progress', intent: 'query' },
  { phrase: 'display progress', command: 'session:progress', intent: 'query' },
  { phrase: 'status', command: 'session:progress', intent: 'query' },
  { phrase: 'what is the status', command: 'session:progress', intent: 'query' },
  { phrase: 'show roadmap', command: 'roadmap:show', intent: 'query' },
  { phrase: 'list phases', command: 'roadmap:show', intent: 'query' },
  
  { phrase: 'resume work', command: 'session:resume', intent: 'execute' },
  { phrase: 'continue work', command: 'session:resume', intent: 'execute' },
  
  { phrase: 'pause work', command: 'session:pause', intent: 'query' },
  { phrase: 'take a break', command: 'session:pause', intent: 'query' },
  
  { phrase: 'new milestone', command: 'milestone:new', intent: 'plan' },
  { phrase: 'create milestone', command: 'milestone:new', intent: 'plan' },
  
  { phrase: 'complete milestone', command: 'milestone:complete', intent: 'execute' },
  { phrase: 'finish milestone', command: 'milestone:complete', intent: 'execute' },
  
  { phrase: 'health check', command: 'health', intent: 'query' },
  { phrase: 'project health', command: 'health', intent: 'query' },
  
  { phrase: 'search decisions', command: 'util:search-decisions', intent: 'query' },
  { phrase: 'find lessons', command: 'util:search-lessons', intent: 'query' }
];

// Short aliases (backward compatibility)
const ALIASES = {
  'p': 'plan:phase',
  'e': 'execute:phase',
  'ep': 'execute:phase',
  'ev': 'verify:phase',
  'v': 'verify:work',
  'w': 'verify:work',
  'q': 'query',
  's': 'session:progress',
  'st': 'session:progress',
  'pr': 'session:progress',
  'r': 'session:resume',
  'rs': 'session:resume',
  'pa': 'session:pause',
  'pp': 'session:pause',
  'h': 'help',
  '?': 'help'
};

// Intent keywords for classification
const INTENTS = {
  plan: ['plan', 'planning', 'create', 'new', 'make', 'add'],
  execute: ['execute', 'run', 'start', 'go', 'do', 'implement', 'run the'],
  verify: ['verify', 'check', 'test', 'validate', 'confirm', 'audit'],
  query: ['show', 'display', 'list', 'get', 'find', 'search', 'what', 'how', 'status', 'progress']
};

module.exports = { PHRASES, ALIASES, INTENTS };
