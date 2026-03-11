// Intent classification for natural language commands
// Classifies user input into command intents: plan, execute, verify, query

const INTENTS = {
  plan: ['plan', 'planning', 'create', 'new', 'make', 'add'],
  execute: ['execute', 'run', 'start', 'go', 'do', 'implement', 'run the'],
  verify: ['verify', 'check', 'test', 'validate', 'confirm', 'audit'],
  query: ['show', 'display', 'list', 'get', 'find', 'search', 'what', 'how', 'status', 'progress']
};

/**
 * Classify user input into an intent
 * @param {string} input - User input string
 * @returns {Object} {intent, confidence}
 */
function classifyIntent(input) {
  if (!input || typeof input !== 'string') {
    return { intent: null, confidence: 0 };
  }
  
  const normalizedInput = input.toLowerCase().trim();
  
  // Check for exact matches first
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    for (const keyword of keywords) {
      // Match at word boundaries
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
      if (regex.test(normalizedInput)) {
        return { intent, confidence: 1.0 };
      }
    }
  }
  
  // Check for partial/keyword matches
  const words = normalizedInput.split(/\s+/);
  for (const word of words) {
    for (const [intent, keywords] of Object.entries(INTENTS)) {
      for (const keyword of keywords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          return { intent, confidence: 0.8 };
        }
      }
    }
  }
  
  return { intent: null, confidence: 0 };
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { classifyIntent, INTENTS };
