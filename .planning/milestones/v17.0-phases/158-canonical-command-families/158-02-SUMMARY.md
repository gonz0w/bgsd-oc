---
phase: 158-canonical-command-families
plan: 02
subsystem: commands
tags: [commands, markdown, aliases, workflow-routing, planning]
requires:
  - phase: 157-planning-context-cascade
    provides: compact planning context and canonical workflow contracts that the new planning family reuses
provides:
  - Canonical `/bgsd-plan` sub-action contract for phase planning and planning-prep flows
  - Compatibility-only planning aliases that route through shared canonical behavior
  - Targeted parity tests for canonical versus legacy planning-family entrypoints
affects:
  - phase-158-follow-on-plans
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Canonical family commands normalize sub-actions onto existing workflow contracts
    - Legacy wrappers become compatibility shims that point back to the canonical command file
key-files:
  created: []
  modified:
    - commands/bgsd-plan.md
    - workflows/plan-phase.md
    - commands/bgsd-plan-phase.md
    - commands/bgsd-discuss-phase.md
    - commands/bgsd-research-phase.md
    - commands/bgsd-list-assumptions.md
    - tests/plan-phase-workflow.test.cjs
    - tests/workflow.test.cjs
key-decisions:
  - Keep `/bgsd-plan` limited to phase planning, discussion, research, and assumptions in this slice so roadmap, gap, and todo migration can land later without enlarging the contract prematurely
  - Route legacy planning wrappers through the canonical command file instead of duplicating workflow instructions so canonical and alias paths stay behaviorally aligned
  - Move only directly touched planning workflow wording to the canonical `/bgsd-plan phase` surface and leave broader help-surface cleanup for Phase 159
patterns-established:
  - "Canonical family normalization: one command file lists sub-actions and maps each onto an existing workflow contract"
  - "Compatibility shims: legacy planning wrappers defer to `/bgsd-plan` and avoid preference language"
requirements-completed: [CMD-02, CMD-03]
one-liner: "Canonical `/bgsd-plan` sub-action routing for phase planning discussion research and assumptions with compatibility-shim aliases and parity tests"
duration: 4 min
completed: 2026-03-29
---

# Phase 158 Plan 02: Establish `/bgsd-plan` as the real master entrypoint for phase-planning and planning-prep actions before the broader roadmap, gap, and todo aliases migrate onto it. Summary

**Canonical `/bgsd-plan` sub-action routing for phase planning discussion research and assumptions with compatibility-shim aliases and parity tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T21:48:11Z
- **Completed:** 2026-03-29T21:52:15Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Expanded `commands/bgsd-plan.md` from a placeholder wrapper into the canonical planning-family contract for `phase`, `discuss`, `research`, and `assumptions` sub-actions.
- Recast `bgsd-plan-phase`, `bgsd-discuss-phase`, `bgsd-research-phase`, and `bgsd-list-assumptions` as thin compatibility shims that route to `/bgsd-plan` instead of carrying separate preferred behavior.
- Added focused workflow and wrapper parity tests so canonical and legacy planning entrypoints fail loudly if they drift on routing or wording.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the `/bgsd-plan` contract for core planning flows** - `89cc431` (feat)
2. **Task 2: Convert legacy planning-prep commands into thin compatibility shims** - `927fef2` (refactor)
3. **Task 3: Lock core planning-family parity with targeted routing regressions** - `c1c1859` (test)

## Files Created/Modified

- `commands/bgsd-plan.md` - Defines the canonical planning-family sub-actions and their workflow normalization.
- `workflows/plan-phase.md` - Surfaces `/bgsd-plan phase` as the canonical planning entry while retaining compatibility wording.
- `commands/bgsd-plan-phase.md` - Converts the legacy plan command into a compatibility-only shim.
- `commands/bgsd-discuss-phase.md` - Converts the legacy discuss command into a compatibility-only shim while preserving `--fast` compatibility.
- `commands/bgsd-research-phase.md` - Routes the legacy research command through canonical planning-family behavior.
- `commands/bgsd-list-assumptions.md` - Routes the legacy assumptions command through canonical planning-family behavior.
- `tests/plan-phase-workflow.test.cjs` - Verifies plan-phase wording now prefers `/bgsd-plan phase`.
- `tests/workflow.test.cjs` - Verifies canonical planning sub-action routing and alias-to-canonical parity.

## Decisions Made

- Kept `/bgsd-plan` intentionally narrow in this slice so roadmap, gaps, and plan-scoped todos can migrate in follow-on plans without inflating the current contract.
- Pointed legacy wrappers at `commands/bgsd-plan.md` rather than duplicating workflow-specific instructions, because one canonical contract is the lowest-risk way to preserve alias parity.
- Updated only the directly touched planning workflow wording to prefer canonical `/bgsd-plan phase`, leaving broader help and reference cleanup to Phase 159 as planned.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's `node bin/bgsd-tools.cjs verify:references commands/bgsd-plan.md` verification step is unavailable in the current CLI build (`Unknown verify subcommand: references`). I relied on the targeted routing regression suite and direct command-contract inspection instead.

## Next Phase Readiness

- The core planning-family contract is now centralized under `/bgsd-plan`, so follow-on Phase 158 work can add roadmap, gap, and todo sub-actions without reworking the compatibility pattern again.
- Planning aliases already land on the canonical contract, which reduces risk for Phase 159 help and command-integrity cleanup.

## Self-Check

PASSED
