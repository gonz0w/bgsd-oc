---
phase: 64-command-workflow-cleanup
plan: 01
subsystem: cli
tags: [router, namespace, commands, cleanup]

# Dependency graph
requires:
  - phase: 62-dead-code-audit
    provides: command audit identifying 281 commands (namespaced + legacy forms)
provides:
  - Namespace-only CLI routing — all commands use namespace:command syntax
  - 20 previously flat-only commands migrated to namespace routes
  - ~890 lines of backward-compat flat routing removed
  - bgsd-join-discord command fully removed
affects: [64-02, tests, workflows, commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [namespace-only routing]

key-files:
  created: []
  modified:
    - src/router.js
    - build.js
    - bin/gsd-tools.cjs

key-decisions:
  - "Semantic duplicate codebase-impact (features.js version) removed with flat block — util:codebase impact (codebase.js) is the canonical route"
  - "build.js smoke test migrated to util:current-timestamp namespace form"
  - "Test failures from flat-form removal deferred to Plan 02 for systematic migration"

patterns-established:
  - "All CLI commands routed exclusively through namespace:command syntax"

requirements-completed: [CMD-01, CMD-03, CMD-04]

# Metrics
duration: 29min
completed: 2026-03-07
---

# Phase 64 Plan 01: Namespace Routing Migration Summary

**Migrated 20 flat-only commands to namespace routes and removed ~890-line backward-compat flat switch block from router.js**

## Performance

- **Duration:** 29 min
- **Started:** 2026-03-07T13:48:54Z
- **Completed:** 2026-03-07T14:18:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added namespace routes for 20 commands that only existed in the flat backward-compat switch block
- Removed the entire ~890-line backward-compat flat switch block (router.js: 1642→928 lines)
- Deleted bgsd-join-discord.md slash command wrapper
- Bundle size reduced from 1221KB to 1186KB (35KB savings)
- Resolved semantic duplicate: codebase-impact (features.js) removed with flat block; util:codebase impact (codebase.js) is canonical

## Task Commits

Each task was committed atomically:

1. **Task 1: Add namespace routes for flat-only commands** - `dbd2fea` (feat)
2. **Task 2: Remove backward-compat switch block and stale slash command** - `35eaeaf` (feat)

## Files Created/Modified
- `src/router.js` - Namespace-only routing, flat block removed (1642→928 lines)
- `build.js` - Smoke test updated to use util:current-timestamp
- `bin/gsd-tools.cjs` - Rebuilt bundle (1221KB→1186KB)
- `bin/manifest.json` - Updated build manifest
- `commands/bgsd-join-discord.md` - Deleted

## Decisions Made
- Semantic duplicate `codebase-impact` (features.js version) removed with flat block — `util:codebase impact` (codebase.js) is the canonical route per plan
- build.js smoke test migrated from flat `current-timestamp` to `util:current-timestamp`
- Test failures from flat-form removal are expected and deferred to Plan 02 (376 pass / 386 fail baseline)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated build.js smoke test to use namespace form**
- **Found during:** Task 2 (Remove backward-compat block)
- **Issue:** build.js smoke test used flat-form `current-timestamp` which now returns "Unknown command"
- **Fix:** Changed to `util:current-timestamp` namespace form
- **Files modified:** build.js
- **Verification:** `npm run build` succeeds with smoke test passing
- **Committed in:** 35eaeaf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for build to succeed. No scope creep.

## Issues Encountered
- Test suite shows 386 failures (376 pass) — all from flat-form command removal as expected. These will be migrated to namespace form in Plan 02.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All namespace routes working — verified with sample commands
- Plan 02 needs to: migrate test suite to namespace forms, update workflow/command .md references, clean up help output
- Test baseline captured: 376 pass / 386 fail (flat-form failures only)

---
*Phase: 64-command-workflow-cleanup*
*Completed: 2026-03-07*
