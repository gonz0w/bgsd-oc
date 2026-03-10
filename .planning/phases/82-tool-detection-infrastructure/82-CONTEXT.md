# Phase 82: Tool Detection Infrastructure - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI tool availability detection with caching, install guidance, and graceful fallback to Node.js implementations. Users can run a command to see which CLI tools are available, receive platform-specific install instructions when missing, and operations gracefully fall back without errors.

</domain>

<decisions>
## Implementation Decisions

### Unavailable Guidance
- **Detail level:** Detailed multi-line output showing what the tool does, why it's needed, how to install, and alternatives
- **Platform detection:** Auto-detect OS and show install commands specific to that platform (macOS, Linux, Windows)
- **Fallback mention:** Per-operation basis — each operation decides whether to mention the Node.js fallback
- **When to show:** On-demand (lazy) — only when user runs a command that needs the missing tool

### Agent's Discretion
- Exact wording and formatting of the detailed guidance
- How to detect OS (node os module, environment variables, etc.)
- Cache duration and invalidation strategy
- How each operation decides whether to mention fallbacks

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

*Phase: 82-tool-detection-infrastructure*
*Context gathered: 2026-03-10*
