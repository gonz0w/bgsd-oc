# Getting Started with bGSD

This guide walks you through your first project using the easy flow. bGSD handles the complexity — you just answer questions and approve plans.

## Prerequisites

- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured
- Node.js >= 18

## Installation

```bash
git clone https://github.com/gonz0w/bgsd-oc.git
cd bgsd-oc
npm install && npm run build
./deploy.sh
```

This installs bGSD into your OpenCode configuration. Restart OpenCode to pick up the new commands.

## Your First Project

### Step 1: Start a New Project

Open a terminal in your project directory and launch OpenCode. Then:

```
/gsd-new-project
```

bGSD asks you one question: **"What do you want to build?"**

Describe your project in plain language. bGSD follows up with clarifying questions to understand scope, users, and constraints. This typically takes 3-5 questions.

**What happens behind the scenes:**
1. bGSD creates `.planning/PROJECT.md` capturing your vision
2. Creates `INTENT.md` with structured outcomes and success criteria
3. Optionally runs parallel research (4 AI agents researching stack, features, architecture, and pitfalls)
4. Generates `REQUIREMENTS.md` with checkable items (REQ-01, REQ-02, etc.)
5. Creates `ROADMAP.md` breaking the project into phases with goals and dependencies

At the end, you'll see something like:

```
Created .planning/:
  PROJECT.md       - Project definition
  INTENT.md        - Desired outcomes and success criteria
  REQUIREMENTS.md  - 12 requirements (REQ-01 through REQ-12)
  ROADMAP.md       - 5 phases with goals and dependencies
  STATE.md         - Project state tracker
  config.json      - Workflow configuration

Next up: /gsd-plan-phase 1
```

### Step 2: Plan the First Phase

```
/gsd-plan-phase 1
```

bGSD reads your roadmap, understands the phase goal, and creates executable plans. Each plan is a detailed task breakdown with:

- Numbered tasks with clear instructions
- File paths and code patterns to follow
- Dependencies between tasks
- Wave assignments for parallel execution
- `must_haves` — what must be true when the plan is done

Plans go through a quality review (gsd-plan-checker agent) with up to 3 revision cycles.

**Output:** One or more `PLAN.md` files in `.planning/phases/01-*/`

### Step 3: Execute the Phase

```
/gsd-execute-phase 1
```

bGSD executes all plans in the phase:

1. Validates dependencies between plans
2. Groups plans into waves (independent plans run in parallel)
3. Spawns executor agents for each plan
4. Each task gets an atomic git commit
5. Creates `SUMMARY.md` documenting what was built
6. Runs phase verification (did we actually achieve the goal?)

You'll see progress as plans complete:

```
Wave 1: [01-01 COMPLETE] [01-02 COMPLETE]
Wave 2: [01-03 IN PROGRESS]
```

### Step 4: Check Progress

```
/gsd-progress
```

Shows milestone progress, recent work, and intelligently routes you to the next action:

- More plans to execute? Routes to `/gsd-execute-phase`
- Phase needs planning? Routes to `/gsd-plan-phase`
- All phases done? Routes to `/gsd-complete-milestone`

### Step 5: Continue Through Phases

Repeat the plan-execute cycle for each phase:

```
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-plan-phase 3
/gsd-execute-phase 3
...
```

Or let bGSD auto-advance by setting YOLO mode:

```
/gsd-settings
# Set mode to "yolo" — bGSD auto-continues between phases
```

### Step 6: Complete the Milestone

When all phases are done:

```
/gsd-complete-milestone
```

bGSD archives the milestone, creates a historical record in `MILESTONES.md`, tags the release in git, and prepares for the next milestone.

---

## Session Management

### Pausing Work

Need to stop mid-phase?

```
/gsd-pause-work
```

Creates a `.continue-here.md` file capturing exactly where you are, what's done, what's remaining, and your current mental context.

### Resuming Work

Next session:

```
/gsd-resume-work
```

bGSD reads the handoff file and restores full context. You're back exactly where you left off.

### Quick Tasks

Need to do something small outside the main plan?

```
/gsd-quick Fix the login button alignment
```

Creates a minimal plan, executes it, commits with tracking — all with bGSD's guarantees but without the full ceremony.

---

## Exploring Approaches with Trajectory Engineering

When you're unsure which implementation approach to take, bGSD's trajectory system lets you checkpoint, explore, and compare — instead of guessing.

### Basic Flow: Try Two Approaches

```bash
# 1. You've written some code for approach A. Checkpoint it:
node bin/gsd-tools.cjs trajectory checkpoint auth-flow --description "JWT tokens with refresh"

# 2. Keep coding — try approach B instead. Checkpoint again:
node bin/gsd-tools.cjs trajectory checkpoint auth-flow --description "Session-based with Redis"

# 3. See all your checkpoints with auto-collected metrics:
node bin/gsd-tools.cjs trajectory list
```

The `trajectory list` command shows a table with:
- Test results (pass/fail count) at each checkpoint
- Lines of code added/removed
- Code complexity scores
- When each checkpoint was created

### Comparing and Choosing

Compare metrics across all your attempts:

```bash
# Side-by-side comparison (best values highlighted green, worst red)
node bin/gsd-tools.cjs trajectory compare auth-flow
```

### Pivoting When Something Isn't Working

If approach B isn't working and you want to go back to approach A:

```bash
# Pivot back with a reason (auto-archives current work, rewinds to checkpoint)
node bin/gsd-tools.cjs trajectory pivot auth-flow --reason "Session approach too complex for our API"
```

This automatically:
1. Archives your current work as an abandoned attempt
2. Rewinds source code to the checkpoint (preserves `.planning/`, `package.json`, etc.)
3. Records the reason in the trajectory journal

### Choosing the Winner

When you've decided on the best approach:

```bash
# Merge the winner, archive alternatives as tags, clean up branches
node bin/gsd-tools.cjs trajectory choose auth-flow --attempt 1 --reason "Better test coverage"
```

### Scoping Checkpoints

Use `--scope` to organize checkpoints by granularity:

```bash
# Phase-level (default)
node bin/gsd-tools.cjs trajectory checkpoint my-feature --scope phase

# Task-level
node bin/gsd-tools.cjs trajectory checkpoint db-schema --scope task

# Filter by scope when listing
node bin/gsd-tools.cjs trajectory list --scope task
```

### Recording Exploration Notes

The trajectory journal also stores decisions and observations:

```bash
# Record a decision during exploration
node bin/gsd-tools.cjs memory write --store trajectories --entry '{"category":"decision","text":"Chose JWT over sessions because of stateless API requirement","confidence":"high"}'

# Read back your trajectory journal
node bin/gsd-tools.cjs memory read --store trajectories
```

---

## Common Patterns

### Brownfield Projects (Existing Code)

If you're adding bGSD to an existing codebase, map it first:

```
/gsd-map-codebase          # 4 parallel agents analyze your code
/gsd-new-project            # Uses codebase analysis for better planning
```

### Checking What's Available

```
/gsd-help                   # Full command reference
/gsd-health                 # Check .planning/ directory integrity
/gsd-progress               # Current state and next action
```

### Debugging Issues

```
/gsd-debug Something is broken with the auth flow
```

Launches a systematic debugger that persists state across sessions — hypothesis, evidence, and investigation timeline all tracked in `.planning/debug/`.

---

## Configuration Quick Reference

GSD works out of the box. Customize through `/gsd-settings` or edit `.planning/config.json`:

| Setting | What It Controls |
|---------|-----------------|
| `model_profile` | AI model tier: `quality`, `balanced` (default), `budget` |
| `mode` | `interactive` (confirms each step) or `yolo` (auto-approves) |
| `research` | Enable/disable research phase before planning |
| `plan_checker` | Enable/disable plan quality review |
| `verifier` | Enable/disable phase verification |
| `parallelization` | Execute independent plans in parallel |

---

## Next Steps

- **[Expert Guide](expert-guide.md)** — Full control over every step
- **[Command Reference](commands.md)** — All 41 commands with options
- **[Architecture](architecture.md)** — How bGSD works internally
- **[Agent System](agents.md)** — All 12 agents and their roles
- **[Planning System](planning-system.md)** — How .planning/ works
- **[TDD Guide](tdd.md)** — Test-driven development with bGSD
- **[Configuration](configuration.md)** — Full configuration reference
- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions

---

## Troubleshooting

### "command not found" for /gsd-* commands

Restart OpenCode after installation. bGSD registers commands at `~/.config/opencode/command/`.

### Plans seem too large or too small

Adjust planning depth in `/gsd-settings`, or use `/gsd-discuss-phase` before planning to lock down scope.

### Want to skip research/verification

```
/gsd-plan-phase 1 --skip-research    # Skip research phase
/gsd-settings                         # Toggle agents off permanently
```

### Context window filling up

```
/clear                                # Clear context, then resume
/gsd-resume-work                      # Restores state from files
```

bGSD is designed for context resets. All state lives in `.planning/` files, not in conversation history.
