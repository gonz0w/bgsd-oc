---
phase: 72-rebrand
plan: 01
subsystem: core
tags: [rebrand, env-vars, config-paths, build-pipeline, naming]
dependency_graph:
  requires: []
  provides: [BGSD_DEBUG, BGSD_PROFILE, __OPENCODE_CONFIG__/bgsd-oc, bgsd-tools.cjs, bgsd-oc-package]
  affects: [72-02, 72-03, 72-04]
tech_stack:
  added: []
  patterns: [env-var-prefix-convention, config-path-convention]
key_files:
  created:
    - bin/bgsd-tools.cjs
  modified:
    - src/lib/output.js
    - src/lib/profiler.js
    - src/lib/constants.js
    - src/lib/cache.js
    - src/router.js
    - src/commands/agent.js
    - src/commands/codebase.js
    - src/commands/features.js
    - src/commands/profiler.js
    - src/commands/trajectory.js
    - src/commands/worktree.js
    - src/commands/verify.js
    - src/plugin/index.js
    - build.cjs
    - package.json
    - bin/bgsd-tools.test.cjs
    - test/__snapshots__/state-read.json
decisions:
  - Renamed all GSD_ prefixed env vars to BGSD_ in a single pass rather than piecemeal — ensures no mixed-naming state exists
  - Also renamed discovered env vars not in original plan (GSD_PLUGIN_DIR, GSD_BG_ANALYSIS, GSD_NO_TMPFILE, GSD_CACHE_FORCE_MAP in cache.js) to prevent runtime breakage from partial rename
  - Renamed test file bin/gsd-tools.test.cjs→bin/bgsd-tools.test.cjs and updated all test assertions to match new naming
metrics:
  duration: 19 min
  completed: 2026-03-09
  tasks: 2
  files_modified: 17
---

# Phase 72 Plan 01: Source Code & Build Pipeline Rebrand Summary

Renamed all environment variables from GSD_ to BGSD_ prefix, config paths from get-shit-done to bgsd-oc, CLI binary from gsd-tools to bgsd-tools, and all ~149 usage strings in COMMAND_HELP — the foundational naming layer that all other rebrand plans (02-04) depend on.

## Task 1: Rename environment variables and config paths in source

**Commit:** `52c3f3a` — refactor(72-01): rename all GSD_ env vars, config paths, and usage strings to BGSD_ prefix

**Changes across 13 source files:**

| Category | Old | New | Files |
|----------|-----|-----|-------|
| Debug env var | `GSD_DEBUG` | `BGSD_DEBUG` | output.js, profiler.js, safe-hook.js |
| Profile env var | `GSD_PROFILE` | `BGSD_PROFILE` | profiler.js, router.js |
| Home dir env var | `GSD_HOME` | `__OPENCODE_CONFIG__/bgsd-oc` | agent.js, plugin/index.js |
| Cache env var | `GSD_CACHE_FORCE_MAP` | `BGSD_CACHE_FORCE_MAP` | router.js, cache.js |
| Plugin dir env var | `GSD_PLUGIN_DIR` | `BGSD_PLUGIN_DIR` | features.js (2 locations) |
| Background env var | `GSD_BG_ANALYSIS` | `BGSD_BG_ANALYSIS` | codebase.js |
| Tmpfile env var | `GSD_NO_TMPFILE` | `BGSD_NO_TMPFILE` | output.js |
| Config path | `get-shit-done` | `bgsd-oc` | agent.js, plugin/index.js, features.js, cache.js |
| CLI binary | `gsd-tools` | `bgsd-tools` | constants.js (~149 strings), router.js, profiler.js, worktree.js, verify.js, codebase.js, trajectory.js, features.js |
| MODEL_PROFILES keys | `gsd-*` | `bgsd-*` | constants.js (9 agent keys) |
| Branch templates | `gsd/` | `bgsd/` | constants.js CONFIG_SCHEMA (2 defaults) |
| Function names | `resolveGsdPaths` | `resolveBgsdPaths` | agent.js |
| Variable names | `gsdHome`, `GSD_HOME` | `bgsdHome`, `__OPENCODE_CONFIG__/bgsd-oc` | agent.js, plugin/index.js |
| Worktree path | `/tmp/gsd-worktrees` | `/tmp/bgsd-worktrees` | worktree.js |

## Task 2: Update build pipeline, package.json, rebuild

**Commit:** `e8ee03d` — build(72-01): rename build pipeline to bgsd-tools, update package.json, rebuild

**build.cjs changes:**
- Output file: `bin/gsd-tools.cjs` -> `bin/bgsd-tools.cjs`
- Smoke test path updated
- Bundle size tracking path updated
- Metafile output: `/tmp/gsd-metafile.json` -> `/tmp/bgsd-metafile.json`
- Agent filter: `gsd-*.md` -> `bgsd-*.md`

**package.json changes:**
- name: `get-shit-done-oc` -> `bgsd-oc`
- bin: `get-shit-done-oc` -> `bgsd-oc`
- test script: `bin/gsd-tools.test.cjs` -> `bin/bgsd-tools.test.cjs`
- files array: `bin/gsd-tools.cjs` -> `bin/bgsd-tools.cjs`

**Test file updates:**
- Renamed `bin/gsd-tools.test.cjs` -> `bin/bgsd-tools.test.cjs`
- Updated TOOLS_PATH, all `GSD_DEBUG` -> `BGSD_DEBUG` test assertions (14 refs)
- Updated all `GSD_PROFILE` -> `BGSD_PROFILE` test assertions (10 refs)
- Updated build output assertions, snapshot references
- Updated test snapshot `state-read.json` branch template defaults

**Build result:** 1165KB bundle (within 1500KB budget), smoke test passed, ESM validation passed.
**Test result:** 782 tests pass, 0 failures.

## Deviations

1. **cache.js added to scope** (auto-fix: blocking issue) — `src/lib/cache.js` had `get-shit-done` config path (line 23) and `GSD_CACHE_FORCE_MAP` env var (line 520) that would break at runtime if only the router-side env var was renamed. Added to Task 1 scope.

2. **Additional env vars discovered and renamed** (auto-fix: blocking issue) — `GSD_PLUGIN_DIR` (features.js, 2 locations), `GSD_BG_ANALYSIS` (codebase.js), `GSD_NO_TMPFILE` (output.js) were not in the original plan but are `GSD_`-prefixed functional env vars that must be consistently renamed.

3. **Test file rename and updates added to Task 2** (auto-fix: blocking issue) — `bin/gsd-tools.test.cjs` references the old binary name in `TOOLS_PATH` and checks for old env var names in assertions. Without updating, 4 tests failed. Renamed file and updated all 30+ assertions.

4. **Test snapshot updated** — `test/__snapshots__/state-read.json` contained old branch template defaults (`gsd/phase-...`) that caused snapshot comparison failure.

## Self-Check: PASSED

All created/modified files verified:
- `bin/bgsd-tools.cjs` — FOUND (1165KB)
- `bin/gsd-tools.cjs` — REMOVED (confirmed absent)
- `bin/bgsd-tools.test.cjs` — FOUND
- Commit `52c3f3a` — FOUND
- Commit `e8ee03d` — FOUND
- 782/782 tests passing
