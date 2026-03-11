// Help fallback system for contextual suggestions
// Provides suggestions when input is unrecognized or unclear

const { INTENTS } = require('./command-registry.js');

/**
 * Get fallback suggestions for unrecognized input
 * @param {string} input - User input
 * @param {Object} context - Optional context {intent, params, etc.}
 * @returns {Array} Array of suggestion objects grouped by category
 */
function getFallbackSuggestions(input, context = {}) {
  const suggestions = [];
  const normalizedInput = (input || '').toLowerCase().trim();
  
  // Get intent from context if available
  const intent = context.intent || null;
  
  // Build suggestions based on intents
  for (const [intentName, keywords] of Object.entries(INTENTS)) {
    const intentSuggestions = {
      intent: intentName,
      examples: [],
      commands: []
    };
    
    // Add keyword-based suggestions
    if (keywords.length > 0) {
      intentSuggestions.keywords = keywords.slice(0, 5);
    }
    
    // Add common command patterns for this intent
    const commandPatterns = getCommandsForIntent(intentName);
    intentSuggestions.commands = commandPatterns;
    
    // Only include if it matches the input somewhat or no intent specified
    if (!intent || intent === intentName) {
      suggestions.push(intentSuggestions);
    } else if (normalizedInput.length > 0) {
      // Check if any keywords match the input
      const hasKeywordMatch = keywords.some(kw => 
        normalizedInput.includes(kw) || kw.includes(normalizedInput)
      );
      if (hasKeywordMatch) {
        suggestions.push(intentSuggestions);
      }
    }
  }
  
  // Add "did you mean" style suggestions if input is close to known commands
  if (normalizedInput.length > 2) {
    const didYouMean = generateDidYouMean(normalizedInput);
    if (didYouMean.length > 0) {
      suggestions.unshift({
        type: 'did_you_mean',
        suggestions: didYouMean
      });
    }
  }
  
  return suggestions;
}

/**
 * Get common command patterns for an intent
 * @param {string} intent - Intent name
 * @returns {Array} Array of command patterns
 */
function getCommandsForIntent(intent) {
  const commands = {
    plan: [
      { pattern: 'plan phase', command: 'plan:phase', description: 'Create a plan for a phase' },
      { pattern: 'new phase', command: 'plan:phase', description: 'Add a new phase' },
      { pattern: 'new milestone', command: 'milestone:new', description: 'Create a milestone' }
    ],
    execute: [
      { pattern: 'execute phase', command: 'execute:phase', description: 'Execute a phase plan' },
      { pattern: 'run tests', command: 'execute:quick', description: 'Run tests quickly' },
      { pattern: 'resume work', command: 'session:resume', description: 'Resume paused work' }
    ],
    verify: [
      { pattern: 'verify work', command: 'verify:work', description: 'Verify completed work' },
      { pattern: 'check status', command: 'verify:state', description: 'Check project state' }
    ],
    query: [
      { pattern: 'show progress', command: 'session:progress', description: 'Show progress' },
      { pattern: 'show roadmap', command: 'roadmap:show', description: 'Display roadmap' },
      { pattern: 'health check', command: 'health', description: 'Project health check' }
    ]
  };
  
  return commands[intent] || [];
}

/**
 * Generate "did you mean" suggestions
 * Uses simple Levenshtein-like matching
 * @param {string} input - User input
 * @returns {Array} Array of suggestions
 */
function generateDidYouMean(input) {
  const knownPhrases = [
    'plan phase', 'execute phase', 'verify work', 'show progress',
    'run tests', 'check work', 'new phase', 'resume work'
  ];
  
  const suggestions = [];
  
  for (const phrase of knownPhrases) {
    const distance = levenshteinDistance(input, phrase);
    const maxLen = Math.max(input.length, phrase.length);
    const similarity = 1 - (distance / maxLen);
    
    // Threshold for "close match" is 0.6
    if (similarity >= 0.5 && distance <= 3) {
      suggestions.push({
        phrase,
        input,
        similarity: Math.round(similarity * 100) / 100,
        distance
      });
    }
  }
  
  return suggestions
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(s => s.phrase);
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Distance
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
 * Generate help text for unrecognized input
 * @param {string} input - User input
 * @returns {string} Help text
 */
function generateHelp(input) {
  const normalizedInput = (input || '').toLowerCase().trim();
  
  let help = `Unrecognized input: "${input || '(empty)'}"\n\n`;
  help += 'Available intents:\n';
  help += '  plan    - Create plans, add phases, new milestones\n';
  help += '  execute - Run phases, tests, resume work\n';
  help += '  verify  - Check work, validate state\n';
  help += '  query   - Show progress, roadmap, status\n\n';
  help += 'Try phrases like:\n';
  help += '  "plan phase 5"\n';
  help += '  "show progress"\n';
  help += '  "run tests"\n';
  help += '  "verify work"';
  
  return help;
}

module.exports = { getFallbackSuggestions, generateHelp, getCommandsForIntent };
