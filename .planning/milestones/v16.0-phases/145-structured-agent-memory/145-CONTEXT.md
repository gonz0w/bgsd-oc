# Phase 145: Structured Agent Memory - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary
This phase delivers a human-editable, git-trackable `MEMORY.md` in `.planning/`, injects a screened frozen snapshot into agent system prompts at session start, and adds CLI commands to list, add, remove, and prune memory. It clarifies how structured memory should behave; it does not add broader retrieval systems or on-demand prompt injection modes.
</domain>

<decisions>
## Implementation Decisions

### Memory Structure
- Optimize for a balance of scanability and detail so humans can edit it comfortably, agents can consume it clearly, and the file can grow without turning chaotic.
- Start from the roadmap's 4 core sections: project facts, user preferences, environment patterns, and correction history.
- Add an `Active / Recent` section so current context stands out, long-lived sections stay cleaner, and future pruning has a clearer staging area.
- Use a small per-entry schema rather than plain bullets or rigid records; include lightweight provenance/context fields only when useful because that gives enough meaning without making markdown heavy.
- Store only recurring corrections in correction history so memory space goes to reusable patterns instead of one-off noise.

### Prompt Injection Model
- Keep the roadmap boundary: memory is injected at session start as a frozen snapshot; mid-session disk writes do not alter the active prompt.
- Within that fixed model, favor a consistent snapshot experience and treat visibility around staleness as important UX.
- If memory changes mid-session, surface an explicit refresh/restart notice so users understand why new entries are on disk but not active yet.

### Safety Screening
- Threat-pattern matches must be blocked before prompt injection; avoid a warn-only path for true matches.
- Treat direct instruction overrides, exfiltration attempts, and tool-coercion/bypass language as first-class blocker categories from the first implementation.
- When an entry is blocked, explain the rejection clearly rather than offering rewrite suggestions; the user prefers avoiding loophole-teaching over faster recovery.

### CLI Workflow
- Memory commands should feel balanced: concise for frequent use, but still clear enough to support safe edits.
- For `memory:add`, downstream planning should prefer the most consistency-preserving input shape; the user's strongest preference is predictable structure over either maximum scriptability or maximum conversational input.
- `memory:list` should default to section-grouped output that mirrors `MEMORY.md`, because matching the file's shape lowers surprise and makes review easier.

### Pruning Policy
- Pruning should consider both age and relevance, not age alone; old entries may still be valuable.
- Recent use is the strongest relevance signal, but explicit keep intent also matters and should not be ignored.
- `memory:prune` should default to a non-destructive preview-first experience so users can inspect proposed removals before cleanup is applied.

### Warnings and Failures
- Favor balanced visibility: concise inline notices when memory injection is skipped, reduced, or frozen, without turning routine output into long diagnostics.
- Error messages should pair the failure reason with a practical next step so recovery feels obvious rather than dead-ended.
- For blocked unsafe entries, show the blocker category plus a redacted snippet; category alone feels too opaque, but full text echo is unnecessarily risky.

### Agent's Discretion
- Choose the exact lightweight entry fields for the small memory schema.
- Choose the primary `memory:add` interface shape, but bias toward consistency of stored structure.
- Choose the exact phrasing and compactness of inline notices, as long as they stay visible and low-noise.
</decisions>

<specifics>
## Specific Ideas
- Keep `MEMORY.md` human-readable and comfortable to hand-edit.
- Make the CLI view and the file structure feel aligned rather than like two different models.
- Treat prompt-space growth and long-term clutter as real concerns, even if the first version stays simple.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Full-session snapshot concerns were challenged from a long-term prompt-bloat angle. Decision held: keep the roadmap's frozen session-start model, but make staleness visible and plan with future clutter pressure in mind.
- Preview-first pruning was challenged as potentially too cautious. Decision held: default to inspect-before-delete behavior because memory cleanup feels risky enough to earn explicit review.
- Strict blocked-entry rejection was challenged from a recovery-speed angle. Decision held: do not provide rewrite hints for unsafe entries because that can create evasion guidance.
</stress_tested>

<deferred>
## Deferred Ideas
- On-demand memory injection instead of session-start snapshotting came up in discussion, but that would change the roadmap-defined behavior and belongs in a future phase if revisited.
</deferred>

---
*Phase: 145-structured-agent-memory*
*Context gathered: 2026-03-28*
