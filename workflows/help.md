<purpose>
Display the complete bGSD command reference. Output ONLY the reference content — no project-specific analysis, git status, or commentary.
</purpose>

<reference>
# bGSD Command Reference

**bGSD** (Get Stuff Done) creates hierarchical project plans optimized for solo agentic development with the host editor.

## Quick Start

1. `/bgsd plan project` - Initialize project (includes research, requirements, roadmap)
2. `/bgsd plan phase 1` - Create detailed plan for first phase
3. `/bgsd exec phase 1` - Execute the phase

## Command Structure

bGSD uses a subcommand structure. Most commands are accessed through group commands:

- `/bgsd plan` — Planning operations
- `/bgsd exec` — Execution operations
- `/bgsd roadmap` — Roadmap management
- `/bgsd milestone` — Milestone operations
- `/bgsd session` — Session management
- `/bgsd todo` — Todo management
- `/bgsd config` — Configuration
- `/bgsd util` — Utility commands

## Subcommands

### /bgsd plan — Planning

| Subcommand | Description |
|------------|-------------|
| project | Initialize new project with research, requirements, roadmap |
| discuss [n] | Capture vision for a phase |
| research [n] | Ecosystem research for niche domains |
| assumptions [n] | See agent's intended approach before planning |
| phase [n] | Create execution plan for a phase |

**Usage:** `/bgsd plan phase 1`

### /bgsd exec — Execution

| Subcommand | Description |
|------------|-------------|
| phase [n] | Execute all plans in a phase |
| quick | Execute small, ad-hoc tasks |
| ci | Push branch, create PR, run code scanning, auto-merge |

**Usage:** `/bgsd exec phase 5`

### /bgsd roadmap — Roadmap Management

| Subcommand | Description |
|------------|-------------|
| add [desc] | Append new phase to current milestone |
| insert [after] [desc] | Insert decimal phase between existing |
| remove [n] | Remove future phase |

**Usage:** `/bgsd roadmap add "Add admin dashboard"`

### /bgsd milestone — Milestone Management

| Subcommand | Description |
|------------|-------------|
| new [name] | Start new milestone |
| complete [version] | Archive milestone |
| audit [version] | Audit milestone against intent |
| gaps | Create phases from audit gaps |

**Usage:** `/bgsd milestone new v2.0`

### /bgsd session — Session Management

| Subcommand | Description |
|------------|-------------|
| resume | Restore full context from previous session |
| pause | Create .continue-here handoff |
| progress | Show progress, recent work, current position |

**Usage:** `/bgsd session resume`

### /bgsd todo — Todo Management

| Subcommand | Description |
|------------|-------------|
| add [task] | Capture idea/task as structured todo |
| check [area] | List pending todos, select to work on |

**Usage:** `/bgsd todo add Fix auth bug`

### /bgsd config — Configuration

| Subcommand | Description |
|------------|-------------|
| settings | Configure workflow toggles and model profile |
| profile [name] | Switch model profile (quality/balanced/budget) |
| validate | Validate config.json schema |

**Usage:** `/bgsd config profile budget`

### /bgsd util — Utilities

| Subcommand | Description |
|------------|-------------|
| map | Map existing codebase with parallel agents |
| cleanup | Archive phase directories from completed milestones |
| help | Show this reference |
| update | Update bGSD with changelog preview |
| velocity | Execution velocity metrics and forecast |
| validate-deps | Phase dependency graph validation |
| test-run | Parse test output with pass/fail gating |
| trace [req] | Trace requirement from spec to files |
| search-decisions [query] | Search past decisions |
| search-lessons [query] | Search completed phase lessons |
| session-diff | Git commits since last session |
| rollback-info | Commits and revert command for a plan |
| context-budget | Token usage estimation for plans |
| impact | Module dependencies and blast radius |
| patches | Reapply editor patches |
| health | Project health check |

**Usage:** `/bgsd util velocity`

## Standalone Commands

These commands are not part of the subcommand groups:

| Command | Description |
|---------|-------------|
| `/bgsd debug [issue]` | Systematic debugging with persistent state |
| `/bgsd health` | Project health check |
| `/bgsd verify-work [phase]` | Conversational UAT — extract testable deliverables |

## Backward Compatibility

The old individual commands are deprecated but still accessible during the transition period. Use the new subcommand structure for better organization.

## Files & Structure

```
.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── milestones/
│   ├── v1.0-ROADMAP.md       # Archived roadmap snapshot
│   ├── v1.0-REQUIREMENTS.md  # Archived requirements
│   └── v1.0-phases/          # Archived phase dirs (via /bgsd-cleanup or --archive-phases)
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

**Interactive** — Confirms decisions, pauses at checkpoints.
**YOLO** — Auto-approves, only stops for critical checkpoints.

Set during `/bgsd plan project`. Change via `.planning/config.json`.

## Planning Configuration

**`planning.commit_docs`** (default: `true`) — `false` keeps planning local-only (add `.planning/` to `.gitignore`).
**`planning.search_gitignored`** (default: `false`) — `true` adds `--no-ignore` to broad rg searches.

## Common Workflows

**Starting a new project:**

```
/bgsd plan project    # Unified flow: questioning → research → requirements → roadmap
/clear
/bgsd plan phase 1   # Create plans for first phase
/clear
/bgsd exec phase 1   # Execute all plans in phase
```

**Resuming work after a break:**

```
/bgsd session progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/bgsd roadmap insert 5 "Critical security fix"
/bgsd plan phase 5.1
/bgsd exec phase 5.1
```

**Completing a milestone:**

```
/bgsd milestone complete 1.0.0
/clear
/bgsd milestone new      # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/bgsd todo add                    # Capture from conversation context
/bgsd todo add Fix modal z-index  # Capture with explicit description
/bgsd todo check                  # Review and work on todos
/bgsd todo check api              # Filter by area
```

**Debugging an issue:**

```
/bgsd debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/bgsd debug                                    # Resume from where you left off
```

## Getting Help

Read `.planning/PROJECT.md` (vision), `.planning/STATE.md` (context), `.planning/ROADMAP.md` (status), or run `/bgsd-progress`.
</reference>
