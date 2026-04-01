# Phase 180: Command Validator Drift Resolution - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Restore trust in milestone-close command-integrity proof by aligning the validator's supported-command contract with the surfaced command guidance that Phase 180 is responsible for proving.
- **Expected User Change:** Before: maintainers could get red or misleading command-integrity results because the validator, surfaced guidance, and named exception cases did not agree on the supported command contract. After: maintainers can run `util:validate-commands --raw` and trust the result because the covered surfaced files, narrow exclusions, and legitimate special cases all match the validator's contract. Examples: built runtime next-step guidance validates against the same canonical planning-family grammar the docs teach; quoted examples, redirects, and internal-bootstrap cases are classified intentionally instead of reported as generic command failures; the validator reports the proof inventory and named exclusions it used so a green result has a stable meaning.
- **Non-Goals:**
  - Building a new general-purpose command linter or expanding validation beyond the milestone-close surfaced command family
  - Lowering the proof bar to only user-facing files while treating agent and workflow surfaces as optional hygiene
  - Spending this phase on report polish or unrelated docs cleanup unless required to make the proof contract trustworthy
</phase_intent>

<domain>
## Phase Boundary
This phase delivers trustworthy command-integrity proof for the surfaced milestone-close command family across docs, workflows, agents, and built runtime guidance. It clarifies the supported-command contract, names the narrow exclusions that are intentionally out of scope, and then reconciles remaining surfaced drift against that settled contract.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Proof scope — Locked. Phase closure must validate all surfaced milestone-close proof files across docs, workflows, agents, and built runtime guidance. Only explicit, named internal-bootstrap or similarly intentional exclusions may sit outside the green proof surface.
- Drift resolution policy — Locked. Use a hybrid policy, but sequence it contract-first: first tighten the validator's supported-command and exception rules, then update only the surfaced files that still legitimately drift from that settled contract. This avoids both loophole-heavy validator growth and repo-wide wording churn.

### Medium Decisions
- Closure evidence style — Defaulted, then stress-tested stronger. `util:validate-commands --raw` remains the primary closure proof, but Phase 180 must back that green result with targeted risk checks for the changed classes, fixed regression coverage for newly supported or excluded cases, and an explicit proof inventory plus named exclusions.
- Proof inventory ownership — Locked after stress-test reassessment. The validator's own output should be the authoritative source of covered surfaced files/classes and named exclusions so maintainers do not have to trust a second drifting manifest.

### Low Defaults and Open Questions
- Validator output/reporting polish — Defaulted. Improve reporting only as far as needed to make coverage, classifications, and exclusions trustworthy; do not broaden this phase into a reporting UX project.

### Agent's Discretion
- The planner may choose the smallest implementation slice that achieves validator-owned proof inventory, stable classification behavior, and minimal file spread, as long as the proof-scope and contract-first sequencing decisions remain intact.
</decisions>

<specifics>
## Specific Ideas
- Keep the proof bar strict enough that milestone-close evidence still means "all surfaced command guidance in scope validated," not "we narrowed the audit until it turned green."
- Treat quoted examples, redirects, and internal-bootstrap patterns as legitimate special cases only when they are classified explicitly and deterministically.
- Prefer a validator contract that explains what was covered and what was intentionally excluded over one that only emits pass/fail counts.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Original decision: keep all surfaced milestone-close proof files in scope with only narrow named exclusions.
  - Stress-test result: held. The strict proof bar stays in place; we are not splitting user-facing versus secondary proof surfaces.
- Original decision: use a hybrid rewrite-plus-exception policy.
  - Stress-test revision: hybrid remains correct, but sequencing is now explicit: settle validator/support rules first, then repair only the surfaced files that still drift.
- Original decision: let `util:validate-commands --raw` serve as the primary closure proof with targeted smokes as supporting evidence.
  - Stress-test revision: a green validator run alone is not enough. The plan must also provide targeted trust checks for changed risk areas, fixed regression coverage for changed classifications, and a durable proof inventory with named exclusions.
  - Follow-on clarification: the validator's own output should own that proof inventory and exclusion list so the repo does not gain a second source of truth.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 180-command-validator-drift-resolution*
*Context gathered: 2026-04-01*
