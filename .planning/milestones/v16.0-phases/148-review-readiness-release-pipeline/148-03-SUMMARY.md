---
phase: 148-review-readiness-release-pipeline
plan: 03
subsystem: release
tags: [release, semver, changelog, git, github, gh, testing]
requires:
  - phase: 148-review-readiness-release-pipeline
    provides: dry-run release analysis and changelog preview contracts from Plan 02
provides:
  - resumable release mutations that sync package.json, package-lock.json, VERSION, and CHANGELOG.md
  - gh-preflighted release PR automation with github-ci compatible branch and handoff metadata
  - fixture-backed recovery coverage for safe cleanup boundaries and resume guidance
affects: [148-04, workflows/release.md, workflows/github-ci.md]
tech-stack:
  added: []
  patterns: [resumable release-state persistence, safe-cleanup-only recovery, gh preflight before PR mutation]
key-files:
  created:
    - src/lib/release/mutate.js
    - src/lib/release/pr.js
    - src/lib/release/state.js
    - tests/release.test.cjs
  modified: [bin/bgsd-tools.cjs, src/lib/cli-tools/gh.js, src/lib/git.js]
key-decisions:
  - "Release mutations persist step-by-step progress in `.planning/release-state.json` instead of attempting magical rollback."
  - "`release:pr` checks gh usability and authentication before any PR-specific mutation so missing GitHub access fails with explicit resume guidance."
  - "Automatic cleanup is limited to obviously safe local artifacts like an unpushed tag; version and changelog edits are preserved for resume."
patterns-established:
  - "Release state tracks completed safe steps plus next-safe-command guidance for resumable tag and PR flows."
  - "Release PR output carries github-ci handoff metadata (branch, base, scope) instead of inventing a parallel post-PR contract."
requirements-completed: [REL-01, REL-03]
one-liner: "Resumable release mutations that sync version files, create annotated tags, and open gh-preflighted release PRs with safe resume guidance"
duration: 5min
completed: 2026-03-28
---

# Phase 148 Plan 03: Build the resumable mutation layer for version updates, tagging, and PR automation. Summary

**Resumable release mutations that sync version files, create annotated tags, and open gh-preflighted release PRs with safe resume guidance**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28 17:13:14 -0600
- **Completed:** 2026-03-28 17:18:16 -0600
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added the release mutation layer that applies version/changelog changes, creates annotated tags, and persists `.planning/release-state.json` after each safe step.
- Added `release:pr` automation that preflights gh early, pushes release refs, creates PRs through the shared gh wrapper, and returns github-ci compatible handoff metadata.
- Expanded release fixtures to prove synchronized version updates, safe cleanup boundaries, explicit resume guidance, and release routing compatibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement synchronized version updates, tag creation, and release resume-state persistence** - `fae2cef` (feat)
2. **Task 2: Add tag and PR automation with early gh preflight, previewable PR details, and github-ci handoff compatibility** - `0070e40` (feat)
3. **Task 3: Expand release tests for partial failure, safe cleanup, and resume guidance** - `16ab41a` (test)
4. **Additional commit** - `780af5a` (test: test(148-03): align readiness routing expectations)

**Plan metadata:** Pending final docs commit

## Files Created/Modified

- `src/lib/release/mutate.js` - Applies synchronized version/changelog mutations, annotated tags, and persisted safe-step progress for release execution.
- `src/lib/release/state.js` - Stores `.planning/release-state.json` with completed steps, cleanup tracking, and next-safe resume guidance.
- `src/lib/release/pr.js` - Builds previewable release PR details, runs gh preflight, pushes refs, and returns github-ci handoff metadata.
- `src/commands/release.js` - Routes `release:tag` and `release:pr` to the real mutation and PR engines.
- `src/lib/cli-tools/gh.js` - Adds shared PR creation support so release automation stays on the existing gh wrapper path.
- `src/lib/git.js` - Adds reusable tag, branch, and push helpers needed by resumable release automation.
- `tests/release.test.cjs` - Covers version syncing, gh preflight failure, successful PR handoff metadata, safe cleanup, and resume guidance.
- `tests/review-readiness.test.cjs` - Updates release command discovery assertions to match the now-implemented release bump path.
- `bin/bgsd-tools.cjs` - Rebuilt bundled CLI artifact with release mutation and recovery support.

## Decisions Made

- Persisted release progress inside `.planning/release-state.json` so failed release runs can resume from the next safe step instead of guessing rollback behavior.
- Treated gh usability/authentication as an early gate in `release:pr` so missing GitHub access fails before branch push or PR creation work.
- Limited automatic cleanup to obvious local-only artifacts such as an unpushed tag while intentionally preserving meaningful version and changelog edits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale readiness routing expectations after release automation stopped being scaffold-only**
- **Found during:** Overall verification (`npm test` broad regression gate)
- **Issue:** `tests/review-readiness.test.cjs` still expected `release:bump` to return scaffold status `todo`, but Plans 02-03 now implement the live release path.
- **Fix:** Updated the readiness routing assertion to expect the active `ok` status while keeping the discovery coverage intact.
- **Files modified:** `tests/review-readiness.test.cjs`
- **Verification:** `node --test --test-force-exit tests/release.test.cjs tests/review-readiness.test.cjs`
- **Committed in:** `780af5a`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Regression fix only; it aligned existing test expectations with the implemented Phase 148 release behavior without changing scope.

## Review Findings

Review skipped — execution summary only; no post-execution review workflow was run for this plan.

## Issues Encountered

- The selective `execute:commit` helper remains unusable in this dirty worktree, so task commits were created with explicit file-scoped Git staging to avoid scooping unrelated user changes.
- The full `npm test` regression gate still reports pre-existing failures outside this plan (`tests/tdd.test.cjs`, `tests/cli-tools-integration.test.cjs`, `tests/trajectory.test.cjs`, and `tests/worktree.test.cjs`); release-focused verification passed and the one release-related regression was fixed inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 148 now has the mutation-half of the release engine: synchronized file updates, resumable tag/PR state, gh preflight, and github-ci handoff metadata are all in place.
- Plan 04 can focus on the `/bgsd-release` workflow shell and confirmation UX instead of inventing new mutation primitives.

## Self-Check: PASSED

- Found `.planning/phases/148-review-readiness-release-pipeline/148-03-SUMMARY.md`
- Verified task and follow-up commits `fae2cef`, `0070e40`, `16ab41a`, and `780af5a`

---
*Phase: 148-review-readiness-release-pipeline*
*Completed: 2026-03-28*
