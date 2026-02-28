---
phase: 39-orchestration-intelligence
plan: 01
subsystem: orchestration
tags: [complexity-scoring, task-routing, execution-mode, agent-orchestration]
dependency-graph:
  requires:
    - "src/lib/frontmatter.js (extractFrontmatter)"
    - "src/lib/deps.js (buildDependencyGraph)"
    - "src/lib/codebase-intel.js (readIntel)"
    - "src/lib/helpers.js (findPhaseInternal)"
    - "src/lib/format.js (banner, formatTable, summaryLine)"
  provides:
    - "Task complexity classification (1-5 score)"
    - "Agent/model routing recommendations"
    - "Execution mode auto-selection"
    - "classify plan/phase CLI commands"
    - "task_routing field in init execute-phase"
  affects:
    - "src/commands/init.js (execute-phase output)"
    - "src/router.js (new classify command)"
    - "src/lib/constants.js (COMMAND_HELP)"
tech-stack:
  added: []
  patterns:
    - "Additive scoring with clamping (1-5 range)"
    - "Lazy require for optional dep graph loading"
    - "Non-blocking classification (try/catch wrapping)"
key-files:
  created:
    - "src/lib/orchestration.js"
  modified:
    - "src/commands/init.js"
    - "src/router.js"
    - "src/lib/constants.js"
    - "bin/gsd-tools.test.cjs"
decisions:
  - "Model mapping: scores 1-3 → sonnet, scores 4-5 → opus (aligns with MODEL_PROFILES pattern)"
  - "Dep graph loading is non-blocking: classification works without codebase-intel.json, just with lower accuracy"
  - "task_routing added to compact mode whitelist so agents always receive routing guidance"
metrics:
  duration: "~11 minutes"
  completed: "2026-02-27"
  tests_added: 11
  tests_total: 630
  files_created: 1
  files_modified: 4
---

# Phase 39 Plan 01: Orchestration Intelligence Summary

Task complexity classifier with 1-5 scoring, execution mode auto-selection from plan wave structure, and agent/model routing — wired into init execute-phase output for transparent orchestration guidance.

## What Was Built

### src/lib/orchestration.js (7 exports)

**Core classification:**
- `classifyTaskComplexity(task, context)` — Scores tasks 1-5 based on 5 factors: file count (+1 at 3, +2 at 6), cross-module blast radius from dep graph (+1 at 3 importers, +2 at 6), test requirements (+1), checkpoint complexity (+1), action length (+1 at >800 chars). Result includes score, label, factors array, recommended model and agent.
- `classifyPlan(planPath, cwd)` — Reads plan, parses frontmatter + task XML blocks, optionally loads dep graph from codebase-intel.json, classifies each task. Returns plan-level complexity (max task score) and highest recommended model.
- `selectExecutionMode(planClassifications)` — Determines single/parallel/sequential/pipeline from plan wave structure: single (1 plan, 1-2 tasks), parallel (multiple same-wave plans), sequential (has checkpoints), pipeline (3+ waves).

**Supporting:**
- `routeTask(complexity, config)` — Maps complexity score to model tier with config profile override support.
- `parseTasksFromPlan(content)` — Regex parser for `<task type="...">...</task>` XML blocks in plan files. Extracts name, type, files, action, verify, done elements.

**CLI commands:**
- `cmdClassifyPlan(cwd, args, raw)` — Formatted table output with task scores, labels, models, factors.
- `cmdClassifyPhase(cwd, args, raw)` — Per-plan classification tables + execution mode summary.

### Integration Points

- **init execute-phase** — New `task_routing` field added to JSON output containing per-task complexity scores, recommended models, and execution mode. Available in both compact and verbose modes.
- **Router** — New top-level `classify` command with `plan` and `phase` subcommands. Uses lazy-loaded `lazyOrchestration()` pattern.
- **Constants** — COMMAND_HELP entries for `classify`, `classify plan`, `classify phase`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] task_routing missing from compact mode output**
- **Found during:** Task 2 verification
- **Issue:** init execute-phase compact mode whitelist didn't include the new task_routing field, so agents in default compact mode wouldn't receive routing guidance.
- **Fix:** Added `task_routing: result.task_routing || null` to the compact result object.
- **Files modified:** src/commands/init.js
- **Commit:** 41d0e8c

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| classify phase | `classify phase 38 --raw` | 2 plans classified, mode=sequential |
| classify plan | `classify plan .../38-01-PLAN.md --raw` | 2 tasks, scores=[3, 5] |
| init task_routing | `init execute-phase 39 --raw` | task_routing field present |
| Tests | `npm test` | 630 pass, 0 fail |
| Build | `npm run build` | 985KB / 1000KB budget |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 0ee468f | Orchestration intelligence module (7 exports) |
| 2 | 41d0e8c | Wire into init, classify CLI, 11 tests |

## Self-Check: PASSED
