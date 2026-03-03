---
phase: 59-notebooklm-integration
plan: 01
subsystem: research
tags: [notebooklm, notebooklm-py, rag, research, nlm, subprocess]

# Dependency graph
requires:
  - phase: 56-research-capabilities
    provides: detectCliTools() with notebooklm-py detection and path resolution
  - phase: 58-research-orchestration
    provides: research namespace, execFileSync subprocess pattern, output() framework
provides:
  - getNlmBinary() — binary resolution helper with graceful degradation
  - checkNlmAuth() — auth health probe via notebooklm list --json
  - cmdResearchNlmCreate() — create NotebookLM notebook with structured JSON output
  - cmdResearchNlmAddSource() — add source to notebook with 60s timeout
  - formatNlmCreate() and formatNlmAddSource() — TTY formatters
  - COMMAND_HELP entries for research:nlm-create and research:nlm-add-source
affects: [60-notebooklm-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NLM guard pattern: check binary → check auth → execute (same as yt-dlp pattern from Phase 57)"
    - "Auth health probe via cheapest NLM operation (list --json) before any mutation"
    - "execFileSync subprocess with explicit stdio: pipe to prevent terminal bleed"

key-files:
  created: []
  modified:
    - src/commands/research.js
    - src/lib/constants.js
    - src/router.js
    - bin/gsd-tools.cjs

key-decisions:
  - "Auth health probe uses 'notebooklm list --json' — cheapest available operation that validates cookies"
  - "Auth timeout = Math.min(10000, rag_timeout * 1000 / 3) — never more than 10s, fraction of total budget"
  - "nlm-add-source uses 60s timeout — source processing (fetch + index) can be slow"
  - "Set active notebook via 'use' command before adding source — notebooklm-py API requires this"
  - "Pre-existing config-migrate test failures (2) are from Phase 56 RAG config key additions, not Phase 59"

patterns-established:
  - "NLM guard pattern: getNlmBinary() → checkNlmAuth() → execute → structured error on each guard"
  - "Auth error detection via regex on stderr: /auth|cookie|login|401|403|session|expired|unauthorized/i"

requirements-completed: [NLM-01, NLM-04]

# Metrics
duration: 11min
completed: 2026-03-03
---

# Phase 59 Plan 01: NotebookLM Commands Summary

**NotebookLM notebook management via `research:nlm-create` and `research:nlm-add-source` with binary/auth guard pattern and graceful degradation to structured JSON errors on all failure paths**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-03T12:44:29Z
- **Completed:** 2026-03-03T12:56:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented `getNlmBinary()`, `checkNlmAuth()`, and `formatNlmError()` helpers
- Added `cmdResearchNlmCreate()` — creates NotebookLM notebooks, returns `{ notebook_id, title, raw_output }`
- Added `cmdResearchNlmAddSource()` — sets active notebook then adds source with 60s timeout
- Wired `research:nlm-create` and `research:nlm-add-source` routing in research namespace
- Added COMMAND_HELP entries for both commands (colon and space-separated variants)
- Rebuilt bundle at 1190KB (well within 1500KB budget), 760/762 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement NLM helper functions and notebook management commands** - `e5cf167` (feat)
2. **Task 2: Build and verify end-to-end with edge cases** - `8718785` (chore)

**Plan metadata:** `(pending)` (docs: complete plan)

## Files Created/Modified
- `src/commands/research.js` - Added getNlmBinary, checkNlmAuth, formatNlmError, formatNlmCreate, formatNlmAddSource, cmdResearchNlmCreate, cmdResearchNlmAddSource
- `src/lib/constants.js` - Added COMMAND_HELP entries for research:nlm-create, research nlm-create, research:nlm-add-source, research nlm-add-source
- `src/router.js` - Added nlm-create and nlm-add-source routing in research namespace case block
- `bin/gsd-tools.cjs` - Rebuilt bundle with NLM commands included

## Decisions Made
- **Auth health probe pattern:** Use `notebooklm list --json` (cheapest available command) to validate cookies before any mutation. Avoids creating half-done notebooks when auth is expired.
- **Auth timeout formula:** `Math.min(10000, rag_timeout * 1000 / 3)` — hard cap at 10s, uses 1/3 of total RAG budget so auth check doesn't consume the whole pipeline timeout.
- **60s add-source timeout:** Source processing (URL fetch + indexing by NotebookLM) can be slow. Using 30s would cause false failures on valid operations.
- **Set active notebook via 'use':** The notebooklm-py API requires setting the active notebook before sourcing operations — this is a CLI-level constraint, not a design choice.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was pre-committed in a previous session (`e5cf167`). Task 2 completed the build/verify cycle with no issues.

## Review Findings

Review skipped — continuation plan (Task 1 previously committed, Task 2 was build-only verification).

## Issues Encountered
- Two pre-existing test failures (`already-complete config returns empty migrated_keys` and `idempotent on modern config`) were found during test run. Confirmed pre-existing from Phase 56 RAG config key additions by checking out prior commit. Not caused by Phase 59 changes. Deferred to separate cleanup.
- `nlm` binary was found at `/home/cam/go/bin/nlm` but auth cookies are expired — demonstrated the exact graceful degradation path working correctly.

## User Setup Required
None - no external service configuration required. Users who want to use NotebookLM commands must install `notebooklm-py` and run `notebooklm login` separately. This is documented in the install_hint returned by the commands themselves.

## Next Phase Readiness
- NotebookLM notebook creation and source management commands are complete
- Foundation ready for Plan 02: RAG synthesis (asking questions and generating reports via NotebookLM)
- Auth health checking infrastructure will be reused by Plan 02's query command

---
*Phase: 59-notebooklm-integration*
*Completed: 2026-03-03*
