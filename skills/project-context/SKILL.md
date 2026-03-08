---
name: project-context
description: Project-specific discovery protocol — reads AGENTS.md and project skills before performing any work. Required by all agents to apply project conventions, coding standards, and patterns during execution.
type: shared
agents: [executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker]
---

## Purpose

Ensures every agent discovers and follows project-specific conventions before starting work. Without this protocol, agents would operate with generic defaults and miss project-level patterns, security requirements, and coding standards.

Used by all 10 agents as a first step after bootstrap. Candidates for `eager` loading since every agent needs it.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{action_verb}}` | The verb describing what the agent does (present participle) | "executing", "planning", "verifying", "investigating", "researching", "mapping" |

## Content

### Project Discovery Protocol

Before {{action_verb}}, discover project context:

**Step 1: Read project instructions**

Read `./AGENTS.md` if it exists in the working directory. This file contains project-specific guidelines, security requirements, coding conventions, architecture rules, and development workflow instructions. Follow all directives found here.

**Step 2: Check for project skills**

Check `.agents/skills/` directory if it exists. This is the project-local skill directory (distinct from the global bGSD skills).

**Step 3: Read skill indexes**

If project skills exist, list available skills (subdirectories) and read `SKILL.md` for each skill. These are lightweight index files (~130 lines) that describe project-specific patterns.

**Step 4: Load rules on demand**

Load specific `rules/*.md` files from project skills as needed during work. Do NOT load full `AGENTS.md` files from skill directories (100KB+ context cost). Only load the specific rules relevant to the current task.

**Step 5: Apply patterns**

Follow skill rules relevant to the current task. Ensure work output conforms to project-specific patterns, naming conventions, and architectural boundaries.

## Cross-references

- All agents use this skill as their first step after bootstrap
- Project skills (`.agents/skills/`) are distinct from bGSD skills (`skills/`)

## Examples

**Executor agent:**
```
Before executing, discover project context:
<skill:project-context action="executing" />
```

**Planner agent:**
```
Before planning, discover project context:
<skill:project-context action="planning" />
```

**Verifier agent:**
```
Before verifying, discover project context:
<skill:project-context action="verifying" />
```
