<purpose>
Display the compact canonical bGSD help surface. Output ONLY the reference content — no project-specific analysis, git status, or commentary.
</purpose>

<reference>
# bGSD Help

**bGSD** (Better Getting Stuff Done) gives you a small default path, then deeper command families when you need them.

## Core Path

Run these in order for the common project loop:

1. `/bgsd-new-project` — initialize research, requirements, roadmap, and planning state
2. `/bgsd-plan phase 12` — create the plan for the phase you want to execute
3. `/bgsd-execute-phase 12` — run that phase's plans
4. `/bgsd-review` — scan the current change for code-review issues before shipping
5. `/bgsd-inspect progress` — see where the project stands and what to do next

## Advanced Command Families

Use these when you need a specific workflow beyond the core path.

### Planning

| Need | Run |
|------|-----|
| Capture phase decisions before planning | `/bgsd-plan discuss 12` |
| Research a phase before planning | `/bgsd-plan research 12` |
| Inspect planning assumptions | `/bgsd-plan assumptions 12` |
| Turn audit gaps into follow-on phases | `/bgsd-plan gaps 12` |
| Insert urgent roadmap work | `/bgsd-plan roadmap insert 12 "Critical security fix"` |
| Capture a plan-scoped todo | `/bgsd-plan todo add "Fix modal z-index"` |

### Verification & Debugging

| Need | Run |
|------|-----|
| Validate completed work with conversational UAT | `/bgsd-verify-work 12` |
| Start or resume a structured debugging session | `/bgsd-debug "form submission fails silently"` |
| Audit the active milestone against intent | `/bgsd-audit-milestone` |

### Settings & Inspection

| Need | Run |
|------|-----|
| Switch model profile | `/bgsd-settings profile quality` |
| Validate config | `/bgsd-settings validate .planning/config.json` |
| Check project health | `/bgsd-inspect health` |
| Inspect execution velocity | `/bgsd-inspect velocity` |
| Trace a requirement to files | `/bgsd-inspect trace CMD-04` |

### Lifecycle & Maintenance

| Need | Run |
|------|-----|
| Start the next milestone | `/bgsd-new-milestone` |
| Complete the active milestone | `/bgsd-complete-milestone 1.0.0` |
| Restore previous session context | `/bgsd-resume` |
| Pause with a handoff file | `/bgsd-pause` |
| Update bGSD | `/bgsd-update` |
| Archive completed milestone phases | `/bgsd-cleanup` |
| Show this help again | `/bgsd-help` |

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
/bgsd-plan phase 1   # Create plans for the first phase
/clear
/bgsd-execute-phase 1   # Execute all plans in phase
/clear
/bgsd-review            # Review the current change before shipping
```

**Resuming work after a break:**

```
/bgsd-inspect progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/bgsd-plan roadmap insert 5 "Critical security fix"
/bgsd-plan phase 5.1
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
/bgsd-plan todo add                    # Capture from conversation context
/bgsd-plan todo add Fix modal z-index  # Capture with explicit description
/bgsd-plan todo check                  # Review and work on todos
/bgsd-plan todo check api              # Filter by area
```

**Debugging an issue:**

```
/bgsd-debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/bgsd-debug                                    # Resume from where you left off
```

## Getting Help

Read `.planning/PROJECT.md` (vision), `.planning/STATE.md` (context), `.planning/ROADMAP.md` (status), or run `/bgsd-inspect progress`.
</reference>
