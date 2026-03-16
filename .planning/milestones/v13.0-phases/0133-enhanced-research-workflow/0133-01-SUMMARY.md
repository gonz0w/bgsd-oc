---
phase: 0133-enhanced-research-workflow
plan: 01
subsystem: cli
tags: [research, scoring, quality-profile, commonjs, javascript]
provides:
  - cmdResearchScore — structured 7-field quality profile from RESEARCH.md with cache write
  - cmdResearchGaps — convenience extractor reading flagged_gaps[] from cached profile
  - parseResearchFile — defensive RESEARCH.md parser (sources, confidence breakdown, gaps, conflicts)
  - computeConfidenceLevel — composite negative-signal scoring (LOW needs >= 3 signals)
affects: [new-milestone, research-workflow]
tech-stack:
  added: []
  patterns:
    - "Composite confidence scoring: count negative signals (>= 3 = LOW, >= 1 = MEDIUM, else HIGH)"
    - "Cache-first pattern: score writes research-score.json; gaps reads it — no independent recomputation"
key-files:
  created: [tests/research-score.test.cjs]
  modified: [src/commands/research.js, src/router.js, bin/bgsd-tools.cjs]
key-decisions:
  - "Router wiring added as deviation fix — research:score and research:gaps needed explicit case blocks in research namespace"
  - "computeConfidenceLevel uses 5 negative signals: totalSources<3, !hasOfficialDocs, >90 days, conflicts>0, highConfidencePct<30"
  - "parseResearchFile extracts official docs from docs.* domain pattern OR 'official' keyword in Primary/Secondary sources"
  - "Conflict detection scans Sources section only (not full doc) to reduce false positives"
patterns-established:
  - "Defensive parsing: all extractors return empty arrays/null/0 defaults — never throws on missing sections"
  - "Cache contract: research-score.json is the source of truth for gaps command; cache path derived from input dir"
requirements-completed: [RESEARCH-01, RESEARCH-03, RESEARCH-04]
one-liner: "RESEARCH.md quality profile engine: 7-field JSON scoring (source count, confidence, gaps, conflicts) with research-score.json cache and research:gaps convenience extractor"
duration: 8min
completed: 2026-03-15
---

# Phase 133 Plan 01: Implement `cmdResearchScore` and `cmdResearchGaps` Summary

**RESEARCH.md quality profile engine: 7-field JSON scoring (source count, confidence, gaps, conflicts) with research-score.json cache and research:gaps convenience extractor**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T23:01:20Z
- **Completed:** 2026-03-15T23:10:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Implemented `parseResearchFile()` with defensive RESEARCH.md parsing: tier-based source counting (Primary/Secondary/Tertiary), official docs detection via `docs.*` domains or "official" keyword, confidence breakdown extraction from Metadata section, gap detection from LOW-confidence breakdown entries and Open Questions, and multi-pattern conflict detection
- Implemented `computeConfidenceLevel()` with composite negative-signal scoring: 5 signals tracked, `>= 3` signals = LOW, `>= 1` = MEDIUM, zero = HIGH — prevents single-red-flag false alarms
- Implemented `cmdResearchScore` (writes 7-field JSON + `research-score.json` cache) and `cmdResearchGaps` (reads cache, errors if missing), wired both into the router and added 22 tests covering unit (parseResearchFile, computeConfidenceLevel), integration (cmdResearchScore, cmdResearchGaps), and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement cmdResearchScore and cmdResearchGaps in research.js** - `5b96835` (feat)
2. **Task 2: Add tests for research:score and research:gaps** - `e57f7d8` (test)
3. **Router wiring fix** - `9fa29ea` (feat: wire score+gaps into router)

## Files Created/Modified

- `src/commands/research.js` — Added parseResearchFile, computeConfidenceLevel, cmdResearchScore, formatResearchScore, cmdResearchGaps, formatResearchGaps
- `src/router.js` — Added research:score and research:gaps case blocks, updated usage string
- `tests/research-score.test.cjs` — 22 tests: parseResearchFile (6), computeConfidenceLevel (6), cmdResearchScore (3), cmdResearchGaps (4), edge cases (3)
- `bin/bgsd-tools.cjs` — Rebuilt from source

## Decisions Made

- Router wiring was a necessary addition not explicitly in the plan: `cmdResearchScore` and `cmdResearchGaps` needed to be wired into the `research:` namespace in router.js to be callable via CLI
- `computeConfidenceLevel` uses 5 negative signals — the plan listed exactly 5 but didn't number them; implementation tracks: `totalSources < 3`, `!hasOfficialDocs`, `oldestSourceDays > 90`, `conflicts.length > 0`, `highConfidencePct < 30`
- Official docs detection scans Primary+Secondary sources (not Tertiary) via `docs.*` domain pattern or "official" keyword — Tertiary sources are typically community/secondary references

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Router wiring required for integration tests**
- **Found during:** Task 2 (integration test execution)
- **Issue:** `research:score` and `research:gaps` commands not registered in router — "Unknown research subcommand" error
- **Fix:** Added `score` and `gaps` case blocks to the `research:` namespace in `src/router.js`, updated usage strings, rebuilt bin
- **Files modified:** src/router.js, bin/bgsd-tools.cjs
- **Verification:** All 22 integration tests pass; manual `node bin/bgsd-tools.cjs research:score` returns valid 7-field JSON
- **Committed in:** `9fa29ea` (separate atomic commit, part of Task 2 completion)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Router wiring is essential for the commands to be callable — zero scope creep.

## Issues Encountered

- `git stash` during regression baseline check reverted `src/router.js` edits (stash pop failed on untracked files). Re-applied edits and rebuilt. Minor disruption — tests verified before and after.

## Next Phase Readiness

- `research:score` and `research:gaps` are fully wired and tested — ready for integration into `new-milestone.md` workflow (Phase 133 Plan 02 scope, if applicable)
- `research-score.json` cache contract is established: `{ source_count, high_confidence_pct, oldest_source_days, has_official_docs, confidence_level, flagged_gaps[], conflicts[] }`
- No blockers

## Self-Check: PASSED

All artifacts verified:
- `src/commands/research.js` — FOUND
- `src/router.js` — FOUND
- `tests/research-score.test.cjs` — FOUND
- `.planning/phases/0133-enhanced-research-workflow/0133-01-SUMMARY.md` — FOUND
- Commit `5b96835` — FOUND
- Commit `e57f7d8` — FOUND
- Commit `9fa29ea` — FOUND

---
*Phase: 0133-enhanced-research-workflow*
*Completed: 2026-03-15*
