# Phase 83: Search & Discovery - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate ripgrep, fd, and jq CLI tools for faster content search and file discovery. Users can run ripgrep searches with JSON output, use fd for file discovery respecting .gitignore, and pipe data through jq for transformation. Creating tool detection infrastructure (Phase 82) was a prerequisite.

</domain>

<decisions>
## Implementation Decisions

### Tool Integration
- Sequential pipelines — tools chain together for common search patterns
- Default order: file-first (fd → ripgrep) — filter files first to reduce search space early
- Shell pipeline execution — use OS pipes between tool processes for efficiency

### Agent's Discretion
- Specific jq filter expressions for common transformations
- How to handle edge cases in pipeline (e.g., no files found by fd)
- Fallback behavior if any tool in pipeline fails

</decisions>

<specifics>
## Specific Ideas

- "whatever is more efficient" — efficiency is the primary goal for pipeline ordering
- File-first approach reduces search space early by filtering files before content search

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 83-search-and-discovery*
*Context gathered: 2026-03-10*
