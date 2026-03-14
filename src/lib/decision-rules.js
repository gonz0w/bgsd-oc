// ─── Decision Rules Engine ───────────────────────────────────────────────────
//
// Pure decision functions and rule registry for deterministic decision resolution.
// Every function follows the contract: (state) => { value, confidence, rule_id, metadata? }
// No file I/O — functions receive pre-computed state objects.
//
// Categories: workflow-routing, execution-mode, state-assessment, configuration, argument-parsing

// ─── Decision Functions ──────────────────────────────────────────────────────

/**
 * bgsd-context presence check.
 * Covers ~30 workflow locations that check if the enricher is loaded.
 */
function resolveContextGate(state) {
  const present = Boolean(state && state.context_present);
  return { value: present, confidence: 'HIGH', rule_id: 'context-gate' };
}

/**
 * Progress workflow Routes A-F.
 * Determines which route the progress workflow should take.
 */
function resolveProgressRoute(state) {
  const {
    plan_count = 0,
    summary_count = 0,
    uat_gap_count = 0,
    current_phase,
    highest_phase,
    roadmap_exists = false,
    project_exists = false,
    state_exists = false,
  } = state || {};

  if (!state_exists && !roadmap_exists && !project_exists) {
    return { value: 'no-project', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (!state_exists) {
    return { value: 'no-state', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (!roadmap_exists && project_exists) {
    return { value: 'F', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (uat_gap_count > 0) {
    return { value: 'E', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (summary_count < plan_count) {
    return { value: 'A', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (summary_count === plan_count && plan_count > 0) {
    return current_phase < highest_phase
      ? { value: 'C', confidence: 'HIGH', rule_id: 'progress-route' }
      : { value: 'D', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  if (plan_count === 0) {
    return { value: 'B', confidence: 'HIGH', rule_id: 'progress-route' };
  }
  // Ambiguous state — between milestones or unexpected combination
  return { value: 'F', confidence: 'MEDIUM', rule_id: 'progress-route' };
}

/**
 * Resume project next-action routing.
 * State can be ambiguous, so MEDIUM confidence for uncertain paths.
 */
function resolveResumeRoute(state) {
  const {
    has_state = false,
    has_roadmap = false,
    has_plans = false,
    has_incomplete_plans = false,
    has_blockers = false,
    phase_complete = false,
  } = state || {};

  if (!has_state) {
    return { value: 'initialize', confidence: 'HIGH', rule_id: 'resume-route' };
  }
  if (has_blockers) {
    return { value: 'resolve-blockers', confidence: 'HIGH', rule_id: 'resume-route' };
  }
  if (has_incomplete_plans) {
    return { value: 'continue-execution', confidence: 'HIGH', rule_id: 'resume-route' };
  }
  if (phase_complete && has_roadmap) {
    return { value: 'next-phase', confidence: 'HIGH', rule_id: 'resume-route' };
  }
  if (has_plans && !has_incomplete_plans) {
    return { value: 'verify-or-advance', confidence: 'MEDIUM', rule_id: 'resume-route' };
  }
  if (!has_plans && has_roadmap) {
    return { value: 'plan-phase', confidence: 'HIGH', rule_id: 'resume-route' };
  }
  // Ambiguous — state exists but unclear what to do next
  return { value: 'review-state', confidence: 'MEDIUM', rule_id: 'resume-route' };
}

/**
 * Execute-plan Pattern A/B/C selection.
 * Based on task types found in the plan.
 */
function resolveExecutionPattern(state) {
  const { task_types = [] } = state || {};

  const hasDecisionCheckpoints = task_types.some(
    t => typeof t === 'string' && t.startsWith('checkpoint:decision')
  );
  const hasOtherCheckpoints = task_types.some(
    t => typeof t === 'string' && t.startsWith('checkpoint:') && !t.startsWith('checkpoint:decision')
  );

  if (hasDecisionCheckpoints) {
    return { value: 'C', confidence: 'HIGH', rule_id: 'execution-pattern' };
  }
  if (hasOtherCheckpoints) {
    return { value: 'B', confidence: 'HIGH', rule_id: 'execution-pattern' };
  }
  return { value: 'A', confidence: 'HIGH', rule_id: 'execution-pattern' };
}

/**
 * Context budget warning check.
 * Determines if plan execution should proceed, warn, or stop based on budget.
 */
function resolveContextBudgetGate(state) {
  const { warning = false, mode = 'interactive' } = state || {};

  if (!warning) {
    return { value: 'proceed', confidence: 'HIGH', rule_id: 'context-budget-gate' };
  }
  if (mode === 'yolo') {
    return { value: 'warn', confidence: 'HIGH', rule_id: 'context-budget-gate' };
  }
  return { value: 'stop', confidence: 'HIGH', rule_id: 'context-budget-gate' };
}

/**
 * Previous SUMMARY blocker check.
 * Checks if previous phase's summary has unresolved issues.
 */
function resolvePreviousCheckGate(state) {
  const {
    has_previous_summary = false,
    has_unresolved_issues = false,
    has_blockers = false,
  } = state || {};

  if (!has_previous_summary) {
    return { value: 'proceed', confidence: 'HIGH', rule_id: 'previous-check-gate' };
  }
  if (has_blockers) {
    return { value: 'block', confidence: 'HIGH', rule_id: 'previous-check-gate' };
  }
  if (has_unresolved_issues) {
    return { value: 'warn', confidence: 'HIGH', rule_id: 'previous-check-gate' };
  }
  return { value: 'proceed', confidence: 'HIGH', rule_id: 'previous-check-gate' };
}

/**
 * CI quality gate check.
 * Determines whether to run CI, skip it, or warn about configuration.
 */
function resolveCiGate(state) {
  const {
    ci_enabled = false,
    has_test_command = false,
    tests_passing = true,
  } = state || {};

  if (!ci_enabled) {
    return { value: 'skip', confidence: 'HIGH', rule_id: 'ci-gate' };
  }
  if (!has_test_command) {
    return { value: 'warn', confidence: 'HIGH', rule_id: 'ci-gate' };
  }
  if (!tests_passing) {
    return { value: 'warn', confidence: 'HIGH', rule_id: 'ci-gate' };
  }
  return { value: 'run', confidence: 'HIGH', rule_id: 'ci-gate' };
}

/**
 * Phase has plans / needs planning routing.
 * Determines whether a phase is ready for execution or needs planning first.
 */
function resolvePlanExistenceRoute(state) {
  const {
    plan_count = 0,
    has_research = false,
    has_context = false,
  } = state || {};

  if (plan_count > 0) {
    return { value: 'has-plans', confidence: 'HIGH', rule_id: 'plan-existence-route' };
  }
  if (has_research || has_context) {
    return { value: 'needs-planning', confidence: 'HIGH', rule_id: 'plan-existence-route' };
  }
  return { value: 'needs-research', confidence: 'HIGH', rule_id: 'plan-existence-route' };
}

/**
 * Branch merge strategy selection.
 * User-preference dependent, so uses MEDIUM confidence.
 */
function resolveBranchHandling(state) {
  const {
    branching_strategy = 'none',
    has_branch = false,
    branch_behind = false,
  } = state || {};

  if (branching_strategy === 'none') {
    return { value: 'skip', confidence: 'HIGH', rule_id: 'branch-handling' };
  }
  if (!has_branch) {
    return { value: 'create', confidence: 'MEDIUM', rule_id: 'branch-handling' };
  }
  if (branch_behind) {
    return { value: 'update', confidence: 'MEDIUM', rule_id: 'branch-handling' };
  }
  return { value: 'use-existing', confidence: 'MEDIUM', rule_id: 'branch-handling' };
}

/**
 * Auto-advance config check.
 * Whether to auto-advance to the next plan after completion.
 */
function resolveAutoAdvance(state) {
  const {
    auto_advance_config = false,
    auto_flag = false,
  } = state || {};

  const shouldAdvance = Boolean(auto_advance_config || auto_flag);
  return { value: shouldAdvance, confidence: 'HIGH', rule_id: 'auto-advance' };
}

/**
 * Phase number from arguments.
 * Parses a raw argument into a phase number.
 */
function resolvePhaseArgParse(state) {
  const { raw_arg } = state || {};

  if (raw_arg === undefined || raw_arg === null || raw_arg === '') {
    return { value: null, confidence: 'HIGH', rule_id: 'phase-arg-parse' };
  }

  const str = String(raw_arg).trim();

  // Match patterns: "111", "0111", "phase 111", "Phase 111:", "111-name"
  const match = str.match(/^(?:phase\s+)?(\d+(?:\.\d+)?)/i);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num > 0) {
      return { value: num, confidence: 'HIGH', rule_id: 'phase-arg-parse' };
    }
  }

  return { value: null, confidence: 'HIGH', rule_id: 'phase-arg-parse' };
}

/**
 * Debug return handling route.
 * Determines action based on debug return type — MEDIUM because return shapes vary.
 */
function resolveDebugHandlerRoute(state) {
  const { return_type } = state || {};

  if (!return_type || typeof return_type !== 'string') {
    return { value: 'manual', confidence: 'MEDIUM', rule_id: 'debug-handler-route' };
  }

  const type = return_type.toLowerCase();
  if (type === 'fix' || type === 'auto-fix') {
    return { value: 'fix', confidence: 'MEDIUM', rule_id: 'debug-handler-route' };
  }
  if (type === 'plan' || type === 'needs-plan') {
    return { value: 'plan', confidence: 'MEDIUM', rule_id: 'debug-handler-route' };
  }
  if (type === 'continue' || type === 'resolved') {
    return { value: 'continue', confidence: 'MEDIUM', rule_id: 'debug-handler-route' };
  }
  return { value: 'manual', confidence: 'MEDIUM', rule_id: 'debug-handler-route' };
}

// ─── Rule Registry ───────────────────────────────────────────────────────────

const DECISION_REGISTRY = [
  {
    id: 'context-gate',
    name: 'Context Gate Check',
    category: 'state-assessment',
    description: 'Checks if bgsd-context is present (enricher loaded)',
    inputs: ['context_present'],
    outputs: ['boolean'],
    confidence_range: ['HIGH'],
    resolve: resolveContextGate,
  },
  {
    id: 'progress-route',
    name: 'Progress Workflow Route Selection',
    category: 'workflow-routing',
    description: 'Determines which route (A-F) the progress workflow should take',
    inputs: ['plan_count', 'summary_count', 'uat_gap_count', 'current_phase', 'highest_phase', 'roadmap_exists', 'project_exists', 'state_exists'],
    outputs: ['route_letter'],
    confidence_range: ['HIGH', 'MEDIUM'],
    resolve: resolveProgressRoute,
  },
  {
    id: 'resume-route',
    name: 'Resume Project Next-Action',
    category: 'workflow-routing',
    description: 'Determines the next action when resuming a project',
    inputs: ['has_state', 'has_roadmap', 'has_plans', 'has_incomplete_plans', 'has_blockers', 'phase_complete'],
    outputs: ['action_string'],
    confidence_range: ['HIGH', 'MEDIUM'],
    resolve: resolveResumeRoute,
  },
  {
    id: 'execution-pattern',
    name: 'Execution Pattern Selection',
    category: 'execution-mode',
    description: 'Determines execute-plan Pattern A/B/C based on task types',
    inputs: ['task_types'],
    outputs: ['pattern_letter'],
    confidence_range: ['HIGH'],
    resolve: resolveExecutionPattern,
  },
  {
    id: 'context-budget-gate',
    name: 'Context Budget Warning Gate',
    category: 'state-assessment',
    description: 'Checks if plan execution should proceed based on context budget',
    inputs: ['warning', 'mode'],
    outputs: ['proceed_warn_stop'],
    confidence_range: ['HIGH'],
    resolve: resolveContextBudgetGate,
  },
  {
    id: 'previous-check-gate',
    name: 'Previous Summary Blocker Check',
    category: 'state-assessment',
    description: 'Checks if previous SUMMARY has unresolved issues or blockers',
    inputs: ['has_previous_summary', 'has_unresolved_issues', 'has_blockers'],
    outputs: ['proceed_warn_block'],
    confidence_range: ['HIGH'],
    resolve: resolvePreviousCheckGate,
  },
  {
    id: 'ci-gate',
    name: 'CI Quality Gate Check',
    category: 'execution-mode',
    description: 'Determines whether to run CI, skip, or warn about configuration',
    inputs: ['ci_enabled', 'has_test_command', 'tests_passing'],
    outputs: ['run_skip_warn'],
    confidence_range: ['HIGH'],
    resolve: resolveCiGate,
  },
  {
    id: 'plan-existence-route',
    name: 'Plan Existence Route',
    category: 'workflow-routing',
    description: 'Determines if a phase has plans or needs planning/research',
    inputs: ['plan_count', 'has_research', 'has_context'],
    outputs: ['routing_advice'],
    confidence_range: ['HIGH'],
    resolve: resolvePlanExistenceRoute,
  },
  {
    id: 'branch-handling',
    name: 'Branch Merge Strategy',
    category: 'configuration',
    description: 'Determines branch handling strategy based on config and state',
    inputs: ['branching_strategy', 'has_branch', 'branch_behind'],
    outputs: ['strategy'],
    confidence_range: ['HIGH', 'MEDIUM'],
    resolve: resolveBranchHandling,
  },
  {
    id: 'auto-advance',
    name: 'Auto-Advance Config Check',
    category: 'configuration',
    description: 'Determines if plan should auto-advance to next plan after completion',
    inputs: ['auto_advance_config', 'auto_flag'],
    outputs: ['boolean'],
    confidence_range: ['HIGH'],
    resolve: resolveAutoAdvance,
  },
  {
    id: 'phase-arg-parse',
    name: 'Phase Argument Parser',
    category: 'argument-parsing',
    description: 'Parses a raw argument string into a phase number',
    inputs: ['raw_arg'],
    outputs: ['number_or_null'],
    confidence_range: ['HIGH'],
    resolve: resolvePhaseArgParse,
  },
  {
    id: 'debug-handler-route',
    name: 'Debug Return Handler Route',
    category: 'workflow-routing',
    description: 'Determines action based on debug return type (fix/plan/manual/continue)',
    inputs: ['return_type'],
    outputs: ['action_string'],
    confidence_range: ['MEDIUM'],
    resolve: resolveDebugHandlerRoute,
  },
];

// ─── Aggregator ──────────────────────────────────────────────────────────────

/**
 * Evaluate all applicable decision rules for a given command context.
 * Returns a map of { rule_id: result } for all rules whose inputs are
 * at least partially present in the state.
 *
 * @param {string} command - The command being executed (for filtering if needed)
 * @param {object} state - Pre-computed state object with decision inputs
 * @returns {Object<string, {value: *, confidence: string, rule_id: string}>}
 */
function evaluateDecisions(command, state) {
  if (!state || typeof state !== 'object') return {};

  const results = {};
  const stateKeys = new Set(Object.keys(state));

  for (const rule of DECISION_REGISTRY) {
    // Check if at least one input key is present in the state
    const hasInput = rule.inputs.some(input => stateKeys.has(input));
    if (hasInput) {
      try {
        results[rule.id] = rule.resolve(state);
      } catch (_e) {
        // Pure functions shouldn't throw, but guard against it
        results[rule.id] = { value: null, confidence: 'LOW', rule_id: rule.id, error: true };
      }
    }
  }

  return results;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Individual decision functions
  resolveContextGate,
  resolveProgressRoute,
  resolveResumeRoute,
  resolveExecutionPattern,
  resolveContextBudgetGate,
  resolvePreviousCheckGate,
  resolveCiGate,
  resolvePlanExistenceRoute,
  resolveBranchHandling,
  resolveAutoAdvance,
  resolvePhaseArgParse,
  resolveDebugHandlerRoute,
  // Registry and aggregator
  DECISION_REGISTRY,
  evaluateDecisions,
};
