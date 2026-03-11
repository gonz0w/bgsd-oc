# Phase 91: Rich TTY Output & Error Handling - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation layer for enhanced CLI formatting and context-rich error handling. This phase delivers:
- Color-coded terminal output with proper TTY detection
- Styled table rendering
- Progress indicators for long operations
- Actionable error messages with recovery suggestions
- Debug helpers for troubleshooting

This is the foundation that subsequent phases (92+) will build upon.

</domain>

<decisions>
## Implementation Decisions

### Color Scheme & Library
- **Library:** picocolors (lightweight, fast, Node.js native)
- **Color scheme:** Standard terminal colors (red=error, yellow=warning, green=success, blue=debug)
- **Styling:** Use bold for emphasis (headers, important values)
- **Agent's Discretion:** Exact hex codes, additional color nuances

### TTY Detection & Fallback
- **Detection:** Check `process.stdout.isTTY` + `chalk.supportsColor`
- **Environment:** Respect `NO_COLOR` (disable) and `FORCE_COLOR` (enable) env vars
- **CLI flags:** `--color` / `--no-color` explicit flags, `--force-color` to override
- **Default:** Enable colors if supported (user can opt out)

### Progress Indicator Style
- **Type:** Combination - spinner for indeterminate, progress bar with % for determinate
- **Nesting:** Support nested tasks (sub-tasks under main task)
- **Characters:** Classic ASCII (`|`, `/`, `-`, `\`)
- **Cancellation:** Ctrl+C support (standard interrupt)

### Error Message Structure
- **Components:** Error type + message + file + line + recovery suggestion
- **Recovery format:** "Try: [action]" prefix for clear action orientation
- **Change context:** Not included initially (keep errors focused)
- **Severity:** Both color (red/yellow) AND prefix markers (`[ERROR]`, `[WARN]`)

### Debug Helpers
- **Commands:** `trace` (stack trace), `context dump` (state inspection), `state` command
- **Invocation:** Flags on existing commands (`--trace`, `--debug`) + separate debug subcommands
- **Agent's Discretion:** Exact command names, output format, detail levels

### Table Formatting
- **Library:** cli-table3 or similar (well-maintained)
- **Style:** Unicode box-drawing characters for polished look
- **Alignment:** Auto-size columns, right-align numbers, left-align text
- **Features:** Column sorting, row limiting, overflow handling

</decisions>

<specifics>
## Specific Ideas

No specific references provided — using standard CLI best practices.

**Key constraints from requirements:**
- UX-01: Color-coded output (TTY detected)
- UX-02: Tables with alignment and styling
- UX-03: Progress indicators for long operations
- UX-10: Actionable recovery suggestions in errors
- UX-11: Debug helpers (trace, context dump, state)
- UX-12: Errors include context (file, line)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 91-rich-tty-output*
*Context gathered: 2026-03-10*
