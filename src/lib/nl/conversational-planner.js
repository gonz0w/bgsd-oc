// Conversational Planner - Main orchestrator combining requirement extraction, 
// multi-intent detection, and suggestions

const { parseGoalDescription, generateClarifyingQuestions, extractRequirements } = require('./requirement-extractor.js');
const { detectIntents, parseCompoundCommand, sequenceIntents, detectAndParse } = require('./multi-intent-detector.js');
const { detectCommandType, getSuggestions, buildSuggestionChain } = require('./suggestion-engine.js');
const { parse: nlParse } = require('./nl-parser.js');
const fs = require('fs');
const path = require('path');

// Configuration constants
const CONFIDENCE_THRESHOLD = 0.6; // 60% - auto-execute above this
const CONTEXT_BOOST = 0.15; // Boost confidence when command aligns with current phase

// Cached context for fast lookup
let contextCache = null;
let contextCacheTime = 0;
const CONTEXT_CACHE_TTL = 60000; // 1 minute TTL

/**
 * Get project context from STATE.md
 * @returns {Object} Context {currentPhase, milestone, recentCommands}
 */
function getProjectContext() {
  const now = Date.now();
  
  // Return cached context if still fresh
  if (contextCache && (now - contextCacheTime) < CONTEXT_CACHE_TTL) {
    return contextCache;
  }
  
  try {
    const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
    
    if (!fs.existsSync(statePath)) {
      return { currentPhase: null, milestone: null, recentCommands: [] };
    }
    
    const content = fs.readFileSync(statePath, 'utf8');
    
    // Extract current phase from STATE.md
    const phaseMatch = content.match(/\*\*Phase:\*\*\s*(\d+[-\w]+)/);
    const currentPhase = phaseMatch ? phaseMatch[1] : null;
    
    // Extract milestone
    const milestoneMatch = content.match(/\|v?[\d.]+\s*\|\s*(\d+[-\w]+)\s*\|.*?\|.*?\|.*?\|/);
    const milestone = milestoneMatch ? milestoneMatch[1] : null;
    
    // Extract recent completed plans/commands
    const recentCommands = [];
    const lastSessionMatch = content.match(/\*\*Last session:\*\*\s*([^\n]+)/);
    const lastActivityMatch = content.match(/\*\*Last Activity:\*\*\s*([^\n]+)/);
    
    contextCache = {
      currentPhase,
      milestone,
      recentCommands,
      lastSession: lastSessionMatch ? lastSessionMatch[1].trim() : null,
      lastActivity: lastActivityMatch ? lastActivityMatch[1].trim() : null
    };
    contextCacheTime = now;
    
    return contextCache;
  } catch (error) {
    return { currentPhase: null, milestone: null, recentCommands: [] };
  }
}

/**
 * Calculate context-based confidence boost
 * If command aligns with current project phase, boost confidence
 * @param {Object} parsedResult - Result from nlParse
 * @param {Object} context - Project context
 * @returns {number} Confidence boost (0-0.3)
 */
function calculateContextBoost(parsedResult, context) {
  if (!context || !context.currentPhase) {
    return 0;
  }
  
  const { command, params } = parsedResult;
  if (!command) return 0;
  
  // Extract phase number from command
  const commandPhase = params?.phase;
  
  // If user explicitly specified a phase, check if it matches current
  if (commandPhase) {
    // Normalize phase comparison (e.g., "103" matches "103-direct-command-routing")
    const currentPhaseNum = context.currentPhase.replace(/-.+$/, '');
    if (String(commandPhase) === currentPhaseNum) {
      return CONTEXT_BOOST;
    }
    return 0;
  }
  
  // If no explicit phase, check if command intent matches current phase context
  // E.g., if in planning phase, boost "plan" commands
  const phaseNum = context.currentPhase.match(/^(\d+)/)?.[1];
  if (!phaseNum) return 0;
  
  // Infer intent from command
  const intentMap = {
    'plan': ['plan:phase', 'plan:roadmap', 'milestone:new'],
    'execute': ['execute:phase', 'execute:quick', 'execute:commit', 'session:resume'],
    'verify': ['verify:work', 'verify:phase', 'verify:state']
  };
  
  for (const [intent, commands] of Object.entries(intentMap)) {
    if (commands.includes(command)) {
      // Boost based on phase range (rough heuristic)
      // Planning phases (100-109) boost plan commands
      // Execution phases boost execute commands
      const phaseNumInt = parseInt(phaseNum, 10);
      if (intent === 'plan' && phaseNumInt >= 100 && phaseNumInt < 110) {
        return CONTEXT_BOOST * 0.5; // Smaller boost for inferred intent
      }
    }
  }
  
  return 0;
}

/**
 * Parse goal description - main entry point
 * @param {string} text - User's goal description
 * @param {Object} options - Options {answers: {}, bypassClarification: boolean}
 * @returns {Object} Parsed result with clarifying questions or requirements
 */
function parseGoal(text, options = {}) {
  const { answers, bypassClarification = false } = options;
  
  if (!text || typeof text !== 'string') {
    return {
      type: 'error',
      message: 'Empty input',
      suggestions: getSuggestions('utility'),
      confidence: 0
    };
  }

  const trimmed = text.trim();

  // First check if it's a compound command
  const intentDetection = detectIntents(trimmed);
  if (intentDetection.isCompound) {
    return handleCompoundCommand(trimmed, { bypassClarification });
  }

  // Check if it looks like a goal description (natural language)
  // Goal descriptions typically have: multiple words, specific patterns
  const isGoalDescription = /^(i want|i need|i'd like|i should|can you|please|help me|add|create|build|implement)/i.test(trimmed) 
    || (trimmed.split(/\s+/).length > 3 && !/^(plan|exec|verify|test|debug|run)/i.test(trimmed));

  if (isGoalDescription) {
    // Use requirement extractor
    const parsed = parseGoalDescription(trimmed);
    
    // If bypassClarification is true, skip clarifying questions and extract requirements directly
    if (bypassClarification) {
      const requirements = extractRequirements(trimmed, answers || {});
      return {
        type: 'requirements',
        requirements,
        suggestions: getSuggestions('planning'),
        confidence: 0.95 // High confidence for direct requirement extraction
      };
    }
    
    const questions = generateClarifyingQuestions(parsed);
    
    if (questions.length > 0 && !answers) {
      // Return clarifying questions
      return {
        type: 'clarifying_questions',
        questions,
        parsed,
        suggestions: getSuggestions('utility'),
        confidence: 0.5 // Medium confidence - needs clarification
      };
    }

    // Build requirements from answers
    const requirements = extractRequirements(trimmed, answers || {});
    return {
      type: 'requirements',
      requirements,
      suggestions: getSuggestions('planning'),
      confidence: 0.9 // High confidence once requirements extracted
    };
  }

  // Fall back to standard NL parser
  const parsed = nlParse(trimmed);
  
  // Add context-based confidence boost
  let confidence = parsed.confidence || 0;
  let autoExecute = false;
  
  // If bypassClarification is true (from direct routing), always execute
  if (bypassClarification) {
    autoExecute = true;
    confidence = Math.min(confidence + 0.2, 1.0);
  } else {
    // Get project context for confidence boost
    const context = getProjectContext();
    const contextBoost = calculateContextBoost(parsed, context);
    confidence = Math.min(confidence + contextBoost, 1.0);
    
    // Threshold-based auto-execution: >= 60% = auto, < 60% = prompt
    autoExecute = confidence >= CONFIDENCE_THRESHOLD;
  }
  
  return {
    type: 'command',
    parsed,
    suggestions: getSuggestions(parsed.command || 'utility'),
    confidence,
    autoExecute,
    threshold: CONFIDENCE_THRESHOLD
  };
}

/**
 * Handle compound commands using multi-intent-detector
 * @param {string} text - Compound command text
 * @param {Object} options - Options {bypassClarification: boolean}
 * @returns {Object} Parsed result with intents
 */
function handleCompoundCommand(text, options = {}) {
  const { bypassClarification = false } = options;
  const parsed = parseCompoundCommand(text);
  const sequenced = sequenceIntents(parsed);
  const chain = buildSuggestionChain(sequenced);

  // Check for missing phase numbers
  const missingPhase = sequenced.some(i => !i.target || i.target === 'current');
  
  // If bypassClarification is true, skip asking for phase and use defaults
  if (missingPhase && !text.match(/phase\s*\d+/i) && !bypassClarification) {
    return {
      type: 'needs_phase',
      message: 'Which phase?',
      intents: sequenced,
      clarification: 'Please specify a phase number for the command(s)',
      suggestions: getSuggestions('utility'),
      confidence: 0.4,
      autoExecute: false
    };
  }

  // Build suggestion chain
  return {
    type: 'compound',
    intents: sequenced,
    chain: chain.chain,
    missingLinks: chain.missing,
    suggestions: getSuggestions(sequenced[sequenced.length - 1].intent),
    confidence: 0.85,
    autoExecute: true // Compound commands with phase specified are auto-executable
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
  buildSuggestionChain,
  // New exports for confidence and context
  getProjectContext,
  calculateContextBoost,
  CONFIDENCE_THRESHOLD
};
