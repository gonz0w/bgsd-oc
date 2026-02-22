---
phase: "06-token-measurement-output-infrastructure"
plan: "02"
subsystem: "workflow-baseline-measurement"
tags: [baseline, workflow-measurement, at-references, token-counting]
dependency_graph:
  requires: [token-estimation-library, context-budget-command]
  provides: [baseline-measurement, workflow-scanning, at-reference-parsing, compare-subcommand]
  affects: [context-budget-command, baselines-directory]
tech_stack:
  added: []
  patterns: [timestamped-json-baselines, workflow-scanning, at-reference-extraction]
key_files:
  created: [.planning/baselines/]
  modified: [src/commands/features.js, src/lib/helpers.js, src/router.js, bin/gsd-tools.test.cjs]
key_decisions:
  - decision: "Implement compare subcommand alongside baseline in same commit"
    rationale: "Both share measureAllWorkflows() function; implementing together avoids duplicate measurement code"
  - decision: "Sort baseline by total_tokens descending, compare by delta ascending"
    rationale: "Baseline shows biggest workflows first (optimization targets); compare shows biggest reductions first (proof of progress)"
metrics:
  duration: "~4m"
  completed: "2026-02-22"
---

# Phase 6 Plan 02: Workflow Baseline Measurement Summary

Added `context-budget baseline` subcommand that scans all 43 workflow files, measures token counts including @-referenced files, and saves timestamped baseline JSON files. Also implemented `extractAtReferences()` helper and `measureAllWorkflows()` shared function.

## Tasks Completed: 2/2

### Task 1: Implement baseline subcommand and measurement infrastructure
- Created `extractAtReferences()` in `helpers.js` — parses @-path references from workflow content
- Created `measureAllWorkflows(cwd)` shared function — scans workflow dir, measures each file + @-refs
- Implemented `cmdContextBudgetBaseline` — measures all workflows, saves timestamped JSON to `.planning/baselines/`
- Implemented `cmdContextBudgetCompare` — compares current vs saved baseline (ahead of Plan 03)
- Updated `router.js` for subcommand dispatch
- Commit: `4160a2a`

### Task 2: Tests for baseline measurement and @-reference parsing
- 6 `extractAtReferences` unit tests: absolute paths, relative paths, context blocks, email filtering, dedup, edge cases
- 5 baseline integration tests: schema fields, workflow measurement fields, sort order, file output, backward compat
- Commit: `1646153`
- Bundle rebuild: `af88a3b`

## Deviations from Plan

### Ahead-of-plan Work

**1. [Rule 2 - Efficiency] Implemented compare subcommand in Plan 02 instead of Plan 03**
- **Reason:** `cmdContextBudgetCompare` shares `measureAllWorkflows()` function with baseline — implementing both together avoids code duplication
- **Impact:** Plan 03 Task 1 is effectively complete; Plan 03 only needs help text update and compare tests

## Verification

- [x] `npm run build` succeeds
- [x] `npm test` passes (182/183, 1 pre-existing DEBT-01)
- [x] `context-budget baseline` measures 43 workflows, total ~120K tokens
- [x] Baseline JSON saved to `.planning/baselines/baseline-*.json`
- [x] `context-budget <path>` still works (backward compatible)
- [x] `extractAtReferences()` correctly parses absolute, relative, and context block references

## Self-Check: PASSED
