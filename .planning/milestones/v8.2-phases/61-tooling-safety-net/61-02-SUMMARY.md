---
phase: 61-tooling-safety-net
plan: 02
subsystem: infra
tags: [manifest, deploy-sync, performance-baseline, stale-file-removal]

# Dependency graph
requires:
  - phase: 61-tooling-safety-net
    provides: "esbuild metafile analysis and build infrastructure (Plan 01)"
provides:
  - "Manifest-based deploy sync with stale file removal"
  - "Performance baseline capture script (init timing, bundle size, I/O counts)"
  - "bin/manifest.json listing all deployable files"
  - ".planning/baselines/performance.json with reproducible metrics"
affects: [62-audit-discovery, 65-performance-tuning]

# Tech tracking
tech-stack:
  added: [jq]
  patterns: [manifest-based-deploy-sync, proc-self-io-profiling, median-timing-measurement]

key-files:
  created: ["baseline.js", "bin/manifest.json", ".planning/baselines/performance.json"]
  modified: ["build.js", "deploy.sh", "package.json", ".planning/.gitignore"]

key-decisions:
  - "Snapshot old manifest before copy loop to avoid self-comparison during stale file detection"
  - "Use /proc/self/io for fs I/O counting with strace fallback — reliable on Linux without extra tooling"
  - "Exclude performance.json from gitignore so git history preserves baseline snapshots"

patterns-established:
  - "Manifest sync: build generates manifest → deploy reads old+new → copies new → deletes stale"
  - "Baseline capture: median of N runs for timing, /proc/self/io for I/O counts"

requirements-completed: [AUDIT-05]

# Metrics
duration: 9min
completed: 2026-03-07
---

# Phase 61 Plan 02: Deploy Sync & Performance Baselines Summary

**Manifest-based deploy with stale file removal via jq diff, and performance baseline capture (init timing, bundle size, I/O counts) via /proc/self/io**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-07T02:13:41Z
- **Completed:** 2026-03-07T02:22:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Build generates bin/manifest.json listing all 194 deployable files for manifest-based sync
- Deploy script reads old manifest from target, copies all new files, removes stale entries with printed summary
- baseline.js captures init timing (median of 5 runs: ~120ms), bundle size (1216KB), fs I/O counts (555 reads, 147 writes), and source metrics (40 files, 31K lines)
- Deploy now exits cleanly with add/update/remove counts and correct command/agent counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add manifest generation to build and implement manifest-based deploy sync** - `7f1396c` (feat)
2. **Task 2: Create performance baseline capture script** - `6884b5b` (feat)

## Files Created/Modified
- `build.js` - Added manifest generation after metafile analysis (scans all deployable dirs, writes bin/manifest.json)
- `deploy.sh` - Replaced copy-everything with manifest-based sync: snapshots old manifest, copies new files, deletes stale entries
- `bin/manifest.json` - Generated manifest listing 194 deployable files (sorted, with ISO timestamp)
- `baseline.js` - Performance baseline capture: init timing, bundle size, I/O counts, source metrics
- `package.json` - Added `npm run baseline` script
- `.planning/baselines/performance.json` - Captured baseline metrics for Phase 65 comparison
- `.planning/.gitignore` - Added exception for performance.json to preserve git history

## Decisions Made
- Snapshot old manifest BEFORE the copy loop to prevent self-comparison (copy overwrites bin/manifest.json at target)
- Use /proc/self/io for I/O counting (available on Linux, no extra tools needed) with strace/zeros fallback chain
- performance.json un-gitignored so git history preserves snapshots per CONTEXT.md decision
- Used `find` instead of `ls` for deploy summary counts (avoids pipefail exit on no matches)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed manifest comparison order in deploy.sh**
- **Found during:** Task 1 (manifest-based deploy)
- **Issue:** Old manifest at deploy target was overwritten by copy loop before stale file comparison, so old vs new diff always found zero stale files
- **Fix:** Snapshot old manifest file list into temp file BEFORE the copy loop runs
- **Files modified:** deploy.sh
- **Verification:** Deploy correctly reports 0 stale when manifests match, would detect removals when they differ
- **Committed in:** 7f1396c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed pre-existing CMD_COUNT glob pattern in deploy.sh**
- **Found during:** Task 1 (deploy testing)
- **Issue:** `ls "$CMD_DIR"/gsd-*.md` used wrong prefix (gsd- vs bgsd-), causing exit code 2 under set -euo pipefail
- **Fix:** Changed to `find "$CMD_DIR" -maxdepth 1 -name 'bgsd-*.md'` (correct pattern, pipefail-safe)
- **Files modified:** deploy.sh
- **Verification:** Deploy completes with exit 0, reports correct count (41 commands, 11 agents)
- **Committed in:** 7f1396c (Task 1 commit)

**3. [Rule 2 - Missing Critical] Un-gitignored performance.json for history tracking**
- **Found during:** Task 2 (baseline script)
- **Issue:** .planning/.gitignore excluded baselines/*.json, preventing performance.json from being tracked in git (CONTEXT.md expects git history to preserve snapshots)
- **Fix:** Added `!baselines/performance.json` exception to .planning/.gitignore
- **Files modified:** .planning/.gitignore
- **Verification:** `git check-ignore` confirms performance.json is no longer ignored
- **Committed in:** 6884b5b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
- Test suite timed out (762+ tests, >120s) — pre-existing, not caused by this plan's changes. Smoke test and build verification confirmed no regressions.
- strace not available on this system — /proc/self/io fallback worked correctly for I/O counting

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 62 (Audit & Discovery) has full tooling: knip, madge, metafile analysis, and now manifest + baselines
- Phase 65 (Performance Tuning) can use performance.json for before/after comparison of init timing, bundle size, and I/O counts
- Deploy safety established: stale files will be cleaned automatically on each deploy

---
*Phase: 61-tooling-safety-net*
*Completed: 2026-03-07*
