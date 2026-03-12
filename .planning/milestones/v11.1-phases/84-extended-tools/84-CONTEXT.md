# Phase 84: Extended Tools - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can use yq, bat, and gh CLI tools for YAML processing, syntax-highlighted output, and GitHub operations. This builds on the tool detection infrastructure from phase 82 and search/discovery from phase 83.

</domain>

<decisions>
## Implementation Decisions

### Tool Availability Handling
- **Graceful fallback** when tools are unavailable (yq, bat, or gh)
- Same fallback approach as phases 82/83 - use Node.js alternatives where possible
- Clear error messages indicating which tool is missing

### Output Format
- **JSON preferred** for programmatic use across all three tools
- When tools support JSON output (like `yq -o json`), use that by default
- Allows downstream parsing and integration with other CLI tools

### Error Handling
- **Consistent with existing plugin error handling**
- Don't add tool-specific error details beyond what other plugin commands use
- Maintains uniformity across all bgsd-oc commands

### Caching Strategy
- **Same caching as phase 82** (tool detection infrastructure)
- Check tool availability once, cache results
- Reuse existing tool detection cache mechanism

</decisions>

<specifics>
## Specific Ideas

No specific references provided — open to standard implementation approaches aligned with phases 82 and 83 patterns.

</specifics>

<deferred>
## Deferred Ideas

- Individual tool-specific behaviors (yq operations, bat themes, gh auth flow) — to be determined during planning
- These can be refined when planning each tool's integration

</deferred>

---

*Phase: 84-extended-tools*
*Context gathered: 2026-03-10*
