---
phase: 62-audit-discovery
plan: 02
subsystem: tooling
tags: [knip, dead-code, command-reference, markdown-cross-ref, audit]

# Dependency graph
requires:
  - phase: 62-audit-discovery
    provides: dead-code-report.json with knip export classification
provides:
  - Command reference map cross-referencing 281 CLI commands against 140 markdown files
  - Final audit summary with markdown-aware export reclassification
  - npm audit:commands and audit:all scripts for repeatable analysis
affects: [63-dead-code-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: [markdown consumer scanning via regex, export reclassification pipeline, multi-report cross-reference]

key-files:
  created:
    - audit-commands.js
    - .planning/baselines/audit/command-reference-map.json
    - .planning/baselines/audit/audit-summary.json
  modified:
    - package.json

key-decisions:
  - "281 commands tracked (namespaced + legacy forms) — high orphan count expected from duplicate entries"
  - "4 exports reclassified from truly_dead/internal to documented_helper via markdown reference check"
  - "Phase 63 has 0 removable exports, 1 removable file — most knip findings are false positives"

patterns-established:
  - "audit-commands.js map/summary subcommands for incremental or full audit runs"
  - "Markdown regex handles __OPENCODE_CONFIG__ mangled paths from auth plugin"

requirements-completed: [AUDIT-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 62 Plan 02: Command Reference Map & Audit Summary

**Command reference map cross-references 281 CLI commands against 140 markdown files, reclassifying 4 knip false positives as markdown-documented — final audit confirms 0 truly dead exports and 1 removable file for Phase 63**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T02:44:58Z
- **Completed:** 2026-03-07T02:48:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created audit-commands.js that parses router.js for all 281 CLI commands and scans 140 markdown files for gsd-tools invocations
- Command reference map identifies 80 commands with markdown consumers and 201 orphans (mostly namespace/legacy duplicates)
- Final audit summary cross-references dead code report with markdown consumers, reclassifying 4 exports as documented_helper
- Classification totals verified: 154 router + 0 cross-module + 105 internal + 0 markdown-only + 4 documented + 0 truly dead = 263 (matches knip total)
- Wired `npm run audit:commands` and `npm run audit:all` for repeatable full-suite audit

## Task Commits

Each task was committed atomically:

1. **Task 1: Build command reference map from markdown consumers** - `8b83ad7` (feat)
2. **Task 2: Produce final audit summary with markdown cross-reference** - `402b0e3` (feat)

## Files Created/Modified
- `audit-commands.js` - Command reference map builder and cross-reference analyzer with map/summary subcommands
- `.planning/baselines/audit/command-reference-map.json` - CLI command to markdown consumer cross-reference (281 commands, 140 files)
- `.planning/baselines/audit/audit-summary.json` - Final combined audit with actionable categories and Phase 63 removal candidates
- `package.json` - Added audit:commands and audit:all npm scripts

## Decisions Made
- Tracked both namespaced (e.g. `verify:state advance-plan`) and legacy (e.g. `state advance-plan`) command forms — 281 total entries, high orphan count is expected from duplicates not representing missing functionality
- Regex handles `__OPENCODE_CONFIG__` mangled paths from the auth plugin, ensuring markdown file invocations are properly captured
- 4 exports reclassified from truly_dead/internal_helper to documented_helper: `default` (lifecycle.js), `blame` (git.js), `mark` and `measure` (profiler.js) — all referenced by name in markdown docs
- Phase 63 removal scope is conservative: 0 exports, 1 file (src/lib/review/stage-review.js) — the vast majority of knip findings are router dispatch false positives

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — autonomous plan, review context not required.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 62 audit discovery complete — all three audit scripts (exports, circular, commands) produce structured JSON reports
- Phase 63 has a clear, conservative removal target: 1 file (stage-review.js) and 0 exports
- 105 internal helpers identified for potential export cleanup (remove from module.exports, keep the function)
- 201 orphan commands identified for review (mostly namespace/legacy form duplicates)

---
*Phase: 62-audit-discovery*
*Completed: 2026-03-07*
