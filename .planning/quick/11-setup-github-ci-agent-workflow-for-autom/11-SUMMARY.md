---
phase: quick-11
plan: 01
type: quick
subsystem: ci-automation
tags: [github-ci, agent, workflow, command, code-scanning, auto-merge]
dependency_graph:
  requires: []
  provides: [gsd-github-ci-agent, github-ci-workflow, bgsd-github-ci-command]
  affects: [agents/, workflows/, commands/, AGENTS.md]
tech_stack:
  patterns: [subagent-definition, thin-command-wrapper, workflow-orchestration, gh-cli-automation]
key_files:
  created:
    - agents/gsd-github-ci.md
    - workflows/github-ci.md
    - commands/bgsd-github-ci.md
  modified:
    - AGENTS.md
decisions:
  - GitHub CI agent uses 7-step execution flow matching gsd-executor pattern
  - Alert classification uses severity + context heuristics (test file vs production)
  - False positives dismissed via gh API with documented reasoning
  - Workflow validates 3 prerequisites before spawning agent (gh auth, commits to push, remote exists)
metrics:
  duration: 3 min
  completed: 2026-03-08
  tasks: 3
  files: 4
---

# Quick Task 11: Setup GitHub CI Agent/Workflow Summary

GitHub CI quality gate agent with push → PR → check → fix-loop → merge automation via gh CLI, callable as `/bgsd-github-ci` command or Task() subagent.

## What Was Built

### 1. Agent Definition (`agents/gsd-github-ci.md`)

Production-ready subagent with 7 execution steps:
- **parse_input**: Accepts BRANCH_NAME, BASE_BRANCH, MAX_FIX_ITERATIONS, AUTO_MERGE, MERGE_METHOD, SCOPE parameters
- **push_branch**: Creates/switches branch, pushes with upstream tracking, handles auth gates
- **create_pr**: Creates PR via `gh pr create`, detects existing PRs for same branch
- **wait_for_checks**: Polls `gh pr checks` with --watch fallback to 30s polling loop, 15min timeout
- **analyze_failures**: Fetches code scanning alerts, classifies true positive vs false positive by severity/context
- **fix_and_repush**: Reads flagged files, applies rule-guided fixes, commits, pushes, re-checks (max 3 iterations)
- **auto_merge**: Tries `--auto` then direct merge, handles merge-blocked with checkpoint

Follows all existing agent conventions: YAML frontmatter (mode: subagent, tool grants), PATH SETUP block, `<role>`, `<execution_flow>`, `<completion_format>`, `<success_criteria>` sections.

### 2. Workflow (`workflows/github-ci.md`)

Orchestrator workflow with 5 steps:
- Parses `--branch`, `--base`, `--no-merge`, `--scope` flags
- Validates prerequisites: gh auth status, commits ahead of base, remote configured
- Derives scope from STATE.md or recent commits when not specified
- Spawns `gsd-github-ci` agent via `Task(subagent_type="gsd-github-ci")`
- Reports structured CI COMPLETE results

### 3. Command (`commands/bgsd-github-ci.md`)

Thin wrapper following existing command pattern:
- Frontmatter with description
- `<objective>` with flag documentation
- `<execution_context>` referencing `workflows/github-ci.md`
- `<process>` delegating to workflow

### 4. AGENTS.md Updated

- Added `/bgsd-github-ci` under Execution & Verification section
- Updated command count from 40 to 41

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create gsd-github-ci agent definition | 63c9e82 | agents/gsd-github-ci.md |
| 2 | Create github-ci workflow and slash command | 591e98a | workflows/github-ci.md, commands/bgsd-github-ci.md |
| 3 | Update AGENTS.md command list | db52f5d | AGENTS.md |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- [x] All 3 files exist: agents/gsd-github-ci.md, workflows/github-ci.md, commands/bgsd-github-ci.md
- [x] Agent has proper frontmatter with mode: subagent and tool grants
- [x] Agent has 7 execution steps covering full push → PR → check → fix-loop → merge flow
- [x] Workflow spawns agent via Task(subagent_type="gsd-github-ci")
- [x] Command references workflows/github-ci.md in execution_context
- [x] AGENTS.md lists /bgsd-github-ci and shows 41 commands

## Self-Check: PASSED
