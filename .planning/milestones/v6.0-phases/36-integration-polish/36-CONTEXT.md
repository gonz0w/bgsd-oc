# Phase 36: Integration & Polish - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all 11 command wrappers into the OpenCode command directory, update deploy.sh to manage them, refresh AGENTS.md as a lean index, and sweep dead code. This is the final phase of v6.0 — closes out the milestone.

</domain>

<decisions>
## Implementation Decisions

### Command wrapper organization
- Move 11 `cmd-*.md` files from `workflows/` to a new `commands/` directory in the dev repo
- Rename to match installed `gsd-*` pattern (e.g., `cmd-velocity.md` → `gsd-velocity.md`)
- Delete old `workflows/cmd-*.md` files after move — no duplication
- Standardize wrapper format across all command files for clarity and speed
- Investigate origin of existing 30 commands in `~/.config/opencode/command/` — if any are redundant with workflows, clean up; if they have value, plumb them into the repo structure

### Deploy.sh command deployment
- Add `commands/` directory to deploy.sh copy targets → deploys to `~/.config/opencode/command/`
- Only manage files that originate from this repo — do not touch, overwrite, or delete commands from other plugins or OpenCode itself
- Validate against opencode package to identify which commands are ours vs. external
- Include command wrappers in the post-deploy smoke test / validation
- Back up command directory alongside existing get-shit-done backup

### AGENTS.md as lean index
- AGENTS.md should inform about this dev repo (how to work on the plugin), not duplicate plugin content
- Remove stale "Completed Work" section — history lives in `.planning/`
- Remove "Optional Next Steps" — roadmap tracks this
- Point to relevant bGSD plugin files (workflows, references, templates) for detailed content
- Keep it minimal to avoid overloading agent context windows
- Testing section should reference `npm test` for full suite, not list individual smoke-test commands

### Dead code cleanup
- Sweep for dead code after moving `cmd-*.md` files out of `workflows/`
- Clean up any remaining `--raw` references removed in Phase 35
- Remove unused imports or stale references
- No bundle size measurements or thresholds — `npm run build` success is the gate

### Validation approach
- `npm run build` must succeed cleanly
- Full test suite (`npm test`) must pass
- No size metrics — keep things light but don't sacrifice framework quality
- Milestone closure (`/gsd-complete-milestone`) is manual — user runs after testing

### Agent's Discretion
- Exact standardized format for command wrapper files
- How to detect which commands in `~/.config/opencode/command/` are ours vs. external
- Dead code sweep methodology (grep-based, import analysis, etc.)
- Order of operations for move + rename + cleanup

</decisions>

<specifics>
## Specific Ideas

- "I always want proper organization and structure so the agents are never confused"
- "AGENTS.md should just inform the overall project and point to the relevant bGSD file to get the content it needs"
- "I always want a full test suite ran during milestone validate or closure"
- "Keep things as light as possible, but without sacrificing the goal of building an incredible framework for developing complex software with great testing and validation"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-integration-polish*
*Context gathered: 2026-02-27*
