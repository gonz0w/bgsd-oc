// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'gsd-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'gsd-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'gsd-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ─── Config Schema ───────────────────────────────────────────────────────────

const CONFIG_SCHEMA = {
  model_profile:             { type: 'string',  default: 'balanced',                     description: 'Active model profile (quality/balanced/budget)',  aliases: [], nested: null },
  commit_docs:               { type: 'boolean', default: true,                            description: 'Auto-commit planning docs',                      aliases: [], nested: { section: 'planning', field: 'commit_docs' } },
  search_gitignored:         { type: 'boolean', default: false,                           description: 'Include gitignored files in searches',            aliases: [], nested: { section: 'planning', field: 'search_gitignored' } },
  branching_strategy:        { type: 'string',  default: 'none',                          description: 'Git branching strategy',                          aliases: [], nested: { section: 'git', field: 'branching_strategy' } },
  phase_branch_template:     { type: 'string',  default: 'gsd/phase-{phase}-{slug}',      description: 'Phase branch name template',                      aliases: [], nested: { section: 'git', field: 'phase_branch_template' } },
  milestone_branch_template: { type: 'string',  default: 'gsd/{milestone}-{slug}',        description: 'Milestone branch name template',                  aliases: [], nested: { section: 'git', field: 'milestone_branch_template' } },
  research:                  { type: 'boolean', default: true,                            description: 'Enable research phase',                           aliases: ['research_enabled'], nested: { section: 'workflow', field: 'research' } },
  plan_checker:              { type: 'boolean', default: true,                            description: 'Enable plan checking',                            aliases: [], nested: { section: 'workflow', field: 'plan_check' } },
  verifier:                  { type: 'boolean', default: true,                            description: 'Enable verification phase',                       aliases: [], nested: { section: 'workflow', field: 'verifier' } },
  parallelization:           { type: 'boolean', default: true,                            description: 'Enable parallel plan execution',                  aliases: [], nested: null, coerce: 'parallelization' },
  brave_search:              { type: 'boolean', default: false,                           description: 'Enable Brave Search API',                         aliases: [], nested: null },
  mode:                      { type: 'string',  default: 'interactive',                   description: 'Execution mode (interactive or yolo)',             aliases: [], nested: null },
  model_profiles:            { type: 'object',  default: {},                              description: 'Model assignments per agent',                     aliases: [], nested: null },
  depth:                     { type: 'string',  default: 'standard',                      description: 'Planning depth',                                  aliases: [], nested: null },
  test_commands:             { type: 'object',  default: {},                              description: 'Test commands by framework',                      aliases: [], nested: null },
  test_gate:                 { type: 'boolean', default: true,                            description: 'Block plan completion on test failure',            aliases: [], nested: null },
};

// ─── Command Help ────────────────────────────────────────────────────────────

const COMMAND_HELP = {
  'state': `Usage: gsd-tools state <subcommand> [options] [--raw]

Manage project state in STATE.md.

Subcommands:
  load                      Load all state from STATE.md (default)
  get <field>               Get a specific field value
  update <field> <value>    Update a specific field
  patch --key value ...     Update multiple fields atomically
  advance-plan              Increment plan counter
  record-metric             Record execution metrics
    --phase P --plan N --duration D [--tasks T] [--files F]
  update-progress           Recalculate progress bar from disk
  add-decision              Add decision to state
    --phase P --summary S [--rationale R]
  add-blocker --text "..."  Add a blocker
  resolve-blocker --text "..." Remove a blocker
  record-session            Update session continuity
    --stopped-at "..." [--resume-file path]

Examples:
  gsd-tools state load --raw
  gsd-tools state advance-plan
  gsd-tools state add-decision --phase 03 --summary "Chose esbuild"`,

  'frontmatter': `Usage: gsd-tools frontmatter <subcommand> <file> [options] [--raw]

CRUD operations on YAML frontmatter in markdown files.

Subcommands:
  get <file> [--field key]        Extract frontmatter as JSON
  set <file> --field k --value v  Update single frontmatter field
  merge <file> --data '{json}'    Merge JSON into frontmatter
  validate <file> --schema type   Validate required fields
    Schema types: plan, summary, verification

Examples:
  gsd-tools frontmatter get plan.md --raw
  gsd-tools frontmatter set plan.md --field wave --value 2`,

  'verify': `Usage: gsd-tools verify <subcommand> [args] [--raw]

Verification suite for planning documents.

Subcommands:
  plan-structure <file>        Check PLAN.md structure + tasks
  phase-completeness <phase>   Check all plans have summaries
  references <file>            Check @-refs and paths resolve
  commits <h1> [h2] ...       Batch verify commit hashes exist
  artifacts <plan-file>        Check must_haves.artifacts from plan
  key-links <plan-file>        Check must_haves.key_links from plan

Examples:
  gsd-tools verify plan-structure .planning/phases/01-foundation/01-01-PLAN.md
  gsd-tools verify phase-completeness 01`,

  'roadmap': `Usage: gsd-tools roadmap <subcommand> [args] [--raw]

Roadmap operations.

Subcommands:
  get-phase <phase>            Extract phase section from ROADMAP.md
  analyze                      Full roadmap parse with disk status
  update-plan-progress <N>     Update progress table row from disk

Examples:
  gsd-tools roadmap analyze --raw
  gsd-tools roadmap update-plan-progress 03`,

  'phase': `Usage: gsd-tools phase <subcommand> [args] [--raw]

Phase lifecycle operations.

Subcommands:
  next-decimal <phase>         Calculate next decimal phase number
  add <description>            Append new phase to roadmap + create dir
  insert <after> <description> Insert decimal phase after existing
  remove <phase> [--force]     Remove phase, renumber subsequent
  complete <phase>             Mark phase done, update state + roadmap

Examples:
  gsd-tools phase add "Performance Optimization"
  gsd-tools phase complete 02`,

  'milestone': `Usage: gsd-tools milestone <subcommand> [args] [--raw]

Milestone lifecycle operations.

Subcommands:
  complete <version>           Archive milestone, create MILESTONES.md
    [--name <name>]
    [--archive-phases]         Move phase dirs to milestones/vX.Y-phases/

Examples:
  gsd-tools milestone complete v1.0 --name "Initial Release" --archive-phases`,

  'init': `Usage: gsd-tools init <workflow> [args] [--raw]

Compound initialization commands for workflows.

Workflows:
  execute-phase <phase>   All context for execute-phase workflow
  plan-phase <phase>      All context for plan-phase workflow
  new-project             All context for new-project workflow
  new-milestone           All context for new-milestone workflow
  quick <description>     All context for quick workflow
  resume                  All context for resume-project workflow
  verify-work <phase>     All context for verify-work workflow
  phase-op <phase>        Generic phase operation context
  todos [area]            All context for todo workflows
  milestone-op            Milestone operation context
  map-codebase            Codebase mapping context
  progress                Progress overview

Examples:
  gsd-tools init execute-phase 03
  gsd-tools init progress --raw`,

  'commit': `Usage: gsd-tools commit <message> [--files f1 f2 ...] [--amend] [--raw]

Commit planning documents to git.

Arguments:
  message         Commit message (required)
  --files f1 f2   Specific files to stage (default: all .planning/ changes)
  --amend         Amend the previous commit instead of creating new

Examples:
  gsd-tools commit "docs(03-01): add help system" --files .planning/STATE.md`,

  'template': `Usage: gsd-tools template <subcommand> [options] [--raw]

Template operations for planning documents.

Subcommands:
  select <type>              Select a template for the given type
  fill <type> [options]      Create pre-filled template document
    Types: summary, plan, verification
    --phase N   Phase number
    --plan M    Plan number
    --name "..."  Document name
    --type execute|tdd  Plan type (for plan templates)
    --wave N    Wave number
    --fields '{json}'   Additional fields

Examples:
  gsd-tools template fill summary --phase 03 --plan 01 --name "Help System"`,

  'config-ensure-section': `Usage: gsd-tools config-ensure-section [--raw]

Initialize .planning/config.json with default values from CONFIG_SCHEMA.
Detects Brave Search API key availability and applies user-level defaults
from ~/.gsd/defaults.json if present. No-op if config already exists.`,

  'config-set': `Usage: gsd-tools config-set <key.path> <value> [--raw]

Set a configuration value in .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)
  value      Value to set (booleans and numbers auto-parsed)

Examples:
  gsd-tools config-set model_profile quality
  gsd-tools config-set workflow.research false`,

  'config-get': `Usage: gsd-tools config-get <key.path> [--raw]

Get a configuration value from .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)

Examples:
  gsd-tools config-get model_profile --raw
  gsd-tools config-get workflow.research`,

  'config-migrate': `Usage: gsd-tools config-migrate [--raw]

Migrate .planning/config.json to include any new CONFIG_SCHEMA keys.
Adds missing keys with default values. Never overwrites existing values.
Creates a backup at .planning/config.json.bak before writing.

Output: { migrated_keys, unchanged_keys, config_path, backup_path }

Examples:
  gsd-tools config-migrate
  gsd-tools config-migrate --raw`,

  'generate-slug': `Usage: gsd-tools generate-slug <text> [--raw]

Convert text to a URL-safe slug (lowercase, hyphens, no special chars).

Arguments:
  text   Text to convert

Examples:
  gsd-tools generate-slug "Developer Experience" --raw
  # Output: developer-experience`,

  'current-timestamp': `Usage: gsd-tools current-timestamp [format] [--raw]

Returns the current UTC timestamp.

Formats:
  full       ISO 8601 (default): 2026-02-22T14:30:00Z
  date       Date only: 2026-02-22
  filename   Filename-safe: 2026-02-22_143000

Examples:
  gsd-tools current-timestamp --raw
  gsd-tools current-timestamp date --raw`,

  'list-todos': `Usage: gsd-tools list-todos [area] [--raw]

Count and enumerate pending todos from planning documents.

Arguments:
  area   Optional area filter (e.g., phase name)

Examples:
  gsd-tools list-todos --raw`,

  'verify-path-exists': `Usage: gsd-tools verify-path-exists <path> [--raw]

Check if a file or directory exists relative to project root.

Arguments:
  path   Relative path to check

Examples:
  gsd-tools verify-path-exists .planning/config.json`,

  'session-diff': `Usage: gsd-tools session-diff [--raw]

Show git commits since last recorded session activity.
Uses the last activity date from STATE.md to find recent commits.

Output: { commits, since_date, count }`,

  'context-budget': `Usage: gsd-tools context-budget <plan-path> [--raw]

Estimate token count for a plan file and its @-referenced files.
Warns if total exceeds 50% of context window.

Arguments:
  plan-path   Path to the plan file to analyze

Examples:
  gsd-tools context-budget .planning/phases/03-developer-experience/03-01-PLAN.md`,

  'test-run': `Usage: gsd-tools test-run [--raw]

Run project test commands (from config.json test_commands) and parse output.
Supports ExUnit, Go test, and pytest output formats.
Returns structured pass/fail results with test_gate enforcement.`,

  'search-decisions': `Usage: gsd-tools search-decisions <query> [--raw]

Search for decisions in STATE.md and archived milestone states.

Arguments:
  query   Search term (case-insensitive substring match)

Examples:
  gsd-tools search-decisions "esbuild"`,

  'validate-dependencies': `Usage: gsd-tools validate-dependencies <phase> [--raw]

Validate the dependency graph for plans in a phase.
Checks that depends_on references exist and are acyclic.

Arguments:
  phase   Phase number to validate

Examples:
  gsd-tools validate-dependencies 03`,

  'search-lessons': `Usage: gsd-tools search-lessons <query> [--raw]

Search tasks/lessons.md for matching entries.

Arguments:
  query   Search term (case-insensitive)

Examples:
  gsd-tools search-lessons "frontmatter"`,

  'codebase-impact': `Usage: gsd-tools codebase-impact <files...> [--raw]

Show module dependencies for the given files.
Reads Elixir defmodule/import/use/alias statements and reports dependents.

Arguments:
  files   One or more file paths to analyze

Examples:
  gsd-tools codebase-impact lib/my_app/accounts.ex`,

  'rollback-info': `Usage: gsd-tools rollback-info <plan-id> [--raw]

Show commits associated with a plan and the git revert command to undo them.

Arguments:
  plan-id   Plan identifier (e.g., 03-01)

Examples:
  gsd-tools rollback-info 02-01`,

  'velocity': `Usage: gsd-tools velocity [--raw]

Calculate planning velocity: plans/day, completion forecast, and trend.
Reads execution metrics from STATE.md performance table.`,

  'trace-requirement': `Usage: gsd-tools trace-requirement <req-id> [--raw]

Full traceability from requirement to files on disk.
Traces through REQUIREMENTS.md → PLAN.md → SUMMARY.md → actual files.

Arguments:
  req-id   Requirement identifier (e.g., DX-01)

Examples:
  gsd-tools trace-requirement FOUND-01`,

  'validate-config': `Usage: gsd-tools validate-config [--raw]

Schema validation and typo detection for .planning/config.json.
Checks all keys against CONFIG_SCHEMA, reports unknown keys and type mismatches.`,

  'quick-summary': `Usage: gsd-tools quick-summary [--raw]

Milestone progress summary showing quick task status.`,

  'validate': `Usage: gsd-tools validate <subcommand> [options] [--raw]

Validation commands.

Subcommands:
  consistency            Check phase numbering, disk/roadmap sync
  health [--repair]      Check .planning/ integrity, optionally repair

Examples:
  gsd-tools validate consistency
  gsd-tools validate health --repair`,

  'progress': `Usage: gsd-tools progress [format] [--raw]

Render progress in various formats.

Formats:
  json    JSON output (default)
  table   ASCII table
  bar     Progress bar only

Examples:
  gsd-tools progress table
  gsd-tools progress bar --raw`,

  'todo': `Usage: gsd-tools todo <subcommand> [args] [--raw]

Todo management.

Subcommands:
  complete <filename>    Move todo from pending to completed

Examples:
  gsd-tools todo complete my-task.md`,

  'scaffold': `Usage: gsd-tools scaffold <type> [options] [--raw]

Create scaffolded planning documents.

Types:
  context --phase N          Create CONTEXT.md template
  uat --phase N              Create UAT.md template
  verification --phase N     Create VERIFICATION.md template
  phase-dir --phase N --name "..."  Create phase directory

Examples:
  gsd-tools scaffold context --phase 03
  gsd-tools scaffold phase-dir --phase 04 --name "Build System"`,

  'phases': `Usage: gsd-tools phases list [options] [--raw]

List phase directories with metadata.

Options:
  --type <type>          Filter by type (e.g., plan, summary)
  --phase <N>            Filter by phase number
  --include-archived     Include archived milestone phases

Examples:
  gsd-tools phases list
  gsd-tools phases list --phase 03`,

  'requirements': `Usage: gsd-tools requirements <subcommand> [args] [--raw]

Requirements traceability operations.

Subcommands:
  mark-complete <ids>    Mark requirement IDs as complete
    Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]

Examples:
  gsd-tools requirements mark-complete DX-01 DX-03`,

  'find-phase': `Usage: gsd-tools find-phase <phase> [--raw]

Find a phase directory by number, returning its path and metadata.

Arguments:
  phase   Phase number (e.g., 03, 02.1)

Examples:
  gsd-tools find-phase 03 --raw`,

  'resolve-model': `Usage: gsd-tools resolve-model <agent-type> [--raw]

Get the model assignment for an agent based on the active profile.

Arguments:
  agent-type   Agent identifier (e.g., gsd-executor, gsd-planner)

Examples:
  gsd-tools resolve-model gsd-executor --raw`,

  'verify-summary': `Usage: gsd-tools verify-summary <path> [--check-count N] [--raw]

Verify a SUMMARY.md file for completeness and structure.

Arguments:
  path            Path to SUMMARY.md file
  --check-count N Minimum number of checks required (default: 2)

Examples:
  gsd-tools verify-summary .planning/phases/01-foundation/01-01-SUMMARY.md`,

  'history-digest': `Usage: gsd-tools history-digest [--raw]

Aggregate all SUMMARY.md data across phases into a single digest.
Includes archived milestone phases. Returns decisions, tech stack, and per-phase data.`,

  'phase-plan-index': `Usage: gsd-tools phase-plan-index <phase> [--raw]

Index all plans in a phase with waves, dependencies, and status.

Arguments:
  phase   Phase number

Examples:
  gsd-tools phase-plan-index 03`,

  'state-snapshot': `Usage: gsd-tools state-snapshot [--raw]

Structured parse of STATE.md returning all sections as JSON.
More detailed than state load — includes metrics, decisions, blockers, session info.`,

  'summary-extract': `Usage: gsd-tools summary-extract <path> [--fields f1,f2] [--raw]

Extract structured data from a SUMMARY.md file.

Arguments:
  path             Path to SUMMARY.md
  --fields f1,f2   Comma-separated fields to extract (default: all)

Examples:
  gsd-tools summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md
  gsd-tools summary-extract path/to/SUMMARY.md --fields phase,decisions`,

  'websearch': `Usage: gsd-tools websearch <query> [--limit N] [--freshness day|week|month] [--raw]

Search the web via Brave Search API (requires brave_search config enabled).

Arguments:
  query          Search query string
  --limit N      Max results (default: 10)
  --freshness    Time filter: day, week, or month

Examples:
  gsd-tools websearch "esbuild bundler plugins" --limit 5`,
};

module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP };
