---
phase: 158-canonical-command-families
plan: 05
subsystem: commands
tags: [markdown, javascript, commonjs]
provides:
  - Canonical `/bgsd-settings` family routing for settings, profile switching, and config validation
  - Runtime enricher metadata parity for canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings`
  - Focused regression coverage for settings aliases and touched canonical help/reference surfaces
affects:
  - phase-159-help-surface-command-integrity
  - phase-158-follow-on-command-family-slices
tech-stack:
  added: []
  patterns:
    - Canonical settings family wrapper with thin compatibility shims for legacy settings entrypoints
    - Canonical-family parity tests that validate bundled enricher metadata plus touched help/reference wording
key-files:
  created:
    - plugin.js
    - src/plugin/command-enricher.js
    - tests/contracts.test.cjs
    - tests/enricher.test.cjs
    - tests/workflow.test.cjs
  modified:
    - workflows/help.md
    - docs/commands.md
    - commands/bgsd-settings.md
key-decisions:
  - Keep `/bgsd-settings` separate from planning and inspect so profile switching and config validation stay in one bounded settings family
  - Prefer canonical family names only on directly touched help/reference surfaces, leaving the broader command-reference audit for Phase 159
patterns-established:
  - "Settings-family routing: canonical `/bgsd-settings` owns sub-actions while `/bgsd-set-profile` and `/bgsd-validate-config` stay compatibility-only"
  - "Bundled enricher parity: canonical family metadata changes must be validated against `plugin.js`, not just source modules"
requirements-completed: [CMD-02, CMD-03]
one-liner: "Canonical `/bgsd-settings` now owns profile switching and config validation while runtime metadata and touched help surfaces prefer the new command families"
duration: 28min
completed: 2026-03-29
---

# Phase 158 Plan 05: Keep settings as its own canonical family and update the directly affected runtime/help surfaces once the planning and inspect families are in place. Summary

**Canonical `/bgsd-settings` now owns profile switching and config validation while runtime metadata and touched help surfaces prefer the new command families**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-29 15:58:13 -0600
- **Completed:** 2026-03-29 16:26:34 -0600
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Promoted `commands/bgsd-settings.md` into a real canonical settings-family contract and converted `bgsd-set-profile` plus `bgsd-validate-config` into compatibility-only shims.
- Added canonical runtime enricher routing for `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` so the new family names inherit the same agent metadata path as their legacy surfaces.
- Updated `workflows/help.md` and `docs/commands.md` only where they directly contradicted the Phase 158 family map, then locked the changes with focused parity tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route settings aliases through a separate canonical settings family** - `402199f` (feat)
2. **Task 2: Update runtime metadata and only the directly contradicted guidance surfaces** - `f1dabf8` (feat)
3. **Task 3: Add parity regressions for settings and canonical runtime metadata** - `186f3bb` (test)

## Files Created/Modified

- `commands/bgsd-set-profile.md` [+8/-4]
- `commands/bgsd-settings.md` [+21/-4]
- `commands/bgsd-validate-config.md` [+8/-4]
- `docs/commands.md` [+24/-4]
- `plugin.js` [+5/-0]
- `src/plugin/command-enricher.js` [+5/-0]
- `tests/contracts.test.cjs` [+32/-0]
- `tests/enricher.test.cjs` [+37/-0]
- `tests/workflow.test.cjs` [+32/-0]
- `workflows/help.md` [+29/-29]

## Decisions Made

- Kept `/bgsd-settings` as a dedicated canonical family so settings work does not blur back into planning or inspect boundaries.
- Limited help/reference updates to directly touched contradictions in `workflows/help.md` and `docs/commands.md` so Phase 158 stays out of Phase 159's broader audit scope.
- Added bundled-plugin coverage in the parity suite because enricher behavior is exercised through `plugin.js`, not only `src/plugin/command-enricher.js`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt the bundled plugin after updating canonical enricher metadata**
- **Found during:** Task 3 (Add parity regressions for settings and canonical runtime metadata)
- **Issue:** `tests/enricher.test.cjs` imports `plugin.js`, so source-only changes in `src/plugin/command-enricher.js` left the bundled runtime stale and the new canonical metadata absent.
- **Fix:** Ran `npm run build` and committed the regenerated `plugin.js` bundle with the new parity tests.
- **Files modified:** `plugin.js`
- **Verification:** `npm run test:file -- tests/enricher.test.cjs tests/workflow.test.cjs tests/contracts.test.cjs`
- **Committed in:** `186f3bb` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The rebuild was required to ship the runtime metadata change that Task 2 introduced. No scope creep beyond keeping the bundled artifact honest.

## Issues Encountered

- `node bin/bgsd-tools.cjs verify:references ...` is not available in the current CLI build, so final verification relied on the focused command/help parity suite plus the touched-surface contract assertions added in Task 3.

## Next Phase Readiness

- The settings family now matches the canonical family map at the wrapper, runtime metadata, and touched help/reference layers.
- Phase 159 can concentrate on broader help/reference integrity cleanup without reopening settings-family routing or canonical metadata parity.

## Self-Check

PASSED

- Found expected files: `commands/bgsd-settings.md`, `src/plugin/command-enricher.js`, `tests/enricher.test.cjs`, `.planning/phases/158-canonical-command-families/158-05-SUMMARY.md`
- Verified task commits exist: `402199fc`, `f1dabf86`, `186f3bb0`

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
