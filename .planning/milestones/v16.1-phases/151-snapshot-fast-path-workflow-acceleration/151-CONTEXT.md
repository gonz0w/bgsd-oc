# Phase 151: Snapshot & Fast-Path Workflow Acceleration - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary
This phase makes common phase work faster by collapsing repeated discovery and fragmented state updates into compact reusable commands, cached discovery reuse, and verification/reporting flows that reduce orchestration overhead. It improves the existing workflow path for phase work; it does not add broader new capabilities beyond acceleration of the current phase lifecycle.

## Implementation Decisions

### Snapshot Contract
- `phase:snapshot <phase>` should be richer than a minimal machine primitive by default. It should still feel compact, but include enough high-value metadata that common callers do not need immediate follow-up reads for basic phase understanding.
- The snapshot must still prioritize reusable structured data over verbose transcript-style output. Richer by default means self-sufficient for common orchestration, not an unbounded dump.

### Batched State Finalization
- The batched completion/update command should not be fully all-or-nothing across every possible write.
- Use an atomic core plus optional tail model: progress, position, and decisions should succeed or fail together as the durable core state transition, while lower-priority writes such as continuity or metrics may fail separately with explicit warning and recovery guidance.
- This preserves speed and auditability without forcing a full retry for a minor trailing write failure.

### Cache Reuse
- Discovery caches may be trusted for the current session because planning files are effectively agent-driven rather than manually edited in parallel.
- That trust ends when bGSD itself writes planning data. Any bGSD-owned write should invalidate and refresh the relevant cached discovery data before later commands reuse it.
- The implementation should optimize for session-speed without silently carrying stale data across tool-driven mutations.

### Discussion Workflow Acceleration
- Do not introduce `discuss-phase --fast` as a distinct shortcut-centric UX.
- The intent behind the roadmap item should be recast into improving the default `discuss-phase` workflow so the normal path gets faster and better instead of splitting behavior across standard and shortcut modes.
- If compatibility pressure exists, a flag can exist only as a thin compatibility surface, but planners should treat acceleration of the default workflow as the real product direction.

### Batch Verification
- `verify-work --batch N` should optimize for the clean path first: use a cheap grouped pass for routine checks so successful batches complete quickly.
- Reporting can stay summary-first on clean runs, but failures must preserve exact confidence by drilling down to item-level results instead of staying vague.
- Failed batches should trigger exact individual verification only for the failing group, so expensive detailed work is paid only where needed.

### Agent's Discretion
- Exact payload shape for the richer snapshot can be tuned by implementation as long as it remains compact, structured, and sufficient for common callers without immediate extra reads.
- Verification batching internals may vary as long as the clean path stays cheap and failed groups get precise individual follow-up.

## Specific Ideas
- Favor one reusable snapshot primitive that gives downstream workflows both identifiers and enough contextual metadata to avoid routine re-reads.
- Keep acceleration focused on standard workflow paths rather than adding more special-purpose command variants.
- Treat cache invalidation around bGSD-owned writes as the main trust boundary, since planning state is agent-managed.

## Stress-Tested Decisions
- Original decision: `phase:snapshot <phase>` should default to a compact core payload with follow-up reads for extra detail.
  - Stress-test revision: Make snapshot richer by default so common callers do not immediately need another command.
  - Follow-on clarification: The richer default must still stay compact and structured rather than expanding into a verbose dump.
- Original decision: Batched state updates should be fully atomic across progress, metrics, decisions, and continuity writes.
  - Stress-test revision: Use an atomic core plus optional tail so the critical state transition stays atomic while minor trailing writes can fail independently.
  - Follow-on clarification: Core state includes progress, position, and decisions; continuity or metrics can be treated as separate tail writes with explicit warnings.
- Original decision: `verify-work --batch N` should run summary-first and rerun failed batches individually for exact reporting.
  - Stress-test revision: Keep the two-stage model only if the first grouped pass is cheap enough to preserve the fast path.
  - Follow-on clarification: Detailed per-item verification should be paid only for failing batches, not for already clean groups.
- Original decision: Add `discuss-phase --fast` as the acceleration surface for low-risk clarification.
  - Stress-test revision: Drop shortcut-centric fast mode and improve the normal discussion workflow instead.
  - Follow-on clarification: Planners should interpret the roadmap requirement as default-flow acceleration rather than a distinct product mode.
- Original decision: Cache reuse can trust the current session unless stale data is detected externally.
  - Stress-test challenge: Manual edits could make that unsafe.
  - Final decision: Keep session-trust because planning files are agent-driven, but invalidate cache whenever bGSD itself writes planning state.

## Deferred Ideas
None - discussion stayed within phase scope.

---
*Phase: 151-snapshot-fast-path-workflow-acceleration*
*Context gathered: 2026-03-28*
