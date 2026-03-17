---
phase: "134"
plan: "02"
title: "Workflow Structure Verification"
subsystem: "workflow-measurement"
tags: ["workflow", "verification", "regression-detection", "structural-fingerprint"]
dependency_graph:
  requires:
    - "134-01 (workflow:baseline with extractStructuralFingerprint)"
  provides:
    - "workflow:verify-structure command"
    - "Structural regression detection with pass/fail output"
  affects:
    - "src/commands/workflow.js"
    - "tests/workflow.test.cjs"
tech_stack:
  added: []
  patterns:
    - "CLI command with BGSD_PLUGIN_DIR for workflow file resolution"
    - "process.exitCode = 1 (not process.exit) for clean exit on regression"
    - "CLI-based unit tests (execSync with env vars) to avoid stdout capture interference"
key_files:
  created: []
  modified:
    - "src/commands/workflow.js (cmdWorkflowVerifyStructure + path fix for baseline too)"
    - "src/router.js (wired workflow:verify-structure case)"
    - "bin/bgsd-tools.cjs (rebuilt)"
    - "tests/workflow.test.cjs (14 new tests)"
decisions:
  - "Use CLI-based unit tests (execSync + BGSD_PLUGIN_DIR) instead of direct function calls with stdout capture — direct approach interferes with node:test runner's stdout registration"
  - "Fixed __dirname path bug in both cmdWorkflowBaseline and cmdWorkflowVerifyStructure: was path.resolve(__dirname, '..', '..') (wrong, goes above project root), changed to path.resolve(__dirname, '..') (correct for bundled binary)"
  - "process.exitCode = 1 instead of process.exit(1) so cleanup runs before exit"
metrics:
  duration: "12 min"
  completed: "2026-03-16"
  tasks_completed: 2
  files_modified: 4
task_commits:
  - task: 1
    hash: "9d524cd"
    description: "feat(134-02-t1): add workflow:verify-structure command"
  - task: 2
    hash: "bd58c90"
    description: "test(134-02-t2): add 14 tests for workflow:verify-structure"
---

# Phase 134 Plan 02: Workflow Structure Verification Summary

**One-liner:** `workflow:verify-structure` compares baseline structural fingerprints (Task() calls, CLI commands, section markers, question blocks, XML tags) against current workflows, reporting missing elements as failures with exit code 1.

## What Was Built

### Task 1: Implement workflow:verify-structure command

Added `cmdWorkflowVerifyStructure(cwd, args, raw)` to `src/commands/workflow.js` and exported it. Also wired `workflow:verify-structure` in `src/router.js`.

**Key behavior:**
- Without args: finds most recent `workflow-baseline-*.json` in `.planning/baselines/`
- With path arg: uses that file as the baseline
- Per workflow: reads current file, extracts structural fingerprint via `extractStructuralFingerprint()`, compares against baseline
- Reports removals per element type: `task_call`, `cli_command`, `section_marker`, `question_block`, `xml_tag`
- Additions (new elements not in baseline) are fine — only removals are failures
- Removed workflow files → `removed: true` + fail
- `process.exitCode = 1` if any workflow fails
- Human-readable table on stderr, JSON on stdout with `--raw`

**Bug fixed:** Both `cmdWorkflowBaseline` and `cmdWorkflowVerifyStructure` had `path.resolve(__dirname, '..', '..')` which resolves to the parent of the project root in the bundled binary. Fixed to `path.resolve(__dirname, '..')` (correct: bin/ → project root).

### Task 2: Add tests for workflow:verify-structure

Added 14 tests in a `describe('workflow:verify-structure (unit)')` block and a `describe('workflow:verify-structure (integration)')` block to `tests/workflow.test.cjs`.

**Unit tests (10 via CLI with BGSD_PLUGIN_DIR):**
1. All elements preserved → pass (exit code 0)
2. Task() call removed → fail + correct missing entry
3. CLI command removed → fail
4. Section marker removed → fail
5. Question block removed → fail
6. Additions only → still pass
7. Workflow removed entirely → fail + removed:true
8. Workflow added (not in baseline) → not a regression (pass)
9. Empty baseline structure → all pass
10. Workflow with no structural elements → pass

**Integration tests (4):**
1. JSON output shape validation (baseline_file, baseline_date, verified_at, summary, results)
2. Fresh baseline → all workflows pass
3. Nonexistent baseline → error
4. Regression detected → exit code 1

**Total new tests: 14** (suite now 35 tests, 30 passing, 5 pre-existing failures in workflow:baseline integration)

## Deviations

### Deviation 1: captureOutput approach → CLI-based unit tests

**What happened:** Initially wrote unit tests using `captureOutput` (overriding `process.stdout.write`). This broke node:test registration — the TAP reporter uses stdout, so intercepting it caused all tests to appear as one.

**Fixed by:** Rewrote unit tests to use `execSync` with `BGSD_PLUGIN_DIR` env var pointing to a temp directory. Same coverage, no interference with the test runner.

**Impact:** None — better test approach (tests through the built binary, not source directly).

## Self-Check: PASSED

Files created/modified:
- `src/commands/workflow.js` — FOUND (contains cmdWorkflowVerifyStructure)
- `src/router.js` — FOUND (workflow:verify-structure wired)
- `tests/workflow.test.cjs` — FOUND (14 new tests)
- `bin/bgsd-tools.cjs` — FOUND (rebuilt)

Commits:
- `9d524cd` — FOUND (feat(134-02-t1))
- `bd58c90` — FOUND (test(134-02-t2))

Verification:
- `workflow:verify-structure` with fresh baseline: 44/44 workflows pass ✓
- Regression detection: modified workflow → correctly reports missing element ✓
- 14 new tests all green ✓
