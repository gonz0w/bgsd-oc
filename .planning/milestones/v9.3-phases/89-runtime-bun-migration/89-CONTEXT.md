# Phase 89: Runtime Bun Migration - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Bun runtime fully integrated into the bGSD CLI tool. Projects without Bun work exactly as before. The tool auto-detects Bun at startup and uses it when available, falling back to Node.js gracefully.

</domain>

<decisions>
## Implementation Decisions

### Bun detection
- Detect using `bun --version` command
- Any Bun version works (agent determines if minimum version needed)
- Check at startup and cache result in config for faster subsequent runs
- Inform user when Bun is detected/available
- Silent fail if detection command fails (continue with fallback)
- If multiple Bun installations found, use highest version
- Agent decides on override mechanism (e.g., BUN_PATH env var)

### Backward compatibility
- Auto-detect Bun with automatic fallback to Node.js
- Allow config option to force Node.js and skip Bun entirely
- Existing Node.js projects work identically with Bun (same behavior)
- No migration steps required — seamless adoption

### Fallback behavior
- When Bun not available, automatically use Node.js
- Notify user when falling back to Node.js
- If Bun found but version doesn't meet requirements, fall back to Node.js
- Remember fallback decision for the session (cache decision)

### Output/reporting
- Startup banner showing which runtime is being used
- Banner shows runtime name + version (e.g., "Running with Bun v1.2.3")
- When falling back to Node.js, show "Falling back to Node.js"
- Verbose mode (-v) shows additional runtime details

### Agent's Discretion
- Minimum Bun version requirement (if any)
- Override mechanism design (env var, config key)
- Exact banner format and styling
- What extra details to show in verbose mode

</decisions>

<specifics>
## Specific Ideas

- "I want it to work without any changes to existing projects"
- Startup should show what runtime is being used
- Silent failure with fallback is preferred over blocking errors

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 89-runtime-bun-migration*
*Context gathered: 2026-03-10*
