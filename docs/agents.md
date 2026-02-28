# Agent System

bGSD uses 12 specialized AI agents, each purpose-built for a specific task. Agents communicate through files, not conversation history.

---

## Design Philosophy

- **Specialization over generalization.** A planning agent plans. An execution agent executes. A verification agent verifies. No agent does everything.
- **Fresh context per invocation.** Each agent starts with a clean context window. Communication happens through files (PLAN.md in, SUMMARY.md out).
- **Intelligence as data.** New capabilities are delivered as CLI data that existing agents consume, not as new agent roles. Agent count is capped at 12.
- **Advisory routing.** The orchestrator recommends which agent and model to use. Workflows make the final decision.

---

## Agent Roster

### Core Agents

#### gsd-planner

**Role:** Creates executable plans (PLAN.md files) from phase context.

**Inputs:** Phase goal, success criteria, roadmap context, codebase conventions, research findings, lessons learned, assertions.

**Outputs:** One or more PLAN.md files with YAML frontmatter (phase, plan, type, wave, dependencies, must_haves) and XML task definitions.

**Spawned by:** `/gsd-plan-phase`, `/gsd-quick`

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

**Spawned by:** `/gsd-execute-phase`, `/gsd-quick`

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

**Spawned by:** `/gsd-execute-phase` (after all plans complete)

**Key behaviors:**
- Checks truths: Are behavioral claims actually true in the codebase?
- Checks artifacts: Do required files exist? Are they real implementations (not stubs)?
- Checks wiring: Are key_links imported AND actually used?
- Scans for anti-patterns: TODO/FIXME/HACK, empty returns, placeholder content
- Maps verified items to requirements (REQ-ID coverage)

---

#### gsd-reviewer

**Role:** Reviews code changes against project conventions and plan spec before completion.

**Inputs:** Git diff, PLAN.md task requirements, CONVENTIONS.md, dependency graph.

**Outputs:** Review findings with severity classification, integrated into SUMMARY.md.

**Spawned by:** `/gsd-execute-phase` (post-execution review step)

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

**Spawned by:** `/gsd-debug`

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

**Spawned by:** `/gsd-plan-phase` (when `plan_checker` enabled)

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

**Spawned by:** `/gsd-plan-phase --research`, `/gsd-research-phase`

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

**Spawned by:** `/gsd-new-project`, `/gsd-new-milestone`

**Key behaviors:**
- Groups requirements into logical phases
- Defines phase dependencies
- Sets success criteria per phase
- Estimates plan counts

---

### Research Agents

#### gsd-project-researcher

**Role:** Parallel domain research before roadmap creation. Four instances run simultaneously.

**Inputs:** Project description, assigned focus area.

**Outputs:** Research document (STACK.md, FEATURES.md, ARCHITECTURE.md, or PITFALLS.md).

**Spawned by:** `/gsd-new-project`, `/gsd-new-milestone` (4 parallel instances)

**Focus areas:**
- **Stack** — Technology choices, dependencies, tooling
- **Features** — Feature analysis, competitive landscape
- **Architecture** — Design patterns, module structure
- **Pitfalls** — Known problems, anti-patterns, risk areas

---

#### gsd-research-synthesizer

**Role:** Merges parallel research outputs into a single summary.

**Inputs:** 4 research documents from gsd-project-researchers.

**Outputs:** `research/SUMMARY.md` with executive summary, key findings, confidence assessment.

**Spawned by:** `/gsd-new-project`, `/gsd-new-milestone`

---

### Codebase Analysis Agents

#### gsd-codebase-mapper

**Role:** Parallel codebase analysis for brownfield projects. Four instances run simultaneously.

**Inputs:** Codebase files, assigned focus area.

**Outputs:** Codebase document in `.planning/codebase/`.

**Spawned by:** `/gsd-map-codebase` (4 parallel instances)

**Focus areas and outputs:**

| Focus | Documents Created |
|-------|-------------------|
| tech | `STACK.md`, `INTEGRATIONS.md` |
| arch | `ARCHITECTURE.md`, `STRUCTURE.md` |
| quality | `CONVENTIONS.md`, `TESTING.md` |
| concerns | `CONCERNS.md` |

---

#### gsd-integration-checker

**Role:** Cross-phase wiring verification at milestone boundaries.

**Inputs:** Phase verifications, summaries, requirement mapping.

**Outputs:** `MILESTONE-AUDIT.md` with integration assessment.

**Spawned by:** `/gsd-audit-milestone`

**Key behaviors:**
- Verifies artifacts from different phases connect properly
- Tests end-to-end user flows
- Checks all requirements are satisfied across the milestone
- Identifies integration gaps

---

## Model Profiles

Three profiles control which AI model each agent uses:

| Agent | Quality | Balanced (default) | Budget |
|-------|---------|-------------------|--------|
| gsd-planner | opus | opus | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-reviewer | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | sonnet | haiku |
| gsd-roadmapper | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-codebase-mapper | sonnet | sonnet | haiku |
| gsd-integration-checker | opus | sonnet | sonnet |

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
| `/gsd-new-project` | gsd-project-researcher | 4 (Stack, Features, Architecture, Pitfalls) |
| `/gsd-map-codebase` | gsd-codebase-mapper | 4 (tech, arch, quality, concerns) |
| `/gsd-execute-phase` | gsd-executor | N per wave (independent plans) |
| `/gsd-verify-work` | debug agents | N per UAT gap |

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
  "gsd-reviewer": {
    "fields": ["conventions", "dependencies"],
    "optional": []
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

*For how agents communicate through planning documents, see [Planning System](planning-system.md). For model profile configuration, see [Configuration](configuration.md).*
