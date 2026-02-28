**Revision:** 6
**Created:** 2026-02-25
**Updated:** 2026-02-28

<objective>
An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Supports trajectory engineering: checkpoint, pivot, compare, and choose between multiple approaches at any workflow level, with decision journals that prevent re-exploring dead ends.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-15 [P1]: Missing agent roles (code review, test generation, refactoring, dependency management) exist as first-class specialized agent types
- DO-16 [P1]: Orchestrator intelligently assigns work to the right agent type based on task nature and context
- DO-17 [P1]: Independent tasks run in parallel by default — more work happens concurrently with less coordination overhead
- DO-18 [P2]: Git workflows go beyond commit/diff — branch strategy awareness, conflict detection, PR workflow support
- DO-19 [P1]: Agents receive only what they need — measurable reduction in tokens loaded per agent without fidelity loss
- DO-20 [P2]: Commands that are slow get profiled and optimized — measurable latency improvement where it matters
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
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
- HM-02: All tests pass (574 currently) with zero regressions after each phase
- HM-03: Init commands complete in <500ms even with analysis context injection
- HM-04: Agent context load is measurably reduced vs v6.0 baselines (tokens per agent invocation)

### Qualitative
Orchestration should feel invisible — the right agent gets the right task with the right context, and the developer only sees results. Agent coordination overhead should decrease, not increase, as more specialized roles are added.
</health>

<history>
### v7.0 — 2026-02-28
- **Modified** objective: An intelligent agent orchestration engine for building large-scale software. Provides structured planning, execution, verification, specialized agent coordination, and structured exploration — turning unstructured project ideas into executable plans with traceability from intent through requirements to delivered code. Supports trajectory engineering: checkpoint, pivot, compare, and choose between multiple approaches at any workflow level, with decision journals that prevent re-exploring dead ends.
  - Reason: Milestone v7.1: expanded to include structured exploration and trajectory engineering

</history>
