// NL Parser - Main entry point for natural language command parsing
// Orchestrates intent classification, parameter extraction, fuzzy matching, and help fallback

const { classifyIntent } = require('./intent-classifier.js');
const { extractPhaseNumber, extractFlags, extractTarget } = require('./parameter-extractor.js');
const { PHRASES, ALIASES } = require('./command-registry.js');
const { FuzzyResolver } = require('./fuzzy-resolver.js');
const { getFallbackSuggestions, generateHelp, getLearnedPreference } = require('./help-fallback.js');

// Learning boost constant
const LEARNING_BOOST = 0.15; // Boost confidence when user previously chose this option

// Shared fuzzy resolver instance
let fuzzyResolver = null;

/**
 * Get or create the fuzzy resolver
 * @returns {FuzzyResolver}
 */
function getFuzzyResolver() {
  if (!fuzzyResolver) {
    fuzzyResolver = new FuzzyResolver(PHRASES);
    fuzzyResolver.initialize(PHRASES);
  }
  return fuzzyResolver;
}

/**
 * Check if input looks like natural language (not a short alias)
 * @param {string} input - User input
 * @returns {boolean}
 */
function isNaturalLanguage(input) {
  if (!input || typeof input !== 'string') return false;
  
  const trimmed = input.trim();
  
  // Check for short alias first (priority)
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  if (ALIASES[firstWord] && trimmed.split(/\s+/).length === 1) {
    return false;
  }
  
  // Natural language has multiple words or contains spaces with longer phrases
  return trimmed.includes(' ') || trimmed.length > 10;
}

/**
 * Check if input is a short alias
 * @param {string} input - User input
 * @returns {Object|null} {alias, command} or null
 */
function resolveAlias(input) {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  
  if (ALIASES[firstWord]) {
    const remaining = trimmed.slice(firstWord.length).trim();
    return {
      alias: firstWord,
      command: ALIASES[firstWord],
      remaining
    };
  }
  
  return null;
}

/**
 * Find exact phrase match in registry
 * @param {string} input - User input
 * @returns {Object|null} Match result
 */
function findExactPhraseMatch(input) {
  const normalized = input.toLowerCase().trim();
  
  for (const phrase of PHRASES) {
    if (phrase.phrase === normalized) {
      return {
        ...phrase,
        matchType: 'exact',
        confidence: 1.0
      };
    }
  }
  
  return null;
}

/**
 * Parse natural language input into a command
 * @param {string} input - User input string
 * @param {Object} options - Parse options
 * @param {boolean} [options.forceNL=false] - Force NL parsing even for aliases
 * @returns {Object} Parsed result
 */
function parse(input, options = {}) {
  const { forceNL = false } = options;
  
  // Handle empty input
  if (!input || typeof input !== 'string' || !input.trim()) {
    return {
      parsed: false,
      input: '',
      error: 'Empty input',
      suggestions: getFallbackSuggestions('')
    };
  }
  
  const trimmedInput = input.trim();
  
  // Check for short alias first (priority, unless forceNL)
  if (!forceNL) {
    const aliasResult = resolveAlias(trimmedInput);
    if (aliasResult) {
      const phase = extractPhaseNumber(aliasResult.remaining);
      const flags = extractFlags(aliasResult.remaining);
      const target = extractTarget(aliasResult.remaining);
      
      return {
        parsed: true,
        input: trimmedInput,
        type: 'alias',
        command: aliasResult.command,
        alias: aliasResult.alias,
        params: {
          phase,
          flags,
          target
        },
        confidence: 1.0,
        intent: getIntentFromCommand(aliasResult.command)
      };
    }
  }
  
  // Try exact phrase match
  const exactMatch = findExactPhraseMatch(trimmedInput);
  if (exactMatch) {
    const phase = extractPhaseNumber(trimmedInput);
    const flags = extractFlags(trimmedInput);
    const target = extractTarget(trimmedInput, { intent: exactMatch.intent });
    
    return {
      parsed: true,
      input: trimmedInput,
      type: 'exact_phrase',
      command: exactMatch.command,
      intent: exactMatch.intent,
      params: {
        phase,
        flags,
        target
      },
      confidence: exactMatch.confidence
    };
  }
  
  // Use fuzzy matching for natural language input
  const resolver = getFuzzyResolver();
  const fuzzyResults = resolver.resolve(trimmedInput);
  
  // Check for learned preference to boost confidence
  const learnedChoice = getLearnedPreference(trimmedInput.toLowerCase().trim());
  
  if (fuzzyResults.length > 0) {
    const best = fuzzyResults[0];
    
    // Apply learning boost if user's previous choice matches this result
    let confidence = best.confidence;
    let hasLearningBoost = false;
    
    if (learnedChoice && best.command === learnedChoice) {
      confidence = Math.min(confidence + LEARNING_BOOST, 1.0);
      hasLearningBoost = true;
    }
    
    // Check if confidence is high enough
    if (confidence >= 0.6) {
      const phase = extractPhaseNumber(trimmedInput);
      const flags = extractFlags(trimmedInput);
      const target = extractTarget(trimmedInput, { intent: best.intent });
      
      return {
        parsed: true,
        input: trimmedInput,
        type: 'fuzzy',
        command: best.command,
        intent: best.intent,
        params: {
          phase,
          flags,
          target
        },
        confidence,
        hasLearningBoost,
        score: best.score,
        choices: fuzzyResults.slice(0, 3).map(r => ({
          command: r.command,
          intent: r.intent,
          phrase: r.phrase,
          confidence: r.confidence
        }))
      };
    } else {
      // Low confidence - show disambiguation, but boost if learned choice present
      const choices = fuzzyResults.slice(0, 5).map(r => ({
        command: r.command,
        intent: r.intent,
        phrase: r.phrase,
        confidence: r.command === learnedChoice ? Math.min(r.confidence + LEARNING_BOOST, 1.0) : r.confidence
      }));
      
      return {
        parsed: false,
        input: trimmedInput,
        type: 'low_confidence',
        confidence,
        hasLearningBoost,
        choices,
        suggestions: getFallbackSuggestions(trimmedInput, { intent: null })
      };
    }
  }
  
  // No match - fall back to help
  return {
    parsed: false,
    input: trimmedInput,
    type: 'unrecognized',
    error: 'No matching command found',
    help: generateHelp(trimmedInput),
    suggestions: getFallbackSuggestions(trimmedInput)
  };
}

/**
 * Get intent from command string
 * @param {string} command - Command string (e.g., 'plan:phase')
 * @returns {string|null} Intent
 */
function getIntentFromCommand(command) {
  const intentMap = {
    'plan:phase': 'plan',
    'plan:roadmap': 'plan',
    'plan:milestone': 'plan',
    'milestone:new': 'plan',
    'milestone:complete': 'execute',
    'execute:phase': 'execute',
    'execute:quick': 'execute',
    'execute:commit': 'execute',
    'session:resume': 'execute',
    'verify:work': 'verify',
    'verify:phase': 'verify',
    'verify:state': 'verify',
    'session:progress': 'query',
    'session:pause': 'query',
    'roadmap:show': 'query',
    'health': 'query'
  };
  
  return intentMap[command] || null;
}

module.exports = { parse, isNaturalLanguage, resolveAlias, getFuzzyResolver };
