**Revision:** 3
**Created:** 2026-02-25
**Updated:** 2026-02-26

<objective>
A zero-dependency CLI plugin that provides structured planning, execution, and verification workflows for AI-driven software development.

The plugin turns unstructured project ideas into executable plans with traceability from intent through requirements to delivered code, optimized for single-developer + AI-assistant workflows.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-01 [P1] [achieved v3.0]: Every project captures why it exists and what success looks like in a structured, machine-readable format (INTENT.md)
- DO-02 [P1] [achieved v3.0]: AI agents automatically see project intent in their context, aligning decisions with stated goals
- DO-03 [P1] [achieved v3.0]: Work that drifts from stated intent is detected and flagged before execution (advisory, not blocking)
- DO-04 [P2] [achieved v3.0]: Plans trace back to desired outcomes, creating full traceability from intent to delivered code
- DO-05 [P2] [achieved v3.0]: Verification checks deliverables against desired outcomes and success criteria, not just requirements
- DO-06 [P3] [achieved v3.0]: Intent evolves across milestones with tracked reasoning for changes
- DO-07 [P1] [achieved v5.0]: Agents receive architectural context (conventions, dependencies, lifecycle) scoped to their current task, reducing mistakes from incomplete project understanding
- DO-08 [P1] [achieved v5.0]: Codebase analysis runs as specialized parallel agents that produce structured, queryable artifacts
- DO-09 [P2] [achieved v5.0]: Convention violations are detectable before execution (e.g. wrong module path, missing seed update)
- DO-10 [P2] [achieved v5.0]: Analysis results stay current as the codebase evolves (staleness detection, incremental updates)
- DO-11 [P1]: CLI output is branded and human-readable when run interactively, with automatic TTY detection falling back to JSON for agent consumption
- DO-12 [P1]: Shared formatting infrastructure (tables, colors, banners, progress bars) eliminates ad-hoc output and ensures visual consistency
- DO-13 [P2]: Workflow-rendered output is tighter — less noise, higher information density, no redundant status messages
- DO-14 [P2]: All 11 feature commands are accessible as slash commands in OpenCode with proper command wrappers
</outcomes>

<criteria>
- SC-01: `intent create` produces valid INTENT.md; `intent show` renders it; `intent validate` passes
- SC-02: `intent trace` shows which outcomes have plans and which have gaps
- SC-03: `intent drift` produces numeric score; init commands show drift advisory
- SC-04: All GSD workflows (research, plan, execute, verify) receive intent context automatically
- SC-05: GSD's own .planning/INTENT.md is maintained alongside its roadmap
- SC-06 [achieved v5.0]: Codebase analysis produces structured artifacts that execution agents can query by task scope
- SC-07 [achieved v5.0]: Convention extraction detects naming patterns, file organization, and framework-specific macros
- SC-08 [achieved v5.0]: Dependency graph shows module relationships and change impact
- SC-09 [achieved v5.0]: Lifecycle analysis captures execution order (seeds, migrations, config, boot)
- SC-10: Running any command in a TTY produces branded, readable output; piped output remains JSON
- SC-11: `src/lib/format.js` provides table, color, banner, progress, and box utilities used by all commands
- SC-12: Workflow output tokens decrease measurably vs v5.0 baselines (noise reduction)
- SC-13: All 11 feature slash commands are registered and functional in OpenCode
</criteria>

<constraints>
### Technical
- C-01: Zero external dependencies — Node.js standard library only
- C-03: All operations are advisory — never block workflow execution

### Business
- C-04: Backward compatible — projects without codebase analysis work exactly as before
- C-05: Analysis adds value without adding ceremony — no mandatory steps
</constraints>

<health>
### Quantitative
- HM-02: All tests pass (572+ currently) with zero regressions after each phase
- HM-03: Init commands complete in <500ms even with analysis context injection

### Qualitative
Codebase intelligence should feel like agents naturally understand the project, not like a manual documentation exercise. Task-scoped injection means agents get relevant context without information overload.
</health>

<history>
- v3.0 (2026-02-25): Initial intent created for intent engineering milestone
- v5.0 (2026-02-25): Evolved for codebase intelligence milestone — marked DO-01 through DO-06 as achieved, added DO-07 through DO-10 for architectural understanding and task-scoped context, dropped bundle size constraint (C-02) and v3.0 timeline constraint (C-06), added success criteria SC-06 through SC-09, updated health metrics to reflect current test count (502+)
- v6.0 (2026-02-26): Evolved for UX & Developer Experience milestone — marked DO-07 through DO-10 and SC-06 through SC-09 as achieved (v5.0), added DO-11 through DO-14 for branded TUI output, formatting infrastructure, workflow noise reduction, and slash command completion, added SC-10 through SC-13
</history>
