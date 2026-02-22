# Architecture

**Analysis Date:** 2026-02-21

## Pattern Overview

**Overall:** CLI-Driven Orchestrator-Agent Architecture

The GSD plugin uses a single-file Node.js CLI (`bin/gsd-tools.cjs`) as a data/operations backend, with markdown workflow files (`workflows/*.md`) acting as orchestration prompts for AI agents. The CLI provides structured JSON data; the workflows define decision logic and agent coordination. This separation means the CLI never makes creative decisions — it parses, computes, and validates. The AI agents (driven by workflow prompts) handle reasoning, planning, and code generation.

**Key Characteristics:**
- Zero-dependency Node.js CLI as the data layer (6,495 lines, single file)
- Markdown-as-code: workflows are executable prompts, not documentation
- Agent orchestration via `Task()` subagent spawning described in workflow files
- JSON-over-stdout as the universal data exchange format between CLI and agents
- File-system-as-database: all state lives in `.planning/` directory as markdown files with YAML frontmatter

## Layers

**Layer 1 — CLI Tool (`bin/gsd-tools.cjs`)**
- Purpose: Data access, parsing, validation, git operations, state mutations
- Location: `bin/gsd-tools.cjs`
- Contains: ~85 command functions, ~15 internal helpers, YAML frontmatter parser, CLI router
- Depends on: Node.js stdlib only (`fs`, `path`, `child_process`), `.planning/` filesystem
- Used by: Workflow markdown files (via `node gsd-tools.cjs <command>` shell invocations)

**Layer 2 — Workflow Prompts (`workflows/*.md`)**
- Purpose: Orchestration logic — define multi-step processes, agent spawning, user interactions
- Location: `workflows/*.md` (32 files)
- Contains: XML-structured prompts with `<process>`, `<step>`, `<purpose>` tags
- Depends on: CLI tool for data, references for behavioral rules, templates for document structure
- Used by: Claude Code slash commands (in `~/.config/opencode/command/`)

**Layer 3 — Templates (`templates/*.md`, `templates/config.json`)**
- Purpose: Document structure definitions for all `.planning/` artifacts
- Location: `templates/*.md` (24+ files), `templates/codebase/` (7 files), `templates/research-project/` (5 files)
- Contains: File templates with placeholders, validation schemas, usage guidelines
- Depends on: Nothing (static definitions)
- Used by: Workflows (via `@` file references), CLI tool (`template fill` command)

**Layer 4 — References (`references/*.md`)**
- Purpose: Behavioral rules and patterns that agents must follow
- Location: `references/*.md` (13 files)
- Contains: UI branding rules, git integration patterns, checkpoint definitions, model profiles
- Depends on: Nothing (static definitions)
- Used by: Workflows (via `@` file references in `<required_reading>` blocks)

**Layer 5 — Deployment & Configuration**
- Purpose: Deploy plugin to live install, version tracking
- Location: `deploy.sh`, `VERSION`
- Contains: Copy script, version string
- Depends on: Source workspace
- Used by: Developer (manual deployment)

## Data Flow

**Primary Flow — Workflow Initialization:**

1. User invokes slash command (e.g., `/gsd-execute-phase 3`)
2. Command resolves to workflow file (`workflows/execute-phase.md`)
3. Workflow's first step calls CLI: `node gsd-tools.cjs init execute-phase 3`
4. CLI reads `.planning/config.json`, filesystem state, `ROADMAP.md`, `STATE.md`
5. CLI returns comprehensive JSON blob with all context needed for the workflow
6. Workflow parses JSON and branches based on conditions (`phase_found`, `plan_count`, etc.)
7. Workflow spawns subagents with `Task()` calls, passing file paths (not content)
8. Subagents read files themselves using their fresh context window

**State Mutation Flow:**

1. Agent completes work (code changes, document creation)
2. Workflow calls CLI to update state: `node gsd-tools.cjs state update-progress`
3. CLI modifies `.planning/STATE.md` in place (regex-based field updates)
4. Workflow calls CLI to commit: `node gsd-tools.cjs commit "message" --files path1 path2`
5. CLI handles git add + commit, respecting `commit_docs` config flag

**Large Output Handling:**

1. CLI generates JSON output
2. If output > 50KB, writes to tmpfile and returns `@file:/tmp/gsd-TIMESTAMP.json`
3. Caller detects `@file:` prefix and reads from disk instead of stdout

**State Management:**
- `STATE.md` is the project's "short-term memory" — current position, metrics, decisions, blockers
- `ROADMAP.md` is the project's "plan of record" — phases, goals, requirements mapping
- `config.json` controls behavior — mode (interactive/yolo), depth, parallelization, gates
- Phase directories (`phases/XX-name/`) contain all artifacts for a phase: PLAN.md, SUMMARY.md, RESEARCH.md, CONTEXT.md, VERIFICATION.md, UAT.md

## Key Abstractions

**Phase:**
- Purpose: Unit of project progress containing related work items
- Examples: `.planning/phases/01-foundation/`, `.planning/phases/02-auth/`
- Pattern: Numbered directories (01-99), optionally decimal (02.1) for insertions. Each contains PLAN.md files (execution prompts) and SUMMARY.md files (completion records). Phase is "complete" when all plans have summaries.

**Plan (PLAN.md):**
- Purpose: Executable prompt for a single unit of work within a phase
- Examples: `.planning/phases/01-foundation/01-01-PLAN.md`, `.planning/phases/01-foundation/01-02-PLAN.md`
- Pattern: YAML frontmatter (wave, depends_on, autonomous, files_modified) + XML task definitions + verification criteria + `must_haves` block for goal-backward verification

**Summary (SUMMARY.md):**
- Purpose: Completion record documenting what was built, decisions made, tech added
- Examples: `.planning/phases/01-foundation/01-01-SUMMARY.md`
- Pattern: YAML frontmatter (dependency graph, tech-stack, key-decisions, metrics) + markdown body (accomplishments, issues, decisions)

**Milestone:**
- Purpose: Collection of phases that together deliver a version
- Pattern: Tracked in `ROADMAP.md` with markers (🔵 active, ✅ complete). Completed milestones archived to `.planning/milestones/vX.Y-phases/`

**Init Command (Compound Command):**
- Purpose: Single CLI call that gathers all context a workflow needs
- Examples: `init execute-phase`, `init plan-phase`, `init new-project`, `init quick`
- Pattern: Returns JSON with resolved models, config flags, phase info, file paths, file existence checks. Minimizes round-trips between workflow and CLI.

**Model Profile:**
- Purpose: Maps agent types to Claude model tiers based on budget preference
- Implementation: `MODEL_PROFILES` lookup table in `bin/gsd-tools.cjs` (line 132)
- Pattern: Three profiles (`quality`, `balanced`, `budget`) map 11 agent types to `opus`/`sonnet`/`haiku`. Per-agent overrides via `config.json`.

## Entry Points

**CLI Entry (`bin/gsd-tools.cjs`):**
- Location: `bin/gsd-tools.cjs` line 6022 (`async function main()`)
- Triggers: `node gsd-tools.cjs <command> [args] [--raw]`
- Responsibilities: Parse argv, route to command function, output JSON to stdout

**CLI Router (`main()` switch statement):**
- Location: `bin/gsd-tools.cjs` lines 6035-6492
- Pattern: Top-level `switch(command)` dispatches to command groups. Commands with subcommands (e.g., `state`, `phase`, `roadmap`, `verify`, `frontmatter`, `init`) use nested `if/else` chains on `args[1]`.
- Top-level commands: `state`, `resolve-model`, `find-phase`, `commit`, `verify-summary`, `template`, `frontmatter`, `verify`, `generate-slug`, `current-timestamp`, `list-todos`, `verify-path-exists`, `config-ensure-section`, `config-set`, `config-get`, `history-digest`, `phases`, `roadmap`, `requirements`, `phase`, `milestone`, `validate`, `progress`, `todo`, `scaffold`, `init`, `phase-plan-index`, `state-snapshot`, `summary-extract`, `websearch`, `session-diff`, `context-budget`, `test-run`, `search-decisions`, `validate-dependencies`, `search-lessons`, `codebase-impact`, `rollback-info`, `velocity`, `trace-requirement`, `validate-config`, `quick-summary`

**Workflow Entry (workflow markdown files):**
- Location: `workflows/*.md` (32 files)
- Triggers: Claude Code slash commands (e.g., `/gsd-execute-phase`, `/gsd-plan-phase`)
- Responsibilities: Define the orchestration logic, agent spawning, user interaction, and state transitions

**Deploy Entry (`deploy.sh`):**
- Location: `deploy.sh`
- Triggers: Manual execution by developer
- Responsibilities: Back up current install, copy `bin/`, `workflows/`, `templates/`, `references/`, `VERSION` to `~/.config/opencode/get-shit-done/`

## Command System

The CLI has ~50 commands organized into functional categories:

**Atomic Commands (lines 488-2110):**
Simple operations that read/write one thing:
- `generate-slug`, `current-timestamp` — Pure utility functions
- `list-todos`, `verify-path-exists` — Filesystem queries
- `config-ensure-section`, `config-set`, `config-get` — Config CRUD
- `history-digest`, `summary-extract`, `state-snapshot`, `phase-plan-index` — Data extraction
- `phases list` — Phase directory listing with filtering

**State Progression Engine (lines 1191-2110):**
State mutation commands that modify `STATE.md`:
- `state load`, `state get`, `state update`, `state patch` — Basic CRUD
- `state advance-plan` — Increment plan counter
- `state record-metric` — Record execution metrics
- `state update-progress` — Recalculate progress bar
- `state add-decision`, `state add-blocker`, `state resolve-blocker` — Accumulated context
- `state record-session` — Session continuity tracking

**Frontmatter CRUD (lines 2175-2237):**
YAML frontmatter operations on any markdown file:
- `frontmatter get`, `set`, `merge`, `validate`

**Verification Suite (lines 2239-2530):**
Validation commands for quality gates:
- `verify plan-structure` — Check PLAN.md structure
- `verify phase-completeness` — All plans have summaries
- `verify references` — @-refs resolve to real files
- `verify commits` — Git hashes exist
- `verify artifacts`, `verify key-links` — must_haves validation

**Roadmap Analysis (lines 2531-2662):**
Parse and analyze ROADMAP.md:
- `roadmap get-phase` — Extract one phase section
- `roadmap analyze` — Full roadmap parse with disk status comparison

**Phase Operations (lines 2663-3132):**
Modify phase structure:
- `phase add` — Append new phase to roadmap + create directory
- `phase insert` — Insert decimal phase (e.g., 2.1 between 2 and 3)
- `phase remove` — Remove phase + renumber subsequent phases
- `phase complete` — Mark phase done, update state + roadmap

**Compound/Init Commands (lines 4059-5010):**
Single-call context gathering for workflows:
- `init execute-phase`, `init plan-phase`, `init new-project`, `init new-milestone`
- `init quick`, `init resume`, `init verify-work`, `init phase-op`
- `init todos`, `init milestone-op`, `init map-codebase`, `init progress`

Each returns a comprehensive JSON object with all context a workflow needs (models, config flags, phase info, file paths, existence checks).

**Extended Features (lines 5012-6018):**
Additional capabilities added post-initial release:
- `session-diff` — Git commits since last activity
- `context-budget` — Token estimation for context window
- `test-run` — Parse test output (ExUnit/Go/pytest)
- `search-decisions`, `search-lessons` — Full-text search across archives
- `validate-dependencies` — Phase dependency graph validation
- `codebase-impact` — Module dependency analysis
- `rollback-info` — Rollback plan with git revert commands
- `velocity` — Plans/day + completion forecast
- `trace-requirement` — Requirement-to-file traceability
- `validate-config` — Config schema validation
- `quick-summary` — Milestone progress summary

## Error Handling

**Strategy:** Fail-fast with stderr error messages

**Patterns:**
- `error(message)` helper writes to stderr and exits with code 1
- `safeReadFile(path)` returns `null` on any read failure (never throws)
- `execGit(cwd, args)` catches errors and returns `{ exitCode, stdout, stderr }`
- Command functions check preconditions early and call `error()` for invalid input
- Output function `output(result, raw)` always exits with code 0 after successful JSON output

## Cross-Cutting Concerns

**Logging:** No logging framework. CLI outputs JSON to stdout only. Errors go to stderr. Workflows display user-facing messages using UI brand patterns from `references/ui-brand.md`.

**Validation:** Multi-layered — `verify` command suite for structural validation, `validate` commands for consistency checks, `frontmatter validate` for schema conformance, `validate-config` for config.json schema.

**Configuration:** Hierarchical — defaults hardcoded in `loadConfig()`, overridden by `.planning/config.json` with support for flat and nested key formats, per-agent model overrides.

**Git Integration:** All git operations go through `execGit()` helper and `cmdCommit()`. Respects `commit_docs` config flag. Auto-detects gitignored `.planning/` directories. Branching strategies: `none`, `phase`, `milestone`.

---

*Architecture analysis: 2026-02-21*
