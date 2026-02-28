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
  context_window:            { type: 'number',  default: 200000,                          description: 'Context window size in tokens',                    aliases: [], nested: null },
  context_target_percent:    { type: 'number',  default: 50,                              description: 'Target context utilization percent (1-100)',        aliases: [], nested: null },
};

// ─── Command Help ────────────────────────────────────────────────────────────

const COMMAND_HELP = {
  'state': `Usage: gsd-tools state <subcommand> [options]

Manage project state in STATE.md.

Subcommands:
  load | get <field> | update <field> <value> | patch --key value ...
  advance-plan | update-progress
  record-metric --phase P --plan N --duration D [--tasks T] [--files F]
  add-decision --phase P --summary S [--rationale R]
  add-blocker --text "..." | resolve-blocker --text "..."
  record-session --stopped-at "..." [--resume-file path]
  validate [--fix]`,

  'state validate': `Usage: gsd-tools state validate [--fix]

Validate state vs disk reality: plan counts, position, activity staleness.
--fix auto-corrects plan count mismatches. Pre-flight in execute-phase.`,

  'frontmatter': `Usage: gsd-tools frontmatter <subcommand> <file> [options]

CRUD operations on YAML frontmatter in markdown files.

Subcommands:
  get <file> [--field key]        Extract frontmatter as JSON
  set <file> --field k --value v  Update single frontmatter field
  merge <file> --data '{json}'    Merge JSON into frontmatter
  validate <file> --schema type   Validate required fields
    Schema types: plan, summary, verification

Examples:
  gsd-tools frontmatter get plan.md
  gsd-tools frontmatter set plan.md --field wave --value 2`,

  'verify': `Usage: gsd-tools verify <subcommand> [args]

Verification suite for planning documents.

Subcommands:
  plan-structure <file>        Check PLAN.md structure + tasks
  phase-completeness <phase>   Check all plans have summaries
  references <file>            Check @-refs and paths resolve
  commits <h1> [h2] ...       Batch verify commit hashes exist
  artifacts <plan-file>        Check must_haves.artifacts from plan
  key-links <plan-file>        Check must_haves.key_links from plan
  analyze-plan <plan-file>     Analyze plan complexity, SR score, split suggestions
  deliverables [--plan file]   Run tests + verify plan deliverables
  requirements                 Check REQUIREMENTS.md coverage
  regression [--before f] [--after f]  Detect test regressions
  plan-wave <phase-dir>        Check for file conflicts within waves
  plan-deps <phase-dir>        Check dependency graph for cycles/issues
  quality [--plan f] [--phase N]  Composite quality score with trend

Examples:
  gsd-tools verify plan-structure .planning/phases/01-foundation/01-01-PLAN.md
  gsd-tools verify phase-completeness 01
  gsd-tools verify analyze-plan .planning/phases/12-quality/12-03-PLAN.md
  gsd-tools verify deliverables --plan .planning/phases/01/01-01-PLAN.md
  gsd-tools verify requirements
  gsd-tools verify regression --before before.json --after after.json
  gsd-tools verify plan-wave .planning/phases/12-quality
  gsd-tools verify plan-deps .planning/phases/12-quality`,

  'verify deliverables': `Usage: gsd-tools verify deliverables [--plan <file>]

Run project tests and optionally verify plan deliverables (artifacts + key_links).

Auto-detects test framework: package.json → npm test, mix.exs → mix test, go.mod → go test ./...
Override via config.json test_commands.

Options:
  --plan <file>   Plan file to check must_haves.artifacts and key_links

Output: { test_result, tests_passed, tests_failed, tests_total, framework, verdict }

Examples:
  gsd-tools verify deliverables
  gsd-tools verify deliverables --plan .planning/phases/01-foundation/01-01-PLAN.md`,

  'verify requirements': `Usage: gsd-tools verify requirements

Check REQUIREMENTS.md coverage. Parses requirement checkboxes and traceability table.
A requirement is "addressed" if marked [x] or its mapped phase has SUMMARY.md files.

Output: { total, addressed, unaddressed, unaddressed_list }

Examples:
  gsd-tools verify requirements`,

  'verify regression': `Usage: gsd-tools verify regression [--before <file>] [--after <file>]

Detect test regressions by comparing before/after test result files.
Each file: { tests: [{name, status: "pass"|"fail"}] }

Without --before/--after, checks .planning/memory/test-baseline.json.

Output: { regressions, regression_count, verdict }

Examples:
  gsd-tools verify regression --before baseline.json --after current.json`,

  'verify quality': `Usage: gsd-tools verify quality [--plan <file>] [--phase <N>]

Composite quality score (tests 30%, must_haves 30%, requirements 20%, regression 20%).
Grade: A(90+) B(80+) C(70+) D(60+) F(<60). Trend tracking via quality-scores.json.`,

  'roadmap': `Usage: gsd-tools roadmap <subcommand> [args]

Roadmap operations.

Subcommands:
  get-phase <phase>            Extract phase section from ROADMAP.md
  analyze                      Full roadmap parse with disk status
  update-plan-progress <N>     Update progress table row from disk

Examples:
  gsd-tools roadmap analyze
  gsd-tools roadmap update-plan-progress 03`,

  'phase': `Usage: gsd-tools phase <subcommand> [args]

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

  'milestone': `Usage: gsd-tools milestone <subcommand> [args]

Milestone lifecycle operations.

Subcommands:
  complete <version>           Archive milestone, create MILESTONES.md
    [--name <name>]
    [--archive-phases]         Move phase dirs to milestones/vX.Y-phases/

Examples:
  gsd-tools milestone complete v1.0 --name "Initial Release" --archive-phases`,

  'init': `Usage: gsd-tools init <workflow> [args] [--compact]

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
  memory [options]        Session memory digest with codebase knowledge

Flags:
  --compact   Return essential-only fields (38-50% smaller)
  --manifest  Include context manifest with --compact (adds file loading guidance)
  --agent=<type>  Scope output to agent's declared context (e.g. --agent=gsd-executor)

Examples:
  gsd-tools init execute-phase 03
  gsd-tools init progress --compact
  gsd-tools init progress --compact --manifest`,

  'init memory': `Usage: gsd-tools init memory [--workflow <name>] [--phase <N>] [--compact]
Session memory digest: position, bookmarks, decisions, lessons, codebase knowledge.
Workflows: execute-phase, plan-phase, execute-plan, quick, resume, verify-work, progress.`,

  'commit': `Usage: gsd-tools commit <message> [--files f1 f2 ...] [--amend] [--agent <type>] [--tdd-phase red|green|refactor]

Commit planning documents to git.

Arguments:
  message              Commit message (required)
  --files f1 f2        Specific files to stage (default: all .planning/ changes)
  --amend              Amend the previous commit instead of creating new
  --agent <type>       Add Agent-Type git trailer for attribution
  --tdd-phase <phase>  Add GSD-Phase trailer (red, green, or refactor)

Examples:
  gsd-tools commit "docs(03-01): add help system" --files .planning/STATE.md
  gsd-tools commit "test(43-01): failing test" --tdd-phase red --files src/`,

  'template': `Usage: gsd-tools template <subcommand> [options]

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

  'config-ensure-section': `Usage: gsd-tools config-ensure-section

Initialize .planning/config.json with default values from CONFIG_SCHEMA.
Detects Brave Search API key availability and applies user-level defaults
from ~/.gsd/defaults.json if present. No-op if config already exists.`,

  'config-set': `Usage: gsd-tools config-set <key.path> <value>

Set a configuration value in .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)
  value      Value to set (booleans and numbers auto-parsed)

Examples:
  gsd-tools config-set model_profile quality
  gsd-tools config-set workflow.research false`,

  'config-get': `Usage: gsd-tools config-get <key.path>

Get a configuration value from .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)

Examples:
  gsd-tools config-get model_profile
  gsd-tools config-get workflow.research`,

  'config-migrate': `Usage: gsd-tools config-migrate

Migrate .planning/config.json to include any new CONFIG_SCHEMA keys.
Adds missing keys with default values. Creates backup before writing.

Examples:
  gsd-tools config-migrate`,

  'generate-slug': `Usage: gsd-tools generate-slug <text>

Convert text to a URL-safe slug (lowercase, hyphens, no special chars).

Arguments:
  text   Text to convert

Examples:
  gsd-tools generate-slug "Developer Experience"
  # Output: developer-experience`,

  'current-timestamp': `Usage: gsd-tools current-timestamp [format]

Returns the current UTC timestamp.

Formats:
  full       ISO 8601 (default): 2026-02-22T14:30:00Z
  date       Date only: 2026-02-22
  filename   Filename-safe: 2026-02-22_143000

Examples:
  gsd-tools current-timestamp
  gsd-tools current-timestamp date`,

  'list-todos': `Usage: gsd-tools list-todos [area]

Count and enumerate pending todos from planning documents.

Arguments:
  area   Optional area filter (e.g., phase name)

Examples:
  gsd-tools list-todos`,

  'verify-path-exists': `Usage: gsd-tools verify-path-exists <path>

Check if a file or directory exists relative to project root.

Arguments:
  path   Relative path to check

Examples:
  gsd-tools verify-path-exists .planning/config.json`,

  'session-diff': `Usage: gsd-tools session-diff

Show git commits since last recorded session activity.
Uses the last activity date from STATE.md to find recent commits.

Output: { commits, since_date, count }`,

  'session-summary': `Usage: gsd-tools session-summary

Session handoff summary: position, activity, next action, continuity.
Output: { current_position, session_activity, next_action, session_continuity }`,

  'context-budget': `Usage: gsd-tools context-budget <subcommand|path> [options]

Measure and compare token consumption across GSD workflows.

Subcommands:
  <path>                    Estimate tokens for a single file (existing behavior)
  baseline                  Measure all workflows, save baseline to .planning/baselines/
  compare [baseline-path]   Compare current vs saved baseline (default: most recent)

Options:
  --fields <fields>         Return only specified JSON fields (comma-separated)
  --pretty                  Force human-readable output when piped

Examples:
  gsd-tools context-budget .planning/ROADMAP.md
  gsd-tools context-budget baseline
  gsd-tools context-budget compare
  gsd-tools context-budget compare .planning/baselines/baseline-2026-02-22.json`,

  'test-run': `Usage: gsd-tools test-run

Run project test commands (from config.json test_commands) and parse output.
Supports ExUnit, Go test, and pytest output formats.
Returns structured pass/fail results with test_gate enforcement.`,

  'search-decisions': `Usage: gsd-tools search-decisions <query>

Search for decisions in STATE.md and archived milestone states.

Arguments:
  query   Search term (case-insensitive substring match)

Examples:
  gsd-tools search-decisions "esbuild"`,

  'validate-dependencies': `Usage: gsd-tools validate-dependencies <phase>

Validate the dependency graph for plans in a phase.
Checks that depends_on references exist and are acyclic.

Arguments:
  phase   Phase number to validate

Examples:
  gsd-tools validate-dependencies 03`,

  'search-lessons': `Usage: gsd-tools search-lessons <query>

Search tasks/lessons.md for matching entries.

Arguments:
  query   Search term (case-insensitive)

Examples:
  gsd-tools search-lessons "frontmatter"`,

  'codebase-impact': `Usage: gsd-tools codebase-impact <files...>

Show module dependencies for the given files.
Reads Elixir defmodule/import/use/alias statements and reports dependents.

Arguments:
  files   One or more file paths to analyze

Examples:
  gsd-tools codebase-impact lib/my_app/accounts.ex`,

  'rollback-info': `Usage: gsd-tools rollback-info <plan-id>

Show commits associated with a plan and the git revert command to undo them.

Arguments:
  plan-id   Plan identifier (e.g., 03-01)

Examples:
  gsd-tools rollback-info 02-01`,

  'velocity': `Usage: gsd-tools velocity

Calculate planning velocity: plans/day, completion forecast, and trend.
Reads execution metrics from STATE.md performance table.`,

  'trace-requirement': `Usage: gsd-tools trace-requirement <req-id>

Full traceability from requirement to files on disk.
Traces through REQUIREMENTS.md → PLAN.md → SUMMARY.md → actual files.

Arguments:
  req-id   Requirement identifier (e.g., DX-01)

Examples:
  gsd-tools trace-requirement FOUND-01`,

  'validate-config': `Usage: gsd-tools validate-config

Schema validation and typo detection for .planning/config.json.
Checks all keys against CONFIG_SCHEMA, reports unknown keys and type mismatches.`,

  'quick-summary': `Usage: gsd-tools quick-summary

Milestone progress summary showing quick task status.`,

  'validate': `Usage: gsd-tools validate <subcommand> [options]

Validation commands.

Subcommands:
  consistency            Check phase numbering, disk/roadmap sync
  health [--repair]      Check .planning/ integrity, optionally repair

Examples:
  gsd-tools validate consistency
  gsd-tools validate health --repair`,

  'progress': `Usage: gsd-tools progress [format]

Render progress in various formats.

Formats:
  json    JSON output (default)
  table   ASCII table
  bar     Progress bar only

Examples:
  gsd-tools progress table
  gsd-tools progress bar`,

  'todo': `Usage: gsd-tools todo <subcommand> [args]

Todo management.

Subcommands:
  complete <filename>    Move todo from pending to completed

Examples:
  gsd-tools todo complete my-task.md`,

  'scaffold': `Usage: gsd-tools scaffold <type> [options]

Create scaffolded planning documents.

Types:
  context --phase N          Create CONTEXT.md template
  uat --phase N              Create UAT.md template
  verification --phase N     Create VERIFICATION.md template
  phase-dir --phase N --name "..."  Create phase directory

Examples:
  gsd-tools scaffold context --phase 03
  gsd-tools scaffold phase-dir --phase 04 --name "Build System"`,

  'phases': `Usage: gsd-tools phases list [options]

List phase directories with metadata.

Options:
  --type <type>          Filter by type (e.g., plan, summary)
  --phase <N>            Filter by phase number
  --include-archived     Include archived milestone phases

Examples:
  gsd-tools phases list
  gsd-tools phases list --phase 03`,

  'requirements': `Usage: gsd-tools requirements <subcommand> [args]

Requirements traceability operations.

Subcommands:
  mark-complete <ids>    Mark requirement IDs as complete
    Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]

Examples:
  gsd-tools requirements mark-complete DX-01 DX-03`,

  'find-phase': `Usage: gsd-tools find-phase <phase>

Find a phase directory by number, returning its path and metadata.

Arguments:
  phase   Phase number (e.g., 03, 02.1)

Examples:
  gsd-tools find-phase 03`,

  'resolve-model': `Usage: gsd-tools resolve-model <agent-type>

Get the model assignment for an agent based on the active profile.

Arguments:
  agent-type   Agent identifier (e.g., gsd-executor, gsd-planner)

Examples:
  gsd-tools resolve-model gsd-executor`,

  'verify-summary': `Usage: gsd-tools verify-summary <path> [--check-count N]

Verify a SUMMARY.md file for completeness and structure.

Arguments:
  path            Path to SUMMARY.md file
  --check-count N Minimum number of checks required (default: 2)

Examples:
  gsd-tools verify-summary .planning/phases/01-foundation/01-01-SUMMARY.md`,

  'history-digest': `Usage: gsd-tools history-digest

Aggregate all SUMMARY.md data across phases into a single digest.
Includes archived milestone phases. Returns decisions, tech stack, and per-phase data.`,

  'phase-plan-index': `Usage: gsd-tools phase-plan-index <phase>

Index all plans in a phase with waves, dependencies, and status.

Arguments:
  phase   Phase number

Examples:
  gsd-tools phase-plan-index 03`,

  'state-snapshot': `Usage: gsd-tools state-snapshot

Structured parse of STATE.md returning all sections as JSON.
More detailed than state load — includes metrics, decisions, blockers, session info.`,

  'summary-extract': `Usage: gsd-tools summary-extract <path> [--fields f1,f2]

Extract structured data from a SUMMARY.md file.

Arguments:
  path             Path to SUMMARY.md
  --fields f1,f2   Comma-separated fields to extract (default: all)

Examples:
  gsd-tools summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md
  gsd-tools summary-extract path/to/SUMMARY.md --fields phase,decisions`,

  'websearch': `Usage: gsd-tools websearch <query> [--limit N] [--freshness day|week|month]

Search the web via Brave Search API (requires brave_search config enabled).

Arguments:
  query          Search query string
  --limit N      Max results (default: 10)
  --freshness    Time filter: day, week, or month

Examples:
  gsd-tools websearch "esbuild bundler plugins" --limit 5`,

  'memory': `Usage: gsd-tools memory <subcommand> [options]

Persistent memory store for decisions, bookmarks, lessons, todos, and trajectories.

Subcommands:
  write --store <name> --entry '{json}'   Write entry to a store
  read --store <name> [options]           Read entries from a store
  list                                    List stores with stats
  ensure-dir                              Create .planning/memory/ directory
  compact [--store <name>] [--threshold N] [--dry-run]  Compact old entries

Stores: decisions, bookmarks, lessons, todos, trajectories

Options (read):
  --limit N          Max entries to return
  --query "text"     Case-insensitive text search across values
  --phase N          Filter by phase field

Trajectory-specific options (read --store trajectories):
  --category <cat>   Filter by category (decision|observation|correction|hypothesis)
  --tags <t1,t2>     Filter by tags (comma-separated, must have ALL)
  --from <date>      Filter entries from ISO date (inclusive)
  --to <date>        Filter entries to ISO date (inclusive)
  --asc              Return in chronological order (default: newest first)

Examples:
  gsd-tools memory write --store decisions --entry '{"summary":"Chose esbuild","phase":"03"}'
  gsd-tools memory write --store trajectories --entry '{"category":"decision","text":"Use vertical slices","phase":"45"}'
  gsd-tools memory read --store trajectories --category decision
  gsd-tools memory read --store decisions --query "esbuild"
  gsd-tools memory list`,

  'memory write': `Usage: gsd-tools memory write --store <name> --entry '{json}'
Write entry to store. Stores: decisions, bookmarks, lessons, todos, trajectories.
decisions/lessons/trajectories append-only. bookmarks prepend + trim to 20.
Trajectories require category (decision|observation|correction|hypothesis) and text fields.`,

  'memory read': `Usage: gsd-tools memory read --store <name> [--limit N] [--query "text"] [--phase N]
Read entries with optional filtering.
Trajectory-specific: --category, --tags, --from, --to, --asc.`,

  'memory list': `Usage: gsd-tools memory list — List stores with entry counts and sizes.`,

  'memory compact': `Usage: gsd-tools memory compact [--store <name>] [--threshold N] [--dry-run]
Compact non-sacred stores by summarizing old entries.`,

  'test-coverage': `Usage: gsd-tools test-coverage

Analyze test coverage by comparing test file invocations against router commands.

Reads:
  - Test file (default: bin/gsd-tools.test.cjs, override via config test_file)
  - Router file (default: src/router.js, override via config router_file)

Detects tested commands via:
  - runGsdTools('command ...') invocations in test file
  - describe('command ...') block names matching known commands
  - Template literal invocations

Output: { total_commands, commands_with_tests, coverage_percent, covered, uncovered, test_count }

Examples:
  gsd-tools test-coverage`,

  'intent': `Usage: gsd-tools intent <subcommand> [options]

Manage project intent in INTENT.md.

Subcommands:
  create      Create a new INTENT.md (errors if exists, use --force to overwrite)
  show        Display intent summary (compact by default, --full for complete, section filter supported)
  read        Read intent as JSON (alias for intent show, section filter supported)
  update      Update INTENT.md sections (--add, --remove, --set-priority, --value)
  validate    Validate INTENT.md structure (exit 0=valid, 1=issues)
  trace       Traceability matrix: desired outcomes → plans (--gaps for uncovered only)
  drift       Drift analysis: detect misalignment with 4 signals + numeric score

Examples:
  gsd-tools intent create
  gsd-tools intent show
  gsd-tools intent read outcomes
  gsd-tools intent validate
  gsd-tools intent trace
  gsd-tools intent trace --gaps
  gsd-tools intent drift`,

  'intent create': `Usage: gsd-tools intent create [--force] [--objective "text"] [--users "u1" "u2"] [--outcomes "DO-01: desc"] [--criteria "SC-01: gate"]
Create INTENT.md with 6 sections. --force overwrites existing.`,

  'intent show': `Usage: gsd-tools intent show [section] [--full]

Display intent summary from INTENT.md.

Modes:
  (default)        Compact summary (10-20 lines, outcomes sorted by priority)
  --full           Render complete INTENT.md content
  <section>        Show specific section (objective, users, outcomes, criteria, constraints, health)
             JSON output of all sections (or filtered section)

Examples:
  gsd-tools intent show
  gsd-tools intent show --full
  gsd-tools intent show outcomes
  gsd-tools intent show`,

  'intent read': `Usage: gsd-tools intent read [section]

Read intent as JSON. Alias for 'intent show'.

Arguments:
  section    Optional section filter (objective, users, outcomes, criteria, constraints, health)

Output: Full structured JSON or single section JSON

Examples:
  gsd-tools intent read
  gsd-tools intent read outcomes`,

  'intent validate': `Usage: gsd-tools intent validate

Validate INTENT.md structure: sections, ID format, uniqueness, minimums.
Exit 0=valid, 1=issues. Output (JSON): { valid, issues, sections, revision }

Examples:
  gsd-tools intent validate`,

  'intent trace': `Usage: gsd-tools intent trace [--gaps]

Traceability matrix: desired outcomes → plans addressing them.
Scans PLAN.md frontmatter for intent.outcome_ids.

Flags: --gaps (uncovered only), (JSON output)

Examples:
  gsd-tools intent trace --gaps`,

  'intent drift': `Usage: gsd-tools intent drift

Detect misalignment between work and stated intent. Drift score 0-100.

Signals: Coverage Gaps (40pts), Objective Mismatch (25pts), Feature Creep (15pts), Priority Inversion (20pts).
Score: 0-15 excellent, 16-35 good, 36-60 moderate, 61-100 poor.

Examples:
  gsd-tools intent drift`,

  'extract-sections': `Usage: gsd-tools extract-sections <file-path> [section1] [section2] ...

Extract specific named sections from a markdown file.
Supports ## headers and <!-- section: name --> markers as section boundaries.

Modes:
  Discovery     No sections specified → list available sections
  Extraction    Sections specified → return matching content

Section matching is case-insensitive.

Output (discovery):  { file, available_sections: [...] }
Output (extraction): { file, sections_found, sections_missing, content }

Examples:
  gsd-tools extract-sections references/checkpoints.md
  gsd-tools extract-sections references/checkpoints.md "types"
   gsd-tools extract-sections references/checkpoints.md "types" "guidelines"`,

  'token-budget': `Usage: gsd-tools token-budget

Show estimated token counts for all workflow files against their budgets.
Searches for workflow .md files in:
  1. <cwd>/workflows/
  2. Plugin directory workflows/
  3. ~/.config/opencode/workflows/ (home config)

Each workflow is measured (chars/4 ≈ tokens) and compared against known budget limits.

Output: { workflows: [{ name, path, tokens, budget, within_budget }], total_tokens, over_budget_count }

Examples:
  gsd-tools token-budget`,

  'mcp-profile': `Usage: gsd-tools mcp-profile [options]

Discover MCP servers, estimate token cost, score relevance, apply/restore.

Sources: .mcp.json, opencode.json, ~/.config/opencode/opencode.json
Known-server DB covers 15+ servers. Scores keep/disable/review per server.

Options:
  --window <size>   Context window size (default: 200000)
  --apply           Disable recommended servers in opencode.json (backup first)
  --dry-run         With --apply: preview without modifying
  --restore         Restore opencode.json from opencode.json.bak
              JSON output

Only opencode.json is modified (not .mcp.json). Also: gsd-tools mcp profile

Examples:
  gsd-tools mcp-profile --apply
  gsd-tools mcp-profile --restore`,

  'mcp': `Usage: gsd-tools mcp <subcommand> [options]

MCP server management. Subcommands: profile [--window N] [--apply] [--restore]

Examples:
  gsd-tools mcp profile
  gsd-tools mcp profile --apply`,

  'assertions': `Usage: gsd-tools assertions <subcommand> [options]

Manage structured acceptance criteria in ASSERTIONS.md.

Subcommands:
  list [--req SREQ-01]    List all assertions, optionally filter by requirement ID
  validate                Check assertion format, coverage, and consistency

Output (list): { total_requirements, total_assertions, must_have_count, nice_to_have_count, requirements }
Output (validate): { valid, issues, stats: { total_reqs, total_assertions, coverage_percent } }

Examples:
  gsd-tools assertions list
  gsd-tools assertions list --req SREQ-01
  gsd-tools assertions validate`,

  'assertions list': `Usage: gsd-tools assertions list [--req <id>]

List all assertions from .planning/ASSERTIONS.md grouped by requirement ID.

Options:
  --req <id>    Filter to specific requirement (e.g., SREQ-01)

Output: { total_requirements, total_assertions, must_have_count, nice_to_have_count, requirements }

Examples:
  gsd-tools assertions list
  gsd-tools assertions list --req SREQ-01`,

  'assertions validate': `Usage: gsd-tools assertions validate

Validate ASSERTIONS.md format, coverage, and consistency with REQUIREMENTS.md.

Checks:
  - Every requirement ID exists in REQUIREMENTS.md
  - Each requirement has 2-5 assertions (advisory)
  - Every assertion has non-empty assert field
  - type values are valid: api, cli, file, behavior
  - priority values are valid: must-have, nice-to-have

Output: { valid, issues: [{reqId, issue, severity}], stats: {total_reqs, total_assertions, coverage_percent} }

Examples:
  gsd-tools assertions validate`,

  'env': `Usage: gsd-tools env <subcommand> [options]

Detect project languages, tools, and runtimes.

Subcommands:
  scan [--force] [--verbose]  Detect project environment and write manifest
  status                      Check environment manifest freshness

The scan command detects languages from manifest files (package.json, go.mod,
mix.exs, etc.), checks binary availability, detects package managers, version
managers, CI platforms, test frameworks, linters/formatters, scripts, Docker
services, MCP servers, and monorepo configurations.

Results are written to:
  .planning/env-manifest.json   Machine-specific (gitignored)
  .planning/project-profile.json  Team-visible (committed)

Flags:
  --force     Force full rescan even if manifest is fresh
  --verbose   Print human-readable summary to stderr
        Output JSON to stdout

Examples:
  gsd-tools env scan
  gsd-tools env scan --force --verbose
  gsd-tools env status`,

  'env scan': `Usage: gsd-tools env scan [--force] [--verbose]
Detect languages, tools, runtimes. Write env-manifest.json + project-profile.json.
--force bypasses freshness check. Detects 26+ language patterns.`,

  'env status': `Usage: gsd-tools env status

Report manifest freshness without triggering a scan.

Output: { exists, stale, reason, scanned_at, age_minutes, languages_count, changed_files }

Examples:
  gsd-tools env status`,

  'worktree': `Usage: gsd-tools worktree <subcommand> [options]

Manage git worktrees for parallel plan execution.

Subcommands:
  create <plan-id>    Create isolated worktree for a plan
  list                List active worktrees for this project
  remove <plan-id>    Remove a specific worktree
  cleanup             Remove all worktrees for this project`,

  'worktree create': `Usage: gsd-tools worktree create <plan-id>

Create an isolated git worktree for a plan.

Args:
  plan-id     Plan ID in NN-MM format (e.g., 21-02)

Creates worktree at {base_path}/{project}/{plan-id}/ with branch worktree-{phase}-{plan}-{wave}.
Syncs configured files (.env, config) and runs setup hooks.

Output: { created, plan_id, branch, path, synced_files, setup_status, setup_error?, resource_warnings? }`,

  'worktree list': `Usage: gsd-tools worktree list

List active worktrees for the current project.

Output: { worktrees: [{ plan_id, branch, path, head, disk_usage }] }`,

  'worktree remove': `Usage: gsd-tools worktree remove <plan-id>

Remove a specific worktree and its branch.

Args:
  plan-id     Plan ID to remove (e.g., 21-02)

Output: { removed, plan_id, path }`,

  'worktree cleanup': `Usage: gsd-tools worktree cleanup

Remove all worktrees for the current project and prune stale references.

Output: { cleaned, worktrees: [{ plan_id, path }] }`,

  'codebase context': `Usage: gsd-tools codebase context --files <file1> [file2] ... [--plan <path>]
       gsd-tools codebase context --task <file1,file2,...> [--plan <path>] [--budget <tokens>]

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
  gsd-tools codebase context --files src/lib/ast.js
  gsd-tools codebase context --task src/lib/ast.js,src/router.js --budget 2000`,

  'codebase ast': `Usage: gsd-tools codebase ast <file>

Extract function, class, and method signatures from a source file.

For JS/TS: Uses acorn AST parsing with TypeScript stripping.
For Python, Go, Rust, Ruby, Elixir, Java, PHP: Uses regex-based extraction.

Arguments:
  file   Source file path to analyze

Output: { file, language, signatures: [{name, type, params, line, async, generator}], count }

Examples:
  gsd-tools codebase ast src/lib/ast.js
  gsd-tools codebase ast app.py`,

  'codebase exports': `Usage: gsd-tools codebase exports <file>

Extract the export surface from a JS/TS module.

Detects ESM exports (named, default, re-exports) and CJS exports
(module.exports, exports patterns). Reports module type (esm/cjs/mixed).

Arguments:
  file   Source file path to analyze

Output: { file, type, named, default, re_exports, cjs_exports }

Examples:
  gsd-tools codebase exports src/lib/ast.js
  gsd-tools codebase exports src/router.js`,

  'codebase complexity': `Usage: gsd-tools codebase complexity <file>

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
  gsd-tools codebase complexity src/router.js
  gsd-tools codebase complexity src/lib/ast.js`,

  'codebase repo-map': `Usage: gsd-tools codebase repo-map [--budget <tokens>]

Generate a compact repository map from AST signatures.

Walks all source files, extracts function/class/method signatures and
exports, then builds a compact text summary sorted by signature density.
Designed for agent context injection (~1k tokens by default).

Options:
  --budget <tokens>   Token budget for output (default: 1000)

Output (raw): { summary, files_included, total_signatures, token_estimate }
Output (formatted): The summary text directly

Examples:
  gsd-tools codebase repo-map
  gsd-tools codebase repo-map --budget 500`,

  'trajectory': `Usage: gsd-tools trajectory <subcommand> [options]

Trajectory engineering commands.

Subcommands:
  checkpoint <name>  Create named checkpoint with auto-metrics
    --scope <scope>       Scope level (default: phase)
    --description <text>  Optional context description

Creates a git branch at trajectory/<scope>/<name>/attempt-N and writes a
journal entry to the trajectories memory store with test count, LOC delta,
and cyclomatic complexity metrics.

Examples:
  gsd-tools trajectory checkpoint explore-auth
  gsd-tools trajectory checkpoint try-redis --scope task --description "Redis caching approach"`,

  'classify': `Usage: gsd-tools classify <plan|phase> <path-or-number>

Classify task complexity and recommend execution strategy.

Subcommands:
  plan <plan-path>       Classify all tasks in a single plan (1-5 complexity scores)
  phase <phase-number>   Classify all incomplete plans in a phase + execution mode

Examples:
  gsd-tools classify plan .planning/phases/39-orchestration-intelligence/39-01-PLAN.md
  gsd-tools classify phase 39`,

  'classify plan': `Usage: gsd-tools classify plan <plan-path>

Classify all tasks in a plan file with 1-5 complexity scores.

Scoring factors: file count, cross-module blast radius, test requirements,
checkpoint complexity, action length.

Model mapping: score 1-2 → sonnet, score 3 → sonnet, score 4-5 → opus

Output: { plan, wave, autonomous, task_count, tasks: [{name, complexity}], plan_complexity, recommended_model }

Examples:
  gsd-tools classify plan .planning/phases/39-orchestration-intelligence/39-01-PLAN.md`,

  'classify phase': `Usage: gsd-tools classify phase <phase-number>

Classify all incomplete plans in a phase and determine execution mode.

Execution modes:
  single      1 plan with 1-2 tasks
  parallel    Multiple plans in same wave, no file overlaps
  sequential  Plans with checkpoint tasks
  pipeline    Plans spanning 3+ waves

Output: { phase, plans_classified, plans: [...], execution_mode: { mode, reason, waves } }

Examples:
  gsd-tools classify phase 39
  gsd-tools classify phase 38`,

  'tdd': `Usage: gsd-tools tdd <subcommand> [options]

TDD validation gates for RED/GREEN/REFACTOR cycle enforcement.

Subcommands:
  validate-red --test-cmd "cmd"       Verify test fails (exit 0 if test fails)
  validate-green --test-cmd "cmd"     Verify test passes (exit 0 if test passes)
  validate-refactor --test-cmd "cmd"  Same as validate-green
  auto-test --test-cmd "cmd"          Run test, report result (no exit code override)
  detect-antipattern --phase P --files "f1,f2"  Check for TDD violations

Also: commit --tdd-phase red|green|refactor adds GSD-Phase trailer

Examples:
  gsd-tools tdd validate-red --test-cmd "npm test"
  gsd-tools tdd detect-antipattern --phase red --files "src/foo.js"`,

  'review': `Usage: gsd-tools review <phase> <plan> — Review context for reviewer agent`,

  'profile': 'Set GSD_PROFILE=1 to enable performance profiling. Baselines written to .planning/baselines/',

  'git': `Usage: gsd-tools git <log|diff-summary|blame|branch-info|rewind|trajectory-branch> [options]

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
  gsd-tools git log --count 5
  gsd-tools git diff-summary --from main --to HEAD
  gsd-tools git blame src/router.js
  gsd-tools git branch-info
  gsd-tools git rewind --ref HEAD~3 --dry-run
  gsd-tools git rewind --ref abc123 --confirm
  gsd-tools git trajectory-branch --phase 45 --slug decision-journal`,
};

module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP };
