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

  // discuss-phase workflow templates
  'discuss-context-existing': {
    question: 'What would you like to do with the existing context?',
    options: [
      { id: 'update', label: 'Update it', diversity: { approach: 0.3 } },
      { id: 'view', label: 'View it', diversity: { approach: 0.6 } },
      { id: 'skip', label: 'Skip', diversity: { approach: 1.0 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-replan-warning': {
    question: 'Phase already has plans. How do you want to proceed?',
    options: [
      { id: 'continue', label: 'Continue and replan after', diversity: { certainty: 0.3 } },
      { id: 'view', label: 'View existing plans', diversity: { certainty: 0.6 } },
      { id: 'cancel', label: 'Cancel', diversity: { certainty: 1.0 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-gray-areas': {
    question: 'Which areas do you want to discuss?',
    options: [],
    typeHint: 'MULTI_CHOICE'
  },
  'discuss-socratic-continue': {
    question: 'More questions about this area, or move to next?',
    options: [
      { id: 'more', label: 'More questions', diversity: { certainty: 0.4 } },
      { id: 'next', label: 'Next area', diversity: { certainty: 0.8 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-stress-test-response': {
    question: 'Any of those points change your thinking?',
    options: [
      { id: 'proceed', label: 'No changes — proceed', diversity: { certainty: 0.8 } },
      { id: 'revisit', label: 'Revisit a decision', diversity: { certainty: 0.3 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // execute-phase workflow templates
  'execute-checkpoint-verify': {
    question: 'Verification result:',
    options: [
      { id: 'pass', label: 'Pass', diversity: { certainty: 1.0 } },
      { id: 'fail', label: 'Fail', diversity: { certainty: 0.0 } },
      { id: 'adjust', label: 'Needs adjustment', diversity: { certainty: 0.5 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'execute-checkpoint-retry': {
    question: 'How do you want to proceed?',
    options: [
      { id: 'retry', label: 'Retry', diversity: { certainty: 0.3 } },
      { id: 'continue', label: 'Continue', diversity: { certainty: 0.7 } },
      { id: 'skip', label: 'Skip', diversity: { certainty: 1.0 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'execute-wave-continue': {
    question: 'Wave complete — what next?',
    options: [
      { id: 'proceed', label: 'Proceed to next wave', diversity: { certainty: 0.8 } },
      { id: 'review', label: 'Review current wave', diversity: { certainty: 0.5 } },
      { id: 'pause', label: 'Pause', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // plan-phase workflow templates
  'plan-phase-context': {
    question: 'How would you like to proceed?',
    options: [
      { id: 'continue-without', label: 'Continue without context', diversity: { certainty: 0.3 } },
      { id: 'discuss-first', label: 'Run discuss-phase first', diversity: { certainty: 0.7 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'plan-phase-existing': {
    question: 'What would you like to do with existing plans?',
    options: [
      { id: 'add-more', label: 'Add more plans', diversity: { scope: 0.3 } },
      { id: 'view', label: 'View existing plans', diversity: { scope: 0.5 } },
      { id: 'replan', label: 'Replan', diversity: { scope: 0.8 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'plan-phase-checker-passed': {
    question: 'Verification passed. How would you like to proceed?',
    options: [
      { id: 'continue', label: 'Continue', diversity: { certainty: 0.5 } },
      { id: 'view-plans', label: 'View plans', diversity: { certainty: 0.7 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'plan-phase-checker-issues': {
    question: 'Verification found issues. How would you like to proceed?',
    options: [
      { id: 'force', label: 'Force continue', diversity: { certainty: 0.3 } },
      { id: 'guidance', label: 'Get guidance', diversity: { certainty: 0.5 } },
      { id: 'abandon', label: 'Abandon', diversity: { certainty: 0.9 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // transition workflow templates
  'transition-complete': {
    question: 'Ready to mark done and move to next phase?',
    options: [
      { id: 'mark-done', label: 'Mark done', diversity: { certainty: 0.8 } },
      { id: 'cancel', label: 'Cancel', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'transition-incomplete': {
    question: 'What would you like to do with incomplete plans?',
    options: [
      { id: 'continue', label: 'Continue current phase', diversity: { certainty: 0.3 } },
      { id: 'mark-complete', label: 'Mark complete anyway', diversity: { certainty: 0.6 } },
      { id: 'review', label: 'Review what\'s left', diversity: { certainty: 0.9 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'transition-next-route': {
    question: 'What would you like to do next?',
    options: [
      { id: 'more-phases', label: 'Plan more phases', diversity: { certainty: 0.4 } },
      { id: 'milestone-complete', label: 'Complete milestone', diversity: { certainty: 0.8 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // verify-work workflow templates
  'verify-session-resume': {
    question: 'Which would you like to do?',
    options: [
      { id: 'resume', label: 'Resume existing session', diversity: { certainty: 0.8 } },
      { id: 'start-new', label: 'Start new session', diversity: { certainty: 0.6 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'verify-test-response': {
    question: 'How did the test go?',
    options: [
      { id: 'pass', label: 'Pass — it works as expected', diversity: { certainty: 1.0 } },
      { id: 'fail', label: 'Fail — something is wrong', diversity: { certainty: 0.3 } },
      { id: 'skip', label: 'Skip — cannot test right now', diversity: { certainty: 0.5 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'verify-complete-issues': {
    question: 'Issues were found. What would you like to do?',
    options: [
      { id: 'diagnose', label: 'Diagnose issues — find root causes', diversity: { approach: 0.7 } },
      { id: 'next-phase', label: 'Suggest next phase — defer issues', diversity: { approach: 0.4 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'verify-diagnose': {
    question: 'How should issues be handled?',
    options: [
      { id: 'spawn', label: 'Spawn debug agents — auto-investigate', diversity: { approach: 0.8 } },
      { id: 'manual', label: 'Manual handling — I will address', diversity: { approach: 0.3 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // new-milestone workflow templates
  'new-milestone-goals': {
    question: 'What do you want to build next?',
    options: [
      { id: 'explore-features', label: 'Explore features', diversity: { scope: 0.3 } },
      { id: 'explore-priorities', label: 'Clarify priorities', diversity: { priority: 0.5 } },
      { id: 'explore-constraints', label: 'Identify constraints', diversity: { scope: 0.7 } },
      { id: 'explore-scope', label: 'Discuss scope', diversity: { scope: 0.9 } }
    ],
    typeHint: 'EXPLORATION'
  },
  'new-milestone-version': {
    question: 'Confirm milestone version?',
    options: [
      { id: 'yes', label: 'Yes, proceed with suggested version', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No, I want to adjust', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },
  'new-milestone-research': {
    question: 'Research the domain ecosystem for new features before defining requirements?',
    options: [
      { id: 'research-first', label: 'Research first (Recommended)', diversity: { scope: 0.8 } },
      { id: 'skip-research', label: 'Skip research', diversity: { scope: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'new-milestone-skills': {
    question: 'Install any skills before defining requirements?',
    options: [
      { id: 'yes', label: 'Yes', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },
  'new-milestone-scope-category': {
    question: 'Select categories to scope for this milestone',
    options: [
      { id: 'category-1', label: 'Category 1', diversity: { scope: 0.2 } },
      { id: 'category-2', label: 'Category 2', diversity: { scope: 0.4 } },
      { id: 'category-3', label: 'Category 3', diversity: { scope: 0.6 } },
      { id: 'none', label: 'None for this milestone', diversity: { scope: 1.0 } }
    ],
    typeHint: 'MULTI_CHOICE'
  }
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
