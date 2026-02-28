---
phase: 40-context-efficiency
plan: 02
subsystem: context
tags: [task-scoped-injection, dep-graph-traversal, relevance-scoring, ast-signatures, token-budgeting]
dependency_graph:
  requires: [AGENT_MANIFESTS, scopeContextForAgent, compactPlanState, compactDepGraph]
  provides: [buildTaskContext, scoreTaskFile, codebase-context-task-flag]
  affects: [src/lib/context.js, src/commands/codebase.js, src/lib/constants.js]
tech_stack:
  added: []
  patterns: [dep-graph-1-hop-traversal, relevance-scoring, lazy-require-for-bundle-size, token-budget-enforcement]
key_files:
  created: []
  modified:
    - src/lib/context.js
    - src/commands/codebase.js
    - src/lib/constants.js
    - bin/gsd-tools.test.cjs
decisions:
  - Duplicated scoring logic as scoreTaskFile (~15 lines) to avoid circular imports between context.js and codebase.js
  - AST signatures lazy-loaded only when includeSignatures=true to keep bundle lean
  - Token budget enforcement drops lowest-scored files iteratively rather than binary search
  - Reduction percentage computed as ratio of excluded candidates to total for transparency
metrics:
  duration: 9m
  completed: 2026-02-27
---

# Phase 40 Plan 02: Task-Scoped File Injection Summary

Task-scoped file injection via buildTaskContext with dep-graph 1-hop traversal, relevance scoring (direct=1.0, import=0.7, importer=0.5, plan+0.3, recent+0.2), AST signatures, and token budgeting. Achieves 60-70% context reduction for typical task files.

## What Was Done

### Task 1: Task-scoped context builder + codebase context --task integration
Extended `src/lib/context.js` (246 → 370 lines) with:

- **scoreTaskFile(file, taskFiles, graph, planFiles, recentFiles)** — Duplicated small scoring function to avoid circular imports. Returns `{ score, reason }` with weights: direct=1.0, imported-by-task=0.7, imports-task=0.5, plan-scope=+0.3, recent=+0.2.
- **buildTaskContext(cwd, taskFiles, options?)** — Main function that:
  1. Loads dep graph from codebase-intel.json via lazy `readIntel()`
  2. Gathers 1-hop candidates (forward + reverse adjacency)
  3. Scores all candidates, filters to >= 0.3
  4. Optionally adds AST signatures via lazy `extractSignatures()`
  5. Enforces token budget by dropping lowest-scored files
  6. Returns `{ task_files, context_files, stats }` with reduction metrics

Added `--task` flag to `cmdCodebaseContext` in `src/commands/codebase.js`:
- `codebase context --task file1,file2 [--plan path] [--budget tokens]`
- Delegates to `buildTaskContext` and outputs JSON result
- Works alongside existing `--files` mode

Added `codebase context` entry to COMMAND_HELP in `src/lib/constants.js`.

**Commit:** `6b53c66`

### Task 2: Tests + quality baseline validation
Added 10 tests to `bin/gsd-tools.test.cjs`:

**Unit tests (6):**
1. Single task file with deps → returns scored context
2. Multiple task files → union of deps, no duplicates
3. Token budget enforcement → fewer files under constraint
4. No codebase intel → graceful fallback to task files only
5. includeSignatures=true → signatures array on context files
6. Empty task files → zero stats

**Integration tests (4):**
7. CLI `--task` returns JSON with context_files and stats
8. CLI `--budget` reduces files vs unconstrained
9. `reduction_pct > 0` when budget constrains output
10. Quality baseline: codebase-intel.js includes both deps (output.js/git.js/helpers.js) and importers (codebase.js/init.js/deps.js)

**Commit:** `04e874f`

## Verification Results

| Check | Result |
|-------|--------|
| `codebase context --task src/lib/output.js --raw` | ✅ 7 files, 70% reduction |
| `codebase context --task src/lib/codebase-intel.js --budget 1000 --raw` | ✅ 4 files, 60% reduction, 818 tokens |
| Quality baseline (deps + importers) | ✅ Passed |
| Bundle size | ✅ 997KB / 1000KB budget |
| Tests | ✅ 652 pass, 0 fail (642 existing + 10 new) |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
