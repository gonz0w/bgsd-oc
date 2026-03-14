# Phase 117: Intent Archival System - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

INTENT.md is automatically cleaned during milestone completion — completed outcomes archived to per-milestone files, active file stays lean with only current objective and pending outcomes.
</domain>

<decisions>
## Implementation Decisions

### Trigger Timing
- Archival runs automatically at the end of `/bgsd-complete-milestone` workflow

### Archive Storage
- Per-milestone archive files stored in `.planning/archive/` directory
- Each milestone gets its own `.md` file (e.g., ` INTENT-v11.5.md`)

### Active File Content
- After archival, INTENT.md contains only:
  - Current objective
  - Pending outcomes (not yet completed)
- Criteria, constraints, and health sections are removed from active file (archived with milestone)

### Historical Access
- Direct file access to `.planning/archive/*.md` files
- No CLI commands needed — users can read archived files directly
</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 117-intent-archival-system*
*Context gathered: 2026-03-14*
