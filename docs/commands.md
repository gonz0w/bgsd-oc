# bGSD Command Reference

Complete reference for all bGSD slash commands and CLI operations.

---

## Slash Commands (41)

### Project Initialization

#### `/gsd-new-project`

Initialize a new project through the full lifecycle: questioning, research, requirements, roadmap.

| Option | Description |
|--------|-------------|
| `--auto` | Automatic mode. Expects idea document via `@` reference. Collects settings in 2 rounds instead of interactive questioning. |

**Workflow:** `workflows/new-project.md`
**Agents:** gsd-project-researcher (x4), gsd-research-synthesizer, gsd-roadmapper
**Creates:** `PROJECT.md`, `INTENT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, optionally `research/`

---

#### `/gsd-map-codebase`

Analyze an existing codebase using 4 parallel mapper agents. Produces structured analysis documents.

| Argument | Description |
|----------|-------------|
| `[area]` | Optional focus area (e.g., "api", "auth") to narrow analysis |

**Workflow:** `workflows/map-codebase.md`
**Agents:** gsd-codebase-mapper (x4, parallel)
**Creates:** 7 documents in `.planning/codebase/`: `STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`

---

### Phase Planning

#### `/gsd-discuss-phase`

Gather implementation decisions through adaptive questioning. Produces CONTEXT.md for downstream planning agents.

| Argument | Description |
|----------|-------------|
| `<phase>` | Phase number to discuss |
| `--auto` | Auto-advance to `/gsd-plan-phase` after |

**Workflow:** `workflows/discuss-phase.md`
**Creates:** `{phase_dir}/{padded_phase}-CONTEXT.md`

---

#### `/gsd-list-phase-assumptions`

Surface the AI's assumptions about a phase approach before planning. Conversational only — no files created.

| Argument | Description |
|----------|-------------|
| `[phase]` | Phase number to analyze |

**Workflow:** `workflows/list-phase-assumptions.md`

---

#### `/gsd-research-phase`

Standalone deep research for a specific phase. Spawns a dedicated researcher agent.

| Argument | Description |
|----------|-------------|
| `[phase]` | Phase number to research |

**Workflow:** `workflows/research-phase.md`
**Agents:** gsd-phase-researcher
**Creates:** `{phase_dir}/{phase}-RESEARCH.md`

---

#### `/gsd-plan-phase`

Create executable plans (PLAN.md files) for a phase. Includes optional research, plan quality review with revision loop.

| Argument | Description |
|----------|-------------|
| `[phase]` | Phase number to plan |
| `--auto` | Auto-advance to execution after planning |
| `--research` | Force research phase (overrides config) |
| `--skip-research` | Skip research (even if config enables it) |
| `--gaps` | Only create plans for UAT gaps |
| `--skip-verify` | Skip plan-checker quality review |

**Workflow:** `workflows/plan-phase.md`
**Agents:** gsd-phase-researcher (optional), gsd-planner, gsd-plan-checker (optional)
**Creates:** `{phase_dir}/{phase}-{plan}-PLAN.md` files

---

### Execution

#### `/gsd-execute-phase`

Execute all plans in a phase with wave-based parallel execution.

| Argument | Description |
|----------|-------------|
| `<phase>` | Phase number to execute |
| `--gaps-only` | Only execute gap closure plans (from UAT) |

**Workflow:** `workflows/execute-phase.md`
**Agents:** gsd-executor (per plan), gsd-verifier
**Creates:** `SUMMARY.md` per plan, `VERIFICATION.md` for phase

---

#### `/gsd-quick`

Execute small ad-hoc tasks with bGSD tracking (atomic commits, state updates) but minimal ceremony.

| Argument | Description |
|----------|-------------|
| `[description]` | What to do (in natural language) |
| `--full` | Add plan-checking and verification |

**Workflow:** `workflows/quick.md`
**Agents:** gsd-planner, gsd-executor, optionally gsd-plan-checker and gsd-verifier
**Creates:** `.planning/quick/{num}-{slug}/PLAN.md`, `SUMMARY.md`

---

### Roadmap Management

#### `/gsd-add-phase`

Add a new phase to the end of the current milestone.

| Argument | Description |
|----------|-------------|
| `<description>` | Phase description |

**Workflow:** `workflows/add-phase.md`

---

#### `/gsd-insert-phase`

Insert urgent work as a decimal phase (e.g., 3.1 between phases 3 and 4).

| Argument | Description |
|----------|-------------|
| `<after>` | Phase number to insert after |
| `<description>` | Phase description |

**Workflow:** `workflows/insert-phase.md`

---

#### `/gsd-remove-phase`

Remove an unstarted future phase and renumber subsequent phases.

| Argument | Description |
|----------|-------------|
| `<phase>` | Phase number to remove |

**Workflow:** `workflows/remove-phase.md`

---

### Milestone Management

#### `/gsd-new-milestone`

Start a new milestone cycle with questioning, research, requirements, and roadmap.

| Argument | Description |
|----------|-------------|
| `[name]` | Milestone name (e.g., "v1.1 Notifications") |

**Workflow:** `workflows/new-milestone.md`
**Agents:** gsd-project-researcher (x4), gsd-research-synthesizer, gsd-roadmapper

---

#### `/gsd-complete-milestone`

Archive completed milestone, create historical record, tag release.

| Argument | Description |
|----------|-------------|
| `<version>` | Milestone version to complete |

**Workflow:** `workflows/complete-milestone.md`

---

#### `/gsd-audit-milestone`

Audit milestone against original intent. Cross-phase integration check.

| Argument | Description |
|----------|-------------|
| `[version]` | Milestone version to audit |

**Workflow:** `workflows/audit-milestone.md`
**Agents:** gsd-integration-checker
**Creates:** `MILESTONE-AUDIT.md`

---

#### `/gsd-plan-milestone-gaps`

Create phases to close all gaps identified by milestone audit.

**Workflow:** `workflows/plan-milestone-gaps.md`
**Reads:** `MILESTONE-AUDIT.md`

---

### Progress & Session

#### `/gsd-progress`

Check project progress and get intelligently routed to the next action.

**Workflow:** `workflows/progress.md`

---

#### `/gsd-resume-work`

Restore context from a previous session.

**Workflow:** `workflows/resume-project.md`

---

#### `/gsd-pause-work`

Create a handoff file for session continuity.

**Workflow:** `workflows/pause-work.md`
**Creates:** `.continue-here.md`

---

### Verification

#### `/gsd-verify-work`

Conversational UAT testing with gap tracking and fix plan generation.

| Argument | Description |
|----------|-------------|
| `[phase]` | Phase number to verify |

**Workflow:** `workflows/verify-work.md`
**Creates:** `{phase}-UAT.md`

---

### Debugging

#### `/gsd-debug`

Systematic debugging with persistent state across context resets.

| Argument | Description |
|----------|-------------|
| `[description]` | Issue description. No args = resume active session. |

**Workflow:** `workflows/diagnose-issues.md`
**Agents:** gsd-debugger
**Creates:** `.planning/debug/{slug}.md`

---

### Todo Management

#### `/gsd-add-todo`

Capture an idea or task from current conversation context.

| Argument | Description |
|----------|-------------|
| `[description]` | Optional description (inferred from context if omitted) |

**Workflow:** `workflows/add-todo.md`
**Creates:** `.planning/todos/pending/{date}-{slug}.md`

---

#### `/gsd-check-todos`

List pending todos, select one to work on.

| Argument | Description |
|----------|-------------|
| `[area]` | Optional filter (e.g., "auth", "api", "ui") |

**Workflow:** `workflows/check-todos.md`

---

### Configuration

#### `/gsd-settings`

Interactive configuration of workflow agents and model profile.

**Workflow:** `workflows/settings.md`
**Updates:** `.planning/config.json`, optionally `~/.gsd/defaults.json`

---

#### `/gsd-set-profile`

Quick switch model profile for bGSD agents.

| Argument | Description |
|----------|-------------|
| `<profile>` | `quality`, `balanced`, or `budget` |

**Workflow:** `workflows/set-profile.md`

---

### Utility

#### `/gsd-health`

Check `.planning/` directory integrity. Optionally repair issues.

| Argument | Description |
|----------|-------------|
| `--repair` | Auto-fix repairable issues |

**Workflow:** `workflows/health.md`

---

#### `/gsd-cleanup`

Archive phase directories from completed milestones.

**Workflow:** `workflows/cleanup.md`

---

#### `/gsd-update`

Check for and install bGSD updates via npm.

**Workflow:** `workflows/update.md`

---

#### `/gsd-help`

Display the complete bGSD command reference.

**Workflow:** `workflows/help.md`

---

#### `/gsd-reapply-patches`

Reapply local modifications after a GSD update. Intelligently merges user's previously saved local changes back into newly installed files, handling conflicts when both upstream and local versions changed.

**Workflow:** Inline (no external workflow)

---

### Analytics & Utility

#### `/gsd-velocity`

Show execution velocity metrics: plans completed per day, average duration, and completion forecast for the current milestone.

**Workflow:** `workflows/cmd-velocity.md`

---

#### `/gsd-codebase-impact`

Show module dependencies and blast radius for given files. Analyzes which modules import/reference the specified files.

| Argument | Description |
|----------|-------------|
| `<files...>` | One or more file paths to analyze |

**Workflow:** `workflows/cmd-codebase-impact.md`

---

#### `/gsd-context-budget`

Estimate token usage for a plan file and warn if over context budget. Warns when plan content exceeds the configured context window threshold (default: 50% of 200K tokens).

| Argument | Description |
|----------|-------------|
| `[file-path]` | Optional path to a plan file (defaults to current phase) |

**Workflow:** `workflows/cmd-context-budget.md`

---

#### `/gsd-rollback-info`

Show commits and revert command for a specific plan. Useful when a plan's changes need to be undone.

| Argument | Description |
|----------|-------------|
| `<plan-id>` | Plan identifier (e.g., "45-01") |

**Workflow:** `workflows/cmd-rollback-info.md`

---

#### `/gsd-search-decisions`

Search STATE.md and archived states for past decisions matching a query. Useful for understanding past architectural and implementation choices.

| Argument | Description |
|----------|-------------|
| `<query>` | Search query text |

**Workflow:** `workflows/cmd-search-decisions.md`

---

#### `/gsd-search-lessons`

Search completed phase lessons for relevant patterns and insights. Surfaces lessons learned from past execution to inform current planning.

| Argument | Description |
|----------|-------------|
| `<query>` | Search query text |

**Workflow:** `workflows/cmd-search-lessons.md`

---

#### `/gsd-session-diff`

Show git commits since last planning session activity. Useful for understanding what changed since the last session.

**Workflow:** `workflows/cmd-session-diff.md`

---

#### `/gsd-test-run`

Parse test output and apply pass/fail gating. Detects test framework (ExUnit, Go test, pytest, Node.js test runner) and reports structured results.

**Workflow:** `workflows/cmd-test-run.md`

---

#### `/gsd-trace-requirement`

Trace a requirement from REQUIREMENTS.md through plans to actual files on disk. Shows the full implementation chain for a specific requirement ID.

| Argument | Description |
|----------|-------------|
| `<req-id>` | Requirement identifier (e.g., "REQ-01") |

**Workflow:** `workflows/cmd-trace-requirement.md`

---

#### `/gsd-validate-config`

Validate `.planning/config.json` against the schema. Checks for missing fields, invalid values, and typos in field names.

**Workflow:** `workflows/cmd-validate-config.md`

---

#### `/gsd-validate-deps`

Validate the dependency graph for a phase. Checks that all plan dependencies are satisfiable and flags circular or missing dependencies.

| Argument | Description |
|----------|-------------|
| `[phase]` | Optional phase number (defaults to current phase) |

**Workflow:** `workflows/cmd-validate-deps.md`

---

### Community

#### `/gsd-join-discord`

Display the Discord invite link for the GSD community server. Connect with other GSD users, get help, share what you're building.

**Workflow:** Inline (no external workflow)

---

## CLI Tool (`gsd-tools.cjs`)

Run directly:
```bash
node bin/gsd-tools.cjs <command> [args] --raw
```

### Global Flags

| Flag | Effect |
|------|--------|
| `--raw` | JSON output to stdout (default for programmatic use) |
| `--verbose` | Full output (disables compact mode) |
| `--compact` | Minimal output (default for init commands) |
| `--manifest` | Include context manifest with file loading guidance |
| `--fields f1,f2` | Filter JSON to specified dot-notation fields |
| `--help` / `-h` | Print help text |

When JSON output exceeds 50KB, it's written to a temp file and stdout emits `@file:/tmp/gsd-TIMESTAMP.json`.

---

### Command Groups

#### `state` — Project State Management

```bash
gsd-tools state                                    # Load all state
gsd-tools state get <field>                        # Get specific field
gsd-tools state update <field> <value>             # Update field
gsd-tools state patch --key1 val1 --key2 val2      # Update multiple fields
gsd-tools state advance-plan                       # Increment plan counter
gsd-tools state record-metric --phase P --plan N --duration D [--tasks T] [--files F]
gsd-tools state update-progress                    # Recalculate from disk
gsd-tools state add-decision --phase P --summary S [--rationale R]
gsd-tools state add-blocker --text "..."
gsd-tools state resolve-blocker --text "..."
gsd-tools state record-session --stopped-at "..." [--resume-file path]
gsd-tools state validate [--fix]                   # Drift detection + repair
```

#### `init` — Workflow Context Injection

```bash
gsd-tools init execute-phase <phase>
gsd-tools init plan-phase <phase>
gsd-tools init new-project
gsd-tools init new-milestone
gsd-tools init quick <description>
gsd-tools init resume
gsd-tools init verify-work <phase>
gsd-tools init phase-op <phase>
gsd-tools init todos [area]
gsd-tools init milestone-op
gsd-tools init map-codebase
gsd-tools init progress
gsd-tools init memory [--workflow name] [--phase N] [--compact]
```

#### `intent` — Project Intent

```bash
gsd-tools intent create [--force] [--objective "..."] [--users "..."] [--outcomes "..."] [--criteria "..."]
gsd-tools intent show [section] [--full]
gsd-tools intent read [section]
gsd-tools intent update [--add] [--remove] [--set-priority] [--value]
gsd-tools intent validate
gsd-tools intent trace [--gaps]
gsd-tools intent drift
```

#### `verify` — Quality Gates

```bash
gsd-tools verify plan-structure <file>
gsd-tools verify phase-completeness <phase>
gsd-tools verify references <file>
gsd-tools verify commits <hash1> [hash2] ...
gsd-tools verify artifacts <plan-file>
gsd-tools verify key-links <plan-file>
gsd-tools verify analyze-plan <plan-file>
gsd-tools verify deliverables [--plan file]
gsd-tools verify requirements
gsd-tools verify regression [--before f] [--after f]
gsd-tools verify plan-wave <phase-dir>
gsd-tools verify plan-deps <phase-dir>
gsd-tools verify quality [--plan f] [--phase N]
```

#### `validate` — Integrity Checks

```bash
gsd-tools validate consistency
gsd-tools validate health [--repair]
```

#### `roadmap` — Roadmap Operations

```bash
gsd-tools roadmap get-phase <phase>
gsd-tools roadmap analyze
gsd-tools roadmap update-plan-progress <N>
```

#### `phase` — Phase Lifecycle

```bash
gsd-tools phase next-decimal <phase>
gsd-tools phase add <description>
gsd-tools phase insert <after> <description>
gsd-tools phase remove <phase> [--force]
gsd-tools phase complete <phase>
```

#### `milestone` — Milestone Lifecycle

```bash
gsd-tools milestone complete <version> [--name "..."] [--archive-phases]
```

#### `memory` — Persistent Stores

```bash
gsd-tools memory write --store <name> --entry '{json}'
gsd-tools memory read --store <name> [--limit N] [--query "text"] [--phase N]
gsd-tools memory list
gsd-tools memory ensure-dir
gsd-tools memory compact [--store name] [--threshold N] [--dry-run]
```

Stores: `decisions`, `lessons`, `trajectories` (sacred — never pruned), `bookmarks` (trimmed to 20), `todos`.

#### `codebase` — Codebase Intelligence

```bash
gsd-tools codebase analyze [--full]
gsd-tools codebase status
gsd-tools codebase conventions [--threshold N] [--all]
gsd-tools codebase rules [--threshold N] [--max N]
gsd-tools codebase deps [--cycles]
gsd-tools codebase impact <file1> [file2] ...
gsd-tools codebase context --files <f1> [f2] ... [--plan path]
gsd-tools codebase lifecycle
gsd-tools codebase ast <file>
gsd-tools codebase complexity [file]
gsd-tools codebase exports <file>
gsd-tools codebase repo-map [--budget N]
```

#### `env` — Environment Detection

```bash
gsd-tools env scan [--force] [--verbose]
gsd-tools env status
```

#### `frontmatter` — YAML Frontmatter

```bash
gsd-tools frontmatter get <file> [--field key]
gsd-tools frontmatter set <file> --field k --value v
gsd-tools frontmatter merge <file> --data '{json}'
gsd-tools frontmatter validate <file> --schema type
```

#### `template` — Document Templates

```bash
gsd-tools template select <type>
gsd-tools template fill <type> --phase N --plan M --name "..." [--type execute|tdd] [--wave N]
```

#### `scaffold` — Create Documents

```bash
gsd-tools scaffold context --phase N
gsd-tools scaffold uat --phase N
gsd-tools scaffold verification --phase N
gsd-tools scaffold phase-dir --phase N --name "..."
```

#### `assertions` — Acceptance Criteria

```bash
gsd-tools assertions list [--req SREQ-01]
gsd-tools assertions validate
```

#### `worktree` — Git Worktree Isolation

```bash
gsd-tools worktree create <plan-id>
gsd-tools worktree list
gsd-tools worktree remove <plan-id>
gsd-tools worktree cleanup
gsd-tools worktree merge <plan-id>
gsd-tools worktree check-overlap <phase-number>
```

#### `context-budget` — Token Management

```bash
gsd-tools context-budget <file-path>
gsd-tools context-budget baseline
gsd-tools context-budget compare [baseline-path]
gsd-tools context-budget measure
```

#### `mcp` — MCP Server Management

```bash
gsd-tools mcp profile [--window N] [--apply] [--dry-run] [--restore]
```

#### `trajectory` — Trajectory Engineering

Structured exploration system for checkpointing, comparing, and choosing between implementation approaches.

##### `trajectory checkpoint <name>`

Create a named checkpoint with automatically captured quality metrics. Creates a git branch as a permanent reference and writes a journal entry.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `<name>` | positional | required | Checkpoint name (alphanumeric, hyphens, underscores) |
| `--scope <scope>` | string | `"phase"` | Scope level (e.g., `phase`, `task`, `milestone`) |
| `--description <text>` | string | none | Human-readable context for this checkpoint |

**Behavior:**
1. Validates no uncommitted changes outside `.planning/`
2. Counts existing checkpoints with same scope+name, auto-increments attempt number
3. Creates git branch at `trajectory/<scope>/<name>/attempt-N` (ref only, no checkout)
4. Collects metrics (fault-tolerant — partial metrics if any collector fails):
   - **Tests:** runs test suite, captures total/pass/fail
   - **LOC delta:** insertions, deletions, files changed from last 5 commits
   - **Complexity:** cyclomatic complexity of recently changed `.js` files
5. Generates unique ID (`tj-XXXXXX`) with collision detection
6. Writes entry to `.planning/memory/trajectory.json`

**Examples:**
```bash
# Basic checkpoint
gsd-tools trajectory checkpoint auth-flow

# With scope and description
gsd-tools trajectory checkpoint auth-flow --scope task --description "JWT with refresh tokens"

# Repeated calls auto-increment: attempt-1, attempt-2, etc.
gsd-tools trajectory checkpoint auth-flow
gsd-tools trajectory checkpoint auth-flow
```

**Output:**
```json
{
  "created": true,
  "checkpoint": "auth-flow",
  "branch": "trajectory/phase/auth-flow/attempt-1",
  "attempt": 1,
  "git_ref": "abc1234...",
  "metrics": {
    "tests": { "total": 716, "pass": 716, "fail": 0 },
    "loc_delta": { "insertions": 50, "deletions": 12, "files_changed": 4 },
    "complexity": { "total": 25, "files_analyzed": 3 }
  }
}
```

##### `trajectory list`

List all checkpoints with metrics. Dual-mode output: formatted table in terminal, JSON when piped.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scope <scope>` | string | all | Filter by scope |
| `--name <name>` | string | all | Filter by checkpoint name |
| `--limit <N>` | integer | all | Limit number of results |

**Examples:**
```bash
# List all checkpoints
gsd-tools trajectory list

# Filter by name
gsd-tools trajectory list --name auth-flow

# Filter by scope with limit
gsd-tools trajectory list --scope task --limit 5
```

**Terminal output** shows a color-coded table:
```
Name        Scope  Attempt  Ref      Tests     LOC         Age
auth-flow   phase  2        def4567  716/716   +50 -12     2 hours ago
auth-flow   phase  1        abc1234  710/716   +30 -5      5 hours ago
```

---

#### `git` — Structured Git Intelligence

Structured git operations with JSON output. Includes selective code rewind and trajectory branch creation.

##### Standard git operations

```bash
gsd-tools git log [--count N] [--since D] [--until D] [--author A] [--path P]
gsd-tools git diff-summary [--from ref] [--to ref] [--path P]
gsd-tools git blame <file>
gsd-tools git branch-info
```

##### `git rewind --ref <ref>` — Selective Code Rewind

Roll back source code to any git ref while preserving planning state and root configuration files.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--ref <ref>` | string | yes | Git ref to rewind to (SHA, branch, `HEAD~N`) |
| `--dry-run` | boolean | no | Preview changes without modifying files |
| `--confirm` | boolean | no | Required to execute rewind |

**Protected paths** (never rewound):
- `.planning/` (entire directory)
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.*.json`
- `.gitignore`, `.env`, `.env.*`

**Three-gate safety:**
1. `--dry-run` — returns change list, no modifications
2. No flags — returns `needs_confirm: true` with change preview
3. `--confirm` — executes rewind with auto-stash if working tree is dirty

**Examples:**
```bash
# Preview rewind to a trajectory checkpoint
gsd-tools git rewind --ref trajectory/phase/auth-flow/attempt-1 --dry-run

# Execute rewind
gsd-tools git rewind --ref trajectory/phase/auth-flow/attempt-1 --confirm

# Rewind to any git ref
gsd-tools git rewind --ref HEAD~3 --confirm
```

##### `git trajectory-branch` — Exploration Branches

Create dedicated branches for longer trajectory explorations.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--phase <N>` | string | yes | Phase number |
| `--slug <name>` | string | yes | Short name slug |
| `--push` | boolean | no | Push to origin with upstream tracking |

**Examples:**
```bash
# Create local exploration branch
gsd-tools git trajectory-branch --phase 5 --slug auth-refactor

# Create and push
gsd-tools git trajectory-branch --phase 5 --slug auth-refactor --push
```

Creates branch at `gsd/trajectory/<phase>-<slug>`. Unlike `trajectory checkpoint`, this **does** check out the new branch.

#### `classify` — Task Complexity Classification

Scores task complexity (1-5) based on file count, cross-module reach, and test requirements. Recommends execution strategy.

```bash
gsd-tools classify plan <plan-path>
gsd-tools classify phase <phase-number>
```

#### `review` — Code Review Context

Two-stage code review (spec compliance + code quality) with severity classification (BLOCKER/WARNING/INFO).

```bash
gsd-tools review <phase> <plan>
```

#### `codebase` — Codebase Intelligence (complete)

```bash
gsd-tools codebase analyze [--full]
gsd-tools codebase status
gsd-tools codebase conventions [--threshold N] [--all]
gsd-tools codebase rules [--threshold N] [--max N]
gsd-tools codebase deps [--cycles]
gsd-tools codebase impact <file1> [file2] ...
gsd-tools codebase context --files <f1> [f2] ... [--plan path]
gsd-tools codebase lifecycle
gsd-tools codebase ast <file>
gsd-tools codebase complexity [file]
gsd-tools codebase exports <file>
gsd-tools codebase repo-map [--budget N]
```

#### `mcp-profile` — MCP Server Profiling (alias)

```bash
gsd-tools mcp-profile [--window N] [--apply] [--dry-run] [--restore]
```

#### Standalone Commands

```bash
gsd-tools commit <message> [--files f1 f2] [--amend]
gsd-tools resolve-model <agent-type>
gsd-tools find-phase <phase>
gsd-tools generate-slug <text>
gsd-tools current-timestamp [full|date|filename]
gsd-tools list-todos [area]
gsd-tools verify-path-exists <path>
gsd-tools verify-summary <path> [--check-count N]
gsd-tools config-ensure-section
gsd-tools config-set <key.path> <value>
gsd-tools config-get <key.path>
gsd-tools config-migrate
gsd-tools history-digest [--limit N] [--phases p1,p2] [--slim]
gsd-tools phase-plan-index <phase>
gsd-tools state-snapshot
gsd-tools summary-extract <path> [--fields f1,f2]
gsd-tools progress [json|table|bar]
gsd-tools session-diff
gsd-tools session-summary
gsd-tools test-run
gsd-tools search-decisions <query>
gsd-tools validate-dependencies <phase>
gsd-tools search-lessons <query>
gsd-tools codebase-impact <files...>
gsd-tools rollback-info <plan-id>
gsd-tools velocity
gsd-tools trace-requirement <req-id>
gsd-tools validate-config
gsd-tools quick-summary
gsd-tools extract-sections <file-path> [section1] [section2] ...
gsd-tools test-coverage
gsd-tools token-budget
gsd-tools websearch <query> [--limit N] [--freshness day|week|month]
gsd-tools todo complete <filename>
gsd-tools requirements mark-complete <ids>
gsd-tools phases list [--type type] [--phase N] [--include-archived]
```

---

## Related Documentation

- **[Getting Started](getting-started.md)** — First project walkthrough
- **[Expert Guide](expert-guide.md)** — Full control flow and advanced patterns
- **[Architecture](architecture.md)** — Internal design
- **[Agent System](agents.md)** — All 12 agents and their roles
- **[Workflows](workflows.md)** — All 45 workflows
- **[TDD Guide](tdd.md)** — TDD execution engine
- **[Configuration](configuration.md)** — Full configuration reference
