# Phase 115: CLI Command Routing - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Every registered CLI command resolves correctly — no missing routes, no orphaned modules, no stale validator data. This is internal infrastructure; the CLI is not exposed to end users.

</domain>

<decisions>
## Implementation Decisions

### Router Resolution
- Direct file mapping (command name → handler file)
- Colon-separated commands map with hyphen: `verify:state` → `verify/state.js`
- Fail fast if handler file missing
- Case-insensitive command names
- Validation on-demand only (not at startup)
- Log errors only (not full invocation logging)
- Minimal handler interface (just needs execute function)
- Fixed timeout per command (5 seconds)
- Grouped by namespace in command list

### Help System
- Minimal help output
- Both global --help and per-command --help
- Auto-generated help text
- Compact format prioritizing usage then options
- Git-style output
- Show nested subcommands
- Exit code 0 for --help
- No examples in help
- Summary only in global help
- Auto-adjust to terminal width

### Error Handling
- Simple message for unknown commands
- Exit code 127 for unknown commands
- Clean error output by default (stack trace optional via flag)
- Brief error messages
- Pass through handler errors
- Handler validates arguments
- Color output for errors
- File logging for errors
- Error messages with prefix (e.g., "Error: command: message")
- stdout only for errors

### Validation Output
- Check both missing commands and orphaned files
- Standard exit codes (0 = valid, 1 = issues)
- Table format output
- Warnings are warnings (don't fail), errors fail

### Command Discovery
- You decide: auto-scan or explicit registry
- Build-time cache (scan once at build, not every run)
- You decide: directory structure and what files count as commands
- Exclude orphaned src/commands/ci.js
- One command per file
- Filename is command name

### Agent's Discretion
- Whether commands support nesting (verify:state style)
- How arguments passed to handlers (array, spread, parsed options)
- Command discovery mechanism (auto-scan vs explicit registry)
- Directory structure for command files
- What files count as commands
- Missing handler vs unregistered command error handling

</decisions>

<specifics>
## Specific Ideas

- verify:handoff and verify:agents should be handled same as other commands
- Grouped by namespace in command list output
- Exit code 127 for unknown commands (standard shell convention)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 115-CLI-command-routing*
*Context gathered: 2026-03-13*
