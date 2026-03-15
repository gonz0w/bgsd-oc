---
phase: 0126-extended-tools
plan: 02
subsystem: cli
tags:
  - gh
  - github-cli
  - version-blocklist
  - preflight
  - javascript

# Dependency graph
requires:
  - phase: 0124-tool-detection-infrastructure
    provides: detectTool(), parseVersion() used by isGhUsable()
  - phase: 0126-extended-tools
    provides: gh.js with listPRs, checkAuth base for preflight
provides:
  - isGhUsable() function with exact version blocklist for gh 2.88.0
  - detect:gh-preflight CLI command returning structured JSON for workflow pre-flight
affects:
  - workflows/github-ci.md (can now call detect:gh-preflight before spawning CI agent)
  - any future gh-using code (can gate on isGhUsable())

tech-stack:
  added: []
  patterns:
    - "Version blocklist pattern: BLOCKED_VERSIONS array with exact major.minor.patch match"
    - "Pre-flight validation: structured JSON { usable, authenticated, version, errors } for workflow gating"

key-files:
  created: []
  modified:
    - src/lib/cli-tools/gh.js
    - src/lib/cli-tools/index.js
    - src/commands/tools.js
    - src/router.js
    - bin/bgsd-tools.cjs

key-decisions:
  - "Exact match (major === b.major && minor === b.minor && patch === b.patch) — only 2.88.0 is blocked, not 2.88.x"
  - "BLOCKED_VERSIONS as array for extensibility — future blocked versions can be added without code changes"
  - "detect:gh-preflight kept internal (no COMMAND_HELP entry) — workflow-facing tool, not user-facing"
  - "Auth check only runs when gh is usable — no wasted auth call when gh is missing/blocked"

patterns-established:
  - "Version blocklist pattern: BLOCKED_VERSIONS array with { major, minor, patch, reason } for exact semver blocking"
  - "Pre-flight command pattern: structured { usable, authenticated, version, errors } for CI workflow gating"

requirements-completed: [TOOL-06]
one-liner: "gh 2.88.0 version blocklist in isGhUsable() and detect:gh-preflight CLI command for GitHub CI workflow pre-flight validation"

# Metrics
duration: 19min
completed: 2026-03-15
---

# Phase 126 Plan 02: gh CLI Version Blocklist and Pre-flight Validation Summary

**gh 2.88.0 version blocklist in isGhUsable() and detect:gh-preflight CLI command for GitHub CI workflow pre-flight validation**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-15T13:16:19Z
- **Completed:** 2026-03-15T13:35:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `isGhUsable()` to `gh.js` with a `BLOCKED_VERSIONS` array that exact-matches `2.88.0` using `parseVersion()` from detector.js — blocks only the bad patch, allows 2.88.1, 2.87.x, 2.89.x
- Added `detect:gh-preflight` CLI command to `tools.js` and wired it into the `detect:` namespace in `router.js`, returning structured `{ usable, authenticated, version, errors }` JSON
- Exported `isGhUsable` through `cli-tools/index.js` making it available to all consumers; all 1398 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isGhUsable() with version blocklist to gh.js** - `5d726c6` (feat)
2. **Task 2: Add detect:gh-preflight CLI command and update index exports** - `59722fb` (feat)

**Plan metadata:** `1a1cd29` (docs: complete plan)

## Files Created/Modified
- `src/lib/cli-tools/gh.js` - Added BLOCKED_VERSIONS, isGhUsable(), updated imports and exports
- `src/lib/cli-tools/index.js` - Added isGhUsable to gh imports and module.exports
- `src/commands/tools.js` - Added cmdGhPreflight() function and export
- `src/router.js` - Added detect:gh-preflight case to detect namespace dispatch
- `bin/bgsd-tools.cjs` - Built output (updated in both task commits)

## Decisions Made
- Used exact version match (`major === blocked.major && minor === blocked.minor && patch === blocked.patch`) as required by CONTEXT.md — only 2.88.0 is blocked, not any 2.88.x
- `BLOCKED_VERSIONS` stored as an array of objects (not a Set/Map) for future extensibility — new blocked versions can be added as objects with `reason` field
- `detect:gh-preflight` is internal (no COMMAND_HELP entry) since it is workflow-facing, not user-facing
- Auth check only runs when `isGhUsable()` succeeds — saves one process spawn when gh is missing/blocked

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — gap closure not applicable, no checkpoints; pre-existing test flakiness (codebase_stats timing issue) confirmed pre-existing via baseline check.

## Issues Encountered

- **Stash pop conflict:** During baseline testing (to verify pre-existing failures), `git stash pop` caused a merge conflict on the `bin/bgsd-tools.cjs` built file, reverting source changes. Re-applied edits to `gh.js` and `index.js` and rebuilt. No functional impact.
- **Pre-existing test failures:** The `config-migrate` test (`already-complete config returns empty migrated_keys`) was failing due to unstaged Phase 0125 changes adding `tools_yq`, `tools_bat`, `tools_gh` to `constants.js`. These changes were already in the workspace diff and fixed after rebuild. The `init execute-phase includes codebase_stats` test is a known flaky test that passes individually but occasionally fails under full suite parallel execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- gh 2.88.0 version blocklist complete (TOOL-06 satisfied)
- `detect:gh-preflight` is ready for the github-ci workflow to call before spawning the CI agent
- Phase 126 Plan 02 complete; Phase 127 (agent routing decision functions) can proceed

## Self-Check: PASSED

- ✓ `src/lib/cli-tools/gh.js` exists with BLOCKED_VERSIONS and isGhUsable()
- ✓ `src/commands/tools.js` exists with cmdGhPreflight()
- ✓ `.planning/phases/0126-extended-tools/0126-02-SUMMARY.md` exists
- ✓ Commits present: `5d726c6` (task 1), `59722fb` (task 2), `8f3db5f` (metadata)
- ✓ `isGhUsable` exported as function from cli-tools index
- ✓ `detect:gh-preflight` returns valid JSON with usable/authenticated/version/errors

---
*Phase: 0126-extended-tools*
*Completed: 2026-03-15*
