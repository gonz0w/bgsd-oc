---
phase: "06-token-measurement-output-infrastructure"
plan: "01"
subsystem: "token-estimation-and-fields"
tags: [tokenx, context-budget, fields-flag, bundling]
dependency_graph:
  requires: [esbuild-build-system, context-budget-command]
  provides: [token-estimation-library, fields-flag-infrastructure, accurate-token-counts]
  affects: [all-json-commands, context-budget-output]
tech_stack:
  added: [tokenx-1.3.0]
  patterns: [npm-bundling-via-esbuild, global-flag-parsing, dot-notation-field-filtering]
key_files:
  created: [src/lib/context.js]
  modified: [src/lib/output.js, src/router.js, build.js, package.json, bin/gsd-tools.test.cjs]
key_decisions:
  - decision: "Bundle tokenx into gsd-tools.cjs instead of externalizing"
    rationale: "tokenx is ESM-only; bundling via esbuild handles ESM→CJS conversion automatically and keeps zero-dependency deployment model"
  - decision: "Keep heuristic_tokens field alongside accurate token counts"
    rationale: "Allows comparing old vs new estimation methods to quantify improvement"
  - decision: "Use global._gsdRequestedFields for flag communication"
    rationale: "CLI process is short-lived (~5s); global is simplest cross-module communication"
metrics:
  duration: "~8m"
  completed: "2026-02-22"
---

# Phase 6 Plan 01: Token Estimation Library + --fields Flag Summary

Installed tokenx@1.3.0 for accurate BPE-based token estimation, added `--fields` flag infrastructure to all JSON commands, and replaced the broken `lines*4` heuristic in context-budget with real token counts.

## Tasks Completed: 3/3

### Task 1: Install tokenx and create context.js module
- Created `src/lib/context.js` with `estimateTokens()`, `estimateJsonTokens()`, `checkBudget()`, `isWithinBudget()`
- Updated `build.js` from `packages: 'external'` to explicit Node.js builtins externals (so tokenx bundles)
- Added tokenx@1.3.0 as production dependency
- Commit: `9db62d1`

### Task 2: Add --fields global flag
- Added `--fields` parsing in `router.js` (before command dispatch)
- Implemented `filterFields()` in `output.js` with dot-notation and array support
- 6 new tests: top-level filtering, missing fields, backward compat, dot-notation, array handling
- Commit: `ea97804`

### Task 3: Replace heuristic with tokenx in context-budget
- Replaced `lines * 4` with `estimateTokens()` in `cmdContextBudget`
- Added `heuristic_tokens` field for comparison (ROADMAP.md: 1,610 vs 372 — old was 4.3x too low)
- Fixed 2 broken tests referencing archived v1.0 plan files
- 6 new tests for token estimation accuracy
- Commit: `6cb9faf`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed broken test references**
- **Found during:** Task 3
- **Issue:** Two existing context-budget tests referenced `.planning/phases/01-foundation/01-01-PLAN.md` which was archived with v1.0 milestone
- **Fix:** Updated test paths to use Phase 6 plan files that exist on disk
- **Files modified:** `bin/gsd-tools.test.cjs`
- **Commit:** `6cb9faf`

## Verification

- [x] `npm run build` succeeds (bundle: ~274KB with tokenx)
- [x] `npm test` passes (176/177, 1 pre-existing DEBT-01)
- [x] `estimateTokens("Hello world, this is a test string")` returns 8 (matches BPE ground truth)
- [x] `--fields` works with top-level, nested dot-notation, and arrays
- [x] `context-budget` returns `token_estimate` (accurate) and `heuristic_tokens` (old method)

## Self-Check: PASSED
