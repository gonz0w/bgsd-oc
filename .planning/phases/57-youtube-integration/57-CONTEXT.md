# Phase 57: YouTube Integration - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

YouTube search and transcript extraction via yt-dlp, exposed as `research:yt-search` and `research:yt-transcript` commands. This is agent-facing infrastructure — the research agent calls these commands, not end users. User-facing CLI polish is not a goal. Filtering, quality scoring, and sensible defaults optimize for the agent getting the best content with minimal configuration.

</domain>

<decisions>
## Implementation Decisions

### Search result shape and defaults
- Default to 10 results per search (pre-filter count)
- Return null for missing metadata fields (views, duration) — never omit the field
- Include a computed quality signal to help the agent rank results (e.g., recency + views + duration heuristic) — agent decides what to pull transcripts for based on this score
- Agent-optimized: structured JSON output is the primary format, human-readable formatting is secondary

### Transcript output format
- Strip timestamps by default — clean plain text for agent consumption
- Optional `--timestamps` flag to preserve them if needed
- Language priority: English (`en`) first, auto-generated English (`en-auto`) fallback
- Always return the full transcript — no truncation. Let the consumer (research agent) decide how much to use
- When a video has no subtitles: return structured response with clear "no subtitles available" message, no fake fallbacks

### Filter behavior and defaults
- Default recency: last 2 years — developer content goes stale fast, agent can override
- Default duration range: 5-60 minutes — skips sub-minute spam and multi-hour livestream replays, agent can override bounds
- No channel allowlist — quality signal (views + recency + duration) is the real filter, skip the complexity
- Empty results after filtering: return `{ results: [], pre_filter_count: N, post_filter_count: 0 }` so the agent can decide whether to retry with relaxed filters. No auto-retry.

### Agent's Discretion
- Quality signal algorithm (how to weight views, recency, duration into a score)
- Exact yt-dlp flags and argument formatting
- VTT parsing implementation details
- Error message wording
- Whether to add any additional metadata fields beyond what's specified

</decisions>

<specifics>
## Specific Ideas

- This is agent-facing infrastructure, not user-facing CLI — optimize defaults for research agent consumption
- "Whatever gives us the best content, ignore false positives and clickbait" — the quality signal should actively demote likely-clickbait results (high views but very short, sensational patterns)
- Follows the established `execFileSync` subprocess pattern from `git.js` — zero bundled dependencies

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 57-youtube-integration*
*Context gathered: 2026-03-03*
