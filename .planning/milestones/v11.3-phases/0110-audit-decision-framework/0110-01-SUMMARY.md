---
phase: 0110-audit-decision-framework
plan: 01
subsystem: audit
tags: [regex, rubric, token-estimation, cli, workflow-scanning]

# Dependency graph
requires:
  - phase: none
    provides: first phase of v11.3
provides:
  - audit:scan CLI command producing structured catalog of LLM-offloadable decisions
  - 7-criteria rubric scorer (3 critical + 4 preferred) as pure functions
  - Token savings estimator with category-based model
  - Partitioned output (offloadable vs keep-in-LLM with rationale)
affects: [0111-decision-engine, 0112-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [regex-based markdown scanning, pure-function rubric scoring, static token estimation]

key-files:
  created: [src/commands/audit.js]
  modified: [src/router.js, src/lib/constants.js, bin/bgsd-tools.cjs]

key-decisions:
  - "New 'audit' namespace in router (not under util:) — cleaner separation for audit-specific commands"
  - "Single-file command module (src/commands/audit.js) following codebase.js pattern — all scanner/rubric/estimator in one file"
  - "False positive filtering for procedural conditionals (if file exists, if error) — prevents catalog dilution"
  - "Category-based token estimation using midpoint model (75/350/550 tokens) — honest order-of-magnitude estimates"

patterns-established:
  - "Decision indicator regex patterns for markdown scanning"
  - "7-criteria rubric scoring as pure functions (assessFiniteInputs, assessDeterministic, assessNoNLU + 4 preferred)"
  - "Workflow frequency classification (every-session, per-phase, rare) for token savings estimation"

requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03]
one-liner: "Regex-based audit scanner with 7-criteria rubric scoring and token estimation across 44 workflows and 10 agents, finding 87 decision candidates (~22K tokens/session savings)"

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 110 Plan 01: Audit Scanner, Rubric Scorer, Token Estimator Summary

**Regex-based audit scanner with 7-criteria rubric scoring and token estimation across 44 workflows and 10 agents, finding 87 decision candidates (~22K tokens/session savings)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-13T13:25:43Z
- **Completed:** 2026-03-13T13:40:46Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `src/commands/audit.js` with scanner, rubric scorer, and token estimator (8KB)
- Registered `audit:scan` CLI command via new `audit` namespace in router
- Scanner identifies 87 decision candidates across all 44 workflow files and 10 agent definitions
- Rubric scores each candidate against 3 critical + 4 preferred criteria with clear pass/fail rationale
- Token estimator assigns per-invocation and per-session savings using category-based midpoint model
- 85 candidates offloadable, 2 explicitly kept in LLM with rationale ("requires NLU")
- Estimated ~22K tokens/session savings from offloadable candidates

## Task Commits

Each task was committed atomically:

1. **Task 1: Create audit command module** - `62421f5` (feat)
2. **Task 2: Register audit namespace in router** - `ab892d4` (feat)
3. **Task 3: Build, run scan, validate output** - `6b47e61` (chore)

## Files Created/Modified
- `src/commands/audit.js` - New command module: scanner, rubric, estimator, cmdAuditScan handler
- `src/router.js` - Added lazyAudit() loader, 'audit' namespace routing, KNOWN_NAMESPACES update
- `src/lib/constants.js` - Added audit:scan entry to COMMAND_HELP
- `bin/bgsd-tools.cjs` - Rebuilt bundle (773KB within 1550KB budget)

## Decisions Made
- Used new `audit` namespace (not `util:audit`) for cleaner command separation
- Single-file command module pattern (all logic in audit.js) following existing codebase.js convention
- False positive filtering: procedural conditionals ("if file exists") excluded from decision candidates
- Category-based token estimation with static midpoint model — honest order-of-magnitude estimates without runtime telemetry

## Deviations from Plan

None - plan executed exactly as written.

## Review Findings

Review skipped — autonomous plan execution.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- audit:scan command produces complete catalog for Phase 111 consumption
- Phase 111 (Decision Engine) can use the offloadable candidates list to build decision-rules.js
- Token estimates provide prioritization data for implementation order

---
*Phase: 0110-audit-decision-framework*
*Completed: 2026-03-13*
