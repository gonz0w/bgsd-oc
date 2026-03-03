# bGSD (Get Stuff Done) — AI Project Planning for OpenCode

A structured project planning and execution system for [OpenCode](https://github.com/opencode-ai/opencode). bGSD turns AI-assisted coding from ad-hoc prompting into milestone-driven development with planning, execution, verification, and memory that persists across sessions.

**762 tests** | **Zero runtime dependencies** | **41 slash commands** | **100+ CLI operations** | **9 specialized AI agents** | **8 milestones shipped**

---

## The Problem

AI coding assistants are powerful but chaotic. Without structure, you get:
- Lost context between sessions
- No traceability from requirements to code
- No verification that what was built matches what was asked for
- No way to pause, resume, or hand off work
- No learning from past decisions
- Error cascading from unchecked edits

## The Solution

bGSD provides a complete project lifecycle inside your AI editor:

```
Idea → Requirements → Roadmap → Plans → Execution → Verification
  |                                                        |
  +-- Intent tracking, session memory, quality gates,  ----+
      TDD enforcement, review gates, progress metrics
```

Every step produces structured documents in `.planning/` that agents read for context. Decisions persist. Progress is tracked. Quality is measured.

---

## Quick Start

```bash
clone this repo, run deploy.sh (we are in dev mode, no npx plugin yet)
```

Then in OpenCode:

```
/bgsd-new-project
```

That's it. bGSD walks you through everything: what you want to build, how to break it down, and then executes it phase by phase.

See the **[Getting Started Guide](docs/getting-started.md)** for the full walkthrough, or the **[Expert Guide](docs/expert-guide.md)** if you want full control.

---

## How It Works

### Two Flows

**Easy Flow** — Let bGSD drive. Answer questions, approve plans, watch execution:

```
/bgsd-new-project           # Answer "what do you want to build?"
                            # bGSD creates requirements, roadmap, phases
/bgsd-plan-phase 1           # bGSD creates executable plans for phase 1
/bgsd-execute-phase 1        # bGSD builds it, commits per-task, verifies
/bgsd-progress               # See where things stand, get routed to next action
```

**Expert Flow** — Control every decision. Research domains, discuss assumptions, tune agents:

```
/bgsd-map-codebase                       # Analyze existing code first (brownfield)
/bgsd-new-project                        # Full questioning + parallel research
/bgsd-discuss-phase 1                    # Lock down implementation decisions
/bgsd-list-phase-assumptions 1           # See what the AI assumes before planning
/bgsd-research-phase 1                   # Deep domain research
/bgsd-plan-phase 1 --research            # Plan with integrated research
/bgsd-execute-phase 1                    # Execute with wave parallelism
/bgsd-verify-work 1                      # Manual UAT testing
/bgsd-audit-milestone                    # Cross-phase integration check
```

### What Gets Created

```
.planning/
  PROJECT.md              # What this project is, core decisions
  INTENT.md               # Why it exists, desired outcomes, success criteria
  REQUIREMENTS.md         # Checkable requirements with IDs (REQ-01, REQ-02...)
  ROADMAP.md              # Phases with goals, dependencies, progress
  STATE.md                # Living memory: position, metrics, decisions, blockers
  config.json             # Workflow settings, model profiles, gates

  phases/
    01-setup/
      01-01-PLAN.md       # Executable plan with tasks, dependencies, waves
      01-01-SUMMARY.md    # What was built, decisions made, files changed
      01-02-PLAN.md       # Next plan in this phase
      01-02-SUMMARY.md
      01-VERIFICATION.md  # Phase goal verification report

  research/               # Domain research (optional)
  codebase/               # Codebase analysis documents (brownfield)
  memory/                 # Persistent stores (decisions, bookmarks, lessons, trajectories)
  todos/                  # Captured ideas and tasks
  debug/                  # Debug session state files
  quick/                  # Quick task plans and summaries
```

---

## Core Commands

### Project Lifecycle

| Command | What It Does |
|---------|-------------|
| `/bgsd-new-project` | Initialize project: questioning, research, roadmap |
| `/bgsd-map-codebase` | Analyze existing codebase (brownfield projects) |
| `/bgsd-plan-phase [N]` | Create executable plans for a phase |
| `/bgsd-execute-phase N` | Execute all plans in a phase |
| `/bgsd-progress` | View progress, get routed to next action |
| `/bgsd-verify-work [N]` | Manual UAT testing with gap tracking |
| `/bgsd-new-milestone` | Start next milestone cycle |
| `/bgsd-complete-milestone` | Archive completed milestone |

### Session Management

| Command | What It Does |
|---------|-------------|
| `/bgsd-resume-work` | Restore context from previous session |
| `/bgsd-pause-work` | Create handoff file for later |
| `/bgsd-quick` | Execute small tasks with bGSD guarantees |
| `/bgsd-debug` | Systematic debugging with persistent state |

### Configuration

| Command | What It Does |
|---------|-------------|
| `/bgsd-settings` | Interactive workflow configuration |
| `/bgsd-set-profile [quality\|balanced\|budget]` | Switch AI model tier |
| `/bgsd-health` | Check `.planning/` integrity |
| `/bgsd-update` | Update bGSD to latest version |

### Analytics & Utility

| Command | What It Does |
|---------|-------------|
| `/bgsd-velocity` | Execution velocity metrics and completion forecast |
| `/bgsd-codebase-impact` | Module dependencies and blast radius analysis |
| `/bgsd-context-budget` | Token usage estimation for plan files |
| `/bgsd-rollback-info` | Commits and revert command for a plan |
| `/bgsd-search-decisions` | Search past decisions across archives |
| `/bgsd-search-lessons` | Search completed phase lessons |
| `/bgsd-session-diff` | Git commits since last session activity |
| `/bgsd-test-run` | Parse test output with pass/fail gating |
| `/bgsd-trace-requirement` | Trace requirement from spec to files on disk |
| `/bgsd-validate-config` | Schema validation for config.json |
| `/bgsd-validate-deps` | Phase dependency graph validation |

### Roadmap Management

| Command | What It Does |
|---------|-------------|
| `/bgsd-add-phase` | Add a new phase to the end of the roadmap |
| `/bgsd-insert-phase` | Insert urgent work as a decimal phase (e.g., 3.1) |
| `/bgsd-remove-phase` | Remove an unstarted future phase |

### Todo & Community

| Command | What It Does |
|---------|-------------|
| `/bgsd-add-todo` | Capture an idea or task from context |
| `/bgsd-check-todos` | List pending todos, select one to work on |
| `/bgsd-join-discord` | Join the GSD Discord community |
| `/bgsd-reapply-patches` | Reapply local modifications after update |

See the **[Full Command Reference](docs/commands.md)** for all 41 commands with options and examples.

---

## Key Features

### 9 Specialized AI Agents

bGSD doesn't use one generic agent for everything. Each task gets a purpose-built agent:

| Agent | Role |
|-------|------|
| **gsd-planner** | Creates executable plans with task breakdown, dependencies, waves |
| **gsd-executor** | Implements code, runs tests, commits per-task with attribution |
| **gsd-verifier** | Verifies phase goals were actually achieved (not just tasks completed) |
| **gsd-debugger** | Systematic debugging with hypothesis testing |
| **gsd-phase-researcher** | Researches implementation approaches for a phase |
| **gsd-project-researcher** | Parallel domain research (stack, features, architecture, pitfalls) |
| **gsd-roadmapper** | Creates phased roadmaps from requirements |
| **gsd-plan-checker** | Reviews plan quality with revision loop |
| **gsd-codebase-mapper** | Parallel codebase analysis (4 agents, 7 documents) |

Code review (two-stage: spec compliance + code quality with BLOCKER/WARNING/INFO severity) is embedded in the execution workflow.

See the **[Agent System Guide](docs/agents.md)** for full details on each agent.

### Intelligent Orchestration

bGSD automatically routes work to the right agent with the right model:

- **Task complexity scoring** (1-5) based on file count, cross-module reach, and test requirements
- **Automatic model selection** — complex tasks get opus, simple tasks get sonnet
- **Execution mode selection** — single/parallel/team mode from plan structure
- **Agent context manifests** — each agent declares what context it needs; system provides only that (40-60% token reduction)

### Model Profiles

Control cost vs quality with three profiles:

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|-------------|
| **quality** | Opus | Opus | Sonnet |
| **balanced** (default) | Opus | Sonnet | Sonnet |
| **budget** | Sonnet | Sonnet | Haiku |

```
/bgsd-set-profile budget    # Switch to budget mode
```

Override individual agents in `.planning/config.json`:
```json
{
  "model_profile": "balanced",
  "model_profiles": {
    "gsd-executor": "opus"
  }
}
```

### Wave-Based Parallel Execution

Plans within a phase are organized into dependency waves. Independent plans execute in parallel:

```
Wave 1: [Plan 01-01] [Plan 01-02]    # No dependencies, run parallel
Wave 2: [Plan 01-03]                  # Depends on 01-01, waits
Wave 3: [Plan 01-04] [Plan 01-05]    # Depend on 01-03, run parallel
```

### TDD Execution Engine

Plans can specify `type: tdd` for test-driven development with orchestrator-enforced gates:

```
RED   → Write failing test → Verify it fails → Commit (GSD-Phase: red)
GREEN → Write minimal code → Verify it passes → Commit (GSD-Phase: green)
REFACTOR → Clean up → Verify tests still pass → Commit (GSD-Phase: refactor)
```

Includes anti-pattern detection (pre-test code, YAGNI violations, over-mocking) and auto test-after-edit to catch errors immediately.

See the **[TDD Guide](docs/tdd.md)** for full details.

### Quality Gates

- **Two-stage code review** — Spec compliance (does it match the plan?) then code quality (does it follow conventions?)
- **Severity-classified findings** — BLOCKER (prevents completion), WARNING (advisory), INFO (informational)
- **Test gating** — Plans fail if tests fail
- **Requirement verification** — Track REQ-01 through plans to files on disk
- **Regression detection** — Compare test results before/after changes
- **Quality scoring** — A-F grades across 4 dimensions with trend tracking
- **Intent drift** — Numeric score (0-100) measuring alignment with project goals
- **Stuck/loop detection** — Identifies when executor is repeating failed patterns and triggers recovery

### AST Intelligence & Repo Map

- **Function signature extraction** — Acorn-based JS/TS parsing with regex fallback for other languages
- **Repository map** — ~1k token compact codebase summary replacing full file contents in agent context
- **Complexity metrics** — Per-function/module complexity scoring for task classification
- **Dependency graph** — Module relationships across 6 languages with Tarjan's SCC cycle detection

### Context Efficiency

- **Agent context manifests** — Each agent declares required context; system provides only that
- **Compact serialization** — 40-60% token reduction for agent consumption
- **Task-scoped injection** — Loads only task-relevant files using dependency graph and relevance scoring
- **Token budgets** — Bounded context injection prevents context rot

### Session Memory

Decisions, lessons, bookmarks, and trajectory journals persist across `/clear` and session restarts:

```
/bgsd-search-decisions "database choice"   # Find past decisions
/bgsd-search-lessons "auth"                # Find lessons learned
/bgsd-velocity                             # Plans/day, completion forecast
```

### Performance & Architecture (v8.0)

The latest milestone focused on runtime performance, system simplification, and release readiness:

- **SQLite Caching (L1/L2)** — Two-layer cache: in-memory Map (L1) for instant hits + SQLite via `node:sqlite` (L2) for persistent cache across CLI invocations. Graceful degradation to Map-only on Node <22.5. Zero dependencies — uses Node's built-in `DatabaseSync`.
- **Agent Consolidation (12→9)** — Merged gsd-integration-checker into gsd-verifier, gsd-research-synthesizer into gsd-roadmapper. Fewer agents, same capabilities, less coordination overhead.
- **Namespace Routing** — Commands organized into semantic namespaces (`init:`, `plan:`, `execute:`, `verify:`, `util:`) with colon syntax for clarity and discoverability.
- **Token Budgets** — Each agent has a declared token budget (60-80K). Context builder warns when injection approaches budget, preventing context rot.
- **RACI Matrix** — Every lifecycle step has exactly one responsible agent. No ambiguity in agent roles.
- **Profiler Instrumentation** — `GSD_PROFILE=1` emits timing data for file reads, git operations, markdown parsing, and AST analysis. `profiler compare` shows before/after timing deltas with color-coded regression highlighting.
- **Auto Changelog** — `gsd-tools milestone complete` auto-generates version docs from git log and STATE.md metrics.

### Trajectory Engineering (v7.1)

Structured exploration for comparing implementation approaches. Checkpoint your work, try different strategies, compare metrics, and choose a winner — all while preserving planning state.

```
# 1. Checkpoint before trying a new approach
node bin/gsd-tools.cjs trajectory checkpoint auth-strategy --description "JWT approach"

# 2. Try another approach, checkpoint again (auto-increments to attempt-2)
node bin/gsd-tools.cjs trajectory checkpoint auth-strategy --description "Session-based approach"

# 3. Compare metrics across all attempts
node bin/gsd-tools.cjs trajectory compare auth-strategy

# 4. Approach not working? Pivot back with a recorded reason
node bin/gsd-tools.cjs trajectory pivot auth-strategy --reason "Session approach too complex"

# 5. Choose the winner — merges code, archives alternatives, cleans up branches
node bin/gsd-tools.cjs trajectory choose auth-strategy --attempt 1 --reason "Better test coverage"
```

**Full trajectory lifecycle:**

| Command | What It Does |
|---------|-------------|
| `trajectory checkpoint <name>` | Save named snapshot with auto-collected metrics (tests, LOC, complexity) |
| `trajectory list` | List all checkpoints with metrics table |
| `trajectory compare <name>` | Side-by-side metrics comparison across all attempts (best/worst highlighted) |
| `trajectory pivot <name>` | Abandon current approach with recorded reason, rewind to checkpoint |
| `trajectory choose <name>` | Select winner, merge code, archive alternatives as git tags, clean up branches |

**What checkpoints capture automatically:**
- **Test metrics** — total/pass/fail from your test suite
- **LOC delta** — insertions, deletions, files changed (last 5 commits)
- **Cyclomatic complexity** — aggregate complexity of recently changed files
- **Git branch** — permanent ref at `trajectory/<scope>/<name>/attempt-N`

**Selective rewind** — roll back source code to any checkpoint while preserving `.planning/`, `package.json`, `.gitignore`, and other protected files:

```
# Preview what would change
node bin/gsd-tools.cjs git rewind --ref trajectory/phase/auth-strategy/attempt-1 --dry-run

# Execute the rewind
node bin/gsd-tools.cjs git rewind --ref trajectory/phase/auth-strategy/attempt-1 --confirm
```

**Trajectory journal** — a sacred memory store (never auto-pruned) that records checkpoints, pivots, comparisons, and choices throughout exploration. Query it with:

```
node bin/gsd-tools.cjs memory read --store trajectories --category checkpoint
```

### Git Integration

- Per-task atomic commits with agent attribution trailers
- Pre-commit safety checks (dirty tree, rebase, detached HEAD, shallow clones)
- Session diffs showing what happened since last activity
- Rollback info with exact revert commands
- TDD phase trailers for audit trail
- Optional branch-per-phase or branch-per-milestone strategies
- **Trajectory engineering** — checkpoint, pivot, compare, and choose between implementation approaches with auto-collected metrics
- **Trajectory branches** — dedicated exploration branches via `git trajectory-branch`
- **Selective rewind** — roll back code to any git ref while preserving planning state and root configs

### Codebase Intelligence

- **Convention extraction** — Naming patterns, file organization, framework macros with confidence scoring
- **Dependency graphs** — Import analysis across JS, TS, Python, Go, Elixir, Rust
- **Lifecycle awareness** — Execution order detection (seeds, migrations, config, boot)
- **Environment detection** — 26 manifest patterns, package managers, CI, test frameworks, Docker, MCP

---

## Configuration

bGSD is configured through `.planning/config.json`:

| Setting | Default | Options |
|---------|---------|---------|
| `model_profile` | `"balanced"` | `"quality"`, `"balanced"`, `"budget"` |
| `mode` | `"interactive"` | `"interactive"` (confirms), `"yolo"` (auto-approves) |
| `commit_docs` | `true` | Auto-commit planning documents |
| `research` | `true` | Enable research phase before planning |
| `plan_checker` | `true` | Enable plan quality review |
| `verifier` | `true` | Enable phase verification |
| `parallelization` | `true` | Parallel plan execution within waves |
| `test_gate` | `true` | Block on test failure |
| `branching_strategy` | `"none"` | `"none"`, `"phase"`, `"milestone"` |
| `brave_search` | `false` | Enable web search in research |

Interactive configuration: `/bgsd-settings`

See the **[Full Configuration Reference](docs/configuration.md)** for all options.

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | First project walkthrough, easy flow, minimal decisions |
| **[Expert Guide](docs/expert-guide.md)** | Full control flow, all options, advanced patterns |
| **[Command Reference](docs/commands.md)** | Every command with arguments, options, and examples |
| **[Architecture](docs/architecture.md)** | How bGSD works internally, agent system, tool design |
| **[Agent System](docs/agents.md)** | All 9 agents, their roles, spawning, model profiles |
| **[Workflows](docs/workflows.md)** | All 45 workflows, what they do, how they connect |
| **[Planning System](docs/planning-system.md)** | How .planning/ works, document structure, lifecycle |
| **[Configuration](docs/configuration.md)** | Full configuration reference with all options |
| **[TDD Guide](docs/tdd.md)** | TDD execution engine, RED-GREEN-REFACTOR, anti-patterns |
| **[Design Decisions](docs/decisions.md)** | Why bGSD is built the way it is, with rationale |
| **[Research & Analysis](docs/research.md)** | Competitive audit, research methodology, key findings |
| **[Version History](docs/milestones.md)** | Every milestone, what shipped, metrics |
| **[Troubleshooting](docs/troubleshooting.md)** | Common issues and solutions |

---

## Development

```bash
# Clone
git clone https://github.com/gonz0w/bgsd-oc.git
cd bgsd-oc

# Install & build
npm install
npm run build

# Run tests (node:test, 762 tests)
npm test

# Test a specific command
node bin/gsd-tools.cjs state validate --raw

# Deploy to live OpenCode config
./deploy.sh
```

### Source Architecture

```
src/
  index.js                 # Entry point
  router.js                # Command routing, namespace dispatch, global flags
  commands/
    init.js                # 13 init subcommands (context injection for workflows)
    intent.js              # Intent CRUD, tracing, drift scoring
    state.js               # State management, validation, snapshots
    phase.js               # Phase lifecycle, plan indexing
    roadmap.js             # Roadmap parsing, requirement tracking
    verify.js              # Quality gates, plan analysis
    memory.js              # Persistent memory stores
    features.js            # Test coverage, token budgets, MCP
    trajectory.js          # Trajectory engineering (checkpoint, list, pivot, compare, choose)
    misc.js                # Velocity, search, impact, rollback, TDD
    worktree.js            # Git worktree isolation
    codebase.js            # Codebase intelligence
    env.js                 # Environment detection
    mcp.js                 # MCP server operations
  lib/
    config.js              # Config loading, migration, schema validation
    constants.js           # Command help, schemas, model profiles
    context.js             # Token estimation (tokenx)
    frontmatter.js         # YAML frontmatter parsing
    git.js                 # Git operations (log, diff, status, commit, tag)
    helpers.js             # File I/O, caching, paths
    output.js              # JSON formatting, field filtering
    format.js              # Table, color, banner, progress bar
    ast.js                 # Acorn-based AST parsing
    codebase-intel.js      # Codebase intelligence storage
    conventions.js         # Convention extraction engine
    deps.js                # Dependency graph (Tarjan's SCC)
    lifecycle.js           # Lifecycle awareness
    orchestration.js       # Task classification/routing
    profiler.js            # Performance profiling
    cache.js               # L1/L2 caching (Map + SQLite)
    regex-cache.js         # Compiled regex cache
    review/
      stage-review.js      # Two-stage review (spec+quality)
      severity.js          # BLOCKER/WARNING/INFO classification
    recovery/
      stuck-detector.js    # Stuck/loop detection + recovery
```

Built with esbuild into a single `bin/gsd-tools.cjs` file. Workflows are markdown files that agents follow as step-by-step prompts, calling gsd-tools for structured data.

## Requirements

- Node.js >= 22.5 (required for `node:sqlite` caching; falls back to in-memory cache on older versions)
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
