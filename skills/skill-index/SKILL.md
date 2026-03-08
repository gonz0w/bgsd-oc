---
name: skill-index
description: Auto-generated index of all available bGSD skills. Load this to discover what skills are available without loading their full content.
type: shared
agents: [all]
---

# Skill Index

**Generated:** 2026-03-08T22:41:42.343Z
**Total skills:** 12

| Skill | Type | Agents | Description |
|-------|------|--------|-------------|
| checkpoint-protocol | shared | executor, github-ci, planner, debugger | Checkpoint detection, handling, and structured return format for pausing execution at human interaction points. Covers human-verify, decision, and human-action checkpoint types with auto-mode behavior. |
| commit-protocol | shared | executor, github-ci | Atomic task commit protocol with staging rules, conventional commit message format, and hash tracking for SUMMARY.md. Used after completing each task during plan execution. |
| debugger-hypothesis-testing | agent-specific | debugger | Scientific hypothesis testing methodology for debuggers — forming falsifiable hypotheses, experimental design framework, evidence quality assessment, decision criteria for acting, recovery from wrong hypotheses, and multiple competing hypotheses strategy. |
| deviation-rules | shared | executor, github-ci | Auto-fix decision framework for handling unexpected issues during execution — classifying bugs, missing functionality, blocking issues, and architectural changes with clear rules for when to fix automatically vs escalate to the user. |
| executor-continuation | agent-specific | executor | Context window continuation handling for executors — saving execution state before context exhaustion, resumption protocol for fresh agents, and completed task verification on resume. |
| planner-checkpoints | agent-specific | planner | Checkpoint planning guidelines for planners — when to use each checkpoint type (human-verify 90%, decision 9%, human-action 1%), XML templates, authentication gates, writing rules, and anti-patterns to avoid. |
| planner-dependency-graph | agent-specific | planner | Dependency graph construction for planners — recording needs/creates per task, wave analysis, vertical slices vs horizontal layers, and file ownership rules for parallel execution. |
| planner-gap-closure | agent-specific | planner | Gap closure planning methodology — creating plans from verification or UAT failures. Covers finding gap sources, parsing gap data, loading existing SUMMARYs, grouping gaps into plans, and writing gap closure PLAN.md files. |
| planner-scope-estimation | agent-specific | planner | Context budget rules for planners — 50% context target, 2-3 tasks per plan, split signals, depth calibration table, and per-task context impact estimates by file count and complexity. |
| planner-task-breakdown | agent-specific | planner | Task decomposition methodology for planners — task anatomy (files, action, verify, done), task types, sizing rules (15-60 min), specificity standards, TDD detection heuristic, and user setup detection for external services. |
| project-context | shared | executor, planner, verifier, debugger, github-ci, roadmapper, codebase-mapper, project-researcher, phase-researcher, plan-checker | Project-specific discovery protocol — reads AGENTS.md and project skills before performing any work. Required by all agents to apply project conventions, coding standards, and patterns during execution. |
| state-update-protocol | shared | executor, github-ci | STATE.md and ROADMAP.md update procedures after plan completion — advancing position, recording metrics, adding decisions, updating session continuity, and marking requirements complete. |
