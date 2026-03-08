# bGSD (Get Stuff Done) — AI Project Planning for OpenCode

A structured project planning and execution system for [OpenCode](https://github.com/opencode-ai/opencode). bGSD turns AI-assisted coding from ad-hoc prompting into milestone-driven development with planning, execution, verification, and memory that persists across sessions.

**762 tests** | **Zero runtime dependencies** | **40 slash commands** | **100+ CLI operations** | **9 specialized AI agents** | **11 milestones shipped**

> **Note:** bGSD creates a `~/.config/oc` symlink pointing to `~/.config/opencode` to work around a path mangling issue in the Anthropic auth module. This is created automatically during installation.

---

## The Problem

AI coding assistants are powerful but chaotic. Without structure, you get:
- Lost context between sessions
- No traceability from requirements to code
- No verification that what was built matches what was asked for
- No way to pause, resume, or hand off work
- No learning from past decisions
- Error cascading from unchecked edits

## The Solution

bGSD provides a complete project lifecycle inside your AI editor:

```
Idea → Requirements → Roadmap → Plans → Execution → Verification
  |                                                        |
  +-- Intent tracking, session memory, quality gates,  ----+
      TDD enforcement, review gates, progress metrics
```

Every step produces structured documents in `.planning/` that agents read for context. Decisions persist. Progress is tracked. Quality is measured. See the **[Planning System](docs/planning-system.md)** for the full `.planning/` structure.

---

## Quick Start

Then in OpenCode:

```
/bgsd-new-project
```

That's it. bGSD walks you through everything: what you want to build, how to break it down, and then executes it phase by phase.

### Uninstall

```bash
npx get-shit-done-oc --uninstall
```

### Update

```bash
npx get-shit-done-oc@latest
```

See the **[Getting Started Guide](docs/getting-started.md)** for the full walkthrough, or the **[Expert Guide](docs/expert-guide.md)** if you want full control.

---

## Two Flows

**Easy Flow** — Let bGSD drive. Answer questions, approve plans, watch execution:

```
/bgsd-new-project           # Answer "what do you want to build?"
                            # bGSD creates requirements, roadmap, phases
/bgsd-plan-phase 1           # bGSD creates executable plans for phase 1
/bgsd-execute-phase 1        # bGSD builds it, commits per-task, verifies
/bgsd-progress               # See where things stand, get routed to next action
```

**Expert Flow** — Control every decision. Research domains, discuss assumptions, tune agents:

```
/bgsd-map-codebase                       # Analyze existing code first (brownfield)
/bgsd-new-project                        # Full questioning + parallel research
/bgsd-discuss-phase 1                    # Lock down implementation decisions
/bgsd-list-phase-assumptions 1           # See what the AI assumes before planning
/bgsd-research-phase 1                   # Deep domain research
/bgsd-plan-phase 1 --research            # Plan with integrated research
/bgsd-execute-phase 1                    # Execute with wave parallelism
/bgsd-verify-work 1                      # Manual UAT testing
/bgsd-audit-milestone                    # Cross-phase integration check
```

---

## Key Features

**[9 Specialized AI Agents](docs/agents.md)** — Planner, executor, verifier, debugger, researchers, roadmapper, plan checker, and codebase mapper. Two-stage code review (spec compliance + code quality) embedded in execution.

**Intelligent Orchestration** — Task complexity scoring (1-5) drives automatic model selection. Agent context manifests reduce token usage by 40-60%.

**Model Profiles** — Three tiers (quality/balanced/budget) controlling which model handles planning, execution, and verification. See **[Configuration](docs/configuration.md)**.

**Wave-Based Parallel Execution** — Plans organized into dependency waves; independent plans run in parallel.

**[TDD Execution Engine](docs/tdd.md)** — Orchestrator-enforced RED → GREEN → REFACTOR gates with anti-pattern detection and auto test-after-edit.

**Quality Gates** — Two-stage review, severity-classified findings (BLOCKER/WARNING/INFO), test gating, requirement verification, regression detection, A-F quality scoring, intent drift scoring, and stuck/loop detection with recovery.

**AST Intelligence** — Acorn-based JS/TS parsing, ~1k token repo maps, per-function complexity metrics, and module dependency graphs with cycle detection.

**Context Efficiency** — Agent context manifests, compact serialization, task-scoped injection, and bounded token budgets preventing context rot.

**Session Memory** — Decisions, lessons, bookmarks, and trajectory journals persist across `/clear` and session restarts.

**[RAG Research Pipeline](docs/configuration.md)** — YouTube search (yt-dlp), NotebookLM synthesis, multi-source orchestration. Gracefully degrades through 4 tiers down to pure LLM.

**[Trajectory Engineering](docs/architecture.md)** — Checkpoint, compare metrics, pivot, and choose between implementation approaches while preserving planning state.

**Git Integration** — Per-task atomic commits, pre-commit safety checks, session diffs, rollback info, TDD trailers, branch-per-phase strategies, and selective rewind.

**Codebase Intelligence** — Convention extraction, dependency graphs across 6 languages, lifecycle awareness, and environment detection for 26 manifest patterns.

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | First project walkthrough, easy flow, minimal decisions |
| **[Expert Guide](docs/expert-guide.md)** | Full control flow, all options, advanced patterns |
| **[Command Reference](docs/commands.md)** | Every command with arguments, options, and examples |
| **[Architecture](docs/architecture.md)** | How bGSD works internally, agent system, tool design |
| **[Agent System](docs/agents.md)** | All 9 agents, their roles, spawning, model profiles |
| **[Workflows](docs/workflows.md)** | All 45 workflows, what they do, how they connect |
| **[Planning System](docs/planning-system.md)** | How .planning/ works, document structure, lifecycle |
| **[Configuration](docs/configuration.md)** | Full configuration reference with all options |
| **[TDD Guide](docs/tdd.md)** | TDD execution engine, RED-GREEN-REFACTOR, anti-patterns |
| **[Design Decisions](docs/decisions.md)** | Why bGSD is built the way it is, with rationale |
| **[Research & Analysis](docs/research.md)** | Competitive audit, research methodology, key findings |
| **[Version History](docs/milestones.md)** | Every milestone, what shipped, metrics |
| **[Troubleshooting](docs/troubleshooting.md)** | Common issues and solutions |

---

## Commands

bGSD includes **40 slash commands** across project lifecycle, planning, execution, analysis, and configuration. See the **[Full Command Reference](docs/commands.md)**.

| Command | What It Does |
|---------|-------------|
| `/bgsd-new-project` | Initialize project: questioning, research, roadmap |
| `/bgsd-plan-phase [N]` | Create executable plans for a phase |
| `/bgsd-execute-phase N` | Execute all plans in a phase |
| `/bgsd-progress` | View progress, get routed to next action |
| `/bgsd-quick` | Execute small tasks with bGSD guarantees |

---

## Development

> **For end users:** Use `npx get-shit-done-oc` to install. The instructions below are for contributors working on bGSD itself.

```bash
# Clone
git clone https://github.com/gonz0w/bgsd-oc.git
cd bgsd-oc

# Install & build
npm install
npm run build

# Run tests (node:test, 762 tests)
npm test

# Test a specific command
node bin/gsd-tools.cjs state validate --raw

# Deploy to live OpenCode config (dev workflow)
./deploy.sh
```

Built with esbuild into a single `bin/gsd-tools.cjs` file. See **[Architecture](docs/architecture.md)** for the full source structure.

---

## Requirements

- Node.js >= 22.5 (required for `node:sqlite` caching; falls back to in-memory cache on older versions)
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
