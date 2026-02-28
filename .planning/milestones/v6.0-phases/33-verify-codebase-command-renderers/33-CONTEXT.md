# Phase 33: Verify & Codebase Command Renderers — Context

## Decisions

- **User-facing commands only**: Only format commands humans actually see. Agent-consumed commands stay efficient JSON.
- **User-facing verify commands**: `verify quality`, `verify requirements`
- **User-facing codebase commands**: `codebase status`, `codebase analyze`
- **All other verify/codebase commands**: Leave as-is — agents need structured JSON for plan-structure, artifacts, key-links, conventions, deps, etc.
- **Brand**: Use `bGSD` branding consistently

## Deferred Ideas

- Formatting agent-consumed verify commands (plan-structure, artifacts, key-links, commits, references, etc.)
- Formatting agent-consumed codebase commands (conventions, deps, context, lifecycle, impact, rules)

## Agent's Discretion

- Table layout for verify requirements (pass/fail indicators, requirement ID column)
- Letter grade styling for verify quality dimensions
- How to display codebase staleness in codebase status
- Level of detail in codebase analyze formatted output
