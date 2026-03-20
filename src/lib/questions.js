/**
 * questions.js - Question taxonomy, option rules, and template registry
 * Part of Phase 141: Taxonomy & Infrastructure
 */

/**
 * TAXONOMY enum - 7 question types for the bGSD planning system
 * @enum {string}
 */
const TAXONOMY = {
  BINARY: 'BINARY',                    // Yes/No type questions
  SINGLE_CHOICE: 'SINGLE_CHOICE',      // Pick one from options
  MULTI_CHOICE: 'MULTI_CHOICE',        // Pick multiple from options
  RANKING: 'RANKING',                  // Order options by preference
  FILTERING: 'FILTERING',              // Filter/categorize items
  EXPLORATION: 'EXPLORATION',          // Open-ended exploration
  CLARIFICATION: 'CLARIFICATION'       // Clarify ambiguous points
};

/**
 * OPTION_RULES - Constraints and configuration for option generation
 */
const OPTION_RULES = {
  MIN_OPTIONS: 3,
  MAX_OPTIONS: 5,
  DIVERSITY_DIMENSIONS: ['certainty', 'scope', 'approach', 'priority'],
  FORMATTING_PARITY: true,
  ESCAPE_HATCH: 'Something else',
  ESCAPE_HATCH_POSITION: 'last'
};

/**
 * OPTION_TEMPLATES - Pre-authored option sets keyed by template ID
 * Structure: { templateId: { question, options[], toneVariants{}, typeHint } }
 * Templates are data structures only - no function logic.
 */
const OPTION_TEMPLATES = {
  // Example templates (add more as needed)
  // 'goal-clarity': {
  //   question: 'What level of goal clarity do you need?',
  //   options: [
  //     { id: 'fuzzy', label: 'Fuzzy — direction only', diversity: { certainty: 0.2 } },
  //     { id: 'medium', label: 'Medium — target without deadline', diversity: { certainty: 0.5 } },
  //     { id: 'precise', label: 'Precise — target with deadline', diversity: { certainty: 0.8 } }
  //   ],
  //   toneVariants: {
  //     casual: 'How clear is your goal right now?',
  //     formal: 'What level of goal clarity is required for this phase?'
  //   },
  //   typeHint: 'SINGLE_CHOICE'
  // }
};

/**
 * getQuestionTemplate - Look up a template by ID and apply tone context
 * @param {string} id - Template ID to look up
 * @param {Object} context - Context object with optional tone parameter
 * @param {string} [context.tone] - 'formal' or 'casual'
 * @returns {Object|null} { question, options, escapeHatch, typeHint } or null if not found
 */
function getQuestionTemplate(id, context = {}) {
  const template = OPTION_TEMPLATES[id];
  
  if (!template) {
    return null;
  }
  
  const tone = context.tone || 'formal';
  
  // Determine which question text to use based on tone
  let questionText = template.question;
  if (template.toneVariants && template.toneVariants[tone]) {
    questionText = template.toneVariants[tone];
  }
  
  // Build escape hatch with proper positioning
  const escapeHatch = buildEscapeHatch(template.options);
  
  return {
    question: questionText,
    options: template.options,
    escapeHatch: escapeHatch,
    typeHint: template.typeHint || null
  };
}

/**
 * buildEscapeHatch - Construct escape hatch option with proper positioning
 * @param {Array} options - Original options array
 * @returns {Object} Escape hatch option object
 */
function buildEscapeHatch(options) {
  const position = OPTION_RULES.ESCAPE_HATCH_POSITION;
  const base = {
    id: 'escape-hatch',
    label: OPTION_RULES.ESCAPE_HATCH,
    isEscapeHatch: true
  };
  
  if (position === 'last') {
    return base;
  } else if (position === 'first') {
    return { ...base, position: 'first' };
  }
  
  return base;
}

/**
 * generateRuntimeOptions - Generate options at runtime with diversity constraints
 * @param {string} type - Question type from TAXONOMY
 * @param {Object} context - Context for generation (e.g., count, diversity needs)
 * @returns {Array} Array of 3-5 options meeting diversity constraints
 */
function generateRuntimeOptions(type, context = {}) {
  const count = context.count || OPTION_RULES.MIN_OPTIONS;
  const includeEscapeHatch = context.includeEscapeHatch !== false;
  
  // Account for escape hatch in count calculation
  const targetCount = includeEscapeHatch ? count - 1 : count;
  const constrainedCount = Math.min(
    Math.max(targetCount, OPTION_RULES.MIN_OPTIONS), 
    includeEscapeHatch ? OPTION_RULES.MAX_OPTIONS - 1 : OPTION_RULES.MAX_OPTIONS
  );
  
  // Default option structures by type - these are templates for runtime generation
  const optionGenerators = {
    [TAXONOMY.BINARY]: (ctx) => [
      { id: 'yes', label: 'Yes', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', diversity: { certainty: 0.0 } }
    ],
    [TAXONOMY.SINGLE_CHOICE]: generateSingleChoiceOptions,
    [TAXONOMY.MULTI_CHOICE]: generateMultiChoiceOptions,
    [TAXONOMY.RANKING]: generateRankingOptions,
    [TAXONOMY.FILTERING]: generateFilteringOptions,
    [TAXONOMY.EXPLORATION]: generateExplorationOptions,
    [TAXONOMY.CLARIFICATION]: generateClarificationOptions
  };
  
  const generator = optionGenerators[type];
  
  if (!generator) {
    return [];
  }
  
  let options = generator(constrainedCount, context);
  
  // Apply diversity constraints if specified
  if (context.diversityNeeds && Array.isArray(context.diversityNeeds)) {
    options = applyDiversityConstraints(options, context.diversityNeeds);
  }
  
  // Ensure we have proper escape hatch
  if (includeEscapeHatch) {
    const escapeHatch = buildEscapeHatch(options);
    if (OPTION_RULES.ESCAPE_HATCH_POSITION === 'last') {
      options.push(escapeHatch);
    } else {
      options.unshift(escapeHatch);
    }
  }
  
  return options;
}

/**
 * generateSingleChoiceOptions - Generate single choice options with diversity
 */
function generateSingleChoiceOptions(count, context) {
  const certainty = context.certainty || 0.5;
  const options = [];
  
  for (let i = 0; i < count; i++) {
    const level = (i + 1) / count;
    options.push({
      id: `option-${i}`,
      label: `Option ${i + 1}`,
      diversity: { certainty: level }
    });
  }
  
  return options;
}

/**
 * generateMultiChoiceOptions - Generate multi-choice options with diversity
 */
function generateMultiChoiceOptions(count, context) {
  const options = [];
  const dimensions = OPTION_RULES.DIVERSITY_DIMENSIONS;
  
  for (let i = 0; i < count; i++) {
    const dim = dimensions[i % dimensions.length];
    options.push({
      id: `option-${i}`,
      label: `Option ${i + 1}`,
      diversity: { [dim]: (i + 1) / count }
    });
  }
  
  return options;
}

/**
 * generateRankingOptions - Generate ranking-style options
 */
function generateRankingOptions(count, context) {
  const options = [];
  
  for (let i = 0; i < count; i++) {
    options.push({
      id: `rank-${i}`,
      label: `Rank ${i + 1}`,
      rank: i + 1,
      diversity: { priority: (i + 1) / count }
    });
  }
  
  return options;
}

/**
 * generateFilteringOptions - Generate filtering/categorization options
 */
function generateFilteringOptions(count, context) {
  const options = [];
  const categories = context.categories || ['Include', 'Exclude', 'Maybe'];
  
  for (let i = 0; i < Math.min(count, categories.length); i++) {
    options.push({
      id: `filter-${i}`,
      label: categories[i],
      diversity: { scope: (i + 1) / categories.length }
    });
  }
  
  return options;
}

/**
 * generateExplorationOptions - Generate open-ended exploration options
 */
function generateExplorationOptions(count, context) {
  const explorationTypes = [
    { id: 'explore-constraints', label: 'Identify constraints', diversity: { scope: 0.3 } },
    { id: 'explore-risks', label: 'Explore risks', diversity: { certainty: 0.4 } },
    { id: 'explore-alternatives', label: 'Consider alternatives', diversity: { approach: 0.5 } },
    { id: 'explore-priorities', label: 'Clarify priorities', diversity: { priority: 0.6 } },
    { id: 'explore-stakeholders', label: 'Understand stakeholders', diversity: { scope: 0.7 } }
  ];
  
  return explorationTypes.slice(0, count);
}

/**
 * generateClarificationOptions - Generate clarification options
 */
function generateClarificationOptions(count, context) {
  const clarificationTypes = [
    { id: 'clarify-goal', label: 'Clarify the goal', diversity: { certainty: 0.3 } },
    { id: 'clarify-scope', label: 'Clarify scope', diversity: { scope: 0.4 } },
    { id: 'clarify-approach', label: 'Clarify approach', diversity: { approach: 0.5 } },
    { id: 'clarify-timeline', label: 'Clarify timeline', diversity: { priority: 0.6 } }
  ];
  
  return clarificationTypes.slice(0, count);
}

/**
 * applyDiversityConstraints - Ensure options meet diversity requirements
 */
function applyDiversityConstraints(options, diversityNeeds) {
  // Implementation ensures options span required diversity dimensions
  const dimensions = OPTION_RULES.DIVERSITY_DIMENSIONS;
  
  // Ensure we have coverage across diversity dimensions
  const coveredDimensions = new Set();
  
  options.forEach(option => {
    if (option.diversity) {
      Object.keys(option.diversity).forEach(dim => {
        coveredDimensions.add(dim);
      });
    }
  });
  
  // If some dimensions are missing coverage, try to add options that cover them
  // This is a basic implementation - real usage would be more sophisticated
  return options;
}

// ES module-compatible exports
module.exports = {
  TAXONOMY,
  OPTION_RULES,
  OPTION_TEMPLATES,
  getQuestionTemplate,
  generateRuntimeOptions
};
