# Workflows

bGSD workflows are markdown files that define step-by-step behavior for AI agents. They are the bridge between slash commands and the CLI tool — workflows read context from `gsd-tools.cjs`, make decisions, and spawn specialized agents.

---

## How Workflows Work

```
User types /bgsd-plan phase 1
  → OpenCode loads workflows/plan-phase.md
  → AI follows step-by-step instructions
  → Calls gsd-tools.cjs for structured data (JSON)
  → Spawns subagents for specialized work
  → Produces output files (.planning/phases/...)
```

Workflows are **not code**. They are prompts that any LLM can follow. The deterministic logic lives in `gsd-tools.cjs`; workflows handle reasoning and coordination.

---

## Workflow Categories

### Project Initialization (5 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `new-project.md` | `/bgsd-new-project` | Full project initialization: questioning, research (5 parallel agents), requirements, roadmap |
| `map-codebase.md` | `/bgsd-map-codebase` | Spawns 4 parallel codebase mapper agents to analyze existing code |
| `discovery-phase.md` | (internal) | Research phase within planning — quick verify, standard, or deep dive |
| `help.md` | `/bgsd-help` | Displays complete command reference |
| `update.md` | `/bgsd-update` | Checks for and installs updates |

### Phase Planning (5 workflows)

Canonical docs should teach `/bgsd-plan ...` first. Older planning aliases may still resolve for compatibility, but they are no longer the preferred path.

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `plan-phase.md` | `/bgsd-plan phase [phase]` | Creates PLAN.md files: optional research → planner agent → plan-checker review |
| `discuss-phase.md` | `/bgsd-plan discuss [phase]` | Interactive decision gathering, produces CONTEXT.md |
| `list-phase-assumptions.md` | `/bgsd-plan assumptions [phase]` | Surfaces AI assumptions (conversational, no files created) |
| `research-phase.md` | `/bgsd-plan research [phase]` | Spawns phase researcher for domain investigation |
| `tdd.md` | (internal) | TDD plan execution workflow (RED-GREEN-REFACTOR state machine) |

### Execution (4 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `execute-phase.md` | `/bgsd-execute-phase` | Wave-based plan execution with parallel agents, verification |
| `execute-plan.md` | (internal) | Single plan execution: task loop, commits, checkpoints, review |
| `quick.md` | `/bgsd-quick` | Minimal-ceremony task execution with GSD guarantees |
| `github-ci.md` | `/bgsd-github-ci` | Push branch, create PR, monitor code scanning, fix/dismiss, auto-merge |

### Verification (3 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `verify-phase.md` | (internal) | Automated phase goal verification via gsd-verifier |
| `verify-work.md` | `/bgsd-verify-work` | Interactive UAT with gap tracking and fix plan generation |
| `transition.md` | (internal) | Phase completion transitions |

### Milestone Management (4 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `new-milestone.md` | `/bgsd-new-milestone` | Start new milestone: questioning, research, requirements, roadmap |
| `complete-milestone.md` | `/bgsd-complete-milestone` | Archive milestone, create historical record, tag release |
| `audit-milestone.md` | `/bgsd-audit-milestone` | Cross-phase integration check via gsd-verifier |
| `plan-milestone-gaps.md` | `/bgsd-plan gaps [phase]` | Create fix phases for audit gaps |

### Roadmap Management (3 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `add-phase.md` | `/bgsd-plan roadmap add "Description"` | Append new phase to current milestone |
| `insert-phase.md` | `/bgsd-plan roadmap insert <after-phase> "Description"` | Insert decimal phase (e.g., 3.1 between 3 and 4) |
| `remove-phase.md` | `/bgsd-plan roadmap remove <phase>` | Remove unstarted phase and renumber |

### Session Management (3 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `resume-project.md` | `/bgsd-resume` | Restore context from previous session |
| `pause-work.md` | `/bgsd-pause` | Create handoff file (.continue-here.md) |
| `progress.md` | `/bgsd-inspect progress` | Show progress, intelligently route to next action |

### Todo Management (2 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `add-todo.md` | `/bgsd-plan todo add "task"` | Capture idea/task from current conversation |
| `check-todos.md` | `/bgsd-plan todo check` | List and work on pending todos |

### Configuration (3 workflows)

Canonical docs should teach `/bgsd-settings ...` first. Legacy settings aliases remain reference-only compatibility routes.

Reference-only compatibility note: older planning, roadmap, todo, progress, and settings aliases may still exist for parity, but user-followable guidance should prefer the canonical `/bgsd-plan ...`, `/bgsd-settings ...`, and `/bgsd-inspect ...` families above.

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `settings.md` | `/bgsd-settings` | Interactive workflow configuration |
| `set-profile.md` | `/bgsd-settings profile quality` | Quick model profile switch |
| `health.md` | `/bgsd-inspect health` | Check .planning/ integrity, optionally repair |

### Debugging (1 workflow)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `diagnose-issues.md` | `/bgsd-debug` | Systematic debugging with persistent state |

### Utility (2 workflows)

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `cleanup.md` | `/bgsd-cleanup` | Archive completed milestone phase directories |
| `complete-and-clear.md` | (internal) | Session summary + clean handoff |

### Slash Command Workflows (11 workflows)

These are thin wrappers that call `bgsd-tools.cjs` for data and format the output:

| Workflow | Command | What It Does |
|----------|---------|-------------|
| `cmd-velocity.md` | `/bgsd-inspect velocity` | Execution velocity metrics and completion forecast |
| `cmd-codebase-impact.md` | `/bgsd-inspect impact bin/bgsd-tools.cjs` | Module dependencies and blast radius analysis |
| `cmd-context-budget.md` | `/bgsd-inspect context-budget 159-12` | Token usage estimation for plan files |
| `cmd-rollback-info.md` | `/bgsd-inspect rollback-info 159-12` | Commits and revert command for a plan |
| `cmd-search-decisions.md` | `/bgsd-inspect search decisions "query"` | Search past decisions across STATE.md and archives |
| `cmd-search-lessons.md` | `/bgsd-inspect search lessons "query"` | Search completed phase lessons for patterns |
| `cmd-session-diff.md` | `/bgsd-inspect session-diff` | Git commits since last session activity |
| `cmd-test-run.md` | `/bgsd-test-run` | Parse test output with pass/fail gating |
| `cmd-trace-requirement.md` | `/bgsd-inspect trace CMD-04` | Trace requirement from spec to files on disk |
| `cmd-validate-config.md` | `/bgsd-settings validate .planning/config.json` | Schema validation for config.json |
| `cmd-validate-deps.md` | `/bgsd-inspect validate-deps 159` | Phase dependency graph validation |

---

## Workflow Data Flow

### Context Injection

Every workflow starts by calling an `init` command to get all necessary context:

```bash
node bin/bgsd-tools.cjs init:plan-phase 1 --raw
```

This returns a compound JSON object with state, roadmap, config, codebase intelligence, memory, and session continuity — everything the workflow needs in one call.

### Agent Spawning

Workflows spawn agents via `Task()`:

```
Task(
  prompt="You are the gsd-planner agent. Create plans for Phase 1.
          Context: {init_json}
          Phase goal: {roadmap_phase.goal}",
  subagent_type="gsd-planner",
  model="{planner_model}"
)
```

### Result Handling

Agents write output to files. Workflows read those files to determine next steps:

```
Planner writes PLAN.md → Workflow reads → Spawns plan-checker
Plan-checker approves → Workflow reports success
Plan-checker requests revision → Workflow re-spawns planner (max 3 cycles)
```

---

## Key Workflow Patterns

### Parallel Agent Spawning

Several workflows spawn multiple agents simultaneously:

```
/bgsd-new-project:
  Spawn 5x gsd-project-researcher in parallel
    → Stack researcher
    → Features researcher
    → Architecture researcher
    → Pitfalls researcher
    → Skills researcher
  Wait for all 5 to complete
  Spawn 1x gsd-roadmapper to synthesize and create roadmap
```

### Wave Execution

```
/bgsd-execute-phase:
  Read plan index → Group by wave
  Wave 1: Spawn agents for plans with wave=1 (parallel)
  Wait for Wave 1 completion
  Wave 2: Spawn agents for plans with wave=2 (parallel)
  ...
  After all waves: Spawn gsd-verifier
```

### Quality Review Loop

```
/bgsd-plan phase [phase]:
  Spawn gsd-planner → Creates PLAN.md
  Spawn gsd-plan-checker → Reviews PLAN.md
  If revision needed:
    Re-spawn gsd-planner with feedback
    Re-spawn gsd-plan-checker
    (max 3 cycles)
```

### TDD State Machine

```
/bgsd-execute-phase (for type: tdd plans):
  RED phase:
    Write failing test → Run tests → Verify failure
    Commit with GSD-Phase: red trailer
  GREEN phase:
    Write minimal implementation → Run tests → Verify pass
    Commit with GSD-Phase: green trailer
  REFACTOR phase:
    Clean up code → Run tests → Verify still passing
    Commit with GSD-Phase: refactor trailer
```

### Session Continuity

```
/bgsd-pause:
  Read STATE.md → Capture current context
  Write .continue-here.md with position + mental context

/bgsd-resume:
  Read .continue-here.md → Restore context
  Read STATE.md → Verify position
  Route to next action
```

---

## Workflow Configuration

Workflows respect settings in `.planning/config.json`:

| Setting | Affects |
|---------|---------|
| `mode: "yolo"` | Auto-approves human-verify checkpoints |
| `research: false` | Skips research phase in planning |
| `plan_checker: false` | Skips plan quality review |
| `verifier: false` | Skips phase verification |
| `parallelization: true` | Enables parallel plan execution within waves |
| `test_gate: true` | Blocks execution on test failure |

---

## Adding Custom Workflows

Workflows are markdown files in the `workflows/` directory. To add a custom workflow:

1. Create a `.md` file in `workflows/`
2. Define step-by-step instructions the AI will follow
3. Call `bgsd-tools.cjs` commands for structured data
4. Create a slash command wrapper in `commands/` that references the workflow

---

*For the agents that workflows spawn, see [Agents](agents.md). For the CLI commands workflows call, see [Commands](commands.md).*
