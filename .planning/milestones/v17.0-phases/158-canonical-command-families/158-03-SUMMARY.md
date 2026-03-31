---
phase: 158-canonical-command-families
plan: 03
subsystem: commands
tags: [commands, markdown, aliases, workflow-routing, roadmap, todos]
requires:
  - phase: 158-canonical-command-families
    provides: canonical `/bgsd-plan` planning-family baseline from Plan 02 that this slice expands to roadmap gaps and todos
provides:
  - Canonical `/bgsd-plan` roadmap, gaps, and plan-scoped todo contract
  - Compatibility-only roadmap, gap, and todo aliases routed through the canonical planning family
  - Explicit planning-family boundary notes for follow-on parity verification
affects:
  - phase-158-follow-on-parity
  - phase-159-help-surface-command-integrity
tech-stack:
  added: []
  patterns:
    - Canonical family commands enumerate grouped sub-actions and normalize them onto existing workflows
    - Legacy planning wrappers point to the canonical command file instead of duplicating workflow contracts
key-files:
  created: []
  modified:
    - commands/bgsd-plan.md
    - workflows/plan-phase.md
    - commands/bgsd-add-phase.md
    - commands/bgsd-insert-phase.md
    - commands/bgsd-remove-phase.md
    - commands/bgsd-plan-gaps.md
    - commands/bgsd-add-todo.md
    - commands/bgsd-check-todos.md
key-decisions:
  - Keep roadmap mutation under `/bgsd-plan roadmap ...` instead of adding another canonical top-level command family
  - Keep `/bgsd-plan gaps` limited to the existing milestone-gap planning entrypoint rather than redesigning gap semantics in this slice
  - Keep todos explicitly plan-scoped under `/bgsd-plan todo ...` and avoid reopening a standalone todo surface
patterns-established:
  - "Planning-family expansion: add new canonical sub-actions by documenting normalized routes in `commands/bgsd-plan.md`"
  - "Compatibility shims: legacy roadmap gap and todo wrappers defer to `/bgsd-plan` and avoid preferred-path wording"
requirements-completed: [CMD-02, CMD-03]
one-liner: "Canonical `/bgsd-plan` routing now covers roadmap edits milestone-gap planning entry and plan-scoped todo aliases through one shared contract"
duration: 4 min
completed: 2026-03-29
---

# Phase 158 Plan 03: Finish the `/bgsd-plan` migration by collapsing roadmap mutation, gap-planning entry, and plan-scoped todo flows behind the canonical planning family. Summary

**Canonical `/bgsd-plan` routing now covers roadmap edits milestone-gap planning entry and plan-scoped todo aliases through one shared contract**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T21:55:20Z
- **Completed:** 2026-03-29T21:58:52Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Expanded `commands/bgsd-plan.md` so the canonical planning family now documents normalized `roadmap`, `gaps`, and `todo` branches alongside the earlier phase-planning actions.
- Recast all touched roadmap, gap, and todo wrappers as compatibility-only shims that route into `/bgsd-plan` instead of presenting separate preferred entrypoints.
- Documented explicit family boundaries and alias-to-canonical expectations so the follow-on parity slice can test one normalized contract instead of reverse-engineering intent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand `/bgsd-plan` to cover roadmap, gaps, and plan-scoped todos** - `bb1b2f05` (feat)
2. **Task 2: Convert roadmap, gap, and todo commands into thin compatibility shims** - `05049548` (refactor)
3. **Task 3: Document the shared contract boundaries for the follow-on parity slice** - `09fcdfa1` (docs)

**Plan metadata:** `TBD`

## Files Created/Modified

- `commands/bgsd-plan.md` - Defines the expanded canonical planning-family contract for planning, roadmap, gap, and plan-scoped todo actions.
- `workflows/plan-phase.md` - Clarifies that `/bgsd-plan phase` is one branch of the broader planning family and records parity expectations for future verification.
- `commands/bgsd-add-phase.md` - Routes the legacy roadmap-add alias through `/bgsd-plan roadmap add`.
- `commands/bgsd-insert-phase.md` - Routes the legacy roadmap-insert alias through `/bgsd-plan roadmap insert`.
- `commands/bgsd-remove-phase.md` - Routes the legacy roadmap-remove alias through `/bgsd-plan roadmap remove`.
- `commands/bgsd-plan-gaps.md` - Routes the legacy gap-planning alias through `/bgsd-plan gaps` while preserving milestone-gap scope.
- `commands/bgsd-add-todo.md` - Routes legacy todo creation through `/bgsd-plan todo add` with plan-scoped wording.
- `commands/bgsd-check-todos.md` - Routes legacy todo review through `/bgsd-plan todo check` with plan-scoped wording.

## Decisions Made

- Kept roadmap mutation inside `/bgsd-plan roadmap ...` so planning-oriented mutations stay under one master command instead of spawning another visible family.
- Kept `/bgsd-plan gaps` tied to the existing milestone-gap workflow rather than redefining gap-planning behavior, which preserves scope for the later parity slice.
- Made todo aliases explicitly plan-scoped under `/bgsd-plan todo ...` to honor the phase boundary against a general task-management product surface.

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — review context included cumulative branch changes outside this plan, so a plan-scoped post-execution review was not available.

## Issues Encountered

- The plan's `verify:references` commands are still unavailable in the current CLI build (`Unknown verify subcommand: references`), so verification used targeted command-contract checks plus focused workflow tests instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Canonical and legacy roadmap, gap, and todo entrypoints now collapse onto one documented planning-family contract, which is ready for parity regression coverage.
- Phase 159 can update help/reference surfaces against a smaller canonical planning command set without reworking the underlying alias routing again.

## Self-Check

PENDING

---
*Phase: 158-canonical-command-families*
*Completed: 2026-03-29*
