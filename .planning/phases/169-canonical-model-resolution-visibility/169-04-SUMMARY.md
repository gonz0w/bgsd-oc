---
phase: 169-canonical-model-resolution-visibility
plan: 04
subsystem: core
tags: [javascript, sqlite, model-settings, plugin]
requires:
  - phase: 169-canonical-model-resolution-visibility
    provides: shared model-state visibility contract and provider-agnostic routing from plans 01 and 03
provides:
  - legacy planning and plugin cache model-profile APIs removed from live use
  - SQLite model_profiles reduced to an explicit compatibility-only boundary
  - regression proof that fresh migrations do not seed provider-tier model defaults
affects: [settings, init, plugin, sqlite-cache]
tech-stack:
  added: []
  patterns:
    - compatibility tables may remain on disk without exposing live selection APIs
    - plugin ESM surfaces should avoid importing broad CJS helper modules when a local config-backed presenter is sufficient
key-files:
  created: []
  modified:
    - src/lib/planning-cache.js
    - src/plugin/lib/db-cache.js
    - src/lib/db.js
    - src/plugin/command-enricher.js
    - tests/session-state.test.cjs
    - tests/infra.test.cjs
    - bin/bgsd-tools.cjs
    - plugin.js
    - bin/manifest.json
key-decisions:
  - "Removed planning and plugin cache model-profile helpers entirely because repo search showed no live callers and leaving them in place would preserve an alternate truth-shaped API."
  - "Kept the SQLite model_profiles table only as a compatibility boundary, but stopped seeding provider-tier defaults so fresh databases cannot resurrect legacy selection state."
  - "Moved plugin enrichment onto a local ESM-safe model-state presenter after runtime verification exposed that importing the CJS helpers bundle broke plugin.js loading."
patterns-established:
  - "Legacy persistence compatibility should be explicit, inert, and unadvertised on live resolution paths."
  - "Plugin runtime bundles should keep model-state presentation self-contained instead of depending on CLI-only helper modules."
requirements-completed: [MODEL-04]
one-liner: "Legacy cache model-profile APIs are gone, SQLite keeps only inert compatibility rows, and plugin/runtime checks prove canonical config remains the sole live model-selection truth."
duration: 9min
completed: 2026-03-31
---

# Phase 169 Plan 04: Remove or fence the remaining legacy model-profile persistence surfaces so canonical config stays the only live truth source. Summary

**Legacy cache model-profile APIs are gone, SQLite keeps only inert compatibility rows, and plugin/runtime checks prove canonical config remains the sole live model-selection truth.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T05:12:13Z
- **Completed:** 2026-03-31T05:21:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Removed the dead planning-cache and plugin-cache model-profile helpers so no live cache layer can masquerade as current model-selection truth.
- Reduced SQLite `model_profiles` to a compatibility-only table by stopping fresh default seeding while preserving historical rows and adding regression proof.
- Kept the rebuilt plugin runtime importable by replacing a blocking CJS helper dependency with an ESM-safe model-state presenter during verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove or fence dead model-profile cache APIs**
   - `f0dbbc8` — `refactor(169-04): remove legacy cache model-profile APIs`
2. **Task 2: Preserve only the SQLite compatibility boundary needed after cleanup**
   - `c84f54f` — `fix(169-04): fence sqlite model-profile compatibility boundary`

**Plan metadata:** `prnrsutt` (docs: complete plan)

## Files Created/Modified

- `src/lib/planning-cache.js` - Removes the legacy model-profile read/write helpers from the planning cache live path.
- `src/plugin/lib/db-cache.js` - Removes plugin-side model-profile helpers and labels the table as compatibility-only.
- `src/lib/db.js` - Keeps the compatibility table migration but stops seeding legacy provider-tier defaults.
- `src/plugin/command-enricher.js` - Adds an ESM-safe model-state presenter used during plugin/runtime verification.
- `tests/session-state.test.cjs` - Proves fresh migrations leave `model_profiles` empty while preserving existing compatibility rows.
- `tests/infra.test.cjs` - Updates config migration expectations around canonical `model_settings` plus preserved legacy keys.
- `bin/bgsd-tools.cjs` - Rebuilt CLI bundle with the compatibility-boundary cleanup.
- `plugin.js` - Rebuilt plugin bundle after the ESM-safe model-state presenter fix.
- `bin/manifest.json` - Refreshed build manifest for rebuilt runtime artifacts.

## Decisions Made

- Removed the dead cache helper methods instead of leaving deprecated wrappers because repo-wide caller search showed no live consumers and deletion best prevents future accidental reuse.
- Kept `model_profiles` schema creation for migration compatibility, but removed automatic default seeding so fresh environments no longer advertise provider-tier model choices as active behavior.
- Fixed the plugin import blocker inline because runtime verification is part of this plan's proof path and the ESM bundle must stay loadable after touched runtime rebuilds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced plugin CJS helper import with an ESM-safe model-state presenter**
- **Found during:** Task 2 (Preserve only the SQLite compatibility boundary needed after cleanup)
- **Issue:** `tests/infra.test.cjs` failed because rebuilt `plugin.js` imported `src/lib/helpers.js`, which pulls `crypto` through a CJS wrapper that is not safe for the ESM plugin bundle.
- **Fix:** Moved the small configured/resolved model-state calculation used by `src/plugin/command-enricher.js` into a local ESM-safe helper block and rebuilt runtime artifacts.
- **Files modified:** `src/plugin/command-enricher.js`, `plugin.js`, `bin/bgsd-tools.cjs`, `bin/manifest.json`
- **Verification:** `npm run build` and `npm run test:file -- tests/session-state.test.cjs tests/infra.test.cjs`
- **Committed in:** `c84f54f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The auto-fix kept verification and runtime parity intact without widening the model-selection cleanup scope.

## Issues Encountered

- Final focused verification initially failed in the ESM plugin import check; rebuilding after moving command enrichment off the CJS helpers resolved the issue and kept runtime artifacts valid.

## Next Phase Readiness

- Canonical config is now the only remaining live model-selection source across cache, plugin, and SQLite compatibility boundaries.
- Future work can remove the legacy `model_profiles` table entirely once migration/back-compat support is no longer required.

## Self-Check: PASSED

- Found `.planning/phases/169-canonical-model-resolution-visibility/169-04-SUMMARY.md`
- Verified task commits `f0dbbc81` and `c84f54f8` in `jj log`

---
*Phase: 169-canonical-model-resolution-visibility*
*Completed: 2026-03-31*
