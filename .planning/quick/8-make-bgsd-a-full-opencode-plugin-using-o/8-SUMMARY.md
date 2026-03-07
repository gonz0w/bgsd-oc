---
phase: quick-8
plan: 01
subsystem: plugin-distribution
tags: [opencode, plugin, npm, installer, distribution]
dependency_graph:
  requires: [quick-7-audit-fixes]
  provides: [npm-publishable-package, opencode-plugin-hooks, npx-installer]
  affects: [plugin.js, install.js, package.json, README.md, opencode.json, AGENTS.md, build.cjs]
tech_stack:
  added: [opencode-plugin-api]
  patterns: [esm-plugin, cjs-source-isolation, npx-installer]
key_files:
  created:
    - plugin.js
    - install.js
    - opencode.json
    - src/package.json
  modified:
    - package.json
    - README.md
    - AGENTS.md
    - build.cjs (renamed from build.js)
    - audit-exports.cjs (renamed from audit-exports.js)
    - audit-commands.cjs (renamed from audit-commands.js)
    - baseline.cjs (renamed from baseline.js)
    - bin/manifest.json
decisions:
  - ESM for plugin.js/install.js via package.json "type":"module", CJS source preserved via src/package.json "type":"commonjs"
  - Renamed build.js and audit scripts to .cjs extension for CJS compatibility under ESM root
  - npm "files" field excludes test files (bin/gsd-tools.test.cjs, bin/format.test.cjs) from published package
  - acorn and tokenx moved to devDependencies (bundled into gsd-tools.cjs by esbuild, not needed at runtime)
metrics:
  duration: 9 min
  completed: 2026-03-07
  tasks: 2
  files: 11
---

# Quick Task 8: Make bGSD a Full OpenCode Plugin Summary

Package bGSD as an npm-distributable OpenCode plugin with session lifecycle hooks, npx installer, and updated documentation.

## What Was Done

### Task 1: Create plugin.js, install.js, and opencode.json (80361be)

**plugin.js** — ESM OpenCode plugin exporting `BgsdPlugin` with 3 hooks:
- `session.created`: Logs plugin availability message
- `shell.env`: Injects `GSD_HOME` environment variable for workflow resolution
- `experimental.session.compacting`: Preserves `.planning/STATE.md` content across compaction

**install.js** — npx-compatible Node.js installer mirroring deploy.sh:
- `--help`: Shows usage and what gets installed
- `--uninstall`: Removes all bGSD files (commands, agents, plugin, get-shit-done dir)
- Default: Reads bin/manifest.json, copies files to correct destinations, installs plugin to plugins/bgsd.js, creates `~/.config/oc` symlink, substitutes `__OPENCODE_CONFIG__` placeholders, runs smoke test
- Includes error handling with cleanup suggestion on failure

**opencode.json** — Minimal dev workspace config with schema and AGENTS.md instructions reference.

### Task 2: Update package.json and README.md for npm distribution (9bd9bd1)

**package.json changes:**
- Name: `gsd-tools` → `get-shit-done-oc`
- Added `"type": "module"` for ESM plugin/installer
- Removed `"private": true`
- Updated bin entry: `get-shit-done-oc` → `./install.js`
- Added: keywords, repository, homepage, license (MIT)
- Added: files array (excludes test files, src/, dev scripts)
- Moved acorn/tokenx to devDependencies (bundled into CJS at build time)

**README.md changes:**
- Replaced old NOTE about symlinks with clean note about `~/.config/oc` symlink
- Replaced clone+deploy Quick Start with `npx get-shit-done-oc` instructions
- Added Uninstall (`--uninstall`) and Update (`@latest`) sections
- Updated Development section with note about deploy.sh being for contributors

**CJS/ESM compatibility:**
- Renamed build.js, audit-exports.js, audit-commands.js, baseline.js to .cjs (all use require())
- Created src/package.json with `"type": "commonjs"` to isolate CJS source from ESM root
- Updated npm scripts to reference .cjs filenames
- Updated AGENTS.md project structure to reflect new filenames

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CJS scripts broken by "type": "module"**
- **Found during:** Task 2
- **Issue:** Adding `"type": "module"` to package.json caused build.js and other CJS scripts to fail with `ReferenceError: require is not defined in ES module scope`
- **Fix:** Renamed build.js → build.cjs, audit-exports.js → audit-exports.cjs, audit-commands.js → audit-commands.cjs, baseline.js → baseline.cjs; updated npm scripts
- **Files modified:** build.cjs, audit-exports.cjs, audit-commands.cjs, baseline.cjs, package.json
- **Commit:** 9bd9bd1

**2. [Rule 3 - Blocking] esbuild treating src/ as ESM**
- **Found during:** Task 2
- **Issue:** esbuild followed root `"type": "module"` and mishandled `module.exports` in src/*.js, producing broken output bundle
- **Fix:** Created `src/package.json` with `{"type": "commonjs"}` to scope CJS treatment to source files only
- **Files modified:** src/package.json
- **Commit:** 9bd9bd1

**3. [Rule 2 - Missing functionality] Test files in npm package**
- **Found during:** Task 2
- **Issue:** `"bin/"` in files array included bin/gsd-tools.test.cjs (769KB) and bin/format.test.cjs (15KB) in published package
- **Fix:** Changed files array from `"bin/"` to `"bin/gsd-tools.cjs"` and `"bin/manifest.json"` specifically
- **Files modified:** package.json
- **Commit:** 9bd9bd1

## Verification Results

| Check | Result |
|-------|--------|
| plugin.js syntax check | ✅ Passes |
| install.js syntax check | ✅ Passes |
| BgsdPlugin export is function | ✅ typeof === "function" |
| opencode.json valid JSON | ✅ Has instructions field |
| package.json name | ✅ get-shit-done-oc |
| package.json type | ✅ module |
| package.json private | ✅ false (removed) |
| package.json bin | ✅ get-shit-done-oc → ./install.js |
| README.md npx references | ✅ 4 occurrences |
| README.md --uninstall docs | ✅ Present |
| npm pack --dry-run | ✅ 147 files, 501KB, no test files |
| npm run build | ✅ 1163KB, smoke test passed |
| deploy.sh unchanged | ✅ No modifications |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 80361be | feat: create plugin.js, install.js, and opencode.json |
| 2 | 9bd9bd1 | feat: update package.json and README.md for npm distribution |

## Self-Check: PASSED

- All 8 created/modified files verified on disk
- Both commits (80361be, 9bd9bd1) found in git log
