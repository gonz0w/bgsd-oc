# Phase 53: Agent Consolidation - Research

**Researched:** 2026-03-02
**Domain:** Agent Architecture Consolidation
**Confidence:** HIGH

## Summary

Phase 53 consolidates the GSD plugin's agent architecture by merging redundant agents and establishing clear ownership. Current state: 11 agents. Target: 9 agents.

**Primary recommendation:** Merge gsd-integration-checker into gsd-verifier, merge gsd-research-synthesizer into gsd-roadmapper. Create RACI matrix document. Implement agent audit command. Add token budgets to manifests.

## Current Agent State

| Agent | File | Status | Merge Target |
|-------|------|--------|--------------|
| gsd-executor | gsd-executor.md | Active | - |
| gsd-planner | gsd-planner.md | Active | - |
| gsd-verifier | gsd-verifier.md | Active | receives integration-checker |
| gsd-roadmapper | gsd-roadmapper.md | Active | receives research-synthesizer |
| gsd-phase-researcher | gsd-phase-researcher.md | Active | - |
| gsd-project-researcher | gsd-project-researcher.md | Active | - |
| gsd-codebase-mapper | gsd-codebase-mapper.md | Active | - |
| gsd-debugger | gsd-debugger.md | Active | - |
| gsd-plan-checker | gsd-plan-checker.md | Active | - |
| gsd-integration-checker | gsd-integration-checker.md | Merge | → verifier |
| gsd-research-synthesizer | gsd-research-synthesizer.md | Merge | → roadmapper |

## Requirements Mapping

| Requirement | Description | Implementation Approach |
|-------------|-------------|----------------------|
| AGENT-01 | RACI matrix document | Create RACI.md mapping lifecycle steps to agents |
| AGENT-02 | Agent audit command | Add `gsd-tools agent audit` command |
| AGENT-03 | Agent count 9 | Merge integration-checker→verifier, synthesizer→roadmapper |
| AGENT-04 | Token budgets in manifests | Add max_tokens to each agent .md frontmatter |
| AGENT-05 | Update workflow references | Grep replace old agent names in workflows |

## Standard Stack

### Tools Used
| Tool | Purpose |
|------|---------|
| gsd-tools CLI | Main command interface |
| Agent .md files | Agent definitions in /agents/ |
| Workflow .md files | Workflow definitions |

### No External Dependencies
This is internal GSD plugin work - no external libraries needed.

## Architecture Patterns

### Agent Manifest Structure
```yaml
---
description: [one-line description]
color: "#HEXCODE"
tools:
  read: true
  write: true
  bash: true
  # etc
---
```

### Workflow Spawn Pattern
```javascript
Task(
  subagent_type="gsd-verifier",
  model="{model}",
  prompt="..."
)
```

## Don't Hand-Roll

- Agent definition format - use existing .md pattern
- CLI command structure - use existing command patterns

## Common Pitfalls

1. **Broken spawn chains** - When merging agents, all workflow references must be updated
2. **Missing token budgets** - Each agent needs explicit max_tokens in manifest
3. **Orphan workflows** - After merge, verify no broken Task() calls

## Open Questions

1. How to implement token budget enforcement in context builder?
   - Need to check how context is assembled
   - May need logging warning on overflow

## Sources

- Agent files in /home/cam/.config/oc/agents/
- Workflow files in /home/cam/.config/oc/workflows/
- STATE.md decisions on agent count

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - internal work, no external deps
- Architecture: HIGH - existing patterns well-established
- Pitfalls: MEDIUM - edge cases around merge

**Research date:** 2026-03-02
**Valid until:** 90 days (stable internal architecture)
