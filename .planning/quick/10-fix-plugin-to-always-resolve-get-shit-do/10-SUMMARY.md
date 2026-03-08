---
phase: quick-10
plan: 01
subsystem: infra
tags: [plugin, homedir, path-resolution, opencode]

requires:
  - phase: quick-8
    provides: "OpenCode plugin structure"
provides:
  - "GSD_HOME always resolves to ~/.config/opencode/get-shit-done/ regardless of plugin load location"
affects: [install, plugin, deploy]

tech-stack:
  added: []
  patterns: ["homedir() for cross-platform home directory resolution"]

key-files:
  created: []
  modified: [plugin.js]

key-decisions:
  - "Used os.homedir() over process.env.HOME for cross-platform reliability — matches install.js pattern"
  - "Removed __dirname, dirname, fileURLToPath entirely since they are no longer needed"

patterns-established:
  - "Plugin path resolution: always use homedir() for absolute paths, never __dirname relative"

requirements-completed: [FIX-PLUGIN-PATH]

duration: 3min
completed: 2026-03-08
---

# Quick Task 10: Fix Plugin GSD_HOME Resolution Summary

**Fixed GSD_HOME to always resolve via os.homedir() instead of relative __dirname, preventing breakage when plugin is loaded from local .opencode/plugins/**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T13:44:09Z
- **Completed:** 2026-03-08T13:47:34Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced `__dirname`-based relative path with `homedir()` absolute path for GSD_HOME resolution
- Removed unused imports (`dirname`, `fileURLToPath` from `url`, `dirname` from `path`)
- Added `homedir` import from `os` — matches existing pattern in install.js
- Verified all three hooks (session.created, shell.env, experimental.session.compacting) still work

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix GSD_HOME resolution in plugin.js** - `dcbdfe5` (fix)
2. **Task 2: Verify install.js copies correct plugin and run tests** - No commit (verification-only, no files modified)

## Files Created/Modified
- `plugin.js` - Replaced `__dirname` relative resolution with `homedir()` absolute resolution for GSD_HOME

## Decisions Made
- Used `os.homedir()` instead of `process.env.HOME` for cross-platform reliability — matches the pattern already used in `install.js` line 15
- Removed all `__dirname`-related imports (`dirname` from `path`, `fileURLToPath` from `url`) since they're no longer used anywhere in plugin.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plugin fix will propagate through install.js's `cpSync(pluginSrc, pluginDst)` — no install.js changes needed
- Users running `npx get-shit-done-oc` will get the fixed plugin.js automatically

---
*Phase: quick-10*
*Completed: 2026-03-08*
