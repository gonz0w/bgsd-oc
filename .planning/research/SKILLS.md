# Project Skill Recommendations

**Project:** bGSD Plugin (Node.js CLI planning tool)
**Milestone focus:** v19.3 Workflow Acceleration — hot-path optimization, reduced I/O through caching/batching, parallel workflow stages
**Researched:** 2026-04-05
**Confidence:** HIGH (researched ecosystem thoroughly)

## Recommendation Summary

No strong skill recommendations for this milestone. The v19.3 goals are achieved through internal CLI implementation (faster routing in `src/`, better caching/batching in the data layer, parallel stage coordination in execution workflows) rather than through agent-level skill patterns. The existing `planner-dependency-graph` skill already provides wave analysis, vertical-vs-horizontal decomposition, and file-ownership rules for parallel execution — which covers the "parallel workflow stages" target. The `cmux` skill handles terminal orchestration for parallel panes. The remaining acceleration targets (routing speed, I/O batching) are implementation concerns that live in `src/` modules, not skill guidance.

## Rejected Candidates

- **parallel-task** (`am-will/codex-skills`, 0 installs) — Wave-based parallel subagent orchestration from a plan file. Targets Claude Code/Codex agent execution model. Not installable in bGSD format and overlaps functionally with existing `planner-dependency-graph` + `cmux` combination. Zero install count suggests unproven.  
  Source: https://github.com/am-will/codex-skills/tree/main/skills/parallel-task

- **CCPM** (`automazeio/ccpm`, 7.9k stars) — GitHub Issues + Git worktree parallel execution system. Excellent for multi-agent Claude Code setups. Fundamentally incompatible with bGSD: requires `gh` CLI + authenticated GitHub, uses Git worktrees (bGSD uses JJ workspaces), and replaces bGSD's markdown-based `.planning/` workflow with GitHub Issues as source of truth. Not a skill fit for a markdown-planning CLI tool.  
  Source: https://github.com/automazeio/ccpm

- **opencode-parallel-agents** (`aptdnfapt`, 27 stars) — Agent templates for running multiple LLMs in parallel within OpenCode. Targets multi-model orchestration (Claude + DeepSeek + Qwen simultaneously). Not a workflow acceleration skill — it's a multi-model diversity pattern. v19.3 is about CLI internal speed, not model diversity.  
  Source: https://github.com/aptdnfapt/opencode-parallel-agents

## Selection Criteria

- Repositories must be real, directly installable skill repos with `SKILL.md`
- Recommendations must materially help this milestone, not just be generally interesting
- Prefer skills that complement the project's current stack and workflow
- Prefer high-confidence, clearly scoped skills over broad or speculative ones

## Sources

- MCP.Directory skill registry — searched "parallel-task", "batch execution", "workflow acceleration" — https://mcp.directory/skills/parallel-task
- GitHub — searched opencode parallel/batch/acceleration skills ecosystem — multiple repos inspected
- awesome-opencode-skills collection (`jshsakura`, 136+ skills) — reviewed high-relevance candidates for parallelization and performance — https://github.com/jshsakura/awesome-opencode-skills

---
*Research completed: 2026-04-05*
*Ready to propose to user: no — no external skills meet the bar for v19.3*
