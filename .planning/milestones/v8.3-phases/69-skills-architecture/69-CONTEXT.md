# Phase 69: Skills Architecture - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract shared agent content (references, common patterns, protocols) into OpenCode skills. Reduce duplication across agent definitions, enable lazy-loading of domain knowledge, and update the deploy pipeline. References/ directory is absorbed into skills. No new agent capabilities — this is reorganization of existing content.

</domain>

<decisions>
## Implementation Decisions

### Skill Granularity
- One skill per protocol — fine-grained skills (commit-protocol, checkpoint-protocol, goal-backward, etc.), not bundled
- Always extract — no threshold. Even if a protocol is small or used by one agent, it becomes a skill. One source of truth per protocol
- Domain-adapted content uses placeholders in SKILL.md ({{agent_name}}, {{action_verb}}, {{phase}}, {{gsd_home}}) — agents pass values via skill tag attributes
- Standard placeholder set: `{{agent_name}}`, `{{action_verb}}`, `{{phase}}`, `{{gsd_home}}`
- Skills can cross-reference other skills
- Skill index is a skill named 'skill-index', auto-generated at build time from scanning SKILL.md files, loaded on-demand (not auto-loaded)
- Each skill is a directory with SKILL.md + optional supporting files (freeform naming for supporting files)
- Follow OpenCode convention: skills/{name}/SKILL.md
- No versioning needed — skills deploy in same cycle as agents, always in sync
- References/ directory migrated into skills and then removed entirely
- bGSD-specific only — no portability requirement
- No migration trail comments in agents — clean removal of inline content
- Standard YAML frontmatter in SKILL.md

### Agent-to-Skill Binding
- Both a `<skills>` section at top of agent definition AND inline `<skill:name />` markers where protocols were
- `<skills>` section is a structured list with skill names, brief hints about what each provides, when to load, and placeholder values
- Inline markers use XML-style tags: `<skill:commit-protocol />`
- Tags support attributes for placeholder values: `<skill:project-context action="executing" />`
- Tags support section selection: `<skill:commit-protocol section="pre-commit" />`
- Hybrid loading: `eager` attribute on tag for build-time expansion, default is lazy (agent calls use_skill at runtime)
- Skills have good descriptions for OpenCode's native description-based matching, but agents reference by explicit name
- deploy.sh validates agent skill references exist — fail deploy if skill is missing
- Workflows can also reference skills, not just agents

### Content Migration Boundaries
- ALL standardized blocks become skills: project_context, PATH SETUP, structured_returns, commit protocol, checkpoint protocol, state update protocol
- Domain-specific content also extracted into skills (executor's deviation handling, planner's task breakdown rules, verifier's gap analysis, etc.)
- structured_returns: one skill with per-agent sections — agents load their specific section via section attribute
- Agent definitions become thin: identity + execution flow + skills list. Everything procedural/protocol moves to skills
- No target line count — extract what makes sense, don't force it
- Agent-specific skills use agent-prefixed naming: executor-deviations, planner-task-breakdown, etc.
- Shared protocol skills use concept naming: commit-protocol, checkpoint-protocol, etc.
- References/ reorganized by topic during migration (not 1:1 mapping)
- Content rewritten/improved during extraction — not just copy-paste
- Big bang migration — all at once, not incremental

### Skill Naming & Structure
- kebab-case throughout for directory names: skills/commit-protocol/, skills/executor-deviations/
- SKILL.md internal sections (required): Purpose, Placeholders, Content, Cross-references, Examples
- YAML frontmatter fields: name, description, type (shared | agent-specific), agents (list), sections (list)
- Skills deployed alongside agents/ in host editor config (same level)
- Build.cjs extended to handle skill expansion for eager-loaded skills and auto-generate skill-index
- deploy.sh validates skills before deploying (structure, frontmatter, cross-refs)
- Skill-index auto-generated at build time
- Tests added to test suite for skill validation (frontmatter valid, cross-refs resolve, placeholders documented)

### Agent's Discretion
- Whether to distinguish protocol skills vs reference skills structurally, or treat all skills uniformly

</decisions>

<specifics>
## Specific Ideas

- Skill tags should feel native to the existing XML-tag convention in agent definitions (`<project_context>`, `<structured_returns>`, etc.)
- The skill-index skill should be useful for agents to discover what's available without loading everything
- Build-time validation should catch broken skill references, missing placeholders, and invalid cross-references before deploy
- Eager vs lazy loading controlled per-reference via tag attribute, giving fine-grained control over context window usage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 69-skills-architecture*
*Context gathered: 2026-03-08*
