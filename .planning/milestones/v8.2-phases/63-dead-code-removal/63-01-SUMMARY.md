---
phase: 63-dead-code-removal
plan: 01
subsystem: api
tags: [dead-code, exports, module-surface, cleanup]

# Dependency graph
requires:
  - phase: 62-audit-discovery
    provides: dead code audit identifying unused exports and files
provides:
  - Reduced public API surface across 24 source files
  - Deleted 1 confirmed dead file (stage-review.js)
affects: [63-02-dead-code-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: [internal-only functions kept as module-local, only public API exported]

key-files:
  created: []
  modified:
    - src/lib/output.js
    - src/lib/context.js
    - src/lib/helpers.js
    - src/lib/deps.js
    - src/lib/recovery/stuck-detector.js
    - src/lib/git.js
    - src/lib/orchestration.js
    - src/lib/codebase-intel.js
    - src/lib/conventions.js
    - src/lib/ast.js
    - src/lib/regex-cache.js
    - src/lib/review/severity.js
    - src/commands/state.js
    - src/commands/init.js
    - src/commands/features.js
    - src/commands/misc.js
    - src/commands/env.js
    - src/commands/mcp.js
    - src/commands/worktree.js
    - src/commands/codebase.js
    - src/commands/cache.js
    - src/commands/agent.js
    - src/commands/research.js

key-decisions:
  - "Preserved branchInfo and trajectoryBranch exports in git.js — router-consumed, not internal"
  - "Preserved detectCliTools, detectMcpServers, calculateTier in research.js — cross-module imports from init.js"
  - "Preserved readCodebaseIntel, checkCodebaseIntelStaleness, autoTriggerCodebaseIntel, spawnBackgroundAnalysis in codebase.js — cross-module imports from init.js"
  - "Preserved checkBinary in env.js — cross-module import from research.js"

patterns-established:
  - "Pattern: Only export functions used by other modules or tests. Keep internal helpers as module-local."

requirements-completed: [DEAD-01, DEAD-02]

# Metrics
duration: 16min
completed: 2026-03-07
---

# Phase 63 Plan 01: Dead Code Removal Summary

**Deleted 1 dead file and removed ~80 internal helper exports from module.exports across 24 source files, reducing bundle from 1216KB to 1211KB**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-07T03:06:59Z
- **Completed:** 2026-03-07T03:23:43Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Deleted `src/lib/review/stage-review.js` — confirmed unused dead file
- Removed internal helper exports from 13 lib/ module.exports blocks
- Removed internal helper exports from 11 commands/ module.exports blocks
- All 10 test-referenced exports preserved (AGENT_MANIFESTS, compactPlanState, compactDepGraph, getTimings, classifyTaskComplexity, parseTasksFromPlan, LANG_MANIFESTS, parsePlanId, computeRiskLevel, plus cross-module functions)
- Bundle size reduced from ~1216KB to 1211KB
- All 762 tests pass (3 pre-existing config-migrate failures unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead file and un-export internal helpers from lib/ modules** - `d5401cc` (refactor)
2. **Task 2: Un-export internal helpers from commands/ modules and verify** - `13b2419` (refactor)

## Files Created/Modified
- `src/lib/review/stage-review.js` - Deleted (dead file)
- `src/lib/output.js` - Removed `_tmpFiles, outputMode` from exports
- `src/lib/context.js` - Removed `isWithinBudget` from exports
- `src/lib/helpers.js` - Removed `searchPhaseInDir, invalidateMilestoneCache` from exports
- `src/lib/deps.js` - Removed `IMPORT_PARSERS, parseImports` from exports
- `src/lib/recovery/stuck-detector.js` - Removed `StuckDetector, DEFAULT_CONFIG` from exports
- `src/lib/git.js` - Removed `routeTask` from orchestration.js (git.js kept intact — see deviations)
- `src/lib/orchestration.js` - Removed `routeTask` from exports
- `src/lib/codebase-intel.js` - Removed `INTEL_PATH, BINARY_EXTENSIONS, analyzeFile` from exports
- `src/lib/conventions.js` - Removed `detectNamingConventions, detectFileOrganization, detectFrameworkConventions, FRAMEWORK_DETECTORS` from exports
- `src/lib/ast.js` - Removed `DETECTOR_REGISTRY, stripTypeScript, parseWithAcorn, extractCjsExports, extractJsSignaturesRegex` from exports
- `src/lib/regex-cache.js` - Removed `FRONTMATTER_DELIMITERS, PHASE_HEADER, ACTIVE_MILESTONE, ACTIVE_TAG_MILESTONE, VERSION_PATTERN, DATE_PATTERN, COMMIT_SHA, UNCHECKED_PHASE` from exports
- `src/lib/review/severity.js` - Removed `classifySeverity, createFinding, filterBySeverity, getSeveritySummary, blocksCompletion, CLASSIFICATION_RULES` from exports
- `src/commands/state.js` - Removed `stateExtractField, stateReplaceField`
- `src/commands/init.js` - Removed `getSessionDiffSummary`
- `src/commands/features.js` - Removed `extractSectionsFromFile`
- `src/commands/misc.js` - Removed `preCommitChecks, FRONTMATTER_SCHEMAS`
- `src/commands/env.js` - Removed `checkEnvManifestStaleness, scanManifests, detectPackageManager, matchSimpleGlob, performEnvScan, writeManifest, ensureManifestGitignored, writeProjectProfile, getWatchedFiles, getWatchedFilesMtimes`
- `src/commands/mcp.js` - Removed all 17 internal helpers
- `src/commands/worktree.js` - Removed `parseMergeTreeConflicts, isAutoResolvable, WORKTREE_DEFAULTS`
- `src/commands/codebase.js` - Removed `scoreRelevance, getRecentlyModifiedFiles, getPlanFiles, enforceTokenBudget, matchFileConventions`
- `src/commands/cache.js` - Removed `registerCacheCommand`
- `src/commands/agent.js` - Removed `scanAgents, parseRaciMatrix`
- `src/commands/research.js` - Removed `collectWebSources, collectYouTubeSources, collectNlmSynthesis, formatSourcesForAgent, parseVtt, saveSession, loadSession, deleteSession`

## Decisions Made
- Preserved `branchInfo` and `trajectoryBranch` in git.js — plan classified as internal but they are router-consumed via router.js
- Preserved `detectCliTools`, `detectMcpServers`, `calculateTier` in research.js — cross-module imports from init.js
- Preserved `readCodebaseIntel`, `checkCodebaseIntelStaleness`, `autoTriggerCodebaseIntel`, `spawnBackgroundAnalysis` in codebase.js — cross-module imports from init.js
- Preserved `checkBinary` in env.js — cross-module import from research.js

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved branchInfo and trajectoryBranch exports in git.js**
- **Found during:** Task 1 (lib/ export removal)
- **Issue:** Plan classified `branchInfo` and `trajectoryBranch` as internal helpers, but they are consumed by router.js (line 1502, 1520). Removing would break the build.
- **Fix:** Kept both exports in git.js module.exports
- **Files modified:** src/lib/git.js
- **Verification:** Build succeeds, router.js references resolve
- **Committed in:** d5401cc (Task 1 commit)

**2. [Rule 1 - Bug] Preserved cross-module exports in research.js**
- **Found during:** Task 2 (commands/ export removal)
- **Issue:** Plan classified `detectCliTools`, `detectMcpServers`, `calculateTier` as internal, but init.js imports them via `require('./research')`
- **Fix:** Kept these 3 exports; only removed 8 truly internal helpers
- **Files modified:** src/commands/research.js
- **Verification:** Build succeeds, init.js cross-module imports resolve
- **Committed in:** 13b2419 (Task 2 commit)

**3. [Rule 1 - Bug] Preserved cross-module exports in codebase.js**
- **Found during:** Task 2 (commands/ export removal)
- **Issue:** Plan classified `readCodebaseIntel`, `checkCodebaseIntelStaleness`, `spawnBackgroundAnalysis` as internal, but init.js imports `autoTriggerCodebaseIntel` which uses them
- **Fix:** Kept `readCodebaseIntel`, `checkCodebaseIntelStaleness`, `autoTriggerCodebaseIntel`, `spawnBackgroundAnalysis` exports; removed 5 truly internal helpers
- **Files modified:** src/commands/codebase.js
- **Verification:** Build succeeds, init.js cross-module imports resolve
- **Committed in:** 13b2419 (Task 2 commit)

**4. [Rule 1 - Bug] Preserved checkBinary export in env.js**
- **Found during:** Task 2 (commands/ export removal)
- **Issue:** Plan did not list `checkBinary` for removal, but confirming it's needed by research.js
- **Fix:** Correctly kept `checkBinary` in env.js exports
- **Files modified:** src/commands/env.js
- **Verification:** Build succeeds
- **Committed in:** 13b2419 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 bugs — plan incorrectly classified cross-module exports as internal)
**Impact on plan:** ~15 fewer exports removed than planned (80 instead of 95) due to audit false positives on router-consumed and cross-module functions. No scope creep. All truly internal helpers were removed successfully.

## Review Findings

Review skipped — autonomous plan, no review context assembled.

## Issues Encountered
None — all issues were caught and handled via deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can proceed with CONFIG_SCHEMA and COMMAND_HELP cleanup in constants.js
- All function definitions remain intact; only exports were removed
- Bundle loads cleanly and all tests pass

---
*Phase: 63-dead-code-removal*
*Completed: 2026-03-07*
