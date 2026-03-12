---
phase: 84-extended-tools
plan: 01
subsystem: cli-tools
tags: [yq, bat, gh, yaml, syntax-highlighting, github]

# Dependency graph
requires:
  - phase: 82-tool-detection
    provides: "Tool detection infrastructure (detector.js, fallback.js)"
  - phase: 83-search-and-discovery
    provides: "Search patterns (ripgrep, fd, jq)"
provides:
  - "yq.js - YAML processing wrapper with parseYAML, transformYAML, YAMLtoJSON"
  - "bat.js - Syntax highlighting wrapper with catWithHighlight, listThemes, getLanguage"
  - "gh.js - GitHub CLI wrapper with listPRs, listIssues, getRepoInfo"
  - "index.js - Unified exports for all extended tools"
affects: [85-runtime-exploration]

# Tech tracking
added: [yq CLI, bat CLI, gh CLI]
patterns: [CLI tool wrapper with graceful fallback, execFileSync with array args]

key-files:
  created: [src/lib/cli-tools/yq.js, src/lib/cli-tools/bat.js, src/lib/cli-tools/gh.js]
  modified: [src/lib/cli-tools/index.js, bin/bgsd-tools.cjs]

key-decisions:
  - "Used Python yq v3.4.3 compatibility (temp file approach since no stdin support)"
  - "gh CLI has no Node.js fallback - clear error messages when unavailable"
  - "All wrappers use withToolFallback for graceful degradation"

patterns-established:
  - "CLI tool wrapper pattern: CLI first, Node.js fallback, clear error messages"
  - "execFileSync with array args for shell injection prevention"

requirements-completed: [CLI-07, CLI-08, CLI-09]
one-liner: "yq, bat, and gh CLI tool wrappers with unified index.js exports and graceful fallbacks"

# Metrics
duration: 7 min
completed: 2026-03-10
---

# Phase 84 Plan 01: Extended Tools Summary

**yq, bat, and gh CLI tool wrappers with unified index.js exports and graceful fallbacks**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T13:14:57Z
- **Completed:** 2026-03-10T13:21:20Z
- **Tasks:** 5
- **Files modified:** 7

## Accomplishments
- Created yq.js for YAML processing (parseYAML, transformYAML, YAMLtoJSON)
- Created bat.js for syntax highlighting (catWithHighlight, listThemes, getLanguage)
- Created gh.js for GitHub operations (listPRs, listIssues, getRepoInfo, checkAuth)
- Updated index.js with unified exports for all tools
- Bundled CLI with all new modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create yq.js YAML processing wrapper** - `f6c25f7` (feat)
2. **Task 2: Create bat.js syntax highlighting wrapper** - `979ce31` (feat)
3. **Task 3: Create gh.js GitHub operations wrapper** - `8e3d828` (feat)
4. **Task 4: Update index.js with unified exports** - `bcfbb69` (feat)
5. **Task 5: Bundle and verify integration** - `a9d1b76` (build)

**Plan metadata:** `a9d1b76` (build: bundle CLI with extended tool integrations)

## Files Created/Modified
- `src/lib/cli-tools/yq.js` - YAML processing with yq CLI + js-yaml fallback
- `src/lib/cli-tools/bat.js` - Syntax highlighting with bat CLI + cat fallback
- `src/lib/cli-tools/gh.js` - GitHub CLI operations (no fallback)
- `src/lib/cli-tools/index.js` - Unified exports for all tools
- `bin/bgsd-tools.cjs` - Bundled CLI with new modules

## Decisions Made
- Python yq v3.4.3 requires temp file approach (no stdin support)
- gh CLI has no Node.js fallback - clear error messages when unavailable
- All wrappers use withToolFallback for graceful degradation

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for Phase 85: Runtime Exploration
- All CLI tools (yq, bat, gh) integrated with detection infrastructure

---
*Phase: 84-extended-tools*
*Completed: 2026-03-10*
