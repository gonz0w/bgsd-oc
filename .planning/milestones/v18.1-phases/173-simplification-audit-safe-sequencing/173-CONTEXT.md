# Phase 173: Simplification Audit & Safe Sequencing - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Produce one execution-ready milestone audit that shows where the repo can be deleted, simplified, hardened, or deferred before cleanup work starts.
- **Expected User Change:** Before: maintainers and agents know the milestone should simplify the repo, but they do not yet have one audit artifact that shows the concrete cleanup targets, their risk, and the safe order to approach them. After: they can read one canonical audit ledger that maps hotspots to file references, pass coverage, action bucket, confidence, and gate-based stage prerequisites. Examples: an agent can distinguish safe deletions from validate-before-delete suspects without rereading the whole repo; a maintainer can see why router-heavy work waits until earlier low-blast-radius cleanup is done; later planning can lift scored findings directly into cleanup plans instead of rebuilding the audit from scratch.
- **Non-Goals:**
  - Performing the cleanup itself, deleting code, or rewriting command paths in this phase.
  - Turning the audit into a broad product redesign or new feature wishlist beyond cleanup-driven findings.
  - Cataloging every minor style nit with no cleanup leverage, file evidence, or sequencing value.
</phase_intent>

<domain>
## Phase Boundary
Phase 173 delivers a code-review-grade simplification audit for the current milestone. The audit must cover the repo with the requested multi-pass review lens, identify concrete cleanup candidates with file-level references, classify them by action bucket and confidence, and group them into gate-based stages that explain what can land first versus what must wait for stronger proof or prior cleanup. It does not perform the cleanup, and it does not expand the milestone beyond behavior-preserving simplification and hardening.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Audit shape - Locked. Use one primary execution-first audit artifact organized as a canonical findings ledger that later phases can lift from directly, rather than scattered review notes or purely narrative dossiers. Reasoning: the roadmap goal is reviewable and action-guiding, and later cleanup planning should reuse one source of truth instead of rebuilding findings.
- Risk classification - Locked. Classify each finding with a hybrid model: an action bucket such as safe delete, simplify/consolidate, validate before delete, or high-risk refactor/defer, plus an explicit confidence marker. Reasoning: the audit needs to stay scannable while still making it obvious which findings are safe versus proof-dependent.
- Sequencing model - Locked. Replace generic waves with gate-based stages that name the prerequisite or safety boundary for each stage, and avoid fake ordering inside a stage unless one item truly blocks another. Reasoning: later agents need a trustworthy order of operations, but Phase 173 should not pretend it already knows exact execution sequencing where only dependency boundaries are real.

### Medium Decisions
- Evidence threshold - Defaulted. Include high-confidence findings plus medium-confidence suspects only when they have concrete file references and an explicit validate-before-delete note. Reasoning: the audit should be exhaustive enough to be useful, but it must not blur proven cleanup targets with speculation.
- Deferral policy - Defaulted. Keep the audit milestone-local, but include a short explicit defer list for adjacent cleanup that belongs in later phases. Reasoning: this preserves focus while preventing nearby out-of-scope work from disappearing.
- Pass traceability - Locked. Keep one deduped findings ledger as the main artifact, and tag each finding with the relevant review passes instead of repeating the same hotspot in separate sections. Reasoning: the user wants multi-pass coverage, but later agents need one canonical hotspot record rather than inflated duplicate findings.

### Low Defaults and Open Questions
- Presentation density - Defaulted. Keep the audit table-first and concise, with short rationale blocks instead of long narrative review prose.
- Artifact count - Defaulted. Deliver one primary audit artifact rather than a scattered set of parallel notes.
- Speculative labeling - Defaulted. Any non-proven finding must be clearly marked as validate before delete, not implied to be approved cleanup.

### Agent's Discretion
- The implementation can choose the exact scoring formula, column layout, and stage thresholds, but it must preserve the multi-pass coverage, canonical deduped ledger, hybrid action-bucket-plus-confidence model, explicit pass tags, and gate-based staging with stated prerequisites.
</decisions>

<specifics>
## Specific Ideas
- Use the supplied six-pass review structure as the audit lens: dead code and unused exports, redundancy and duplication, simplification opportunities, race conditions and concurrency bugs, error handling and robustness, and code hygiene and maintainability.
- Score findings by at least blast radius, evidence strength, and sequencing dependency so later phases can derive cleanup stages from the audit instead of inventing them.
- Keep each hotspot merged once in the main ledger, then attach pass tags and inline fix notes or replacement sketches where they materially help later cleanup.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: use staged cleanup waves to recommend order of operations.
- Stress-test revision: replace generic waves with gate-based stages that explain why a group can start now and what prerequisite must be satisfied before later work begins.
- Follow-on clarification from post-stress-test reassessment: keep one canonical findings ledger as the main artifact and use pass tags for traceability instead of separate duplicated per-pass finding lists.
- Original decision: keep the audit selective around only the highest-leverage findings.
- Stress-test revision: run an exhaustive multi-pass review of the whole codebase using the supplied audit prompt structure, then score findings so staging comes from evidence rather than guesswork.
- Original decision: separate high-confidence findings from suspects mainly through prose.
- Stress-test revision: make action bucket, confidence, and validate-before-delete status explicit per finding so agents do not confuse proof-needed suspects with safe cleanup.
</stress_tested>

<deferred>
## Deferred Ideas
- Executing deletions, consolidations, router refactors, or command-surface cleanup in this phase.
- Broader product or UX changes that are not directly tied to simplification, hardening, or compatibility cleanup.
- Any future automation that applies or batches audit findings automatically rather than producing the milestone audit first.
</deferred>

---
*Phase: 173-simplification-audit-safe-sequencing*
*Context gathered: 2026-03-31*
