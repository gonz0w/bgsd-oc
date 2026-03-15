// ─── Trajectory Scopes ───────────────────────────────────────────────────────

const VALID_TRAJECTORY_SCOPES = ['task', 'plan', 'phase'];

// ─── Model Profile Table ─────────────────────────────────────────────────────

/** @deprecated Phase 122: Use model-selection decision rule backed by SQLite model_profiles table instead */
const MODEL_PROFILES = {
  'bgsd-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'bgsd-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bgsd-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bgsd-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'bgsd-project-researcher':    { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'bgsd-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'bgsd-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'bgsd-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'bgsd-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ─── Config Schema ───────────────────────────────────────────────────────────

const CONFIG_SCHEMA = {
  model_profile:             { type: 'string',  default: 'balanced',                     description: 'Active model profile (quality/balanced/budget)',  aliases: [], nested: null },
  commit_docs:               { type: 'boolean', default: true,                            description: 'Auto-commit planning docs',                      aliases: [], nested: { section: 'planning', field: 'commit_docs' } },
  search_gitignored:         { type: 'boolean', default: false,                           description: 'Include gitignored files in searches',            aliases: [], nested: { section: 'planning', field: 'search_gitignored' } },
  branching_strategy:        { type: 'string',  default: 'none',                          description: 'Git branching strategy',                          aliases: [], nested: { section: 'git', field: 'branching_strategy' } },
  phase_branch_template:     { type: 'string',  default: 'bgsd/phase-{phase}-{slug}',      description: 'Phase branch name template',                      aliases: [], nested: { section: 'git', field: 'phase_branch_template' } },
  milestone_branch_template: { type: 'string',  default: 'bgsd/{milestone}-{slug}',        description: 'Milestone branch name template',                  aliases: [], nested: { section: 'git', field: 'milestone_branch_template' } },
  research:                  { type: 'boolean', default: true,                            description: 'Enable research phase',                           aliases: ['research_enabled'], nested: { section: 'workflow', field: 'research' } },
  plan_checker:              { type: 'boolean', default: true,                            description: 'Enable plan checking',                            aliases: [], nested: { section: 'workflow', field: 'plan_check' } },
  verifier:                  { type: 'boolean', default: true,                            description: 'Enable verification phase',                       aliases: [], nested: { section: 'workflow', field: 'verifier' } },
  parallelization:           { type: 'boolean', default: true,                            description: 'Enable parallel plan execution',                  aliases: [], nested: null, coerce: 'parallelization' },
  brave_search:              { type: 'boolean', default: false,                           description: 'Enable Brave Search API',                         aliases: [], nested: null },
  mode:                      { type: 'string',  default: 'interactive',                   description: 'Execution mode (interactive or yolo)',             aliases: [], nested: null },
  depth:                     { type: 'string',  default: 'standard',                      description: 'Planning depth',                                  aliases: [], nested: null },
  test_commands:             { type: 'object',  default: {},                              description: 'Test commands by framework',                      aliases: [], nested: null },
  test_gate:                 { type: 'boolean', default: true,                            description: 'Block plan completion on test failure',            aliases: [], nested: null },
  context_window:            { type: 'number',  default: 200000,                          description: 'Context window size in tokens',                    aliases: [], nested: null },
  context_target_percent:    { type: 'number',  default: 50,                              description: 'Target context utilization percent (1-100)',        aliases: [], nested: null },
  runtime:                   { type: 'string',  default: 'auto',                           description: 'Runtime to use (auto/bun/node)',                aliases: [], nested: null },

  // ─── RAG Research Pipeline ───
  rag_enabled:               { type: 'boolean', default: true,                            description: 'Enable RAG-powered research pipeline',              aliases: [], nested: { section: 'workflow', field: 'rag' } },
  rag_timeout:               { type: 'number',  default: 30,                              description: 'Per-tool research timeout in seconds',               aliases: [], nested: { section: 'workflow', field: 'rag_timeout' } },
  ytdlp_path:                { type: 'string',  default: '',                              description: 'Path to yt-dlp binary (auto-detects if empty)',      aliases: [], nested: null },
  nlm_path:                  { type: 'string',  default: '',                              description: 'Path to notebooklm-py binary (auto-detects if empty)', aliases: [], nested: null },
  mcp_config_path:           { type: 'string',  default: '',                              description: 'Path to MCP server config file (auto-detects if empty)', aliases: [], nested: null },

  // ─── Dependency-Backed Optimizations ───
  optimization:               { type: 'object',  default: {},                              description: 'Optimization flags for dependency-backed features', aliases: [], nested: null },
  optimization_valibot:     { type: 'boolean', default: true,                            description: 'Use valibot for schema validation',                   aliases: [], nested: { section: 'optimization', field: 'valibot' }, env: 'BGSD_DEP_VALIBOT' },
  optimization_discovery:   { type: 'string',  default: 'optimized',                    description: 'File discovery mode',                              aliases: [], nested: { section: 'optimization', field: 'discovery' }, env: 'BGSD_DISCOVERY_MODE', values: ['optimized', 'legacy'] },
  optimization_compile_cache: { type: 'boolean', default: false,                         description: 'Enable Node.js compile-cache',                     aliases: [], nested: { section: 'optimization', field: 'compile_cache' }, env: 'BGSD_COMPILE_CACHE' },
  optimization_sqlite_cache: { type: 'boolean', default: true,                           description: 'SQLite statement caching',                       aliases: [], nested: { section: 'optimization', field: 'sqlite_cache' }, env: 'BGSD_SQLITE_STATEMENT_CACHE' },
};

// ─── Command Help ────────────────────────────────────────────────────────────

const COMMAND_HELP = {

  'util:codebase context': `Usage: bgsd-tools codebase context --files <file1> [file2] ... [--plan <path>]
       bgsd-tools codebase context --task <file1,file2,...> [--plan <path>] [--budget <tokens>]

Assemble per-file architectural context from cached intel.

Mode 1 (--files): Full context with imports, dependents, conventions, risk levels.
Mode 2 (--task):  Task-scoped context using dep graph + relevance scoring.
  Returns only files relevant to the task with scores and optional AST signatures.

Options:
  --files <paths>    Target file paths for full context mode
  --task <paths>     Comma-separated task files for scoped context mode
  --plan <path>      Plan file for scope signal (reads files_modified)
  --budget <tokens>  Token budget for task-scoped output (default: 3000)

Output (--task): { task_files, context_files: [{path, score, reason, signatures?}], stats }

Examples:
  bgsd-tools codebase context --files src/lib/ast.js
  bgsd-tools codebase context --task src/lib/ast.js,src/router.js --budget 2000`,

  'util:codebase ast': `Usage: bgsd-tools codebase ast <file>

Extract function, class, and method signatures from a source file.

For JS/TS: Uses acorn AST parsing with TypeScript stripping.
For Python, Go, Rust, Ruby, Elixir, Java, PHP: Uses regex-based extraction.

Arguments:
  file   Source file path to analyze

Output: { file, language, signatures: [{name, type, params, line, async, generator}], count }

Examples:
  bgsd-tools codebase ast src/lib/ast.js
  bgsd-tools codebase ast app.py`,

  'util:codebase exports': `Usage: bgsd-tools codebase exports <file>

Extract the export surface from a JS/TS module.

Detects ESM exports (named, default, re-exports) and CJS exports
(module.exports, exports patterns). Reports module type (esm/cjs/mixed).

Arguments:
  file   Source file path to analyze

Output: { file, type, named, default, re_exports, cjs_exports }

Examples:
  bgsd-tools codebase exports src/lib/ast.js
  bgsd-tools codebase exports src/router.js`,

  'util:codebase complexity': `Usage: bgsd-tools codebase complexity <file>

Compute per-function cyclomatic complexity for a source file.

For JS/TS: Uses acorn AST to walk each function body, counting branching
nodes (if, for, while, switch, catch, ternary, logical operators) and
tracking max nesting depth.

For other languages: Uses regex approximation counting branching keywords.

Arguments:
  file   Source file path to analyze

Output: { file, module_complexity, functions: [{name, line, complexity, nesting_max}] }

Color coding (formatted mode): green(1-5), yellow(6-10), red(11+)

Examples:
  bgsd-tools codebase complexity src/router.js
  bgsd-tools codebase complexity src/lib/ast.js`,

  'util:codebase repo-map': `Usage: bgsd-tools codebase repo-map [--budget <tokens>]

Generate a compact repository map from AST signatures.

Walks all source files, extracts function/class/method signatures and
exports, then builds a compact text summary sorted by signature density.
Designed for agent context injection (~1k tokens by default).

Options:
  --budget <tokens>   Token budget for output (default: 1000)

Output (raw): { summary, files_included, total_signatures, token_estimate }
Output (formatted): The summary text directly

Examples:
  bgsd-tools codebase repo-map
  bgsd-tools codebase repo-map --budget 500`,

  'execute:trajectory': `Usage: bgsd-tools trajectory <subcommand> [options]

Trajectory engineering commands.

Subcommands:
  checkpoint <name>  Create named checkpoint with auto-metrics
    --scope <scope>       Scope level (default: phase)
    --description <text>  Optional context description
  list               List all checkpoints with metrics
    --scope <scope>       Filter by scope
    --name <name>         Filter by checkpoint name
    --limit <N>           Limit results
  compare <name>     Compare metrics across all attempts for a checkpoint
    --scope <scope>       Scope level (default: phase)
  pivot <checkpoint>   Abandon current approach, rewind to checkpoint
    --scope <scope>       Scope level (default: phase)
    --reason <text>       Why this approach is being abandoned (required)
    --attempt <N>         Target specific attempt (default: most recent)
    --stash               Auto-stash dirty working tree before pivot
  choose <name> --attempt <N>   Select winner, archive rest, clean up
    --scope <scope>       Scope level (default: phase)
    --reason <text>       Why this attempt was chosen (recorded in journal)
  dead-ends              Query journal for failed approaches
    --scope <scope>       Filter by scope (task, plan, phase)
    --name <name>         Filter by checkpoint name
    --limit <N>           Max results (default: 10)
    --token-cap <N>       Token cap for context output (default: 500)

Creates a git branch at trajectory/<scope>/<name>/attempt-N and writes a
journal entry to the trajectories memory store with test count, LOC delta,
and cyclomatic complexity metrics.

Examples:
  bgsd-tools trajectory checkpoint explore-auth
  bgsd-tools trajectory checkpoint try-redis --scope task --description "Redis caching approach"
  bgsd-tools trajectory list
  bgsd-tools trajectory list --scope phase --limit 5
  bgsd-tools trajectory compare my-feat
  bgsd-tools trajectory pivot explore-auth --reason "JWT approach too complex"
  bgsd-tools trajectory choose my-feat --attempt 2 --reason "Better test coverage"
  bgsd-tools trajectory dead-ends
  bgsd-tools trajectory dead-ends --scope task --limit 5`,

  'execute:trajectory compare': `Usage: bgsd-tools trajectory compare <name> [--scope <scope>]

Compare metrics across all attempts for a named checkpoint.
Shows test results, LOC delta, and cyclomatic complexity side-by-side.
Best values highlighted green, worst highlighted red.

Arguments:
  name              Checkpoint name to compare attempts for

Options:
  --scope <scope>   Scope level (default: phase)

Output: { checkpoint, scope, attempt_count, attempts, best_per_metric, worst_per_metric }

Examples:
  bgsd-tools trajectory compare my-feat
  bgsd-tools trajectory compare try-redis --scope task`,

  'execute:trajectory choose': `Usage: bgsd-tools trajectory choose <name> --attempt <N> [--scope <scope>] [--reason "rationale"]

Select the winning attempt, merge its code, archive non-chosen attempts as tags,
and delete all trajectory working branches.

Arguments:
  name              Checkpoint name to finalize

Options:
  --attempt <N>     Required. The winning attempt number
  --scope <scope>   Scope level (default: phase)
  --reason "text"   Why this attempt was chosen (recorded in journal)

What happens:
  1. Winning attempt branch is merged into current branch (--no-ff)
  2. Non-chosen attempt branches are archived as lightweight git tags
  3. All trajectory working branches are deleted (tags preserved)
  4. Journal records the choice with rationale

Examples:
  bgsd-tools trajectory choose my-feat --attempt 2
  bgsd-tools trajectory choose try-redis --scope task --attempt 1 --reason "Lower complexity"`,

  'execute:trajectory pivot': `Usage: bgsd-tools trajectory pivot <checkpoint> --reason "what failed and why"

Abandon current approach with recorded reasoning and rewind to checkpoint.
Auto-checkpoints current work as abandoned attempt before rewinding.

Arguments:
  checkpoint          Name of checkpoint to rewind to

Options:
  --scope <scope>     Scope level (default: phase)
  --reason <text>     Structured reason for abandoning (required)
  --attempt <N>       Target specific attempt number (default: most recent)
  --stash             Auto-stash dirty working tree before pivot

Output: { pivoted, checkpoint, target_ref, abandoned_branch, files_rewound, stash_used }

Examples:
  bgsd-tools trajectory pivot explore-auth --reason "JWT approach too complex, session-based simpler"
  bgsd-tools trajectory pivot try-redis --scope task --reason "Redis overkill for this cache size"
  bgsd-tools trajectory pivot my-feature --attempt 2 --reason "Attempt 2 had better foundation"`,

  'execute:trajectory dead-ends': `Usage: bgsd-tools trajectory dead-ends [--scope <scope>] [--name <name>] [--limit <N>] [--token-cap <N>]

Query journal for failed approaches (pivot/abandon entries).
Shows "what NOT to do" context with reasons from pivot entries.

Options:
  --scope <scope>   Filter by scope (task, plan, phase)
  --name <name>     Filter by checkpoint name
  --limit <N>       Max results (default: 10)
  --token-cap <N>   Token cap for context output (default: 500)

Output: { dead_ends, count, scope_filter, name_filter, context }

Examples:
  bgsd-tools trajectory dead-ends
  bgsd-tools trajectory dead-ends --scope task --limit 5`,

  'util:classify plan': `Usage: bgsd-tools classify plan <plan-path>

Classify all tasks in a plan file with 1-5 complexity scores.

Scoring factors: file count, cross-module blast radius, test requirements,
checkpoint complexity, action length.

Model mapping: score 1-2 → sonnet, score 3 → sonnet, score 4-5 → opus

Output: { plan, wave, autonomous, task_count, tasks: [{name, complexity}], plan_complexity, recommended_model }

Examples:
  bgsd-tools classify plan .planning/phases/39-orchestration-intelligence/39-01-PLAN.md`,

  'util:classify phase': `Usage: bgsd-tools classify phase <phase-number>

Classify all incomplete plans in a phase and determine execution mode.

Execution modes:
  single      1 plan with 1-2 tasks
  parallel    Multiple plans in same wave, no file overlaps
  sequential  Plans with checkpoint tasks
  pipeline    Plans spanning 3+ waves

Output: { phase, plans_classified, plans: [...], execution_mode: { mode, reason, waves } }

Examples:
  bgsd-tools classify phase 39
  bgsd-tools classify phase 38`,

  'util:git': `Usage: bgsd-tools git <log|diff-summary|blame|branch-info|rewind|trajectory-branch> [options]

Structured git intelligence — JSON output for agents and workflows.

Subcommands:
  log [--count N] [--since D] [--until D] [--author A] [--path P]
    Structured commit log with file stats and conventional commit parsing.
  diff-summary [--from ref] [--to ref] [--path P]
    Diff stats between two refs (default: HEAD~1..HEAD).
  blame <file>
    Line-to-commit/author mapping for a file.
  branch-info
    Current branch state: detached, shallow, dirty, rebasing, upstream.
  rewind --ref <ref> [--confirm] [--dry-run]
    Selective code rewind protecting .planning/ and root configs.
    Shows diff summary of changes. --dry-run previews without modifying.
    --confirm executes the rewind. Auto-stashes dirty working tree.
  trajectory-branch --phase <N> --slug <name> [--push]
    Create branch in gsd/trajectory/{phase}-{slug} namespace.
    Local-only by default. --push to push to origin.

Examples:
  bgsd-tools git log --count 5
  bgsd-tools git diff-summary --from main --to HEAD
  bgsd-tools git blame src/router.js
  bgsd-tools git branch-info
  bgsd-tools git rewind --ref HEAD~3 --dry-run
  bgsd-tools git rewind --ref abc123 --confirm
  bgsd-tools git trajectory-branch --phase 45 --slug decision-journal`,

  // ─── Namespaced Command Help (user-facing only) ──────────────────────────────

  // plan namespace
  'plan:intent': `Usage: bgsd-tools plan:intent <subcommand> [options]

Manage project intent in INTENT.md.

Subcommands:
  create      Create a new INTENT.md
  show        Display intent summary
  read        Read intent as JSON
  update      Update INTENT.md sections
  validate    Validate INTENT.md structure
  trace       Traceability matrix
  drift       Drift analysis`,
  'plan:intent show': `Usage: bgsd-tools plan:intent show [section] [--full]

Display intent summary from INTENT.md.`,
  'plan:requirements': `Usage: bgsd-tools plan:requirements mark-complete <ids>

Mark requirement IDs as complete.`,
  'plan:roadmap': `Usage: bgsd-tools plan:roadmap <subcommand> [args]

Roadmap operations.

Subcommands:
  get-phase <phase>   Extract phase section from ROADMAP.md
  analyze             Full roadmap parse with disk status
  update-plan-progress <N>  Update progress table row from disk`,
  'plan:phases': `Usage: bgsd-tools plan:phases list [options]

List phase directories with metadata.`,
  'plan:find-phase': `Usage: bgsd-tools plan:find-phase <phase>

Find a phase directory by number.`,
  'plan:milestone': `Usage: bgsd-tools plan:milestone complete <version> [options]

Complete a milestone.`,
  'plan:phase': `Usage: bgsd-tools plan:phase <subcommand> [args]

Phase lifecycle operations.

Subcommands:
  next-decimal <phase>   Calculate next decimal phase
  add <description>       Append new phase
  insert <after> <desc>  Insert decimal phase
  remove <phase> [--force]  Remove phase
  complete <phase>       Mark phase done`,

  // execute namespace
  'execute:commit': `Usage: bgsd-tools execute:commit <message> [--files f1 f2 ...] [--amend] [--agent <type>]

Commit planning documents to git.`,
  'execute:rollback-info': `Usage: bgsd-tools execute:rollback-info <plan-id>

Show commits and revert command for a plan.`,
  'execute:session-diff': `Usage: bgsd-tools execute:session-diff

Show git commits since last session activity.`,
  'execute:session-summary': `Usage: bgsd-tools execute:session-summary

Session handoff summary.`,
  'execute:velocity': `Usage: bgsd-tools execute:velocity

Calculate planning velocity and completion forecast.`,
  'execute:worktree': `Usage: bgsd-tools execute:worktree <subcommand> [options]

Manage git worktrees for parallel execution.

Subcommands:
  create <plan-id>    Create isolated worktree
  list                List active worktrees
  remove <plan-id>    Remove a worktree
  cleanup             Remove all worktrees
  merge <plan-id>     Merge worktree back
  check-overlap       Check for file overlaps`,
  'execute:tdd': `Usage: bgsd-tools execute:tdd <subcommand> [options]

TDD validation gates.

Subcommands:
  validate-red --test-cmd "cmd"       Verify test fails
  validate-green --test-cmd "cmd"     Verify test passes
  validate-refactor --test-cmd "cmd" Same as validate-green
  auto-test --test-cmd "cmd"         Run test, report result`,
  'execute:test-run': `Usage: bgsd-tools execute:test-run

Run project tests and parse output.`,

  // verify namespace
  'verify:state': `Usage: bgsd-tools verify:state <subcommand> [options]

Manage project state in STATE.md.

Subcommands:
  load | get <field> | update <field> <value> | patch --key value ...
  advance-plan | update-progress
  record-metric --phase P --plan N --duration D [--tasks T] [--files F]
  add-decision --phase P --summary S [--rationale R]
  add-blocker --text "..." | resolve-blocker --text "..."
  record-session --stopped-at "..." [--resume-file path]
  validate [--fix]`,
  'verify:verify': `Usage: bgsd-tools verify:verify <subcommand> [args]

Verification suite for planning documents.

Subcommands:
  plan-structure <file>        Check PLAN.md structure
  phase-completeness <phase>   Check all plans have summaries
  references <file>            Check @-refs and paths resolve
  commits <h1> [h2] ...       Batch verify commit hashes
  artifacts <plan-file>        Check must_haves.artifacts
  key-links <plan-file>        Check must_haves.key_links
  analyze-plan <plan-file>     Analyze plan complexity
  deliverables [--plan file]   Run tests + verify deliverables
  requirements                 Check REQUIREMENTS.md coverage
  regression [--before f] [--after f]  Detect regressions
  plan-wave <phase-dir>        Check file conflicts
  plan-deps <phase-dir>        Check dependency cycles
  quality [--plan f] [--phase N]  Composite quality score`,
  'verify:assertions': `Usage: bgsd-tools verify:assertions <subcommand> [options]

Manage structured acceptance criteria.

Subcommands:
  list [--req SREQ-01]    List assertions by requirement
  validate                Check assertion format and coverage`,
  'verify:search-decisions': `Usage: bgsd-tools verify:search-decisions <query>

Search decisions in STATE.md and archives.`,
  'verify:search-lessons': `Usage: bgsd-tools verify:search-lessons <query>

Search tasks/lessons.md for patterns.`,
  'verify:review': `Usage: bgsd-tools verify:review <phase> <plan>

Review context for reviewer agent.`,
  'verify:context-budget': `Usage: bgsd-tools verify:context-budget <subcommand|path> [options]

Measure token consumption across workflows.

Subcommands:
  <path>                    Estimate tokens for a file
  baseline                  Measure all workflows, save baseline
  compare [baseline-path]   Compare current vs baseline`,
  'verify:token-budget': `Usage: bgsd-tools verify:token-budget

Show token counts for workflow files vs budgets.`,
  'verify:handoff': `Usage: bgsd-tools verify:handoff [options]

Validate agent handoff context transfer.

Options:
  --preview              Show what context would transfer between agents
  --from <agent>        Source agent name
  --to <agent>          Target agent name
  --validate <context>  Validate handoff completeness (state|plan|tasks|summary|all)

Examples:
  bgsd-tools verify:handoff --preview --from planner --to executor
  bgsd-tools verify:handoff --validate state`,
  'verify:agents': `Usage: bgsd-tools verify:agents [options]

Verify agent boundary contracts and capabilities.

Options:
  --verify              Verify specific agent contract
  --contracts           Show all handoff contracts
  --check-overlap       Check for capability overlap
  --from <agent>        Source agent name
  --to <agent>          Target agent name

Examples:
  bgsd-tools verify:agents --contracts
  bgsd-tools verify:agents --verify --from planner --to executor
  bgsd-tools verify:agents --check-overlap`,
  // util namespace
  'util:config-get': `Usage: bgsd-tools util:config-get <key.path>

Get configuration value from .planning/config.json.`,
  'util:config-set': `Usage: bgsd-tools util:config-set <key.path> <value>

Set configuration value in .planning/config.json.`,
  'util:config-migrate': `Usage: bgsd-tools util:config-migrate

Migrate .planning/config.json to match CONFIG_SCHEMA.
Adds missing keys with default values. Never overwrites existing values.
Creates backup before writing changes.`,
  'util:env': `Usage: bgsd-tools util:env <subcommand> [options]

Detect project languages, tools, and runtimes.

Subcommands:
  scan [--force] [--verbose]  Detect and write manifest
  status                      Check manifest freshness`,
  'util:current-timestamp': `Usage: bgsd-tools util:current-timestamp [format]

Return current UTC timestamp.`,
  'util:list-todos': `Usage: bgsd-tools util:list-todos [area]

Count and enumerate pending todos.`,
  'util:todo': `Usage: bgsd-tools util:todo complete <filename>

Mark todo as complete.`,
  'util:memory': `Usage: bgsd-tools util:memory <subcommand> [options]

Persistent memory store.

Subcommands:
  write --store <name> --entry '{json}'   Write entry
  read --store <name> [options]           Read entries
  list                                    List stores
  ensure-dir                              Create directory
  compact [--store <name>] [--threshold N]  Compact old entries`,
  'util:mcp': `Usage: bgsd-tools util:mcp <subcommand> [options]

MCP server management.

Subcommands:
  profile [--window N] [--apply] [--restore]  Manage profiles`,
  'util:classify': `Usage: bgsd-tools util:classify <plan|phase> <path-or-number>

Classify complexity and recommend execution strategy.`,
  'util:frontmatter': `Usage: bgsd-tools util:frontmatter <subcommand> <file> [options]

CRUD operations on YAML frontmatter.

Subcommands:
  get <file> [--field key]        Extract frontmatter as JSON
  set <file> --field k --value v  Update single field
  merge <file> --data '{json}'    Merge JSON into frontmatter
  validate <file> --schema type   Validate format`,
  'util:validate-commands': `Usage: bgsd-tools util:validate-commands

Validate command registry - checks help text alignment with routing.

Compares COMMAND_HELP keys against router implementations to detect:
- Commands in help that have no routing
- Missing help text for implemented commands
- Format inconsistencies (space vs colon)

Exit code 0 if all valid, non-zero if issues found.`,
  'util:validate-artifacts': `Usage: bgsd-tools util:validate-artifacts

Validate planning artifacts for structural issues.

Checks:
- MILESTONES.md: Balanced headers, valid date formats
- PROJECT.md: Balanced <details> tags, no strikethrough in out-of-scope
- Required files exist: STATE.md, ROADMAP.md

Exit code 0 if all valid, non-zero if errors found.`,
  'util:progress': `Usage: bgsd-tools util:progress [format]

Render progress in various formats.`,
  'util:websearch': `Usage: bgsd-tools util:websearch <query> [--limit N] [--freshness day|week|month]

Search web via Brave Search API.`,
  'util:history-digest': `Usage: bgsd-tools util:history-digest [--limit N] [--phases N1,N2] [--slim]

Aggregate all SUMMARY.md data into digest.`,
  'util:trace-requirement': `Usage: bgsd-tools util:trace-requirement <req-id>

Trace requirement from spec to files on disk.`,
  'util:codebase': `Usage: bgsd-tools util:codebase <subcommand> [options]

Codebase intelligence.

Subcommands:
  analyze                  Full codebase analysis
  status                   Current codebase status
  conventions              Extract code conventions
  rules                    Extract linting rules
  deps                     Dependency analysis
  impact                   Module blast radius
  context                  Architectural context
  lifecycle                Lifecycle analysis
  ast                      Function signatures
  exports                  Export surface
  complexity               Cyclomatic complexity
  repo-map                 Repository map`,
  'util:cache': `Usage: bgsd-tools util:cache <subcommand> [options]

Cache management.

Subcommands:
  status                   Show cache backend and entry count
  clear                    Clear cache
  warm [files...]          Pre-populate cache`,
  'util:agent': `Usage: bgsd-tools util:agent <subcommand> [options]

Agent management.

Subcommands:
  audit                                Audit agent lifecycle coverage against RACI matrix
  list                                 List all agents
  validate-contracts [--phase N]       Check agent outputs match declared contracts`,

  // research namespace
  'research': `Usage: bgsd-tools research <subcommand> [options]

Research infrastructure commands.

Subcommands:
  capabilities    Report available research tools, tier, and recommendations
  yt-search       Search YouTube via yt-dlp with filtering and quality scoring
  yt-transcript   Extract clean plain-text transcript from YouTube video
  collect         Orchestrate multi-source collection pipeline with tier degradation
  nlm-create      Create a NotebookLM notebook
  nlm-add-source  Add a source (URL, file, YouTube) to a NotebookLM notebook`,
  'research capabilities': `Usage: bgsd-tools research capabilities

Report available research tools, current degradation tier, and recommendations.

Detects: yt-dlp (YouTube), notebooklm-py (RAG synthesis), Brave Search MCP, Context7 MCP, Exa MCP.
Shows: 4-tier degradation level, per-tool status, install hints for missing tools.

Output: { rag_enabled, current_tier, tiers, cli_tools, mcp_servers, recommendations }`,
  'research:capabilities': `Usage: bgsd-tools research:capabilities

Report available research tools, current degradation tier, and recommendations.

Detects: yt-dlp (YouTube), notebooklm-py (RAG synthesis), Brave Search MCP, Context7 MCP, Exa MCP.
Shows: 4-tier degradation level, per-tool status, install hints for missing tools.

Output: { rag_enabled, current_tier, tiers, cli_tools, mcp_servers, recommendations }`,
  'research yt-search': `Usage: bgsd-tools research yt-search "topic" [options]

Search YouTube via yt-dlp and return structured, filtered, quality-scored results.

Arguments:
  topic              Search query (required)

Options:
  --count N          Pre-filter result count (default: 10)
  --max-age DAYS     Maximum video age in days (default: 730 = ~2 years)
  --min-duration SEC Minimum duration in seconds (default: 300 = 5 min)
  --max-duration SEC Maximum duration in seconds (default: 3600 = 60 min)
  --min-views N      Minimum view count (default: 0)

Output: { query, pre_filter_count, post_filter_count, results: [{ id, title, channel, duration, view_count, upload_date, url, description, quality_score }] }

Quality score (0-100): Recency (40pts) + Views (30pts log-scale) + Duration (30pts bell curve at 15-20min).

Examples:
  bgsd-tools research yt-search "nodejs streams tutorial"
  bgsd-tools research:yt-search "react hooks" --count 5 --min-views 1000`,
  'research:yt-search': `Usage: bgsd-tools research:yt-search "topic" [options]

Search YouTube via yt-dlp and return structured, filtered, quality-scored results.

Arguments:
  topic              Search query (required)

Options:
  --count N          Pre-filter result count (default: 10)
  --max-age DAYS     Maximum video age in days (default: 730 = ~2 years)
  --min-duration SEC Minimum duration in seconds (default: 300 = 5 min)
  --max-duration SEC Maximum duration in seconds (default: 3600 = 60 min)
  --min-views N      Minimum view count (default: 0)

Output: { query, pre_filter_count, post_filter_count, results: [{ id, title, channel, duration, view_count, upload_date, url, description, quality_score }] }

Quality score (0-100): Recency (40pts) + Views (30pts log-scale) + Duration (30pts bell curve at 15-20min).

Examples:
  bgsd-tools research:yt-search "nodejs streams tutorial"
  bgsd-tools research:yt-search "react hooks" --count 5 --min-views 1000`,
  'research yt-transcript': `Usage: bgsd-tools research yt-transcript <video-id|url> [options]

Extract clean plain-text transcript from a YouTube video via yt-dlp subtitle download.

Arguments:
  video-id|url       YouTube video ID or full URL (required)

Options:
  --timestamps       Preserve [HH:MM:SS] timestamp markers (default: stripped)
  --lang LANG        Subtitle language code (default: en)

Output: { video_id, has_subtitles, language, auto_generated, transcript, word_count, char_count }

When no subtitles are available: { video_id, has_subtitles: false, message: "No subtitles available" }
When yt-dlp is missing: { error: "yt-dlp not installed", install_hint: "pip install yt-dlp" }

Full transcript is always returned — no truncation in JSON output.

Examples:
  bgsd-tools research yt-transcript dQw4w9WgXcQ
  bgsd-tools research:yt-transcript "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  bgsd-tools research yt-transcript dQw4w9WgXcQ --timestamps
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --lang es`,
  'research:yt-transcript': `Usage: bgsd-tools research:yt-transcript <video-id|url> [options]

Extract clean plain-text transcript from a YouTube video via yt-dlp subtitle download.

Arguments:
  video-id|url       YouTube video ID or full URL (required)

Options:
  --timestamps       Preserve [HH:MM:SS] timestamp markers (default: stripped)
  --lang LANG        Subtitle language code (default: en)

Output: { video_id, has_subtitles, language, auto_generated, transcript, word_count, char_count }

When no subtitles are available: { video_id, has_subtitles: false, message: "No subtitles available" }
When yt-dlp is missing: { error: "yt-dlp not installed", install_hint: "pip install yt-dlp" }

Full transcript is always returned — no truncation in JSON output.

Examples:
  bgsd-tools research:yt-transcript dQw4w9WgXcQ
  bgsd-tools research:yt-transcript "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --timestamps
  bgsd-tools research:yt-transcript dQw4w9WgXcQ --lang es`,
  'research collect': `Usage: bgsd-tools research collect "topic" [options]

Orchestrate multi-source collection from Brave Search and YouTube with 4-tier degradation.

Arguments:
  topic              Search query (required)

Options:
  --quick            Bypass pipeline entirely, return tier 4 with empty sources

Output: { tier, tier_name, query, source_count, sources, timing, agent_context }

Tiers:
  1 — Full RAG (all tools + NotebookLM synthesis)
  2 — Sources without synthesis (YouTube + MCP, LLM synthesizes)
  3 — Brave/Context7 only (web search, no video)
  4 — Pure LLM (no external sources)

Pipeline stages:
  [1/3] Web sources via Brave Search API (util:websearch subprocess)
  [2/3] YouTube search + top-video transcript (research:yt-search/yt-transcript)
  [3/3] Context7 availability note (MCP — agent accesses directly)

agent_context contains XML-tagged source data for LLM consumption at Tier 2/3.
At Tier 4 (--quick or no tools), agent_context is empty string.

Examples:
  bgsd-tools research collect "nodejs subprocess patterns"
  bgsd-tools research:collect --quick "test query"
  bgsd-tools research:collect "react hooks" --pretty`,
  'research:collect': `Usage: bgsd-tools research:collect "topic" [options]

Orchestrate multi-source collection from Brave Search and YouTube with 4-tier degradation.

Arguments:
  topic              Search query (required)

Options:
  --quick            Bypass pipeline entirely, return tier 4 with empty sources

Output: { tier, tier_name, query, source_count, sources, timing, agent_context }

Tiers:
  1 — Full RAG (all tools + NotebookLM synthesis)
  2 — Sources without synthesis (YouTube + MCP, LLM synthesizes)
  3 — Brave/Context7 only (web search, no video)
  4 — Pure LLM (no external sources)

Pipeline stages:
  [1/3] Web sources via Brave Search API (util:websearch subprocess)
  [2/3] YouTube search + top-video transcript (research:yt-search/yt-transcript)
  [3/3] Context7 availability note (MCP — agent accesses directly)

agent_context contains XML-tagged source data for LLM consumption at Tier 2/3.
At Tier 4 (--quick or no tools), agent_context is empty string.

Examples:
  bgsd-tools research:collect "nodejs subprocess patterns"
  bgsd-tools research:collect --quick "test query"
  bgsd-tools research:collect "react hooks" --pretty`,
  'research nlm-create': `Usage: bgsd-tools research nlm-create "title"

Create a NotebookLM notebook and return its ID.

Arguments:
  title              Notebook title (required)

Checks binary availability and auth health before execution.
Missing binary returns install hint. Expired auth returns re-auth instructions.

Output: { notebook_id, title, raw_output }
Error: { error, install_hint | reauth_command }

Examples:
  bgsd-tools research nlm-create "GSD Research Notes"
  bgsd-tools research:nlm-create "Phase 59 Sources"`,
  'research:nlm-create': `Usage: bgsd-tools research:nlm-create "title"

Create a NotebookLM notebook and return its ID.

Arguments:
  title              Notebook title (required)

Checks binary availability and auth health before execution.
Missing binary returns install hint. Expired auth returns re-auth instructions.

Output: { notebook_id, title, raw_output }
Error: { error, install_hint | reauth_command }

Examples:
  bgsd-tools research:nlm-create "GSD Research Notes"
  bgsd-tools research:nlm-create "Phase 59 Sources"`,
  'research nlm-add-source': `Usage: bgsd-tools research nlm-add-source <notebook-id> "source-url-or-path"

Add a source (URL, YouTube URL, local file) to a NotebookLM notebook.

Arguments:
  notebook-id        Notebook ID from nlm-create (required)
  source-url-or-path Source URL or local file path (required)

Sets the active notebook first, then adds the source. Uses 60s timeout for source processing.
Checks binary availability and auth health before execution.

Output: { notebook_id, source_url, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-add-source abc123 "https://example.com/docs"
  bgsd-tools research:nlm-add-source abc123 "https://youtube.com/watch?v=xxx"
  bgsd-tools research:nlm-add-source abc123 "./docs/research.pdf"`,
  'research:nlm-add-source': `Usage: bgsd-tools research:nlm-add-source <notebook-id> "source-url-or-path"

Add a source (URL, YouTube URL, local file) to a NotebookLM notebook.

Arguments:
  notebook-id        Notebook ID from nlm-create (required)
  source-url-or-path Source URL or local file path (required)

Sets the active notebook first, then adds the source. Uses 60s timeout for source processing.
Checks binary availability and auth health before execution.

Output: { notebook_id, source_url, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-add-source abc123 "https://example.com/docs"
  bgsd-tools research:nlm-add-source abc123 "https://youtube.com/watch?v=xxx"
  bgsd-tools research:nlm-add-source abc123 "./docs/research.pdf"`,
  'research nlm-ask': `Usage: bgsd-tools research nlm-ask <notebook-id> "question" [--new]

Ask a question against a NotebookLM notebook and receive a grounded answer with citations.

Arguments:
  notebook-id  Notebook ID to ask against (required)
  question     Question text (required, remaining positional args joined)

Options:
  --new        Start a fresh conversation (clears conversation history)

Sets the active notebook first, then sends the question. Uses 30s timeout.
Checks binary availability and auth health before execution.

Output: { notebook_id, question, answer, references, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-ask abc123 "What are the key themes?"
  bgsd-tools research:nlm-ask abc123 "Summarize implementation approach" --new`,
  'research:nlm-ask': `Usage: bgsd-tools research:nlm-ask <notebook-id> "question" [--new]

Ask a question against a NotebookLM notebook and receive a grounded answer with citations.

Arguments:
  notebook-id  Notebook ID to ask against (required)
  question     Question text (required, remaining positional args joined)

Options:
  --new        Start a fresh conversation (clears conversation history)

Sets the active notebook first, then sends the question. Uses 30s timeout.
Checks binary availability and auth health before execution.

Output: { notebook_id, question, answer, references, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-ask abc123 "What are the key themes?"
  bgsd-tools research:nlm-ask abc123 "Summarize implementation approach" --new`,
  'research nlm-report': `Usage: bgsd-tools research nlm-report <notebook-id> [--type TYPE] [--prompt "text"]

Generate a structured report from a NotebookLM notebook.

Arguments:
  notebook-id  Notebook ID to generate report from (required)

Options:
  --type TYPE   Report type: briefing-doc (default), study-guide, blog-post
  --prompt "text"  Custom report prompt (optional)

Uses 60s timeout — report generation is slow. Sets active notebook first.
Checks binary availability and auth health before execution.

Output: { notebook_id, report_type, content, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research nlm-report abc123 --type briefing-doc
  bgsd-tools research:nlm-report abc123 --type study-guide
  bgsd-tools research:nlm-report abc123 --prompt "Focus on security implications"`,
  'research:nlm-report': `Usage: bgsd-tools research:nlm-report <notebook-id> [--type TYPE] [--prompt "text"]

Generate a structured report from a NotebookLM notebook.

Arguments:
  notebook-id  Notebook ID to generate report from (required)

Options:
  --type TYPE   Report type: briefing-doc (default), study-guide, blog-post
  --prompt "text"  Custom report prompt (optional)

Uses 60s timeout — report generation is slow. Sets active notebook first.
Checks binary availability and auth health before execution.

Output: { notebook_id, report_type, content, raw_output }
Error: { error, install_hint | reauth_command | details }

Examples:
  bgsd-tools research:nlm-report abc123 --type briefing-doc
  bgsd-tools research:nlm-report abc123 --type study-guide
  bgsd-tools research:nlm-report abc123 --prompt "Focus on security implications"`,
  'research:collect --resume': 'Resume interrupted research session from last completed stage',
  'research collect --resume': 'Resume interrupted research session from last completed stage',

  // audit namespace
  // decisions namespace
  'decisions:list': `Usage: bgsd-tools decisions:list

List all registered decision rules with category, confidence range, and description.

Groups rules by category with section headers. Shows total rules and categories.

Output: { rules, summary: { total_rules, categories, category_list } }

Examples:
  bgsd-tools decisions:list
  bgsd-tools decisions:list --raw`,

  'decisions:inspect': `Usage: bgsd-tools decisions:inspect <rule_id>

Show full details of a specific decision rule.

Arguments:
  rule_id    The rule identifier (e.g., progress-route, context-gate)

Output: { id, name, category, description, inputs, outputs, confidence_range }

If rule not found, shows available rule IDs.

Examples:
  bgsd-tools decisions:inspect progress-route
  bgsd-tools decisions:inspect context-gate --raw`,

  'decisions:evaluate': `Usage: bgsd-tools decisions:evaluate <rule_id> [--state '{json}']

Evaluate a decision rule against a given state object.

Arguments:
  rule_id          The rule identifier to evaluate

Options:
  --state '{json}' JSON state object with input values for the rule

Output: { value, confidence, rule_id, metadata? }

If --state is omitted, evaluates with empty state (default values).

Examples:
  bgsd-tools decisions:evaluate context-gate --state '{"context_present":true}'
  bgsd-tools decisions:evaluate progress-route --state '{"plan_count":3,"summary_count":1,"roadmap_exists":true,"project_exists":true,"state_exists":true}'
  bgsd-tools decisions:evaluate auto-advance --state '{"auto_advance_config":true}' --raw`,

  'decisions:savings': `Usage: bgsd-tools decisions:savings

Show before/after LLM reasoning step counts per workflow.

Reports savings from decision offloading — how many LLM reasoning steps
each workflow used to perform vs how many remain after pre-computed decisions.

Output: { workflows: [{workflow, before, after, saved, decisions}], totals: {before, after, saved, percent_reduction}, note }

Examples:
  bgsd-tools decisions:savings
  bgsd-tools decisions:savings --raw`,

  'audit:scan': `Usage: bgsd-tools audit:scan

Scan workflows and agents for LLM-offloadable decisions with rubric scoring and token estimates.

Scans all workflow .md files and agent definitions for decision points where
the LLM currently reasons about things that deterministic code could handle.
Each candidate is scored against a 7-criteria rubric (3 critical + 4 preferred)
and assigned a token savings estimate.

Output: { candidates, offloadable, keep_in_llm, summary }

Summary includes: total_candidates, offloadable_count, keep_count,
estimated_total_savings, savings_by_category

Examples:
  bgsd-tools audit:scan
  bgsd-tools audit:scan --raw`,

  // Missing COMMAND_HELP entries - adding per plan 115-04

  // util namespace (20 commands)
  'util:settings': `Usage: bgsd-tools util:settings [key]

List all bGSD settings or get a specific value.

Arguments:
  key          Optional key path (e.g., "model_profile", "workflow.auto_advance")

Output: All settings with current values, types, and defaults, or single value.

Examples:
  bgsd-tools util:settings
  bgsd-tools util:settings model_profile`,

  'util:parity-check': `Usage: bgsd-tools util:parity-check

Check feature parity between production config and development config.

Compares settings in .planning/config.json against expected production defaults
and reports any gaps or mismatches.

Output: { parity_ok, differences: [...] }

Examples:
  bgsd-tools util:parity-check`,

  'util:resolve-model': `Usage: bgsd-tools util:resolve-model <agent-type>

Resolve which model to use for a given agent type based on profile settings.

Arguments:
  agent-type    Agent type (e.g., "bgsd-planner", "bgsd-executor")

Uses model_profile config (quality/balanced/budget) to select appropriate model.

Output: { agent_type, profile, resolved_model, quality_model, balanced_model, budget_model }

Examples:
  bgsd-tools util:resolve-model bgsd-planner
  bgsd-tools util:resolve-model bgsd-executor`,

  'util:verify-path-exists': `Usage: bgsd-tools util:verify-path-exists <path>

Verify that a path exists in the project.

Arguments:
  path         Path to verify (file or directory)

Returns whether the path exists and its type (file/directory).

Output: { path, exists: true|false, type: "file"|"directory"|"none" }

Examples:
  bgsd-tools util:verify-path-exists .planning/STATE.md
  bgsd-tools util:verify-path-exists src/lib`,

  'util:config-ensure-section': `Usage: bgsd-tools util:config-ensure-section

Ensure all required sections exist in .planning/config.json.

Creates missing sections with empty defaults. Does not overwrite existing values.

Output: { added: [...], existing: [...], config_ensured: true }

Examples:
  bgsd-tools util:config-ensure-section`,

  'util:scaffold': `Usage: bgsd-tools util:scaffold <type> [--path path]

Scaffold common planning files and structures.

Arguments:
  type         Type to scaffold (plan|phase|milestone|summary)

Options:
  --path       Target path for scaffold operation

Output: { scaffolded: [...], errors: [...] }

Examples:
  bgsd-tools util:scaffold plan --path .planning/phases/99-test
  bgsd-tools util:scaffold phase`,

  'util:phase-plan-index': `Usage: bgsd-tools util:phase-plan-index <phase>

Build or update phase plan index file.

Arguments:
  phase        Phase number or directory

Creates/updates .planning/phases/{phase}/INDEX.json with plan metadata.

Output: { phase, plans_indexed, index_path }

Examples:
  bgsd-tools util:phase-plan-index 99
  bgsd-tools util:phase-plan-index .planning/phases/99-test`,

  'util:state-snapshot': `Usage: bgsd-tools util:state-snapshot

Create a point-in-time snapshot of STATE.md.

Captures current phase, plan position, blockers, decisions, and metrics.

Output: { timestamp, phase, plan, position, blockers: [...], decisions: [...] }

Examples:
  bgsd-tools util:state-snapshot`,

  'util:summary-extract': `Usage: bgsd-tools util:summary-extract <summary-path> [fields...]

Extract specific fields from a SUMMARY.md file.

Arguments:
  summary-path  Path to SUMMARY.md file
  fields       Field names to extract (default: all)

Output: JSON with extracted field values.

Examples:
  bgsd-tools util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md one-liner
  bgsd-tools util:summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md`,

  'util:summary-generate': `Usage: bgsd-tools util:summary-generate <phase> <plan>

Generate SUMMARY.md scaffold from PLAN.md.

Arguments:
  phase        Phase number (e.g., "01", "99")
  plan         Plan number (e.g., "01", "04")

Creates a structured SUMMARY.md template based on PLAN.md frontmatter and tasks.

Output: JSON with generated sections and todo_remaining count.

Examples:
  bgsd-tools util:summary-generate 01 01
  bgsd-tools util:summary-generate 99 04`,

  'util:quick-summary': `Usage: bgsd-tools util:quick-summary [options]

Generate a quick task summary from current state.

Options:
  --plan <path>    Plan file to summarize
  --format         Output format (text|json)

Output: Summary of tasks, completion status, and time estimates.

Examples:
  bgsd-tools util:quick-summary
  bgsd-tools util:quick-summary --plan .planning/phases/01-foundation/01-01-PLAN.md`,

  'util:extract-sections': `Usage: bgsd-tools util:extract-sections <file> <section>...

Extract specific sections from a markdown file.

Arguments:
  file         Source markdown file
  sections     Section names to extract (e.g., "context", "tasks")

Output: JSON with section content.

Examples:
  bgsd-tools util:extract-sections .planning/PROJECT.md description goals`,

  'util:tools': `Usage: bgsd-tools util:tools [options]

Check status of external tools and dependencies.

Options:
  --detailed    Show detailed version info
  --json        Output as JSON

Detects: Node.js, Bun, git, yt-dlp, notebooklm-py, MCP servers.

Output: { tools: [...], all_available: true|false }

Examples:
  bgsd-tools util:tools
  bgsd-tools util:tools --detailed`,

  'util:runtime': `Usage: bgsd-tools util:runtime [options]

Show runtime information and benchmarks.

Options:
  --benchmark   Run quick benchmark
  --details     Show detailed timing

Reports runtime version, memory usage, and command execution times.

Output: { runtime, version, memory, benchmark_results: {...} }

Examples:
  bgsd-tools util:runtime
  bgsd-tools util:runtime --benchmark`,

  'util:recovery': `Usage: bgsd-tools util:recovery <subcommand> [options]

Auto-recovery and stuck task resolution.

Subcommands:
  analyze <error>     Analyze error and suggest fix
  checkpoint <json>  Restore from checkpoint
  stuck <task-id>     Diagnose why task is stuck

Examples:
  bgsd-tools util:recovery analyze "Cannot read property 'foo' of undefined"
  bgsd-tools util:recovery checkpoint '{"files":["a.js"],"type":"auto"}'
  bgsd-tools util:recovery stuck task-123`,

  'util:history': `Usage: bgsd-tools util:history [options]

Lookup command history and recent activity.

Options:
  --limit N         Number of entries (default: 10)
  --command <cmd>   Filter by command
  --since <date>    Filter since date

Output: { entries: [...], count }

Examples:
  bgsd-tools util:history
  bgsd-tools util:history --limit 20
  bgsd-tools util:history --command util:settings`,

  'util:examples': `Usage: bgsd-tools util:examples [command]

Show usage examples for a command or list all examples.

Arguments:
  command      Optional command to get examples for

Output: { examples: [...] }

Examples:
  bgsd-tools util:examples
  bgsd-tools util:examples util:codebase`,

  'util:analyze-deps': `Usage: bgsd-tools util:analyze-deps [path]

Analyze dependencies for a file or entire project.

Arguments:
  path         Optional file or directory path

Output: { dependencies: [...], dev_dependencies: [...], circular: [...] }

Examples:
  bgsd-tools util:analyze-deps
  bgsd-tools util:analyze-deps src/lib/utils.js`,

  'util:estimate-scope': `Usage: bgsd-tools util:estimate-scope <plan-path>

Estimate token scope for executing a plan.

Arguments:
  plan-path    Path to PLAN.md file

Analyzes task count, file modifications, and complexity to estimate context budget.

Output: { estimated_tokens, tasks, files, complexity, recommendation }

Examples:
  bgsd-tools util:estimate-scope .planning/phases/01-foundation/01-01-PLAN.md`,

  'util:test-coverage': `Usage: bgsd-tools util:test-coverage [options]

Show test coverage information.

Options:
  --summary     Show summary only
  --file <path> Coverage for specific file

Output: { lines_covered, lines_total, percentage, uncovered_lines: [...] }

Examples:
  bgsd-tools util:test-coverage
  bgsd-tools util:test-coverage --summary`,

  // verify namespace (7 commands)
  'verify:regression': `Usage: bgsd-tools verify:regression [options]

Detect regressions by comparing before/after states.

Options:
  --before <ref>    Before commit/tag (default: HEAD~1)
  --after <ref>     After commit/tag (default: HEAD)
  --plan <path>    Check plan-specific regressions

Runs test suite and compares outputs to detect behavioral changes.

Output: { regressions_found: N, details: [...] }

Examples:
  bgsd-tools verify:regression
  bgsd-tools verify:regression --before main --after HEAD
  bgsd-tools verify:regression --plan .planning/phases/01-foundation/01-01-PLAN.md`,

  'verify:quality': `Usage: bgsd-tools verify:quality [options]

Run composite quality checks on planning documents.

Options:
  --plan <path>    Check specific plan
  --phase <N>      Check entire phase
  --score          Show numeric score

Checks: structure, references, must_haves, key_links, dependencies.

Output: { quality_score, issues: [...], warnings: [...] }

Examples:
  bgsd-tools verify:quality
  bgsd-tools verify:quality --phase 01
  bgsd-tools verify:quality --plan .planning/phases/01-foundation/01-01-PLAN.md --score`,

  'verify:summary': `Usage: bgsd-tools verify:summary <summary-path>

Verify SUMMARY.md completeness and correctness.

Arguments:
  summary-path  Path to SUMMARY.md file

Checks: required sections, frontmatter completeness, task commit references.

Output: { valid: true|false, issues: [...], completeness_score }

Examples:
  bgsd-tools verify:summary .planning/phases/01-foundation/01-01-SUMMARY.md`,

  'verify:validate consistency': `Usage: bgsd-tools verify:validate consistency

Validate consistency across planning documents.

Checks: phase numbers match directories, plan numbers are sequential,
references resolve correctly, no orphaned files.

Output: { consistent: true|false, issues: [...] }

Examples:
  bgsd-tools verify:validate consistency`,

  'verify:validate health': `Usage: bgsd-tools verify:validate health [options]

Validate project health indicators.

Options:
  --detailed     Show detailed health metrics

Checks: test pass rate, recent commit activity, blocker count, phase progress.

Output: { healthy: true|false, metrics: {...}, recommendations: [...] }

Examples:
  bgsd-tools verify:validate health
  bgsd-tools verify:validate health --detailed`,

  'verify:validate-dependencies': `Usage: bgsd-tools verify:validate-dependencies

Validate phase and plan dependencies.

Checks: no circular dependencies, all required phases exist,
plan depends_on references valid.

Output: { valid: true|false, cycles: [...], missing: [...], warnings: [...] }

Examples:
  bgsd-tools verify:validate-dependencies`,

  'verify:validate-config': `Usage: bgsd-tools verify:validate-config [options]

Validate .planning/config.json against schema.

Options:
  --fix          Auto-fix trivial issues
  --detailed     Show detailed validation results

Checks: required keys present, types correct, defaults applied.

Output: { valid: true|false, issues: [...], fixed: [...] }

Examples:
  bgsd-tools verify:validate-config
  bgsd-tools verify:validate-config --fix`,

  // cache namespace (5 commands)
  'cache:research-stats': `Usage: bgsd-tools cache:research-stats

Show research cache statistics.

Reports entry count, hits, and misses for research results cached via
the research:collect command.

Output: { count, hits, misses, hit_rate_percent }

Examples:
  bgsd-tools cache:research-stats`,

  'cache:research-clear': `Usage: bgsd-tools cache:research-clear

Clear all research cache entries.

Removes cached research results from the research_cache table.
Does not affect general file cache.

Output: { cleared: true, entries_removed: N }

Examples:
  bgsd-tools cache:research-clear`,

  'cache:status': `Usage: bgsd-tools cache:status

Show cache backend type and entry count.

Reports which cache backend is active (memory/SQLite) and total entries.

Output: { backend, count, hits, misses }

Examples:
  bgsd-tools cache:status`,

  'cache:clear': `Usage: bgsd-tools cache:clear

Clear all cache entries.

Removes all entries from the active cache backend.
Does not affect research cache.

Output: { cleared: true, entries_removed: N }

Examples:
  bgsd-tools cache:clear`,

  'cache:warm': `Usage: bgsd-tools cache:warm [files...]

Pre-populate cache with file contents.

Arguments:
  files        Optional file paths to cache (default: all .planning/ files)

Discovers and caches planning documents for faster subsequent access.

Output: { warmed: N, elapsed_ms: M }

Examples:
  bgsd-tools cache:warm
  bgsd-tools cache:warm .planning/STATE.md .planning/ROADMAP.md`,
};

module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP, VALID_TRAJECTORY_SCOPES };
