# Phase 85: Runtime Exploration - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Bun runtime detection, compatibility documentation, and startup benchmarking for the bGSD plugin. Users can detect if Bun is available, view compatibility docs, and benchmark startup performance compared to Node.js.

</domain>

<decisions>
## Implementation Decisions

### Detection approach
- Use both detection methods: version command (`bun --version`) first, fallback to PATH lookup
- Cache detection results for current session only (session cache)
- Auto-detect Bun when running any bgsd-tools command
- Always auto-detect, not configurable via settings

### When Bun is detected
- Show full details: Bun version, path, and that it's ready to use

### When Bun is NOT detected
- Show platform-specific install instructions (macOS, Linux, Windows)

### Agent's Discretion
- Minimum version checking — agent decides whether to enforce a minimum Bun version
- Exact wording of version output
- Exact format of platform-specific install instructions

</decisions>

<specifics>
## Specific Ideas

No specific references or examples — decisions captured as general preferences.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 85-runtime-exploration*
*Context gathered: 2026-03-10*
