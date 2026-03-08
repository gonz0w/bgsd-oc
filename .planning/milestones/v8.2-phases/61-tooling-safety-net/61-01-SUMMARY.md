---
phase: 61-tooling-safety-net
plan: 01
subsystem: infra
tags: [esbuild, metafile, knip, madge, dead-code, circular-deps, build-analysis]

# Dependency graph
requires: []
provides:
  - "Per-module byte attribution via esbuild metafile (build-analysis.json)"
  - "Dead-code audit tool (knip) with npm script"
  - "Circular-dependency audit tool (madge) with npm script"
affects: [62-audit-discovery, 65-performance-tuning]

# Tech tracking
tech-stack:
  added: [knip, madge]
  patterns: [esbuild-metafile-analysis, per-module-byte-attribution]

key-files:
  created: [".planning/baselines/build-analysis.json"]
  modified: ["build.js", "package.json"]

key-decisions:
  - "Group metafile analysis by directory prefix with scoped package support"
  - "Warn but don't fail on source files exceeding 50KB in output"
  - "build-analysis.json stays gitignored (regenerated each build)"

patterns-established:
  - "Build analysis: esbuild metafile enables per-module byte tracking for optimization decisions"
  - "Audit scripts: npm run audit:* pattern for code quality tooling"

requirements-completed: [AUDIT-01, AUDIT-06]

# Metrics
duration: 23min
completed: 2026-03-07
---

# Phase 61 Plan 01: Tooling & Safety Net Summary

**esbuild metafile per-module byte attribution with knip dead-code and madge circular-dependency audit scripts**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-07T01:47:01Z
- **Completed:** 2026-03-07T02:10:26Z
- **Tasks:** 2
- **Files modified:** 3 (build.js, package.json, package-lock.json)

## Accomplishments
- esbuild metafile analysis producing per-module and per-directory byte attribution in console and build-analysis.json
- knip installed and detecting 263 unused exports across src/ (Phase 62 will curate)
- madge installed and confirming zero circular dependencies in src/
- All existing build functionality preserved (smoke test, bundle size tracking, budget gate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable esbuild metafile and per-module build analysis** - `0e72001` (feat)
2. **Task 2: Install knip and madge with audit npm scripts** - `88a6e65` (feat)

## Files Created/Modified
- `build.js` - Added metafile: true, per-module analysis with directory grouping, build-analysis.json output, large file warnings
- `package.json` - Added knip + madge devDependencies, audit:dead-code and audit:circular npm scripts
- `package-lock.json` - Lockfile updated with 171 new packages (knip + madge dependency trees)
- `.planning/baselines/build-analysis.json` - Generated per-build: per-module and per-directory byte counts (gitignored)

## Decisions Made
- Group metafile analysis by directory prefix (src/commands/, src/lib/, node_modules/pkg/) for clear attribution
- Warn on files >50KB in output but don't fail the build — provides visibility for Phase 65 optimization
- build-analysis.json stays gitignored since it's regenerated each build — avoids noisy diffs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed group-file filtering for src/ root files**
- **Found during:** Task 1 (metafile analysis)
- **Issue:** The initial file-to-group filter showed all src/ files under the src/ root group instead of only root-level files (index.js, router.js)
- **Fix:** Added explicit check for `fp.split('/').length === 2` when groupName is `src/`
- **Files modified:** build.js
- **Verification:** Build output correctly shows only router.js and index.js under src/ group
- **Committed in:** 0e72001 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor display bug fixed during development. No scope creep.

## Issues Encountered
- Two pre-existing test failures (config-migrate tests from Phase 56 RAG key additions) — not caused by this plan's changes, documented in STATE.md as known issue

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 62 (Audit & Discovery) can now run knip to identify dead code for removal
- Phase 65 (Performance Tuning) can consume build-analysis.json for per-module optimization targeting
- Baseline data: bundle at 1216KB, acorn is largest single module (230KB), src/commands/ is largest group (630KB)

---
*Phase: 61-tooling-safety-net*
*Completed: 2026-03-07*
