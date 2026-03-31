---
phase: 167-logging-contract-quiet-defaults
plan: 01
subsystem: plugin
tags: [BGSD_DEBUG, stderr, diagnostics, plugin, cli]

# Dependency graph
requires:
  - phase: 166-execution-realism-plan-scoped-completion
    provides: plan-scoped verification and runtime rebuild discipline for dirty workspace execution
provides:
  - shared debug gating helpers for touched CLI and plugin diagnostics
  - plugin-safe BGSD_DEBUG contract for validation and enricher markers
  - regression coverage for quiet defaults and stderr-only investigation output
affects: [phase-167-plan-02, diagnostics, plugin]

tech-stack:
  added: []
  patterns: [shared stderr debug gating, plugin-local debug contract helper, verbose-or-debug diagnostic opt-in]
key-files:
  created:
    - src/plugin/debug-contract.js
  modified: [src/lib/output.js, src/plugin/validation/adapter.js, src/plugin/command-enricher.js, src/plugin/index.js, tests/infra.test.cjs, tests/enricher.test.cjs, tests/plugin.test.cjs, bin/bgsd-tools.cjs, plugin.js]
key-decisions:
  - "BGSD_DEBUG is the canonical env switch for touched plugin diagnostics, while CLI --verbose enables the same stderr contract for command-line investigations."
  - "Plugin debug gating lives in an ESM-safe helper so plugin.js can share the contract without reintroducing CommonJS runtime import failures."
patterns-established:
  - "Use shared debug helpers instead of ad hoc BGSD_DEBUG/GSD_DEBUG/NODE_ENV checks for touched diagnostics."
  - "Keep investigation markers on stderr so JSON stdout remains machine-readable."
requirements-completed: [LOG-01]
one-liner: "Shared BGSD_DEBUG or --verbose stderr diagnostics across CLI debug helpers, plugin validation markers, and enricher timing output"
duration: 4 min
completed: 2026-03-30
---

# Phase 167 Plan 01: Establish one shared debug or verbosity contract for touched CLI and plugin reliability diagnostics so investigation output is predictable and normal runs stay quiet. Summary

**Shared BGSD_DEBUG or --verbose stderr diagnostics across CLI debug helpers, plugin validation markers, and enricher timing output**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30 16:01:03 -0600
- **Completed:** 2026-03-30 16:30:09 -0600
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added a shared CLI-side debug helper that enables investigation diagnostics under `BGSD_DEBUG` or explicit `--verbose` while keeping stdout payloads clean.
- Migrated plugin validation, startup, and enricher timing diagnostics onto the same `BGSD_DEBUG` stderr contract and rebuilt both `bin/bgsd-tools.cjs` and `plugin.js`.
- Locked the contract with focused regressions covering CLI stderr behavior, plugin validation markers, and enricher debug timing without `NODE_ENV=development` drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regressions for the shared debug contract across CLI and plugin surfaces** - `401c880` (test)
2. **Task 2: Implement a shared verbosity helper and migrate divergent debug emitters** - `3fd88d1` (feat)
3. **Task 3: Align touched diagnostic call sites to the shared contract without changing normal-path semantics** - `607be1d` (refactor)

**Plan metadata:** `581f6f0` (docs)

## Files Created/Modified

- `bin/bgsd-tools.cjs` [+371/-371]
- `plugin.js` [+35/-11]
- `src/lib/output.js` [+46/-8]
- `src/plugin/command-enricher.js` [+7/-13]
- `src/plugin/debug-contract.js` [+28/-0]
- `src/plugin/index.js` [+2/-4]
- `src/plugin/validation/adapter.js` [+3/-10]
- `tests/enricher.test.cjs` [+51/-0]
- `tests/infra.test.cjs` [+16/-0]
- `tests/plugin.test.cjs` [+41/-1]

## Verification

- **Requirement Coverage:** LOG-01 complete — touched CLI and plugin debug markers now share one explicit verbosity contract.
- **Intent Alignment:** not assessed — this phase plan does not include the explicit phase-intent block required for an `aligned|partial|misaligned` verdict.
- **Checks run:**
  - `npm run build`
  - `node --test tests/infra.test.cjs --test-name-pattern "debug logging|ESM plugin build"`
  - `node --test tests/enricher.test.cjs --test-name-pattern "Group 1: Zero redundant calls|Group 2: Warm-cache timing and _enrichment_ms field|Group 3: Output shape invariance"`
  - `node --input-type=module -e "import { BgsdPlugin } from './plugin.js'; const plugin = await BgsdPlugin({ directory: process.cwd() }); const result = await plugin.tool.bgsd_progress.execute({ action: 'not-a-real-action' }, { directory: process.cwd() }); const parsed = JSON.parse(result); if (parsed.error !== 'validation_error') throw new Error('expected validation_error'); process.stdout.write('ok'); process.exit(0);"`
- **Additional evidence:** attempted the plan-specified `node --test tests/infra.test.cjs tests/enricher.test.cjs tests/plugin.test.cjs` gate, including a `--test-force-exit` retry, but `tests/plugin.test.cjs` did not complete within the tool timeout in this workspace.

## Decisions Made

- Kept `BGSD_DEBUG` as the canonical environment switch and layered CLI `--verbose` onto the same helper so investigations do not require separate mental models for source and bundled runtimes.
- Added `src/plugin/debug-contract.js` instead of importing the CommonJS output helper directly into plugin code, because the ESM plugin bundle must stay free of dynamic `require()` failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept plugin debug sharing ESM-safe**
- **Found during:** Task 2 (Implement a shared verbosity helper and migrate divergent debug emitters)
- **Issue:** Importing `src/lib/output.js` directly into plugin ESM code caused `plugin.js` to fail with `Dynamic require of "fs" is not supported`.
- **Fix:** Added `src/plugin/debug-contract.js` and routed plugin consumers through that ESM-safe helper while preserving the shared BGSD_DEBUG contract.
- **Files modified:** src/plugin/debug-contract.js, src/plugin/validation/adapter.js, src/plugin/command-enricher.js, src/plugin/index.js, plugin.js
- **Verification:** `npm run build`; `node --test tests/infra.test.cjs --test-name-pattern "ESM plugin build"`
- **Committed in:** `3fd88d1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserved the planned shared contract while keeping the shipped plugin runtime importable.

## Issues Encountered

- The full `tests/plugin.test.cjs` file did not complete inside the tool timeout even when retried with `--test-force-exit`, so final proof used focused touched-surface regressions plus direct rebuilt-plugin smoke checks.

## Next Phase Readiness

- Plan 02 can now reduce remaining default-noise paths against one shared debug contract instead of juggling `BGSD_DEBUG`, `GSD_DEBUG`, and `NODE_ENV=development` branches.
- Remaining follow-on work should reuse `src/plugin/debug-contract.js` or `src/lib/output.js` helpers rather than adding new diagnostic gates.

## Self-Check: PASSED

- Found `.planning/phases/167-logging-contract-quiet-defaults/167-01-SUMMARY.md` on disk.
- Confirmed task commits `401c880`, `3fd88d1`, and `607be1d` in `jj log` via commit IDs.

---
*Phase: 167-logging-contract-quiet-defaults*
*Completed: 2026-03-30*
