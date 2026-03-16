---
phase: 0133-enhanced-research-workflow
plan: 02
subsystem: cli
tags:
  - research
  - quality-profile
  - command-discovery
  - help-system
  - workflow-integration
  - commonjs
  - javascript
provides:
  - research:score and research:gaps wired into help system, category listings, related commands, and keyword aliases
  - new-milestone.md Step 8 quality profile section — LOW confidence flagging with HIGH/MEDIUM gap filter
requires:
  - phase: 0133-enhanced-research-workflow (Plan 01)
    provides: cmdResearchScore and cmdResearchGaps implementations with router wiring
affects: [new-milestone, research-workflow, command-help, command-discovery]
tech-stack:
  added: []
  patterns:
    - "Help system pattern: COMMAND_HELP entry + COMMAND_BRIEF + COMMAND_RELATED + NATURAL_LANGUAGE_ALIASES all required for full discoverability"
    - "Workflow advisory gate: research quality profile is non-blocking — never prevents milestone creation, only surfaces confidence info"
key-files:
  created: []
  modified:
    - src/lib/constants.js
    - src/lib/command-help.js
    - src/lib/commandDiscovery.js
    - bin/bgsd-tools.cjs
    - workflows/new-milestone.md
key-decisions:
  - "Quality profile section inserted after RESEARCH COMPLETE banner, before Skip research shortcut — ensures profile is shown for users who complete research but optional for skippers"
  - "Gaps filter: only HIGH and MEDIUM severity shown in new-milestone.md — LOW severity gaps suppressed per CONTEXT.md guidance"
  - "Non-blocking design: re-research prompt defaults to 'N' — confidence issues are advisory, never block milestone creation"
patterns-established:
  - "Advisory gate pattern: surface quality info after completion banner, offer remediation with N default — never block primary workflow"
requirements-completed: [RESEARCH-02]
one-liner: "research:score and research:gaps wired into help, discovery, and keyword aliases; new-milestone.md Step 8 surfaces LOW-confidence files with HIGH/MEDIUM gap filter and non-blocking re-research prompt"
duration: 8min
completed: 2026-03-15
---

# Phase 133 Plan 02: Wire `research:score`/`research:gaps` into CLI and integrate quality profile into new-milestone.md Summary

**research:score and research:gaps wired into help, discovery, and keyword aliases; new-milestone.md Step 8 surfaces LOW-confidence files with HIGH/MEDIUM gap filter and non-blocking re-research prompt**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T23:12:59Z
- **Completed:** 2026-03-15T23:21:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `research:score` and `research:gaps` COMMAND_HELP entries in `constants.js` with full usage text, output JSON shape, and examples; updated `command-help.js` with COMMAND_CATEGORIES, COMMAND_BRIEF, COMMAND_RELATED, and NATURAL_LANGUAGE_ALIASES (`score`, `gaps`, `quality`) for both commands
- Updated `commandDiscovery.js` in 5 locations: NAMESPACE_CATEGORIES research array, COMMAND_TREE research object, `getAllCommands()` fallback list, `routerImplementations` research object, and `spaceFormatCommands` array — ensuring full autocomplete and validation coverage
- Inserted Research Quality Profile section in `new-milestone.md` Step 8 after the RESEARCH COMPLETE banner: runs `research:score` on each `.planning/research/` file, displays confidence profile, flags LOW-confidence files with HIGH/MEDIUM gaps only, shows conflicts, and offers non-blocking re-research prompt (default: N)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire router + help + discovery metadata for research:score and research:gaps** - `4ec6a52` (feat)
2. **Task 2: Integrate quality profile into new-milestone.md Step 8** - `d36b403` (feat)

## Files Created/Modified

- `src/lib/constants.js` — Added COMMAND_HELP entries for research:score and research:gaps with usage, args, output schema, examples (+42 lines)
- `src/lib/command-help.js` — Updated COMMAND_CATEGORIES Research array, COMMAND_BRIEF, COMMAND_RELATED, NATURAL_LANGUAGE_ALIASES (+13 lines)
- `src/lib/commandDiscovery.js` — Updated NAMESPACE_CATEGORIES, COMMAND_TREE, getAllCommands fallback, routerImplementations, spaceFormatCommands (+13 lines)
- `bin/bgsd-tools.cjs` — Rebuilt from source
- `workflows/new-milestone.md` — Added quality profile section after RESEARCH COMPLETE banner (+34 lines)

## Decisions Made

- Quality profile section placed after RESEARCH COMPLETE banner and before "If Skip research" shortcut — shows profile to users completing research without forcing it on users who skip
- Gaps filter shows HIGH and MEDIUM only — LOW severity suppressed per CONTEXT.md guidance to avoid noise
- Re-research prompt defaults to "N" — non-blocking per RESEARCH-02 requirement; users can improve research quality but are never blocked from continuing to milestone creation

## Deviations from Plan

None - plan executed exactly as written.

Note: router.js already had `score` and `gaps` case blocks from Plan 01's Rule-3 deviation fix — Task 1 correctly focused on the remaining wiring (help, discovery, categories, aliases) without duplicating the router work.

## Issues Encountered

- `git stash` + `git stash pop` conflict during regression baseline check: stash pop failed due to build artifact conflicts in `.planning/codebase/`, `bin/manifest.json`, and `skills/skill-index/`. Source edits were re-applied cleanly from stash diff. No functional impact — tests verified before and after confirming pre-existing 1 failure was unrelated to these changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 133 complete: all RESEARCH-0[1-4] requirements fulfilled
  - RESEARCH-01 (Plan 01): parseResearchFile defensive parser
  - RESEARCH-02 (Plan 02): CLI wiring + new-milestone.md integration ✓
  - RESEARCH-03 (Plan 01): cmdResearchScore 7-field JSON
  - RESEARCH-04 (Plan 01): cmdResearchGaps cache reader
- `research:score` and `research:gaps` are fully accessible via CLI with help text, categories, related commands, and keyword aliases
- new-milestone.md surfaces research quality at the right moment — after RESEARCH COMPLETE, before proceeding to requirements
- No blockers

## Self-Check: PASSED

All artifacts verified:
- `src/lib/constants.js` — FOUND
- `src/lib/command-help.js` — FOUND
- `src/lib/commandDiscovery.js` — FOUND
- `workflows/new-milestone.md` — FOUND
- `.planning/phases/0133-enhanced-research-workflow/0133-02-SUMMARY.md` — FOUND
- Commit `4ec6a52` (Task 1) — FOUND
- Commit `d36b403` (Task 2) — FOUND

---
*Phase: 0133-enhanced-research-workflow*
*Completed: 2026-03-15*
