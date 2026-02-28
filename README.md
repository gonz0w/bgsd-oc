# bGSD (Get Stuff Done) — AI Project Planning for OpenCode

A structured project planning and execution system for [OpenCode](https://github.com/opencode-ai/opencode). bGSD turns AI-assisted coding from ad-hoc prompting into milestone-driven development with planning, execution, verification, and memory that persists across sessions.

**716 tests** | **Zero runtime dependencies** | **41 slash commands** | **100+ CLI operations** | **12 specialized AI agents** | **7 milestones shipped**

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
/gsd-new-project
```

That's it. bGSD walks you through everything: what you want to build, how to break it down, and then executes it phase by phase.

See the **[Getting Started Guide](docs/getting-started.md)** for the full walkthrough, or the **[Expert Guide](docs/expert-guide.md)** if you want full control.

---

## How It Works

### Two Flows

**Easy Flow** — Let bGSD drive. Answer questions, approve plans, watch execution:

```
/gsd-new-project           # Answer "what do you want to build?"
                            # bGSD creates requirements, roadmap, phases
/gsd-plan-phase 1           # bGSD creates executable plans for phase 1
/gsd-execute-phase 1        # bGSD builds it, commits per-task, verifies
/gsd-progress               # See where things stand, get routed to next action
```

**Expert Flow** — Control every decision. Research domains, discuss assumptions, tune agents:

```
/gsd-map-codebase                       # Analyze existing code first (brownfield)
/gsd-new-project                        # Full questioning + parallel research
/gsd-discuss-phase 1                    # Lock down implementation decisions
/gsd-list-phase-assumptions 1           # See what the AI assumes before planning
/gsd-research-phase 1                   # Deep domain research
/gsd-plan-phase 1 --research            # Plan with integrated research
/gsd-execute-phase 1                    # Execute with wave parallelism
/gsd-verify-work 1                      # Manual UAT testing
/gsd-audit-milestone                    # Cross-phase integration check
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
  memory/                 # Persistent stores (decisions, bookmarks, lessons)
  todos/                  # Captured ideas and tasks
  debug/                  # Debug session state files
  quick/                  # Quick task plans and summaries
```

---

## Core Commands

### Project Lifecycle

| Command | What It Does |
|---------|-------------|
| `/gsd-new-project` | Initialize project: questioning, research, roadmap |
| `/gsd-map-codebase` | Analyze existing codebase (brownfield projects) |
| `/gsd-plan-phase [N]` | Create executable plans for a phase |
| `/gsd-execute-phase N` | Execute all plans in a phase |
| `/gsd-progress` | View progress, get routed to next action |
| `/gsd-verify-work [N]` | Manual UAT testing with gap tracking |
| `/gsd-new-milestone` | Start next milestone cycle |
| `/gsd-complete-milestone` | Archive completed milestone |

### Session Management

| Command | What It Does |
|---------|-------------|
| `/gsd-resume-work` | Restore context from previous session |
| `/gsd-pause-work` | Create handoff file for later |
| `/gsd-quick` | Execute small tasks with bGSD guarantees |
| `/gsd-debug` | Systematic debugging with persistent state |

### Configuration

| Command | What It Does |
|---------|-------------|
| `/gsd-settings` | Interactive workflow configuration |
| `/gsd-set-profile [quality\|balanced\|budget]` | Switch AI model tier |
| `/gsd-health` | Check `.planning/` integrity |
| `/gsd-update` | Update bGSD to latest version |

### Analytics & Utility

| Command | What It Does |
|---------|-------------|
| `/gsd-velocity` | Execution velocity metrics and completion forecast |
| `/gsd-codebase-impact` | Module dependencies and blast radius analysis |
| `/gsd-context-budget` | Token usage estimation for plan files |
| `/gsd-rollback-info` | Commits and revert command for a plan |
| `/gsd-search-decisions` | Search past decisions across archives |
| `/gsd-search-lessons` | Search completed phase lessons |
| `/gsd-session-diff` | Git commits since last session activity |
| `/gsd-test-run` | Parse test output with pass/fail gating |
| `/gsd-trace-requirement` | Trace requirement from spec to files on disk |
| `/gsd-validate-config` | Schema validation for config.json |
| `/gsd-validate-deps` | Phase dependency graph validation |

### Roadmap Management

| Command | What It Does |
|---------|-------------|
| `/gsd-add-phase` | Add a new phase to the end of the roadmap |
| `/gsd-insert-phase` | Insert urgent work as a decimal phase (e.g., 3.1) |
| `/gsd-remove-phase` | Remove an unstarted future phase |

### Todo & Community

| Command | What It Does |
|---------|-------------|
| `/gsd-add-todo` | Capture an idea or task from context |
| `/gsd-check-todos` | List pending todos, select one to work on |
| `/gsd-join-discord` | Join the GSD Discord community |
| `/gsd-reapply-patches` | Reapply local modifications after update |

See the **[Full Command Reference](docs/commands.md)** for all 41 commands with options and examples.

---

## Key Features

### 12 Specialized AI Agents

bGSD doesn't use one generic agent for everything. Each task gets a purpose-built agent:

| Agent | Role |
|-------|------|
| **gsd-planner** | Creates executable plans with task breakdown, dependencies, waves |
| **gsd-executor** | Implements code, runs tests, commits per-task with attribution |
| **gsd-verifier** | Verifies phase goals were actually achieved (not just tasks completed) |
| **gsd-reviewer** | Two-stage review: spec compliance + code quality with severity classification |
| **gsd-debugger** | Systematic debugging with hypothesis testing |
| **gsd-phase-researcher** | Researches implementation approaches for a phase |
| **gsd-project-researcher** | Parallel domain research (stack, features, architecture, pitfalls) |
| **gsd-roadmapper** | Creates phased roadmaps from requirements |
| **gsd-plan-checker** | Reviews plan quality with revision loop |
| **gsd-codebase-mapper** | Parallel codebase analysis (4 agents, 7 documents) |
| **gsd-integration-checker** | Cross-phase wiring verification |
| **gsd-research-synthesizer** | Merges parallel research outputs |

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
/gsd-set-profile budget    # Switch to budget mode
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

Decisions, lessons, and bookmarks persist across `/clear` and session restarts:

```
/gsd-search-decisions "database choice"   # Find past decisions
/gsd-search-lessons "auth"                # Find lessons learned
/gsd-velocity                             # Plans/day, completion forecast
```

### Git Integration

- Per-task atomic commits with agent attribution trailers
- Pre-commit safety checks (dirty tree, rebase, detached HEAD, shallow clones)
- Session diffs showing what happened since last activity
- Rollback info with exact revert commands
- TDD phase trailers for audit trail
- Optional branch-per-phase or branch-per-milestone strategies

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

Interactive configuration: `/gsd-settings`

See the **[Full Configuration Reference](docs/configuration.md)** for all options.

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | First project walkthrough, easy flow, minimal decisions |
| **[Expert Guide](docs/expert-guide.md)** | Full control flow, all options, advanced patterns |
| **[Command Reference](docs/commands.md)** | Every command with arguments, options, and examples |
| **[Architecture](docs/architecture.md)** | How bGSD works internally, agent system, tool design |
| **[Agent System](docs/agents.md)** | All 12 agents, their roles, spawning, model profiles |
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

# Run tests (node:test, 716 tests)
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
  router.js                # Command routing, global flags
  commands/
    init.js                # 13 init subcommands (context injection for workflows)
    intent.js              # Intent CRUD, tracing, drift scoring
    state.js               # State management, validation, snapshots
    phase.js               # Phase lifecycle, plan indexing
    roadmap.js             # Roadmap parsing, requirement tracking
    verify.js              # Quality gates, plan analysis
    memory.js              # Persistent memory stores
    features.js            # Test coverage, token budgets, MCP
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
    regex-cache.js         # Compiled regex cache
    review/
      stage-review.js      # Two-stage review (spec+quality)
      severity.js          # BLOCKER/WARNING/INFO classification
    recovery/
      stuck-detector.js    # Stuck/loop detection + recovery
```

Built with esbuild into a single `bin/gsd-tools.cjs` file. Workflows are markdown files that agents follow as step-by-step prompts, calling gsd-tools for structured data.

## Requirements

- Node.js >= 18
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
