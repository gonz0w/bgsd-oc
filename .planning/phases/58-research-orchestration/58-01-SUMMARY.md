---
phase: 58-research-orchestration
plan: 01
subsystem: research
tags: [research, pipeline, orchestration, brave-search, youtube, yt-dlp, xml, agent-context, tier-degradation]

# Dependency graph
requires:
  - phase: 56-research-capabilities
    provides: detectCliTools, detectMcpServers, calculateTier, research namespace routing
  - phase: 57-youtube-integration
    provides: cmdResearchYtSearch, cmdResearchYtTranscript, parseVtt
provides:
  - research:collect pipeline command with multi-source orchestration
  - collectWebSources and collectYouTubeSources subprocess collectors
  - formatSourcesForAgent XML builder for agent_context
  - formatCollect TTY formatter for human-readable output
  - --quick bypass for performance-sensitive workflows
affects: [58-02-PLAN, research-phase workflow, agent context loading]

# Tech tracking
tech-stack:
  added: []
  patterns: [subprocess orchestration via execFileSync, progressive stderr status, XML-tagged agent context]

key-files:
  created: []
  modified: [src/commands/research.js, src/router.js, src/lib/constants.js, bin/gsd-tools.cjs]

key-decisions:
  - "Per-stage timeout splits total budget evenly — simple, prevents one stage consuming all time"
  - "Only top YouTube video gets transcript extraction — expensive operation, diminishing returns beyond first"
  - "agent_context uses XML tags not JSON — LLMs parse XML attributes reliably in context windows"

patterns-established:
  - "Pipeline progressive status: [N/M] stage description on stderr for user feedback"
  - "Subprocess collection pattern: execFileSync self-invocation with JSON parsing for composable commands"
  - "Graceful degradation: each stage returns empty array on failure, pipeline continues"

requirements-completed: [ORCH-01, ORCH-02, ORCH-04, ORCH-05]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 58 Plan 01: Research Collection Pipeline Summary

**Multi-source research:collect command orchestrating Brave Search + YouTube collection with 4-tier degradation, --quick bypass, progressive status output, and XML-tagged agent_context formatting**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T11:45:46Z
- **Completed:** 2026-03-03T11:51:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented `research:collect` pipeline with subprocess orchestration of existing web and YouTube primitives
- 4-tier automatic degradation: detects available tools via existing calculateTier() and adjusts collection
- `--quick` flag bypasses pipeline entirely for performance-sensitive workflows (tier 4, zero latency)
- Progressive `[1/3]`, `[2/3]`, `[3/3]` status messages on stderr at each collection stage with timing
- XML-tagged `agent_context` field with `<collected_sources>` wrapper for LLM consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement research:collect command with source collectors, tier-aware orchestration, and agent_context formatting** - `cbcf607` (feat)
2. **Task 2: Build and verify end-to-end command integration** - `6c34b53` (chore)

## Files Created/Modified
- `src/commands/research.js` - Added collectWebSources, collectYouTubeSources, escapeXmlAttr, truncateTranscript, formatSourcesForAgent, formatCollect, cmdResearchCollect
- `src/router.js` - Added collect routing in research namespace, updated error message and usage string
- `src/lib/constants.js` - Added COMMAND_HELP entries for research:collect and research collect, updated research listing
- `bin/gsd-tools.cjs` - Rebuilt bundle (1180KB, within 1500KB budget)

## Decisions Made
- Per-stage timeout splits total rag_timeout budget evenly between web and YouTube stages — simple and prevents one slow stage consuming all time
- Only the top-ranked YouTube video gets transcript extraction — it's expensive (yt-dlp subtitle download) and diminishing returns beyond first result
- agent_context uses XML tags (`<collected_sources>`, `<source>`) rather than JSON — LLMs parse XML attributes reliably in context windows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- research:collect pipeline fully operational, ready for Phase 58 Plan 02 workflow integration
- Brave Search web sources collected successfully when API key available
- YouTube gracefully skipped when yt-dlp not installed
- Bundle size stable at 1180KB with ~10KB headroom added

---
*Phase: 58-research-orchestration*
*Completed: 2026-03-03*
