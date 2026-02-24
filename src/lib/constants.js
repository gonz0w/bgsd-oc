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
  validate [--fix]          Validate state vs disk reality (auto-runs as pre-flight in execute-phase)

Examples:
  gsd-tools state load --raw
  gsd-tools state advance-plan
  gsd-tools state add-decision --phase 03 --summary "Chose esbuild"`,

  'state validate': `Usage: gsd-tools state validate [--fix] [--raw]

Validate state consistency between declared state and disk reality.

Checks:
  Plan count drift     ROADMAP.md claims vs actual files
  Position validity    STATE.md position vs existing phases
  Activity staleness   Last activity timestamp vs git history
  Blocker/todo age     Items open through 2+ completed plans

Options:
  --fix    Auto-correct plan count mismatches in ROADMAP.md
  --raw    JSON output

Pre-flight: Execute-phase automatically runs state validate --fix before
execution. Errors block, warnings display. Use --skip-validate to bypass.
Disable permanently via config: gates.pre_flight_validation: false

Examples:
  gsd-tools state validate --raw
  gsd-tools state validate --fix`,

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

  'verify deliverables': `Usage: gsd-tools verify deliverables [--plan <file>] [--raw]

Run project tests and optionally verify plan deliverables (artifacts + key_links).

Auto-detects test framework: package.json → npm test, mix.exs → mix test, go.mod → go test ./...
Override via config.json test_commands.

Options:
  --plan <file>   Plan file to check must_haves.artifacts and key_links

Output: { test_result, tests_passed, tests_failed, tests_total, framework, verdict }

Examples:
  gsd-tools verify deliverables
  gsd-tools verify deliverables --plan .planning/phases/01-foundation/01-01-PLAN.md`,

  'verify requirements': `Usage: gsd-tools verify requirements [--raw]

Check REQUIREMENTS.md coverage. Parses requirement checkboxes and traceability table.
A requirement is "addressed" if marked [x] or its mapped phase has SUMMARY.md files.

Output: { total, addressed, unaddressed, unaddressed_list }

Examples:
  gsd-tools verify requirements --raw`,

  'verify regression': `Usage: gsd-tools verify regression [--before <file>] [--after <file>] [--raw]

Detect test regressions by comparing before/after test result files.
Each file: { tests: [{name, status: "pass"|"fail"}] }

Without --before/--after, checks .planning/memory/test-baseline.json.

Output: { regressions, regression_count, verdict }

Examples:
  gsd-tools verify regression --before baseline.json --after current.json`,

  'verify quality': `Usage: gsd-tools verify quality [--plan <file>] [--phase <N>] [--raw]

Composite quality score across 4 dimensions with trend tracking.

Dimensions (weighted):
  tests (30%)          Run test suite, 100 if pass, 0 if fail
  must_haves (30%)     Check plan artifacts + key_links (requires --plan)
  requirements (20%)   REQUIREMENTS.md coverage (filterable by --phase)
  regression (20%)     Check test-baseline.json for regressions

Skipped dimensions (null score) are excluded from the weighted average.
Grade: A (90+), B (80+), C (70+), D (60+), F (<60)

Scores are stored in .planning/memory/quality-scores.json for trend tracking.
Trend: "improving" (last 3 ascending), "declining" (descending), "stable" (mixed).

Options:
  --plan <file>   Plan file for must_haves checking
  --phase <N>     Filter requirements to specific phase

Output: { score, grade, dimensions, trend, plan, phase }

Examples:
  gsd-tools verify quality --raw
  gsd-tools verify quality --plan .planning/phases/12-quality/12-02-PLAN.md --phase 12 --raw`,

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

  'init': `Usage: gsd-tools init <workflow> [args] [--raw] [--compact]

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

Examples:
  gsd-tools init execute-phase 03
  gsd-tools init progress --compact --raw
  gsd-tools init progress --compact --manifest --raw`,

  'init memory': `Usage: gsd-tools init memory [options] [--raw]

Session memory digest with workflow-aware codebase knowledge surfacing.
Reads position from STATE.md, bookmarks/decisions/lessons from memory stores,
and loads relevant codebase docs based on the active workflow.

Options:
  --workflow <name>   Workflow context: execute-phase, plan-phase, execute-plan,
                      quick, resume, verify-work, progress
  --phase <N>         Filter decisions/lessons by phase number
  --compact           Reduced output (5 decisions, 4000 char limit)

Output includes: position, bookmark (with drift warning), decisions, blockers,
todos, lessons, codebase knowledge sections, and trimming metadata.

Priority trimming (when output exceeds size limit):
  1. codebase content removed
  2. lessons reduced to 2
  3. decisions reduced to 3
  4. todos reduced to 2
  Position is never trimmed.

Examples:
  gsd-tools init memory --workflow execute-phase --phase 11 --raw
  gsd-tools init memory --workflow plan-phase --compact --raw
  gsd-tools init memory --raw`,

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

  'context-budget': `Usage: gsd-tools context-budget <subcommand|path> [options] [--raw]

Measure and compare token consumption across GSD workflows.

Subcommands:
  <path>                    Estimate tokens for a single file (existing behavior)
  baseline                  Measure all workflows, save baseline to .planning/baselines/
  compare [baseline-path]   Compare current vs saved baseline (default: most recent)

Options:
  --fields <fields>         Return only specified JSON fields (comma-separated)
  --raw                     Output raw JSON

Examples:
  gsd-tools context-budget .planning/ROADMAP.md
  gsd-tools context-budget baseline
  gsd-tools context-budget compare
  gsd-tools context-budget compare .planning/baselines/baseline-2026-02-22.json`,

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

  'memory': `Usage: gsd-tools memory <subcommand> [options] [--raw]

Persistent memory store for decisions, bookmarks, lessons, and todos.

Subcommands:
  write --store <name> --entry '{json}'   Write entry to a store
  read --store <name> [options]           Read entries from a store
  list                                    List stores with stats
  ensure-dir                              Create .planning/memory/ directory
  compact [--store <name>] [--threshold N] [--dry-run]  Compact old entries

Stores: decisions, bookmarks, lessons, todos

Options (read):
  --limit N          Max entries to return
  --query "text"     Case-insensitive text search across values
  --phase N          Filter by phase field

Examples:
  gsd-tools memory write --store decisions --entry '{"summary":"Chose esbuild","phase":"03"}'
  gsd-tools memory read --store decisions --query "esbuild"
  gsd-tools memory list --raw`,

  'memory write': `Usage: gsd-tools memory write --store <name> --entry '{json}' [--raw]

Write an entry to a memory store.

Arguments:
  --store <name>    Store name: decisions, bookmarks, lessons, todos
  --entry '{json}'  JSON object to store

Behavior:
  decisions/lessons  Append only, NEVER pruned (sacred data)
  bookmarks          Prepend (newest first), trim to max 20
  todos              Simple append

Auto-adds "timestamp" field (ISO date) if not present.

Examples:
  gsd-tools memory write --store decisions --entry '{"summary":"Use esbuild","phase":"03"}'
  gsd-tools memory write --store bookmarks --entry '{"file":"src/router.js","line":42}'`,

  'memory read': `Usage: gsd-tools memory read --store <name> [options] [--raw]

Read entries from a memory store with optional filtering.

Arguments:
  --store <name>    Store name: decisions, bookmarks, lessons, todos

Options:
  --limit N         Max entries to return
  --query "text"    Case-insensitive text search across all string values
  --phase N         Filter by entry.phase field

Output: { entries, count, store, total }

Examples:
  gsd-tools memory read --store decisions --raw
  gsd-tools memory read --store lessons --query "frontmatter" --limit 5
  gsd-tools memory read --store decisions --phase 03`,

  'memory list': `Usage: gsd-tools memory list [--raw]

List all memory stores with entry counts and file sizes.

Output: { stores: [{name, entry_count, size_bytes, last_modified}], memory_dir }

Examples:
  gsd-tools memory list --raw`,

  'memory compact': `Usage: gsd-tools memory compact [--store <name>] [--threshold N] [--dry-run] [--raw]

Compact memory stores by summarizing old entries.

Options:
  --store <name>     Specific store to compact (default: all non-sacred)
  --threshold N      Entry count threshold to trigger compaction (default: 50)
  --dry-run          Preview compaction without modifying files

Sacred data (decisions, lessons) is NEVER compacted.

Compaction rules:
  bookmarks    Keep 10 most recent, summarize older entries
  todos        Keep active todos, summarize completed ones

Output: { compacted, stores_processed, entries_before, entries_after, summaries_created, sacred_skipped }

Examples:
  gsd-tools memory compact --raw
  gsd-tools memory compact --store bookmarks --dry-run --raw
  gsd-tools memory compact --threshold 30 --raw`,

  'extract-sections': `Usage: gsd-tools extract-sections <file-path> [section1] [section2] ... [--raw]

Extract specific named sections from a markdown file.
Supports ## headers and <!-- section: name --> markers as section boundaries.

Modes:
  Discovery     No sections specified → list available sections
  Extraction    Sections specified → return matching content

Section matching is case-insensitive.

Output (discovery):  { file, available_sections: [...] }
Output (extraction): { file, sections_found, sections_missing, content }

Examples:
  gsd-tools extract-sections references/checkpoints.md --raw
  gsd-tools extract-sections references/checkpoints.md "types" --raw
  gsd-tools extract-sections references/checkpoints.md "types" "guidelines" --raw`,
};

module.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP };
