# Plan 01 Summary — Config Toggles + Ripgrep Integration

**Phase:** 0125-core-tools-integration  
**Plan:** 01  
**Status:** complete  
**Completed:** 2026-03-15

## What Was Built

### Task 1: Config Toggles and isToolEnabled
- Added `tools_ripgrep`, `tools_fd`, `tools_jq` to `CONFIG_SCHEMA` in `src/lib/constants.js` with type `boolean`, default `true`, nested section `tools`
- Added `isToolEnabled(toolName)` to `src/lib/cli-tools/fallback.js` that reads config and falls through to `detectTool()` when config not set
- Updated `withToolFallback()` to call `isToolEnabled()` instead of `detectTool()` — respects config toggle before detection
- Exported `isToolEnabled` from both `fallback.js` and `cli-tools/index.js`
- Fixed pre-existing build errors in `ripgrep.js` and `fd.js` fallbacks: replaced `require('glob')` with `require('fast-glob')` (glob not a project dependency)
- Updated integration tests (`integration.test.cjs`, `infra.test.cjs`) to include `tools` section in "fully modern" config fixtures

### Task 2: Ripgrep Integration
- **conventions.js**: Phoenix route detection uses ripgrep for `pipe_through|get|post|put|delete|patch` patterns across router.ex files; Ecto schema detection uses ripgrep for `use Ecto.Schema`; Plug detection uses ripgrep for `use Plug\b|import Plug.Conn`. All with transparent fallback to file-by-file read when ripgrep unavailable.
- **deps.js**: Added ripgrep pre-filter before readFileSync in `buildGraph()` — scans for `^(import |from |require\(|use |using |package )` patterns. Files with no import matches skipped entirely. When ripgrep unavailable, falls through to full read.
- **env.js**: `detectInfraServices()` uses ripgrep to check for `image:|build:` lines in docker-compose files. If found, reads file for service name parsing; if no ripgrep or no matches, falls through to full read.

## Key Files Modified
- `src/lib/constants.js` — 3 config schema entries added
- `src/lib/cli-tools/fallback.js` — isToolEnabled() added, withToolFallback() updated
- `src/lib/cli-tools/index.js` — isToolEnabled exported
- `src/lib/cli-tools/ripgrep.js` — fixed glob→fast-glob in fallback
- `src/lib/cli-tools/fd.js` — fixed glob→fast-glob in fallback
- `src/lib/conventions.js` — ripgrep for Phoenix patterns
- `src/lib/deps.js` — ripgrep pre-filter for import detection
- `src/commands/env.js` — ripgrep for docker-compose parsing
- `tests/integration.test.cjs` — tools section in modern config fixture
- `tests/infra.test.cjs` — tools section in modern config fixture

## Verification Results
- `npm test`: 1350 tests pass, 0 failures
- `npm run build`: Build succeeds
- CONFIG_SCHEMA has `tools_ripgrep`, `tools_fd`, `tools_jq` entries
- `isToolEnabled` exported from fallback.js
- `searchRipgrep` present in all 3 consumer files
- No new `execSync()` calls (all tool invocations via wrappers)

## Self-Check: PASSED
All must_haves satisfied:
- Per-tool config toggles in CONFIG_SCHEMA ✓
- Setting tools_ripgrep=false causes ripgrep skip ✓
- Convention detection uses ripgrep when available ✓
- Dependency parsing pre-filters via ripgrep when available ✓
- Infrastructure service detection uses ripgrep when available ✓
- All fallback paths produce identical output format ✓
