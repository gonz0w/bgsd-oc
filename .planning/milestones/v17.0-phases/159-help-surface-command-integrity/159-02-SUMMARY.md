---
phase: 159-help-surface-command-integrity
plan: 02
subsystem: cli
tags: [commands, validation, guidance, inventory, tests]
requires:
  - phase: 158-canonical-command-families
    provides: canonical command wrappers and compatibility alias contracts
provides:
  - inventory-backed surfaced command integrity validation
  - grouped `util:validate-commands` reporting with failing exit codes
  - focused regression coverage for legacy aliases and missing arguments or flags
affects: [docs, workflows, agents, skills, templates, phase-handoffs]
tech-stack:
  added: []
  patterns: [manifest-backed slash inventory scanning, grouped semantic command issue reporting]
key-files:
  created: [tests/validate-commands.test.cjs]
  modified: [src/lib/commandDiscovery.js, src/commands/misc.js, bin/bgsd-tools.cjs]
key-decisions:
  - derive surfaced slash-command alias metadata from shipped command wrappers instead of maintaining a second allowlist
  - validate gap and argument correctness as semantic guidance rules so the validator catches executable-shape mistakes, not only missing commands
patterns-established:
  - "Surfaced command validation scans active user-facing files instead of registry metadata alone."
  - "Validator output groups actionable issues by surfaced file so cleanup plans can repair many references per run."
requirements-completed: [CMD-05, CMD-06]
one-liner: "Inventory-backed command guidance validator with grouped surfaced issue reporting and semantic gap and argument checks"
duration: 10min
completed: 2026-03-30
---

# Phase 159 Plan 02: Build the command-integrity gate for shipped inventories, canonical guidance, and parameter-correct next-step examples Summary

**Inventory-backed command guidance validator with grouped surfaced issue reporting and semantic gap and argument checks**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T01:17:37Z
- **Completed:** 2026-03-30T01:28:02Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Expanded `src/lib/commandDiscovery.js` from registry alignment checks into a surfaced-guidance validator that scans active docs, workflows, agents, skills, templates, runtime text, and handoff artifacts against shipped command inventories.
- Strengthened `util:validate-commands` so the CLI returns grouped actionable issue data and exits non-zero when surfaced guidance contains legacy aliases, nonexistent commands, or semantic command-shape mistakes.
- Added focused regression tests that lock grouped reporting, legacy-command detection, missing phase/profile arguments, gap-flow command selection, and `--gaps-only` enforcement.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand command discovery into an inventory-backed integrity validator** - `395cff9` (feat)
2. **Task 2: Strengthen the `util:validate-commands` CLI contract** - `fb4731e` (feat)
3. **Task 3: Add focused contract tests for validator behavior** - `4c1463a` (test)

## Files Created/Modified

- `src/lib/commandDiscovery.js` - Adds shipped-inventory discovery, surfaced file scanning, semantic command checks, and grouped integrity reports.
- `src/commands/misc.js` - Routes `util:validate-commands` through the new integrity validator and returns grouped failing output.
- `tests/validate-commands.test.cjs` - Covers direct validator behavior and CLI non-zero failure behavior with fixture repos.
- `bin/bgsd-tools.cjs` - Rebuilt bundled CLI so the shipped binary exposes the new validator behavior.

## Decisions Made

- Derived alias metadata from shipped `commands/*.md` wrappers so canonical-versus-legacy validation follows the deployed command surface instead of a hand-maintained mirror list.
- Kept semantic validation focused on runnable guidance rules the phase cares about now: canonical-only commands, required phase/profile arguments, gap-planning subcommands, and `--gaps-only` execution examples.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Requirement completion helper missed CMD-05 and CMD-06**
- **Found during:** Plan finalization
- **Issue:** `plan:requirements mark-complete CMD-05 CMD-06` returned `not_found` even though both requirements exist in `.planning/REQUIREMENTS.md`.
- **Fix:** Updated `.planning/REQUIREMENTS.md` directly so the requirement checklist and traceability matrix match the completed validator plan.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Confirmed `CMD-05` and `CMD-06` are checked in the requirements list and marked `Complete` in the traceability matrix.
- **Committed in:** plan metadata commit

**2. [Rule 3 - Blocking] State metric helpers left duplicate Phase 159 P02 rows and stale totals**
- **Found during:** Plan finalization
- **Issue:** The state finalization commands advanced the plan correctly, but `STATE.md` still showed pre-plan totals and duplicated the `Phase 159 P02` metrics row.
- **Fix:** Updated `STATE.md` directly so plan totals, phase averages, and the metrics table reflect one completed Phase 159 P02 entry.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Confirmed `Current Plan` advanced to `3`, the Phase 159 summary row shows `2 | 2 | 6.0 min`, and the duplicate metrics row was removed.
- **Committed in:** plan metadata commit

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No product-scope change. The workarounds kept planning metadata aligned after finalization-tool mismatches.

## Issues Encountered

- Running the validator on the current repo now reports `1230` issues across `99` surfaced files. This is expected for Plan 02 because the new gate is surfacing the backlog that later Phase 159 plans will repair.
- `plan:requirements mark-complete CMD-05 CMD-06` reported `not_found` despite both requirements being present in `.planning/REQUIREMENTS.md`; the requirement state was recorded manually so plan metadata stayed accurate.
- The state finalization helpers left duplicate Phase 159 P02 metrics and stale totals, so `STATE.md` was corrected manually after the automated updates completed.

## Next Phase Readiness

- Phase 159 now has one auditable command-integrity gate that can be used to drive the remaining docs, workflow, agent, skill, template, and runtime cleanup plans.
- Focused regression coverage is in place for validator behavior, so follow-on plans can sweep surfaced content without weakening the integrity rules.

## Self-Check: PASSED

- FOUND: `.planning/phases/159-help-surface-command-integrity/159-02-SUMMARY.md`
- FOUND: `395cff94` task commit for the inventory-backed validator core
- FOUND: `fb4731ed` task commit for the CLI integrity contract
- FOUND: `4c1463a0` task commit for validator regression coverage

---
*Phase: 159-help-surface-command-integrity*
*Completed: 2026-03-30*
