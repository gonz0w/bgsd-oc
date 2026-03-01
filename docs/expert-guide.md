# bGSD Expert Guide

Full control over the bGSD workflow. This guide covers every option, advanced patterns, and the decisions behind the system.

## Philosophy

bGSD separates concerns into layers:

1. **Intent** — Why does this project exist? What does success look like?
2. **Requirements** — What specifically needs to be built?
3. **Roadmap** — In what order, with what dependencies?
4. **Plans** — Exactly what tasks, in what sequence, producing what artifacts?
5. **Execution** — Build it, test it, commit it
6. **Verification** — Did we actually achieve the goal?
7. **Memory** — What did we learn? What decisions did we make?

Each layer has dedicated commands, agents, and documents. You can engage with any layer independently.

---

## Full Project Initialization

### Pre-Initialization: Codebase Mapping (Brownfield)

For existing codebases, always map first:

```
/gsd-map-codebase
```

Spawns 4 parallel agents that write 7 documents to `.planning/codebase/`:

| Agent | Focus | Documents |
|-------|-------|-----------|
| Tech mapper | Stack analysis | `STACK.md`, `INTEGRATIONS.md` |
| Arch mapper | Architecture | `ARCHITECTURE.md`, `STRUCTURE.md` |
| Quality mapper | Conventions | `CONVENTIONS.md`, `TESTING.md` |
| Concerns mapper | Tech debt | `CONCERNS.md` |

These documents feed into planning agents for context-aware plan generation.

### Project Initialization

```
/gsd-new-project
```

The full flow:

1. **Deep questioning** — bGSD probes your vision. Not just "what" but "why" and "for whom"
2. **PROJECT.md** — Living project definition
3. **INTENT.md** — Structured capture of objective, desired outcomes (prioritized P1-P3), success criteria, constraints
4. **Workflow preferences** — Mode, depth, agent toggles, git strategy
5. **Research** (optional) — 4 parallel researchers explore Stack, Features, Architecture, and Pitfalls. A synthesizer merges findings into `RESEARCH.md`
6. **Requirements** — Feature scoping per category, generating `REQUIREMENTS.md` with traceable IDs
7. **Roadmap** — `gsd-roadmapper` agent creates phased plan with goals, dependencies, and success criteria

**Auto mode:**
```
/gsd-new-project --auto
```
Expects a design document via `@` reference. Collects all settings in 2 rounds instead of interactive questioning.

### Intent Engineering

INTENT.md captures the "north star" for your project:

```
/gsd-new-project           # Creates INTENT.md during initialization
```

After creation, use intent commands for ongoing alignment:

```bash
# CLI operations (run via gsd-tools or through workflows)
node bin/gsd-tools.cjs intent show                    # Compact summary
node bin/gsd-tools.cjs intent show --full              # Full content
node bin/gsd-tools.cjs intent show outcomes            # Specific section
node bin/gsd-tools.cjs intent validate                 # Structure check
node bin/gsd-tools.cjs intent trace                    # Outcomes -> plans matrix
node bin/gsd-tools.cjs intent trace --gaps             # Show uncovered outcomes
node bin/gsd-tools.cjs intent drift                    # Drift score (0-100)
node bin/gsd-tools.cjs intent update --add outcomes --value "DO-05 [P2]: Export to PDF"
```

**Drift scoring** measures alignment across 4 signals:
- Coverage gaps (40 points) — outcomes with no plans addressing them
- Objective mismatch (25 points) — plans diverging from stated objective
- Feature creep (15 points) — work not traced to any outcome
- Priority inversion (20 points) — P2/P3 work before P1 completion

Score 0-30 = aligned, 31-60 = drifting, 61-100 = significantly misaligned.

---

## Phase Planning — Full Control

### Step 1: Surface Assumptions

Before planning, see what the AI assumes:

```
/gsd-list-phase-assumptions 1
```

Surfaces assumptions across 5 areas with confidence levels:
- **Technical Approach** — frameworks, patterns, tools
- **Implementation Order** — what gets built first
- **Scope Boundaries** — what's in/out
- **Risk Areas** — potential problems
- **Dependencies** — what this phase needs from others

No files created. Purely conversational. Correct assumptions before they become plans.

### Step 2: Discuss Context

Lock down implementation decisions:

```
/gsd-discuss-phase 1
```

bGSD identifies gray areas specific to your phase (layout decisions, behavior edge cases, ordering preferences) and lets you choose which to discuss. Produces `CONTEXT.md` with:

- **Locked decisions** — choices the user made
- **Agent's discretion** — areas the agent can decide
- **Deferred ideas** — captured for later

### Step 3: Research (Optional)

For complex or unfamiliar domains:

```
/gsd-research-phase 1
```

Spawns a `gsd-phase-researcher` agent that investigates:
- Ecosystem standard approaches
- Library APIs and integration patterns
- Known pitfalls and gotchas
- Recommended implementations

Produces `{phase}-RESEARCH.md` consumed by the planner.

### Step 4: Plan

```
/gsd-plan-phase 1
```

**Flags:**

| Flag | Effect |
|------|--------|
| `--research` | Force research phase (overrides config) |
| `--skip-research` | Skip research (even if config enables it) |
| `--skip-verify` | Skip plan-checker quality review |
| `--gaps` | Only create plans for UAT gaps |
| `--auto` | Auto-advance to execution after planning |

**What the planner produces:**

Each `PLAN.md` contains:
```yaml
---
phase: 1
plan: 1
type: execute          # or "tdd" for test-driven plans
wave: 1                # parallel execution group
depends_on: []         # other plan IDs this depends on
estimated_tasks: 5
must_haves:
  truths:              # what must be true when done
    - "Users can log in with email/password"
  artifacts:           # files that must exist
    - "src/auth/login.ts"
  key_links:           # imports/connections that must exist
    - "src/app.ts imports src/auth/login.ts"
---
```

Followed by XML task definitions with instructions, file paths, and acceptance criteria.

**Plan quality review:**

If `plan_checker` is enabled, the `gsd-plan-checker` agent reviews each plan and may request revisions (up to 3 cycles). Checks:
- Task specificity (no vague instructions)
- Dependency correctness
- Wave assignments (no conflicts)
- `must_haves` completeness
- Single-responsibility scoring

### Step 5: Discovery (Within Planning)

The planner automatically triggers discovery at the appropriate depth:

| Level | Duration | When Used |
|-------|----------|-----------|
| **Quick Verify** | 2-5 min | Familiar tech, just confirming APIs |
| **Standard** | 15-30 min | Moderate complexity, creates DISCOVERY.md |
| **Deep Dive** | 1+ hour | Unfamiliar domains, comprehensive research |

Discovery uses Context7 MCP for library docs and optionally Brave Search for web research.

---

## Execution — Full Control

### Wave Execution

```
/gsd-execute-phase 1
```

**Pre-flight checks:**
1. Dependency validation — cycles, missing refs
2. State validation — drift detection with auto-fix
3. Worktree overlap check — file conflicts between parallel plans
4. Convention loading — naming patterns from codebase intel

**Execution modes:**

| Mode | When | How |
|------|------|-----|
| **Standard** | Default | Plans execute sequentially within waves, waves execute in order |
| **Worktree parallel** | `worktree.enabled = true` | Each plan gets an isolated git worktree, merged back after |

**Gaps-only mode:**
```
/gsd-execute-phase 1 --gaps-only
```
Only executes plans created by `/gsd-plan-phase --gaps` (from UAT gap closure).

### Checkpoint Types

Plans can contain three types of checkpoints:

| Type | Frequency | Behavior |
|------|-----------|----------|
| **human-verify** | ~90% | "Check this looks right" — visual, UX, integration |
| **decision** | ~9% | "Which approach?" — requires user choice |
| **human-action** | ~1% | "Create this account" — cannot be automated |

In `yolo` mode, `human-verify` checkpoints are auto-approved. `decision` and `human-action` always pause.

### Per-Task Commits

Every task in a plan gets its own git commit:
```
feat(auth): implement login endpoint [phase-01/plan-01/task-03]
```

This enables precise rollback:
```
/gsd-rollback-info 01-01     # Shows commits and revert command for plan 01-01
```

---

## Verification

### Automated Phase Verification

After execution, the `gsd-verifier` agent checks:

1. **Truth verification** — Are the `must_haves.truths` actually true in the codebase?
2. **Artifact verification** — Do required files exist? Are they real implementations (not stubs)?
3. **Wiring verification** — Are `key_links` actually imported AND used?
4. **Anti-pattern scan** — TODO/FIXME/HACK, empty returns, placeholder content
5. **Requirement coverage** — Which REQ-IDs are addressed?

Produces `VERIFICATION.md` with pass/gaps_found/human_needed status.

### Manual UAT Testing

```
/gsd-verify-work 1
```

Interactive testing flow:
1. bGSD presents test scenarios one at a time
2. You test and report: pass, skip, or issue
3. Issues get severity classification (inferred, never asked)
4. Gaps are diagnosed by parallel debug agents
5. Fix plans are generated for `/gsd-execute-phase --gaps-only`

### Milestone Audit

Before completing a milestone:

```
/gsd-audit-milestone
```

Spawns `gsd-integration-checker` to verify cross-phase wiring:
- Do artifacts from different phases connect properly?
- Do end-to-end user flows work?
- Are all requirements satisfied across the milestone?

Produces `MILESTONE-AUDIT.md`. If gaps found:

```
/gsd-plan-milestone-gaps     # Creates fix phases for all gaps
```

### Quality Scoring

```bash
node bin/gsd-tools.cjs verify quality --phase 1 --raw
```

Composite A-F grade across 4 dimensions:
- Tests (30%) — test pass rate
- Must-haves (30%) — artifact and truth verification
- Requirements (20%) — REQ-ID coverage
- Regression (20%) — no new test failures

Tracks trend across plans for quality trajectory.

---

## Memory System

### Persistent Stores

bGSD maintains 5 memory stores in `.planning/memory/`:

| Store | Content | Sacred? |
|-------|---------|---------|
| `decisions` | Technical decisions with rationale | Yes (never pruned) |
| `lessons` | Lessons learned from execution | Yes (never pruned) |
| `trajectories` | Checkpoints, exploration decisions, observations | Yes (never pruned) |
| `bookmarks` | Session position markers | No (trimmed to 20) |
| `todos` | Captured ideas and tasks | No |

### Searching Memory

```
/gsd-search-decisions "database"      # Find past decisions
/gsd-search-lessons "auth"            # Find lessons learned
```

### Memory in Context

Every workflow automatically loads relevant memory via `init memory`:
- Current position bookmark
- Recent decisions
- Phase-specific lessons
- Codebase knowledge

Memory is trimmed by priority when approaching token budget limits.

### Todo Management

```
/gsd-add-todo Fix the edge case in user validation
/gsd-check-todos                      # List and work on todos
/gsd-check-todos auth                 # Filter by area
```

---

## Trajectory Engineering

When exploring implementation approaches, trajectory engineering provides structured checkpointing, metrics capture, and selective rewind — replacing ad-hoc branching with measurable, journaled exploration.

### Creating Checkpoints

Save a named checkpoint at the current state. Each checkpoint automatically captures test metrics, LOC delta, and cyclomatic complexity:

```bash
# Basic checkpoint
node bin/gsd-tools.cjs trajectory checkpoint auth-strategy

# With scope and description
node bin/gsd-tools.cjs trajectory checkpoint auth-strategy \
  --scope phase \
  --description "JWT approach with refresh tokens"
```

**What happens under the hood:**
1. Validates no uncommitted changes (outside `.planning/`)
2. Creates a git branch at `trajectory/<scope>/<name>/attempt-N` (ref only — no checkout)
3. Runs your test suite and captures pass/fail counts
4. Computes LOC delta from recent commits
5. Calculates cyclomatic complexity of changed files
6. Writes a journal entry to `.planning/memory/trajectory.json`

Calling `checkpoint` again with the same name auto-increments the attempt number (attempt-1, attempt-2, etc.).

### Listing Checkpoints

```bash
# List all checkpoints
node bin/gsd-tools.cjs trajectory list

# Filter by scope or name
node bin/gsd-tools.cjs trajectory list --scope phase --name auth-strategy

# Limit results
node bin/gsd-tools.cjs trajectory list --limit 5
```

In a terminal, this renders a color-coded table showing:

| Column | Content |
|--------|---------|
| Name | Checkpoint name |
| Scope | phase, task, etc. |
| Attempt | Auto-incremented attempt number |
| Ref | Short git SHA |
| Tests | Pass/fail (green if all pass, red otherwise) |
| LOC | Lines added/removed |
| Age | Relative time since checkpoint |

### Comparing Attempts

Compare metrics across all non-abandoned attempts side-by-side. Best values highlighted green, worst highlighted red:

```bash
# Compare all attempts for a checkpoint
node bin/gsd-tools.cjs trajectory compare auth-strategy

# Scoped comparison
node bin/gsd-tools.cjs trajectory compare try-redis --scope task
```

Shows test results, LOC delta, and cyclomatic complexity per attempt with best/worst indicators.

### Pivoting to a Different Approach

When the current approach isn't working, pivot back to a previous checkpoint with a recorded reason. The current work is auto-archived as an abandoned attempt before rewinding:

```bash
# Pivot back to the most recent checkpoint
node bin/gsd-tools.cjs trajectory pivot auth-strategy --reason "JWT approach too complex"

# Pivot to a specific attempt
node bin/gsd-tools.cjs trajectory pivot auth-strategy --attempt 1 --reason "Attempt 1 was simpler"

# Auto-stash dirty files before pivoting
node bin/gsd-tools.cjs trajectory pivot auth-strategy --reason "..." --stash
```

**What happens under the hood:**
1. Auto-checkpoints current HEAD as an abandoned attempt (archived branch)
2. Selectively rewinds source code to the target checkpoint (preserves `.planning/`)
3. Writes an abandonment journal entry with your reason
4. Pops stash if `--stash` was used

### Choosing a Winner

When you've explored enough and want to commit to an approach, `choose` merges the winner, archives alternatives, and cleans up:

```bash
# Select the winning attempt
node bin/gsd-tools.cjs trajectory choose auth-strategy --attempt 2

# With a reason for the journal
node bin/gsd-tools.cjs trajectory choose auth-strategy --attempt 2 --reason "Better test coverage"
```

**What happens under the hood:**
1. Merges the winning attempt's branch into the current branch (`--no-ff` for history)
2. Archives non-chosen attempt branches as lightweight git tags (preserving their history)
3. Deletes ALL trajectory working branches (tags remain for future reference)
4. Writes a `category: 'choose'` journal entry marking the lifecycle complete

### Selective Rewind

Roll back source code to any git ref while preserving planning state and root configs:

```bash
# Preview changes (safe, read-only)
node bin/gsd-tools.cjs git rewind --ref trajectory/phase/auth-strategy/attempt-1 --dry-run

# Execute rewind
node bin/gsd-tools.cjs git rewind --ref trajectory/phase/auth-strategy/attempt-1 --confirm
```

**Protected paths** (never rewound):
- `.planning/` (entire directory)
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.*.json`
- `.gitignore`, `.env`, `.env.*`

**Three-gate safety model:**
1. `--dry-run` — shows what would change, no modifications
2. No flags — returns a confirmation prompt with change list
3. `--confirm` — executes the rewind with auto-stash of dirty files

### Trajectory Branches

Create dedicated exploration branches for longer investigations:

```bash
# Create a trajectory branch
node bin/gsd-tools.cjs git trajectory-branch --phase 5 --slug auth-refactor

# Create and push to origin
node bin/gsd-tools.cjs git trajectory-branch --phase 5 --slug auth-refactor --push
```

Creates branch at `gsd/trajectory/5-auth-refactor`. Unlike `trajectory checkpoint`, this **does** check out the new branch.

### Trajectory Journal

The trajectory memory store records more than just checkpoints. Use it as an exploration log:

```bash
# Record a decision
node bin/gsd-tools.cjs memory write --store trajectories \
  --entry '{"category":"decision","text":"JWT chosen over sessions for stateless scaling","confidence":"high"}'

# Record an observation
node bin/gsd-tools.cjs memory write --store trajectories \
  --entry '{"category":"observation","text":"Redis sessions add 50ms latency per request"}'

# Query the journal
node bin/gsd-tools.cjs memory read --store trajectories --category decision
node bin/gsd-tools.cjs memory read --store trajectories --from 2026-02-01 --limit 10
```

Valid categories: `checkpoint`, `decision`, `observation`, `correction`, `hypothesis`, `choose`
Confidence levels: `high`, `medium`, `low`

The trajectory store is **sacred** — it is never auto-compacted, so your exploration history is permanent.

### Typical Exploration Workflow

```bash
# 1. Checkpoint current state before exploring
node bin/gsd-tools.cjs trajectory checkpoint db-layer --description "Prisma ORM"

# 2. Build approach A, run tests, iterate
# ... write code ...

# 3. Checkpoint approach A, start approach B
node bin/gsd-tools.cjs trajectory checkpoint db-layer --description "Drizzle ORM"

# 4. Build approach B
# ... write code ...

# 5. Compare metrics across both attempts
node bin/gsd-tools.cjs trajectory compare db-layer

# 6. Approach B isn't working — pivot back to approach A
node bin/gsd-tools.cjs trajectory pivot db-layer --attempt 1 --reason "Drizzle had 15% more test failures"

# 7. Happy with approach A — choose it as the winner
node bin/gsd-tools.cjs trajectory choose db-layer --attempt 1 --reason "Better type inference, fewer test failures"
```

---

## Git Strategies

### Branching

Configure in `.planning/config.json`:

```json
{
  "branching_strategy": "phase",
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}"
}
```

| Strategy | Behavior |
|----------|----------|
| `none` | All work on current branch |
| `phase` | New branch per phase, merged at completion |
| `milestone` | New branch per milestone |

### Worktree Isolation

For true parallel execution without merge conflicts:

```json
{
  "worktree": {
    "enabled": true,
    "base_path": "/tmp/gsd-worktrees",
    "sync_files": [".env", ".env.local", ".planning/config.json"],
    "setup_hooks": ["npm install"],
    "max_concurrent": 3
  }
}
```

Each plan executes in its own git worktree, merged back to main after completion.

---

## Advanced Patterns

### Decimal Phases (Urgent Insertions)

Need to insert urgent work between phases 3 and 4?

```
/gsd-insert-phase 3 "Fix critical auth vulnerability"
```

Creates phase 3.1 with all the same planning/execution capabilities.

### Roadmap Evolution

```
/gsd-add-phase "Add export functionality"     # Append to roadmap
/gsd-remove-phase 7                            # Remove unstarted phase
/gsd-insert-phase 4 "Emergency hotfix"         # Insert between phases
```

### Debug Sessions

```
/gsd-debug The payment webhook is timing out
```

Persistent debug state survives `/clear`:
- Symptoms captured in `.planning/debug/{slug}.md`
- Hypotheses tracked with evidence
- Investigation timeline
- Can resume across sessions

### Velocity Tracking

```bash
node bin/gsd-tools.cjs velocity --raw
```

Shows plans/day, average duration, and completion forecast based on historical execution metrics stored in STATE.md.

### Requirement Traceability

Trace a single requirement through the entire system:

```bash
node bin/gsd-tools.cjs trace-requirement REQ-03 --raw
```

Shows: REQUIREMENTS.md entry -> which PLAN.md files address it -> which SUMMARY.md confirms it -> which actual files on disk implement it.

### Context Budget Management

```bash
node bin/gsd-tools.cjs context-budget .planning/phases/01-setup/01-01-PLAN.md --raw
node bin/gsd-tools.cjs context-budget baseline          # Save current baseline
node bin/gsd-tools.cjs context-budget compare            # Compare to baseline
```

### Codebase Intelligence

```bash
node bin/gsd-tools.cjs codebase analyze --raw          # Full analysis
node bin/gsd-tools.cjs codebase conventions --raw       # Extract naming patterns
node bin/gsd-tools.cjs codebase deps --cycles --raw     # Dependency graph + cycles
node bin/gsd-tools.cjs codebase impact src/auth.ts --raw  # Blast radius
node bin/gsd-tools.cjs codebase lifecycle --raw          # Migration/schema patterns
```

### Environment Detection

```bash
node bin/gsd-tools.cjs env scan --raw          # Detect languages, tools, runtimes
node bin/gsd-tools.cjs env status --raw         # Check manifest freshness
```

Detects 26 language patterns, package managers, version managers, CI, test frameworks, linters, Docker, MCP servers, and monorepo configs.

### MCP Server Profiling

```bash
node bin/gsd-tools.cjs mcp profile --raw          # Discover MCP servers, estimate token cost
node bin/gsd-tools.cjs mcp profile --apply         # Disable recommended servers (backup first)
node bin/gsd-tools.cjs mcp profile --restore       # Restore from backup
```

---

## Configuration Reference

### Full config.json Schema

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "model_profiles": {},
  "commit_docs": true,
  "search_gitignored": false,
  "branching_strategy": "none",
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "research": true,
  "plan_checker": true,
  "verifier": true,
  "parallelization": true,
  "brave_search": false,
  "test_commands": {},
  "test_gate": true,
  "context_window": 200000,
  "context_target_percent": 50,

  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false
  },

  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },

  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },

  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },

  "worktree": {
    "enabled": false,
    "base_path": "/tmp/gsd-worktrees",
    "sync_files": [".env", ".env.local", ".planning/config.json"],
    "setup_hooks": [],
    "max_concurrent": 3
  }
}
```

### Config Management

```bash
node bin/gsd-tools.cjs config-ensure-section          # Initialize with defaults
node bin/gsd-tools.cjs config-set model_profile quality  # Set a value
node bin/gsd-tools.cjs config-get model_profile          # Get a value
node bin/gsd-tools.cjs config-migrate                    # Add missing keys
node bin/gsd-tools.cjs validate-config                   # Schema validation
```

Or interactively:
```
/gsd-settings
```

### User Defaults

Save preferred settings globally at `~/.gsd/defaults.json`. These are applied when creating new projects.

---

## Typical Expert Workflow

```
# 1. Map existing codebase (brownfield)
/gsd-map-codebase

# 2. Initialize project with full research
/gsd-new-project
# -> Answer questions, approve research, review roadmap

# 3. For each phase:
/gsd-list-phase-assumptions 1        # Check AI's assumptions
/gsd-discuss-phase 1                  # Lock implementation decisions
/gsd-plan-phase 1 --research          # Plan with domain research
/gsd-execute-phase 1                  # Execute with wave parallelism
/gsd-verify-work 1                    # Manual UAT testing

# 4. If UAT finds gaps:
/gsd-plan-phase 1 --gaps              # Plan fixes for gaps
/gsd-execute-phase 1 --gaps-only      # Execute only gap plans

# 5. Before milestone completion:
/gsd-audit-milestone                  # Cross-phase integration check
/gsd-plan-milestone-gaps              # Fix any integration gaps

# 6. Complete milestone:
/gsd-complete-milestone

# 7. Start next cycle:
/gsd-new-milestone
```

---

## Related Documentation

- **[Getting Started](getting-started.md)** — Simple first-project walkthrough
- **[Command Reference](commands.md)** — Every command with full details
- **[Architecture](architecture.md)** — Internal design and agent system
- **[Agent System](agents.md)** — All 12 agents and their roles
- **[Planning System](planning-system.md)** — How .planning/ works
- **[TDD Guide](tdd.md)** — TDD execution engine
- **[Configuration](configuration.md)** — Full configuration reference
- **[Design Decisions](decisions.md)** — Why bGSD is built this way
- **[Research & Analysis](research.md)** — Competitive audit and key findings
- **[Version History](milestones.md)** — Every milestone and what shipped
- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions
