# Command Footprint Reduction PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-28
**Status:** Backlog
**Target window:** After current milestone completion

## Problem

bGSD currently exposes too many top-level slash commands for the frequency with which most users actually need them.

The result is product friction rather than capability:
- the command list is harder to learn than the underlying workflow model
- closely related actions are split across separate top-level names
- some commands are aliases or near-aliases, which makes the surface area feel larger than the true feature set
- help and docs do not cleanly distinguish core daily-use commands from advanced or maintenance commands
- workflows, agents, templates, and docs contain stale or inconsistent command references, including missing flags and incorrect next-step suggestions

This creates a user experience where people remember only a small subset of commands, do not trust the rest, and are unsure which command is the canonical entrypoint.

## Goal

Reduce the visible command footprint without reducing capability.

The new command model should:
- make the primary workflow obvious
- collapse closely related commands into fewer top-level entrypoints
- preserve backward compatibility through aliases and deprecation guidance
- ensure help, workflows, agents, templates, and docs all point to the same canonical next steps
- make follow-up guidance explicit when flags are required, especially for gap-closing and filtered execution flows

## Non-Goals

- Removing underlying CLI capabilities that still provide value
- Breaking existing user habits abruptly by deleting commands without compatibility shims
- Rewriting the planning model or execution architecture
- Solving every historical doc inconsistency outside command naming and next-step guidance

## User Needs

### Primary user need
- As a regular bGSD user, I want a small set of commands I can actually remember so I can drive planning and execution without consulting docs every session.

### Secondary user needs
- I want one obvious command for quick work.
- I want related operations grouped under one concept instead of memorizing multiple sibling commands.
- I want help output to show the few commands I should learn first.
- I want every workflow's suggested next step to be correct and executable as written.

## Current State Summary

### Observed issues
- `/bgsd-quick` and `/bgsd-quick-task` both exist even though there should be one canonical quick-entry command.
- planning-adjacent commands are split across `/bgsd-discuss-phase`, `/bgsd-research-phase`, `/bgsd-list-assumptions`, and `/bgsd-plan-phase`
- roadmap edits are split across `/bgsd-add-phase`, `/bgsd-insert-phase`, and `/bgsd-remove-phase`
- todo operations are split across `/bgsd-add-todo` and `/bgsd-check-todos`
- settings operations are split across `/bgsd-settings`, `/bgsd-set-profile`, and `/bgsd-validate-config`
- low-frequency analysis/history utilities consume many top-level names
- command references across workflows/docs are inconsistent; some omit required flags and some point to the wrong conceptual next step

### Specific correctness gaps already identified
- `/bgsd-review` exists but is missing from core help surfaces
- `/bgsd-quick` vs `/bgsd-quick-task` naming is inconsistent across repo docs
- `/bgsd-plan-gaps` and `/bgsd-plan-phase --gaps` are conceptually related but semantically different; guidance must distinguish milestone gap phases from in-phase gap-closure plans
- at least one stale command reference exists today: `/bgsd-discuss-milestone` is referenced but has no command wrapper

## Product Direction

Adopt a smaller, more intentional command surface with a canonical top-level set and a compatibility layer for legacy names.

The system should move toward:
- fewer top-level commands
- more verb families under a shared entrypoint
- one canonical command per user intent
- explicit help tiers: core vs advanced
- automated validation of command references in workflows, agents, templates, and docs

## Proposed Canonical Command Model

### 1. One quick command

Keep:
- `/bgsd-quick`

Deprecate to alias status:
- `/bgsd-quick-task`

Behavior:
- `/bgsd-quick` is the only user-facing quick-task command in help, docs, examples, and next-step guidance
- `/bgsd-quick-task` continues to work during a deprecation window, but every surfaced reference should prefer `/bgsd-quick`

### 2. Collapse planning-side subcommands into `/bgsd-plan-phase`

Current top-level commands to collapse:
- `/bgsd-discuss-phase`
- `/bgsd-research-phase`
- `/bgsd-list-assumptions`
- `/bgsd-plan-phase`

Canonical model:
- `/bgsd-plan-phase [phase]`
- `/bgsd-plan-phase [phase] --discuss`
- `/bgsd-plan-phase [phase] --research-only`
- `/bgsd-plan-phase [phase] --assumptions`
- `/bgsd-plan-phase [phase] --gaps`

Notes:
- `--gaps` remains the in-phase gap-closure planning mode triggered after UAT/debug diagnosis
- help and workflows must stop suggesting the older planning siblings as primary entrypoints once the unified model exists

### 3. Collapse roadmap-edit commands into `/bgsd-roadmap`

Current top-level commands to collapse:
- `/bgsd-add-phase`
- `/bgsd-insert-phase`
- `/bgsd-remove-phase`

Canonical model:
- `/bgsd-roadmap add "description"`
- `/bgsd-roadmap insert <after-phase> "description"`
- `/bgsd-roadmap remove <phase>`

Notes:
- old commands can remain as aliases for compatibility, but help/docs should teach the grouped form

### 4. Collapse todo commands into `/bgsd-todo`

Current top-level commands to collapse:
- `/bgsd-add-todo`
- `/bgsd-check-todos`

Canonical model:
- `/bgsd-todo add [task]`
- `/bgsd-todo list`
- `/bgsd-todo list [area]`

Notes:
- wording may use `list`, `show`, or `check`; one canonical verb should be chosen and used consistently everywhere

### 5. Collapse settings commands into `/bgsd-settings`

Current top-level commands to collapse:
- `/bgsd-settings`
- `/bgsd-set-profile`
- `/bgsd-validate-config`

Canonical model:
- `/bgsd-settings`
- `/bgsd-settings profile <quality|balanced|budget>`
- `/bgsd-settings validate`

Notes:
- `profile` and `validate` should be represented in help/examples as settings sub-actions rather than separate top-level commands

### 6. Collapse low-frequency analysis/history utilities into one advanced family

Current top-level commands to collapse:
- `/bgsd-velocity`
- `/bgsd-impact`
- `/bgsd-context-budget`
- `/bgsd-validate-deps`
- `/bgsd-test-run`
- `/bgsd-trace`
- `/bgsd-search-decisions`
- `/bgsd-search-lessons`
- `/bgsd-session-diff`
- `/bgsd-rollback-info`

Canonical model:
- `/bgsd-inspect velocity`
- `/bgsd-inspect impact`
- `/bgsd-inspect context-budget`
- `/bgsd-inspect validate-deps`
- `/bgsd-inspect test-run`
- `/bgsd-inspect trace <req>`
- `/bgsd-inspect search-decisions [query]`
- `/bgsd-inspect search-lessons [query]`
- `/bgsd-inspect session-diff`
- `/bgsd-inspect rollback-info <plan>`

Notes:
- these are useful but low-frequency for most users
- they should move out of the primary mental model and into an advanced utility family

## Core Command Set After Consolidation

The help-first command set should be optimized around what users do most often:
- `/bgsd-help`
- `/bgsd-new-project`
- `/bgsd-progress`
- `/bgsd-plan-phase`
- `/bgsd-execute-phase`
- `/bgsd-quick`
- `/bgsd-verify-work`
- `/bgsd-review`
- `/bgsd-debug`
- `/bgsd-settings`
- `/bgsd-roadmap`
- `/bgsd-todo`
- `/bgsd-inspect`

Milestone-specific lifecycle commands remain available, but should be presented as secondary or advanced unless the user is already in milestone management flows.

## Help and Discoverability

### Help redesign principles
- show the core command set first
- mark advanced families clearly
- prefer canonical commands only
- avoid teaching deprecated aliases
- include examples with required params and flags

### Required help changes
- add `/bgsd-review` to the main help surface
- remove `/bgsd-quick-task` from primary help once `/bgsd-quick` is canonical
- teach grouped families instead of sibling commands
- distinguish milestone gap closure from in-phase gap closure

Example guidance:
- after UAT gaps: `/bgsd-plan-phase 12 --gaps`
- after milestone audit gaps: `/bgsd-plan-gaps` or its future unified equivalent, but never the wrong one
- when filtered execution is required: include `--gaps-only` explicitly

## Command Reference Integrity

Every user-facing command mention in workflows, agents, templates, skills, and docs should be correct, canonical, and executable.

### Reference categories in scope
- `workflows/*.md`
- `agents/*.md`
- `templates/**/*.md`
- `skills/**/*.md`
- `docs/**/*.md`
- root project instructions such as `AGENTS.md`

### Required integrity rules
- no references to nonexistent slash commands
- no stale aliases used as the preferred command once canonical replacements exist
- every next-step suggestion uses the right command for the right workflow stage
- required parameters are included when needed
- required flags are included when needed
- examples and prose do not conflict with command help or wrapper inventory

### Examples of correctness expectations
- if a workflow means "execute only gap plans", it must say `/bgsd-execute-phase {phase} --gaps-only`
- if a workflow means "plan gap closure inside the current phase", it must say `/bgsd-plan-phase {phase} --gaps`
- if a workflow means "switch model profile", it should use `/bgsd-settings profile balanced` once consolidation lands
- if a workflow means "list todos in area api", it should use the canonical todo family form with the area parameter

## Requirements

### Functional requirements

1. The product exposes one canonical quick-entry command: `/bgsd-quick`.
2. Planning-related sibling commands collapse into `/bgsd-plan-phase` sub-modes.
3. Roadmap edit commands collapse into `/bgsd-roadmap` subcommands.
4. Todo commands collapse into `/bgsd-todo` subcommands.
5. Settings commands collapse into `/bgsd-settings` subcommands.
6. Low-frequency analysis/history commands collapse into `/bgsd-inspect` subcommands.
7. Legacy commands continue to resolve during a compatibility period.
8. `/bgsd-help` is updated to teach only canonical commands in the primary view.
9. `/bgsd-review` appears in the primary help surface.
10. All workflows, agents, templates, skills, and docs are scanned and corrected for command references and next-step guidance.

### UX requirements

11. Help output clearly separates core vs advanced commands.
12. The canonical command for a user intent is obvious from help and docs.
13. Deprecated aliases are not presented as the recommended path.
14. Next-step prompts include arguments and flags when required for successful execution.

### Quality requirements

15. There is an auditable inventory of command references across the repo.
16. The repo has a validation mechanism or scripted audit that detects nonexistent command references.
17. The repo has a validation mechanism or scripted audit that flags preferred use of deprecated aliases in user-facing surfaces.
18. The implementation preserves backward compatibility for existing users and docs-linked entrypoints during migration.

## Proposed Migration Strategy

### Phase 1: Introduce canonical grouped commands
- add the new grouped entrypoints
- preserve old wrappers as aliases
- route aliases to the same workflows or subcommand handlers where appropriate

### Phase 2: Flip discoverability
- update help to show only canonical commands in the main table
- update workflows/docs/templates/skills/agents to use canonical forms
- add deprecation notes only where useful

### Phase 3: Enforce reference correctness
- add automated scan/audit for command mentions
- fail validation when a command mention is nonexistent or known-stale
- optionally warn when next-step strings omit required flags for known flows

### Phase 4: Decide long-tail cleanup
- after sufficient compatibility time, evaluate removal of unused alias wrappers
- removal is optional; discoverability cleanup delivers most of the value even if aliases remain forever

## Open Product Decisions

1. Whether `/bgsd-plan-gaps` remains as a milestone-specific special case or is folded into a broader canonical gap-planning family.
2. Whether `/bgsd-inspect` is the final family name, or whether another umbrella name is clearer.
3. Whether grouped commands should be implemented as true slash-command subcommands, flag-based wrappers, or thin markdown aliases over existing internal CLI namespaces.
4. Whether help should have a compact default view and an advanced-expanded view.

## Success Metrics

- primary help surface shrinks materially while preserving task coverage
- canonical top-level commands are fewer and easier to remember
- `/bgsd-quick-task` no longer appears as the preferred quick path
- `/bgsd-review` appears in core help and command references
- repo scan finds zero references to nonexistent commands
- repo scan finds zero incorrect next-step suggestions for gap-planning or gap-execution flows
- user-facing docs and workflows consistently show required flags such as `--gaps` and `--gaps-only` where needed

## Acceptance Criteria

- a canonical grouped command map exists and is documented
- `/bgsd-quick` is the only recommended quick command in help/docs/workflows
- consolidated families exist for planning, roadmap, todo, settings, and advanced inspection
- the main help surface reflects the consolidated model
- workflows, agents, templates, skills, docs, and `AGENTS.md` are audited and corrected
- stale references such as nonexistent commands are removed or replaced
- next-step guidance is parameter-correct and flag-correct across all audited surfaces
