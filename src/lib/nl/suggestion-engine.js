// Suggestion Engine - Provides contextual next-action suggestions based on command type

/**
 * Detect command category from command name or output
 * @param {string} lastCommand - Command name or description
 * @returns {Object} {category: "planning"|"execution"|"verification"|"session"|"utility", command: string}
 */
function detectCommandType(lastCommand) {
  if (!lastCommand || typeof lastCommand !== 'string') {
    return { category: 'utility', command: lastCommand || '' };
  }

  const cmd = lastCommand.toLowerCase().trim();

  // Planning commands
  const planningCommands = ['plan', 'plan:phase', 'plan:roadmap', 'plan:milestone', 'milestone:new'];
  if (planningCommands.some(c => cmd.includes(c))) {
    return { category: 'planning', command: cmd };
  }

  // Execution commands
  const executionCommands = ['exec', 'execute', 'execute:phase', 'execute:quick', 'execute:commit'];
  if (executionCommands.some(c => cmd.includes(c))) {
    return { category: 'execution', command: cmd };
  }

  // Verification commands
  const verificationCommands = ['verify', 'verify:work', 'verify:phase', 'test'];
  if (verificationCommands.some(c => cmd.includes(c))) {
    return { category: 'verification', command: cmd };
  }

  // Session commands
  const sessionCommands = ['session', 'session:pause', 'session:resume', 'session:progress'];
  if (sessionCommands.some(c => cmd.includes(c))) {
    return { category: 'session', command: cmd };
  }

  return { category: 'utility', command: cmd };
}

/**
 * Returns contextual next-action suggestions
 * @param {string} commandType - Detected command type
 * @param {Object} currentState - Current state {currentPhase, lastPhase, milestoneStatus}
 * @returns {Array} Array of {command, reason, priority}
 */
function getSuggestions(commandType, currentState = {}) {
  const { currentPhase, lastPhase, milestoneStatus } = currentState;
  const suggestions = [];
  const category = typeof commandType === 'string' ? commandType : commandType.category;

  // Helper to add suggestion
  const add = (cmd, reason, priority = 1) => {
    suggestions.push({ command: cmd, reason, priority });
  };

  switch (category) {
    case 'planning':
      if (currentPhase || lastPhase) {
        const phase = currentPhase || lastPhase;
        add(`exec phase ${phase}`, 'Execute the plan you just created', 1);
      } else {
        add('roadmap show', 'View available phases to execute', 2);
      }
      break;

    case 'execution':
      if (currentPhase || lastPhase) {
        const phase = currentPhase || lastPhase;
        add(`verify phase ${phase}`, 'Verify the execution results', 1);
      }
      add('session progress', 'Check overall project progress', 3);
      break;

    case 'verification':
      // Suggest next phase if available
      if (currentPhase) {
        const nextPhase = parseInt(currentPhase) + 1;
        add(`plan phase ${nextPhase}`, 'Plan the next phase', 1);
      }
      // Suggest milestone completion if appropriate
      if (milestoneStatus === 'ready') {
        add('milestone complete', 'Complete current milestone', 1);
      } else {
        add('session pause', 'Pause and review progress', 2);
      }
      break;

    case 'session':
      if (commandType.command && commandType.command.includes('pause')) {
        add('session resume', 'Resume working on the project', 1);
      } else if (commandType.command && commandType.command.includes('progress')) {
        add('roadmap show', 'View full roadmap', 2);
      }
      break;

    case 'utility':
    default:
      // No specific suggestions for utility commands
      add('roadmap show', 'View available commands', 2);
      add('health', 'Check project health', 3);
      break;
  }

  // Sort by priority (lower = higher priority)
  suggestions.sort((a, b) => a.priority - b.priority);

  return suggestions;
}

/**
 * Build suggestion chain for multi-step sequences
 * @param {Array} sequence - Array of intents [{intent, target}]
 * @returns {Object} {chain: [], missing: []}
 */
function buildSuggestionChain(sequence) {
  if (!sequence || sequence.length === 0) {
    return { chain: [], missing: [] };
  }

  const chain = [];
  const missing = [];
  const intentTypes = sequence.map(s => s.intent);

  // Build the expected chain: plan → execute → verify
  const expectedChain = ['plan', 'execute', 'verify'];

  // Add each intent from sequence
  for (const item of sequence) {
    chain.push({
      intent: item.intent,
      target: item.target,
      status: 'requested'
    });
  }

  // Check for missing links
  if (intentTypes.includes('plan') && !intentTypes.includes('execute')) {
    missing.push({ missing: 'execute', suggestion: 'After planning, execute the plan' });
  }
  if (intentTypes.includes('execute') && !intentTypes.includes('verify')) {
    missing.push({ missing: 'verify', suggestion: 'After executing, verify the results' });
  }

  // Add suggested next actions after the full chain
  const lastIntent = sequence[sequence.length - 1]?.intent;
  if (lastIntent === 'verify') {
    chain.push({ intent: 'next_phase', suggestion: 'Plan or continue with next phase' });
  } else if (lastIntent === 'execute') {
    chain.push({ intent: 'verify', suggestion: 'Verify the execution' });
  } else if (lastIntent === 'plan') {
    chain.push({ intent: 'execute', suggestion: 'Execute the plan' });
  }

  return { chain, missing };
}

module.exports = {
  detectCommandType,
  getSuggestions,
  buildSuggestionChain
};
