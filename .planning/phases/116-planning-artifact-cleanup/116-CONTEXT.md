# Phase 116: Planning Artifact Cleanup - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Cleaning up and normalizing planning documentation files — MILESTONES.md, PROJECT.md, out-of-scope list, Key Decisions table, and constraints — so that every agent consuming these files gets accurate, complete, and consistently formatted data.

</domain>

<decisions>
## Implementation Decisions

### File Prioritization
- Fix broken/outdated entries first, not audit-first
- Work on MILESTONES.md and PROJECT.md in parallel
- Include out-of-scope list, Key Decisions table, and constraints in same pass
- Use wave-based approach (not all 7 requirements at once)

### Data vs Format
- Mixed approach: handle data fixes and formatting together as we go
- Also improve overall structure and organization (not minimal changes only)
- Separate passes: format first, then data fixes

### Scope Depth
- Fix broken entries AND improve structure
- Add validation to prevent future regressions
- Validation lives in CLI (bgsd-tools), not test suite
- Validation is a build gate (fails if issues found)

### Verification Approach
- Automated checks (not manual review)
- Checks verify both structure (broken HTML, tables) and content order (milestones chronological)
- Auto-run after cleanup
- Lives in build/validate command (not test suite)

</decisions>

<specifics>
## Specific Ideas

- MILESTONES.md: Fix broken entries, ensure 18+ milestones in chronological order
- PROJECT.md: Fix broken HTML, stale counts, broken table rows
- Out-of-scope: Remove stale items from 12+ milestones ago
- Key Decisions: Ensure all entries are current and properly formatted
- Constraints: Archive resolved constraints, keep only relevant ones

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 116-planning-artifact-cleanup*
*Context gathered: 2026-03-13*
