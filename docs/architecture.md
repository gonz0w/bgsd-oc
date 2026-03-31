# bGSD Architecture

How bGSD works internally. This document covers the two-layer design, agent system, data flow, and extension points.

> **See also:** [Agent System](agents.md) for detailed agent documentation, [Planning System](planning-system.md) for .planning/ structure, [Decisions](decisions.md) for architectural rationale.

---

## Design Philosophy

bGSD separates **deterministic operations** from **AI reasoning**:

- **Deterministic layer** (`bgsd-tools.cjs`) — Parsing, validation, git, file I/O, state management, AST analysis, task classification. Always produces the same output for the same input.
- **AI layer** (workflow `.md` files) — Agent behavior definitions. LLMs follow these as step-by-step prompts, calling the bGSD CLI for structured data.

This means:
- AI agents never parse markdown directly — they get clean JSON from CLI init and verify commands
- State changes are atomic — CLI helpers handle file writes and git commits
- Workflows are portable — any LLM that follows markdown instructions can execute them
- Testing is straightforward — 1,500+ tests cover the deterministic layer

---

## System Architecture

```
User
  |
  v
OpenCode Session
  |
  v
Slash Command (/bgsd-*)
  |
  v
Workflow (.md file)                    <-- AI follows step-by-step
  |
  +-- calls bgsd-tools.cjs            <-- Deterministic data operations
  |     |
  |     +-- reads/writes .planning/   <-- Structured markdown + JSON
  |     +-- git operations             <-- Commits, branches, tags
  |     +-- JSON output                <-- Structured data for AI
  |
  +-- spawns subagents                 <-- Specialized AI agents
        |
        +-- gsd-planner               <-- Creates PLAN.md
        +-- gsd-executor               <-- Implements code
        +-- gsd-verifier               <-- Verifies results
        +-- (etc.)
```

### Data Flow Example: Plan and Execute

```
/bgsd-plan phase 1
  |
  v
plan-phase.md workflow
  |
  +-- node bin/bgsd-tools.cjs init:plan-phase 1 --raw             -> JSON: roadmap, state, config, codebase context
  +-- node bin/bgsd-tools.cjs plan:roadmap get-phase 1            -> JSON: phase goal, success criteria
  +-- node bin/bgsd-tools.cjs lessons:list --query 1              -> JSON: relevant past lessons from .planning/memory/lessons.json
  +-- node bin/bgsd-tools.cjs verify:assertions list --req REQ-01 -> JSON: acceptance criteria
  |
  +-- spawn gsd-planner agent          -> Writes PLAN.md files
  +-- spawn gsd-plan-checker agent     -> Reviews, requests revisions (max 3)
  |
  v
/bgsd-execute-phase 1
  |
  v
execute-phase.md workflow
  |
  +-- node bin/bgsd-tools.cjs init:execute-phase 1 --raw          -> JSON: all context
  +-- node bin/bgsd-tools.cjs verify:validate-dependencies 1      -> JSON: dependency validation
  +-- node bin/bgsd-tools.cjs util:phase-plan-index 1             -> JSON: plan waves and ordering
  |
  +-- For each wave:
       +-- spawn gsd-executor agents   -> Implement code, commit per-task
       +-- node bin/bgsd-tools.cjs verify:state advance-plan
       +-- node bin/bgsd-tools.cjs verify:state record-metric --phase 1 --plan 1 --duration "5 min"
  |
  +-- spawn gsd-verifier agent         -> Creates VERIFICATION.md
  +-- node bin/bgsd-tools.cjs plan:phase complete 1
```

---

## Source Structure

```
src/
  index.js                 # Entry point, argument parsing
  router.js                # Command dispatch, namespace routing (init:, plan:, etc.), global flags
  commands/
    init.js                # 13 init subcommands — compound context for each workflow
    intent.js              # INTENT.md CRUD, traceability, drift scoring
    state.js               # STATE.md management, drift detection, snapshots
    phase.js               # Phase lifecycle, plan indexing, worktree management
    roadmap.js             # ROADMAP.md parsing, requirement tracking
    verify.js              # Quality gates, plan analysis, deliverable verification
    memory.js              # Persistent stores (decisions, bookmarks, lessons, todos, trajectories)
    trajectory.js          # Trajectory engineering (checkpoint, list, pivot, compare, choose)
    features.js            # Test coverage, token budgets, MCP discovery
    misc.js                # Velocity, search, impact, rollback, tracing, TDD
    worktree.js            # Git worktree creation, merge, cleanup
    codebase.js            # Codebase intelligence (incremental analysis, conventions)
    env.js                 # Environment detection (26 language patterns)
    mcp.js                 # MCP server operations
    agent.js               # Local agent overrides (list-local, override, diff, sync)
    skills.js              # Skill discovery & security (list, install, validate, remove)
    lessons.js             # Lesson analysis pipeline (capture, analyze, suggest, compact)
    research.js            # Research scoring (score, gaps)
    decisions.js           # Decision engine (list, inspect, evaluate, savings)
    audit.js               # Codebase audit framework
    tools.js               # CLI tool integration (detect, status)
    measure.js             # Measurement & metrics
    runtime.js             # Runtime detection (Bun, Node)
    milestone.js           # Milestone lifecycle operations
    cache.js               # Cache management (warm, stats, clear)
  lib/
    config.js              # Config loading with caching, schema validation, migration
    constants.js           # COMMAND_HELP, CONFIG_SCHEMA, MODEL_PROFILES
    context.js             # Token estimation via tokenx (~96% accuracy)
    frontmatter.js         # YAML frontmatter parsing and manipulation
    git.js                 # Git operations (log, diff, status, commit, tag, pre-commit checks, selective rewind, trajectory branches)
    helpers.js             # File I/O with caching, path resolution, slug generation
    output.js              # JSON output formatting, field filtering, large output handling
    format.js              # Table, color, banner, progress bar (TTY-aware)
    ast.js                 # Acorn-based AST parsing for JS/TS
    codebase-intel.js      # Codebase intelligence storage
    conventions.js         # Convention extraction engine
    deps.js                # Dependency graph (Tarjan's SCC)
    lifecycle.js           # Lifecycle awareness
    orchestration.js       # Task classification/routing
    profiler.js            # Performance profiling
    cache.js               # L1/L2 caching (Map + SQLite)
    regex-cache.js         # Compiled regex cache
    db.js                  # SQLite DataStore (WAL mode, schema versioning, Map fallback)
    decision-rules.js      # Deterministic decision functions with confidence scoring
    debug.js               # Debug/trace utilities
    error.js               # Structured error classes with recovery suggestions
    wizard.js              # Interactive guided prompt wizards
    review/
      stage-review.js      # Two-stage review (spec+quality)
      severity.js          # BLOCKER/WARNING/INFO classification
    recovery/
      stuck-detector.js    # Stuck/loop detection + recovery
      autoRecovery.js      # Autonomous deviation recovery with lesson capture
    nl/                    # Natural language parsing (v11.0)
      intent-classifier.js # Intent classification from free-text input
      param-extractor.js   # Parameter extraction from natural language
      fuzzy-resolver.js    # Fuzzy command matching with disambiguation
      alias-registry.js    # Smart command aliases
      (+ 6 more modules)
    viz/                   # Visualization (v11.0)
      dashboard.js         # Full-screen terminal dashboard
      burndown.js          # ASCII burndown charts
      sparkline.js         # Velocity sparkline rendering
      progress.js          # Progress bar visualization
      quality.js           # Quality score display
      milestone.js         # Milestone completion visualization
    cli-tools/             # External tool wrappers (v12.1)
      detect.js            # Unified tool detection with 5-min cache
      ripgrep.js           # ripgrep --json integration
      fd.js                # fd --glob file discovery
      jq.js                # JSON query integration
      yq.js                # YAML processing
      bat.js               # Syntax-highlighted file viewing
      gh.js                # GitHub CLI wrapper
      fallback.js          # Node.js fallback implementations
      install-guidance.js  # Cross-platform install instructions
      (+ 1 more module)
  plugin/                  # Host editor plugin system
    index.js               # Plugin entry point
    project-state.js       # Project state provider
    context-builder.js     # Context injection for workflows
    tool-registry.js       # Tool registration and routing
    token-budget.js        # Token budget enforcement
    idle-validator.js      # Idle-time validation runner
    stuck-detector.js      # Agent stuck detection
    advisory-guardrails.js # Advisory safety guardrails
    command-enricher.js    # Command context enrichment
    (+ 8 more modules)
```

**Build:** esbuild bundles all source into a single `bin/bgsd-tools.cjs` file. Zero runtime dependencies in the built artifact.

**Lazy loading:** Command modules are loaded on demand via `lazyState`, `lazyRoadmap`, etc. — only the needed module is loaded per invocation.

---

## Agent System

### Agent Types and Roles

| Agent | Purpose | Context Source | Output |
|-------|---------|---------------|--------|
| **gsd-planner** | Create PLAN.md from phase context | init plan-phase JSON, CONTEXT.md, RESEARCH.md, lessons, assertions | PLAN.md files |
| **gsd-executor** | Implement a single plan | PLAN.md, codebase conventions, codebase context | Code changes, SUMMARY.md |
| **gsd-verifier** | Verify phase goals achieved | PLAN frontmatter must_haves, roadmap success criteria | VERIFICATION.md |
| **gsd-plan-checker** | Review plan quality | PLAN.md content | Revision feedback or approval |
| **gsd-debugger** | Systematic debugging | Symptoms, codebase context | Debug state file, root cause |
| **gsd-phase-researcher** | Research implementation | Phase goal, ecosystem context | RESEARCH.md |
| **gsd-project-researcher** | Domain research | Project description, focus area | Research document |
| **gsd-roadmapper** | Create roadmap + synthesize research | Requirements, research, project context | ROADMAP.md |
| **gsd-codebase-mapper** | Analyze codebase | Focus area (tech/arch/quality/concerns) | Codebase documents |

> **Note:** Code review (spec compliance + code quality with BLOCKER/WARNING/INFO severity) is a step within the `execute-plan.md` workflow, not a standalone agent. Review logic lives in `src/lib/review/` and is invoked by the executor after plan completion.

### Model Profiles

Three profiles control which AI model each agent uses:

```
Quality:    planner=opus   executor=opus   verifier=sonnet  researcher=opus   checker=sonnet
Balanced:   planner=opus   executor=sonnet verifier=sonnet  researcher=sonnet checker=sonnet
Budget:     planner=sonnet executor=sonnet verifier=haiku   researcher=haiku  checker=haiku
```

Configured in `.planning/config.json` with per-agent overrides:

```json
{
  "model_profile": "balanced",
  "model_profiles": {
    "gsd-executor": "opus"
  }
}
```

Resolution: `config.json` -> check `model_profiles` for agent -> look up in profile table -> pass to `Task()` spawn. Opus-tier agents resolve to `"inherit"` to avoid version conflicts.

### Agent Spawning

Workflows spawn agents via the `Task()` tool:

```
Task(
  prompt="<context and instructions>",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute Plan 01-01"
)
```

Each agent gets a fresh context window. Communication happens through files (PLAN.md in, SUMMARY.md out) — not through conversation history.

### Parallel Execution

Several workflows spawn multiple agents in parallel:

| Workflow | Parallel Agents |
|----------|----------------|
| `/bgsd-new-project` | 5x gsd-project-researcher (Stack, Features, Architecture, Pitfalls, Skills) |
| `/bgsd-map-codebase` | 4x gsd-codebase-mapper (tech, arch, quality, concerns) |
| `/bgsd-execute-phase` | N x gsd-executor (within each wave) |
| `/bgsd-verify-work` | N x debug agents (one per UAT gap) |

### Trajectory Engineering Data Flow

```
trajectory checkpoint <name>
  |
  +-- Validate clean working tree (exclude .planning/)
  +-- Count existing checkpoints → compute attempt N
  +-- git branch trajectory/<scope>/<name>/attempt-N   (ref only, no checkout)
  |
  +-- Metrics collection (fault-tolerant):
  |     +-- Run test suite → total/pass/fail
  |     +-- git diff HEAD~5..HEAD → insertions/deletions/files
  |     +-- codebase complexity → aggregate score
  |
  +-- Generate unique ID (tj-XXXXXX)
  +-- Write journal entry → .planning/memory/trajectory.json
  +-- Return JSON: checkpoint, branch, attempt, git_ref, metrics

trajectory pivot <checkpoint>
  |
  +-- Check dirty working tree (optional --stash)
  +-- Find matching non-abandoned checkpoints in journal
  +-- Resolve target (--attempt N or most recent)
  +-- Auto-checkpoint current HEAD as abandoned attempt
  |     +-- Create branch: archived/trajectory/<scope>/<name>/attempt-N
  +-- Selective rewind to target ref (preserves .planning/, root configs)
  +-- Pop stash if used
  +-- Write abandoned journal entry → trajectory.json

trajectory compare <name>
  |
  +-- Read journal, filter to non-abandoned checkpoints for scope+name
  +-- Build metrics array per attempt (tests, LOC, complexity)
  +-- Identify best/worst per metric (directional: higher tests = better, lower complexity = better)
  +-- Return JSON: attempts, best_per_metric, worst_per_metric

trajectory choose <name> --attempt <N>
  |
  +-- Read journal, find all checkpoint entries for scope+name
  +-- Validate winning attempt exists and is not abandoned
  +-- Verify winning branch exists in git
  +-- git merge --no-ff winning branch → current branch
  +-- Archive non-chosen branches as lightweight git tags
  +-- Delete ALL trajectory working branches
  +-- Write 'choose' journal entry with tags: ['choose', 'lifecycle-complete']

git rewind --ref <ref>
  |
  +-- Validate ref (git rev-parse --verify)
  +-- Compute diff HEAD vs ref (git diff --name-status)
  +-- Separate protected paths from rewindable paths
  +-- Three-gate: dry-run → needs_confirm → confirm
  +-- Auto-stash if dirty, selective checkout, restore stash
```

---

## Document Templates

Templates define the structure of every document bGSD creates. Located in `templates/`:

### Core Planning
- `project.md` — PROJECT.md template
- `state.md` — STATE.md template
- `roadmap.md` — ROADMAP.md template
- `requirements.md` — REQUIREMENTS.md template
- `intent.md` — INTENT.md template
- `assertions.md` — ASSERTIONS.md template
- `config.json` — Default configuration

### Phase Execution
- `phase-prompt.md` — PLAN.md format (frontmatter schema, task XML, checkpoints)
- `summary.md` / `summary-minimal.md` / `summary-standard.md` / `summary-complex.md` — SUMMARY.md variants
- `verification-report.md` — VERIFICATION.md format
- `plans/execute.md` — Standard execution plan
- `plans/tdd.md` — TDD plan (RED-GREEN-REFACTOR)
- `plans/discovery.md` — Discovery/exploration plan

### Research
- `research.md` — Phase research output
- `context.md` — CONTEXT.md from discussion
- `discovery.md` — Discovery phase output

### Codebase Analysis
- `codebase/stack.md`, `architecture.md`, `structure.md`, `conventions.md`, `testing.md`, `integrations.md`, `concerns.md`

### Project Research
- `research-project/STACK.md`, `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `SUMMARY.md`

---

## Reference Documents

Loaded by agents for behavioral guidance. Located in `references/`:

| Reference | Used By | Purpose |
|-----------|---------|---------|
| `model-profiles.md` | All workflows | Agent-to-model mapping tables |
| `model-profile-resolution.md` | All workflows | How to resolve model once at start |
| `verification-patterns.md` | gsd-verifier | How to detect stubs vs real code |
| `checkpoints.md` | gsd-executor | Checkpoint types and automation rules |
| `questioning.md` | new-project | Dream extraction questioning techniques |
| `git-integration.md` | gsd-executor | Per-task commit strategy |
| `git-planning-commit.md` | All workflows | Planning document commit patterns |
| `continuation-format.md` | All workflows | "Next Up" block format |
| `ui-brand.md` | All workflows | Visual output patterns |
| `planning-config.md` | All workflows | Config behavior documentation |
| `tdd.md` | gsd-planner | TDD methodology guide |
| `phase-argument-parsing.md` | All workflows | Phase number normalization |
| `decimal-phase-calculation.md` | insert-phase | Decimal phase numbering |

---

## Init System

The `init` command family is bGSD's context injection system. Each workflow calls its corresponding `init` subcommand to get all necessary context in one JSON payload:

```bash
node bin/bgsd-tools.cjs init:execute-phase 1 --raw
```

Returns a compound JSON object with:
- Current state (from STATE.md)
- Roadmap data (from ROADMAP.md)
- Phase plans (from disk)
- Configuration (from config.json)
- Codebase intelligence (from codebase-intel.json)
- Memory (from memory stores)
- Session continuity

This eliminates the need for agents to make multiple round-trips to gather context.

**Compact mode** (default): Returns essential-only fields, 38-50% smaller than verbose mode.

**Manifest mode** (`--manifest`): Includes a context manifest telling agents which files to load for deeper context.

---

## Quality System

### Multi-Dimensional Scoring

```
Quality Grade = Tests (30%) + Must-Haves (30%) + Requirements (20%) + Regression (20%)
```

Each dimension scored 0-100, weighted, mapped to A-F grade. Trend tracked across plans.

### Verification Pipeline

```
PLAN.md must_haves
  |
  v
Artifact check       -> File exists? Real implementation or stub?
  |
  v
Wiring check         -> Imported AND actually used?
  |
  v
Truth verification   -> Behavioral claims true in codebase?
  |
  v
Anti-pattern scan    -> TODO/FIXME/HACK, empty returns, placeholders?
  |
  v
VERIFICATION.md      -> pass / gaps_found / human_needed
```

### State Drift Detection

`state validate` compares STATE.md claims against filesystem reality:
- Plan count matches actual PLAN.md files?
- Current position valid?
- Activity timestamps recent?
- Blocker/todo age reasonable?

`--fix` auto-corrects mismatches.

---

## Data Layer

### SQLite-First Architecture (v12.0)

bGSD uses SQLite as its primary data store via Node's built-in `node:sqlite` module (`DatabaseSync`). The database lives at `.planning/.cache.db` with WAL mode for concurrent access.

**Three data tiers:**

1. **Planning cache** — Phases, plans, requirements cached with write-through consistency. Invalidated by git-hash + mtime checks.
2. **Memory stores** — Decisions, lessons, trajectories, bookmarks stored in SQLite with dual-write to JSON files (sacred data backup).
3. **Session state** — Current execution state persisted in SQLite; STATE.md is a generated view.

**Fallback:** Gracefully degrades to in-memory Map on Node <22.5. All SQLite features disabled silently — zero crashes, zero warnings.

### File Caching Layer (v8.0)

Two-layer cache for hot-path file reads:

- **L1 (in-memory Map)** — Per-invocation cache. Instant hits for repeated reads within a single CLI call.
- **L2 (SQLite)** — Persistent cache across CLI invocations. Keyed by file path + mtime for automatic invalidation.

Explicit cache invalidation on all CLI-managed file writes ensures immediate consistency.

**Commands:**
```bash
node bin/bgsd-tools.cjs util:cache warm          # Pre-populate cache with .planning/ files
node bin/bgsd-tools.cjs util:cache status        # Cache hit/miss statistics
node bin/bgsd-tools.cjs util:cache clear         # Clear the SQLite cache
```

### Decision Engine (v11.3)

Deterministic decision functions that replace LLM calls for routing, classification, and gating decisions:

```
decision-rules.js
  |
  +-- 18+ pure functions (model selection, verification routing, research gate, ...)
  +-- Confidence scoring: HIGH (auto-apply), MEDIUM (suggest), LOW (defer to LLM)
  +-- Registry pattern: decisions list / decisions inspect <name> / decisions evaluate
  +-- Consumed by 13 workflows via pre-computed decision blocks
```

This reduces LLM token usage by eliminating round-trips for decisions that can be made deterministically from project state.

---

## Deployment

### Development Workflow

```bash
# Edit source in src/
vim src/commands/phase.js

# Build (esbuild -> bin/bgsd-tools.cjs)
npm run build

# Test
npm test

# Deploy to live OpenCode config
./deploy.sh
```

### deploy.sh Process

1. Build from source (`npm run build`)
2. Backup current `~/.config/opencode/get-shit-done/` to timestamped `.bak-*`
3. Copy `bin/`, `workflows/`, `templates/`, `references/`, `src/`, `VERSION`
4. Smoke test the deployed artifact
5. Auto-rollback on smoke test failure

### Distribution

End users install via:
```bash
git clone https://github.com/gonz0w/bgsd-oc.git
cd bgsd-oc
npm install && npm run build
./deploy.sh
```

This deploys commands, workflows, templates, and references to `~/.config/opencode/`.

---

## Extension Points

### Custom Templates

Add plan templates in `templates/plans/` for project-specific patterns (e.g., `ash-resource.md`, `go-service.md`).

### Worktree Setup Hooks

Configure in `.planning/config.json`:
```json
{
  "worktree": {
    "setup_hooks": ["npm install", "cp .env.example .env"]
  }
}
```

### User Defaults

Save preferred settings at `~/.gsd/defaults.json`. Applied to every new project.

### Test Commands

Override auto-detection:
```json
{
  "test_commands": {
    "node": "npm test",
    "elixir": "mix test"
  }
}
```

---

## Related Documentation

- **[Getting Started](getting-started.md)** — First project walkthrough
- **[Expert Guide](expert-guide.md)** — Full control flow
- **[Command Reference](commands.md)** — Every command with options
- **[Agent System](agents.md)** — Detailed agent documentation
- **[Planning System](planning-system.md)** — How .planning/ works
- **[Design Decisions](decisions.md)** — Why bGSD is built this way
- **[TDD Guide](tdd.md)** — TDD execution engine
