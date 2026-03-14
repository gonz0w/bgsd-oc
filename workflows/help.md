<purpose>
Display the complete bGSD command reference. Output ONLY the reference content — no project-specific analysis, git status, or commentary.
</purpose>

<reference>
# bGSD Command Reference

**bGSD** (Get Stuff Done) creates hierarchical project plans optimized for solo agentic development with the host editor.

## Quick Start

1. `/bgsd-new-project` - Initialize project (includes research, requirements, roadmap)
2. `/bgsd-plan-phase 1` - Create detailed plan for first phase
3. `/bgsd-execute-phase 1` - Execute the phase

## Commands

### Project Lifecycle

| Command | Description |
|---------|-------------|
| `/bgsd-new-project` | Initialize new project with research, requirements, roadmap |
| `/bgsd-new-milestone` | Start a new milestone |
| `/bgsd-complete-milestone` | Complete current milestone and archive |
| `/bgsd-progress` | Show progress, recent work, current position |
| `/bgsd-resume` | Restore full context from previous session |
| `/bgsd-pause` | Create .continue-here handoff |

### Planning

| Command | Description |
|---------|-------------|
| `/bgsd-discuss-phase [n]` | Capture vision and decisions for a phase |
| `/bgsd-research-phase [n]` | Ecosystem research for niche domains |
| `/bgsd-list-assumptions [n]` | See agent's intended approach before planning |
| `/bgsd-plan-phase [n]` | Create execution plan for a phase |

### Execution

| Command | Description |
|---------|-------------|
| `/bgsd-execute-phase [n]` | Execute all plans in a phase |
| `/bgsd-quick-task` | Execute small, ad-hoc tasks |
| `/bgsd-github-ci` | Push branch, create PR, run code scanning, auto-merge |

### Verification & Debugging

| Command | Description |
|---------|-------------|
| `/bgsd-verify-work [phase]` | Conversational UAT — validate built features |
| `/bgsd-debug [issue]` | Systematic debugging with persistent state |
| `/bgsd-audit-milestone` | Audit milestone against intent |
| `/bgsd-plan-gaps` | Create phases from audit gaps |

### Roadmap Management

| Command | Description |
|---------|-------------|
| `/bgsd-add-phase [desc]` | Append new phase to current milestone |
| `/bgsd-insert-phase [after] [desc]` | Insert decimal phase between existing |
| `/bgsd-remove-phase [n]` | Remove future phase |

### Todo Management

| Command | Description |
|---------|-------------|
| `/bgsd-add-todo [task]` | Capture idea/task as structured todo |
| `/bgsd-check-todos [area]` | List pending todos, select to work on |

### Configuration

| Command | Description |
|---------|-------------|
| `/bgsd-settings` | Configure workflow toggles and model profile |
| `/bgsd-set-profile [name]` | Switch model profile (quality/balanced/budget) |
| `/bgsd-validate-config` | Validate config.json schema |

### Analysis & Diagnostics

| Command | Description |
|---------|-------------|
| `/bgsd-health` | Project health check |
| `/bgsd-velocity` | Execution velocity metrics and forecast |
| `/bgsd-impact` | Module dependencies and blast radius |
| `/bgsd-context-budget` | Token usage estimation for plans |
| `/bgsd-map-codebase` | Map existing codebase with parallel agents |
| `/bgsd-validate-deps` | Phase dependency graph validation |
| `/bgsd-test-run` | Parse test output with pass/fail gating |

### Search & History

| Command | Description |
|---------|-------------|
| `/bgsd-trace [req]` | Trace requirement from spec to files |
| `/bgsd-search-decisions [query]` | Search past decisions |
| `/bgsd-search-lessons [query]` | Search completed phase lessons |
| `/bgsd-session-diff` | Git commits since last session |
| `/bgsd-rollback-info` | Commits and revert command for a plan |

### Maintenance

| Command | Description |
|---------|-------------|
| `/bgsd-cleanup` | Archive phase directories from completed milestones |
| `/bgsd-update` | Update bGSD with changelog preview |
| `/bgsd-help` | Show this reference |

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

Set during `/bgsd-new-project`. Change via `.planning/config.json`.

## Planning Configuration

**`planning.commit_docs`** (default: `true`) — `false` keeps planning local-only (add `.planning/` to `.gitignore`).
**`planning.search_gitignored`** (default: `false`) — `true` adds `--no-ignore` to broad rg searches.

## Common Workflows

**Starting a new project:**

```
/bgsd-new-project    # Unified flow: questioning → research → requirements → roadmap
/clear
/bgsd-plan-phase 1   # Create plans for first phase
/clear
/bgsd-execute-phase 1   # Execute all plans in phase
```

**Resuming work after a break:**

```
/bgsd-progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/bgsd-insert-phase 5 "Critical security fix"
/bgsd-plan-phase 5.1
/bgsd-execute-phase 5.1
```

**Completing a milestone:**

```
/bgsd-complete-milestone 1.0.0
/clear
/bgsd-new-milestone      # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/bgsd-add-todo                    # Capture from conversation context
/bgsd-add-todo Fix modal z-index  # Capture with explicit description
/bgsd-check-todos                  # Review and work on todos
/bgsd-check-todos api              # Filter by area
```

**Debugging an issue:**

```
/bgsd-debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/bgsd-debug                                    # Resume from where you left off
```

## Getting Help

Read `.planning/PROJECT.md` (vision), `.planning/STATE.md` (context), `.planning/ROADMAP.md` (status), or run `/bgsd-progress`.
</reference>
