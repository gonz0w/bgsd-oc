# Phase 68: Agent Consistency Audit - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize all 10 agent definition files to the same structural quality. Every agent gets `<project_context>` discovery, PATH SETUP for GSD_HOME resolution, and a `<structured_returns>` section. While touching each agent, also normalize other structural patterns (deviation rules, checkpoint formats, TodoWrite instructions) so all agents follow consistent conventions. The agents' core capabilities and domain logic remain unchanged — this phase improves structure, not behavior.

</domain>

<decisions>
## Implementation Decisions

### Reference patterns and copy depth
- Use best-of adaptation: draw the best patterns from gsd-planner, gsd-executor, and gsd-github-ci as reference agents
- Adapt per agent's needs — not cookie-cutter copy/paste. Each agent's domain determines which patterns apply and how they're worded.
- Example: gsd-codebase-mapper doesn't need deviation rules about CI failures, but does need structured return fields appropriate to codebase mapping output

### Scope of consistency work
- Go beyond the 3 named blocks (project_context, PATH SETUP, structured_returns)
- Also normalize: deviation rules, checkpoint formats, TodoWrite instructions, and any other structural patterns that vary across agents
- Goal: an agent opened at random looks structurally familiar — same section order, same conventions, same discovery patterns
- Core domain logic and capabilities are NOT touched — only structural framing around the domain content

### structured_returns format
- Every agent gets a `<structured_returns>` section — no exceptions
- The section structure is consistent (same XML tag, same general layout)
- The actual return format fields and content are agent-appropriate:
  - Executor returns plan completion results (tasks done, files changed, test outcomes)
  - Verifier returns verification results (criteria checked, pass/fail, gaps found)
  - Codebase-mapper returns mapping results (files scanned, modules found, conventions detected)
  - Each agent's return format reflects what its *caller* needs to parse

### Audit baseline (current state)

| Agent | Lines | project_context | PATH SETUP | structured_returns |
|---|---|---|---|---|
| gsd-executor | 483 | Yes | Yes | **Missing** |
| gsd-planner | 1197 | Yes | Yes | Yes |
| gsd-github-ci | 540 | Yes | Yes | Yes |
| gsd-phase-researcher | 518 | Yes | Yes | Yes |
| gsd-plan-checker | 655 | Yes | Yes | Yes |
| gsd-debugger | 1216 | **Missing** | Yes | Yes |
| gsd-project-researcher | 637 | **Missing** | Yes | Yes |
| gsd-roadmapper | 655 | **Missing** | Yes | Yes |
| gsd-verifier | 571 | **Missing** | Yes | **Missing** |
| gsd-codebase-mapper | 770 | **Missing** | **Missing** | **Missing** |

**Summary of gaps:**
- 5 agents missing `project_context`: debugger, project-researcher, roadmapper, verifier, codebase-mapper
- 1 agent missing PATH SETUP: codebase-mapper
- 2 agents missing `structured_returns`: executor, verifier
- codebase-mapper is the most deficient (missing all 3 named blocks)
- Additional structural patterns (deviation rules, checkpoint formats, TodoWrite) have not been audited yet — the planner should audit these during planning

### Agent's Discretion
- Exact wording of project_context discovery blocks (adapted per agent's discovery needs)
- Section ordering within agent files (follow whatever pattern emerges as most readable)
- Which additional structural patterns beyond the big 3 need normalization (discovered during detailed audit)
- Whether to batch agents by similarity or touch them one at a time
- Specific structured_returns field names for executor, verifier, and codebase-mapper

</decisions>

<specifics>
## Specific Ideas

- Phase 67's gsd-github-ci agent is the most recently updated and should serve as the primary structural reference — it has all 3 blocks plus deviation rules, checkpoint format, and TodoWrite instructions
- gsd-planner and gsd-executor are the two most-used agents and should be treated as high-priority targets
- The codebase-mapper is the biggest outlier (missing everything) and also the largest agent by line count after debugger and planner — may need the most work
- After this phase, any new agent created should be able to use any existing agent as a structural template

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 68-agent-consistency-audit*
*Context gathered: 2026-03-08*
