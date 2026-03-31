# Agent System

bGSD uses 10 specialized AI agents, each purpose-built for a specific task. Agents communicate through files, not conversation history.

---

## Design Philosophy

- **Specialization over generalization.** A planning agent plans. An execution agent executes. A verification agent verifies. No agent does everything.
- **Fresh context per invocation.** Each agent starts with a clean context window. Communication happens through files (PLAN.md in, SUMMARY.md out).
- **Intelligence as data.** New capabilities are delivered as CLI data that existing agents consume, not as new agent roles.
- **Advisory routing.** The orchestrator recommends which agent and model to use. Workflows make the final decision.

---

## Agent Roster

### Core Agents

#### gsd-planner

**Role:** Creates executable plans (PLAN.md files) from phase context.

**Inputs:** Phase goal, success criteria, roadmap context, codebase conventions, research findings, lessons learned, assertions.

**Outputs:** One or more PLAN.md files with YAML frontmatter (phase, plan, type, wave, dependencies, must_haves) and XML task definitions.

**Spawned by:** `/bgsd-plan phase [phase]`, `/bgsd-quick`

**Key behaviors:**
- Breaks phase goals into numbered tasks with file paths and instructions
- Assigns wave numbers for parallel execution
- Defines must_haves (truths, artifacts, key_links) for verification
- Supports two plan types: `execute` (standard) and `tdd` (RED-GREEN-REFACTOR)

---

#### gsd-executor

**Role:** Implements a single plan — writes code, runs tests, creates atomic git commits per task.

**Inputs:** PLAN.md, codebase conventions, task-scoped context (relevant files from dependency graph).

**Outputs:** Code changes, SUMMARY.md documenting what was built, git commits with trailers.

**Spawned by:** `/bgsd-execute-phase [phase]`, `/bgsd-quick`

**Key behaviors:**
- Follows task instructions sequentially
- Creates one git commit per task with descriptive message and trailers (`Agent-Type: gsd-executor`)
- For TDD plans: follows RED-GREEN-REFACTOR state machine with verification gates
- Runs tests after each file modification (auto test-after-edit)
- Reports deviations from plan in SUMMARY.md
- Handles checkpoints (human-verify, decision, human-action)

---

#### gsd-verifier

**Role:** Verifies that a phase actually achieved its goals — not just that tasks were completed.

**Inputs:** PLAN.md frontmatter (must_haves), roadmap success criteria, codebase state.

**Outputs:** VERIFICATION.md with pass/gaps_found/human_needed status.

**Spawned by:** `/bgsd-execute-phase [phase]` (after all plans complete)

**Key behaviors:**
- Checks truths: Are behavioral claims actually true in the codebase?
- Checks artifacts: Do required files exist? Are they real implementations (not stubs)?
- Checks wiring: Are key_links imported AND actually used?
- Scans for anti-patterns: TODO/FIXME/HACK, empty returns, placeholder content
- Maps verified items to requirements (REQ-ID coverage)

---

#### Code Review (workflow-embedded)

**Role:** Reviews code changes against project conventions and plan spec before completion.

> **Note:** Code review is a step within the `execute-plan.md` workflow, not a standalone agent with its own definition file. The review logic lives in `src/lib/review/` and is invoked by the executor after plan completion. This keeps the agent count at 10 while retaining full review capabilities.

**Inputs:** Git diff, PLAN.md task requirements, CONVENTIONS.md, dependency graph.

**Outputs:** Review findings with severity classification, integrated into SUMMARY.md.

**Triggered by:** `/bgsd-execute-phase [phase]` (post-execution review step in `execute-plan.md`)

**Key behaviors:**
- Two-stage review:
  1. **Spec compliance** — Does the diff satisfy the plan's must_haves?
  2. **Code quality** — Does the code follow CONVENTIONS.md patterns?
- Severity classification:
  - **BLOCKER** — Prevents task completion (e.g., missing required artifact)
  - **WARNING** — Should be addressed but doesn't block (e.g., naming convention deviation)
  - **INFO** — Informational (e.g., suggestion for improvement)
- Non-blocking initially; BLOCKER findings prevent completion after pipeline proven reliable

---

#### gsd-debugger

**Role:** Systematic debugging with persistent state across sessions.

**Inputs:** Issue description, codebase context, previous debug state (if resuming).

**Outputs:** Debug state file (`.planning/debug/{slug}.md`) with symptoms, hypotheses, evidence, timeline.

**Spawned by:** `/bgsd-debug`

**Key behaviors:**
- Captures symptoms in structured format
- Generates and tests hypotheses
- Maintains investigation timeline
- State survives `/clear` — resumes from file
- Can run across multiple sessions

---

### Planning Support Agents

#### gsd-plan-checker

**Role:** Reviews plan quality and requests revisions (up to 3 cycles).

**Inputs:** PLAN.md content.

**Outputs:** Revision feedback or approval.

**Spawned by:** `/bgsd-plan phase [phase]` (when `plan_checker` enabled)

**Key behaviors:**
- Checks task specificity (no vague instructions)
- Validates dependency correctness and wave assignments
- Reviews must_haves completeness
- Analyzes single-responsibility (union-find concern grouping)
- Up to 3 revision cycles before accepting

---

#### gsd-phase-researcher

**Role:** Researches implementation approaches for a specific phase.

**Inputs:** Phase goal, ecosystem context.

**Outputs:** `{phase}-RESEARCH.md` consumed by the planner.

**Spawned by:** `/bgsd-plan phase [phase] --research`, `/bgsd-plan research [phase]`

**Key behaviors:**
- Investigates ecosystem standard approaches
- Checks library APIs and integration patterns
- Identifies known pitfalls and gotchas
- Recommends implementations with rationale

---

#### gsd-roadmapper

**Role:** Creates phased roadmaps from requirements.

**Inputs:** Requirements, research synthesis, project context.

**Outputs:** ROADMAP.md with phases, goals, dependencies, success criteria.

**Spawned by:** `/bgsd-new-project`, `/bgsd-new-milestone`

**Key behaviors:**
- Groups requirements into logical phases
- Defines phase dependencies
- Sets success criteria per phase
- Estimates plan counts

---

### Research Agents

#### gsd-project-researcher

**Role:** Parallel domain research before roadmap creation. Five instances run simultaneously.

**Inputs:** Project description, assigned focus area.

**Outputs:** Research document (`STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, or `SKILLS.md`).

**Spawned by:** `/bgsd-new-project`, `/bgsd-new-milestone` (5 parallel instances)

**Focus areas:**
- **Stack** — Technology choices, dependencies, tooling
- **Features** — Feature analysis, competitive landscape
- **Architecture** — Design patterns, module structure
- **Pitfalls** — Known problems, anti-patterns, risk areas
- **Skills** — Project-local skill recommendations worth proposing after research

---

### CI/CD Agents

#### gsd-github-ci

**Role:** Autonomous GitHub CI quality gate — pushes branch, creates PR, monitors code scanning, fixes issues, and auto-merges.

**Inputs:** Branch name, base branch, scope identifier, code scanning alert data.

**Outputs:** Merged PR (or checkpoint if blocked), structured completion report with fix/dismiss details.

**Spawned by:** `/bgsd-github-ci`, `/bgsd-execute-phase --ci`, `/bgsd-quick --ci`

**Key behaviors:**
- Pushes changes to a new branch and creates a PR with descriptive title/body
- Polls for CodeQL/code scanning check completion (up to 15 min timeout)
- Classifies alerts as true positive or false positive based on severity, file context, and rule type
- Fixes true positives (parameterized queries, input sanitization, etc.) and commits fixes
- Dismisses false positives via GitHub API with documented reasoning
- Fix-push-recheck loop capped at 3 iterations to prevent infinite loops
- Auto-merges via `gh pr merge --squash --delete-branch` when all checks pass
- Returns structured checkpoint if merge is blocked (branch protection, required reviews)

---

### Codebase Analysis Agents

#### gsd-codebase-mapper

**Role:** Parallel codebase analysis for brownfield projects. Four instances run simultaneously.

**Inputs:** Codebase files, assigned focus area.

**Outputs:** Codebase document in `.planning/codebase/`.

**Spawned by:** `/bgsd-map-codebase` (4 parallel instances)

**Focus areas and outputs:**

| Focus | Documents Created |
|-------|-------------------|
| tech | `STACK.md`, `INTEGRATIONS.md` |
| arch | `ARCHITECTURE.md`, `STRUCTURE.md` |
| quality | `CONVENTIONS.md`, `TESTING.md` |
| concerns | `CONCERNS.md` |

---

## Model Profiles

Three profiles control which AI model each agent uses:

| Agent | Quality | Balanced (default) | Budget |
|-------|---------|-------------------|--------|
| gsd-planner | opus | opus | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-roadmapper | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-codebase-mapper | sonnet | sonnet | haiku |
| gsd-github-ci | sonnet | sonnet | sonnet |

### Per-Agent Overrides

Override individual agents in `.planning/config.json`:

```json
{
  "model_profile": "balanced",
  "model_profiles": {
    "gsd-executor": "opus"
  }
}
```

### Model Resolution

1. Check `config.json` → `model_profiles` for agent-specific override
2. Look up agent in profile table for the current `model_profile`
3. Opus-tier agents resolve to `"inherit"` to avoid version conflicts

---

## Agent Spawning

Workflows spawn agents via the `Task()` tool:

```
Task(
  prompt="<context and instructions>",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute Plan 01-01"
)
```

Each agent gets a **fresh context window**. There is no shared conversation history between agents. All communication happens through files:
- Plans go in → Code and summaries come out
- Research documents go in → Synthesis comes out
- Verification criteria go in → Verification reports come out

---

## Parallel Execution Patterns

| Workflow | Parallel Agents | Count |
|----------|----------------|-------|
| `/bgsd-new-project` | gsd-project-researcher | 4 (Stack, Features, Architecture, Pitfalls) |
| `/bgsd-map-codebase` | gsd-codebase-mapper | 4 (tech, arch, quality, concerns) |
| `/bgsd-execute-phase [phase]` | gsd-executor | N per wave (independent plans) |
| `/bgsd-verify-work [phase]` | debug agents | N per UAT gap |

---

## Orchestration Intelligence

### Task Classification

The CLI classifies each plan task by complexity (1-5):

| Score | Complexity | Criteria | Model |
|-------|-----------|----------|-------|
| 1-2 | Simple | <3 files, single module, no tests needed | sonnet |
| 3 | Moderate | 3-7 files, limited cross-module | sonnet |
| 4-5 | Complex | 8+ files, cross-module, tests required | opus |

### Context Manifests

Each agent type declares required context via manifest:

```json
{
  "gsd-executor": {
    "fields": ["plans", "config", "conventions", "task_routing"],
    "optional": ["codebase_context", "env_summary"]
  },
  "gsd-verifier": {
    "fields": ["must_haves", "roadmap_criteria"],
    "optional": ["conventions"]
  }
}
```

The system provides only declared context at spawn, reducing token usage by 40-60%.

### Execution Mode Selection

The orchestrator auto-selects execution mode:

| Mode | When | How |
|------|------|-----|
| Single | 1 plan in wave | Sequential execution |
| Parallel | 2+ plans, no file overlap | Concurrent agent spawning |
| Team | Complex phase, worktrees enabled | Isolated worktrees per plan |

---

## Stuck/Loop Detection

If an executor retries the same failed pattern more than 2 times:

1. **Detection** — Identifies repeated failure (same error, same file, same approach)
2. **Recovery** — Rolls back to last known-good state
3. **Escalation** — Tries a different approach or reports to workflow for human intervention

---

## Local Agent Overrides (v13.0)

Agents can be customized per-project without modifying upstream definitions. Local overrides are stored in `.planning/agents/` and take precedence over the global agent definitions.

### Commands

```bash
node bin/bgsd-tools.cjs util:agent list-local              # List all project-local overrides
node bin/bgsd-tools.cjs util:agent override <agent-type>   # Create a local override (copies upstream as starting point)
node bin/bgsd-tools.cjs util:agent diff <agent-type>       # Show diff between local and upstream
node bin/bgsd-tools.cjs util:agent sync <agent-type>       # Pull upstream changes into local override
```

### How it works

1. `agent:override` copies the upstream agent definition to `.planning/agents/<agent-type>.md`
2. YAML frontmatter is validated; content is sanitized against system-prompt mangling
3. The `bgsd-context` enricher injects `local_agent_overrides` into workflow context
4. Workflows check for local overrides and use them when spawning agents

This enables project-specific agent tuning (e.g., adding domain conventions to the executor, adjusting planner heuristics) while keeping upstream agents as the canonical source.

---

## Lesson-Driven Improvement (v13.0)

Agents learn from past executions through a structured lesson pipeline:

1. **Capture** — Lessons are captured during execution (via `lessons:capture`) or auto-captured from deviation recoveries
2. **Analysis** — `lessons:analyze` groups lessons by pattern and surfaces trends across phases
3. **Suggestions** — `lessons:suggest` generates advisory recommendations for agent behavior improvements
4. **Compaction** — `lessons:compact` deduplicates redundant lessons to keep the store lean
5. **Workflow hooks** — Lesson analysis runs automatically in verify-work and complete-milestone workflows

### Deviation Auto-Capture

When an executor autonomously recovers from a Rule-1 deviation (minor issue, auto-fixable), the recovery is automatically captured as a structured lesson. Capped at 3 per milestone to prevent flooding.

---

*For how agents communicate through planning documents, see [Planning System](planning-system.md). For model profile configuration, see [Configuration](configuration.md).*
