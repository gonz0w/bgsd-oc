# bGSD Architecture

How bGSD works internally. This document covers the two-layer design, agent system, data flow, and extension points.

> **See also:** [Agent System](agents.md) for detailed agent documentation, [Planning System](planning-system.md) for .planning/ structure, [Decisions](decisions.md) for architectural rationale.

---

## Design Philosophy

bGSD separates **deterministic operations** from **AI reasoning**:

- **Deterministic layer** (`gsd-tools.cjs`) — Parsing, validation, git, file I/O, state management, AST analysis, task classification. Always produces the same output for the same input.
- **AI layer** (workflow `.md` files) — Agent behavior definitions. LLMs follow these as step-by-step prompts, calling gsd-tools for structured data.

This means:
- AI agents never parse markdown directly — they get clean JSON from gsd-tools
- State changes are atomic — gsd-tools handles file writes and git commits
- Workflows are portable — any LLM that follows markdown instructions can execute them
- Testing is straightforward — 669 tests cover the deterministic layer

---

## System Architecture

```
User
  |
  v
OpenCode Session
  |
  v
Slash Command (/gsd-*)
  |
  v
Workflow (.md file)                    <-- AI follows step-by-step
  |
  +-- calls gsd-tools.cjs             <-- Deterministic data operations
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
/gsd-plan-phase 1
  |
  v
plan-phase.md workflow
  |
  +-- gsd-tools init plan-phase 1     -> JSON: roadmap, state, config, codebase context
  +-- gsd-tools roadmap get-phase 1   -> JSON: phase goal, success criteria
  +-- gsd-tools search-lessons 1       -> JSON: relevant past lessons
  +-- gsd-tools assertions list        -> JSON: acceptance criteria
  |
  +-- spawn gsd-planner agent          -> Writes PLAN.md files
  +-- spawn gsd-plan-checker agent     -> Reviews, requests revisions (max 3)
  |
  v
/gsd-execute-phase 1
  |
  v
execute-phase.md workflow
  |
  +-- gsd-tools init execute-phase 1  -> JSON: all context
  +-- gsd-tools validate-dependencies  -> JSON: dependency validation
  +-- gsd-tools phase-plan-index 1     -> JSON: plan waves and ordering
  |
  +-- For each wave:
       +-- spawn gsd-executor agents   -> Implement code, commit per-task
       +-- gsd-tools state advance-plan
       +-- gsd-tools state record-metric
  |
  +-- spawn gsd-verifier agent         -> Creates VERIFICATION.md
  +-- gsd-tools phase complete 1
```

---

## Source Structure

```
src/
  index.js                 # Entry point, argument parsing
  router.js                # Command dispatch, global flags (--raw, --verbose, --fields)
  commands/
    init.js                # 13 init subcommands — compound context for each workflow
    intent.js              # INTENT.md CRUD, traceability, drift scoring
    state.js               # STATE.md management, drift detection, snapshots
    phase.js               # Phase lifecycle, plan indexing, worktree management
    roadmap.js             # ROADMAP.md parsing, requirement tracking
    verify.js              # Quality gates, plan analysis, deliverable verification
    memory.js              # Persistent stores (decisions, bookmarks, lessons, todos)
    features.js            # Test coverage, token budgets, MCP discovery
    misc.js                # Velocity, search, impact, rollback, tracing, TDD
    worktree.js            # Git worktree creation, merge, cleanup
    codebase.js            # Codebase intelligence (incremental analysis, conventions)
    env.js                 # Environment detection (26 language patterns)
    mcp.js                 # MCP server operations
  lib/
    config.js              # Config loading with caching, schema validation, migration
    constants.js           # COMMAND_HELP, CONFIG_SCHEMA, MODEL_PROFILES
    context.js             # Token estimation via tokenx (~96% accuracy)
    frontmatter.js         # YAML frontmatter parsing and manipulation
    git.js                 # Git operations (log, diff, status, commit, tag, pre-commit checks)
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
    regex-cache.js         # Compiled regex cache
    review/
      stage-review.js      # Two-stage review (spec+quality)
      severity.js          # BLOCKER/WARNING/INFO classification
    recovery/
      stuck-detector.js    # Stuck/loop detection + recovery
```

**Build:** esbuild bundles all source into a single `bin/gsd-tools.cjs` file. Zero runtime dependencies in the built artifact.

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
| **gsd-research-synthesizer** | Merge research | 4 research documents | SUMMARY.md |
| **gsd-roadmapper** | Create roadmap | Requirements, research, project context | ROADMAP.md |
| **gsd-codebase-mapper** | Analyze codebase | Focus area (tech/arch/quality/concerns) | Codebase documents |
| **gsd-reviewer** | Post-execution code review | Git diff, PLAN.md, CONVENTIONS.md | Severity-classified findings |
| **gsd-integration-checker** | Cross-phase wiring | Phase verifications, summaries | Integration report |

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
| `/gsd-new-project` | 4x gsd-project-researcher (Stack, Features, Architecture, Pitfalls) |
| `/gsd-map-codebase` | 4x gsd-codebase-mapper (tech, arch, quality, concerns) |
| `/gsd-execute-phase` | N x gsd-executor (within each wave) |
| `/gsd-verify-work` | N x debug agents (one per UAT gap) |

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
node bin/gsd-tools.cjs init execute-phase 1 --raw
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

## Deployment

### Development Workflow

```bash
# Edit source in src/
vim src/commands/phase.js

# Build (esbuild -> bin/gsd-tools.cjs)
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
git clone https://github.com/gonz0w/gsd-opencode.git
cd gsd-opencode
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
