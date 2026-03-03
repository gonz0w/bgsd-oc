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

## Staying Updated

bGSD evolves fast. Update periodically by pulling the latest and redeploying:

```bash
cd $GSD_DEV_DIR && git pull && npm run build && ./deploy.sh
```

## Core Workflow

```
/bgsd-new-project → /bgsd-plan-phase → /bgsd-execute-phase → repeat
```

### Project Initialization

**`/bgsd-new-project`**
Initialize new project through unified flow.

Deep questioning → optional research → requirements → roadmap. Creates all `.planning/` artifacts (PROJECT.md, config.json, research/, REQUIREMENTS.md, ROADMAP.md, STATE.md).

Usage: `/bgsd-new-project`

**`/bgsd-map-codebase`**
Map existing codebase with parallel agents → `.planning/codebase/` (7 docs: stack, architecture, structure, conventions, testing, integrations, concerns). Use before `/bgsd-new-project` on existing codebases.

Usage: `/bgsd-map-codebase`

### Phase Planning

**`/bgsd-discuss-phase <number>`**
Capture your vision for a phase → creates CONTEXT.md with decisions and boundaries.
Usage: `/bgsd-discuss-phase 2`

**`/bgsd-research-phase <number>`**
Ecosystem research for niche domains → RESEARCH.md with stack, patterns, pitfalls.
Usage: `/bgsd-research-phase 3`

**`/bgsd-list-phase-assumptions <number>`**
See agent's intended approach before planning. Conversational only, no files.
Usage: `/bgsd-list-phase-assumptions 3`

**`/bgsd-plan-phase <number>`**
Create execution plan → `.planning/phases/XX-name/XX-YY-PLAN.md` with tasks, verification, success criteria.
Usage: `/bgsd-plan-phase 1`

### Execution

**`/bgsd-execute-phase <phase-number>`**
Execute all plans in a phase. Waves sequential, plans within waves parallel. Verifies phase goal, updates REQUIREMENTS/ROADMAP/STATE.
Usage: `/bgsd-execute-phase 5`

### Quick Mode

**`/bgsd-quick`**
Execute small, ad-hoc tasks with bGSD guarantees but skip optional agents.

Planner + executor only (skips researcher, checker, verifier). Tasks in `.planning/quick/`. Updates STATE.md, not ROADMAP.md.
Usage: `/bgsd-quick`

### Roadmap Management

**`/bgsd-add-phase <description>`**
Append new phase to current milestone. Usage: `/bgsd-add-phase "Add admin dashboard"`

**`/bgsd-insert-phase <after> <description>`**
Insert decimal phase between existing (e.g., 7.1). Usage: `/bgsd-insert-phase 7 "Fix critical auth bug"`

**`/bgsd-remove-phase <number>`**
Remove future phase, renumber subsequent. Usage: `/bgsd-remove-phase 17`

### Milestone Management

**`/bgsd-new-milestone <name>`**
Start new milestone: questioning → research → requirements → roadmap. Mirrors `/bgsd-new-project` for brownfield.
Usage: `/bgsd-new-milestone "v2.0 Features"`

**`/bgsd-complete-milestone <version>`**
Archive milestone (MILESTONES.md entry, git tag, workspace cleanup).
Usage: `/bgsd-complete-milestone 1.0.0`

### Progress Tracking

**`/bgsd-progress`**
Show progress, recent work, current position, decisions, issues. Routes to next action.
Usage: `/bgsd-progress`

### Session Management

**`/bgsd-resume-work`**
Restore full context from previous session. Shows position, offers next actions.
Usage: `/bgsd-resume-work`

**`/bgsd-pause-work`**
Create .continue-here handoff with current state. Updates STATE.md.
Usage: `/bgsd-pause-work`

### Debugging

**`/bgsd-debug [issue description]`**
Systematic debugging with persistent state. Creates `.planning/debug/[slug].md`. Survives `/clear`.
Usage: `/bgsd-debug "login button doesn't work"` or `/bgsd-debug` (resume)

### Todo Management

**`/bgsd-add-todo [description]`**
Capture idea/task as structured todo in `.planning/todos/pending/`. Infers area, checks duplicates.
Usage: `/bgsd-add-todo` or `/bgsd-add-todo Add auth token refresh`

**`/bgsd-check-todos [area]`**
List pending todos, select one to work on. Optional area filter.
Usage: `/bgsd-check-todos` or `/bgsd-check-todos api`

### User Acceptance Testing

**`/bgsd-verify-work [phase]`**
Conversational UAT — extracts testable deliverables, diagnoses failures, creates fix plans.
Usage: `/bgsd-verify-work 3`

### Milestone Auditing

**`/bgsd-audit-milestone [version]`**
Audit milestone against intent. Checks requirements, integration, creates MILESTONE-AUDIT.md.
Usage: `/bgsd-audit-milestone`

**`/bgsd-plan-milestone-gaps`**
Create phases from audit gaps. Prioritizes must/should/nice, adds to ROADMAP.md.
Usage: `/bgsd-plan-milestone-gaps`

### Configuration

**`/bgsd-settings`**
Configure workflow toggles and model profile. Updates `.planning/config.json`.
Usage: `/bgsd-settings`

**`/bgsd-set-profile <profile>`**
Switch model profile: quality (Opus everywhere) / balanced (default) / budget (Sonnet+Haiku).
Usage: `/bgsd-set-profile budget`

### Utility Commands

**`/bgsd-cleanup`**
Archive phase directories from completed milestones to reduce clutter.
Usage: `/bgsd-cleanup`

**`/bgsd-help`** — Show this reference.

**`/bgsd-update`** — Update bGSD with changelog preview. Usage: `/bgsd-update`

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
/bgsd-new-project        # Unified flow: questioning → research → requirements → roadmap
/clear
/bgsd-plan-phase 1       # Create plans for first phase
/clear
/bgsd-execute-phase 1    # Execute all plans in phase
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
/bgsd-new-milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/bgsd-add-todo                    # Capture from conversation context
/bgsd-add-todo Fix modal z-index  # Capture with explicit description
/bgsd-check-todos                 # Review and work on todos
/bgsd-check-todos api             # Filter by area
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
