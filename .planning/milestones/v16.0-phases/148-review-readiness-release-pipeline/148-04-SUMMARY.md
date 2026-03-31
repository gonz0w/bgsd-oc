---
phase: 148-review-readiness-release-pipeline
plan: 04
subsystem: release
tags: [release, workflow, bootstrap, resume, github-ci]
requires:
  - phase: 148-review-readiness-release-pipeline
    provides: dry-run release analysis, resumable mutation helpers, and github-ci compatible PR metadata from Plans 01-03
provides:
  - init:release bootstrap metadata for model selection, active phase context, release command names, and persisted release-state paths
  - /bgsd-release slash-command wrapper over a dedicated release workflow
  - dry-run-first release orchestration with one explicit confirmation gate and persisted resume guidance
  - workflow contract coverage for release bootstrap, ordering, confirmation scope, and github-ci handoff
affects: [workflows/github-ci.md, /bgsd-release, .planning/release-state.json]
tech-stack:
  added: []
  patterns: [CLI-bootstrapped slash workflows, single-confirmation dry-run release UX, persisted next-safe-step handoff]
key-files:
  created:
    - commands/bgsd-release.md
    - workflows/release.md
    - tests/release-workflow.test.cjs
  modified:
    - src/commands/init.js
    - src/router.js
    - bin/bgsd-tools.cjs
key-decisions:
  - "`/bgsd-release` bootstraps through `init:release` so workflow metadata and resume paths come from CLI state instead of markdown assumptions."
  - "The release workflow stays dry-run-first and uses exactly one explicit confirmation gate before `release:tag` or `release:pr`."
  - "Successful release PRs hand off to the existing `/bgsd-github-ci` contract while blocked runs surface persisted next-safe-step guidance from `.planning/release-state.json`."
patterns-established:
  - "Slash-command workflow wrappers stay thin: wrapper launches workflow, init command supplies deterministic bootstrap context."
  - "Release orchestration documents resume and github-ci handoff behavior in workflow contract tests so later edits cannot reintroduce prompt-space release choreography."
requirements-completed: [REL-04]
one-liner: "Release slash workflow with init bootstrap, one dry-run confirmation gate, and github-ci/resume guidance over persisted release state"
duration: 5min
completed: 2026-03-28
---

# Phase 148 Plan 04: Deliver `/bgsd-release` as the single-command workflow entrypoint for Phase 148. Summary

**Release slash workflow with init bootstrap, one dry-run confirmation gate, and github-ci/resume guidance over persisted release state**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28 17:21:59 -0600
- **Completed:** 2026-03-28 17:27:02 -0600
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `init:release` bootstrap support plus a thin `/bgsd-release` wrapper so the release workflow now resolves models, active phase info, command names, and `.planning/release-state.json` from CLI context.
- Authored `workflows/release.md` as the dry-run-first release orchestration with one explicit confirmation gate, narrowly scoped preview essentials, resume guidance, and explicit `/bgsd-github-ci` handoff.
- Added workflow contract tests that lock bootstrap wiring, command ordering, single-confirmation behavior, github-ci reuse, and persisted release-state guidance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add release workflow bootstrap support and slash-command wrapper** - `7c34407` (feat)
2. **Task 2: Implement the dry-run-first release workflow with one confirmation gate and resume guidance** - `4f75899` (feat)
3. **Task 3: Add workflow contract tests for bootstrap, confirmation order, and resume behavior** - `bdaa40e` (test)

**Plan metadata:** Pending final docs commit

## Files Created/Modified

- `src/commands/init.js` - Adds `buildReleaseInitResult()` and `cmdInitRelease()` so release workflows bootstrap from CLI-provided models, phase metadata, command names, and release-state paths.
- `src/router.js` - Routes `init:release` through the init namespace so the workflow fallback path is executable.
- `commands/bgsd-release.md` - Thin slash-command wrapper that launches the release workflow.
- `workflows/release.md` - Documents the dry-run preview, single confirmation gate, mutation sequencing, resume guidance, and github-ci handoff contract.
- `tests/release-workflow.test.cjs` - Verifies wrapper wiring, init bootstrap, preview ordering, single confirmation, release-state resume guidance, and github-ci reuse.
- `bin/bgsd-tools.cjs` - Rebuilt bundled CLI artifact including `init:release` support.

## Decisions Made

- Added a dedicated `init:release` bootstrap contract so `/bgsd-release` follows the same CLI-first workflow pattern established by `/bgsd-review` and `/bgsd-security`.
- Kept the workflow preview constrained to release essentials only, preserving one meaningful confirmation without layering on hidden readiness gates.
- Directed successful PR completion into `/bgsd-github-ci` and preserved blocked-run recovery through persisted next-safe-step guidance instead of inventing a parallel release CI path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository still has unrelated dirty/untracked files, so task commits were created with explicit file-scoped Git staging to avoid scooping unrelated `.planning/`, `docs/`, `templates/`, `workflows/`, and `src/lib/questions.js` changes.
- The required full regression gate (`npm test`) still reports pre-existing failures outside this plan in `tests/cli-tools-integration.test.cjs`, `tests/trajectory.test.cjs`, and `tests/worktree.test.cjs`; the release-specific verification passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 148 now has the full release entrypoint: deterministic bootstrap, slash wrapper, dry-run confirmation flow, and github-ci-aligned handoff guidance are all in place.
- The broad regression suite still has unrelated pre-existing failures to address separately before claiming milestone-wide green CI.

## Self-Check: PASSED

- Found `.planning/phases/148-review-readiness-release-pipeline/148-04-SUMMARY.md`
- Verified task commits `7c34407`, `4f75899`, and `bdaa40e`
