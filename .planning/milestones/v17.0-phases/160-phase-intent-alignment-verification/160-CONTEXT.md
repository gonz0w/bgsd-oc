# Phase 160: Phase Intent & Alignment Verification - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary
Add a lightweight phase-intent block directly to phase `CONTEXT.md` artifacts and make verification/UAT judge whether shipped work matched that local purpose, not just whether requirement-linked work was completed. This phase clarifies the intended user-facing change each phase should unlock and makes intent alignment a first-class review outcome without introducing a separate top-level phase-intent file.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Phase intent contract - Locked. Every phase context should include a fixed 3-field intent block: local purpose, expected user change, and non-goals. Reasoning: this gives planners and verifiers the minimum durable signal needed for alignment checks without bloating `CONTEXT.md` or creating a second intent artifact.
- Verifiable intent wording - Locked. `Expected user change` must be phrased as an observable before/after style claim, and both `expected user change` and `non-goals` should include 1-3 concrete examples. Reasoning: intent is more critical than raw requirement completion, so verifiers need concrete claims they can prove or disprove instead of hindsight-friendly prose.
- Intent alignment verdict model - Locked. Verification and UAT should report a 3-state verdict: aligned, partial, or misaligned, with a short explanation tied to local purpose, expected user change, and non-goals. Reasoning: alignment needs more structure than freeform commentary, but a binary pass/fail would hide meaningful near-miss cases.
- Core-change miss threshold - Locked. If the core expected user change does not land, the intent verdict must be `misaligned`; `partial` is reserved for supporting or edge-shaping drift only. Reasoning: technically correct work can still produce a useless product, so the verdict must clearly distinguish missing the main user value from smaller scope misses.

### Medium Decisions
- Verification/UAT presentation order - Locked. Intent alignment should appear before or alongside requirement coverage in verification and UAT outputs so the first scan answers whether the phase delivered its claimed user-facing change. Reasoning: if intent is the product-value judgment, it cannot be buried beneath implementation-completeness details.
- Partial verdict explanation contract - Locked. Any `partial` verdict must explicitly name what landed, what did not, and whether the miss was only supporting/edge shaping rather than the core expected user change. Reasoning: this keeps `partial` actionable instead of becoming a safe hedge.
- Backward compatibility posture - Locked. Older phases without the new phase-intent block should not receive a guessed alignment verdict; verification/UAT should mark intent alignment as unavailable or not assessed with a plain reason. Reasoning: the repo should not rehash older phases or fake confidence from missing inputs.

### Low Defaults and Open Questions
- Intent block stays local to `CONTEXT.md` - Defaulted. Do not create a separate top-level phase-intent file. Reasoning: the phase-local purpose belongs near discussion and planning artifacts agents already read.
- Plain-language user value - Defaulted. Verifier and UAT outputs should explain the claimed user-facing change in plain language, not only requirement IDs or internal traceability labels. Reasoning: alignment is about product usefulness, so the review should stay readable to humans.
- Label wording can stay simple - Defaulted. Use straightforward wording such as `Intent Alignment` and `Requirement Coverage` unless implementation details reveal a clearer label during planning. Reasoning: terminology polish is lower risk than the actual judgment contract.

### Agent's Discretion
- Exact markdown shape and heading placement for the new phase-intent block inside `CONTEXT.md`, as long as the 3 required fields stay explicit and lightweight.
- Exact phrasing templates for aligned/partial/misaligned explanations, as long as they preserve the locked core-miss rule and actionable detail.
- Exact fallback wording for unavailable intent alignment on legacy phases, as long as it stays explicit and does not imply guessed confidence.
</decisions>

<specifics>
## Specific Ideas
- The user explicitly said intent is more critical than requirements because a phase can be technically correct while still delivering a useless product.
- The user wants `expected user change` to be concrete enough that a verifier can actually prove or disprove it.
- The user agreed non-goals should name tempting adjacent work the phase is explicitly not trying to solve.
- The user wants intent alignment surfaced early in verification/UAT so reviewers can quickly scan whether the promised user change actually landed.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Intent verdict priority changed during stress testing. Original decision: use a 3-state aligned/partial/misaligned verdict with explanation. Stress-test revision: treat intent as the more critical product-value judgment than requirement coverage, and move intent alignment before or alongside requirement coverage in review outputs.
- Phase intent wording tightened during stress testing. Original decision: fixed 3-field intent block. Stress-test revision: require observable before/after phrasing plus 1-3 concrete examples so verifiers can prove or disprove the claimed user change and scope boundaries.
- Backward-compatibility confidence was narrowed during stress testing. Original decision: older phases would need some degraded alignment handling. Stress-test revision: do not rehash old phases or guess intent verdicts when the new block is missing; mark alignment unavailable/not assessed instead.
- `Partial` verdict semantics tightened during stress testing. Original decision: keep a middle state for nuanced cases. Stress-test revision: `partial` is only for supporting or edge drift; if the core expected user change misses, the verdict is `misaligned`.
</stress_tested>

<deferred>
## Deferred Ideas
- None - discussion stayed within phase scope.
</deferred>

---
*Phase: 160-phase-intent-alignment-verification*
*Context gathered: 2026-03-30*
