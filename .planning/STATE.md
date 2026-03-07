# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v8.2 — Cleanup, Performance & Validation

## Current Position

Phase: 61 of 66 (Tooling & Safety Net)
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: 2026-03-06 — Roadmap created for v8.2 (6 phases, 22 requirements)

Progress: [________________________________________] 0% (v8.2)

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
| Phase 59 P02 | 8min | 2 tasks | 5 files |
| Phase 60 P01 | 13 min | 2 tasks | 5 files |
| Phase 60 P02 | 18 min | 2 tasks | 3 files |
| Phase 60 P02 | 18 min | 2 tasks | 3 files |

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
- [Phase Phase 59]: collectNlmSynthesis() wrapped in single try/catch — any error returns null for silent Tier 1 fallback
- [Phase Phase 59]: Tier 1 synthesis loads top 3 URL sources into session notebook — balances coverage against NLM API timeout risk
- [Phase 60]: research cache keyed on query string — exact match semantics, TTL 1 hour, LRU eviction
- [Phase 60]: cache write skipped if source_count=0 — avoids caching empty/failed pipeline runs
- [Phase 60]: 'cache' namespace added to router (cache:research-stats, cache:research-clear) for symmetry with 'research' namespace
- [Phase 60]: Session file for research:collect keyed on query string — exact match required for resume, different query = fresh run
- [Phase 60]: deleteSession() called after successful output — session only deleted when all pipeline stages complete
- [Phase 60]: Per-stage checkpoint: each stage (web/youtube/context7/nlm) writes session file immediately after completion

### Pending Todos

None — milestone starting fresh.

### Blockers/Concerns

- Bundle at ~1216KB — target measurable reduction via dead code removal
- Two pre-existing config-migrate test failures (from Phase 56 RAG key additions) need cleanup

## Session Continuity

Last session: 2026-03-06
Stopped at: Roadmap created — 6 phases (61-66) covering 22 requirements
Next step: Plan Phase 61 — `/bgsd-plan-phase 61`
