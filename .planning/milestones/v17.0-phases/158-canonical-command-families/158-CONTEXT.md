# Phase 158: Canonical Command Families - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary
Shrink the visible bGSD slash-command surface into a smaller set of canonical grouped families while preserving legacy command routing as a migration-only compatibility layer.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Family map - Planning umbrella for grouped flows. - Disposition: Locked. Use `/bgsd-plan` as the master command for phase planning, roadmap, and todo flows; keep `/bgsd-settings` separate and introduce `/bgsd-inspect` for advanced read-only inspection so the visible surface gets smaller without fragmenting planning-oriented entrypoints.
- Migration posture - Hide legacy almost entirely. - Disposition: Locked. Canonical commands are the only documented and preferred surface; legacy commands continue to resolve for compatibility but stay out of help/docs so the product behaves like a greenfield command set.

### Medium Decisions
- Inspection boundary - Strict read-only diagnostics hub. - Disposition: Locked. `/bgsd-inspect` should own cross-cutting read/analysis flows such as progress, impact, trace, decision/lesson search, and health-style inspection, while mutating or domain-specific review/security/readiness/release commands stay in their existing families.

### Low Defaults and Open Questions
- Quick entry - Canonical quick path. - Disposition: Defaulted. `/bgsd-quick` is the single recommended quick-entry command and `/bgsd-quick-task` remains a compatibility alias only, matching the phase success criteria.
- Workflow parity - Same underlying behavior across entrypoints. - Disposition: Defaulted. Canonical commands and legacy aliases should resolve to equivalent underlying behavior rather than diverging into near-duplicate flows.
- Alias wording - Minimal compatibility messaging. - Disposition: Defaulted. Because this is a greenfield rollout with no active users, legacy aliases do not need prominent messaging; they can remain thin compatibility routes unless Phase 159 decides to surface one-time hints.

### Agent's Discretion
No additional agent-discretion areas were delegated. Implementation can choose exact command names and internal routing details as long as they preserve the locked family map, canonical-first surface, and strict `/bgsd-inspect` boundary.
</decisions>

<specifics>
## Specific Ideas
- User intent is for `/bgsd-plan` to be the master command, not just one sibling among many grouped surfaces.
- Todos should be treated as plan-scoped only; the user only wants to add todos to plans, not maintain a standalone general task-tracking surface.
- Legacy compatibility exists only as a safety net; the user explicitly does not want migration comfort or dual-surface documentation to shape the design.
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing - no revisions needed.

Stress-tested and confirmed:
- Plan-scoped todos under `/bgsd-plan` remained intentional after challenging whether todo management deserved its own surface.
- Hidden legacy aliases remained acceptable because the product is greenfield and compatibility is treated as a low-cost internal safeguard, not a user-migration program.
- `/bgsd-inspect` stayed locked as a strict read-only diagnostics hub with no review/security/readiness leakage.
- `/bgsd-plan` staying the master command remained acceptable even with roadmap and todo responsibilities grouped under it.
</stress_tested>

<deferred>
## Deferred Ideas
- Whether legacy alias invocations should show a one-time canonical replacement hint was left open for later help-surface work and fits better in Phase 159 if needed.
</deferred>

---
*Phase: 158-canonical-command-families*
*Context gathered: 2026-03-29*
