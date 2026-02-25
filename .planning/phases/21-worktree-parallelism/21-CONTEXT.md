# Phase 21: Worktree Parallelism - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create, manage, and merge git worktrees so multiple plans within a wave execute in parallel across isolated working directories, with conflict detection and sequential merge back to the main branch. The execute-phase workflow already supports wave grouping and sequential execution — this phase adds true parallelism via worktrees.

</domain>

<decisions>
## Implementation Decisions

### Worktree lifecycle & layout
- Worktrees live in `/tmp/gsd-worktrees/<project-name>/` — not inside the project tree
- Automatic cleanup after successful merge
- Minimal file sync: copy `.env` files and `.planning/config.json` into each worktree, then run setup hooks fresh (npm install, etc.) — no deep sync of node_modules or build artifacts
- Worktrees persist until phase complete — not cleaned up immediately after merge, gives debugging access if later merges or plans fail

### Agent spawning & monitoring
- Let all agents in a wave finish even if one fails — don't kill running agents on individual failure
- Live status updates while agents run — periodically show which agents are still running and rough progress

### Merge strategy & conflict handling
- Auto-resolve trivial conflicts (lockfiles, generated files); for real code conflicts, offer options: resolve manually, skip this plan, or abort wave
- `git merge-tree` dry-run before every merge attempt

### Resource limits & degradation
- Auto-detect `max_concurrent` from system resources (RAM/cores), with user override in config.json
- If a setup hook fails in a worktree (e.g., `npm install` errors), skip that plan — mark it failed, let the rest of the wave proceed
- Pre-check disk space before creating worktrees — estimate needed space (project size x max_concurrent), warn or block if insufficient
- If system can't support requested parallelism, auto-reduce the number of concurrent worktrees and warn the user

### Agent's Discretion
- Branch naming convention for worktree branches
- Merge ordering within a wave (plan order, smallest diff first, etc.)
- Agent spawning mechanism (Task() subagents vs tmux vs other)
- Completion signaling mechanism (SUMMARY.md polling, Task() return, sentinel files)
- Whether to run tests after each individual merge or after all wave merges
- Test failure handling strategy (revert and continue, or stop merging)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing execute-phase workflow (wave grouping, plan-index, parallel flag) is the integration point. Phase 18 env manifest can inform setup hooks but should degrade gracefully if missing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-worktree-parallelism*
*Context gathered: 2026-02-25*
