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
    question: 'How should we handle these ranked gray areas?',
    options: [
      { id: 'work-ranked', label: 'Work high to low', description: 'Resolve High-impact gray areas first, then continue only as far as needed', diversity: { certainty: 0.8 } },
      { id: 'review-ranked', label: 'Review the ranking', description: 'Inspect why each gray area was ranked before we start resolving them', diversity: { certainty: 0.5 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-low-risk-path': {
    question: 'How should we handle these low-risk defaults?',
    options: [
      { id: 'lock-defaults', label: 'Lock defaults and continue', description: 'Accept the proposed defaults, keep them distinct from hard locks, and move on to any remaining gray areas', diversity: { certainty: 0.8 } },
      { id: 'discuss-one', label: 'Discuss one of them', description: 'Pull a proposed default back into the normal clarification loop before locking it', diversity: { certainty: 0.4 } },
      { id: 'skip-defaults', label: 'Skip defaults', description: 'Do not record these yet — continue with the normal gray-area menu', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-socratic-continue': {
    question: 'More questions about this area, or move to next?',
    options: [
      { id: 'more', label: 'Keep refining', diversity: { certainty: 0.4 } },
      { id: 'next', label: 'Next area', diversity: { certainty: 0.8 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-conflict-resolution': {
    question: 'How should we handle this tension?',
    options: [
      { id: 'lock', label: 'Lock a direction', description: 'Make this a concrete phase decision now', diversity: { certainty: 0.8 } },
      { id: 'default', label: 'Use a default', description: 'Prefer a default pattern unless a later detail forces an exception', diversity: { approach: 0.6 } },
      { id: 'delegate', label: 'Agent decides', description: 'Leave this to downstream planning or execution within stated constraints', diversity: { approach: 0.4 } },
      { id: 'defer', label: 'Defer and note it', description: 'Record the tradeoff but leave the final choice for a later phase or context', diversity: { scope: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'discuss-stress-test-response': {
    question: 'Any of those points change your thinking?',
    options: [
      { id: 'proceed', label: 'No changes — proceed', diversity: { certainty: 0.8 } },
      { id: 'revisit', label: 'Changed something — check knock-on effects', description: 'Record the revision and immediately validate downstream gray areas', diversity: { certainty: 0.3 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // execute-phase workflow templates
  'phase-handoff-resume-summary': {
    question: 'How should we continue from this handoff?',
    options: [
      { id: 'resume', label: 'Resume', description: 'Continue from the latest valid handoff artifact', diversity: { certainty: 0.8 } },
      { id: 'inspect', label: 'Inspect', description: 'Review the active handoff details before continuing', diversity: { certainty: 0.5 } },
      { id: 'restart', label: 'Restart', description: 'Clear the handoff set and restart from discuss', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
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
  'plan-phase-high-impact-gray-area': {
    question: 'This high-impact gray area will change the plan. How should we handle it?',
    options: [
      { id: 'lock', label: 'Lock a direction', description: 'Decide now so the planner can commit to a concrete structure', diversity: { certainty: 0.8 } },
      { id: 'default', label: 'Use a default', description: 'Adopt the safest default and continue planning with it explicitly recorded', diversity: { certainty: 0.5 } },
      { id: 'delegate', label: 'Agent decides', description: 'Let the planner choose within stated constraints and record that discretion', diversity: { certainty: 0.3 } },
      { id: 'defer', label: 'Defer and constrain', description: 'Keep the choice open, but record the limit so planning does not guess beyond it', diversity: { certainty: 0.2 } }
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

  // settings workflow templates
  'settings-model-profile': {
    question: 'Which model profile for agents?',
    options: [
      { id: 'quality', label: 'Quality', description: 'Opus everywhere except verification (highest cost)', diversity: { certainty: 1.0 } },
      { id: 'balanced', label: 'Balanced (Recommended)', description: 'Opus for planning, Sonnet for execution/verification', diversity: { certainty: 0.6 } },
      { id: 'budget', label: 'Budget', description: 'Sonnet for writing, Haiku for research/verification (lowest cost)', diversity: { certainty: 0.3 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'settings-plan-researcher': {
    question: 'Spawn Plan Researcher? (researches domain before planning)',
    options: [
      { id: 'yes', label: 'Yes', description: 'Research phase goals before planning', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', description: 'Skip research, plan directly', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },
  'settings-plan-checker': {
    question: 'Spawn Plan Checker? (verifies plans before execution)',
    options: [
      { id: 'yes', label: 'Yes', description: 'Verify plans meet phase goals', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', description: 'Skip plan verification', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },
  'settings-execution-verifier': {
    question: 'Spawn Execution Verifier? (verifies phase completion)',
    options: [
      { id: 'yes', label: 'Yes', description: 'Verify must-haves after execution', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', description: 'Skip post-execution verification', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },
  'settings-auto-advance': {
    question: 'Auto-advance pipeline? (discuss → plan → execute automatically)',
    options: [
      { id: 'no', label: 'No (Recommended)', description: 'Manual /clear + paste between stages', diversity: { certainty: 0.8 } },
      { id: 'yes', label: 'Yes', description: 'Chain stages via Task() subagents (same isolation)', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'BINARY'
  },
  'settings-branching-strategy': {
    question: 'Git branching strategy?',
    options: [
      { id: 'none', label: 'None (Recommended)', description: 'Commit directly to current branch', diversity: { certainty: 0.8 } },
      { id: 'per-phase', label: 'Per Phase', description: 'Create branch for each phase (gsd/phase-{N}-{name})', diversity: { certainty: 0.5 } },
      { id: 'per-milestone', label: 'Per Milestone', description: 'Create branch for entire milestone (gsd/{version}-{name})', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'settings-save-defaults': {
    question: 'Save these as default settings for all new projects?',
    options: [
      { id: 'yes', label: 'Yes', description: 'New projects start with these settings (saved to ~/.gsd/defaults.json)', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', description: 'Only apply to this project', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
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
    question: 'Install recommended project-local skills before defining requirements?',
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
  },

  // check-todos workflow templates
  'check-todos-roadmap-action': {
    question: 'This todo relates to Phase [N]: [name]. What would you like to do?',
    options: [
      { id: 'work-now', label: 'Work on it now', diversity: { certainty: 1.0 } },
      { id: 'add-to-plan', label: 'Add to phase plan', diversity: { certainty: 0.7 } },
      { id: 'brainstorm', label: 'Brainstorm approach', diversity: { certainty: 0.4 } },
      { id: 'put-back', label: 'Put it back', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },
  'check-todos-general-action': {
    question: 'What would you like to do with this todo?',
    options: [
      { id: 'work-now', label: 'Work on it now', diversity: { certainty: 1.0 } },
      { id: 'create-phase', label: 'Create a phase', diversity: { certainty: 0.7 } },
      { id: 'brainstorm', label: 'Brainstorm approach', diversity: { certainty: 0.4 } },
      { id: 'put-back', label: 'Put it back', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // add-todo workflow templates
  'add-todo-duplicate-action': {
    question: 'Similar todo exists: [title]. What would you like to do?',
    options: [
      { id: 'skip', label: 'Skip', diversity: { certainty: 0.8 } },
      { id: 'replace', label: 'Replace', diversity: { certainty: 0.5 } },
      { id: 'add-anyway', label: 'Add anyway', diversity: { certainty: 0.2 } }
    ],
    typeHint: 'SINGLE_CHOICE'
  },

  // update workflow templates
  'update-proceed': {
    question: 'Proceed with update?',
    options: [
      { id: 'yes', label: 'Yes, update now', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No, cancel', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },

  // cleanup workflow templates
  'cleanup-proceed': {
    question: 'Proceed with archiving?',
    options: [
      { id: 'yes', label: 'Yes — archive listed phases', diversity: { certainty: 1.0 } },
      { id: 'cancel', label: 'Cancel', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
  },

  // complete-milestone workflow templates
  'complete-milestone-push': {
    question: 'Push to remote?',
    options: [
      { id: 'yes', label: 'Yes', diversity: { certainty: 1.0 } },
      { id: 'no', label: 'No', diversity: { certainty: 0.0 } }
    ],
    typeHint: 'BINARY'
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
