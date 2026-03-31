---
phase: 159-help-surface-command-integrity
plan: 06
subsystem: runtime
tags: [commands, templates, plugin, validation, guidance]

# Dependency graph
requires:
  - phase: 159-02
    provides: validator-backed command integrity checks and canonical help semantics
provides:
  - Canonical template examples with concrete planning-family arguments for known flows
  - Phase-aware runtime missing-plan guidance in plugin source and bundle output
  - Focused regression coverage locking template/runtime canonical wording and source-bundle parity
affects: [templates, plugin, command-guidance, validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Concrete phase arguments on known planning-family examples
    - Source-plus-bundle parity checks for runtime command guidance

key-files:
  created:
    - tests/guidance-command-integrity-templates-runtime.test.cjs
  modified:
    - templates/discovery.md
    - templates/UAT.md
    - templates/research.md
    - templates/assertions.md
    - src/plugin/tools/bgsd-context.js
    - plugin.js

key-decisions:
  - "Known planning flows should surface canonical commands with concrete phase arguments instead of alias names or argument-free examples."
  - "Missing-plan runtime guidance should derive the current phase-aware `/bgsd-plan phase` command and stay locked to the shipped bundle with focused parity tests."

patterns-established:
  - "Template guidance uses canonical `/bgsd-plan` subcommands with concrete example arguments when the flow shape is known."
  - "Runtime command wording changes require an immediate plugin rebuild plus source/bundle regression coverage."

requirements-completed: [CMD-05, CMD-06]
one-liner: "Canonical planning-family examples now cover the remaining templates and plugin runtime guidance, including phase-aware missing-plan messaging locked to the rebuilt bundle."

# Metrics
duration: 1 min
completed: 2026-03-30
---

# Phase 159 Plan 06: Help Surface & Command Integrity Summary

**Canonical planning-family examples now cover the remaining templates and plugin runtime guidance, including phase-aware missing-plan messaging locked to the rebuilt bundle.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-30T01:36:04Z
- **Completed:** 2026-03-30T01:37:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced legacy template guidance with canonical `/bgsd-plan` examples that include concrete phase arguments on known flows.
- Updated runtime missing-plan messaging to suggest `/bgsd-plan phase ${phaseNumber}` when the current phase is known.
- Added focused regression coverage that locks template guidance, runtime wording, and plugin bundle parity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonicalize template guidance surfaces** - `4cc32e98` (docs)
2. **Task 2: Align runtime notices, rebuild the plugin bundle, and lock parity** - `d16d4d34` (fix)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `templates/discovery.md` - Swaps legacy research guidance for canonical `/bgsd-plan research 12` examples.
- `templates/UAT.md` - Rewrites gap-closure guidance to canonical `/bgsd-plan gaps 12` examples.
- `templates/research.md` - Rewrites context provenance guidance to canonical `/bgsd-plan discuss 12` wording.
- `templates/assertions.md` - Rewrites planner flow guidance to canonical `/bgsd-plan phase 12` wording.
- `src/plugin/tools/bgsd-context.js` - Makes missing-plan guidance phase-aware when the current phase number is available.
- `plugin.js` - Rebuilt shipped plugin bundle so runtime wording matches source changes.
- `tests/guidance-command-integrity-templates-runtime.test.cjs` - Locks template/runtime canonical wording and bundle parity.

## Decisions Made
- Use concrete phase examples (`12`) on generic templates so users see the required planning-family argument shape immediately.
- Keep runtime missing-plan guidance dynamic: when a current phase is known, point users at `/bgsd-plan phase ${phaseNumber}` rather than an argument-free command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seeded the focused regression file during Task 1 so the declared verify command existed**
- **Found during:** Task 1 (Canonicalize template guidance surfaces)
- **Issue:** The plan's Task 1 verify command targeted `tests/guidance-command-integrity-templates-runtime.test.cjs`, but that file did not exist yet.
- **Fix:** Created the focused regression file with template assertions during Task 1, then expanded it in Task 2 for runtime and bundle parity coverage.
- **Files modified:** `tests/guidance-command-integrity-templates-runtime.test.cjs`
- **Verification:** `npm run test:file -- tests/guidance-command-integrity-templates-runtime.test.cjs`
- **Committed in:** `4cc32e98` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Narrow sequencing fix only; it enabled the plan's declared verification flow without expanding scope beyond the planned regression coverage.

## Issues Encountered
- `util:validate-commands --raw` still emits an `@file:` indirection path in this environment, so verification relied on successful command execution rather than inline JSON inspection.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The remaining template and runtime guidance surfaces now teach canonical planning-family commands with executable examples.
- Focused regressions protect both the source wording and the rebuilt `plugin.js` bundle from drifting apart on these surfaces.

## Self-Check: PASSED

- Found `.planning/phases/159-help-surface-command-integrity/159-06-SUMMARY.md`.
- Found task change ids `pkrlxmmp` and `ppvqnxzr` in `jj log`.
