# Phase 152: Cached Handoffs & Fresh-Context Delivery - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary
This phase makes the standard `discuss -> research -> plan -> execute -> verify` loop work across fresh context windows by reusing cached parsed plan reads and durable handoff artifacts. It improves continuity and speed for the existing delivery flow without breaking standalone commands or requiring handoff artifacts in normal one-off use.

## Implementation Decisions

### Fallback Behavior
- Chain behavior is additive rather than a replacement for standalone commands.
- If cached or handoff state is unusable, only `discuss` may restart cleanly without prior chain state.
- `research`, `plan`, `execute`, and `verify` should stop with repair or restart guidance instead of guessing a safe continuation path.
- If external file changes are detected during an active run, the system should warn and rebuild cache or handoff state from source before continuing.
- If that rebuild still cannot produce valid state, stop with repair guidance rather than falling through to a guessed continuation.

### Chain Entrypoints
- Auto-chain behavior should fold into existing `yolo` mode rather than introducing a separate persistent chaining setting.
- Downstream implementation should treat that as an intentional fast-path simplification for power users, not an incidental coupling.

### Handoff Lifecycle
- Write per-step handoff artifacts across `discuss`, `research`, `plan`, `execute`, and `verify` instead of mutating one rolling artifact in place.
- A new run for the same phase should replace older artifacts for that phase so the fast path stays tidy and deterministic.
- Do not maintain a separate current-pointer artifact; resume should derive the active state from the available step artifacts.

### Resume Behavior
- On return in a fresh context window, show a resume summary first rather than silently resuming.
- That summary should offer three actions: resume, inspect handoff details, or restart.
- When resume selection must be computed from artifacts, use the latest valid artifact as the deterministic target.

### Cache Freshness
- Cached parsed plan data may be trusted within the same active run for speed.
- That trust ends immediately when underlying source files change outside the chain; in that case warn and rebuild from source.
- External-change recovery should prefer preserving the fast path through rebuild, but not at the cost of continuing on invalid reconstructed state.

### Agent's Discretion
- Exact JSON schema and field names for per-step handoff artifacts may vary as long as they stay compact, machine-oriented, and sufficient for deterministic resume.
- The specific UX wording for warnings, resume summaries, and repair guidance may vary as long as the locked behaviors above remain clear.

## Specific Ideas
- Keep the product centered on the standard workflow loop rather than inventing a separate long-lived transcript experience.
- Let `yolo` become the power-user fast path for chained delivery.
- Prefer explicit resume summaries over silent continuation so users can see where the chain thinks they are.
- Use per-step artifacts for traceability, but keep retention deterministic by replacing the prior same-phase run.

## Stress-Tested Decisions
- Original decision: Use `yolo` as the chain-continuation setting.
  - Stress-test challenge: Users may see that as one setting doing two jobs: approval style and chaining behavior.
  - Final decision: Keep chaining folded into `yolo`, but treat that coupling as an intentional power-user fast path rather than accidental overlap.
- Original decision: Keep per-step artifacts and also maintain a separate current-pointer artifact for quick resume.
  - Stress-test revision: Drop the separate pointer because duplicate state would undermine trust if it drifted from the artifact set.
  - Follow-on clarification: Resume should derive the target from the latest valid artifact.
- Original decision: Trust cache within the same run and invalidate immediately on external file changes.
  - Stress-test revision: On external change, warn and rebuild from source instead of immediately collapsing the chain.
  - Follow-on clarification: If rebuild still fails validation, stop with repair guidance rather than continuing.
- Original decision: Only `discuss` may restart cleanly without prior chain state; later steps should fail closed with repair guidance.
  - Stress-test result: This held up under challenge and remained unchanged.

## Deferred Ideas
None - discussion stayed within phase scope.

---
*Phase: 152-cached-handoffs-fresh-context-delivery*
*Context gathered: 2026-03-28*
