// ─── Decision Rules Engine ───────────────────────────────────────────────────
//
// Pure decision functions and rule registry for deterministic decision resolution.
// Every function follows the contract: (state) => { value, confidence, rule_id, metadata? }
// No file I/O — functions receive pre-computed state objects.
//
// Categories: workflow-routing, execution-mode, state-assessment, configuration, argument-parsing
//
// Phase 202: resolvePhaseDependencies restored with Kahn sort verification (PARALLEL-02)

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
 *
 * Extended in Phase 122: added deps_complete, has_blockers inputs and
 * 'ready', 'blocked-deps', 'missing-context' return values.
 * Backward compatible — old callers without new inputs get old behavior.
 */
function resolvePlanExistenceRoute(state) {
  const {
    plan_count = 0,
    has_research = false,
    has_context = false,
    deps_complete,
    has_blockers,
  } = state || {};

  if (plan_count > 0) {
    // New: blocked by explicit blockers or incomplete deps
    if (has_blockers) {
      return { value: 'blocked-deps', confidence: 'HIGH', rule_id: 'plan-existence-route' };
    }
    if (deps_complete === false) {
      return { value: 'blocked-deps', confidence: 'HIGH', rule_id: 'plan-existence-route' };
    }
    // New: ready when plans exist AND context is available
    if (has_context) {
      return { value: 'ready', confidence: 'HIGH', rule_id: 'plan-existence-route' };
    }
    // Backward compat: has plans but no context info supplied by caller
    return { value: 'has-plans', confidence: 'HIGH', rule_id: 'plan-existence-route' };
  }

  // New: missing-context before needs-research when neither context nor research present
  if (!has_context && !has_research) {
    return { value: 'missing-context', confidence: 'HIGH', rule_id: 'plan-existence-route' };
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

// ─── Phase 122: New Decision Functions ───────────────────────────────────────

/**
 * Model selection — picks the concrete model string for a given agent from the
 * canonical model_settings contract.
 *
 * Category: configuration
 */
function resolveModelSelection(state) {
  const {
    agent_type,
    model_profile = 'balanced',
    model_settings,
  } = state || {};

  const { resolveConfiguredModelStateFromConfig } = require('./helpers');
  const resolved = resolveConfiguredModelStateFromConfig({ model_settings, model_profile }, agent_type);

  return {
    value: {
      configured: resolved.configured,
      selected_profile: resolved.selected_profile,
      profile: resolved.selected_profile,
      resolved_model: resolved.resolved_model,
      model: resolved.resolved_model,
      source: resolved.source,
      unknown_agent: resolved.unknown_agent,
    },
    confidence: 'HIGH',
    rule_id: 'model-selection'
  };
}

const VERIFICATION_ROUTE_ORDER = Object.freeze({ skip: 0, light: 1, full: 2 });

function getRouteRank(route) {
  return Object.prototype.hasOwnProperty.call(VERIFICATION_ROUTE_ORDER, route)
    ? VERIFICATION_ROUTE_ORDER[route]
    : -1;
}

function normalizeVerificationRoute(route) {
  if (typeof route !== 'string') return null;
  const normalized = route.trim();
  return Object.prototype.hasOwnProperty.call(VERIFICATION_ROUTE_ORDER, normalized)
    ? normalized
    : null;
}

function normalizeVerificationReason(reason) {
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

function classifyVerificationChangeSet(filesModified) {
  const files = Array.isArray(filesModified)
    ? filesModified.filter(file => typeof file === 'string' && file.trim()).map(file => file.trim())
    : [];
  const classes = new Set();

  for (const file of files) {
    if (/^(bin\/bgsd-tools\.cjs|plugin\.js)$/.test(file)) {
      classes.add('generated-runtime');
      continue;
    }
    if (/^src\/plugin\//.test(file)) {
      classes.add('plugin');
      continue;
    }
    if (/^(src\/|\.planning\/(STATE|ROADMAP)\.md$)/.test(file)) {
      classes.add(file.startsWith('.planning/') ? 'shared-state' : 'runtime');
      continue;
    }
    if (/^(workflows\/|templates\/)/.test(file)) {
      classes.add('workflow-template');
      continue;
    }
    if (/^(docs\/|references\/|commands\/).*\.md$/.test(file) || /^README\.md$/.test(file)) {
      classes.add('docs-guidance');
      continue;
    }
    if (/^tests\//.test(file)) {
      classes.add('tests');
    }
  }

  return { files, change_classes: Array.from(classes) };
}

function getDefaultVerificationRoute(state) {
  const {
    task_count = 0,
    files_modified_count = 0,
    files_modified,
  } = state || {};
  const { files, change_classes } = classifyVerificationChangeSet(files_modified);
  const classes = new Set(change_classes);

  if (classes.has('runtime') || classes.has('shared-state') || classes.has('plugin')) {
    return {
      route: 'full',
      reason: 'runtime, shared-state, and plugin-facing work defaults to full proof',
      change_classes,
      files,
    };
  }

  if (classes.has('generated-runtime')) {
    if (classes.has('workflow-template') || classes.has('docs-guidance')) {
      return {
        route: classes.has('workflow-template') ? 'light' : 'skip',
        reason: 'generated artifacts follow the paired low-risk source or guidance surface when explicitly kept below full',
        change_classes,
        files,
      };
    }
    return {
      route: 'full',
      reason: 'generated runtime artifacts without lower-risk source context default to full proof',
      change_classes,
      files,
    };
  }

  if (classes.has('workflow-template')) {
    return {
      route: 'light',
      reason: 'workflow and template guidance defaults to focused proof instead of broad regression',
      change_classes,
      files,
    };
  }

  if (classes.has('docs-guidance')) {
    return {
      route: 'skip',
      reason: 'docs and guidance-only slices default to structural proof only',
      change_classes,
      files,
    };
  }

  if (files.length > 0) {
    return {
      route: 'light',
      reason: 'non-runtime implementation slices default to focused proof',
      change_classes,
      files,
    };
  }

  if (task_count <= 2 && files_modified_count <= 4) {
    return {
      route: 'light',
      reason: 'fallback heuristic keeps small slices on focused proof',
      change_classes,
      files,
    };
  }

  return {
    route: 'full',
    reason: 'fallback heuristic escalates broader slices to full proof',
    change_classes,
    files,
  };
}

function getRequiredProofForRoute(route) {
  if (route === 'skip') {
    return {
      structural_proof: 'required',
      behavior_proof: 'not required',
      regression_proof: 'not required',
      human_verification: 'not required',
    };
  }
  if (route === 'light') {
    return {
      structural_proof: 'required',
      behavior_proof: 'required',
      regression_proof: 'smoke',
      human_verification: 'not required',
    };
  }
  return {
    structural_proof: 'required',
    behavior_proof: 'required',
    regression_proof: 'broad',
    human_verification: 'not required',
  };
}

/**
 * Verification routing — determines full, light, or skip from explicit risk policy,
 * falling back to the legacy size heuristic when richer inputs are absent.
 *
 * Category: workflow-routing
 */
function resolveVerificationRouting(state) {
  const {
    verifier_enabled = true,
    verification_route,
    verification_route_reason,
  } = state || {};

  if (!verifier_enabled) {
    return {
      value: 'skip',
      confidence: 'HIGH',
      rule_id: 'verification-routing',
      metadata: {
        route_source: 'verifier-disabled',
        default_route: 'skip',
        default_reason: 'verifier is disabled, so no extra verification is required',
        required_proof: getRequiredProofForRoute('skip'),
        change_classes: [],
        downgrade: null,
      },
    };
  }

  const defaultDecision = getDefaultVerificationRoute(state);
  const explicitRoute = normalizeVerificationRoute(verification_route);
  const explicitReason = normalizeVerificationReason(verification_route_reason);
  let selectedRoute = defaultDecision.route;
  let routeSource = 'default';
  let downgrade = null;

  if (explicitRoute) {
    const explicitRank = getRouteRank(explicitRoute);
    const defaultRank = getRouteRank(defaultDecision.route);
    if (explicitRank >= defaultRank) {
      selectedRoute = explicitRoute;
      routeSource = 'explicit';
    } else if (explicitReason) {
      selectedRoute = explicitRoute;
      routeSource = 'explicit-downgrade';
      downgrade = {
        from: defaultDecision.route,
        to: explicitRoute,
        reason: explicitReason,
        justified: true,
      };
    } else {
      downgrade = {
        from: defaultDecision.route,
        to: explicitRoute,
        reason: null,
        justified: false,
        missing_reason: true,
      };
    }
  }

  return {
    value: selectedRoute,
    confidence: 'HIGH',
    rule_id: 'verification-routing',
    metadata: {
      route_source: routeSource,
      default_route: defaultDecision.route,
      default_reason: defaultDecision.reason,
      required_proof: getRequiredProofForRoute(selectedRoute),
      change_classes: defaultDecision.change_classes,
      files_considered: defaultDecision.files,
      downgrade,
    },
  };
}

/**
 * Research gate — determines if research should run and at what depth.
 *
 * Category: workflow-routing
 */
function resolveResearchGate(state) {
  const {
    research_enabled = true,
    has_research = false,
    has_context = false,
    phase_has_external_deps = false,
  } = state || {};

  if (!research_enabled) {
    return { value: { run: false, depth: null }, confidence: 'HIGH', rule_id: 'research-gate' };
  }
  if (has_research) {
    return { value: { run: false, depth: null }, confidence: 'HIGH', rule_id: 'research-gate' };
  }
  if (phase_has_external_deps) {
    return { value: { run: true, depth: 'deep' }, confidence: 'HIGH', rule_id: 'research-gate' };
  }
  if (!has_context) {
    return { value: { run: true, depth: 'quick' }, confidence: 'HIGH', rule_id: 'research-gate' };
  }
  return { value: { run: false, depth: null }, confidence: 'HIGH', rule_id: 'research-gate' };
}

/**
 * Milestone completion readiness check.
 *
 * Category: state-assessment
 */
function resolveMilestoneCompletion(state) {
  const {
    phases_total = 0,
    phases_complete = 0,
    has_incomplete_plans = false,
    milestone_name,
  } = state || {};

  if (phases_complete === phases_total && !has_incomplete_plans) {
    return { value: { ready: true, action: 'complete' }, confidence: 'HIGH', rule_id: 'milestone-completion' };
  }
  if (phases_complete === phases_total - 1) {
    return { value: { ready: false, action: 'finish-last-phase' }, confidence: 'HIGH', rule_id: 'milestone-completion' };
  }
  return { value: { ready: false, action: 'continue' }, confidence: 'HIGH', rule_id: 'milestone-completion' };
}

/**
 * Commit strategy — determines granularity and prefix for commits.
 *
 * Category: execution-mode
 */
function resolveCommitStrategy(state) {
  const {
    task_count = 0,
    plan_type = '',
    files_modified_count = 0,
    is_tdd = false,
  } = state || {};

  // Granularity
  let granularity;
  if (is_tdd) {
    granularity = 'per-phase'; // TDD commits at red/green/refactor
  } else if (task_count <= 1) {
    granularity = 'per-plan';
  } else {
    granularity = 'per-task';
  }

  // Prefix
  let prefix;
  let confidence = 'HIGH';
  if (plan_type === 'tdd') {
    prefix = 'test';
  } else if (files_modified_count === 0) {
    prefix = 'docs';
  } else {
    prefix = 'feat';
    confidence = 'MEDIUM'; // Inferred from file patterns — less certain
  }

  return { value: { granularity, prefix }, confidence, rule_id: 'commit-strategy' };
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
    description: 'Determines if a phase has plans or needs planning/research (extended: blocked-deps, ready, missing-context)',
    inputs: ['plan_count', 'has_research', 'has_context', 'deps_complete', 'has_blockers'],
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

  // Phase 122: New rules
  {
    id: 'model-selection',
    name: 'Model Selection',
    category: 'configuration',
    description: 'Resolves concrete model string for an agent type from canonical model settings',
    inputs: ['agent_type', 'model_profile', 'model_settings'],
    outputs: ['{ profile, model }'],
    confidence_range: ['HIGH'],
    resolve: resolveModelSelection,
  },
  {
    id: 'verification-routing',
    name: 'Verification Routing',
    category: 'workflow-routing',
    description: 'Determines full, light, or skip verification from explicit risk policy inputs',
    inputs: ['files_modified', 'verification_route', 'verification_route_reason', 'task_count', 'files_modified_count', 'verifier_enabled'],
    outputs: ['full|light|skip'],
    confidence_range: ['HIGH'],
    resolve: resolveVerificationRouting,
  },
  {
    id: 'research-gate',
    name: 'Research Gate',
    category: 'workflow-routing',
    description: 'Determines if research should run and at what depth (deep/quick)',
    inputs: ['research_enabled', 'has_research', 'has_context', 'phase_has_external_deps'],
    outputs: ['{ run, depth }'],
    confidence_range: ['HIGH'],
    resolve: resolveResearchGate,
  },
  {
    id: 'milestone-completion',
    name: 'Milestone Completion Check',
    category: 'state-assessment',
    description: 'Determines milestone completion readiness and next action',
    inputs: ['phases_total', 'phases_complete', 'has_incomplete_plans', 'milestone_name'],
    outputs: ['{ ready, action }'],
    confidence_range: ['HIGH'],
    resolve: resolveMilestoneCompletion,
  },
  {
    id: 'commit-strategy',
    name: 'Commit Strategy',
    category: 'execution-mode',
    description: 'Determines commit granularity (per-task/per-plan/per-phase) and prefix (feat/test/docs)',
    inputs: ['task_count', 'plan_type', 'files_modified_count', 'is_tdd'],
    outputs: ['{ granularity, prefix }'],
    confidence_range: ['HIGH', 'MEDIUM'],
    resolve: resolveCommitStrategy,
  },

  // Phase 141: Question taxonomy decision functions
  {
    id: 'resolve-question-type',
    name: 'Question Type Resolution',
    category: 'question-routing',
    description: 'Determines TAXONOMY type for a workflow step',
    inputs: ['workflow_id', 'step_id'],
    outputs: ['TAXONOMY enum value'],
    confidence_range: ['HIGH'],
    resolve: resolveQuestionType,
  },
  {
    id: 'resolve-option-generation',
    name: 'Option Generation Strategy',
    category: 'question-routing',
    description: 'Determines pre-authored vs runtime generation approach',
    inputs: ['questionType', 'context'],
    outputs: ['pre-authored' | 'runtime'],
    confidence_range: ['HIGH'],
    resolve: resolveOptionGeneration,
  },

  // Phase 127: Tool routing decision functions
  {
    id: 'file-discovery-mode',
    name: 'File Discovery Mode',
    category: 'tool-routing',
    description: 'Recommends file discovery tool (fd vs node) based on tool availability and task scope',
    inputs: ['tool_availability', 'scope'],
    outputs: ['fd|node'],
    confidence_range: ['HIGH'],
    resolve: resolveFileDiscoveryMode,
  },
  {
    id: 'search-mode',
    name: 'Search Mode',
    category: 'tool-routing',
    description: 'Recommends search tool (ripgrep vs fd vs node) based on tool availability and .gitignore requirements',
    inputs: ['tool_availability', 'needs_gitignore_respect'],
    outputs: ['ripgrep|fd|node'],
    confidence_range: ['HIGH'],
    resolve: resolveSearchMode,
  },
  {
    id: 'structural-search-mode',
    name: 'Structural Search Mode',
    category: 'tool-routing',
    description: 'Recommends syntax-aware search tool (ast-grep vs ripgrep vs node) based on tool availability',
    inputs: ['tool_availability'],
    outputs: ['ast-grep|ripgrep|node'],
    confidence_range: ['HIGH'],
    resolve: resolveStructuralSearchMode,
  },
  {
    id: 'json-transform-mode',
    name: 'JSON Transform Mode',
    category: 'tool-routing',
    description: 'Recommends JSON transform tool (jq vs node) based on tool availability',
    inputs: ['tool_availability'],
    outputs: ['jq|node'],
    confidence_range: ['HIGH'],
    resolve: resolveJsonTransformMode,
  },
  {
    id: 'yaml-transform-mode',
    name: 'YAML Transform Mode',
    category: 'tool-routing',
    description: 'Recommends YAML transform tool (yq vs node) based on tool availability',
    inputs: ['tool_availability'],
    outputs: ['yq|node'],
    confidence_range: ['HIGH'],
    resolve: resolveYamlTransformMode,
  },
  {
    id: 'text-replace-mode',
    name: 'Text Replace Mode',
    category: 'tool-routing',
    description: 'Recommends text replacement tool (sd vs node) based on tool availability',
    inputs: ['tool_availability'],
    outputs: ['sd|node'],
    confidence_range: ['HIGH'],
    resolve: resolveTextReplaceMode,
  },
  {
    id: 'benchmark-mode',
    name: 'Benchmark Mode',
    category: 'tool-routing',
    description: 'Recommends benchmark tool (hyperfine vs node) based on tool availability',
    inputs: ['tool_availability'],
    outputs: ['hyperfine|node'],
    confidence_range: ['HIGH'],
    resolve: resolveBenchmarkMode,
  },

  // Phase 202: Kahn topological sort for parallel wave ordering
  {
    id: 'phase-dependencies',
    name: 'Phase Dependencies Kahn Sort',
    category: 'workflow-routing',
    description: 'Kahn topological sort with verification for correct parallel wave ordering',
    inputs: ['phases'],
    outputs: ['{ ordered_phases, waves, verification }'],
    confidence_range: ['HIGH'],
    resolve: resolvePhaseDependencies,
  },
];

// ─── Phase 141: Question taxonomy decision functions ─────────────────────────

const { TAXONOMY, OPTION_TEMPLATES } = require('./questions');

/**
 * resolveQuestionType - Determines TAXONOMY type for a workflow step.
 *
 * @param {object} state - { workflow_id, step_id }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveQuestionType(state) {
  const { workflow_id, step_id } = state || {};

  // Mapping of workflow+step to TAXONOMY type
  const questionTypeMap = {
    'discuss-phase:gray-areas': TAXONOMY.MULTI_CHOICE,
    'discuss-phase:conflict-resolution': TAXONOMY.CLARIFICATION,
    'discuss-phase:continue': TAXONOMY.SINGLE_CHOICE,
    'discuss-phase:stress-test-response': TAXONOMY.SINGLE_CHOICE,
    'new-milestone:goal-type': TAXONOMY.SINGLE_CHOICE,
    'new-milestone:priority-set': TAXONOMY.RANKING,
    'new-milestone:constraint-add': TAXONOMY.FILTERING,
    'plan-phase:task-breakdown': TAXONOMY.MULTI_CHOICE,
    'plan-phase:dependency-add': TAXONOMY.FILTERING,
    'plan-phase:priority-order': TAXONOMY.RANKING,
    'verify-work:criteria-select': TAXONOMY.MULTI_CHOICE,
    'verify-work:pass-fail': TAXONOMY.BINARY,
    'execute-phase:tool-select': TAXONOMY.SINGLE_CHOICE,
    'execute-phase:parallel-tasks': TAXONOMY.MULTI_CHOICE,
    'transition:direction-select': TAXONOMY.SINGLE_CHOICE,
    'transition:risk-assess': TAXONOMY.FILTERING,
  };

  const key = `${workflow_id}:${step_id}`;
  const type = questionTypeMap[key];

  if (type) {
    return { value: type, confidence: 'HIGH', rule_id: 'resolve-question-type' };
  }

  // Graceful fallback for unknown workflow/step combinations
  return { value: TAXONOMY.SINGLE_CHOICE, confidence: 'HIGH', rule_id: 'resolve-question-type' };
}

/**
 * resolveOptionGeneration - Determines pre-authored vs runtime generation approach.
 *
 * @param {object} state - { questionType, context }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveOptionGeneration(state) {
  const { questionType, context = {} } = state || {};

  if (!questionType) {
    return { value: 'runtime', confidence: 'HIGH', rule_id: 'resolve-option-generation' };
  }

  // Check if we have a pre-authored template for this question type
  // Template lookup uses the questionType as a template ID hint
  const templateId = context.templateId || questionType.toLowerCase();
  const template = OPTION_TEMPLATES[templateId];

  if (template) {
    return { value: 'pre-authored', confidence: 'HIGH', rule_id: 'resolve-option-generation' };
  }

  // Runtime generation as fallback (uses generateRuntimeOptions internally)
  return { value: 'runtime', confidence: 'HIGH', rule_id: 'resolve-option-generation' };
}

// ─── Phase 127: Tool routing decision functions ───────────────────────────────

/**
 * File discovery mode selection.
 * Recommends ripgrep vs Node.js vs fd based on tool availability and task scope.
 *
 * @param {object} state - { tool_availability: {ripgrep, fd, jq, yq, ast_grep, sd, hyperfine, bat, gh}, scope: 'single-file'|'directory'|'project-wide' }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveFileDiscoveryMode(state) {
  const { tool_availability = {}, scope } = state || {};

  // Single-file operations need no discovery tool when explicitly requested
  if (scope === 'single-file') {
    return { value: 'node', confidence: 'HIGH', rule_id: 'file-discovery-mode' };
  }

  // Prefer fd whenever discovery is needed and it is available
  if (tool_availability.fd === true) {
    return { value: 'fd', confidence: 'HIGH', rule_id: 'file-discovery-mode' };
  }

  // Fallback: Node.js fs
  return { value: 'node', confidence: 'HIGH', rule_id: 'file-discovery-mode' };
}

/**
 * Search mode selection.
 * Recommends ripgrep vs fd vs Node.js based on tool availability and .gitignore requirements.
 * Fallback chain: ripgrep -> fd (when gitignore needed) -> node
 *
 * @param {object} state - { tool_availability: object, needs_gitignore_respect: boolean }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveSearchMode(state) {
  const { tool_availability = {}, needs_gitignore_respect = true } = state || {};

  // ripgrep is the fastest and respects .gitignore by default
  if (tool_availability.ripgrep === true) {
    return { value: 'ripgrep', confidence: 'HIGH', rule_id: 'search-mode' };
  }

  // fd respects .gitignore — use when gitignore respect is needed
  if (tool_availability.fd === true && needs_gitignore_respect) {
    return { value: 'fd', confidence: 'HIGH', rule_id: 'search-mode' };
  }

  // Fallback: Node.js (does NOT respect .gitignore automatically)
  return { value: 'node', confidence: 'HIGH', rule_id: 'search-mode' };
}

/**
 * Structural code search mode selection.
 * Prefer ast-grep for syntax-aware matches, then ripgrep for text search, then Node.js.
 *
 * @param {object} state - { tool_availability: object }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveStructuralSearchMode(state) {
  const { tool_availability = {} } = state || {};

  if (tool_availability.ast_grep === true) {
    return { value: 'ast-grep', confidence: 'HIGH', rule_id: 'structural-search-mode' };
  }

  if (tool_availability.ripgrep === true) {
    return { value: 'ripgrep', confidence: 'HIGH', rule_id: 'structural-search-mode' };
  }

  return { value: 'node', confidence: 'HIGH', rule_id: 'structural-search-mode' };
}

/**
 * JSON transform mode selection.
 *
 * @param {object} state - { tool_availability: object }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveJsonTransformMode(state) {
  const { tool_availability = {} } = state || {};
  if (tool_availability.jq === true) {
    return { value: 'jq', confidence: 'HIGH', rule_id: 'json-transform-mode' };
  }
  return { value: 'node', confidence: 'HIGH', rule_id: 'json-transform-mode' };
}

/**
 * YAML transform mode selection.
 *
 * @param {object} state - { tool_availability: object }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveYamlTransformMode(state) {
  const { tool_availability = {} } = state || {};
  if (tool_availability.yq === true) {
    return { value: 'yq', confidence: 'HIGH', rule_id: 'yaml-transform-mode' };
  }
  return { value: 'node', confidence: 'HIGH', rule_id: 'yaml-transform-mode' };
}

/**
 * Text replace mode selection.
 *
 * @param {object} state - { tool_availability: object }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveTextReplaceMode(state) {
  const { tool_availability = {} } = state || {};
  if (tool_availability.sd === true) {
    return { value: 'sd', confidence: 'HIGH', rule_id: 'text-replace-mode' };
  }
  return { value: 'node', confidence: 'HIGH', rule_id: 'text-replace-mode' };
}

/**
 * Benchmark mode selection.
 *
 * @param {object} state - { tool_availability: object }
 * @returns {{ value: string, confidence: string, rule_id: string }}
 */
function resolveBenchmarkMode(state) {
  const { tool_availability = {} } = state || {};
  if (tool_availability.hyperfine === true) {
    return { value: 'hyperfine', confidence: 'HIGH', rule_id: 'benchmark-mode' };
  }
  return { value: 'node', confidence: 'HIGH', rule_id: 'benchmark-mode' };
}

// ─── Phase 202: Kahn Topological Sort ─────────────────────────────────────────

/**
 * Kahn topological sort with declared depends_on verification.
 * Returns wave-ordered phases and confirms no dependency violations.
 *
 * @param {object} state - { phases: Array<{number, depends_on: string[]|null}> }
 * @returns {{ value: { ordered_phases: Array, waves: object, verification: { valid: boolean, errors: string[] } }, confidence: string, rule_id: string }}
 */
function resolvePhaseDependencies(state) {
  const { phases: rawPhases } = state || {};
  const phases = Array.isArray(rawPhases) ? rawPhases : [];

  // Build adjacency: phase -> [deps] and in-degree tracking
  const adj = new Map();
  const inDegree = new Map();
  const phaseByNum = new Map();

  for (const p of phases) {
    const num = String(p.number);
    adj.set(num, []);
    inDegree.set(num, 0);
    phaseByNum.set(num, p);
  }

  // Build graph edges and compute in-degrees
  for (const p of phases) {
    const deps = p.depends_on || [];
    for (const dep of deps) {
      if (adj.has(dep)) {
        adj.get(dep).push(String(p.number));
        inDegree.set(String(p.number), (inDegree.get(String(p.number)) || 0) + 1);
      }
    }
  }

  // Kahn BFS: process zero in-degree nodes first
  const queue = [];
  const ordered = [];

  for (const [num, degree] of inDegree) {
    if (degree === 0) queue.push(num);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);

    for (const neighbor of (adj.get(current) || [])) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Cycle detection: if not all phases in output, cycles exist
  if (ordered.length !== phases.length) {
    const remaining = phases.filter(p => !ordered.includes(String(p.number)));
    return {
      value: {
        ordered_phases: [],
        waves: {},
        verification: { valid: false, errors: [`cycle detected involving: ${remaining.map(p => p.number).join(', ')}`] }
      },
      confidence: 'HIGH',
      rule_id: 'phase-dependencies'
    };
  }

  // Wave assignment: phase wave = max(dep waves) + 1
  const waves = {};
  for (const num of ordered) {
    const deps = phaseByNum.get(num)?.depends_on || [];
    let wave = 1;
    for (const dep of deps) {
      const depWave = waves[dep] || 1;
      wave = Math.max(wave, depWave + 1);
    }
    waves[num] = wave;
  }

  // Verification pass: confirm each declared dep precedes its dependent
  const verificationErrors = [];
  const orderedSet = new Set(ordered);
  for (const num of ordered) {
    const deps = phaseByNum.get(num)?.depends_on || [];
    for (const dep of deps) {
      const depIdx = ordered.indexOf(dep);
      const numIdx = ordered.indexOf(num);
      if (depIdx >= numIdx) {
        verificationErrors.push(`${num} depends on ${dep} but ${dep} does not precede ${num} in ordering`);
      }
    }
  }

  return {
    value: {
      ordered_phases: ordered.map(n => phaseByNum.get(n)),
      waves,
      verification: { valid: verificationErrors.length === 0, errors: verificationErrors }
    },
    confidence: 'HIGH',
    rule_id: 'phase-dependencies'
  };
}

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
  // Phase 122: New decision functions
  resolveModelSelection,
  resolveVerificationRouting,
  resolveResearchGate,
  resolveMilestoneCompletion,
  resolveCommitStrategy,
  // Phase 141: Question taxonomy decision functions
  resolveQuestionType,
  resolveOptionGeneration,
  // Phase 127: Tool routing decision functions
  resolveFileDiscoveryMode,
  resolveSearchMode,
  resolveStructuralSearchMode,
  resolveJsonTransformMode,
  resolveYamlTransformMode,
  resolveTextReplaceMode,
  resolveBenchmarkMode,
  // Phase 202: Kahn topological sort
  resolvePhaseDependencies,
  // Registry and aggregator
  DECISION_REGISTRY,
  evaluateDecisions,
};
