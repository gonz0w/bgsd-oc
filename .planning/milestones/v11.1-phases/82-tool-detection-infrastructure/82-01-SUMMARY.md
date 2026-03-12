---
phase: 82-tool-detection-infrastructure
plan: 01
subsystem: infra
tags: [cli-tools, detection, fallback, integration]

# Dependency graph
requires:
  - []
provides:
  - CLI tool detection with 5-min cache (detector.js)
  - Platform-specific install guidance (install-guidance.js)
  - Graceful fallback wrapper (fallback.js)
  - CLI command for tool status (util:tools)
affects: [83-search-discovery, 84-extended-tools]

# Tech tracking
tech-stack:
  added: [execFileSync with array args for shell injection prevention]
  patterns: [lazy-loading modules, TTL cache pattern]

key-files:
  created: [src/lib/cli-tools/detector.js, src/lib/cli-tools/install-guidance.js, src/lib/cli-tools/fallback.js, src/commands/tools.js]
  modified: [src/router.js, bin/bgsd-tools.cjs, plugin.js]

key-decisions:
  - "Used execFileSync with array args to prevent shell injection"
  - "5-minute TTL cache for tool detection results"
  - "Lazy-loading modules in router for faster startup"

patterns-established:
  - "CLI tool detection pattern with caching"
  - "Platform-specific install guidance pattern"

requirements-completed: [CLI-01, CLI-02, CLI-03]
one-liner: "CLI tool detection infrastructure with caching, platform-specific install guidance, and graceful fallback wrapper"

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 82 Plan 01: Tool Detection Infrastructure Summary

**CLI tool detection infrastructure with caching, platform-specific install guidance, and graceful fallback wrapper**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T12:29:06Z
- **Completed:** 2026-03-10T12:32:30Z
- **Tasks:** 5
- **Files modified:** 7

## Accomplishments
- Created detector.js with 5-minute TTL cache for tool availability detection
- Created install-guidance.js with platform-specific install commands (darwin/linux/win32)
- Created fallback.js wrapper enabling graceful degradation to Node.js implementations
- Created util:tools command showing available/unavailable tools with install instructions
- Integrated all modules into bundled CLI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CLI tool detector module** - `db917cd` (feat)
2. **Task 2: Create install guidance module** - `7eb80e1` (feat)
3. **Task 3: Create graceful fallback wrapper** - `23c7e87` (feat)
4. **Task 4: Add tools status command** - `341f082` (feat)
5. **Task 5: Integrate all modules** - `1b14075` (feat)

**Plan metadata:** (docs: complete plan)

## Files Created/Modified
- `src/lib/cli-tools/detector.js` - Tool detection with 5-min cache
- `src/lib/cli-tools/install-guidance.js` - Platform-specific install commands
- `src/lib/cli-tools/fallback.js` - Graceful fallback wrapper
- `src/commands/tools.js` - CLI command for tool status
- `src/router.js` - Added tools command registration
- `bin/bgsd-tools.cjs` - Bundled CLI with new modules

## Decisions Made
- Used execFileSync with array args to prevent shell injection vulnerabilities
- 5-minute TTL cache balances freshness with performance
- Lazy-loading modules in router maintains fast startup time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool detection infrastructure complete, ready for Phase 83 (Search & Discovery)
- ripgrep, fd, jq, yq, bat, gh integrations can now check availability first

---
*Phase: 82-tool-detection-infrastructure*
*Completed: 2026-03-10*
