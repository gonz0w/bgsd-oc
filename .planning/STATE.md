# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v8.1 — RAG-Powered Research Pipeline

## Current Position

Phase: 59 of 60 (notebooklm-integration)
Plan: 1 of 2
Status: Plan 59-01 complete — NLM notebook management commands delivered
Last activity: 2026-03-03 — Completed 59-01-PLAN.md (NLM commands)

Progress: [########################################] 100% (v8.1)

## Performance Metrics

**Velocity:**
- Total plans completed: 126 (v1.0-v8.0)
- Average duration: ~15 min/plan
- Total execution time: ~27 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 | 5 | 14 | 2 days |
| v1.1 | 4 | 10 | 1 day |
| v2.0 | 4 | 13 | 3 days |
| v3.0 | 4 | 10 | 1 day |
| v4.0 | 5 | 13 | 1 day |
| v5.0 | 7 | 14 | 2 days |
| v6.0 | 7 | 11 | 1 day |
| v7.0 | 8 | 15 | 2 days |
| v7.1 | 6 | 12 | 3 days |
| v8.0 | 5 | 14 | 3 days |
| Phase 56 P01 | 8 min | 2 tasks | 3 files |
| Phase 56 P02 | 7 min | 2 tasks | 5 files |
| Phase 57 P01 | 5 min | 2 tasks | 4 files |
| Phase 57 P02 | 5min | 2 tasks | 4 files |
| Phase 58 P01 | 5 min | 2 tasks | 4 files |
| Phase 58 P02 | 2 min | 2 tasks | 1 files |
| Phase 59 P01 | 11 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

All v1.0-v8.0 decisions recorded in PROJECT.md Key Decisions table with outcomes.

- [v8.1 Research]: Build YouTube/yt-dlp first (low risk), NotebookLM last (highest risk — unofficial API)
- [v8.1 Research]: 4-tier graceful degradation: Full RAG → Sources without synthesis → Brave/Context7 only → Pure LLM
- [v8.1 Research]: All external tools invoked via execFileSync subprocess pattern (matching git.js), zero bundled deps
- [v8.1 Research]: NotebookLM is a quality enhancer, never a requirement — pipeline works at Tier 2-3 without it
- [Phase 56]: MCP config detection handles 3 JSON shapes (mcpServers, mcp.servers, mcp-direct) for cross-editor compatibility
- [Phase 56]: notebooklm-py detection falls back to 'nlm' binary name for alternate installations
- [Phase 56]: Tier calculation shared via calculateTier() — DRY between capabilities command and init output
- [Phase 56]: research namespace added as top-level command namespace for clean separation
- [Phase 57]: Quality score weights: recency 40pts + views 30pts (log-scale) + duration 30pts (bell curve at 15-20min) — demotes clickbait
- [Phase 57]: yt-dlp check runs before query validation — fail fast on missing dependency
- [Phase 57]: VTT auto-sub deduplication strips consecutive identical lines for clean agent consumption
- [Phase 57]: Full transcript always returned in JSON — TTY display truncation only, no data loss
- [Phase 58]: Per-stage timeout splits rag_timeout budget evenly — prevents one slow stage consuming all time
- [Phase 58]: Only top YouTube video gets transcript — expensive operation with diminishing returns beyond first
- [Phase 58]: agent_context uses XML tags not JSON — LLMs parse XML attributes reliably in context windows
- [Phase 58]: Workflow source injection conditional on tier < 4 — zero regression at tier 4, collection failure = silent fallback
- [Phase 59]: Auth health probe uses 'notebooklm list --json' — cheapest NLM operation that validates cookies before any mutation
- [Phase 59]: nlm-add-source uses 60s timeout — source processing (URL fetch + indexing) is slow, 30s causes false failures

### Pending Todos

None — milestone starting fresh.

### Blockers/Concerns

- NotebookLM unofficial API (notebooklm-py) uses cookie auth that expires every few weeks — Google can break it anytime
- yt-dlp in perpetual arms race with YouTube — nsig/SABR breakage requires frequent updates
- Full RAG pipeline latency 3-8 min vs 10-30 sec LLM-only — progressive output and --quick flag mitigate
- Bundle at ~1190KB — 10KB added in Phase 59 P01, monitor against 1500KB budget
- Two pre-existing config-migrate test failures (from Phase 56 RAG key additions) need cleanup

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 59-01-PLAN.md (NLM notebook management commands)
Next step: Execute Phase 59 Plan 02 — RAG synthesis via NotebookLM query commands
