/**
 * helpExamples.js - Examples in help for common use cases
 * Part of Phase 97: UX Polish - Task 3
 * 
 * Provides practical examples for CLI commands.
 */

const COMMON_WORKFLOWS = [
  {
    name: 'New Project Setup',
    steps: [
      'init:new-project',
      'plan:requirements',
      'plan:roadmap'
    ],
    description: 'Initialize a new project with requirements and roadmap'
  },
  {
    name: 'Plan and Execute Phase',
    steps: [
      'plan:phase <phase-number>',
      'execute:phase <phase-number>',
      'verify:state <phase-number>'
    ],
    description: 'Plan, execute, and verify a phase'
  },
  {
    name: 'Quick Iteration',
    steps: [
      'execute:quick',
      'verify:review'
    ],
    description: 'Quick task execution with review'
  },
  {
    name: 'Debug Workflow',
    steps: [
      'util:trace-requirement <requirement-id>',
      'execute:trajectory analyze',
      'execute:trajectory pivot'
    ],
    description: 'Debug and pivot when stuck'
  },
  {
    name: 'Research and Document',
    steps: [
      'research:capabilities',
      'research:collect <topic>',
      'research:nlm-create'
    ],
    description: 'Research topics and create audio overview'
  },
  {
    name: 'Check Project Health',
    steps: [
      'util:progress',
      'verify:state',
      'execute:velocity'
    ],
    description: 'Check overall project status and velocity'
  }
];

const COMMAND_EXAMPLES = {
  'plan:phase': [
    {
      description: 'Plan a new phase',
      usage: 'plan:phase 97',
      output: 'Creates PLAN.md for phase 97'
    },
    {
      description: 'Plan with requirements',
      usage: 'plan:phase 97 --requirements UX-01,UX-02',
      output: 'Links requirements to the plan'
    }
  ],
  'execute:phase': [
    {
      description: 'Execute all plans in a phase',
      usage: 'execute:phase 97',
      output: 'Runs all tasks in phase 97 plans'
    },
    {
      description: 'Execute specific plan',
      usage: 'execute:phase 97-01',
      output: 'Runs tasks from plan 97-01 only'
    }
  ],
  'verify:state': [
    {
      description: 'Verify current phase state',
      usage: 'verify:state',
      output: 'Shows current phase progress'
    },
    {
      description: 'Verify specific phase',
      usage: 'verify:state 97',
      output: 'Shows phase 97 completion status'
    }
  ],
  'util:progress': [
    {
      description: 'Show project progress',
      usage: 'util:progress',
      output: 'Displays all phases and their completion status'
    }
  ],
  'util:codebase': [
    {
      description: 'Get context for specific files',
      usage: 'util:codebase context --files src/index.js',
      output: 'Returns imports, conventions, risk level for files'
    },
    {
      description: 'Get task-scoped context',
      usage: 'util:codebase context --task src/lib/utils.js,src/cli.js --budget 2000',
      output: 'Returns relevant files for a task within token budget'
    }
  ],
  'plan:roadmap': [
    {
      description: 'View roadmap phases',
      usage: 'plan:roadmap get-phase 97',
      output: 'Shows phase 97 details from roadmap'
    }
  ],
  'research:collect': [
    {
      description: 'Collect research on a topic',
      usage: 'research:collect "React server components"',
      output: 'Searches and saves research to .planning/memory/'
    },
    {
      description: 'Collect with URL',
      usage: 'research:collect --url https://example.com/docs',
      output: 'Fetches and saves specific URL content'
    }
  ],
  'init:new-project': [
    {
      description: 'Initialize new project',
      usage: 'init:new-project',
      output: 'Creates PROJECT.md, ROADMAP.md, STATE.md'
    }
  ]
};

/**
 * Get examples for a specific command
 * @param {string} namespace - Command namespace
 * @param {string} command - Command name
 */
function getExamples(namespace, command) {
  const key = `${namespace}:${command}`;
  return COMMAND_EXAMPLES[key] || [];
}

/**
 * Get all common workflows
 */
function getCommonWorkflows() {
  return COMMON_WORKFLOWS;
}

/**
 * Format an example for display
 * @param {object} example - Example object
 * @param {boolean} verbose - Include full explanation
 */
function formatExample(example, verbose = false) {
  const lines = [
    `  ${example.usage}`,
    `    → ${example.output}`
  ];
  
  if (verbose && example.description) {
    lines.splice(1, 0, `    ${example.description}`);
  }
  
  return lines.join('\n');
}

/**
 * Format workflow for display
 * @param {object} workflow - Workflow object
 * @param {boolean} verbose - Include description
 */
function formatWorkflow(workflow, verbose = true) {
  const lines = [
    `${workflow.name}:`,
    `  Steps: ${workflow.steps.join(' → ')}`
  ];
  
  if (verbose) {
    lines.push(`  ${workflow.description}`);
  }
  
  return lines.join('\n');
}

/**
 * Get help text with examples for a command
 * @param {string} namespace - Command namespace
 * @param {string} command - Command name
 */
function getHelpWithExamples(namespace, command) {
  const examples = getExamples(namespace, command);
  
  if (examples.length === 0) {
    return null;
  }
  
  return {
    command: `${namespace}:${command}`,
    examples: examples.map(ex => ({
      usage: ex.usage,
      description: ex.description,
      output: ex.output
    }))
  };
}

module.exports = {
  getExamples,
  getCommonWorkflows,
  formatExample,
  formatWorkflow,
  getHelpWithExamples,
  COMMAND_EXAMPLES,
  COMMON_WORKFLOWS
};
