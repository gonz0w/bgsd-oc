// Conversational Planner - Main orchestrator combining requirement extraction, 
// multi-intent detection, and suggestions

const { parseGoalDescription, generateClarifyingQuestions, extractRequirements } = require('./requirement-extractor.js');
const { detectIntents, parseCompoundCommand, sequenceIntents, detectAndParse } = require('./multi-intent-detector.js');
const { detectCommandType, getSuggestions, buildSuggestionChain } = require('./suggestion-engine.js');
const { parse: nlParse } = require('./nl-parser.js');

/**
 * Parse goal description - main entry point
 * @param {string} text - User's goal description
 * @param {Object} options - Options {answers: {}}
 * @returns {Object} Parsed result with clarifying questions or requirements
 */
function parseGoal(text, options = {}) {
  const { answers } = options;
  
  if (!text || typeof text !== 'string') {
    return {
      type: 'error',
      message: 'Empty input',
      suggestions: getSuggestions('utility')
    };
  }

  const trimmed = text.trim();

  // First check if it's a compound command
  const intentDetection = detectIntents(trimmed);
  if (intentDetection.isCompound) {
    return handleCompoundCommand(trimmed);
  }

  // Check if it looks like a goal description (natural language)
  // Goal descriptions typically have: multiple words, specific patterns
  const isGoalDescription = /^(i want|i need|i'd like|i should|can you|please|help me|add|create|build|implement)/i.test(trimmed) 
    || (trimmed.split(/\s+/).length > 3 && !/^(plan|exec|verify|test|debug|run)/i.test(trimmed));

  if (isGoalDescription) {
    // Use requirement extractor
    const parsed = parseGoalDescription(trimmed);
    const questions = generateClarifyingQuestions(parsed);
    
    if (questions.length > 0 && !answers) {
      // Return clarifying questions
      return {
        type: 'clarifying_questions',
        questions,
        parsed,
        suggestions: getSuggestions('utility')
      };
    }

    // Build requirements from answers
    const requirements = extractRequirements(trimmed, answers || {});
    return {
      type: 'requirements',
      requirements,
      suggestions: getSuggestions('planning')
    };
  }

  // Fall back to standard NL parser
  const parsed = nlParse(trimmed);
  return {
    type: 'command',
    parsed,
    suggestions: getSuggestions(parsed.command || 'utility')
  };
}

/**
 * Handle compound commands using multi-intent-detector
 * @param {string} text - Compound command text
 * @returns {Object} Parsed result with intents
 */
function handleCompoundCommand(text) {
  const parsed = parseCompoundCommand(text);
  const sequenced = sequenceIntents(parsed);
  const chain = buildSuggestionChain(sequenced);

  // Check for missing phase numbers
  const missingPhase = sequenced.some(i => !i.target || i.target === 'current');
  
  if (missingPhase && !text.match(/phase\s*\d+/i)) {
    return {
      type: 'needs_phase',
      message: 'Which phase?',
      intents: sequenced,
      clarification: 'Please specify a phase number for the command(s)',
      suggestions: getSuggestions('utility')
    };
  }

  // Build suggestion chain
  return {
    type: 'compound',
    intents: sequenced,
    chain: chain.chain,
    missingLinks: chain.missing,
    suggestions: getSuggestions(sequenced[sequenced.length - 1].intent)
  };
}

/**
 * Get next suggestions based on last command and state
 * @param {string} lastCommand - The command that was just executed
 * @param {Object} state - Current state {currentPhase, lastPhase, milestoneStatus}
 * @returns {Array} Suggestions array
 */
function getNextSuggestions(lastCommand, state = {}) {
  const commandType = detectCommandType(lastCommand);
  return getSuggestions(commandType, state);
}

module.exports = {
  parseGoal,
  handleCompoundCommand,
  getNextSuggestions,
  // Re-export for convenience
  parseGoalDescription,
  generateClarifyingQuestions,
  extractRequirements,
  detectIntents,
  parseCompoundCommand,
  sequenceIntents,
  detectCommandType,
  getSuggestions,
  buildSuggestionChain
};
