# The .planning/ System

How bGSD organizes project knowledge, tracks progress, and maintains state across sessions.

---

## Overview

Every bGSD project creates a `.planning/` directory in the project root. This directory is the single source of truth for all project planning, execution state, decisions, and history. Everything an AI agent needs to understand the project lives here.

```
.planning/
  PROJECT.md              # What this project is
  INTENT.md               # Why it exists, what success looks like
  REQUIREMENTS.md         # What specifically needs to be built
  ROADMAP.md              # Phases with goals, dependencies, progress
  STATE.md                # Living state: position, metrics, decisions, blockers
  config.json             # Workflow settings
  project-profile.json    # Detected language, package manager

  phases/                 # Active phase directories
  milestones/             # Archived milestone data
  research/               # Domain research documents
  codebase/               # Codebase analysis (brownfield projects)
  memory/                 # Persistent stores (decisions, bookmarks, lessons)
  todos/                  # Captured ideas and tasks
  debug/                  # Debug session state
  quick/                  # Quick task plans and summaries
  baselines/              # Token and performance baselines
```

---

## Core Documents

### PROJECT.md

The project definition. Created during `/gsd-new-project` and updated as the project evolves.

**Contains:**
- What the project is (one-paragraph summary)
- Core value proposition
- Current milestone goal and target features
- Shipped milestone history
- Validated requirements list (all features delivered across all milestones)
- Active requirements
- Out of scope items with rationale
- Technical context (stack, dependencies, deploy pipeline)
- Constraints
- Key decisions table (decision, rationale, outcome)

**Updated:** At milestone boundaries and when significant decisions are made.

**Why it exists:** Gives any agent or human a complete project overview in one file. Prevents repeated "what is this project?" questions across sessions.

---

### INTENT.md

The project's north star. Captures why the project exists and what success looks like.

**Contains:**
- `<objective>` — What the project does and for whom
- `<users>` — Target users
- `<outcomes>` — Desired outcomes with priority (P1/P2/P3) and achievement status
- `<criteria>` — Success criteria (testable conditions)
- `<constraints>` — Technical and business constraints
- `<health>` — Quantitative and qualitative health metrics
- `<history>` — How intent evolved across milestones with reasoning

**Updated:** At each milestone start. Outcomes are marked as achieved when delivered.

**Why it exists:** Prevents drift. Every plan traces back to a desired outcome. Intent drift scoring (0-100) measures alignment. Agents receive intent context automatically in every workflow.

---

### REQUIREMENTS.md

Checkable requirements with traceable IDs.

**Contains:**
- Requirements grouped by category (e.g., Foundation, AST Intelligence, Context Efficiency)
- Each requirement has an ID (e.g., `SAFE-01`, `AST-03`, `CTX-02`)
- Checkbox status (`[x]` complete, `[ ]` pending)
- Future requirements (deferred to later releases)
- Out of scope items
- Traceability table mapping requirements to phases, status, and test commands

**Updated:** During milestone planning and as requirements are completed.

**Why it exists:** Provides clear, measurable targets. The traceability table ensures every requirement maps to a phase. The `/gsd-trace-requirement` command traces from requirement to plan to code on disk.

---

### ROADMAP.md

The phased development plan.

**Contains:**
- Milestone list with status (complete/active)
- Phase definitions within each milestone:
  - Phase number and name
  - Goal (what this phase achieves)
  - Requirements it addresses
  - Success criteria (testable conditions)
  - Dependencies on other phases
  - Plan list with status
- Progress table showing plans completed per phase

**Updated:** During milestone planning, as plans are created, and as phases complete.

**Why it exists:** Defines the order of work, captures dependencies, and tracks progress. The gsd-roadmapper agent creates the initial roadmap; the CLI maintains it as work progresses.

---

### STATE.md

The living state of the project. Changes frequently.

**Contains:**
- Project reference (pointer to PROJECT.md)
- Current position (phase, plan, status)
- Performance metrics (velocity, plans completed, average duration, milestone timelines)
- Accumulated context:
  - Decisions made during current milestone
  - Pending todos
  - Blockers and concerns
- Session continuity (last session date, where work stopped, resume file reference)

**Updated:** After every plan completion, decision, blocker, or session boundary.

**Why it exists:** Enables session resumption. When an agent starts with `/gsd-resume-work`, STATE.md tells it exactly where things stand. The `state validate` command detects drift between STATE.md and filesystem reality.

---

### config.json

Workflow configuration.

**Contains:** Mode, model profile, gate settings, parallelization options, branching strategy, worktree config. See [Configuration Reference](configuration.md) for full schema.

**Updated:** Via `/gsd-settings` or direct editing.

---

## Phase Directories

Each phase gets a directory under `.planning/phases/`:

```
phases/
  37-foundation-safety-net/
    37-01-PLAN.md           # First plan in phase 37
    37-01-SUMMARY.md        # What was built, decisions made
    37-02-PLAN.md           # Second plan
    37-02-SUMMARY.md
    37-VERIFICATION.md      # Phase goal verification report
    37-CONTEXT.md           # Implementation decisions (from /gsd-discuss-phase)
    37-RESEARCH.md          # Domain research (from /gsd-research-phase)
```

### PLAN.md

The executable plan. Created by the gsd-planner agent.

**Structure:**
```yaml
---
phase: 37
plan: 1
type: execute          # or "tdd" for test-driven plans
wave: 1                # parallel execution group
depends_on: []         # other plan IDs this depends on
estimated_tasks: 5
must_haves:
  truths:              # what must be true when done
    - "Pre-commit checks detect dirty tree"
  artifacts:           # files that must exist
    - "src/lib/git.js"
  key_links:           # imports/connections that must exist
    - "router.js imports git.js"
---
```

Followed by XML task definitions with numbered instructions, file paths, and acceptance criteria.

### SUMMARY.md

Created after plan execution. Documents what was actually built.

**Contains:**
- Tasks completed with outcomes
- Files changed
- Decisions made during execution
- Deviations from plan (if any)
- Review findings (from gsd-reviewer)
- Git commits created

### VERIFICATION.md

Created by the gsd-verifier agent after all plans in a phase complete.

**Contains:**
- Truth verification (are must_haves actually true?)
- Artifact verification (do required files exist and are they real implementations?)
- Wiring verification (are key_links actually imported AND used?)
- Anti-pattern scan (TODO/FIXME/HACK, empty returns, placeholder content)
- Pass/gaps_found/human_needed status

---

## Document Lifecycle

### Creation Flow

```
/gsd-new-project
  ├── Creates PROJECT.md
  ├── Creates INTENT.md
  ├── Creates REQUIREMENTS.md (with REQ-IDs)
  ├── Creates ROADMAP.md (phases with goals)
  ├── Creates STATE.md
  └── Creates config.json

/gsd-plan-phase N
  ├── Creates {phase}-{plan}-PLAN.md files
  └── Optionally creates {phase}-RESEARCH.md, {phase}-CONTEXT.md

/gsd-execute-phase N
  ├── Creates {phase}-{plan}-SUMMARY.md files
  └── Creates {phase}-VERIFICATION.md

/gsd-complete-milestone
  ├── Archives phase directories to milestones/
  ├── Archives ROADMAP.md and REQUIREMENTS.md
  ├── Updates MILESTONES.md with completion record
  └── Resets STATE.md for next milestone
```

### Update Flow

```
Plan completion  →  STATE.md (position, metrics)
Decision made    →  STATE.md (accumulated context)
Phase complete   →  ROADMAP.md (checkbox), STATE.md (position)
Milestone done   →  MILESTONES.md, PROJECT.md, INTENT.md
```

---

## Milestone Archives

When a milestone completes, its data moves to `.planning/milestones/`:

```
milestones/
  v1.0-ROADMAP.md          # Archived roadmap
  v1.0-REQUIREMENTS.md     # Archived requirements
  v1.0-phases/             # Archived phase directories
    01-foundation/
    02-error-handling/
    ...
```

The main MILESTONES.md file maintains a summary of every shipped milestone with metrics (phases, plans, commits, files changed, lines, timeline, tests, bundle size).

---

## Memory System

Persistent stores in `.planning/memory/`:

| Store | File | Content | Retention |
|-------|------|---------|-----------|
| `decisions` | `decisions.json` | Technical decisions with rationale | Sacred (never pruned) |
| `lessons` | `lessons.json` | Lessons learned from execution | Sacred (never pruned) |
| `bookmarks` | `bookmarks.json` | Session position markers with git HEADs | Trimmed to 20 |
| `todos` | `todos.json` | Captured ideas and tasks | Manual management |
| `quality-scores` | `quality-scores.json` | A-F quality grades per plan | Persistent |

### Memory Access

```
/gsd-search-decisions "database"     # Search decisions
/gsd-search-lessons "auth"           # Search lessons
```

Memory is loaded into workflows via `init memory`. It's trimmed by priority when approaching token budget limits.

---

## Research Documents

Research lives in `.planning/research/`:

| File | Content |
|------|---------|
| `SUMMARY.md` | Synthesized research findings with confidence rating |
| `ARCHITECTURE.md` | Architecture design with module specs and data flows |
| `FEATURES.md` | Feature research and competitive analysis |
| `STACK.md` | Technology stack decisions |
| `PITFALLS.md` | Known pitfalls with prevention strategies |
| `TDD-EXECUTION.md` | TDD system analysis |
| `AGENTIC-AUDIT.md` | Competitive audit of agent systems |

Research is created during `/gsd-new-project` (4 parallel researchers) or `/gsd-new-milestone`.

---

## Codebase Analysis

For brownfield projects, `/gsd-map-codebase` creates 7 documents in `.planning/codebase/`:

| File | Focus |
|------|-------|
| `STACK.md` | Languages, frameworks, runtimes |
| `INTEGRATIONS.md` | External services, APIs |
| `ARCHITECTURE.md` | Module structure, patterns |
| `STRUCTURE.md` | Directory organization |
| `CONVENTIONS.md` | Naming patterns, code style |
| `TESTING.md` | Test framework, coverage |
| `CONCERNS.md` | Tech debt, risk areas |

These feed into planning agents for context-aware plan generation.

---

## Quick Tasks

Ad-hoc tasks via `/gsd-quick` get their own directory:

```
quick/
  1-fix-login-button/
    1-PLAN.md
    1-SUMMARY.md
```

Quick tasks get the same guarantees (planning, execution, commit tracking) with less ceremony.

---

## Debug Sessions

Persistent debug state in `.planning/debug/`:

```
debug/
  payment-webhook-timeout.md    # Symptoms, hypotheses, evidence, timeline
```

Debug sessions survive `/clear` and session restarts. The gsd-debugger agent maintains the investigation state.

---

## Token Baselines

Performance measurement data in `.planning/baselines/`:

| File | Content |
|------|---------|
| `bundle-size.json` | Current bundle size vs budget |
| `baseline-*.json` | Token measurements for workflows |

Used by `/gsd-context-budget compare` to measure token savings across versions.

---

## Design Principles

1. **Human-readable first.** All planning documents are markdown. Humans can read, edit, and understand them without tools.

2. **Single source of truth.** STATE.md is authoritative for position. ROADMAP.md is authoritative for plan structure. Memory files cache derived data.

3. **Survives context resets.** Everything lives in files, not conversation history. `/clear` loses nothing.

4. **Git-tracked.** Planning documents are committed alongside code. History is preserved.

5. **Incremental.** Documents are updated, not recreated. Milestone archives preserve history.

6. **Bounded.** Memory has token budgets. Bookmarks are trimmed to 20. Context injection has a 5K token cap. Nothing grows unbounded.

---

*For how agents use these documents, see [Agents](agents.md). For the full command reference, see [Commands](commands.md).*
