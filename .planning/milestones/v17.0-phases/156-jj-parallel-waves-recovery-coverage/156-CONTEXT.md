# Phase 156: JJ Parallel Waves, Recovery & Coverage - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary
Make JJ workspaces the supported execution model for multi-plan waves, including per-plan workspace creation/tracking, stale or divergent run diagnostics, supported recovery behavior, failed-run inspection/cleanup, and JJ-first docs/config/test coverage. This phase clarifies how parallel JJ execution behaves when runs fail or drift. It does not add new non-JJ execution backends or broaden scope beyond workspace-wave execution and recovery.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Recovery posture - Locked, then stress-test revised. Recovery must be preview-first. bGSD may detect obvious reversible stale cases and prepare safe fixes, but it should show the proposed recovery before mutating workspace state. Divergent or conflict-heavy cases need stronger guardrails and should not be treated as silent auto-repair. Reasoning: the user wants more automation than purely manual guidance, but not at the cost of losing inspection breadcrumbs or trust.
- Wave failure semantics - Locked, then stress-test revised. Let unaffected plans in a parallel wave finish and reconcile independently, while failed or divergent workspaces are reported separately for recovery. Reasoning: the user prefers throughput over whole-wave blocking, as long as partial completion is explicit instead of hidden.
- Failed-run retention - Locked. Keep failed workspaces and recovery breadcrumbs available during recovery work, but if the phase ultimately completes and verifies, clean up the failed workspace at normal end-of-phase cleanup with the rest. Reasoning: failed state should be available while it matters, but not linger forever once the phase is done and the failure is effectively obsolete.

### Medium Decisions
- Recovery surface - Defaulted, then knock-on clarified. Keep recovery inside the existing `workspace` command surface rather than adding a large new command family. After stress-test revisions, the user clarified that preview/recovery should extend current commands with richer status and preview behavior instead of introducing dedicated inspect/recover entrypoints.
- Coverage depth - Defaulted. Bias the phase toward focused regression coverage for workspace lifecycle, stale handling, recovery behavior, and partial-wave outcomes, while also updating JJ-first docs/help/config copy enough to make the supported model clear. Reasoning: lifecycle and recovery semantics are the main planning risk in this phase.

### Low Defaults and Open Questions
- JJ-first coverage posture - Defaulted. Help/config/docs/tests should teach only the JJ workspace path, not a Git worktree fallback.
- Output style - Defaulted. Human output should stay scan-friendly while machine output remains structured enough for tooling and diagnostics.
- Naming/reporting details - Untouched. Exact labels, columns, and message wording can follow standard project patterns as long as the JJ-first model stays clear.

### Agent's Discretion
- Exact detection heuristics for what counts as an obvious reversible stale case, as long as the user gets a preview before any mutation.
- Exact status fields and preview payload shape exposed through the existing `workspace` commands.
- Exact docs/help phrasing and test fixture structure needed to express the locked phase behavior.
</decisions>

<specifics>
## Specific Ideas
- User wants low-risk defaults locked quickly, but wanted the High-impact items explicitly discussed rather than silently defaulted.
- User preferred more automation than a purely guided-manual model, but changed that during stress testing to preview-first recovery before any mutation.
- User accepted partial-wave outcomes as long as healthy work can reconcile independently and the failed workspace is surfaced clearly.
- User wants failed workspace cleanup to happen automatically once the phase is complete and verified, since any formerly failed workspace is no longer useful at that point.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Recovery posture
  - Original decision: Auto-fix obvious reversible stale cases; use stronger guardrails for divergent or conflict-heavy states.
  - Stress-test revision: Make all recovery preview-first, including obvious stale cases.
  - Follow-on clarification: Keep this preview/recovery flow inside the existing `workspace` commands rather than creating separate inspect/recover commands.
- Wave failure semantics
  - Original decision: Let running work finish, then recover, while holding reconcile until the whole wave is recoverable.
  - Stress-test revision: Let unaffected plans finish and reconcile independently; report the wave as partially completed with failed/divergent workspaces called out separately.
  - Follow-on clarification: None beyond explicit partial-wave reporting.
- Failed-run retention
  - Original decision: Keep failed workspaces through recovery work and clean them up with end-of-phase cleanup once the phase completes and verifies.
  - Stress-test revision: No change in direction; the user reinforced that verified phase completion means obsolete failed workspaces should be cleaned up automatically.
  - Follow-on clarification: Cleanup should happen with normal end-of-phase cleanup, not as a separate manual step.
</stress_tested>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---
*Phase: 156-jj-parallel-waves-recovery-coverage*
*Context gathered: 2026-03-29*
