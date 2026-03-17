---
phase: 134-measurement-infrastructure
plan: "01"
subsystem: measurement
tags: [workflow, tokens, baseline, compare, structural-fingerprint, cli, measurement]

# Dependency graph
requires: []
provides:
  - "workflow:baseline command — measures token counts + structural fingerprints for all 44 workflows, saves versioned snapshots to .planning/baselines/"
  - "workflow:compare command — diffs two snapshots showing per-workflow deltas and total reduction percentage"
  - "extractStructuralFingerprint() — extracts Task() calls, CLI commands, section markers, question blocks, xml tags from workflow content"
  - "measureAllWorkflows() exported from features.js — reusable token measurement function"
  - "workflow namespace in router — lazyWorkflow() loader, KNOWN_NAMESPACES, switch case"
  - "21 tests covering unit fingerprint extraction, compare logic, and CLI integration"
affects: [135-workflow-compression, 137-section-level-loading]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "workflow namespace follows lazyLoader() pattern established in router.js"
    - "structural fingerprint uses regex extraction with named return arrays"
    - "compare logic mirrors context-budget-compare pattern (before/after/delta/pct)"
    - "test file uses node:test + node:assert with helpers.cjs runGsdTools integration pattern"

key-files:
  created:
    - src/commands/workflow.js
    - tests/workflow.test.cjs
  modified:
    - src/commands/features.js
    - src/router.js
    - src/lib/constants.js
    - src/lib/commandDiscovery.js
    - bin/bgsd-tools.cjs

key-decisions:
  - "Reuse measureAllWorkflows() from features.js rather than duplicating code — exported it from module.exports"
  - "Structural fingerprint stored as arrays of matched strings (not just counts) for richer diffing in future phases"
  - "compare: two-arg mode, one-arg mode (vs current state), zero-arg mode (auto-select 2 recent) — mirrors context-budget-compare UX"
  - "Baselines saved as workflow-baseline-{timestamp}.json to distinguish from old baseline-{timestamp}.json format"

patterns-established:
  - "Workflow measurement snapshots: version 1, timestamp, workflow_count, total_tokens, workflows[{name, workflow_tokens, ref_count, ref_tokens, total_tokens, structure}]"
  - "Compare result schema: { snapshot_a, snapshot_b, date_a, date_b, summary, workflows } — reusable for future metrics"

requirements-completed: ["MEAS-01", "MEAS-02"]
one-liner: "workflow:baseline and workflow:compare CLI commands with token measurement, structural fingerprinting (Task/CLI/section/question/XML), snapshot persistence, and 21-test coverage"

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 134 Plan 01: Workflow Baseline & Compare Commands Summary

**workflow:baseline and workflow:compare CLI commands with token measurement, structural fingerprinting (Task/CLI/section/question/XML), snapshot persistence, and 21-test coverage**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T21:37:06Z
- **Completed:** 2026-03-16T21:44:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `workflow:baseline` — measures tokens + structural fingerprint for all 44 workflows, saves versioned JSON to `.planning/baselines/workflow-baseline-{timestamp}.json`, prints human-readable table to stderr
- Created `workflow:compare` — diffs two snapshots (or current state vs saved), shows per-workflow token deltas + total reduction %, prints comparison table to stderr
- Exported `measureAllWorkflows()` from `features.js` so `workflow.js` can reuse it without duplicating 90 lines
- Wired `workflow` namespace into `router.js` with `lazyWorkflow()` loader, `KNOWN_NAMESPACES`, and `case 'workflow'` switch block
- Added `COMMAND_HELP` entries for `workflow:baseline` and `workflow:compare` in `constants.js`
- Added aliases `w`, `w:b`, `w:c`, `w:v` and `measurement` category in `commandDiscovery.js`
- 21 tests: 7 unit (fingerprint extraction), 5 unit (compare logic), 5 integration (baseline), 4 integration (compare)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow namespace with baseline and compare commands** - `16d12a6` (feat)
2. **Task 2: Add tests for workflow:baseline and workflow:compare** - `5cf4032` (test)

## Files Created/Modified

- `src/commands/workflow.js` — New: workflow namespace with cmdWorkflowBaseline, cmdWorkflowCompare, extractStructuralFingerprint
- `tests/workflow.test.cjs` — New: 21 tests for baseline and compare commands
- `src/commands/features.js` — Modified: added measureAllWorkflows to module.exports
- `src/router.js` — Modified: lazyWorkflow(), 'workflow' in KNOWN_NAMESPACES, case 'workflow' routing
- `src/lib/constants.js` — Modified: COMMAND_HELP entries for workflow:baseline and workflow:compare
- `src/lib/commandDiscovery.js` — Modified: aliases (w, w:b, w:c, w:v), measurement category, workflow COMMAND_TREE
- `bin/bgsd-tools.cjs` — Rebuilt

## Decisions Made

- Reused `measureAllWorkflows()` from features.js (exported it) rather than duplicating — keeps measurement logic in one place
- Structural fingerprint stores matched strings (not just counts) — supports richer diffing in future phases (Phase 135)
- Three compare modes (two-arg, one-arg vs current, zero-arg auto-select) — mirrors existing context-budget-compare UX
- Baselines named `workflow-baseline-{timestamp}.json` (not `baseline-{timestamp}.json`) — distinguishes from old format

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `workflow:baseline` and `workflow:compare` are ready for use in Phase 135 (workflow compression)
- Structural fingerprints provide regression detection foundation for Phase 134 Plan 02 (`workflow:verify-structure`)
- 1 pre-existing test failure in `agent.test.cjs:332` unrelated to this plan (quality baseline importer check)

---
*Phase: 134-measurement-infrastructure*
*Completed: 2026-03-16*

## Self-Check: PASSED

**Files verified:**
- `src/commands/workflow.js` — FOUND ✓
- `tests/workflow.test.cjs` — FOUND ✓
- `src/commands/features.js` (measureAllWorkflows exported) — FOUND ✓

**Commits verified:**
- `16d12a6` feat(134-01): add workflow:baseline and workflow:compare commands — FOUND ✓
- `5cf4032` test(134-01): add workflow baseline and compare test suite — FOUND ✓

**Functional verification:**
- `workflow:baseline --raw` → workflow_count: 44, total_tokens: 74230, version: 1 ✓
- `workflow:compare` (auto mode) → summary.delta: 0, workflows: 44 ✓
- 21 tests: all pass ✓
