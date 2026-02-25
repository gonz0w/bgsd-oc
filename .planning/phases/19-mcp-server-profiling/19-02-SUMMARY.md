---
phase: 19-mcp-server-profiling
plan: 02
subsystem: mcp
tags: [mcp, relevance-scoring, recommendations, context-optimization, token-savings]

# Dependency graph
requires:
  - phase: 19-01
    provides: "discoverMcpServers(), estimateTokenCost(), MCP_KNOWN_SERVERS"
provides:
  - "scoreServerRelevance() — per-server relevance scoring against project files"
  - "generateRecommendations() — keep/disable/review with reasoning and savings"
  - "RELEVANCE_INDICATORS mapping 16 server types to file indicators"
  - "Enhanced mcp-profile output with relevance, recommendations, and savings"
affects: [19-03 auto-disable]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fuzzy server name matching against indicator keys", "env hint detection in .env/docker-compose files", "low-cost threshold for auto-relevant scoring"]

key-files:
  created: []
  modified: [src/commands/mcp.js, bin/gsd-tools.cjs, bin/gsd-tools.test.cjs]

key-decisions:
  - "Fuzzy name matching: server name contains indicator key or vice-versa"
  - "Low-cost threshold at 1000 tokens — servers under this always marked relevant"
  - "Env hints checked in .env, .env.local, .env.development, docker-compose.yml/yaml"
  - "Compact RELEVANCE_INDICATORS format to stay within 500KB bundle budget"

patterns-established:
  - "Relevance scoring: indicator-based file/env checking with always_relevant override"
  - "Recommendation engine: score → recommendation mapping with savings calculation"

requirements-completed: [MCP-03, MCP-04]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 19 Plan 02: Relevance Scoring & Recommendations Summary

**Project-aware relevance scoring matching 16 server types against file indicators with keep/disable/review recommendations and total savings calculation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T15:34:18Z
- **Completed:** 2026-02-25T15:38:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- RELEVANCE_INDICATORS database mapping 16 MCP server types to project file indicators, env hints, and always-relevant flags
- scoreServerRelevance() with fuzzy name matching, filesystem checks, env hint detection in .env/docker-compose, and low-cost threshold
- generateRecommendations() producing keep/disable/review per server with human-readable reasoning and total potential token savings
- Enhanced cmdMcpProfile output with relevance, recommendation, recommendation_reason, total_potential_savings, potential_savings_percent, and recommendations_summary
- 8 new test cases covering all scoring paths with zero regressions (427 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build relevance scoring and recommendation engine** - `5c21d37` (feat)
2. **Task 2: Add tests for relevance scoring and recommendations** - `6907a06` (test)

## Files Created/Modified
- `src/commands/mcp.js` — Added RELEVANCE_INDICATORS, scoreServerRelevance(), generateRecommendations(), matchIndicatorKey(), checkEnvHints(); updated cmdMcpProfile with recommendation enrichment
- `bin/gsd-tools.cjs` — Bundled output (500KB, within budget)
- `bin/gsd-tools.test.cjs` — 8 new test cases in relevance scoring describe block

## Decisions Made
- Fuzzy name matching (contains check both directions) for server→indicator mapping — "my-postgres" matches "postgres" indicator
- Low-cost threshold set at 1000 tokens — no known servers fall below this currently, but the logic is ready for future additions
- Env hints checked across 5 files (.env, .env.local, .env.development, docker-compose.yml, docker-compose.yaml) — covers common patterns
- Compact RELEVANCE_INDICATORS format (single-line entries, omitted empty arrays) to stay within 500KB bundle budget

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Relevance scoring and recommendations ready for Plan 03 (auto-disable)
- scoreServerRelevance() and generateRecommendations() exported for Plan 03 consumption
- RELEVANCE_INDICATORS extensible for future server types

---
*Phase: 19-mcp-server-profiling*
*Completed: 2026-02-25*
