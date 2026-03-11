**Revision:** 13
**Created:** 2026-02-25
**Updated:** 2026-03-10

<objective>
An intelligent agent orchestration engine for building large-scale software with a deeply embedded plugin experience. This milestone emphasizes rigorous performance benchmarking against modern OpenCode plugins, targeted latency reduction, and selective adoption of dependencies/new technology where measurable speed gains justify complexity.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-20 [P2]: Commands that are slow get profiled and optimized — measurable latency improvement where it matters
- DO-27 [P1]: Agent roles have zero overlap — each agent has a single, clear responsibility with no duplicated work
- DO-28 [P1]: Context loading is deterministic — agents receive pre-computed context, not search-and-discover
- DO-30 [P1]: Commands consolidated into subcommand groups — fewer top-level commands, same capabilities
- DO-32 [P2]: Memory and disk I/O usage measurably reduced vs v7.1 baselines
- DO-33 [P1]: Zero orphaned code — every function, export, workflow, template, and config entry is reachable and used
- DO-34 [P1]: Command surface area reduced — stale commands removed, overlapping commands consolidated, internal-only calls not exposed as slash commands
- DO-35 [P1]: Agent boundaries validated — each agent has a precise manifest, minimal context load, and structured handoff contracts
- DO-36 [P2]: Bundle size reduced — dead code removal and dependency pruning measurably shrink the output
- DO-37 [P1]: Shared agent metadata (references, manifests, common workflows) extracted into reusable OpenCode skills — reducing duplication and context loading across agents
- DO-38 [P1]: Test suite is fully green — zero pre-existing failures, all 762+ tests pass
- DO-39 [P1]: The AI always knows current project state (phase, plan, blockers) without agents needing to run init commands — context injected via system prompt hook
- DO-40 [P1]: Hot-path CLI operations available as native LLM-callable tools — faster, typed, no shell overhead
- DO-41 [P1]: Project state stays synchronized automatically — STATE.md updates on session idle, file changes trigger validation
- DO-42 [P2]: Slash commands auto-enrich with project context before executing — reducing manual @-file references
- DO-43 [P2]: Advisory guardrails catch convention violations and suggest test runs via tool interception — graduating to blocks for critical safety
- DO-44 [P2]: Phase transitions, milestone completion, and stuck detection trigger visible notifications
- DO-45 [P1]: Compaction preserves full project context (decisions, blockers, current task, intent) — not just STATE.md
- DO-46 [P1]: CLI tool integrations operational — ripgrep, fd, fzf, bat, gh, lazygit, jq, yq available and discoverable
- DO-47 [P1]: Bun runtime validated — 3-5x startup improvement demonstrated with backward compatibility
- DO-48 [P2]: Plugin benchmark adapter built — cross-plugin comparison framework operational
- DO-49 [P1]: Planning intelligence improved — Better task decomposition with dependency detection and sizing heuristics
- DO-50 [P1]: Verification intelligence enhanced — Smarter testing strategies, better regression detection, automated edge case discovery
- DO-51 [P1]: Execution intelligence advanced — Deviation handling with autonomous recovery, improved checkpoint decisions
- DO-52 [P1]: Multi-agent collaboration optimized — Better handoffs between agents, shared context patterns, coordinated execution
- DO-53 [P1]: Rich TTY output — Enhanced formatting, color schemes, structured tables, progress visualization
- DO-54 [P1]: Interactive workflows — Guided prompts, wizards for complex tasks, interactive command modes
- DO-55 [P2]: Command discoverability improved — Better help, suggestions, context-aware completions
- DO-56 [P2]: Error handling improved — Actionable error messages, debug helpers, recovery suggestions
- DO-57 [P2]: Memory usage reduced — Measurable reduction in memory and disk I/O vs v9.3 baselines
- DO-58 [P2]: Bundle size optimized — Further reduction beyond v9.3 baseline via dead code removal
- DO-59 [P1]: Enhanced compaction — Full project context preserved during compaction (decisions, blockers, intent, trajectory)
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
- SC-19: Agent audit document maps every lifecycle stage to exactly one agent with no overlapping responsibilities
- SC-21: Agent init commands load context from cache in <100ms (vs current filesystem baseline)
- SC-22: Top-level slash commands reduced by ≥50% via subcommand grouping
- SC-24: Dead code audit produces zero orphaned functions, exports, or unreachable modules
- SC-25: Every workflow, template, and reference file is reachable from at least one command or agent
- SC-26: Bundle size measurably smaller than v8.1 baseline (~1216KB)
- SC-27: Agent RACI audit passes with no overlap warnings and clear handoff contracts documented
- SC-28: Agent metadata shared via OpenCode skills is loadable and reduces per-agent context size
- SC-29: All 762+ tests pass with zero pre-existing failures (config-migrate, compact, codebase-impact, codebase ast fixed)
- SC-30: GitHub CI agent uses structured todo tracking and proper workflow gates matching other agents
- SC-31: System prompt hook injects current phase, plan, and blockers into every LLM interaction without manual init calls
- SC-32: At least 5 hot-path CLI operations are registered as native LLM-callable tools with typed Zod schemas
- SC-33: STATE.md auto-updates when session goes idle with no manual intervention
- SC-34: Compaction preserves PROJECT.md context, INTENT.md summary, decisions, and blockers alongside STATE.md
- SC-35: Toast notifications fire on phase completion, milestone completion, and stuck detection events
- SC-36: Tool interception provides advisory warnings when convention-violating file writes are detected
- SC-37: Planning intelligence produces task decomposition with clear dependencies and sizing estimates
- SC-38: Verification intelligence detects regressions automatically with coverage analysis
- SC-39: Execution deviation handling recovers autonomously from common failure patterns
- SC-40: Multi-agent handoffs include structured context transfer with preconditions verified
- SC-41: TTY output includes rich formatting, colors, and structured tables with progress indicators
- SC-42: Interactive workflows guide users through complex multi-step tasks with prompts
- SC-43: Command help includes contextual suggestions and examples
- SC-44: Error messages include actionable recovery suggestions and relevant context
- SC-45: Memory usage measurably reduced vs v9.3 baseline (measure via /bgsd-measure)
- SC-46: Bundle size reduced beyond v9.3 baseline (measure via baseline comparison)
- SC-47: Compaction preserves full context including decisions, blockers, intent, and trajectory data
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution

### Business
- C-04: Backward compatible — projects without codebase analysis work exactly as before
- C-05: Analysis adds value without adding ceremony — no mandatory steps

</constraints>

<health>
### Quantitative
- HM-02: All tests pass (751 currently) with zero regressions after each phase
- HM-03: Init commands complete in <100ms with cache layer (current baseline <500ms)
- HM-04: Agent context load is measurably reduced vs v7.1 baselines (tokens per agent invocation)
- HM-05: Disk I/O operations per agent invocation measurably reduced vs v7.1 baseline

### Qualitative
Orchestration should feel invisible — the right agent gets the right task with the right context, and the developer only sees results. Agent coordination overhead should decrease, not increase, as more specialized roles are added.
</health>

<history>
### v10.0 — 2026-03-10
- **Added** outcomes: DO-49 through DO-59 covering agent intelligence (planning, verification, execution, multi-agent), UX (formatting, interactivity, commands, errors), and performance (memory, bundle, compaction).
  - Reason: Milestone v10.0: Agent Intelligence & UX — comprehensive upgrade

### v9.3 — 2026-03-10
- **Added** outcomes: DO-46 (CLI tool integrations), DO-47 (Bun runtime), DO-48 (plugin benchmark adapter).
  - Reason: Milestone v9.2: CLI Tool Integrations & Runtime Modernization

### v9.0 — 2026-03-09
- **Modified** objective: Added deeply embedded editor experience through plugin hooks as a first-class architectural concern.
  - Reason: Milestone v9.0: Plugin is the primary integration surface for UX
- **Added** outcomes: DO-39 (always-on context injection), DO-40 (native LLM-callable tools), DO-41 (event-driven state sync), DO-42 (command enrichment), DO-43 (advisory guardrails), DO-44 (notifications), DO-45 (enhanced compaction).
  - Reason: Milestone v9.0: Embedded Plugin Experience — full hook surface utilization
- **Added** criteria: SC-31 through SC-36 for plugin integration verification.
  - Reason: Milestone v9.0: Measurable success criteria for each plugin capability
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software with a deeply embedded plugin experience. This milestone emphasizes rigorous performance benchmarking against modern OpenCode plugins, targeted latency reduction, and selective adoption of dependencies/new technology where measurable speed gains justify complexity.
  - Reason: Milestone v9.1: prioritize plugin performance benchmarking and modernization

### v8.3 — 2026-03-08
- **Modified** objective: Added reusable skills architecture as a first-class architectural concern alongside minimal context loading, fast execution, and clean agent boundaries.
  - Reason: Milestone v8.3: Skills architecture for shared agent metadata
- **Added** outcomes: DO-37 (skills-based agent metadata sharing), DO-38 (zero pre-existing test failures).
  - Reason: Milestone v8.3: Agent quality, skills exploration, and test debt cleanup
- **Added** criteria: SC-28 (skills reduce context size), SC-29 (all tests green), SC-30 (GitHub CI agent quality).
  - Reason: Milestone v8.3: Success criteria for agent quality and skills work

### v8.2 — 2026-03-06
- **Modified** outcomes: Marked DO-29, DO-31 as achieved v8.0. Added DO-33 (zero orphaned code), DO-34 (command surface reduction), DO-35 (agent boundary validation), DO-36 (bundle size reduction).
  - Reason: Milestone v8.2: Hardening milestone — dead code audit, command cleanup, agent sharpening, performance tuning
- **Modified** criteria: Marked SC-20, SC-23 as achieved v8.0. Added SC-24 (dead code audit clean), SC-25 (file reachability), SC-26 (bundle size reduction), SC-27 (RACI audit clean).
  - Reason: Milestone v8.2: Success criteria for cleanup and validation work

### v7.1 — 2026-03-02
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, and clean agent boundaries — each agent does one thing well with exactly the context it needs.
  - Reason: Milestone v8.0: Added performance and agent architecture focus

</history>
