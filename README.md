# GSD (Get Shit Done) — Planning Plugin for OpenCode

A structured project planning and execution plugin for [OpenCode](https://github.com/opencode-ai/opencode). GSD brings milestone-driven planning, phase execution, progress tracking, quality verification, and developer workflow automation to AI-assisted coding sessions.

**348 tests** | **457KB bundle** | **Zero runtime dependencies** | **25,500+ lines of source**

## What It Does

GSD turns chaotic development into structured execution:

- **Milestone & Phase Planning** — Break projects into milestones with phases, goals, dependencies, and requirements
- **Execution Tracking** — Track progress at milestone, phase, and plan level with automatic state management
- **Quality Gates** — Test gating, requirement verification, regression detection, and multi-dimensional quality scoring
- **Intent Engineering** — Capture *why* a project exists and *what success looks like* in structured INTENT.md, trace plans to outcomes, detect drift
- **Session Memory** — Decisions, bookmarks, lessons, and codebase knowledge persist across sessions
- **State Intelligence** — Drift detection between declared state and filesystem/git reality with auto-fix
- **Plan Analysis** — Single-responsibility scoring, dependency cycle detection, wave conflict validation
- **Git-Aware** — Session diffs, commit tracking, rollback info, and velocity metrics
- **Context Management** — Token budget estimation, bundle size tracking, codebase impact analysis
- **MCP Discovery** — Discover available MCP servers and surface their capabilities to workflows

## Project Structure

```
bin/gsd-tools.cjs          # Built CLI (457KB, single file, zero runtime deps)
src/
  commands/                # 9 command modules (init, intent, state, phase, roadmap, verify, memory, features, misc)
  lib/                     # 7 library modules (config, constants, context, frontmatter, git, helpers, output)
  router.js                # Command routing with --verbose/--compact/--fields flags
  index.js                 # Entry point
workflows/*.md             # 43 workflow definitions (invoked by slash commands)
templates/*.md             # 25 document templates (plans, summaries, roadmaps, dependency eval, etc.)
references/*.md            # Reference docs loaded by agents
build.js                   # esbuild pipeline with bundle size tracking (450KB budget)
deploy.sh                  # Deploy to ~/.config/opencode/get-shit-done/
```

## Installation

```bash
# Clone the repo
git clone https://github.com/gonz0w/gsd-opencode.git

# Install dev dependencies
cd gsd-opencode
npm install

# Build the CLI
npm run build

# Deploy to OpenCode config
./deploy.sh
```

## Usage

GSD is used through slash commands inside OpenCode sessions:

### Core Workflow

```
/gsd-new-project          # Start a new project with milestone planning
/gsd-plan-phase           # Plan the next phase with task breakdown
/gsd-execute-phase        # Execute a planned phase
/gsd-progress             # View current milestone/phase progress
/gsd-quick                # Quick summary of where things stand
```

### Intent & Alignment

```
/gsd-intent-create        # Create INTENT.md with structured sections
/gsd-intent-show          # Display intent summary or specific section
/gsd-intent-update        # Update a section with automatic history tracking
/gsd-intent-validate      # Validate intent structure and completeness
/gsd-intent-trace         # Traceability matrix: outcomes → plans
/gsd-intent-drift         # Drift score: how aligned is current work?
```

### Quality & Verification

```
/gsd-verify-phase         # Run full phase verification suite
/gsd-test-run             # Parse test output with pass/fail gating
/gsd-validate-deps        # Validate phase dependency graph
/gsd-validate-config      # Schema validation for config.json
/gsd-trace-requirement    # Trace requirement to files on disk
```

### Session & Memory

```
/gsd-session-diff         # Git commits since last activity
/gsd-search-decisions     # Search past decisions
/gsd-search-lessons       # Search lessons learned
/gsd-velocity             # Plans/day + completion forecast
/gsd-rollback-info        # Show commits + revert command
```

### Analysis & Budget

```
/gsd-context-budget       # Token estimation for a plan
/gsd-codebase-impact      # Show module dependencies
```

Or run the CLI directly:

```bash
node bin/gsd-tools.cjs <command> [args] --raw
```

## CLI Commands

The CLI exposes 70+ commands organized by domain:

| Domain | Commands | Description |
|--------|----------|-------------|
| **init** | `init progress`, `init plan-phase`, `init execute-phase`, `init memory`, ... | Context injection for workflow sessions |
| **intent** | `intent create`, `intent show`, `intent update`, `intent validate`, `intent trace`, `intent drift` | Intent capture, display, evolution tracking, traceability, and drift scoring |
| **state** | `state validate`, `state validate --fix`, `state-snapshot` | State drift detection and auto-repair |
| **memory** | `memory write`, `memory read`, `memory list`, `memory compact` | Cross-session persistence (decisions, bookmarks, lessons, todos) |
| **verify** | `verify deliverables`, `verify requirements`, `verify regression`, `verify quality` | Quality gates with A-F grading and trend tracking |
| **analyze** | `analyze plan`, `verify plan-wave`, `verify plan-deps`, `verify plan-structure` | Plan decomposition analysis and validation |
| **roadmap** | `roadmap analyze`, `roadmap phase-status`, `requirements` | Roadmap parsing and requirement tracking |
| **features** | `test-coverage`, `token-budget`, `mcp discover` | Test coverage, token budgets, MCP discovery |
| **misc** | `velocity`, `session-diff`, `search-decisions`, `search-lessons`, `codebase-impact`, `rollback-info`, `trace-requirement` | Developer productivity tools |

## Key Features by Version

### v3.0 — Intent Engineering (current)

- **INTENT.md** — Structured document capturing project objective, desired outcomes (prioritized P1-P3), success criteria, constraints, target users, and health metrics. Machine-readable, human-friendly.
- **Intent CRUD** — `intent create` with guided questionnaire or auto-synthesis from documents. `intent show` renders compact summary or specific sections. `intent update` modifies sections with automatic diff detection. `intent validate` checks structure and completeness.
- **Traceability Matrix** — `intent trace` maps every desired outcome to the phases and plans that address it. Detects outcome coverage gaps — outcomes with no plan addressing them.
- **Drift Detection** — `intent drift` produces a numeric alignment score (0-100) across 4 signals: objective mismatch, feature creep, priority inversion, and outcome coverage. Runs as advisory pre-flight before plan execution (warns, never blocks).
- **Workflow Integration** — Init commands automatically include intent summary in agent context. Research, planning, and verification workflows receive intent for scope alignment. All injections are conditional — projects without INTENT.md see zero changes.
- **Intent Evolution** — `<history>` section in INTENT.md tracks what changed, why, and in which milestone. `intent update --reason` logs reasoning automatically. `intent show history` displays evolution timeline.
- **Guided Capture** — New-project workflow asks 4 structured questions (objective, outcomes, criteria, constraints) before requirements. New-milestone workflow reviews and evolves existing intent section-by-section.
- **Self-Application** — GSD's own development uses INTENT.md, proving the system works on itself.

### v2.0 — Quality & Intelligence

- **State Intelligence** — `state validate` detects drift between ROADMAP.md claims and actual files on disk, with `--fix` for auto-correction. Pre-flight validation runs automatically before phase execution.
- **Session Memory** — Dual-store pattern (STATE.md + memory.json) with sacred data protection. Decisions and lessons are never pruned. Bookmarks record exact position for seamless resume.
- **Quality Gates** — `verify deliverables` runs tests and fails on failure. `verify requirements` checks REQUIREMENTS.md coverage. `verify regression` detects new test failures. `verify quality` produces A-F scores across 4 dimensions (tests 30%, must_haves 30%, requirements 20%, regression 20%) with trend tracking.
- **Plan Analysis** — `analyze plan` scores plans 1-5 on single-responsibility using union-find concern grouping. `verify plan-wave` detects file conflicts in parallel execution. `verify plan-deps` finds dependency cycles via DFS.
- **Test Infrastructure** — 348 tests across 76 suites. Integration tests cover workflow sequences, state round-trips, config migration, intent operations, and E2E simulation. Snapshot tests for init output stability.
- **Build Pipeline** — Bundle size tracked on every build (457KB / 450KB budget). Token budgets assigned per workflow with overage flagging.
- **Compact Default** — `--compact` output is now the default for all init commands (optimized for AI consumers). Use `--verbose` for full output.
- **MCP Discovery** — `mcp discover` scans .mcp.json configs and surfaces server capabilities.

### v1.1 — Context Reduction & Tech Debt

- **Token Measurement** — BPE-based token estimation via tokenx (~96% accuracy)
- **Output Compaction** — `--compact` profiles reduce init output by 40-60%
- **Context Manifests** — `--manifest` flag for structured context loading
- **Workflow Compression** — All 43 workflows compressed for token efficiency
- **`--fields` Flag** — Filter any JSON output with dot-notation (e.g., `--fields phase_count,phases.name`)
- **Section Extraction** — `extract-sections` pulls specific sections from markdown files

### v1.0 — Performance & Quality

- **Multi-strategy milestone detection** — Finds active milestone via markers, tags, sections, or fallback
- **esbuild pipeline** — Source split into 16 modules, bundled to single CJS file
- **In-memory file cache** — `cachedReadFile` eliminates redundant disk reads
- **Session diff tracking** — Git commits since last activity in progress reports
- **Config validation** — Schema validation with typo detection for config.json

## Development

```bash
# Build (includes bundle size check)
npm run build

# Run tests (node:test runner, 348 tests)
npm test

# Test a specific command
node bin/gsd-tools.cjs state validate --raw

# Deploy to live config
./deploy.sh
```

### Source Architecture

```
src/index.js           # Entry point, CLI argument parsing
src/router.js          # Command routing, global flags (--raw, --verbose, --fields)
src/commands/
  init.js              # 12 init subcommands + init memory
  intent.js            # Intent CRUD, tracing, drift scoring, validation, history
  state.js             # State management, validation, snapshots
  phase.js             # Phase operations, plan indexing
  roadmap.js           # Roadmap analysis, requirement tracking
  verify.js            # Quality gates, plan analysis, deliverable verification
  memory.js            # Memory store CRUD (decisions, bookmarks, lessons, todos)
  features.js          # Test coverage, token budgets, MCP discovery
  misc.js              # Velocity, search, impact, rollback, tracing
src/lib/
  config.js            # Config loading, migration, schema validation
  constants.js         # Command help text, schemas, defaults
  context.js           # Token estimation (tokenx integration)
  frontmatter.js       # YAML frontmatter parsing and validation
  git.js               # Git operations (log, diff, status, commit)
  helpers.js           # File I/O, caching, path resolution
  output.js            # JSON output formatting, field filtering
```

## Requirements

- Node.js >= 18
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
