#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/constants.js
var require_constants = __commonJS({
  "src/lib/constants.js"(exports2, module2) {
    var MODEL_PROFILES = {
      "gsd-planner": { quality: "opus", balanced: "opus", budget: "sonnet" },
      "gsd-roadmapper": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "gsd-executor": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "gsd-phase-researcher": { quality: "opus", balanced: "sonnet", budget: "haiku" },
      "gsd-project-researcher": { quality: "opus", balanced: "sonnet", budget: "haiku" },
      "gsd-research-synthesizer": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
      "gsd-debugger": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
      "gsd-codebase-mapper": { quality: "sonnet", balanced: "haiku", budget: "haiku" },
      "gsd-verifier": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
      "gsd-plan-checker": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
      "gsd-integration-checker": { quality: "sonnet", balanced: "sonnet", budget: "haiku" }
    };
    var CONFIG_SCHEMA = {
      model_profile: { type: "string", default: "balanced", description: "Active model profile (quality/balanced/budget)", aliases: [], nested: null },
      commit_docs: { type: "boolean", default: true, description: "Auto-commit planning docs", aliases: [], nested: { section: "planning", field: "commit_docs" } },
      search_gitignored: { type: "boolean", default: false, description: "Include gitignored files in searches", aliases: [], nested: { section: "planning", field: "search_gitignored" } },
      branching_strategy: { type: "string", default: "none", description: "Git branching strategy", aliases: [], nested: { section: "git", field: "branching_strategy" } },
      phase_branch_template: { type: "string", default: "gsd/phase-{phase}-{slug}", description: "Phase branch name template", aliases: [], nested: { section: "git", field: "phase_branch_template" } },
      milestone_branch_template: { type: "string", default: "gsd/{milestone}-{slug}", description: "Milestone branch name template", aliases: [], nested: { section: "git", field: "milestone_branch_template" } },
      research: { type: "boolean", default: true, description: "Enable research phase", aliases: ["research_enabled"], nested: { section: "workflow", field: "research" } },
      plan_checker: { type: "boolean", default: true, description: "Enable plan checking", aliases: [], nested: { section: "workflow", field: "plan_check" } },
      verifier: { type: "boolean", default: true, description: "Enable verification phase", aliases: [], nested: { section: "workflow", field: "verifier" } },
      parallelization: { type: "boolean", default: true, description: "Enable parallel plan execution", aliases: [], nested: null, coerce: "parallelization" },
      brave_search: { type: "boolean", default: false, description: "Enable Brave Search API", aliases: [], nested: null },
      mode: { type: "string", default: "interactive", description: "Execution mode (interactive or yolo)", aliases: [], nested: null },
      model_profiles: { type: "object", default: {}, description: "Model assignments per agent", aliases: [], nested: null },
      depth: { type: "string", default: "standard", description: "Planning depth", aliases: [], nested: null },
      test_commands: { type: "object", default: {}, description: "Test commands by framework", aliases: [], nested: null },
      test_gate: { type: "boolean", default: true, description: "Block plan completion on test failure", aliases: [], nested: null },
      context_window: { type: "number", default: 2e5, description: "Context window size in tokens", aliases: [], nested: null },
      context_target_percent: { type: "number", default: 50, description: "Target context utilization percent (1-100)", aliases: [], nested: null }
    };
    var COMMAND_HELP = {
      "state": `Usage: gsd-tools state <subcommand> [options] [--raw]

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
      "state validate": `Usage: gsd-tools state validate [--fix] [--raw]

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
      "frontmatter": `Usage: gsd-tools frontmatter <subcommand> <file> [options] [--raw]

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
      "verify": `Usage: gsd-tools verify <subcommand> [args] [--raw]

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
      "verify deliverables": `Usage: gsd-tools verify deliverables [--plan <file>] [--raw]

Run project tests and optionally verify plan deliverables (artifacts + key_links).

Auto-detects test framework: package.json \u2192 npm test, mix.exs \u2192 mix test, go.mod \u2192 go test ./...
Override via config.json test_commands.

Options:
  --plan <file>   Plan file to check must_haves.artifacts and key_links

Output: { test_result, tests_passed, tests_failed, tests_total, framework, verdict }

Examples:
  gsd-tools verify deliverables
  gsd-tools verify deliverables --plan .planning/phases/01-foundation/01-01-PLAN.md`,
      "verify requirements": `Usage: gsd-tools verify requirements [--raw]

Check REQUIREMENTS.md coverage. Parses requirement checkboxes and traceability table.
A requirement is "addressed" if marked [x] or its mapped phase has SUMMARY.md files.

Output: { total, addressed, unaddressed, unaddressed_list }

Examples:
  gsd-tools verify requirements --raw`,
      "verify regression": `Usage: gsd-tools verify regression [--before <file>] [--after <file>] [--raw]

Detect test regressions by comparing before/after test result files.
Each file: { tests: [{name, status: "pass"|"fail"}] }

Without --before/--after, checks .planning/memory/test-baseline.json.

Output: { regressions, regression_count, verdict }

Examples:
  gsd-tools verify regression --before baseline.json --after current.json`,
      "verify quality": `Usage: gsd-tools verify quality [--plan <file>] [--phase <N>] [--raw]

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
      "roadmap": `Usage: gsd-tools roadmap <subcommand> [args] [--raw]

Roadmap operations.

Subcommands:
  get-phase <phase>            Extract phase section from ROADMAP.md
  analyze                      Full roadmap parse with disk status
  update-plan-progress <N>     Update progress table row from disk

Examples:
  gsd-tools roadmap analyze --raw
  gsd-tools roadmap update-plan-progress 03`,
      "phase": `Usage: gsd-tools phase <subcommand> [args] [--raw]

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
      "milestone": `Usage: gsd-tools milestone <subcommand> [args] [--raw]

Milestone lifecycle operations.

Subcommands:
  complete <version>           Archive milestone, create MILESTONES.md
    [--name <name>]
    [--archive-phases]         Move phase dirs to milestones/vX.Y-phases/

Examples:
  gsd-tools milestone complete v1.0 --name "Initial Release" --archive-phases`,
      "init": `Usage: gsd-tools init <workflow> [args] [--raw] [--compact]

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
      "init memory": `Usage: gsd-tools init memory [options] [--raw]

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
      "commit": `Usage: gsd-tools commit <message> [--files f1 f2 ...] [--amend] [--raw]

Commit planning documents to git.

Arguments:
  message         Commit message (required)
  --files f1 f2   Specific files to stage (default: all .planning/ changes)
  --amend         Amend the previous commit instead of creating new

Examples:
  gsd-tools commit "docs(03-01): add help system" --files .planning/STATE.md`,
      "template": `Usage: gsd-tools template <subcommand> [options] [--raw]

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
      "config-ensure-section": `Usage: gsd-tools config-ensure-section [--raw]

Initialize .planning/config.json with default values from CONFIG_SCHEMA.
Detects Brave Search API key availability and applies user-level defaults
from ~/.gsd/defaults.json if present. No-op if config already exists.`,
      "config-set": `Usage: gsd-tools config-set <key.path> <value> [--raw]

Set a configuration value in .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)
  value      Value to set (booleans and numbers auto-parsed)

Examples:
  gsd-tools config-set model_profile quality
  gsd-tools config-set workflow.research false`,
      "config-get": `Usage: gsd-tools config-get <key.path> [--raw]

Get a configuration value from .planning/config.json.
Supports dot-notation for nested keys.

Arguments:
  key.path   Key path using dot notation (e.g., workflow.research)

Examples:
  gsd-tools config-get model_profile --raw
  gsd-tools config-get workflow.research`,
      "config-migrate": `Usage: gsd-tools config-migrate [--raw]

Migrate .planning/config.json to include any new CONFIG_SCHEMA keys.
Adds missing keys with default values. Never overwrites existing values.
Creates a backup at .planning/config.json.bak before writing.

Output: { migrated_keys, unchanged_keys, config_path, backup_path }

Examples:
  gsd-tools config-migrate
  gsd-tools config-migrate --raw`,
      "generate-slug": `Usage: gsd-tools generate-slug <text> [--raw]

Convert text to a URL-safe slug (lowercase, hyphens, no special chars).

Arguments:
  text   Text to convert

Examples:
  gsd-tools generate-slug "Developer Experience" --raw
  # Output: developer-experience`,
      "current-timestamp": `Usage: gsd-tools current-timestamp [format] [--raw]

Returns the current UTC timestamp.

Formats:
  full       ISO 8601 (default): 2026-02-22T14:30:00Z
  date       Date only: 2026-02-22
  filename   Filename-safe: 2026-02-22_143000

Examples:
  gsd-tools current-timestamp --raw
  gsd-tools current-timestamp date --raw`,
      "list-todos": `Usage: gsd-tools list-todos [area] [--raw]

Count and enumerate pending todos from planning documents.

Arguments:
  area   Optional area filter (e.g., phase name)

Examples:
  gsd-tools list-todos --raw`,
      "verify-path-exists": `Usage: gsd-tools verify-path-exists <path> [--raw]

Check if a file or directory exists relative to project root.

Arguments:
  path   Relative path to check

Examples:
  gsd-tools verify-path-exists .planning/config.json`,
      "session-diff": `Usage: gsd-tools session-diff [--raw]

Show git commits since last recorded session activity.
Uses the last activity date from STATE.md to find recent commits.

Output: { commits, since_date, count }`,
      "session-summary": `Usage: gsd-tools session-summary [--raw]

Session handoff summary: position, activity, next action, continuity.
Output: { current_position, session_activity, next_action, session_continuity }`,
      "context-budget": `Usage: gsd-tools context-budget <subcommand|path> [options] [--raw]

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
      "test-run": `Usage: gsd-tools test-run [--raw]

Run project test commands (from config.json test_commands) and parse output.
Supports ExUnit, Go test, and pytest output formats.
Returns structured pass/fail results with test_gate enforcement.`,
      "search-decisions": `Usage: gsd-tools search-decisions <query> [--raw]

Search for decisions in STATE.md and archived milestone states.

Arguments:
  query   Search term (case-insensitive substring match)

Examples:
  gsd-tools search-decisions "esbuild"`,
      "validate-dependencies": `Usage: gsd-tools validate-dependencies <phase> [--raw]

Validate the dependency graph for plans in a phase.
Checks that depends_on references exist and are acyclic.

Arguments:
  phase   Phase number to validate

Examples:
  gsd-tools validate-dependencies 03`,
      "search-lessons": `Usage: gsd-tools search-lessons <query> [--raw]

Search tasks/lessons.md for matching entries.

Arguments:
  query   Search term (case-insensitive)

Examples:
  gsd-tools search-lessons "frontmatter"`,
      "codebase-impact": `Usage: gsd-tools codebase-impact <files...> [--raw]

Show module dependencies for the given files.
Reads Elixir defmodule/import/use/alias statements and reports dependents.

Arguments:
  files   One or more file paths to analyze

Examples:
  gsd-tools codebase-impact lib/my_app/accounts.ex`,
      "rollback-info": `Usage: gsd-tools rollback-info <plan-id> [--raw]

Show commits associated with a plan and the git revert command to undo them.

Arguments:
  plan-id   Plan identifier (e.g., 03-01)

Examples:
  gsd-tools rollback-info 02-01`,
      "velocity": `Usage: gsd-tools velocity [--raw]

Calculate planning velocity: plans/day, completion forecast, and trend.
Reads execution metrics from STATE.md performance table.`,
      "trace-requirement": `Usage: gsd-tools trace-requirement <req-id> [--raw]

Full traceability from requirement to files on disk.
Traces through REQUIREMENTS.md \u2192 PLAN.md \u2192 SUMMARY.md \u2192 actual files.

Arguments:
  req-id   Requirement identifier (e.g., DX-01)

Examples:
  gsd-tools trace-requirement FOUND-01`,
      "validate-config": `Usage: gsd-tools validate-config [--raw]

Schema validation and typo detection for .planning/config.json.
Checks all keys against CONFIG_SCHEMA, reports unknown keys and type mismatches.`,
      "quick-summary": `Usage: gsd-tools quick-summary [--raw]

Milestone progress summary showing quick task status.`,
      "validate": `Usage: gsd-tools validate <subcommand> [options] [--raw]

Validation commands.

Subcommands:
  consistency            Check phase numbering, disk/roadmap sync
  health [--repair]      Check .planning/ integrity, optionally repair

Examples:
  gsd-tools validate consistency
  gsd-tools validate health --repair`,
      "progress": `Usage: gsd-tools progress [format] [--raw]

Render progress in various formats.

Formats:
  json    JSON output (default)
  table   ASCII table
  bar     Progress bar only

Examples:
  gsd-tools progress table
  gsd-tools progress bar --raw`,
      "todo": `Usage: gsd-tools todo <subcommand> [args] [--raw]

Todo management.

Subcommands:
  complete <filename>    Move todo from pending to completed

Examples:
  gsd-tools todo complete my-task.md`,
      "scaffold": `Usage: gsd-tools scaffold <type> [options] [--raw]

Create scaffolded planning documents.

Types:
  context --phase N          Create CONTEXT.md template
  uat --phase N              Create UAT.md template
  verification --phase N     Create VERIFICATION.md template
  phase-dir --phase N --name "..."  Create phase directory

Examples:
  gsd-tools scaffold context --phase 03
  gsd-tools scaffold phase-dir --phase 04 --name "Build System"`,
      "phases": `Usage: gsd-tools phases list [options] [--raw]

List phase directories with metadata.

Options:
  --type <type>          Filter by type (e.g., plan, summary)
  --phase <N>            Filter by phase number
  --include-archived     Include archived milestone phases

Examples:
  gsd-tools phases list
  gsd-tools phases list --phase 03`,
      "requirements": `Usage: gsd-tools requirements <subcommand> [args] [--raw]

Requirements traceability operations.

Subcommands:
  mark-complete <ids>    Mark requirement IDs as complete
    Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]

Examples:
  gsd-tools requirements mark-complete DX-01 DX-03`,
      "find-phase": `Usage: gsd-tools find-phase <phase> [--raw]

Find a phase directory by number, returning its path and metadata.

Arguments:
  phase   Phase number (e.g., 03, 02.1)

Examples:
  gsd-tools find-phase 03 --raw`,
      "resolve-model": `Usage: gsd-tools resolve-model <agent-type> [--raw]

Get the model assignment for an agent based on the active profile.

Arguments:
  agent-type   Agent identifier (e.g., gsd-executor, gsd-planner)

Examples:
  gsd-tools resolve-model gsd-executor --raw`,
      "verify-summary": `Usage: gsd-tools verify-summary <path> [--check-count N] [--raw]

Verify a SUMMARY.md file for completeness and structure.

Arguments:
  path            Path to SUMMARY.md file
  --check-count N Minimum number of checks required (default: 2)

Examples:
  gsd-tools verify-summary .planning/phases/01-foundation/01-01-SUMMARY.md`,
      "history-digest": `Usage: gsd-tools history-digest [--raw]

Aggregate all SUMMARY.md data across phases into a single digest.
Includes archived milestone phases. Returns decisions, tech stack, and per-phase data.`,
      "phase-plan-index": `Usage: gsd-tools phase-plan-index <phase> [--raw]

Index all plans in a phase with waves, dependencies, and status.

Arguments:
  phase   Phase number

Examples:
  gsd-tools phase-plan-index 03`,
      "state-snapshot": `Usage: gsd-tools state-snapshot [--raw]

Structured parse of STATE.md returning all sections as JSON.
More detailed than state load \u2014 includes metrics, decisions, blockers, session info.`,
      "summary-extract": `Usage: gsd-tools summary-extract <path> [--fields f1,f2] [--raw]

Extract structured data from a SUMMARY.md file.

Arguments:
  path             Path to SUMMARY.md
  --fields f1,f2   Comma-separated fields to extract (default: all)

Examples:
  gsd-tools summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md
  gsd-tools summary-extract path/to/SUMMARY.md --fields phase,decisions`,
      "websearch": `Usage: gsd-tools websearch <query> [--limit N] [--freshness day|week|month] [--raw]

Search the web via Brave Search API (requires brave_search config enabled).

Arguments:
  query          Search query string
  --limit N      Max results (default: 10)
  --freshness    Time filter: day, week, or month

Examples:
  gsd-tools websearch "esbuild bundler plugins" --limit 5`,
      "memory": `Usage: gsd-tools memory <subcommand> [options] [--raw]

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
      "memory write": `Usage: gsd-tools memory write --store <name> --entry '{json}' [--raw]

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
      "memory read": `Usage: gsd-tools memory read --store <name> [options] [--raw]

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
      "memory list": `Usage: gsd-tools memory list [--raw]

List all memory stores with entry counts and file sizes.

Output: { stores: [{name, entry_count, size_bytes, last_modified}], memory_dir }

Examples:
  gsd-tools memory list --raw`,
      "memory compact": `Usage: gsd-tools memory compact [--store <name>] [--threshold N] [--dry-run] [--raw]

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
      "test-coverage": `Usage: gsd-tools test-coverage [--raw]

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
  gsd-tools test-coverage --raw`,
      "intent": `Usage: gsd-tools intent <subcommand> [options] [--raw]

Manage project intent in INTENT.md.

Subcommands:
  create      Create a new INTENT.md (errors if exists, use --force to overwrite)
  show        Display intent summary (compact by default, --full for complete, section filter supported)
  read        Read intent as JSON (alias for intent show --raw, section filter supported)
  update      Update INTENT.md sections (--add, --remove, --set-priority, --value)
  validate    Validate INTENT.md structure (exit 0=valid, 1=issues)
  trace       Traceability matrix: desired outcomes \u2192 plans (--gaps for uncovered only)
  drift       Drift analysis: detect misalignment with 4 signals + numeric score

Examples:
  gsd-tools intent create
  gsd-tools intent show
  gsd-tools intent read outcomes --raw
  gsd-tools intent validate --raw
  gsd-tools intent trace --raw
  gsd-tools intent trace --gaps
  gsd-tools intent drift --raw`,
      "intent create": `Usage: gsd-tools intent create [options] [--raw]

Create a new INTENT.md in .planning/ with 6 structured sections.

Options:
  --force                 Overwrite existing INTENT.md
  --objective "text"      Set objective statement
  --users "u1" "u2"      Set target users
  --outcomes "DO-01 [P1]: desc"  Add desired outcomes
  --criteria "SC-01: gate"       Add success criteria

Sections: objective, users, outcomes, criteria, constraints, health
Auto-commits if commit_docs is enabled.

Output: { created, path, revision, sections, commit }

Examples:
  gsd-tools intent create
  gsd-tools intent create --force
  gsd-tools intent create --objective "A CLI for project planning" --raw`,
      "intent show": `Usage: gsd-tools intent show [section] [--full] [--raw]

Display intent summary from INTENT.md.

Modes:
  (default)        Compact summary (10-20 lines, outcomes sorted by priority)
  --full           Render complete INTENT.md content
  <section>        Show specific section (objective, users, outcomes, criteria, constraints, health)
  --raw            JSON output of all sections (or filtered section)

Examples:
  gsd-tools intent show
  gsd-tools intent show --full
  gsd-tools intent show outcomes
  gsd-tools intent show --raw`,
      "intent read": `Usage: gsd-tools intent read [section] [--raw]

Read intent as JSON. Alias for 'intent show --raw'.

Arguments:
  section    Optional section filter (objective, users, outcomes, criteria, constraints, health)

Output: Full structured JSON or single section JSON

Examples:
  gsd-tools intent read --raw
  gsd-tools intent read outcomes --raw`,
      "intent validate": `Usage: gsd-tools intent validate [--raw]

Validate INTENT.md structure: sections, ID format, uniqueness, minimums.
Exit 0=valid, 1=issues. Output (--raw): { valid, issues, sections, revision }

Examples:
  gsd-tools intent validate --raw`,
      "intent trace": `Usage: gsd-tools intent trace [--gaps] [--raw]

Traceability matrix: desired outcomes \u2192 plans addressing them.
Scans PLAN.md frontmatter for intent.outcome_ids.

Flags: --gaps (uncovered only), --raw (JSON output)

Examples:
  gsd-tools intent trace --gaps --raw`,
      "intent drift": `Usage: gsd-tools intent drift [--raw]

Detect misalignment between work and stated intent. Drift score 0-100.

Signals: Coverage Gaps (40pts), Objective Mismatch (25pts), Feature Creep (15pts), Priority Inversion (20pts).
Score: 0-15 excellent, 16-35 good, 36-60 moderate, 61-100 poor.

Examples:
  gsd-tools intent drift --raw`,
      "extract-sections": `Usage: gsd-tools extract-sections <file-path> [section1] [section2] ... [--raw]

Extract specific named sections from a markdown file.
Supports ## headers and <!-- section: name --> markers as section boundaries.

Modes:
  Discovery     No sections specified \u2192 list available sections
  Extraction    Sections specified \u2192 return matching content

Section matching is case-insensitive.

Output (discovery):  { file, available_sections: [...] }
Output (extraction): { file, sections_found, sections_missing, content }

Examples:
  gsd-tools extract-sections references/checkpoints.md --raw
  gsd-tools extract-sections references/checkpoints.md "types" --raw
   gsd-tools extract-sections references/checkpoints.md "types" "guidelines" --raw`,
      "token-budget": `Usage: gsd-tools token-budget [--raw]

Show estimated token counts for all workflow files against their budgets.
Searches for workflow .md files in:
  1. <cwd>/workflows/
  2. Plugin directory workflows/
  3. ~/.config/opencode/workflows/ (home config)

Each workflow is measured (chars/4 \u2248 tokens) and compared against known budget limits.

Output: { workflows: [{ name, path, tokens, budget, within_budget }], total_tokens, over_budget_count }

Examples:
  gsd-tools token-budget --raw`,
      "mcp-profile": `Usage: gsd-tools mcp-profile [options] [--raw]

Discover MCP servers, estimate token cost, score relevance, apply/restore.

Sources: .mcp.json, opencode.json, ~/.config/opencode/opencode.json
Known-server DB covers 15+ servers. Scores keep/disable/review per server.

Options:
  --window <size>   Context window size (default: 200000)
  --apply           Disable recommended servers in opencode.json (backup first)
  --dry-run         With --apply: preview without modifying
  --restore         Restore opencode.json from opencode.json.bak
  --raw             JSON output

Only opencode.json is modified (not .mcp.json). Also: gsd-tools mcp profile

Examples:
  gsd-tools mcp-profile --apply --raw
  gsd-tools mcp-profile --restore --raw`,
      "mcp": `Usage: gsd-tools mcp <subcommand> [options] [--raw]

MCP server management. Subcommands: profile [--window N] [--apply] [--restore]

Examples:
  gsd-tools mcp profile --raw
  gsd-tools mcp profile --apply --raw`,
      "assertions": `Usage: gsd-tools assertions <subcommand> [options] [--raw]

Manage structured acceptance criteria in ASSERTIONS.md.

Subcommands:
  list [--req SREQ-01]    List all assertions, optionally filter by requirement ID
  validate                Check assertion format, coverage, and consistency

Output (list): { total_requirements, total_assertions, must_have_count, nice_to_have_count, requirements }
Output (validate): { valid, issues, stats: { total_reqs, total_assertions, coverage_percent } }

Examples:
  gsd-tools assertions list --raw
  gsd-tools assertions list --req SREQ-01 --raw
  gsd-tools assertions validate --raw`,
      "assertions list": `Usage: gsd-tools assertions list [--req <id>] [--raw]

List all assertions from .planning/ASSERTIONS.md grouped by requirement ID.

Options:
  --req <id>    Filter to specific requirement (e.g., SREQ-01)

Output: { total_requirements, total_assertions, must_have_count, nice_to_have_count, requirements }

Examples:
  gsd-tools assertions list --raw
  gsd-tools assertions list --req SREQ-01 --raw`,
      "assertions validate": `Usage: gsd-tools assertions validate [--raw]

Validate ASSERTIONS.md format, coverage, and consistency with REQUIREMENTS.md.

Checks:
  - Every requirement ID exists in REQUIREMENTS.md
  - Each requirement has 2-5 assertions (advisory)
  - Every assertion has non-empty assert field
  - type values are valid: api, cli, file, behavior
  - priority values are valid: must-have, nice-to-have

Output: { valid, issues: [{reqId, issue, severity}], stats: {total_reqs, total_assertions, coverage_percent} }

Examples:
  gsd-tools assertions validate --raw`,
      "env": `Usage: gsd-tools env <subcommand> [options] [--raw]

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
  --raw       Output JSON to stdout

Examples:
  gsd-tools env scan --raw
  gsd-tools env scan --force --verbose
  gsd-tools env status --raw`,
      "env scan": `Usage: gsd-tools env scan [--force] [--verbose] [--raw]

Scan project for languages, tools, runtimes, and write env-manifest.json.

Without --force, skips scan if manifest is fresh (no watched files changed).
With --force, always performs a full scan.

Detects: 26 language manifest patterns, package managers (with lockfile
precedence), version managers, CI platforms, test frameworks, linters/formatters,
well-known scripts, Docker services, MCP servers, monorepo configurations.

Output includes: languages (with binary version/path), package_manager,
version_managers, tools, scripts, infrastructure, monorepo, watched_files.

Examples:
  gsd-tools env scan --raw
  gsd-tools env scan --force --verbose`,
      "env status": `Usage: gsd-tools env status [--raw]

Report manifest freshness without triggering a scan.

Output: { exists, stale, reason, scanned_at, age_minutes, languages_count, changed_files }

Examples:
  gsd-tools env status --raw`,
      "worktree": `Usage: gsd-tools worktree <subcommand> [options] [--raw]

Manage git worktrees for parallel plan execution.

Subcommands:
  create <plan-id>    Create isolated worktree for a plan
  list                List active worktrees for this project
  remove <plan-id>    Remove a specific worktree
  cleanup             Remove all worktrees for this project`,
      "worktree create": `Usage: gsd-tools worktree create <plan-id> [--raw]

Create an isolated git worktree for a plan.

Args:
  plan-id     Plan ID in NN-MM format (e.g., 21-02)

Creates worktree at {base_path}/{project}/{plan-id}/ with branch worktree-{phase}-{plan}-{wave}.
Syncs configured files (.env, config) and runs setup hooks.

Output: { created, plan_id, branch, path, synced_files, setup_status, setup_error?, resource_warnings? }`,
      "worktree list": `Usage: gsd-tools worktree list [--raw]

List active worktrees for the current project.

Output: { worktrees: [{ plan_id, branch, path, head, disk_usage }] }`,
      "worktree remove": `Usage: gsd-tools worktree remove <plan-id> [--raw]

Remove a specific worktree and its branch.

Args:
  plan-id     Plan ID to remove (e.g., 21-02)

Output: { removed, plan_id, path }`,
      "worktree cleanup": `Usage: gsd-tools worktree cleanup [--raw]

Remove all worktrees for the current project and prune stale references.

Output: { cleaned, worktrees: [{ plan_id, path }] }`
    };
    module2.exports = { MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP };
  }
});

// src/lib/output.js
var require_output = __commonJS({
  "src/lib/output.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var _tmpFiles = [];
    process.on("exit", () => {
      for (const f of _tmpFiles) {
        try {
          fs.unlinkSync(f);
        } catch {
        }
      }
    });
    function filterFields(obj, fields) {
      if (obj === null || obj === void 0) return obj;
      if (Array.isArray(obj)) {
        return obj.map((item) => filterFields(item, fields));
      }
      if (typeof obj !== "object") return obj;
      const result = {};
      for (const field of fields) {
        const parts = field.split(".");
        if (parts.length === 1) {
          result[field] = field in obj ? obj[field] : null;
        } else {
          const topKey = parts[0];
          const rest = parts.slice(1).join(".");
          if (!(topKey in obj)) {
            result[topKey] = null;
          } else {
            const val = obj[topKey];
            if (Array.isArray(val)) {
              result[topKey] = val.map((item) => {
                if (typeof item === "object" && item !== null) {
                  return filterFields(item, [rest]);
                }
                return item;
              });
            } else if (typeof val === "object" && val !== null) {
              const existing = result[topKey] || {};
              const nested = filterFields(val, [rest]);
              result[topKey] = typeof existing === "object" && !Array.isArray(existing) ? { ...existing, ...nested } : nested;
            } else {
              result[topKey] = val;
            }
          }
        }
      }
      return result;
    }
    function output(result, raw, rawValue) {
      if (raw && rawValue !== void 0) {
        process.stdout.write(String(rawValue));
      } else {
        let filtered = result;
        if (global._gsdRequestedFields && typeof result === "object" && result !== null) {
          filtered = filterFields(result, global._gsdRequestedFields);
        }
        const json = JSON.stringify(filtered, null, 2);
        if (json.length > 5e4 && !process.env.GSD_NO_TMPFILE) {
          const tmpPath = path.join(require("os").tmpdir(), `gsd-${Date.now()}.json`);
          fs.writeFileSync(tmpPath, json, "utf-8");
          _tmpFiles.push(tmpPath);
          process.stdout.write("@file:" + tmpPath);
        } else {
          process.stdout.write(json);
        }
      }
      process.exit(0);
    }
    function error(message) {
      process.stderr.write("Error: " + message + "\n");
      process.exit(1);
    }
    function debugLog(context, message, err) {
      if (!process.env.GSD_DEBUG) return;
      let line = `[GSD_DEBUG] ${context}: ${message}`;
      if (err) line += ` | ${err.message || err}`;
      process.stderr.write(line + "\n");
    }
    module2.exports = { _tmpFiles, filterFields, output, error, debugLog };
  }
});

// src/lib/config.js
var require_config = __commonJS({
  "src/lib/config.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { execFileSync } = require("child_process");
    var { CONFIG_SCHEMA } = require_constants();
    var { debugLog } = require_output();
    var _configCache = /* @__PURE__ */ new Map();
    function loadConfig(cwd) {
      if (_configCache.has(cwd)) {
        debugLog("config.load", `cache hit: ${cwd}`);
        return _configCache.get(cwd);
      }
      const configPath = path.join(cwd, ".planning", "config.json");
      const defaults = {};
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        defaults[key] = def.default;
      }
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        const get = (key, def) => {
          if (parsed[key] !== void 0) return parsed[key];
          if (def.nested && parsed[def.nested.section] && parsed[def.nested.section][def.nested.field] !== void 0) {
            return parsed[def.nested.section][def.nested.field];
          }
          for (const alias of def.aliases) {
            if (parsed[alias] !== void 0) return parsed[alias];
          }
          return void 0;
        };
        const result = {};
        for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
          if (def.coerce === "parallelization") {
            const val = get(key, def);
            if (typeof val === "boolean") {
              result[key] = val;
            } else if (typeof val === "object" && val !== null && "enabled" in val) {
              result[key] = val.enabled;
            } else {
              result[key] = def.default;
            }
          } else {
            result[key] = get(key, def) ?? def.default;
          }
        }
        _configCache.set(cwd, result);
        return result;
      } catch (e) {
        debugLog("config.load", "parse config.json failed, using defaults", e);
        _configCache.set(cwd, defaults);
        return defaults;
      }
    }
    function isGitIgnored(cwd, targetPath) {
      try {
        execFileSync("git", ["check-ignore", "-q", "--", targetPath], {
          cwd,
          stdio: "pipe"
        });
        return true;
      } catch (e) {
        debugLog("git.checkIgnore", "exec failed", e);
        return false;
      }
    }
    module2.exports = { loadConfig, isGitIgnored };
  }
});

// src/lib/regex-cache.js
var require_regex_cache = __commonJS({
  "src/lib/regex-cache.js"(exports2, module2) {
    var MAX_CACHE_SIZE = 200;
    var _dynamicRegexCache = /* @__PURE__ */ new Map();
    function cachedRegex(pattern, flags = "") {
      const key = `${pattern}|||${flags}`;
      if (_dynamicRegexCache.has(key)) {
        const regex2 = _dynamicRegexCache.get(key);
        _dynamicRegexCache.delete(key);
        _dynamicRegexCache.set(key, regex2);
        return regex2;
      }
      if (_dynamicRegexCache.size >= MAX_CACHE_SIZE) {
        const oldest = _dynamicRegexCache.keys().next().value;
        _dynamicRegexCache.delete(oldest);
      }
      const regex = new RegExp(pattern, flags);
      _dynamicRegexCache.set(key, regex);
      return regex;
    }
    var FRONTMATTER_DELIMITERS = /^---\n([\s\S]+?)\n---/;
    var PHASE_HEADER = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
    var ACTIVE_MILESTONE = /[-*]\s*🔵\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/;
    var ACTIVE_TAG_MILESTONE = /[-*]\s*(?:🔵\s*)?\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*\(active\)[^\n]*)/i;
    var VERSION_PATTERN = /v(\d+\.\d+)/;
    var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    var PHASE_DIR_NUMBER = /^(\d+(?:\.\d+)?)-?(.*)/;
    var COMMIT_SHA = /\b([a-f0-9]{7,40})\b/g;
    var UNCHECKED_PHASE = /- \[ \] \*\*Phase/g;
    module2.exports = {
      cachedRegex,
      FRONTMATTER_DELIMITERS,
      PHASE_HEADER,
      ACTIVE_MILESTONE,
      ACTIVE_TAG_MILESTONE,
      VERSION_PATTERN,
      DATE_PATTERN,
      PHASE_DIR_NUMBER,
      COMMIT_SHA,
      UNCHECKED_PHASE
    };
  }
});

// src/lib/frontmatter.js
var require_frontmatter = __commonJS({
  "src/lib/frontmatter.js"(exports2, module2) {
    var FM_DELIMITERS = /^---\n([\s\S]+?)\n---/;
    var FM_INDENT = /^(\s*)/;
    var FM_KEY_VALUE = /^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/;
    var _fmCache = /* @__PURE__ */ new Map();
    var FM_CACHE_MAX = 100;
    function extractFrontmatter(content) {
      if (!content || typeof content !== "string") return {};
      if (!content.startsWith("---\n")) return {};
      const cacheKey = content.length + ":" + content.slice(0, 200);
      if (_fmCache.has(cacheKey)) {
        return _fmCache.get(cacheKey);
      }
      const frontmatter = {};
      const match = content.match(FM_DELIMITERS);
      if (!match) return frontmatter;
      const yaml = match[1];
      const lines = yaml.split("\n");
      let stack = [{ obj: frontmatter, key: null, indent: -1 }];
      for (const line of lines) {
        if (line.trim() === "") continue;
        const indentMatch = line.match(FM_INDENT);
        const indent = indentMatch ? indentMatch[1].length : 0;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        const current = stack[stack.length - 1];
        const keyMatch = line.match(FM_KEY_VALUE);
        if (keyMatch) {
          const key = keyMatch[2];
          const value = keyMatch[3].trim();
          if (value === "" || value === "[") {
            current.obj[key] = value === "[" ? [] : {};
            current.key = null;
            stack.push({ obj: current.obj[key], key: null, indent });
          } else if (value.startsWith("[") && value.endsWith("]")) {
            current.obj[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
            current.key = null;
          } else {
            current.obj[key] = value.replace(/^["']|["']$/g, "");
            current.key = null;
          }
        } else if (line.trim().startsWith("- ")) {
          const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, "");
          if (typeof current.obj === "object" && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
            const parent = stack.length > 1 ? stack[stack.length - 2] : null;
            if (parent) {
              for (const k of Object.keys(parent.obj)) {
                if (parent.obj[k] === current.obj) {
                  parent.obj[k] = [itemValue];
                  current.obj = parent.obj[k];
                  break;
                }
              }
            }
          } else if (Array.isArray(current.obj)) {
            current.obj.push(itemValue);
          }
        }
      }
      if (_fmCache.size >= FM_CACHE_MAX) {
        const oldest = _fmCache.keys().next().value;
        _fmCache.delete(oldest);
      }
      _fmCache.set(cacheKey, frontmatter);
      return frontmatter;
    }
    function reconstructFrontmatter(obj) {
      const lines = [];
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === void 0) continue;
        if (Array.isArray(value)) {
          if (value.length === 0) {
            lines.push(`${key}: []`);
          } else if (value.every((v) => typeof v === "string") && value.length <= 3 && value.join(", ").length < 60) {
            lines.push(`${key}: [${value.join(", ")}]`);
          } else {
            lines.push(`${key}:`);
            for (const item of value) {
              lines.push(`  - ${typeof item === "string" && (item.includes(":") || item.includes("#")) ? `"${item}"` : item}`);
            }
          }
        } else if (typeof value === "object") {
          lines.push(`${key}:`);
          for (const [subkey, subval] of Object.entries(value)) {
            if (subval === null || subval === void 0) continue;
            if (Array.isArray(subval)) {
              if (subval.length === 0) {
                lines.push(`  ${subkey}: []`);
              } else if (subval.every((v) => typeof v === "string") && subval.length <= 3 && subval.join(", ").length < 60) {
                lines.push(`  ${subkey}: [${subval.join(", ")}]`);
              } else {
                lines.push(`  ${subkey}:`);
                for (const item of subval) {
                  lines.push(`    - ${typeof item === "string" && (item.includes(":") || item.includes("#")) ? `"${item}"` : item}`);
                }
              }
            } else if (typeof subval === "object") {
              lines.push(`  ${subkey}:`);
              for (const [subsubkey, subsubval] of Object.entries(subval)) {
                if (subsubval === null || subsubval === void 0) continue;
                if (Array.isArray(subsubval)) {
                  if (subsubval.length === 0) {
                    lines.push(`    ${subsubkey}: []`);
                  } else {
                    lines.push(`    ${subsubkey}:`);
                    for (const item of subsubval) {
                      lines.push(`      - ${item}`);
                    }
                  }
                } else {
                  lines.push(`    ${subsubkey}: ${subsubval}`);
                }
              }
            } else {
              const sv = String(subval);
              lines.push(`  ${subkey}: ${sv.includes(":") || sv.includes("#") ? `"${sv}"` : sv}`);
            }
          }
        } else {
          const sv = String(value);
          if (sv.includes(":") || sv.includes("#") || sv.startsWith("[") || sv.startsWith("{")) {
            lines.push(`${key}: "${sv}"`);
          } else {
            lines.push(`${key}: ${sv}`);
          }
        }
      }
      return lines.join("\n");
    }
    function spliceFrontmatter(content, newObj) {
      const yamlStr = reconstructFrontmatter(newObj);
      const match = content.match(/^---\n[\s\S]+?\n---/);
      if (match) {
        return `---
${yamlStr}
---` + content.slice(match[0].length);
      }
      return `---
${yamlStr}
---

` + content;
    }
    module2.exports = { extractFrontmatter, reconstructFrontmatter, spliceFrontmatter };
  }
});

// src/lib/helpers.js
var require_helpers = __commonJS({
  "src/lib/helpers.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { debugLog } = require_output();
    var { loadConfig } = require_config();
    var { MODEL_PROFILES } = require_constants();
    var { cachedRegex, PHASE_DIR_NUMBER } = require_regex_cache();
    var fileCache = /* @__PURE__ */ new Map();
    var dirCache = /* @__PURE__ */ new Map();
    function safeReadFile(filePath) {
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch (e) {
        debugLog("file.read", "read failed", e);
        return null;
      }
    }
    function cachedReadFile(filePath) {
      if (fileCache.has(filePath)) {
        debugLog("file.cache", `cache hit: ${filePath}`);
        return fileCache.get(filePath);
      }
      const content = safeReadFile(filePath);
      if (content !== null) {
        fileCache.set(filePath, content);
      }
      return content;
    }
    function invalidateFileCache(filePath) {
      if (filePath) {
        fileCache.delete(filePath);
      } else {
        fileCache.clear();
      }
    }
    function cachedReaddirSync(dirPath, options) {
      const optKey = options?.withFileTypes ? ":wt" : "";
      const key = dirPath + optKey;
      if (dirCache.has(key)) {
        return dirCache.get(key);
      }
      try {
        const entries = fs.readdirSync(dirPath, options);
        dirCache.set(key, entries);
        return entries;
      } catch (e) {
        debugLog("dir.cache", `readdir failed: ${dirPath}`, e);
        dirCache.set(key, null);
        return null;
      }
    }
    var _phaseTreeCache = null;
    var _phaseTreeCwd = null;
    function getPhaseTree(cwd) {
      if (_phaseTreeCache && _phaseTreeCwd === cwd) {
        return _phaseTreeCache;
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const tree = /* @__PURE__ */ new Map();
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        for (const dir of dirs) {
          const dirMatch = dir.match(PHASE_DIR_NUMBER);
          const phaseNumber = dirMatch ? dirMatch[1] : dir;
          const normalized = normalizePhaseName(phaseNumber);
          const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
          const phaseDir = path.join(phasesDir, dir);
          const phaseFiles = fs.readdirSync(phaseDir);
          const plans = phaseFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
          const summaries = phaseFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md").sort();
          const hasResearch = phaseFiles.some((f) => f.endsWith("-RESEARCH.md") || f === "RESEARCH.md");
          const hasContext = phaseFiles.some((f) => f.endsWith("-CONTEXT.md") || f === "CONTEXT.md");
          const hasVerification = phaseFiles.some((f) => f.endsWith("-VERIFICATION.md") || f === "VERIFICATION.md");
          const completedPlanIds = new Set(
            summaries.map((s) => s.replace("-SUMMARY.md", "").replace("SUMMARY.md", ""))
          );
          const incompletePlans = plans.filter((p) => {
            const planId = p.replace("-PLAN.md", "").replace("PLAN.md", "");
            return !completedPlanIds.has(planId);
          });
          tree.set(normalized, {
            dirName: dir,
            fullPath: phaseDir,
            relPath: path.join(".planning", "phases", dir),
            phaseNumber,
            phaseName,
            phaseSlug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : null,
            files: phaseFiles,
            plans,
            summaries,
            incompletePlans,
            hasResearch,
            hasContext,
            hasVerification
          });
        }
      } catch (e) {
        debugLog("phase.tree", "scan failed", e);
      }
      _phaseTreeCache = tree;
      _phaseTreeCwd = cwd;
      return tree;
    }
    function normalizePhaseName(phase) {
      const match = phase.match(/^(\d+(?:\.\d+)?)/);
      if (!match) return phase;
      const num = match[1];
      const parts = num.split(".");
      const padded = parts[0].padStart(2, "0");
      return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
    }
    function parseMustHavesBlock(content, blockName) {
      const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (!fmMatch) return [];
      const yaml = fmMatch[1];
      const blockPattern = cachedRegex(`^\\s{4}${blockName}:\\s*$`, "m");
      const blockStart = yaml.search(blockPattern);
      if (blockStart === -1) return [];
      const afterBlock = yaml.slice(blockStart);
      const blockLines = afterBlock.split("\n").slice(1);
      const items = [];
      let current = null;
      for (const line of blockLines) {
        if (line.trim() === "") continue;
        const indent = line.match(/^(\s*)/)[1].length;
        if (indent <= 4 && line.trim() !== "") break;
        if (line.match(/^\s{6}-\s+/)) {
          if (current) items.push(current);
          current = {};
          const simpleMatch = line.match(/^\s{6}-\s+"?([^"]+)"?\s*$/);
          if (simpleMatch && !line.includes(":")) {
            current = simpleMatch[1];
          } else {
            const kvMatch = line.match(/^\s{6}-\s+(\w+):\s*"?([^"]*)"?\s*$/);
            if (kvMatch) {
              current = {};
              current[kvMatch[1]] = kvMatch[2];
            }
          }
        } else if (current && typeof current === "object") {
          const kvMatch = line.match(/^\s{8,}(\w+):\s*"?([^"]*)"?\s*$/);
          if (kvMatch) {
            const val = kvMatch[2];
            current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
          }
          const arrMatch = line.match(/^\s{10,}-\s+"?([^"]+)"?\s*$/);
          if (arrMatch) {
            const keys = Object.keys(current);
            const lastKey = keys[keys.length - 1];
            if (lastKey && !Array.isArray(current[lastKey])) {
              current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
            }
            if (lastKey) current[lastKey].push(arrMatch[1]);
          }
        }
      }
      if (current) items.push(current);
      return items;
    }
    function sanitizeShellArg(arg) {
      return "'" + String(arg).replace(/'/g, "'\\''") + "'";
    }
    function isValidDateString(str) {
      return /^\d{4}-\d{2}-\d{2}$/.test(str);
    }
    function resolveModelInternal(cwd, agentType) {
      const config = loadConfig(cwd);
      const override = config.model_overrides?.[agentType];
      if (override) {
        return override === "opus" ? "inherit" : override;
      }
      const profile = config.model_profile || "balanced";
      const agentModels = MODEL_PROFILES[agentType];
      if (!agentModels) return "sonnet";
      const resolved = agentModels[profile] || agentModels["balanced"] || "sonnet";
      return resolved === "opus" ? "inherit" : resolved;
    }
    function getArchivedPhaseDirs(cwd) {
      const milestonesDir = path.join(cwd, ".planning", "milestones");
      const results = [];
      if (!fs.existsSync(milestonesDir)) return results;
      try {
        const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
        const phaseDirs = milestoneEntries.filter((e) => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name)).map((e) => e.name).sort().reverse();
        for (const archiveName of phaseDirs) {
          const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
          const archivePath = path.join(milestonesDir, archiveName);
          const entries = fs.readdirSync(archivePath, { withFileTypes: true });
          const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          for (const dir of dirs) {
            results.push({
              name: dir,
              milestone: version,
              basePath: path.join(".planning", "milestones", archiveName),
              fullPath: path.join(archivePath, dir)
            });
          }
        }
      } catch (e) {
        debugLog("phase.getArchived", "readdir failed", e);
      }
      return results;
    }
    function searchPhaseInDir(baseDir, relBase, normalized) {
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        const match = dirs.find((d) => d.startsWith(normalized));
        if (!match) return null;
        const dirMatch = match.match(PHASE_DIR_NUMBER);
        const phaseNumber = dirMatch ? dirMatch[1] : normalized;
        const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
        const phaseDir = path.join(baseDir, match);
        const phaseFiles = fs.readdirSync(phaseDir);
        const plans = phaseFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
        const summaries = phaseFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md").sort();
        const hasResearch = phaseFiles.some((f) => f.endsWith("-RESEARCH.md") || f === "RESEARCH.md");
        const hasContext = phaseFiles.some((f) => f.endsWith("-CONTEXT.md") || f === "CONTEXT.md");
        const hasVerification = phaseFiles.some((f) => f.endsWith("-VERIFICATION.md") || f === "VERIFICATION.md");
        const completedPlanIds = new Set(
          summaries.map((s) => s.replace("-SUMMARY.md", "").replace("SUMMARY.md", ""))
        );
        const incompletePlans = plans.filter((p) => {
          const planId = p.replace("-PLAN.md", "").replace("PLAN.md", "");
          return !completedPlanIds.has(planId);
        });
        return {
          found: true,
          directory: path.join(relBase, match),
          phase_number: phaseNumber,
          phase_name: phaseName,
          phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : null,
          plans,
          summaries,
          incomplete_plans: incompletePlans,
          has_research: hasResearch,
          has_context: hasContext,
          has_verification: hasVerification
        };
      } catch (e) {
        debugLog("phase.searchDir", "search directory failed", e);
        return null;
      }
    }
    function findPhaseInternal(cwd, phase) {
      if (!phase) return null;
      const normalized = normalizePhaseName(phase);
      const tree = getPhaseTree(cwd);
      const cached = tree.get(normalized);
      if (cached) {
        return {
          found: true,
          directory: cached.relPath,
          phase_number: cached.phaseNumber,
          phase_name: cached.phaseName,
          phase_slug: cached.phaseSlug,
          plans: cached.plans,
          summaries: cached.summaries,
          incomplete_plans: cached.incompletePlans,
          has_research: cached.hasResearch,
          has_context: cached.hasContext,
          has_verification: cached.hasVerification
        };
      }
      const milestonesDir = path.join(cwd, ".planning", "milestones");
      if (!fs.existsSync(milestonesDir)) return null;
      try {
        const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
        const archiveDirs = milestoneEntries.filter((e) => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name)).map((e) => e.name).sort().reverse();
        for (const archiveName of archiveDirs) {
          const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
          const archivePath = path.join(milestonesDir, archiveName);
          const relBase = path.join(".planning", "milestones", archiveName);
          const result = searchPhaseInDir(archivePath, relBase, normalized);
          if (result) {
            result.archived = version;
            return result;
          }
        }
      } catch (e) {
        debugLog("phase.findInternal", "search archived phases failed", e);
      }
      return null;
    }
    function getRoadmapPhaseInternal(cwd, phaseNum) {
      if (!phaseNum) return null;
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      try {
        const content = cachedReadFile(roadmapPath);
        if (!content) return null;
        const escapedPhase = phaseNum.toString().replace(/\./g, "\\.");
        const phasePattern = cachedRegex(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, "i");
        const headerMatch = content.match(phasePattern);
        if (!headerMatch) return null;
        const phaseName = headerMatch[1].trim();
        const headerIndex = headerMatch.index;
        const restOfContent = content.slice(headerIndex);
        const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
        const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
        const section = content.slice(headerIndex, sectionEnd).trim();
        const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
        const goal = goalMatch ? goalMatch[1].trim() : null;
        return {
          found: true,
          phase_number: phaseNum.toString(),
          phase_name: phaseName,
          goal,
          section
        };
      } catch (e) {
        debugLog("roadmap.getPhaseInternal", "read roadmap phase failed", e);
        return null;
      }
    }
    function pathExistsInternal(cwd, targetPath) {
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
      try {
        fs.statSync(fullPath);
        return true;
      } catch (e) {
        debugLog("file.exists", "stat failed", e);
        return false;
      }
    }
    function generateSlugInternal(text) {
      if (!text) return null;
      return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
    var _milestoneCache = null;
    var _milestoneCwd = null;
    function getMilestoneInfo(cwd) {
      if (_milestoneCache && _milestoneCwd === cwd) {
        return _milestoneCache;
      }
      const result = _getMilestoneInfoUncached(cwd);
      _milestoneCache = result;
      _milestoneCwd = cwd;
      return result;
    }
    function _getMilestoneInfoUncached(cwd) {
      try {
        let extractPhaseRange2 = function(line) {
          const rangeMatch = line.match(/Phases?\s+(\d+)\s*[-–]\s*(\d+)/i);
          if (rangeMatch) return { start: parseInt(rangeMatch[1]), end: parseInt(rangeMatch[2]) };
          return null;
        };
        var extractPhaseRange = extractPhaseRange2;
        const roadmap = cachedReadFile(path.join(cwd, ".planning", "ROADMAP.md"));
        if (!roadmap) return { version: "v1.0", name: "milestone", phaseRange: null };
        let version = null;
        let name = null;
        let phaseRange = null;
        const activeMatch = roadmap.match(/[-*]\s*🔵\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/);
        if (activeMatch) {
          version = "v" + activeMatch[1];
          name = activeMatch[2].trim();
          phaseRange = extractPhaseRange2(activeMatch[0]);
        }
        if (!version) {
          const activeTagMatch = roadmap.match(/[-*]\s*(?:🔵\s*)?\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*\(active\)[^\n]*)/i);
          if (activeTagMatch) {
            version = "v" + activeTagMatch[1];
            name = activeTagMatch[2].trim();
            phaseRange = extractPhaseRange2(activeTagMatch[0]);
          }
        }
        if (!version) {
          const currentWorkMatch = roadmap.match(/\*\*Active Milestone\*\*\s*[-—]+\s*v(\d+(?:\.\d+)*)[\s:]+([^\n]+)/i);
          if (currentWorkMatch) {
            version = "v" + currentWorkMatch[1];
            name = currentWorkMatch[2].trim();
            const listMatch = roadmap.match(cachedRegex("v" + currentWorkMatch[1].replace(".", "\\.") + "[^\\n]*Phases?\\s+(\\d+)\\s*[-\u2013]\\s*(\\d+)", "i"));
            if (listMatch) phaseRange = { start: parseInt(listMatch[1]), end: parseInt(listMatch[2]) };
          }
        }
        if (!version) {
          const milestoneLines = [...roadmap.matchAll(/[-*]\s*(?!✅)[^\n]*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g)];
          if (milestoneLines.length > 0) {
            const last = milestoneLines[milestoneLines.length - 1];
            version = "v" + last[1];
            name = last[2].trim();
            phaseRange = extractPhaseRange2(last[0]);
          }
        }
        if (!version) {
          const versionMatch = roadmap.match(/v(\d+\.\d+)/);
          const nameMatch = roadmap.match(/## .*v\d+\.\d+[:\s]+([^\n(]+)/);
          version = versionMatch ? versionMatch[0] : "v1.0";
          name = nameMatch ? nameMatch[1].trim() : "milestone";
        }
        return { version, name, phaseRange };
      } catch (e) {
        debugLog("milestone.info", "read roadmap for milestone failed", e);
        return { version: "v1.0", name: "milestone", phaseRange: null };
      }
    }
    function invalidateMilestoneCache() {
      _milestoneCache = null;
      _milestoneCwd = null;
    }
    function extractAtReferences(content) {
      if (!content || typeof content !== "string") return [];
      const refs = /* @__PURE__ */ new Set();
      const atPattern = /@((?:\/[\w.+\-/]+|\.[\w.+\-/]+|[\w][\w.+\-]*\/[\w.+\-/]+)(?:\.\w+)?)/g;
      let match;
      while ((match = atPattern.exec(content)) !== null) {
        const ref = match[1];
        if (ref.includes("/") && !ref.includes("@") && ref.length > 2) {
          refs.add(ref);
        }
      }
      return Array.from(refs);
    }
    function parseIntentMd(content) {
      if (!content || typeof content !== "string") {
        return {
          revision: null,
          created: null,
          updated: null,
          objective: { statement: "", elaboration: "" },
          users: [],
          outcomes: [],
          criteria: [],
          constraints: { technical: [], business: [], timeline: [] },
          health: { quantitative: [], qualitative: "" },
          history: []
        };
      }
      const revisionMatch = content.match(/\*\*Revision:\*\*\s*(\d+)/);
      const createdMatch = content.match(/\*\*Created:\*\*\s*(\S+)/);
      const updatedMatch = content.match(/\*\*Updated:\*\*\s*(\S+)/);
      const revision = revisionMatch ? parseInt(revisionMatch[1], 10) : null;
      const created = createdMatch ? createdMatch[1] : null;
      const updated = updatedMatch ? updatedMatch[1] : null;
      function extractSection(tag) {
        const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
        const match = content.match(pattern);
        return match ? match[1].trim() : null;
      }
      const objectiveRaw = extractSection("objective");
      const objective = { statement: "", elaboration: "" };
      if (objectiveRaw) {
        const lines = objectiveRaw.split("\n");
        objective.statement = lines[0].trim();
        objective.elaboration = lines.slice(1).join("\n").trim();
      }
      const usersRaw = extractSection("users");
      const users = [];
      if (usersRaw) {
        const userLines = usersRaw.split("\n").filter((l) => l.match(/^\s*-\s+/));
        for (const line of userLines) {
          const text = line.replace(/^\s*-\s+/, "").trim();
          if (text) users.push({ text });
        }
      }
      const outcomesRaw = extractSection("outcomes");
      const outcomes = [];
      if (outcomesRaw) {
        const outcomePattern = /^\s*-\s+(DO-\d+)\s+\[(P[123])\]:\s*(.+)/;
        for (const line of outcomesRaw.split("\n")) {
          const match = line.match(outcomePattern);
          if (match) {
            outcomes.push({ id: match[1], priority: match[2], text: match[3].trim() });
          }
        }
      }
      const criteriaRaw = extractSection("criteria");
      const criteria = [];
      if (criteriaRaw) {
        const criteriaPattern = /^\s*-\s+(SC-\d+):\s*(.+)/;
        for (const line of criteriaRaw.split("\n")) {
          const match = line.match(criteriaPattern);
          if (match) {
            criteria.push({ id: match[1], text: match[2].trim() });
          }
        }
      }
      const constraintsRaw = extractSection("constraints");
      const constraints = { technical: [], business: [], timeline: [] };
      if (constraintsRaw) {
        const constraintPattern = /^\s*-\s+(C-\d+):\s*(.+)/;
        let currentType = null;
        for (const line of constraintsRaw.split("\n")) {
          if (/^###\s*Technical/i.test(line)) {
            currentType = "technical";
            continue;
          }
          if (/^###\s*Business/i.test(line)) {
            currentType = "business";
            continue;
          }
          if (/^###\s*Timeline/i.test(line)) {
            currentType = "timeline";
            continue;
          }
          if (currentType) {
            const match = line.match(constraintPattern);
            if (match) {
              constraints[currentType].push({ id: match[1], text: match[2].trim() });
            }
          }
        }
      }
      const healthRaw = extractSection("health");
      const health = { quantitative: [], qualitative: "" };
      if (healthRaw) {
        const healthPattern = /^\s*-\s+(HM-\d+):\s*(.+)/;
        let inQuantitative = false;
        let inQualitative = false;
        const qualLines = [];
        for (const line of healthRaw.split("\n")) {
          if (/^###\s*Quantitative/i.test(line)) {
            inQuantitative = true;
            inQualitative = false;
            continue;
          }
          if (/^###\s*Qualitative/i.test(line)) {
            inQualitative = true;
            inQuantitative = false;
            continue;
          }
          if (inQuantitative) {
            const match = line.match(healthPattern);
            if (match) {
              health.quantitative.push({ id: match[1], text: match[2].trim() });
            }
          }
          if (inQualitative && line.trim()) {
            qualLines.push(line.trim());
          }
        }
        health.qualitative = qualLines.join("\n");
      }
      const historyRaw = extractSection("history");
      const history = [];
      if (historyRaw) {
        let currentEntry = null;
        let currentChange = null;
        for (const line of historyRaw.split("\n")) {
          const milestoneMatch = line.match(/^###\s+(v[\d.]+)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})/);
          if (milestoneMatch) {
            if (currentChange && currentEntry) currentEntry.changes.push(currentChange);
            currentChange = null;
            if (currentEntry) history.push(currentEntry);
            currentEntry = { milestone: milestoneMatch[1], date: milestoneMatch[2], changes: [] };
            continue;
          }
          const changeMatch = line.match(/^\s*-\s+\*\*(Added|Modified|Removed)\*\*\s+(.+?):\s*(.+)/);
          if (changeMatch && currentEntry) {
            if (currentChange) currentEntry.changes.push(currentChange);
            currentChange = { type: changeMatch[1], target: changeMatch[2], description: changeMatch[3].trim() };
            continue;
          }
          const reasonMatch = line.match(/^\s+-\s+Reason:\s*(.+)/);
          if (reasonMatch && currentChange) {
            currentChange.reason = reasonMatch[1].trim();
            continue;
          }
        }
        if (currentChange && currentEntry) currentEntry.changes.push(currentChange);
        if (currentEntry) history.push(currentEntry);
      }
      return {
        revision,
        created,
        updated,
        objective,
        users,
        outcomes,
        criteria,
        constraints,
        health,
        history
      };
    }
    function generateIntentMd(data) {
      const lines = [];
      lines.push(`**Revision:** ${data.revision || 1}`);
      lines.push(`**Created:** ${data.created || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`);
      lines.push(`**Updated:** ${data.updated || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`);
      lines.push("");
      lines.push("<objective>");
      if (data.objective && data.objective.statement) {
        lines.push(data.objective.statement);
        if (data.objective.elaboration) {
          lines.push("");
          lines.push(data.objective.elaboration);
        }
      } else {
        lines.push("<!-- Single statement: what this project does and why -->");
      }
      lines.push("</objective>");
      lines.push("");
      lines.push("<users>");
      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          lines.push(`- ${u.text}`);
        }
      } else {
        lines.push("<!-- Brief audience descriptions, one per line -->");
      }
      lines.push("</users>");
      lines.push("");
      lines.push("<outcomes>");
      if (data.outcomes && data.outcomes.length > 0) {
        for (const o of data.outcomes) {
          lines.push(`- ${o.id} [${o.priority}]: ${o.text}`);
        }
      } else {
        lines.push("<!-- Bullet list: - DO-XX [PX]: description -->");
      }
      lines.push("</outcomes>");
      lines.push("");
      lines.push("<criteria>");
      if (data.criteria && data.criteria.length > 0) {
        for (const c of data.criteria) {
          lines.push(`- ${c.id}: ${c.text}`);
        }
      } else {
        lines.push("<!-- Bullet list: - SC-XX: launch gate -->");
      }
      lines.push("</criteria>");
      lines.push("");
      lines.push("<constraints>");
      const hasTech = data.constraints && data.constraints.technical && data.constraints.technical.length > 0;
      const hasBiz = data.constraints && data.constraints.business && data.constraints.business.length > 0;
      const hasTime = data.constraints && data.constraints.timeline && data.constraints.timeline.length > 0;
      if (hasTech || hasBiz || hasTime) {
        if (hasTech) {
          lines.push("### Technical");
          for (const c of data.constraints.technical) {
            lines.push(`- ${c.id}: ${c.text}`);
          }
          lines.push("");
        }
        if (hasBiz) {
          lines.push("### Business");
          for (const c of data.constraints.business) {
            lines.push(`- ${c.id}: ${c.text}`);
          }
          lines.push("");
        }
        if (hasTime) {
          lines.push("### Timeline");
          for (const c of data.constraints.timeline) {
            lines.push(`- ${c.id}: ${c.text}`);
          }
          lines.push("");
        }
      } else {
        lines.push("<!-- Sub-headers: ### Technical, ### Business, ### Timeline. Items: - C-XX: constraint -->");
      }
      lines.push("</constraints>");
      lines.push("");
      lines.push("<health>");
      const hasQuant = data.health && data.health.quantitative && data.health.quantitative.length > 0;
      const hasQual = data.health && data.health.qualitative && data.health.qualitative.trim();
      if (hasQuant || hasQual) {
        if (hasQuant) {
          lines.push("### Quantitative");
          for (const m of data.health.quantitative) {
            lines.push(`- ${m.id}: ${m.text}`);
          }
          lines.push("");
        }
        if (hasQual) {
          lines.push("### Qualitative");
          lines.push(data.health.qualitative);
        }
      } else {
        lines.push("<!-- Sub-headers: ### Quantitative (- HM-XX: metric) and ### Qualitative (prose) -->");
      }
      lines.push("</health>");
      lines.push("");
      if (data.history && data.history.length > 0) {
        lines.push("<history>");
        for (const entry of data.history) {
          lines.push(`### ${entry.milestone} \u2014 ${entry.date}`);
          for (const change of entry.changes) {
            lines.push(`- **${change.type}** ${change.target}: ${change.description}`);
            if (change.reason) {
              lines.push(`  - Reason: ${change.reason}`);
            }
          }
          lines.push("");
        }
        lines.push("</history>");
        lines.push("");
      }
      return lines.join("\n");
    }
    function parsePlanIntent(content) {
      if (!content || typeof content !== "string") return null;
      const { extractFrontmatter } = require_frontmatter();
      const fm = extractFrontmatter(content);
      if (!fm || !fm.intent) return null;
      const intent = fm.intent;
      let outcomeIds = [];
      let rationale = "";
      const rawIds = intent.outcome_ids || intent["outcome_ids"];
      if (rawIds) {
        if (Array.isArray(rawIds)) {
          outcomeIds = rawIds;
        } else if (typeof rawIds === "string") {
          outcomeIds = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      const doPattern = /^DO-\d+$/;
      outcomeIds = outcomeIds.filter((id) => doPattern.test(id));
      rationale = intent.rationale || "";
      if (outcomeIds.length === 0 && !rationale) return null;
      return { outcome_ids: outcomeIds, rationale };
    }
    module2.exports = {
      safeReadFile,
      cachedReadFile,
      invalidateFileCache,
      cachedReaddirSync,
      getPhaseTree,
      normalizePhaseName,
      parseMustHavesBlock,
      sanitizeShellArg,
      isValidDateString,
      resolveModelInternal,
      getArchivedPhaseDirs,
      searchPhaseInDir,
      findPhaseInternal,
      getRoadmapPhaseInternal,
      pathExistsInternal,
      generateSlugInternal,
      getMilestoneInfo,
      invalidateMilestoneCache,
      extractAtReferences,
      parseIntentMd,
      generateIntentMd,
      parsePlanIntent
    };
  }
});

// src/lib/git.js
var require_git = __commonJS({
  "src/lib/git.js"(exports2, module2) {
    var { execFileSync } = require("child_process");
    var { debugLog } = require_output();
    function execGit(cwd, args) {
      try {
        const stdout = execFileSync("git", args, {
          cwd,
          stdio: "pipe",
          encoding: "utf-8"
        });
        return { exitCode: 0, stdout: stdout.trim(), stderr: "" };
      } catch (err) {
        debugLog("git.exec", "exec failed", err);
        return {
          exitCode: err.status ?? 1,
          stdout: (err.stdout ?? "").toString().trim(),
          stderr: (err.stderr ?? "").toString().trim()
        };
      }
    }
    module2.exports = { execGit };
  }
});

// src/commands/state.js
var require_state = __commonJS({
  "src/commands/state.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { loadConfig } = require_config();
    var { safeReadFile, cachedReadFile, invalidateFileCache, normalizePhaseName, findPhaseInternal, getPhaseTree } = require_helpers();
    var { execGit } = require_git();
    var _fieldRegexCache = /* @__PURE__ */ new Map();
    function getFieldExtractRegex(fieldName) {
      const key = `extract:${fieldName}`;
      if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
      const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, "i");
      _fieldRegexCache.set(key, pattern);
      return pattern;
    }
    function getFieldReplaceRegex(fieldName) {
      const key = `replace:${fieldName}`;
      if (_fieldRegexCache.has(key)) return _fieldRegexCache.get(key);
      const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, "i");
      _fieldRegexCache.set(key, pattern);
      return pattern;
    }
    function cmdStateLoad(cwd, raw) {
      const config = loadConfig(cwd);
      const planningDir = path.join(cwd, ".planning");
      const stateContent = cachedReadFile(path.join(planningDir, "STATE.md"));
      const stateRaw = stateContent || "";
      const stateExists = stateRaw.length > 0;
      let configExists = false;
      let roadmapExists = false;
      try {
        fs.statSync(path.join(planningDir, "config.json"));
        configExists = true;
      } catch {
      }
      try {
        fs.statSync(path.join(planningDir, "ROADMAP.md"));
        roadmapExists = true;
      } catch {
      }
      const result = {
        config,
        state_raw: stateRaw,
        state_exists: stateExists,
        roadmap_exists: roadmapExists,
        config_exists: configExists
      };
      if (raw) {
        const c = config;
        const lines = [
          `model_profile=${c.model_profile}`,
          `commit_docs=${c.commit_docs}`,
          `branching_strategy=${c.branching_strategy}`,
          `phase_branch_template=${c.phase_branch_template}`,
          `milestone_branch_template=${c.milestone_branch_template}`,
          `parallelization=${c.parallelization}`,
          `research=${c.research}`,
          `plan_checker=${c.plan_checker}`,
          `verifier=${c.verifier}`,
          `config_exists=${configExists}`,
          `roadmap_exists=${roadmapExists}`,
          `state_exists=${stateExists}`
        ];
        process.stdout.write(lines.join("\n"));
        process.exit(0);
      }
      output(result);
    }
    function cmdStateGet(cwd, section, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      const content = cachedReadFile(statePath);
      if (!content) {
        error("STATE.md not found");
      }
      if (!section) {
        output({ content }, raw, content);
        return;
      }
      const fieldMatch = content.match(getFieldReplaceRegex(section));
      if (fieldMatch) {
        const val = fieldMatch[2].trim();
        output({ [section]: val }, raw, val);
        return;
      }
      const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*
([\\s\\S]*?)(?=\\n##|$)`, "i");
      const sectionMatch = content.match(sectionPattern);
      if (sectionMatch) {
        output({ [section]: sectionMatch[1].trim() }, raw, sectionMatch[1].trim());
        return;
      }
      output({ error: `Section or field "${section}" not found` }, raw, "");
    }
    function cmdStatePatch(cwd, patches, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        error("STATE.md not found");
      }
      const results = { updated: [], failed: [] };
      for (const [field, value] of Object.entries(patches)) {
        const pattern = getFieldReplaceRegex(field);
        if (pattern.test(content)) {
          content = content.replace(pattern, `$1${value}`);
          results.updated.push(field);
        } else {
          results.failed.push(field);
        }
      }
      if (results.updated.length > 0) {
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
      }
      output(results, raw, results.updated.length > 0 ? "true" : "false");
    }
    function cmdStateUpdate(cwd, field, value) {
      if (!field || value === void 0) {
        error("field and value required for state update");
      }
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ updated: false, reason: "STATE.md not found" });
        return;
      }
      const pattern = getFieldReplaceRegex(field);
      if (pattern.test(content)) {
        content = content.replace(pattern, `$1${value}`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ updated: true });
      } else {
        output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
      }
    }
    function stateExtractField(content, fieldName) {
      const pattern = getFieldExtractRegex(fieldName);
      const match = content.match(pattern);
      return match ? match[1].trim() : null;
    }
    function stateReplaceField(content, fieldName, newValue) {
      const pattern = getFieldReplaceRegex(fieldName);
      if (pattern.test(content)) {
        return content.replace(pattern, `$1${newValue}`);
      }
      return null;
    }
    function cmdStateAdvancePlan(cwd, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const currentPlan = parseInt(stateExtractField(content, "Current Plan"), 10);
      const totalPlans = parseInt(stateExtractField(content, "Total Plans in Phase"), 10);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (isNaN(currentPlan) || isNaN(totalPlans)) {
        output({ error: "Cannot parse Current Plan or Total Plans in Phase from STATE.md" }, raw);
        return;
      }
      if (currentPlan >= totalPlans) {
        content = stateReplaceField(content, "Status", "Phase complete \u2014 ready for verification") || content;
        content = stateReplaceField(content, "Last Activity", today) || content;
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ advanced: false, reason: "last_plan", current_plan: currentPlan, total_plans: totalPlans, status: "ready_for_verification" }, raw, "false");
      } else {
        const newPlan = currentPlan + 1;
        content = stateReplaceField(content, "Current Plan", String(newPlan)) || content;
        content = stateReplaceField(content, "Status", "Ready to execute") || content;
        content = stateReplaceField(content, "Last Activity", today) || content;
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans }, raw, "true");
      }
    }
    function cmdStateRecordMetric(cwd, options, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const { phase, plan, duration, tasks, files } = options;
      if (!phase || !plan || !duration) {
        output({ error: "phase, plan, and duration required" }, raw);
        return;
      }
      const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
      const metricsMatch = content.match(metricsPattern);
      if (metricsMatch) {
        const tableHeader = metricsMatch[1];
        let tableBody = metricsMatch[2].trimEnd();
        const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || "-"} tasks | ${files || "-"} files |`;
        if (tableBody.trim() === "" || tableBody.includes("None yet")) {
          tableBody = newRow;
        } else {
          tableBody = tableBody + "\n" + newRow;
        }
        content = content.replace(metricsPattern, `${tableHeader}${tableBody}
`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ recorded: true, phase, plan, duration }, raw, "true");
      } else {
        output({ recorded: false, reason: "Performance Metrics section not found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateUpdateProgress(cwd, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      let totalPlans = 0;
      let totalSummaries = 0;
      const phaseTree = getPhaseTree(cwd);
      for (const [, entry] of phaseTree) {
        totalPlans += entry.plans.length;
        totalSummaries += entry.summaries.length;
      }
      const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
      const barWidth = 10;
      const filled = Math.round(percent / 100 * barWidth);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
      const progressStr = `[${bar}] ${percent}%`;
      const progressPattern = /(\*\*Progress:\*\*\s*).*/i;
      if (progressPattern.test(content)) {
        content = content.replace(progressPattern, `$1${progressStr}`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, raw, progressStr);
      } else {
        output({ updated: false, reason: "Progress field not found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateAddDecision(cwd, options, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const { phase, summary, rationale } = options;
      if (!summary) {
        output({ error: "summary required" }, raw);
        return;
      }
      const entry = `- [Phase ${phase || "?"}]: ${summary}${rationale ? ` \u2014 ${rationale}` : ""}`;
      const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
      const match = content.match(sectionPattern);
      if (match) {
        let sectionBody = match[2];
        sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, "").replace(/No decisions yet\.?\s*\n?/gi, "");
        sectionBody = sectionBody.trimEnd() + "\n" + entry + "\n";
        content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ added: true, decision: entry }, raw, "true");
      } else {
        output({ added: false, reason: "Decisions section not found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateAddBlocker(cwd, text, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      if (!text) {
        output({ error: "text required" }, raw);
        return;
      }
      const entry = `- ${text}`;
      const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
      const match = content.match(sectionPattern);
      if (match) {
        let sectionBody = match[2];
        sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, "").replace(/None yet\.?\s*\n?/gi, "");
        sectionBody = sectionBody.trimEnd() + "\n" + entry + "\n";
        content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ added: true, blocker: text }, raw, "true");
      } else {
        output({ added: false, reason: "Blockers section not found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateResolveBlocker(cwd, text, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      if (!text) {
        output({ error: "text required" }, raw);
        return;
      }
      const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
      const match = content.match(sectionPattern);
      if (match) {
        const sectionBody = match[2];
        const lines = sectionBody.split("\n");
        const filtered = lines.filter((line) => {
          if (!line.startsWith("- ")) return true;
          return !line.toLowerCase().includes(text.toLowerCase());
        });
        let newBody = filtered.join("\n");
        if (!newBody.trim() || !newBody.includes("- ")) {
          newBody = "None\n";
        }
        content = content.replace(sectionPattern, `${match[1]}${newBody}`);
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ resolved: true, blocker: text }, raw, "true");
      } else {
        output({ resolved: false, reason: "Blockers section not found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateRecordSession(cwd, options, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      let content = cachedReadFile(statePath);
      if (!content) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updated = [];
      let result = stateReplaceField(content, "Last session", now);
      if (result) {
        content = result;
        updated.push("Last session");
      }
      result = stateReplaceField(content, "Last Date", now);
      if (result) {
        content = result;
        updated.push("Last Date");
      }
      if (options.stopped_at) {
        result = stateReplaceField(content, "Stopped At", options.stopped_at);
        if (!result) result = stateReplaceField(content, "Stopped at", options.stopped_at);
        if (result) {
          content = result;
          updated.push("Stopped At");
        }
      }
      const resumeFile = options.resume_file || "None";
      result = stateReplaceField(content, "Resume File", resumeFile);
      if (!result) result = stateReplaceField(content, "Resume file", resumeFile);
      if (result) {
        content = result;
        updated.push("Resume File");
      }
      if (updated.length > 0) {
        fs.writeFileSync(statePath, content, "utf-8");
        invalidateFileCache(statePath);
        output({ recorded: true, updated }, raw, "true");
      } else {
        output({ recorded: false, reason: "No session fields found in STATE.md" }, raw, "false");
      }
    }
    function cmdStateValidate(cwd, options, raw) {
      const planningDir = path.join(cwd, ".planning");
      const roadmapPath = path.join(planningDir, "ROADMAP.md");
      const statePath = path.join(planningDir, "STATE.md");
      const phasesDir = path.join(planningDir, "phases");
      const issues = [];
      const fixesApplied = [];
      const roadmapContent = safeReadFile(roadmapPath);
      const stateContent = safeReadFile(statePath);
      if (!roadmapContent && !stateContent) {
        output({
          status: "errors",
          issues: [{ type: "missing_files", location: ".planning/", expected: "ROADMAP.md and STATE.md", actual: "Neither found", severity: "error" }],
          fixes_applied: [],
          summary: "Found 1 error and 0 warnings"
        }, raw);
        return;
      }
      if (roadmapContent) {
        const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
        let phaseMatch;
        while ((phaseMatch = phasePattern.exec(roadmapContent)) !== null) {
          const phaseNum = phaseMatch[1];
          const normalized = normalizePhaseName(phaseNum);
          const sectionStart = phaseMatch.index;
          const restOfContent = roadmapContent.slice(sectionStart);
          const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
          const sectionEnd = nextHeader ? sectionStart + nextHeader.index : roadmapContent.length;
          const section = roadmapContent.slice(sectionStart, sectionEnd);
          const plansMatch = section.match(/\*\*Plans:?\*\*:?\s*(?:(\d+)\/)?(\d+)\s*plan/i);
          const claimedPlanCount = plansMatch ? parseInt(plansMatch[2], 10) : null;
          const claimedSummaryCount = plansMatch && plansMatch[1] ? parseInt(plansMatch[1], 10) : null;
          let diskPlanCount = 0;
          let diskSummaryCount = 0;
          let phaseDirName = null;
          const phaseTree = getPhaseTree(cwd);
          const cachedPhase = phaseTree.get(normalized);
          if (cachedPhase) {
            phaseDirName = cachedPhase.dirName;
            diskPlanCount = cachedPhase.plans.length;
            diskSummaryCount = cachedPhase.summaries.length;
          }
          if (claimedPlanCount !== null && claimedPlanCount !== diskPlanCount && phaseDirName) {
            issues.push({
              type: "plan_count_drift",
              location: `ROADMAP.md Phase ${phaseNum}`,
              expected: `${diskPlanCount} plans on disk`,
              actual: `ROADMAP claims ${claimedPlanCount} plans`,
              severity: "error"
            });
            if (options.fix) {
              try {
                let updatedRoadmap = safeReadFile(roadmapPath) || roadmapContent;
                const phaseEscaped = phaseNum.replace(/\./g, "\\.");
                const fixPattern = new RegExp(
                  `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)(?:\\d+\\/)?\\d+(\\s*plan)`,
                  "i"
                );
                const fixMatch = updatedRoadmap.match(fixPattern);
                if (fixMatch) {
                  const newText = claimedSummaryCount !== null ? `${fixMatch[1]}${diskSummaryCount}/${diskPlanCount}${fixMatch[2]}` : `${fixMatch[1]}${diskPlanCount}${fixMatch[2]}`;
                  updatedRoadmap = updatedRoadmap.replace(fixPattern, newText);
                  fs.writeFileSync(roadmapPath, updatedRoadmap, "utf-8");
                  execGit(cwd, ["add", roadmapPath]);
                  execGit(cwd, ["commit", "-m", `fix(state): correct phase ${phaseNum} plan count ${claimedPlanCount} \u2192 ${diskPlanCount}`]);
                  fixesApplied.push({
                    phase: phaseNum,
                    field: "plan_count",
                    old: String(claimedPlanCount),
                    new: String(diskPlanCount)
                  });
                }
              } catch (e) {
                debugLog("state.validate", "auto-fix failed for phase " + phaseNum, e);
              }
            }
          }
          if (phaseDirName && diskPlanCount > 0) {
            const checkboxPattern = new RegExp(`-\\s*\\[x\\]\\s*.*Phase\\s+${phaseNum.replace(/\./g, "\\.")}`, "i");
            const isMarkedComplete = checkboxPattern.test(roadmapContent);
            if (isMarkedComplete && diskSummaryCount < diskPlanCount) {
              issues.push({
                type: "completion_drift",
                location: `ROADMAP.md Phase ${phaseNum}`,
                expected: `${diskPlanCount} summaries for completion`,
                actual: `${diskSummaryCount} summaries on disk`,
                severity: "error"
              });
            }
          }
        }
      }
      if (stateContent) {
        const phaseFieldMatch = stateContent.match(/\*\*Phase:\*\*\s*(\d+(?:\.\d+)?)\s+of\s+(\d+)/i);
        if (phaseFieldMatch) {
          const currentPhaseNum = phaseFieldMatch[1];
          const phaseInfo = findPhaseInternal(cwd, currentPhaseNum);
          if (!phaseInfo) {
            issues.push({
              type: "position_missing",
              location: "STATE.md Phase field",
              expected: `Phase ${currentPhaseNum} directory exists`,
              actual: "Phase directory not found",
              severity: "error"
            });
          } else if (phaseInfo.plans.length > 0 && phaseInfo.summaries.length >= phaseInfo.plans.length) {
            issues.push({
              type: "position_completed",
              location: "STATE.md Phase field",
              expected: "Active phase with incomplete plans",
              actual: `Phase ${currentPhaseNum} is fully complete (${phaseInfo.summaries.length}/${phaseInfo.plans.length})`,
              severity: "warn"
            });
          }
        }
      }
      if (stateContent) {
        const activityMatch = stateContent.match(/\*\*Last Activity:\*\*\s*(\S+)/i);
        if (activityMatch) {
          const declaredDate = activityMatch[1];
          const declaredTime = new Date(declaredDate).getTime();
          const gitResult = execGit(cwd, ["log", "-1", "--format=%ci", "--", ".planning/"]);
          if (gitResult.exitCode === 0 && gitResult.stdout) {
            const gitDate = gitResult.stdout.split(" ")[0];
            const gitTime = new Date(gitDate).getTime();
            const dayMs = 24 * 60 * 60 * 1e3;
            if (!isNaN(declaredTime) && !isNaN(gitTime) && gitTime - declaredTime > dayMs) {
              issues.push({
                type: "activity_stale",
                location: "STATE.md Last Activity",
                expected: `Recent date near ${gitDate}`,
                actual: `Declared ${declaredDate}`,
                severity: "warn"
              });
            }
          }
        }
      }
      if (stateContent) {
        const config = loadConfig(cwd);
        const stalenessThreshold = config.staleness_threshold || 2;
        let totalCompletedPlans = 0;
        const phaseTreeForBlockers = getPhaseTree(cwd);
        for (const [, entry] of phaseTreeForBlockers) {
          totalCompletedPlans += entry.summaries.length;
        }
        const blockerSection = stateContent.match(/###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
        if (blockerSection) {
          const blockerBody = blockerSection[1].trim();
          if (blockerBody && !/^none\.?$/i.test(blockerBody) && !/^none yet\.?$/i.test(blockerBody)) {
            const blockerLines = blockerBody.split("\n").filter((l) => l.startsWith("- "));
            if (blockerLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
              for (const line of blockerLines) {
                issues.push({
                  type: "stale_blocker",
                  location: "STATE.md Blockers",
                  expected: `Resolved within ${stalenessThreshold} completed plans`,
                  actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
                  severity: "warn"
                });
              }
            }
          }
        }
        const todoSection = stateContent.match(/###?\s*(?:Pending Todos|Todos|Open Todos)\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
        if (todoSection) {
          const todoBody = todoSection[1].trim();
          if (todoBody && !/^none\.?$/i.test(todoBody) && !/^none yet\.?$/i.test(todoBody)) {
            const todoLines = todoBody.split("\n").filter((l) => l.startsWith("- "));
            if (todoLines.length > 0 && totalCompletedPlans >= stalenessThreshold) {
              for (const line of todoLines) {
                issues.push({
                  type: "stale_todo",
                  location: "STATE.md Pending Todos",
                  expected: `Resolved within ${stalenessThreshold} completed plans`,
                  actual: `"${line.slice(2).trim()}" still open after ${totalCompletedPlans} completed plans`,
                  severity: "warn"
                });
              }
            }
          }
        }
      }
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warnCount = issues.filter((i) => i.severity === "warn").length;
      let status = "clean";
      if (errorCount > 0) status = "errors";
      else if (warnCount > 0) status = "warnings";
      const summary = status === "clean" ? "State validation passed \u2014 no issues found" : `Found ${errorCount} error${errorCount !== 1 ? "s" : ""} and ${warnCount} warning${warnCount !== 1 ? "s" : ""}`;
      output({
        status,
        issues,
        fixes_applied: fixesApplied,
        summary
      }, raw);
    }
    module2.exports = {
      cmdStateLoad,
      cmdStateGet,
      cmdStatePatch,
      cmdStateUpdate,
      stateExtractField,
      stateReplaceField,
      cmdStateAdvancePlan,
      cmdStateRecordMetric,
      cmdStateUpdateProgress,
      cmdStateAddDecision,
      cmdStateAddBlocker,
      cmdStateResolveBlocker,
      cmdStateRecordSession,
      cmdStateValidate
    };
  }
});

// src/commands/roadmap.js
var require_roadmap = __commonJS({
  "src/commands/roadmap.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { normalizePhaseName, cachedReadFile, findPhaseInternal, getPhaseTree } = require_helpers();
    var { extractFrontmatter } = require_frontmatter();
    function cmdRoadmapGetPhase(cwd, phaseNum, raw) {
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      try {
        const content = cachedReadFile(roadmapPath);
        if (!content) {
          output({ found: false, error: "ROADMAP.md not found" }, raw, "");
          return;
        }
        const escapedPhase = phaseNum.replace(/\./g, "\\.");
        const phasePattern = new RegExp(
          `#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`,
          "i"
        );
        const headerMatch = content.match(phasePattern);
        if (!headerMatch) {
          const checklistPattern = new RegExp(
            `-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${escapedPhase}:\\s*([^*]+)\\*\\*`,
            "i"
          );
          const checklistMatch = content.match(checklistPattern);
          if (checklistMatch) {
            output({
              found: false,
              phase_number: phaseNum,
              phase_name: checklistMatch[1].trim(),
              error: "malformed_roadmap",
              message: `Phase ${phaseNum} exists in summary list but missing "### Phase ${phaseNum}:" detail section. ROADMAP.md needs both formats.`
            }, raw, "");
            return;
          }
          output({ found: false, phase_number: phaseNum }, raw, "");
          return;
        }
        const phaseName = headerMatch[1].trim();
        const headerIndex = headerMatch.index;
        const restOfContent = content.slice(headerIndex);
        const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
        const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
        const section = content.slice(headerIndex, sectionEnd).trim();
        const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
        const goal = goalMatch ? goalMatch[1].trim() : null;
        const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
        const success_criteria = criteriaMatch ? criteriaMatch[1].trim().split("\n").map((line) => line.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean) : [];
        output(
          {
            found: true,
            phase_number: phaseNum,
            phase_name: phaseName,
            goal,
            success_criteria,
            section
          },
          raw,
          section
        );
      } catch (e) {
        debugLog("roadmap.getPhase", "read roadmap failed", e);
        error("Failed to read ROADMAP.md: " + e.message);
      }
    }
    function cmdRoadmapAnalyze(cwd, raw) {
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const content = cachedReadFile(roadmapPath);
      if (!content) {
        output({ error: "ROADMAP.md not found", milestones: [], phases: [], current_phase: null }, raw);
        return;
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
      const phases = [];
      let match;
      while ((match = phasePattern.exec(content)) !== null) {
        const phaseNum = match[1];
        const phaseName = match[2].replace(/\(INSERTED\)/i, "").trim();
        const sectionStart = match.index;
        const restOfContent = content.slice(sectionStart);
        const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
        const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
        const section = content.slice(sectionStart, sectionEnd);
        const goalMatch = section.match(/\*\*Goal:?\*\*:?\s*([^\n]+)/i);
        const goal = goalMatch ? goalMatch[1].trim() : null;
        const dependsMatch = section.match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
        const depends_on = dependsMatch ? dependsMatch[1].trim() : null;
        const normalized = normalizePhaseName(phaseNum);
        let diskStatus = "no_directory";
        let planCount = 0;
        let summaryCount = 0;
        let hasContext = false;
        let hasResearch = false;
        const phaseTree = getPhaseTree(cwd);
        const cachedPhase = phaseTree.get(normalized);
        if (cachedPhase) {
          planCount = cachedPhase.plans.length;
          summaryCount = cachedPhase.summaries.length;
          hasContext = cachedPhase.hasContext;
          hasResearch = cachedPhase.hasResearch;
          if (summaryCount >= planCount && planCount > 0) diskStatus = "complete";
          else if (summaryCount > 0) diskStatus = "partial";
          else if (planCount > 0) diskStatus = "planned";
          else if (hasResearch) diskStatus = "researched";
          else if (hasContext) diskStatus = "discussed";
          else diskStatus = "empty";
        }
        const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${phaseNum.replace(".", "\\.")}`, "i");
        const checkboxMatch = content.match(checkboxPattern);
        const roadmapComplete = checkboxMatch ? checkboxMatch[1] === "x" : false;
        phases.push({
          number: phaseNum,
          name: phaseName,
          goal,
          depends_on,
          plan_count: planCount,
          summary_count: summaryCount,
          has_context: hasContext,
          has_research: hasResearch,
          disk_status: diskStatus,
          roadmap_complete: roadmapComplete
        });
      }
      const milestones = [];
      const milestonePattern = /[-*]\s*(?:✅|🔵)\s*\*\*v(\d+(?:\.\d+)*)\s+([^*]+)\*\*([^\n]*)/g;
      let mMatch;
      while ((mMatch = milestonePattern.exec(content)) !== null) {
        const isActive = mMatch[0].includes("\u{1F535}");
        milestones.push({
          heading: mMatch[2].trim(),
          version: "v" + mMatch[1],
          active: isActive
        });
      }
      const currentPhase = phases.find((p) => p.disk_status === "planned" || p.disk_status === "partial") || null;
      const nextPhase = phases.find((p) => p.disk_status === "empty" || p.disk_status === "no_directory" || p.disk_status === "discussed" || p.disk_status === "researched") || null;
      const totalPlans = phases.reduce((sum, p) => sum + p.plan_count, 0);
      const totalSummaries = phases.reduce((sum, p) => sum + p.summary_count, 0);
      const completedPhases = phases.filter((p) => p.disk_status === "complete").length;
      const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)/gi;
      const checklistPhases = /* @__PURE__ */ new Set();
      let checklistMatch;
      while ((checklistMatch = checklistPattern.exec(content)) !== null) {
        checklistPhases.add(checklistMatch[1]);
      }
      const detailPhases = new Set(phases.map((p) => p.number));
      const missingDetails = [...checklistPhases].filter((p) => !detailPhases.has(p));
      const result = {
        milestones,
        phases,
        phase_count: phases.length,
        completed_phases: completedPhases,
        total_plans: totalPlans,
        total_summaries: totalSummaries,
        progress_percent: phases.length > 0 ? Math.round(completedPhases / phases.length * 100) : 0,
        plan_progress_percent: totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0,
        current_phase: currentPhase ? currentPhase.number : null,
        next_phase: nextPhase ? nextPhase.number : null,
        missing_phase_details: missingDetails.length > 0 ? missingDetails : null
      };
      output(result, raw);
    }
    function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw) {
      if (!phaseNum) {
        error("phase number required for roadmap update-plan-progress");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const phaseInfo = findPhaseInternal(cwd, phaseNum);
      if (!phaseInfo) {
        error(`Phase ${phaseNum} not found`);
      }
      const planCount = phaseInfo.plans.length;
      const summaryCount = phaseInfo.summaries.length;
      if (planCount === 0) {
        output({ updated: false, reason: "No plans found", plan_count: 0, summary_count: 0 }, raw, "no plans");
        return;
      }
      const isComplete = summaryCount >= planCount;
      const status = isComplete ? "Complete" : summaryCount > 0 ? "In Progress" : "Planned";
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (!fs.existsSync(roadmapPath)) {
        output({ updated: false, reason: "ROADMAP.md not found", plan_count: planCount, summary_count: summaryCount }, raw, "no roadmap");
        return;
      }
      let roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
      const phaseEscaped = phaseNum.replace(".", "\\.");
      const tablePattern = new RegExp(
        `(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|)[^|]*(\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
        "i"
      );
      const dateField = isComplete ? ` ${today} ` : "  ";
      roadmapContent = roadmapContent.replace(
        tablePattern,
        `$1 ${summaryCount}/${planCount} $2 ${status.padEnd(11)}$3${dateField}$4`
      );
      const planCountPattern = new RegExp(
        `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)[^\\n]+`,
        "i"
      );
      const planCountText = isComplete ? `${summaryCount}/${planCount} plans complete` : `${summaryCount}/${planCount} plans executed`;
      roadmapContent = roadmapContent.replace(planCountPattern, `$1${planCountText}`);
      if (isComplete) {
        const checkboxPattern = new RegExp(
          `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
          "i"
        );
        roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);
      }
      fs.writeFileSync(roadmapPath, roadmapContent, "utf-8");
      output({
        updated: true,
        phase: phaseNum,
        plan_count: planCount,
        summary_count: summaryCount,
        status,
        complete: isComplete
      }, raw, `${summaryCount}/${planCount} ${status}`);
    }
    module2.exports = {
      cmdRoadmapGetPhase,
      cmdRoadmapAnalyze,
      cmdRoadmapUpdatePlanProgress
    };
  }
});

// src/commands/phase.js
var require_phase = __commonJS({
  "src/commands/phase.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { normalizePhaseName, getArchivedPhaseDirs, findPhaseInternal, generateSlugInternal, getMilestoneInfo } = require_helpers();
    var { extractFrontmatter } = require_frontmatter();
    var { execGit } = require_git();
    function cmdPhasesList(cwd, options, raw) {
      const phasesDir = path.join(cwd, ".planning", "phases");
      const { type, phase, includeArchived } = options;
      if (!fs.existsSync(phasesDir)) {
        if (type) {
          output({ files: [], count: 0 }, raw, "");
        } else {
          output({ directories: [], count: 0 }, raw, "");
        }
        return;
      }
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        let dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        if (includeArchived) {
          const archived = getArchivedPhaseDirs(cwd);
          for (const a of archived) {
            dirs.push(`${a.name} [${a.milestone}]`);
          }
        }
        dirs.sort((a, b) => {
          const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || "0");
          const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || "0");
          return aNum - bNum;
        });
        if (phase) {
          const normalized = normalizePhaseName(phase);
          const match = dirs.find((d) => d.startsWith(normalized));
          if (!match) {
            output({ files: [], count: 0, phase_dir: null, error: "Phase not found" }, raw, "");
            return;
          }
          dirs = [match];
        }
        if (type) {
          const files = [];
          for (const dir of dirs) {
            const dirPath = path.join(phasesDir, dir);
            const dirFiles = fs.readdirSync(dirPath);
            let filtered;
            if (type === "plans") {
              filtered = dirFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md");
            } else if (type === "summaries") {
              filtered = dirFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md");
            } else {
              filtered = dirFiles;
            }
            files.push(...filtered.sort());
          }
          const result = {
            files,
            count: files.length,
            phase_dir: phase ? dirs[0].replace(/^\d+(?:\.\d+)?-?/, "") : null
          };
          output(result, raw, files.join("\n"));
          return;
        }
        output({ directories: dirs, count: dirs.length }, raw, dirs.join("\n"));
      } catch (e) {
        debugLog("phase.list", "list phases failed", e);
        error("Failed to list phases: " + e.message);
      }
    }
    function cmdPhaseNextDecimal(cwd, basePhase, raw) {
      const phasesDir = path.join(cwd, ".planning", "phases");
      const normalized = normalizePhaseName(basePhase);
      if (!fs.existsSync(phasesDir)) {
        output(
          {
            found: false,
            base_phase: normalized,
            next: `${normalized}.1`,
            existing: []
          },
          raw,
          `${normalized}.1`
        );
        return;
      }
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        const baseExists = dirs.some((d) => d.startsWith(normalized + "-") || d === normalized);
        const decimalPattern = new RegExp(`^${normalized}\\.(\\d+)`);
        const existingDecimals = [];
        for (const dir of dirs) {
          const match = dir.match(decimalPattern);
          if (match) {
            existingDecimals.push(`${normalized}.${match[1]}`);
          }
        }
        existingDecimals.sort((a, b) => {
          const aNum = parseFloat(a);
          const bNum = parseFloat(b);
          return aNum - bNum;
        });
        let nextDecimal;
        if (existingDecimals.length === 0) {
          nextDecimal = `${normalized}.1`;
        } else {
          const lastDecimal = existingDecimals[existingDecimals.length - 1];
          const lastNum = parseInt(lastDecimal.split(".")[1], 10);
          nextDecimal = `${normalized}.${lastNum + 1}`;
        }
        output(
          {
            found: baseExists,
            base_phase: normalized,
            next: nextDecimal,
            existing: existingDecimals
          },
          raw,
          nextDecimal
        );
      } catch (e) {
        debugLog("phase.nextDecimal", "calculate next decimal failed", e);
        error("Failed to calculate next decimal phase: " + e.message);
      }
    }
    function cmdPhaseAdd(cwd, description, raw) {
      if (!description) {
        error("description required for phase add");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      if (!fs.existsSync(roadmapPath)) {
        error("ROADMAP.md not found");
      }
      const content = fs.readFileSync(roadmapPath, "utf-8");
      const slug = generateSlugInternal(description);
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)(?:\.\d+)?:/gi;
      let maxPhase = 0;
      let m;
      while ((m = phasePattern.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num > maxPhase) maxPhase = num;
      }
      const newPhaseNum = maxPhase + 1;
      const paddedNum = String(newPhaseNum).padStart(2, "0");
      const dirName = `${paddedNum}-${slug}`;
      const dirPath = path.join(cwd, ".planning", "phases", dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, ".gitkeep"), "");
      const phaseEntry = `
### Phase ${newPhaseNum}: ${description}

**Goal:** [To be planned]
**Depends on:** Phase ${maxPhase}
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase ${newPhaseNum} to break down)
`;
      let updatedContent;
      const lastSeparator = content.lastIndexOf("\n---");
      if (lastSeparator > 0) {
        updatedContent = content.slice(0, lastSeparator) + phaseEntry + content.slice(lastSeparator);
      } else {
        updatedContent = content + phaseEntry;
      }
      fs.writeFileSync(roadmapPath, updatedContent, "utf-8");
      const result = {
        phase_number: newPhaseNum,
        padded: paddedNum,
        name: description,
        slug,
        directory: `.planning/phases/${dirName}`
      };
      output(result, raw, paddedNum);
    }
    function cmdPhaseInsert(cwd, afterPhase, description, raw) {
      if (!afterPhase || !description) {
        error("after-phase and description required for phase insert");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      if (!fs.existsSync(roadmapPath)) {
        error("ROADMAP.md not found");
      }
      const content = fs.readFileSync(roadmapPath, "utf-8");
      const slug = generateSlugInternal(description);
      const normalizedAfter = normalizePhaseName(afterPhase);
      const unpadded = normalizedAfter.replace(/^0+/, "");
      const afterPhaseEscaped = unpadded.replace(/\./g, "\\.");
      const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, "i");
      if (!targetPattern.test(content)) {
        error(`Phase ${afterPhase} not found in ROADMAP.md`);
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const normalizedBase = normalizePhaseName(afterPhase);
      let existingDecimals = [];
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        const decimalPattern = new RegExp(`^${normalizedBase}\\.(\\d+)`);
        for (const dir of dirs) {
          const dm = dir.match(decimalPattern);
          if (dm) existingDecimals.push(parseInt(dm[1], 10));
        }
      } catch (e) {
        debugLog("phase.insert", "readdir failed", e);
      }
      const nextDecimal = existingDecimals.length === 0 ? 1 : Math.max(...existingDecimals) + 1;
      const decimalPhase = `${normalizedBase}.${nextDecimal}`;
      const dirName = `${decimalPhase}-${slug}`;
      const dirPath = path.join(cwd, ".planning", "phases", dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, ".gitkeep"), "");
      const phaseEntry = `
### Phase ${decimalPhase}: ${description} (INSERTED)

**Goal:** [Urgent work - to be planned]
**Depends on:** Phase ${afterPhase}
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase ${decimalPhase} to break down)
`;
      const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, "i");
      const headerMatch = content.match(headerPattern);
      if (!headerMatch) {
        error(`Could not find Phase ${afterPhase} header`);
      }
      const headerIdx = content.indexOf(headerMatch[0]);
      const afterHeader = content.slice(headerIdx + headerMatch[0].length);
      const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);
      let insertIdx;
      if (nextPhaseMatch) {
        insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
      } else {
        insertIdx = content.length;
      }
      const updatedContent = content.slice(0, insertIdx) + phaseEntry + content.slice(insertIdx);
      fs.writeFileSync(roadmapPath, updatedContent, "utf-8");
      const result = {
        phase_number: decimalPhase,
        after_phase: afterPhase,
        name: description,
        slug,
        directory: `.planning/phases/${dirName}`
      };
      output(result, raw, decimalPhase);
    }
    function cmdPhaseRemove(cwd, targetPhase, options, raw) {
      if (!targetPhase) {
        error("phase number required for phase remove");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const phasesDir = path.join(cwd, ".planning", "phases");
      const force = options.force || false;
      if (!fs.existsSync(roadmapPath)) {
        error("ROADMAP.md not found");
      }
      const normalized = normalizePhaseName(targetPhase);
      const isDecimal = targetPhase.includes(".");
      let targetDir = null;
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        targetDir = dirs.find((d) => d.startsWith(normalized + "-") || d === normalized);
      } catch (e) {
        debugLog("phase.remove", "readdir failed", e);
      }
      if (targetDir && !force) {
        const targetPath = path.join(phasesDir, targetDir);
        const files = fs.readdirSync(targetPath);
        const summaries = files.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md");
        if (summaries.length > 0) {
          error(`Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`);
        }
      }
      if (targetDir) {
        fs.rmSync(path.join(phasesDir, targetDir), { recursive: true, force: true });
      }
      const renamedDirs = [];
      const renamedFiles = [];
      if (isDecimal) {
        const baseParts = normalized.split(".");
        const baseInt = baseParts[0];
        const removedDecimal = parseInt(baseParts[1], 10);
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          const decPattern = new RegExp(`^${baseInt}\\.(\\d+)-(.+)$`);
          const toRename = [];
          for (const dir of dirs) {
            const dm = dir.match(decPattern);
            if (dm && parseInt(dm[1], 10) > removedDecimal) {
              toRename.push({ dir, oldDecimal: parseInt(dm[1], 10), slug: dm[2] });
            }
          }
          toRename.sort((a, b) => b.oldDecimal - a.oldDecimal);
          for (const item of toRename) {
            const newDecimal = item.oldDecimal - 1;
            const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
            const newPhaseId = `${baseInt}.${newDecimal}`;
            const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;
            fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
            renamedDirs.push({ from: item.dir, to: newDirName });
            const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
            for (const f of dirFiles) {
              if (f.includes(oldPhaseId)) {
                const newFileName = f.replace(oldPhaseId, newPhaseId);
                fs.renameSync(
                  path.join(phasesDir, newDirName, f),
                  path.join(phasesDir, newDirName, newFileName)
                );
                renamedFiles.push({ from: f, to: newFileName });
              }
            }
          }
        } catch (e) {
          debugLog("phase.remove", "rename failed", e);
        }
      } else {
        const removedInt = parseInt(normalized, 10);
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          const toRename = [];
          for (const dir of dirs) {
            const dm = dir.match(/^(\d+)(?:\.(\d+))?-(.+)$/);
            if (!dm) continue;
            const dirInt = parseInt(dm[1], 10);
            if (dirInt > removedInt) {
              toRename.push({
                dir,
                oldInt: dirInt,
                decimal: dm[2] ? parseInt(dm[2], 10) : null,
                slug: dm[3]
              });
            }
          }
          toRename.sort((a, b) => {
            if (a.oldInt !== b.oldInt) return b.oldInt - a.oldInt;
            return (b.decimal || 0) - (a.decimal || 0);
          });
          for (const item of toRename) {
            const newInt = item.oldInt - 1;
            const newPadded = String(newInt).padStart(2, "0");
            const oldPadded = String(item.oldInt).padStart(2, "0");
            const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : "";
            const oldPrefix = `${oldPadded}${decimalSuffix}`;
            const newPrefix = `${newPadded}${decimalSuffix}`;
            const newDirName = `${newPrefix}-${item.slug}`;
            fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
            renamedDirs.push({ from: item.dir, to: newDirName });
            const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
            for (const f of dirFiles) {
              if (f.startsWith(oldPrefix)) {
                const newFileName = newPrefix + f.slice(oldPrefix.length);
                fs.renameSync(
                  path.join(phasesDir, newDirName, f),
                  path.join(phasesDir, newDirName, newFileName)
                );
                renamedFiles.push({ from: f, to: newFileName });
              }
            }
          }
        } catch (e) {
          debugLog("phase.remove", "rename failed", e);
        }
      }
      let roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
      const targetEscaped = targetPhase.replace(/\./g, "\\.");
      const sectionPattern = new RegExp(
        `\\n?#{2,4}\\s*Phase\\s+${targetEscaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`,
        "i"
      );
      roadmapContent = roadmapContent.replace(sectionPattern, "");
      const checkboxPattern = new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${targetEscaped}[:\\s][^\\n]*`, "gi");
      roadmapContent = roadmapContent.replace(checkboxPattern, "");
      const tableRowPattern = new RegExp(`\\n?\\|\\s*${targetEscaped}\\.?\\s[^|]*\\|[^\\n]*`, "gi");
      roadmapContent = roadmapContent.replace(tableRowPattern, "");
      if (!isDecimal) {
        const removedInt = parseInt(normalized, 10);
        const maxPhase = 99;
        for (let oldNum = maxPhase; oldNum > removedInt; oldNum--) {
          const newNum = oldNum - 1;
          const oldStr = String(oldNum);
          const newStr = String(newNum);
          const oldPad = oldStr.padStart(2, "0");
          const newPad = newStr.padStart(2, "0");
          roadmapContent = roadmapContent.replace(
            new RegExp(`(#{2,4}\\s*Phase\\s+)${oldStr}(\\s*:)`, "gi"),
            `$1${newStr}$2`
          );
          roadmapContent = roadmapContent.replace(
            new RegExp(`(Phase\\s+)${oldStr}([:\\s])`, "g"),
            `$1${newStr}$2`
          );
          roadmapContent = roadmapContent.replace(
            new RegExp(`${oldPad}-(\\d{2})`, "g"),
            `${newPad}-$1`
          );
          roadmapContent = roadmapContent.replace(
            new RegExp(`(\\|\\s*)${oldStr}\\.\\s`, "g"),
            `$1${newStr}. `
          );
          roadmapContent = roadmapContent.replace(
            new RegExp(`(Depends on:?\\*\\*:?\\s*Phase\\s+)${oldStr}\\b`, "gi"),
            `$1${newStr}`
          );
        }
      }
      fs.writeFileSync(roadmapPath, roadmapContent, "utf-8");
      const statePath = path.join(cwd, ".planning", "STATE.md");
      if (fs.existsSync(statePath)) {
        let stateContent = fs.readFileSync(statePath, "utf-8");
        const totalPattern = /(\*\*Total Phases:\*\*\s*)(\d+)/;
        const totalMatch = stateContent.match(totalPattern);
        if (totalMatch) {
          const oldTotal = parseInt(totalMatch[2], 10);
          stateContent = stateContent.replace(totalPattern, `$1${oldTotal - 1}`);
        }
        const ofPattern = /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i;
        const ofMatch = stateContent.match(ofPattern);
        if (ofMatch) {
          const oldTotal = parseInt(ofMatch[2], 10);
          stateContent = stateContent.replace(ofPattern, `$1${oldTotal - 1}$3`);
        }
        fs.writeFileSync(statePath, stateContent, "utf-8");
      }
      const result = {
        removed: targetPhase,
        directory_deleted: targetDir || null,
        renamed_directories: renamedDirs,
        renamed_files: renamedFiles,
        roadmap_updated: true,
        state_updated: fs.existsSync(statePath)
      };
      output(result, raw);
    }
    function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
      if (!reqIdsRaw || reqIdsRaw.length === 0) {
        error("requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02");
      }
      const reqIds = reqIdsRaw.join(" ").replace(/[\[\]]/g, "").split(/[,\s]+/).map((r) => r.trim()).filter(Boolean);
      if (reqIds.length === 0) {
        error("no valid requirement IDs found");
      }
      const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
      if (!fs.existsSync(reqPath)) {
        output({ updated: false, reason: "REQUIREMENTS.md not found", ids: reqIds }, raw, "no requirements file");
        return;
      }
      let reqContent = fs.readFileSync(reqPath, "utf-8");
      const updated = [];
      const notFound = [];
      for (const reqId of reqIds) {
        let found = false;
        const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, "gi");
        if (checkboxPattern.test(reqContent)) {
          reqContent = reqContent.replace(checkboxPattern, "$1x$2");
          found = true;
        }
        const tablePattern = new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, "gi");
        if (tablePattern.test(reqContent)) {
          reqContent = reqContent.replace(
            new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, "gi"),
            "$1 Complete $2"
          );
          found = true;
        }
        if (found) {
          updated.push(reqId);
        } else {
          notFound.push(reqId);
        }
      }
      if (updated.length > 0) {
        fs.writeFileSync(reqPath, reqContent, "utf-8");
      }
      output({
        updated: updated.length > 0,
        marked_complete: updated,
        not_found: notFound,
        total: reqIds.length
      }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
    }
    function cmdPhaseComplete(cwd, phaseNum, raw) {
      if (!phaseNum) {
        error("phase number required for phase complete");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const statePath = path.join(cwd, ".planning", "STATE.md");
      const phasesDir = path.join(cwd, ".planning", "phases");
      const normalized = normalizePhaseName(phaseNum);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const phaseInfo = findPhaseInternal(cwd, phaseNum);
      if (!phaseInfo) {
        error(`Phase ${phaseNum} not found`);
      }
      const planCount = phaseInfo.plans.length;
      const summaryCount = phaseInfo.summaries.length;
      if (fs.existsSync(roadmapPath)) {
        let roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
        const checkboxPattern = new RegExp(
          `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseNum.replace(".", "\\.")}[:\\s][^\\n]*)`,
          "i"
        );
        roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);
        const phaseEscaped = phaseNum.replace(".", "\\.");
        const tablePattern = new RegExp(
          `(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|[^|]*\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
          "i"
        );
        roadmapContent = roadmapContent.replace(
          tablePattern,
          `$1 Complete    $2 ${today} $3`
        );
        const planCountPattern = new RegExp(
          `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:?\\*\\*:?\\s*)[^\\n]+`,
          "i"
        );
        roadmapContent = roadmapContent.replace(
          planCountPattern,
          `$1${summaryCount}/${planCount} plans complete`
        );
        fs.writeFileSync(roadmapPath, roadmapContent, "utf-8");
        const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
        if (fs.existsSync(reqPath)) {
          const reqMatch = roadmapContent.match(
            new RegExp(`Phase\\s+${phaseNum.replace(".", "\\.")}[\\s\\S]*?\\*\\*Requirements:?\\*\\*:?\\s*([^\\n]+)`, "i")
          );
          if (reqMatch) {
            const reqIds = reqMatch[1].replace(/[\[\]]/g, "").split(/[,\s]+/).map((r) => r.trim()).filter(Boolean);
            let reqContent = fs.readFileSync(reqPath, "utf-8");
            for (const reqId of reqIds) {
              reqContent = reqContent.replace(
                new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, "gi"),
                "$1x$2"
              );
              reqContent = reqContent.replace(
                new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, "gi"),
                "$1 Complete $2"
              );
            }
            fs.writeFileSync(reqPath, reqContent, "utf-8");
          }
        }
      }
      let nextPhaseNum = null;
      let nextPhaseName = null;
      let isLastPhase = true;
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        const currentFloat = parseFloat(phaseNum);
        for (const dir of dirs) {
          const dm = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
          if (dm) {
            const dirFloat = parseFloat(dm[1]);
            if (dirFloat > currentFloat) {
              nextPhaseNum = dm[1];
              nextPhaseName = dm[2] || null;
              isLastPhase = false;
              break;
            }
          }
        }
      } catch (e) {
        debugLog("phase.complete", "find next phase failed", e);
      }
      if (fs.existsSync(statePath)) {
        let stateContent = fs.readFileSync(statePath, "utf-8");
        stateContent = stateContent.replace(
          /(\*\*Current Phase:\*\*\s*).*/,
          `$1${nextPhaseNum || phaseNum}`
        );
        if (nextPhaseName) {
          stateContent = stateContent.replace(
            /(\*\*Current Phase Name:\*\*\s*).*/,
            `$1${nextPhaseName.replace(/-/g, " ")}`
          );
        }
        stateContent = stateContent.replace(
          /(\*\*Status:\*\*\s*).*/,
          `$1${isLastPhase ? "Milestone complete" : "Ready to plan"}`
        );
        stateContent = stateContent.replace(
          /(\*\*Current Plan:\*\*\s*).*/,
          `$1Not started`
        );
        stateContent = stateContent.replace(
          /(\*\*Last Activity:\*\*\s*).*/,
          `$1${today}`
        );
        stateContent = stateContent.replace(
          /(\*\*Last Activity Description:\*\*\s*).*/,
          `$1Phase ${phaseNum} complete${nextPhaseNum ? `, transitioned to Phase ${nextPhaseNum}` : ""}`
        );
        fs.writeFileSync(statePath, stateContent, "utf-8");
      }
      const result = {
        completed_phase: phaseNum,
        phase_name: phaseInfo.phase_name,
        plans_executed: `${summaryCount}/${planCount}`,
        next_phase: nextPhaseNum,
        next_phase_name: nextPhaseName,
        is_last_phase: isLastPhase,
        date: today,
        roadmap_updated: fs.existsSync(roadmapPath),
        state_updated: fs.existsSync(statePath)
      };
      output(result, raw);
    }
    function cmdMilestoneComplete(cwd, version, options, raw) {
      if (!version) {
        error("version required for milestone complete (e.g., v1.0)");
      }
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
      const statePath = path.join(cwd, ".planning", "STATE.md");
      const milestonesPath = path.join(cwd, ".planning", "MILESTONES.md");
      const archiveDir = path.join(cwd, ".planning", "milestones");
      const phasesDir = path.join(cwd, ".planning", "phases");
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const milestoneName = options.name || version;
      fs.mkdirSync(archiveDir, { recursive: true });
      let phaseCount = 0;
      let totalPlans = 0;
      let totalTasks = 0;
      const accomplishments = [];
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        for (const dir of dirs) {
          phaseCount++;
          const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
          const plans = phaseFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md");
          const summaries = phaseFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md");
          totalPlans += plans.length;
          for (const s of summaries) {
            try {
              const content = fs.readFileSync(path.join(phasesDir, dir, s), "utf-8");
              const fm = extractFrontmatter(content);
              if (fm["one-liner"]) {
                accomplishments.push(fm["one-liner"]);
              }
              const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
              totalTasks += taskMatches.length;
            } catch (e) {
              debugLog("milestone.complete", "frontmatter extraction failed", e);
            }
          }
        }
      } catch (e) {
        debugLog("milestone.complete", "frontmatter extraction failed", e);
      }
      if (fs.existsSync(roadmapPath)) {
        const roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
        fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, "utf-8");
      }
      if (fs.existsSync(reqPath)) {
        const reqContent = fs.readFileSync(reqPath, "utf-8");
        const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}

**Archived:** ${today}
**Status:** SHIPPED

For current requirements, see \`.planning/REQUIREMENTS.md\`.

---

`;
        fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, "utf-8");
      }
      const auditFile = path.join(cwd, ".planning", `${version}-MILESTONE-AUDIT.md`);
      if (fs.existsSync(auditFile)) {
        fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
      }
      const accomplishmentsList = accomplishments.map((a) => `- ${a}`).join("\n");
      const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})

**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks

**Key accomplishments:**
${accomplishmentsList || "- (none recorded)"}

---

`;
      if (fs.existsSync(milestonesPath)) {
        const existing = fs.readFileSync(milestonesPath, "utf-8");
        fs.writeFileSync(milestonesPath, existing + "\n" + milestoneEntry, "utf-8");
      } else {
        fs.writeFileSync(milestonesPath, `# Milestones

${milestoneEntry}`, "utf-8");
      }
      if (fs.existsSync(statePath)) {
        let stateContent = fs.readFileSync(statePath, "utf-8");
        stateContent = stateContent.replace(
          /(\*\*Status:\*\*\s*).*/,
          `$1${version} milestone complete`
        );
        stateContent = stateContent.replace(
          /(\*\*Last Activity:\*\*\s*).*/,
          `$1${today}`
        );
        stateContent = stateContent.replace(
          /(\*\*Last Activity Description:\*\*\s*).*/,
          `$1${version} milestone completed and archived`
        );
        fs.writeFileSync(statePath, stateContent, "utf-8");
      }
      let phasesArchived = false;
      try {
        const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
        fs.mkdirSync(phaseArchiveDir, { recursive: true });
        const milestone = getMilestoneInfo(cwd);
        const phaseRange = milestone.phaseRange;
        const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const phaseDirNames = phaseEntries.filter((e) => e.isDirectory()).map((e) => e.name);
        for (const dir of phaseDirNames) {
          if (phaseRange) {
            const dirMatch = dir.match(/^(\d+)/);
            if (dirMatch) {
              const num = parseInt(dirMatch[1]);
              if (num < phaseRange.start || num > phaseRange.end) continue;
            }
          } else if (!options.archivePhases) {
            continue;
          }
          fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
        }
        const archivedEntries = fs.readdirSync(phaseArchiveDir);
        phasesArchived = archivedEntries.length > 0;
      } catch (e) {
        debugLog("milestone.complete", "readdir failed", e);
      }
      const result = {
        version,
        name: milestoneName,
        date: today,
        phases: phaseCount,
        plans: totalPlans,
        tasks: totalTasks,
        accomplishments,
        archived: {
          roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
          requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
          audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
          phases: phasesArchived
        },
        milestones_updated: true,
        state_updated: fs.existsSync(statePath)
      };
      output(result, raw);
    }
    module2.exports = {
      cmdPhasesList,
      cmdPhaseNextDecimal,
      cmdPhaseAdd,
      cmdPhaseInsert,
      cmdPhaseRemove,
      cmdRequirementsMarkComplete,
      cmdPhaseComplete,
      cmdMilestoneComplete
    };
  }
});

// src/commands/verify.js
var require_verify = __commonJS({
  "src/commands/verify.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { safeReadFile, cachedReadFile, findPhaseInternal, normalizePhaseName, parseMustHavesBlock, getArchivedPhaseDirs, getMilestoneInfo, getPhaseTree } = require_helpers();
    var { extractFrontmatter } = require_frontmatter();
    var { execGit } = require_git();
    function cmdVerifyPlanStructure(cwd, filePath, raw) {
      if (!filePath) {
        error("file path required");
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const fm = extractFrontmatter(content);
      const errors = [];
      const warnings = [];
      const required = ["phase", "plan", "type", "wave", "depends_on", "files_modified", "autonomous", "must_haves"];
      for (const field of required) {
        if (fm[field] === void 0) errors.push(`Missing required frontmatter field: ${field}`);
      }
      const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
      const tasks = [];
      let taskMatch;
      while ((taskMatch = taskPattern.exec(content)) !== null) {
        const taskContent = taskMatch[1];
        const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
        const taskName = nameMatch ? nameMatch[1].trim() : "unnamed";
        const hasFiles = /<files>/.test(taskContent);
        const hasAction = /<action>/.test(taskContent);
        const hasVerify = /<verify>/.test(taskContent);
        const hasDone = /<done>/.test(taskContent);
        if (!nameMatch) errors.push("Task missing <name> element");
        if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
        if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
        if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
        if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);
        tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
      }
      if (tasks.length === 0) warnings.push("No <task> elements found");
      if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || Array.isArray(fm.depends_on) && fm.depends_on.length === 0)) {
        warnings.push("Wave > 1 but depends_on is empty");
      }
      const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
      if (hasCheckpoints && fm.autonomous !== "false" && fm.autonomous !== false) {
        errors.push("Has checkpoint tasks but autonomous is not false");
      }
      const templateCompliance = { valid: true, missing_fields: [], type_issues: [] };
      const planType = fm.type || "execute";
      const typeRequiredFields = {
        execute: ["wave", "depends_on", "files_modified", "autonomous", "requirements", "must_haves"],
        tdd: ["wave", "depends_on", "files_modified", "autonomous", "requirements"]
      };
      const requiredForType = typeRequiredFields[planType] || typeRequiredFields.execute;
      for (const field of requiredForType) {
        if (fm[field] === void 0) {
          templateCompliance.missing_fields.push(field);
        }
      }
      if (fm.requirements !== void 0) {
        const reqEmpty = Array.isArray(fm.requirements) && fm.requirements.length === 0 || typeof fm.requirements === "string" && fm.requirements.trim() === "" || typeof fm.requirements === "object" && !Array.isArray(fm.requirements) && Object.keys(fm.requirements).length === 0;
        if (reqEmpty) {
          templateCompliance.type_issues.push("requirements is empty \u2014 every plan should map to requirements");
        }
      }
      if (planType === "tdd") {
        if (!/<feature>/.test(content)) {
          templateCompliance.type_issues.push("TDD plan missing <feature> block");
        }
      }
      for (const task of tasks) {
        if (!task.hasAction) templateCompliance.type_issues.push(`Task '${task.name}' missing <action>`);
        if (!task.hasVerify) templateCompliance.type_issues.push(`Task '${task.name}' missing <verify>`);
        if (!task.hasDone) templateCompliance.type_issues.push(`Task '${task.name}' missing <done>`);
      }
      if (templateCompliance.missing_fields.length > 0 || templateCompliance.type_issues.length > 0) {
        templateCompliance.valid = false;
      }
      output({
        valid: errors.length === 0,
        errors,
        warnings,
        task_count: tasks.length,
        tasks,
        frontmatter_fields: Object.keys(fm),
        template_compliance: templateCompliance
      }, raw, errors.length === 0 ? "valid" : "invalid");
    }
    function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
      if (!phase) {
        error("phase required");
      }
      const phaseInfo = findPhaseInternal(cwd, phase);
      if (!phaseInfo || !phaseInfo.found) {
        output({ error: "Phase not found", phase }, raw);
        return;
      }
      const errors = [];
      const warnings = [];
      const phaseDir = path.join(cwd, phaseInfo.directory);
      let files;
      try {
        files = fs.readdirSync(phaseDir);
      } catch (e) {
        debugLog("verify.phaseComplete", "readdir phase failed", e);
        output({ error: "Cannot read phase directory" }, raw);
        return;
      }
      const plans = files.filter((f) => f.match(/-PLAN\.md$/i));
      const summaries = files.filter((f) => f.match(/-SUMMARY\.md$/i));
      const planIds = new Set(plans.map((p) => p.replace(/-PLAN\.md$/i, "")));
      const summaryIds = new Set(summaries.map((s) => s.replace(/-SUMMARY\.md$/i, "")));
      const incompletePlans = [...planIds].filter((id) => !summaryIds.has(id));
      if (incompletePlans.length > 0) {
        errors.push(`Plans without summaries: ${incompletePlans.join(", ")}`);
      }
      const orphanSummaries = [...summaryIds].filter((id) => !planIds.has(id));
      if (orphanSummaries.length > 0) {
        warnings.push(`Summaries without plans: ${orphanSummaries.join(", ")}`);
      }
      output({
        complete: errors.length === 0,
        phase: phaseInfo.phase_number,
        plan_count: plans.length,
        summary_count: summaries.length,
        incomplete_plans: incompletePlans,
        orphan_summaries: orphanSummaries,
        errors,
        warnings
      }, raw, errors.length === 0 ? "complete" : "incomplete");
    }
    function cmdVerifyReferences(cwd, filePath, raw) {
      if (!filePath) {
        error("file path required");
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const found = [];
      const missing = [];
      const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
      for (const ref of atRefs) {
        const cleanRef = ref.slice(1);
        const resolved = cleanRef.startsWith("~/") ? path.join(process.env.HOME || "", cleanRef.slice(2)) : path.join(cwd, cleanRef);
        if (fs.existsSync(resolved)) {
          found.push(cleanRef);
        } else {
          missing.push(cleanRef);
        }
      }
      const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
      for (const ref of backtickRefs) {
        const cleanRef = ref.slice(1, -1);
        if (cleanRef.startsWith("http") || cleanRef.includes("${") || cleanRef.includes("{{")) continue;
        if (found.includes(cleanRef) || missing.includes(cleanRef)) continue;
        const resolved = path.join(cwd, cleanRef);
        if (fs.existsSync(resolved)) {
          found.push(cleanRef);
        } else {
          missing.push(cleanRef);
        }
      }
      output({
        valid: missing.length === 0,
        found: found.length,
        missing,
        total: found.length + missing.length
      }, raw, missing.length === 0 ? "valid" : "invalid");
    }
    function cmdVerifyCommits(cwd, hashes, raw) {
      if (!hashes || hashes.length === 0) {
        error("At least one commit hash required");
      }
      const valid = [];
      const invalid = [];
      for (const hash of hashes) {
        const result = execGit(cwd, ["cat-file", "-t", hash]);
        if (result.exitCode === 0 && result.stdout.trim() === "commit") {
          valid.push(hash);
        } else {
          invalid.push(hash);
        }
      }
      output({
        all_valid: invalid.length === 0,
        valid,
        invalid,
        total: hashes.length
      }, raw, invalid.length === 0 ? "valid" : "invalid");
    }
    function cmdVerifyArtifacts(cwd, planFilePath, raw) {
      if (!planFilePath) {
        error("plan file path required");
      }
      const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: planFilePath }, raw);
        return;
      }
      const artifacts = parseMustHavesBlock(content, "artifacts");
      if (artifacts.length === 0) {
        output({ error: "No must_haves.artifacts found in frontmatter", path: planFilePath }, raw);
        return;
      }
      const results = [];
      for (const artifact of artifacts) {
        if (typeof artifact === "string") continue;
        const artPath = artifact.path;
        if (!artPath) continue;
        const artFullPath = path.join(cwd, artPath);
        const exists = fs.existsSync(artFullPath);
        const check = { path: artPath, exists, issues: [], passed: false };
        if (exists) {
          const fileContent = safeReadFile(artFullPath) || "";
          const lineCount = fileContent.split("\n").length;
          if (artifact.min_lines && lineCount < artifact.min_lines) {
            check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
          }
          if (artifact.contains && !fileContent.includes(artifact.contains)) {
            check.issues.push(`Missing pattern: ${artifact.contains}`);
          }
          if (artifact.exports) {
            const exports3 = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
            for (const exp of exports3) {
              if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
            }
          }
          check.passed = check.issues.length === 0;
        } else {
          check.issues.push("File not found");
        }
        results.push(check);
      }
      const passed = results.filter((r) => r.passed).length;
      output({
        all_passed: passed === results.length,
        passed,
        total: results.length,
        artifacts: results
      }, raw, passed === results.length ? "valid" : "invalid");
    }
    function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
      if (!planFilePath) {
        error("plan file path required");
      }
      const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: planFilePath }, raw);
        return;
      }
      const keyLinks = parseMustHavesBlock(content, "key_links");
      if (keyLinks.length === 0) {
        output({ error: "No must_haves.key_links found in frontmatter", path: planFilePath }, raw);
        return;
      }
      const results = [];
      for (const link of keyLinks) {
        if (typeof link === "string") continue;
        const check = { from: link.from, to: link.to, via: link.via || "", verified: false, detail: "" };
        const sourceContent = safeReadFile(path.join(cwd, link.from || ""));
        if (!sourceContent) {
          check.detail = "Source file not found";
        } else if (link.pattern) {
          try {
            const regex = new RegExp(link.pattern);
            if (regex.test(sourceContent)) {
              check.verified = true;
              check.detail = "Pattern found in source";
            } else {
              const targetContent = safeReadFile(path.join(cwd, link.to || ""));
              if (targetContent && regex.test(targetContent)) {
                check.verified = true;
                check.detail = "Pattern found in target";
              } else {
                check.detail = `Pattern "${link.pattern}" not found in source or target`;
              }
            }
          } catch (e) {
            debugLog("verify.keyLinks", "read failed", e);
            check.detail = `Invalid regex pattern: ${link.pattern}`;
          }
        } else {
          if (sourceContent.includes(link.to || "")) {
            check.verified = true;
            check.detail = "Target referenced in source";
          } else {
            check.detail = "Target not referenced in source";
          }
        }
        results.push(check);
      }
      const verified = results.filter((r) => r.verified).length;
      output({
        all_verified: verified === results.length,
        verified,
        total: results.length,
        links: results
      }, raw, verified === results.length ? "valid" : "invalid");
    }
    function cmdValidateConsistency(cwd, raw) {
      const roadmapPath = path.join(cwd, ".planning", "ROADMAP.md");
      const errors = [];
      const warnings = [];
      const roadmapContent = cachedReadFile(roadmapPath);
      if (!roadmapContent) {
        errors.push("ROADMAP.md not found");
        output({ passed: false, errors, warnings }, raw, "failed");
        return;
      }
      const roadmapPhases = /* @__PURE__ */ new Set();
      const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
      let m;
      while ((m = phasePattern.exec(roadmapContent)) !== null) {
        roadmapPhases.add(m[1]);
      }
      const phaseTree = getPhaseTree(cwd);
      const diskPhases = /* @__PURE__ */ new Set();
      for (const [, entry] of phaseTree) {
        diskPhases.add(entry.phaseNumber);
      }
      for (const p of roadmapPhases) {
        if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
          warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
        }
      }
      for (const p of diskPhases) {
        const unpadded = String(parseInt(p, 10));
        if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
          warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
        }
      }
      const integerPhases = [...diskPhases].filter((p) => !p.includes(".")).map((p) => parseInt(p, 10)).sort((a, b) => a - b);
      for (let i = 1; i < integerPhases.length; i++) {
        if (integerPhases[i] !== integerPhases[i - 1] + 1) {
          warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} \u2192 ${integerPhases[i]}`);
        }
      }
      for (const [, entry] of phaseTree) {
        const plans = entry.plans;
        const summaries = entry.summaries;
        const planNums = plans.map((p) => {
          const pm = p.match(/-(\d{2})-PLAN\.md$/);
          return pm ? parseInt(pm[1], 10) : null;
        }).filter((n) => n !== null);
        for (let i = 1; i < planNums.length; i++) {
          if (planNums[i] !== planNums[i - 1] + 1) {
            warnings.push(`Gap in plan numbering in ${entry.dirName}: plan ${planNums[i - 1]} \u2192 ${planNums[i]}`);
          }
        }
        const planIds = new Set(plans.map((p) => p.replace("-PLAN.md", "")));
        const summaryIds = new Set(summaries.map((s) => s.replace("-SUMMARY.md", "")));
        for (const sid of summaryIds) {
          if (!planIds.has(sid)) {
            warnings.push(`Summary ${sid}-SUMMARY.md in ${entry.dirName} has no matching PLAN.md`);
          }
        }
        for (const plan of plans) {
          const content = cachedReadFile(path.join(entry.fullPath, plan));
          if (!content) continue;
          const fm = extractFrontmatter(content);
          if (!fm.wave) {
            warnings.push(`${entry.dirName}/${plan}: missing 'wave' in frontmatter`);
          }
        }
      }
      const passed = errors.length === 0;
      output({ passed, errors, warnings, warning_count: warnings.length }, raw, passed ? "passed" : "failed");
    }
    function cmdValidateHealth(cwd, options, raw) {
      const planningDir = path.join(cwd, ".planning");
      const projectPath = path.join(planningDir, "PROJECT.md");
      const roadmapPath = path.join(planningDir, "ROADMAP.md");
      const statePath = path.join(planningDir, "STATE.md");
      const configPath = path.join(planningDir, "config.json");
      const phasesDir = path.join(planningDir, "phases");
      const errors = [];
      const warnings = [];
      const info = [];
      const repairs = [];
      const addIssue = (severity, code, message, fix, repairable = false) => {
        const issue = { code, message, fix, repairable };
        if (severity === "error") errors.push(issue);
        else if (severity === "warning") warnings.push(issue);
        else info.push(issue);
      };
      if (!fs.existsSync(planningDir)) {
        addIssue("error", "E001", ".planning/ directory not found", "Run /gsd:new-project to initialize");
        output({
          status: "broken",
          errors,
          warnings,
          info,
          repairable_count: 0
        }, raw);
        return;
      }
      const projectContent = cachedReadFile(projectPath);
      if (!projectContent) {
        addIssue("error", "E002", "PROJECT.md not found", "Run /gsd:new-project to create");
      } else {
        const requiredSections = ["## What This Is", "## Core Value", "## Requirements"];
        for (const section of requiredSections) {
          if (!projectContent.includes(section)) {
            addIssue("warning", "W001", `PROJECT.md missing section: ${section}`, "Add section manually");
          }
        }
      }
      if (!fs.existsSync(roadmapPath)) {
        addIssue("error", "E003", "ROADMAP.md not found", "Run /gsd:new-milestone to create roadmap");
      }
      const stateContent = cachedReadFile(statePath);
      if (!stateContent) {
        addIssue("error", "E004", "STATE.md not found", "Run /gsd:health --repair to regenerate", true);
        repairs.push("regenerateState");
      } else {
        const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
        const phaseTree = getPhaseTree(cwd);
        const diskPhases = /* @__PURE__ */ new Set();
        for (const [, entry] of phaseTree) {
          diskPhases.add(entry.phaseNumber);
        }
        for (const ref of phaseRefs) {
          const normalizedRef = String(parseInt(ref, 10)).padStart(2, "0");
          if (!diskPhases.has(ref) && !diskPhases.has(normalizedRef) && !diskPhases.has(String(parseInt(ref, 10)))) {
            if (diskPhases.size > 0) {
              addIssue("warning", "W002", `STATE.md references phase ${ref}, but only phases ${[...diskPhases].sort().join(", ")} exist`, "Run /gsd:health --repair to regenerate STATE.md", true);
              if (!repairs.includes("regenerateState")) repairs.push("regenerateState");
            }
          }
        }
      }
      const configContent = cachedReadFile(configPath);
      if (!configContent) {
        addIssue("warning", "W003", "config.json not found", "Run /gsd:health --repair to create with defaults", true);
        repairs.push("createConfig");
      } else {
        try {
          const parsed = JSON.parse(configContent);
          const validProfiles = ["quality", "balanced", "budget"];
          if (parsed.model_profile && !validProfiles.includes(parsed.model_profile)) {
            addIssue("warning", "W004", `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(", ")}`);
          }
        } catch (err) {
          debugLog("validate.health", "JSON parse failed", err);
          addIssue("error", "E005", `config.json: JSON parse error - ${err.message}`, "Run /gsd:health --repair to reset to defaults", true);
          repairs.push("resetConfig");
        }
      }
      const healthPhaseTree = getPhaseTree(cwd);
      for (const [, entry] of healthPhaseTree) {
        if (!entry.dirName.match(/^\d{2}(?:\.\d+)?-[\w-]+$/)) {
          addIssue("warning", "W005", `Phase directory "${entry.dirName}" doesn't follow NN-name format`, "Rename to match pattern (e.g., 01-setup)");
        }
        const summaryBases = new Set(entry.summaries.map((s) => s.replace("-SUMMARY.md", "").replace("SUMMARY.md", "")));
        for (const plan of entry.plans) {
          const planBase = plan.replace("-PLAN.md", "").replace("PLAN.md", "");
          if (!summaryBases.has(planBase)) {
            addIssue("info", "I001", `${entry.dirName}/${plan} has no SUMMARY.md`, "May be in progress");
          }
        }
      }
      if (fs.existsSync(roadmapPath)) {
        const roadmapContent = fs.readFileSync(roadmapPath, "utf-8");
        const roadmapPhases = /* @__PURE__ */ new Set();
        const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
        let m;
        while ((m = phasePattern.exec(roadmapContent)) !== null) {
          roadmapPhases.add(m[1]);
        }
        const diskPhases = /* @__PURE__ */ new Set();
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              const dm = e.name.match(/^(\d+(?:\.\d+)?)/);
              if (dm) diskPhases.add(dm[1]);
            }
          }
        } catch (e) {
          debugLog("validate.health", "readdir failed", e);
        }
        for (const p of roadmapPhases) {
          const padded = String(parseInt(p, 10)).padStart(2, "0");
          if (!diskPhases.has(p) && !diskPhases.has(padded)) {
            addIssue("warning", "W006", `Phase ${p} in ROADMAP.md but no directory on disk`, "Create phase directory or remove from roadmap");
          }
        }
        for (const p of diskPhases) {
          const unpadded = String(parseInt(p, 10));
          if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
            addIssue("warning", "W007", `Phase ${p} exists on disk but not in ROADMAP.md`, "Add to roadmap or remove directory");
          }
        }
      }
      const repairActions = [];
      if (options.repair && repairs.length > 0) {
        for (const repair of repairs) {
          try {
            switch (repair) {
              case "createConfig":
              case "resetConfig": {
                const defaults = {
                  model_profile: "balanced",
                  commit_docs: true,
                  search_gitignored: false,
                  branching_strategy: "none",
                  research: true,
                  plan_checker: true,
                  verifier: true,
                  parallelization: true
                };
                fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), "utf-8");
                repairActions.push({ action: repair, success: true, path: "config.json" });
                break;
              }
              case "regenerateState": {
                if (fs.existsSync(statePath)) {
                  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
                  const backupPath = `${statePath}.bak-${timestamp}`;
                  fs.copyFileSync(statePath, backupPath);
                  repairActions.push({ action: "backupState", success: true, path: backupPath });
                }
                const milestone = getMilestoneInfo(cwd);
                let stateContent2 = `# Session State

`;
                stateContent2 += `## Project Reference

`;
                stateContent2 += `See: .planning/PROJECT.md

`;
                stateContent2 += `## Position

`;
                stateContent2 += `**Milestone:** ${milestone.version} ${milestone.name}
`;
                stateContent2 += `**Current phase:** (determining...)
`;
                stateContent2 += `**Status:** Resuming

`;
                stateContent2 += `## Session Log

`;
                stateContent2 += `- ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}: STATE.md regenerated by /gsd:health --repair
`;
                fs.writeFileSync(statePath, stateContent2, "utf-8");
                repairActions.push({ action: repair, success: true, path: "STATE.md" });
                break;
              }
            }
          } catch (err) {
            debugLog("validate.health", "write failed", err);
            repairActions.push({ action: repair, success: false, error: err.message });
          }
        }
      }
      let status;
      if (errors.length > 0) {
        status = "broken";
      } else if (warnings.length > 0) {
        status = "degraded";
      } else {
        status = "healthy";
      }
      const repairableCount = errors.filter((e) => e.repairable).length + warnings.filter((w) => w.repairable).length;
      output({
        status,
        errors,
        warnings,
        info,
        repairable_count: repairableCount,
        repairs_performed: repairActions.length > 0 ? repairActions : void 0
      }, raw);
    }
    function cmdAnalyzePlan(cwd, planPath, raw) {
      if (!planPath) {
        error("plan file path required");
      }
      const fullPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: planPath }, raw);
        return;
      }
      const fm = extractFrontmatter(content);
      const planId = fm.phase && fm.plan ? `${String(fm.phase).replace(/^0+/, "")}-${String(fm.plan).replace(/^0+/, "").padStart(2, "0")}` : path.basename(planPath, ".md").replace(/-PLAN$/i, "");
      const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
      const tasks = [];
      let taskMatch;
      while ((taskMatch = taskPattern.exec(content)) !== null) {
        const taskContent = taskMatch[1];
        const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
        const filesMatch = taskContent.match(/<files>([\s\S]*?)<\/files>/);
        const taskName = nameMatch ? nameMatch[1].trim() : "unnamed";
        const taskFiles = filesMatch ? filesMatch[1].split("\n").map((f) => f.trim()).filter((f) => f.length > 0) : [];
        tasks.push({ name: taskName, files: taskFiles });
      }
      const allFiles = [];
      const dirSet = /* @__PURE__ */ new Set();
      for (const task of tasks) {
        for (const file of task.files) {
          allFiles.push(file);
          const dir = path.dirname(file);
          dirSet.add(dir === "." ? "(root)" : dir);
        }
      }
      const taskDirs = tasks.map((t) => {
        const dirs = /* @__PURE__ */ new Set();
        for (const f of t.files) {
          const dir = path.dirname(f);
          dirs.add(dir === "." ? "(root)" : dir);
        }
        return dirs;
      });
      const parent = tasks.map((_, i) => i);
      function find(x) {
        while (parent[x] !== x) {
          parent[x] = parent[parent[x]];
          x = parent[x];
        }
        return x;
      }
      function union(a, b) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[ra] = rb;
      }
      for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          for (const dir of taskDirs[i]) {
            if (taskDirs[j].has(dir)) {
              union(i, j);
              break;
            }
          }
        }
      }
      const groups = {};
      for (let i = 0; i < tasks.length; i++) {
        const root = find(i);
        if (!groups[root]) groups[root] = { tasks: [], files: /* @__PURE__ */ new Set(), dirs: /* @__PURE__ */ new Set() };
        groups[root].tasks.push(tasks[i].name);
        for (const f of tasks[i].files) groups[root].files.add(f);
        for (const d of taskDirs[i]) groups[root].dirs.add(d);
      }
      const concerns = Object.values(groups).map((g, idx) => {
        const dirsArr = [...g.dirs];
        const area = dirsArr.length > 0 ? dirsArr[0].split("/").filter((s) => s !== "(root)")[0] || "(root)" : "(none)";
        return {
          group: idx + 1,
          tasks: g.tasks,
          files: [...g.files],
          area
        };
      });
      const concernCount = concerns.length;
      const taskCount = tasks.length;
      const dirCount = dirSet.size;
      let base = 5;
      if (concernCount > 1) base -= 1;
      if (concernCount > 2) base -= 1;
      if (concernCount > 3) base -= 1;
      if (taskCount > 3) base -= 1;
      if (taskCount > 5) base -= 1;
      const srScore = Math.max(1, Math.min(5, base));
      const labels = { 5: "Excellent", 4: "Good", 3: "Acceptable", 2: "Poor", 1: "Bad" };
      const srLabel = labels[srScore];
      let splitSuggestion = null;
      if (srScore <= 3 && concernCount > 1) {
        splitSuggestion = {
          recommended_splits: concernCount,
          proposed_plans: concerns.map((c, idx) => ({
            plan_suffix: String(idx + 1).padStart(2, "0"),
            area: c.area,
            tasks: c.tasks,
            files: c.files
          }))
        };
      }
      const flags = [];
      if (taskCount === 0) flags.push("no_tasks_found");
      if (dirCount > 5) flags.push("high_directory_spread");
      if (concernCount > 3) flags.push("many_concerns");
      output({
        plan: planId,
        sr_score: srScore,
        sr_label: srLabel,
        concern_count: concernCount,
        concerns,
        task_count: taskCount,
        files_total: allFiles.length,
        directories_touched: dirCount,
        split_suggestion: splitSuggestion,
        flags
      }, raw);
    }
    function cmdVerifyDeliverables(cwd, options, raw) {
      const { execSync } = require("child_process");
      const { loadConfig } = require_config();
      let testCommand = null;
      let framework = null;
      const config = loadConfig(cwd);
      if (config.test_commands && typeof config.test_commands === "object") {
        const keys = Object.keys(config.test_commands);
        if (keys.length > 0) {
          framework = keys[0];
          testCommand = config.test_commands[framework];
        }
      }
      if (!testCommand) {
        if (fs.existsSync(path.join(cwd, "package.json"))) {
          framework = "npm";
          testCommand = "npm test";
        } else if (fs.existsSync(path.join(cwd, "mix.exs"))) {
          framework = "mix";
          testCommand = "mix test";
        } else if (fs.existsSync(path.join(cwd, "go.mod"))) {
          framework = "go";
          testCommand = "go test ./...";
        }
      }
      if (!testCommand) {
        output({
          test_result: "skip",
          tests_passed: 0,
          tests_failed: 0,
          tests_total: 0,
          framework: null,
          verdict: "skip",
          reason: "No test framework detected"
        }, raw, "skip");
        return;
      }
      let testOutput = "";
      let testExitCode = 0;
      try {
        testOutput = execSync(testCommand, {
          cwd,
          encoding: "utf-8",
          timeout: 6e4,
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (err) {
        testExitCode = err.status || 1;
        testOutput = (err.stdout || "") + "\n" + (err.stderr || "");
      }
      let testsPassed = 0;
      let testsFailed = 0;
      let testsTotal = 0;
      const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
      const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
      const totalMatch = testOutput.match(/(?:tests?|suites?)\s+(\d+)/i) || testOutput.match(/(\d+)\s+tests?/i);
      if (passMatch) testsPassed = parseInt(passMatch[1], 10);
      if (failMatch) testsFailed = parseInt(failMatch[1], 10);
      if (totalMatch) testsTotal = parseInt(totalMatch[1], 10);
      if (testsTotal === 0 && (testsPassed > 0 || testsFailed > 0)) {
        testsTotal = testsPassed + testsFailed;
      }
      const testResult = testExitCode === 0 ? "pass" : "fail";
      let artifactsOk = true;
      let keyLinksOk = true;
      if (options && options.plan) {
        const planPath = path.isAbsolute(options.plan) ? options.plan : path.join(cwd, options.plan);
        const planContent = safeReadFile(planPath);
        if (planContent) {
          const artifacts = parseMustHavesBlock(planContent, "artifacts");
          if (artifacts.length > 0) {
            for (const artifact of artifacts) {
              if (typeof artifact === "string") continue;
              const artPath = artifact.path;
              if (!artPath) continue;
              if (!fs.existsSync(path.join(cwd, artPath))) {
                artifactsOk = false;
                break;
              }
            }
          }
          const keyLinks = parseMustHavesBlock(planContent, "key_links");
          if (keyLinks.length > 0) {
            for (const link of keyLinks) {
              if (typeof link === "string") continue;
              const sourceContent = safeReadFile(path.join(cwd, link.from || ""));
              if (!sourceContent) {
                keyLinksOk = false;
                break;
              }
            }
          }
        }
      }
      const verdict = testResult === "pass" && artifactsOk && keyLinksOk ? "pass" : "fail";
      output({
        test_result: testResult,
        tests_passed: testsPassed,
        tests_failed: testsFailed,
        tests_total: testsTotal,
        framework,
        artifacts_ok: artifactsOk,
        key_links_ok: keyLinksOk,
        verdict
      }, raw, verdict);
    }
    function cmdVerifyRequirements(cwd, options, raw) {
      const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
      const content = safeReadFile(reqPath);
      if (!content) {
        output({
          total: 0,
          addressed: 0,
          unaddressed: 0,
          unaddressed_list: [],
          error: "REQUIREMENTS.md not found"
        }, raw, "skip");
        return;
      }
      const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
      const requirements = [];
      let match;
      while ((match = reqPattern.exec(content)) !== null) {
        requirements.push({
          id: match[2],
          checked: match[1] === "x"
        });
      }
      const tracePattern = /\| (\w+-\d+) \| Phase (\d+)[^|\n]*\|[^|\n]*\|([^|\n]*)/g;
      const traceMap = {};
      while ((match = tracePattern.exec(content)) !== null) {
        const testCommand = match[3] ? match[3].trim() : null;
        traceMap[match[1]] = { phase: match[2], testCommand: testCommand || null };
      }
      if (Object.keys(traceMap).length === 0) {
        const simpleTracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
        while ((match = simpleTracePattern.exec(content)) !== null) {
          traceMap[match[1]] = { phase: match[2], testCommand: null };
        }
      }
      const unaddressedList = [];
      let addressedCount = 0;
      for (const req of requirements) {
        if (req.checked) {
          addressedCount++;
          continue;
        }
        const traceEntry = traceMap[req.id];
        const phase = traceEntry ? traceEntry.phase : null;
        if (phase) {
          const phasePadded = phase.padStart(2, "0");
          const phasesDir = path.join(cwd, ".planning", "phases");
          let hasSummaries = false;
          try {
            const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && entry.name.startsWith(phasePadded)) {
                const phaseFiles = fs.readdirSync(path.join(phasesDir, entry.name));
                if (phaseFiles.some((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md")) {
                  hasSummaries = true;
                }
                break;
              }
            }
          } catch (e) {
            debugLog("verify.requirements", "readdir failed", e);
          }
          if (hasSummaries) {
            addressedCount++;
          } else {
            unaddressedList.push({ id: req.id, phase, reason: "Phase has no summaries" });
          }
        } else {
          unaddressedList.push({ id: req.id, phase: null, reason: "Not in traceability table" });
        }
      }
      const testCommands = { total: 0, valid: 0, invalid: 0, coverage_percent: 0, commands: [] };
      const knownCommands = /* @__PURE__ */ new Set(["npm", "node", "npx", "mix", "go", "cargo", "pytest", "python", "python3", "ruby", "bundle", "jest", "mocha", "vitest"]);
      for (const [reqId, entry] of Object.entries(traceMap)) {
        if (entry.testCommand) {
          testCommands.total++;
          const baseCommand = entry.testCommand.split(/\s+/)[0];
          const valid = knownCommands.has(baseCommand);
          if (valid) testCommands.valid++;
          else testCommands.invalid++;
          testCommands.commands.push({ reqId, command: entry.testCommand, valid });
        }
      }
      testCommands.coverage_percent = requirements.length > 0 ? Math.round(testCommands.total / requirements.length * 100) : 0;
      const assertionsPath = path.join(cwd, ".planning", "ASSERTIONS.md");
      const assertionsContent = safeReadFile(assertionsPath);
      const allAssertions = assertionsContent ? parseAssertionsMd(assertionsContent) : null;
      let assertionsResult = null;
      if (allAssertions && Object.keys(allAssertions).length > 0) {
        let totalAssertions = 0;
        let verified = 0;
        let failed = 0;
        let needsHuman = 0;
        let mustHavePass = 0;
        let mustHaveFail = 0;
        const byRequirement = {};
        for (const [reqId, data] of Object.entries(allAssertions)) {
          const reqResult = { assertion_count: 0, pass: 0, fail: 0, needs_human: 0, assertions: [] };
          for (const a of data.assertions) {
            totalAssertions++;
            reqResult.assertion_count++;
            let status = "needs_human";
            let evidence = null;
            if (a.type === "file") {
              const filePatterns = a.assert.match(/[\w./-]+\.\w{1,10}/g) || [];
              const whenPatterns = a.when ? a.when.match(/[\w./-]+\.\w{1,10}/g) || [] : [];
              const thenPatterns = a.then ? a.then.match(/[\w./-]+\.\w{1,10}/g) || [] : [];
              const allPatterns = [...filePatterns, ...whenPatterns, ...thenPatterns];
              if (allPatterns.length > 0) {
                const existingFiles = allPatterns.filter((p) => {
                  return fs.existsSync(path.join(cwd, p)) || fs.existsSync(path.join(cwd, ".planning", p)) || fs.existsSync(path.join(cwd, "templates", p));
                });
                if (existingFiles.length > 0) {
                  status = "pass";
                  evidence = `Files found: ${existingFiles.join(", ")}`;
                } else {
                  status = "fail";
                  evidence = `No matching files on disk for: ${allPatterns.join(", ")}`;
                }
              } else {
                status = "needs_human";
                evidence = "No file path detected in assertion text";
              }
            } else if (a.type === "cli") {
              const whenText = (a.when || a.assert || "").toLowerCase();
              const gsdCommands = [
                "assertions",
                "verify",
                "trace-requirement",
                "env",
                "mcp-profile",
                "init",
                "state",
                "roadmap",
                "phase",
                "memory",
                "intent",
                "context-budget",
                "test-run",
                "search-decisions",
                "validate-dependencies",
                "search-lessons",
                "codebase-impact",
                "rollback-info",
                "velocity",
                "validate-config",
                "quick-summary",
                "extract-sections",
                "test-coverage",
                "token-budget",
                "session-diff"
              ];
              const matchedCmd = gsdCommands.find((cmd) => whenText.includes(cmd));
              if (matchedCmd) {
                status = "pass";
                evidence = `CLI command "${matchedCmd}" exists in gsd-tools`;
              } else {
                status = "needs_human";
                evidence = "Could not map assertion to a known CLI command";
              }
            }
            if (status === "pass") {
              verified++;
              reqResult.pass++;
              if (a.priority === "must-have") mustHavePass++;
            } else if (status === "fail") {
              failed++;
              reqResult.fail++;
              if (a.priority === "must-have") mustHaveFail++;
            } else {
              needsHuman++;
              reqResult.needs_human++;
            }
            const assertionEntry = {
              assert: a.assert,
              priority: a.priority,
              type: a.type || null,
              status,
              evidence
            };
            if (status === "fail" && a.priority === "must-have") {
              assertionEntry.gap_description = `[${reqId}] Must-have assertion failed: ${a.assert}`;
            }
            reqResult.assertions.push(assertionEntry);
          }
          byRequirement[reqId] = reqResult;
        }
        const coveragePercent = totalAssertions > 0 ? Math.round((verified + failed) / totalAssertions * 100) : 0;
        assertionsResult = {
          total: totalAssertions,
          verified,
          failed,
          needs_human: needsHuman,
          must_have_pass: mustHavePass,
          must_have_fail: mustHaveFail,
          coverage_percent: coveragePercent,
          by_requirement: byRequirement
        };
      }
      const result = {
        total: requirements.length,
        addressed: addressedCount,
        unaddressed: unaddressedList.length,
        unaddressed_list: unaddressedList
      };
      if (assertionsResult) {
        result.assertions = assertionsResult;
      }
      if (testCommands.total > 0) {
        result.test_commands = testCommands;
      }
      let rawValue;
      if (assertionsResult) {
        rawValue = `${requirements.length} reqs (${addressedCount} addressed), ${assertionsResult.total} assertions (${assertionsResult.verified} pass, ${assertionsResult.failed} fail, ${assertionsResult.needs_human} human)`;
      } else {
        rawValue = unaddressedList.length === 0 ? "pass" : "fail";
      }
      output(result, raw, rawValue);
    }
    function cmdVerifyRegression(cwd, options, raw) {
      const memoryDir = path.join(cwd, ".planning", "memory");
      const baselinePath = path.join(memoryDir, "test-baseline.json");
      let beforeData = null;
      let afterData = null;
      if (options && options.before && options.after) {
        const beforePath = path.isAbsolute(options.before) ? options.before : path.join(cwd, options.before);
        const afterPath = path.isAbsolute(options.after) ? options.after : path.join(cwd, options.after);
        const beforeContent = safeReadFile(beforePath);
        const afterContent = safeReadFile(afterPath);
        if (!beforeContent) {
          output({ error: "Before file not found", path: options.before }, raw, "error");
          return;
        }
        if (!afterContent) {
          output({ error: "After file not found", path: options.after }, raw, "error");
          return;
        }
        try {
          beforeData = JSON.parse(beforeContent);
          afterData = JSON.parse(afterContent);
        } catch (e) {
          debugLog("verify.regression", "JSON parse failed", e);
          output({ error: "Invalid JSON in before/after files" }, raw, "error");
          return;
        }
      } else {
        const baselineContent = safeReadFile(baselinePath);
        if (!baselineContent) {
          output({
            regressions: [],
            regression_count: 0,
            verdict: "pass",
            note: "No baseline found. Save a baseline with --before/--after or store test-baseline.json in .planning/memory/"
          }, raw, "pass");
          return;
        }
        try {
          beforeData = JSON.parse(baselineContent);
        } catch (e) {
          debugLog("verify.regression", "baseline parse failed", e);
          output({ error: "Invalid JSON in test-baseline.json" }, raw, "error");
          return;
        }
        if (!afterData) {
          output({
            regressions: [],
            regression_count: 0,
            verdict: "pass",
            note: "Baseline found but no current results provided. Pass --after to compare."
          }, raw, "pass");
          return;
        }
      }
      const beforeMap = {};
      if (beforeData.tests && Array.isArray(beforeData.tests)) {
        for (const t of beforeData.tests) {
          beforeMap[t.name] = t.status;
        }
      }
      const regressions = [];
      if (afterData.tests && Array.isArray(afterData.tests)) {
        for (const t of afterData.tests) {
          const beforeStatus = beforeMap[t.name];
          if (beforeStatus === "pass" && t.status === "fail") {
            regressions.push({
              test_name: t.name,
              before: "pass",
              after: "fail"
            });
          }
        }
      }
      output({
        regressions,
        regression_count: regressions.length,
        verdict: regressions.length === 0 ? "pass" : "fail"
      }, raw, regressions.length === 0 ? "pass" : "fail");
    }
    function cmdVerifyPlanWave(cwd, phasePath, raw) {
      if (!phasePath) {
        error("phase directory path required");
      }
      const fullPath = path.isAbsolute(phasePath) ? phasePath : path.join(cwd, phasePath);
      let files;
      try {
        files = fs.readdirSync(fullPath);
      } catch (e) {
        debugLog("verify.planWave", "readdir failed", e);
        output({ error: "Cannot read phase directory", path: phasePath }, raw);
        return;
      }
      const planFiles = files.filter((f) => f.match(/-PLAN\.md$/i)).sort();
      const dirName = path.basename(fullPath);
      const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
      const phaseNum = phaseMatch ? phaseMatch[1] : dirName;
      const plansByWave = {};
      for (const planFile of planFiles) {
        const content = safeReadFile(path.join(fullPath, planFile));
        if (!content) continue;
        const fm = extractFrontmatter(content);
        const wave = fm.wave ? String(fm.wave) : "1";
        const planId = planFile.replace(/-PLAN\.md$/i, "");
        let filesModified = [];
        if (Array.isArray(fm.files_modified)) {
          filesModified = fm.files_modified;
        } else if (typeof fm.files_modified === "string" && fm.files_modified.trim()) {
          filesModified = [fm.files_modified];
        }
        if (!plansByWave[wave]) plansByWave[wave] = [];
        plansByWave[wave].push({ id: planId, files: filesModified });
      }
      const waves = {};
      for (const [wave, plans] of Object.entries(plansByWave)) {
        waves[wave] = plans.map((p) => p.id);
      }
      const conflicts = [];
      for (const [wave, plans] of Object.entries(plansByWave)) {
        const fileMap = {};
        for (const plan of plans) {
          for (const file of plan.files) {
            if (!fileMap[file]) fileMap[file] = [];
            fileMap[file].push(plan.id);
          }
        }
        for (const [file, planIds] of Object.entries(fileMap)) {
          if (planIds.length > 1) {
            conflicts.push({ wave: parseInt(wave, 10), file, plans: planIds });
          }
        }
      }
      const verdict = conflicts.length > 0 ? "conflicts_found" : "clean";
      output({
        phase: phaseNum,
        waves,
        conflicts,
        verdict
      }, raw, verdict);
    }
    function cmdVerifyPlanDeps(cwd, phasePath, raw) {
      if (!phasePath) {
        error("phase directory path required");
      }
      const fullPath = path.isAbsolute(phasePath) ? phasePath : path.join(cwd, phasePath);
      let files;
      try {
        files = fs.readdirSync(fullPath);
      } catch (e) {
        debugLog("verify.planDeps", "readdir failed", e);
        output({ error: "Cannot read phase directory", path: phasePath }, raw);
        return;
      }
      const planFiles = files.filter((f) => f.match(/-PLAN\.md$/i)).sort();
      const dirName = path.basename(fullPath);
      const phaseMatch = dirName.match(/^(\d+(?:\.\d+)?)/);
      const phaseNum = phaseMatch ? phaseMatch[1] : dirName;
      const plans = {};
      for (const planFile of planFiles) {
        const content = safeReadFile(path.join(fullPath, planFile));
        if (!content) continue;
        const fm = extractFrontmatter(content);
        const planIdMatch = planFile.match(/(\d{2})-PLAN\.md$/i);
        const planId = planIdMatch ? planIdMatch[1] : fm.plan || planFile.replace(/-PLAN\.md$/i, "");
        let dependsOn = [];
        if (Array.isArray(fm.depends_on)) {
          dependsOn = fm.depends_on;
        } else if (typeof fm.depends_on === "string" && fm.depends_on.trim()) {
          dependsOn = [fm.depends_on];
        }
        const normalizedDeps = dependsOn.map((d) => {
          const depMatch = d.match(/(?:\d+-)?(\d+)$/);
          return depMatch ? depMatch[1] : d;
        }).filter((d) => d.trim());
        const wave = fm.wave ? parseInt(fm.wave, 10) : 1;
        plans[planId] = { deps: normalizedDeps, wave };
      }
      const planIds = new Set(Object.keys(plans));
      const dependencyGraph = {};
      for (const [id, info] of Object.entries(plans)) {
        dependencyGraph[id] = info.deps;
      }
      const issues = [];
      for (const [id, info] of Object.entries(plans)) {
        for (const dep of info.deps) {
          if (!planIds.has(dep)) {
            issues.push({ type: "unreachable", plan: id, dep, message: `Plan ${id} depends on ${dep} which is not in this phase` });
          }
        }
      }
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = {};
      for (const id of planIds) color[id] = WHITE;
      function dfs(node, pathStack) {
        color[node] = GRAY;
        pathStack.push(node);
        const deps = plans[node] ? plans[node].deps : [];
        for (const dep of deps) {
          if (!planIds.has(dep)) continue;
          if (color[dep] === GRAY) {
            const cycleStart = pathStack.indexOf(dep);
            const cycle = pathStack.slice(cycleStart).concat(dep);
            issues.push({ type: "cycle", plans: cycle, message: `Dependency cycle: ${cycle.join(" \u2192 ")}` });
            return;
          }
          if (color[dep] === WHITE) {
            dfs(dep, pathStack);
          }
        }
        pathStack.pop();
        color[node] = BLACK;
      }
      for (const id of planIds) {
        if (color[id] === WHITE) {
          dfs(id, []);
        }
      }
      for (const [id, info] of Object.entries(plans)) {
        if (info.wave > 1) {
          const hasLowerWaveDep = info.deps.some((dep) => {
            return planIds.has(dep) && plans[dep] && plans[dep].wave < info.wave;
          });
          if (!hasLowerWaveDep && info.deps.length === 0) {
            issues.push({
              type: "unnecessary_serialization",
              plan: id,
              wave: info.wave,
              message: `Plan ${id} is in wave ${info.wave} but has no dependencies on lower waves \u2014 could be wave 1`
            });
          }
        }
      }
      const verdict = issues.length > 0 ? "issues_found" : "clean";
      output({
        phase: phaseNum,
        plan_count: planIds.size,
        dependency_graph: dependencyGraph,
        issues,
        verdict
      }, raw, verdict);
    }
    function cmdVerifyQuality(cwd, options, raw) {
      const { execSync } = require("child_process");
      const { loadConfig } = require_config();
      const phaseNum = options.phase || null;
      const planPath = options.plan || null;
      let testsScore = null;
      let testsDetail = "no test framework detected";
      const config = loadConfig(cwd);
      let testCommand = null;
      let framework = null;
      if (config.test_commands && typeof config.test_commands === "object") {
        const keys = Object.keys(config.test_commands);
        if (keys.length > 0) {
          framework = keys[0];
          testCommand = config.test_commands[framework];
        }
      }
      if (!testCommand) {
        if (fs.existsSync(path.join(cwd, "package.json"))) {
          framework = "npm";
          testCommand = "npm test";
        } else if (fs.existsSync(path.join(cwd, "mix.exs"))) {
          framework = "mix";
          testCommand = "mix test";
        } else if (fs.existsSync(path.join(cwd, "go.mod"))) {
          framework = "go";
          testCommand = "go test ./...";
        }
      }
      if (testCommand) {
        let testExitCode = 0;
        let testOutput = "";
        try {
          testOutput = execSync(testCommand, {
            cwd,
            encoding: "utf-8",
            timeout: 12e4,
            stdio: ["pipe", "pipe", "pipe"]
          });
        } catch (err) {
          testExitCode = err.status || 1;
          testOutput = (err.stdout || "") + "\n" + (err.stderr || "");
        }
        if (testExitCode === 0) {
          testsScore = 100;
          const passMatch = testOutput.match(/(\d+)\s+pass(?:ing|ed)?/i) || testOutput.match(/pass\s+(\d+)/i);
          const count = passMatch ? passMatch[1] : "?";
          testsDetail = `all ${count} pass`;
        } else {
          testsScore = 0;
          const failMatch = testOutput.match(/(\d+)\s+fail(?:ing|ed|ure)?/i) || testOutput.match(/fail\s+(\d+)/i);
          const count = failMatch ? failMatch[1] : "?";
          testsDetail = `${count} failing`;
        }
      }
      let mustHavesScore = null;
      let mustHavesDetail = "no plan specified";
      if (planPath) {
        const fullPlanPath = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
        const planContent = safeReadFile(fullPlanPath);
        if (planContent) {
          const artifacts = parseMustHavesBlock(planContent, "artifacts");
          const keyLinks = parseMustHavesBlock(planContent, "key_links");
          let total = 0;
          let verified = 0;
          for (const artifact of artifacts) {
            if (typeof artifact === "string") continue;
            if (!artifact.path) continue;
            total++;
            const artFullPath = path.join(cwd, artifact.path);
            if (fs.existsSync(artFullPath)) {
              let ok = true;
              if (artifact.contains) {
                const fileContent = safeReadFile(artFullPath) || "";
                if (!fileContent.includes(artifact.contains)) ok = false;
              }
              if (ok) verified++;
            }
          }
          for (const link of keyLinks) {
            if (typeof link === "string") continue;
            total++;
            const sourceContent = safeReadFile(path.join(cwd, link.from || ""));
            if (sourceContent) {
              if (link.pattern) {
                try {
                  const regex = new RegExp(link.pattern);
                  if (regex.test(sourceContent)) {
                    verified++;
                  }
                } catch (e) {
                  debugLog("verify.quality", "regex failed", e);
                }
              } else {
                verified++;
              }
            }
          }
          if (total > 0) {
            mustHavesScore = Math.round(verified / total * 100);
            mustHavesDetail = `${verified}/${total} verified`;
          } else {
            mustHavesDetail = "no must_haves defined";
          }
        } else {
          mustHavesDetail = "plan file not found";
        }
      }
      let reqScore = null;
      let reqDetail = "no REQUIREMENTS.md";
      const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
      const reqContent = safeReadFile(reqPath);
      if (reqContent) {
        const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
        const requirements = [];
        let reqMatch;
        while ((reqMatch = reqPattern.exec(reqContent)) !== null) {
          requirements.push({ id: reqMatch[2], checked: reqMatch[1] === "x" });
        }
        let filteredReqs = requirements;
        if (phaseNum) {
          const tracePattern = /\| (\w+-\d+) \| Phase (\d+)/g;
          const traceMap = {};
          let tm;
          while ((tm = tracePattern.exec(reqContent)) !== null) {
            traceMap[tm[1]] = tm[2];
          }
          const pn = String(parseInt(phaseNum, 10));
          filteredReqs = requirements.filter((r) => {
            const mapped = traceMap[r.id];
            return mapped && String(parseInt(mapped, 10)) === pn;
          });
        }
        if (filteredReqs.length > 0) {
          const addressed = filteredReqs.filter((r) => r.checked).length;
          reqScore = Math.round(addressed / filteredReqs.length * 100);
          reqDetail = `${addressed}/${filteredReqs.length} addressed`;
        } else {
          reqDetail = phaseNum ? `no requirements mapped to phase ${phaseNum}` : "no requirements found";
        }
      }
      let regressionScore = null;
      let regressionDetail = "no baseline";
      const baselinePath = path.join(cwd, ".planning", "memory", "test-baseline.json");
      const baselineContent = safeReadFile(baselinePath);
      if (baselineContent) {
        try {
          const baseline = JSON.parse(baselineContent);
          if (baseline.tests_total !== void 0 && baseline.tests_failed !== void 0) {
            regressionScore = baseline.tests_failed === 0 ? 100 : 0;
            regressionDetail = baseline.tests_failed === 0 ? "no regressions" : `${baseline.tests_failed} regressions`;
          } else if (baseline.tests && Array.isArray(baseline.tests)) {
            const failures = baseline.tests.filter((t) => t.status === "fail").length;
            regressionScore = failures === 0 ? 100 : 0;
            regressionDetail = failures === 0 ? "no regressions" : `${failures} regressions`;
          }
        } catch (e) {
          debugLog("verify.quality", "baseline parse failed", e);
          regressionDetail = "invalid baseline JSON";
        }
      }
      const dimensions = {
        tests: { score: testsScore, weight: 30, detail: testsDetail },
        must_haves: { score: mustHavesScore, weight: 30, detail: mustHavesDetail },
        requirements: { score: reqScore, weight: 20, detail: reqDetail },
        regression: { score: regressionScore, weight: 20, detail: regressionDetail }
      };
      let totalWeight = 0;
      let weightedSum = 0;
      for (const dim of Object.values(dimensions)) {
        if (dim.score !== null) {
          totalWeight += dim.weight;
          weightedSum += dim.score * dim.weight;
        }
      }
      const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      let grade;
      if (score >= 90) grade = "A";
      else if (score >= 80) grade = "B";
      else if (score >= 70) grade = "C";
      else if (score >= 60) grade = "D";
      else grade = "F";
      let planId = null;
      if (planPath) {
        const planBase = path.basename(planPath, ".md").replace(/-PLAN$/i, "");
        planId = planBase;
      }
      const memoryDir = path.join(cwd, ".planning", "memory");
      const scoresPath = path.join(memoryDir, "quality-scores.json");
      let scores = [];
      const scoresContent = safeReadFile(scoresPath);
      if (scoresContent) {
        try {
          scores = JSON.parse(scoresContent);
          if (!Array.isArray(scores)) scores = [];
        } catch (e) {
          debugLog("verify.quality", "scores parse failed", e);
          scores = [];
        }
      }
      const entry = {
        phase: phaseNum || (planId ? planId.split("-")[0] : null),
        plan: planId,
        score,
        grade,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      scores.push(entry);
      try {
        if (!fs.existsSync(memoryDir)) {
          fs.mkdirSync(memoryDir, { recursive: true });
        }
        fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2), "utf-8");
      } catch (e) {
        debugLog("verify.quality", "write scores failed", e);
      }
      let trend = "stable";
      if (scores.length >= 3) {
        const last3 = scores.slice(-3);
        const s = last3.map((e) => e.score);
        if (s[0] < s[1] && s[1] < s[2]) trend = "improving";
        else if (s[0] > s[1] && s[1] > s[2]) trend = "declining";
      }
      output({
        score,
        grade,
        dimensions,
        trend,
        plan: planId,
        phase: phaseNum || (planId ? planId.split("-")[0] : null)
      }, raw);
    }
    function cmdAssertionsList(cwd, options, raw) {
      const assertionsPath = path.join(cwd, ".planning", "ASSERTIONS.md");
      const content = safeReadFile(assertionsPath);
      if (!content) {
        output({ error: "ASSERTIONS.md not found", path: ".planning/ASSERTIONS.md" }, raw, "ASSERTIONS.md not found");
        return;
      }
      const parsed = parseAssertionsMd(content);
      const reqId = options && options.reqId;
      const requirements = {};
      let totalAssertions = 0;
      let mustHaveCount = 0;
      let niceToHaveCount = 0;
      for (const [id, data] of Object.entries(parsed)) {
        if (reqId && id !== reqId) continue;
        const assertions = data.assertions || [];
        const must = assertions.filter((a) => a.priority === "must-have").length;
        const nice = assertions.filter((a) => a.priority === "nice-to-have").length;
        totalAssertions += assertions.length;
        mustHaveCount += must;
        niceToHaveCount += nice;
        requirements[id] = {
          description: data.description,
          assertion_count: assertions.length,
          assertions
        };
      }
      const totalRequirements = Object.keys(requirements).length;
      const rawValue = `${totalRequirements} requirements, ${totalAssertions} assertions (${mustHaveCount} must-have, ${niceToHaveCount} nice-to-have)`;
      output({
        total_requirements: totalRequirements,
        total_assertions: totalAssertions,
        must_have_count: mustHaveCount,
        nice_to_have_count: niceToHaveCount,
        requirements
      }, raw, rawValue);
    }
    function cmdAssertionsValidate(cwd, raw) {
      const assertionsPath = path.join(cwd, ".planning", "ASSERTIONS.md");
      const content = safeReadFile(assertionsPath);
      if (!content) {
        output({ error: "ASSERTIONS.md not found", path: ".planning/ASSERTIONS.md" }, raw, "ASSERTIONS.md not found");
        return;
      }
      const parsed = parseAssertionsMd(content);
      const issues = [];
      const reqPath = path.join(cwd, ".planning", "REQUIREMENTS.md");
      const reqContent = safeReadFile(reqPath);
      const reqIds = /* @__PURE__ */ new Set();
      if (reqContent) {
        const reqPattern = /- \[(x| )\] \*\*(\w+-\d+)\*\*/g;
        let m;
        while ((m = reqPattern.exec(reqContent)) !== null) {
          reqIds.add(m[2]);
        }
      }
      const validTypes = /* @__PURE__ */ new Set(["api", "cli", "file", "behavior"]);
      const validPriorities = /* @__PURE__ */ new Set(["must-have", "nice-to-have"]);
      let totalAssertions = 0;
      for (const [reqId, data] of Object.entries(parsed)) {
        if (reqIds.size > 0 && !reqIds.has(reqId)) {
          issues.push({ reqId, issue: `Requirement ${reqId} not found in REQUIREMENTS.md`, severity: "warning" });
        }
        const assertions = data.assertions || [];
        totalAssertions += assertions.length;
        if (assertions.length < 2) {
          issues.push({ reqId, issue: `Only ${assertions.length} assertion(s), recommended 2-5`, severity: "info" });
        } else if (assertions.length > 5) {
          issues.push({ reqId, issue: `${assertions.length} assertions, recommended max 5`, severity: "info" });
        }
        for (let i = 0; i < assertions.length; i++) {
          const a = assertions[i];
          if (!a.assert || !a.assert.trim()) {
            issues.push({ reqId, issue: `Assertion ${i + 1} has empty assert field`, severity: "error" });
          }
          if (a.type && !validTypes.has(a.type)) {
            issues.push({ reqId, issue: `Assertion ${i + 1} has invalid type "${a.type}"`, severity: "error" });
          }
          if (a.priority && !validPriorities.has(a.priority)) {
            issues.push({ reqId, issue: `Assertion ${i + 1} has invalid priority "${a.priority}"`, severity: "error" });
          }
        }
      }
      const assertionReqCount = Object.keys(parsed).length;
      const totalReqs = reqIds.size || assertionReqCount;
      const coveragePercent = totalReqs > 0 ? Math.round(assertionReqCount / totalReqs * 100) : 0;
      const valid = issues.filter((i) => i.severity === "error").length === 0;
      const rawValue = valid ? "valid" : `${issues.length} issues found`;
      output({
        valid,
        issues,
        stats: {
          total_reqs: totalReqs,
          total_assertions: totalAssertions,
          reqs_with_assertions: assertionReqCount,
          coverage_percent: coveragePercent
        }
      }, raw, rawValue);
    }
    function parseAssertionsMd(content) {
      if (!content || typeof content !== "string") return {};
      const result = {};
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.split("\n");
        const heading = lines[0].trim();
        const idMatch = heading.match(/^([A-Z][\w]+-\d+)\s*:\s*(.+)/);
        if (!idMatch) continue;
        const reqId = idMatch[1];
        const description = idMatch[2].trim();
        const assertions = [];
        let current = null;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const assertMatch = line.match(/^- assert:\s*"?([^"]*)"?\s*$/);
          if (assertMatch) {
            if (current) assertions.push(current);
            current = {
              assert: assertMatch[1].trim(),
              when: null,
              then: null,
              type: null,
              priority: "must-have"
            };
            continue;
          }
          if (current) {
            const fieldMatch = line.match(/^\s+(when|then|type|priority):\s*"?([^"]*)"?\s*$/);
            if (fieldMatch) {
              const key = fieldMatch[1];
              const val = fieldMatch[2].trim();
              if (key === "priority") {
                current.priority = val === "nice-to-have" ? "nice-to-have" : "must-have";
              } else {
                current[key] = val || null;
              }
            }
          }
        }
        if (current) assertions.push(current);
        result[reqId] = { description, assertions };
      }
      return result;
    }
    module2.exports = {
      cmdVerifyPlanStructure,
      cmdVerifyPhaseCompleteness,
      cmdVerifyReferences,
      cmdVerifyCommits,
      cmdVerifyArtifacts,
      cmdVerifyKeyLinks,
      cmdValidateConsistency,
      cmdValidateHealth,
      cmdAnalyzePlan,
      cmdVerifyDeliverables,
      cmdVerifyRequirements,
      cmdVerifyRegression,
      cmdVerifyPlanWave,
      cmdVerifyPlanDeps,
      cmdVerifyQuality,
      parseAssertionsMd,
      cmdAssertionsList,
      cmdAssertionsValidate
    };
  }
});

// src/commands/intent.js
var require_intent = __commonJS({
  "src/commands/intent.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { loadConfig } = require_config();
    var { execGit } = require_git();
    var { parseIntentMd, generateIntentMd, parsePlanIntent, getMilestoneInfo, normalizePhaseName } = require_helpers();
    var { extractFrontmatter } = require_frontmatter();
    function cmdIntentCreate(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) {
        error(".planning/ directory not found. Run project initialization first.");
      }
      const intentPath = path.join(planningDir, "INTENT.md");
      const force = args.includes("--force");
      if (fs.existsSync(intentPath) && !force) {
        error("INTENT.md already exists. Use --force to overwrite.");
      }
      const getFlag = (flag) => {
        const idx = args.indexOf(flag);
        if (idx === -1 || idx + 1 >= args.length) return null;
        return args[idx + 1];
      };
      const getMultiFlag = (flag) => {
        const idx = args.indexOf(flag);
        if (idx === -1) return [];
        const values = [];
        for (let i = idx + 1; i < args.length; i++) {
          if (args[i].startsWith("--")) break;
          values.push(args[i]);
        }
        return values;
      };
      const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const data = {
        revision: 1,
        created: now,
        updated: now,
        objective: { statement: "", elaboration: "" },
        users: [],
        outcomes: [],
        criteria: [],
        constraints: { technical: [], business: [], timeline: [] },
        health: { quantitative: [], qualitative: "" },
        history: []
      };
      const objectiveText = getFlag("--objective");
      if (objectiveText) {
        const parts = objectiveText.split("\n");
        data.objective.statement = parts[0] || "";
        data.objective.elaboration = parts.slice(1).join("\n").trim();
      }
      const userArgs = getMultiFlag("--users");
      for (const u of userArgs) {
        data.users.push({ text: u });
      }
      const outcomeArgs = getMultiFlag("--outcomes");
      for (const o of outcomeArgs) {
        const match = o.match(/^(DO-\d+)\s+\[(P[123])\]:\s*(.+)$/);
        if (match) {
          data.outcomes.push({ id: match[1], priority: match[2], text: match[3] });
        }
      }
      const criteriaArgs = getMultiFlag("--criteria");
      for (const c of criteriaArgs) {
        const match = c.match(/^(SC-\d+):\s*(.+)$/);
        if (match) {
          data.criteria.push({ id: match[1], text: match[2] });
        }
      }
      const content = generateIntentMd(data);
      fs.writeFileSync(intentPath, content, "utf-8");
      const sections = ["objective", "users", "outcomes", "criteria", "constraints", "health"];
      const config = loadConfig(cwd);
      let commitHash = null;
      if (config.commit_docs) {
        execGit(cwd, ["add", ".planning/INTENT.md"]);
        const commitResult = execGit(cwd, ["commit", "-m", "docs(intent): create INTENT.md"]);
        if (commitResult.exitCode === 0) {
          const hashResult = execGit(cwd, ["rev-parse", "--short", "HEAD"]);
          commitHash = hashResult.exitCode === 0 ? hashResult.stdout : null;
        }
      }
      const result = {
        created: true,
        path: ".planning/INTENT.md",
        revision: 1,
        sections,
        commit: commitHash
      };
      output(result, raw, commitHash || "created");
    }
    var SECTION_ALIASES = ["objective", "users", "outcomes", "criteria", "constraints", "health", "history"];
    function cmdIntentShow(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) {
        error("No INTENT.md found. Run `intent create` first.");
      }
      const content = fs.readFileSync(intentPath, "utf-8");
      const data = parseIntentMd(content);
      const sectionFilter = args.length > 0 && SECTION_ALIASES.includes(args[0]) ? args[0] : null;
      const fullFlag = args.includes("--full");
      if (raw) {
        if (sectionFilter) {
          const sectionData = {};
          sectionData[sectionFilter] = data[sectionFilter];
          output(sectionData, false);
        } else {
          output(data, false);
        }
        return;
      }
      if (fullFlag) {
        output(null, true, content);
        return;
      }
      if (sectionFilter) {
        const sectionContent = renderSection(data, sectionFilter);
        output(null, true, sectionContent);
        return;
      }
      const summary = renderCompactSummary(data);
      output(null, true, summary);
    }
    function renderCompactSummary(data) {
      const lines = [];
      const isTTY = process.stdout.isTTY;
      const updated = data.updated || "unknown";
      lines.push(`INTENT \u2014 Revision ${data.revision || "?"} (updated ${updated})`);
      lines.push("");
      const obj = data.objective.statement || "(not set)";
      const truncObj = obj.length > 80 ? obj.slice(0, 77) + "..." : obj;
      lines.push(`Objective: ${truncObj}`);
      lines.push("");
      if (data.outcomes.length > 0) {
        const sorted = [...data.outcomes].sort((a, b) => {
          const pa = parseInt(a.priority.replace("P", ""), 10);
          const pb = parseInt(b.priority.replace("P", ""), 10);
          return pa - pb;
        });
        const counts = { P1: 0, P2: 0, P3: 0 };
        for (const o of sorted) {
          if (counts[o.priority] !== void 0) counts[o.priority]++;
        }
        const countParts = [];
        if (counts.P1 > 0) countParts.push(`${counts.P1}\xD7P1`);
        if (counts.P2 > 0) countParts.push(`${counts.P2}\xD7P2`);
        if (counts.P3 > 0) countParts.push(`${counts.P3}\xD7P3`);
        lines.push(`Outcomes (${sorted.length}): ${countParts.join("  ")}`);
        for (const o of sorted) {
          const priorityLabel = colorPriority(o.priority, isTTY);
          lines.push(`  ${priorityLabel}: ${o.id} \u2014 ${o.text}`);
        }
      } else {
        lines.push("Outcomes: none defined");
      }
      lines.push("");
      lines.push(`Success Criteria: ${data.criteria.length} defined`);
      const techCount = data.constraints.technical.length;
      const bizCount = data.constraints.business.length;
      const timeCount = data.constraints.timeline.length;
      lines.push(`Constraints: ${techCount} technical, ${bizCount} business, ${timeCount} timeline`);
      const quantCount = data.health.quantitative.length;
      const hasQual = data.health.qualitative && data.health.qualitative.trim() ? "defined" : "none";
      lines.push(`Health Metrics: ${quantCount} quantitative, qualitative ${hasQual}`);
      lines.push(`Target Users: ${data.users.length} audience${data.users.length !== 1 ? "s" : ""}`);
      if (data.history && data.history.length > 0) {
        const totalChanges = data.history.reduce((sum, e) => sum + e.changes.length, 0);
        const milestones = data.history.map((e) => e.milestone).join(", ");
        lines.push(`Evolution: ${totalChanges} change${totalChanges !== 1 ? "s" : ""} across ${milestones}`);
      }
      return lines.join("\n") + "\n";
    }
    function renderSection(data, section) {
      const isTTY = process.stdout.isTTY;
      const lines = [];
      switch (section) {
        case "objective":
          lines.push("## Objective");
          lines.push("");
          lines.push(data.objective.statement || "(not set)");
          if (data.objective.elaboration) {
            lines.push("");
            lines.push(data.objective.elaboration);
          }
          break;
        case "users":
          lines.push("## Target Users");
          lines.push("");
          if (data.users.length > 0) {
            for (const u of data.users) {
              lines.push(`- ${u.text}`);
            }
          } else {
            lines.push("(none defined)");
          }
          break;
        case "outcomes":
          lines.push("## Desired Outcomes");
          lines.push("");
          if (data.outcomes.length > 0) {
            const sorted = [...data.outcomes].sort((a, b) => {
              const pa = parseInt(a.priority.replace("P", ""), 10);
              const pb = parseInt(b.priority.replace("P", ""), 10);
              return pa - pb;
            });
            for (const o of sorted) {
              const priorityLabel = colorPriority(o.priority, isTTY);
              lines.push(`- ${o.id} [${priorityLabel}]: ${o.text}`);
            }
          } else {
            lines.push("(none defined)");
          }
          break;
        case "criteria":
          lines.push("## Success Criteria");
          lines.push("");
          if (data.criteria.length > 0) {
            for (const c of data.criteria) {
              lines.push(`- ${c.id}: ${c.text}`);
            }
          } else {
            lines.push("(none defined)");
          }
          break;
        case "constraints":
          lines.push("## Constraints");
          if (data.constraints.technical.length > 0) {
            lines.push("");
            lines.push("### Technical");
            for (const c of data.constraints.technical) {
              lines.push(`- ${c.id}: ${c.text}`);
            }
          }
          if (data.constraints.business.length > 0) {
            lines.push("");
            lines.push("### Business");
            for (const c of data.constraints.business) {
              lines.push(`- ${c.id}: ${c.text}`);
            }
          }
          if (data.constraints.timeline.length > 0) {
            lines.push("");
            lines.push("### Timeline");
            for (const c of data.constraints.timeline) {
              lines.push(`- ${c.id}: ${c.text}`);
            }
          }
          if (data.constraints.technical.length === 0 && data.constraints.business.length === 0 && data.constraints.timeline.length === 0) {
            lines.push("");
            lines.push("(none defined)");
          }
          break;
        case "health":
          lines.push("## Health Metrics");
          if (data.health.quantitative.length > 0) {
            lines.push("");
            lines.push("### Quantitative");
            for (const m of data.health.quantitative) {
              lines.push(`- ${m.id}: ${m.text}`);
            }
          }
          if (data.health.qualitative && data.health.qualitative.trim()) {
            lines.push("");
            lines.push("### Qualitative");
            lines.push(data.health.qualitative);
          }
          if (data.health.quantitative.length === 0 && (!data.health.qualitative || !data.health.qualitative.trim())) {
            lines.push("");
            lines.push("(none defined)");
          }
          break;
        case "history":
          lines.push("## Intent Evolution");
          lines.push("");
          if (data.history && data.history.length > 0) {
            for (const entry of data.history) {
              lines.push(`### ${entry.milestone} \u2014 ${entry.date}`);
              for (const change of entry.changes) {
                lines.push(`- **${change.type}** ${change.target}: ${change.description}`);
                if (change.reason) {
                  lines.push(`  - Reason: ${change.reason}`);
                }
              }
              lines.push("");
            }
          } else {
            lines.push("(no history recorded)");
          }
          break;
      }
      return lines.join("\n") + "\n";
    }
    function colorPriority(priority, isTTY) {
      if (!isTTY) return priority;
      switch (priority) {
        case "P1":
          return "\x1B[31mP1\x1B[0m";
        case "P2":
          return "\x1B[33mP2\x1B[0m";
        case "P3":
          return "\x1B[2mP3\x1B[0m";
        default:
          return priority;
      }
    }
    function cmdIntentUpdate(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) {
        error("No INTENT.md found. Run `intent create` first.");
      }
      const reasonIndex = args.indexOf("--reason");
      let reason = null;
      if (reasonIndex !== -1) {
        const reasonParts = [];
        for (let i = reasonIndex + 1; i < args.length; i++) {
          if (args[i].startsWith("--")) break;
          reasonParts.push(args[i]);
        }
        reason = reasonParts.join(" ") || null;
        args.splice(reasonIndex, reasonParts.length + 1);
      }
      const content = fs.readFileSync(intentPath, "utf-8");
      const data = parseIntentMd(content);
      const oldOutcomeIds = new Set((data.outcomes || []).map((o) => o.id));
      const oldCriteriaIds = new Set((data.criteria || []).map((c) => c.id));
      const oldConstraintIds = /* @__PURE__ */ new Set([
        ...(data.constraints.technical || []).map((c) => c.id),
        ...(data.constraints.business || []).map((c) => c.id),
        ...(data.constraints.timeline || []).map((c) => c.id)
      ]);
      const oldHealthIds = new Set((data.health.quantitative || []).map((m) => m.id));
      const oldUserTexts = new Set((data.users || []).map((u) => u.text));
      const oldObjective = data.objective ? data.objective.statement : "";
      const section = args.length > 0 && SECTION_ALIASES.includes(args[0]) ? args[0] : null;
      if (!section) {
        error("Usage: intent update <section> [--add|--remove|--set-priority|--value] [value]\nSections: objective, users, outcomes, criteria, constraints, health");
      }
      const getFlag = (flag) => {
        const idx = args.indexOf(flag);
        if (idx === -1 || idx + 1 >= args.length) return null;
        return args[idx + 1];
      };
      const addValue = getFlag("--add");
      const removeValue = getFlag("--remove");
      const setPriorityId = getFlag("--set-priority");
      const replaceValue = getFlag("--value");
      const priorityValue = getFlag("--priority");
      const typeValue = getFlag("--type");
      let operation = null;
      let operationDetail = null;
      let commitMessage = null;
      if (setPriorityId) {
        if (section !== "outcomes") {
          error("--set-priority is only valid for outcomes");
        }
        const idIdx = args.indexOf("--set-priority");
        const id = args[idIdx + 1];
        const newPriority = args[idIdx + 2];
        if (!id || !newPriority || !/^P[123]$/.test(newPriority)) {
          error("Usage: intent update outcomes --set-priority <DO-XX> <P1|P2|P3>");
        }
        const outcome = data.outcomes.find((o) => o.id === id);
        if (!outcome) {
          error(`Outcome ${id} not found`);
        }
        outcome.priority = newPriority;
        operation = "set-priority";
        operationDetail = { id, priority: newPriority };
        commitMessage = `docs(intent): set ${id} priority to ${newPriority}`;
      } else if (removeValue) {
        operation = "remove";
        if (section === "outcomes") {
          data.outcomes = data.outcomes.filter((o) => o.id !== removeValue);
          operationDetail = { id: removeValue };
          commitMessage = `docs(intent): remove ${removeValue} from outcomes`;
        } else if (section === "criteria") {
          data.criteria = data.criteria.filter((c) => c.id !== removeValue);
          operationDetail = { id: removeValue };
          commitMessage = `docs(intent): remove ${removeValue} from criteria`;
        } else if (section === "constraints") {
          for (const type of ["technical", "business", "timeline"]) {
            data.constraints[type] = data.constraints[type].filter((c) => c.id !== removeValue);
          }
          operationDetail = { id: removeValue };
          commitMessage = `docs(intent): remove ${removeValue} from constraints`;
        } else if (section === "health") {
          data.health.quantitative = data.health.quantitative.filter((m) => m.id !== removeValue);
          operationDetail = { id: removeValue };
          commitMessage = `docs(intent): remove ${removeValue} from health`;
        } else if (section === "users") {
          data.users = data.users.filter((u) => u.text !== removeValue);
          operationDetail = { text: removeValue };
          commitMessage = `docs(intent): remove user from target users`;
        } else {
          error(`--remove is not supported for section: ${section}`);
        }
      } else if (addValue) {
        operation = "add";
        if (section === "outcomes") {
          const nextId = getNextId(data.outcomes, "DO");
          const priority = priorityValue || "P2";
          data.outcomes.push({ id: nextId, priority, text: addValue });
          operationDetail = { id: nextId, priority };
          commitMessage = `docs(intent): add ${nextId} to outcomes`;
        } else if (section === "criteria") {
          const nextId = getNextId(data.criteria, "SC");
          data.criteria.push({ id: nextId, text: addValue });
          operationDetail = { id: nextId };
          commitMessage = `docs(intent): add ${nextId} to criteria`;
        } else if (section === "constraints") {
          const type = typeValue || "technical";
          if (!["technical", "business", "timeline"].includes(type)) {
            error("--type must be one of: technical, business, timeline");
          }
          const allConstraints = [
            ...data.constraints.technical,
            ...data.constraints.business,
            ...data.constraints.timeline
          ];
          const nextId = getNextId(allConstraints, "C");
          data.constraints[type].push({ id: nextId, text: addValue });
          operationDetail = { id: nextId, type };
          commitMessage = `docs(intent): add ${nextId} to constraints (${type})`;
        } else if (section === "health") {
          const nextId = getNextId(data.health.quantitative, "HM");
          data.health.quantitative.push({ id: nextId, text: addValue });
          operationDetail = { id: nextId };
          commitMessage = `docs(intent): add ${nextId} to health metrics`;
        } else if (section === "users") {
          data.users.push({ text: addValue });
          operationDetail = { text: addValue };
          commitMessage = `docs(intent): add user to target users`;
        } else {
          error(`--add is not supported for section: ${section}`);
        }
      } else if (replaceValue) {
        operation = "replace";
        if (section === "objective") {
          const parts = replaceValue.split("\n");
          data.objective.statement = parts[0] || "";
          data.objective.elaboration = parts.slice(1).join("\n").trim();
        } else if (section === "users") {
          data.users = replaceValue.split("\n").filter((l) => l.trim()).map((l) => ({ text: l.trim() }));
        } else {
          error(`--value for section "${section}" is not supported. Use --add/--remove for list sections.`);
        }
        operationDetail = { section };
        commitMessage = `docs(intent): update ${section}`;
      } else {
        error("No operation specified. Use --add, --remove, --set-priority, or --value");
      }
      data.revision = (data.revision || 0) + 1;
      data.updated = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const historyChanges = [];
      const defaultReason = reason || `Updated via intent update ${section}`;
      if (section === "outcomes") {
        const newOutcomeIds = new Set((data.outcomes || []).map((o) => o.id));
        for (const o of data.outcomes || []) {
          if (!oldOutcomeIds.has(o.id)) {
            historyChanges.push({ type: "Added", target: `${o.id} [${o.priority}]`, description: o.text, reason: defaultReason });
          }
        }
        for (const id of oldOutcomeIds) {
          if (!newOutcomeIds.has(id)) {
            historyChanges.push({ type: "Removed", target: id, description: `Removed from outcomes`, reason: defaultReason });
          }
        }
        if (operation === "set-priority" && operationDetail) {
          historyChanges.push({ type: "Modified", target: operationDetail.id, description: `Priority changed to ${operationDetail.priority}`, reason: defaultReason });
        }
      } else if (section === "criteria") {
        const newCriteriaIds = new Set((data.criteria || []).map((c) => c.id));
        for (const c of data.criteria || []) {
          if (!oldCriteriaIds.has(c.id)) {
            historyChanges.push({ type: "Added", target: c.id, description: c.text, reason: defaultReason });
          }
        }
        for (const id of oldCriteriaIds) {
          if (!newCriteriaIds.has(id)) {
            historyChanges.push({ type: "Removed", target: id, description: `Removed from criteria`, reason: defaultReason });
          }
        }
      } else if (section === "constraints") {
        const allNewConstraints = [
          ...data.constraints.technical || [],
          ...data.constraints.business || [],
          ...data.constraints.timeline || []
        ];
        const newConstraintIds = new Set(allNewConstraints.map((c) => c.id));
        for (const c of allNewConstraints) {
          if (!oldConstraintIds.has(c.id)) {
            historyChanges.push({ type: "Added", target: c.id, description: c.text, reason: defaultReason });
          }
        }
        for (const id of oldConstraintIds) {
          if (!newConstraintIds.has(id)) {
            historyChanges.push({ type: "Removed", target: id, description: `Removed from constraints`, reason: defaultReason });
          }
        }
      } else if (section === "health") {
        const newHealthIds = new Set((data.health.quantitative || []).map((m) => m.id));
        for (const m of data.health.quantitative || []) {
          if (!oldHealthIds.has(m.id)) {
            historyChanges.push({ type: "Added", target: m.id, description: m.text, reason: defaultReason });
          }
        }
        for (const id of oldHealthIds) {
          if (!newHealthIds.has(id)) {
            historyChanges.push({ type: "Removed", target: id, description: `Removed from health metrics`, reason: defaultReason });
          }
        }
      } else if (section === "users") {
        const newUserTexts = new Set((data.users || []).map((u) => u.text));
        for (const u of data.users || []) {
          if (!oldUserTexts.has(u.text)) {
            historyChanges.push({ type: "Added", target: "user", description: u.text, reason: defaultReason });
          }
        }
        for (const text of oldUserTexts) {
          if (!newUserTexts.has(text)) {
            historyChanges.push({ type: "Removed", target: "user", description: text, reason: defaultReason });
          }
        }
      } else if (section === "objective") {
        const newObjective = data.objective ? data.objective.statement : "";
        if (newObjective !== oldObjective) {
          historyChanges.push({ type: "Modified", target: "objective", description: newObjective, reason: defaultReason });
        }
      }
      if (historyChanges.length > 0) {
        if (!data.history) data.history = [];
        const milestone = getMilestoneInfo(cwd);
        const milestoneVersion = milestone.version || "unknown";
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        let entry = data.history.find((e) => e.milestone === milestoneVersion && e.date === today);
        if (entry) {
          entry.changes.push(...historyChanges);
        } else {
          entry = { milestone: milestoneVersion, date: today, changes: historyChanges };
          data.history.unshift(entry);
        }
      }
      const newContent = generateIntentMd(data);
      fs.writeFileSync(intentPath, newContent, "utf-8");
      const config = loadConfig(cwd);
      let commitHash = null;
      if (config.commit_docs && commitMessage) {
        execGit(cwd, ["add", ".planning/INTENT.md"]);
        const commitResult = execGit(cwd, ["commit", "-m", commitMessage]);
        if (commitResult.exitCode === 0) {
          const hashResult = execGit(cwd, ["rev-parse", "--short", "HEAD"]);
          commitHash = hashResult.exitCode === 0 ? hashResult.stdout : null;
        }
      }
      const result = {
        updated: true,
        section,
        operation,
        ...operationDetail,
        revision: data.revision,
        commit: commitHash
      };
      output(result, raw);
    }
    function getNextId(items, prefix) {
      let maxNum = 0;
      const pattern = new RegExp(`^${prefix}-(\\d+)$`);
      for (const item of items) {
        const match = item.id.match(pattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = (maxNum + 1).toString().padStart(2, "0");
      return `${prefix}-${nextNum}`;
    }
    function cmdIntentValidate(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) {
        error("No INTENT.md found. Run `intent create` first.");
      }
      const content = fs.readFileSync(intentPath, "utf-8");
      const data = parseIntentMd(content);
      const issues = [];
      const sections = {};
      if (data.objective && data.objective.statement && data.objective.statement.trim()) {
        sections.objective = { valid: true, message: "defined" };
      } else {
        sections.objective = { valid: false, message: "missing or empty" };
        issues.push({ section: "objective", type: "missing", message: "Objective: missing or empty" });
      }
      if (data.users && data.users.length > 0) {
        sections.users = { valid: true, count: data.users.length };
      } else {
        sections.users = { valid: false, count: 0, issues: ["missing or empty"] };
        issues.push({ section: "users", type: "missing", message: "Target Users: missing or empty" });
      }
      if (data.outcomes && data.outcomes.length > 0) {
        const outcomeIssues = [];
        const seenIds = /* @__PURE__ */ new Set();
        for (const o of data.outcomes) {
          if (!/^DO-\d+$/.test(o.id)) {
            outcomeIssues.push(`${o.id} has invalid format`);
          }
          if (seenIds.has(o.id)) {
            outcomeIssues.push(`duplicate ID ${o.id}`);
          }
          seenIds.add(o.id);
        }
        if (outcomeIssues.length > 0) {
          sections.outcomes = { valid: false, count: data.outcomes.length, issues: outcomeIssues };
          for (const iss of outcomeIssues) {
            issues.push({ section: "outcomes", type: "format", message: `Outcomes: ${iss}` });
          }
        } else {
          sections.outcomes = { valid: true, count: data.outcomes.length };
        }
      } else {
        sections.outcomes = { valid: false, count: 0, issues: ["no items defined (minimum 1)"] };
        issues.push({ section: "outcomes", type: "missing", message: "Outcomes: no items defined (minimum 1)" });
      }
      if (data.criteria && data.criteria.length > 0) {
        const criteriaIssues = [];
        const seenIds = /* @__PURE__ */ new Set();
        for (const c of data.criteria) {
          if (!/^SC-\d+$/.test(c.id)) {
            criteriaIssues.push(`${c.id} has invalid format`);
          }
          if (seenIds.has(c.id)) {
            criteriaIssues.push(`duplicate ID ${c.id}`);
          }
          seenIds.add(c.id);
        }
        if (criteriaIssues.length > 0) {
          sections.criteria = { valid: false, count: data.criteria.length, issues: criteriaIssues };
          for (const iss of criteriaIssues) {
            issues.push({ section: "criteria", type: "format", message: `Criteria: ${iss}` });
          }
        } else {
          sections.criteria = { valid: true, count: data.criteria.length };
        }
      } else {
        sections.criteria = { valid: false, count: 0, issues: ["no items defined (minimum 1)"] };
        issues.push({ section: "criteria", type: "missing", message: "Success Criteria: no items defined (minimum 1)" });
      }
      const techCount = data.constraints ? data.constraints.technical.length : 0;
      const bizCount = data.constraints ? data.constraints.business.length : 0;
      const timeCount = data.constraints ? data.constraints.timeline.length : 0;
      const totalConstraints = techCount + bizCount + timeCount;
      if (totalConstraints > 0) {
        const constraintIssues = [];
        const subSections = [];
        if (techCount > 0) subSections.push("technical");
        if (bizCount > 0) subSections.push("business");
        if (timeCount > 0) subSections.push("timeline");
        const seenIds = /* @__PURE__ */ new Set();
        const allConstraints = [
          ...data.constraints.technical || [],
          ...data.constraints.business || [],
          ...data.constraints.timeline || []
        ];
        for (const c of allConstraints) {
          if (!/^C-\d+$/.test(c.id)) {
            constraintIssues.push(`${c.id} has invalid format`);
          }
          if (seenIds.has(c.id)) {
            constraintIssues.push(`duplicate ID ${c.id}`);
          }
          seenIds.add(c.id);
        }
        if (constraintIssues.length > 0) {
          sections.constraints = { valid: false, count: totalConstraints, sub_sections: subSections, issues: constraintIssues };
          for (const iss of constraintIssues) {
            issues.push({ section: "constraints", type: "format", message: `Constraints: ${iss}` });
          }
        } else {
          sections.constraints = { valid: true, count: totalConstraints, sub_sections: subSections };
        }
      } else {
        const constraintsRaw = content.match(/<constraints>([\s\S]*?)<\/constraints>/);
        const rawText = constraintsRaw ? constraintsRaw[1] : "";
        const hasTechHeader = /^###\s*Technical/im.test(rawText);
        const hasBizHeader = /^###\s*Business/im.test(rawText);
        const hasTimeHeader = /^###\s*Timeline/im.test(rawText);
        if (hasTechHeader || hasBizHeader || hasTimeHeader) {
          const subSections = [];
          if (hasTechHeader) subSections.push("technical");
          if (hasBizHeader) subSections.push("business");
          if (hasTimeHeader) subSections.push("timeline");
          sections.constraints = { valid: true, count: 0, sub_sections: subSections };
        } else {
          sections.constraints = { valid: false, count: 0, issues: ["missing sub-sections (need at least ### Technical, ### Business, or ### Timeline)"] };
          issues.push({ section: "constraints", type: "missing", message: "Constraints: missing sub-sections" });
        }
      }
      const quantCount = data.health ? data.health.quantitative.length : 0;
      const hasQual = data.health && data.health.qualitative && data.health.qualitative.trim();
      const healthRaw = content.match(/<health>([\s\S]*?)<\/health>/);
      const healthText = healthRaw ? healthRaw[1] : "";
      const hasQuantHeader = /^###\s*Quantitative/im.test(healthText);
      const hasQualHeader = /^###\s*Qualitative/im.test(healthText);
      if (hasQuantHeader || hasQualHeader) {
        const healthIssues = [];
        if (quantCount > 0) {
          const seenIds = /* @__PURE__ */ new Set();
          for (const m of data.health.quantitative) {
            if (!/^HM-\d+$/.test(m.id)) {
              healthIssues.push(`${m.id} has invalid format`);
            }
            if (seenIds.has(m.id)) {
              healthIssues.push(`duplicate ID ${m.id}`);
            }
            seenIds.add(m.id);
          }
        }
        if (!hasQuantHeader) {
          healthIssues.push("missing ### Quantitative");
        }
        if (!hasQualHeader) {
          healthIssues.push("missing ### Qualitative");
        }
        if (healthIssues.length > 0) {
          sections.health = { valid: false, quantitative_count: quantCount, qualitative: !!hasQual, issues: healthIssues };
          for (const iss of healthIssues) {
            issues.push({ section: "health", type: "format", message: `Health: ${iss}` });
          }
        } else {
          sections.health = { valid: true, quantitative_count: quantCount, qualitative: !!hasQual };
        }
      } else {
        sections.health = { valid: false, quantitative_count: 0, qualitative: false, issues: ["missing or empty"] };
        issues.push({ section: "health", type: "missing", message: "Health Metrics: missing or empty" });
      }
      const warnings = [];
      if (data.history && data.history.length > 0) {
        const historyWarnings = [];
        for (const entry of data.history) {
          if (!entry.milestone) {
            historyWarnings.push("History entry missing milestone");
          }
          if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
            historyWarnings.push(`History entry has invalid date: ${entry.date || "(empty)"}`);
          }
          for (const change of entry.changes || []) {
            if (!change.type || !["Added", "Modified", "Removed"].includes(change.type)) {
              historyWarnings.push(`History change has invalid type: ${change.type || "(empty)"}`);
            }
            if (!change.target) {
              historyWarnings.push("History change missing target");
            }
          }
        }
        if (historyWarnings.length > 0) {
          sections.history = { valid: false, count: data.history.length, issues: historyWarnings };
          for (const warn of historyWarnings) {
            warnings.push({ section: "history", type: "warning", message: `History: ${warn}` });
          }
        } else {
          sections.history = { valid: true, count: data.history.length };
        }
      }
      const revision = data.revision;
      const revisionValid = revision !== null && Number.isInteger(revision) && revision > 0;
      const valid = issues.length === 0 && revisionValid;
      if (!revisionValid) {
        issues.push({ section: "revision", type: "missing", message: "Revision: missing or invalid" });
      }
      const result = {
        valid,
        issues,
        warnings,
        sections,
        revision: revision || null
      };
      if (raw) {
        process.stdout.write(JSON.stringify(result, null, 2));
        process.exit(valid ? 0 : 1);
      } else {
        const lines = [];
        lines.push("INTENT Validation \u2014 .planning/INTENT.md");
        lines.push("");
        const sym = (v) => v ? "\u2713" : "\u2717";
        lines.push(`${sym(sections.objective.valid)} Objective: ${sections.objective.message || "defined"}`);
        if (sections.users.valid) {
          lines.push(`${sym(true)} Target Users: ${sections.users.count} audience${sections.users.count !== 1 ? "s" : ""}`);
        } else {
          lines.push(`${sym(false)} Target Users: missing or empty`);
        }
        if (sections.outcomes.valid) {
          lines.push(`${sym(true)} Outcomes: ${sections.outcomes.count} items, IDs valid`);
        } else if (sections.outcomes.count > 0) {
          lines.push(`${sym(false)} Outcomes: ${(sections.outcomes.issues || []).join("; ")}`);
        } else {
          lines.push(`${sym(false)} Outcomes: no items defined (minimum 1)`);
        }
        if (sections.criteria.valid) {
          lines.push(`${sym(true)} Success Criteria: ${sections.criteria.count} items, IDs valid`);
        } else if (sections.criteria.count > 0) {
          lines.push(`${sym(false)} Success Criteria: ${(sections.criteria.issues || []).join("; ")}`);
        } else {
          lines.push(`${sym(false)} Success Criteria: no items defined (minimum 1)`);
        }
        if (sections.constraints.valid) {
          const subCount = (sections.constraints.sub_sections || []).length;
          lines.push(`${sym(true)} Constraints: ${subCount} sub-section${subCount !== 1 ? "s" : ""} (${(sections.constraints.sub_sections || []).join(", ")})`);
        } else {
          lines.push(`${sym(false)} Constraints: ${(sections.constraints.issues || []).join("; ")}`);
        }
        if (sections.health.valid) {
          lines.push(`${sym(true)} Health Metrics: quantitative (${sections.health.quantitative_count} items), qualitative ${sections.health.qualitative ? "defined" : "none"}`);
        } else {
          lines.push(`${sym(false)} Health Metrics: ${(sections.health.issues || []).join("; ")}`);
        }
        if (revisionValid) {
          lines.push(`${sym(true)} Revision: ${revision}`);
        } else {
          lines.push(`${sym(false)} Revision: missing or invalid`);
        }
        if (sections.history) {
          if (sections.history.valid) {
            lines.push(`${sym(true)} History: ${sections.history.count} milestone${sections.history.count !== 1 ? "s" : ""} recorded`);
          } else {
            lines.push(`\u26A0 History: ${(sections.history.issues || []).join("; ")}`);
          }
        }
        lines.push("");
        if (valid) {
          lines.push("Result: valid");
          if (warnings.length > 0) {
            lines.push(`Warnings: ${warnings.length} advisory issue${warnings.length !== 1 ? "s" : ""}`);
          }
        } else {
          lines.push(`Result: ${issues.length} issue${issues.length !== 1 ? "s" : ""} found`);
        }
        process.stdout.write(lines.join("\n") + "\n");
        process.exit(valid ? 0 : 1);
      }
    }
    function cmdIntentTrace(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) {
        error("No INTENT.md found. Run `intent create` first.");
      }
      const intentContent = fs.readFileSync(intentPath, "utf-8");
      const intentData = parseIntentMd(intentContent);
      if (!intentData.outcomes || intentData.outcomes.length === 0) {
        error("INTENT.md has no desired outcomes defined.");
      }
      const gapsOnly = args.includes("--gaps");
      const milestone = getMilestoneInfo(cwd);
      const phaseRange = milestone.phaseRange;
      const phasesDir = path.join(planningDir, "phases");
      const plans = [];
      if (fs.existsSync(phasesDir)) {
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          const phaseDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          for (const dir of phaseDirs) {
            const phaseNumMatch = dir.match(/^(\d+)/);
            if (phaseNumMatch && phaseRange) {
              const phaseNum = parseInt(phaseNumMatch[1], 10);
              if (phaseNum < phaseRange.start || phaseNum > phaseRange.end) continue;
            }
            const phaseDir = path.join(phasesDir, dir);
            const files = fs.readdirSync(phaseDir);
            const planFiles = files.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
            for (const planFile of planFiles) {
              const planPath = path.join(phaseDir, planFile);
              const planContent = fs.readFileSync(planPath, "utf-8");
              const fm = extractFrontmatter(planContent);
              const intentInfo = parsePlanIntent(planContent);
              const planPhase = fm.phase || dir;
              const planNum = fm.plan || planFile.replace(/-PLAN\.md$/, "").split("-").pop() || "01";
              const paddedPhase = normalizePhaseName(planPhase);
              const paddedPlan = String(planNum).padStart(2, "0");
              const planId = `${paddedPhase}-${paddedPlan}`;
              plans.push({
                plan_id: planId,
                phase: planPhase,
                outcome_ids: intentInfo ? intentInfo.outcome_ids : [],
                rationale: intentInfo ? intentInfo.rationale : ""
              });
            }
          }
        } catch (e) {
          debugLog("intent.trace", "scan phase dirs failed", e);
        }
      }
      const matrix = [];
      const gaps = [];
      let coveredCount = 0;
      for (const outcome of intentData.outcomes) {
        const tracingPlans = plans.filter((p) => p.outcome_ids.includes(outcome.id)).map((p) => p.plan_id);
        const entry = {
          outcome_id: outcome.id,
          priority: outcome.priority,
          text: outcome.text,
          plans: tracingPlans
        };
        matrix.push(entry);
        if (tracingPlans.length === 0) {
          gaps.push({
            outcome_id: outcome.id,
            priority: outcome.priority,
            text: outcome.text
          });
        } else {
          coveredCount++;
        }
      }
      const totalOutcomes = intentData.outcomes.length;
      const coveragePercent = totalOutcomes > 0 ? Math.round(coveredCount / totalOutcomes * 100) : 0;
      const priorityOrder = (a, b) => {
        const pa = parseInt((a.priority || "P9").replace("P", ""), 10);
        const pb = parseInt((b.priority || "P9").replace("P", ""), 10);
        return pa - pb;
      };
      const sortedMatrix = [
        ...matrix.filter((m) => m.plans.length === 0).sort(priorityOrder),
        ...matrix.filter((m) => m.plans.length > 0).sort(priorityOrder)
      ];
      const result = {
        total_outcomes: totalOutcomes,
        covered_outcomes: coveredCount,
        coverage_percent: coveragePercent,
        matrix: gapsOnly ? gaps.sort(priorityOrder) : sortedMatrix,
        gaps: gaps.sort(priorityOrder),
        plans: plans.map((p) => ({
          plan_id: p.plan_id,
          phase: p.phase,
          outcome_ids: p.outcome_ids
        }))
      };
      if (raw) {
        output(result, false);
        return;
      }
      const lines = [];
      lines.push("Intent Traceability \u2014 .planning/INTENT.md");
      lines.push(`Coverage: ${coveredCount}/${totalOutcomes} outcomes (${coveragePercent}%)`);
      lines.push("");
      if (gapsOnly) {
        if (gaps.length === 0) {
          lines.push("  No gaps \u2014 all outcomes have at least one plan tracing to them.");
        } else {
          for (const gap of gaps.sort(priorityOrder)) {
            lines.push(`  \u2717 ${gap.outcome_id} [${gap.priority}]: ${gap.text} \u2192 (no plans)`);
          }
        }
      } else {
        for (const entry of sortedMatrix) {
          if (entry.plans.length === 0) {
            lines.push(`  \u2717 ${entry.outcome_id} [${entry.priority}]: ${entry.text} \u2192 (no plans)`);
          } else {
            lines.push(`  \u2713 ${entry.outcome_id} [${entry.priority}]: ${entry.text} \u2192 ${entry.plans.join(", ")}`);
          }
        }
      }
      if (gaps.length > 0) {
        lines.push("");
        const gapCounts = {};
        for (const g of gaps) {
          gapCounts[g.priority] = (gapCounts[g.priority] || 0) + 1;
        }
        const gapParts = Object.entries(gapCounts).sort(([a], [b]) => a.localeCompare(b)).map(([p, c]) => `${c}\xD7${p}`);
        lines.push(`Gaps: ${gaps.length} outcomes uncovered (${gapParts.join(", ")})`);
      }
      output(null, true, lines.join("\n") + "\n");
    }
    function calculateDriftScore(data) {
      const { outcomes, plans, signalData } = data;
      const totalOutcomes = outcomes.length;
      const totalPlans = plans.length;
      let coverageGap = 0;
      if (totalOutcomes > 0) {
        let weightedGapSum = 0;
        let weightedTotal = 0;
        for (const o of outcomes) {
          const weight = o.priority === "P1" ? 3 : o.priority === "P2" ? 2 : 1;
          weightedTotal += weight;
          if (!signalData.coveredOutcomeIds.has(o.id)) {
            weightedGapSum += weight;
          }
        }
        coverageGap = weightedTotal > 0 ? weightedGapSum / weightedTotal * 40 : 0;
      }
      let objectiveMismatch = 0;
      if (totalPlans > 0) {
        const untracedCount = signalData.untracedPlans.length;
        objectiveMismatch = untracedCount / totalPlans * 25;
      }
      let featureCreep = 0;
      const totalRefs = signalData.totalOutcomeRefs;
      if (totalRefs > 0) {
        featureCreep = signalData.invalidRefs.length / totalRefs * 15;
      }
      const priorityInversion = signalData.inversions.length > 0 ? 20 : 0;
      const score = Math.round(Math.min(100, Math.max(0, coverageGap + objectiveMismatch + featureCreep + priorityInversion)));
      return {
        score,
        components: {
          coverage_gap: Math.round(coverageGap * 10) / 10,
          objective_mismatch: Math.round(objectiveMismatch * 10) / 10,
          feature_creep: Math.round(featureCreep * 10) / 10,
          priority_inversion: Math.round(priorityInversion * 10) / 10
        }
      };
    }
    function getAlignmentLabel(score) {
      if (score <= 15) return "excellent";
      if (score <= 35) return "good";
      if (score <= 60) return "moderate";
      return "poor";
    }
    function getIntentDriftData(cwd) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) return null;
      const intentContent = fs.readFileSync(intentPath, "utf-8");
      const intentData = parseIntentMd(intentContent);
      if (!intentData.outcomes || intentData.outcomes.length === 0) return null;
      const outcomes = intentData.outcomes;
      const validOutcomeIds = new Set(outcomes.map((o) => o.id));
      const milestone = getMilestoneInfo(cwd);
      const phaseRange = milestone.phaseRange;
      const phasesDir = path.join(planningDir, "phases");
      const plans = [];
      if (fs.existsSync(phasesDir)) {
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          const phaseDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
          for (const dir of phaseDirs) {
            const phaseNumMatch = dir.match(/^(\d+)/);
            if (phaseNumMatch && phaseRange) {
              const phaseNum = parseInt(phaseNumMatch[1], 10);
              if (phaseNum < phaseRange.start || phaseNum > phaseRange.end) continue;
            }
            const phaseDir = path.join(phasesDir, dir);
            const files = fs.readdirSync(phaseDir);
            const planFiles = files.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
            for (const planFile of planFiles) {
              const planPath = path.join(phaseDir, planFile);
              const planContent = fs.readFileSync(planPath, "utf-8");
              const fm = extractFrontmatter(planContent);
              const intentInfo = parsePlanIntent(planContent);
              const planPhase = fm.phase || dir;
              const planNum = fm.plan || planFile.replace(/-PLAN\.md$/, "").split("-").pop() || "01";
              const paddedPhase = normalizePhaseName(planPhase);
              const paddedPlan = String(planNum).padStart(2, "0");
              const planId = `${paddedPhase}-${paddedPlan}`;
              plans.push({
                plan_id: planId,
                phase: planPhase,
                outcome_ids: intentInfo ? intentInfo.outcome_ids : []
              });
            }
          }
        } catch (e) {
          debugLog("intent.drift", "scan phase dirs failed", e);
        }
      }
      const coveredOutcomeIds = /* @__PURE__ */ new Set();
      for (const plan of plans) {
        for (const id of plan.outcome_ids) {
          if (validOutcomeIds.has(id)) {
            coveredOutcomeIds.add(id);
          }
        }
      }
      const coverageGapDetails = outcomes.filter((o) => !coveredOutcomeIds.has(o.id)).sort((a, b) => {
        const pa = parseInt(a.priority.replace("P", ""), 10);
        const pb = parseInt(b.priority.replace("P", ""), 10);
        return pa - pb;
      }).map((o) => ({ outcome_id: o.id, priority: o.priority, text: o.text }));
      const untracedPlans = plans.filter((p) => p.outcome_ids.length === 0).map((p) => p.plan_id);
      const invalidRefs = [];
      let totalOutcomeRefs = 0;
      for (const plan of plans) {
        for (const id of plan.outcome_ids) {
          totalOutcomeRefs++;
          if (!validOutcomeIds.has(id)) {
            invalidRefs.push({ plan_id: plan.plan_id, invalid_id: id });
          }
        }
      }
      const inversions = [];
      const uncoveredP1 = outcomes.filter((o) => o.priority === "P1" && !coveredOutcomeIds.has(o.id));
      const coveredP2P3 = outcomes.filter(
        (o) => (o.priority === "P2" || o.priority === "P3") && coveredOutcomeIds.has(o.id)
      );
      for (const p1 of uncoveredP1) {
        for (const lower of coveredP2P3) {
          const lowerPlanCount = plans.filter((p) => p.outcome_ids.includes(lower.id)).length;
          inversions.push({
            uncovered: { outcome_id: p1.id, priority: p1.priority, text: p1.text },
            covered: { outcome_id: lower.id, priority: lower.priority, text: lower.text, plan_count: lowerPlanCount }
          });
        }
      }
      const signalData = {
        coveredOutcomeIds,
        untracedPlans,
        invalidRefs,
        totalOutcomeRefs,
        inversions
      };
      const { score, components } = calculateDriftScore({ outcomes, plans, signalData });
      const alignment = getAlignmentLabel(score);
      return {
        drift_score: score,
        alignment,
        signals: {
          coverage_gap: {
            score: components.coverage_gap,
            details: coverageGapDetails
          },
          objective_mismatch: {
            score: components.objective_mismatch,
            plans: untracedPlans
          },
          feature_creep: {
            score: components.feature_creep,
            invalid_refs: invalidRefs
          },
          priority_inversion: {
            score: components.priority_inversion,
            inversions: inversions.map((inv) => ({
              uncovered_id: inv.uncovered.outcome_id,
              uncovered_priority: inv.uncovered.priority,
              covered_id: inv.covered.outcome_id,
              covered_priority: inv.covered.priority,
              covered_plan_count: inv.covered.plan_count
            }))
          }
        },
        total_outcomes: outcomes.length,
        covered_outcomes: coveredOutcomeIds.size,
        total_plans: plans.length,
        traced_plans: plans.length - untracedPlans.length
      };
    }
    function cmdIntentDrift(cwd, args, raw) {
      const planningDir = path.join(cwd, ".planning");
      const intentPath = path.join(planningDir, "INTENT.md");
      if (!fs.existsSync(intentPath)) {
        error("No INTENT.md found. Run `intent create` first.");
      }
      const data = getIntentDriftData(cwd);
      if (!data) {
        error("INTENT.md has no desired outcomes defined.");
      }
      if (raw) {
        output(data, false);
        return;
      }
      const isTTY = process.stdout.isTTY;
      const lines = [];
      let scoreLabel = `${data.drift_score}/100 (${data.alignment})`;
      if (isTTY) {
        if (data.alignment === "excellent") scoreLabel = `\x1B[32m${scoreLabel}\x1B[0m`;
        else if (data.alignment === "moderate") scoreLabel = `\x1B[33m${scoreLabel}\x1B[0m`;
        else if (data.alignment === "poor") scoreLabel = `\x1B[31m${scoreLabel}\x1B[0m`;
      }
      lines.push("Intent Drift Analysis");
      lines.push(`Score: ${scoreLabel}`);
      lines.push("");
      const cg = data.signals.coverage_gap;
      lines.push(`Coverage Gaps (${cg.score} pts):`);
      if (cg.details.length === 0) {
        lines.push("  \u2713 All outcomes have plans");
      } else {
        for (const gap of cg.details) {
          lines.push(`  \u2717 ${gap.outcome_id} [${gap.priority}]: ${gap.text} \u2014 no plans`);
        }
      }
      lines.push("");
      const om = data.signals.objective_mismatch;
      lines.push(`Objective Mismatch (${om.score} pts):`);
      if (om.plans.length === 0) {
        lines.push("  \u2713 All plans have intent sections");
      } else {
        for (const planId of om.plans) {
          lines.push(`  \u2717 ${planId}: no intent section in frontmatter`);
        }
      }
      lines.push("");
      const fc = data.signals.feature_creep;
      lines.push(`Feature Creep (${fc.score} pts):`);
      if (fc.invalid_refs.length === 0) {
        lines.push("  \u2713 No invalid outcome references");
      } else {
        for (const ref of fc.invalid_refs) {
          lines.push(`  \u2717 ${ref.plan_id}: references non-existent ${ref.invalid_id}`);
        }
      }
      lines.push("");
      const pi = data.signals.priority_inversion;
      lines.push(`Priority Inversion (${pi.score} pts):`);
      if (pi.inversions.length === 0) {
        lines.push("  \u2713 No priority inversions");
      } else {
        for (const inv of pi.inversions) {
          lines.push(`  \u26A0 ${inv.uncovered_id} [${inv.uncovered_priority}] uncovered, but ${inv.covered_id} [${inv.covered_priority}] has ${inv.covered_plan_count} plan${inv.covered_plan_count !== 1 ? "s" : ""}`);
        }
      }
      lines.push("");
      lines.push(`Summary: ${data.covered_outcomes}/${data.total_outcomes} outcomes covered, ${data.traced_plans}/${data.total_plans} plans traced`);
      output(null, true, lines.join("\n") + "\n");
    }
    function getIntentSummary(cwd) {
      const intentPath = path.join(cwd, ".planning", "INTENT.md");
      if (!fs.existsSync(intentPath)) return null;
      const content = fs.readFileSync(intentPath, "utf-8");
      const data = parseIntentMd(content);
      if (!data.objective || !data.objective.statement) return null;
      return {
        objective: data.objective.statement,
        outcome_count: (data.outcomes || []).length,
        top_outcomes: (data.outcomes || []).filter((o) => o.priority === "P1").slice(0, 3).map((o) => ({ id: o.id, text: o.text })),
        users: (data.users || []).slice(0, 3).map((u) => u.text),
        has_criteria: (data.criteria || []).length > 0
      };
    }
    module2.exports = {
      cmdIntentCreate,
      cmdIntentShow,
      cmdIntentUpdate,
      cmdIntentValidate,
      cmdIntentTrace,
      cmdIntentDrift,
      getIntentDriftData,
      getIntentSummary
    };
  }
});

// src/commands/env.js
var require_env = __commonJS({
  "src/commands/env.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { execFileSync } = require("child_process");
    var { output, error, debugLog } = require_output();
    var LANG_MANIFESTS = [
      { file: "package.json", language: "node", binary: "node", versionFlag: "--version" },
      { file: "go.mod", language: "go", binary: "go", versionFlag: "version" },
      { file: "mix.exs", language: "elixir", binary: "elixir", versionFlag: "--version" },
      { file: "Cargo.toml", language: "rust", binary: "cargo", versionFlag: "--version" },
      { file: "pyproject.toml", language: "python", binary: "python3", versionFlag: "--version" },
      { file: "setup.py", language: "python", binary: "python3", versionFlag: "--version" },
      { file: "requirements.txt", language: "python", binary: "python3", versionFlag: "--version" },
      { file: "Gemfile", language: "ruby", binary: "ruby", versionFlag: "--version" },
      { file: "composer.json", language: "php", binary: "php", versionFlag: "--version" },
      { file: "build.gradle", language: "java", binary: "java", versionFlag: "--version" },
      { file: "build.gradle.kts", language: "kotlin", binary: "java", versionFlag: "--version" },
      { file: "pom.xml", language: "java", binary: "java", versionFlag: "--version" },
      { file: "Package.swift", language: "swift", binary: "swift", versionFlag: "--version" },
      { file: "CMakeLists.txt", language: "cpp", binary: "cc", versionFlag: "--version" },
      { file: "Makefile", language: "make", binary: "make", versionFlag: "--version" },
      { file: "Justfile", language: "just", binary: "just", versionFlag: "--version" },
      { file: "Dockerfile", language: "docker", binary: "docker", versionFlag: "--version" },
      { file: "docker-compose.yml", language: "docker", binary: "docker", versionFlag: "--version" },
      { file: "docker-compose.yaml", language: "docker", binary: "docker", versionFlag: "--version" },
      { file: "compose.yml", language: "docker", binary: "docker", versionFlag: "--version" },
      { file: "compose.yaml", language: "docker", binary: "docker", versionFlag: "--version" },
      { file: "flake.nix", language: "nix", binary: "nix", versionFlag: "--version" },
      { file: "deno.json", language: "deno", binary: "deno", versionFlag: "--version" },
      { file: "deno.jsonc", language: "deno", binary: "deno", versionFlag: "--version" },
      { file: "bun.lockb", language: "bun", binary: "bun", versionFlag: "--version" },
      { file: "bunfig.toml", language: "bun", binary: "bun", versionFlag: "--version" }
    ];
    var SKIP_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      "vendor",
      "deps",
      "_build",
      ".git",
      ".next",
      "target",
      "dist",
      "build",
      "__pycache__",
      ".elixir_ls",
      ".cache"
    ]);
    var PM_LOCKFILES = [
      { file: "bun.lock", pm: "bun" },
      { file: "bun.lockb", pm: "bun" },
      { file: "pnpm-lock.yaml", pm: "pnpm" },
      { file: "yarn.lock", pm: "yarn" },
      { file: "package-lock.json", pm: "npm" },
      // Non-Node lockfiles
      { file: "mix.lock", pm: "mix" },
      { file: "go.sum", pm: "go-modules" },
      { file: "Cargo.lock", pm: "cargo" },
      { file: "Gemfile.lock", pm: "bundler" },
      { file: "poetry.lock", pm: "poetry" },
      { file: "Pipfile.lock", pm: "pipenv" }
    ];
    var VERSION_MANAGERS = [
      { file: ".tool-versions", name: "asdf" },
      { file: "mise.toml", name: "mise" },
      { file: ".mise.toml", name: "mise" },
      { file: ".nvmrc", name: "nvm" },
      { file: ".node-version", name: "node-version" },
      { file: ".python-version", name: "pyenv" },
      { file: ".ruby-version", name: "rbenv" },
      { file: ".go-version", name: "goenv" }
    ];
    var CI_CONFIGS = [
      { check: "dir", path: ".github/workflows", platform: "github-actions" },
      { check: "file", path: ".gitlab-ci.yml", platform: "gitlab-ci" },
      { check: "dir", path: ".circleci", platform: "circleci" },
      { check: "file", path: "Jenkinsfile", platform: "jenkins" },
      { check: "file", path: ".travis.yml", platform: "travis" }
    ];
    var TEST_CONFIGS = [
      { pattern: "jest.config.*", name: "jest" },
      { pattern: "vitest.config.*", name: "vitest" },
      { pattern: ".mocharc.*", name: "mocha" },
      { pattern: "pytest.ini", name: "pytest" },
      { pattern: "setup.cfg", name: "pytest", check: "[tool:pytest]" },
      { pattern: "tox.ini", name: "tox" }
    ];
    var LINT_CONFIGS = [
      { pattern: ".eslintrc*", name: "eslint", type: "linter" },
      { pattern: "eslint.config.*", name: "eslint", type: "linter" },
      { pattern: ".prettierrc*", name: "prettier", type: "formatter" },
      { pattern: "prettier.config.*", name: "prettier", type: "formatter" },
      { pattern: "biome.json", name: "biome", type: "both" },
      { pattern: "biome.jsonc", name: "biome", type: "both" },
      { pattern: ".credo.exs", name: "credo", type: "linter" },
      { pattern: ".golangci.yml", name: "golangci-lint", type: "linter" },
      { pattern: ".golangci.yaml", name: "golangci-lint", type: "linter" },
      { pattern: "rustfmt.toml", name: "rustfmt", type: "formatter" },
      { pattern: ".rubocop.yml", name: "rubocop", type: "both" }
    ];
    var WELL_KNOWN_SCRIPTS = ["test", "build", "lint", "start", "deploy", "format", "check"];
    function scanManifests(rootDir, maxDepth) {
      const results = [];
      function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
              walk(path.join(dir, entry.name), depth + 1);
            }
          } else if (entry.isFile()) {
            for (const manifest of LANG_MANIFESTS) {
              if (entry.name === manifest.file) {
                results.push({
                  language: manifest.language,
                  file: manifest.file,
                  path: path.relative(rootDir, path.join(dir, entry.name)),
                  depth,
                  binary: manifest.binary,
                  versionFlag: manifest.versionFlag
                });
              }
            }
          }
        }
      }
      walk(rootDir, 0);
      return results;
    }
    function determinePrimaryLanguage(manifests) {
      if (manifests.length === 0) return null;
      const langStats = {};
      for (const m of manifests) {
        if (!langStats[m.language]) {
          langStats[m.language] = { rootCount: 0, totalCount: 0 };
        }
        langStats[m.language].totalCount++;
        if (m.depth === 0) langStats[m.language].rootCount++;
      }
      const sorted = Object.entries(langStats).sort((a, b) => {
        if (b[1].rootCount !== a[1].rootCount) return b[1].rootCount - a[1].rootCount;
        return b[1].totalCount - a[1].totalCount;
      });
      return sorted[0][0];
    }
    function buildLanguageEntries(manifests, primaryLang) {
      const byLang = {};
      for (const m of manifests) {
        if (!byLang[m.language]) {
          byLang[m.language] = {
            name: m.language,
            primary: m.language === primaryLang,
            manifests: [],
            binary: { name: m.binary, versionFlag: m.versionFlag, available: false, version: null, path: null }
          };
        }
        byLang[m.language].manifests.push({ file: m.file, path: m.path, depth: m.depth });
      }
      return Object.values(byLang);
    }
    function checkBinary(binaryName, versionFlag) {
      const result = { available: false, version: null, path: null };
      const timeout = 3e3;
      try {
        const whichResult = execFileSync("which", [binaryName], {
          encoding: "utf-8",
          timeout,
          stdio: "pipe"
        }).trim();
        if (whichResult) {
          result.available = true;
          result.path = whichResult;
          try {
            const flagArgs = versionFlag.split(/\s+/);
            const versionOut = execFileSync(binaryName, flagArgs, {
              encoding: "utf-8",
              timeout,
              stdio: "pipe"
            }).trim();
            const versionMatch = versionOut.match(/(\d+\.\d+[\.\d]*)/);
            if (versionMatch) {
              result.version = versionMatch[1];
            }
          } catch {
            debugLog("env.binary", `version check failed for ${binaryName}`);
          }
        }
      } catch {
        debugLog("env.binary", `${binaryName} not found on PATH`);
      }
      return result;
    }
    function detectPackageManager(rootDir) {
      const result = { name: null, version: null, source: null, detected_from: null };
      const pkgJsonPath = path.join(rootDir, "package.json");
      try {
        if (fs.existsSync(pkgJsonPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
          if (pkg.packageManager) {
            const match = pkg.packageManager.match(/^([^@]+)(?:@(.+))?$/);
            if (match) {
              result.name = match[1];
              result.version = match[2] || null;
              result.source = "packageManager-field";
              result.detected_from = "package.json";
              return result;
            }
          }
        }
      } catch {
        debugLog("env.pm", "package.json parse failed");
      }
      for (const lockfile of PM_LOCKFILES) {
        if (fs.existsSync(path.join(rootDir, lockfile.file))) {
          result.name = lockfile.pm;
          result.source = "lockfile";
          result.detected_from = lockfile.file;
          return result;
        }
      }
      return result;
    }
    function detectVersionManagers(rootDir) {
      const results = [];
      for (const vm of VERSION_MANAGERS) {
        const filePath = path.join(rootDir, vm.file);
        if (fs.existsSync(filePath)) {
          const entry = { name: vm.name, file: vm.file, configured_versions: {} };
          try {
            const content = fs.readFileSync(filePath, "utf-8").trim();
            if (vm.file === ".nvmrc" || vm.file === ".node-version") {
              entry.configured_versions.node = content.replace(/^v/, "");
            } else if (vm.file === ".python-version") {
              entry.configured_versions.python = content;
            } else if (vm.file === ".ruby-version") {
              entry.configured_versions.ruby = content;
            } else if (vm.file === ".go-version") {
              entry.configured_versions.go = content;
            } else if (vm.file === ".tool-versions") {
              for (const line of content.split("\n")) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2 && !parts[0].startsWith("#")) {
                  entry.configured_versions[parts[0]] = parts[1];
                }
              }
            } else if (vm.file === "mise.toml" || vm.file === ".mise.toml") {
              const toolsMatch = content.match(/\[tools\]\s*\n((?:.*\n?)*?)(?:\n\[|$)/);
              if (toolsMatch) {
                for (const line of toolsMatch[1].split("\n")) {
                  const kvMatch = line.match(/^\s*(\w+)\s*=\s*["']?([^"'\s]+)["']?/);
                  if (kvMatch) {
                    entry.configured_versions[kvMatch[1]] = kvMatch[2];
                  }
                }
              }
            }
          } catch {
            debugLog("env.vm", `failed to parse ${vm.file}`);
          }
          results.push(entry);
        }
      }
      return results;
    }
    function detectCI(rootDir) {
      for (const ci of CI_CONFIGS) {
        const fullPath = path.join(rootDir, ci.path);
        try {
          if (ci.check === "dir") {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              return { platform: ci.platform, config_file: ci.path };
            }
          } else {
            if (fs.existsSync(fullPath)) {
              return { platform: ci.platform, config_file: ci.path };
            }
          }
        } catch {
        }
      }
      return null;
    }
    function detectTestFrameworks(rootDir) {
      const results = [];
      const seen = /* @__PURE__ */ new Set();
      for (const tc of TEST_CONFIGS) {
        try {
          const dir = fs.readdirSync(rootDir);
          for (const entry of dir) {
            if (matchSimpleGlob(entry, tc.pattern)) {
              if (tc.check) {
                const content = fs.readFileSync(path.join(rootDir, entry), "utf-8");
                if (!content.includes(tc.check)) continue;
              }
              if (!seen.has(tc.name)) {
                seen.add(tc.name);
                results.push({ name: tc.name, config_file: entry });
              }
            }
          }
        } catch {
        }
      }
      for (const testDir of ["test", "tests", "spec", "__tests__"]) {
        try {
          const fullPath = path.join(rootDir, testDir);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            results.push({ name: testDir, config_file: null });
          }
        } catch {
        }
      }
      return results;
    }
    function detectLintFormat(rootDir) {
      const linters = [];
      const formatters = [];
      const seen = /* @__PURE__ */ new Set();
      try {
        const dir = fs.readdirSync(rootDir);
        for (const entry of dir) {
          for (const lc of LINT_CONFIGS) {
            if (matchSimpleGlob(entry, lc.pattern) && !seen.has(lc.name)) {
              seen.add(lc.name);
              const item = { name: lc.name, config_file: entry };
              if (lc.type === "linter" || lc.type === "both") linters.push(item);
              if (lc.type === "formatter" || lc.type === "both") formatters.push(item);
            }
          }
        }
      } catch {
      }
      return { linters, formatters };
    }
    function matchSimpleGlob(name, pattern) {
      if (!pattern.includes("*")) return name === pattern;
      const starIdx = pattern.indexOf("*");
      const prefix = pattern.slice(0, starIdx);
      const suffix = pattern.slice(starIdx + 1);
      if (suffix) {
        return name.startsWith(prefix) && name.endsWith(suffix);
      }
      return name.startsWith(prefix);
    }
    function detectScripts(rootDir) {
      const scripts = {};
      try {
        const pkgPath = path.join(rootDir, "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg.scripts) {
            for (const name of WELL_KNOWN_SCRIPTS) {
              if (pkg.scripts[name]) {
                scripts[name] = pkg.scripts[name];
              }
            }
          }
        }
      } catch {
        debugLog("env.scripts", "package.json parse failed");
      }
      try {
        const makefilePath = path.join(rootDir, "Makefile");
        if (fs.existsSync(makefilePath)) {
          const content = fs.readFileSync(makefilePath, "utf-8");
          const targets = [];
          for (const line of content.split("\n")) {
            const match = line.match(/^([a-zA-Z_][\w-]*):/);
            if (match && !match[1].startsWith(".")) {
              targets.push(match[1]);
            }
          }
          if (targets.length > 0) {
            scripts._makefile_targets = targets;
          }
        }
      } catch {
        debugLog("env.scripts", "Makefile parse failed");
      }
      try {
        const justfilePath = path.join(rootDir, "Justfile");
        if (fs.existsSync(justfilePath)) {
          const content = fs.readFileSync(justfilePath, "utf-8");
          const targets = [];
          for (const line of content.split("\n")) {
            const match = line.match(/^([a-zA-Z_][\w-]*)(?:\s.*)?:/);
            if (match) {
              targets.push(match[1]);
            }
          }
          if (targets.length > 0) {
            scripts._justfile_targets = targets;
          }
        }
      } catch {
        debugLog("env.scripts", "Justfile parse failed");
      }
      try {
        const mixPath = path.join(rootDir, "mix.exs");
        if (fs.existsSync(mixPath)) {
          const result = execFileSync("mix", ["help", "--names"], {
            cwd: rootDir,
            encoding: "utf-8",
            timeout: 3e3,
            stdio: "pipe"
          }).trim();
          if (result) {
            const aliases = result.split("\n").filter((l) => l.trim());
            if (aliases.length > 0) {
              scripts._mix_tasks = aliases.slice(0, 20);
            }
          }
        }
      } catch {
        debugLog("env.scripts", "mix help failed");
      }
      return scripts;
    }
    function detectInfraServices(rootDir) {
      const dockerServices = [];
      const composeFiles = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
      for (const file of composeFiles) {
        const filePath = path.join(rootDir, file);
        try {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const servicesMatch = content.match(/^services:\s*\n((?:[ \t]+\S.*\n?)*)/m);
            if (servicesMatch) {
              const serviceLines = servicesMatch[1].split("\n");
              for (const line of serviceLines) {
                const match = line.match(/^[ \t]{2}(\w[\w-]*):/);
                if (match) {
                  dockerServices.push(match[1]);
                }
              }
            }
          }
        } catch {
          debugLog("env.infra", `failed to parse ${file}`);
        }
      }
      return dockerServices;
    }
    function detectMcpServers(rootDir) {
      const servers = [];
      try {
        const mcpPath = path.join(rootDir, ".mcp.json");
        if (fs.existsSync(mcpPath)) {
          const content = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
          if (content.mcpServers && typeof content.mcpServers === "object") {
            for (const name of Object.keys(content.mcpServers)) {
              servers.push(name);
            }
          }
        }
      } catch {
        debugLog("env.mcp", ".mcp.json parse failed");
      }
      return servers;
    }
    function detectMonorepo(rootDir) {
      try {
        const pkgPath = path.join(rootDir, "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg.workspaces) {
            const members = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || [];
            return { type: "npm-workspaces", members };
          }
        }
      } catch {
      }
      try {
        const pnpmWsPath = path.join(rootDir, "pnpm-workspace.yaml");
        if (fs.existsSync(pnpmWsPath)) {
          const content = fs.readFileSync(pnpmWsPath, "utf-8");
          const members = [];
          const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
          if (packagesMatch) {
            for (const line of packagesMatch[1].split("\n")) {
              const m = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
              if (m) members.push(m[1]);
            }
          }
          return { type: "pnpm-workspaces", members };
        }
      } catch {
      }
      try {
        const goWorkPath = path.join(rootDir, "go.work");
        if (fs.existsSync(goWorkPath)) {
          const content = fs.readFileSync(goWorkPath, "utf-8");
          const members = [];
          const useMatch = content.match(/use\s*\(([\s\S]*?)\)/);
          if (useMatch) {
            for (const line of useMatch[1].split("\n")) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith("//")) {
                members.push(trimmed);
              }
            }
          }
          return { type: "go-workspace", members };
        }
      } catch {
      }
      try {
        const mixPath = path.join(rootDir, "mix.exs");
        if (fs.existsSync(mixPath)) {
          const content = fs.readFileSync(mixPath, "utf-8");
          if (content.includes("apps_path")) {
            const appsDir = path.join(rootDir, "apps");
            if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
              const members = fs.readdirSync(appsDir).filter((d) => {
                try {
                  return fs.statSync(path.join(appsDir, d)).isDirectory();
                } catch {
                  return false;
                }
              });
              return { type: "elixir-umbrella", members };
            }
          }
        }
      } catch {
      }
      return null;
    }
    function getWatchedFiles(cwd, manifests) {
      const watched = /* @__PURE__ */ new Set();
      for (const m of manifests) {
        if (m.depth === 0) {
          watched.add(m.file);
        }
      }
      for (const lf of PM_LOCKFILES) {
        if (fs.existsSync(path.join(cwd, lf.file))) {
          watched.add(lf.file);
        }
      }
      for (const vm of VERSION_MANAGERS) {
        if (fs.existsSync(path.join(cwd, vm.file))) {
          watched.add(vm.file);
        }
      }
      for (const dcFile of ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]) {
        if (fs.existsSync(path.join(cwd, dcFile))) {
          watched.add(dcFile);
        }
      }
      return Array.from(watched).sort();
    }
    function getWatchedFilesMtimes(cwd, watchedFiles) {
      const mtimes = {};
      for (const file of watchedFiles) {
        try {
          const stat = fs.statSync(path.join(cwd, file));
          mtimes[file] = stat.mtimeMs;
        } catch {
        }
      }
      return mtimes;
    }
    function ensureManifestGitignored(cwd) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return;
      const planningGitignore = path.join(planningDir, ".gitignore");
      if (fs.existsSync(planningGitignore)) {
        const content = fs.readFileSync(planningGitignore, "utf-8");
        if (content.includes("env-manifest.json")) return;
        const newContent = content.endsWith("\n") ? content + "env-manifest.json\n" : content + "\nenv-manifest.json\n";
        fs.writeFileSync(planningGitignore, newContent);
        return;
      }
      const rootGitignore = path.join(cwd, ".gitignore");
      if (fs.existsSync(rootGitignore)) {
        const content = fs.readFileSync(rootGitignore, "utf-8");
        if (content.includes("env-manifest.json")) return;
      }
      fs.writeFileSync(planningGitignore, "env-manifest.json\n");
    }
    function writeProjectProfile(cwd, result) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return;
      const ci = result.tools && result.tools.ci;
      const infraServices = result.infrastructure && result.infrastructure.docker_services ? result.infrastructure.docker_services : [];
      const profile = {
        "$schema_version": "1.0",
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        languages: result.languages.map((l) => l.name),
        primary_language: (result.languages.find((l) => l.primary) || {}).name || null,
        package_manager: result.package_manager ? result.package_manager.name : null,
        monorepo: result.monorepo || null,
        ci_platform: ci ? ci.platform : null,
        infrastructure_services: infraServices
      };
      const profilePath = path.join(planningDir, "project-profile.json");
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + "\n");
    }
    function checkEnvManifestStaleness(cwd) {
      const manifestPath = path.join(cwd, ".planning", "env-manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { stale: true, reason: "no_manifest" };
      }
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      } catch {
        return { stale: true, reason: "corrupt_manifest" };
      }
      if (!manifest.watched_files_mtimes) {
        return { stale: true, reason: "no_mtime_data" };
      }
      const changedFiles = [];
      for (const file of manifest.watched_files || []) {
        const filePath = path.join(cwd, file);
        try {
          const currentMtime = fs.statSync(filePath).mtimeMs;
          const recordedMtime = manifest.watched_files_mtimes[file];
          if (recordedMtime === void 0 || currentMtime > recordedMtime) {
            changedFiles.push(file);
          }
        } catch {
          if (manifest.watched_files_mtimes[file] !== void 0) {
            changedFiles.push(file);
          }
        }
      }
      const knownFilesSet = /* @__PURE__ */ new Set([
        ...LANG_MANIFESTS.map((m) => m.file),
        ...PM_LOCKFILES.map((l) => l.file),
        ...VERSION_MANAGERS.map((v) => v.file)
      ]);
      const trackedSet = new Set(manifest.watched_files || []);
      for (const file of knownFilesSet) {
        if (!trackedSet.has(file) && fs.existsSync(path.join(cwd, file))) {
          changedFiles.push(file);
          break;
        }
      }
      if (changedFiles.length > 0) {
        return { stale: true, reason: "files_changed", changed_files: [...new Set(changedFiles)] };
      }
      return { stale: false };
    }
    function performEnvScan(cwd, options = {}) {
      const { skipBinaryVersions = false } = options;
      const startMs = Date.now();
      const manifests = scanManifests(cwd, 3);
      const primaryLang = determinePrimaryLanguage(manifests);
      const languages = buildLanguageEntries(manifests, primaryLang);
      if (!skipBinaryVersions) {
        for (const lang of languages) {
          const binaryResult = checkBinary(lang.binary.name, lang.binary.versionFlag);
          lang.binary.available = binaryResult.available;
          lang.binary.version = binaryResult.version;
          lang.binary.path = binaryResult.path;
        }
        const elixirLang = languages.find((l) => l.name === "elixir");
        if (elixirLang) {
          const mixResult = checkBinary("mix", "--version");
          elixirLang.binary.extra = { name: "mix", ...mixResult };
        }
      }
      const packageManager = detectPackageManager(cwd);
      const versionManagers = detectVersionManagers(cwd);
      const ci = detectCI(cwd);
      const testFrameworks = detectTestFrameworks(cwd);
      const { linters, formatters } = detectLintFormat(cwd);
      const scripts = detectScripts(cwd);
      const dockerServices = detectInfraServices(cwd);
      const mcpServers = detectMcpServers(cwd);
      const monorepo = detectMonorepo(cwd);
      const detectionMs = Date.now() - startMs;
      const watchedFiles = getWatchedFiles(cwd, manifests);
      const watchedFilesMtimes = getWatchedFilesMtimes(cwd, watchedFiles);
      return {
        "$schema_version": "1.0",
        scanned_at: (/* @__PURE__ */ new Date()).toISOString(),
        detection_ms: detectionMs,
        languages,
        package_manager: packageManager,
        version_managers: versionManagers,
        tools: {
          ci,
          test_frameworks: testFrameworks,
          linters,
          formatters
        },
        scripts,
        infrastructure: {
          docker_services: dockerServices,
          mcp_servers: mcpServers
        },
        monorepo,
        watched_files: watchedFiles,
        watched_files_mtimes: watchedFilesMtimes
      };
    }
    function writeManifest(cwd, result) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return false;
      const manifestPath = path.join(planningDir, "env-manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2) + "\n");
      return true;
    }
    function cmdEnvScan(cwd, args, raw) {
      const force = args.includes("--force");
      const verbose = global._gsdCompactMode === false;
      if (!force) {
        const staleness = checkEnvManifestStaleness(cwd);
        if (!staleness.stale) {
          const manifestPath = path.join(cwd, ".planning", "env-manifest.json");
          const existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          if (verbose) {
            process.stderr.write("Environment manifest is current\n");
          }
          if (raw) {
            output(existing, raw);
          }
          process.exit(0);
        }
        if (staleness.reason === "files_changed" && verbose) {
          const changed = staleness.changed_files || [];
          process.stderr.write(`Environment changed (${changed.join(", ")} modified), rescanning...
`);
        }
      }
      const result = performEnvScan(cwd);
      writeManifest(cwd, result);
      ensureManifestGitignored(cwd);
      writeProjectProfile(cwd, result);
      if (verbose) {
        const langNames = result.languages.map((l) => l.name).join(", ");
        const pm = result.package_manager ? result.package_manager.name : "none";
        process.stderr.write(`Scanned in ${result.detection_ms}ms: languages=[${langNames}], pm=${pm}, watched=${result.watched_files.length} files
`);
      }
      if (raw) {
        output(result, raw);
      }
      process.exit(0);
    }
    function cmdEnvStatus(cwd, args, raw) {
      const manifestPath = path.join(cwd, ".planning", "env-manifest.json");
      const exists = fs.existsSync(manifestPath);
      let manifest = null;
      if (exists) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        } catch {
        }
      }
      const staleness = checkEnvManifestStaleness(cwd);
      const result = {
        exists,
        stale: staleness.stale,
        reason: staleness.reason || null,
        scanned_at: manifest ? manifest.scanned_at : null,
        age_minutes: manifest ? Math.round((Date.now() - new Date(manifest.scanned_at).getTime()) / 6e4) : null,
        languages_count: manifest ? (manifest.languages || []).length : 0,
        changed_files: staleness.changed_files || []
      };
      output(result, raw);
    }
    function readEnvManifest(cwd) {
      const manifestPath = path.join(cwd, ".planning", "env-manifest.json");
      try {
        if (!fs.existsSync(manifestPath)) return null;
        return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      } catch {
        return null;
      }
    }
    function formatEnvSummary(manifest) {
      if (!manifest || !manifest.languages || manifest.languages.length === 0) return null;
      const langPmMap = {
        npm: "node",
        pnpm: "node",
        yarn: "node",
        bun: "node",
        mix: "elixir",
        cargo: "rust",
        bundler: "ruby",
        poetry: "python",
        pipenv: "python",
        "go-modules": "go"
      };
      const pm = manifest.package_manager;
      const pmName = pm && pm.name ? pm.name : null;
      const pmLang = pmName ? langPmMap[pmName] || null : null;
      const parts = [];
      for (const lang of manifest.languages) {
        let entry;
        if (lang.binary && lang.binary.available && lang.binary.version) {
          entry = `${lang.name}@${lang.binary.version}`;
        } else if (lang.binary && lang.binary.available) {
          entry = lang.name;
        } else {
          entry = `${lang.name} (no binary)`;
        }
        if (pmLang === lang.name && pmName) {
          const pmDisplay = pmName === "go-modules" ? "go modules" : pmName;
          entry += ` (${pmDisplay})`;
        }
        parts.push(entry);
      }
      if (manifest.infrastructure && manifest.infrastructure.docker_services && manifest.infrastructure.docker_services.length > 0) {
        if (!manifest.languages.some((l) => l.name === "docker")) {
          parts.push("docker");
        }
      }
      return `Tools: ${parts.join(", ")}`;
    }
    function autoTriggerEnvScan(cwd) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return null;
      const manifest = readEnvManifest(cwd);
      if (manifest) {
        const staleness = checkEnvManifestStaleness(cwd);
        if (!staleness.stale) {
          return manifest;
        }
        debugLog("env.autoTrigger", `rescan: ${staleness.reason}`);
      }
      try {
        const result = performEnvScan(cwd, { skipBinaryVersions: !!manifest });
        writeManifest(cwd, result);
        ensureManifestGitignored(cwd);
        writeProjectProfile(cwd, result);
        return result;
      } catch (e) {
        debugLog("env.autoTrigger", `scan failed: ${e.message}`);
        return manifest;
      }
    }
    module2.exports = {
      cmdEnvScan,
      cmdEnvStatus,
      checkEnvManifestStaleness,
      LANG_MANIFESTS,
      scanManifests,
      checkBinary,
      detectPackageManager,
      matchSimpleGlob,
      performEnvScan,
      writeManifest,
      ensureManifestGitignored,
      writeProjectProfile,
      getWatchedFiles,
      getWatchedFilesMtimes,
      readEnvManifest,
      formatEnvSummary,
      autoTriggerEnvScan
    };
  }
});

// src/lib/codebase-intel.js
var require_codebase_intel = __commonJS({
  "src/lib/codebase-intel.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { debugLog } = require_output();
    var { execGit } = require_git();
    var { cachedReadFile } = require_helpers();
    function INTEL_PATH(cwd) {
      return path.join(cwd, ".planning", "codebase", "codebase-intel.json");
    }
    var LANGUAGE_MAP = {
      // JavaScript / TypeScript
      ".js": "javascript",
      ".cjs": "javascript",
      ".mjs": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".jsx": "javascript",
      // Python
      ".py": "python",
      ".pyw": "python",
      ".pyi": "python",
      // Go
      ".go": "go",
      // Elixir
      ".ex": "elixir",
      ".exs": "elixir",
      // Rust
      ".rs": "rust",
      // Ruby
      ".rb": "ruby",
      ".rake": "ruby",
      // Java / Kotlin
      ".java": "java",
      ".kt": "kotlin",
      ".kts": "kotlin",
      // C / C++
      ".c": "c",
      ".h": "c",
      ".cpp": "cpp",
      ".hpp": "cpp",
      ".cc": "cpp",
      ".hh": "cpp",
      // Shell
      ".sh": "shell",
      ".bash": "shell",
      ".zsh": "shell",
      // Markup / Config
      ".md": "markdown",
      ".mdx": "markdown",
      ".json": "json",
      ".jsonc": "json",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "toml",
      ".xml": "xml",
      ".html": "html",
      ".htm": "html",
      ".css": "css",
      ".scss": "css",
      ".less": "css",
      ".sql": "sql",
      ".graphql": "graphql",
      ".gql": "graphql",
      ".proto": "protobuf",
      ".swift": "swift",
      ".dart": "dart",
      ".lua": "lua",
      ".r": "r",
      ".R": "r",
      ".php": "php",
      ".pl": "perl",
      ".pm": "perl",
      ".zig": "zig",
      ".nim": "nim",
      ".nix": "nix",
      ".tf": "terraform",
      ".hcl": "terraform",
      ".vue": "vue",
      ".svelte": "svelte"
    };
    var SKIP_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      "vendor",
      "deps",
      "_build",
      ".git",
      ".next",
      "target",
      "dist",
      "build",
      "__pycache__",
      ".elixir_ls",
      ".cache",
      ".planning"
    ]);
    var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".bmp",
      ".ico",
      ".svg",
      ".webp",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".otf",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".a",
      ".o",
      ".zip",
      ".tar",
      ".gz",
      ".bz2",
      ".xz",
      ".7z",
      ".rar",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".mp3",
      ".mp4",
      ".wav",
      ".avi",
      ".mov",
      ".mkv",
      ".flac",
      ".wasm",
      ".pyc",
      ".pyo",
      ".class",
      ".beam",
      ".db",
      ".sqlite",
      ".sqlite3",
      ".lock"
    ]);
    function getSourceDirs(cwd) {
      const sourceDirs = [];
      const knownSourceDirs = /* @__PURE__ */ new Set(["src", "lib", "app", "apps", "pkg", "cmd", "internal", "test", "tests", "spec"]);
      let entries;
      try {
        entries = fs.readdirSync(cwd, { withFileTypes: true });
      } catch {
        return [];
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          const ext = path.extname(entry.name);
          if (LANGUAGE_MAP[ext]) {
            if (!sourceDirs.includes(".")) sourceDirs.push(".");
          }
          continue;
        }
        const name = entry.name;
        if (SKIP_DIRS.has(name)) continue;
        if (name.startsWith(".") && name !== ".") continue;
        const ignoreResult = execGit(cwd, ["check-ignore", "-q", name]);
        if (ignoreResult.exitCode === 0) {
          debugLog("codebase.sourceDirs", `skipping git-ignored: ${name}`);
          continue;
        }
        if (knownSourceDirs.has(name)) {
          sourceDirs.push(name);
        } else {
          try {
            const subEntries = fs.readdirSync(path.join(cwd, name), { withFileTypes: true });
            const hasSource = subEntries.some((e) => {
              if (e.isFile()) {
                const ext = path.extname(e.name);
                return LANGUAGE_MAP[ext] !== void 0;
              }
              return false;
            });
            if (hasSource) {
              sourceDirs.push(name);
            }
          } catch {
          }
        }
      }
      if (sourceDirs.length === 0) {
        sourceDirs.push(".");
      }
      return sourceDirs;
    }
    function walkSourceFiles(cwd, sourceDirs, skipDirs) {
      const files = [];
      const visited = /* @__PURE__ */ new Set();
      function walk(dir) {
        const absDir = path.join(cwd, dir);
        if (visited.has(absDir)) return;
        visited.add(absDir);
        let entries;
        try {
          entries = fs.readdirSync(absDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const relPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name) && !entry.name.startsWith(".")) {
              walk(relPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (!BINARY_EXTENSIONS.has(ext)) {
              files.push(relPath);
            }
          }
        }
      }
      for (const dir of sourceDirs) {
        walk(dir);
      }
      return files;
    }
    function analyzeFile(filePath) {
      const ext = path.extname(filePath);
      const language = LANGUAGE_MAP[ext] || null;
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        return { language, size_bytes: 0, lines: 0, last_modified: null };
      }
      let lines = 0;
      try {
        const content = fs.readFileSync(filePath);
        for (let i = 0; i < content.length; i++) {
          if (content[i] === 10) lines++;
        }
        if (content.length > 0 && content[content.length - 1] !== 10) {
          lines++;
        }
      } catch {
      }
      return {
        language,
        size_bytes: stat.size,
        lines,
        last_modified: stat.mtime.toISOString()
      };
    }
    function getGitInfo(cwd) {
      const hashResult = execGit(cwd, ["rev-parse", "HEAD"]);
      const branchResult = execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      return {
        commit_hash: hashResult.exitCode === 0 ? hashResult.stdout : null,
        branch: branchResult.exitCode === 0 ? branchResult.stdout : null
      };
    }
    function getChangedFilesSinceCommit(cwd, commitHash) {
      if (!commitHash) return null;
      const result = execGit(cwd, ["diff", "--name-only", commitHash, "HEAD"]);
      if (result.exitCode !== 0) {
        debugLog("codebase.changedFiles", `git diff failed for ${commitHash}`);
        return null;
      }
      const files = result.stdout.split("\n").filter((f) => f.trim().length > 0);
      return files;
    }
    function checkStaleness(cwd) {
      const intel = readIntel(cwd);
      if (!intel) {
        return { stale: true, reason: "no_intel" };
      }
      if (intel.git_commit_hash) {
        const gitInfo = getGitInfo(cwd);
        if (gitInfo.commit_hash && gitInfo.commit_hash === intel.git_commit_hash) {
          return { stale: false };
        }
        const changedFiles = getChangedFilesSinceCommit(cwd, intel.git_commit_hash);
        if (changedFiles === null) {
          return { stale: true, reason: "commit_missing", changed_files: [] };
        }
        if (changedFiles.length > 0) {
          return { stale: true, reason: "files_changed", changed_files: changedFiles };
        }
        return { stale: false };
      }
      if (intel.generated_at) {
        const generatedTime = new Date(intel.generated_at).getTime();
        const sourceDirs = intel.source_dirs || getSourceDirs(cwd);
        const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
        const changedFiles = [];
        for (const file of allFiles) {
          try {
            const stat = fs.statSync(path.join(cwd, file));
            if (stat.mtimeMs > generatedTime) {
              changedFiles.push(file);
            }
          } catch {
            changedFiles.push(file);
          }
        }
        if (changedFiles.length > 0) {
          return { stale: true, reason: "mtime_newer", changed_files: changedFiles };
        }
        return { stale: false };
      }
      return { stale: true, reason: "no_watermark" };
    }
    function performAnalysis(cwd, options = {}) {
      const { incremental = false, previousIntel = null, changedFiles = null } = options;
      const startMs = Date.now();
      const gitInfo = getGitInfo(cwd);
      const sourceDirs = getSourceDirs(cwd);
      let fileEntries;
      if (incremental && previousIntel && changedFiles) {
        debugLog("codebase.analyze", `incremental: re-analyzing ${changedFiles.length} files`);
        fileEntries = { ...previousIntel.files };
        for (const filePath of Object.keys(fileEntries)) {
          try {
            fs.statSync(path.join(cwd, filePath));
          } catch {
            delete fileEntries[filePath];
          }
        }
        for (const filePath of changedFiles) {
          const absPath = path.join(cwd, filePath);
          try {
            fs.statSync(absPath);
            const ext = path.extname(filePath);
            if (!BINARY_EXTENSIONS.has(ext)) {
              const result = analyzeFile(absPath);
              fileEntries[filePath] = result;
            }
          } catch {
            delete fileEntries[filePath];
          }
        }
      } else {
        debugLog("codebase.analyze", "full analysis");
        const allFiles = walkSourceFiles(cwd, sourceDirs, SKIP_DIRS);
        fileEntries = {};
        for (const filePath of allFiles) {
          const absPath = path.join(cwd, filePath);
          const result = analyzeFile(absPath);
          fileEntries[filePath] = result;
        }
      }
      const languages = {};
      let totalLines = 0;
      let totalFiles = 0;
      for (const [filePath, info] of Object.entries(fileEntries)) {
        totalFiles++;
        totalLines += info.lines || 0;
        const lang = info.language;
        if (!lang) continue;
        if (!languages[lang]) {
          languages[lang] = { count: 0, extensions: /* @__PURE__ */ new Set(), lines: 0 };
        }
        languages[lang].count++;
        languages[lang].lines += info.lines || 0;
        const ext = path.extname(filePath);
        if (ext) languages[lang].extensions.add(ext);
      }
      for (const lang of Object.values(languages)) {
        lang.extensions = [...lang.extensions].sort();
      }
      const durationMs = Date.now() - startMs;
      return {
        version: 1,
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        git_commit_hash: gitInfo.commit_hash,
        git_branch: gitInfo.branch,
        analysis_duration_ms: durationMs,
        source_dirs: sourceDirs,
        languages,
        files: fileEntries,
        stats: {
          total_files: totalFiles,
          total_lines: totalLines,
          languages_detected: Object.keys(languages).length
        }
      };
    }
    function readIntel(cwd) {
      const intelPath = INTEL_PATH(cwd);
      const content = cachedReadFile(intelPath);
      if (!content) return null;
      try {
        return JSON.parse(content);
      } catch (e) {
        debugLog("codebase.readIntel", "JSON parse failed", e);
        return null;
      }
    }
    function writeIntel(cwd, intel) {
      const intelPath = INTEL_PATH(cwd);
      const dir = path.dirname(intelPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2) + "\n");
      debugLog("codebase.writeIntel", `wrote ${intelPath}`);
    }
    module2.exports = {
      INTEL_PATH,
      LANGUAGE_MAP,
      SKIP_DIRS,
      BINARY_EXTENSIONS,
      getSourceDirs,
      walkSourceFiles,
      analyzeFile,
      getGitInfo,
      getChangedFilesSinceCommit,
      checkStaleness,
      performAnalysis,
      readIntel,
      writeIntel
    };
  }
});

// src/lib/conventions.js
var require_conventions = __commonJS({
  "src/lib/conventions.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { LANGUAGE_MAP } = require_codebase_intel();
    var NAMING_PATTERNS = {
      camelCase: /^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/,
      PascalCase: /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/,
      snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/,
      "kebab-case": /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
      UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
    };
    function classifyName(name) {
      if (/^[a-z][a-z0-9]*$/.test(name)) return "single-word";
      if (/^[A-Z][A-Z0-9]*$/.test(name)) return "single-word";
      for (const [pattern, regex] of Object.entries(NAMING_PATTERNS)) {
        if (regex.test(name)) return pattern;
      }
      return "mixed";
    }
    var SOURCE_LANGUAGES = /* @__PURE__ */ new Set([
      "javascript",
      "typescript",
      "python",
      "go",
      "elixir",
      "rust",
      "ruby",
      "java",
      "kotlin",
      "c",
      "cpp",
      "shell",
      "swift",
      "dart",
      "lua",
      "r",
      "php",
      "perl",
      "zig",
      "nim",
      "vue",
      "svelte"
    ]);
    function isSourceFile(filePath, fileInfo) {
      if (!fileInfo || !fileInfo.language) return false;
      return SOURCE_LANGUAGES.has(fileInfo.language);
    }
    function detectNamingConventions(intel) {
      if (!intel || !intel.files) return { overall: {}, by_directory: {} };
      const byDir = {};
      const allNames = {};
      for (const [filePath, fileInfo] of Object.entries(intel.files)) {
        if (!isSourceFile(filePath, fileInfo)) continue;
        const dir = path.dirname(filePath);
        const basename = path.basename(filePath, path.extname(filePath));
        const pattern = classifyName(basename);
        if (pattern === "single-word") continue;
        if (!byDir[dir]) byDir[dir] = {};
        if (!byDir[dir][pattern]) byDir[dir][pattern] = [];
        byDir[dir][pattern].push(basename);
        if (!allNames[pattern]) allNames[pattern] = [];
        allNames[pattern].push(basename);
      }
      const totalMultiWord = Object.values(allNames).reduce((sum, arr) => sum + arr.length, 0);
      const overall = {};
      for (const [pattern, names] of Object.entries(allNames)) {
        overall[pattern] = {
          pattern,
          confidence: totalMultiWord > 0 ? Math.round(names.length / totalMultiWord * 100) : 0,
          file_count: names.length,
          examples: names.slice(0, 3)
        };
      }
      const byDirectory = {};
      for (const [dir, patterns] of Object.entries(byDir)) {
        const dirTotal = Object.values(patterns).reduce((sum, arr) => sum + arr.length, 0);
        if (dirTotal < 2) continue;
        let dominant = null;
        let maxCount = 0;
        for (const [pattern, names] of Object.entries(patterns)) {
          if (names.length > maxCount) {
            maxCount = names.length;
            dominant = pattern;
          }
        }
        byDirectory[dir] = {
          dominant_pattern: dominant,
          confidence: Math.round(maxCount / dirTotal * 100),
          file_count: dirTotal,
          patterns: {}
        };
        for (const [pattern, names] of Object.entries(patterns)) {
          byDirectory[dir].patterns[pattern] = {
            count: names.length,
            examples: names.slice(0, 3)
          };
        }
      }
      return { overall, by_directory: byDirectory };
    }
    function detectFileOrganization(intel) {
      if (!intel || !intel.files) {
        return { structure_type: "unknown", patterns: [] };
      }
      const filePaths = Object.keys(intel.files);
      const patterns = [];
      const depths = filePaths.map((f) => f.split(path.sep).length);
      const maxDepth = Math.max(...depths, 0);
      const avgDepth = depths.length > 0 ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length * 10) / 10 : 0;
      const structureType = maxDepth <= 2 ? "flat" : "nested";
      patterns.push({
        pattern: `${structureType} structure`,
        detail: `max depth ${maxDepth}, avg depth ${avgDepth}`,
        confidence: 100
      });
      const topDirs = /* @__PURE__ */ new Set();
      for (const fp of filePaths) {
        const parts = fp.split(path.sep);
        if (parts.length > 1) topDirs.add(parts[0]);
      }
      const knownGroupings = {
        "by-type": ["commands", "lib", "models", "controllers", "views", "services", "utils", "helpers"],
        "by-feature": ["features", "modules", "domains", "pages"]
      };
      let groupingType = "unknown";
      let groupingConfidence = 0;
      const topDirList = [...topDirs];
      const byTypeMatches = topDirList.filter((d) => knownGroupings["by-type"].includes(d));
      const byFeatureMatches = topDirList.filter((d) => knownGroupings["by-feature"].includes(d));
      if (byTypeMatches.length > byFeatureMatches.length) {
        groupingType = "by-type";
        groupingConfidence = Math.round(byTypeMatches.length / Math.max(topDirList.length, 1) * 100);
      } else if (byFeatureMatches.length > 0) {
        groupingType = "by-feature";
        groupingConfidence = Math.round(byFeatureMatches.length / Math.max(topDirList.length, 1) * 100);
      }
      if (groupingType !== "unknown") {
        patterns.push({
          pattern: `${groupingType} grouping`,
          detail: `detected from top-level directories: ${topDirList.join(", ")}`,
          confidence: groupingConfidence
        });
      }
      const testFiles = filePaths.filter((f) => {
        const base = path.basename(f);
        return base.includes(".test.") || base.includes(".spec.") || base.includes("_test.") || base.includes("_spec.");
      });
      const testDirFiles = filePaths.filter((f) => {
        const parts = f.split(path.sep);
        return parts.some((p) => p === "test" || p === "tests" || p === "spec" || p === "__tests__");
      });
      let testPlacement = "none";
      let testConfidence = 0;
      if (testFiles.length > 0 && testDirFiles.length > 0) {
        if (testFiles.length > testDirFiles.length) {
          testPlacement = "co-located";
          testConfidence = Math.round(testFiles.length / (testFiles.length + testDirFiles.length) * 100);
        } else {
          testPlacement = "separate-directory";
          testConfidence = Math.round(testDirFiles.length / (testFiles.length + testDirFiles.length) * 100);
        }
      } else if (testFiles.length > 0) {
        testPlacement = "co-located";
        testConfidence = 100;
      } else if (testDirFiles.length > 0) {
        testPlacement = "separate-directory";
        testConfidence = 100;
      }
      if (testPlacement !== "none") {
        patterns.push({
          pattern: `${testPlacement} tests`,
          detail: `${testFiles.length} co-located, ${testDirFiles.length} in test dirs`,
          confidence: testConfidence
        });
      }
      const configExtensions = /* @__PURE__ */ new Set([".json", ".yaml", ".yml", ".toml", ".env", ".ini", ".cfg"]);
      const configNames = /* @__PURE__ */ new Set(["config", "settings", "configuration", ".env", ".eslintrc", ".prettierrc", "tsconfig", "jest.config", "webpack.config", "vite.config"]);
      const configFiles = filePaths.filter((f) => {
        const base = path.basename(f);
        const ext = path.extname(f);
        const nameNoExt = path.basename(f, ext);
        return configExtensions.has(ext) && f.split(path.sep).length <= 2 || configNames.has(nameNoExt) || base.startsWith(".");
      });
      const rootConfigs = configFiles.filter((f) => f.split(path.sep).length === 1);
      if (configFiles.length > 0) {
        const configPlacement = rootConfigs.length > configFiles.length / 2 ? "root" : "config-directory";
        patterns.push({
          pattern: `${configPlacement} config placement`,
          detail: `${rootConfigs.length}/${configFiles.length} config files at root`,
          confidence: Math.round(rootConfigs.length / Math.max(configFiles.length, 1) * 100)
        });
      }
      const indexFiles = filePaths.filter((f) => {
        const base = path.basename(f);
        return base.startsWith("index.") || base.startsWith("mod.") || base.startsWith("__init__.");
      });
      if (indexFiles.length > 0) {
        const dirsWithSource = new Set(filePaths.filter((f) => {
          const info = intel.files[f];
          return isSourceFile(f, info);
        }).map((f) => path.dirname(f)));
        const barrelConfidence = Math.round(indexFiles.length / Math.max(dirsWithSource.size, 1) * 100);
        patterns.push({
          pattern: "barrel/index exports",
          detail: `${indexFiles.length} index files across ${dirsWithSource.size} source dirs`,
          confidence: Math.min(barrelConfidence, 100)
        });
      }
      return {
        structure_type: structureType,
        max_depth: maxDepth,
        avg_depth: avgDepth,
        test_placement: testPlacement,
        patterns
      };
    }
    function safeReadFile(filePath) {
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch (e) {
        return "";
      }
    }
    var FRAMEWORK_DETECTORS = [
      {
        name: "elixir-phoenix",
        /**
         * Detect if this project uses Elixir/Phoenix.
         * Checks for Elixir language presence and Phoenix indicators (router.ex, mix.exs).
         */
        detect(intel) {
          if (!intel || !intel.languages) return false;
          if (!intel.languages.elixir) return false;
          const filePaths = Object.keys(intel.files || {});
          const hasRouter = filePaths.some((f) => f.endsWith("router.ex"));
          const hasMixExs = filePaths.some((f) => f === "mix.exs" || f.endsWith("/mix.exs"));
          return hasRouter || hasMixExs;
        },
        /**
         * Extract Elixir/Phoenix-specific convention patterns.
         */
        extractPatterns(intel, cwd) {
          const patterns = [];
          const filePaths = Object.keys(intel.files || {});
          const routerFiles = filePaths.filter((f) => f.endsWith("router.ex"));
          if (routerFiles.length > 0) {
            let routeEvidence = [];
            let hasPipeThrough = false;
            for (const rf of routerFiles) {
              const content = safeReadFile(path.join(cwd, rf));
              if (/pipe_through/.test(content)) hasPipeThrough = true;
              if (/\b(get|post|put|delete|patch)\s/.test(content)) {
                routeEvidence.push(rf);
              }
            }
            if (routeEvidence.length > 0) {
              patterns.push({
                category: "framework",
                framework: "elixir-phoenix",
                pattern: hasPipeThrough ? "Routes defined in router.ex using pipe_through pipelines" : "Routes defined in router.ex",
                confidence: Math.round(routeEvidence.length / Math.max(routerFiles.length, 1) * 100),
                evidence: routeEvidence.slice(0, 5)
              });
            }
          }
          const schemaFiles = filePaths.filter((f) => f.endsWith(".ex") || f.endsWith(".exs"));
          const ectoSchemaFiles = [];
          for (const sf of schemaFiles) {
            const content = safeReadFile(path.join(cwd, sf));
            if (/use Ecto\.Schema/.test(content)) {
              ectoSchemaFiles.push(sf);
            }
          }
          if (ectoSchemaFiles.length > 0) {
            patterns.push({
              category: "framework",
              framework: "elixir-phoenix",
              pattern: "Ecto schemas use `schema` macro with `field` declarations",
              confidence: Math.round(ectoSchemaFiles.length / Math.max(schemaFiles.length, 1) * 100),
              evidence: ectoSchemaFiles.slice(0, 5)
            });
          }
          const plugFiles = [];
          for (const sf of schemaFiles) {
            const content = safeReadFile(path.join(cwd, sf));
            if (/use Plug\b/.test(content) || /import Plug\.Conn/.test(content)) {
              plugFiles.push(sf);
            }
          }
          if (plugFiles.length > 0) {
            patterns.push({
              category: "framework",
              framework: "elixir-phoenix",
              pattern: "Plugs follow init/call pattern",
              confidence: Math.round(plugFiles.length / Math.max(schemaFiles.length, 1) * 100),
              evidence: plugFiles.slice(0, 5)
            });
          }
          const libDirs = /* @__PURE__ */ new Set();
          for (const fp of filePaths) {
            const match = fp.match(/^lib\/([^/]+)\//);
            if (match) libDirs.add(match[1]);
          }
          if (libDirs.size > 1) {
            patterns.push({
              category: "framework",
              framework: "elixir-phoenix",
              pattern: "Business logic organized into context modules",
              confidence: Math.min(Math.round(libDirs.size / 3 * 100), 100),
              evidence: [...libDirs].slice(0, 5).map((d) => `lib/${d}/`)
            });
          }
          const migrationFiles = filePaths.filter(
            (f) => f.includes("priv/repo/migrations/") || f.match(/priv\/[^/]*\/migrations\//)
          );
          if (migrationFiles.length > 0) {
            const timestampMigrations = migrationFiles.filter(
              (f) => /\d{14}_/.test(path.basename(f))
            );
            patterns.push({
              category: "framework",
              framework: "elixir-phoenix",
              pattern: "Migrations use timestamp prefixes",
              confidence: Math.round(timestampMigrations.length / Math.max(migrationFiles.length, 1) * 100),
              evidence: migrationFiles.slice(0, 5)
            });
          }
          return patterns;
        }
      }
    ];
    function detectFrameworkConventions(intel, cwd) {
      const allPatterns = [];
      for (const detector of FRAMEWORK_DETECTORS) {
        try {
          if (detector.detect(intel)) {
            const patterns = detector.extractPatterns(intel, cwd);
            allPatterns.push(...patterns);
          }
        } catch (e) {
        }
      }
      return allPatterns;
    }
    function extractConventions(intel, options = {}) {
      const { threshold = 60, showAll = false, cwd = process.cwd() } = options;
      const naming = detectNamingConventions(intel);
      const fileOrganization = detectFileOrganization(intel);
      const frameworkPatterns = detectFrameworkConventions(intel, cwd);
      const filteredNaming = { ...naming };
      if (!showAll) {
        filteredNaming.overall = {};
        for (const [key, value] of Object.entries(naming.overall)) {
          if (value.confidence >= threshold) {
            filteredNaming.overall[key] = value;
          }
        }
        filteredNaming.by_directory = {};
        for (const [dir, value] of Object.entries(naming.by_directory)) {
          if (value.confidence >= threshold) {
            filteredNaming.by_directory[dir] = value;
          }
        }
      }
      const filteredFileOrg = { ...fileOrganization };
      if (!showAll) {
        filteredFileOrg.patterns = fileOrganization.patterns.filter((p) => p.confidence >= threshold);
      }
      const filteredFrameworks = showAll ? frameworkPatterns : frameworkPatterns.filter((p) => p.confidence >= threshold);
      return {
        naming: filteredNaming,
        file_organization: filteredFileOrg,
        frameworks: filteredFrameworks,
        extracted_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    function generateRules(conventions, options = {}) {
      const { threshold = 60, maxRules = 15 } = options;
      if (!conventions) {
        return { rules: [], rules_text: "", rule_count: 0, total_conventions: 0, filtered_count: 0 };
      }
      const allConventions = [];
      if (conventions.naming && conventions.naming.overall) {
        for (const [, value] of Object.entries(conventions.naming.overall)) {
          if (value.confidence > 0) {
            allConventions.push({
              text: `File names use ${value.pattern} (${value.confidence}% of ${value.file_count} multi-word files)`,
              confidence: value.confidence
            });
          }
        }
      }
      if (conventions.naming && conventions.naming.by_directory) {
        for (const [dir, value] of Object.entries(conventions.naming.by_directory)) {
          if (value.confidence > 0) {
            allConventions.push({
              text: `File names in \`${dir}/\` use ${value.dominant_pattern} (${value.confidence}% of ${value.file_count} files)`,
              confidence: value.confidence
            });
          }
        }
      }
      if (conventions.file_organization && conventions.file_organization.patterns) {
        for (const p of conventions.file_organization.patterns) {
          if (p.confidence > 0) {
            allConventions.push({
              text: `Project uses ${p.pattern} (${p.detail})`,
              confidence: p.confidence
            });
          }
        }
      }
      if (conventions.frameworks) {
        for (const p of conventions.frameworks) {
          if (p.confidence > 0) {
            allConventions.push({
              text: `${p.pattern} (${p.confidence}%)`,
              confidence: p.confidence
            });
          }
        }
      }
      const totalConventions = allConventions.length;
      const filtered = allConventions.filter((c) => c.confidence >= threshold);
      const filteredCount = totalConventions - filtered.length;
      filtered.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.text.localeCompare(b.text);
      });
      const capped = filtered.slice(0, maxRules);
      const rules = capped.map((c) => c.text);
      const rulesText = rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
      return {
        rules,
        rules_text: rulesText,
        rule_count: rules.length,
        total_conventions: totalConventions,
        filtered_count: filteredCount
      };
    }
    module2.exports = {
      detectNamingConventions,
      detectFileOrganization,
      detectFrameworkConventions,
      extractConventions,
      generateRules,
      FRAMEWORK_DETECTORS
    };
  }
});

// src/commands/codebase.js
var require_codebase = __commonJS({
  "src/commands/codebase.js"(exports2, module2) {
    "use strict";
    var { output, error, debugLog } = require_output();
    var {
      checkStaleness,
      performAnalysis,
      readIntel,
      writeIntel,
      getGitInfo,
      getChangedFilesSinceCommit
    } = require_codebase_intel();
    function cmdCodebaseAnalyze(cwd, args, raw) {
      const forceFull = args.includes("--full");
      const startMs = Date.now();
      let mode = "full";
      let previousIntel = null;
      let changedFiles = null;
      if (!forceFull) {
        previousIntel = readIntel(cwd);
        if (previousIntel) {
          const staleness = checkStaleness(cwd);
          if (staleness.stale && staleness.changed_files && staleness.changed_files.length > 0) {
            mode = "incremental";
            changedFiles = staleness.changed_files;
            debugLog("codebase.analyze", `incremental mode: ${changedFiles.length} changed files`);
          } else if (!staleness.stale) {
            const durationMs2 = Date.now() - startMs;
            output({
              success: true,
              mode: "cached",
              files_analyzed: 0,
              total_files: previousIntel.stats.total_files,
              languages: Object.keys(previousIntel.languages),
              duration_ms: durationMs2,
              path: ".planning/codebase/codebase-intel.json"
            }, raw);
            return;
          }
        }
      }
      debugLog("codebase.analyze", `analyzing in ${mode} mode...`);
      const intel = performAnalysis(cwd, {
        incremental: mode === "incremental",
        previousIntel,
        changedFiles
      });
      writeIntel(cwd, intel);
      const durationMs = Date.now() - startMs;
      const filesAnalyzed = mode === "incremental" && changedFiles ? changedFiles.length : intel.stats.total_files;
      output({
        success: true,
        mode,
        files_analyzed: filesAnalyzed,
        total_files: intel.stats.total_files,
        languages: Object.keys(intel.languages),
        duration_ms: durationMs,
        path: ".planning/codebase/codebase-intel.json"
      }, raw);
    }
    function cmdCodebaseStatus(cwd, args, raw) {
      const intel = readIntel(cwd);
      if (!intel) {
        output({
          exists: false,
          message: "No codebase intel. Run: codebase analyze"
        }, raw);
        return;
      }
      const staleness = checkStaleness(cwd);
      const gitInfo = getGitInfo(cwd);
      if (staleness.stale) {
        let changedGroups = null;
        if (staleness.changed_files && staleness.changed_files.length > 0 && intel.git_commit_hash) {
          changedGroups = groupChangedFiles(cwd, intel.git_commit_hash, staleness.changed_files);
        }
        output({
          exists: true,
          stale: true,
          reason: staleness.reason,
          changed_files: staleness.changed_files || [],
          changed_groups: changedGroups,
          intel_commit: intel.git_commit_hash,
          current_commit: gitInfo.commit_hash,
          generated_at: intel.generated_at
        }, raw);
      } else {
        output({
          exists: true,
          stale: false,
          generated_at: intel.generated_at,
          git_commit_hash: intel.git_commit_hash,
          total_files: intel.stats.total_files,
          total_lines: intel.stats.total_lines,
          languages: Object.keys(intel.languages),
          languages_detected: intel.stats.languages_detected
        }, raw);
      }
    }
    function groupChangedFiles(cwd, fromCommit, changedFiles) {
      const { execGit } = require_git();
      const addedResult = execGit(cwd, ["diff", "--name-only", "--diff-filter=A", fromCommit, "HEAD"]);
      const modifiedResult = execGit(cwd, ["diff", "--name-only", "--diff-filter=M", fromCommit, "HEAD"]);
      const deletedResult = execGit(cwd, ["diff", "--name-only", "--diff-filter=D", fromCommit, "HEAD"]);
      const parse = (result) => {
        if (result.exitCode !== 0) return [];
        return result.stdout.split("\n").filter((f) => f.trim().length > 0);
      };
      const added = parse(addedResult);
      const modified = parse(modifiedResult);
      const deleted = parse(deletedResult);
      if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
        return null;
      }
      return { added, modified, deleted };
    }
    function autoTriggerCodebaseIntel(cwd) {
      const fs = require("fs");
      const path = require("path");
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return null;
      const intel = readIntel(cwd);
      if (!intel) {
        debugLog("codebase.autoTrigger", "no existing intel, skipping (first run needs explicit analyze)");
        return null;
      }
      try {
        const staleness = checkStaleness(cwd);
        if (!staleness.stale) {
          debugLog("codebase.autoTrigger", "intel is fresh");
          return intel;
        }
        debugLog("codebase.autoTrigger", `stale (${staleness.reason}), running incremental analysis`);
        const newIntel = performAnalysis(cwd, {
          incremental: !!(staleness.changed_files && staleness.changed_files.length > 0),
          previousIntel: intel,
          changedFiles: staleness.changed_files || null
        });
        writeIntel(cwd, newIntel);
        return newIntel;
      } catch (e) {
        debugLog("codebase.autoTrigger", `analysis failed: ${e.message}`);
        return intel;
      }
    }
    function readCodebaseIntel(cwd) {
      return readIntel(cwd);
    }
    function checkCodebaseIntelStaleness(cwd) {
      return checkStaleness(cwd);
    }
    function cmdCodebaseConventions(cwd, args, raw) {
      const intel = readIntel(cwd);
      if (!intel) {
        error("No codebase intel. Run: codebase analyze");
        return;
      }
      const { extractConventions } = require_conventions();
      const showAll = args.includes("--all");
      const thresholdIdx = args.indexOf("--threshold");
      const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) : 60;
      const conventions = extractConventions(intel, { threshold, showAll, cwd });
      intel.conventions = conventions;
      writeIntel(cwd, intel);
      const namingPatterns = [];
      for (const [, value] of Object.entries(conventions.naming.overall || {})) {
        namingPatterns.push({
          scope: "project",
          pattern: value.pattern,
          confidence: value.confidence,
          file_count: value.file_count,
          examples: value.examples
        });
      }
      for (const [dir, value] of Object.entries(conventions.naming.by_directory || {})) {
        namingPatterns.push({
          scope: dir,
          pattern: value.dominant_pattern,
          confidence: value.confidence,
          file_count: value.file_count,
          examples: value.patterns[value.dominant_pattern] ? value.patterns[value.dominant_pattern].examples : []
        });
      }
      const frameworkPatterns = conventions.frameworks || [];
      output({
        success: true,
        naming_patterns: namingPatterns,
        file_organization: conventions.file_organization,
        framework_patterns: frameworkPatterns,
        total_conventions: namingPatterns.length + (conventions.file_organization.patterns || []).length + frameworkPatterns.length,
        threshold_used: threshold,
        show_all: showAll,
        extracted_at: conventions.extracted_at
      }, raw);
    }
    function cmdCodebaseRules(cwd, args, raw) {
      const intel = readIntel(cwd);
      if (!intel) {
        error("No codebase intel. Run: codebase analyze");
        return;
      }
      const { extractConventions, generateRules } = require_conventions();
      let conventions = intel.conventions;
      if (!conventions) {
        debugLog("codebase.rules", "no cached conventions, running extraction");
        conventions = extractConventions(intel, { cwd });
        intel.conventions = conventions;
        writeIntel(cwd, intel);
      }
      const thresholdIdx = args.indexOf("--threshold");
      const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) : 60;
      const maxIdx = args.indexOf("--max");
      const maxRules = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : 15;
      const result = generateRules(conventions, { threshold, maxRules });
      if (raw) {
        process.stdout.write(result.rules_text + "\n");
        return;
      }
      output({
        success: true,
        rules: result.rules,
        rules_text: result.rules_text,
        rule_count: result.rule_count,
        total_conventions: result.total_conventions,
        filtered_count: result.filtered_count
      }, false);
    }
    module2.exports = {
      cmdCodebaseAnalyze,
      cmdCodebaseStatus,
      cmdCodebaseConventions,
      cmdCodebaseRules,
      readCodebaseIntel,
      checkCodebaseIntelStaleness,
      autoTriggerCodebaseIntel
    };
  }
});

// src/commands/worktree.js
var require_worktree = __commonJS({
  "src/commands/worktree.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var { execSync, execFileSync } = require("child_process");
    var { output, error, debugLog } = require_output();
    var { execGit } = require_git();
    var { loadConfig } = require_config();
    var { extractFrontmatter } = require_frontmatter();
    var WORKTREE_DEFAULTS = {
      enabled: false,
      base_path: "/tmp/gsd-worktrees",
      sync_files: [".env", ".env.local", ".planning/config.json"],
      setup_hooks: [],
      max_concurrent: 3
    };
    function getWorktreeConfig(cwd) {
      const defaults = { ...WORKTREE_DEFAULTS };
      try {
        const configPath = path.join(cwd, ".planning", "config.json");
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (raw.worktree && typeof raw.worktree === "object") {
          return { ...defaults, ...raw.worktree };
        }
      } catch {
        debugLog("worktree.config", "No worktree config found, using defaults");
      }
      return defaults;
    }
    function getProjectName(cwd) {
      return path.basename(cwd);
    }
    function parsePlanId(planId) {
      if (!planId) return null;
      const match = planId.match(/^(\d+(?:\.\d+)?)-(\d+)$/);
      if (!match) return null;
      return { phase: match[1], plan: match[2] };
    }
    function getWaveFromPlan(cwd, planId) {
      const parsed = parsePlanId(planId);
      if (!parsed) return "0";
      const phasesDir = path.join(cwd, ".planning", "phases");
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const phaseDir = entries.find((e) => e.isDirectory() && e.name.startsWith(parsed.phase.padStart(2, "0")));
        if (!phaseDir) return "0";
        const planFile = path.join(phasesDir, phaseDir.name, `${parsed.phase.padStart(2, "0")}-${parsed.plan.padStart(2, "0")}-PLAN.md`);
        if (!fs.existsSync(planFile)) return "0";
        const content = fs.readFileSync(planFile, "utf-8");
        const waveMatch = content.match(/^wave:\s*(\d+)/m);
        return waveMatch ? waveMatch[1] : "0";
      } catch {
        return "0";
      }
    }
    function parseWorktreeListPorcelain(porcelainOutput) {
      if (!porcelainOutput || !porcelainOutput.trim()) return [];
      const worktrees = [];
      const blocks = porcelainOutput.split("\n\n");
      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.trim().split("\n");
        const wt = {};
        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            wt.path = line.slice("worktree ".length);
          } else if (line.startsWith("HEAD ")) {
            wt.head = line.slice("HEAD ".length);
          } else if (line.startsWith("branch ")) {
            wt.branch = line.slice("branch ".length).replace("refs/heads/", "");
          } else if (line === "bare") {
            wt.bare = true;
          } else if (line === "detached") {
            wt.detached = true;
          }
        }
        if (wt.path) worktrees.push(wt);
      }
      return worktrees;
    }
    function getDiskUsage(dirPath) {
      try {
        const result = execFileSync("du", ["-sh", dirPath], {
          encoding: "utf-8",
          timeout: 5e3,
          stdio: "pipe"
        }).trim();
        const match = result.match(/^([\d.]+[BKMGT]?)\s/);
        return match ? match[1] : "unknown";
      } catch {
        return "unknown";
      }
    }
    function getAvailableDiskMB(dirPath) {
      try {
        const result = execFileSync("df", ["-k", dirPath], {
          encoding: "utf-8",
          timeout: 5e3,
          stdio: "pipe"
        }).trim();
        const lines = result.split("\n");
        const lastLine = lines[lines.length - 1];
        const parts = lastLine.split(/\s+/);
        const availKB = parseInt(parts[3], 10);
        return isNaN(availKB) ? null : Math.round(availKB / 1024);
      } catch {
        return null;
      }
    }
    function getProjectSizeMB(cwd) {
      try {
        const result = execFileSync("du", ["-sm", cwd], {
          encoding: "utf-8",
          timeout: 1e4,
          stdio: "pipe"
        }).trim();
        const match = result.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      } catch {
        return null;
      }
    }
    function cmdWorktreeCreate(cwd, planId, raw) {
      if (!planId) {
        error("Usage: gsd-tools worktree create <plan-id>\n\nplan-id format: NN-MM (e.g., 21-02)");
      }
      const parsed = parsePlanId(planId);
      if (!parsed) {
        error(`Invalid plan ID "${planId}". Expected format: NN-MM (e.g., 21-02)`);
      }
      const config = getWorktreeConfig(cwd);
      const projectName = getProjectName(cwd);
      const wave = getWaveFromPlan(cwd, planId);
      const branchName = `worktree-${parsed.phase.padStart(2, "0")}-${parsed.plan.padStart(2, "0")}-${wave}`;
      const worktreePath = path.join(config.base_path, projectName, planId);
      const listResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
      if (listResult.exitCode === 0) {
        const existing = parseWorktreeListPorcelain(listResult.stdout);
        const alreadyExists = existing.some((wt) => wt.path === worktreePath || wt.branch === branchName);
        if (alreadyExists) {
          error(`Worktree already exists for plan ${planId} (path: ${worktreePath}, branch: ${branchName})`);
        }
        const projectWorktrees = existing.filter(
          (wt) => wt.path && wt.path.startsWith(path.join(config.base_path, projectName))
        );
        if (projectWorktrees.length >= config.max_concurrent) {
          error(`Max concurrent worktrees (${config.max_concurrent}) reached. Remove a worktree first or increase max_concurrent in config.`);
        }
      }
      const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
      const requiredMemMB = config.max_concurrent * 4096;
      const resourceWarnings = [];
      if (freeMemMB < requiredMemMB) {
        resourceWarnings.push(`Low memory: ${freeMemMB}MB free, estimated need ${requiredMemMB}MB for ${config.max_concurrent} concurrent worktrees`);
      }
      const projectSizeMB = getProjectSizeMB(cwd);
      if (projectSizeMB) {
        const neededMB = Math.round(projectSizeMB * 1.5);
        const basePathParent = path.dirname(config.base_path);
        const availMB = getAvailableDiskMB(fs.existsSync(config.base_path) ? config.base_path : basePathParent);
        if (availMB !== null && availMB < neededMB) {
          resourceWarnings.push(`Low disk: ${availMB}MB available at ${config.base_path}, estimated need ${neededMB}MB`);
        }
      }
      const projectWorktreeDir = path.join(config.base_path, projectName);
      try {
        fs.mkdirSync(projectWorktreeDir, { recursive: true });
      } catch (e) {
        error(`Failed to create worktree base directory: ${projectWorktreeDir}: ${e.message}`);
      }
      const createResult = execGit(cwd, ["worktree", "add", "-b", branchName, worktreePath]);
      if (createResult.exitCode !== 0) {
        error(`Failed to create worktree: ${createResult.stderr}`);
      }
      const syncedFiles = [];
      for (const syncFile of config.sync_files) {
        const srcPath = path.join(cwd, syncFile);
        const destPath = path.join(worktreePath, syncFile);
        try {
          if (fs.existsSync(srcPath)) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
            syncedFiles.push(syncFile);
          }
        } catch (e) {
          debugLog("worktree.sync", `Failed to sync ${syncFile}: ${e.message}`);
        }
      }
      let setupStatus = "ok";
      let setupError = null;
      for (const hook of config.setup_hooks) {
        try {
          execSync(hook, {
            cwd: worktreePath,
            timeout: 12e4,
            stdio: "pipe",
            encoding: "utf-8"
          });
        } catch (e) {
          setupStatus = "failed";
          setupError = `Hook "${hook}" failed: ${e.message}`;
          debugLog("worktree.setup", `Setup hook failed: ${hook}: ${e.message}`);
          break;
        }
      }
      const result = {
        created: true,
        plan_id: planId,
        branch: branchName,
        path: worktreePath,
        synced_files: syncedFiles,
        setup_status: setupStatus
      };
      if (setupError) result.setup_error = setupError;
      if (resourceWarnings.length > 0) result.resource_warnings = resourceWarnings;
      output(result, raw);
    }
    function cmdWorktreeList(cwd, raw) {
      const config = getWorktreeConfig(cwd);
      const projectName = getProjectName(cwd);
      const projectBase = path.join(config.base_path, projectName);
      const listResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
      if (listResult.exitCode !== 0) {
        error(`Failed to list worktrees: ${listResult.stderr}`);
      }
      const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
      const projectWorktrees = allWorktrees.filter(
        (wt) => wt.path && wt.path.startsWith(projectBase + "/")
      );
      const worktrees = projectWorktrees.map((wt) => {
        const planId = path.basename(wt.path);
        const diskUsage = fs.existsSync(wt.path) ? getDiskUsage(wt.path) : "removed";
        return {
          plan_id: planId,
          branch: wt.branch || null,
          path: wt.path,
          head: wt.head ? wt.head.slice(0, 8) : null,
          disk_usage: diskUsage
        };
      });
      const result = { worktrees };
      if (worktrees.length === 0) {
        output(result, raw, "No active worktrees for this project.\n");
      } else {
        const lines = [
          "Plan ID   | Branch                     | Path                                    | Disk Usage",
          "--------- | -------------------------- | --------------------------------------- | ----------"
        ];
        for (const wt of worktrees) {
          lines.push(`${(wt.plan_id || "").padEnd(9)} | ${(wt.branch || "").padEnd(26)} | ${(wt.path || "").padEnd(39)} | ${wt.disk_usage}`);
        }
        output(result, raw, lines.join("\n") + "\n");
      }
    }
    function cmdWorktreeRemove(cwd, planId, raw) {
      if (!planId) {
        error("Usage: gsd-tools worktree remove <plan-id>");
      }
      const config = getWorktreeConfig(cwd);
      const projectName = getProjectName(cwd);
      const worktreePath = path.join(config.base_path, projectName, planId);
      const listResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
      if (listResult.exitCode !== 0) {
        error(`Failed to list worktrees: ${listResult.stderr}`);
      }
      const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
      const targetWt = allWorktrees.find((wt) => wt.path === worktreePath);
      if (!targetWt) {
        error(`No worktree found for plan ${planId} at ${worktreePath}`);
      }
      const branchName = targetWt.branch;
      const removeResult = execGit(cwd, ["worktree", "remove", worktreePath, "--force"]);
      if (removeResult.exitCode !== 0) {
        error(`Failed to remove worktree: ${removeResult.stderr}`);
      }
      if (branchName) {
        const branchResult = execGit(cwd, ["branch", "-D", branchName]);
        if (branchResult.exitCode !== 0) {
          debugLog("worktree.remove", `Failed to delete branch ${branchName}: ${branchResult.stderr}`);
        }
      }
      output({ removed: true, plan_id: planId, path: worktreePath }, raw);
    }
    function cmdWorktreeCleanup(cwd, raw) {
      const config = getWorktreeConfig(cwd);
      const projectName = getProjectName(cwd);
      const projectBase = path.join(config.base_path, projectName);
      const listResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
      if (listResult.exitCode !== 0) {
        error(`Failed to list worktrees: ${listResult.stderr}`);
      }
      const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
      const projectWorktrees = allWorktrees.filter(
        (wt) => wt.path && wt.path.startsWith(projectBase + "/")
      );
      const removed = [];
      for (const wt of projectWorktrees) {
        const planId = path.basename(wt.path);
        const branchName = wt.branch;
        const removeResult = execGit(cwd, ["worktree", "remove", wt.path, "--force"]);
        if (removeResult.exitCode === 0) {
          removed.push({ plan_id: planId, path: wt.path });
        } else {
          debugLog("worktree.cleanup", `Failed to remove ${wt.path}: ${removeResult.stderr}`);
        }
        if (branchName) {
          execGit(cwd, ["branch", "-D", branchName]);
        }
      }
      execGit(cwd, ["worktree", "prune"]);
      try {
        if (fs.existsSync(projectBase)) {
          const remaining = fs.readdirSync(projectBase);
          if (remaining.length === 0) {
            fs.rmdirSync(projectBase);
          }
        }
      } catch {
        debugLog("worktree.cleanup", "Failed to remove empty project directory");
      }
      output({ cleaned: removed.length, worktrees: removed }, raw);
    }
    var AUTO_RESOLVE_PATTERNS = [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "go.sum",
      ".planning/baselines/"
    ];
    function isAutoResolvable(filePath) {
      return AUTO_RESOLVE_PATTERNS.some((pattern) => {
        if (pattern.endsWith("/")) {
          return filePath.startsWith(pattern);
        }
        return filePath === pattern || filePath.endsWith("/" + pattern);
      });
    }
    function parseMergeTreeConflicts(output2) {
      const conflicts = [];
      const lines = output2.split("\n");
      for (const line of lines) {
        const match = line.match(/^CONFLICT\s+\(([^)]+)\):\s+.*?(?:in\s+)?(\S+)\s*$/);
        if (match) {
          conflicts.push({ file: match[2], type: match[1] });
        } else {
          const altMatch = line.match(/^CONFLICT\s+\(([^)]+)\):\s+Merge conflict in\s+(.+)$/);
          if (altMatch) {
            conflicts.push({ file: altMatch[2].trim(), type: altMatch[1] });
          }
        }
      }
      return conflicts;
    }
    function getPhaseFilesModified(cwd, phaseNumber) {
      const phasesDir = path.join(cwd, ".planning", "phases");
      const paddedPhase = String(phaseNumber).padStart(2, "0");
      const results = [];
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const phaseDir = entries.find((e) => e.isDirectory() && e.name.startsWith(paddedPhase + "-"));
        if (!phaseDir) return results;
        const phasePath = path.join(phasesDir, phaseDir.name);
        const planFiles = fs.readdirSync(phasePath).filter((f) => f.match(/^\d+-\d+-PLAN\.md$/));
        for (const planFile of planFiles) {
          const content = fs.readFileSync(path.join(phasePath, planFile), "utf-8");
          const fm = extractFrontmatter(content);
          const idMatch = planFile.match(/^(\d+-\d+)-PLAN\.md$/);
          if (!idMatch) continue;
          const planId = idMatch[1];
          const wave = fm.wave || "0";
          const filesModified = fm.files_modified || [];
          results.push({ planId, wave: String(wave), files_modified: filesModified });
        }
      } catch (e) {
        debugLog("worktree.overlap", `Error reading phase plans: ${e.message}`);
      }
      return results;
    }
    function cmdWorktreeMerge(cwd, planId, raw) {
      if (!planId) {
        error("Usage: gsd-tools worktree merge <plan-id>");
      }
      const parsed = parsePlanId(planId);
      if (!parsed) {
        error(`Invalid plan ID "${planId}". Expected format: NN-MM (e.g., 21-02)`);
      }
      const config = getWorktreeConfig(cwd);
      const projectName = getProjectName(cwd);
      const listResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
      if (listResult.exitCode !== 0) {
        error(`Failed to list worktrees: ${listResult.stderr}`);
      }
      const allWorktrees = parseWorktreeListPorcelain(listResult.stdout);
      const projectBase = path.join(config.base_path, projectName);
      const worktreePath = path.join(projectBase, planId);
      const targetWt = allWorktrees.find(
        (wt) => wt.path === worktreePath || wt.branch && wt.branch.match(new RegExp(`^worktree-${parsed.phase.padStart(2, "0")}-${parsed.plan.padStart(2, "0")}-`))
      );
      if (!targetWt) {
        error(`No worktree found for plan ${planId}. Check with 'worktree list'.`);
      }
      const worktreeBranch = targetWt.branch;
      if (!worktreeBranch) {
        error(`Worktree for plan ${planId} has no branch (detached HEAD?)`);
      }
      const baseBranchResult = execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (baseBranchResult.exitCode !== 0) {
        error(`Failed to determine base branch: ${baseBranchResult.stderr}`);
      }
      const baseBranch = baseBranchResult.stdout.trim();
      const fileOverlapWarnings = [];
      const phasePlans = getPhaseFilesModified(cwd, parsed.phase);
      const thisPlan = phasePlans.find((p) => p.planId === planId);
      if (thisPlan && thisPlan.files_modified.length > 0) {
        for (const other of phasePlans) {
          if (other.planId === planId) continue;
          const overlap = thisPlan.files_modified.filter((f) => other.files_modified.includes(f));
          if (overlap.length > 0) {
            fileOverlapWarnings.push({
              plan: other.planId,
              wave: other.wave,
              shared_files: overlap
            });
          }
        }
      }
      const mergeTreeResult = execGit(cwd, ["merge-tree", "--write-tree", baseBranch, worktreeBranch]);
      if (mergeTreeResult.exitCode > 1) {
        error(`git merge-tree failed: ${mergeTreeResult.stderr || mergeTreeResult.stdout}`);
      }
      let conflicts = [];
      let treeSha = null;
      if (mergeTreeResult.exitCode === 0) {
        treeSha = mergeTreeResult.stdout.split("\n")[0].trim();
      } else {
        const fullOutput = (mergeTreeResult.stdout + "\n" + mergeTreeResult.stderr).trim();
        conflicts = parseMergeTreeConflicts(fullOutput);
        if (conflicts.length === 0) {
          const firstLine = mergeTreeResult.stdout.split("\n")[0].trim();
          if (/^[0-9a-f]{40}$/.test(firstLine)) {
            treeSha = firstLine;
          }
        }
      }
      const autoResolvable = conflicts.filter((c) => isAutoResolvable(c.file));
      const realConflicts = conflicts.filter((c) => !isAutoResolvable(c.file));
      if (realConflicts.length > 0) {
        output({
          merged: false,
          plan_id: planId,
          branch: worktreeBranch,
          base_branch: baseBranch,
          conflicts: realConflicts.map((c) => ({ file: c.file, type: c.type })),
          auto_resolved: autoResolvable.map((c) => ({ file: c.file, type: c.type })),
          file_overlap_warnings: fileOverlapWarnings
        }, raw);
        return;
      }
      const mergeResult = execGit(cwd, ["merge", worktreeBranch, "--no-ff", "-m", `merge: plan ${planId} worktree`]);
      if (mergeResult.exitCode !== 0 && autoResolvable.length > 0) {
        let resolved = true;
        for (const c of autoResolvable) {
          const checkoutResult = execGit(cwd, ["checkout", "--theirs", c.file]);
          if (checkoutResult.exitCode !== 0) {
            resolved = false;
            break;
          }
          execGit(cwd, ["add", c.file]);
        }
        if (resolved) {
          const commitResult = execGit(cwd, ["commit", "--no-edit"]);
          if (commitResult.exitCode !== 0) {
            execGit(cwd, ["merge", "--abort"]);
            error(`Merge auto-resolution failed during commit: ${commitResult.stderr}`);
          }
        } else {
          execGit(cwd, ["merge", "--abort"]);
          error(`Merge auto-resolution failed: could not checkout --theirs for lockfiles`);
        }
      } else if (mergeResult.exitCode !== 0) {
        error(`Merge execution failed: ${mergeResult.stderr}`);
      }
      output({
        merged: true,
        plan_id: planId,
        branch: worktreeBranch,
        base_branch: baseBranch,
        tree_sha: treeSha,
        auto_resolved: autoResolvable.map((c) => ({ file: c.file, type: c.type })),
        file_overlap_warnings: fileOverlapWarnings
      }, raw);
    }
    function cmdWorktreeCheckOverlap(cwd, phaseNumber, raw) {
      if (!phaseNumber) {
        error("Usage: gsd-tools worktree check-overlap <phase-number>");
      }
      const phasePlans = getPhaseFilesModified(cwd, phaseNumber);
      const overlaps = [];
      const checked = /* @__PURE__ */ new Set();
      for (let i = 0; i < phasePlans.length; i++) {
        for (let j = i + 1; j < phasePlans.length; j++) {
          const a = phasePlans[i];
          const b = phasePlans[j];
          if (a.wave !== b.wave) continue;
          const pairKey = `${a.planId}:${b.planId}`;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);
          const sharedFiles = a.files_modified.filter((f) => b.files_modified.includes(f));
          if (sharedFiles.length > 0) {
            overlaps.push({
              plans: [a.planId, b.planId],
              files: sharedFiles,
              wave: a.wave
            });
          }
        }
      }
      output({
        phase: phaseNumber,
        plans_analyzed: phasePlans.length,
        overlaps,
        has_conflicts: overlaps.length > 0
      }, raw);
    }
    module2.exports = {
      cmdWorktreeCreate,
      cmdWorktreeList,
      cmdWorktreeRemove,
      cmdWorktreeCleanup,
      cmdWorktreeMerge,
      cmdWorktreeCheckOverlap,
      // Exported for testing
      getWorktreeConfig,
      parsePlanId,
      parseWorktreeListPorcelain,
      getPhaseFilesModified,
      parseMergeTreeConflicts,
      isAutoResolvable,
      WORKTREE_DEFAULTS
    };
  }
});

// src/commands/init.js
var require_init = __commonJS({
  "src/commands/init.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var { loadConfig } = require_config();
    var { safeReadFile, cachedReadFile, findPhaseInternal, resolveModelInternal, getRoadmapPhaseInternal, getMilestoneInfo, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, pathExistsInternal, generateSlugInternal, getPhaseTree } = require_helpers();
    var { extractFrontmatter } = require_frontmatter();
    var { execGit } = require_git();
    var { getIntentDriftData, getIntentSummary } = require_intent();
    var { autoTriggerEnvScan, formatEnvSummary, readEnvManifest } = require_env();
    var { autoTriggerCodebaseIntel } = require_codebase();
    var { getWorktreeConfig, parseWorktreeListPorcelain, getPhaseFilesModified } = require_worktree();
    function formatCodebaseSummary(intel) {
      if (!intel || !intel.stats) return null;
      const langs = Object.entries(intel.languages || {}).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([lang, info]) => `${lang}(${info.count})`).join(", ");
      return {
        total_files: intel.stats.total_files,
        total_lines: intel.stats.total_lines,
        top_languages: langs,
        git_commit: intel.git_commit_hash,
        generated_at: intel.generated_at
      };
    }
    function cmdInitExecutePhase(cwd, phase, raw) {
      if (!phase) {
        error("phase required for init execute-phase");
      }
      const config = loadConfig(cwd);
      const phaseInfo = findPhaseInternal(cwd, phase);
      const milestone = getMilestoneInfo(cwd);
      let rawConfig = {};
      try {
        rawConfig = JSON.parse(fs.readFileSync(path.join(cwd, ".planning", "config.json"), "utf-8"));
      } catch (e) {
        debugLog("init.executePhase", "raw config read failed", e);
      }
      const result = {
        // Models
        executor_model: resolveModelInternal(cwd, "gsd-executor"),
        verifier_model: resolveModelInternal(cwd, "gsd-verifier"),
        // Config flags
        commit_docs: config.commit_docs,
        parallelization: config.parallelization,
        branching_strategy: config.branching_strategy,
        phase_branch_template: config.phase_branch_template,
        milestone_branch_template: config.milestone_branch_template,
        verifier_enabled: config.verifier,
        // Phase info
        phase_found: !!phaseInfo,
        phase_dir: phaseInfo?.directory || null,
        phase_number: phaseInfo?.phase_number || null,
        phase_name: phaseInfo?.phase_name || null,
        phase_slug: phaseInfo?.phase_slug || null,
        // Plan inventory
        plans: phaseInfo?.plans || [],
        summaries: phaseInfo?.summaries || [],
        incomplete_plans: phaseInfo?.incomplete_plans || [],
        plan_count: phaseInfo?.plans?.length || 0,
        incomplete_count: phaseInfo?.incomplete_plans?.length || 0,
        // Branch name (pre-computed)
        branch_name: config.branching_strategy === "phase" && phaseInfo ? config.phase_branch_template.replace("{phase}", phaseInfo.phase_number).replace("{slug}", phaseInfo.phase_slug || "phase") : config.branching_strategy === "milestone" ? config.milestone_branch_template.replace("{milestone}", milestone.version).replace("{slug}", generateSlugInternal(milestone.name) || "milestone") : null,
        // Milestone info
        milestone_version: milestone.version,
        milestone_name: milestone.name,
        milestone_slug: generateSlugInternal(milestone.name),
        // Gates
        pre_flight_validation: rawConfig.gates?.pre_flight_validation !== false,
        // Worktree parallelism
        worktree_enabled: rawConfig.worktree?.enabled || false,
        worktree_config: {
          base_path: rawConfig.worktree?.base_path || "/tmp/gsd-worktrees",
          sync_files: rawConfig.worktree?.sync_files || [".env", ".env.local", ".planning/config.json"],
          setup_hooks: rawConfig.worktree?.setup_hooks || [],
          max_concurrent: rawConfig.worktree?.max_concurrent || 3
        },
        worktree_active: [],
        file_overlaps: [],
        // File existence
        state_exists: pathExistsInternal(cwd, ".planning/STATE.md"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        config_exists: pathExistsInternal(cwd, ".planning/config.json"),
        // File paths
        state_path: ".planning/STATE.md",
        roadmap_path: ".planning/ROADMAP.md",
        config_path: ".planning/config.json",
        // Intent drift advisory (null if no INTENT.md)
        intent_drift: null,
        // Intent summary (null if no INTENT.md)
        intent_summary: null
      };
      try {
        result.intent_summary = getIntentSummary(cwd);
      } catch (e) {
        debugLog("init.executePhase", "intent summary failed (non-blocking)", e);
      }
      try {
        const driftData = getIntentDriftData(cwd);
        if (driftData) {
          let advisory = null;
          if (driftData.drift_score <= 15) {
            advisory = null;
          } else if (driftData.drift_score <= 35) {
            advisory = "Intent alignment is good.";
          } else if (driftData.drift_score <= 60) {
            const gapsCount = driftData.signals.coverage_gap.details.length;
            advisory = `\u26A0 ${gapsCount} outcomes uncovered. Review intent trace.`;
          } else {
            advisory = `\u26A0 Significant drift detected (score: ${driftData.drift_score}). Run \`intent drift\` for details.`;
          }
          result.intent_drift = {
            score: driftData.drift_score,
            alignment: driftData.alignment,
            gaps_count: driftData.signals.coverage_gap.details.length,
            untraced_plans: driftData.signals.objective_mismatch.plans.length,
            advisory
          };
        }
      } catch (e) {
        debugLog("init.executePhase", "intent drift advisory failed (non-blocking)", e);
      }
      try {
        const envManifest = autoTriggerEnvScan(cwd);
        const envSummary = formatEnvSummary(envManifest);
        result.env_summary = envSummary;
        result.env_languages = envManifest?.languages?.length || 0;
        result.env_stale = false;
      } catch (e) {
        debugLog("init.executePhase", "env scan failed (non-blocking)", e);
        result.env_summary = null;
        result.env_languages = 0;
        result.env_stale = false;
      }
      try {
        const codebaseIntel = autoTriggerCodebaseIntel(cwd);
        result.codebase_summary = formatCodebaseSummary(codebaseIntel);
      } catch (e) {
        debugLog("init.executePhase", "codebase intel failed (non-blocking)", e);
        result.codebase_summary = null;
      }
      try {
        if (result.worktree_enabled) {
          const wtListResult = execGit(cwd, ["worktree", "list", "--porcelain"]);
          if (wtListResult.exitCode === 0) {
            const wtConfig = getWorktreeConfig(cwd);
            const projectName = path.basename(cwd);
            const projectBase = path.join(wtConfig.base_path, projectName);
            const allWts = parseWorktreeListPorcelain(wtListResult.stdout);
            result.worktree_active = allWts.filter((wt) => wt.path && wt.path.startsWith(projectBase + "/")).map((wt) => ({
              plan_id: path.basename(wt.path),
              branch: wt.branch || null,
              path: wt.path
            }));
          }
          if (phaseInfo?.phase_number) {
            const phasePlans = getPhaseFilesModified(cwd, phaseInfo.phase_number);
            const overlaps = [];
            const checked = /* @__PURE__ */ new Set();
            for (let i = 0; i < phasePlans.length; i++) {
              for (let j = i + 1; j < phasePlans.length; j++) {
                const a = phasePlans[i];
                const b = phasePlans[j];
                if (a.wave !== b.wave) continue;
                const pairKey = `${a.planId}:${b.planId}`;
                if (checked.has(pairKey)) continue;
                checked.add(pairKey);
                const sharedFiles = a.files_modified.filter((f) => b.files_modified.includes(f));
                if (sharedFiles.length > 0) {
                  overlaps.push({ plans: [a.planId, b.planId], files: sharedFiles, wave: a.wave });
                }
              }
            }
            result.file_overlaps = overlaps;
          }
        }
      } catch (e) {
        debugLog("init.executePhase", "worktree context failed (non-blocking)", e);
      }
      if (global._gsdCompactMode) {
        const planPaths = (result.plans || []).map((p) => typeof p === "string" ? p : p.file || p);
        const compactResult = {
          phase_found: result.phase_found,
          phase_dir: result.phase_dir,
          phase_number: result.phase_number,
          phase_name: result.phase_name,
          plans: planPaths,
          incomplete_plans: (result.incomplete_plans || []).map((p) => typeof p === "string" ? p : p.file || p),
          plan_count: result.plan_count,
          incomplete_count: result.incomplete_count,
          branch_name: result.branch_name,
          verifier_enabled: result.verifier_enabled,
          pre_flight_validation: result.pre_flight_validation,
          intent_drift: result.intent_drift ? {
            score: result.intent_drift.score,
            alignment: result.intent_drift.alignment,
            advisory: result.intent_drift.advisory
          } : null,
          intent_summary: result.intent_summary || null,
          env_summary: result.env_summary || null,
          codebase_summary: result.codebase_summary || null,
          worktree_enabled: result.worktree_enabled,
          worktree_config: result.worktree_config,
          worktree_active: result.worktree_active,
          file_overlaps: result.file_overlaps
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = {
            files: [
              ...planPaths.map((p) => ({ path: result.phase_dir ? `${result.phase_dir}/${p}` : p, required: true })),
              ...result.state_exists ? [{ path: ".planning/STATE.md", sections: ["Current Position"], required: true }] : [],
              ...result.roadmap_exists ? [{ path: ".planning/ROADMAP.md", sections: [`Phase ${result.phase_number || ""}`], required: true }] : []
            ]
          };
        }
        return output(compactResult, raw);
      }
      if (!result.worktree_enabled) {
        delete result.worktree_config;
        delete result.worktree_active;
        delete result.file_overlaps;
      }
      if (result.intent_drift === null) delete result.intent_drift;
      if (result.intent_summary === null) delete result.intent_summary;
      if (result.env_summary === null) {
        delete result.env_summary;
        delete result.env_languages;
        delete result.env_stale;
      }
      if (result.codebase_summary === null) delete result.codebase_summary;
      output(result, raw);
    }
    function cmdInitPlanPhase(cwd, phase, raw) {
      if (!phase) {
        error("phase required for init plan-phase");
      }
      const config = loadConfig(cwd);
      const phaseInfo = findPhaseInternal(cwd, phase);
      const result = {
        // Models
        researcher_model: resolveModelInternal(cwd, "gsd-phase-researcher"),
        planner_model: resolveModelInternal(cwd, "gsd-planner"),
        checker_model: resolveModelInternal(cwd, "gsd-plan-checker"),
        // Workflow flags
        research_enabled: config.research,
        plan_checker_enabled: config.plan_checker,
        commit_docs: config.commit_docs,
        // Phase info
        phase_found: !!phaseInfo,
        phase_dir: phaseInfo?.directory || null,
        phase_number: phaseInfo?.phase_number || null,
        phase_name: phaseInfo?.phase_name || null,
        phase_slug: phaseInfo?.phase_slug || null,
        padded_phase: phaseInfo?.phase_number?.padStart(2, "0") || null,
        // Existing artifacts
        has_research: phaseInfo?.has_research || false,
        has_context: phaseInfo?.has_context || false,
        has_plans: (phaseInfo?.plans?.length || 0) > 0,
        plan_count: phaseInfo?.plans?.length || 0,
        // Environment
        planning_exists: pathExistsInternal(cwd, ".planning"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        // File paths
        state_path: ".planning/STATE.md",
        roadmap_path: ".planning/ROADMAP.md",
        requirements_path: ".planning/REQUIREMENTS.md",
        // Intent context (null if no INTENT.md)
        intent_summary: null,
        intent_path: null
      };
      try {
        result.intent_summary = getIntentSummary(cwd);
        const intentFile = path.join(cwd, ".planning", "INTENT.md");
        if (fs.existsSync(intentFile)) {
          result.intent_path = ".planning/INTENT.md";
        }
      } catch (e) {
        debugLog("init.planPhase", "intent summary failed (non-blocking)", e);
      }
      try {
        const codebaseIntel = autoTriggerCodebaseIntel(cwd);
        result.codebase_summary = formatCodebaseSummary(codebaseIntel);
      } catch (e) {
        debugLog("init.planPhase", "codebase intel failed (non-blocking)", e);
        result.codebase_summary = null;
      }
      if (phaseInfo?.directory) {
        const phaseDirFull = path.join(cwd, phaseInfo.directory);
        try {
          const files = fs.readdirSync(phaseDirFull);
          const contextFile = files.find((f) => f.endsWith("-CONTEXT.md") || f === "CONTEXT.md");
          if (contextFile) {
            result.context_path = path.join(phaseInfo.directory, contextFile);
          }
          const researchFile = files.find((f) => f.endsWith("-RESEARCH.md") || f === "RESEARCH.md");
          if (researchFile) {
            result.research_path = path.join(phaseInfo.directory, researchFile);
          }
          const verificationFile = files.find((f) => f.endsWith("-VERIFICATION.md") || f === "VERIFICATION.md");
          if (verificationFile) {
            result.verification_path = path.join(phaseInfo.directory, verificationFile);
          }
          const uatFile = files.find((f) => f.endsWith("-UAT.md") || f === "UAT.md");
          if (uatFile) {
            result.uat_path = path.join(phaseInfo.directory, uatFile);
          }
        } catch (e) {
          debugLog("init.planPhase", "read phase files failed", e);
        }
      }
      if (global._gsdCompactMode) {
        const compactResult = {
          phase_found: result.phase_found,
          phase_dir: result.phase_dir,
          phase_number: result.phase_number,
          phase_name: result.phase_name,
          phase_slug: result.phase_slug,
          padded_phase: result.padded_phase,
          has_research: result.has_research,
          has_context: result.has_context,
          has_plans: result.has_plans,
          plan_count: result.plan_count,
          research_enabled: result.research_enabled,
          plan_checker_enabled: result.plan_checker_enabled
        };
        if (result.intent_summary) compactResult.intent_summary = result.intent_summary;
        if (result.intent_path) compactResult.intent_path = result.intent_path;
        if (result.codebase_summary) compactResult.codebase_summary = result.codebase_summary;
        if (result.context_path) compactResult.context_path = result.context_path;
        if (result.research_path) compactResult.research_path = result.research_path;
        if (result.verification_path) compactResult.verification_path = result.verification_path;
        if (result.uat_path) compactResult.uat_path = result.uat_path;
        if (global._gsdManifestMode) {
          const manifestFiles = [
            { path: ".planning/STATE.md", sections: ["Current Position", "Accumulated Context"], required: true },
            { path: ".planning/ROADMAP.md", sections: [`Phase ${result.phase_number || ""}`], required: true },
            { path: ".planning/REQUIREMENTS.md", required: true }
          ];
          if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
          if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
          if (result.verification_path) manifestFiles.push({ path: result.verification_path, required: false });
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      if (result.intent_summary === null) delete result.intent_summary;
      if (result.intent_path === null) delete result.intent_path;
      if (result.codebase_summary === null) delete result.codebase_summary;
      output(result, raw);
    }
    function cmdInitNewProject(cwd, raw) {
      const config = loadConfig(cwd);
      const homedir = require("os").homedir();
      const braveKeyFile = path.join(homedir, ".gsd", "brave_api_key");
      const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
      let hasCode = false;
      let hasPackageFile = false;
      const codeExts = /* @__PURE__ */ new Set([".ts", ".js", ".py", ".go", ".rs", ".swift", ".java"]);
      const skipDirs = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "__pycache__"]);
      try {
        const scanForCode = (dir, depth) => {
          if (hasCode || depth > 3) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (hasCode) return;
            if (e.isDirectory() && !skipDirs.has(e.name)) {
              scanForCode(path.join(dir, e.name), depth + 1);
            } else if (e.isFile() && codeExts.has(path.extname(e.name))) {
              hasCode = true;
            }
          }
        };
        scanForCode(cwd, 0);
      } catch (e) {
        debugLog("init.newProject", "code scan failed", e);
      }
      hasPackageFile = pathExistsInternal(cwd, "package.json") || pathExistsInternal(cwd, "requirements.txt") || pathExistsInternal(cwd, "Cargo.toml") || pathExistsInternal(cwd, "go.mod") || pathExistsInternal(cwd, "Package.swift");
      const result = {
        // Models
        researcher_model: resolveModelInternal(cwd, "gsd-project-researcher"),
        synthesizer_model: resolveModelInternal(cwd, "gsd-research-synthesizer"),
        roadmapper_model: resolveModelInternal(cwd, "gsd-roadmapper"),
        // Config
        commit_docs: config.commit_docs,
        // Existing state
        project_exists: pathExistsInternal(cwd, ".planning/PROJECT.md"),
        has_codebase_map: pathExistsInternal(cwd, ".planning/codebase"),
        planning_exists: pathExistsInternal(cwd, ".planning"),
        // Brownfield detection
        has_existing_code: hasCode,
        has_package_file: hasPackageFile,
        is_brownfield: hasCode || hasPackageFile,
        needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, ".planning/codebase"),
        // Git state
        has_git: pathExistsInternal(cwd, ".git"),
        // Enhanced search
        brave_search_available: hasBraveSearch,
        // File paths
        project_path: ".planning/PROJECT.md"
      };
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (result.project_exists) manifestFiles.push({ path: ".planning/PROJECT.md", required: false });
        if (pathExistsInternal(cwd, "AGENTS.md")) manifestFiles.push({ path: "AGENTS.md", required: false });
        const compactResult = {
          is_brownfield: result.is_brownfield,
          needs_codebase_map: result.needs_codebase_map,
          has_existing_code: result.has_existing_code,
          has_package_file: result.has_package_file,
          project_exists: result.project_exists,
          has_codebase_map: result.has_codebase_map,
          planning_exists: result.planning_exists,
          has_git: result.has_git,
          brave_search_available: result.brave_search_available
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitNewMilestone(cwd, raw) {
      const config = loadConfig(cwd);
      const milestone = getMilestoneInfo(cwd);
      const result = {
        // Models
        researcher_model: resolveModelInternal(cwd, "gsd-project-researcher"),
        synthesizer_model: resolveModelInternal(cwd, "gsd-research-synthesizer"),
        roadmapper_model: resolveModelInternal(cwd, "gsd-roadmapper"),
        // Config
        commit_docs: config.commit_docs,
        research_enabled: config.research,
        // Current milestone
        current_milestone: milestone.version,
        current_milestone_name: milestone.name,
        // File existence
        project_exists: pathExistsInternal(cwd, ".planning/PROJECT.md"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        state_exists: pathExistsInternal(cwd, ".planning/STATE.md"),
        // File paths
        project_path: ".planning/PROJECT.md",
        roadmap_path: ".planning/ROADMAP.md",
        state_path: ".planning/STATE.md"
      };
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (result.project_exists) manifestFiles.push({ path: ".planning/PROJECT.md", required: true });
        if (result.roadmap_exists) manifestFiles.push({ path: ".planning/ROADMAP.md", sections: ["Milestones", "Progress"], required: true });
        if (result.state_exists) manifestFiles.push({ path: ".planning/STATE.md", sections: ["Accumulated Context"], required: true });
        const compactResult = {
          current_milestone: result.current_milestone,
          current_milestone_name: result.current_milestone_name,
          project_exists: result.project_exists,
          roadmap_exists: result.roadmap_exists,
          state_exists: result.state_exists,
          research_enabled: result.research_enabled
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitQuick(cwd, description, raw) {
      const config = loadConfig(cwd);
      const now = /* @__PURE__ */ new Date();
      const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;
      const quickDir = path.join(cwd, ".planning", "quick");
      let nextNum = 1;
      try {
        const existing = fs.readdirSync(quickDir).filter((f) => /^\d+-/.test(f)).map((f) => parseInt(f.split("-")[0], 10)).filter((n) => !isNaN(n));
        if (existing.length > 0) {
          nextNum = Math.max(...existing) + 1;
        }
      } catch (e) {
        debugLog("init.quick", "readdir failed", e);
      }
      const result = {
        // Models
        planner_model: resolveModelInternal(cwd, "gsd-planner"),
        executor_model: resolveModelInternal(cwd, "gsd-executor"),
        checker_model: resolveModelInternal(cwd, "gsd-plan-checker"),
        verifier_model: resolveModelInternal(cwd, "gsd-verifier"),
        // Config
        commit_docs: config.commit_docs,
        // Quick task info
        next_num: nextNum,
        slug,
        description: description || null,
        // Timestamps
        date: now.toISOString().split("T")[0],
        timestamp: now.toISOString(),
        // Paths
        quick_dir: ".planning/quick",
        task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,
        // File existence
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        planning_exists: pathExistsInternal(cwd, ".planning")
      };
      try {
        const envManifest = autoTriggerEnvScan(cwd);
        result.env_summary = formatEnvSummary(envManifest);
      } catch (e) {
        debugLog("init.quick", "env scan failed (non-blocking)", e);
        result.env_summary = null;
      }
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (pathExistsInternal(cwd, ".planning/STATE.md")) manifestFiles.push({ path: ".planning/STATE.md", sections: ["Current Position"], required: false });
        const compactResult = {
          next_num: result.next_num,
          slug: result.slug,
          description: result.description,
          task_dir: result.task_dir,
          date: result.date,
          planning_exists: result.planning_exists,
          env_summary: result.env_summary || null
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitResume(cwd, raw) {
      const config = loadConfig(cwd);
      let interruptedAgentId = null;
      try {
        interruptedAgentId = fs.readFileSync(path.join(cwd, ".planning", "current-agent-id.txt"), "utf-8").trim();
      } catch (e) {
        debugLog("init.resume", "read failed", e);
      }
      const result = {
        // File existence
        state_exists: pathExistsInternal(cwd, ".planning/STATE.md"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        project_exists: pathExistsInternal(cwd, ".planning/PROJECT.md"),
        planning_exists: pathExistsInternal(cwd, ".planning"),
        // File paths
        state_path: ".planning/STATE.md",
        roadmap_path: ".planning/ROADMAP.md",
        project_path: ".planning/PROJECT.md",
        // Agent state
        has_interrupted_agent: !!interruptedAgentId,
        interrupted_agent_id: interruptedAgentId,
        // Config
        commit_docs: config.commit_docs
      };
      try {
        const envManifest = autoTriggerEnvScan(cwd);
        result.env_summary = formatEnvSummary(envManifest);
      } catch (e) {
        debugLog("init.resume", "env scan failed (non-blocking)", e);
        result.env_summary = null;
      }
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (result.state_exists) manifestFiles.push({ path: ".planning/STATE.md", required: true });
        if (result.roadmap_exists) manifestFiles.push({ path: ".planning/ROADMAP.md", sections: ["Progress"], required: true });
        const compactResult = {
          state_exists: result.state_exists,
          planning_exists: result.planning_exists,
          has_interrupted_agent: result.has_interrupted_agent,
          interrupted_agent_id: result.interrupted_agent_id,
          env_summary: result.env_summary || null
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitVerifyWork(cwd, phase, raw) {
      if (!phase) {
        error("phase required for init verify-work");
      }
      const config = loadConfig(cwd);
      const phaseInfo = findPhaseInternal(cwd, phase);
      const result = {
        // Models
        planner_model: resolveModelInternal(cwd, "gsd-planner"),
        checker_model: resolveModelInternal(cwd, "gsd-plan-checker"),
        // Config
        commit_docs: config.commit_docs,
        // Phase info
        phase_found: !!phaseInfo,
        phase_dir: phaseInfo?.directory || null,
        phase_number: phaseInfo?.phase_number || null,
        phase_name: phaseInfo?.phase_name || null,
        // Existing artifacts
        has_verification: phaseInfo?.has_verification || false
      };
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (phaseInfo?.directory) {
          try {
            const phaseFiles = fs.readdirSync(path.join(cwd, phaseInfo.directory));
            phaseFiles.filter((f) => f.endsWith("-PLAN.md")).forEach((f) => {
              manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
            });
            phaseFiles.filter((f) => f.endsWith("-SUMMARY.md")).forEach((f) => {
              manifestFiles.push({ path: `${phaseInfo.directory}/${f}`, required: true });
            });
          } catch (e) {
            debugLog("init.verifyWork", "manifest scan failed", e);
          }
        }
        if (pathExistsInternal(cwd, ".planning/ROADMAP.md")) {
          manifestFiles.push({ path: ".planning/ROADMAP.md", sections: [`Phase ${result.phase_number || ""}`], required: true });
        }
        const compactResult = {
          phase_found: result.phase_found,
          phase_dir: result.phase_dir,
          phase_number: result.phase_number,
          phase_name: result.phase_name,
          has_verification: result.has_verification
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitPhaseOp(cwd, phase, raw) {
      const config = loadConfig(cwd);
      let phaseInfo = findPhaseInternal(cwd, phase);
      if (!phaseInfo) {
        const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
        if (roadmapPhase?.found) {
          const phaseName = roadmapPhase.phase_name;
          phaseInfo = {
            found: true,
            directory: null,
            phase_number: roadmapPhase.phase_number,
            phase_name: phaseName,
            phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : null,
            plans: [],
            summaries: [],
            incomplete_plans: [],
            has_research: false,
            has_context: false,
            has_verification: false
          };
        }
      }
      const result = {
        // Config
        commit_docs: config.commit_docs,
        brave_search: config.brave_search,
        // Phase info
        phase_found: !!phaseInfo,
        phase_dir: phaseInfo?.directory || null,
        phase_number: phaseInfo?.phase_number || null,
        phase_name: phaseInfo?.phase_name || null,
        phase_slug: phaseInfo?.phase_slug || null,
        padded_phase: phaseInfo?.phase_number?.padStart(2, "0") || null,
        // Existing artifacts
        has_research: phaseInfo?.has_research || false,
        has_context: phaseInfo?.has_context || false,
        has_plans: (phaseInfo?.plans?.length || 0) > 0,
        has_verification: phaseInfo?.has_verification || false,
        plan_count: phaseInfo?.plans?.length || 0,
        // File existence
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        planning_exists: pathExistsInternal(cwd, ".planning"),
        // File paths
        state_path: ".planning/STATE.md",
        roadmap_path: ".planning/ROADMAP.md",
        requirements_path: ".planning/REQUIREMENTS.md"
      };
      if (phaseInfo?.directory) {
        const phaseDirFull = path.join(cwd, phaseInfo.directory);
        try {
          const files = fs.readdirSync(phaseDirFull);
          const contextFile = files.find((f) => f.endsWith("-CONTEXT.md") || f === "CONTEXT.md");
          if (contextFile) {
            result.context_path = path.join(phaseInfo.directory, contextFile);
          }
          const researchFile = files.find((f) => f.endsWith("-RESEARCH.md") || f === "RESEARCH.md");
          if (researchFile) {
            result.research_path = path.join(phaseInfo.directory, researchFile);
          }
          const verificationFile = files.find((f) => f.endsWith("-VERIFICATION.md") || f === "VERIFICATION.md");
          if (verificationFile) {
            result.verification_path = path.join(phaseInfo.directory, verificationFile);
          }
          const uatFile = files.find((f) => f.endsWith("-UAT.md") || f === "UAT.md");
          if (uatFile) {
            result.uat_path = path.join(phaseInfo.directory, uatFile);
          }
        } catch (e) {
          debugLog("init.phaseOp", "read phase files failed", e);
        }
      }
      try {
        const codebaseIntel = autoTriggerCodebaseIntel(cwd);
        result.codebase_summary = formatCodebaseSummary(codebaseIntel);
      } catch (e) {
        debugLog("init.phaseOp", "codebase intel failed (non-blocking)", e);
        result.codebase_summary = null;
      }
      if (global._gsdCompactMode) {
        const compactResult = {
          phase_found: result.phase_found,
          phase_dir: result.phase_dir,
          phase_number: result.phase_number,
          phase_name: result.phase_name,
          phase_slug: result.phase_slug,
          padded_phase: result.padded_phase,
          has_research: result.has_research,
          has_context: result.has_context,
          has_plans: result.has_plans,
          has_verification: result.has_verification,
          plan_count: result.plan_count
        };
        if (result.context_path) compactResult.context_path = result.context_path;
        if (result.research_path) compactResult.research_path = result.research_path;
        if (result.verification_path) compactResult.verification_path = result.verification_path;
        if (result.uat_path) compactResult.uat_path = result.uat_path;
        if (result.codebase_summary) compactResult.codebase_summary = result.codebase_summary;
        if (global._gsdManifestMode) {
          const manifestFiles = [
            { path: ".planning/STATE.md", sections: ["Current Position"], required: true },
            { path: ".planning/ROADMAP.md", sections: [`Phase ${result.phase_number || ""}`], required: true }
          ];
          if (pathExistsInternal(cwd, ".planning/REQUIREMENTS.md")) manifestFiles.push({ path: ".planning/REQUIREMENTS.md", required: false });
          if (result.context_path) manifestFiles.push({ path: result.context_path, required: false });
          if (result.research_path) manifestFiles.push({ path: result.research_path, required: false });
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitTodos(cwd, area, raw) {
      const config = loadConfig(cwd);
      const now = /* @__PURE__ */ new Date();
      const pendingDir = path.join(cwd, ".planning", "todos", "pending");
      let count = 0;
      const todos = [];
      try {
        const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(pendingDir, file), "utf-8");
            const createdMatch = content.match(/^created:\s*(.+)$/m);
            const titleMatch = content.match(/^title:\s*(.+)$/m);
            const areaMatch = content.match(/^area:\s*(.+)$/m);
            const todoArea = areaMatch ? areaMatch[1].trim() : "general";
            if (area && todoArea !== area) continue;
            count++;
            todos.push({
              file,
              created: createdMatch ? createdMatch[1].trim() : "unknown",
              title: titleMatch ? titleMatch[1].trim() : "Untitled",
              area: todoArea,
              path: path.join(".planning", "todos", "pending", file)
            });
          } catch (e) {
            debugLog("init.todos", "read todo file failed", e);
          }
        }
      } catch (e) {
        debugLog("init.todos", "read pending dir failed", e);
      }
      const result = {
        // Config
        commit_docs: config.commit_docs,
        // Timestamps
        date: now.toISOString().split("T")[0],
        timestamp: now.toISOString(),
        // Todo inventory
        todo_count: count,
        todos,
        area_filter: area || null,
        // Paths
        pending_dir: ".planning/todos/pending",
        completed_dir: ".planning/todos/completed",
        // File existence
        planning_exists: pathExistsInternal(cwd, ".planning"),
        todos_dir_exists: pathExistsInternal(cwd, ".planning/todos"),
        pending_dir_exists: pathExistsInternal(cwd, ".planning/todos/pending")
      };
      if (global._gsdCompactMode) {
        const manifestFiles = result.todos.map((t) => ({ path: t.path, required: true }));
        const compactResult = {
          todo_count: result.todo_count,
          todos: result.todos,
          area_filter: result.area_filter,
          date: result.date,
          pending_dir_exists: result.pending_dir_exists
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitMilestoneOp(cwd, raw) {
      const config = loadConfig(cwd);
      const milestone = getMilestoneInfo(cwd);
      let phaseCount = 0;
      let completedPhases = 0;
      const phaseTree = getPhaseTree(cwd);
      phaseCount = phaseTree.size;
      for (const [, entry] of phaseTree) {
        if (entry.summaries.length > 0) completedPhases++;
      }
      const archiveDir = path.join(cwd, ".planning", "archive");
      let archivedMilestones = [];
      try {
        archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      } catch (e) {
        debugLog("init.milestoneOp", "readdir failed", e);
      }
      const result = {
        // Config
        commit_docs: config.commit_docs,
        // Current milestone
        milestone_version: milestone.version,
        milestone_name: milestone.name,
        milestone_slug: generateSlugInternal(milestone.name),
        // Phase counts
        phase_count: phaseCount,
        completed_phases: completedPhases,
        all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,
        // Archive
        archived_milestones: archivedMilestones,
        archive_count: archivedMilestones.length,
        // File existence
        project_exists: pathExistsInternal(cwd, ".planning/PROJECT.md"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        state_exists: pathExistsInternal(cwd, ".planning/STATE.md"),
        archive_exists: pathExistsInternal(cwd, ".planning/archive"),
        phases_dir_exists: pathExistsInternal(cwd, ".planning/phases")
      };
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (result.roadmap_exists) manifestFiles.push({ path: ".planning/ROADMAP.md", sections: ["Milestones", "Progress"], required: true });
        if (result.state_exists) manifestFiles.push({ path: ".planning/STATE.md", sections: ["Current Position"], required: true });
        const compactResult = {
          milestone_version: result.milestone_version,
          milestone_name: result.milestone_name,
          phase_count: result.phase_count,
          completed_phases: result.completed_phases,
          all_phases_complete: result.all_phases_complete,
          archived_milestones: result.archived_milestones,
          archive_count: result.archive_count
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitMapCodebase(cwd, raw) {
      const config = loadConfig(cwd);
      const codebaseDir = path.join(cwd, ".planning", "codebase");
      let existingMaps = [];
      try {
        existingMaps = fs.readdirSync(codebaseDir).filter((f) => f.endsWith(".md"));
      } catch (e) {
        debugLog("init.mapCodebase", "readdir failed", e);
      }
      const result = {
        // Models
        mapper_model: resolveModelInternal(cwd, "gsd-codebase-mapper"),
        // Config
        commit_docs: config.commit_docs,
        search_gitignored: config.search_gitignored,
        parallelization: config.parallelization,
        // Paths
        codebase_dir: ".planning/codebase",
        // Existing maps
        existing_maps: existingMaps,
        has_maps: existingMaps.length > 0,
        // File existence
        planning_exists: pathExistsInternal(cwd, ".planning"),
        codebase_dir_exists: pathExistsInternal(cwd, ".planning/codebase")
      };
      if (global._gsdCompactMode) {
        const manifestFiles = result.existing_maps.map((m) => ({ path: `.planning/codebase/${m}`, required: false }));
        if (pathExistsInternal(cwd, ".planning/PROJECT.md")) manifestFiles.push({ path: ".planning/PROJECT.md", sections: ["Tech Stack"], required: false });
        const compactResult = {
          existing_maps: result.existing_maps,
          has_maps: result.has_maps,
          planning_exists: result.planning_exists,
          codebase_dir_exists: result.codebase_dir_exists,
          parallelization: result.parallelization
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      output(result, raw);
    }
    function cmdInitProgress(cwd, raw) {
      const config = loadConfig(cwd);
      const milestone = getMilestoneInfo(cwd);
      const phases = [];
      let currentPhase = null;
      let nextPhase = null;
      const phaseTree = getPhaseTree(cwd);
      for (const [, entry] of phaseTree) {
        const phaseNumber = entry.phaseNumber;
        if (milestone.phaseRange) {
          const num = parseInt(phaseNumber);
          if (num < milestone.phaseRange.start || num > milestone.phaseRange.end) continue;
        }
        const status = entry.summaries.length >= entry.plans.length && entry.plans.length > 0 ? "complete" : entry.plans.length > 0 ? "in_progress" : entry.hasResearch ? "researched" : "pending";
        const phaseInfo = {
          number: phaseNumber,
          name: entry.phaseName,
          directory: entry.relPath,
          status,
          plan_count: entry.plans.length,
          summary_count: entry.summaries.length,
          has_research: entry.hasResearch
        };
        phases.push(phaseInfo);
        if (!currentPhase && (status === "in_progress" || status === "researched")) {
          currentPhase = phaseInfo;
        }
        if (!nextPhase && status === "pending") {
          nextPhase = phaseInfo;
        }
      }
      let pausedAt = null;
      try {
        const state = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
        if (pauseMatch) pausedAt = pauseMatch[1].trim();
      } catch (e) {
        debugLog("init.progress", "read failed", e);
      }
      const result = {
        // Models
        executor_model: resolveModelInternal(cwd, "gsd-executor"),
        planner_model: resolveModelInternal(cwd, "gsd-planner"),
        // Config
        commit_docs: config.commit_docs,
        // Milestone
        milestone_version: milestone.version,
        milestone_name: milestone.name,
        // Phase overview
        phases,
        phase_count: phases.length,
        completed_count: phases.filter((p) => p.status === "complete").length,
        in_progress_count: phases.filter((p) => p.status === "in_progress").length,
        // Current state
        current_phase: currentPhase,
        next_phase: nextPhase,
        paused_at: pausedAt,
        has_work_in_progress: !!currentPhase,
        // File existence
        project_exists: pathExistsInternal(cwd, ".planning/PROJECT.md"),
        roadmap_exists: pathExistsInternal(cwd, ".planning/ROADMAP.md"),
        state_exists: pathExistsInternal(cwd, ".planning/STATE.md"),
        // File paths
        state_path: ".planning/STATE.md",
        roadmap_path: ".planning/ROADMAP.md",
        project_path: ".planning/PROJECT.md",
        config_path: ".planning/config.json",
        // Session diff (what changed since last session)
        session_diff: getSessionDiffSummary(cwd),
        // Intent summary (null if no INTENT.md)
        intent_summary: null
      };
      try {
        result.intent_summary = getIntentSummary(cwd);
      } catch (e) {
        debugLog("init.progress", "intent summary failed (non-blocking)", e);
      }
      try {
        const envManifest = autoTriggerEnvScan(cwd);
        result.env_summary = formatEnvSummary(envManifest);
        result.env_languages = envManifest?.languages?.length || 0;
        result.env_stale = false;
      } catch (e) {
        debugLog("init.progress", "env scan failed (non-blocking)", e);
        result.env_summary = null;
        result.env_languages = 0;
        result.env_stale = false;
      }
      try {
        const codebaseIntel = autoTriggerCodebaseIntel(cwd);
        result.codebase_summary = formatCodebaseSummary(codebaseIntel);
        result.codebase_intel_exists = !!codebaseIntel;
      } catch (e) {
        debugLog("init.progress", "codebase intel failed (non-blocking)", e);
        result.codebase_summary = null;
        result.codebase_intel_exists = false;
      }
      if (global._gsdCompactMode) {
        const manifestFiles = [];
        if (result.state_exists) manifestFiles.push({ path: ".planning/STATE.md", sections: ["Current Position"], required: false });
        if (result.roadmap_exists) manifestFiles.push({ path: ".planning/ROADMAP.md", sections: ["Progress"], required: false });
        const compactResult = {
          milestone_version: result.milestone_version,
          milestone_name: result.milestone_name,
          phases: result.phases,
          phase_count: result.phase_count,
          completed_count: result.completed_count,
          in_progress_count: result.in_progress_count,
          current_phase: result.current_phase,
          next_phase: result.next_phase,
          has_work_in_progress: result.has_work_in_progress,
          session_diff: result.session_diff,
          intent_summary: result.intent_summary || null,
          env_summary: result.env_summary || null,
          codebase_intel_exists: result.codebase_intel_exists || false
        };
        if (global._gsdManifestMode) {
          compactResult._manifest = { files: manifestFiles };
        }
        return output(compactResult, raw);
      }
      if (result.intent_summary === null) delete result.intent_summary;
      if (result.env_summary === null) {
        delete result.env_summary;
        delete result.env_languages;
        delete result.env_stale;
      }
      if (result.codebase_summary === null) {
        delete result.codebase_summary;
        delete result.codebase_intel_exists;
      }
      if (result.paused_at === null) delete result.paused_at;
      if (result.session_diff === null) delete result.session_diff;
      output(result, raw);
    }
    function cmdInitMemory(cwd, args, raw) {
      const workflowIdx = args.indexOf("--workflow");
      const workflow = workflowIdx !== -1 ? args[workflowIdx + 1] : null;
      const phaseIdx = args.indexOf("--phase");
      const phaseFilter = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
      const compact = args.includes("--compact") || global._gsdCompactMode;
      const maxChars = compact ? 4e3 : 8e3;
      const trimmed = [];
      const statePath = path.join(cwd, ".planning", "STATE.md");
      const stateContent = safeReadFile(statePath);
      const position = {};
      if (stateContent) {
        const phaseMatch = stateContent.match(/\*\*Phase:?\*\*:?\s*(.+)/i);
        if (phaseMatch) position.phase = phaseMatch[1].trim();
        const nameMatch = stateContent.match(/\*\*Phase Name:?\*\*:?\s*(.+)/i);
        if (nameMatch) position.phase_name = nameMatch[1].trim();
        const planMatch = stateContent.match(/\*\*Plan:?\*\*:?\s*(.+)/i);
        if (planMatch) position.plan = planMatch[1].trim();
        const statusMatch = stateContent.match(/\*\*Status:?\*\*:?\s*(.+)/i);
        if (statusMatch) position.status = statusMatch[1].trim();
        const lastMatch = stateContent.match(/\*\*Last [Aa]ctivity:?\*\*:?\s*(.+)/i);
        if (lastMatch) position.last_activity = lastMatch[1].trim();
        const stoppedMatch = stateContent.match(/\*\*Stopped [Aa]t:?\*\*:?\s*(.+)/i);
        if (stoppedMatch) position.stopped_at = stoppedMatch[1].trim();
      }
      let bookmark = null;
      const bookmarksPath = path.join(cwd, ".planning", "memory", "bookmarks.json");
      const bookmarksContent = safeReadFile(bookmarksPath);
      if (bookmarksContent) {
        try {
          const bookmarks = JSON.parse(bookmarksContent);
          if (Array.isArray(bookmarks) && bookmarks.length > 0) {
            bookmark = bookmarks[0];
            if (bookmark.git_head && phaseFilter && String(bookmark.phase) === String(phaseFilter)) {
              try {
                const headResult = execGit(cwd, ["rev-parse", "HEAD"]);
                if (headResult.exitCode === 0 && headResult.stdout !== bookmark.git_head) {
                  const diffResult = execGit(cwd, ["diff", "--name-only", bookmark.git_head, "HEAD"]);
                  if (diffResult.exitCode === 0 && diffResult.stdout) {
                    const changedFiles = diffResult.stdout.split("\n").filter(Boolean);
                    const relevantChanges = changedFiles.filter(
                      (f) => bookmark.last_file && f === bookmark.last_file || f.startsWith(".planning/")
                    );
                    if (relevantChanges.length > 0) {
                      bookmark.drift_warning = `${relevantChanges.length} relevant file(s) changed since bookmark`;
                    } else {
                      bookmark.drift_warning = null;
                    }
                  } else {
                    bookmark.drift_warning = null;
                  }
                } else {
                  bookmark.drift_warning = null;
                }
              } catch (e) {
                debugLog("init.memory", "git drift check failed", e);
                bookmark.drift_warning = null;
              }
            } else {
              bookmark.drift_warning = null;
            }
          }
        } catch (e) {
          debugLog("init.memory", "parse bookmarks failed", e);
        }
      }
      let decisions = [];
      const decisionsPath = path.join(cwd, ".planning", "memory", "decisions.json");
      const decisionsContent = safeReadFile(decisionsPath);
      if (decisionsContent) {
        try {
          let all = JSON.parse(decisionsContent);
          if (Array.isArray(all)) {
            if (phaseFilter) {
              all = all.filter((d) => d.phase && String(d.phase) === String(phaseFilter));
            }
            const limit = compact ? 5 : 10;
            decisions = all.slice(-limit).reverse();
          }
        } catch (e) {
          debugLog("init.memory", "parse decisions failed", e);
        }
      }
      let blockers = [];
      let todos = [];
      if (stateContent) {
        const blockerMatch = stateContent.match(/###\s*Blockers\/Concerns\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
        if (blockerMatch) {
          blockers = blockerMatch[1].split("\n").filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).filter(Boolean);
        }
        const todoMatch = stateContent.match(/###\s*Pending Todos\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
        if (todoMatch) {
          todos = todoMatch[1].split("\n").filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).filter(Boolean);
        }
      }
      let lessons = [];
      const lessonsPath = path.join(cwd, ".planning", "memory", "lessons.json");
      const lessonsContent = safeReadFile(lessonsPath);
      if (lessonsContent) {
        try {
          let all = JSON.parse(lessonsContent);
          if (Array.isArray(all)) {
            if (phaseFilter) {
              all = all.filter((l) => l.phase && String(l.phase) === String(phaseFilter));
            }
            lessons = all.slice(-5);
          }
        } catch (e) {
          debugLog("init.memory", "parse lessons failed", e);
        }
      }
      const codebaseDir = path.join(cwd, ".planning", "codebase");
      let sectionsToLoad = [];
      switch (workflow) {
        case "execute-phase":
        case "execute-plan":
          sectionsToLoad = ["CONVENTIONS.md", "ARCHITECTURE.md"];
          break;
        case "plan-phase":
          sectionsToLoad = ["ARCHITECTURE.md", "STACK.md", "CONCERNS.md"];
          break;
        case "verify-work":
          sectionsToLoad = ["TESTING.md", "CONVENTIONS.md"];
          break;
        case "quick":
          sectionsToLoad = ["CONVENTIONS.md"];
          break;
        default:
          sectionsToLoad = ["ARCHITECTURE.md"];
          break;
      }
      const codebaseContent = {};
      const sectionsLoaded = [];
      for (const section of sectionsToLoad) {
        const filePath = path.join(codebaseDir, section);
        const content = safeReadFile(filePath);
        if (content) {
          const lines = content.split("\n").slice(0, 50).join("\n");
          const key = section.replace(".md", "").toLowerCase();
          codebaseContent[key] = lines;
          sectionsLoaded.push(section);
        }
      }
      const codebase = {
        sections_loaded: sectionsLoaded,
        content: codebaseContent
      };
      const result = {
        position,
        bookmark,
        decisions,
        blockers,
        todos,
        lessons,
        codebase,
        digest_lines: decisions.length + blockers.length + todos.length + lessons.length,
        workflow: workflow || null,
        trimmed
      };
      let jsonStr = JSON.stringify(result);
      if (jsonStr.length > maxChars) {
        result.codebase.content = {};
        result.codebase.sections_loaded = [];
        trimmed.push("codebase");
        jsonStr = JSON.stringify(result);
      }
      if (jsonStr.length > maxChars) {
        result.lessons = result.lessons.slice(0, 2);
        trimmed.push("lessons");
        jsonStr = JSON.stringify(result);
      }
      if (jsonStr.length > maxChars) {
        result.decisions = result.decisions.slice(0, 3);
        trimmed.push("decisions");
        jsonStr = JSON.stringify(result);
      }
      if (jsonStr.length > maxChars) {
        result.todos = result.todos.slice(0, 2);
        trimmed.push("todos");
        jsonStr = JSON.stringify(result);
      }
      result.digest_lines = result.decisions.length + result.blockers.length + result.todos.length + result.lessons.length;
      output(result, raw);
    }
    function getSessionDiffSummary(cwd) {
      try {
        const state = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        let since = null;
        const lastMatch = state.match(/\*\*Last Activity:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        if (lastMatch) since = lastMatch[1];
        const sessionMatch = state.match(/\*\*Last session:\*\*\s*(\S+)/);
        if (sessionMatch && sessionMatch[1] > (since || "")) since = sessionMatch[1].split("T")[0];
        if (!since) return null;
        if (!isValidDateString(since)) {
          debugLog("feature.sessionDiff", `invalid date string rejected: ${since}`);
          return null;
        }
        const gitResult = execGit(cwd, ["log", `--since=${since}`, "--oneline", "--no-merges", "--", ".planning/"]);
        const log = gitResult.stdout || "";
        const commits = log ? log.split("\n").filter(Boolean) : [];
        return { since, commit_count: commits.length, recent: commits.slice(0, 5) };
      } catch (e) {
        debugLog("feature.sessionDiff", "exec failed", e);
        return null;
      }
    }
    module2.exports = {
      cmdInitExecutePhase,
      cmdInitPlanPhase,
      cmdInitNewProject,
      cmdInitNewMilestone,
      cmdInitQuick,
      cmdInitResume,
      cmdInitVerifyWork,
      cmdInitPhaseOp,
      cmdInitTodos,
      cmdInitMilestoneOp,
      cmdInitMapCodebase,
      cmdInitProgress,
      cmdInitMemory,
      getSessionDiffSummary
    };
  }
});

// node_modules/tokenx/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  approximateTokenSize: () => approximateTokenSize,
  estimateTokenCount: () => estimateTokenCount,
  isWithinTokenLimit: () => isWithinTokenLimit,
  sliceByTokens: () => sliceByTokens,
  splitByTokens: () => splitByTokens
});
function isWithinTokenLimit(text, tokenLimit, options) {
  return estimateTokenCount(text, options) <= tokenLimit;
}
function estimateTokenCount(text, options = {}) {
  if (!text) return 0;
  const { defaultCharsPerToken = DEFAULT_CHARS_PER_TOKEN, languageConfigs = DEFAULT_LANGUAGE_CONFIGS } = options;
  const segments = text.split(TOKEN_SPLIT_PATTERN).filter(Boolean);
  let tokenCount = 0;
  for (const segment of segments) tokenCount += estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken);
  return tokenCount;
}
function sliceByTokens(text, start = 0, end, options = {}) {
  if (!text) return "";
  const { defaultCharsPerToken = DEFAULT_CHARS_PER_TOKEN, languageConfigs = DEFAULT_LANGUAGE_CONFIGS } = options;
  let totalTokens = 0;
  if (start < 0 || end !== void 0 && end < 0) totalTokens = estimateTokenCount(text, options);
  const normalizedStart = start < 0 ? Math.max(0, totalTokens + start) : Math.max(0, start);
  const normalizedEnd = end === void 0 ? Infinity : end < 0 ? Math.max(0, totalTokens + end) : end;
  if (normalizedStart >= normalizedEnd) return "";
  const segments = text.split(TOKEN_SPLIT_PATTERN).filter(Boolean);
  const parts = [];
  let currentTokenPos = 0;
  for (const segment of segments) {
    if (currentTokenPos >= normalizedEnd) break;
    const tokenCount = estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken);
    const extracted = extractSegmentPart(segment, currentTokenPos, tokenCount, normalizedStart, normalizedEnd);
    if (extracted) parts.push(extracted);
    currentTokenPos += tokenCount;
  }
  return parts.join("");
}
function splitByTokens(text, tokensPerChunk, options = {}) {
  if (!text || tokensPerChunk <= 0) return [];
  const { defaultCharsPerToken = DEFAULT_CHARS_PER_TOKEN, languageConfigs = DEFAULT_LANGUAGE_CONFIGS, overlap = 0 } = options;
  const segments = text.split(TOKEN_SPLIT_PATTERN).filter(Boolean);
  const chunks = [];
  let currentChunk = [];
  let currentTokenCount = 0;
  for (const segment of segments) {
    const tokenCount = estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken);
    currentChunk.push(segment);
    currentTokenCount += tokenCount;
    if (currentTokenCount >= tokensPerChunk) {
      chunks.push(currentChunk.join(""));
      if (overlap > 0) {
        const overlapSegments = [];
        let overlapTokenCount = 0;
        for (let i = currentChunk.length - 1; i >= 0 && overlapTokenCount < overlap; i--) {
          const segmentValue = currentChunk[i];
          const tokCount = estimateSegmentTokens(segmentValue, languageConfigs, defaultCharsPerToken);
          overlapSegments.unshift(segmentValue);
          overlapTokenCount += tokCount;
        }
        currentChunk = overlapSegments;
        currentTokenCount = overlapTokenCount;
      } else {
        currentChunk = [];
        currentTokenCount = 0;
      }
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(""));
  return chunks;
}
function estimateSegmentTokens(segment, languageConfigs, defaultCharsPerToken) {
  if (PATTERNS.whitespace.test(segment)) return 0;
  if (PATTERNS.cjk.test(segment)) return getCharacterCount(segment);
  if (PATTERNS.numeric.test(segment)) return 1;
  if (segment.length <= SHORT_TOKEN_THRESHOLD) return 1;
  if (PATTERNS.punctuation.test(segment)) return segment.length > 1 ? Math.ceil(segment.length / 2) : 1;
  if (PATTERNS.alphanumeric.test(segment)) {
    const charsPerToken$1 = getLanguageSpecificCharsPerToken(segment, languageConfigs) ?? defaultCharsPerToken;
    return Math.ceil(segment.length / charsPerToken$1);
  }
  const charsPerToken = getLanguageSpecificCharsPerToken(segment, languageConfigs) ?? defaultCharsPerToken;
  return Math.ceil(segment.length / charsPerToken);
}
function getLanguageSpecificCharsPerToken(segment, languageConfigs) {
  for (const config of languageConfigs) if (config.pattern.test(segment)) return config.averageCharsPerToken;
}
function getCharacterCount(text) {
  return Array.from(text).length;
}
function extractSegmentPart(segment, segmentTokenStart, segmentTokenCount, targetStart, targetEnd) {
  if (segmentTokenCount === 0) return segmentTokenStart >= targetStart && segmentTokenStart < targetEnd ? segment : "";
  const segmentTokenEnd = segmentTokenStart + segmentTokenCount;
  if (segmentTokenStart >= targetEnd || segmentTokenEnd <= targetStart) return "";
  const overlapStart = Math.max(0, targetStart - segmentTokenStart);
  const overlapEnd = Math.min(segmentTokenCount, targetEnd - segmentTokenStart);
  if (overlapStart === 0 && overlapEnd === segmentTokenCount) return segment;
  const charStart = Math.floor(overlapStart / segmentTokenCount * segment.length);
  const charEnd = Math.ceil(overlapEnd / segmentTokenCount * segment.length);
  return segment.slice(charStart, charEnd);
}
var PATTERNS, TOKEN_SPLIT_PATTERN, DEFAULT_CHARS_PER_TOKEN, SHORT_TOKEN_THRESHOLD, DEFAULT_LANGUAGE_CONFIGS, approximateTokenSize;
var init_dist = __esm({
  "node_modules/tokenx/dist/index.mjs"() {
    PATTERNS = {
      whitespace: /^\s+$/,
      cjk: /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\u30A0-\u30FF\u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3300-\u33FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/,
      numeric: /^\d+(?:[.,]\d+)*$/,
      punctuation: /[.,!?;(){}[\]<>:/\\|@#$%^&*+=`~_-]/,
      alphanumeric: /^[a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+$/
    };
    TOKEN_SPLIT_PATTERN = /* @__PURE__ */ new RegExp(`(\\s+|${PATTERNS.punctuation.source}+)`);
    DEFAULT_CHARS_PER_TOKEN = 6;
    SHORT_TOKEN_THRESHOLD = 3;
    DEFAULT_LANGUAGE_CONFIGS = [
      {
        pattern: /[äöüßẞ]/i,
        averageCharsPerToken: 3
      },
      {
        pattern: /[éèêëàâîïôûùüÿçœæáíóúñ]/i,
        averageCharsPerToken: 3
      },
      {
        pattern: /[ąćęłńóśźżěščřžýůúďťň]/i,
        averageCharsPerToken: 3.5
      }
    ];
    approximateTokenSize = estimateTokenCount;
  }
});

// src/lib/context.js
var require_context = __commonJS({
  "src/lib/context.js"(exports2, module2) {
    "use strict";
    var { debugLog } = require_output();
    var _estimateTokenCount = null;
    function getTokenizer() {
      if (_estimateTokenCount !== null) return _estimateTokenCount;
      try {
        const tokenx = (init_dist(), __toCommonJS(dist_exports));
        _estimateTokenCount = tokenx.estimateTokenCount;
        debugLog("context.tokenizer", "tokenx loaded successfully");
      } catch (e) {
        debugLog("context.tokenizer", "tokenx load failed, using fallback", e);
        _estimateTokenCount = (text) => Math.ceil(String(text).length / 4);
      }
      return _estimateTokenCount;
    }
    function estimateTokens(text) {
      if (!text || typeof text !== "string") return 0;
      try {
        const fn = getTokenizer();
        return fn(text);
      } catch (e) {
        debugLog("context.estimateTokens", "estimation failed, using fallback", e);
        return Math.ceil(text.length / 4);
      }
    }
    function estimateJsonTokens(obj) {
      if (obj === void 0 || obj === null) return 0;
      try {
        return estimateTokens(JSON.stringify(obj));
      } catch (e) {
        debugLog("context.estimateJsonTokens", "stringify failed", e);
        return 0;
      }
    }
    function checkBudget(tokens, config = {}) {
      const contextWindow = config.context_window || 2e5;
      const targetPercent = config.context_target_percent || 50;
      const percent = Math.round(tokens / contextWindow * 100);
      const warning = percent > targetPercent;
      let recommendation = null;
      if (percent > 80) {
        recommendation = "Critical: exceeds 80% of context window. Split into smaller units.";
      } else if (percent > 60) {
        recommendation = "High: exceeds 60% of context window. Consider reducing scope.";
      } else if (percent > targetPercent) {
        recommendation = `Above target: exceeds ${targetPercent}% target. Monitor closely.`;
      }
      return { tokens, percent, warning, recommendation };
    }
    function isWithinBudget(text, config = {}) {
      const tokens = estimateTokens(text);
      return checkBudget(tokens, config);
    }
    module2.exports = { estimateTokens, estimateJsonTokens, checkBudget, isWithinBudget };
  }
});

// src/commands/misc.js
var require_misc = __commonJS({
  "src/commands/misc.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { execSync } = require("child_process");
    var { output, error, debugLog } = require_output();
    var { loadConfig, isGitIgnored } = require_config();
    var { MODEL_PROFILES, CONFIG_SCHEMA } = require_constants();
    var { safeReadFile, cachedReadFile, normalizePhaseName, findPhaseInternal, generateSlugInternal, getArchivedPhaseDirs, getMilestoneInfo, getPhaseTree, cachedReaddirSync } = require_helpers();
    var { extractFrontmatter, reconstructFrontmatter, spliceFrontmatter } = require_frontmatter();
    var { execGit } = require_git();
    function cmdGenerateSlug(text, raw) {
      if (!text) {
        error("text required for slug generation");
      }
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const result = { slug };
      output(result, raw, slug);
    }
    function cmdCurrentTimestamp(format, raw) {
      const now = /* @__PURE__ */ new Date();
      let result;
      switch (format) {
        case "date":
          result = now.toISOString().split("T")[0];
          break;
        case "filename":
          result = now.toISOString().replace(/:/g, "-").replace(/\..+/, "");
          break;
        case "full":
        default:
          result = now.toISOString();
          break;
      }
      output({ timestamp: result }, raw, result);
    }
    function cmdListTodos(cwd, area, raw) {
      const pendingDir = path.join(cwd, ".planning", "todos", "pending");
      let count = 0;
      const todos = [];
      try {
        const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(pendingDir, file), "utf-8");
            const createdMatch = content.match(/^created:\s*(.+)$/m);
            const titleMatch = content.match(/^title:\s*(.+)$/m);
            const areaMatch = content.match(/^area:\s*(.+)$/m);
            const todoArea = areaMatch ? areaMatch[1].trim() : "general";
            if (area && todoArea !== area) continue;
            count++;
            todos.push({
              file,
              created: createdMatch ? createdMatch[1].trim() : "unknown",
              title: titleMatch ? titleMatch[1].trim() : "Untitled",
              area: todoArea,
              path: path.join(".planning", "todos", "pending", file)
            });
          } catch (e) {
            debugLog("feature.listTodos", "read todo file failed", e);
          }
        }
      } catch (e) {
        debugLog("feature.listTodos", "read pending dir failed", e);
      }
      const result = { count, todos };
      output(result, raw, count.toString());
    }
    function cmdVerifyPathExists(cwd, targetPath, raw) {
      if (!targetPath) {
        error("path required for verification");
      }
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
      try {
        const stats = fs.statSync(fullPath);
        const type = stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other";
        const result = { exists: true, type };
        output(result, raw, "true");
      } catch (e) {
        debugLog("file.stat", "stat failed", e);
        const result = { exists: false, type: null };
        output(result, raw, "false");
      }
    }
    function cmdConfigEnsureSection(cwd, raw) {
      const configPath = path.join(cwd, ".planning", "config.json");
      const planningDir = path.join(cwd, ".planning");
      try {
        if (!fs.existsSync(planningDir)) {
          fs.mkdirSync(planningDir, { recursive: true });
        }
      } catch (err) {
        debugLog("config.ensure", "mkdir failed", err);
        error("Failed to create .planning directory: " + err.message);
      }
      if (fs.existsSync(configPath)) {
        const result = { created: false, reason: "already_exists" };
        output(result, raw, "exists");
        return;
      }
      const homedir = require("os").homedir();
      const braveKeyFile = path.join(homedir, ".gsd", "brave_api_key");
      const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
      const globalDefaultsPath = path.join(homedir, ".gsd", "defaults.json");
      let userDefaults = {};
      try {
        if (fs.existsSync(globalDefaultsPath)) {
          userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, "utf-8"));
        }
      } catch (err) {
        debugLog("config.ensure", "read failed", err);
      }
      const hardcoded = {};
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        if (def.nested) {
          if (!hardcoded[def.nested.section]) hardcoded[def.nested.section] = {};
          hardcoded[def.nested.section][def.nested.field] = def.default;
        } else {
          hardcoded[key] = def.default;
        }
      }
      hardcoded.brave_search = hasBraveSearch;
      const defaults = {
        ...hardcoded,
        ...userDefaults,
        workflow: { ...hardcoded.workflow, ...userDefaults.workflow || {} }
      };
      try {
        fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), "utf-8");
        const result = { created: true, path: ".planning/config.json" };
        output(result, raw, "created");
      } catch (err) {
        debugLog("config.ensure", "write failed", err);
        error("Failed to create config.json: " + err.message);
      }
    }
    function cmdConfigSet(cwd, keyPath, value, raw) {
      const configPath = path.join(cwd, ".planning", "config.json");
      if (!keyPath) {
        error("Usage: config-set <key.path> <value>");
      }
      let parsedValue = value;
      if (value === "true") parsedValue = true;
      else if (value === "false") parsedValue = false;
      else if (!isNaN(value) && value !== "") parsedValue = Number(value);
      let config = {};
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        }
      } catch (err) {
        debugLog("config.set", "read failed", err);
        error("Failed to read config.json: " + err.message);
      }
      const keys = keyPath.split(".");
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === void 0 || typeof current[key] !== "object") {
          current[key] = {};
        }
        current = current[key];
      }
      current[keys[keys.length - 1]] = parsedValue;
      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        const result = { updated: true, key: keyPath, value: parsedValue };
        output(result, raw, `${keyPath}=${parsedValue}`);
      } catch (err) {
        debugLog("config.set", "write failed", err);
        error("Failed to write config.json: " + err.message);
      }
    }
    function cmdConfigGet(cwd, keyPath, raw) {
      const configPath = path.join(cwd, ".planning", "config.json");
      if (!keyPath) {
        error("Usage: config-get <key.path>");
      }
      let config = {};
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } else {
          error("No config.json found at " + configPath);
        }
      } catch (err) {
        debugLog("config.get", "read failed", err);
        if (err.message.startsWith("No config.json")) throw err;
        error("Failed to read config.json: " + err.message);
      }
      const keys = keyPath.split(".");
      let current = config;
      for (const key of keys) {
        if (current === void 0 || current === null || typeof current !== "object") {
          error(`Key not found: ${keyPath}`);
        }
        current = current[key];
      }
      if (current === void 0) {
        error(`Key not found: ${keyPath}`);
      }
      output(current, raw, String(current));
    }
    function cmdConfigMigrate(cwd, raw) {
      const configPath = path.join(cwd, ".planning", "config.json");
      const backupPath = configPath + ".bak";
      let config = {};
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } else {
          error("No config.json found at " + configPath + ". Run config-ensure-section first.");
        }
      } catch (err) {
        debugLog("config.migrate", "read failed", err);
        if (err.message.startsWith("No config.json")) throw err;
        error("Failed to read config.json: " + err.message);
      }
      const migratedKeys = [];
      const unchangedKeys = [];
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        if (def.nested) {
          const section = def.nested.section;
          const field = def.nested.field;
          if (config[section] && config[section][field] !== void 0) {
            unchangedKeys.push(`${section}.${field}`);
          } else {
            if (!config[section] || typeof config[section] !== "object") {
              config[section] = {};
            }
            config[section][field] = def.default;
            migratedKeys.push(`${section}.${field}`);
          }
        } else {
          if (config[key] !== void 0) {
            unchangedKeys.push(key);
          } else {
            config[key] = def.default;
            migratedKeys.push(key);
          }
        }
      }
      if (migratedKeys.length > 0) {
        try {
          fs.copyFileSync(configPath, backupPath);
        } catch (err) {
          debugLog("config.migrate", "backup failed", err);
          error("Failed to create backup: " + err.message);
        }
        try {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        } catch (err) {
          debugLog("config.migrate", "write failed", err);
          error("Failed to write config.json: " + err.message);
        }
      }
      const result = {
        migrated_keys: migratedKeys,
        unchanged_keys: unchangedKeys,
        config_path: ".planning/config.json",
        backup_path: migratedKeys.length > 0 ? ".planning/config.json.bak" : null
      };
      output(result, raw);
    }
    function cmdHistoryDigest(cwd, options, raw) {
      const limit = options.limit || null;
      const phasesFilter = options.phases || null;
      const compact = options.compact || false;
      const phasesDir = path.join(cwd, ".planning", "phases");
      const digest = { phases: {}, decisions: [], tech_stack: /* @__PURE__ */ new Set() };
      const allPhaseDirs = [];
      const archived = getArchivedPhaseDirs(cwd);
      for (const a of archived) {
        allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
      }
      if (fs.existsSync(phasesDir)) {
        try {
          const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
          for (const dir of currentDirs) {
            allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
          }
        } catch (e) {
          debugLog("feature.historyDigest", "readdir failed", e);
        }
      }
      if (allPhaseDirs.length === 0) {
        digest.tech_stack = [];
        output(digest, raw);
        return;
      }
      try {
        for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
          const summaries = fs.readdirSync(dirPath).filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md");
          for (const summary of summaries) {
            try {
              const content = cachedReadFile(path.join(dirPath, summary));
              if (!content) continue;
              const fm = extractFrontmatter(content);
              const phaseNum = fm.phase || dir.split("-")[0];
              if (!digest.phases[phaseNum]) {
                digest.phases[phaseNum] = {
                  name: fm.name || dir.split("-").slice(1).join(" ") || "Unknown",
                  provides: /* @__PURE__ */ new Set(),
                  affects: /* @__PURE__ */ new Set(),
                  patterns: /* @__PURE__ */ new Set()
                };
              }
              if (fm["dependency-graph"] && fm["dependency-graph"].provides) {
                fm["dependency-graph"].provides.forEach((p) => digest.phases[phaseNum].provides.add(p));
              } else if (fm.provides) {
                fm.provides.forEach((p) => digest.phases[phaseNum].provides.add(p));
              }
              if (fm["dependency-graph"] && fm["dependency-graph"].affects) {
                fm["dependency-graph"].affects.forEach((a) => digest.phases[phaseNum].affects.add(a));
              }
              if (fm["patterns-established"]) {
                fm["patterns-established"].forEach((p) => digest.phases[phaseNum].patterns.add(p));
              }
              if (fm["key-decisions"]) {
                fm["key-decisions"].forEach((d) => {
                  digest.decisions.push({ phase: phaseNum, decision: d });
                });
              }
              if (fm["tech-stack"] && fm["tech-stack"].added) {
                fm["tech-stack"].added.forEach((t) => digest.tech_stack.add(typeof t === "string" ? t : t.name));
              }
            } catch (e) {
              debugLog("feature.historyDigest", "skip malformed summary", e);
            }
          }
        }
        Object.keys(digest.phases).forEach((p) => {
          digest.phases[p].provides = [...digest.phases[p].provides];
          digest.phases[p].affects = [...digest.phases[p].affects];
          digest.phases[p].patterns = [...digest.phases[p].patterns];
        });
        digest.tech_stack = [...digest.tech_stack];
        if (phasesFilter) {
          const allowed = new Set(phasesFilter);
          digest.phases = Object.fromEntries(Object.entries(digest.phases).filter(([k]) => allowed.has(k)));
          digest.decisions = digest.decisions.filter((d) => allowed.has(String(d.phase)));
        }
        if (limit) {
          const kept = new Set(Object.keys(digest.phases).sort((a, b) => parseFloat(b) - parseFloat(a)).slice(0, limit));
          digest.phases = Object.fromEntries(Object.entries(digest.phases).filter(([k]) => kept.has(k)));
          digest.decisions = digest.decisions.filter((d) => kept.has(String(d.phase)));
        }
        if (compact) {
          delete digest.decisions;
          delete digest.tech_stack;
        }
        output(digest, raw);
      } catch (e) {
        debugLog("feature.historyDigest", "digest generation failed", e);
        error("Failed to generate history digest: " + e.message);
      }
    }
    function cmdResolveModel(cwd, agentType, raw) {
      if (!agentType) {
        error("agent-type required");
      }
      const config = loadConfig(cwd);
      const profile = config.model_profile || "balanced";
      const agentModels = MODEL_PROFILES[agentType];
      if (!agentModels) {
        const result2 = { model: "sonnet", profile, unknown_agent: true };
        output(result2, raw, "sonnet");
        return;
      }
      const resolved = agentModels[profile] || agentModels["balanced"] || "sonnet";
      const model = resolved === "opus" ? "inherit" : resolved;
      const result = { model, profile };
      output(result, raw, model);
    }
    function cmdFindPhase(cwd, phase, raw) {
      if (!phase) {
        error("phase identifier required");
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const normalized = normalizePhaseName(phase);
      const notFound = { found: false, directory: null, phase_number: null, phase_name: null, plans: [], summaries: [] };
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        const match = dirs.find((d) => d.startsWith(normalized));
        if (!match) {
          output(notFound, raw, "");
          return;
        }
        const dirMatch = match.match(/^(\d+(?:\.\d+)?)-?(.*)/);
        const phaseNumber = dirMatch ? dirMatch[1] : normalized;
        const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
        const phaseDir = path.join(phasesDir, match);
        const phaseFiles = fs.readdirSync(phaseDir);
        const plans = phaseFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
        const summaries = phaseFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md").sort();
        const result = {
          found: true,
          directory: path.join(".planning", "phases", match),
          phase_number: phaseNumber,
          phase_name: phaseName,
          plans,
          summaries
        };
        output(result, raw, result.directory);
      } catch (e) {
        debugLog("phase.find", "readdir failed", e);
        output(notFound, raw, "");
      }
    }
    function cmdCommit(cwd, message, files, raw, amend) {
      if (!message && !amend) {
        error("commit message required");
      }
      const config = loadConfig(cwd);
      if (!config.commit_docs) {
        const result2 = { committed: false, hash: null, reason: "skipped_commit_docs_false" };
        output(result2, raw, "skipped");
        return;
      }
      if (isGitIgnored(cwd, ".planning")) {
        const result2 = { committed: false, hash: null, reason: "skipped_gitignored" };
        output(result2, raw, "skipped");
        return;
      }
      const filesToStage = files && files.length > 0 ? files : [".planning/"];
      for (const file of filesToStage) {
        execGit(cwd, ["add", file]);
      }
      const commitArgs = amend ? ["commit", "--amend", "--no-edit"] : ["commit", "-m", message];
      const commitResult = execGit(cwd, commitArgs);
      if (commitResult.exitCode !== 0) {
        if (commitResult.stdout.includes("nothing to commit") || commitResult.stderr.includes("nothing to commit")) {
          const result3 = { committed: false, hash: null, reason: "nothing_to_commit" };
          output(result3, raw, "nothing");
          return;
        }
        const result2 = { committed: false, hash: null, reason: "nothing_to_commit", error: commitResult.stderr };
        output(result2, raw, "nothing");
        return;
      }
      const hashResult = execGit(cwd, ["rev-parse", "--short", "HEAD"]);
      const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
      const result = { committed: true, hash, reason: "committed" };
      output(result, raw, hash || "committed");
    }
    function cmdVerifySummary(cwd, summaryPath, checkFileCount, raw) {
      if (!summaryPath) {
        error("summary-path required");
      }
      const fullPath = path.join(cwd, summaryPath);
      const checkCount = checkFileCount || 2;
      if (!fs.existsSync(fullPath)) {
        const result2 = {
          passed: false,
          checks: {
            summary_exists: false,
            files_created: { checked: 0, found: 0, missing: [] },
            commits_exist: false,
            self_check: "not_found"
          },
          errors: ["SUMMARY.md not found"]
        };
        output(result2, raw, "failed");
        return;
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      const errors = [];
      const mentionedFiles = /* @__PURE__ */ new Set();
      const patterns = [
        /`([^`]+\.[a-zA-Z]+)`/g,
        /(?:Created|Modified|Added|Updated|Edited):\s*`?([^\s`]+\.[a-zA-Z]+)`?/gi
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(content)) !== null) {
          const filePath = m[1];
          if (filePath && !filePath.startsWith("http") && filePath.includes("/")) {
            mentionedFiles.add(filePath);
          }
        }
      }
      const filesToCheck = Array.from(mentionedFiles).slice(0, checkCount);
      const missing = [];
      for (const file of filesToCheck) {
        if (!fs.existsSync(path.join(cwd, file))) {
          missing.push(file);
        }
      }
      const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
      const hashes = content.match(commitHashPattern) || [];
      let commitsExist = false;
      if (hashes.length > 0) {
        for (const hash of hashes.slice(0, 3)) {
          const result2 = execGit(cwd, ["cat-file", "-t", hash]);
          if (result2.exitCode === 0 && result2.stdout === "commit") {
            commitsExist = true;
            break;
          }
        }
      }
      let selfCheck = "not_found";
      const selfCheckPattern = /##\s*(?:Self[- ]?Check|Verification|Quality Check)/i;
      if (selfCheckPattern.test(content)) {
        const passPattern = /(?:all\s+)?(?:pass|✓|✅|complete|succeeded)/i;
        const failPattern = /(?:fail|✗|❌|incomplete|blocked)/i;
        const checkSection = content.slice(content.search(selfCheckPattern));
        if (failPattern.test(checkSection)) {
          selfCheck = "failed";
        } else if (passPattern.test(checkSection)) {
          selfCheck = "passed";
        }
      }
      if (missing.length > 0) errors.push("Missing files: " + missing.join(", "));
      if (!commitsExist && hashes.length > 0) errors.push("Referenced commit hashes not found in git history");
      if (selfCheck === "failed") errors.push("Self-check section indicates failure");
      const checks = {
        summary_exists: true,
        files_created: { checked: filesToCheck.length, found: filesToCheck.length - missing.length, missing },
        commits_exist: commitsExist,
        self_check: selfCheck
      };
      const passed = missing.length === 0 && selfCheck !== "failed";
      const result = { passed, checks, errors };
      output(result, raw, passed ? "passed" : "failed");
    }
    function cmdTemplateSelect(cwd, planPath, raw) {
      if (!planPath) {
        error("plan-path required");
      }
      try {
        const fullPath = path.join(cwd, planPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const taskMatch = content.match(/###\s*Task\s*\d+/g) || [];
        const taskCount = taskMatch.length;
        const decisionMatch = content.match(/decision/gi) || [];
        const hasDecisions = decisionMatch.length > 0;
        const fileMentions = /* @__PURE__ */ new Set();
        const filePattern = /`([^`]+\.[a-zA-Z]+)`/g;
        let m;
        while ((m = filePattern.exec(content)) !== null) {
          if (m[1].includes("/") && !m[1].startsWith("http")) {
            fileMentions.add(m[1]);
          }
        }
        const fileCount = fileMentions.size;
        let template = "templates/summary-standard.md";
        let type = "standard";
        if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
          template = "templates/summary-minimal.md";
          type = "minimal";
        } else if (hasDecisions || fileCount > 6 || taskCount > 5) {
          template = "templates/summary-complex.md";
          type = "complex";
        }
        const result = { template, type, taskCount, fileCount, hasDecisions };
        output(result, raw, template);
      } catch (e) {
        debugLog("template.pick", "template selection failed", e);
        output({ template: "templates/summary-standard.md", type: "standard", error: e.message }, raw, "templates/summary-standard.md");
      }
    }
    function cmdTemplateFill(cwd, templateType, options, raw) {
      if (!templateType) {
        error("template type required: summary, plan, or verification");
      }
      if (!options.phase) {
        error("--phase required");
      }
      const phaseInfo = findPhaseInternal(cwd, options.phase);
      if (!phaseInfo || !phaseInfo.found) {
        output({ error: "Phase not found", phase: options.phase }, raw);
        return;
      }
      const padded = normalizePhaseName(options.phase);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const phaseName = options.name || phaseInfo.phase_name || "Unnamed";
      const phaseSlug = phaseInfo.phase_slug || generateSlugInternal(phaseName);
      const phaseId = `${padded}-${phaseSlug}`;
      const planNum = (options.plan || "01").padStart(2, "0");
      const fields = options.fields || {};
      let frontmatter, body, fileName;
      switch (templateType) {
        case "summary": {
          frontmatter = {
            phase: phaseId,
            plan: planNum,
            subsystem: "[primary category]",
            tags: [],
            provides: [],
            affects: [],
            "tech-stack": { added: [], patterns: [] },
            "key-files": { created: [], modified: [] },
            "key-decisions": [],
            "patterns-established": [],
            duration: "[X]min",
            completed: today,
            ...fields
          };
          body = [
            `# Phase ${options.phase}: ${phaseName} Summary`,
            "",
            "**[Substantive one-liner describing outcome]**",
            "",
            "## Performance",
            "- **Duration:** [time]",
            "- **Tasks:** [count completed]",
            "- **Files modified:** [count]",
            "",
            "## Accomplishments",
            "- [Key outcome 1]",
            "- [Key outcome 2]",
            "",
            "## Task Commits",
            "1. **Task 1: [task name]** - `hash`",
            "",
            "## Files Created/Modified",
            "- `path/to/file.ts` - What it does",
            "",
            "## Decisions & Deviations",
            '[Key decisions or "None - followed plan as specified"]',
            "",
            "## Next Phase Readiness",
            "[What's ready for next phase]"
          ].join("\n");
          fileName = `${padded}-${planNum}-SUMMARY.md`;
          break;
        }
        case "plan": {
          const planType = options.type || "execute";
          const wave = parseInt(options.wave) || 1;
          frontmatter = {
            phase: phaseId,
            plan: planNum,
            type: planType,
            wave,
            depends_on: [],
            files_modified: [],
            autonomous: true,
            user_setup: [],
            must_haves: { truths: [], artifacts: [], key_links: [] },
            ...fields
          };
          body = [
            `# Phase ${options.phase} Plan ${planNum}: [Title]`,
            "",
            "## Objective",
            "- **What:** [What this plan builds]",
            "- **Why:** [Why it matters for the phase goal]",
            "- **Output:** [Concrete deliverable]",
            "",
            "## Context",
            "@.planning/PROJECT.md",
            "@.planning/ROADMAP.md",
            "@.planning/STATE.md",
            "",
            "## Tasks",
            "",
            '<task type="code">',
            "  <name>[Task name]</name>",
            "  <files>[file paths]</files>",
            "  <action>[What to do]</action>",
            "  <verify>[How to verify]</verify>",
            "  <done>[Definition of done]</done>",
            "</task>",
            "",
            "## Verification",
            "[How to verify this plan achieved its objective]",
            "",
            "## Success Criteria",
            "- [ ] [Criterion 1]",
            "- [ ] [Criterion 2]"
          ].join("\n");
          fileName = `${padded}-${planNum}-PLAN.md`;
          break;
        }
        case "verification": {
          frontmatter = {
            phase: phaseId,
            verified: (/* @__PURE__ */ new Date()).toISOString(),
            status: "pending",
            score: "0/0 must-haves verified",
            ...fields
          };
          body = [
            `# Phase ${options.phase}: ${phaseName} \u2014 Verification`,
            "",
            "## Observable Truths",
            "| # | Truth | Status | Evidence |",
            "|---|-------|--------|----------|",
            "| 1 | [Truth] | pending | |",
            "",
            "## Required Artifacts",
            "| Artifact | Expected | Status | Details |",
            "|----------|----------|--------|---------|",
            "| [path] | [what] | pending | |",
            "",
            "## Key Link Verification",
            "| From | To | Via | Status | Details |",
            "|------|----|----|--------|---------|",
            "| [source] | [target] | [connection] | pending | |",
            "",
            "## Requirements Coverage",
            "| Requirement | Status | Blocking Issue |",
            "|-------------|--------|----------------|",
            "| [req] | pending | |",
            "",
            "## Result",
            "[Pending verification]"
          ].join("\n");
          fileName = `${padded}-VERIFICATION.md`;
          break;
        }
        default:
          error(`Unknown template type: ${templateType}. Available: summary, plan, verification`);
          return;
      }
      const fullContent = `---
${reconstructFrontmatter(frontmatter)}
---

${body}
`;
      const outPath = path.join(cwd, phaseInfo.directory, fileName);
      if (fs.existsSync(outPath)) {
        output({ error: "File already exists", path: path.relative(cwd, outPath) }, raw);
        return;
      }
      fs.writeFileSync(outPath, fullContent, "utf-8");
      const relPath = path.relative(cwd, outPath);
      output({ created: true, path: relPath, template: templateType }, raw, relPath);
    }
    function cmdPhasePlanIndex(cwd, phase, raw) {
      if (!phase) {
        error("phase required for phase-plan-index");
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const normalized = normalizePhaseName(phase);
      let phaseDir = null;
      let phaseDirName = null;
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        const match = dirs.find((d) => d.startsWith(normalized));
        if (match) {
          phaseDir = path.join(phasesDir, match);
          phaseDirName = match;
        }
      } catch (e) {
        debugLog("phase.planIndex", "readdir failed", e);
      }
      if (!phaseDir) {
        output({ phase: normalized, error: "Phase not found", plans: [], waves: {}, incomplete: [], has_checkpoints: false }, raw);
        return;
      }
      const phaseFiles = fs.readdirSync(phaseDir);
      const planFiles = phaseFiles.filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md").sort();
      const summaryFiles = phaseFiles.filter((f) => f.endsWith("-SUMMARY.md") || f === "SUMMARY.md");
      const completedPlanIds = new Set(
        summaryFiles.map((s) => s.replace("-SUMMARY.md", "").replace("SUMMARY.md", ""))
      );
      const plans = [];
      const waves = {};
      const incomplete = [];
      let hasCheckpoints = false;
      for (const planFile of planFiles) {
        const planId = planFile.replace("-PLAN.md", "").replace("PLAN.md", "");
        const planPath = path.join(phaseDir, planFile);
        const content = fs.readFileSync(planPath, "utf-8");
        const fm = extractFrontmatter(content);
        const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
        const taskCount = taskMatches.length;
        const wave = parseInt(fm.wave, 10) || 1;
        let autonomous = true;
        if (fm.autonomous !== void 0) {
          autonomous = fm.autonomous === "true" || fm.autonomous === true;
        }
        if (!autonomous) {
          hasCheckpoints = true;
        }
        let filesModified = [];
        if (fm["files-modified"]) {
          filesModified = Array.isArray(fm["files-modified"]) ? fm["files-modified"] : [fm["files-modified"]];
        }
        const hasSummary = completedPlanIds.has(planId);
        if (!hasSummary) {
          incomplete.push(planId);
        }
        const plan = {
          id: planId,
          wave,
          autonomous,
          objective: fm.objective || null,
          files_modified: filesModified,
          task_count: taskCount,
          has_summary: hasSummary
        };
        plans.push(plan);
        const waveKey = String(wave);
        if (!waves[waveKey]) {
          waves[waveKey] = [];
        }
        waves[waveKey].push(planId);
      }
      const result = {
        phase: normalized,
        plans,
        waves,
        incomplete,
        has_checkpoints: hasCheckpoints
      };
      output(result, raw);
    }
    function cmdStateSnapshot(cwd, raw) {
      const statePath = path.join(cwd, ".planning", "STATE.md");
      if (!fs.existsSync(statePath)) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const content = fs.readFileSync(statePath, "utf-8");
      const extractField = (fieldName) => {
        const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, "i");
        const match = content.match(pattern);
        return match ? match[1].trim() : null;
      };
      const currentPhase = extractField("Current Phase");
      const currentPhaseName = extractField("Current Phase Name");
      const totalPhasesRaw = extractField("Total Phases");
      const currentPlan = extractField("Current Plan");
      const totalPlansRaw = extractField("Total Plans in Phase");
      const status = extractField("Status");
      const progressRaw = extractField("Progress");
      const lastActivity = extractField("Last Activity");
      const lastActivityDesc = extractField("Last Activity Description");
      const pausedAt = extractField("Paused At");
      const totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
      const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
      const progressPercent = progressRaw ? parseInt(progressRaw.replace("%", ""), 10) : null;
      const decisions = [];
      const decisionsMatch = content.match(/##\s*Decisions Made[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n([\s\S]*?)(?=\n##|\n$|$)/i);
      if (decisionsMatch) {
        const tableBody = decisionsMatch[1];
        const rows = tableBody.trim().split("\n").filter((r) => r.includes("|"));
        for (const row of rows) {
          const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
          if (cells.length >= 3) {
            decisions.push({
              phase: cells[0],
              summary: cells[1],
              rationale: cells[2]
            });
          }
        }
      }
      const blockers = [];
      const blockersMatch = content.match(/##\s*Blockers\s*\n([\s\S]*?)(?=\n##|$)/i);
      if (blockersMatch) {
        const blockersSection = blockersMatch[1];
        const items = blockersSection.match(/^-\s+(.+)$/gm) || [];
        for (const item of items) {
          blockers.push(item.replace(/^-\s+/, "").trim());
        }
      }
      const session = {
        last_date: null,
        stopped_at: null,
        resume_file: null
      };
      const sessionMatch = content.match(/##\s*Session\s*\n([\s\S]*?)(?=\n##|$)/i);
      if (sessionMatch) {
        const sessionSection = sessionMatch[1];
        const lastDateMatch = sessionSection.match(/\*\*Last Date:\*\*\s*(.+)/i);
        const stoppedAtMatch = sessionSection.match(/\*\*Stopped At:\*\*\s*(.+)/i);
        const resumeFileMatch = sessionSection.match(/\*\*Resume File:\*\*\s*(.+)/i);
        if (lastDateMatch) session.last_date = lastDateMatch[1].trim();
        if (stoppedAtMatch) session.stopped_at = stoppedAtMatch[1].trim();
        if (resumeFileMatch) session.resume_file = resumeFileMatch[1].trim();
      }
      const result = {
        current_phase: currentPhase,
        current_phase_name: currentPhaseName,
        total_phases: totalPhases,
        current_plan: currentPlan,
        total_plans_in_phase: totalPlansInPhase,
        status,
        progress_percent: progressPercent,
        last_activity: lastActivity,
        last_activity_desc: lastActivityDesc,
        decisions,
        blockers,
        paused_at: pausedAt,
        session
      };
      output(result, raw);
    }
    function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
      if (!summaryPath) {
        error("summary-path required for summary-extract");
      }
      const fullPath = path.join(cwd, summaryPath);
      if (!fs.existsSync(fullPath)) {
        output({ error: "File not found", path: summaryPath }, raw);
        return;
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      const fm = extractFrontmatter(content);
      const parseDecisions = (decisionsList) => {
        if (!decisionsList || !Array.isArray(decisionsList)) return [];
        return decisionsList.map((d) => {
          const colonIdx = d.indexOf(":");
          if (colonIdx > 0) {
            return {
              summary: d.substring(0, colonIdx).trim(),
              rationale: d.substring(colonIdx + 1).trim()
            };
          }
          return { summary: d, rationale: null };
        });
      };
      const fullResult = {
        path: summaryPath,
        one_liner: fm["one-liner"] || null,
        key_files: fm["key-files"] || [],
        tech_added: fm["tech-stack"] && fm["tech-stack"].added || [],
        patterns: fm["patterns-established"] || [],
        decisions: parseDecisions(fm["key-decisions"])
      };
      if (fields && fields.length > 0) {
        const filtered = { path: summaryPath };
        for (const field of fields) {
          if (fullResult[field] !== void 0) {
            filtered[field] = fullResult[field];
          }
        }
        output(filtered, raw);
        return;
      }
      output(fullResult, raw);
    }
    async function cmdWebsearch(query, options, raw) {
      const apiKey = process.env.BRAVE_API_KEY;
      if (!apiKey) {
        output({ available: false, reason: "BRAVE_API_KEY not set" }, raw, "");
        return;
      }
      if (!query) {
        output({ available: false, error: "Query required" }, raw, "");
        return;
      }
      const params = new URLSearchParams({
        q: query,
        count: String(options.limit || 10),
        country: "us",
        search_lang: "en",
        text_decorations: "false"
      });
      if (options.freshness) {
        params.set("freshness", options.freshness);
      }
      try {
        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?${params}`,
          {
            headers: {
              "Accept": "application/json",
              "X-Subscription-Token": apiKey
            }
          }
        );
        if (!response.ok) {
          output({ available: false, error: `API error: ${response.status}` }, raw, "");
          return;
        }
        const data = await response.json();
        const results = (data.web?.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          age: r.age || null
        }));
        output({
          available: true,
          query,
          count: results.length,
          results
        }, raw, results.map((r) => `${r.title}
${r.url}
${r.description}`).join("\n\n"));
      } catch (err) {
        debugLog("feature.webSearch", "search request failed", err);
        output({ available: false, error: err.message }, raw, "");
      }
    }
    function cmdFrontmatterGet(cwd, filePath, field, raw) {
      if (!filePath) {
        error("file path required");
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const fm = extractFrontmatter(content);
      if (field) {
        const value = fm[field];
        if (value === void 0) {
          output({ error: "Field not found", field }, raw);
          return;
        }
        output({ [field]: value }, raw, JSON.stringify(value));
      } else {
        output(fm, raw);
      }
    }
    function cmdFrontmatterSet(cwd, filePath, field, value, raw) {
      if (!filePath || !field || value === void 0) {
        error("file, field, and value required");
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      if (!fs.existsSync(fullPath)) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      const fm = extractFrontmatter(content);
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        debugLog("frontmatter.set", "JSON parse value failed, using string", e);
        parsedValue = value;
      }
      fm[field] = parsedValue;
      const newContent = spliceFrontmatter(content, fm);
      fs.writeFileSync(fullPath, newContent, "utf-8");
      output({ updated: true, field, value: parsedValue }, raw, "true");
    }
    function cmdFrontmatterMerge(cwd, filePath, data, raw) {
      if (!filePath || !data) {
        error("file and data required");
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      if (!fs.existsSync(fullPath)) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      const fm = extractFrontmatter(content);
      let mergeData;
      try {
        mergeData = JSON.parse(data);
      } catch (e) {
        debugLog("frontmatter.merge", "JSON parse --data failed", e);
        error("Invalid JSON for --data");
        return;
      }
      Object.assign(fm, mergeData);
      const newContent = spliceFrontmatter(content, fm);
      fs.writeFileSync(fullPath, newContent, "utf-8");
      output({ merged: true, fields: Object.keys(mergeData) }, raw, "true");
    }
    var FRONTMATTER_SCHEMAS = {
      plan: { required: ["phase", "plan", "type", "wave", "depends_on", "files_modified", "autonomous", "must_haves"] },
      summary: { required: ["phase", "plan", "subsystem", "tags", "duration", "completed"] },
      verification: { required: ["phase", "verified", "status", "score"] }
    };
    function cmdFrontmatterValidate(cwd, filePath, schemaName, raw) {
      if (!filePath || !schemaName) {
        error("file and schema required");
      }
      const schema = FRONTMATTER_SCHEMAS[schemaName];
      if (!schema) {
        error(`Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(", ")}`);
      }
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const content = safeReadFile(fullPath);
      if (!content) {
        output({ error: "File not found", path: filePath }, raw);
        return;
      }
      const fm = extractFrontmatter(content);
      const missing = schema.required.filter((f) => fm[f] === void 0);
      const present = schema.required.filter((f) => fm[f] !== void 0);
      output({ valid: missing.length === 0, missing, present, schema: schemaName }, raw, missing.length === 0 ? "valid" : "invalid");
    }
    function cmdProgressRender(cwd, format, raw) {
      const milestone = getMilestoneInfo(cwd);
      const phases = [];
      let totalPlans = 0;
      let totalSummaries = 0;
      const phaseTree = getPhaseTree(cwd);
      for (const [, entry] of phaseTree) {
        const plans = entry.plans.length;
        const summaries = entry.summaries.length;
        const phaseName = entry.phaseName ? entry.phaseName.replace(/-/g, " ") : "";
        totalPlans += plans;
        totalSummaries += summaries;
        let status;
        if (plans === 0) status = "Pending";
        else if (summaries >= plans) status = "Complete";
        else if (summaries > 0) status = "In Progress";
        else status = "Planned";
        phases.push({ number: entry.phaseNumber, name: phaseName, plans, summaries, status });
      }
      const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
      if (format === "table") {
        const barWidth = 10;
        const filled = Math.round(percent / 100 * barWidth);
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
        let out = `# ${milestone.version} ${milestone.name}

`;
        out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)

`;
        out += `| Phase | Name | Plans | Status |
`;
        out += `|-------|------|-------|--------|
`;
        for (const p of phases) {
          out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |
`;
        }
        output({ rendered: out }, raw, out);
      } else if (format === "bar") {
        const barWidth = 20;
        const filled = Math.round(percent / 100 * barWidth);
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
        const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
        output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
      } else {
        output({
          milestone_version: milestone.version,
          milestone_name: milestone.name,
          phases,
          total_plans: totalPlans,
          total_summaries: totalSummaries,
          percent
        }, raw);
      }
    }
    function cmdTodoComplete(cwd, filename, raw) {
      if (!filename) {
        error("filename required for todo complete");
      }
      const pendingDir = path.join(cwd, ".planning", "todos", "pending");
      const completedDir = path.join(cwd, ".planning", "todos", "completed");
      const sourcePath = path.join(pendingDir, filename);
      if (!fs.existsSync(sourcePath)) {
        error(`Todo not found: ${filename}`);
      }
      fs.mkdirSync(completedDir, { recursive: true });
      let content = fs.readFileSync(sourcePath, "utf-8");
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      content = `completed: ${today}
` + content;
      fs.writeFileSync(path.join(completedDir, filename), content, "utf-8");
      fs.unlinkSync(sourcePath);
      output({ completed: true, file: filename, date: today }, raw, "completed");
    }
    function cmdScaffold(cwd, type, options, raw) {
      const { phase, name } = options;
      const padded = phase ? normalizePhaseName(phase) : "00";
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
      const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;
      if (phase && !phaseDir && type !== "phase-dir") {
        error(`Phase ${phase} directory not found`);
      }
      let filePath, content;
      switch (type) {
        case "context": {
          filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
          content = `---
phase: "${padded}"
name: "${name || phaseInfo?.phase_name || "Unnamed"}"
created: ${today}
---

# Phase ${phase}: ${name || phaseInfo?.phase_name || "Unnamed"} \u2014 Context

## Decisions

_Decisions will be captured during /gsd:discuss-phase ${phase}_

## Discretion Areas

_Areas where the executor can use judgment_

## Deferred Ideas

_Ideas to consider later_
`;
          break;
        }
        case "uat": {
          filePath = path.join(phaseDir, `${padded}-UAT.md`);
          content = `---
phase: "${padded}"
name: "${name || phaseInfo?.phase_name || "Unnamed"}"
created: ${today}
status: pending
---

# Phase ${phase}: ${name || phaseInfo?.phase_name || "Unnamed"} \u2014 User Acceptance Testing

## Test Results

| # | Test | Status | Notes |
|---|------|--------|-------|

## Summary

_Pending UAT_
`;
          break;
        }
        case "verification": {
          filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
          content = `---
phase: "${padded}"
name: "${name || phaseInfo?.phase_name || "Unnamed"}"
created: ${today}
status: pending
---

# Phase ${phase}: ${name || phaseInfo?.phase_name || "Unnamed"} \u2014 Verification

## Goal-Backward Verification

**Phase Goal:** [From ROADMAP.md]

## Checks

| # | Requirement | Status | Evidence |
|---|------------|--------|----------|

## Result

_Pending verification_
`;
          break;
        }
        case "phase-dir": {
          if (!phase || !name) {
            error("phase and name required for phase-dir scaffold");
          }
          const slug = generateSlugInternal(name);
          const dirName = `${padded}-${slug}`;
          const phasesParent = path.join(cwd, ".planning", "phases");
          fs.mkdirSync(phasesParent, { recursive: true });
          const dirPath = path.join(phasesParent, dirName);
          fs.mkdirSync(dirPath, { recursive: true });
          output({ created: true, directory: `.planning/phases/${dirName}`, path: dirPath }, raw, dirPath);
          return;
        }
        default:
          error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
      }
      if (fs.existsSync(filePath)) {
        output({ created: false, reason: "already_exists", path: filePath }, raw, "exists");
        return;
      }
      fs.writeFileSync(filePath, content, "utf-8");
      const relPath = path.relative(cwd, filePath);
      output({ created: true, path: relPath }, raw, relPath);
    }
    module2.exports = {
      cmdGenerateSlug,
      cmdCurrentTimestamp,
      cmdListTodos,
      cmdVerifyPathExists,
      cmdConfigEnsureSection,
      cmdConfigSet,
      cmdConfigGet,
      cmdConfigMigrate,
      cmdHistoryDigest,
      cmdResolveModel,
      cmdFindPhase,
      cmdCommit,
      cmdVerifySummary,
      cmdTemplateSelect,
      cmdTemplateFill,
      cmdPhasePlanIndex,
      cmdStateSnapshot,
      cmdSummaryExtract,
      cmdWebsearch,
      cmdFrontmatterGet,
      cmdFrontmatterSet,
      cmdFrontmatterMerge,
      FRONTMATTER_SCHEMAS,
      cmdFrontmatterValidate,
      cmdProgressRender,
      cmdTodoComplete,
      cmdScaffold
    };
  }
});

// src/commands/features.js
var require_features = __commonJS({
  "src/commands/features.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { execSync, execFileSync } = require("child_process");
    var { output, error, debugLog } = require_output();
    var { loadConfig } = require_config();
    var { CONFIG_SCHEMA } = require_constants();
    var { parseAssertionsMd } = require_verify();
    var { safeReadFile, cachedReadFile, findPhaseInternal, getArchivedPhaseDirs, normalizePhaseName, isValidDateString, sanitizeShellArg, getMilestoneInfo, getPhaseTree } = require_helpers();
    var { cachedRegex } = require_regex_cache();
    var { extractFrontmatter } = require_frontmatter();
    var { execGit } = require_git();
    var { estimateTokens, estimateJsonTokens, checkBudget } = require_context();
    function cmdSessionDiff(cwd, raw) {
      let since = null;
      try {
        const state2 = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        const lastMatch = state2.match(/\*\*Last Activity:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        if (lastMatch) since = lastMatch[1];
        const sessionMatch = state2.match(/\*\*Last session:\*\*\s*(\S+)/);
        if (sessionMatch && sessionMatch[1] > (since || "")) since = sessionMatch[1].split("T")[0];
      } catch (e) {
        debugLog("feature.sessionDiff", "read failed", e);
      }
      if (!since) {
        output({ error: "No last activity found in STATE.md", changes: [] }, raw);
        return;
      }
      if (!isValidDateString(since)) {
        output({ error: "Invalid date format in STATE.md", changes: [] }, raw);
        return;
      }
      const sanitizedSince = sanitizeShellArg(since);
      const changes = [];
      const gitLogResult = execGit(cwd, ["log", `--since=${since}`, "--oneline", "--no-merges", "--", ".planning/"]);
      if (gitLogResult.exitCode === 0 && gitLogResult.stdout) {
        for (const line of gitLogResult.stdout.split("\n")) {
          const match = line.match(/^([a-f0-9]+)\s+(.*)/);
          if (match) changes.push({ sha: match[1], message: match[2] });
        }
      }
      const filesChanged = [];
      const gitDiffResult = execGit(cwd, ["log", `--since=${since}`, "--name-only", "--pretty=format:", "--", ".planning/"]);
      if (gitDiffResult.exitCode === 0 && gitDiffResult.stdout) {
        const unique = [...new Set(gitDiffResult.stdout.split("\n").filter(Boolean))];
        filesChanged.push(...unique);
      }
      const summaries = filesChanged.filter((f) => f.includes("SUMMARY"));
      const plans = filesChanged.filter((f) => f.includes("PLAN"));
      const state = filesChanged.filter((f) => f.includes("STATE"));
      const roadmap = filesChanged.filter((f) => f.includes("ROADMAP"));
      output({
        since,
        commit_count: changes.length,
        commits: changes.slice(0, 20),
        files_changed: filesChanged.length,
        categories: {
          summaries: summaries.length,
          plans: plans.length,
          state_updates: state.length,
          roadmap_updates: roadmap.length
        }
      }, raw);
    }
    function cmdContextBudget(cwd, planPath, raw) {
      if (!planPath || !fs.existsSync(path.join(cwd, planPath))) {
        error("Plan path required and must exist");
      }
      const content = fs.readFileSync(path.join(cwd, planPath), "utf-8");
      const fm = extractFrontmatter(content);
      const filesModified = fm.files_modified || [];
      let totalLines = 0;
      let fileReadTokens = 0;
      let heuristicFileReadTokens = 0;
      let existingFiles = 0;
      let newFiles = 0;
      const fileDetails = [];
      for (const file of filesModified) {
        const fullPath = path.join(cwd, file);
        if (fs.existsSync(fullPath)) {
          existingFiles++;
          try {
            const fileContent = fs.readFileSync(fullPath, "utf-8");
            const lines = fileContent.split("\n").length;
            const tokens = estimateTokens(fileContent);
            totalLines += lines;
            fileReadTokens += tokens;
            heuristicFileReadTokens += lines * 4;
            fileDetails.push({ path: file, lines, tokens, exists: true });
          } catch (e) {
            debugLog("feature.contextBudget", "read failed", e);
            fileDetails.push({ path: file, lines: 0, tokens: 0, exists: true, error: "unreadable" });
          }
        } else {
          newFiles++;
          fileDetails.push({ path: file, lines: 0, tokens: 0, exists: false });
        }
      }
      const taskMatches = content.match(/<task\s/gi) || [];
      const taskCount = taskMatches.length;
      const planTokens = estimateTokens(content);
      const heuristicPlanTokens = content.split("\n").length * 4;
      const executionTokens = taskCount * 3500;
      const testTokens = taskCount * 750;
      const totalEstimate = planTokens + fileReadTokens + executionTokens + testTokens;
      const heuristicTotal = heuristicPlanTokens + heuristicFileReadTokens + executionTokens + testTokens;
      const config = loadConfig(cwd);
      const contextWindow = config.context_window || 2e5;
      const targetPercent = config.context_target_percent || 50;
      const estimatedPercent = Math.round(totalEstimate / contextWindow * 100);
      let risk = "low";
      if (estimatedPercent > 60) risk = "high";
      else if (estimatedPercent > 40) risk = "medium";
      const recommendations = [];
      if (estimatedPercent > 50) {
        recommendations.push("Consider splitting this plan \u2014 estimated to exceed 50% context budget");
      }
      if (filesModified.length > 5) {
        recommendations.push(`${filesModified.length} files modified \u2014 high file count increases context pressure`);
      }
      if (taskCount > 3) {
        recommendations.push(`${taskCount} tasks \u2014 plans should have 2-3 tasks max`);
      }
      if (totalLines > 1e3) {
        recommendations.push(`${totalLines} existing lines to read \u2014 large codebase context`);
      }
      output({
        plan: planPath,
        files: {
          total: filesModified.length,
          existing: existingFiles,
          new: newFiles,
          total_lines: totalLines,
          details: fileDetails
        },
        tasks: taskCount,
        estimates: {
          plan_tokens: planTokens,
          file_read_tokens: fileReadTokens,
          execution_tokens: executionTokens,
          test_tokens: testTokens,
          total_tokens: totalEstimate,
          heuristic_tokens: heuristicTotal,
          context_window: contextWindow,
          context_percent: estimatedPercent,
          target_percent: targetPercent
        },
        risk,
        recommendations
      }, raw);
    }
    function cmdTestRun(cwd, raw) {
      const config = loadConfig(cwd);
      const testCommands = config.test_commands || {};
      const testGate = config.test_gate !== false;
      if (Object.keys(testCommands).length === 0) {
        output({
          configured: false,
          message: "No test_commands configured in .planning/config.json",
          example: {
            test_commands: {
              elixir: "cd services/console && mix test",
              go: "cd services/ingestion && go test ./...",
              python: "cd services/ai && pytest"
            },
            test_gate: true
          }
        }, raw);
        return;
      }
      const results = {};
      let allPassed = true;
      for (const [name, command] of Object.entries(testCommands)) {
        const start = Date.now();
        try {
          const testOutput = execSync(command, {
            cwd,
            encoding: "utf-8",
            timeout: 3e5,
            // 5 min timeout
            stdio: ["pipe", "pipe", "pipe"]
          });
          const duration = Date.now() - start;
          const parsed = parseTestOutput(name, testOutput);
          results[name] = {
            status: "passed",
            duration_ms: duration,
            command,
            ...parsed
          };
        } catch (err) {
          debugLog("feature.testRun", "exec failed", err);
          const duration = Date.now() - start;
          allPassed = false;
          const stderr = err.stderr || "";
          const stdout = err.stdout || "";
          const parsed = parseTestOutput(name, stdout + "\n" + stderr);
          results[name] = {
            status: "failed",
            duration_ms: duration,
            command,
            exit_code: err.status,
            ...parsed,
            error_tail: (stderr || stdout).split("\n").slice(-20).join("\n")
          };
        }
      }
      output({
        configured: true,
        test_gate: testGate,
        all_passed: allPassed,
        gate_blocked: testGate && !allPassed,
        results
      }, raw);
    }
    function parseTestOutput(framework, text) {
      const exunit = text.match(/(\d+)\s+tests?,\s+(\d+)\s+failures?(?:,\s+(\d+)\s+excluded)?/);
      if (exunit) {
        return { passed: parseInt(exunit[1]) - parseInt(exunit[2]), failed: parseInt(exunit[2]), skipped: parseInt(exunit[3] || "0") };
      }
      const goPass = (text.match(/^ok\s+/gm) || []).length;
      const goFail = (text.match(/^FAIL\s+/gm) || []).length;
      if (goPass + goFail > 0) {
        return { passed: goPass, failed: goFail, skipped: 0 };
      }
      const pytest = text.match(/(\d+)\s+passed(?:.*?(\d+)\s+failed)?(?:.*?(\d+)\s+skipped)?/);
      if (pytest) {
        return { passed: parseInt(pytest[1]), failed: parseInt(pytest[2] || "0"), skipped: parseInt(pytest[3] || "0") };
      }
      return { passed: null, failed: null, skipped: null };
    }
    function cmdSearchDecisions(cwd, query, raw) {
      if (!query) {
        error("Query string required for decision search");
      }
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      const results = [];
      try {
        const state = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        const decisions = extractDecisions(state, "current");
        for (const d of decisions) {
          const score = scoreDecision(d.text, queryWords);
          if (score > 0) results.push({ ...d, score, source: "STATE.md" });
        }
      } catch (e) {
        debugLog("feature.searchDecisions", "read failed", e);
      }
      try {
        const archiveDir = path.join(cwd, ".planning", "milestones");
        let archiveFiles;
        try {
          archiveFiles = fs.readdirSync(archiveDir).filter((f) => f.endsWith("-ROADMAP.md"));
        } catch {
          archiveFiles = [];
        }
        for (const file of archiveFiles) {
          const content = cachedReadFile(path.join(archiveDir, file));
          if (!content) continue;
          const version = file.replace("-ROADMAP.md", "");
          const decisions = extractDecisions(content, version);
          for (const d of decisions) {
            const score = scoreDecision(d.text, queryWords);
            if (score > 0) results.push({ ...d, score, source: file });
          }
        }
      } catch (e) {
        debugLog("feature.searchDecisions", "read failed", e);
      }
      results.sort((a, b) => b.score - a.score);
      output({
        query,
        match_count: results.length,
        decisions: results.slice(0, 20)
      }, raw);
    }
    function extractDecisions(content, milestone) {
      const decisions = [];
      const pattern = /(\d+)\.\s+\*\*([^*]+)\*\*\s*(?:\(([^)]+)\))?\s*:?\s*([^\n]+)/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        decisions.push({
          number: parseInt(match[1]),
          title: match[2].trim(),
          phase: match[3] ? match[3].trim() : null,
          text: match[4].trim(),
          full: match[0].trim(),
          milestone
        });
      }
      return decisions;
    }
    function scoreDecision(text, queryWords) {
      const textLower = text.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (textLower.includes(word)) score += 1;
      }
      return score;
    }
    function cmdValidateDependencies(cwd, phase, raw) {
      if (!phase) {
        error("Phase number required for dependency validation");
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      const issues = [];
      const checked = [];
      const phaseInfo = findPhaseInternal(cwd, phase);
      let planFiles = [];
      let fullPhaseDir = null;
      if (phaseInfo && phaseInfo.found) {
        fullPhaseDir = path.join(cwd, phaseInfo.directory);
        try {
          planFiles = fs.readdirSync(fullPhaseDir).filter((f) => f.endsWith("-PLAN.md") || f === "PLAN.md");
        } catch (e) {
          debugLog("validate.dependencies", "readdir failed", e);
        }
      }
      if (planFiles.length === 0) {
        try {
          const roadmap = cachedReadFile(path.join(cwd, ".planning", "ROADMAP.md"));
          const phaseSection = roadmap ? roadmap.match(cachedRegex(`###?\\s*Phase\\s+${phase}[\\s\\S]*?(?=###?\\s*Phase\\s+\\d|$)`, "i")) : null;
          if (phaseSection) {
            const depMatch = phaseSection[0].match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
            if (depMatch && !depMatch[1].toLowerCase().includes("nothing")) {
              const depPhases = depMatch[1].match(/Phase\s+(\d+)/gi) || [];
              for (const dp of depPhases) {
                const num = dp.match(/\d+/)[0];
                const depCheck = { plan: "ROADMAP", dependency: dp, status: "unknown" };
                const phaseTree = getPhaseTree(cwd);
                const depNorm = normalizePhaseName(num);
                const depEntry = phaseTree.get(depNorm);
                if (!depEntry) {
                  depCheck.status = "missing";
                  depCheck.message = `Dependency phase ${num} has no directory`;
                  issues.push(depCheck);
                } else {
                  if (depEntry.plans.length === 0) {
                    depCheck.status = "not_planned";
                    depCheck.message = `Phase ${num} has no plans`;
                    issues.push(depCheck);
                  } else if (depEntry.summaries.length < depEntry.plans.length) {
                    depCheck.status = "incomplete";
                    depCheck.message = `Phase ${num}: ${depEntry.summaries.length}/${depEntry.plans.length} complete`;
                    issues.push(depCheck);
                  } else {
                    depCheck.status = "satisfied";
                  }
                }
                checked.push(depCheck);
              }
            }
          }
        } catch (e) {
          debugLog("validate.dependencies", "read roadmap deps failed", e);
        }
        output({ phase, valid: issues.length === 0, issue_count: issues.length, issues, checked, note: "Phase has no plans yet \u2014 checked ROADMAP-level dependencies only" }, raw);
        return;
      }
      for (const planFile of planFiles) {
        const planPath = path.join(fullPhaseDir, planFile);
        const content = cachedReadFile(planPath) || "";
        const fm = extractFrontmatter(content);
        const dependsOn = fm.depends_on || [];
        for (const dep of dependsOn) {
          const depCheck = { plan: planFile, dependency: dep, status: "unknown" };
          const depPhaseMatch = dep.toString().match(/^(\d+)/);
          if (!depPhaseMatch) {
            depCheck.status = "unparseable";
            depCheck.message = `Cannot parse dependency: ${dep}`;
            issues.push(depCheck);
            checked.push(depCheck);
            continue;
          }
          const depPhaseNum = depPhaseMatch[1];
          const depPhaseTree = getPhaseTree(cwd);
          const depNorm = normalizePhaseName(depPhaseNum);
          const depEntry = depPhaseTree.get(depNorm);
          if (!depEntry) {
            depCheck.status = "missing";
            depCheck.message = `Dependency phase ${depPhaseNum} has no directory`;
            issues.push(depCheck);
          } else {
            if (depEntry.plans.length === 0) {
              depCheck.status = "not_planned";
              depCheck.message = `Dependency phase ${depPhaseNum} has no plans`;
              issues.push(depCheck);
            } else if (depEntry.summaries.length < depEntry.plans.length) {
              depCheck.status = "incomplete";
              depCheck.message = `Dependency phase ${depPhaseNum}: ${depEntry.summaries.length}/${depEntry.plans.length} plans complete`;
              issues.push(depCheck);
            } else {
              depCheck.status = "satisfied";
            }
          }
          checked.push(depCheck);
        }
      }
      try {
        const roadmap = cachedReadFile(path.join(cwd, ".planning", "ROADMAP.md"));
        const phaseSection = roadmap ? roadmap.match(cachedRegex(`###?\\s*Phase\\s+${phase}[\\s\\S]*?(?=###?\\s*Phase\\s+\\d|$)`, "i")) : null;
        if (phaseSection) {
          const depMatch = phaseSection[0].match(/\*\*Depends on:?\*\*:?\s*([^\n]+)/i);
          if (depMatch && !depMatch[1].toLowerCase().includes("nothing")) {
            const depPhases = depMatch[1].match(/Phase\s+(\d+)/gi) || [];
            for (const dp of depPhases) {
              const num = dp.match(/\d+/)[0];
              const existing = checked.find((c) => c.dependency.toString().startsWith(num));
              if (!existing) {
                checked.push({ plan: "ROADMAP", dependency: dp, status: "info", message: "Roadmap-level dependency (not in plan frontmatter)" });
              }
            }
          }
        }
      } catch (e) {
        debugLog("validate.dependencies", "read failed", e);
      }
      output({
        phase,
        valid: issues.length === 0,
        issue_count: issues.length,
        issues,
        checked
      }, raw);
    }
    function cmdSearchLessons(cwd, query, raw) {
      if (!query) {
        error("Query string required for lessons search");
      }
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      const results = [];
      const candidatePaths = [
        path.join(cwd, "tasks", "lessons.md"),
        path.join(cwd, ".planning", "lessons.md")
      ];
      const searchPaths = candidatePaths.filter((p) => {
        try {
          fs.statSync(p);
          return true;
        } catch {
          return false;
        }
      });
      if (searchPaths.length === 0) {
        output({ query, match_count: 0, lessons: [], message: "No lessons file found (checked tasks/lessons.md and .planning/lessons.md)" }, raw);
        return;
      }
      for (const searchPath of searchPaths) {
        const content = cachedReadFile(searchPath);
        if (!content) continue;
        const sections = content.split(/(?=^#{1,3}\s)/m).filter(Boolean);
        for (const section of sections) {
          const titleMatch = section.match(/^#{1,3}\s+(.+)/);
          const title = titleMatch ? titleMatch[1].trim() : "Untitled";
          const body = section.replace(/^#{1,3}\s+.+\n?/, "").trim();
          let score = 0;
          const sectionLower = section.toLowerCase();
          for (const word of queryWords) {
            if (sectionLower.includes(word)) score += 1;
            if (title.toLowerCase().includes(word)) score += 2;
          }
          if (score > 0) {
            results.push({
              title,
              body: body.slice(0, 300) + (body.length > 300 ? "..." : ""),
              score,
              source: path.relative(cwd, searchPath)
            });
          }
        }
      }
      results.sort((a, b) => b.score - a.score);
      output({
        query,
        match_count: results.length,
        lessons: results.slice(0, 15)
      }, raw);
    }
    function cmdCodebaseImpact(cwd, filePaths, raw) {
      if (!filePaths || filePaths.length === 0) {
        error("File paths required for impact estimation");
      }
      const results = [];
      for (const filePath of filePaths) {
        const fullPath = path.join(cwd, filePath);
        if (!fs.existsSync(fullPath)) {
          results.push({ path: filePath, exists: false, dependents: [] });
          continue;
        }
        const dependents = [];
        const basename = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        const searchPatterns = [];
        if ([".ex", ".exs"].includes(ext)) {
          const moduleName = basename.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
          searchPatterns.push(moduleName);
          searchPatterns.push(basename);
          try {
            const fileContent = fs.readFileSync(fullPath, "utf-8");
            const defmodMatch = fileContent.match(/defmodule\s+([\w.]+)/);
            if (defmodMatch) {
              const parts = defmodMatch[1].split(".");
              const lastPart = parts[parts.length - 1];
              if (!searchPatterns.includes(lastPart)) searchPatterns.push(lastPart);
              if (!searchPatterns.includes(defmodMatch[1])) searchPatterns.push(defmodMatch[1]);
            }
          } catch (e) {
            debugLog("feature.codebaseImpact", "read failed", e);
          }
        } else if (ext === ".go") {
          const dirName = path.dirname(filePath).split("/").pop();
          searchPatterns.push(`"${dirName}"`);
        } else if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          searchPatterns.push(basename);
        } else if (ext === ".py") {
          searchPatterns.push(`from.*${basename}`);
          searchPatterns.push(`import.*${basename}`);
        }
        if (searchPatterns.length > 0) {
          const regexMeta = /[.*+?[\]{}()|^$\\]/;
          const fixedPatterns = searchPatterns.filter((p) => !regexMeta.test(p));
          const regexPatterns = searchPatterns.filter((p) => regexMeta.test(p));
          const includeArgs = ["--include=*.ex", "--include=*.exs", "--include=*.go", "--include=*.py", "--include=*.ts", "--include=*.tsx", "--include=*.js"];
          const excludeArgs = ["--exclude-dir=node_modules", "--exclude-dir=_build", "--exclude-dir=deps"];
          const runGrep = (grepArgs) => {
            try {
              const result = execFileSync("grep", grepArgs, {
                cwd,
                encoding: "utf-8",
                timeout: 15e3,
                stdio: ["pipe", "pipe", "pipe"]
              }).trim();
              if (result) {
                for (const dep of result.split("\n").slice(0, 30)) {
                  const relative = dep.replace(/^\.\//, "");
                  if (relative !== filePath && !dependents.includes(relative)) {
                    dependents.push(relative);
                  }
                }
              }
            } catch (e) {
              debugLog("feature.codebaseImpact", "grep failed", e);
            }
          };
          if (fixedPatterns.length > 0) {
            const eArgs = fixedPatterns.flatMap((p) => ["-e", p]);
            runGrep(["-rl", "--fixed-strings", ...eArgs, ...includeArgs, ...excludeArgs, "."]);
          }
          if (regexPatterns.length > 0) {
            const eArgs = regexPatterns.flatMap((p) => ["-e", p]);
            runGrep(["-rl", ...eArgs, ...includeArgs, ...excludeArgs, "."]);
          }
        }
        results.push({
          path: filePath,
          exists: true,
          dependent_count: dependents.length,
          dependents: dependents.slice(0, 20),
          risk: dependents.length > 10 ? "high" : dependents.length > 5 ? "medium" : "low"
        });
      }
      const totalDependents = results.reduce((sum, r) => sum + r.dependent_count, 0);
      output({
        files_analyzed: results.length,
        total_dependents: totalDependents,
        overall_risk: totalDependents > 20 ? "high" : totalDependents > 10 ? "medium" : "low",
        files: results
      }, raw);
    }
    function cmdRollbackInfo(cwd, planId, raw) {
      if (!planId) {
        error("Plan ID required (e.g., 68-01)");
      }
      const phasesDir = path.join(cwd, ".planning", "phases");
      let summaryPath = null;
      let summaryContent = null;
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
        const phaseMatch = planId.match(/^(\d+)/);
        if (phaseMatch) {
          const phaseNum = phaseMatch[1];
          const dir = dirs.find((d) => d.startsWith(phaseNum + "-") || d === phaseNum);
          if (dir) {
            const files = fs.readdirSync(path.join(phasesDir, dir));
            const summary = files.find((f) => f.includes(planId) && f.endsWith("-SUMMARY.md"));
            if (summary) {
              summaryPath = path.join(".planning", "phases", dir, summary);
              summaryContent = fs.readFileSync(path.join(cwd, summaryPath), "utf-8");
            }
          }
        }
      } catch (e) {
        debugLog("feature.rollbackInfo", "read failed", e);
      }
      if (!summaryContent) {
        output({ found: false, plan_id: planId, message: "No SUMMARY found for this plan" }, raw);
        return;
      }
      const commitPattern = /\b([a-f0-9]{7,40})\b/g;
      const fm = extractFrontmatter(summaryContent);
      const commits = fm.commits || [];
      const candidateShas = [];
      let cm;
      while ((cm = commitPattern.exec(summaryContent)) !== null) {
        const sha = cm[1];
        if (!commits.includes(sha)) {
          candidateShas.push(sha);
        }
      }
      if (candidateShas.length > 0) {
        const verifyResult = execGit(cwd, ["rev-parse", "--verify", ...candidateShas.map((s) => s + "^{commit}")]);
        if (verifyResult.exitCode === 0) {
          for (const sha of candidateShas) {
            if (!commits.includes(sha)) commits.push(sha);
          }
        } else {
          for (const sha of candidateShas) {
            const result = execGit(cwd, ["rev-parse", "--verify", sha + "^{commit}"]);
            if (result.exitCode === 0 && !commits.includes(sha)) {
              commits.push(sha);
            }
          }
        }
      }
      const allCommits = commits;
      const commitDetails = [];
      if (allCommits.length > 0) {
        const logResult = execGit(cwd, ["log", "--no-walk", "--format=%H|%s|%an|%ai", ...allCommits]);
        if (logResult.exitCode === 0 && logResult.stdout) {
          const logLines = logResult.stdout.split("\n").filter(Boolean);
          for (const line of logLines) {
            const [hash, subject, author, date] = line.split("|");
            if (!hash) continue;
            const filesResult = execGit(cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", hash]);
            const files = filesResult.exitCode === 0 ? filesResult.stdout.split("\n").filter(Boolean) : [];
            commitDetails.push({ sha: hash.slice(0, 7), subject, author, date, files });
          }
        }
      }
      output({
        found: true,
        plan_id: planId,
        summary_path: summaryPath,
        commit_count: commitDetails.length,
        commits: commitDetails,
        rollback_command: allCommits.length > 0 ? `git revert --no-commit ${allCommits.map((c) => c.slice(0, 7)).join(" ")} && git commit -m "rollback: revert plan ${planId}"` : null,
        warning: "Review the commits above before running rollback. This creates a revert commit (non-destructive)."
      }, raw);
    }
    function cmdVelocity(cwd, raw) {
      const milestone = getMilestoneInfo(cwd);
      const metrics = [];
      try {
        const state = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        const metricsSection = state.match(/### Performance Metrics[\s\S]*?\|[\s\S]*?(?=\n###|\n---|\n$)/);
        if (metricsSection) {
          const rows = metricsSection[0].match(/\|\s*[\d.]+-[\d.]+\s*\|[^\n]+/g) || [];
          for (const row of rows) {
            const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
            if (cols.length >= 2) {
              metrics.push({
                plan: cols[0],
                duration: cols[1],
                tasks: cols[2] ? parseInt(cols[2]) : null,
                files: cols[3] ? parseInt(cols[3]) : null
              });
            }
          }
        }
      } catch (e) {
        debugLog("feature.velocity", "read STATE.md metrics failed", e);
      }
      let plansPerDay = {};
      const velocityLog = execGit(cwd, ["log", "--oneline", "--format=%ai|%s", "--", ".planning/"]);
      if (velocityLog.exitCode === 0 && velocityLog.stdout) {
        for (const line of velocityLog.stdout.split("\n")) {
          const [dateTime, ...msgParts] = line.split("|");
          const date = dateTime.split(" ")[0];
          const msg = msgParts.join("|");
          if (msg.toLowerCase().includes("summary") || msg.toLowerCase().includes("complete")) {
            plansPerDay[date] = (plansPerDay[date] || 0) + 1;
          }
        }
      }
      const daysList = Object.entries(plansPerDay).sort((a, b) => a[0].localeCompare(b[0]));
      const totalDays = daysList.length || 1;
      const totalCompletedPlans = daysList.reduce((sum, [, count]) => sum + count, 0);
      const avgPerDay = (totalCompletedPlans / totalDays).toFixed(1);
      let remainingPhases = 0;
      try {
        const roadmap = cachedReadFile(path.join(cwd, ".planning", "ROADMAP.md"));
        const unchecked = (roadmap.match(/- \[ \] \*\*Phase/g) || []).length;
        remainingPhases = unchecked;
      } catch (e) {
        debugLog("feature.velocity", "read failed", e);
      }
      const avgPlansPerPhase = metrics.length > 0 ? Math.ceil(metrics.length / Math.max(1, metrics.length / 4)) : 4;
      const estimatedRemainingPlans = remainingPhases * avgPlansPerPhase;
      const estimatedDaysRemaining = totalCompletedPlans > 0 ? Math.ceil(estimatedRemainingPlans / (totalCompletedPlans / totalDays)) : null;
      output({
        milestone: milestone.version,
        metrics: {
          plans_completed: totalCompletedPlans,
          active_days: totalDays,
          avg_plans_per_day: parseFloat(avgPerDay),
          daily_breakdown: daysList.slice(-7)
          // Last 7 days
        },
        plan_metrics: metrics,
        forecast: {
          remaining_phases: remainingPhases,
          estimated_remaining_plans: estimatedRemainingPlans,
          estimated_days_remaining: estimatedDaysRemaining
        }
      }, raw);
    }
    function cmdTraceRequirement(cwd, reqId, raw) {
      if (!reqId) {
        error("Requirement ID required (e.g., ANOM-01)");
      }
      const reqUpper = reqId.toUpperCase();
      const trace = { requirement: reqUpper, phase: null, plans: [], files: [], status: "unknown" };
      try {
        const roadmap = cachedReadFile(path.join(cwd, ".planning", "ROADMAP.md"));
        const coverageMatch = roadmap.match(cachedRegex(`${reqUpper}\\s*\\|\\s*(\\d+)`, "i"));
        if (coverageMatch) {
          trace.phase = coverageMatch[1];
        }
        if (!trace.phase) {
          const reqLine = roadmap.match(cachedRegex(`Phase\\s+(\\d+)[\\s\\S]*?Requirements:?\\*\\*:?\\s*[^\\n]*${reqUpper}`, "i"));
          if (reqLine) trace.phase = reqLine[1];
        }
      } catch (e) {
        debugLog("feature.traceRequirement", "read failed", e);
      }
      if (!trace.phase) {
        output({ ...trace, status: "unmapped", message: `${reqUpper} not found in ROADMAP.md coverage map` }, raw);
        return;
      }
      const phaseTree = getPhaseTree(cwd);
      const phaseNorm = normalizePhaseName(trace.phase);
      const phaseEntry = phaseTree.get(phaseNorm);
      if (phaseEntry) {
        for (const plan of phaseEntry.plans) {
          const content = cachedReadFile(path.join(phaseEntry.fullPath, plan));
          if (!content) continue;
          const fm = extractFrontmatter(content);
          const reqs = fm.requirements || [];
          if (reqs.some((r) => r.toUpperCase().includes(reqUpper))) {
            trace.plans.push({
              file: plan,
              has_summary: phaseEntry.summaries.includes(plan.replace("-PLAN.md", "-SUMMARY.md"))
            });
            const planFiles = fm.files_modified || [];
            trace.files.push(...planFiles);
          }
        }
        const allSummariesExist = trace.plans.every((p) => p.has_summary);
        if (trace.plans.length === 0) {
          trace.status = "planned_no_plans";
        } else if (allSummariesExist) {
          trace.status = "implemented";
        } else {
          trace.status = "in_progress";
        }
      } else {
        trace.status = "not_started";
      }
      trace.files = [...new Set(trace.files)];
      trace.files = trace.files.map((f) => ({
        path: f,
        exists: fs.existsSync(path.join(cwd, f))
      }));
      const assertionsContent = cachedReadFile(path.join(cwd, ".planning", "ASSERTIONS.md"));
      if (assertionsContent) {
        const allAssertions = parseAssertionsMd(assertionsContent);
        const reqAssertions = allAssertions[reqUpper];
        if (reqAssertions) {
          const planTruths = /* @__PURE__ */ new Set();
          if (phaseEntry) {
            for (const plan of phaseEntry.plans) {
              const planContent = cachedReadFile(path.join(phaseEntry.fullPath, plan));
              if (!planContent) continue;
              const fm = extractFrontmatter(planContent);
              if (fm.must_haves && fm.must_haves.truths) {
                const truths = Array.isArray(fm.must_haves.truths) ? fm.must_haves.truths : [fm.must_haves.truths];
                for (const t of truths) {
                  if (typeof t === "string") planTruths.add(t.toLowerCase());
                }
              }
            }
          }
          const hasSummaries = trace.plans.length > 0 && trace.plans.every((p) => p.has_summary);
          const assertionEntries = reqAssertions.assertions.map((a) => {
            const assertLower = a.assert.toLowerCase();
            const planned = planTruths.size > 0 && [...planTruths].some(
              (t) => t.includes(assertLower.slice(0, 30)) || assertLower.includes(t.slice(0, 30))
            );
            const implemented = planned && hasSummaries;
            return {
              assert: a.assert,
              priority: a.priority,
              type: a.type || null,
              planned,
              implemented,
              gap: !planned
            };
          });
          trace.assertions = assertionEntries;
          trace.assertion_count = assertionEntries.length;
          trace.must_have_count = assertionEntries.filter((a) => a.priority === "must-have").length;
          const passCount = assertionEntries.filter((a) => a.implemented).length;
          const failCount = assertionEntries.filter((a) => !a.implemented && a.priority === "must-have").length;
          const planRef = trace.plans.length > 0 ? trace.plans.map((p) => p.file.replace(/-PLAN\.md$/, "")).join(", ") : "no plan";
          const verificationStatus = passCount === assertionEntries.length ? "PASSED" : failCount > 0 ? "partial" : "pending";
          trace.chain = `${reqUpper} \u2192 ${assertionEntries.length} assertions (${trace.must_have_count} must-have) \u2192 ${planRef} \u2192 VERIFICATION: ${verificationStatus}`;
        }
      }
      output(trace, raw);
    }
    function cmdValidateConfig(cwd, raw) {
      const configPath = path.join(cwd, ".planning", "config.json");
      if (!fs.existsSync(configPath)) {
        output({ exists: false, message: "No config.json found" }, raw);
        return;
      }
      let config;
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        debugLog("feature.validateConfig", "read failed", e);
        output({ exists: true, valid_json: false, error: e.message }, raw);
        return;
      }
      const knownKeys = {};
      for (const [key, def] of Object.entries(CONFIG_SCHEMA)) {
        knownKeys[key] = { type: def.type, default: def.default, description: def.description };
        for (const alias of def.aliases) {
          knownKeys[alias] = { type: def.type, default: def.default, description: `Alias for ${key}: ${def.description}` };
        }
      }
      const sectionNames = /* @__PURE__ */ new Set();
      for (const [, def] of Object.entries(CONFIG_SCHEMA)) {
        if (def.nested) sectionNames.add(def.nested.section);
      }
      for (const section of sectionNames) {
        knownKeys[section] = { type: "object", default: {}, description: `${section} configuration section` };
      }
      const warnings = [];
      const effective = {};
      for (const key of Object.keys(config)) {
        if (!knownKeys[key]) {
          warnings.push({ type: "unknown_key", key, value: config[key], message: `Unknown config key: "${key}" \u2014 possible typo?` });
        }
      }
      for (const [key, schema] of Object.entries(knownKeys)) {
        const hasExplicit = key in config;
        const value = hasExplicit ? config[key] : schema.default;
        if (hasExplicit) {
          const actualType = typeof config[key];
          if (actualType !== schema.type && !(schema.type === "object" && actualType === "object")) {
            warnings.push({
              type: "type_mismatch",
              key,
              expected: schema.type,
              actual: actualType,
              message: `"${key}" should be ${schema.type}, got ${actualType}`
            });
          }
        }
        effective[key] = { value, source: hasExplicit ? "explicit" : "default", description: schema.description };
      }
      output({
        exists: true,
        valid_json: true,
        warning_count: warnings.length,
        warnings,
        effective_config: effective
      }, raw);
    }
    function cmdQuickTaskSummary(cwd, raw) {
      const milestone = getMilestoneInfo(cwd);
      const quickTasks = [];
      try {
        const state = cachedReadFile(path.join(cwd, ".planning", "STATE.md"));
        const quickSection = state.match(/### Quick Tasks Completed[\s\S]*?\|[\s\S]*?(?=\n###|\n---|\n$)/);
        if (quickSection) {
          const rows = quickSection[0].match(/\|\s*\d+\s*\|[^\n]+/g) || [];
          for (const row of rows) {
            const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
            if (cols.length >= 4) {
              quickTasks.push({
                number: cols[0],
                description: cols[1],
                date: cols[2],
                commit: cols[3],
                status: cols[4] || "unknown"
              });
            }
          }
        }
      } catch (e) {
        debugLog("feature.quickSummary", "parse STATE.md quick tasks failed", e);
      }
      output({
        milestone: milestone.version,
        total_quick_tasks: quickTasks.length,
        tasks: quickTasks
      }, raw);
    }
    function extractSectionsFromFile(filePath, sectionNames) {
      const content = safeReadFile(filePath);
      if (content === null) {
        return { error: "File not found", file: filePath };
      }
      const lines = content.split("\n");
      const sections = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const markerMatch = line.match(/<!--\s*section:\s*(.+?)\s*-->/i);
        if (markerMatch) {
          const name = markerMatch[1].trim();
          sections.push({ name, startLine: i, endLine: -1, type: "marker" });
          continue;
        }
        const endMarkerMatch = line.match(/<!--\s*\/section\s*-->/i);
        if (endMarkerMatch) {
          for (let j = sections.length - 1; j >= 0; j--) {
            if (sections[j].type === "marker" && sections[j].endLine === -1) {
              sections[j].endLine = i;
              break;
            }
          }
          continue;
        }
        const headerMatch = line.match(/^(#{2,3})\s+(.+)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const name = headerMatch[2].trim();
          sections.push({ name, startLine: i, endLine: -1, type: "header", level });
        }
      }
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        if (sec.endLine !== -1) continue;
        if (sec.type === "header") {
          let closed = false;
          for (let j = i + 1; j < sections.length; j++) {
            if (sections[j].type === "header" && sections[j].level <= sec.level) {
              sec.endLine = sections[j].startLine - 1;
              closed = true;
              break;
            }
          }
          if (!closed) {
            sec.endLine = lines.length - 1;
          }
        } else if (sec.type === "marker" && sec.endLine === -1) {
          sec.endLine = lines.length - 1;
        }
      }
      const availableSections = sections.map((s) => s.name);
      if (!sectionNames || sectionNames.length === 0) {
        return {
          file: filePath,
          available_sections: availableSections
        };
      }
      const found = [];
      const missing = [];
      const contentParts = [];
      for (const requestedName of sectionNames) {
        const requestedLower = requestedName.toLowerCase();
        const match = sections.find((s) => s.name.toLowerCase() === requestedLower);
        if (match) {
          found.push(match.name);
          const sectionLines = lines.slice(match.startLine, match.endLine + 1);
          contentParts.push(sectionLines.join("\n"));
        } else {
          missing.push(requestedName);
        }
      }
      return {
        file: filePath,
        sections_found: found,
        sections_missing: missing,
        content: contentParts.join("\n\n")
      };
    }
    function cmdExtractSections(cwd, args, raw) {
      const filePath = args[0];
      if (!filePath) {
        error("Usage: extract-sections <file-path> [section1] [section2] ...");
      }
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const sectionNames = args.slice(1);
      const result = extractSectionsFromFile(resolvedPath, sectionNames);
      if (result.error) {
        error(`File not found: ${filePath}`);
      }
      output(result, raw);
    }
    var { extractAtReferences } = require_helpers();
    function measureAllWorkflows(cwd) {
      let pluginDir = process.env.GSD_PLUGIN_DIR;
      if (!pluginDir) {
        pluginDir = path.resolve(__dirname, "..");
      }
      const workflowsDir = path.join(pluginDir, "workflows");
      if (!fs.existsSync(workflowsDir)) {
        return { error: `Workflows directory not found: ${workflowsDir}`, workflows: [] };
      }
      const workflowFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".md")).sort();
      const workflows = [];
      let totalTokens = 0;
      for (const file of workflowFiles) {
        const filePath = path.join(workflowsDir, file);
        let content;
        try {
          content = fs.readFileSync(filePath, "utf-8");
        } catch (e) {
          debugLog("baseline.measure", `read workflow failed: ${file}`, e);
          continue;
        }
        const workflowTokens = estimateTokens(content);
        const refs = extractAtReferences(content);
        let refTokens = 0;
        let resolvedRefs = 0;
        for (const ref of refs) {
          let refPath;
          if (path.isAbsolute(ref)) {
            refPath = ref;
          } else {
            const pluginRef = path.join(pluginDir, ref);
            const cwdRef = path.join(cwd, ref);
            if (fs.existsSync(pluginRef)) {
              refPath = pluginRef;
            } else if (fs.existsSync(cwdRef)) {
              refPath = cwdRef;
            } else {
              continue;
            }
          }
          try {
            const refContent = fs.readFileSync(refPath, "utf-8");
            refTokens += estimateTokens(refContent);
            resolvedRefs++;
          } catch (e) {
            debugLog("baseline.measure", `read ref failed: ${ref}`, e);
          }
        }
        const total = workflowTokens + refTokens;
        totalTokens += total;
        workflows.push({
          name: file,
          workflow_tokens: workflowTokens,
          ref_count: resolvedRefs,
          ref_tokens: refTokens,
          total_tokens: total
        });
      }
      workflows.sort((a, b) => b.total_tokens - a.total_tokens);
      return {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        workflow_count: workflows.length,
        total_tokens: totalTokens,
        workflows
      };
    }
    function cmdContextBudgetBaseline(cwd, raw) {
      const measurement = measureAllWorkflows(cwd);
      if (measurement.error) {
        error(measurement.error);
      }
      const baselinesDir = path.join(cwd, ".planning", "baselines");
      if (!fs.existsSync(baselinesDir)) {
        fs.mkdirSync(baselinesDir, { recursive: true });
      }
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const baselinePath = path.join(baselinesDir, `baseline-${timestamp}.json`);
      fs.writeFileSync(baselinePath, JSON.stringify(measurement, null, 2), "utf-8");
      const maxNameLen = Math.max(25, ...measurement.workflows.map((w) => w.name.length));
      const header = `${"Workflow".padEnd(maxNameLen)} | Tokens  | Refs | Ref Tokens | Total`;
      const sep = "-".repeat(maxNameLen) + "-|---------|------|------------|--------";
      process.stderr.write("\n## Workflow Token Baseline\n\n");
      process.stderr.write(header + "\n");
      process.stderr.write(sep + "\n");
      for (const w of measurement.workflows) {
        const name = w.name.padEnd(maxNameLen);
        const tokens = String(w.workflow_tokens).padStart(7);
        const refs = String(w.ref_count).padStart(4);
        const refTokens = String(w.ref_tokens).padStart(10);
        const total = String(w.total_tokens).padStart(7);
        process.stderr.write(`${name} | ${tokens} | ${refs} | ${refTokens} | ${total}
`);
      }
      process.stderr.write(sep + "\n");
      process.stderr.write(`${"TOTAL".padEnd(maxNameLen)} | ${String(measurement.total_tokens).padStart(7)} |      |            |
`);
      process.stderr.write(`
Baseline saved: ${path.relative(cwd, baselinePath)}

`);
      measurement.baseline_file = path.relative(cwd, baselinePath);
      output(measurement, raw);
    }
    function cmdContextBudgetCompare(cwd, baselinePath, raw) {
      let baseline;
      const baselinesDir = path.join(cwd, ".planning", "baselines");
      if (baselinePath) {
        const fullPath = path.isAbsolute(baselinePath) ? baselinePath : path.join(cwd, baselinePath);
        if (!fs.existsSync(fullPath)) {
          error(`Baseline file not found: ${baselinePath}`);
        }
        try {
          baseline = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        } catch (e) {
          error(`Invalid baseline file: ${e.message}`);
        }
      } else {
        if (!fs.existsSync(baselinesDir)) {
          error("No baselines directory. Run `context-budget baseline` first.");
        }
        const files = fs.readdirSync(baselinesDir).filter((f) => f.startsWith("baseline-") && f.endsWith(".json")).sort().reverse();
        if (files.length === 0) {
          error("No baseline found. Run `context-budget baseline` first.");
        }
        const latestFile = path.join(baselinesDir, files[0]);
        try {
          baseline = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
          baselinePath = path.relative(cwd, latestFile);
        } catch (e) {
          error(`Invalid baseline file: ${e.message}`);
        }
      }
      const current = measureAllWorkflows(cwd);
      if (current.error) {
        error(current.error);
      }
      const baselineMap = {};
      for (const w of baseline.workflows || []) {
        baselineMap[w.name] = w;
      }
      const currentMap = {};
      for (const w of current.workflows) {
        currentMap[w.name] = w;
      }
      const allNames = /* @__PURE__ */ new Set([...Object.keys(baselineMap), ...Object.keys(currentMap)]);
      const comparisons = [];
      let beforeTotal = 0;
      let afterTotal = 0;
      let improved = 0;
      let unchanged = 0;
      let worsened = 0;
      for (const name of allNames) {
        const before = baselineMap[name];
        const after = currentMap[name];
        if (before && after) {
          const delta = after.total_tokens - before.total_tokens;
          const pctChange = before.total_tokens > 0 ? Math.round(delta / before.total_tokens * 1e3) / 10 : 0;
          beforeTotal += before.total_tokens;
          afterTotal += after.total_tokens;
          if (delta < 0) improved++;
          else if (delta > 0) worsened++;
          else unchanged++;
          comparisons.push({ name, before: before.total_tokens, after: after.total_tokens, delta, percent_change: pctChange });
        } else if (before && !after) {
          beforeTotal += before.total_tokens;
          comparisons.push({ name, before: before.total_tokens, after: 0, delta: -before.total_tokens, percent_change: -100, status: "removed" });
          improved++;
        } else if (!before && after) {
          afterTotal += after.total_tokens;
          comparisons.push({ name, before: 0, after: after.total_tokens, delta: after.total_tokens, percent_change: 100, status: "new" });
          worsened++;
        }
      }
      comparisons.sort((a, b) => a.delta - b.delta);
      const totalDelta = afterTotal - beforeTotal;
      const totalPctChange = beforeTotal > 0 ? Math.round(totalDelta / beforeTotal * 1e3) / 10 : 0;
      const result = {
        baseline_file: baselinePath || "unknown",
        baseline_date: baseline.timestamp || "unknown",
        current_date: current.timestamp,
        summary: {
          before_total: beforeTotal,
          after_total: afterTotal,
          delta: totalDelta,
          percent_change: totalPctChange,
          workflows_improved: improved,
          workflows_unchanged: unchanged,
          workflows_worsened: worsened
        },
        workflows: comparisons
      };
      const maxNameLen = Math.max(25, ...comparisons.map((c) => c.name.length));
      const header = `${"Workflow".padEnd(maxNameLen)} | Before  | After   | Delta   | Change`;
      const sep = "-".repeat(maxNameLen) + "-|---------|---------|---------|-------";
      process.stderr.write("\n## Context Budget Comparison\n\n");
      process.stderr.write(`Baseline: ${baselinePath} (${baseline.timestamp || "unknown"})

`);
      process.stderr.write(header + "\n");
      process.stderr.write(sep + "\n");
      for (const c of comparisons) {
        const name = c.name.padEnd(maxNameLen);
        const before = String(c.before).padStart(7);
        const after = String(c.after).padStart(7);
        const delta = (c.delta >= 0 ? "+" + c.delta : String(c.delta)).padStart(7);
        const pct = (c.percent_change >= 0 ? "+" + c.percent_change : String(c.percent_change)) + "%";
        process.stderr.write(`${name} | ${before} | ${after} | ${delta} | ${pct.padStart(6)}
`);
      }
      process.stderr.write(sep + "\n");
      const totalDeltaStr = (totalDelta >= 0 ? "+" + totalDelta : String(totalDelta)).padStart(7);
      const totalPctStr = (totalPctChange >= 0 ? "+" + totalPctChange : String(totalPctChange)) + "%";
      process.stderr.write(`${"TOTAL".padEnd(maxNameLen)} | ${String(beforeTotal).padStart(7)} | ${String(afterTotal).padStart(7)} | ${totalDeltaStr} | ${totalPctStr.padStart(6)}
`);
      process.stderr.write(`
Improved: ${improved} | Unchanged: ${unchanged} | Worsened: ${worsened}

`);
      output(result, raw);
    }
    function cmdContextBudgetMeasure(cwd, raw) {
      const measurements = [];
      function measureInProcess(label, fn) {
        try {
          let captured = null;
          const origStdoutWrite = process.stdout.write;
          process.stdout.write = (chunk) => {
            captured = chunk;
            return true;
          };
          try {
            fn();
          } finally {
            process.stdout.write = origStdoutWrite;
          }
          const jsonStr = typeof captured === "string" ? captured : captured ? captured.toString() : "";
          const tokens = estimateTokens(jsonStr);
          return { tokens, bytes: Buffer.byteLength(jsonStr, "utf-8") };
        } catch (e) {
          debugLog("measure", `in-process measurement failed: ${label}`, e);
          return { tokens: 0, bytes: 0, error: e.message ? e.message.split("\n")[0] : "unknown" };
        }
      }
      const { cmdHistoryDigest } = require_misc();
      const { cmdInitProgress, cmdInitExecutePhase, cmdInitPlanPhase } = require_init();
      let testPhase = null;
      const phaseTree = getPhaseTree(cwd);
      if (phaseTree.size > 0) {
        const firstEntry = phaseTree.values().next().value;
        if (firstEntry) testPhase = firstEntry.phaseNumber;
      }
      const hdFull = measureInProcess("history-digest", () => cmdHistoryDigest(cwd, {}, true));
      const hdLimit5 = measureInProcess("history-digest --limit 5", () => cmdHistoryDigest(cwd, { limit: 5 }, true));
      const hdSlim = measureInProcess("history-digest --slim", () => cmdHistoryDigest(cwd, { compact: true }, true));
      const hdSlimLimit5 = measureInProcess("history-digest --slim --limit 5", () => cmdHistoryDigest(cwd, { limit: 5, compact: true }, true));
      if (!hdFull.error) {
        measurements.push({
          command: "history-digest",
          variant: "--limit 5",
          full_tokens: hdFull.tokens,
          slim_tokens: hdLimit5.tokens,
          saved_tokens: hdFull.tokens - hdLimit5.tokens,
          saved_percent: hdFull.tokens > 0 ? Math.round((hdFull.tokens - hdLimit5.tokens) / hdFull.tokens * 100) : 0,
          full_bytes: hdFull.bytes,
          slim_bytes: hdLimit5.bytes
        });
        measurements.push({
          command: "history-digest",
          variant: "--slim",
          full_tokens: hdFull.tokens,
          slim_tokens: hdSlim.tokens,
          saved_tokens: hdFull.tokens - hdSlim.tokens,
          saved_percent: hdFull.tokens > 0 ? Math.round((hdFull.tokens - hdSlim.tokens) / hdFull.tokens * 100) : 0,
          full_bytes: hdFull.bytes,
          slim_bytes: hdSlim.bytes
        });
        measurements.push({
          command: "history-digest",
          variant: "--slim --limit 5",
          full_tokens: hdFull.tokens,
          slim_tokens: hdSlimLimit5.tokens,
          saved_tokens: hdFull.tokens - hdSlimLimit5.tokens,
          saved_percent: hdFull.tokens > 0 ? Math.round((hdFull.tokens - hdSlimLimit5.tokens) / hdFull.tokens * 100) : 0,
          full_bytes: hdFull.bytes,
          slim_bytes: hdSlimLimit5.bytes
        });
      }
      const savedCompact = global._gsdCompactMode;
      global._gsdCompactMode = false;
      const progressVerbose = measureInProcess("init progress --verbose", () => cmdInitProgress(cwd, true));
      global._gsdCompactMode = true;
      const progressCompact = measureInProcess("init progress", () => cmdInitProgress(cwd, true));
      global._gsdCompactMode = savedCompact;
      if (!progressVerbose.error) {
        measurements.push({
          command: "init progress",
          variant: "compact (default) vs verbose",
          full_tokens: progressVerbose.tokens,
          slim_tokens: progressCompact.tokens,
          saved_tokens: progressVerbose.tokens - progressCompact.tokens,
          saved_percent: progressVerbose.tokens > 0 ? Math.round((progressVerbose.tokens - progressCompact.tokens) / progressVerbose.tokens * 100) : 0,
          full_bytes: progressVerbose.bytes,
          slim_bytes: progressCompact.bytes
        });
      }
      if (testPhase) {
        global._gsdCompactMode = false;
        const execVerbose = measureInProcess(`init execute-phase ${testPhase} --verbose`, () => cmdInitExecutePhase(cwd, testPhase, true));
        global._gsdCompactMode = true;
        const execCompact = measureInProcess(`init execute-phase ${testPhase}`, () => cmdInitExecutePhase(cwd, testPhase, true));
        global._gsdCompactMode = savedCompact;
        if (!execVerbose.error) {
          measurements.push({
            command: `init execute-phase ${testPhase}`,
            variant: "compact (default) vs verbose",
            full_tokens: execVerbose.tokens,
            slim_tokens: execCompact.tokens,
            saved_tokens: execVerbose.tokens - execCompact.tokens,
            saved_percent: execVerbose.tokens > 0 ? Math.round((execVerbose.tokens - execCompact.tokens) / execVerbose.tokens * 100) : 0,
            full_bytes: execVerbose.bytes,
            slim_bytes: execCompact.bytes
          });
        }
        global._gsdCompactMode = false;
        const planVerbose = measureInProcess(`init plan-phase ${testPhase} --verbose`, () => cmdInitPlanPhase(cwd, testPhase, true));
        global._gsdCompactMode = true;
        const planCompact = measureInProcess(`init plan-phase ${testPhase}`, () => cmdInitPlanPhase(cwd, testPhase, true));
        global._gsdCompactMode = savedCompact;
        if (!planVerbose.error) {
          measurements.push({
            command: `init plan-phase ${testPhase}`,
            variant: "compact (default) vs verbose",
            full_tokens: planVerbose.tokens,
            slim_tokens: planCompact.tokens,
            saved_tokens: planVerbose.tokens - planCompact.tokens,
            saved_percent: planVerbose.tokens > 0 ? Math.round((planVerbose.tokens - planCompact.tokens) / planVerbose.tokens * 100) : 0,
            full_bytes: planVerbose.bytes,
            slim_bytes: planCompact.bytes
          });
        }
      }
      const totalFullTokens = measurements.reduce((sum, m) => sum + m.full_tokens, 0);
      const totalSlimTokens = measurements.reduce((sum, m) => sum + m.slim_tokens, 0);
      const totalSavedTokens = totalFullTokens - totalSlimTokens;
      const totalSavedPercent = totalFullTokens > 0 ? Math.round(totalSavedTokens / totalFullTokens * 100) : 0;
      output({
        measurements,
        total_full_tokens: totalFullTokens,
        total_slim_tokens: totalSlimTokens,
        total_saved_tokens: totalSavedTokens,
        total_saved_percent: totalSavedPercent,
        note: 'Measures real JSON output token counts. "full" = verbose/unfiltered, "slim" = compact/filtered.'
      }, raw);
    }
    var WORKFLOW_BUDGETS = {
      "execute-phase": 15e3,
      "plan-phase": 15e3,
      "execute-plan": 12e3,
      "new-project": 25e3,
      "quick": 1e4,
      "progress": 8e3,
      "verify-work": 12e3,
      "resume-project": 8e3,
      "help": 1e4,
      "pause-work": 5e3
    };
    function cmdTokenBudget(cwd, raw) {
      let pluginDir = process.env.GSD_PLUGIN_DIR;
      if (!pluginDir) {
        pluginDir = path.resolve(__dirname, "..");
      }
      const searchDirs = [
        path.join(cwd, "workflows"),
        path.join(pluginDir, "workflows")
      ];
      const homeConfig = process.env.HOME ? path.join(process.env.HOME, ".config", "opencode", "get-shit-done", "workflows") : null;
      if (homeConfig) searchDirs.push(homeConfig);
      let workflowsDir = null;
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          workflowsDir = dir;
          break;
        }
      }
      const workflows = [];
      let overBudgetCount = 0;
      for (const [name, budgetTokens] of Object.entries(WORKFLOW_BUDGETS)) {
        const fileName = `${name}.md`;
        let content = null;
        if (workflowsDir) {
          const filePath = path.join(workflowsDir, fileName);
          if (fs.existsSync(filePath)) {
            try {
              content = fs.readFileSync(filePath, "utf-8");
            } catch (e) {
              debugLog("feature.tokenBudget", `read workflow failed: ${fileName}`, e);
            }
          }
        }
        if (content === null) {
          workflows.push({ name, actual_tokens: null, budget_tokens: budgetTokens, over_budget: false, percent_of_budget: null, status: "not_found" });
          continue;
        }
        const actualTokens = Math.ceil(content.length / 4);
        const overBudget = actualTokens > budgetTokens;
        const percentOfBudget = Math.round(actualTokens / budgetTokens * 100);
        if (overBudget) overBudgetCount++;
        workflows.push({ name, actual_tokens: actualTokens, budget_tokens: budgetTokens, over_budget: overBudget, percent_of_budget: percentOfBudget });
      }
      output({ workflows, over_budget_count: overBudgetCount, total_workflows: workflows.length }, raw);
    }
    function cmdTestCoverage(cwd, raw) {
      const config = loadConfig(cwd);
      const testFile = config.test_file || "bin/gsd-tools.test.cjs";
      const testPath = path.join(cwd, testFile);
      if (!fs.existsSync(testPath)) {
        error(`Test file not found: ${testFile}`);
      }
      const routerFile = config.router_file || "src/router.js";
      const routerPath = path.join(cwd, routerFile);
      if (!fs.existsSync(routerPath)) {
        error(`Router file not found: ${routerFile}`);
      }
      const testContent = fs.readFileSync(testPath, "utf-8");
      const routerContent = fs.readFileSync(routerPath, "utf-8");
      const routerCommands = /* @__PURE__ */ new Set();
      const casePattern = /^\s{4}case\s+'([^']+)'/gm;
      let caseMatch;
      while ((caseMatch = casePattern.exec(routerContent)) !== null) {
        routerCommands.add(caseMatch[1]);
      }
      const initPattern = /^\s{8}case\s+'([^']+)'/gm;
      let initMatch;
      while ((initMatch = initPattern.exec(routerContent)) !== null) {
        routerCommands.add("init " + initMatch[1]);
      }
      const testedCommands = /* @__PURE__ */ new Set();
      const runPattern = /runGsdTools\(\s*['"`]([^'"`]+)['"`]/g;
      let runMatch;
      while ((runMatch = runPattern.exec(testContent)) !== null) {
        const fullCmd = runMatch[1].trim();
        const words = fullCmd.split(/\s+/);
        const cmd = words[0];
        testedCommands.add(cmd);
        if (words.length > 1 && ["init", "state", "verify", "memory", "roadmap", "phase", "phases", "frontmatter", "template", "validate", "milestone", "requirements", "context-budget", "todo"].includes(cmd)) {
          testedCommands.add(cmd + " " + words[1]);
        }
      }
      const templatePattern = /runGsdTools\(\s*`([^`]+)`/g;
      let templateMatch;
      while ((templateMatch = templatePattern.exec(testContent)) !== null) {
        const fullCmd = templateMatch[1].replace(/\$\{[^}]+\}/g, "X").trim();
        const words = fullCmd.split(/\s+/);
        const cmd = words[0];
        testedCommands.add(cmd);
        if (words.length > 1 && ["init", "state", "verify", "memory", "roadmap", "phase", "phases", "frontmatter", "template", "validate", "milestone", "requirements", "context-budget", "todo"].includes(cmd)) {
          testedCommands.add(cmd + " " + words[1]);
        }
      }
      const describePattern = /describe\(\s*['"`]([^'"`]+)['"`]/g;
      let describeMatch;
      while ((describeMatch = describePattern.exec(testContent)) !== null) {
        const desc = describeMatch[1].trim();
        const descWords = desc.split(/[\s:]+/);
        for (const word of descWords) {
          if (routerCommands.has(word)) {
            testedCommands.add(word);
          }
        }
      }
      const testMatches = testContent.match(/\btest\s*\(/g) || [];
      const testCount = testMatches.length;
      const allCommands = [...routerCommands].sort();
      const covered = allCommands.filter((cmd) => {
        if (testedCommands.has(cmd)) return true;
        const base = cmd.split(" ")[0];
        if (testedCommands.has(base) && cmd.startsWith("init ")) {
          return testedCommands.has(cmd);
        }
        return false;
      });
      const uncovered = allCommands.filter((cmd) => !covered.includes(cmd));
      const totalCommands = allCommands.length;
      const commandsWithTests = covered.length;
      const coveragePercent = totalCommands > 0 ? Math.round(commandsWithTests / totalCommands * 100) : 0;
      output({
        total_commands: totalCommands,
        commands_with_tests: commandsWithTests,
        coverage_percent: coveragePercent,
        covered,
        uncovered,
        test_count: testCount
      }, raw);
    }
    function cmdSessionSummary(cwd, raw) {
      const pd = path.join(cwd, ".planning");
      const sc = safeReadFile(path.join(pd, "STATE.md"));
      if (!sc) {
        output({ error: "STATE.md not found" }, raw);
        return;
      }
      const xf = (f) => {
        const m = sc.match(new RegExp(`\\*\\*${f}:\\*\\*\\s*(.+)`, "i"));
        return m ? m[1].trim() : null;
      };
      const pm = (xf("Phase") || "").match(/(\d+)\s*of\s*(\d+)\s*\(([^)]+)\)/);
      const phaseNum = pm ? pm[1] : xf("Phase");
      const phaseName = pm ? pm[3] : null;
      const plan = xf("Current Plan") || "Not started";
      const status = xf("Status") || "Unknown";
      const lastAct = xf("Last Activity");
      const completed = [];
      if (lastAct && isValidDateString(lastAct)) {
        const sessionLog = execGit(cwd, ["log", `--since=${lastAct}`, "--oneline", "--no-merges", "--", ".planning/"]);
        if (sessionLog.exitCode === 0 && sessionLog.stdout) {
          for (const l of sessionLog.stdout.split("\n")) {
            const m = l.match(/(?:feat|fix|docs|chore|refactor|test|perf)\((\d+-\d+)\)/);
            if (m && !completed.includes(m[1])) completed.push(m[1]);
          }
        }
      }
      const ds = sc.match(/### Decisions\s*\n([\s\S]*?)(?=\n###|\n## |\n$)/);
      const decisions = [];
      if (ds) for (const l of ds[1].split("\n")) {
        const m = l.match(/^-\s*(?:\[Phase \d+\]:\s*)?(.{10,})/);
        if (m && !m[1].startsWith("All v")) decisions.push(m[1].trim());
      }
      let next = { command: "/gsd-resume", description: "Resume project work" };
      const rc = safeReadFile(path.join(pd, "ROADMAP.md"));
      if (rc && phaseNum) {
        const unchecked = [];
        let um;
        const up = /- \[ \] \*\*Phase (\d+):\s*([^*]+)\*\*/g;
        while ((um = up.exec(rc)) !== null) unchecked.push({ n: um[1], name: um[2].trim() });
        const pDir = path.join(pd, "phases");
        const countPlans = (num) => {
          try {
            const dirs = fs.readdirSync(pDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
            const d = dirs.find((d2) => d2.startsWith(normalizePhaseName(num) + "-"));
            if (!d) return { plans: 0, summaries: 0 };
            const files = fs.readdirSync(path.join(pDir, d));
            return { plans: files.filter((f) => f.endsWith("-PLAN.md")).length, summaries: files.filter((f) => f.endsWith("-SUMMARY.md")).length };
          } catch (e) {
            return { plans: 0, summaries: 0 };
          }
        };
        const cur = countPlans(phaseNum);
        if (cur.plans > 0 && cur.summaries < cur.plans) {
          next = { command: `/gsd-execute-phase ${phaseNum}`, description: `Continue Phase ${phaseNum}: ${phaseName || "current"}` };
        } else if (unchecked.length > 0) {
          const np = unchecked.find((p) => parseInt(p.n) > parseInt(phaseNum));
          if (np) {
            const nc = countPlans(np.n);
            next = nc.plans > 0 ? { command: `/gsd-execute-phase ${np.n}`, description: `Execute Phase ${np.n}: ${np.name}` } : { command: `/gsd-plan-phase ${np.n}`, description: `Plan Phase ${np.n}: ${np.name}` };
          } else {
            next = { command: "/gsd-complete-milestone", description: "All phases done \u2014 complete milestone" };
          }
        } else {
          next = { command: "/gsd-complete-milestone", description: "All phases done \u2014 complete milestone" };
        }
      }
      const sa = sc.match(/Stopped at:\s*(.+)/);
      const rf = sc.match(/Resume file:\s*(.+)/);
      output({
        current_position: { phase: pm ? `${pm[1]} of ${pm[2]}` : phaseNum || "Unknown", phase_name: phaseName || "Unknown", plan, status },
        session_activity: { plans_completed: completed, decisions_made: decisions.slice(-5), blockers_resolved: [], last_activity: lastAct || "Unknown" },
        next_action: next,
        session_continuity: { stopped_at: sa ? sa[1].trim() : `Phase ${phaseNum || "?"} \u2014 ${status}`, resume_file: rf ? rf[1].trim() : "None" }
      }, raw);
    }
    module2.exports = {
      cmdSessionDiff,
      cmdContextBudget,
      cmdContextBudgetBaseline,
      cmdContextBudgetCompare,
      cmdContextBudgetMeasure,
      cmdTestRun,
      cmdSearchDecisions,
      cmdValidateDependencies,
      cmdSearchLessons,
      cmdCodebaseImpact,
      cmdRollbackInfo,
      cmdVelocity,
      cmdTraceRequirement,
      cmdValidateConfig,
      cmdQuickTaskSummary,
      cmdExtractSections,
      extractSectionsFromFile,
      cmdTokenBudget,
      cmdTestCoverage,
      cmdSessionSummary
    };
  }
});

// src/commands/memory.js
var require_memory = __commonJS({
  "src/commands/memory.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var VALID_STORES = ["decisions", "bookmarks", "lessons", "todos"];
    var SACRED_STORES = ["decisions", "lessons"];
    var BOOKMARKS_MAX = 20;
    var COMPACT_THRESHOLD = 50;
    var COMPACT_KEEP_RECENT = 10;
    function cmdMemoryEnsureDir(cwd) {
      const dir = path.join(cwd, ".planning", "memory");
      fs.mkdirSync(dir, { recursive: true });
      output({ ensured: true, memory_dir: dir });
    }
    function cmdMemoryWrite(cwd, options, raw) {
      const { store, entry: entryJson } = options;
      if (!store || !VALID_STORES.includes(store)) {
        error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(", ")}`);
      }
      if (!entryJson) {
        error("Missing --entry (JSON string)");
      }
      let entry;
      try {
        entry = JSON.parse(entryJson);
      } catch (e) {
        error(`Invalid JSON in --entry: ${e.message}`);
      }
      const memDir = path.join(cwd, ".planning", "memory");
      fs.mkdirSync(memDir, { recursive: true });
      const filePath = path.join(memDir, `${store}.json`);
      let entries = [];
      try {
        const raw2 = fs.readFileSync(filePath, "utf-8");
        entries = JSON.parse(raw2);
        if (!Array.isArray(entries)) entries = [];
      } catch (e) {
        debugLog("memory.write", "read failed, starting fresh", e);
        entries = [];
      }
      if (!entry.timestamp) {
        entry.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      }
      if (store === "bookmarks") {
        entries.unshift(entry);
        if (entries.length > BOOKMARKS_MAX) {
          entries = entries.slice(0, BOOKMARKS_MAX);
        }
      } else {
        entries.push(entry);
      }
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
      const result = { written: true, store, entry_count: entries.length };
      if (!SACRED_STORES.includes(store) && entries.length > COMPACT_THRESHOLD) {
        result.compact_needed = true;
        result.threshold = COMPACT_THRESHOLD;
      }
      output(result);
    }
    function cmdMemoryRead(cwd, options, raw) {
      const { store, limit, query, phase } = options;
      if (!store || !VALID_STORES.includes(store)) {
        error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(", ")}`);
      }
      const filePath = path.join(cwd, ".planning", "memory", `${store}.json`);
      let entries = [];
      try {
        const raw2 = fs.readFileSync(filePath, "utf-8");
        entries = JSON.parse(raw2);
        if (!Array.isArray(entries)) entries = [];
      } catch (e) {
        debugLog("memory.read", "read failed", e);
        entries = [];
      }
      const total = entries.length;
      if (phase) {
        entries = entries.filter((e) => e.phase && String(e.phase) === String(phase));
      }
      if (query) {
        const q = query.toLowerCase();
        entries = entries.filter((e) => {
          return Object.values(e).some((v) => {
            if (typeof v === "string") return v.toLowerCase().includes(q);
            return false;
          });
        });
      }
      if (limit && parseInt(limit, 10) > 0) {
        entries = entries.slice(0, parseInt(limit, 10));
      }
      output({ entries, count: entries.length, store, total });
    }
    function cmdMemoryList(cwd, options, raw) {
      const memDir = path.join(cwd, ".planning", "memory");
      const stores = [];
      try {
        const files = fs.readdirSync(memDir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const filePath = path.join(memDir, file);
          const stat = fs.statSync(filePath);
          let entryCount = 0;
          try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            if (Array.isArray(data)) entryCount = data.length;
          } catch (e) {
            debugLog("memory.list", `parse failed for ${file}`, e);
          }
          stores.push({
            name: file.replace(".json", ""),
            entry_count: entryCount,
            size_bytes: stat.size,
            last_modified: stat.mtime.toISOString()
          });
        }
      } catch (e) {
        debugLog("memory.list", "readdir failed", e);
      }
      output({ stores, memory_dir: memDir });
    }
    function cmdMemoryCompact(cwd, options, raw) {
      const { store, threshold: thresholdStr, dryRun } = options;
      const threshold = thresholdStr ? parseInt(thresholdStr, 10) : COMPACT_THRESHOLD;
      if (store && !VALID_STORES.includes(store)) {
        error(`Invalid store. Must be one of: ${VALID_STORES.join(", ")}`);
      }
      const memDir = path.join(cwd, ".planning", "memory");
      const storesToProcess = store ? [store] : VALID_STORES;
      const result = {
        compacted: false,
        stores_processed: [],
        entries_before: {},
        entries_after: {},
        summaries_created: {},
        sacred_skipped: []
      };
      for (const s of storesToProcess) {
        if (SACRED_STORES.includes(s)) {
          result.sacred_skipped.push(s);
          continue;
        }
        const filePath = path.join(memDir, `${s}.json`);
        let entries = [];
        try {
          const rawData = fs.readFileSync(filePath, "utf-8");
          entries = JSON.parse(rawData);
          if (!Array.isArray(entries)) entries = [];
        } catch (e) {
          debugLog("memory.compact", `read failed for ${s}`, e);
          continue;
        }
        const beforeCount = entries.length;
        result.entries_before[s] = beforeCount;
        if (beforeCount <= threshold) {
          result.entries_after[s] = beforeCount;
          result.summaries_created[s] = 0;
          result.stores_processed.push(s);
          continue;
        }
        let compactedEntries;
        let summariesCreated = 0;
        if (s === "bookmarks") {
          const kept = entries.slice(0, COMPACT_KEEP_RECENT);
          const old = entries.slice(COMPACT_KEEP_RECENT);
          const summarized = old.map((e) => {
            const ts = e.timestamp || "";
            const date = ts ? ts.split("T")[0] : "unknown";
            const phase = e.phase || "?";
            const plan = e.plan || "?";
            const task = e.task !== void 0 ? e.task : "?";
            return {
              summary: `${date}: Phase ${phase}, Plan ${plan}, Task ${task}`,
              original_timestamp: ts
            };
          });
          summariesCreated = summarized.length;
          compactedEntries = [...kept, ...summarized];
        } else if (s === "todos") {
          const active = [];
          const completedSummaries = [];
          for (const e of entries) {
            const isCompleted = e.completed === true || e.status === "completed" || e.status === "done";
            if (isCompleted) {
              const ts = e.timestamp || "";
              const date = ts ? ts.split("T")[0] : "unknown";
              const text = e.text || e.summary || e.title || "todo";
              completedSummaries.push({
                summary: `${date}: [completed] ${text}`,
                original_timestamp: ts
              });
            } else {
              active.push(e);
            }
          }
          summariesCreated = completedSummaries.length;
          compactedEntries = [...active, ...completedSummaries];
        } else {
          result.entries_after[s] = beforeCount;
          result.summaries_created[s] = 0;
          result.stores_processed.push(s);
          continue;
        }
        result.entries_after[s] = compactedEntries.length;
        result.summaries_created[s] = summariesCreated;
        result.stores_processed.push(s);
        if (summariesCreated > 0) {
          result.compacted = true;
        }
        if (!dryRun) {
          fs.mkdirSync(memDir, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify(compactedEntries, null, 2), "utf-8");
        }
      }
      if (store && SACRED_STORES.includes(store)) {
        output({ compacted: false, reason: "sacred_data" });
        return;
      }
      if (dryRun) {
        result.dry_run = true;
      }
      output(result);
    }
    module2.exports = { cmdMemoryWrite, cmdMemoryRead, cmdMemoryList, cmdMemoryEnsureDir, cmdMemoryCompact };
  }
});

// src/commands/mcp.js
var require_mcp = __commonJS({
  "src/commands/mcp.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { output, error, debugLog } = require_output();
    var MCP_KNOWN_SERVERS = [
      { name: "postgres", patterns: [/postgres/i, /toolbox.*postgres/i], tool_count: 12, base_tokens: 700, total_estimate: 4500 },
      { name: "github", patterns: [/github/i], tool_count: 30, base_tokens: 1500, total_estimate: 46e3 },
      { name: "brave-search", patterns: [/brave[_-]?search/i, /server-brave-search/i], tool_count: 3, base_tokens: 500, total_estimate: 2500 },
      { name: "context7", patterns: [/context7/i], tool_count: 2, base_tokens: 300, total_estimate: 1500 },
      { name: "terraform", patterns: [/terraform/i], tool_count: 8, base_tokens: 800, total_estimate: 6e3 },
      { name: "docker", patterns: [/^docker$/i, /docker-mcp/i], tool_count: 10, base_tokens: 500, total_estimate: 5e3 },
      { name: "podman", patterns: [/podman/i], tool_count: 10, base_tokens: 500, total_estimate: 5e3 },
      { name: "filesystem", patterns: [/filesystem/i, /server-filesystem/i], tool_count: 8, base_tokens: 500, total_estimate: 3e3 },
      { name: "puppeteer", patterns: [/puppeteer/i], tool_count: 12, base_tokens: 800, total_estimate: 8e3 },
      { name: "sqlite", patterns: [/sqlite/i], tool_count: 6, base_tokens: 500, total_estimate: 3e3 },
      { name: "redis", patterns: [/redis/i], tool_count: 8, base_tokens: 500, total_estimate: 3500 },
      { name: "rabbitmq", patterns: [/rabbitmq/i, /queue[_-]?pilot/i], tool_count: 6, base_tokens: 500, total_estimate: 3e3 },
      { name: "pulsar", patterns: [/pulsar/i, /snmcp/i], tool_count: 8, base_tokens: 500, total_estimate: 4e3 },
      { name: "consul", patterns: [/consul/i], tool_count: 5, base_tokens: 400, total_estimate: 2500 },
      { name: "vault", patterns: [/vault/i], tool_count: 8, base_tokens: 500, total_estimate: 4e3 },
      { name: "slack", patterns: [/slack/i], tool_count: 15, base_tokens: 1e3, total_estimate: 12e3 },
      { name: "linear", patterns: [/linear/i], tool_count: 20, base_tokens: 1e3, total_estimate: 15e3 },
      { name: "notion", patterns: [/notion/i], tool_count: 12, base_tokens: 800, total_estimate: 6e3 },
      { name: "sentry", patterns: [/sentry/i], tool_count: 8, base_tokens: 600, total_estimate: 4e3 },
      { name: "datadog", patterns: [/datadog/i], tool_count: 10, base_tokens: 800, total_estimate: 5e3 }
    ];
    var DEFAULT_TOKENS_PER_TOOL = 150;
    var DEFAULT_BASE_TOKENS = 400;
    var DEFAULT_CONTEXT_WINDOW = 2e5;
    var LOW_COST_THRESHOLD = 1e3;
    var RELEVANCE_INDICATORS = {
      postgres: { files: ["prisma/schema.prisma", "migrations/", "db/", "ecto/", "schema.sql", "knexfile.js", "drizzle.config.ts"], patterns: ["*.sql"], description: "Database schema or migrations detected" },
      github: { files: [".github/", ".git/"], description: "Git repository detected" },
      terraform: { files: ["terraform/", ".terraform/"], patterns: ["*.tf"], description: "Terraform configuration files detected" },
      docker: { files: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"], description: "Docker configuration detected" },
      "brave-search": { description: "General-purpose web search (always useful)", always_relevant: true },
      context7: { description: "Documentation lookup (always useful)", always_relevant: true },
      redis: { files: ["redis.conf"], env_hints: ["REDIS_URL", "REDIS_HOST"], description: "Redis configuration or environment hints detected" },
      rabbitmq: { files: ["schemas/", "rabbitmq.conf"], env_hints: ["RABBITMQ_URL", "AMQP_URL"], description: "Message queue schemas or config detected" },
      pulsar: { env_hints: ["PULSAR_SERVICE_URL"], description: "Pulsar connection configured" },
      consul: { files: ["consul.hcl", "consul/"], env_hints: ["CONSUL_HTTP_ADDR"], description: "Consul configuration detected" },
      vault: { files: ["vault.hcl", "vault/"], env_hints: ["VAULT_ADDR"], description: "Vault configuration detected" },
      sqlite: { patterns: ["*.sqlite", "*.db"], description: "SQLite database files detected" },
      puppeteer: { files: ["puppeteer.config.js", ".puppeteerrc"], description: "Puppeteer/browser automation config detected" },
      slack: { files: ["slack.json", ".slack/"], env_hints: ["SLACK_BOT_TOKEN", "SLACK_WEBHOOK_URL"], description: "Slack integration detected" },
      filesystem: { description: "Filesystem access (always useful for coding)", always_relevant: true },
      podman: { files: ["Containerfile", "Dockerfile", "podman-compose.yml"], description: "Container configuration detected" }
    };
    function safeReadJson(filePath) {
      try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch {
        debugLog("mcp.discovery", `failed to parse ${filePath}`);
        return null;
      }
    }
    function extractFromMcpJson(filePath) {
      const data = safeReadJson(filePath);
      if (!data || !data.mcpServers || typeof data.mcpServers !== "object") return [];
      const servers = [];
      for (const [name, config] of Object.entries(data.mcpServers)) {
        if (!config || typeof config !== "object") continue;
        servers.push({ name, source: ".mcp.json", transport: "stdio", command: (typeof config.command === "string" ? config.command : null) || "unknown", args: Array.isArray(config.args) ? config.args : [] });
      }
      return servers;
    }
    function extractFromOpencodeJson(filePath, sourceName) {
      const data = safeReadJson(filePath);
      if (!data || !data.mcp || typeof data.mcp !== "object") return [];
      const servers = [];
      for (const [name, config] of Object.entries(data.mcp)) {
        if (!config || typeof config !== "object") continue;
        const transport = config.type === "remote" ? "remote" : "stdio";
        let command = "unknown", args = [];
        if (transport === "remote") {
          command = config.url || "unknown";
        } else if (Array.isArray(config.command)) {
          command = config.command[0] || "unknown";
          args = config.command.slice(1);
        } else if (typeof config.command === "string") {
          command = config.command;
        }
        servers.push({ name, source: sourceName || path.basename(filePath), transport, command, args });
      }
      return servers;
    }
    function discoverMcpServers(cwd) {
      const mcpJsonServers = extractFromMcpJson(path.join(cwd, ".mcp.json"));
      const opencodeServers = extractFromOpencodeJson(path.join(cwd, "opencode.json"), "opencode.json");
      const homeConfig = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".config", "opencode", "opencode.json");
      const userServers = extractFromOpencodeJson(homeConfig, "~/.config/opencode/opencode.json");
      const serverMap = /* @__PURE__ */ new Map();
      for (const s of mcpJsonServers) serverMap.set(s.name, s);
      for (const s of opencodeServers) {
        if (!serverMap.has(s.name)) serverMap.set(s.name, s);
      }
      for (const s of userServers) {
        if (!serverMap.has(s.name)) serverMap.set(s.name, s);
      }
      return Array.from(serverMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
    function estimateTokenCost(server, knownServers) {
      const db = knownServers || MCP_KNOWN_SERVERS;
      for (const known of db) {
        for (const pattern of known.patterns) {
          const testStr = `${server.name} ${server.command} ${(server.args || []).join(" ")}`;
          if (pattern instanceof RegExp) {
            if (pattern.test(server.name) || pattern.test(server.command) || pattern.test(testStr)) {
              return {
                matched: true,
                server_name: known.name,
                tool_count: known.tool_count,
                token_estimate: known.total_estimate,
                source: "known-db"
              };
            }
          } else if (typeof pattern === "string") {
            const lowerTest = testStr.toLowerCase();
            if (lowerTest.includes(pattern.toLowerCase())) {
              return {
                matched: true,
                server_name: known.name,
                tool_count: known.tool_count,
                token_estimate: known.total_estimate,
                source: "known-db"
              };
            }
          }
        }
      }
      const defaultToolCount = 5;
      const estimate = defaultToolCount * DEFAULT_TOKENS_PER_TOOL + DEFAULT_BASE_TOKENS;
      return {
        matched: false,
        server_name: server.name,
        tool_count: defaultToolCount,
        token_estimate: estimate,
        source: "default-estimate"
      };
    }
    function matchIndicatorKey(serverName) {
      const lower = serverName.toLowerCase();
      if (RELEVANCE_INDICATORS[lower]) return lower;
      for (const key of Object.keys(RELEVANCE_INDICATORS)) {
        if (lower.includes(key) || key.includes(lower)) return key;
      }
      return null;
    }
    function checkEnvHints(envHints, cwd) {
      if (!envHints || envHints.length === 0) return false;
      const envFiles = [".env", ".env.local", ".env.development", "docker-compose.yml", "docker-compose.yaml"];
      for (const envFile of envFiles) {
        const filePath = path.join(cwd, envFile);
        try {
          if (!fs.existsSync(filePath)) continue;
          const content = fs.readFileSync(filePath, "utf-8");
          for (const hint of envHints) {
            if (content.includes(hint)) return true;
          }
        } catch {
        }
      }
      return false;
    }
    function scoreServerRelevance(server, cwd) {
      const indicatorKey = matchIndicatorKey(server.name);
      if (indicatorKey) {
        const indicator = RELEVANCE_INDICATORS[indicatorKey];
        if (indicator.always_relevant) {
          return { score: "relevant", reason: indicator.description };
        }
        if (server.token_estimate && server.token_estimate < LOW_COST_THRESHOLD) {
          return { score: "relevant", reason: "Low cost (<1K tokens) \u2014 not worth disabling" };
        }
        const files = indicator.files || [];
        for (const file of files) {
          try {
            if (fs.existsSync(path.join(cwd, file))) return { score: "relevant", reason: indicator.description };
          } catch {
          }
        }
        const patterns = indicator.patterns || [];
        for (const pattern of patterns) {
          if (pattern.startsWith("*.")) {
            const ext = pattern.slice(1);
            try {
              if (fs.readdirSync(cwd).some((e) => e.endsWith(ext))) return { score: "relevant", reason: indicator.description };
            } catch {
            }
          }
        }
        if (checkEnvHints(indicator.env_hints, cwd)) {
          return { score: "possibly-relevant", reason: "Environment hints found but no project files" };
        }
        return { score: "not-relevant", reason: "No project files matching this server type" };
      }
      if (server.token_estimate && server.token_estimate < LOW_COST_THRESHOLD) {
        return { score: "relevant", reason: "Low cost (<1K tokens) \u2014 not worth disabling" };
      }
      return { score: "possibly-relevant", reason: "Unknown server \u2014 manual review recommended" };
    }
    function generateRecommendations(servers, cwd, contextWindow) {
      contextWindow = contextWindow || DEFAULT_CONTEXT_WINDOW;
      let totalPotentialSavings = 0;
      const summary = { keep: 0, disable: 0, review: 0 };
      const enriched = servers.map((server) => {
        const { score, reason } = scoreServerRelevance(server, cwd);
        let recommendation;
        let recommendationReason;
        if (score === "relevant") {
          recommendation = "keep";
          recommendationReason = reason;
          summary.keep++;
        } else if (score === "possibly-relevant") {
          recommendation = "review";
          recommendationReason = "Check if this server is needed for your workflow";
          summary.review++;
        } else {
          recommendation = "disable";
          const tokenSave = server.token_estimate || 0;
          const pct = (tokenSave / contextWindow * 100).toFixed(1);
          recommendationReason = `No matching project files found \u2014 saves ${tokenSave} tokens (${pct}%)`;
          totalPotentialSavings += tokenSave;
          summary.disable++;
        }
        return {
          ...server,
          relevance: score,
          recommendation,
          recommendation_reason: recommendationReason
        };
      });
      const totalTokens = servers.reduce((sum, s) => sum + (s.token_estimate || 0), 0);
      const potentialSavingsPercent = totalTokens > 0 ? (totalPotentialSavings / contextWindow * 100).toFixed(1) + "%" : "0.0%";
      return {
        servers: enriched,
        total_potential_savings: totalPotentialSavings,
        potential_savings_percent: potentialSavingsPercent,
        recommendations_summary: summary
      };
    }
    function applyRecommendations(cwd, servers) {
      const cfgPath = path.join(cwd, "opencode.json");
      const bakPath = path.join(cwd, "opencode.json.bak");
      if (!fs.existsSync(cfgPath)) return { applied: false, reason: "No opencode.json found \u2014 only OpenCode configs support disable" };
      let config;
      try {
        config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      } catch (e) {
        return { applied: false, reason: `Failed to parse opencode.json: ${e.message}` };
      }
      if (!config.mcp || typeof config.mcp !== "object") return { applied: false, reason: "No mcp section in opencode.json" };
      fs.copyFileSync(cfgPath, bakPath);
      const toDisable = servers.filter((s) => s.recommendation === "disable" && s.source === "opencode.json");
      const disabled = [];
      let saved = 0;
      for (const s of toDisable) {
        if (config.mcp[s.name]) {
          config.mcp[s.name].enabled = false;
          disabled.push(s.name);
          saved += s.token_estimate || 0;
        }
      }
      fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + "\n");
      const skipped = servers.filter((s) => s.recommendation === "disable" && s.source === ".mcp.json").map((s) => s.name);
      return { applied: true, backup_path: "opencode.json.bak", disabled_count: disabled.length, disabled_servers: disabled, tokens_saved: saved, skipped_mcp_json: skipped.length > 0 ? skipped : void 0 };
    }
    function restoreBackup(cwd) {
      const cfgPath = path.join(cwd, "opencode.json");
      const bakPath = path.join(cwd, "opencode.json.bak");
      if (!fs.existsSync(bakPath)) return { restored: false, reason: "No backup found (opencode.json.bak)" };
      fs.copyFileSync(bakPath, cfgPath);
      fs.unlinkSync(bakPath);
      return { restored: true, message: "Restored opencode.json from backup" };
    }
    function cmdMcpProfile(cwd, args, raw) {
      const hasApply = args.includes("--apply");
      const hasRestore = args.includes("--restore");
      const hasDryRun = args.includes("--dry-run");
      if (hasRestore) {
        const result2 = restoreBackup(cwd);
        output(result2, raw);
        return;
      }
      let contextWindow = DEFAULT_CONTEXT_WINDOW;
      const windowIdx = args.indexOf("--window");
      if (windowIdx !== -1 && args[windowIdx + 1]) {
        const parsed = parseInt(args[windowIdx + 1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          contextWindow = parsed;
        }
      }
      const servers = discoverMcpServers(cwd);
      let totalTokens = 0;
      let knownCount = 0;
      let unknownCount = 0;
      const serverResults = servers.map((server) => {
        const cost = estimateTokenCost(server);
        totalTokens += cost.token_estimate;
        if (cost.source === "known-db") {
          knownCount++;
        } else {
          unknownCount++;
        }
        const contextPercent = (cost.token_estimate / contextWindow * 100).toFixed(1) + "%";
        return {
          name: server.name,
          source: server.source,
          transport: server.transport,
          command: server.command,
          tool_count: cost.tool_count,
          token_estimate: cost.token_estimate,
          token_source: cost.source,
          context_percent: contextPercent
        };
      });
      const recommendations = generateRecommendations(serverResults, cwd, contextWindow);
      const totalContextPercent = (totalTokens / contextWindow * 100).toFixed(1) + "%";
      const result = {
        servers: recommendations.servers,
        total_tokens: totalTokens,
        total_context_percent: totalContextPercent,
        context_window: contextWindow,
        server_count: servers.length,
        known_count: knownCount,
        unknown_count: unknownCount,
        total_potential_savings: recommendations.total_potential_savings,
        potential_savings_percent: recommendations.potential_savings_percent,
        recommendations_summary: recommendations.recommendations_summary
      };
      if (hasApply && !hasDryRun) {
        result.apply_result = applyRecommendations(cwd, recommendations.servers);
      } else if (hasApply && hasDryRun) {
        const wd = recommendations.servers.filter((s) => s.recommendation === "disable" && s.source === "opencode.json");
        result.dry_run = { would_disable: wd.map((s) => s.name), would_disable_count: wd.length, tokens_would_save: wd.reduce((sum, s) => sum + (s.token_estimate || 0), 0), skipped_mcp_json: recommendations.servers.filter((s) => s.recommendation === "disable" && s.source === ".mcp.json").map((s) => s.name) };
      }
      output(result, raw);
    }
    module2.exports = {
      cmdMcpProfile,
      discoverMcpServers,
      estimateTokenCost,
      scoreServerRelevance,
      generateRecommendations,
      applyRecommendations,
      restoreBackup,
      MCP_KNOWN_SERVERS,
      RELEVANCE_INDICATORS,
      DEFAULT_CONTEXT_WINDOW,
      DEFAULT_TOKENS_PER_TOOL,
      DEFAULT_BASE_TOKENS,
      LOW_COST_THRESHOLD,
      // Internal helpers exported for testing
      extractFromMcpJson,
      extractFromOpencodeJson,
      safeReadJson,
      matchIndicatorKey,
      checkEnvHints
    };
  }
});

// src/router.js
var require_router = __commonJS({
  "src/router.js"(exports2, module2) {
    "use strict";
    var { COMMAND_HELP } = require_constants();
    var { error } = require_output();
    var _modules = {};
    function lazyState() {
      return _modules.state || (_modules.state = require_state());
    }
    function lazyRoadmap() {
      return _modules.roadmap || (_modules.roadmap = require_roadmap());
    }
    function lazyPhase() {
      return _modules.phase || (_modules.phase = require_phase());
    }
    function lazyVerify() {
      return _modules.verify || (_modules.verify = require_verify());
    }
    function lazyInit() {
      return _modules.init || (_modules.init = require_init());
    }
    function lazyFeatures() {
      return _modules.features || (_modules.features = require_features());
    }
    function lazyMisc() {
      return _modules.misc || (_modules.misc = require_misc());
    }
    function lazyMemory() {
      return _modules.memory || (_modules.memory = require_memory());
    }
    function lazyIntent() {
      return _modules.intent || (_modules.intent = require_intent());
    }
    function lazyEnv() {
      return _modules.env || (_modules.env = require_env());
    }
    function lazyMcp() {
      return _modules.mcp || (_modules.mcp = require_mcp());
    }
    function lazyWorktree() {
      return _modules.worktree || (_modules.worktree = require_worktree());
    }
    function lazyCodebase() {
      return _modules.codebase || (_modules.codebase = require_codebase());
    }
    async function main2() {
      const args = process.argv.slice(2);
      const rawIndex = args.indexOf("--raw");
      const raw = rawIndex !== -1;
      if (rawIndex !== -1) args.splice(rawIndex, 1);
      const fieldsIdx = args.indexOf("--fields");
      if (fieldsIdx !== -1) {
        const fieldsValue = args[fieldsIdx + 1];
        const requestedFields = fieldsValue ? fieldsValue.split(",") : null;
        args.splice(fieldsIdx, 2);
        if (requestedFields) {
          global._gsdRequestedFields = requestedFields;
        }
      }
      const verboseIdx = args.indexOf("--verbose");
      if (verboseIdx !== -1) {
        global._gsdCompactMode = false;
        args.splice(verboseIdx, 1);
      } else if (global._gsdCompactMode === void 0) {
        global._gsdCompactMode = true;
      }
      const compactIdx = args.indexOf("--compact");
      if (compactIdx !== -1) {
        global._gsdCompactMode = true;
        args.splice(compactIdx, 1);
      }
      const manifestIdx = args.indexOf("--manifest");
      if (manifestIdx !== -1) {
        global._gsdManifestMode = true;
        args.splice(manifestIdx, 1);
      }
      const command = args[0];
      const cwd = process.cwd();
      if (!command) {
        error("Usage: gsd-tools <command> [args] [--raw] [--verbose]\nCommands: assertions, codebase, codebase-impact, commit, config-ensure-section, config-get, config-migrate, config-set, context-budget, current-timestamp, env, extract-sections, find-phase, frontmatter, generate-slug, history-digest, init, intent, list-todos, mcp, mcp-profile, memory, milestone, phase, phase-plan-index, phases, progress, quick-summary, requirements, resolve-model, roadmap, rollback-info, scaffold, search-decisions, search-lessons, session-diff, state, state-snapshot, summary-extract, template, test-coverage, test-run, todo, token-budget, trace-requirement, validate, validate-config, validate-dependencies, velocity, verify, verify-path-exists, verify-summary, websearch, worktree");
      }
      if (args.includes("--help") || args.includes("-h")) {
        const subForHelp = args[1] && !args[1].startsWith("-") ? args[1] : "";
        const compoundKey = subForHelp ? `${command} ${subForHelp}` : "";
        const helpKey = compoundKey && COMMAND_HELP[compoundKey] ? compoundKey : command || "";
        const helpText = COMMAND_HELP[helpKey];
        if (helpText) {
          process.stderr.write(helpText + "\n");
        } else {
          process.stderr.write(`No help available for "${helpKey}". Available commands:
`);
          process.stderr.write(Object.keys(COMMAND_HELP).sort().join(", ") + "\n");
        }
        process.exit(0);
      }
      switch (command) {
        case "state": {
          const subcommand = args[1];
          if (subcommand === "update") {
            lazyState().cmdStateUpdate(cwd, args[2], args[3]);
          } else if (subcommand === "get") {
            lazyState().cmdStateGet(cwd, args[2], raw);
          } else if (subcommand === "patch") {
            const patches = {};
            for (let i = 2; i < args.length; i += 2) {
              const key = args[i].replace(/^--/, "");
              const value = args[i + 1];
              if (key && value !== void 0) {
                patches[key] = value;
              }
            }
            lazyState().cmdStatePatch(cwd, patches, raw);
          } else if (subcommand === "advance-plan") {
            lazyState().cmdStateAdvancePlan(cwd, raw);
          } else if (subcommand === "record-metric") {
            const phaseIdx = args.indexOf("--phase");
            const planIdx = args.indexOf("--plan");
            const durationIdx = args.indexOf("--duration");
            const tasksIdx = args.indexOf("--tasks");
            const filesIdx = args.indexOf("--files");
            lazyState().cmdStateRecordMetric(cwd, {
              phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
              plan: planIdx !== -1 ? args[planIdx + 1] : null,
              duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
              tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
              files: filesIdx !== -1 ? args[filesIdx + 1] : null
            }, raw);
          } else if (subcommand === "update-progress") {
            lazyState().cmdStateUpdateProgress(cwd, raw);
          } else if (subcommand === "add-decision") {
            const phaseIdx = args.indexOf("--phase");
            const summaryIdx = args.indexOf("--summary");
            const rationaleIdx = args.indexOf("--rationale");
            lazyState().cmdStateAddDecision(cwd, {
              phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
              summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
              rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : ""
            }, raw);
          } else if (subcommand === "add-blocker") {
            const textIdx = args.indexOf("--text");
            lazyState().cmdStateAddBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
          } else if (subcommand === "resolve-blocker") {
            const textIdx = args.indexOf("--text");
            lazyState().cmdStateResolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
          } else if (subcommand === "record-session") {
            const stoppedIdx = args.indexOf("--stopped-at");
            const resumeIdx = args.indexOf("--resume-file");
            lazyState().cmdStateRecordSession(cwd, {
              stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
              resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : "None"
            }, raw);
          } else if (subcommand === "validate") {
            const fix = args.includes("--fix");
            lazyState().cmdStateValidate(cwd, { fix }, raw);
          } else {
            lazyState().cmdStateLoad(cwd, raw);
          }
          break;
        }
        case "resolve-model": {
          lazyMisc().cmdResolveModel(cwd, args[1], raw);
          break;
        }
        case "find-phase": {
          lazyMisc().cmdFindPhase(cwd, args[1], raw);
          break;
        }
        case "commit": {
          const amend = args.includes("--amend");
          const message = args[1];
          const filesIndex = args.indexOf("--files");
          const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter((a) => !a.startsWith("--")) : [];
          lazyMisc().cmdCommit(cwd, message, files, raw, amend);
          break;
        }
        case "verify-summary": {
          const summaryPath = args[1];
          const countIndex = args.indexOf("--check-count");
          const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
          lazyMisc().cmdVerifySummary(cwd, summaryPath, checkCount, raw);
          break;
        }
        case "template": {
          const subcommand = args[1];
          if (subcommand === "select") {
            lazyMisc().cmdTemplateSelect(cwd, args[2], raw);
          } else if (subcommand === "fill") {
            const templateType = args[2];
            const phaseIdx = args.indexOf("--phase");
            const planIdx = args.indexOf("--plan");
            const nameIdx = args.indexOf("--name");
            const typeIdx = args.indexOf("--type");
            const waveIdx = args.indexOf("--wave");
            const fieldsIdx2 = args.indexOf("--fields");
            lazyMisc().cmdTemplateFill(cwd, templateType, {
              phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
              plan: planIdx !== -1 ? args[planIdx + 1] : null,
              name: nameIdx !== -1 ? args[nameIdx + 1] : null,
              type: typeIdx !== -1 ? args[typeIdx + 1] : "execute",
              wave: waveIdx !== -1 ? args[waveIdx + 1] : "1",
              fields: fieldsIdx2 !== -1 ? JSON.parse(args[fieldsIdx2 + 1]) : {}
            }, raw);
          } else {
            error("Unknown template subcommand. Available: select, fill");
          }
          break;
        }
        case "frontmatter": {
          const subcommand = args[1];
          const file = args[2];
          if (subcommand === "get") {
            const fieldIdx = args.indexOf("--field");
            lazyMisc().cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, raw);
          } else if (subcommand === "set") {
            const fieldIdx = args.indexOf("--field");
            const valueIdx = args.indexOf("--value");
            lazyMisc().cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, valueIdx !== -1 ? args[valueIdx + 1] : void 0, raw);
          } else if (subcommand === "merge") {
            const dataIdx = args.indexOf("--data");
            lazyMisc().cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? args[dataIdx + 1] : null, raw);
          } else if (subcommand === "validate") {
            const schemaIdx = args.indexOf("--schema");
            lazyMisc().cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? args[schemaIdx + 1] : null, raw);
          } else {
            error("Unknown frontmatter subcommand. Available: get, set, merge, validate");
          }
          break;
        }
        case "verify": {
          const subcommand = args[1];
          if (subcommand === "plan-structure") {
            lazyVerify().cmdVerifyPlanStructure(cwd, args[2], raw);
          } else if (subcommand === "phase-completeness") {
            lazyVerify().cmdVerifyPhaseCompleteness(cwd, args[2], raw);
          } else if (subcommand === "references") {
            lazyVerify().cmdVerifyReferences(cwd, args[2], raw);
          } else if (subcommand === "commits") {
            lazyVerify().cmdVerifyCommits(cwd, args.slice(2), raw);
          } else if (subcommand === "artifacts") {
            lazyVerify().cmdVerifyArtifacts(cwd, args[2], raw);
          } else if (subcommand === "key-links") {
            lazyVerify().cmdVerifyKeyLinks(cwd, args[2], raw);
          } else if (subcommand === "analyze-plan") {
            lazyVerify().cmdAnalyzePlan(cwd, args[2], raw);
          } else if (subcommand === "deliverables") {
            const planIdx = args.indexOf("--plan");
            lazyVerify().cmdVerifyDeliverables(cwd, {
              plan: planIdx !== -1 ? args[planIdx + 1] : null
            }, raw);
          } else if (subcommand === "requirements") {
            lazyVerify().cmdVerifyRequirements(cwd, {}, raw);
          } else if (subcommand === "regression") {
            const beforeIdx = args.indexOf("--before");
            const afterIdx = args.indexOf("--after");
            lazyVerify().cmdVerifyRegression(cwd, {
              before: beforeIdx !== -1 ? args[beforeIdx + 1] : null,
              after: afterIdx !== -1 ? args[afterIdx + 1] : null
            }, raw);
          } else if (subcommand === "plan-wave") {
            lazyVerify().cmdVerifyPlanWave(cwd, args[2], raw);
          } else if (subcommand === "plan-deps") {
            lazyVerify().cmdVerifyPlanDeps(cwd, args[2], raw);
          } else if (subcommand === "quality") {
            const planIdx = args.indexOf("--plan");
            const phaseIdx = args.indexOf("--phase");
            lazyVerify().cmdVerifyQuality(cwd, {
              plan: planIdx !== -1 ? args[planIdx + 1] : null,
              phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null
            }, raw);
          } else {
            error("Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links, analyze-plan, deliverables, requirements, regression, plan-wave, plan-deps, quality");
          }
          break;
        }
        case "generate-slug": {
          lazyMisc().cmdGenerateSlug(args[1], raw);
          break;
        }
        case "current-timestamp": {
          lazyMisc().cmdCurrentTimestamp(args[1] || "full", raw);
          break;
        }
        case "list-todos": {
          lazyMisc().cmdListTodos(cwd, args[1], raw);
          break;
        }
        case "verify-path-exists": {
          lazyMisc().cmdVerifyPathExists(cwd, args[1], raw);
          break;
        }
        case "config-ensure-section": {
          lazyMisc().cmdConfigEnsureSection(cwd, raw);
          break;
        }
        case "config-set": {
          lazyMisc().cmdConfigSet(cwd, args[1], args[2], raw);
          break;
        }
        case "config-get": {
          lazyMisc().cmdConfigGet(cwd, args[1], raw);
          break;
        }
        case "config-migrate": {
          lazyMisc().cmdConfigMigrate(cwd, raw);
          break;
        }
        case "history-digest": {
          const hdLimitIdx = args.indexOf("--limit");
          const hdPhasesIdx = args.indexOf("--phases");
          const hdSlim = args.includes("--slim");
          const hdOptions = {
            limit: hdLimitIdx !== -1 ? parseInt(args[hdLimitIdx + 1], 10) : null,
            phases: hdPhasesIdx !== -1 ? args[hdPhasesIdx + 1].split(",").map((s) => s.trim()) : null,
            compact: hdSlim
          };
          lazyMisc().cmdHistoryDigest(cwd, hdOptions, raw);
          break;
        }
        case "phases": {
          const subcommand = args[1];
          if (subcommand === "list") {
            const typeIndex = args.indexOf("--type");
            const phaseIndex = args.indexOf("--phase");
            const options = {
              type: typeIndex !== -1 ? args[typeIndex + 1] : null,
              phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
              includeArchived: args.includes("--include-archived")
            };
            lazyPhase().cmdPhasesList(cwd, options, raw);
          } else {
            error("Unknown phases subcommand. Available: list");
          }
          break;
        }
        case "roadmap": {
          const subcommand = args[1];
          if (subcommand === "get-phase") {
            lazyRoadmap().cmdRoadmapGetPhase(cwd, args[2], raw);
          } else if (subcommand === "analyze") {
            lazyRoadmap().cmdRoadmapAnalyze(cwd, raw);
          } else if (subcommand === "update-plan-progress") {
            lazyRoadmap().cmdRoadmapUpdatePlanProgress(cwd, args[2], raw);
          } else {
            error("Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress");
          }
          break;
        }
        case "requirements": {
          const subcommand = args[1];
          if (subcommand === "mark-complete") {
            lazyPhase().cmdRequirementsMarkComplete(cwd, args.slice(2), raw);
          } else {
            error("Unknown requirements subcommand. Available: mark-complete");
          }
          break;
        }
        case "phase": {
          const subcommand = args[1];
          if (subcommand === "next-decimal") {
            lazyPhase().cmdPhaseNextDecimal(cwd, args[2], raw);
          } else if (subcommand === "add") {
            lazyPhase().cmdPhaseAdd(cwd, args.slice(2).join(" "), raw);
          } else if (subcommand === "insert") {
            lazyPhase().cmdPhaseInsert(cwd, args[2], args.slice(3).join(" "), raw);
          } else if (subcommand === "remove") {
            const forceFlag = args.includes("--force");
            lazyPhase().cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw);
          } else if (subcommand === "complete") {
            lazyPhase().cmdPhaseComplete(cwd, args[2], raw);
          } else {
            error("Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete");
          }
          break;
        }
        case "milestone": {
          const subcommand = args[1];
          if (subcommand === "complete") {
            const nameIndex = args.indexOf("--name");
            const archivePhases = args.includes("--archive-phases");
            let milestoneName = null;
            if (nameIndex !== -1) {
              const nameArgs = [];
              for (let i = nameIndex + 1; i < args.length; i++) {
                if (args[i].startsWith("--")) break;
                nameArgs.push(args[i]);
              }
              milestoneName = nameArgs.join(" ") || null;
            }
            lazyPhase().cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw);
          } else {
            error("Unknown milestone subcommand. Available: complete");
          }
          break;
        }
        case "validate": {
          const subcommand = args[1];
          if (subcommand === "consistency") {
            lazyVerify().cmdValidateConsistency(cwd, raw);
          } else if (subcommand === "health") {
            const repairFlag = args.includes("--repair");
            lazyVerify().cmdValidateHealth(cwd, { repair: repairFlag }, raw);
          } else {
            error("Unknown validate subcommand. Available: consistency, health");
          }
          break;
        }
        case "progress": {
          const subcommand = args[1] || "json";
          lazyMisc().cmdProgressRender(cwd, subcommand, raw);
          break;
        }
        case "todo": {
          const subcommand = args[1];
          if (subcommand === "complete") {
            lazyMisc().cmdTodoComplete(cwd, args[2], raw);
          } else {
            error("Unknown todo subcommand. Available: complete");
          }
          break;
        }
        case "scaffold": {
          const scaffoldType = args[1];
          const phaseIndex = args.indexOf("--phase");
          const nameIndex = args.indexOf("--name");
          const scaffoldOptions = {
            phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
            name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(" ") : null
          };
          lazyMisc().cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
          break;
        }
        case "init": {
          const workflow = args[1];
          switch (workflow) {
            case "execute-phase":
              lazyInit().cmdInitExecutePhase(cwd, args[2], raw);
              break;
            case "plan-phase":
              lazyInit().cmdInitPlanPhase(cwd, args[2], raw);
              break;
            case "new-project":
              lazyInit().cmdInitNewProject(cwd, raw);
              break;
            case "new-milestone":
              lazyInit().cmdInitNewMilestone(cwd, raw);
              break;
            case "quick":
              lazyInit().cmdInitQuick(cwd, args.slice(2).join(" "), raw);
              break;
            case "resume":
              lazyInit().cmdInitResume(cwd, raw);
              break;
            case "verify-work":
              lazyInit().cmdInitVerifyWork(cwd, args[2], raw);
              break;
            case "phase-op":
              lazyInit().cmdInitPhaseOp(cwd, args[2], raw);
              break;
            case "todos":
              lazyInit().cmdInitTodos(cwd, args[2], raw);
              break;
            case "milestone-op":
              lazyInit().cmdInitMilestoneOp(cwd, raw);
              break;
            case "map-codebase":
              lazyInit().cmdInitMapCodebase(cwd, raw);
              break;
            case "progress":
              lazyInit().cmdInitProgress(cwd, raw);
              break;
            case "memory":
              lazyInit().cmdInitMemory(cwd, args.slice(2), raw);
              break;
            default:
              error(`Unknown init workflow: ${workflow}
Available: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, memory`);
          }
          break;
        }
        case "phase-plan-index": {
          lazyMisc().cmdPhasePlanIndex(cwd, args[1], raw);
          break;
        }
        case "state-snapshot": {
          lazyMisc().cmdStateSnapshot(cwd, raw);
          break;
        }
        case "summary-extract": {
          const summaryPath = args[1];
          const fieldsIndex = args.indexOf("--fields");
          const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(",") : null;
          lazyMisc().cmdSummaryExtract(cwd, summaryPath, fields, raw);
          break;
        }
        case "websearch": {
          const query = args[1];
          const limitIdx = args.indexOf("--limit");
          const freshnessIdx = args.indexOf("--freshness");
          await lazyMisc().cmdWebsearch(query, {
            limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
            freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null
          }, raw);
          break;
        }
        case "session-diff": {
          lazyFeatures().cmdSessionDiff(cwd, raw);
          break;
        }
        case "session-summary": {
          lazyFeatures().cmdSessionSummary(cwd, raw);
          break;
        }
        case "context-budget": {
          const subcommand = args[1];
          if (subcommand === "baseline") {
            lazyFeatures().cmdContextBudgetBaseline(cwd, raw);
          } else if (subcommand === "compare") {
            lazyFeatures().cmdContextBudgetCompare(cwd, args[2], raw);
          } else if (subcommand === "measure") {
            lazyFeatures().cmdContextBudgetMeasure(cwd, raw);
          } else {
            lazyFeatures().cmdContextBudget(cwd, subcommand, raw);
          }
          break;
        }
        case "test-run": {
          lazyFeatures().cmdTestRun(cwd, raw);
          break;
        }
        case "search-decisions": {
          lazyFeatures().cmdSearchDecisions(cwd, args.slice(1).join(" "), raw);
          break;
        }
        case "validate-dependencies": {
          lazyFeatures().cmdValidateDependencies(cwd, args[1], raw);
          break;
        }
        case "search-lessons": {
          lazyFeatures().cmdSearchLessons(cwd, args.slice(1).join(" "), raw);
          break;
        }
        case "codebase": {
          const sub = args[1];
          if (sub === "analyze") {
            lazyCodebase().cmdCodebaseAnalyze(cwd, args.slice(2), raw);
          } else if (sub === "status") {
            lazyCodebase().cmdCodebaseStatus(cwd, args.slice(2), raw);
          } else if (sub === "conventions") {
            lazyCodebase().cmdCodebaseConventions(cwd, args.slice(2), raw);
          } else if (sub === "rules") {
            lazyCodebase().cmdCodebaseRules(cwd, args.slice(2), raw);
          } else {
            error("Usage: codebase <analyze|status|conventions|rules>");
          }
          break;
        }
        case "codebase-impact": {
          lazyFeatures().cmdCodebaseImpact(cwd, args.slice(1), raw);
          break;
        }
        case "rollback-info": {
          lazyFeatures().cmdRollbackInfo(cwd, args[1], raw);
          break;
        }
        case "velocity": {
          lazyFeatures().cmdVelocity(cwd, raw);
          break;
        }
        case "trace-requirement": {
          lazyFeatures().cmdTraceRequirement(cwd, args[1], raw);
          break;
        }
        case "validate-config": {
          lazyFeatures().cmdValidateConfig(cwd, raw);
          break;
        }
        case "quick-summary": {
          lazyFeatures().cmdQuickTaskSummary(cwd, raw);
          break;
        }
        case "extract-sections": {
          lazyFeatures().cmdExtractSections(cwd, args.slice(1), raw);
          break;
        }
        case "test-coverage": {
          lazyFeatures().cmdTestCoverage(cwd, raw);
          break;
        }
        case "token-budget": {
          lazyFeatures().cmdTokenBudget(cwd, raw);
          break;
        }
        case "memory": {
          const subcommand = args[1];
          if (subcommand === "write") {
            const storeIdx = args.indexOf("--store");
            const entryIdx = args.indexOf("--entry");
            lazyMemory().cmdMemoryWrite(cwd, {
              store: storeIdx !== -1 ? args[storeIdx + 1] : null,
              entry: entryIdx !== -1 ? args[entryIdx + 1] : null
            }, raw);
          } else if (subcommand === "read") {
            const storeIdx = args.indexOf("--store");
            const limitIdx = args.indexOf("--limit");
            const queryIdx = args.indexOf("--query");
            const phaseIdx = args.indexOf("--phase");
            lazyMemory().cmdMemoryRead(cwd, {
              store: storeIdx !== -1 ? args[storeIdx + 1] : null,
              limit: limitIdx !== -1 ? args[limitIdx + 1] : null,
              query: queryIdx !== -1 ? args[queryIdx + 1] : null,
              phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null
            }, raw);
          } else if (subcommand === "list") {
            lazyMemory().cmdMemoryList(cwd, {}, raw);
          } else if (subcommand === "ensure-dir") {
            lazyMemory().cmdMemoryEnsureDir(cwd);
          } else if (subcommand === "compact") {
            const storeIdx = args.indexOf("--store");
            const thresholdIdx = args.indexOf("--threshold");
            const dryRun = args.includes("--dry-run");
            lazyMemory().cmdMemoryCompact(cwd, {
              store: storeIdx !== -1 ? args[storeIdx + 1] : null,
              threshold: thresholdIdx !== -1 ? args[thresholdIdx + 1] : null,
              dryRun
            }, raw);
          } else {
            error("Unknown memory subcommand. Available: write, read, list, ensure-dir, compact");
          }
          break;
        }
        case "intent": {
          const subcommand = args[1];
          if (subcommand === "create") {
            lazyIntent().cmdIntentCreate(cwd, args.slice(2), raw);
          } else if (subcommand === "show") {
            lazyIntent().cmdIntentShow(cwd, args.slice(2), raw);
          } else if (subcommand === "read") {
            lazyIntent().cmdIntentShow(cwd, args.slice(2), true);
          } else if (subcommand === "update") {
            lazyIntent().cmdIntentUpdate(cwd, args.slice(2), raw);
          } else if (subcommand === "validate") {
            lazyIntent().cmdIntentValidate(cwd, args.slice(2), raw);
          } else if (subcommand === "trace") {
            lazyIntent().cmdIntentTrace(cwd, args.slice(2), raw);
          } else if (subcommand === "drift") {
            lazyIntent().cmdIntentDrift(cwd, args.slice(2), raw);
          } else {
            error("Unknown intent subcommand. Available: create, show, read, update, validate, trace, drift");
          }
          break;
        }
        case "env": {
          const subcommand = args[1];
          if (subcommand === "scan") {
            lazyEnv().cmdEnvScan(cwd, args.slice(2), raw);
          } else if (subcommand === "status") {
            lazyEnv().cmdEnvStatus(cwd, args.slice(2), raw);
          } else {
            error("Unknown env subcommand. Available: scan, status");
          }
          break;
        }
        case "mcp-profile": {
          lazyMcp().cmdMcpProfile(cwd, args.slice(1), raw);
          break;
        }
        case "mcp": {
          const subcommand = args[1];
          if (subcommand === "profile") {
            lazyMcp().cmdMcpProfile(cwd, args.slice(2), raw);
          } else {
            error("Unknown mcp subcommand. Available: profile");
          }
          break;
        }
        case "assertions": {
          const subcommand = args[1];
          if (subcommand === "list") {
            const reqIdx = args.indexOf("--req");
            lazyVerify().cmdAssertionsList(cwd, {
              reqId: reqIdx !== -1 ? args[reqIdx + 1] : null
            }, raw);
          } else if (subcommand === "validate") {
            lazyVerify().cmdAssertionsValidate(cwd, raw);
          } else {
            error("Unknown assertions subcommand. Available: list, validate");
          }
          break;
        }
        case "worktree": {
          const subcommand = args[1];
          if (subcommand === "create") {
            lazyWorktree().cmdWorktreeCreate(cwd, args[2], raw);
          } else if (subcommand === "list") {
            lazyWorktree().cmdWorktreeList(cwd, raw);
          } else if (subcommand === "remove") {
            lazyWorktree().cmdWorktreeRemove(cwd, args[2], raw);
          } else if (subcommand === "cleanup") {
            lazyWorktree().cmdWorktreeCleanup(cwd, raw);
          } else if (subcommand === "merge") {
            lazyWorktree().cmdWorktreeMerge(cwd, args[2], raw);
          } else if (subcommand === "check-overlap") {
            lazyWorktree().cmdWorktreeCheckOverlap(cwd, args[2], raw);
          } else {
            error("Unknown worktree subcommand. Available: create, list, remove, cleanup, merge, check-overlap");
          }
          break;
        }
        default:
          error(`Unknown command: ${command}`);
      }
    }
    module2.exports = { main: main2 };
    module2.exports = { main: main2 };
  }
});

// src/index.js
var { main } = require_router();
main();
