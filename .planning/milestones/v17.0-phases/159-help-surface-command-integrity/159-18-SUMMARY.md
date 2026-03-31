---
phase: 159-help-surface-command-integrity
plan: 18
subsystem: runtime-help
tags:
  - plugin
  - runtime-guidance
  - inspect
  - command-integrity
requires:
  - phase: 159-13
    provides: Gap-closure verification evidence isolating the remaining runtime blocker slice
provides:
  - Canonical inspect-health diagnostics for runtime project-state failures
  - Inspect-first missing-plan fallback guidance when the active phase cannot be inferred
  - Direct runtime-tail regression coverage against shipped source files and the rebuilt plugin bundle
affects:
  - runtime-help
  - plugin
  - verification
tech-stack:
  added: []
  patterns:
    - Runtime fallback guidance should switch to /bgsd-inspect health or /bgsd-inspect progress when the exact planning command cannot be formed safely
    - Runtime integrity regressions should read real plugin source files plus plugin.js directly
key-files:
  created:
    - tests/guidance-command-integrity-runtime-tail.test.cjs
  modified:
    - src/plugin/context-builder.js
    - src/plugin/command-enricher.js
    - src/plugin/tools/bgsd-context.js
    - src/plugin/tools/bgsd-plan.js
    - src/plugin/notification.js
    - plugin.js
key-decisions:
  - "State-load failures now point to /bgsd-inspect health because the old /bgsd-health alias is stale on runtime surfaces."
  - "When phase context is unavailable, missing-plan guidance now stops at /bgsd-inspect progress instead of emitting a bare /bgsd-plan phase command."
patterns-established:
  - "Unavailable runtime context should degrade to inspect-first guidance rather than incomplete planning commands."
  - "DND notification summaries should be labeled informational when no replay command exists."
requirements-completed: [CMD-06]
one-liner: "Canonical inspect-health diagnostics and inspect-first runtime fallbacks in the shipped plugin bundle"
duration: 4min
completed: 2026-03-30
---

# Phase 159 Plan 18: Runtime help tail guidance cleanup Summary

**Canonical inspect-health diagnostics and inspect-first runtime fallbacks in the shipped plugin bundle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T04:20:00Z
- **Completed:** 2026-03-30T04:24:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Replaced stale runtime `/bgsd-health` diagnostics with canonical `/bgsd-inspect health` guidance across the plugin runtime sources and rebuilt bundle.
- Removed the bare `/bgsd-plan phase` fallback when no phase number is available and replaced it with inspect-first guidance through `/bgsd-inspect progress`.
- Added a focused runtime-tail regression that reads the real source files and rebuilt `plugin.js` directly to lock the remaining blocker patterns.

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct runtime fallback guidance at the source and in the shipped bundle** - `nwtnlnvv` (fix)
2. **Task 2: Lock the runtime-help slice with direct regression coverage** - `wlozynqz` (test)

**Plan metadata:** `sqtqszll` (docs)

## Files Created/Modified

- `src/plugin/context-builder.js` - Routes runtime project-state failures to `/bgsd-inspect health`
- `src/plugin/command-enricher.js` - Aligns enrichment failure guidance with canonical inspect diagnostics
- `src/plugin/tools/bgsd-context.js` - Uses phase-aware planning guidance only when the phase is known and falls back to `/bgsd-inspect progress` otherwise
- `src/plugin/tools/bgsd-plan.js` - Replaces stale roadmap parse diagnostics with `/bgsd-inspect health`
- `src/plugin/notification.js` - Removes the nonexistent DND replay command from notification summaries
- `plugin.js` - Rebuilt shipped runtime bundle with the corrected guidance strings
- `tests/guidance-command-integrity-runtime-tail.test.cjs` - Direct regression over the runtime blocker tail in source and bundle outputs

## Decisions Made

- Used `/bgsd-inspect health` as the canonical diagnostic fallback because the runtime issue is an inspection path, not a planning command.
- Treated the no-phase missing-plan branch as inspect-only guidance so users are not told to run an incomplete planning command.
- Marked DND summary notifications as informational when no replay command exists instead of advertising a nonexistent slash command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated plugin runtime source modules instead of `src/lib/constants.js`**
- **Found during:** Task 1 (Correct runtime fallback guidance at the source and in the shipped bundle)
- **Issue:** The remaining stale runtime strings named by verification were emitted from `src/plugin/*` modules, so changing `src/lib/constants.js` would not rebuild the shipped plugin guidance correctly.
- **Fix:** Patched the actual plugin runtime source modules, then rebuilt `plugin.js` so the shipped bundle matched the corrected source wording.
- **Files modified:** src/plugin/context-builder.js, src/plugin/command-enricher.js, src/plugin/tools/bgsd-context.js, src/plugin/tools/bgsd-plan.js, src/plugin/notification.js, plugin.js
- **Verification:** `npm run build && npm run test:file -- tests/guidance-command-integrity-runtime-tail.test.cjs`
- **Committed in:** `nwtnlnvv` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix stayed inside the intended runtime-help slice and was required to change the real shipped guidance source.

## Review Findings

Review skipped — reason: gap closure plan

## Issues Encountered

- The plan file named `src/lib/constants.js`, but the remaining stale runtime strings were actually emitted from the plugin runtime source modules that build `plugin.js`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shipped runtime bundle now avoids the remaining stale `/bgsd-health`, `/bgsd-notifications`, and bare `/bgsd-plan phase` guidance patterns cited by verification.
- Follow-on Phase 159 gap-closure plans can focus on the remaining workflow and skill surfaces without reopening this runtime blocker slice.

## Self-Check

PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-18-SUMMARY.md`
- Found task commit `nwtnlnvv`
- Found task commit `wlozynqz`

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
