# Plan 02 Summary — fd + jq Integration + Health Check

**Phase:** 0125-core-tools-integration  
**Plan:** 02  
**Status:** complete  
**Completed:** 2026-03-15

## What Was Built

### Task 1: fd Integration into Discovery Adapter
- Added `fdFindFiles` and `isToolEnabled` imports to `src/lib/adapters/discovery.js`
- Implemented `fdGetSourceDirs(cwd)`: uses fd for top-level directory detection; filters through KNOWN_SOURCE_DIRS; returns null to signal fallback on failure
- Implemented `fdWalkSourceFiles(cwd, sourceDirs)`: uses fd for large-scale file discovery; excludes SKIP_DIRS and BINARY_EXTENSIONS; returns null to signal fallback
- Updated `getSourceDirs()`: tries fd first when `isToolEnabled('fd')` is true, falls through to existing optimized/legacy modes on failure
- Updated `walkSourceFiles()`: tries fd first when `isToolEnabled('fd')` is true, falls through to existing fast-glob/legacy modes on failure
- Per CONTEXT.md: fd used ONLY for large-scale codebase discovery; `.planning/` operations unchanged; fd mode is 3rd option (fastest when available)

### Task 2: jq Integration + Enhanced Fallback + Health Check

**jq.js fallback enhancement:**
- Fixed incorrect FILTER_PRESETS: `keys: 'keys'` (was `'.[]'`), `values: '[.[]]'` (was `'.[]'`), `mapKeys: 'keys'`
- Added comprehensive `applyJqFilter()` function supporting:
  - Pipe chains via `findTopLevelPipe()` (handles nesting depth)
  - `[expr]` array wrapping
  - `.[]` array/object iteration
  - `keys`, `values`, `length`, `to_entries[]`
  - `select(condition)` — filter elements matching condition
  - `map(expr)` — transform each element
  - Comparison operators for select conditions (`.key == value`, `.x > 1`, etc.)
  - Array indexing `.[N]`
  - Nested dot-path access `.key.subkey`
  - `.` identity

**tools.js integration:**
- Added `transformJson` import from cli-tools/jq
- Fixed pre-existing bug: added `getInstallGuidance` to import from install-guidance
- `cmdToolsStatus()`: uses jq to extract available tool names via `[.[] | select(.available == true) | .name]`, adds `available_summary` to output

**codebase-intel.js integration:**
- Added `transformJson` import from cli-tools
- `readIntel()`: for large intel files (>100KB), uses jq `.files | keys | length` for quick file count diagnostic before full JSON.parse

**env.js integration:**
- Added `transformJson` to existing cli-tools import
- `detectMcpServers()`: uses jq `.mcpServers | keys` to extract server names with JS fallback for when jq unavailable

**verify.js health check:**
- Added `getToolStatus` import from cli-tools
- `cmdValidateHealth()` now includes `tool_availability` section in output
- For each tool: shows `name`, `available`, and either `version`/`path` (if available) or `project_url` (if missing)
- Project URLs for all 6 tools included: ripgrep, fd, jq, yq, bat, gh
- Advisory: never blocks health check (wrapped in try/catch)

## Key Files Modified
- `src/lib/adapters/discovery.js` — fd integration as acceleration mode
- `src/lib/cli-tools/jq.js` — comprehensive fallback with applyJqFilter()
- `src/commands/tools.js` — jq for available_summary + fix missing import
- `src/lib/codebase-intel.js` — jq for large intel file diagnostics
- `src/commands/env.js` — jq for MCP server name extraction
- `src/commands/verify.js` — tool availability section in health check

## Verification Results
- `npm test`: 1350 tests pass, 0 failures
- `npm run build`: Build succeeds
- fd integration: `fdFindFiles`, `fdWalkSourceFiles`, `fdGetSourceDirs` present in discovery.js
- jq integration: `transformJson` in tools.js, codebase-intel.js, env.js
- Health check: `tool_availability` field in verify.js output
- No new `execSync()` calls

## Self-Check: PASSED
All must_haves satisfied:
- File discovery uses fd as acceleration mode with transparent fallback ✓
- fd integration respects .gitignore (fd's native behavior) ✓
- jq used for JSON transformation with full JS fallback ✓
- jq JS fallback covers all filters used (select, map, pipe, nested, keys, values) ✓
- Tool availability in health check with project links for missing tools ✓
- CLI never crashes when tools unavailable ✓
