# Phase 162: Intent Runtime Parity & Legacy Context Stability - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<phase_intent>
## Phase Intent

- **Local Purpose:** Keep legacy phase-context intent fallback behavior identical in source and shipped runtime so rebuilds do not change intent-alignment outcomes.
- **Expected User Change:** Before: maintainers could get different legacy intent results depending on whether they were reading source helpers or the rebuilt shipped CLI. After: source and bundled runtime resolve legacy contexts the same way, so verification and UAT continue to report a stable `not assessed` / unavailable result when the explicit phase-intent block is missing.
  - `init:verify-work 160` stays consistent before and after rebuilding `bin/bgsd-tools.cjs`
  - Legacy contexts such as `.planning/phases/160-phase-intent-alignment-verification/160-CONTEXT.md` do not silently gain guessed phase intent from loose prose
  - Future parser edits fail targeted regressions if source and shipped runtime drift on legacy fallback behavior
- **Non-Goals:**
  - Retrofitting old phase contexts with new explicit phase-intent blocks
  - Changing the aligned / partial / misaligned / not assessed intent-verdict ladder introduced in Phase 160
  - Expanding this phase into a broader intent-model redesign beyond legacy fallback parity

</phase_intent>

<domain>
## Phase Boundary

Keep source and shipped runtime aligned on how they interpret legacy phase contexts that predate the explicit phase-intent block. This phase is about one stable fallback contract for missing local intent, plus regression proof that rebuilds preserve verification and UAT intent-alignment behavior.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Shared fallback authority - Locked. Source helpers and the bundled runtime should rely on one explicit legacy-fallback contract for phase-local intent instead of maintaining parallel interpretations. Reasoning: the milestone audit already identified drift risk between `src/lib/phase-context.js` and shipped runtime behavior, so parity must come from one authoritative rule rather than duplicated logic.
- Legacy-context semantics - Locked. If a phase context lacks the explicit `Phase Intent` block, phase-local intent remains absent and downstream verification/UAT surfaces should keep reporting `not assessed` / unavailable with a plain reason rather than inferring intent from surrounding prose. Reasoning: Phase 160 deliberately chose a no-guess fallback, and this phase exists to keep that exact behavior stable across rebuilds.
- Parity proof path - Locked. Regression coverage must exercise both the source-side intent path and the shipped runtime path against a real legacy context and fail if they disagree on the fallback result. Reasoning: source-only tests would miss the actual rebuild-risk called out by the audit.

### Medium Decisions
- Real legacy artifact first - Locked. Use the existing legacy-shaped `.planning/phases/160-phase-intent-alignment-verification/160-CONTEXT.md` as the primary parity fixture where practical, because it represents the exact backward-compatibility case the audit cited. Reasoning: phase-owned real data is a stronger guardrail than a synthetic markdown sample alone.
- Rebuild is part of the fix - Locked. Any source change affecting phase-intent parsing or intent consumers must be followed by rebuilding `bin/bgsd-tools.cjs` in the same plan slice so shipped behavior stays aligned immediately. Reasoning: this phase is specifically about source-versus-runtime parity, so source-only completion would leave the bug half-fixed.
- Scope stays surgical - Locked. Do not reopen fresh context authoring, verification template wording, or broader intent-cascade design unless directly required to preserve the legacy fallback contract. Reasoning: the roadmap goal is stability for existing legacy contexts, not a second round of Phase 160 feature work.

### Low Defaults and Open Questions
- Fallback wording stays existing-contract friendly - Defaulted. Preserve current `not assessed` / unavailable wording patterns unless a touched runtime surface requires a narrowly clearer plain-language reason. Reasoning: wording churn is lower value than locking the behavior itself.
- Minimal fixture expansion - Defaulted. Add a tiny synthetic fixture only if the real Phase 160 artifact is insufficient to isolate a parser edge case. Reasoning: the real legacy context should do most of the parity work, with extra fixtures used only to close blind spots.

### Agent's Discretion
- Exact file ownership between `src/lib/phase-context.js`, `src/commands/intent.js`, and any rebuilt runtime sections, as long as the final behavior is driven by one explicit fallback contract.
- Exact regression split between unit, integration, and runtime-facing tests, as long as at least one proof path compares source behavior with shipped runtime behavior on a legacy context.
- Exact plain-language reason text for the legacy fallback, as long as it clearly communicates missing explicit phase intent and does not imply guessed confidence.
</decisions>

<specifics>
## Specific Ideas

- The milestone audit explicitly called out `src/lib/phase-context.js`, `.planning/phases/160-phase-intent-alignment-verification/160-CONTEXT.md`, and shipped runtime behavior as the continuity risk that remains after Phase 161.
- The most important observable check is that legacy verification/UAT intent alignment remains stable after rebuilding the CLI, especially on the real Phase 160 legacy context.
- The safest product posture is still the Phase 160 decision: no guessed phase-local intent when the explicit block is missing.
</specifics>

<stress_tested>
## Stress-Tested Decisions

- Shared-authority scope tightened during analysis. Original direction: align source and runtime somehow. Stress-test revision: require one explicit fallback authority plus a rebuild in the same slice so parity is structural, not accidental.
- Regression expectations hardened during analysis. Original direction: add parser coverage. Stress-test revision: prove parity through a real runtime-facing path as well, because source-only tests would miss the rebuild stability risk this phase exists to close.
- Legacy behavior remained intentionally conservative during analysis. Original direction: preserve backward compatibility. Stress-test revision: keep the no-guess `not assessed` / unavailable fallback even if surrounding prose looks suggestive, because inferred intent would make old verification results unstable.
</stress_tested>

<deferred>
## Deferred Ideas

- Legacy-context migration or auto-upgrade tooling - separate future phase if maintainers ever want to backfill old contexts instead of preserving fallback behavior.
- Broader intent-model redesign across project, milestone, and phase layers - out of scope for this parity/stability phase.
</deferred>

---
*Phase: 162-intent-runtime-parity-legacy-context-stability*
*Context gathered: 2026-03-30*
