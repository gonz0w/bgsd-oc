---
phase: 159-help-surface-command-integrity
plan: 20
subsystem: command-integrity
tags:
  - validator
  - commands
  - help-surface
  - workflows
  - runtime
requires:
  - phase: 159-14
    provides: Final workflow gap-closure cleanup on remaining user-facing command guidance
  - phase: 159-18
    provides: Runtime-tail cleanup proving the remaining validator failures are boundary-only
  - phase: 159-19
    provides: Final skill-tail cleanup on the cited verification blockers
provides:
  - Auditable reference-only exemptions for internal metadata, XML tags, workflow self-definition lines, and descriptive CLI prose
  - Repo-wide `util:validate-commands` proof that runnable guidance still fails while reference-only text stays clean
affects:
  - validator
  - workflows
  - skills
  - runtime
  - verification
tech-stack:
  added: []
  patterns:
    - Command validation should exempt only explicit metadata/reference contexts, not runnable prose
    - Repo-wide validator proof should rely on the real shipped surfaces plus focused contract tests
key-files:
  created: []
  modified:
    - src/lib/commandDiscovery.js
    - tests/validate-commands.test.cjs
key-decisions:
  - "Internal phase-handoff artifacts and XML-style bgsd wrapper tags are metadata, not runnable command guidance."
  - "Workflow self-definition lines, anti-pattern notes, compatibility-alias callouts, and descriptive bgsd-tools prose stay exempt only in explicit reference contexts."
patterns-established:
  - "Reference-only validator exemptions must be line-context aware and auditable."
  - "Runnable slash and CLI guidance remains strict even when nearby reference-only examples are allowed."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Final command-integrity boundary that keeps repo-wide validation strict on runnable guidance while exempting explicit reference-only metadata"
duration: 8 min
completed: 2026-03-30
---

# Phase 159 Plan 20: Final validator boundary Summary

**Final command-integrity boundary that keeps repo-wide validation strict on runnable guidance while exempting explicit reference-only metadata**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T04:27:14Z
- **Completed:** 2026-03-30T04:35:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Narrowed validator exemptions to explicit reference-only contexts such as internal handoff metadata, XML-style wrapper tags, workflow self-definition lines, anti-pattern notes, and compatibility-alias callouts.
- Kept runnable slash and CLI guidance strict by preserving missing-argument, missing-flag, legacy-alias, and nonexistent-command failures outside those metadata contexts.
- Added focused contract tests proving the final boundary and confirmed repo-wide `util:validate-commands` now succeeds as the final Phase 159 proof path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Align validator scope with the final cleaned guidance boundary** - `ykvvqltx` (fix)
2. **Task 2: Prove the final validator boundary with contract tests and repo validation** - `tqnrzkol` (test)

**Plan metadata:** `vuuxztkn` (docs)

## Files Created/Modified

- `src/lib/commandDiscovery.js` - Adds auditable reference-only heuristics for internal metadata, XML tags, workflow self-definition lines, anti-patterns, compatibility-alias notes, and descriptive CLI prose.
- `tests/validate-commands.test.cjs` - Extends the validator contract with final boundary coverage for internal tags, workflow metadata, and descriptive CLI prose while keeping runnable failures enforced.

## Decisions Made

- Excluded `.planning/phase-handoffs` from repo-wide surfaced validation because they are internal persisted artifacts, not current user-facing guidance.
- Treated XML-style `<bgsd-*>` tags, workflow self-definition usage lines, anti-pattern bullets, compatibility-alias notes, and command-string variable assignments as explicit reference-only contexts.
- Tightened CLI detection so descriptive prose about `bgsd-tools` no longer masquerades as a runnable command while real stale CLI examples still fail.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — reason: gap closure plan

## Issues Encountered

- The `execute:commit` helper refused to isolate task changes in the detached, dirty workspace, so task commits used path-scoped `jj commit` commands to preserve unrelated work while still keeping each task atomic.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Repo-wide `util:validate-commands` is now a trustworthy final proof path for the remaining Phase 159 validator-boundary blocker.
- The validator boundary stays broad over runnable guidance while keeping reference-only exemptions narrow and auditable for future help-surface work.

## Self-Check

PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-20-SUMMARY.md`
- Found task commit `ykvvqltx`
- Found task commit `tqnrzkol`

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
