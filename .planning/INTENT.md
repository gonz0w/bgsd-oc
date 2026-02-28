**Revision:** 7
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
- DO-15 [P1] [achieved v7.0]: Missing agent roles (code review, test generation, refactoring, dependency management) exist as first-class specialized agent types
- DO-16 [P1] [achieved v7.0]: Orchestrator intelligently assigns work to the right agent type based on task nature and context
- DO-17 [P1] [achieved v7.0]: Independent tasks run in parallel by default — more work happens concurrently with less coordination overhead
- DO-18 [P2] [achieved v7.0]: Git workflows go beyond commit/diff — branch strategy awareness, conflict detection, PR workflow support
- DO-19 [P1] [achieved v7.0]: Agents receive only what they need — measurable reduction in tokens loaded per agent without fidelity loss
- DO-20 [P2]: Commands that are slow get profiled and optimized — measurable latency improvement where it matters
- DO-21 [P1]: Developer can checkpoint code state and decision context at any named point during execution
- DO-22 [P1]: Developer can pivot to a different approach with recorded reasoning, rewinding to a prior checkpoint
- DO-23 [P1]: Multiple attempts at the same task/plan/phase can be compared on outcome metrics (tests, complexity, LOC)
- DO-24 [P1]: Winning approach can be merged back while alternatives are archived as named branches
- DO-25 [P1]: Decision journal captures all trajectories — what was tried, why it was abandoned, what was chosen — consumable by agents and humans
- DO-26 [P2]: Trajectory exploration works at task, plan, and phase levels with appropriate granularity at each
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
- SC-14: `trajectory checkpoint` creates named snapshot with code state + decision context
- SC-15: `trajectory pivot` records abandonment reason, rewinds code to checkpoint, writes context bridge file
- SC-16: `trajectory compare` shows outcome metrics (tests, complexity, LOC) across all attempts
- SC-17: `trajectory choose` merges winner and archives alternatives as named git branches
- SC-18: Decision journal entries are auto-injected into agent context during execution to prevent dead-end re-exploration
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
- HM-02: All tests pass (669 currently) with zero regressions after each phase
- HM-03: Init commands complete in <500ms even with analysis context injection
- HM-04: Agent context load is measurably reduced vs v6.0 baselines (tokens per agent invocation)

### Qualitative
Orchestration should feel invisible — the right agent gets the right task with the right context, and the developer only sees results. Agent coordination overhead should decrease, not increase, as more specialized roles are added.
</health>

<history>
- v3.0 (2026-02-25): Initial intent created for intent engineering milestone
- v5.0 (2026-02-25): Evolved for codebase intelligence milestone — marked DO-01 through DO-06 as achieved, added DO-07 through DO-10 for architectural understanding and task-scoped context, dropped bundle size constraint (C-02) and v3.0 timeline constraint (C-06), added success criteria SC-06 through SC-09, updated health metrics to reflect current test count (502+)
- v6.0 (2026-02-26): Evolved for UX & Developer Experience milestone — marked DO-07 through DO-10 and SC-06 through SC-09 as achieved (v5.0), added DO-11 through DO-14 for branded TUI output, formatting infrastructure, workflow noise reduction, and slash command completion, added SC-10 through SC-13
- v6.0 (2026-02-27): Post-milestone update — marked DO-11 through DO-14 and SC-10 through SC-13 as achieved (v6.0), updated test count to 574
- v7.0 (2026-02-26): Evolved for Agent Orchestration & Efficiency milestone — updated objective to emphasize intelligent orchestration at scale, added DO-15 through DO-20 for specialized agents, smart routing, parallelism, git intelligence, leaner context, and faster CLI, dropped C-01 (zero deps) permanently — dependencies allowed when they serve quality
- v7.1 (2026-02-28): Evolved for Trajectory Engineering milestone — expanded objective to include structured exploration, marked DO-15/16/17/18/19 as achieved (v7.0), added DO-21 through DO-26 for checkpoint/pivot/compare/choose workflow and decision journals, added SC-14 through SC-18, updated test count to 669
</history>
