---
phase: 35-workflow-output-tightening
plan: 01
subsystem: docs
tags: [ui-brand, formatting, bGSD, output-patterns]

requires:
  - phase: 30-formatting-foundation
    provides: format.js primitives (banner, formatTable, SYMBOLS, color)
provides:
  - Updated ui-brand.md reference with bGSD branding and concrete output examples
  - Information density guidelines for all command output
  - Anti-pattern documentation for format.js usage
affects: [35-02, 32-01, 33-01, 34-01]

tech-stack:
  added: []
  patterns: [banner-content-summary-action output pattern]

key-files:
  created: []
  modified: [references/ui-brand.md]

key-decisions:
  - "Document format.js function names alongside visual specs so agents use functions not raw ANSI"
  - "Add SYMBOLS constant mapping next to each symbol so agents reference constants not hardcoded Unicode"

patterns-established:
  - "Command output structure: banner → content → summaryLine → actionHint"
  - "One action hint per command, no verbose status messages"

requirements-completed: [WKFL-06]

duration: 2min
completed: 2026-02-27
---

# Phase 35 Plan 01: ui-brand.md bGSD Branding & Output Pattern Reference Summary

**Updated ui-brand.md with bGSD branding, format.js function references, concrete command output examples, and information density guidelines**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T04:25:31Z
- **Completed:** 2026-02-27T04:27:01Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced all standalone "GSD" references with "bGSD" throughout ui-brand.md
- Added concrete command output examples showing `init progress` and `verify quality` with full formatted output
- Added Information Density Guidelines section with 7 rules for information-dense output
- Updated all visual specs to reference format.js functions (banner, formatTable, box, summaryLine, actionHint, SYMBOLS)
- Added SYMBOLS constant names alongside each status symbol for agent reference
- Expanded anti-patterns with 4 new entries: inline ANSI codes, multiple action hints, verbose status messages, hardcoded Unicode

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ui-brand.md branding and patterns** - `dfac811` (docs)

## Files Created/Modified
- `references/ui-brand.md` - Updated brand reference with bGSD branding, format.js function references, command output examples, information density guidelines, and expanded anti-patterns

## Decisions Made
- Referenced format.js function names (e.g., `banner(title)`, `formatTable(headers, rows, options)`) directly in specs so agents use shared primitives instead of raw ANSI
- Added SYMBOLS constant mapping next to each symbol character so agents reference `SYMBOLS.check` not hardcoded `✓`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ui-brand.md is complete — ready for 35-02 (workflow tightening using these patterns)
- All command renderer phases (32-34) can reference this updated spec

---
*Phase: 35-workflow-output-tightening*
*Completed: 2026-02-27*
