# Phase 44: Review Gate Hardening - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Graduate the reviewer from informational to enforcing — two-stage review with severity-classified findings and stuck/loop detection.
This builds on Phase 41's reviewer agent and Phase 43's TDD execution engine.

</domain>

<decisions>
## Implementation Decisions

### Two-Stage Review Approach
- Stage 1: Spec compliance check — verify code meets plan must_haves
- Stage 2: Code quality check — verify conventions, patterns, anti-patterns
- Each stage produces findings with severity levels

### Severity Classification
- BLOCKER: Prevents task completion, must fix before proceeding
- WARNING: Should fix, but task can proceed
- INFO: FYI, no action required

### Stuck/Loop Detection
- Track failure patterns per task (count retries on same error)
- Trigger recovery after >2 retries: rollback + suggest different approach
- Recovery includes: last good state, error pattern, alternative strategy

</decisions>

<specifics>
## Specific Ideas

- Two-stage review integrates with existing gsd-reviewer agent
- Severity classification extends current finding format
- Stuck detection uses executor state tracking from Phase 43
- Recovery workflow uses git rollback capabilities

</specifics>

---

*Phase: 44-review-gate-hardening*
*Context gathered: 2026-02-27*
