**Revision:** 10
**Created:** 2026-02-25
**Updated:** 2026-03-08

<objective>
An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, clean agent boundaries, and reusable skills architecture — each agent does one thing well with exactly the context it needs, sharing common patterns through composable skills.
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
### v8.2 — 2026-03-08
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, clean agent boundaries, and reusable skills architecture — each agent does one thing well with exactly the context it needs, sharing common patterns through composable skills.
  - Reason: Milestone v8.3: Added reusable skills architecture as a first-class architectural concern

### v8.2 — 2026-03-06
- **Modified** outcomes: Marked DO-29, DO-31 as achieved v8.0. Added DO-33 (zero orphaned code), DO-34 (command surface reduction), DO-35 (agent boundary validation), DO-36 (bundle size reduction).
  - Reason: Milestone v8.2: Hardening milestone — dead code audit, command cleanup, agent sharpening, performance tuning
- **Modified** criteria: Marked SC-20, SC-23 as achieved v8.0. Added SC-24 (dead code audit clean), SC-25 (file reachability), SC-26 (bundle size reduction), SC-27 (RACI audit clean).
  - Reason: Milestone v8.2: Success criteria for cleanup and validation work

### v7.1 — 2026-03-02
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Optimized for minimal context loading, fast execution, and clean agent boundaries — each agent does one thing well with exactly the context it needs.
  - Reason: Milestone v8.0: Added performance and agent architecture focus

</history>
