---
phase: "04"
plan: "01"
name: "esbuild Pipeline Setup"
subsystem: "build"
tags: [esbuild, bundler, build-system, proof-of-concept]
dependency-graph:
  requires: []
  provides:
    - "esbuild build pipeline"
    - "build.js script"
    - "npm run build command"
  affects:
    - "bin/gsd-tools.bundle.cjs"
    - "package.json"
tech-stack:
  added:
    - "esbuild 0.27.x"
  patterns:
    - "esbuild JS API with plugin system"
    - "shebang stripping plugin for monolith bundling"
key-files:
  created:
    - "build.js"
    - ".gitignore"
    - "package-lock.json"
  modified:
    - "package.json"
    - "bin/gsd-tools.test.cjs"
key-decisions:
  - "Strip-shebang esbuild plugin to handle monolith's existing shebang — avoids double-shebang in bundled output"
  - "Output to bin/gsd-tools.bundle.cjs temporarily to preserve working original during proof-of-concept"
  - "packages: 'external' keeps all Node.js builtins as require() calls — correct for CLI tool"
metrics:
  duration: "4 min"
  completed: "2026-02-22"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 6
  tests_total: 143
---

# Phase 4 Plan 01: esbuild Pipeline Setup Summary

esbuild 0.27.x bundler pipeline with strip-shebang plugin — bundles 7169-line monolith as proof-of-concept in ~50ms, output verified functionally identical to original via 6 automated tests.

## What Was Done

### Task 1: Install esbuild and create build.js
- Installed esbuild 0.27.3 as devDependency
- Created `build.js` using esbuild's JS API with:
  - `platform: 'node'`, `format: 'cjs'`, `target: 'node18'`
  - `packages: 'external'` to keep Node.js builtins as require() calls
  - `banner` for canonical shebang line
  - Custom `stripShebangPlugin` to remove existing shebang from monolith source (prevents double-shebang)
  - Built-in smoke test that runs `current-timestamp --raw` against bundled output
- Updated package.json `build` script from placeholder to `node build.js`
- Created `.gitignore` with `node_modules/` and `bin/gsd-tools.bundle.cjs`
- **Commit:** `547bca5`

### Task 2: Add build system verification tests
- Added `describe('build system')` block with 6 tests:
  1. `npm run build` succeeds with exit code 0
  2. Build produces `bin/gsd-tools.bundle.cjs` with substantial size
  3. Bundled file has exactly 1 working shebang on line 1
  4. Bundled `current-timestamp --raw` matches original ISO format
  5. Bundled `state load --raw` output identical to original in temp project
  6. Build completes in under 500ms
- Cleanup: afterEach removes bundle file to keep workspace clean
- **Commit:** `17bb286`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double-shebang in bundled output**
- **Found during:** Task 1 verification
- **Issue:** The original monolith already has `#!/usr/bin/env node` on line 1. esbuild's `banner` option adds another, creating an invalid double-shebang (`#!/usr/bin/env node\n#!/usr/bin/env node\n...`) that Node.js rejects as SyntaxError.
- **Fix:** Created a `stripShebangPlugin` esbuild plugin that removes the source shebang before bundling, letting the banner option provide the canonical one. This pattern will work correctly when Plan 02 splits into modules (entry point won't have a shebang).
- **Files modified:** `build.js`
- **Commit:** `547bca5`

**2. [Rule 1 - Bug] Fixed test comparing state load output as JSON**
- **Found during:** Task 2 verification
- **Issue:** The `state load` command outputs key=value shell format, not JSON. Test tried to `JSON.parse()` the output.
- **Fix:** Changed test to compare raw key=value string output directly (exact string equality between bundle and original), plus specific key assertions.
- **Files modified:** `bin/gsd-tools.test.cjs`
- **Commit:** `17bb286`

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` succeeds | PASS — builds in ~50ms |
| Smoke test (timestamp output) | PASS |
| `npm test` all tests | 142/143 pass (1 pre-existing) |
| Build under 500ms | PASS (~50ms) |
| No double shebang | PASS (exactly 1) |
| Bundle functionally identical | PASS (timestamp + state load match) |

## Self-Check: PASSED
