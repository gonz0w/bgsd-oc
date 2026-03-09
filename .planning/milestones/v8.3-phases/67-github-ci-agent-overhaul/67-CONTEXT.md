# Phase 67: GitHub CI Agent Overhaul - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring the GitHub CI agent (`gsd-github-ci`) to the same quality standard as gsd-executor and gsd-planner. Add structured returns (CHECKPOINT REACHED / CI COMPLETE), project context discovery, deviation rules for check failures, state tracking via gsd-tools, and TodoWrite progress visibility. The agent's core push-PR-check-fix-merge loop remains — this phase improves its structure, not its capabilities.

</domain>

<decisions>
## Implementation Decisions

### State tracking granularity
- Record outcome summary only in STATE.md: PR merged/blocked, checks passed/failed, iteration count
- No full alert breakdown or audit trail in STATE.md — that detail lives in the PR/commit history
- Record ALL decisions the agent makes (auto-fixes, dismissals, escalations) as decision entries in STATE.md
- Session info only — no cumulative metrics (no CI run counters or success rates)
- Parent workflow handles state when CI agent is spawned by another workflow (e.g., execute-phase). CI agent returns structured output, parent decides what to record. Avoids duplicate writes.

### Deviation classification
- Auto-fix simple true positives (unused imports, straightforward sanitization). Escalate complex fixes requiring architectural changes.
- False positive dismissals: auto-dismiss low severity (note/warning) with reasoning. Present medium+ severity suspected false positives to user for confirmation.
- Deviation rules: hardcoded sensible defaults in agent definition, with config.json overrides per project
- Non-scanning check failures (build errors, lint errors, test failures): attempt fix using the same loop as code scanning alerts — read error output, try to fix, push, re-check

### Progress reporting style
- TodoWrite uses high-level phases: ~5-6 items (Push branch, Create PR, Wait for checks, Analyze failures, Fix & repush, Merge)
- No per-alert todo items — keep the list clean
- Conversational status updates between steps ("Pushing branch...", "Waiting for checks (2/5 passed)...")
- Show iteration banner during fix loops: "Fix iteration 2/3: addressing 2 remaining alerts"
- CI COMPLETE structured return includes timing information (total duration, check wait time, fix time)

### Checkpoint escalation behavior
- Max iterations reached: checkpoint with recommendations (specific next actions: dismiss, manual fix, or close PR)
- Merge blocked by branch protection: wait 2-3 minutes for auto-review bots, then checkpoint if still blocked
- Auth failures: run `gh auth status` for diagnostics before stopping. Include diagnostic output in checkpoint.
- Check timeout (15 min): always escalate immediately. No offer to extend.

### Agent's Discretion
- Exact structured return field names and formatting (match patterns from executor/planner)
- How project context discovery integrates into the existing step flow
- Config.json schema for deviation rule overrides
- Specific wording of conversational updates

</decisions>

<specifics>
## Specific Ideas

- State update ownership model: CI agent returns structured output, parent workflow records state. This means the CI agent needs a flag or convention to know when it's spawned vs. invoked directly (direct invocation = agent updates state itself).
- Deviation rules should feel like the existing classification table in the agent (severity x context matrix) but formalized into a `<deviation_rules>` block that other agents could reference.
- Iteration banner format should be consistent with how gsd-executor reports progress during plan execution.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 67-github-ci-agent-overhaul*
*Context gathered: 2026-03-08*
