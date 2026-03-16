# Phase 132: Deviation Recovery Auto-Capture - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-capture winning recovery patterns from Rule-1 (code bug) deviation failures as structured lesson entries in execute-phase. Capped at 3 per milestone, non-blocking, never triggered by Rule-3 environmental failures. Also fixes the `autonomousRecoverles` typo in `autoRecovery.js`.

</domain>

<decisions>
## Implementation Decisions

### Lesson Entry Storage
- Store captured lessons in a dedicated `LESSONS.md` file at the `.planning/` root (not per-phase)
- Use structured markdown format for entries with labeled fields (Rule, Failure Count, Behavioral Change, Agent)
- File is created on first capture only — no pre-created empty templates
- One file accumulates entries across all phases within a milestone

### Deduplication Handling
- Duplicate recoveries are merged rather than creating separate entries
- Match criteria: same deviation rule type AND similar behavioral change description
- On merge: append "also seen in plan X" context notes to the existing entry
- A merged entry counts as one entry toward the 3-per-milestone cap (not per-occurrence)

### Cap Reset & Visibility
- Track the cap by counting entries in LESSONS.md — the file IS the state, no separate counter
- When the 3-entry cap is reached, stop capturing completely silently (no notification)
- On milestone transition: lessons that have been acted on (agent/skill modifications applied) are manually removed; unresolved lessons propagate forward to the next milestone
- Resolution tracking is manual — user or agent deletes the entry from LESSONS.md after applying the fix

</decisions>

<specifics>
## Specific Ideas

- Lessons that result in agent or skill modifications should be removed from LESSONS.md once the fix is applied — this is a manual cleanup step, not automated
- Unresolved lessons carry forward across milestones until acted on, ensuring nothing is lost
- The file-as-state approach means no config.json changes needed for cap tracking

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0132-deviation-recovery-auto-capture*
*Context gathered: 2026-03-15*
