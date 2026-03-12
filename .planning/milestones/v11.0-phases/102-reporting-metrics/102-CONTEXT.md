# Phase 102: Reporting & Metrics - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users receive rich formatted reports for completed milestones and velocity analytics. This phase builds on Phase 101 (Rich Visualization) to present milestone completion data and compute velocity metrics in useful formats.

**Core capabilities:**
- Formatted milestone summary reports
- Velocity metrics computation and display

</domain>

<decisions>
## Implementation Decisions

### Trigger Points
- **Decision:** Both automatic AND on-demand
- Milestone summary displays automatically when a milestone completes (matches celebration moment)
- On-demand command available: `/bgsd milestone summary [milestone-id]` to view any milestone
- On-demand command: `/bgsd util velocity` to view velocity metrics anytime

### Output Destination
- **Decision:** Console by default, with optional file save
- Console output for immediate feedback (primary)
- `--save` or `--file <path>` flag to persist reports
- Default file location: `.planning/milestones/{milestone-name}/summary.md`
- JSON export option for programmatic access: `--format json`

### Report Content
- Milestone name and dates (started, completed)
- Total phases completed
- Total tasks completed
- Time metrics (total time, average per phase)
- Quality scores summary (if available)
- Velocity metrics (tasks per session trend)

### Velocity Metrics
- Tasks completed per session
- Average session duration
- Trend indicator (improving/stable/declining)
- Sparkline visualization (using VIS-05 from Phase 101)

</decisions>

<specifics>
## Specific Ideas

- Use existing format.js infrastructure from Phase 91 for table rendering
- Integrate burndown chart data from Phase 101 for milestone timeline visualization
- Velocity sparkline inline with session output
- Terminal dashboard integration (VIS-06 from Phase 101) for rich metrics display

No specific external references — using standard CLI patterns and existing bGSD conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 102-reporting-metrics*
*Context gathered: 2026-03-11*
