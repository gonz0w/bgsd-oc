# Phase 71: Plugin Architecture & Safety - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin has a modular, safe foundation — ESM build target, universal error boundary, shared parsers for in-process reads, and enforced tool naming convention. This is infrastructure that downstream phases (72-76) depend on. No user-facing features are added; this phase delivers the architectural foundation.

</domain>

<decisions>
## Implementation Decisions

### Error boundary behavior
- Brief toast/notification on hook failure — user sees "bGSD hook failed: [name]" but flow continues uninterrupted
- Retry once silently before treating as failure — handles transient issues like file locks
- After retry failure: log to both file AND stderr for immediate + persistent visibility
- Circuit breaker: auto-disable hook after 3 consecutive failures within a session
  - Failure count resets on editor restart (fresh chance each session)
  - Toast notification when hook is disabled: "Hook [name] disabled after repeated failures"
  - Re-enable via /bgsd-settings command
- Async hooks get a 5-second timeout — if they don't resolve, treat as failure
- On failure, skip the hook's contribution entirely (no stale cached data fallback)
- BGSD_DEBUG=1 bypasses error boundary — exceptions propagate for plugin development debugging
- Slow hook logging: hooks taking >500ms get a timing entry in the log
- Correlation IDs on errors — toast shows an ID that matches the log file entry for easy lookup
- Log file lives in the global config directory (~/.config/...), not per-project
- Log format: human-readable text with timestamps (not JSON)
- Log file capped at 512KB with rotation to .log.1

### Agent's Discretion (Error boundary)
- Whether to use one universal safeHook wrapper or type-specific wrappers (safeSessionHook, safePromptHook, etc.)

### Shared parser API surface
- Return structured typed objects with accessor methods (e.g., roadmap.getPhase(71).name), not raw parsed data
- Return null when a file can't be parsed (corrupt, missing, wrong format) — caller checks for null
- Cache parsed results until explicitly invalidated via manual invalidate() call (file watchers come in Phase 75)
- Read-only parsers — writing stays in gsd-tools.cjs CLI commands
- Individual imports: import { parseRoadmap } from 'bgsd/parsers/roadmap' — tree-shakeable, granular
- Extract parsing code FROM existing gsd-tools.cjs into shared modules — both CLI and plugin use the same source
- Auto-discover files from CWD — no path argument required (e.g., parseRoadmap() finds .planning/ROADMAP.md)
- Parsed objects are immutable (Object.freeze) — prevents accidental mutation of cached data
- parsePlans(phaseNum) returns array of all parsed plans for a phase — handles multi-plan discovery
- Include raw markdown sections alongside structured data — useful for display hooks
- Lenient parsing — best-effort extraction, skip/null unrecognizable parts rather than strict rejection

### Build output & dual format
- Shared source, dual output — same src/ modules, build produces CJS and ESM bundles
- Switch from custom build.cjs to esbuild — handles CJS/ESM dual output natively
- ESM output preserves module structure (not single bundle) — tree-shakeable
- Single `npm run build` command produces both CJS and ESM outputs
- No source maps for ESM output
- Update deploy.sh to handle new ESM output alongside CJS
- Build validates ESM output is actually valid ESM (no require() leaks) — fail build if found
- Audit and clean up dev dependencies while touching the build
- Remove old build.cjs after migration — clean break

### Agent's Discretion (Build)
- ESM output directory location (dist/, lib/, or root with package.json exports)

### Tool naming enforcement
- Auto-prefix silently — tools registered without bgsd_ prefix get it added automatically
- Enforce snake_case for entire tool name — bgsd_tool_name format, lowercase, underscores only
- Maintain internal tool registry — tracks all registered tools, enables conflict detection
- Duplicate tool names: warn and overwrite — log a warning, then replace the first registration
- Tool registration is permanent for the session — no unregistration API
- Tool handlers wrapped in the same safeHook error boundary as hooks — consistent error handling
- No limit on number of registered tools — trust the developer
- Registry is internal only — no public has/get/list API exposed

### Agent's Discretion (Tool naming)
- Whether tool registration API includes schema/description metadata or just name + handler

</decisions>

<specifics>
## Specific Ideas

- Error boundary should feel like a safety net, not a restriction — hooks should "just work" and fail gracefully
- The circuit breaker pattern should be lightweight enough to not add overhead to every hook invocation
- Parsers should feel natural to import — same patterns developers use with any Node.js library
- The esbuild migration is an opportunity to modernize the entire build pipeline, not just add ESM output

</specifics>

<deferred>
## Deferred Ideas

- Hook testing command (/bgsd-test-hooks to run all hooks with mock data) — out of scope, could be its own feature
- File watcher-based cache invalidation — Phase 75 (Event-Driven State Sync)
- Public tool registry API (has/get/list) — not needed now, could be added if use cases emerge

</deferred>

---

*Phase: 71-plugin-architecture-safety*
*Context gathered: 2026-03-08*
