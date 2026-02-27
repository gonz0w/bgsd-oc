<purpose>
Display the complete bGSD command reference. Output ONLY the reference content — no project-specific analysis, git status, or commentary.
</purpose>

<reference>
# bGSD Command Reference

**bGSD** (Get Stuff Done) creates hierarchical project plans optimized for solo agentic development with OpenCode.

## Quick Start

1. `/gsd-new-project` - Initialize project (includes research, requirements, roadmap)
2. `/gsd-plan-phase 1` - Create detailed plan for first phase
3. `/gsd-execute-phase 1` - Execute the phase

## Staying Updated

bGSD evolves fast. Update periodically:

```bash
npx get-shit-done-cc@latest
```

## Core Workflow

```
/gsd-new-project → /gsd-plan-phase → /gsd-execute-phase → repeat
```

### Project Initialization

**`/gsd-new-project`**
Initialize new project through unified flow.

Deep questioning → optional research → requirements → roadmap. Creates all `.planning/` artifacts (PROJECT.md, config.json, research/, REQUIREMENTS.md, ROADMAP.md, STATE.md).

Usage: `/gsd-new-project`

**`/gsd-map-codebase`**
Map existing codebase with parallel agents → `.planning/codebase/` (7 docs: stack, architecture, structure, conventions, testing, integrations, concerns). Use before `/gsd-new-project` on existing codebases.

Usage: `/gsd-map-codebase`

### Phase Planning

**`/gsd-discuss-phase <number>`**
Capture your vision for a phase → creates CONTEXT.md with decisions and boundaries.
Usage: `/gsd-discuss-phase 2`

**`/gsd-research-phase <number>`**
Ecosystem research for niche domains → RESEARCH.md with stack, patterns, pitfalls.
Usage: `/gsd-research-phase 3`

**`/gsd-list-phase-assumptions <number>`**
See agent's intended approach before planning. Conversational only, no files.
Usage: `/gsd-list-phase-assumptions 3`

**`/gsd-plan-phase <number>`**
Create execution plan → `.planning/phases/XX-name/XX-YY-PLAN.md` with tasks, verification, success criteria.
Usage: `/gsd-plan-phase 1`

### Execution

**`/gsd-execute-phase <phase-number>`**
Execute all plans in a phase. Waves sequential, plans within waves parallel. Verifies phase goal, updates REQUIREMENTS/ROADMAP/STATE.
Usage: `/gsd-execute-phase 5`

### Quick Mode

**`/gsd-quick`**
Execute small, ad-hoc tasks with bGSD guarantees but skip optional agents.

Planner + executor only (skips researcher, checker, verifier). Tasks in `.planning/quick/`. Updates STATE.md, not ROADMAP.md.
Usage: `/gsd-quick`

### Roadmap Management

**`/gsd-add-phase <description>`**
Append new phase to current milestone. Usage: `/gsd-add-phase "Add admin dashboard"`

**`/gsd-insert-phase <after> <description>`**
Insert decimal phase between existing (e.g., 7.1). Usage: `/gsd-insert-phase 7 "Fix critical auth bug"`

**`/gsd-remove-phase <number>`**
Remove future phase, renumber subsequent. Usage: `/gsd-remove-phase 17`

### Milestone Management

**`/gsd-new-milestone <name>`**
Start new milestone: questioning → research → requirements → roadmap. Mirrors `/gsd-new-project` for brownfield.
Usage: `/gsd-new-milestone "v2.0 Features"`

**`/gsd-complete-milestone <version>`**
Archive milestone (MILESTONES.md entry, git tag, workspace cleanup).
Usage: `/gsd-complete-milestone 1.0.0`

### Progress Tracking

**`/gsd-progress`**
Show progress, recent work, current position, decisions, issues. Routes to next action.
Usage: `/gsd-progress`

### Session Management

**`/gsd-resume-work`**
Restore full context from previous session. Shows position, offers next actions.
Usage: `/gsd-resume-work`

**`/gsd-pause-work`**
Create .continue-here handoff with current state. Updates STATE.md.
Usage: `/gsd-pause-work`

### Debugging

**`/gsd-debug [issue description]`**
Systematic debugging with persistent state. Creates `.planning/debug/[slug].md`. Survives `/clear`.
Usage: `/gsd-debug "login button doesn't work"` or `/gsd-debug` (resume)

### Todo Management

**`/gsd-add-todo [description]`**
Capture idea/task as structured todo in `.planning/todos/pending/`. Infers area, checks duplicates.
Usage: `/gsd-add-todo` or `/gsd-add-todo Add auth token refresh`

**`/gsd-check-todos [area]`**
List pending todos, select one to work on. Optional area filter.
Usage: `/gsd-check-todos` or `/gsd-check-todos api`

### User Acceptance Testing

**`/gsd-verify-work [phase]`**
Conversational UAT — extracts testable deliverables, diagnoses failures, creates fix plans.
Usage: `/gsd-verify-work 3`

### Milestone Auditing

**`/gsd-audit-milestone [version]`**
Audit milestone against intent. Checks requirements, integration, creates MILESTONE-AUDIT.md.
Usage: `/gsd-audit-milestone`

**`/gsd-plan-milestone-gaps`**
Create phases from audit gaps. Prioritizes must/should/nice, adds to ROADMAP.md.
Usage: `/gsd-plan-milestone-gaps`

### Configuration

**`/gsd-settings`**
Configure workflow toggles and model profile. Updates `.planning/config.json`.
Usage: `/gsd-settings`

**`/gsd-set-profile <profile>`**
Switch model profile: quality (Opus everywhere) / balanced (default) / budget (Sonnet+Haiku).
Usage: `/gsd-set-profile budget`

### Utility Commands

**`/gsd-cleanup`**
Archive phase directories from completed milestones to reduce clutter.
Usage: `/gsd-cleanup`

**`/gsd-help`** — Show this reference.

**`/gsd-update`** — Update bGSD with changelog preview. Usage: `/gsd-update`

**`/gsd-join-discord`** — Join bGSD Discord community. Usage: `/gsd-join-discord`

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
│   └── v1.0-phases/          # Archived phase dirs (via /gsd-cleanup or --archive-phases)
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

Set during `/gsd-new-project`. Change via `.planning/config.json`.

## Planning Configuration

**`planning.commit_docs`** (default: `true`) — `false` keeps planning local-only (add `.planning/` to `.gitignore`).
**`planning.search_gitignored`** (default: `false`) — `true` adds `--no-ignore` to broad rg searches.

## Common Workflows

**Starting a new project:**

```
/gsd-new-project        # Unified flow: questioning → research → requirements → roadmap
/clear
/gsd-plan-phase 1       # Create plans for first phase
/clear
/gsd-execute-phase 1    # Execute all plans in phase
```

**Resuming work after a break:**

```
/gsd-progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/gsd-insert-phase 5 "Critical security fix"
/gsd-plan-phase 5.1
/gsd-execute-phase 5.1
```

**Completing a milestone:**

```
/gsd-complete-milestone 1.0.0
/clear
/gsd-new-milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/gsd-add-todo                    # Capture from conversation context
/gsd-add-todo Fix modal z-index  # Capture with explicit description
/gsd-check-todos                 # Review and work on todos
/gsd-check-todos api             # Filter by area
```

**Debugging an issue:**

```
/gsd-debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/gsd-debug                                    # Resume from where you left off
```

## Getting Help

Read `.planning/PROJECT.md` (vision), `.planning/STATE.md` (context), `.planning/ROADMAP.md` (status), or run `/gsd-progress`.
</reference>
