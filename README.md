# bGSD — AI Project Planning & Execution

A structured project lifecycle system for AI-assisted coding. Turns ad-hoc prompting into milestone-driven development with planning, execution, verification, and session memory.

**1,500+ tests** | **Zero dependencies** | **41 slash commands** | **10 specialized agents**

---

## What It Does

bGSD gives your AI editor a complete project workflow: requirements gathering, roadmap creation, phase planning, parallel execution with atomic commits, automated verification, and GitHub CI integration. Everything persists in `.planning/` so context survives across sessions.

## Example Flow

```
/bgsd-new-project              # Answer questions about what you want to build
                                # → Creates requirements, roadmap, phases

/bgsd-plan-phase 1              # Create executable plans for phase 1
                                # → Breaks work into tasks with file targets

/bgsd-execute-phase 1           # Build it — atomic commits per task, two-stage review
                                # → Code written, tested, committed

/bgsd-verify-work 1             # Verify output matches requirements
                                # → Gap report if anything's missing

/bgsd-progress                  # See where things stand, get routed to next action

/bgsd-github-ci                 # Push, create PR, run code scanning, fix loop, auto-merge
```

Each command handles orchestration, agent spawning, and state management automatically. Use `/bgsd-help` for the full command list, or see the [Command Reference](docs/commands.md) for detailed docs.

---

## Key Capabilities

- **10 Specialized Agents** — Planner, executor, verifier, debugger, researchers, roadmapper, plan checker, codebase mapper, GitHub CI agent. Two-stage code review embedded in execution.
- **Wave-Based Parallel Execution** — Plans organized into dependency waves; independent plans run concurrently.
- **TDD Execution Engine** — Orchestrator-enforced RED/GREEN/REFACTOR gates with anti-pattern detection.
- **Quality Gates** — Severity-classified findings, test gating, requirement verification, A-F scoring, intent drift detection, stuck/loop recovery.
- **SQLite-First Data Layer** — Planning cache, memory stores, and session state backed by SQLite with write-through consistency and Map fallback for older Node versions.
- **Decision Engine** — Deterministic decision functions replacing LLM calls for routing, classification, and gating decisions with confidence-scored outputs.
- **CLI Tool Integration** — ripgrep, fd, jq, yq, bat, and GitHub CLI with auto-detection, 5-minute TTL caching, and graceful Node.js fallbacks.
- **Skill System** — Install, validate, and manage community skills with a 41-pattern security scanner, audit logging, and GitHub fetch pipeline.
- **Lesson Analysis Pipeline** — Structured lesson capture, pattern grouping via `lessons:analyze`, advisory suggestions, automatic compaction, and deviation auto-capture.
- **Local Agent Overrides** — Customize agent behavior per-project with `agent:override`, diff against upstream, and selective sync.
- **Research Quality Scoring** — `research:score` returns structured quality profiles, `research:gaps` extracts actionable gap lists, multi-source conflict detection.
- **AST Intelligence** — JS/TS parsing, repo maps, per-function complexity metrics, dependency graphs with cycle detection.
- **Session Memory** — Decisions, lessons, bookmarks, and trajectory journals persist across sessions and `/clear`. SQL-backed search and dual-write JSON backup.
- **Git Integration** — Per-task atomic commits, session diffs, rollback info, TDD trailers, branch-per-phase strategies, automated GitHub CI pipeline.
- **Context Efficiency** — Agent context manifests, compact serialization, task-scoped injection, bounded token budgets.
- **Model Profiles** — Three tiers (quality/balanced/budget) controlling which model handles each agent role.
- **Visualization** — Burndown charts, velocity sparklines, ASCII progress bars, quality score displays, and terminal dashboard.

---

## Development

```bash
npm install && npm run build    # Install deps and build CLI
npm test                        # Run full test suite (1,500+ tests)
./deploy.sh                     # Deploy to live host editor config
```

`deploy.sh` copies commands, workflows, templates, references, agents, hooks, and the built CLI to the host editor's config directory. This is the only deployment step needed during development.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Command Reference](docs/commands.md) | All 41 commands with arguments, options, and examples |
| [Getting Started](docs/getting-started.md) | First project walkthrough |
| [Expert Guide](docs/expert-guide.md) | Full control flow and advanced patterns |
| [Architecture](docs/architecture.md) | Internals, agent system, tool design |
| [Agent System](docs/agents.md) | All 10 agents, roles, spawning, model profiles |
| [Planning System](docs/planning-system.md) | `.planning/` structure and document lifecycle |
| [Configuration](docs/configuration.md) | Full configuration reference |
| [TDD Guide](docs/tdd.md) | TDD execution engine and anti-patterns |

## Requirements

- Node.js >= 22.5
- A compatible AI code editor

## License

MIT
