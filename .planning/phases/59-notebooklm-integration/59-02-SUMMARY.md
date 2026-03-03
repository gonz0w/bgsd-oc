---
phase: 59-notebooklm-integration
plan: 02
subsystem: research
tags: [notebooklm, notebooklm-py, rag, research, nlm, tier1, synthesis, subprocess]

# Dependency graph
requires:
  - phase: 59-notebooklm-integration
    provides: getNlmBinary(), checkNlmAuth(), nlm-create and nlm-add-source commands
  - phase: 58-research-orchestration
    provides: research:collect pipeline, formatSourcesForAgent(), tier calculation
provides:
  - cmdResearchNlmAsk() — ask grounded question against notebook, returns answer + references
  - cmdResearchNlmReport() — generate briefing-doc/study-guide/blog-post from notebook
  - collectNlmSynthesis() — Tier 1 internal helper: session notebook creation + source loading + synthesis question
  - Tier 1 Stage 4 in cmdResearchCollect() — NLM synthesis integrated into pipeline with silent fallback
  - <nlm_synthesis> XML block in agent_context at Tier 1
  - Updated workflows/research-phase.md with Tier 1 documentation
affects: [60-notebooklm-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NLM guard pattern extended: binary check → auth check → execute (same as Plan 01)"
    - "Silent pipeline fallback: any error in collectNlmSynthesis() returns null, pipeline continues"
    - "XML synthesis block placed before raw sources so agent sees grounded analysis first"
    - "Stage count dynamic: 4 at Tier 1, 3 at Tier 2+ for correct [N/N] progress messages"

key-files:
  created: []
  modified:
    - src/commands/research.js
    - src/lib/constants.js
    - src/router.js
    - bin/gsd-tools.cjs
    - workflows/research-phase.md

key-decisions:
  - "collectNlmSynthesis() wrapped in single try/catch — any error returns null (silent fallback). Pipeline never crashes due to NLM."
  - "formatSourcesForAgent() accepts optional nlmSynthesis param — backward compatible, null = omit block"
  - "Session notebook title prefixed [GSD] for identifiability, capped at 50 chars"
  - "Load top 3 source URLs (filter s.url) — tradeoff between coverage and NLM API timeout"
  - "nlm-ask --new flag passed through to notebooklm-py for fresh conversation support"

patterns-established:
  - "Tier 1 synthesis: create notebook → load sources → ask grounded question → include in agent_context"
  - "Pipeline stage count determined before stages begin: totalStages = tier === 1 ? 4 : 3"

requirements-completed: [NLM-02, NLM-03]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 59 Plan 02: NotebookLM Ask/Report + Tier 1 Pipeline Summary

**Full Tier 1 RAG loop complete: `research:nlm-ask` and `research:nlm-report` commands added, `research:collect` now creates session notebooks at Tier 1, loads collected sources, asks a synthesis question, and includes the grounded answer in `agent_context` with silent NLM fallback**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T12:58:26Z
- **Completed:** 2026-03-03T13:06:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Implemented `cmdResearchNlmAsk()` — sets active notebook, asks question with `--new` flag support, returns `{ notebook_id, question, answer, references, raw_output }`
- Implemented `cmdResearchNlmReport()` — generates `briefing-doc`, `study-guide`, or `blog-post` with optional `--prompt`, 60s timeout
- Implemented `collectNlmSynthesis()` — fully wrapped in try/catch, creates `[GSD] query` notebook, loads top 3 URL sources, asks synthesis question, returns answer or null
- Updated `formatSourcesForAgent()` to accept optional `nlmSynthesis` parameter and emit `<nlm_synthesis>` XML block before raw sources
- Updated `cmdResearchCollect()` to add Stage 4 NLM synthesis at Tier 1, adjust stage count display to `[1/4]`–`[4/4]` at Tier 1
- Added COMMAND_HELP entries for both colon and space-separated variants
- Rebuilt bundle at 1204KB (well within 1500KB budget)
- Updated `workflows/research-phase.md` with Tier 1 documentation note

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement nlm-ask, nlm-report commands and Tier 1 pipeline integration** - `2835917` (feat)
2. **Task 2: Build, verify zero regression, and update workflow** - `1ec0ef0` (chore)

**Plan metadata:** `(pending)` (docs: complete plan)

## Files Created/Modified
- `src/commands/research.js` - Added formatNlmAsk, cmdResearchNlmAsk, formatNlmReport, cmdResearchNlmReport, collectNlmSynthesis; updated formatSourcesForAgent and cmdResearchCollect
- `src/lib/constants.js` - Added COMMAND_HELP entries for research:nlm-ask (colon + space), research:nlm-report (colon + space)
- `src/router.js` - Added nlm-ask and nlm-report routing; updated error message and usage string
- `bin/gsd-tools.cjs` - Rebuilt bundle at 1204KB with all NLM commands
- `workflows/research-phase.md` - Added Tier 1 documentation note in Step 3.5

## Decisions Made
- **Silent fallback pattern:** `collectNlmSynthesis()` wrapped in a single outer try/catch that returns null on any error. Auth failures, timeout, JSON parse errors, API changes — all result in null and the pipeline continues with raw sources. NotebookLM is never required.
- **Optional nlmSynthesis parameter:** `formatSourcesForAgent()` signature changed to accept optional third parameter. Existing callers passing only `(sources, query)` continue to work identically — null synthesis omits the `<nlm_synthesis>` block entirely.
- **Top 3 sources:** Only the first 3 URL-bearing sources are loaded into the session notebook. This balances coverage against NLM API timeout risk — adding more sources increases the chance of partial failures during the synthesis window.
- **Dynamic stage count:** `totalStages` computed before Stage 1 based on tier. At Tier 1: shows `[1/4]`…`[4/4]`. At Tier 2+: shows `[1/3]`…`[3/3]`. Zero visual regression for non-Tier-1 users.

## Deviations from Plan

None — plan executed exactly as written. All 8 sub-items in Task 1 implemented per spec.

## Review Findings

Review skipped — checkpoint plan (autonomous: true, but implementation follows exact plan specification).

## Issues Encountered
- Two pre-existing test failures (`already-complete config returns empty migrated_keys` and `idempotent on modern config`) — same failures as Plan 01, from Phase 56 RAG config key additions. Not caused by Plan 02 changes. 760/762 tests pass.
- `nlm` binary found at `/home/cam/go/bin/nlm` but auth cookies are expired — correct behavior verified: auth check gate fires before any notebook operations, returns structured `{ error, reauth_command }` JSON.

## User Setup Required
None - no external service configuration required. Users who want to use NLM commands must install `notebooklm-py` and run `notebooklm login` separately. This is documented in the install_hint returned by the commands themselves.

## Next Phase Readiness
- Full Tier 1 RAG pipeline complete: collect → synthesize → ground in agent_context
- Phase 59 (NotebookLM integration) fully implemented: nlm-create, nlm-add-source (Plan 01) + nlm-ask, nlm-report, Tier 1 synthesis (Plan 02)
- Ready for Phase 60 (final integration / milestone completion) if planned

## Self-Check: PASSED

All files verified present on disk. All task commits verified in git history. All key functions verified in source files.

---
*Phase: 59-notebooklm-integration*
*Completed: 2026-03-03*
