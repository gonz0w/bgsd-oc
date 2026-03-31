# Phase 147: Security Audit Workflow - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary
This phase delivers a single-command security audit workflow that scans application code, source files, and dependency manifests for likely security issues, then presents confidence-gated findings through `/bgsd-security`. It clarifies how broadly to scan, how to present findings, and how users manage false positives, without expanding into new security product areas.

## Implementation Decisions

### Scan Coverage
- Start with core-signal coverage rather than a maximally broad heuristic sweep. Focus the first release on common OWASP-style patterns, secrets detection, and dependency checks where findings are more actionable and less noisy.
- Reasoning: the phase promises confidence-gated security audit results. A narrower, higher-signal launch better matches that promise than broad but noisy coverage that trains users to distrust the output.

### Results Format
- Use an action-first report. Group findings by severity and include confidence, file/location, short rationale, and a concrete next step for each finding.
- Reasoning: this workflow should help users triage and fix issues quickly. Severity-led output supports immediate action better than category-first or raw audit dumps.

### Confidence Gating
- Show high- and medium-confidence findings, with confidence made explicit in the output.
- Reasoning: the user wants broader visibility than a strict high-confidence-only gate, but still wants confidence to shape prioritization. This keeps uncertain results visible without flattening all findings into the same urgency.

### Exclusions Policy
- Keep exclusions narrow at the finding level rather than allowing broad rule or project-wide suppressions.
- Reasoning: security suppressions should stay auditable and hard to abuse. Narrow suppression reduces the risk of hiding real issues while still allowing known false positives to be managed.

### Secrets Handling
- Flag secret-like values by default across the repo, and rely on explicit allowlisting for known fixtures, samples, and test data.
- Reasoning: secrets exposure is high-risk enough that the default should err on surfacing potential problems. Explicit allowlisting makes exceptions visible instead of silently assuming test paths are safe.

### Agent's Discretion
- Exact rule inventory within the chosen core-signal scope.
- Exact formatting details for the action-first report, as long as severity, confidence, location, rationale, and next-step guidance are present.
- Exact thresholding and labeling mechanics for distinguishing high- versus medium-confidence findings.

## Specific Ideas
No specific requirements - open to standard approaches.

## Stress-Tested Decisions
- Core-signal coverage held: the user prefers a conservative first release over broader but noisier OWASP coverage, even after the risk of missed expectations was raised.
- Action-first reporting held: the user still prefers severity-led triage over category-led bulk remediation.
- Showing medium-confidence findings held: concern about alert fatigue did not change the preference, so planning should make confidence labeling and ranking clear.
- Finding-level exclusions held: the user accepted the extra friction in exchange for tighter auditability and lower suppression risk.
- Default-flagging secrets held: the user still prefers explicit allowlisting over path-based auto-relaxation.

## Deferred Ideas
None - discussion stayed within phase scope.

---
*Phase: 147-security-audit-workflow*
*Context gathered: 2026-03-28*
