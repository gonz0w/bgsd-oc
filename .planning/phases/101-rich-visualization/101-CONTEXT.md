# Phase 101: Rich Visualization - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view ASCII-based charts and terminal dashboard for project insights. This phase delivers:
- ASCII burndown chart (planned vs actual progress)
- Velocity sparkline inline with session output
- Terminal dashboard command for key metrics overview

Success Criteria:
1. User can view ASCII burndown chart showing planned vs actual progress over milestone timeline
2. User sees velocity sparkline inline with session output showing trend
3. User can run dashboard command to see overview of key metrics in terminal

</domain>

<decisions>
## Implementation Decisions

### Chart Rendering
- **Library:** Agent's discretion — pick best option for world-class visuals like btop
- **Compatibility:** Wide compatibility (Unicode + 256 colors) with graceful ASCII fallbacks
- **Detail level:** Tiered — high detail in modern terminals, minimal in older terminals
- **Sparkline labels:** Show values only in expanded view, inline shows just the sparkline

### Dashboard Layout
- **Metrics:** Progress-focused (task completion %, phase progress, milestone progress)
- **Layout:** Agent's discretion — tiered (better layouts on modern terminals, simpler on older)
- **Historical context:** Current milestone default, full history available on request
- **Screen handling:** Full-screen immersive view (btop-style). If terminal too small, don't display and tell user.

### Data Sources
- **Primary sources:** STATE.md + ROADMAP.md combined
- **In-progress tasks:** Show as projected/estimated based on current pace
- **Refresh:** On-demand only (user runs command)
- **Caching:** Compute fresh each time. SQLite caching deferred to Phase 102 (Reporting & Metrics)

### User Interaction
- **Keyboard navigation:** Full keyboard support (arrows, enter, q)
- **Expandable elements:** Drill-down on enter (e.g., phase → tasks)
- **Multiple views:** Tiered — tabs on modern terminals, toggle with arrows on older
- **Export:** View only — no export functionality

### Terminal Compatibility
- **Detection:** Auto-detect from TERM/terminfo, configuration can override
- **Fallback:** Agent's discretion — do whatever elite ASCII possible for fallback
- **Colors:** Match terminal theme (agent's discretion for matching)
- **Non-interactive:** No fallback — dashboard is interactive-only

</decisions>

<specifics>
## Specific Ideas

- btop-style full-screen immersive dashboard experience
- Tiered approach throughout: modern terminals get best experience, older terminals get gracefully degraded but still polished ASCII
- No velocity metrics in dashboard — user didn't find agent velocity useful
- SQLite caching for historical aggregations deferred to Phase 102 when velocity analytics are needed
- Current milestone shows by default, history available on request

</specifics>

<deferred>
## Deferred Ideas

- SQLite caching for visualization data → Phase 102 (Reporting & Metrics)
- Non-interactive/scripting output → Not planned

</deferred>

---

*Phase: 101-rich-visualization*
*Context gathered: 2026-03-11*
