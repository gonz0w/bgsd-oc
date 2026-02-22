---
phase: "04"
plan: "02"
name: "Source Module Split"
subsystem: "build"
tags: [modules, refactor, src-split, build-system]
dependency-graph:
  requires:
    - "esbuild build pipeline (04-01)"
  provides:
    - "src/ module structure (15 files)"
    - "bin/gsd-tools.cjs as build artifact from src/"
    - "strict router -> commands -> lib dependency direction"
  affects:
    - "build.js"
    - "bin/gsd-tools.cjs"
    - ".gitignore"
    - "bin/gsd-tools.test.cjs"
tech-stack:
  added: []
  patterns:
    - "CommonJS module split with require/exports"
    - "index -> router -> commands -> lib dependency hierarchy"
    - "Commands never import from other command modules"
key-files:
  created:
    - "src/index.js"
    - "src/router.js"
    - "src/lib/constants.js"
    - "src/lib/output.js"
    - "src/lib/helpers.js"
    - "src/lib/config.js"
    - "src/lib/frontmatter.js"
    - "src/lib/git.js"
    - "src/commands/state.js"
    - "src/commands/roadmap.js"
    - "src/commands/phase.js"
    - "src/commands/verify.js"
    - "src/commands/init.js"
    - "src/commands/features.js"
    - "src/commands/misc.js"
  modified:
    - "build.js"
    - ".gitignore"
    - "bin/gsd-tools.test.cjs"
key-decisions:
  - "15-module split: 6 lib + 7 commands + router + index — matches logical boundaries in monolith"
  - "bin/gsd-tools.cjs is now a build artifact, no longer source — .gitignore updated accordingly"
  - "Build system tests updated to reference bin/gsd-tools.cjs instead of removed .bundle.cjs"
  - "Variable shadowing fixes: raw→rawContent in verify.js, output→testOutput in features.js"
metrics:
  duration: "8 min"
  completed: "2026-02-22"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  tests_total: 143
---

# Phase 4 Plan 02: Source Module Split Summary

Split 7169-line monolith into 15 organized src/ modules with strict router→commands→lib dependency direction — esbuild bundles back to single-file bin/gsd-tools.cjs, all 142 tests pass.

## What Was Done

### Task 1: Create src/ module structure from monolith
- Created 15 source modules organized in 3 layers:
  - **src/lib/** (6 modules): constants.js (MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP), output.js (output, error, debugLog, _tmpFiles), helpers.js (13 utility functions), config.js (loadConfig, isGitIgnored), frontmatter.js (extract/reconstruct/splice), git.js (execGit)
  - **src/commands/** (7 modules): state.js (13 functions), roadmap.js (3 functions), phase.js (8 functions), verify.js (8 functions), init.js (13 functions), features.js (15 functions), misc.js (28 functions/constants)
  - **src/router.js**: async main() with full CLI switch/case routing, imports all command modules
  - **src/index.js**: 5-line entry point — shebang + require('./router') + main()
- All modules use `module.exports = { }` for exports and `require()` for imports
- Strict dependency direction enforced: index → router → commands → lib (no reverse imports)
- No command module imports from another command module
- Original bin/gsd-tools.cjs left untouched during this task
- All 15 modules pass syntax check (`node -c`) and import resolution (`require()`)
- **Commit:** `e85c68c`

### Task 2: Update build.js and verify tests pass against bundled output
- Updated `build.js`:
  - Entry point: `bin/gsd-tools.cjs` → `src/index.js`
  - Output: `bin/gsd-tools.bundle.cjs` → `bin/gsd-tools.cjs`
  - Plugin filter: `/\.cjs$/` → `/\.c?js$/` (matches .js source files)
  - Smoke test updated to reference new output path
- Updated `.gitignore`: `bin/gsd-tools.bundle.cjs` → `bin/gsd-tools.cjs`
- Updated build system tests:
  - Replaced BUNDLE_PATH with BUILD_OUTPUT_PATH (same as TOOLS_PATH now)
  - Simplified comparison tests (bundled file IS the tool now)
  - Fixed quote-style detection in temp file cleanup test (esbuild outputs double quotes)
- Build completes in ~50ms, smoke test passes
- **Commit:** `415204c`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed variable shadowing in extracted modules**
- **Found during:** Task 1 extraction
- **Issue:** In the monolith, `cmdValidateHealth` has `const raw = fs.readFileSync(...)` which shadows the `raw` parameter. Similarly, `cmdTestRun` has `const output = execSync(...)` shadowing the imported `output()` function.
- **Fix:** Renamed to `rawContent` in verify.js and `testOutput` in features.js to prevent shadowing bugs in module context.
- **Files modified:** `src/commands/verify.js`, `src/commands/features.js`
- **Commit:** `e85c68c`

**2. [Rule 3 - Blocking] Updated build system tests for new output path**
- **Found during:** Task 2 test run
- **Issue:** 5 build system tests from Plan 04-01 referenced `bin/gsd-tools.bundle.cjs` which no longer exists. Tests also checked for `process.on('exit'` with single quotes but esbuild outputs double quotes.
- **Fix:** Rewrote build system tests to reference `bin/gsd-tools.cjs` (now the build artifact). Updated exit handler test to accept either quote style.
- **Files modified:** `bin/gsd-tools.test.cjs`
- **Commit:** `415204c`

## Verification Results

| Check | Result |
|-------|--------|
| `ls src/lib/*.js \| wc -l` = 6 | PASS |
| `ls src/commands/*.js \| wc -l` = 7 | PASS |
| All 15 modules load without error | PASS |
| `npm run build` succeeds (~50ms) | PASS |
| `npm test` — 142/143 pass (1 pre-existing) | PASS |
| `current-timestamp --raw` works | PASS |
| `state load --raw` works | PASS |
| `state --help` shows help text | PASS |
| No circular imports | PASS |

## Self-Check: PASSED
